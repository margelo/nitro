import { NitroConfig } from '../../config/NitroConfig.js'
import { capitalizeName, indent } from '../../utils.js'
import { createFileMetadataString, isNotDuplicate } from '../helpers.js'
import type { SourceFile } from '../SourceFile.js'
import { OptionalType } from '../types/OptionalType.js'
import type { KotlinVariantType } from './types/KotlinVariantType.js'
import { getImportCode, getImportsCode } from '../getImportCode.js'

export function createKotlinVariant(variant: KotlinVariantType): SourceFile[] {
  const publicVariant = variant.type
  const jniName = variant.jniName
  const jsName = publicVariant.variants
    .map((v) => v.getCode('kotlin', { context: 'value' }))
    .join(' | ')
  const cxxName = publicVariant
    .getCode('c++', { context: 'value' })
    .replaceAll('/* ', '')
    .replaceAll(' */', '')
  const kotlinName = variant.name
  const namespace = `${jniName}_impl`

  const innerClasses = variant.kotlinCases.map(({ label, type }) => {
    const innerName = capitalizeName(label)
    const valueType = type.getCode('kotlin', { context: 'property' })
    return `
@DoNotStrip
data class ${innerName}(@DoNotStrip val value: ${valueType}): ${kotlinName}()
      `.trim()
  })

  const packageName = NitroConfig.current.getAndroidPackage('java/kotlin')
  const isFunctions = variant.kotlinCases.map(({ label }) => {
    const innerName = capitalizeName(label)
    return `
val is${innerName}: Boolean
  get() = this is ${innerName}
    `.trim()
  })
  const asFunctions = variant.kotlinCases.map(({ label, publicType, type }) => {
    const innerName = capitalizeName(label)
    const optional = new OptionalType(publicType)
    const optionalType = optional.getCode('kotlin', { context: 'return' })
    const publicValue = type.convert('value', {
      from: 'c++',
      to: 'kotlin',
      in: 'kotlin',
    })
    return `
fun as${innerName}OrNull(): ${optionalType} {
  val value = (this as? ${innerName})?.value ?: return null
  return ${publicValue}
}
    `.trim()
  })
  const matchParameters = variant.kotlinCases.map(({ label, publicType }) => {
    const type = publicType.getCode('kotlin', { context: 'parameter' })
    return `${label}: (${type}) -> R`
  })
  const matchCases = variant.kotlinCases.map(({ label, type }) => {
    const innerName = capitalizeName(label)
    const publicValue = type.convert('value', {
      from: 'c++',
      to: 'kotlin',
      in: 'kotlin',
    })
    return `
is ${innerName} -> ${label}(${publicValue})
    `.trim()
  })
  const asCases = variant.kotlinCases.map(({ label, type }) => {
    const innerName = capitalizeName(label)
    const publicValue = type.convert('value', {
      from: 'c++',
      to: 'kotlin',
      in: 'kotlin',
    })
    return `
is ${innerName} -> (${publicValue}) as? T
    `.trim()
  })

  const createFunctions = variant.kotlinCases.map(({ label, type }) => {
    const innerName = capitalizeName(label)
    const valueType = type.getCode('kotlin', { context: 'parameter' })
    const publicValue = type.convert('value', {
      from: 'c++',
      to: 'kotlin',
      in: 'kotlin',
    })
    return `
@JvmStatic
@DoNotStrip
fun create(value: ${valueType}): ${kotlinName} = ${innerName}(${publicValue})
`.trim()
  })

  const extraImports = publicVariant.variants
    .flatMap((t) => t.getRequiredImports('kotlin'))
    .map((i) => getImportCode(i))
    .filter(isNotDuplicate)

  const code = `
${createFileMetadataString(`${kotlinName}.kt`)}

package ${packageName}

import com.facebook.proguard.annotations.DoNotStrip
${extraImports.join('\n')}

/**
 * Represents the TypeScript variant "${jsName}".
 */
@Suppress("ClassName")
@DoNotStrip
sealed class ${kotlinName} {
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

  const cxxNamespace = NitroConfig.current.getCxxNamespace('c++')
  const jniClassDescriptor = NitroConfig.current.getAndroidPackage(
    'c++/jni',
    kotlinName
  )
  const cppCreateDeclarations = variant.kotlinCases.map(({ type }, i) => {
    const jniType = type.getCode('c++', { context: 'parameter' })
    return `static jni::local_ref<${jniName}> create_${i}(${jniType} value);`
  })
  const cppCreateImplementations = variant.kotlinCases.map(({ type }, i) => {
    const jniType = type.getCode('c++', { context: 'parameter' })
    return `
jni::local_ref<${jniName}> ${jniName}::create_${i}(${jniType} value) {
  static const auto method = javaClassStatic()->getStaticMethod<${jniName}(${jniType})>("create");
  return method(javaClassStatic(), value);
}
    `.trim()
  })
  const variantCases = variant.kotlinCases.map(({ type }, i) => {
    const jniValue = type.convert(`std::get<${i}>(variant)`, {
      from: 'c++',
      to: 'kotlin',
      in: 'c++',
    })
    return `case ${i}: return create_${i}(${jniValue});`
  })
  const cppGetIfs = variant.kotlinCases.map(({ label, publicType, type }) => {
    const innerName = capitalizeName(label)
    const cppType = publicType.getCode('c++', { context: 'value' })
    const cppValue = type.convert('jniValue', {
      from: 'kotlin',
      to: 'c++',
      in: 'c++',
    })
    return `
if (isInstanceOf(${namespace}::${innerName}::javaClassStatic())) {
  // It's a \`${cppType}\`
  auto jniValue = static_cast<const ${namespace}::${innerName}*>(this)->getValue();
  return ${indent(cppValue, '  ')};
}
  `.trim()
  })
  const cppInnerClasses = variant.kotlinCases.map(({ label, type }) => {
    const innerName = capitalizeName(label)
    const jniType = type.getCode('c++', { context: 'return' })
    const descriptor = NitroConfig.current.getAndroidPackage(
      'c++/jni',
      `${kotlinName}$${innerName}`
    )
    return `
class ${innerName} final : public jni::JavaClass<${innerName}, ${jniName}> {
public:
  static constexpr auto kJavaDescriptor = "L${descriptor};";

  [[nodiscard]] ${jniType} getValue() const;
};
    `.trim()
  })

  const cppInnerImplementations = variant.kotlinCases.map(({ label, type }) => {
    const innerName = capitalizeName(label)
    const jniType = type.getCode('c++', { context: 'return' })
    const fieldType = type.getCode('c++', { context: 'property' })
    return `
${jniType} ${namespace}::${innerName}::getValue() const {
  static const auto field = javaClassStatic()->getField<${fieldType}>("value");
  return getFieldValue(field);
}
    `.trim()
  })

  const imports = [
    ...publicVariant.getRequiredImports('c++'),
    ...variant.variants.flatMap((v) => v.getRequiredImports('c++')),
  ]
  const declarationIncludes = imports
    .map((i) => getImportCode(i, 'declaration'))
    .filter(isNotDuplicate)
  const implementationIncludes = getImportsCode(
    [
      {
        language: 'c++',
        declaration: NitroConfig.current.getCxxHeader(
          `${jniName}.hpp`,
          'private'
        ),
      },
      ...imports,
    ],
    'implementation'
  )

  const cppParameterType = publicVariant.getCode('c++', {
    context: 'parameter',
  })
  const cppReturnType = publicVariant.getCode('c++', { context: 'return' })

  const fbjniHeaderCode = `
${createFileMetadataString(`${jniName}.hpp`)}

#pragma once

#include <fbjni/fbjni.h>
#include <variant>

${declarationIncludes.join('\n')}

namespace ${cxxNamespace} {

  using namespace facebook;

  /**
   * The C++ JNI bridge between the C++ std::variant and the Java class "${kotlinName}".
   */
  class ${jniName} : public jni::JavaClass<${jniName}> {
  public:
    static constexpr auto kJavaDescriptor = "L${jniClassDescriptor};";

    ${indent(cppCreateDeclarations.join('\n'), '    ')}

    static jni::local_ref<${jniName}> fromCpp(${cppParameterType} variant);

    [[nodiscard]] ${cppReturnType} toCpp() const;
  };

  namespace ${namespace} {
    ${indent(cppInnerClasses.join('\n\n'), '    ')}
  } // namespace ${namespace}
} // namespace ${cxxNamespace}
  `.trim()
  const fbjniImplementationCode = `
${createFileMetadataString(`${jniName}.cpp`)}

${implementationIncludes}

namespace ${cxxNamespace} {
  ${indent(cppCreateImplementations.join('\n\n'), '  ')}

  jni::local_ref<${jniName}> ${jniName}::fromCpp(${cppParameterType} variant) {
    switch (variant.index()) {
      ${indent(variantCases.join('\n'), '      ')}
      default: throw std::invalid_argument("Variant holds unknown index! (" + std::to_string(variant.index()) + ")");
    }
  }

  ${indent(cppInnerImplementations.join('\n\n'), '  ')}

  /**
   * Converts ${jniName} to ${cxxName}
   */
  ${cppReturnType} ${jniName}::toCpp() const {
    ${indent(cppGetIfs.join(' else '), '    ')}
    throw std::invalid_argument("Variant is unknown Kotlin instance!");
  }
} // namespace ${cxxNamespace}
  `.trim()

  const files: SourceFile[] = []
  files.push({
    content: code,
    language: 'kotlin',
    name: `${kotlinName}.kt`,
    subdirectory: NitroConfig.current.getAndroidPackageDirectory(),
    platform: 'android',
  })
  files.push({
    content: fbjniHeaderCode,
    language: 'c++',
    name: `${jniName}.hpp`,
    subdirectory: [],
    platform: 'android',
  })
  files.push({
    content: fbjniImplementationCode,
    language: 'c++',
    name: `${jniName}.cpp`,
    subdirectory: [],
    platform: 'android',
  })
  return files
}
