//
//  HybridFunction.hpp
//  NitroModules
//
//  Created by Marc Rousavy on 07.08.24.
//

#pragma once

namespace margelo::nitro {
template <typename T, typename Enable>
struct JSIConverter;
} // namespace margelo::nitro

#include "CountTrailingOptionals.hpp"
#include "InstanceMethod.hpp"
#include "JSIConverter.hpp"
#include "NitroDefines.hpp"
#include "NitroTypeInfo.hpp"
#include "PropNameIDCache.hpp"
#include <exception>
#include <functional>
#include <jsi/jsi.h>
#include <memory>
#include <string>
#include <type_traits>

namespace margelo::nitro {

using namespace facebook;

/**
 * Represents the kind of a function - it can be either a normal function ("METHOD"),
 * or a property ("GETTER" + "SETTER")
 */
enum class FunctionKind { METHOD, GETTER, SETTER };

/**
 * A helper for an `InstanceMethod` that doesn't have a typed return value or arguments, but instead uses raw JSI values.
 */
template <typename T>
using RawInstanceMethod = InstanceMethod<
    /* instance type */ T,
    /* return value */ jsi::Value,
    /* jsi::HostFunction arguments */ jsi::Runtime&, const jsi::Value&, const jsi::Value*, size_t>;

/**
 * Represents a Hybrid Function.
 */
class HybridFunction final {
private:
  jsi::HostFunctionType _function;
  size_t _paramCount;
  std::string _name;

public:
  // getters
  inline const std::string& getName() const {
    return _name;
  }
  inline size_t getParamCount() const {
    return _paramCount;
  }
  inline const jsi::HostFunctionType& getHostFunction() const {
    return _function;
  }

public:
  // functions
  inline jsi::Function toJSFunction(jsi::Runtime& runtime) const {
    return jsi::Function::createFromHostFunction(runtime, PropNameIDCache::get(runtime, _name), static_cast<unsigned int>(_paramCount),
                                                 _function);
  }

private:
  HybridFunction(jsi::HostFunctionType&& function, size_t paramCount, const std::string& name)
      : _function(std::move(function)), _paramCount(paramCount), _name(name) {}

public:
  /**
   * Create a new `HybridFunction` that can be called from JS.
   * This performs proper JSI -> C++ conversion using `JSIConverter<T>`,
   * and assumes that the object this is called on has a proper `this` configured.
   * The object's `this` needs to be a `NativeState`.
   */
  template <typename THybrid, typename ReturnType, typename... Args>
  static inline HybridFunction createHybridFunction(/* The name of the method */ const std::string& name,
                                                    /* The method on THybrid */ InstanceMethod<THybrid, ReturnType, Args...> method,
                                                    /* The type of the method */ FunctionKind kind) {
    jsi::HostFunctionType hostFunction = [name, method, kind](/* JS Runtime */ jsi::Runtime& runtime,
                                                              /* HybridObject */ const jsi::Value& thisValue,
                                                              /* JS arguments */ const jsi::Value* NON_NULL args,
                                                              /* argument size */ size_t count) -> jsi::Value {
      // 1. Get actual `HybridObject` instance from `thisValue` (it's stored as `NativeState`)
      std::shared_ptr<THybrid> hybridInstance = getHybridObjectNativeState<THybrid>(runtime, thisValue, kind, name);

      // 2. Make sure the given arguments match, either with a static size, or with potentially optional arguments size.
      constexpr size_t optionalArgsCount = trailing_optionals_count_v<Args...>;
      constexpr size_t maxArgsCount = sizeof...(Args);
      constexpr size_t minArgsCount = maxArgsCount - optionalArgsCount;
      bool isWithinArgsRange = (count >= minArgsCount && count <= maxArgsCount);
      if (!isWithinArgsRange) [[unlikely]] {
        // invalid amount of arguments passed!
        std::string funcName = getHybridFuncFullName<THybrid>(kind, name, hybridInstance.get());
        if constexpr (minArgsCount == maxArgsCount) {
          // min and max args length is the same, so we don't have any optional parameters. fixed count
          throw jsi::JSError(runtime, "`" + funcName + "` expected " + std::to_string(maxArgsCount) + " arguments, but received " +
                                          std::to_string(count) + "!");
        } else {
          // min and max args length are different, so we have optional parameters - variable length arguments.
          throw jsi::JSError(runtime, "`" + funcName + "` expected between " + std::to_string(minArgsCount) + " and " +
                                          std::to_string(maxArgsCount) + " arguments, but received " + std::to_string(count) + "!");
        }
      }

      try {
        // 3. Actually call the method with JSI values as arguments and return a JSI value again.
        //    Internally, this method converts the JSI values to C++ values using `JSIConverter<T>`.
        return callMethod(hybridInstance.get(), method, runtime, args, count, std::index_sequence_for<Args...>{});
      } catch (const std::exception& exception) {
        // Some exception was thrown - add method name information and re-throw as `JSError`.
        std::string funcName = getHybridFuncFullName<THybrid>(kind, name, hybridInstance.get());
        std::string message = exception.what();
        throw jsi::JSError(runtime, funcName + ": " + message);
      } catch (...) {
        // Some unknown exception was thrown - add method name information and re-throw as `JSError`.
        std::string funcName = getHybridFuncFullName<THybrid>(kind, name, hybridInstance.get());
        std::string errorName = TypeInfo::getCurrentExceptionName();
        throw jsi::JSError(runtime, "`" + funcName + "` threw an unknown " + errorName + " error.");
      }
    };

    return HybridFunction(std::move(hostFunction), sizeof...(Args), name);
  }

  /**
   * Create a new `HybridFunction` that can be called from JS.
   * Unlike `createHybridFunction(...)`, this method does **not** perform any argument parsing or size checking.
   * It is a raw-, untyped JSI method, and the user is expected to manually handle arguments and return values.
   */
  template <typename Derived>
  static inline HybridFunction createRawHybridFunction(/* The name of the raw method */ const std::string& name,
                                                       /* The number of expected arguments */ size_t expectedArgumentsCount,
                                                       /* The raw JSI method on the instance */ RawInstanceMethod<Derived> method) {
    jsi::HostFunctionType hostFunction = [name, method](/* JS Runtime */ jsi::Runtime& runtime,
                                                        /* HybridObject */ const jsi::Value& thisValue,
                                                        /* JS arguments */ const jsi::Value* args,
                                                        /* argument size */ size_t count) -> jsi::Value {
      // 1. Get actual `HybridObject` instance from `thisValue` (it's stored as `NativeState`)
      std::shared_ptr<Derived> hybridInstance = getHybridObjectNativeState<Derived>(runtime, thisValue, FunctionKind::METHOD, name);

      // 2. Call the raw JSI method using raw JSI Values. Exceptions are also expected to be handled by the user.
      Derived* pointer = hybridInstance.get();
      return (pointer->*method)(runtime, thisValue, args, count);
    };

    return HybridFunction(std::move(hostFunction), expectedArgumentsCount, name);
  }

private:
  /**
   * Calls the given method on the given instance with the given `jsi::Value` arguments by converting them to the desired target types.
   * The given method's return value will be converted to a `jsi::Value` again.
   */
  template <typename Derived, typename ReturnType, typename... Args, size_t... Is>
  static inline jsi::Value callMethod(/* The instance to call the method on */ Derived* NON_NULL obj,
                                      /* The method to call */ InstanceMethod<Derived, ReturnType, Args...> method,
                                      /* JS Runtime */ jsi::Runtime& runtime,
                                      /* JS Arguments */ const jsi::Value* NON_NULL args,
                                      /* JS Arguments count */ size_t argsSize, std::index_sequence<Is...>) {
    static const jsi::Value defaultValue;

    if constexpr (std::is_void_v<ReturnType>) {
      // It's a void method.
      (obj->*method)(JSIConverter<std::decay_t<Args>>::fromJSI(runtime, Is < argsSize ? args[Is] : defaultValue)...);
      return jsi::Value::undefined();
    } else {
      // It's returning some C++ type, we need to convert that to a JSI value now.
      ReturnType result = (obj->*method)(JSIConverter<std::decay_t<Args>>::fromJSI(runtime, Is < argsSize ? args[Is] : defaultValue)...);
      return JSIConverter<ReturnType>::toJSI(runtime, std::forward<ReturnType>(result));
    }
  }

private:
  /**
   * Get the `NativeState` of the given `value`.
   */
  template <typename THybrid>
  static inline std::shared_ptr<THybrid> getHybridObjectNativeState(jsi::Runtime& runtime, const jsi::Value& value,
                                                                    [[maybe_unused]] FunctionKind funcKind,
                                                                    [[maybe_unused]] const std::string& funcName) {
    // 1. Convert jsi::Value to jsi::Object
#ifdef NITRO_DEBUG
    if (!value.isObject()) [[unlikely]] {
      throw jsi::JSError(runtime, "Cannot " + getHybridFuncDebugInfo<THybrid>(funcKind, funcName) +
                                      " - `this` is not bound! Suggestions:\n"
                                      "- Did you accidentally destructure the `HybridObject`? (`const { " +
                                      funcName +
                                      " } = ...`)\n"
                                      "- Did you call `dispose()` on the `HybridObject` before?"
                                      "- Did you accidentally call `" +
                                      funcName + "` on the prototype directly?");
    }
#endif
    jsi::Object object = value.getObject(runtime);

    // 2. Check if it even has any kind of `NativeState`
#ifdef NITRO_DEBUG
    if (!object.hasNativeState(runtime)) [[unlikely]] {
      throw jsi::JSError(runtime, "Cannot " + getHybridFuncDebugInfo<THybrid>(funcKind, funcName) +
                                      " - `this` does not have a NativeState! Suggestions:\n"
                                      "- Did you accidentally destructure the `HybridObject`? (`const { " +
                                      funcName +
                                      " } = ...`)\n"
                                      "- Did you call `dispose()` on the `HybridObject` before?"
                                      "- Did you accidentally call `" +
                                      funcName + "` on the prototype directly?");
    }
#endif

    // 3. Get `NativeState` from the jsi::Object and check if it is non-null
    std::shared_ptr<jsi::NativeState> nativeState = object.getNativeState(runtime);
#ifdef NITRO_DEBUG
    if (nativeState == nullptr) [[unlikely]] {
      throw jsi::JSError(runtime, "Cannot " + getHybridFuncDebugInfo<THybrid>(funcKind, funcName) +
                                      " - `this`'s `NativeState` is `null`, "
                                      "did you accidentally call `dispose()` on this object?");
    }
#endif

    // 4. Try casting it to our desired target type.
    std::shared_ptr<THybrid> hybridInstance = std::dynamic_pointer_cast<THybrid>(nativeState);
#ifdef NITRO_DEBUG
    if (hybridInstance == nullptr) [[unlikely]] {
      throw jsi::JSError(runtime, "Cannot " + getHybridFuncDebugInfo<THybrid>(funcKind, funcName) +
                                      " - `this` has a NativeState, but it's the wrong type!");
    }
#endif
    return hybridInstance;
  }

private:
  template <typename THybrid>
  static inline std::string getHybridFuncFullName(FunctionKind kind, const std::string& registrationName,
                                                  THybrid* NULLABLE hybridInstance = nullptr) {
    std::string typeName = hybridInstance != nullptr ? hybridInstance->getName() : TypeInfo::getFriendlyTypename<THybrid>(true);
    switch (kind) {
      case FunctionKind::METHOD:
        return typeName + "." + registrationName + "(...)";
      case FunctionKind::GETTER:
      case FunctionKind::SETTER:
        return typeName + "." + registrationName;
    }
  }
  template <typename THybrid>
  static inline std::string getHybridFuncDebugInfo(FunctionKind kind, const std::string& registrationName,
                                                   THybrid* NULLABLE hybridInstance = nullptr) {
    auto funcName = getHybridFuncFullName<THybrid>(kind, registrationName, hybridInstance);
    switch (kind) {
      case FunctionKind::METHOD:
        return "call hybrid function `" + funcName + "`";
      case FunctionKind::GETTER:
        return "get hybrid property `" + funcName + "`";
      case FunctionKind::SETTER:
        return "set hybrid property `" + funcName + "`";
    }
  }
};

} // namespace margelo::nitro
