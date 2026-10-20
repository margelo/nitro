//
//  JSIConverter+SwiftString.cpp
//  NitroModules
//
//  Created by Marc Rousavy on 29.09.26.
//

#include <NitroModules/JSIConverter+SwiftString.hpp>
#include <NitroModules/NitroModules-Swift-Cxx-Umbrella.hpp>

#include <CoreFoundation/CFString.h>
#include <exception>
#include <optional>

namespace margelo::nitro {

// Configured in Package.swift according to the runtime's UTF-16 implementation.
constexpr bool hasFastJsiUtf16Constructor = NITRO_JSI_HAS_FAST_UTF16;

swift::String JSIConverter<swift::String>::fromJSI(jsi::Runtime& runtime, const jsi::Value& value) {
  jsi::String string = value.asString(runtime);
  swift::String result = swift::String::init();
  // jsi::String::getStringData(..) might call the callback multiple times if the string consists of multiple ropes.
  // UTF-16 surrogates might be spread across such ropes, and decoding a single surrogate would give us garbage; surrogates
  // _should_ come in pairs - so we have to keep track of a dangling high surrogate if it appears at the end of one rope,
  // then decode it together with the first character of the next rope which is the paired low surrogate.
  uint16_t pendingHighSurrogate = 0;
  auto callback = [&](bool ascii, const void* data, size_t count) {
    if (count == 0) {
      return;
    }
    const auto* units = static_cast<const char16_t*>(data);
    if (pendingHighSurrogate != 0) {
      // This is the dangling surrogate case from above - the last rope has a dangling high surrogate,
      // and the first character here should now be the continuation of that dangling high surrogate.
      // If that's the case, we combine those and decode it together, as a single surrogate would
      // decode to garbage. If this rope doesn't start with the low surrogate, we have to decode
      // the dangling high surrogate alone - which is malformed UTF-16 and will be repaired to U+FFFD.
      uint16_t pair[] = {pendingHighSurrogate, 0};
      size_t pairSize = 1;
      if (!ascii && CFStringIsSurrogateLowCharacter(units[0])) {
        pair[1] = units[0];
        pairSize = 2;
        ++units;
        --count;
      }
      NitroModules::StringUtils::appendUTF16(result, pair, pairSize);
      pendingHighSurrogate = 0;
    }
    if (ascii) {
      // ASCII is fast - it doesn't require any transcoding
      NitroModules::StringUtils::appendASCII(result, static_cast<const uint8_t*>(data), count);
    } else {
      if (count != 0 && CFStringIsSurrogateHighCharacter(units[count - 1])) {
        // The last character of this UTF-16 string is a high surrogate, which we cannot decode alone - we
        // have to wait for the next rope to see the paired low surrogate.
        // So we keep it in `pendingHighSurrogate`, and parse one character less in the string for now - next
        // rope call will pick it up and decode it together with the continuation of the pair.
        pendingHighSurrogate = units[--count];
      }
      if (count != 0) {
        NitroModules::StringUtils::appendUTF16(result, reinterpret_cast<const uint16_t*>(units), count);
      }
    }
  };
  string.getStringData(runtime, callback);
  if (pendingHighSurrogate != 0) [[unlikely]] {
    // If we still have a pending high surrogate after JSI gave us all string ropes, the
    // string is malformed UTF-16. We now decode the high surrogate alone, without a paired
    // low surrogate - which is garbage unicode but JS still allows it. rare, but can happen.
    // Decoding this lone surrogate repairs the malformed UTF-16 and produces U+FFFD.
    NitroModules::StringUtils::appendUTF16(result, &pendingHighSurrogate, 1);
  }
  return result;
}

jsi::String JSIConverter<swift::String>::toJSI(jsi::Runtime& runtime, const swift::String& value) {
  struct Context {
    jsi::Runtime& runtime;
    std::optional<jsi::String> result;
    std::exception_ptr error;
  } context{runtime, std::nullopt, nullptr};
  StringBufferConsumer consumer(
      &context,
      [](void* raw, const void* data, size_t count, StringEncoding encoding) noexcept {
        auto& ctx = *static_cast<Context*>(raw);
        // C++ exceptions must not unwind through Swift's borrowed-buffer scope.
        try {
          if (count == 0) {
            ctx.result.emplace(jsi::String::createFromAscii(ctx.runtime, "", 0));
          } else if (encoding == StringEncoding::ascii) {
            ctx.result.emplace(jsi::String::createFromAscii(ctx.runtime, static_cast<const char*>(data), count));
          } else if (hasFastJsiUtf16Constructor && encoding == StringEncoding::utf16) {
            ctx.result.emplace(jsi::String::createFromUtf16(ctx.runtime, static_cast<const char16_t*>(data), count));
          } else {
            ctx.result.emplace(jsi::String::createFromUtf8(ctx.runtime, static_cast<const uint8_t*>(data), count));
          }
        } catch (...) {
          ctx.error = std::current_exception();
        }
      },
      hasFastJsiUtf16Constructor);
  // Pass a C-style callback to the Swift API so that Swift can give us the data of its
  // String as a buffer (which in Swift is always a closure, like `string.withUTF8 { ... }`)
  // and we construct the `jsi::String` within here. This just looks weird because of bridging.
  NitroModules::StringUtils::withJSIStringData(value, consumer);
  if (context.error) {
    std::rethrow_exception(context.error);
  }
  return std::move(context.result.value());
}

bool JSIConverter<swift::String>::canConvert(jsi::Runtime&, const jsi::Value& value) {
  return value.isString();
}

} // namespace margelo::nitro
