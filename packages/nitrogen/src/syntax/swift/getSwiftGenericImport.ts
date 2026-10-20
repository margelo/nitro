import type { SourceImport } from '../SourceFile.js'

/**
 * Imports a generic Swift stdlib type, such as `swift::Optional`, for bridge headers and their implementations.
 *
 * Swift's importer reads bridge headers before any generated -Swift.h exists, so it only gets a forward declaration.
 * Generated -Swift.h headers define these types with a constraint that only holds after their primitive
 * specializations, so C++ includes a -Swift.h before the bridge header and skips the forward declaration.
 *
 * TODO: Remove this workaround, and include the bridge header first again in createSwiftUmbrellaHeader.ts,
 * once our minimum Xcode includes https://github.com/swiftlang/swift/pull/93299. Its toolchain header
 * declares these types before any -Swift.h.
 */
export function getSwiftGenericImport(
  name: 'Optional' | 'Array',
  jsiConverterHeader: string
): SourceImport<'c++'> {
  const forwardDeclaration = `
#ifndef SWIFT_SWIFT_H
namespace swift { template <class T> class ${name}; }
#endif
`.trim()
  return {
    language: 'c++',
    declaration: { forwardDeclaration: forwardDeclaration },
    implementation: { name: jsiConverterHeader, space: 'system' },
  }
}
