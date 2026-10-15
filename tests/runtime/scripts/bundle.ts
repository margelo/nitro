import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const files = [...new Bun.Glob("**/*.test.ts").scanSync(`${root}js`)].sort();
const program = ts.createProgram(
  files.map((file) => `${root}js/${file}`),
  {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
  },
);
const checker = program.getTypeChecker();
const imports = ['import { registerTests } from "../js/index";'];
const entries: string[] = [];
const names: string[] = [];

for (const [index, file] of files.entries()) {
  const source = program.getSourceFile(`${root}js/${file}`)!;
  const module = checker.getSymbolAtLocation(source);
  if (module === undefined) throw new Error(`No exported tests in ${file}`);
  imports.push(
    `import * as suite${index} from ${JSON.stringify(`../js/${file}`)};`,
  );
  const exports = checker
    .getExportsOfModule(module)
    .sort((a, b) => a.name.localeCompare(b.name));
  let count = 0;
  for (const symbol of exports) {
    const value =
      symbol.flags & ts.SymbolFlags.Alias
        ? checker.getAliasedSymbol(symbol)
        : symbol;
    if (!(value.flags & ts.SymbolFlags.Value)) continue;
    const signatures = checker
      .getTypeOfSymbolAtLocation(symbol, source)
      .getCallSignatures();
    if (
      symbol.name === "default" ||
      !signatures.some((signature) => signature.parameters.length === 0)
    ) {
      throw new Error(
        `${file}: export ${symbol.name} must be a named test function with no arguments`,
      );
    }
    const name = `${file.replace(/\.test\.ts$/, "")}.${symbol.name}`;
    names.push(name);
    entries.push(
      `${JSON.stringify(name)}: suite${index}[${JSON.stringify(symbol.name)}]`,
    );
    count++;
  }
  if (count === 0) throw new Error(`No exported tests in ${file}`);
}
if (names.length === 0) throw new Error("No *.test.ts cases found");
if (new Set(names).size !== names.length)
  throw new Error("Duplicate test names");

// Discovery reads exports without evaluating test modules in Bun. The same names
// drive the JS dispatcher and the native runners' parameterized test cases.
await Bun.write(
  `${root}build/runtime-entry.ts`,
  `${imports.join("\n")}\nregisterTests({\n${entries.join(",\n")}\n});\n`,
);
const result = await Bun.build({
  entrypoints: [`${root}build/runtime-entry.ts`],
  outdir: `${root}build`,
  naming: "runtime-tests.js",
  target: "browser", // Module resolution; this does not downlevel JS for Hermes.
  format: "iife",
  sourcemap: "external",
  minify: false,
});
if (!result.success)
  throw new AggregateError(result.logs, "Test bundle failed");
await Bun.write(
  `${root}build/runtime-tests.json`,
  `${JSON.stringify(names, null, 2)}\n`,
);
console.log(
  `Bundled ${names.length} shared runtime tests into build/runtime-tests.js`,
);
