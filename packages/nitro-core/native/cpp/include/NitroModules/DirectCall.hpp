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
#include <jsi/jsi.h>
#include <memory>
#include <string>
#include <utility>

#ifdef __ANDROID__
#include <jni.h>
#endif

extern "C" {

/** Stores the UTF-8 string result of a generated Swift entry point in `target`, a `std::string*`. */
void nitro_direct_set_string(void* _Nonnull target, const uint8_t* _Nullable utf8, size_t length);

/** Stores the message of the error a generated Swift entry point reports in `target`, a `std::string*`. */
void nitro_direct_set_error(void* _Nonnull target, const char* _Nonnull message);

} // extern "C"

namespace margelo::nitro::direct {

using namespace facebook;

/** Creates the direct host function of a static method for `runtime`. `fallback` is its regular JSI implementation. */
using Factory = jsi::HostFunctionType (*)(jsi::Runtime& runtime, const jsi::HostFunctionType& fallback);

/** Throws the error a native implementation reported, the way the regular JSI implementation reports it. */
[[noreturn]] void throwError(jsi::Runtime& runtime, const char* name, const std::string& message);

/**
 * The characters of a JavaScript string, copied out of the Runtime: ASCII bytes, or UTF-16 code units if the
 * string has other characters.
 */
class StringData final {
public:
  const void* data() const {
    return _isASCII ? static_cast<const void*>(_ascii.data()) : static_cast<const void*>(_utf16.data());
  }
  size_t length() const {
    return _isASCII ? _ascii.size() : _utf16.size();
  }
  bool isASCII() const {
    return _isASCII;
  }

private:
  friend void readString(jsi::Runtime& runtime, const jsi::Value& value, StringData& result);
  void append(bool ascii, const void* data, size_t count);

private:
  std::string _ascii;
  std::u16string _utf16;
  bool _isASCII = true;
};

/** Copies the characters of `value`, which must be a string. */
void readString(jsi::Runtime& runtime, const jsi::Value& value, StringData& result);

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
