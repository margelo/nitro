import { NitroConfig } from '../../config/NitroConfig.js'
import { capitalizeName, indent } from '../../utils.js'
import { createFileMetadataString, isNotDuplicate } from '../helpers.js'
import type { SourceFile } from '../SourceFile.js'
import type { KotlinStructType } from './types/KotlinStructType.js'
import { getImportCode } from '../getImportCode.js'

export function createKotlinStruct(structType: KotlinStructType): SourceFile[] {
  const publicType = structType.type
  const packageName = NitroConfig.current.getAndroidPackage('java/kotlin')

  const properties = structType.properties
    .map((p) => {
      const type = p.getCode('kotlin', { context: 'property' })
      return `
@DoNotStrip
@Keep
val ${p.escapedName}: ${type}
`.trim()
    })
    .join(',\n')

  const cxxCreateFunctionParameters = structType.properties
    .map((p) => {
      const type = p.getCode('kotlin', { context: 'parameter' })
      return `${p.escapedName}: ${type}`
    })
    .join(', ')
  const cxxCreateFunctionForward = structType.properties
    .map((p) => p.escapedName)
    .join(', ')

  const extraImports = publicType.properties
    .flatMap((t) => t.getRequiredImports('kotlin'))
    .map((i) => getImportCode(i))
    .filter(isNotDuplicate)

  const secondaryConstructor = createKotlinConstructor(structType)

  const equalityComparators = structType.properties.map(
    (p) => `Objects.deepEquals(this.${p.escapedName}, other.${p.escapedName})`
  )
  const propertiesList = structType.properties
    .map((p) => p.escapedName)
    .join(',\n')

  const code = `
${createFileMetadataString(`${structType.structName}.kt`)}

package ${packageName}

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import java.util.Objects
${extraImports.join('\n')}

/**
 * Represents the JavaScript object/struct "${structType.structName}".
 */
@DoNotStrip
@Keep
data class ${structType.structName}(
  ${indent(properties, '  ')}
) {
  ${indent(secondaryConstructor, '  ')}

  override fun equals(other: Any?): Boolean {
    if (this === other) return true
    if (other !is ${structType.structName}) return false
    return ${equalityComparators.join(`\n      && `)}
  }

  override fun hashCode(): Int {
    return arrayOf<Any?>(
      ${indent(propertiesList, '      ')}
    ).contentDeepHashCode()
  }

  companion object {
    /**
     * Constructor called from C++
     */
    @DoNotStrip
    @Keep
    @Suppress("unused")
    @JvmStatic
    private fun fromCpp(${cxxCreateFunctionParameters}): ${structType.structName} {
      return ${structType.structName}(${cxxCreateFunctionForward})
    }
  }
}
  `.trim()

  const cxxNamespace = NitroConfig.current.getCxxNamespace('c++')
  const jniClassDescriptor = NitroConfig.current.getAndroidPackage(
    'c++/jni',
    structType.structName
  )
  const jniStructInitializerBody = createJNIStructInitializer(structType)
  const cppStructInitializerBody = createCppStructInitializer(
    'value',
    structType
  )
  const imports = structType.properties.flatMap((p) =>
    p.getRequiredImports('c++')
  )
  const implementationIncludes = imports
    .map((i) => getImportCode(i, 'implementation'))
    .filter(isNotDuplicate)
    .sort()
  const publicTypeInclude = getImportCode({
    language: 'c++',
    declaration: NitroConfig.current.getCxxHeader(
      publicType.declarationFile.name
    ),
  })
  const jniTypeInclude = getImportCode({
    language: 'c++',
    declaration: NitroConfig.current.getCxxHeader(
      `${structType.jniName}.hpp`,
      'private'
    ),
  })

  const fbjniCode = `
${createFileMetadataString(`${structType.jniName}.hpp`)}

#pragma once

#include <fbjni/fbjni.h>
${publicTypeInclude}

namespace ${cxxNamespace} {

  using namespace facebook;

  /**
   * The C++ JNI bridge between the C++ struct "${structType.structName}" and the Kotlin data class "${structType.structName}".
   */
  struct ${structType.jniName} final : public jni::JavaClass<${structType.jniName}> {
  public:
    static constexpr auto kJavaDescriptor = "L${jniClassDescriptor};";

  public:
    /**
     * Convert this Java/Kotlin-based struct to the C++ struct ${structType.structName} by copying all values to C++.
     */
    [[maybe_unused]]
    [[nodiscard]]
    ${structType.structName} toCpp() const;

  public:
    /**
     * Create a Java/Kotlin-based struct by copying all values from the given C++ struct to Java.
     */
    [[maybe_unused]]
    static jni::local_ref<${structType.jniName}::javaobject> fromCpp(const ${structType.structName}& value);
  };

} // namespace ${cxxNamespace}
  `.trim()

  const fbjniImplementationCode = `
${createFileMetadataString(`${structType.jniName}.cpp`)}

${jniTypeInclude}

${implementationIncludes.join('\n')}

namespace ${cxxNamespace} {

  ${structType.structName} ${structType.jniName}::toCpp() const {
    ${indent(jniStructInitializerBody, '    ')}
  }

  jni::local_ref<${structType.jniName}::javaobject> ${structType.jniName}::fromCpp(const ${structType.structName}& value) {
    ${indent(cppStructInitializerBody, '    ')}
  }

} // namespace ${cxxNamespace}
  `.trim()

  const files: SourceFile[] = []
  files.push({
    content: code,
    language: 'kotlin',
    name: `${structType.structName}.kt`,
    subdirectory: NitroConfig.current.getAndroidPackageDirectory(),
    platform: 'android',
  })
  files.push({
    content: fbjniCode,
    language: 'c++',
    name: `${structType.jniName}.hpp`,
    subdirectory: [],
    platform: 'android',
  })
  files.push({
    content: fbjniImplementationCode,
    language: 'c++',
    name: `${structType.jniName}.cpp`,
    subdirectory: [],
    platform: 'android',
  })
  return files
}

function createKotlinConstructor(structType: KotlinStructType): string {
  const needsKotlinConversion = structType.properties.some(
    (p) => p.needsKotlinConversion
  )
  if (needsKotlinConversion) {
    const kotlinParams = structType.type.properties.map((p) => {
      const type = p.getCode('kotlin', { context: 'parameter' })
      return `${p.escapedName}: ${type}`
    })
    const paramsForward = structType.properties.map((p) =>
      p.convert(p.escapedName, { from: 'kotlin', to: 'c++', in: 'kotlin' })
    )
    return `
/**
 * Create a new instance of ${structType.structName} from Kotlin
 */
constructor(${kotlinParams.join(', ')}):
       this(${paramsForward.join(', ')})
      `.trim()
  } else {
    return `/* primary constructor */`
  }
}

function createJNIStructInitializer(structType: KotlinStructType): string {
  const lines: string[] = ['static const auto clazz = javaClassStatic();']
  for (const prop of structType.properties) {
    const fieldName = `field${capitalizeName(prop.escapedName)}`
    const signatureType = prop.getCode('c++', { context: 'property' })
    const valueType = prop.getCode('c++', { context: 'value' })
    lines.push(
      `static const auto ${fieldName} = clazz->getField<${signatureType}>("${prop.escapedName}");`
    )
    lines.push(
      `${valueType} ${prop.escapedName} = this->getFieldValue(${fieldName});`
    )
  }

  const propsForward = structType.properties.map((p) =>
    p.convert(p.escapedName, { from: 'kotlin', to: 'c++', in: 'c++' })
  )
  lines.push(`return ${structType.structName}(`)
  lines.push(`  ${indent(propsForward.join(',\n'), '  ')}`)
  lines.push(`);`)
  return lines.join('\n')
}

function createCppStructInitializer(
  cppValueName: string,
  structType: KotlinStructType
): string {
  const jniTypes = structType.properties
    .map((p) => p.getCode('c++', { context: 'parameter' }))
    .join(', ')
  const params = structType.properties
    .map((p) =>
      p.convert(`${cppValueName}.${p.escapedName}`, {
        from: 'c++',
        to: 'kotlin',
        in: 'c++',
      })
    )
    .join(',\n')

  return `
using JSignature = ${structType.jniName}(${jniTypes});
static const auto clazz = javaClassStatic();
static const auto create = clazz->getStaticMethod<JSignature>("fromCpp");
return create(
  clazz,
  ${indent(params, '  ')}
);
  `.trim()
}
