//
//  RuntimeData.hpp
//  NitroModules
//
//  Created by Marc Rousavy on 15.10.26.
//

#pragma once

#include <NitroModules/NitroDefines.hpp>
#include <jsi/jsi.h>
#include <memory>
#include <stdexcept>
#include <string>
#include <type_traits>

namespace margelo::nitro::detail {

using namespace facebook;

/**
 * Nitro keeps per-Runtime state in the `jsi::Runtime`'s runtime data, each kind under its own `uuid`.
 *
 * The `jsi::Runtime` owns it. JSI only guarantees that the `jsi::Runtime` releases it when the
 * `jsi::Runtime` is destroyed (or when an entry is replaced, which Nitro never does), so a returned
 * pointer or reference stays valid until then. Only use it on the `jsi::Runtime`'s Thread, and never
 * while the `jsi::Runtime` is being destroyed (e.g. from runtime data or `NativeState` destructors).
 * JSI does not specify the order in which runtime data is released, so `T`'s destructor must not
 * use other runtime data.
 */
class RuntimeData final {
public:
  RuntimeData() = delete;
  ~RuntimeData() = delete;

  /**
   * Gets the `T` stored under the given `uuid`, or `nullptr` if the `jsi::Runtime` has none.
   */
  template <typename T>
  static T* get(jsi::Runtime& runtime, const jsi::UUID& uuid) {
    std::shared_ptr<void> data = runtime.getRuntimeData(uuid);
    if (data == nullptr) {
      return nullptr;
    }
#ifdef NITRO_DEBUG
    // Another linked copy of Nitro finds the same `uuid`, but its `T` may have a different layout.
    if (*static_cast<const void* const*>(data.get()) != getNitroModulesCopyIdentifier()) [[unlikely]] {
      throw std::runtime_error("The runtime data of \"" + runtime.description() +
                               "\" was created by a different copy of Nitro! Did you link Nitro Modules twice?");
    }
#endif
    Entry<T>* entry = static_cast<Entry<T>*>(data.get());
    return &entry->value;
  }

  /**
   * Stores `value` under the given `uuid`. The `jsi::Runtime` must not have a `T` under that `uuid` yet.
   */
  template <typename T>
  static void create(jsi::Runtime& runtime, const jsi::UUID& uuid, T value) {
#ifdef NITRO_DEBUG
    if (get<T>(runtime, uuid) != nullptr) [[unlikely]] {
      throw std::runtime_error("The runtime data \"" + uuid.toString() + "\" of \"" + runtime.description() +
                               "\" already exists! Did you create it twice?");
    }
#endif
    runtime.setRuntimeData(uuid, std::make_shared<Entry<T>>([&] { return std::move(value); }));
  }

  /**
   * Gets the `T` stored under the given `uuid`, or stores and returns the `T` returned by `create()`
   * if the `jsi::Runtime` has none yet.
   */
  template <typename Create, typename T = std::invoke_result_t<Create>>
  static T& getOrCreate(jsi::Runtime& runtime, const jsi::UUID& uuid, Create&& create) {
    T* existing = get<T>(runtime, uuid);
    if (existing != nullptr) [[likely]] {
      return *existing;
    }
    auto entry = std::make_shared<Entry<T>>(std::forward<Create>(create));
    runtime.setRuntimeData(uuid, entry);
    return entry->value;
  }

private:
#ifdef NITRO_DEBUG
  /**
   * Identifies this linked copy of Nitro Modules, so `get(...)` can tell its own runtime data apart
   * from another copy's.
   */
  static const void* getNitroModulesCopyIdentifier();
#endif

  /**
   * What Nitro stores in a `jsi::Runtime`'s runtime data.
   */
  template <typename T>
  struct Entry {
    // `create()` builds the `T` in place, so `T` doesn't need to be movable.
    template <typename Create>
    explicit Entry(Create&& create) : value(create()) {}

#ifdef NITRO_DEBUG
    // The copy of Nitro Modules that created this entry. The first member, so other copies can read it.
    const void* owner = getNitroModulesCopyIdentifier();
#endif
    T value;
  };
};

} // namespace margelo::nitro::detail
