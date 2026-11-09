import { capitalizeName, indent } from '../../utils.js'
import { createFileMetadataString } from '../helpers.js'
import type { SourceFile } from '../SourceFile.js'
import type { KotlinStructType } from './types/KotlinStructType.js'
import { getImportsCode } from '../getImportCode.js'
import { convertJniValue, getJniCode, getKotlinEqualityCode, getKotlinHashCode } from './types/KotlinType.js'

export function createKotlinStruct(structType: KotlinStructType): SourceFile[] {
  const publicType = structType.type
  const packageName = structType.config.getAndroidPackage('java/kotlin')

  const properties = publicType.properties
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
  const cxxCreateFunctionForward = structType.properties.map((property) => property.escapedName).join(', ')
  const requiresJvmName = structType.properties.some((property) => property.requiresKotlinJvmName)
  const fromCppAnnotations = ['@DoNotStrip', '@Keep', '@Suppress("unused")', '@JvmStatic']
  if (requiresJvmName) {
    fromCppAnnotations.push('@JvmName("fromCpp")')
  }
  const fromCppCode = `
${fromCppAnnotations.join('\n')}
private fun fromCpp(${cxxCreateFunctionParameters}): ${structType.structName} {
  return ${structType.structName}(${cxxCreateFunctionForward})
}
`.trim()

  const kotlinPropertyImports = [...publicType.properties, ...structType.properties].flatMap((type) => type.getRequiredImports('kotlin'))
  const extraImports = getImportsCode(kotlinPropertyImports)

  const equalityComparators = structType.properties.map((property) =>
    getKotlinEqualityCode(property, { left: `this.${property.escapedName}`, right: `other.${property.escapedName}` })
  )
  const equalityCode = equalityComparators.join(`\n      && `)
  const propertyHashes = structType.properties.map((property) => {
    const hash = getKotlinHashCode(property, `this.${property.escapedName}`)
    return `
result = 31 * result + ${hash}
`.trim()
  })
  // Keep Arrays.deepHashCode's seed so existing structs retain their hash values.
  const hashCodeBody = `
var result = 1
${propertyHashes.join('\n')}
return result
`.trim()

  const code = `
${createFileMetadataString(`${structType.structName}.kt`)}

package ${packageName}

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
${extraImports}

/**
 * Represents the JavaScript object/struct "${structType.structName}".
 */
@DoNotStrip
@Keep
data class ${structType.structName}(
  ${indent(properties, '  ')}
) {
  override fun equals(other: Any?): Boolean {
    if (this === other) return true
    if (other !is ${structType.structName}) return false
    return ${equalityCode}
  }

  override fun hashCode(): Int {
    ${indent(hashCodeBody, '    ')}
  }

  companion object {
    /**
     * Constructor called from C++
     */
    ${indent(fromCppCode, '    ')}
  }
}
  `.trim()

  const cxxNamespace = structType.config.getCxxNamespace('c++')
  const jniClassDescriptor = structType.config.getAndroidPackage('c++/jni', structType.structName)
  const propertyImports = structType.properties.flatMap((property) => property.getRequiredImports('c++'))
  const declarationIncludes = getImportsCode(propertyImports, 'declaration')
  const implementationIncludes = getImportsCode(
    [{ language: 'c++', declaration: structType.config.getCxxHeader(`${structType.jniName}.hpp`, 'private') }, ...propertyImports],
    'implementation'
  )
  const parameters = structType.properties.map((property) => {
    const type = property.getCode('c++', { context: 'parameter' })
    return `${type} ${property.escapedName}`
  })
  const parameterTypes = structType.properties.map((property) => getJniCode(property, { context: 'parameter' }))
  const argumentsList = structType.properties.map((property) => convertJniValue(property, property.escapedName, 'to-jni'))
  const getters = structType.properties.map((property) => {
    const returnType = property.getCode('c++', { context: 'return' })
    const signatureType = getJniCode(property, { context: 'property' })
    const name = capitalizeName(property.escapedName)
    const fieldResult = convertJniValue(property, 'getFieldValue(field)', 'from-jni')
    return `
${returnType} get${name}() const {
  static const auto field = javaClassStatic()->getField<${signatureType}>("${property.escapedName}");
  return ${fieldResult};
}
`.trim()
  })
  const jniClass = structType.getCode('c++', { context: 'type-argument', fullyQualified: true })
  const nativeType = `jni::local_ref<${jniClass}>`
  const propertyConverters = structType.properties.map((property) => {
    const type = property.type.getCode('c++', { context: 'value', fullyQualified: true })
    return { property: property, converter: `JSIConverter<${type}>` }
  })
  const fromJSIArguments = propertyConverters.map(
    ({ property, converter }) =>
      `${converter}::fromJSI(runtime, object.getProperty(runtime, PropNameIDCache::get(runtime, "${property.name}")))`
  )
  const toJSIFields = propertyConverters.map(({ property, converter }) => {
    const getter = `value->get${capitalizeName(property.escapedName)}()`
    return `object.setProperty(runtime, PropNameIDCache::get(runtime, "${property.name}"), ${converter}::toJSI(runtime, ${getter}));`
  })
  const checks = propertyConverters.map(
    ({ property, converter }) =>
      `${converter}::canConvert(runtime, object.getProperty(runtime, PropNameIDCache::get(runtime, "${property.name}")))`
  )
  const jsiDeclaration = `
namespace margelo::nitro {

  namespace jni = facebook::jni;
  namespace jsi = facebook::jsi;

  template <>
  struct JSIConverter<${nativeType}> {
    static ${nativeType} fromJSI(jsi::Runtime& runtime, const jsi::Value& value);
    static jsi::Value toJSI(jsi::Runtime& runtime, jni::alias_ref<${jniClass}> value);
    static bool canConvert(jsi::Runtime& runtime, const jsi::Value& value);
  };

} // namespace margelo::nitro
`.trim()
  const jsiImplementation = `
namespace margelo::nitro {

  ${nativeType} JSIConverter<${nativeType}>::fromJSI(jsi::Runtime& runtime, const jsi::Value& value) {
    auto object = value.asObject(runtime);
    return ${jniClass}::create(${fromJSIArguments.join(', ')});
  }

  jsi::Value JSIConverter<${nativeType}>::toJSI(jsi::Runtime& runtime, jni::alias_ref<${jniClass}> value) {
    jsi::Object object(runtime);
    ${indent(toJSIFields.join('\n'), '    ')}
    return object;
  }

  bool JSIConverter<${nativeType}>::canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
    if (!value.isObject()) return false;
    auto object = value.getObject(runtime);
    if (!isPlainObject(runtime, object)) return false;
    return ${checks.join(' && ')};
  }

} // namespace margelo::nitro
`.trim()
  const fbjniCode = `
${createFileMetadataString(`${structType.jniName}.hpp`)}

#pragma once

#include <fbjni/fbjni.h>
#include <NitroModules/JSIConverter.hpp>
${declarationIncludes}

namespace ${cxxNamespace} {

  namespace jni = facebook::jni;

  /** JNI access to the Kotlin data class ${structType.structName}. */
  struct ${structType.jniName} final : public jni::JavaClass<${structType.jniName}> {
    static constexpr auto kJavaDescriptor = "L${jniClassDescriptor};";

    static jni::local_ref<${structType.jniName}> create(${parameters.join(', ')}) {
      static const auto clazz = javaClassStatic();
      static const auto create = clazz->getStaticMethod<${structType.jniName}(${parameterTypes.join(', ')})>("fromCpp");
      return create(clazz, ${argumentsList.join(', ')});
    }

    ${indent(getters.join('\n\n'), '    ')}
  };

} // namespace ${cxxNamespace}

${jsiDeclaration}
`.trim()
  const fbjniImplementationCode = `
${createFileMetadataString(`${structType.jniName}.cpp`)}

${implementationIncludes}
#include <NitroModules/PropNameIDCache.hpp>
#include <NitroModules/JSIHelpers.hpp>

${jsiImplementation}
`.trim()

  const files: SourceFile[] = []
  files.push({
    content: code,
    language: 'kotlin',
    name: `${structType.structName}.kt`,
    subdirectory: structType.config.getAndroidPackageDirectory(),
    platform: 'android',
  })
  files.push({
    content: fbjniCode,
    language: 'c++',
    name: `${structType.jniName}.hpp`,
    headerVisibility: 'private',
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
