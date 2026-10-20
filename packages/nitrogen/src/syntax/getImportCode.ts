import type { SourceImport } from './SourceFile.js'

const swiftImportAccess = { private: 0, internal: 1, public: 2 }

/** Render each import once, keeping the widest access required for Swift modules. */
export function getImportsCode(
  sourceImports: SourceImport[],
  context: 'declaration' | 'implementation' = 'declaration'
): string {
  const imports = new Map<string, SourceImport>()
  for (const sourceImport of sourceImports) {
    const key =
      sourceImport.language === 'swift'
        ? `swift:${sourceImport.name}`
        : getImportCode(sourceImport, context)
    const existing = imports.get(key)
    if (
      sourceImport.language === 'swift' &&
      existing?.language === 'swift' &&
      swiftImportAccess[existing.access] >=
        swiftImportAccess[sourceImport.access]
    ) {
      continue
    }
    imports.set(key, sourceImport)
  }
  return [...imports.values()].map((i) => getImportCode(i, context)).join('\n')
}

export function getImportCode(
  sourceImport: SourceImport,
  context: 'declaration' | 'implementation' = 'declaration'
): string {
  switch (sourceImport.language) {
    case 'c++': {
      const { declaration, implementation } = sourceImport
      if (context === 'implementation' && implementation != null) {
        return includeHeader(implementation.name, implementation.space)
      }
      if ('name' in declaration) {
        return includeHeader(declaration.name, declaration.space)
      }
      if (context === 'declaration') {
        return declaration.forwardDeclaration
      }
      return ''
    }
    case 'swift':
      if (
        'declaration' in sourceImport ||
        'forwardDeclaration' in sourceImport
      ) {
        throw new Error(
          `Forward declarations are not supported in ${sourceImport.language}`
        )
      }
      return `${sourceImport.access} import ${sourceImport.name}`
    case 'kotlin':
      if (
        'declaration' in sourceImport ||
        'forwardDeclaration' in sourceImport
      ) {
        throw new Error(
          `Forward declarations are not supported in ${sourceImport.language}`
        )
      }
      return `import ${sourceImport.name}`
  }
}

function includeHeader(name: string, space: 'user' | 'system'): string {
  switch (space) {
    case 'user':
      return `#include "${name}"`
    case 'system':
      return `#include <${name}>`
  }
}
