import { NitroConfig } from '../../config/NitroConfig.js'
import { indent } from '../../utils.js'
import { includeHeader } from '../c++/includeNitroHeader.js'
import { createFileMetadataString, isNotDuplicate } from '../helpers.js'
import type { SourceFile } from '../SourceFile.js'
import type { FunctionType } from '../types/FunctionType.js'
import { addJNINativeRegistration } from './JNINativeRegistrations.js'
import { KotlinCxxBridgedType } from './KotlinCxxBridgedType.js'

export function createKotlinFunction(functionType: FunctionType): SourceFile[] {
  const name = functionType.specializationName
  const packageName = NitroConfig.current.getAndroidPackage('java/kotlin')
  const kotlinReturnType = functionType.returnType.getCode('kotlin')
  const kotlinParams = functionType.parameters.map(
    (p) => `${p.escapedName}: ${p.getCode('kotlin')}`
  )
  const kotlinParamTypes = functionType.parameters.map((p) =>
    p.getCode('kotlin')
  )
  const kotlinParamsForward = functionType.parameters.map((p) => p.escapedName)
  const lambdaSignature = `(${kotlinParamTypes.join(', ')}) -> ${kotlinReturnType}`

  const extraImports = functionType
    .getRequiredImports('kotlin')
    .map((i) => `import ${i.name}`)
    .filter(isNotDuplicate)

  const kotlinCode = `
${createFileMetadataString(`${name}.kt`)}

package ${packageName}

import androidx.annotation.Keep
import com.facebook.jni.HybridData
import com.facebook.proguard.annotations.DoNotStrip
${extraImports.join('\n')}

/**
 * Represents the JavaScript callback \`${functionType.jsName}\`.
 * This can be either implemented in C++ (in which case it might be a callback coming from JS),
 * or in Kotlin/Java (in which case it is a native callback).
 */
@DoNotStrip
@Keep
@Suppress("ClassName", "RedundantUnitReturnType")
fun interface ${name}: ${lambdaSignature} {
  /**
   * Call the given JS callback.
   * @throws Throwable if the JS function itself throws an error, or if the JS function/runtime has already been deleted.
   */
  @DoNotStrip
  @Keep
  override fun invoke(${kotlinParams.join(', ')}): ${kotlinReturnType}
}

/**
 * Represents the JavaScript callback \`${functionType.jsName}\`.
 * This is implemented in C++, via a \`std::function<...>\`.
 * The callback might be coming from JS.
 */
@DoNotStrip
@Keep
@Suppress(
  "KotlinJniMissingFunction", "unused",
  "RedundantSuppression", "RedundantUnitReturnType", "FunctionName",
  "ConvertSecondaryConstructorToPrimary", "ClassName", "LocalVariableName",
)
class ${name}_cxx: ${name} {
  @DoNotStrip
  @Keep
  private val mHybridData: HybridData

  @DoNotStrip
  @Keep
  private constructor(hybridData: HybridData) {
    mHybridData = hybridData
  }

  @DoNotStrip
  @Keep
  override fun invoke(${kotlinParams.join(', ')}): ${kotlinReturnType}
    = invoke_cxx(${kotlinParamsForward.join(',')})

  private external fun invoke_cxx(${kotlinParams.join(', ')}): ${kotlinReturnType}
}

/**
 * Represents the JavaScript callback \`${functionType.jsName}\`.
 * This is implemented in Java/Kotlin, via a \`${lambdaSignature}\`.
 * The callback is always coming from native.
 */
@DoNotStrip
@Keep
@Suppress("ClassName", "RedundantUnitReturnType", "unused")
class ${name}_java(private val function: ${lambdaSignature}): ${name} {
  @DoNotStrip
  @Keep
  override fun invoke(${kotlinParams.join(', ')}): ${kotlinReturnType} {
    return this.function(${kotlinParamsForward.join(', ')})
  }
}
  `.trim()

  const jniInterfaceDescriptor = NitroConfig.current.getAndroidPackage(
    'c++/jni',
    name
  )
  const jniClassDescriptor = NitroConfig.current.getAndroidPackage(
    'c++/jni',
    `${name}_cxx`
  )
  const bridgedReturn = new KotlinCxxBridgedType(functionType.returnType)
  const cxxNamespace = NitroConfig.current.getCxxNamespace('c++')
  const typename = functionType.getCode('c++')

  // call() Java -> C++
  const cppParams = functionType.parameters.map((p) => {
    const bridge = new KotlinCxxBridgedType(p)
    const type = bridge.asJniReferenceType('alias')
    return `${type} ${p.escapedName}`
  })
  const paramsForward = functionType.parameters.map((p) => {
    const bridge = new KotlinCxxBridgedType(p)
    return bridge.parseFromKotlinToCpp(p.escapedName, 'c++', false)
  })

  // call() C++ -> Java
  const jniParams = functionType.parameters.map((p) => {
    if (p.canBePassedByReference) {
      return `const ${p.getCode('c++')}& ${p.escapedName}`
    } else {
      return `${p.getCode('c++')} ${p.escapedName}`
    }
  })
  const jniParamsForward = [
    'self()',
    ...functionType.parameters.map((p) => {
      const bridge = new KotlinCxxBridgedType(p)
      return bridge.parseFromCppToKotlin(p.escapedName, 'c++', false)
    }),
  ]
  // `invoke` overrides `FunctionN.invoke`, so primitive returns need boxing.
  // Its parameters can remain primitive, and `Unit` returns remain `void`.
  const jniSignature = `${bridgedReturn.asJniReferenceType('local', true)}(${functionType.parameters
    .map((p) => {
      const bridge = new KotlinCxxBridgedType(p)
      return `${bridge.asJniReferenceType('alias')} /* ${p.escapedName} */`
    })
    .join(', ')})`

  let cppCallBody: string
  let jniCallBody: string
  if (functionType.returnType.kind === 'void') {
    // It returns void
    cppCallBody = `_func(${paramsForward.join(', ')});`
    jniCallBody = `
static const auto method = javaClassStatic()->getMethod<${jniSignature}>("invoke");
method(${jniParamsForward.join(', ')});
    `.trim()
  } else {
    // It returns a type!
    cppCallBody = `
${functionType.returnType.getCode('c++')} __result = _func(${paramsForward.join(', ')});
return ${bridgedReturn.parseFromCppToKotlin('__result', 'c++')};
`.trim()
    jniCallBody = `
static const auto method = javaClassStatic()->getMethod<${jniSignature}>("invoke");
auto __result = method(${jniParamsForward.join(', ')});
return ${bridgedReturn.parseFromKotlinToCpp('__result', 'c++', true)};
    `.trim()
  }

  const fbjniReturnType =
    functionType.returnType.kind === 'hybrid-object'
      ? bridgedReturn.asJniReferenceType('global')
      : bridgedReturn.asJniReferenceType('local')

  const bridged = new KotlinCxxBridgedType(functionType)
  const imports = bridged
    .getRequiredImports('c++')
    .filter((i) => i.name !== `J${name}.hpp`)
  const includes = imports.map((i) => includeHeader(i)).filter(isNotDuplicate)

  const fbjniCode = `
${createFileMetadataString(`J${name}.hpp`)}

#pragma once

#include <fbjni/fbjni.h>
#include <functional>

${includes.join('\n')}

namespace ${cxxNamespace} {

  using namespace facebook;

  /**
   * Represents the Java/Kotlin callback \`${functionType.getCode('kotlin')}\`.
   * This can be passed around between C++ and Java/Kotlin.
   */
  struct J${name}: public jni::JavaClass<J${name}> {
  public:
    static constexpr auto kJavaDescriptor = "L${jniInterfaceDescriptor};";

  public:
    /**
     * Invokes the function this \`J${name}\` instance holds through JNI.
     */
    ${functionType.returnType.getCode('c++')} invoke(${jniParams.join(', ')}) const {
      ${indent(jniCallBody, '      ')}
    }
  };

  /**
   * An implementation of ${name} that is backed by a C++ implementation (using \`std::function<...>\`)
   */
  class J${name}_cxx final: public jni::HybridClass<J${name}_cxx, J${name}> {
  public:
    static jni::local_ref<J${name}::javaobject> fromCpp(const ${typename}& func) {
      return J${name}_cxx::newObjectCxxArgs(func);
    }

  public:
    /**
     * Invokes the C++ \`std::function<...>\` this \`J${name}_cxx\` instance holds.
     */
    ${fbjniReturnType} invoke_cxx(${cppParams.join(', ')}) {
      ${indent(cppCallBody, '      ')}
    }

  public:
    [[nodiscard]]
    inline const ${typename}& getFunction() const {
      return _func;
    }

  public:
    static constexpr auto kJavaDescriptor = "L${jniClassDescriptor};";
    static void registerNatives() {
      registerHybrid({makeNativeMethod("invoke_cxx", J${name}_cxx::invoke_cxx)});
    }

  private:
    explicit J${name}_cxx(const ${typename}& func): _func(func) { }

  private:
    friend HybridBase;
    ${typename} _func;
  };

} // namespace ${cxxNamespace}
  `.trim()

  // Make sure we register all native JNI methods on app startup
  addJNINativeRegistration({
    namespace: cxxNamespace,
    className: `J${name}_cxx`,
    import: {
      name: `J${name}.hpp`,
      space: 'user',
      language: 'c++',
    },
  })

  const files: SourceFile[] = []
  files.push({
    content: kotlinCode,
    language: 'kotlin',
    name: `${name}.kt`,
    subdirectory: NitroConfig.current.getAndroidPackageDirectory(),
    platform: 'android',
  })
  files.push({
    content: fbjniCode,
    language: 'c++',
    name: `J${name}.hpp`,
    subdirectory: [],
    platform: 'android',
  })
  return files
}
