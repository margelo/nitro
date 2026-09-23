//
//  CommonGlobals.cpp
//  react-native-nitro
//
//  Created by Marc Rousavy on 17.10.25.
//

#include "CommonGlobals.hpp"
#include "JSICache.hpp"
#include "JSIHelpers.hpp"
#include "NitroDefines.hpp"
#include "PropNameIDCache.hpp"
#include <mutex>

#if __has_include(<cxxreact/ReactNativeVersion.h>)
#include <cxxreact/ReactNativeVersion.h>
#if REACT_NATIVE_VERSION_MINOR >= 78
#define ENABLE_NATIVE_OBJECT_CREATE
#endif
#endif

namespace margelo::nitro {

using namespace facebook;

std::unordered_map<jsi::Runtime*, CommonGlobals::FunctionCache> CommonGlobals::_cache;

// Guards the OUTER `_cache` map only - `operator[]` inserts, and concurrent
// insertion/rehash from different Runtimes' Threads is UB. The inner per-Runtime
// `FunctionCache` is only ever accessed from that Runtime's own Thread, and
// `unordered_map` value references stay valid across rehash, so the reference can
// be used lock-free after acquisition.
static std::mutex g_functionCacheMutex;

// pragma MARK: Object

jsi::Object CommonGlobals::Object::create(jsi::Runtime& runtime, const jsi::Value& prototype) {
#ifdef ENABLE_NATIVE_OBJECT_CREATE
  return jsi::Object::create(runtime, prototype);
#else
  const jsi::Function& createFn = getGlobalFunction(runtime, "Object.create", [](jsi::Runtime& runtime) {
    return runtime.global().getPropertyAsObject(runtime, "Object").getPropertyAsFunction(runtime, "create");
  });
  return createFn.call(runtime, prototype).getObject(runtime);
#endif
}

void CommonGlobals::Object::defineProperty(jsi::Runtime& runtime, const jsi::Object& object, const char* propertyName,
                                           PlainPropertyDescriptor&& descriptor) {
  const jsi::Function& definePropertyFn = getGlobalFunction(runtime, "Object.defineProperty", [](jsi::Runtime& runtime) {
    return runtime.global().getPropertyAsObject(runtime, "Object").getPropertyAsFunction(runtime, "defineProperty");
  });

  jsi::String nameJs = jsi::String::createFromAscii(runtime, propertyName);

  jsi::Object descriptorJs(runtime);
  descriptorJs.setProperty(runtime, PropNameIDCache::get(runtime, "configurable"), jsi::Value(descriptor.configurable));
  descriptorJs.setProperty(runtime, PropNameIDCache::get(runtime, "enumerable"), jsi::Value(descriptor.enumerable));
  descriptorJs.setProperty(runtime, PropNameIDCache::get(runtime, "value"), std::move(descriptor.value));
  descriptorJs.setProperty(runtime, PropNameIDCache::get(runtime, "writable"), jsi::Value(descriptor.writable));

  definePropertyFn.call(runtime, object, std::move(nameJs), std::move(descriptorJs));
}

void CommonGlobals::Object::defineProperty(jsi::Runtime& runtime, const jsi::Object& object, const char* propertyName,
                                           ComputedReadonlyPropertyDescriptor&& descriptor) {
  const jsi::Function& definePropertyFn = getGlobalFunction(runtime, "Object.defineProperty", [](jsi::Runtime& runtime) {
    return runtime.global().getPropertyAsObject(runtime, "Object").getPropertyAsFunction(runtime, "defineProperty");
  });

  jsi::String nameJs = jsi::String::createFromAscii(runtime, propertyName);

  jsi::Object descriptorJs(runtime);
  descriptorJs.setProperty(runtime, PropNameIDCache::get(runtime, "configurable"), jsi::Value(descriptor.configurable));
  descriptorJs.setProperty(runtime, PropNameIDCache::get(runtime, "enumerable"), jsi::Value(descriptor.enumerable));
  descriptorJs.setProperty(runtime, PropNameIDCache::get(runtime, "get"), std::move(descriptor.get));

  definePropertyFn.call(runtime, object, std::move(nameJs), std::move(descriptorJs));
}

void CommonGlobals::Object::defineProperty(jsi::Runtime& runtime, const jsi::Object& object, const char* propertyName,
                                           ComputedPropertyDescriptor&& descriptor) {
  const jsi::Function& definePropertyFn = getGlobalFunction(runtime, "Object.defineProperty", [](jsi::Runtime& runtime) {
    return runtime.global().getPropertyAsObject(runtime, "Object").getPropertyAsFunction(runtime, "defineProperty");
  });

  jsi::String nameJs = jsi::String::createFromAscii(runtime, propertyName);

  jsi::Object descriptorJs(runtime);
  descriptorJs.setProperty(runtime, PropNameIDCache::get(runtime, "configurable"), jsi::Value(descriptor.configurable));
  descriptorJs.setProperty(runtime, PropNameIDCache::get(runtime, "enumerable"), jsi::Value(descriptor.enumerable));
  descriptorJs.setProperty(runtime, PropNameIDCache::get(runtime, "get"), std::move(descriptor.get));
  descriptorJs.setProperty(runtime, PropNameIDCache::get(runtime, "set"), std::move(descriptor.set));

  definePropertyFn.call(runtime, object, std::move(nameJs), std::move(descriptorJs));
}

void CommonGlobals::Object::freeze(jsi::Runtime& runtime, const jsi::Object& object) {
  const jsi::Function& freezeFn = getGlobalFunction(runtime, "Object.freeze", [](jsi::Runtime& runtime) {
    return runtime.global().getPropertyAsObject(runtime, "Object").getPropertyAsFunction(runtime, "freeze");
  });

  freezeFn.call(runtime, object);
}

// pragma MARK: Promise

jsi::Value CommonGlobals::Promise::resolved(jsi::Runtime& runtime) {
  const jsi::Function& resolvedFunc = getGlobalFunction(runtime, "Promise.resolve", [](jsi::Runtime& runtime) {
    return runtime.global().getPropertyAsObject(runtime, "Promise").getPropertyAsFunction(runtime, "resolve");
  });
  return resolvedFunc.call(runtime);
}
jsi::Value CommonGlobals::Promise::resolved(jsi::Runtime& runtime, jsi::Value&& value) {
  const jsi::Function& resolvedFunc = getGlobalFunction(runtime, "Promise.resolve", [](jsi::Runtime& runtime) {
    return runtime.global().getPropertyAsObject(runtime, "Promise").getPropertyAsFunction(runtime, "resolve");
  });
  return resolvedFunc.call(runtime, {std::move(value)});
}
jsi::Value CommonGlobals::Promise::rejected(jsi::Runtime& runtime, jsi::Value&& error) {
  const jsi::Function& rejectedFunc = getGlobalFunction(runtime, "Promise.reject", [](jsi::Runtime& runtime) {
    return runtime.global().getPropertyAsObject(runtime, "Promise").getPropertyAsFunction(runtime, "reject");
  });
  return rejectedFunc.call(runtime, {std::move(error)});
}

jsi::Value CommonGlobals::Promise::callConstructor(jsi::Runtime& runtime, jsi::HostFunctionType&& executor) {
  const jsi::Function& promiseCtor = getGlobalFunction(
      runtime, "Promise", [](jsi::Runtime& runtime) { return runtime.global().getPropertyAsFunction(runtime, "Promise"); });
  jsi::Function executorFunc =
      jsi::Function::createFromHostFunction(runtime, PropNameIDCache::get(runtime, "executor"), 2, std::move(executor));
  return promiseCtor.callAsConstructor(runtime, std::move(executorFunc));
}
bool CommonGlobals::Promise::isInstanceOf(jsi::Runtime& runtime, const jsi::Object& object) {
  const jsi::Function& promiseCtor = getGlobalFunction(
      runtime, "Promise", [](jsi::Runtime& runtime) { return runtime.global().getPropertyAsFunction(runtime, "Promise"); });
  return object.instanceOf(runtime, promiseCtor);
}

// pragma MARK: Date

jsi::Value CommonGlobals::Date::callConstructor(jsi::Runtime& runtime, double msSinceEpoch) {
  const jsi::Function& dateCtor =
      getGlobalFunction(runtime, "Date", [](jsi::Runtime& runtime) { return runtime.global().getPropertyAsFunction(runtime, "Date"); });
  return dateCtor.callAsConstructor(runtime, {jsi::Value(msSinceEpoch)});
}
bool CommonGlobals::Date::isInstanceOf(jsi::Runtime& runtime, const jsi::Object& object) {
  const jsi::Function& dateCtor =
      getGlobalFunction(runtime, "Date", [](jsi::Runtime& runtime) { return runtime.global().getPropertyAsFunction(runtime, "Date"); });
  return object.instanceOf(runtime, dateCtor);
}

// pragma MARK: Error

bool CommonGlobals::Error::isInstanceOf(jsi::Runtime& runtime, const jsi::Object& object) {
  const jsi::Function& errorCtor =
      getGlobalFunction(runtime, "Error", [](jsi::Runtime& runtime) { return runtime.global().getPropertyAsFunction(runtime, "Error"); });
  return object.instanceOf(runtime, errorCtor);
}

// pragma MARK: CommonGlobals

void CommonGlobals::defineGlobal(jsi::Runtime& runtime, KnownGlobalPropertyName name, jsi::Value&& value) {
  const char* nameString = getKnownGlobalPropertyNameString(name);

#ifdef NITRO_DEBUG
  // In debug, let's perform additional safety checks.
  if (runtime.global().hasProperty(runtime, nameString)) [[unlikely]] {
    throw std::runtime_error("Failed to set `global." + std::string(nameString) + "` - it already exists for Runtime \"" +
                             getRuntimeId(runtime) + "\"! Did you call `defineGlobal(\"" + std::string(nameString) +
                             "\")` twice? Did you link Nitro Modules twice?");
  }
  Object::defineProperty(runtime, runtime.global(), nameString,
                         PlainPropertyDescriptor{.configurable = false, .enumerable = true, .value = std::move(value), .writable = false});
#else
  // In release, just set the property.
  runtime.global().setProperty(runtime, nameString, std::move(value));
#endif
}

const char* CommonGlobals::getKnownGlobalPropertyNameString(KnownGlobalPropertyName name) {
  switch (name) {
    case KnownGlobalPropertyName::DISPATCHER:
      return "__nitroDispatcher";
    case KnownGlobalPropertyName::JSI_CACHE:
      return "__nitroJsiCache";
    case KnownGlobalPropertyName::NITRO_MODULES_PROXY:
      return "NitroModulesProxy";
  }
}

const jsi::PropNameID& CommonGlobals::getKnownGlobalPropertyName(jsi::Runtime& runtime, KnownGlobalPropertyName name) {
  return PropNameIDCache::get(runtime, getKnownGlobalPropertyNameString(name));
}

const jsi::Function& CommonGlobals::getGlobalFunction(jsi::Runtime& runtime, const char* key,
                                                      std::function<jsi::Function(jsi::Runtime&)> getFunction) {
  // Let's try to find the function in cache
  FunctionCache* functionCachePtr;
  {
    std::unique_lock lock(g_functionCacheMutex);
    functionCachePtr = &_cache[&runtime];
  }
  FunctionCache& functionCache = *functionCachePtr;
  std::string stringKey = key;
  auto iterator = functionCache.find(stringKey);
  if (iterator != functionCache.end()) {
    // We found it! Let's check if the reference is still valid...
    BorrowingReference<jsi::Function> function = iterator->second;
    if (function != nullptr) [[likely]] {
      // It's still alive - let's use it from cache!
      return *function;
    }
  }

  // We haven't found the function with the given key in cache - so let's get it:
  jsi::Function function = getFunction(runtime);

  // Let's throw it in cache!
  BorrowingReference<jsi::Function> sharedFunction;
  {
    JSICacheReference jsiCache = JSICache::getOrCreateCache(runtime);
    sharedFunction = jsiCache.makeShared(std::move(function));
  }
  functionCache[stringKey] = sharedFunction;

  // And now return:
  return *sharedFunction;
}

} // namespace margelo::nitro
