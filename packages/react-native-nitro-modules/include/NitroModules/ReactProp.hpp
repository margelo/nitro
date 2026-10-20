//
// Created by Marc Rousavy on 20.08.26.
//

#pragma once

#include <NitroModules/BorrowingReference.hpp>
#include <NitroModules/JSICache.hpp>
#include <NitroModules/JSIConverter.hpp>
#include <NitroModules/NitroDefines.hpp>
#include <jsi/jsi.h>

#include <react/renderer/core/RawProps.h>
#include <react/renderer/core/RawValue.h>

#include <memory>
#include <optional>
#include <utility>

namespace margelo::nitro {

using namespace facebook;

/**
 * A React prop (via `RawProps`) that caches its converted value against the
 * original JS value (via `jsi::Value::strictEquals(...)`).
 *
 * Copies of an unchanged prop share the same immutable entry, which provides
 * a stable identity for comparing two Fabric Props snapshots.
 */
template <typename T>
class ReactProp final {
private:
  struct Entry final {
    std::optional<T> value;
    BorrowingReference<jsi::Value> jsiValue;

    Entry() = default;
    Entry(T&& value, BorrowingReference<jsi::Value>&& jsiValue)
        : value(std::in_place, std::move(value)), jsiValue(std::move(jsiValue)) {}
  };

  std::shared_ptr<const Entry> _entry;

public:
  // Default constructor
  ReactProp() : _entry(std::make_shared<const Entry>()) {}
  // Constructor with value
  ReactProp(T&& value, BorrowingReference<jsi::Value>&& jsiValue)
      : _entry(std::make_shared<const Entry>(std::move(value), std::move(jsiValue))) {}
  // Copy/Move/Destruct
  ReactProp(const ReactProp&) = default;
  ReactProp(ReactProp&&) = default;
  ReactProp& operator=(const ReactProp&) = default;
  ReactProp& operator=(ReactProp&&) = default;
  ~ReactProp() = default;

public:
  [[nodiscard]]
  const T& get() const {
    return _entry->value.value();
  }

  [[nodiscard]]
  bool hasSameValue(const ReactProp<T>& other) const noexcept {
    return _entry == other._entry;
  }

  /**
   * Returns whether this prop has an explicit value in the current Fabric
   * Props snapshot. Omitted props inherit this immutable state from the
   * previous snapshot.
   */
  [[nodiscard]]
  bool isProvided() const noexcept {
    return _entry->value.has_value();
  }

private:
  bool equals(jsi::Runtime& runtime, const jsi::Value& other) const {
    if (_entry->jsiValue == nullptr) {
      return false;
    }
    return jsi::Value::strictEquals(runtime, *_entry->jsiValue, other);
  }

public:
  static ReactProp<T> fromRawValue(const char* viewName, const char* propName, const react::RawProps& rawProps,
                                   const ReactProp<T>& previousProp) {
    try {
      const react::RawValue* rawValue = rawProps.at(propName);
      if (rawValue == nullptr) {
        // This RawValue pack does not contain our prop, so skip it - it's still the same from before
        return previousProp;
      }

      auto [runtime, value] = static_cast<std::pair<jsi::Runtime*, jsi::Value>>(*rawValue);

      if (previousProp.equals(*runtime, value)) {
        // jsi::Value hasn't changed - no need to convert it again!
        return previousProp;
      }
      // The new `value` differs from our previous value, so let's convert it using JSIConverter and cache it
      T converted = JSIConverter<T>::fromJSI(*runtime, value);
      JSICache& cache = JSICache::getOrCreateCache(*runtime);
      BorrowingReference<jsi::Value> cached = cache.makeShared(std::move(value));
      return ReactProp<T>(std::move(converted), std::move(cached));
    } catch (const std::exception& exception) {
      throw std::runtime_error(std::string(viewName) + "." + propName + ": " + exception.what());
    }
  }
};

} // namespace margelo::nitro
