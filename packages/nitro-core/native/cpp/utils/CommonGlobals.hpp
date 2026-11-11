//
//  CommonGlobals.hpp
//  react-native-nitro
//
//  Created by Marc Rousavy on 17.10.25.
//

#pragma once

#include "BorrowingReference.hpp"
#include <jsi/jsi.h>
#include <unordered_map>

namespace margelo::nitro {

using namespace facebook;

struct PlainPropertyDescriptor {
  bool configurable;
  bool enumerable;
  jsi::Value value;
  bool writable;
};
struct ComputedReadonlyPropertyDescriptor {
  bool configurable;
  bool enumerable;
  jsi::Function get;
};
struct ComputedPropertyDescriptor {
  bool configurable;
  bool enumerable;
  jsi::Function get;
  jsi::Function set;
};

enum class KnownGlobalPropertyName { DISPATCHER, JSI_CACHE, NITRO_MODULES_PROXY };

class CommonGlobals final {
public:
  CommonGlobals() = delete;
  ~CommonGlobals() = delete;

public:
  /**
   * Define a global value for the given Runtime.
   * In debug, this performs additional safety checks such as freezing the property.
   */
  static void defineGlobal(jsi::Runtime& runtime, KnownGlobalPropertyName name, jsi::Value&& value);
  /**
   * Get a string name for a known global property name.
   */
  static const char* getKnownGlobalPropertyNameString(KnownGlobalPropertyName name);
  /**
   * Get a `jsi::PropNameID` for a known global property name.
   */
  static const jsi::PropNameID& getKnownGlobalPropertyName(jsi::Runtime& runtime, KnownGlobalPropertyName name);

  /**
   * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object
   */
  class Object final {
  public:
    Object() = delete;
    ~Object() = delete;

    /**
     * Create a new `jsi::Object` with the given `prototype`.
     * Uses a native implementation if possible.
     */
    static jsi::Object create(jsi::Runtime& runtime, const jsi::Value& prototype);

    /**
     * Define a plain property on the given `object` with the given `propertyName`.
     * The `descriptor` defines the attributes of this property.
     */
    static void defineProperty(jsi::Runtime& runtime, const jsi::Object& object, const char* propertyName,
                               PlainPropertyDescriptor&& descriptor);
    /**
     * Define a plain property on the given `object` with the given `propertyName`.
     * The `descriptor` defines the attributes of this property.
     */
    static void defineProperty(jsi::Runtime& runtime, const jsi::Object& object, const char* propertyName,
                               ComputedReadonlyPropertyDescriptor&& descriptor);
    /**
     * Define a plain property on the given `object` with the given `propertyName`.
     * The `descriptor` defines the attributes of this property.
     */
    static void defineProperty(jsi::Runtime& runtime, const jsi::Object& object, const char* propertyName,
                               ComputedPropertyDescriptor&& descriptor);

    /**
     * Freezes all values of the given `object`.
     */
    static void freeze(jsi::Runtime& runtime, const jsi::Object& object);
  };

  /**
   * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise
   */
  class Promise final {
  public:
    Promise() = delete;
    ~Promise() = delete;

    static jsi::Value resolved(jsi::Runtime& runtime);
    static jsi::Value resolved(jsi::Runtime& runtime, jsi::Value&& value);
    static jsi::Value rejected(jsi::Runtime& runtime, jsi::Value&& error);

    static jsi::Value callConstructor(jsi::Runtime& runtime, jsi::HostFunctionType&& executor);
    static bool isInstanceOf(jsi::Runtime& runtime, const jsi::Object& object);
  };

  /**
   * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date
   */
  class Date final {
  public:
    Date() = delete;
    ~Date() = delete;

    static jsi::Value callConstructor(jsi::Runtime& runtime, double msSinceEpoch);
    static bool isInstanceOf(jsi::Runtime& runtime, const jsi::Object& object);
  };

  /**
   * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error
   */
  class Error final {
  public:
    Error() = delete;
    ~Error() = delete;

    static bool isInstanceOf(jsi::Runtime& runtime, const jsi::Object& object);
  };

private:
  friend Object;
  friend Promise;
  friend Date;
  friend Error;

private:
  /**
   * Get a global Function, and optionally cache it in the Runtime via the `key`.
   *
   * The returned const-ref to a `jsi::Function` should only be used within the callee's
   * synchronous scope.
   * It may no longer be active after the scope ends (function return).
   */
  static const jsi::Function& getGlobalFunction(jsi::Runtime& runtime, const char* key,
                                                std::function<jsi::Function(jsi::Runtime&)> getFunction);

private:
  using FunctionCache = std::unordered_map<std::string, BorrowingReference<jsi::Function>>;
  static std::unordered_map<jsi::Runtime*, FunctionCache> _cache;
};

} // namespace margelo::nitro
