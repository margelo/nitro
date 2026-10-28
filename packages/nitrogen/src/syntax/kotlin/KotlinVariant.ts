import { convertJniValue, getJniCode } from './types/KotlinType.js'
import { capitalizeName, indent } from '../../utils.js'
import { createFileMetadataString } from '../helpers.js'
import type { SourceFile } from '../SourceFile.js'
import { OptionalType } from '../types/OptionalType.js'
import type { KotlinVariantType } from './types/KotlinVariantType.js'
import { getImportsCode } from '../getImportCode.js'

export function createKotlinVariant(variant: KotlinVariantType): SourceFile[] {
  const publicVariant = variant.type
  const config = variant.config
  const jniName = variant.jniName
  const jsName = publicVariant.variants.map((v) => v.getCode('kotlin', { context: 'value' })).join(' | ')
  const kotlinName = variant.name
  const namespace = `${jniName}_impl`

  const innerClasses = variant.kotlinCases.map(({ label, publicType, type }, index) => {
    const innerName = capitalizeName(label)
    const valueType = publicType.getCode('kotlin', { context: 'property' })
    const classCode = `
@DoNotStrip
data class ${innerName}(@DoNotStrip val value: ${valueType}): ${kotlinName}(${index})
`.trim()
    const isFieldCompatible = type.isKotlinFieldCompatible ?? !type.needsKotlinConversion
    if (isFieldCompatible) return classCode
    // JNI reads values that Kotlin represents differently, e.g. `Long` for `ULong`, through an accessor.
    const bridgeType = type.getCode('kotlin', { context: 'return' })
    const bridgeValue = type.convert('value', { from: 'kotlin', to: 'c++', in: 'kotlin' })
    return `
${classCode} {
  @DoNotStrip
  @Suppress("unused", "FunctionName")
  @JvmName("getValue_cxx")
  private fun getValue_cxx(): ${bridgeType} {
    return ${bridgeValue}
  }
}
`.trim()
  })

  const packageName = config.getAndroidPackage('java/kotlin')
  const isFunctions = variant.kotlinCases.map(({ label }) => {
    const innerName = capitalizeName(label)
    return `
val is${innerName}: Boolean
  get() = this is ${innerName}
    `.trim()
  })
  const asFunctions = variant.kotlinCases.map(({ label, publicType }) => {
    const innerName = capitalizeName(label)
    const optional = new OptionalType(publicType)
    const optionalType = optional.getCode('kotlin', { context: 'return' })
    return `
fun as${innerName}OrNull(): ${optionalType} {
  val value = (this as? ${innerName})?.value ?: return null
  return value
}
    `.trim()
  })
  const matchParameters = variant.kotlinCases.map(({ label, publicType }) => {
    const type = publicType.getCode('kotlin', { context: 'parameter' })
    return `${label}: (${type}) -> R`
  })
  const matchCases = variant.kotlinCases.map(({ label }) => {
    const innerName = capitalizeName(label)
    return `
is ${innerName} -> ${label}(value)
    `.trim()
  })
  const asCases = variant.kotlinCases.map(({ label }) => {
    const innerName = capitalizeName(label)
    return `
is ${innerName} -> (value) as? T
    `.trim()
  })

  const createFunctions = variant.kotlinCases.map(({ label, publicType, type }, i) => {
    const innerName = capitalizeName(label)
    const valueType = publicType.getCode('kotlin', { context: 'parameter' })
    const bridgeType = type.getCode('kotlin', { context: 'parameter' })
    const publicValue = type.convert('value', {
      from: 'c++',
      to: 'kotlin',
      in: 'kotlin',
    })
    // Cases such as two callbacks can erase to the same JVM type, so give each a JVM name.
    return `
@JvmStatic
@JvmName("create${innerName}")
@DoNotStrip
fun create(value: ${valueType}): ${kotlinName} = ${innerName}(value)

@JvmStatic
@DoNotStrip
@JvmName("fromCpp_${i}")
private fun fromCpp_${i}(value: ${bridgeType}): ${kotlinName} = ${innerName}(${publicValue})
`.trim()
  })

  const kotlinTypes = [...publicVariant.variants, ...variant.variants]
  const kotlinImports = kotlinTypes.flatMap((type) => type.getRequiredImports('kotlin'))
  const extraImports = getImportsCode(kotlinImports)

  const code = `
${createFileMetadataString(`${kotlinName}.kt`)}

package ${packageName}

import com.facebook.proguard.annotations.DoNotStrip
${extraImports}

/**
 * Represents the TypeScript variant "${jsName}".
 */
@Suppress("ClassName")
@DoNotStrip
sealed class ${kotlinName} private constructor(@DoNotStrip private val index: Int) {
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

  const cxxNamespace = config.getCxxNamespace('c++')
  const jniClassDescriptor = config.getAndroidPackage('c++/jni', kotlinName)
  const cppCases = variant.kotlinCases.map(({ label, type }, index) => {
    const innerName = capitalizeName(label)
    const descriptor = config.getAndroidPackage('c++/jni', `${kotlinName}$${innerName}`)
    const jniParameter = getJniCode(type, { context: 'parameter' })
    const jniField = getJniCode(type, { context: 'property' })
    const valueType = type.getCode('c++', { context: 'return' })
    const parameterType = type.getCode('c++', { context: 'parameter' })
    const createValue = convertJniValue(type, 'value', 'to-jni')
    const isFieldCompatible = type.isKotlinFieldCompatible ?? !type.needsKotlinConversion
    let getValueBody: string
    if (isFieldCompatible) {
      const extractedValue = convertJniValue(type, 'getFieldValue(field)', 'from-jni')
      getValueBody = `
static const auto field = javaClassStatic()->getField<${jniField}>("value");
return ${extractedValue};
`.trim()
    } else {
      // The accessor is private and final, so JNI calls it without a virtual lookup.
      const extractedValue = convertJniValue(type, 'method(self(), clazz)', 'from-jni')
      getValueBody = `
static const auto clazz = javaClassStatic();
static const auto method = clazz->getNonvirtualMethod<${jniField}()>("getValue_cxx");
return ${extractedValue};
`.trim()
    }
    const declaration = `
class ${innerName} final : public jni::JavaClass<${innerName}, ${jniName}> {
public:
  static constexpr auto kJavaDescriptor = "L${descriptor};";
  using Value = ${valueType};

  static jni::local_ref<${jniName}> create(${parameterType} value);
  [[nodiscard]] Value getValue() const;
};
`.trim()
    const implementation = `
jni::local_ref<${jniName}> ${namespace}::${innerName}::create(${parameterType} value) {
  static const auto method = ${jniName}::javaClassStatic()->getStaticMethod<jni::local_ref<${jniName}>(${jniParameter})>("fromCpp_${index}");
  return method(${jniName}::javaClassStatic(), ${createValue});
}

${namespace}::${innerName}::Value ${namespace}::${innerName}::getValue() const {
  ${indent(getValueBody, '  ')}
}
`.trim()
    return { name: innerName, declaration: declaration, implementation: implementation }
  })
  const forwardDeclarations = cppCases.map((item) => `class ${item.name};`)
  const caseTypes = cppCases.map((item) => `${namespace}::${item.name}`)
  const caseDeclarations = cppCases.map((item) => item.declaration)
  const caseImplementations = cppCases.map((item) => item.implementation)
  const diagnosticTypes = publicVariant.variants.map((type) => type.getCode('c++', { context: 'type-argument', fullyQualified: true }))
  const diagnosticName = `variant<${diagnosticTypes.join(', ')}>`
  const imports = variant.variants.flatMap((type) => type.getRequiredImports('c++'))
  const declarationIncludes = getImportsCode(imports, 'declaration')
  const implementationIncludes = getImportsCode(
    [{ language: 'c++', declaration: config.getCxxHeader(`${jniName}.hpp`, 'private') }, ...imports],
    'implementation'
  )
  const fbjniHeaderCode = `
${createFileMetadataString(`${jniName}.hpp`)}

#pragma once

#include <fbjni/fbjni.h>
#include <tuple>
#include <NitroModules/JSIConverter+JNIVariant.hpp>
${declarationIncludes}

namespace ${cxxNamespace} {

  namespace jni = facebook::jni;

  namespace ${namespace} {
    ${indent(forwardDeclarations.join('\n'), '    ')}
  }

  /** The JNI representation of Kotlin's sealed ${kotlinName} class. */
  class ${jniName} : public jni::JavaClass<${jniName}> {
  public:
    static constexpr auto kJavaDescriptor = "L${jniClassDescriptor};";
    using Cases = std::tuple<${caseTypes.join(', ')}>;
#ifdef NITRO_DEBUG
    static constexpr auto diagnosticName = "${diagnosticName}";
#else
    static constexpr auto diagnosticName = "variant<...>";
#endif

    [[nodiscard]] size_t getIndex() const;
  };

  namespace ${namespace} {
    ${indent(caseDeclarations.join('\n\n'), '    ')}
  }

} // namespace ${cxxNamespace}
`.trim()
  const fbjniImplementationCode = `
${createFileMetadataString(`${jniName}.cpp`)}

${implementationIncludes}

namespace ${cxxNamespace} {

  size_t ${jniName}::getIndex() const {
    static const auto field = javaClassStatic()->getField<jint>("index");
    return static_cast<size_t>(getFieldValue(field));
  }

  ${indent(caseImplementations.join('\n\n'), '  ')}

} // namespace ${cxxNamespace}
`.trim()

  return [
    {
      content: code,
      language: 'kotlin',
      name: `${kotlinName}.kt`,
      subdirectory: config.getAndroidPackageDirectory(),
      platform: 'android',
    },
    {
      content: fbjniHeaderCode,
      language: 'c++',
      name: `${jniName}.hpp`,
      subdirectory: [],
      platform: 'android',
      headerVisibility: 'private',
    },
    {
      content: fbjniImplementationCode,
      language: 'c++',
      name: `${jniName}.cpp`,
      subdirectory: [],
      platform: 'android',
    },
  ]
}
