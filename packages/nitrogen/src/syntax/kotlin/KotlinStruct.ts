import { NitroConfig } from '../../config/NitroConfig.js'
import { capitalizeName, indent } from '../../utils.js'
import { includeHeader } from '../c++/includeNitroHeader.js'
import { getReferencedTypes } from '../getReferencedTypes.js'
import { createFileMetadataString, isNotDuplicate } from '../helpers.js'
import type { SourceFile } from '../SourceFile.js'
import type { StructType } from '../types/StructType.js'
import { KotlinCxxBridgedType } from './KotlinCxxBridgedType.js'

interface BridgedProperty {
  name: string
  type: KotlinCxxBridgedType
}

export function createKotlinStruct(structType: StructType): SourceFile[] {
  const packageName = NitroConfig.current.getAndroidPackage('java/kotlin')

  const bridgedProperties = structType.properties.map<BridgedProperty>((p) => ({
    name: p.escapedName,
    type: new KotlinCxxBridgedType(p),
  }))
  const properties = bridgedProperties
    .map(({ name, type }) => {
      return `
@DoNotStrip
@Keep
val ${name}: ${type.getTypeCode('kotlin', false)}
`.trim()
    })
    .join(',\n')

  const cxxCreateFunctionParameters = bridgedProperties
    .map(({ name, type }) => {
      return `${name}: ${type.getTypeCode('kotlin', false)}`
    })
    .join(', ')
  const cxxCreateFunctionForward = bridgedProperties
    .map((p) => p.name)
    .join(', ')

  const extraImports = structType.properties
    .flatMap((t) => t.getRequiredImports('kotlin'))
    .map((i) => `import ${i.name}`)
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
  const imports = structType.properties
    .flatMap((p) => getReferencedTypes(p))
    .map((t) => new KotlinCxxBridgedType(t))
    .flatMap((t) => t.getRequiredImports('c++'))
  const includes = imports
    .map((i) => includeHeader(i))
    .filter(isNotDuplicate)
    .sort()

  const fbjniCode = `
${createFileMetadataString(`J${structType.structName}.hpp`)}

#pragma once

#include <fbjni/fbjni.h>
#include "${structType.declarationFile.name}"

${includes.join('\n')}

namespace ${cxxNamespace} {

  using namespace facebook;

  /**
   * The C++ JNI bridge between the C++ struct "${structType.structName}" and the Kotlin data class "${structType.structName}".
   */
  struct J${structType.structName} final: public jni::JavaClass<J${structType.structName}> {
  public:
    static constexpr auto kJavaDescriptor = "L${jniClassDescriptor};";

  public:
    /**
     * Convert this Java/Kotlin-based struct to the C++ struct ${structType.structName} by copying all values to C++.
     */
    [[maybe_unused]]
    [[nodiscard]]
    ${structType.structName} toCpp() const {
      ${indent(jniStructInitializerBody, '      ')}
    }

  public:
    /**
     * Create a Java/Kotlin-based struct by copying all values from the given C++ struct to Java.
     */
    [[maybe_unused]]
    static jni::local_ref<J${structType.structName}::javaobject> fromCpp(const ${structType.structName}& value) {
      ${indent(cppStructInitializerBody, '      ')}
    }
  };

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
    name: `J${structType.structName}.hpp`,
    subdirectory: [],
    platform: 'android',
  })
  return files
}

function createKotlinConstructor(structType: StructType): string {
  const bridgedProperties = structType.properties.map<BridgedProperty>((p) => ({
    name: p.escapedName,
    type: new KotlinCxxBridgedType(p),
  }))
  const needsSpecialHandling = bridgedProperties.some(
    ({ type }) => type.needsSpecialHandling
  )
  if (needsSpecialHandling) {
    const kotlinParams = structType.properties.map(
      (p) => `${p.escapedName}: ${p.getCode('kotlin')}`
    )
    const paramsForward = bridgedProperties.map(({ name, type }) =>
      type.parseFromKotlinToCpp(name, 'kotlin')
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

function createJNIStructInitializer(structType: StructType): string {
  const lines: string[] = ['static const auto clazz = javaClassStatic();']
  for (const prop of structType.properties) {
    const fieldName = `field${capitalizeName(prop.escapedName)}`
    const jniType = new KotlinCxxBridgedType(prop)
    const signatureType = jniType.getTypeCode('c++')
    const valueType = jniType.asJniReferenceType('local')
    lines.push(
      `static const auto ${fieldName} = clazz->getField<${signatureType}>("${prop.escapedName}");`
    )
    lines.push(
      `${valueType} ${prop.escapedName} = this->getFieldValue(${fieldName});`
    )
  }

  const propsForward = structType.properties.map((p) => {
    const bridged = new KotlinCxxBridgedType(p)
    return bridged.parse(p.escapedName, 'kotlin', 'c++', 'c++')
  })
  lines.push(`return ${structType.structName}(`)
  lines.push(`  ${indent(propsForward.join(',\n'), '  ')}`)
  lines.push(`);`)
  return lines.join('\n')
}

function createCppStructInitializer(
  cppValueName: string,
  structType: StructType
): string {
  const jniTypes = structType.properties
    .map((p) => {
      const bridge = new KotlinCxxBridgedType(p)
      return bridge.asJniReferenceType('alias')
    })
    .join(', ')
  const params = structType.properties
    .map((p) => {
      const name = `${cppValueName}.${p.escapedName}`
      const bridge = new KotlinCxxBridgedType(p)
      return bridge.parse(name, 'c++', 'kotlin', 'c++')
    })
    .join(',\n')

  return `
using JSignature = J${structType.structName}(${jniTypes});
static const auto clazz = javaClassStatic();
static const auto create = clazz->getStaticMethod<JSignature>("fromCpp");
return create(
  clazz,
  ${indent(params, '  ')}
);
  `.trim()
}
