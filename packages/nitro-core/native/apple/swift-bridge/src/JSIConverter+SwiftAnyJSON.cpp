//
//  JSIConverter+SwiftAnyJSON.cpp
//  NitroModules
//
//  Created by Marc Rousavy on 29.09.26.
//

#include <NitroModules/CommonGlobals.hpp>
#include <NitroModules/JSIConverter+SwiftAnyJSON.hpp>
#include <NitroModules/NitroModules-Swift-Cxx-Umbrella.hpp>

#include <cassert>
#include <exception>
#include <optional>

namespace margelo::nitro {

NitroModules::AnyJSON JSIConverter<NitroModules::AnyJSON>::fromJSI(jsi::Runtime& runtime, const jsi::Value& value) {
  jsi::String string = CommonGlobals::JSON::stringify(runtime, value);
  NitroModules::UTF8DataHolder data = NitroModules::UTF8DataHolder::init();
  auto callback = [&](bool ascii, const void* bytes, size_t count) {
    if (count == 0) {
      return;
    }
    assert(bytes != nullptr);
    // JSI owns these borrowed chunks. Only touch the Swift buffer inside this callback.
    if (ascii) {
      data.appendASCII(static_cast<const uint8_t*>(bytes), count);
    } else {
      data.appendUTF16(static_cast<const uint16_t*>(bytes), count);
    }
  };
  string.getStringData(runtime, callback);
  data.flushPendingHighSurrogate();
  return NitroModules::AnyJSON::init(data);
}

jsi::Value JSIConverter<NitroModules::AnyJSON>::toJSI(jsi::Runtime& runtime, const NitroModules::AnyJSON& value) {
  struct Context {
    jsi::Runtime& runtime;
    std::optional<jsi::Value> result;
    std::exception_ptr error;
  } context{runtime, std::nullopt, nullptr};
  StringBufferConsumer consumer(&context, [](void* raw, const void* bytes, size_t count, StringEncoding) noexcept {
    auto& ctx = *static_cast<Context*>(raw);
    // Finish parsing while Swift lends the bytes. Exceptions must not unwind through Swift.
    try {
      ctx.result.emplace(jsi::Value::createFromJsonUtf8(ctx.runtime, static_cast<const uint8_t*>(bytes), count));
    } catch (...) {
      ctx.error = std::current_exception();
    }
  });
  value.withUTF8(consumer);
  if (context.error) {
    std::rethrow_exception(context.error);
  }
  return std::move(context.result.value());
}

bool JSIConverter<NitroModules::AnyJSON>::canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
  return value.isNull() || value.isBool() || value.isNumber() || value.isString() ||
         (value.isObject() && !value.getObject(runtime).isFunction(runtime));
}

} // namespace margelo::nitro
