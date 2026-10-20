import { NitroConfig } from '../../config/NitroConfig.js'
import { capitalizeName, indent } from '../../utils.js'
import { createFileMetadataString } from '../helpers.js'
import type { SourceFile } from '../SourceFile.js'
import type { KotlinEnumType } from './types/KotlinEnumType.js'
import { getImportCode } from '../getImportCode.js'

export function createKotlinEnum(enumType: KotlinEnumType): SourceFile[] {
  const members = enumType.enumMembers.map(
    (m) => `${m.name.toUpperCase()}(${m.value})`
  )
  const packageName = NitroConfig.current.getAndroidPackage('java/kotlin')
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

  companion object
}
  `.trim()

  const cxxNamespace = NitroConfig.current.getCxxNamespace('c++')
  const jniClassDescriptor = NitroConfig.current.getAndroidPackage(
    'c++/jni',
    enumType.enumName
  )
  const cppToJniConverterCode = getCppToJniConverterCode('value', enumType)
  const enumInclude = getImportCode({
    language: 'c++',
    declaration: NitroConfig.current.getCxxHeader(
      enumType.declarationFile.name
    ),
  })

  const fbjniCode = `
${createFileMetadataString(`${enumType.jniName}.hpp`)}

#pragma once

#include <fbjni/fbjni.h>
${enumInclude}

namespace ${cxxNamespace} {

  using namespace facebook;

  /**
   * The C++ JNI bridge between the C++ enum "${enumType.enumName}" and the Kotlin enum "${enumType.enumName}".
   */
  struct ${enumType.jniName} final : public jni::JavaClass<${enumType.jniName}> {
  public:
    static constexpr auto kJavaDescriptor = "L${jniClassDescriptor};";

  public:
    /**
     * Convert this Java/Kotlin-based enum to the C++ enum ${enumType.enumName}.
     */
    [[maybe_unused]]
    [[nodiscard]]
    ${enumType.enumName} toCpp() const {
      static const auto clazz = javaClassStatic();
      static const auto fieldOrdinal = clazz->getField<int>("value");
      int ordinal = this->getFieldValue(fieldOrdinal);
      return static_cast<${enumType.enumName}>(ordinal);
    }

  public:
    /**
     * Create a Java/Kotlin-based enum with the given C++ enum's value.
     */
    [[maybe_unused]]
    static jni::alias_ref<${enumType.jniName}> fromCpp(${enumType.enumName} value) {
      ${indent(cppToJniConverterCode, '      ')}
    }
  };

} // namespace ${cxxNamespace}
  `.trim()

  const files: SourceFile[] = []
  files.push({
    content: code,
    language: 'kotlin',
    name: `${enumType.enumName}.kt`,
    subdirectory: NitroConfig.current.getAndroidPackageDirectory(),
    platform: 'android',
  })
  files.push({
    content: fbjniCode,
    language: 'c++',
    name: `${enumType.jniName}.hpp`,
    subdirectory: [],
    platform: 'android',
  })
  return files
}

function getCppToJniConverterCode(
  cppValueName: string,
  enumType: KotlinEnumType
): string {
  const jniEnumName = enumType.jniName

  const cases = enumType.enumMembers.map((m) => {
    const fieldName = `field${capitalizeName(m.name)}`
    return `
case ${enumType.enumName}::${m.name}:
  static const auto ${fieldName} = clazz->getStaticField<${jniEnumName}>("${m.name}");
  return clazz->getStaticFieldValue(${fieldName});
`.trim()
  })

  return `
static const auto clazz = javaClassStatic();
switch (${cppValueName}) {
  ${indent(cases.join('\n'), '  ')}
  default:
    std::string stringValue = std::to_string(static_cast<int>(${cppValueName}));
    throw std::invalid_argument("Invalid enum value (" + stringValue + "!");
}
  `.trim()
}
