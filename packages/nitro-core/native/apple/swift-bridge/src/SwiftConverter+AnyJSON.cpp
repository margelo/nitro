//
//  SwiftConverter+AnyJSON.cpp
//  NitroModulesSwiftBridge
//

#include <NitroModules/NitroModules-Swift-Cxx-Umbrella.hpp>

#include <NitroModules/SwiftConverter+AnyJSON.hpp>

#include <exception>
#include <utility>

namespace margelo::nitro {

AnyJSON SwiftConverter<AnyJSON>::fromSwift(const SwiftType& value) {
  struct Context {
    AnyJSON result;
    std::exception_ptr error;
  } context{};
  StringBufferConsumer consumer(&context, [](void* raw, const void* bytes, size_t count, StringEncoding) noexcept {
    auto& ctx = *static_cast<Context*>(raw);
    // Copy while Swift lends the bytes. Exceptions must not unwind through Swift.
    try {
      if (count != 0) {
        ctx.result.stringRepresentation.assign(static_cast<const char*>(bytes), count);
      }
    } catch (...) {
      ctx.error = std::current_exception();
    }
  });
  value.withUTF8(consumer);
  if (context.error) {
    std::rethrow_exception(context.error);
  }
  return std::move(context.result);
}

SwiftConverter<AnyJSON>::SwiftType SwiftConverter<AnyJSON>::toSwift(const AnyJSON& value) {
  const auto& bytes = value.stringRepresentation;
  return SwiftType::init(reinterpret_cast<const uint8_t*>(bytes.data()), static_cast<swift::Int>(bytes.size()));
}

} // namespace margelo::nitro
