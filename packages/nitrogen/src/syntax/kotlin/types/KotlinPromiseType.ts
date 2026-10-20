import type { Language } from '../../../getPlatformSpecs.js'
import type { GetCodeOptions } from '../../types/Type.js'
import { indent } from '../../../utils.js'
import type { SourceImport } from '../../SourceFile.js'
import { PromiseType } from '../../types/PromiseType.js'
import { wrapKotlinType } from '../wrapKotlinType.js'
import {
  getJniReferenceCode,
  type KotlinConversion,
  type KotlinType,
} from './KotlinType.js'

export class KotlinPromiseType extends PromiseType implements KotlinType {
  override readonly resultingType: KotlinType
  readonly jniValueKind = 'pointer'
  readonly needsKotlinConversion = false

  constructor(readonly type: PromiseType) {
    // JNI resolves promises with objects, so primitive results are boxed.
    const resultingType = wrapKotlinType(type.resultingType, { boxed: true })
    super(resultingType)
    this.resultingType = resultingType
  }

  convert(value: string, conversion: KotlinConversion): string {
    switch (conversion.in) {
      case 'kotlin':
        // Kotlin passes its public Promise through JNI without converting its result.
        return value
      case 'c++':
        switch (conversion.from) {
          case 'c++':
            return this.getCppToJniCode(value)
          case 'kotlin':
            return this.getJniToCppCode(value)
        }
    }
  }

  private getCppToJniCode(value: string): string {
    let resolveListenerCode: string
    if (this.resultingType.kind === 'void') {
      // void: resolve()
      resolveListenerCode = `
${value}->addOnResolvedListener([=]() {
  __promise->cthis()->resolve(JUnit::instance());
});
`.trim()
    } else {
      // T: resolve(T)
      const resolvingType = this.type.resultingType.getCode('c++', {
        context: 'type-argument',
      })
      const jniResult = this.resultingType.convert('__result', {
        from: 'c++',
        to: 'kotlin',
        in: 'c++',
      })
      resolveListenerCode = `
${value}->addOnResolvedListener([=](const ${resolvingType}& __result) {
  __promise->cthis()->resolve(${indent(jniResult, '  ')});
});
`.trim()
    }
    return `
[&]() {
  jni::local_ref<JPromise::javaobject> __localPromise = JPromise::create();
  jni::global_ref<JPromise::javaobject> __promise = jni::make_global(__localPromise);
  ${indent(resolveListenerCode, '  ')}
  ${value}->addOnRejectedListener([=](const std::exception_ptr& __error) {
    auto __jniError = jni::getJavaExceptionForCppException(__error);
    __promise->cthis()->reject(__jniError);
  });
  return __localPromise;
}()
`.trim()
  }
  private getJniToCppCode(value: string): string {
    const actualCppType = this.type.resultingType.getCode('c++', {
      context: 'type-argument',
    })
    let resolveListenerCode: string
    if (this.resultingType.kind === 'void') {
      // it's a Promise<void>
      resolveListenerCode = `
${value}->cthis()->addOnResolvedListener([=](const jni::alias_ref<jni::JObject>& /* unit */) {
  __promise->resolve();
});
`.trim()
    } else {
      // it's a Promise<T>
      const jniResultType = this.resultingType.getCode('c++', {
        context: 'type-argument',
      })
      const cppResult = this.resultingType.convert('__result', {
        from: 'kotlin',
        to: 'c++',
        in: 'c++',
      })
      resolveListenerCode = `
${value}->cthis()->addOnResolvedListener([=](const jni::alias_ref<jni::JObject>& __boxedResult) {
  auto __result = jni::static_ref_cast<${jniResultType}>(__boxedResult);
  __promise->resolve(${indent(cppResult, '  ')});
});
`.trim()
    }
    return `
[&]() {
  auto __promise = Promise<${actualCppType}>::create();
  ${indent(resolveListenerCode, '  ')}
  ${value}->cthis()->addOnRejectedListener([=](const jni::alias_ref<jni::JThrowable>& __throwable) {
    jni::JniException __jniError(__throwable);
    __promise->reject(std::make_exception_ptr(__jniError));
  });
  return __promise;
}()
`.trim()
  }
  override getCode(language: Language, options: GetCodeOptions): string {
    switch (language) {
      case 'c++':
        return getJniReferenceCode('JPromise::javaobject', options.context)
      case 'kotlin':
        // Kotlin passes its public Promise through JNI without converting its result.
        return this.type.getCode(language, options)
      default:
        return super.getCode(language, options)
    }
  }

  override getRequiredImports(language: Language): SourceImport[] {
    const imports = this.type.getRequiredImports(language)
    switch (language) {
      case 'c++':
        imports.push({
          language: language,
          declaration: { name: 'NitroModules/JPromise.hpp', space: 'system' },
        })
        if (this.resultingType.kind === 'void') {
          // Promise<void> resolves with JUnit
          imports.push({
            language: language,
            declaration: { name: 'NitroModules/JUnit.hpp', space: 'system' },
          })
        }
        break
    }
    imports.push(...this.resultingType.getRequiredImports(language))
    return imports
  }
}
