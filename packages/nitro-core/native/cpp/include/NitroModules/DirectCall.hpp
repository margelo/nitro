//
//  DirectCall.hpp
//  NitroModules
//
//  Direct JSI host functions for static methods.
//
//  Nitrogen generates a `jsi::HostFunction` for each static method whose arguments and result are numbers,
//  booleans, strings, or structs of numbers and booleans. It reads the arguments straight from JSI's argument
//  array and calls the implementation with plain values: a `@_cdecl` Swift function on iOS, or a static Kotlin
//  method through JNI with cached method IDs on Android. This skips the generic `JSIConverter`s, the Swift/C++
//  interop wrappers and fbjni's reference wrappers. Any other input calls the method's regular JSI implementation,
//  so behavior and errors stay the same.
//

#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <jsi/jsi.h>
#include <memory>
#include <new>
#include <string>
#include <utility>

#ifdef __ANDROID__
#include <jni.h>
#endif

extern "C" {

/** Stores the UTF-8 string result of a generated Swift entry point in `target`, a `StringResult*`. */
void nitro_direct_set_string(void* _Nonnull target, const uint8_t* _Nullable utf8, size_t length);

/** Stores the message of the error a generated Swift entry point reports in `target`, a `std::string*`. */
void nitro_direct_set_error(void* _Nonnull target, const char* _Nonnull message);

} // extern "C"

namespace margelo::nitro::direct {

using namespace facebook;

/** Creates the direct host function of a static method for `runtime`. `fallback` is its regular JSI implementation. */
using Factory = jsi::HostFunctionType (*)(jsi::Runtime& runtime, const jsi::HostFunctionType& fallback);

/**
 * Gives direct calls JSI's protected pointer helpers. It is never instantiated.
 */
class PointerAccess final : public jsi::Runtime {
public:
  template <typename T>
  static T wrap(const jsi::Value& value) {
    return make<T>(const_cast<PointerValue*>(getPointerValue(value)));
  }
};

/**
 * A `jsi::String` or `jsi::Object` view of an argument that reuses the argument's JSI pointer instead of
 * cloning it, as `getString()` and `getObject()` do. The argument owns the pointer and outlives the call,
 * so the view never releases it. Only create it from an argument of the matching kind.
 */
template <typename T>
class Borrowed final {
public:
  explicit Borrowed(const jsi::Value& value) {
    new (_storage) T(PointerAccess::wrap<T>(value));
  }
  // Skips `T`'s destructor on purpose: releasing the pointer is the argument's job.
  ~Borrowed() = default;
  Borrowed(const Borrowed&) = delete;
  Borrowed& operator=(const Borrowed&) = delete;

  const T& get() const {
    return *std::launder(reinterpret_cast<const T*>(_storage));
  }

private:
  alignas(T) unsigned char _storage[sizeof(T)];
};

/** Throws the error a native implementation reported, the way the regular JSI implementation reports it. */
[[noreturn]] void throwError(jsi::Runtime& runtime, const char* name, const std::string& message);

class StringData;

/** Copies the characters of `value`, which must be a string. */
inline void readString(jsi::Runtime& runtime, const jsi::Value& value, StringData& result);

/**
 * The characters of a JavaScript string, copied out of the Runtime: ASCII bytes, or UTF-16 code units if the
 * string has other characters. Short ASCII strings stay inline.
 */
class StringData final {
public:
  const void* data() const {
    if (!_isASCII) {
      return _utf16.data();
    }
    return _onHeap ? static_cast<const void*>(_ascii.data()) : static_cast<const void*>(_inline);
  }
  size_t length() const {
    return _isASCII ? _length : _utf16.size();
  }
  bool isASCII() const {
    return _isASCII;
  }

private:
  friend void readString(jsi::Runtime& runtime, const jsi::Value& value, StringData& result);
  void append(bool ascii, const void* data, size_t count) {
    if (ascii && _isASCII && !_onHeap && count <= kInlineCapacity - _length) [[likely]] {
      // Short strings are common, and a loop beats a call to `memcpy` for them.
      const char* source = static_cast<const char*>(data);
      char* target = _inline + _length;
      for (size_t i = 0; i < count; i++) {
        target[i] = source[i];
      }
      _length += count;
      return;
    }
    appendSlow(ascii, data, count);
  }
  void appendSlow(bool ascii, const void* data, size_t count);

private:
  static constexpr size_t kInlineCapacity = 64;
  char _inline[kInlineCapacity];
  size_t _length = 0;
  bool _isASCII = true;
  bool _onHeap = false;
  std::string _ascii;
  std::u16string _utf16;
};

inline void readString(jsi::Runtime& runtime, const jsi::Value& value, StringData& result) {
  Borrowed<jsi::String> string(value);
  auto append = [&result](bool ascii, const void* data, size_t count) { result.append(ascii, data, count); };
  string.get().getStringData(runtime, append);
}

/**
 * The string result of a Swift entry point, in UTF-8. Short results stay inline, and the result remembers
 * whether it is ASCII, so creating the JavaScript string needs no second pass.
 */
class StringResult final {
public:
  StringResult() = default;
  // `_data` can point into `_inline`, so a copy would point into the original.
  StringResult(const StringResult&) = delete;
  StringResult& operator=(const StringResult&) = delete;

  /** Stores `length` bytes of UTF-8. Called by `nitro_direct_set_string()`. */
  void set(const uint8_t* utf8, size_t length) {
    char* target = _inline;
    if (length > kInlineCapacity) [[unlikely]] {
      _heap.resize(length);
      target = _heap.data();
    }
    uint8_t any = 0;
    for (size_t i = 0; i < length; i++) {
      target[i] = static_cast<char>(utf8[i]);
      any |= utf8[i];
    }
    _data = target;
    _length = length;
    _isASCII = (any & 0x80) == 0;
  }

  /** Creates the JavaScript string. */
  jsi::Value toJS(jsi::Runtime& runtime) const {
    if (_isASCII) [[likely]] {
      return jsi::String::createFromAscii(runtime, _data, _length);
    }
    return jsi::String::createFromUtf8(runtime, reinterpret_cast<const uint8_t*>(_data), _length);
  }

private:
  static constexpr size_t kInlineCapacity = 64;
  char _inline[kInlineCapacity];
  const char* _data = _inline;
  size_t _length = 0;
  bool _isASCII = true;
  std::string _heap;
};

/** Creates the property names a direct host function reads and writes on struct objects, once per Runtime. */
template <size_t N>
std::shared_ptr<const std::array<jsi::PropNameID, N>> createNames(jsi::Runtime& runtime, const char* const (&names)[N]) {
  return [&]<size_t... I>(std::index_sequence<I...>) {
    return std::make_shared<const std::array<jsi::PropNameID, N>>(
        std::array<jsi::PropNameID, N>{jsi::PropNameID::forAscii(runtime, names[I])...});
  }(std::make_index_sequence<N>{});
}

#ifdef __ANDROID__
// The scratch memory Kotlin bridges exchange strings and struct results through.
inline constexpr size_t kScratchSize = 256;

/**
 * The JNI state of one Runtime, shared by its direct host functions.
 * Every Runtime runs on one thread, so `env` is that thread's `JNIEnv`.
 */
struct JavaContext final {
  JNIEnv* env = nullptr;
  // A global reference to a direct `ByteBuffer` in native byte order over `scratchData`.
  // Kotlin bridges write struct results into it, so C++ reads them without another JNI call.
  jobject scratchBuffer = nullptr;
  // A global reference to the `byte[]` Kotlin bridges read and write strings through.
  jbyteArray scratchBytes = nullptr;
  // The memory of `scratchBuffer`. C++ writes a bridge's input strings here and reads its results.
  uint8_t* scratchData = nullptr;
  // The index of `scratchData` in `scratchBytes` when `scratchShared` is set, otherwise 0.
  jint scratchBase = 0;
  // Whether `scratchBytes` shares `scratchData`'s memory, so strings need no JNI copies.
  bool scratchShared = false;
  // The scratch memory if it is not shared with Java.
  alignas(8) uint8_t scratch[kScratchSize] = {};

  JavaContext() = default;
  JavaContext(const JavaContext&) = delete;
  JavaContext& operator=(const JavaContext&) = delete;
  ~JavaContext();

  /** Returns the context of `runtime`, creating it on first use. Call it on the Runtime's thread. */
  static std::shared_ptr<JavaContext> get(jsi::Runtime& runtime);
};

/**
 * Appends the characters of string `value` to the scratch memory at `offset` as ASCII, and returns its length in
 * `length`. Returns false for other characters and strings that do not fit, which take the regular JSI path.
 */
bool appendASCII(jsi::Runtime& runtime, const jsi::Value& value, JavaContext& context, size_t& offset, jint& length);

void copyScratchToJavaBytesSlow(JavaContext& context, size_t length);
void copyJavaBytesToScratchSlow(JavaContext& context, jint length);

/** Makes the first `length` scratch bytes visible to a Kotlin bridge. This is free when the memory is shared. */
inline void copyScratchToJavaBytes(JavaContext& context, size_t length) {
  if (!context.scratchShared) [[unlikely]] {
    copyScratchToJavaBytesSlow(context, length);
  }
}

/** Creates a JavaScript string from the `length` ASCII bytes a Kotlin bridge wrote to the scratch `byte[]`. */
inline jsi::Value stringFromJavaBytes(jsi::Runtime& runtime, JavaContext& context, jint length) {
  if (!context.scratchShared) [[unlikely]] {
    copyJavaBytesToScratchSlow(context, length);
  }
  return jsi::String::createFromAscii(runtime, reinterpret_cast<const char*>(context.scratchData), static_cast<size_t>(length));
}

/** Returns the string a Kotlin bridge kept in `DirectCall` because it was not ASCII or did not fit. */
jsi::Value takePendingJavaString(jsi::Runtime& runtime, JavaContext& context);

/** Throws the pending Java exception as a JavaScript error, prefixed with the function's name, and clears it. */
[[noreturn]] void throwJavaException(jsi::Runtime& runtime, JavaContext& context, const char* name);
#endif

} // namespace margelo::nitro::direct
