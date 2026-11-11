//
// Created by Marc Rousavy on 04.06.25.
//

#pragma once

// Forward declare a few of the common types that might have cyclic includes.
namespace margelo::nitro {
class JSICache;

template <typename T, typename Enable>
struct JSIConverter;
} // namespace margelo::nitro

#include "JSIConverter.hpp"

#include "CommonGlobals.hpp"
#include "PropNameIDCache.hpp"
#include <chrono>
#include <jsi/jsi.h>
#include <memory>
#include <type_traits>

namespace margelo::nitro {

using namespace facebook;
using namespace std;

// Date <> chrono::system_clock::time_point
template <>
struct JSIConverter<std::chrono::system_clock::time_point> final {
  static inline chrono::system_clock::time_point fromJSI(jsi::Runtime& runtime, const jsi::Value& arg) {
#ifdef NITRO_DEBUG
    if (!arg.isObject()) [[unlikely]] {
      throw std::invalid_argument("Value \"" + arg.toString(runtime).utf8(runtime) +
                                  "\" is not a Date - in fact, "
                                  "it's not even an object!");
    }
#endif

    jsi::Object object = arg.asObject(runtime);
#ifdef NITRO_DEBUG
    if (!object.hasProperty(runtime, PropNameIDCache::get(runtime, "getTime"))) {
      throw std::invalid_argument("Object \"" + arg.toString(runtime).utf8(runtime) +
                                  "\" does not have a .getTime() function! "
                                  "It's not a valid Date object.");
    }
#endif

    jsi::Function getTimeFunc =
        object.getProperty(runtime, PropNameIDCache::get(runtime, "getTime")).getObject(runtime).getFunction(runtime);
    double msSinceEpoch = getTimeFunc.callWithThis(runtime, object).getNumber();

    // ms -> std::chrono::system_clock::time_point
    auto durationMs = chrono::duration<double, std::milli>(msSinceEpoch);
    auto duration = chrono::duration_cast<chrono::system_clock::duration>(durationMs);
    auto timePoint = chrono::system_clock::time_point(duration);

    return timePoint;
  }

  static inline jsi::Value toJSI(jsi::Runtime& runtime, const chrono::system_clock::time_point& date) {
    // 1. Get milliseconds since epoch as a double
    auto ms = chrono::duration_cast<chrono::milliseconds>(date.time_since_epoch()).count();
    auto msSinceEpoch = static_cast<double>(ms);

    // 2. Call `new Date(...)` with the milliseconds since epoch
    jsi::Value jsDate = CommonGlobals::Date::callConstructor(runtime, msSinceEpoch);
    return jsDate;
  }

  static inline bool canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
    if (value.isObject()) {
      jsi::Object object = value.getObject(runtime);
      return CommonGlobals::Date::isInstanceOf(runtime, object);
    }
    return false;
  }
};

} // namespace margelo::nitro
