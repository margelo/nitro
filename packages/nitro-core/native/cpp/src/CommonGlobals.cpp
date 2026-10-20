//
//  CommonGlobals.cpp
//  react-native-nitro
//
//  Created by Marc Rousavy on 17.10.25.
//

#include <NitroModules/CommonGlobals.hpp>
#include <NitroModules/JSIHelpers.hpp>
#include <NitroModules/NitroDefines.hpp>
#include <NitroModules/PropNameIDCache.hpp>
#include <NitroModules/detail/RuntimeData.hpp>

namespace margelo::nitro {

using namespace facebook;

// Identifies the cached global functions in a jsi::Runtime's runtime data.
static constexpr jsi::UUID RUNTIME_DATA_UUID{0xaf898054, 0xabce, 0x43db, 0xa651, 0x9424aa9a5347};

// pragma MARK: Object

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
  const jsi::Function& promiseCtor = getGlobalFunction(
      runtime, "Promise", [](jsi::Runtime& runtime) { return runtime.global().getPropertyAsFunction(runtime, "Promise"); });
  return resolvedFunc.callWithThis(runtime, promiseCtor);
}
jsi::Value CommonGlobals::Promise::resolved(jsi::Runtime& runtime, jsi::Value&& value) {
  const jsi::Function& resolvedFunc = getGlobalFunction(runtime, "Promise.resolve", [](jsi::Runtime& runtime) {
    return runtime.global().getPropertyAsObject(runtime, "Promise").getPropertyAsFunction(runtime, "resolve");
  });
  const jsi::Function& promiseCtor = getGlobalFunction(
      runtime, "Promise", [](jsi::Runtime& runtime) { return runtime.global().getPropertyAsFunction(runtime, "Promise"); });
  return resolvedFunc.callWithThis(runtime, promiseCtor, {std::move(value)});
}
jsi::Value CommonGlobals::Promise::rejected(jsi::Runtime& runtime, jsi::Value&& error) {
  const jsi::Function& rejectedFunc = getGlobalFunction(runtime, "Promise.reject", [](jsi::Runtime& runtime) {
    return runtime.global().getPropertyAsObject(runtime, "Promise").getPropertyAsFunction(runtime, "reject");
  });
  const jsi::Function& promiseCtor = getGlobalFunction(
      runtime, "Promise", [](jsi::Runtime& runtime) { return runtime.global().getPropertyAsFunction(runtime, "Promise"); });
  return rejectedFunc.callWithThis(runtime, promiseCtor, {std::move(error)});
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

// pragma MARK: Error

bool CommonGlobals::Error::isInstanceOf(jsi::Runtime& runtime, const jsi::Object& object) {
  const jsi::Function& errorCtor =
      getGlobalFunction(runtime, "Error", [](jsi::Runtime& runtime) { return runtime.global().getPropertyAsFunction(runtime, "Error"); });
  return object.instanceOf(runtime, errorCtor);
}

// pragma MARK: JSON

jsi::String CommonGlobals::JSON::stringify(jsi::Runtime& runtime, const jsi::Value& value) {
  const jsi::Function& stringifyFunc = getGlobalFunction(runtime, "JSON.stringify", [](jsi::Runtime& runtime) {
    return runtime.global().getPropertyAsObject(runtime, "JSON").getPropertyAsFunction(runtime, "stringify");
  });
  return stringifyFunc.call(runtime, value).asString(runtime);
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
  FunctionCache& functionCache = detail::RuntimeData::getOrCreate(runtime, RUNTIME_DATA_UUID, [] { return FunctionCache(); });
  std::string stringKey = key;
  auto iterator = functionCache.find(stringKey);
  if (iterator != functionCache.end()) [[likely]] {
    // We found it! Let's use it from cache!
    return iterator->second;
  }

  // We haven't found the function with the given key in cache - so let's get it:
  jsi::Function function = getFunction(runtime);

  // Let's throw it in cache!
  auto inserted = functionCache.try_emplace(std::move(stringKey), std::move(function));

  // And now return:
  return inserted.first->second;
}

} // namespace margelo::nitro
