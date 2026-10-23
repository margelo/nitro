import { indent } from '../../utils.js'
import { createFileMetadataString } from '../helpers.js'
import type { SourceFile } from '../SourceFile.js'
import type { KotlinEnumType } from './types/KotlinEnumType.js'
import { getImportCode } from '../getImportCode.js'

/** Escapes a JS string value for a Kotlin string literal, where `$` starts a template. */
function toKotlinStringLiteral(value: string): string {
  return `"${value.replace(/[\\"$]/g, (character) => `\\${character}`)}"`
}

export function createKotlinEnum(enumType: KotlinEnumType): SourceFile[] {
  const members = enumType.enumMembers.map((m) => `${m.name.toUpperCase()}(${m.value})`)
  const toStringCases = enumType.enumMembers.map((m) => `${m.name.toUpperCase()} -> ${toKotlinStringLiteral(m.stringValue)}`)
  const fromStringCases = enumType.enumMembers.map((m) => `${toKotlinStringLiteral(m.stringValue)} -> ${m.name.toUpperCase()}`)
  const packageName = enumType.config.getAndroidPackage('java/kotlin')
  const code = `
${createFileMetadataString(`${enumType.enumName}.kt`)}

package ${packageName}

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip

/**
 * Represents the JavaScript enum/union "${enumType.enumName}".
 */
@DoNotStrip
@Keep
enum class ${enumType.enumName}(@DoNotStrip @Keep val value: Int) {
  ${indent(members.join(',\n'), '  ')};

  /**
   * Get the String value this ${enumType.enumName} represents.
   */
  val stringValue: String
    get() =
      when (this) {
        ${indent(toStringCases.join('\n'), '        ')}
      }

  override fun toString(): String = stringValue

  companion object {
    /**
     * Get a ${enumType.enumName} for the given String value, or
     * return \`null\` if the given value was invalid/unknown.
     */
    fun fromString(value: String): ${enumType.enumName}? =
      when (value) {
        ${indent(fromStringCases.join('\n'), '        ')}
        else -> null
      }
  }
}
  `.trim()

  const cxxNamespace = enumType.config.getCxxNamespace('c++')
  const jniClassDescriptor = enumType.config.getAndroidPackage('c++/jni', enumType.enumName)
  const jniClass = enumType.getCode('c++', { context: 'type-argument', fullyQualified: true })
  const nativeType = `jni::local_ref<${jniClass}>`
  const values = [...new Set(enumType.enumMembers.map((member) => member.value))]
  const rawMembers = values.map((value) => {
    const member = enumType.enumMembers.find((candidate) => candidate.value === value)
    if (member == null) throw new Error(`Missing ${enumType.enumName} member ${value}`)
    return member
  })
  const javaCases = rawMembers.map((member) => {
    const field = `field_${member.name}`
    const instance = `instance_${member.name}`
    return `
case ${member.value}: {
  static const auto ${field} = clazz->getStaticField<${enumType.jniName}>("${member.name}");
  static const auto ${instance} = jni::make_global(clazz->getStaticFieldValue(${field}));
  return ${instance};
}
`.trim()
  })
  let fromJSI: string
  let toJSI: string
  let canConvert: string
  if (enumType.jsType === 'union') {
    const fromCases = enumType.enumMembers.map((member) => `case hashString("${member.stringValue}"): return ${member.value};`)
    const toCases = enumType.enumMembers.map((member) => `case ${member.value}: return createJSIString<"${member.stringValue}">(runtime);`)
    const checkCases = enumType.enumMembers.map((member) => `case hashString("${member.stringValue}"): return true;`)
    fromJSI = `
const auto string = value.asString(runtime).utf8(runtime);
switch (hashString(string)) {
  ${indent(fromCases.join('\n'), '  ')}
  default: [[unlikely]]
    throw std::invalid_argument("Cannot convert \\"" + string + "\\" to enum ${enumType.enumName} - invalid value!");
}
`.trim()
    toJSI = `
switch (value->value()) {
  ${indent(toCases.join('\n'), '  ')}
  default: [[unlikely]]
    throw std::invalid_argument("Cannot convert ${enumType.enumName} to JS - invalid value: " + std::to_string(value->value()) + "!");
}
`.trim()
    canConvert = `
if (!value.isString()) return false;
const auto string = value.getString(runtime).utf8(runtime);
switch (hashString(string)) {
  ${indent(checkCases.join('\n'), '  ')}
  default: return false;
}
`.trim()
  } else {
    const minimum = Math.min(...values)
    const maximum = Math.max(...values)
    const isContiguous = maximum - minimum + 1 === values.length
    const fromCases = values.map((value) => `case ${value}: return ${value};`)
    const checkCases = values.map((value) => `case ${value}: return true;`)
    let checkInteger: string
    if (isContiguous) {
      checkInteger = 'return true;'
    } else {
      checkInteger = `
switch (integer) {
  ${indent(checkCases.join('\n'), '  ')}
  default: return false;
}
`.trim()
    }
    fromJSI = `
const auto integer = doubleToInt(value.asNumber());
switch (integer) {
  ${indent(fromCases.join('\n'), '  ')}
  default: [[unlikely]]
    throw std::invalid_argument("Cannot convert " + value.toString(runtime).utf8(runtime) + " to enum ${enumType.enumName} - invalid value!");
}
`.trim()
    toJSI = `
return jsi::Value(value->value());
`.trim()
    canConvert = `
if (!value.isNumber()) return false;
const double number = value.getNumber();
if (!(number >= ${minimum} && number <= ${maximum})) return false;
const auto integer = static_cast<int32_t>(number);
if (number != integer) return false;
${checkInteger}
`.trim()
  }
  const ownInclude = getImportCode({
    language: 'c++',
    declaration: enumType.config.getCxxHeader(`${enumType.jniName}.hpp`, 'private'),
  })
  const fbjniCode = `
${createFileMetadataString(`${enumType.jniName}.hpp`)}

#pragma once

#include <fbjni/fbjni.h>
#include <NitroModules/JSIConverter.hpp>
#include <stdexcept>

namespace ${cxxNamespace} {

  namespace jni = facebook::jni;

  /** JNI access to the Kotlin enum ${enumType.enumName}. */
  struct ${enumType.jniName} final : public jni::JavaClass<${enumType.jniName}> {
    static constexpr auto kJavaDescriptor = "L${jniClassDescriptor};";

    int32_t value() const {
      static const auto field = javaClassStatic()->getField<jint>("value");
      return getFieldValue(field);
    }

    static jni::local_ref<${enumType.jniName}> fromValue(int32_t value) {
      return jni::make_local(borrowedFromValue(value));
    }

    static jni::alias_ref<${enumType.jniName}> borrowedFromValue(int32_t value) {
      static const auto clazz = javaClassStatic();
      switch (value) {
        ${indent(javaCases.join('\n'), '        ')}
        default: [[unlikely]]
          throw std::invalid_argument("Invalid ${enumType.enumName} value: " + std::to_string(value));
      }
    }
  };

} // namespace ${cxxNamespace}

namespace margelo::nitro {

  namespace jni = facebook::jni;
  namespace jsi = facebook::jsi;

  template <>
  struct JSIConverter<${nativeType}> {
    static ${nativeType} fromJSI(jsi::Runtime& runtime, const jsi::Value& value);
    static jsi::Value toJSI(jsi::Runtime& runtime, jni::alias_ref<${jniClass}> value);
    static bool canConvert(jsi::Runtime& runtime, const jsi::Value& value);
  protected:
    static int32_t valueFromJSI(jsi::Runtime& runtime, const jsi::Value& value);
  };

  // These aliases borrow the immutable singleton owners in borrowedFromValue().
  template <>
  struct JSIConverter<jni::alias_ref<${jniClass}>> : JSIConverter<${nativeType}> {
    static jni::alias_ref<${jniClass}> fromJSI(jsi::Runtime& runtime, const jsi::Value& value);
  };

} // namespace margelo::nitro
`.trim()
  const fbjniImplementationCode = `
${createFileMetadataString(`${enumType.jniName}.cpp`)}

${ownInclude}
#include <NitroModules/NitroHash.hpp>
#include <NitroModules/NumberUtils.hpp>
#include <NitroModules/JSIString.hpp>

namespace margelo::nitro {

  ${nativeType} JSIConverter<${nativeType}>::fromJSI(jsi::Runtime& runtime, const jsi::Value& value) {
    return ${jniClass}::fromValue(valueFromJSI(runtime, value));
  }

  jni::alias_ref<${jniClass}> JSIConverter<jni::alias_ref<${jniClass}>>::fromJSI(jsi::Runtime& runtime, const jsi::Value& value) {
    return ${jniClass}::borrowedFromValue(valueFromJSI(runtime, value));
  }

  int32_t JSIConverter<${nativeType}>::valueFromJSI(jsi::Runtime& runtime, const jsi::Value& value) {
    ${indent(fromJSI, '    ')}
  }

  jsi::Value JSIConverter<${nativeType}>::toJSI(jsi::Runtime& runtime, jni::alias_ref<${jniClass}> value) {
    ${indent(toJSI, '    ')}
  }

  bool JSIConverter<${nativeType}>::canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
    ${indent(canConvert, '    ')}
  }

} // namespace margelo::nitro
`.trim()

  const files: SourceFile[] = []
  files.push({
    content: code,
    language: 'kotlin',
    name: `${enumType.enumName}.kt`,
    subdirectory: enumType.config.getAndroidPackageDirectory(),
    platform: 'android',
  })
  files.push({
    content: fbjniCode,
    language: 'c++',
    name: `${enumType.jniName}.hpp`,
    headerVisibility: 'private',
    subdirectory: [],
    platform: 'android',
  })
  files.push({
    content: fbjniImplementationCode,
    language: 'c++',
    name: `${enumType.jniName}.cpp`,
    subdirectory: [],
    platform: 'android',
  })
  return files
}
