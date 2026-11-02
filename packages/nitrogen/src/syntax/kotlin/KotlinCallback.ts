import { convertJniValue, getJniCode } from './types/KotlinType.js'
import { KotlinPromiseType } from './types/KotlinPromiseType.js'
import { indent } from '../../utils.js'
import { createFileMetadataString, isNotDuplicate } from '../helpers.js'
import type { SourceFile, SourceImport } from '../SourceFile.js'
import type { KotlinCallbackType } from './types/KotlinCallbackType.js'
import { PromiseType } from '../types/PromiseType.js'
import { getImportCode, getImportsCode } from '../getImportCode.js'

export function createKotlinCallback(callbackType: KotlinCallbackType): SourceFile[] {
  const publicType = callbackType.type
  const name = callbackType.specializationName
  const jniName = callbackType.jniName
  const packageName = callbackType.config.getAndroidPackage('java/kotlin')
  const isVoid = publicType.returnType.kind === 'void'
  const asyncType = new KotlinPromiseType(new PromiseType(publicType.returnType), { config: callbackType.config })

  const kotlinCallbackType = publicType.getCode('kotlin', { context: 'type-argument' })
  const kotlinReturnType = publicType.returnType.getCode('kotlin', { context: 'type-argument' })
  const kotlinAsyncType = asyncType.type.getCode('kotlin', { context: 'return' })
  const kotlinParams = publicType.parameters.map((p) => `${p.escapedName}: ${p.getCode('kotlin', { context: 'parameter' })}`)
  const kotlinParamTypes = publicType.parameters.map((p) => p.getCode('kotlin', { context: 'type-argument' }))
  const arityType = `Callback.Arity${publicType.parameters.length}<${[...kotlinParamTypes, kotlinReturnType].join(', ')}>`

  const kotlinArguments = callbackType.parameters.map((parameter) => parameter.escapedName)
  const callAnnotations = ['@DoNotStrip', '@Keep', '@JvmName("call")']
  const callSyncAnnotations = ['@DoNotStrip', '@Keep', '@JvmName("callSync_cxx")']
  const callAsyncAnnotations = ['@DoNotStrip', '@Keep', '@JvmName("callAsync_cxx")']
  const callAndForgetAnnotations = ['@DoNotStrip', '@Keep', '@JvmName("callAndForget_cxx")']

  const callSyncNative = `callSync_cxx(${kotlinArguments.join(', ')})`
  let callSyncBody: string
  if (isVoid) {
    callSyncBody = callSyncNative
  } else {
    callSyncBody = `
return ${callSyncNative}
`.trim()
  }

  // A parameter may have the same name as the property, so qualify it with `this`.
  const callKotlin = `this.callback.callSync(${kotlinArguments.join(', ')})`
  let callKotlinBody: string
  if (isVoid) {
    callKotlinBody = callKotlin
  } else {
    callKotlinBody = `
return ${callKotlin}
`.trim()
  }

  const callCode = `
${callAnnotations.join('\n')}
fun call(${kotlinParams.join(', ')}): ${kotlinReturnType} {
  ${indent(callKotlinBody, '  ')}
}
`.trim()
  const callSyncDeclaration = `
${callSyncAnnotations.join('\n')}
private external fun callSync_cxx(${kotlinParams.join(', ')}): ${kotlinReturnType}
`.trim()
  const callAsyncDeclaration = `
${callAsyncAnnotations.join('\n')}
private external fun callAsync_cxx(${kotlinParams.join(', ')}): ${kotlinAsyncType}
`.trim()
  const callAndForgetDeclaration = `
${callAndForgetAnnotations.join('\n')}
private external fun callAndForget_cxx(${kotlinParams.join(', ')}): Unit
`.trim()

  const coreImports: SourceImport[] = [
    { language: 'kotlin', name: 'com.margelo.nitro.core.CxxCallback' },
    { language: 'kotlin', name: 'com.margelo.nitro.core.callSync' },
  ]
  const callbackImports = [
    ...publicType.getRequiredImports('kotlin'),
    ...asyncType.getRequiredImports('kotlin'),
    ...callbackType.returnType.getRequiredImports('kotlin'),
    ...callbackType.parameters.flatMap((parameter) => parameter.getRequiredImports('kotlin')),
    ...coreImports,
  ]
  const extraImports = callbackImports.map((i) => getImportCode(i)).filter(isNotDuplicate)

  const kotlinCode = `
${createFileMetadataString(`${name}.kt`)}

package ${packageName}

import androidx.annotation.Keep
import com.facebook.jni.HybridData
import com.facebook.proguard.annotations.DoNotStrip
${extraImports.join('\n')}

/**
 * The JNI representation of \`${kotlinCallbackType}\`, for the JavaScript callback \`${publicType.jsName}\`.
 * It holds a C++ \`Callback<...>\`, which calls either a JS function or a native function.
 * Use \`${kotlinCallbackType}\` instead of this class in your code.
 */
@DoNotStrip
@Keep
@Suppress(
  "KotlinJniMissingFunction", "unused",
  "RedundantSuppression", "RedundantUnitReturnType", "FunctionName",
  "ConvertSecondaryConstructorToPrimary", "ClassName", "LocalVariableName",
  "PARAMETER_NAME_CHANGED_ON_OVERRIDE",
)
class ${name} @DoNotStrip @Keep private constructor(hybridData: HybridData): CxxCallback(hybridData), ${arityType} {
  override fun callSync(${kotlinParams.join(', ')}): ${kotlinReturnType} {
    ${indent(callSyncBody, '    ')}
  }

  override fun callAsync(${kotlinParams.join(', ')}): ${kotlinAsyncType} {
    return callAsync_cxx(${kotlinArguments.join(', ')})
  }

  override fun callAndForget(${kotlinParams.join(', ')}): Unit {
    callAndForget_cxx(${kotlinArguments.join(', ')})
  }

  /**
   * Lets C++ call a callback implemented in Kotlin through a JNI entry point.
   * C++ creates it when such a callback crosses JNI.
   */
  @DoNotStrip
  @Keep
  private class Function_cxx(private val callback: ${kotlinCallbackType}) {
    ${indent(callCode, '    ')}
  }

  ${indent(callSyncDeclaration, '  ')}

  ${indent(callAsyncDeclaration, '  ')}

  ${indent(callAndForgetDeclaration, '  ')}
}
  `.trim()

  const jniClassDescriptor = callbackType.config.getAndroidPackage('c++/jni', name)
  const jniFunctionDescriptor = `${jniClassDescriptor}$Function_cxx`
  const returnType = callbackType.returnType
  const cxxNamespace = callbackType.config.getCxxNamespace('c++')
  const valueReturnType = returnType.getCode('c++', { context: 'value', fullyQualified: true })
  const valueParameters = callbackType.parameters.map((p) => p.type.getCode('c++', { context: 'value', fullyQualified: true }))
  const valueSignature = `${valueReturnType}(${valueParameters.join(', ')})`
  const retainedReturnType = `JNIRetainedValue<${valueReturnType}>::Type`
  const retainedParameters = callbackType.parameters.map((p) => {
    const type = p.type.getCode('c++', { context: 'value', fullyQualified: true })
    return `JNIRetainedValue<${type}>::Type ${p.escapedName}`
  })
  const nativeParams = callbackType.parameters.map((p) => `${getJniCode(p, { context: 'parameter' })} ${p.escapedName}`)
  const paramsForward = callbackType.parameters.map((p) => convertJniValue(p, p.escapedName, 'from-jni'))
  const jniParamsForward = callbackType.parameters.map((p) => {
    const type = p.type.getCode('c++', { context: 'value', fullyQualified: true })
    const value = `JNIRetainedValue<${type}>::borrow(${p.escapedName})`
    return convertJniValue(p, value, 'to-jni')
  })
  const jniReturnType = getJniCode(returnType, { context: 'return' })
  const jniAsyncReturnType = asyncType.getCode('c++', { context: 'return', fullyQualified: true })
  const jniAsyncPromiseType = asyncType.getCode('c++', { context: 'type-argument', fullyQualified: true })
  const jniParamTypes = callbackType.parameters.map((p) => getJniCode(p, { context: 'parameter' }))
  const jniSignature = `${jniReturnType}(${jniParamTypes.join(', ')})`
  const callArgumentsCode = ['self()', ...jniParamsForward].join(', ')
  let callFunctionCode: string
  if (returnType.kind === 'void') {
    callFunctionCode = `
__method(${callArgumentsCode});
`.trim()
  } else {
    const result = convertJniValue(returnType, 'result', 'from-jni')
    callFunctionCode = `
auto result = __method(${callArgumentsCode});
return JNIRetainedValue<${valueReturnType}>::retain(${result});
`.trim()
  }
  const imports = [
    ...returnType.getRequiredImports('c++'),
    ...asyncType.getRequiredImports('c++'),
    ...callbackType.parameters.flatMap((p) => p.getRequiredImports('c++')),
  ]
  const declarationIncludes = getImportsCode(imports, 'declaration')
  const implementationIncludes = getImportsCode(
    [{ language: 'c++', declaration: callbackType.config.getCxxHeader(`${jniName}.hpp`, 'private') }, ...imports],
    'implementation'
  )
  const fbjniCode = `
${createFileMetadataString(`${jniName}.hpp`)}

#pragma once

#include <NitroModules/JCallback.hpp>
#include <NitroModules/JNICallable.hpp>
#include <NitroModules/JNICallback.hpp>
#include <NitroModules/JSIConverter+JCallback.hpp>
${declarationIncludes}

namespace ${cxxNamespace} {

  namespace jni = facebook::jni;

  /**
   * The C++ part of the Kotlin \`${name}\`, which holds a \`Callback<...>\` in \`JNICallback\`.
   */
  class ${jniName} final : public jni::HybridClass<${jniName}, JNICallback<${valueSignature}>> {
  public:
    static constexpr auto kJavaDescriptor = "L${jniClassDescriptor};";

    /**
     * The Kotlin \`${name}.Function_cxx\`, which calls a Kotlin callback.
     */
    struct JFunction_cxx : jni::JavaClass<JFunction_cxx> {
      static constexpr auto kJavaDescriptor = "L${jniFunctionDescriptor};";
      static jni::local_ref<JFunction_cxx> create(jni::alias_ref<JCallback<JavaPart>> callback);
      ${retainedReturnType} invoke(${retainedParameters.join(', ')}) const;
    };

  public:
    static jni::local_ref<JavaPart> create(CallbackType callback);
    /** Wraps a callback implemented in Kotlin in a C++ \`Callback<...>\`. */
    static CallbackType fromKotlin(jni::alias_ref<JCallback<JavaPart>> callback);
    static void registerNatives();

  private:
    ${jniReturnType} callSync_cxx(${nativeParams.join(', ')});
    ${jniAsyncReturnType} callAsync_cxx(${nativeParams.join(', ')});
    void callAndForget_cxx(${nativeParams.join(', ')});

  private:
    friend HybridBase;
    explicit ${jniName}(CallbackType callback);
  };

} // namespace ${cxxNamespace}
`.trim()

  const callSyncResult = convertJniValue(returnType, `callSync(${paramsForward.join(', ')})`, 'to-jni')
  const fbjniImplementationCode = `
${createFileMetadataString(`${jniName}.cpp`)}

${implementationIncludes}

namespace ${cxxNamespace} {

  jni::local_ref<${jniName}::JFunction_cxx> ${jniName}::JFunction_cxx::create(jni::alias_ref<JCallback<JavaPart>> callback) {
    return newInstance(callback);
  }

  ${retainedReturnType} ${jniName}::JFunction_cxx::invoke(${retainedParameters.join(', ')}) const {
    static const auto __method = javaClassStatic()->getMethod<${jniSignature}>("call");
    ${indent(callFunctionCode, '    ')}
  }

  jni::local_ref<${jniName}::JavaPart> ${jniName}::create(CallbackType callback) {
    return newObjectCxxArgs(std::move(callback));
  }

  ${jniReturnType} ${jniName}::callSync_cxx(${nativeParams.join(', ')}) {
    return ${callSyncResult};
  }

  ${jniAsyncReturnType} ${jniName}::callAsync_cxx(${nativeParams.join(', ')}) {
    return callAsync<${jniAsyncPromiseType}>(${paramsForward.join(', ')});
  }

  void ${jniName}::callAndForget_cxx(${nativeParams.join(', ')}) {
    callAndForget(${paramsForward.join(', ')});
  }

  ${jniName}::CallbackType ${jniName}::fromKotlin(jni::alias_ref<JCallback<JavaPart>> callback) {
    auto function = JFunction_cxx::create(callback);
    return CallbackType::make(JNICallable<JFunction_cxx, NativeSignature>(jni::make_global(function)));
  }

  void ${jniName}::registerNatives() {
    registerHybrid({
      makeNativeMethod("callSync_cxx", ${jniName}::callSync_cxx),
      makeNativeMethod("callAsync_cxx", ${jniName}::callAsync_cxx),
      makeNativeMethod("callAndForget_cxx", ${jniName}::callAndForget_cxx),
    });
  }

  ${jniName}::${jniName}(CallbackType callback) : HybridBase(std::move(callback)) {}

} // namespace ${cxxNamespace}
`.trim()

  const files: SourceFile[] = []
  files.push({
    content: kotlinCode,
    language: 'kotlin',
    name: `${name}.kt`,
    subdirectory: callbackType.config.getAndroidPackageDirectory(),
    platform: 'android',
  })
  files.push({
    content: fbjniCode,
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
