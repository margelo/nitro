import type { FileWithReferencedTypes } from '../SourceFile.js'
import { createFileMetadataString, isNotDuplicate } from '../helpers.js'
import { indent } from '../../utils.js'
import { includeHeader, includeNitroHeader } from './includeNitroHeader.js'
import { NitroConfig } from '../../config/NitroConfig.js'
import type { DiscriminatedUnionType } from '../types/DiscriminatedUnionType.js'

/**
 * Generates a C++ JSIConverter specialization for a discriminated union.
 * The discriminant property (e.g. `kind`) is read first to decide which
 * struct to deserialize into, then delegated to that struct's own JSIConverter.
 */
export function createCppDiscriminatedUnion(
  union: DiscriminatedUnionType
): FileWithReferencedTypes {
  const { unionName, discriminantKey, variants } = union
  const fullyQualifiedVariants = variants
    .map((v) => v.type.getCode('c++', { fullyQualified: true }))
    .filter(isNotDuplicate)
  const cxxVariantType = `std::variant<${fullyQualifiedVariants.join(', ')}>`

  // fromJSI: switch on the discriminant string value
  const fromJsiCases = variants
    .map(
      (v) =>
        `case hashString("${v.discriminantValue}"): return JSIConverter<${v.type.getCode('c++', { fullyQualified: true })}>::fromJSI(runtime, arg);`
    )
    .join('\n')

  // toJSI: generic lambda dispatch — serialize struct then inject discriminant key back
  const toJsiDiscriminants = variants
    .map(
      (v) =>
        `if constexpr (std::is_same_v<T, ${v.type.getCode('c++', { fullyQualified: true })}>)\n  obj.setProperty(runtime, PropNameIDCache::get(runtime, "${discriminantKey}"), JSIConverter<std::string>::toJSI(runtime, "${v.discriminantValue}"));`
    )
    .join('\nelse ')
  // canConvert: check discriminant is present and is a known value
  const canConvertCases = variants
    .map((v) => `case hashString("${v.discriminantValue}"):`)
    .join('\n')

  // Includes for each constituent struct
  const includedTypes = variants.flatMap((v) =>
    v.type.getRequiredImports('c++')
  )
  const forwardDeclarations = includedTypes
    .map((i) => i.forwardDeclaration)
    .filter((v) => v != null)
    .filter(isNotDuplicate)
  const extraIncludes = includedTypes
    .map((i) => includeHeader(i))
    .filter(isNotDuplicate)

  const cxxNamespace = NitroConfig.current.getCxxNamespace('c++')

  const code = `
${createFileMetadataString(`${unionName}.hpp`)}

#pragma once

#include <variant>
${includeNitroHeader('NitroHash.hpp')}
${includeNitroHeader('JSIConverter.hpp')}
${includeNitroHeader('NitroDefines.hpp')}
${includeNitroHeader('JSIHelpers.hpp')}
${includeNitroHeader('PropNameIDCache.hpp')}

${forwardDeclarations.join('\n')}

${extraIncludes.join('\n')}

namespace margelo::nitro {

  // C++ ${cxxNamespace}::${unionName} <> JS ${unionName} (discriminated union on "${discriminantKey}")
  template <>
  struct JSIConverter<${cxxVariantType}> final {
    static inline ${cxxVariantType} fromJSI(jsi::Runtime& runtime, const jsi::Value& arg) {
      jsi::Object obj = arg.asObject(runtime);
      std::string discriminant = JSIConverter<std::string>::fromJSI(
        runtime, obj.getProperty(runtime, PropNameIDCache::get(runtime, "${discriminantKey}"))
      );
      switch (hashString(discriminant.c_str(), discriminant.size())) {
        ${indent(fromJsiCases, '        ')}
        default: [[unlikely]]
          throw std::invalid_argument(
            "Cannot convert JS object to ${unionName}: unknown discriminant \\"" + discriminant + "\\" for key \\"${discriminantKey}\\"!"
          );
      }
    }
    static inline jsi::Value toJSI(jsi::Runtime& runtime, const ${cxxVariantType}& arg) {
      return std::visit(
        [&runtime](const auto& val) {
          // Serialize the struct, then inject the discriminant key back
          // so JS receives the full discriminated object (e.g. { kind: 'truck', payload: 1000 })
          using T = std::decay_t<decltype(val)>;
          jsi::Value result = JSIConverter<T>::toJSI(runtime, val);
          jsi::Object obj = result.asObject(runtime);
          ${indent(toJsiDiscriminants, '          ')}
          return jsi::Value(runtime, obj);
        },
        arg
      );
    }
    static inline bool canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
      if (!value.isObject()) {
        return false;
      }
      jsi::Object obj = value.getObject(runtime);
      if (!nitro::isPlainObject(runtime, obj)) {
        return false;
      }
      jsi::Value discriminantVal = obj.getProperty(runtime, PropNameIDCache::get(runtime, "${discriminantKey}"));
      if (!discriminantVal.isString()) {
        return false;
      }
      std::string discriminant = JSIConverter<std::string>::fromJSI(runtime, discriminantVal);
      switch (hashString(discriminant.c_str(), discriminant.size())) {
        ${indent(canConvertCases, '        ')}
          return true;
        default:
          return false;
      }
    }
  };

} // namespace margelo::nitro
  `

  return {
    content: code,
    name: `${unionName}.hpp`,
    subdirectory: [],
    language: 'c++',
    referencedTypes: variants.map((v) => v.type),
    platform: 'shared',
  }
}
