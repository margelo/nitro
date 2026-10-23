import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('../', import.meta.url))
const files = [...new Bun.Glob('**/*.test.ts').scanSync(`${root}js`)].sort()
const program = ts.createProgram(
  files.map((file) => `${root}js/${file}`),
  {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
  }
)
const checker = program.getTypeChecker()
const imports = ['import { registerTests } from "../js/index";']
const entries: string[] = []
const suites: Record<string, string[]> = {}
const skips: Record<string, Record<string, string>> = {}

function requireTest(type: ts.Type, label: string): void {
  if (!type.getCallSignatures().some((signature) => signature.parameters.length === 0)) {
    throw new Error(`${label} must be a test function with no arguments`)
  }
}

function literalProperties(type: ts.Type, label: string): ts.Symbol[] {
  if (type.getStringIndexType() || type.getNumberIndexType()) {
    throw new Error(`${label} must have statically known test names, not an index signature`)
  }
  return type.getProperties().sort((a, b) => a.name.localeCompare(b.name))
}

for (const [index, file] of files.entries()) {
  const source = program.getSourceFile(`${root}js/${file}`)
  if (source === undefined) throw new Error(`Could not read test suite ${file}`)
  const module = checker.getSymbolAtLocation(source)
  if (module === undefined) throw new Error(`No exported tests in ${file}`)
  imports.push(`import * as suite${index} from ${JSON.stringify(`../js/${file}`)};`)
  const exports = checker.getExportsOfModule(module).sort((a, b) => a.name.localeCompare(b.name))
  const names: string[] = []
  const prefix = file.replace(/\.test\.ts$/, '')
  for (const symbol of exports) {
    const value = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
    if (!(value.flags & ts.SymbolFlags.Value)) continue
    const type = checker.getTypeOfSymbolAtLocation(symbol, source)
    if (symbol.name === 'skips') {
      for (const entry of literalProperties(type, `${file}: skips`)) {
        const rules: Record<string, string> = {}
        const entryType = checker.getTypeOfSymbolAtLocation(entry, source)
        for (const rule of literalProperties(entryType, `${file}: skips.${entry.name}`)) {
          const reason = checker.getTypeOfSymbolAtLocation(rule, source)
          if (!['apple', 'android', 'release'].includes(rule.name) || !reason.isStringLiteral() || !reason.value.trim()) {
            throw new Error(`${file}: ${entry.name} exclusion must have an apple/android/release key and a literal reason`)
          }
          rules[rule.name] = reason.value
        }
        if (Object.keys(rules).length === 0) throw new Error(`${file}: empty exclusion for ${entry.name}`)
        skips[`${prefix}.${entry.name}`] = rules
      }
      continue
    }
    if (symbol.name === 'cases') {
      for (const test of literalProperties(type, `${file}: cases`)) {
        requireTest(checker.getTypeOfSymbolAtLocation(test, source), `${file}: ${test.name}`)
        const name = `${prefix}.${test.name}`
        names.push(name)
        entries.push(`${JSON.stringify(name)}: suite${index}.cases[${JSON.stringify(test.name)}]`)
      }
      continue
    }
    if (symbol.name === 'default') throw new Error(`${file}: tests must have named exports`)
    requireTest(type, `${file}: export ${symbol.name}`)
    const name = `${prefix}.${symbol.name}`
    names.push(name)
    entries.push(`${JSON.stringify(name)}: suite${index}[${JSON.stringify(symbol.name)}]`)
  }
  if (names.length === 0) throw new Error(`No exported tests in ${file}`)
  suites[prefix] = names
}
const names = Object.values(suites).flat()
if (names.length === 0) throw new Error('No *.test.ts cases found')
if (new Set(names).size !== names.length) throw new Error('Duplicate test names')
const nameSet = new Set(names)
for (const name of Object.keys(skips)) {
  if (!nameSet.has(name)) throw new Error(`Exclusion refers to unknown test: ${name}`)
}

// Discovery reads exports without evaluating test modules in Bun. Each file is
// one suite, and native runners execute its cases sequentially in one runtime.
await Bun.write(`${root}build/runtime-entry.ts`, `${imports.join('\n')}\nregisterTests({\n${entries.join(',\n')}\n});\n`)
const result = await Bun.build({
  entrypoints: [`${root}build/runtime-entry.ts`],
  outdir: `${root}build`,
  naming: 'runtime-tests.js',
  target: 'browser', // Module resolution; this does not downlevel JS for Hermes.
  format: 'iife',
  sourcemap: 'external',
  minify: false,
})
if (!result.success) throw new AggregateError(result.logs, 'Test bundle failed')
await Bun.write(`${root}build/runtime-tests.json`, `${JSON.stringify(suites, null, 2)}\n`)
await Bun.write(`${root}build/runtime-test-skips.json`, `${JSON.stringify(skips, null, 2)}\n`)
console.log(`Bundled ${names.length} tests in ${files.length} runtime suites into build/runtime-tests.js`)
