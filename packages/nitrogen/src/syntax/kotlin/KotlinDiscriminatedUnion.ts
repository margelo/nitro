import { NitroConfig } from '../../config/NitroConfig.js'
import { capitalizeName, indent } from '../../utils.js'
import { includeHeader } from '../c++/includeNitroHeader.js'
import {
  createFileMetadataString,
  isNotDuplicate,
  toReferenceType,
} from '../helpers.js'
import type { SourceFile } from '../SourceFile.js'
import type { DiscriminatedUnionType } from '../types/DiscriminatedUnionType.js'
import { KotlinCxxBridgedType } from './KotlinCxxBridgedType.js'

/**
 * Generates Kotlin sealed class + JNI bridge for a discriminated union.
 * Cases are named after the discriminant values (e.g. `truck`, `boat`)
 * instead of the positional `First`, `Second` labels used for plain variants.
 */
export function createKotlinDiscriminatedUnion(
  union: DiscriminatedUnionType
): SourceFile[] {
  const { unionName, discriminantKey, variants } = union
  const packageName = NitroConfig.current.getAndroidPackage('java/kotlin')
  const cxxNamespace = NitroConfig.current.getCxxNamespace('c++')
  const jniClassDescriptor = NitroConfig.current.getAndroidPackage(
    'c++/jni',
    unionName
  )
  const namespace = `J${unionName}_impl`

  // Kotlin sealed class inner data classes, named after discriminant values
  const innerClasses = variants.map((v) => {
    const innerName = capitalizeName(v.discriminantValue)
    const bridge = new KotlinCxxBridgedType(v.type)
    return `@DoNotStrip\ndata class ${innerName}(@DoNotStrip val value: ${bridge.getTypeCode('kotlin')}): ${unionName}()`
  })

  const isFunctions = variants.map((v) => {
    const innerName = capitalizeName(v.discriminantValue)
    return `val is${innerName}: Boolean\n  get() = this is ${innerName}`
  })

  const asFunctions = variants.map((v) => {
    const innerName = capitalizeName(v.discriminantValue)
    const bridge = new KotlinCxxBridgedType(v.type)
    return `fun as${innerName}OrNull(): ${v.type.getCode('kotlin')}? {\n  val value = (this as? ${innerName})?.value ?: return null\n  return ${bridge.parseFromCppToKotlin('value', 'kotlin')}\n}`
  })

  const matchParameters = variants.map((v) => {
    const caseName = v.discriminantValue.replace(/[^a-zA-Z0-9_]/g, '_')
    return `${caseName}: (${v.type.getCode('kotlin')}) -> R`
  })

  const matchCases = variants.map((v) => {
    const innerName = capitalizeName(v.discriminantValue)
    const bridge = new KotlinCxxBridgedType(v.type)
    const caseName = v.discriminantValue.replace(/[^a-zA-Z0-9_]/g, '_')
    return `is ${innerName} -> ${caseName}(${bridge.parseFromCppToKotlin('value', 'kotlin')})`
  })

  const asCases = variants.map((v) => {
    const innerName = capitalizeName(v.discriminantValue)
    const bridge = new KotlinCxxBridgedType(v.type)
    return `is ${innerName} -> (${bridge.parseFromCppToKotlin('value', 'kotlin')}) as? T`
  })

  const createFunctions = variants.map((v) => {
    const bridge = new KotlinCxxBridgedType(v.type)
    const innerName = capitalizeName(v.discriminantValue)
    return `@JvmStatic\n@DoNotStrip\nfun create(value: ${bridge.getTypeCode('kotlin')}): ${unionName} = ${innerName}(${bridge.parseFromCppToKotlin('value', 'kotlin')})`
  })

  const extraImports = variants
    .flatMap((v) => v.type.getRequiredImports('kotlin'))
    .map((i) => `import ${i.name}`)
    .filter(isNotDuplicate)

  const cxxVariantType = union.getCode('c++')
  const jsSignature = variants
    .map((v) => `{ ${discriminantKey}: '${v.discriminantValue}' }`)
    .join(' | ')

  const kotlinCode = `
${createFileMetadataString(`${unionName}.kt`)}

package ${packageName}

import com.facebook.proguard.annotations.DoNotStrip
${extraImports.join('\n')}

/**
 * Represents the TypeScript discriminated union "${jsSignature}".
 * Discriminant key: "${discriminantKey}"
 */
@Suppress("ClassName")
@DoNotStrip
sealed class ${unionName} {
  ${indent(innerClasses.join('\n'), '  ')}

  inline fun <reified T> asType(): T? {
    return when (this) {
      ${indent(asCases.join('\n'), '      ')}
    }
  }
  inline fun <reified T> isType(): Boolean {
    return asType<T>() != null
  }
  inline fun <R> match(${matchParameters.join(', ')}): R {
    return when (this) {
      ${indent(matchCases.join('\n'), '      ')}
    }
  }

  ${indent(isFunctions.join('\n'), '  ')}

  ${indent(asFunctions.join('\n'), '  ')}

  companion object {
    ${indent(createFunctions.join('\n'), '    ')}
  }
}
  `.trim()

  // C++ JNI bridge — same structure as KotlinVariant but cases named by discriminant
  const cppCreateFuncs = variants.map((v, i) => {
    const bridge = new KotlinCxxBridgedType(v.type)
    return `static jni::local_ref<J${unionName}> create_${i}(${bridge.asJniReferenceType('alias')} value) {\n  static const auto method = javaClassStatic()->getStaticMethod<J${unionName}(${bridge.asJniReferenceType('alias')})>("create");\n  return method(javaClassStatic(), value);\n}`
  })

  const variantCases = variants.map((v, i) => {
    const bridge = new KotlinCxxBridgedType(v.type)
    return `case ${i}: return create_${i}(${bridge.parseFromCppToKotlin(`std::get<${i}>(variant)`, 'c++')});`
  })

  const cppGetIfs = variants.map((v) => {
    const innerName = capitalizeName(v.discriminantValue)
    const bridge = new KotlinCxxBridgedType(v.type)
    return `if (isInstanceOf(${namespace}::${innerName}::javaClassStatic())) {\n  auto jniValue = static_cast<const ${namespace}::${innerName}*>(this)->getValue();\n  return ${indent(bridge.parseFromKotlinToCpp('jniValue', 'c++'), '  ')};\n}`
  })

  const cppInnerClasses = variants.map((v) => {
    const bridge = new KotlinCxxBridgedType(v.type)
    const innerName = capitalizeName(v.discriminantValue)
    const descriptor = NitroConfig.current.getAndroidPackage(
      'c++/jni',
      `${unionName}$${innerName}`
    )
    return `class ${innerName} final: public jni::JavaClass<${innerName}, J${unionName}> {\npublic:\n  static constexpr auto kJavaDescriptor = "L${descriptor};";\n\n  [[nodiscard]] ${bridge.asJniReferenceType('local')} getValue() const {\n    static const auto field = javaClassStatic()->getField<${bridge.getTypeCode('c++')}>("value");\n    return getFieldValue(field);\n  }\n};`
  })

  const includes = new KotlinCxxBridgedType(union)
    .getRequiredImports('c++')
    .filter((i) => i.name !== `J${unionName}.hpp`)
    .map((i) => includeHeader(i, true))
    .filter(isNotDuplicate)

  const fbjniHeaderCode = `
${createFileMetadataString(`J${unionName}.hpp`)}

#pragma once

#include <fbjni/fbjni.h>
#include <variant>

${includes.join('\n')}

namespace ${cxxNamespace} {

  using namespace facebook;

  /**
   * The C++ JNI bridge between the C++ std::variant and the Java class "${unionName}".
   * Discriminant key: "${discriminantKey}"
   */
  class J${unionName}: public jni::JavaClass<J${unionName}> {
  public:
    static constexpr auto kJavaDescriptor = "L${jniClassDescriptor};";

    ${indent(cppCreateFuncs.join('\n'), '    ')}

    static jni::local_ref<J${unionName}> fromCpp(${toReferenceType(cxxVariantType)} variant) {
      switch (variant.index()) {
        ${indent(variantCases.join('\n'), '        ')}
        default: throw std::invalid_argument("Variant holds unknown index! (" + std::to_string(variant.index()) + ")");
      }
    }

    [[nodiscard]] ${cxxVariantType} toCpp() const;
  };

  namespace ${namespace} {
    ${indent(cppInnerClasses.join('\n\n'), '    ')}
  } // namespace ${namespace}
} // namespace ${cxxNamespace}
  `.trim()

  const fbjniImplementationCode = `
${createFileMetadataString(`J${unionName}.cpp`)}

#include "J${unionName}.hpp"

namespace ${cxxNamespace} {
  /**
   * Converts J${unionName} to ${cxxVariantType}
   */
  ${cxxVariantType} J${unionName}::toCpp() const {
    ${indent(cppGetIfs.join(' else '), '    ')}
    throw std::invalid_argument("DiscriminatedUnion ${unionName} is unknown Kotlin instance!");
  }
} // namespace ${cxxNamespace}
  `.trim()

  return [
    {
      content: kotlinCode,
      language: 'kotlin',
      name: `${unionName}.kt`,
      subdirectory: NitroConfig.current.getAndroidPackageDirectory(),
      platform: 'android',
    },
    {
      content: fbjniHeaderCode,
      language: 'c++',
      name: `J${unionName}.hpp`,
      subdirectory: [],
      platform: 'android',
    },
    {
      content: fbjniImplementationCode,
      language: 'c++',
      name: `J${unionName}.cpp`,
      subdirectory: [],
      platform: 'android',
    },
  ]
}
