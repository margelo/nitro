import type { SourceImport } from '../SourceFile.js'

/**
 * Generates C++ code for including a `NitroModules` header.
 * @example `Hash.hpp` -> `#include <NitroModules/Hash.hpp>`
 */
export function includeNitroHeader(headerName: string): string {
  return `
#if __has_include(<NitroModules/${headerName}>)
#include <NitroModules/${headerName}>
#else
#error NitroModules cannot be found! Are you sure you installed NitroModules properly?
#endif
  `.trim()
}

export function includeHeader(
  sourceImport: SourceImport,
  force = true
): string {
  const header = getHeader(sourceImport.name, sourceImport.space)
  if (force) {
    return `#include ${header}`
  } else {
    return `
#if __has_include(${header})
 #include ${header}
#endif
    `.trim()
  }
}

/**
 * Includes a module-local header through its iOS framework name.
 * System headers are already qualified and stay unchanged.
 */
export function includeModuleHeader(
  sourceImport: SourceImport,
  moduleName: string,
  force = true
): string {
  if (sourceImport.space === 'system') {
    return includeHeader(sourceImport, force)
  }

  return includeHeader(
    {
      ...sourceImport,
      name: `${moduleName}/${sourceImport.name}`,
      space: 'system',
    },
    force
  )
}

export function sortSourceImports(
  sourceImports: SourceImport[]
): SourceImport[] {
  return [...sourceImports].sort((left, right) => {
    const leftHeader = getHeader(left.name, left.space)
    const rightHeader = getHeader(right.name, right.space)
    if (leftHeader < rightHeader) return -1
    if (leftHeader > rightHeader) return 1
    return 0
  })
}

function getHeader(name: string, space: 'user' | 'system'): string {
  switch (space) {
    case 'user':
      return `"${name}"`
    case 'system':
      return `<${name}>`
  }
}
