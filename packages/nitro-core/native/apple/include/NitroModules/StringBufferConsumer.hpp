#pragma once

#include <cstddef>
#include <cstdint>

namespace margelo::nitro {

enum class StringEncoding : uint8_t { ascii, utf8, utf16 };

// A synchronous, non-owning callback. The caller keeps the context alive and
// consumes the borrowed buffer before call() returns. No allocation is needed.
class StringBufferConsumer final {
public:
  using Callback = void (*)(void*, const void*, size_t, StringEncoding) noexcept;
  StringBufferConsumer(void* context, Callback callback, bool canCreateUTF16Directly = false)
      : _context(context), _callback(callback), _canCreateUTF16Directly(canCreateUTF16Directly) {}

  void call(const void* data, size_t count, StringEncoding encoding) const noexcept {
    _callback(_context, data, count, encoding);
  }

  // Whether the consumer can create strings directly from UTF-16 without an
  // expensive fallback.
  bool canCreateUTF16Directly() const noexcept {
    return _canCreateUTF16Directly;
  }

private:
  void* _context;
  Callback _callback;
  bool _canCreateUTF16Directly;
};

} // namespace margelo::nitro
