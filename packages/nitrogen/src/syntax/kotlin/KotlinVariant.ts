import { NitroConfig } from '../../config/NitroConfig.js'
import { capitalizeName, indent } from '../../utils.js'
import { includeHeader } from '../c++/includeNitroHeader.js'
import {
  createFileMetadataString,
  isNotDuplicate,
  toReferenceType,
} from '../helpers.js'
import type { SourceFile } from '../SourceFile.js'
import { OptionalType } from '../types/OptionalType.js'
import { type VariantType } from '../types/VariantType.js'
import { KotlinCxxBridgedType } from './KotlinCxxBridgedType.js'

export function createKotlinVariant(variant: VariantType): SourceFile[] {
  const jsName = variant.variants.map((v) => v.getCode('kotlin')).join(' | ')
  const cxxName = variant
    .getCode('c++')
    .replaceAll('/* ', '')
    .replaceAll(' */', '')
  const kotlinName = variant.getAliasName('kotlin')
  const namespace = `J${kotlinName}_impl`

  const innerClasses = variant.cases.map(([label, v]) => {
    const innerName = capitalizeName(label)
    const bridge = new KotlinCxxBridgedType(v)
    return `
@DoNotStrip
data class ${innerName}(@DoNotStrip val value: ${bridge.getTypeCode('kotlin')}): ${kotlinName}()
      `.trim()
  })

  const packageName = NitroConfig.current.getAndroidPackage('java/kotlin')
  const isFunctions = variant.cases.map(([label]) => {
    const innerName = capitalizeName(label)
    return `
val is${innerName}: Boolean
  get() = this is ${innerName}
    `.trim()
  })
  const asFunctions = variant.cases.map(([label, v]) => {
    const innerName = capitalizeName(label)
    const bridge = new KotlinCxxBridgedType(v)
    const optional = new OptionalType(v)
    return `
fun as${innerName}OrNull(): ${optional.getCode('kotlin')} {
  val value = (this as? ${innerName})?.value ?: return null
  return ${bridge.parseFromCppToKotlin('value', 'kotlin')}
}
    `.trim()
  })
  const matchParameters = variant.cases.map(([label, v]) => {
    return `${label}: (${v.getCode('kotlin')}) -> R`
  })
  const matchCases = variant.cases.map(([label, v]) => {
    const innerName = capitalizeName(label)
    const bridge = new KotlinCxxBridgedType(v)
    return `
is ${innerName} -> ${label}(${bridge.parseFromCppToKotlin('value', 'kotlin')})
    `.trim()
  })
  const asCases = variant.cases.map(([label, v]) => {
    const innerName = capitalizeName(label)
    const bridge = new KotlinCxxBridgedType(v)
    return `
is ${innerName} -> (${bridge.parseFromCppToKotlin('value', 'kotlin')}) as? T
    `.trim()
  })

  const createFunctions = variant.cases.map(([label, v]) => {
    const bridge = new KotlinCxxBridgedType(v)
    const innerName = capitalizeName(label)
    return `
@JvmStatic
@DoNotStrip
fun create(value: ${bridge.getTypeCode('kotlin')}): ${kotlinName} = ${innerName}(${bridge.parseFromCppToKotlin('value', 'kotlin')})
`.trim()
  })

  const extraImports = variant.variants
    .flatMap((t) => t.getRequiredImports('kotlin'))
    .map((i) => `import ${i.name}`)
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
  const cppCreateFuncs = variant.variants.map((v, i) => {
    const bridge = new KotlinCxxBridgedType(v)
    return `
static jni::local_ref<J${kotlinName}> create_${i}(${bridge.asJniReferenceType('alias')} value) {
  static const auto method = javaClassStatic()->getStaticMethod<J${kotlinName}(${bridge.asJniReferenceType('alias')})>("create");
  return method(javaClassStatic(), value);
}
    `.trim()
  })
  const variantCases = variant.variants.map((v, i) => {
    const bridge = new KotlinCxxBridgedType(v)
    return `case ${i}: return create_${i}(${bridge.parseFromCppToKotlin(`std::get<${i}>(variant)`, 'c++')});`
  })
  const cppGetIfs = variant.cases.map(([label, v]) => {
    const innerName = capitalizeName(label)
    const bridge = new KotlinCxxBridgedType(v)
    return `
if (isInstanceOf(${namespace}::${innerName}::javaClassStatic())) {
  // It's a \`${v.getCode('c++')}\`
  auto jniValue = static_cast<const ${namespace}::${innerName}*>(this)->getValue();
  return ${indent(bridge.parseFromKotlinToCpp('jniValue', 'c++'), '  ')};
}
  `.trim()
  })
  const cppInnerClasses = variant.cases.map(([label, v]) => {
    const bridge = new KotlinCxxBridgedType(v)
    const innerName = capitalizeName(label)
    const descriptor = NitroConfig.current.getAndroidPackage(
      'c++/jni',
      `${kotlinName}$${innerName}`
    )
    return `
class ${innerName} final: public jni::JavaClass<${innerName}, J${kotlinName}> {
public:
  static constexpr auto kJavaDescriptor = "L${descriptor};";

  [[nodiscard]] ${bridge.asJniReferenceType('local')} getValue() const {
    static const auto field = javaClassStatic()->getField<${bridge.getTypeCode('c++')}>("value");
    return getFieldValue(field);
  }
};
    `.trim()
  })

  const includes = new KotlinCxxBridgedType(variant)
    .getRequiredImports('c++')
    .filter((i) => i.name !== `J${kotlinName}.hpp`)
    .map((i) => includeHeader(i, true))
    .filter(isNotDuplicate)

  const fbjniHeaderCode = `
${createFileMetadataString(`J${kotlinName}.hpp`)}

#pragma once

#include <fbjni/fbjni.h>
#include <variant>

${includes.join('\n')}

namespace ${cxxNamespace} {

  using namespace facebook;

  /**
   * The C++ JNI bridge between the C++ std::variant and the Java class "${kotlinName}".
   */
  class J${kotlinName}: public jni::JavaClass<J${kotlinName}> {
  public:
    static constexpr auto kJavaDescriptor = "L${jniClassDescriptor};";

    ${indent(cppCreateFuncs.join('\n'), '    ')}

    static jni::local_ref<J${kotlinName}> fromCpp(${toReferenceType(variant.getCode('c++'))} variant) {
      switch (variant.index()) {
        ${indent(variantCases.join('\n'), '        ')}
        default: throw std::invalid_argument("Variant holds unknown index! (" + std::to_string(variant.index()) + ")");
      }
    }

    [[nodiscard]] ${variant.getCode('c++')} toCpp() const;
  };

  namespace ${namespace} {
    ${indent(cppInnerClasses.join('\n\n'), '    ')}
  } // namespace ${namespace}
} // namespace ${cxxNamespace}
  `.trim()
  const fbjniImplementationCode = `
${createFileMetadataString(`J${kotlinName}.cpp`)}

#include "J${kotlinName}.hpp"

namespace ${cxxNamespace} {
  /**
   * Converts J${kotlinName} to ${cxxName}
   */
  ${variant.getCode('c++')} J${kotlinName}::toCpp() const {
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
    name: `J${kotlinName}.hpp`,
    subdirectory: [],
    platform: 'android',
  })
  files.push({
    content: fbjniImplementationCode,
    language: 'c++',
    name: `J${kotlinName}.cpp`,
    subdirectory: [],
    platform: 'android',
  })
  return files
}
