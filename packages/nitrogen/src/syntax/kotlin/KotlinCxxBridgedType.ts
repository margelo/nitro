import type { Language } from '../../getPlatformSpecs.js'
import { indent } from '../../utils.js'
import type { BridgedType } from '../BridgedType.js'
import { getHybridObjectName } from '../getHybridObjectName.js'
import { getReferencedTypes } from '../getReferencedTypes.js'
import type { SourceFile, SourceImport } from '../SourceFile.js'
import { ArrayType } from '../types/ArrayType.js'
import { EnumType } from '../types/EnumType.js'
import { FunctionType } from '../types/FunctionType.js'
import { getTypeAs } from '../types/getTypeAs.js'
import { HybridObjectType } from '../types/HybridObjectType.js'
import { OptionalType } from '../types/OptionalType.js'
import { PromiseType } from '../types/PromiseType.js'
import { RecordType } from '../types/RecordType.js'
import { StructType } from '../types/StructType.js'
import type { Type } from '../types/Type.js'
import { VariantType } from '../types/VariantType.js'
import { getKotlinBoxedPrimitiveType } from './KotlinBoxedPrimitive.js'
import { createKotlinEnum } from './KotlinEnum.js'
import { createKotlinFunction } from './KotlinFunction.js'
import { createKotlinStruct } from './KotlinStruct.js'
import { createKotlinVariant } from './KotlinVariant.js'

export class KotlinCxxBridgedType implements BridgedType<'kotlin', 'c++'> {
  readonly type: Type

  constructor(type: Type) {
    this.type = type
  }

  get hasType(): boolean {
    return this.type.kind !== 'void'
  }

  get canBePassedByReference(): boolean {
    return this.type.canBePassedByReference
  }

  get needsSpecialHandling(): boolean {
    switch (this.type.kind) {
      case 'function':
        // Function needs to be converted from JFunc_... to Lambda
        return true
      case 'optional':
        // Optionals need special handling if the wrapped type needs special handling
        const optional = getTypeAs(this.type, OptionalType)
        return new KotlinCxxBridgedType(optional.wrappingType)
          .needsSpecialHandling
      case 'array':
        // Arrays need special handling if their item type needs special handling
        const array = getTypeAs(this.type, ArrayType)
        return new KotlinCxxBridgedType(array.itemType).needsSpecialHandling
      case 'record':
        // Records need special handling if their key or value type needs special handling
        const record = getTypeAs(this.type, RecordType)
        const keyType = new KotlinCxxBridgedType(record.keyType)
        const valueType = new KotlinCxxBridgedType(record.valueType)
        return keyType.needsSpecialHandling || valueType.needsSpecialHandling
      case 'uint64':
        // ULong == Long, we need to cast
        return true
      default:
        break
    }
    // no special handling needed
    return false
  }

  getRequiredImports(
    language: Language,
    visited: Set<Type> = new Set()
  ): SourceImport[] {
    if (visited.has(this.type)) return []
    visited.add(this.type)

    const imports = this.type.getRequiredImports(language)

    if (language === 'c++') {
      // All C++ imports we need for the JNI bridge
      switch (this.type.kind) {
        case 'enum':
          const enumType = getTypeAs(this.type, EnumType)
          imports.push({
            language: 'c++',
            name: `J${enumType.enumName}.hpp`,
            space: 'user',
          })
          break
        case 'struct':
          const structType = getTypeAs(this.type, StructType)
          imports.push({
            language: 'c++',
            name: `J${structType.structName}.hpp`,
            space: 'user',
          })
          break
        case 'function':
          const functionType = getTypeAs(this.type, FunctionType)
          imports.push({
            language: 'c++',
            name: `J${functionType.specializationName}.hpp`,
            space: 'user',
          })
          imports.push({
            language: 'c++',
            name: `NitroModules/JNICallable.hpp`,
            space: 'system',
          })
          break
        case 'null':
          imports.push({
            language: 'c++',
            name: `NitroModules/JNull.hpp`,
            space: 'system',
          })
          break
        case 'array-buffer':
          imports.push({
            language: 'c++',
            name: 'NitroModules/JArrayBuffer.hpp',
            space: 'system',
          })
          break
        case 'promise':
          imports.push({
            language: 'c++',
            name: 'NitroModules/JPromise.hpp',
            space: 'system',
          })
          const promiseType = getTypeAs(this.type, PromiseType)
          if (promiseType.resultingType.kind === 'void') {
            // Promise<void> uses JUnit
            imports.push({
              language: 'c++',
              name: 'NitroModules/JUnit.hpp',
              space: 'system',
            })
          }
          break
        case 'date':
          imports.push({
            language: 'c++',
            name: 'NitroModules/JInstant.hpp',
            space: 'system',
          })
          break
        case 'map':
          imports.push({
            language: 'c++',
            name: 'NitroModules/JAnyMap.hpp',
            space: 'system',
          })
          break
        case 'variant':
          const variantType = getTypeAs(this.type, VariantType)
          const variantName = variantType.getAliasName('kotlin')
          imports.push({
            language: 'c++',
            name: `J${variantName}.hpp`,
            space: 'user',
          })
          break
        case 'hybrid-object': {
          const hybridObjectType = getTypeAs(this.type, HybridObjectType)
          const name = getHybridObjectName(hybridObjectType.hybridObjectName)
          if (hybridObjectType.sourceConfig.isExternalConfig) {
            // It's an externally imported type
            imports.push({
              language: 'c++',
              name: `${hybridObjectType.sourceConfig.getAndroidCxxLibName()}/${name.JHybridTSpec}.hpp`,
              space: 'system',
            })
          } else {
            // It's our custom type
            imports.push({
              language: 'c++',
              name: `${name.JHybridTSpec}.hpp`,
              space: 'user',
            })
          }
          break
        }
      }
    }

    // Recursively look into referenced types (e.g. the `T` of a `optional<T>`, or `T` of a `T[]`)
    const referencedTypes = getReferencedTypes(this.type)
    for (const t of referencedTypes) {
      const bridged = new KotlinCxxBridgedType(t)
      imports.push(...bridged.getRequiredImports(language, visited))
    }

    return imports
  }

  getExtraFiles(visited: Set<Type> = new Set()): SourceFile[] {
    if (visited.has(this.type)) return []
    visited.add(this.type)
    const files: SourceFile[] = []

    switch (this.type.kind) {
      case 'enum':
        const enumType = getTypeAs(this.type, EnumType)
        const enumFiles = createKotlinEnum(enumType)
        files.push(...enumFiles)
        break
      case 'struct':
        const structType = getTypeAs(this.type, StructType)
        const structFiles = createKotlinStruct(structType)
        files.push(...structFiles)
        break
      case 'variant':
        const variantType = getTypeAs(this.type, VariantType)
        const variantFiles = createKotlinVariant(variantType)
        files.push(...variantFiles)
        break
      case 'function':
        const functionType = getTypeAs(this.type, FunctionType)
        const funcFiles = createKotlinFunction(functionType)
        files.push(...funcFiles)
        break
    }

    // Recursively look into referenced types (e.g. the `T` of a `optional<T>`, or `T` of a `T[]`)
    const referencedTypes = getReferencedTypes(this.type)
    for (const t of referencedTypes) {
      const bridged = new KotlinCxxBridgedType(t)
      files.push(...bridged.getExtraFiles(visited))
    }

    return files
  }

  asJniReferenceType(
    referenceType: 'alias' | 'local' | 'global' = 'alias',
    isBoxed = false
  ) {
    const typeCode = this.getTypeCode('c++', isBoxed)
    switch (this.type.kind) {
      case 'void':
        return 'void'
      case 'number':
      case 'boolean':
      case 'int64':
      case 'uint64':
        if (!isBoxed) {
          return typeCode
        }
    }
    return `jni::${referenceType}_ref<${typeCode}>`
  }

  getTypeCode(language: 'kotlin' | 'c++', isBoxed = false): string {
    switch (this.type.kind) {
      case 'number':
      case 'boolean':
      case 'int64':
        if (isBoxed) {
          return getKotlinBoxedPrimitiveType(this.type)
        } else {
          if (this.type.kind === 'boolean' && language === 'c++') {
            // JNI does not use `bool`, so it is a jboolean instead.
            return 'jboolean'
          }
          return this.type.getCode(language)
        }
      case 'uint64':
        // ULong is unfortunately not representable in JNI. It's long + cast
        switch (language) {
          case 'c++':
            if (isBoxed) {
              return 'jni::JLong'
            } else {
              return 'jlong'
            }
          case 'kotlin':
            return 'Long'
          default:
            return this.type.getCode(language)
        }
      case 'array':
        const array = getTypeAs(this.type, ArrayType)
        const bridgedItem = new KotlinCxxBridgedType(array.itemType)
        switch (language) {
          case 'c++':
            switch (array.itemType.kind) {
              case 'number':
                return 'jni::JArrayDouble'
              case 'boolean':
                return 'jni::JArrayBoolean'
              case 'int64':
                return 'jni::JArrayLong'
              case 'uint64':
                // ULong is Long, we have to reinterpret cast it
                return 'jni::JArrayLong'
              default:
                return `jni::JArrayClass<${bridgedItem.getTypeCode(language)}>`
            }
          case 'kotlin':
            switch (array.itemType.kind) {
              case 'number':
                return 'DoubleArray'
              case 'boolean':
                return 'BooleanArray'
              case 'int64':
                return 'LongArray'
              case 'uint64':
                // ULong is Long, we have to reinterpret cast it
                return 'LongArray'
              default:
                return `Array<${bridgedItem.getTypeCode(language)}>`
            }
          default:
            return this.type.getCode(language)
        }
      case 'string':
        switch (language) {
          case 'c++':
            return 'jni::JString'
          default:
            return this.type.getCode(language)
        }
      case 'record': {
        switch (language) {
          case 'c++':
            const recordType = getTypeAs(this.type, RecordType)
            const keyType = new KotlinCxxBridgedType(
              recordType.keyType
            ).getTypeCode(language, true)
            const valueType = new KotlinCxxBridgedType(
              recordType.valueType
            ).getTypeCode(language, true)
            return `jni::JMap<${keyType}, ${valueType}>`
          default:
            return this.type.getCode(language)
        }
      }
      case 'enum':
        switch (language) {
          case 'c++':
            const enumType = getTypeAs(this.type, EnumType)
            return `J${enumType.enumName}`
          default:
            return this.type.getCode(language)
        }
      case 'struct':
        switch (language) {
          case 'c++':
            const structType = getTypeAs(this.type, StructType)
            return `J${structType.structName}`
          default:
            return this.type.getCode(language)
        }
      case 'function':
        const functionType = getTypeAs(this.type, FunctionType)
        switch (language) {
          case 'c++':
            return `J${functionType.specializationName}::javaobject`
          case 'kotlin':
            return functionType.specializationName
          default:
            return this.type.getCode(language)
        }
      case 'hybrid-object': {
        switch (language) {
          case 'c++':
            const hybridObjectType = getTypeAs(this.type, HybridObjectType)
            const fullName = this.getFullJHybridObjectName(hybridObjectType)
            return `${fullName}::JavaPart`
          default:
            return this.type.getCode(language)
        }
      }
      case 'null':
        switch (language) {
          case 'c++':
            return `JNull`
          default:
            return this.type.getCode(language)
        }
      case 'array-buffer':
        switch (language) {
          case 'c++':
            return `JArrayBuffer::javaobject`
          default:
            return this.type.getCode(language)
        }
      case 'date':
        switch (language) {
          case 'c++':
            return `JInstant`
          default:
            return this.type.getCode(language)
        }
      case 'variant': {
        const variant = getTypeAs(this.type, VariantType)
        const name = variant.getAliasName('kotlin')
        switch (language) {
          case 'c++':
            return `J${name}`
          case 'kotlin':
            return name
          default:
            return this.type.getCode(language)
        }
      }
      case 'promise':
        switch (language) {
          case 'c++':
            return `JPromise::javaobject`
          default:
            return this.type.getCode(language)
        }
      case 'map':
        switch (language) {
          case 'c++':
            return `JAnyMap::javaobject`
          default:
            return this.type.getCode(language)
        }
      case 'optional': {
        const optional = getTypeAs(this.type, OptionalType)
        const bridgedWrappingType = new KotlinCxxBridgedType(
          optional.wrappingType
        )
        switch (language) {
          case 'c++':
            switch (optional.wrappingType.kind) {
              // primitives need to be boxed to make them nullable
              case 'number':
              case 'boolean':
              case 'int64':
              case 'uint64':
                const boxed = getKotlinBoxedPrimitiveType(optional.wrappingType)
                return boxed
              default:
                // all other types can be nullable as they are objects.
                return bridgedWrappingType.getTypeCode('c++')
            }
          case 'kotlin':
            return `${bridgedWrappingType.getTypeCode(language)}?`
          default:
            return this.type.getCode(language)
        }
      }
      case 'error':
        switch (language) {
          case 'c++':
            return 'jni::JThrowable'
          default:
            return this.type.getCode(language)
        }
      default:
        return this.type.getCode(language)
    }
  }

  parse(
    parameterName: string,
    from: 'c++' | 'kotlin',
    to: 'kotlin' | 'c++',
    inLanguage: 'kotlin' | 'c++'
  ): string {
    if (from === 'c++') {
      return this.parseFromCppToKotlin(parameterName, inLanguage)
    } else if (from === 'kotlin') {
      return this.parseFromKotlinToCpp(parameterName, inLanguage)
    } else {
      throw new Error(`Cannot parse "${parameterName}" from ${from} to ${to}!`)
    }
  }

  dereferenceToJObject(parameterName: string): string {
    switch (this.type.kind) {
      // an optional bridges to a (possibly `nullptr`) ref of its wrapping type,
      // so it needs to be dereferenced the same way as the type it wraps.
      case 'optional': {
        const optional = getTypeAs(this.type, OptionalType)
        const bridge = new KotlinCxxBridgedType(optional.wrappingType)
        return bridge.dereferenceToJObject(parameterName)
      }
      // any jni::HybridClass needs to be dereferenced to jobject with .get()
      case 'array-buffer':
      case 'function':
      case 'hybrid-object-base':
      case 'map':
      case 'promise':
        return `${parameterName}.get()`
      // anything else can be dereferenced to jobject with *
      default:
        return `*${parameterName}`
    }
  }

  parseFromCppToKotlin(
    parameterName: string,
    language: 'kotlin' | 'c++',
    isBoxed = false
  ): string {
    switch (this.type.kind) {
      case 'number':
      case 'boolean':
      case 'int64':
      case 'uint64':
        switch (language) {
          case 'c++':
            if (isBoxed) {
              // box a primitive (double) to an object (JDouble)
              const boxed = getKotlinBoxedPrimitiveType(this.type)
              return `${boxed}::valueOf(${parameterName})`
            } else {
              return parameterName
            }
          case 'kotlin':
            switch (this.type.kind) {
              case 'uint64':
                // Long -> ULong
                return `${parameterName}.toULong()`
              default:
                return parameterName
            }
          default:
            return parameterName
        }
      case 'string':
        switch (language) {
          case 'c++':
            return `jni::make_jstring(${parameterName})`
          default:
            return parameterName
        }
      case 'struct': {
        switch (language) {
          case 'c++':
            const struct = getTypeAs(this.type, StructType)
            return `J${struct.structName}::fromCpp(${parameterName})`
          default:
            return parameterName
        }
      }
      case 'variant': {
        switch (language) {
          case 'c++':
            const variant = getTypeAs(this.type, VariantType)
            const name = variant.getAliasName('kotlin')
            return `J${name}::fromCpp(${parameterName})`
          default:
            return parameterName
        }
      }
      case 'null': {
        switch (language) {
          case 'c++':
            return `JNull::null()`
          default:
            return parameterName
        }
      }
      case 'date': {
        switch (language) {
          case 'c++':
            return `JInstant::fromChrono(${parameterName})`
          default:
            return parameterName
        }
      }
      case 'enum': {
        switch (language) {
          case 'c++':
            const enumType = getTypeAs(this.type, EnumType)
            return `J${enumType.enumName}::fromCpp(${parameterName})`
          default:
            return parameterName
        }
      }
      case 'function': {
        switch (language) {
          case 'c++':
            const func = getTypeAs(this.type, FunctionType)
            return `J${func.specializationName}_cxx::fromCpp(${parameterName})`
          case 'kotlin':
            return parameterName
          default:
            return parameterName
        }
      }
      case 'hybrid-object': {
        switch (language) {
          case 'c++':
            const hybrid = getTypeAs(this.type, HybridObjectType)
            const fullName = this.getFullJHybridObjectName(hybrid)
            return `std::dynamic_pointer_cast<${fullName}>(${parameterName})->getJavaPart()`
          default:
            return parameterName
        }
      }
      case 'optional': {
        const optional = getTypeAs(this.type, OptionalType)
        const bridge = new KotlinCxxBridgedType(optional.wrappingType)
        switch (language) {
          case 'c++':
            return `${parameterName}.has_value() ? ${bridge.parseFromCppToKotlin(`${parameterName}.value()`, 'c++', true)} : nullptr`
          case 'kotlin':
            if (bridge.needsSpecialHandling) {
              return `${parameterName}?.let { ${bridge.parseFromCppToKotlin('it', language, isBoxed)} }`
            } else {
              return parameterName
            }
          default:
            return parameterName
        }
      }
      case 'array-buffer': {
        switch (language) {
          case 'c++':
            return `JArrayBuffer::wrap(${parameterName})`
          default:
            return parameterName
        }
      }
      case 'map': {
        switch (language) {
          case 'c++':
            return `JAnyMap::create(${parameterName})`
          default:
            return parameterName
        }
      }
      case 'record': {
        switch (language) {
          case 'c++':
            const record = getTypeAs(this.type, RecordType)
            const key = new KotlinCxxBridgedType(record.keyType)
            const value = new KotlinCxxBridgedType(record.valueType)
            const parseKey = key.parseFromCppToKotlin(
              '__entry.first',
              'c++',
              true
            )
            const parseValue = value.parseFromCppToKotlin(
              '__entry.second',
              'c++',
              true
            )
            const keyType = key.getTypeCode('c++', true)
            const valueType = value.getTypeCode('c++', true)
            const javaMapType = `jni::JMap<${keyType}, ${valueType}>`
            const javaHashMapType = `jni::JHashMap<${keyType}, ${valueType}>`
            return `
[&]() -> jni::local_ref<${javaMapType}> {
  auto __map = ${javaHashMapType}::create(${parameterName}.size());
  for (const auto& __entry : ${parameterName}) {
    __map->put(${indent(parseKey, '    ')}, ${indent(parseValue, '    ')});
  }
  return __map;
}()
            `.trim()
          default:
            return parameterName
        }
      }
      case 'array': {
        const array = getTypeAs(this.type, ArrayType)
        const arrayType = this.getTypeCode('c++')
        const bridge = new KotlinCxxBridgedType(array.itemType)
        switch (language) {
          case 'c++': {
            switch (array.itemType.kind) {
              case 'number':
              case 'boolean':
              case 'int64':
              case 'uint64': {
                // primitive arrays can be constructed more efficiently with region/batch access.
                // no need to iterate through the entire array.
                return `
[&]() {
  size_t __size = ${parameterName}.size();
  jni::local_ref<${arrayType}> __array = ${arrayType}::newArray(__size);
  __array->setRegion(0, __size, ${parameterName}.data());
  return __array;
}()
`.trim()
              }
              default: {
                // other arrays need to loop through.
                // we wrap the lambda with a parameter (`__input`) so that nested arrays
                // don't end up shadowing `__element` in their own initializers
                // (which would be `const auto& __element = __element[__i]`,
                //  an invalid self-referential `auto`-type deduction).
                // `auto&&` is a forwarding reference so it binds to both const and
                // non-const inputs across nesting levels.
                return `
[&](auto&& __input) {
  size_t __size = __input.size();
  jni::local_ref<${arrayType}> __array = ${arrayType}::newArray(__size);
  for (size_t __i = 0; __i < __size; __i++) {
    const auto& __element = __input[__i];
    auto __elementJni = ${indent(bridge.parseFromCppToKotlin('__element', 'c++'), '    ')};
    __array->setElement(__i, ${bridge.dereferenceToJObject('__elementJni')});
  }
  return __array;
}(${parameterName})
            `.trim()
              }
            }
          }
          case 'kotlin':
            if (bridge.needsSpecialHandling) {
              const variableName = `${parameterName}[i]`
              const parseCode = bridge.parseFromCppToKotlin(
                variableName,
                'kotlin',
                isBoxed
              )
              return `Array(${parameterName}.size) { i -> ${parseCode} }`
            } else {
              return parameterName
            }
          default:
            return parameterName
        }
      }
      case 'promise': {
        switch (language) {
          case 'c++': {
            const promise = getTypeAs(this.type, PromiseType)
            const resolvingType = promise.resultingType.getCode('c++')
            const bridge = new KotlinCxxBridgedType(promise.resultingType)
            if (promise.resultingType.kind === 'void') {
              // void: resolve()
              return `
[&]() {
  jni::local_ref<JPromise::javaobject> __localPromise = JPromise::create();
  jni::global_ref<JPromise::javaobject> __promise = jni::make_global(__localPromise);
  ${parameterName}->addOnResolvedListener([=]() {
    __promise->cthis()->resolve(JUnit::instance());
  });
  ${parameterName}->addOnRejectedListener([=](const std::exception_ptr& __error) {
    auto __jniError = jni::getJavaExceptionForCppException(__error);
    __promise->cthis()->reject(__jniError);
  });
  return __localPromise;
}()
`.trim()
            } else {
              // T: resolve(T)
              return `
[&]() {
  jni::local_ref<JPromise::javaobject> __localPromise = JPromise::create();
  jni::global_ref<JPromise::javaobject> __promise = jni::make_global(__localPromise);
  ${parameterName}->addOnResolvedListener([=](const ${resolvingType}& __result) {
    __promise->cthis()->resolve(${indent(bridge.parseFromCppToKotlin('__result', 'c++', true), '    ')});
  });
  ${parameterName}->addOnRejectedListener([=](const std::exception_ptr& __error) {
    auto __jniError = jni::getJavaExceptionForCppException(__error);
    __promise->cthis()->reject(__jniError);
  });
  return __localPromise;
}()
`.trim()
            }
          }
          default:
            return parameterName
        }
      }
      case 'error':
        switch (language) {
          case 'c++':
            return `jni::getJavaExceptionForCppException(${parameterName})`
          default:
            return parameterName
        }
      default:
        // no need to parse anything, just return as is
        return parameterName
    }
  }

  parseFromKotlinToCpp(
    parameterName: string,
    language: 'kotlin' | 'c++',
    isBoxed = false
  ): string {
    switch (this.type.kind) {
      case 'boolean':
      case 'number':
      case 'int64':
      case 'uint64':
        switch (language) {
          case 'c++':
            let code: string
            if (isBoxed) {
              // unbox an object (JDouble) to a primitive (double)
              code = `${parameterName}->value()`
            } else {
              // it's just the primitive type directly
              code = parameterName
            }
            switch (this.type.kind) {
              case 'boolean':
                // jboolean =/= bool (it's a char in Java)
                code = `static_cast<bool>(${code})`
                break
              case 'uint64':
                // jlong =/= uint64 (it's signed in Java)
                code = `static_cast<uint64_t>(${code})`
                break
              default:
                break
            }
            return code
          case 'kotlin':
            switch (this.type.kind) {
              case 'uint64':
                // ULong -> Long
                return `${parameterName}.toLong()`
              default:
                return parameterName
            }
          default:
            return parameterName
        }
      case 'string':
        switch (language) {
          case 'c++':
            return `${parameterName}->toStdString()`
          default:
            return parameterName
        }
      case 'struct':
      case 'enum': {
        switch (language) {
          case 'c++':
            return `${parameterName}->toCpp()`
          default:
            return parameterName
        }
      }
      case 'variant': {
        switch (language) {
          case 'c++':
            return `${parameterName}->toCpp()`
          default:
            return parameterName
        }
      }
      case 'date': {
        switch (language) {
          case 'c++':
            return `${parameterName}->toChrono()`
          default:
            return parameterName
        }
      }
      case 'null': {
        switch (language) {
          case 'c++':
            return `nitro::null`
          default:
            return parameterName
        }
      }
      case 'hybrid-object': {
        switch (language) {
          case 'c++':
            const hybridObject = getTypeAs(this.type, HybridObjectType)
            const { JHybridTSpec } = getHybridObjectName(
              hybridObject.hybridObjectName
            )
            return `${parameterName}->get${JHybridTSpec}()`
          default:
            return parameterName
        }
      }
      case 'optional': {
        const optional = getTypeAs(this.type, OptionalType)
        const bridge = new KotlinCxxBridgedType(optional.wrappingType)
        switch (language) {
          case 'c++':
            const parsed = bridge.parseFromKotlinToCpp(
              parameterName,
              'c++',
              true
            )
            return `${parameterName} != nullptr ? std::make_optional(${parsed}) : std::nullopt`
          case 'kotlin':
            if (bridge.needsSpecialHandling) {
              return `${parameterName}?.let { ${bridge.parseFromKotlinToCpp('it', language, isBoxed)} }`
            } else {
              return parameterName
            }
          default:
            return parameterName
        }
      }
      case 'function': {
        const functionType = getTypeAs(this.type, FunctionType)
        switch (language) {
          case 'c++': {
            const returnType = functionType.returnType.getCode('c++')
            const paramTypes = functionType.parameters.map((p) =>
              p.getCode('c++')
            )
            const jniType = `J${functionType.specializationName}_cxx`
            return `
[&]() -> ${functionType.getCode('c++')} {
  if (${parameterName}->isInstanceOf(${jniType}::javaClassStatic())) [[likely]] {
    auto downcast = jni::static_ref_cast<${jniType}::javaobject>(${parameterName});
    return downcast->cthis()->getFunction();
  } else {
    auto ${parameterName}Ref = jni::make_global(${parameterName});
    return JNICallable<J${functionType.specializationName}, ${returnType}(${paramTypes.join(', ')})>(std::move(${parameterName}Ref));
  }
}()
            `.trim()
          }
          case 'kotlin': {
            return `${functionType.specializationName}_java(${parameterName})`
          }
          default:
            return parameterName
        }
      }
      case 'array-buffer': {
        switch (language) {
          case 'c++':
            return `${parameterName}->cthis()->getArrayBuffer()`
          default:
            return parameterName
        }
      }
      case 'map': {
        switch (language) {
          case 'c++':
            return `${parameterName}->cthis()->getMap()`
          default:
            return parameterName
        }
      }
      case 'record': {
        switch (language) {
          case 'c++':
            const record = getTypeAs(this.type, RecordType)
            const key = new KotlinCxxBridgedType(record.keyType)
            const value = new KotlinCxxBridgedType(record.valueType)
            const parseKey = key.parseFromKotlinToCpp(
              '__entry.first',
              'c++',
              true
            )
            const parseValue = value.parseFromKotlinToCpp(
              '__entry.second',
              'c++',
              true
            )
            const cxxType = this.type.getCode('c++')
            return `
[&]() {
  ${cxxType} __map;
  __map.reserve(${parameterName}->size());
  for (const auto& __entry : *${parameterName}) {
    __map.emplace(${indent(parseKey, '    ')}, ${indent(parseValue, '    ')});
  }
  return __map;
}()
            `.trim()
          default:
            return parameterName
        }
      }
      case 'array': {
        const array = getTypeAs(this.type, ArrayType)
        const bridge = new KotlinCxxBridgedType(array.itemType)
        switch (language) {
          case 'c++': {
            const itemType = array.itemType.getCode('c++')
            switch (array.itemType.kind) {
              case 'number':
              case 'boolean':
              case 'int64':
              case 'uint64': {
                // primitive arrays can use region/batch access,
                // which we can use to construct the vector directly instead of looping through it.
                return `
[&]() {
  size_t __size = ${parameterName}->size();
  std::vector<${itemType}> __vector(__size);
  ${parameterName}->getRegion(0, __size, __vector.data());
  return __vector;
}()
`.trim()
              }
              default: {
                // other arrays need to loop through.
                // we wrap the lambda with a parameter (`__input`) so that nested arrays
                // don't end up shadowing `__element` in their own initializers
                // (which would be `auto __element = __element->getElement(__i)`,
                //  an invalid self-referential `auto`-type deduction).
                // `auto&&` is a forwarding reference so it binds to both const and
                // non-const inputs across nesting levels (and to JNI `local_ref`s,
                // which expose non-const `getElement(...)`).
                return `
[&](auto&& __input) {
  size_t __size = __input->size();
  std::vector<${itemType}> __vector;
  __vector.reserve(__size);
  for (size_t __i = 0; __i < __size; __i++) {
    auto __element = __input->getElement(__i);
    __vector.push_back(${indent(bridge.parseFromKotlinToCpp('__element', 'c++'), '    ')});
  }
  return __vector;
}(${parameterName})
            `.trim()
              }
            }
          }
          case 'kotlin':
            if (bridge.needsSpecialHandling) {
              const variableName = `${parameterName}[i]`
              const parseCode = bridge.parseFromKotlinToCpp(
                variableName,
                'kotlin',
                isBoxed
              )
              return `Array(${parameterName}.size) { i -> ${parseCode} }`
            } else {
              return parameterName
            }
          default:
            return parameterName
        }
      }
      case 'promise': {
        switch (language) {
          case 'c++':
            const promise = getTypeAs(this.type, PromiseType)
            const actualCppType = promise.resultingType.getCode('c++')
            const resultingType = new KotlinCxxBridgedType(
              promise.resultingType
            )
            let resolveBody: string
            if (resultingType.hasType) {
              // it's a Promise<T>
              resolveBody = `
auto __result = jni::static_ref_cast<${resultingType.getTypeCode('c++', true)}>(__boxedResult);
__promise->resolve(${resultingType.parseFromKotlinToCpp('__result', 'c++', true)});
          `.trim()
            } else {
              // it's a Promise<void>
              resolveBody = `
__promise->resolve();
          `.trim()
            }
            return `
[&]() {
  auto __promise = Promise<${actualCppType}>::create();
  ${parameterName}->cthis()->addOnResolvedListener([=](const jni::alias_ref<jni::JObject>& ${resultingType.hasType ? '__boxedResult' : '/* unit */'}) {
    ${indent(resolveBody, '    ')}
  });
  ${parameterName}->cthis()->addOnRejectedListener([=](const jni::alias_ref<jni::JThrowable>& __throwable) {
    jni::JniException __jniError(__throwable);
    __promise->reject(std::make_exception_ptr(__jniError));
  });
  return __promise;
}()
        `.trim()
          default:
            return parameterName
        }
      }
      case 'error':
        switch (language) {
          case 'c++':
            return `std::make_exception_ptr(jni::JniException(${parameterName}))`
          default:
            return parameterName
        }
      default:
        // no need to parse anything, just return as is
        return parameterName
    }
  }

  private getFullJHybridObjectName(hybridObject: HybridObjectType): string {
    const name = getHybridObjectName(hybridObject.hybridObjectName)
    if (hybridObject.sourceConfig.isExternalConfig) {
      // fully qualified name like "margelo::nitro::image::JImage"
      const fullName = hybridObject.sourceConfig.getCxxNamespace(
        'c++',
        name.JHybridTSpec
      )
      return fullName
    } else {
      // relative name like "JImage"
      return name.JHybridTSpec
    }
  }
}
