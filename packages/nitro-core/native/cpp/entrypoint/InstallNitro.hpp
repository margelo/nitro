//
//  InstallNitro.hpp
//  NitroModules
//
//  Created by Marc Rousavy on 05.10.24
//

#pragma once

#include "Dispatcher.hpp"
#include <jsi/jsi.h>
#include <memory>

namespace margelo::nitro {

/**
 * Installs Nitro into the given JS `runtime`.
 * This will create `global.NitroModulesProxy`, Nitro's entry-point,
 * which can be used to create all registered HybridObjects from JS.
 *
 * Also registers the given `dispatcher` which allows using callbacks,
 * and async code (Promises).
 * The `dispatcher` needs to implement `runAsync`/`runSync` to run
 * methods on whatever Thread can safely access `runtime`.
 * In a non-thread-safe Runtime, it needs to be a single Thread (e.g.
 * React's `CallInvoker`), but in a thread-safe Runtime it might just be
 * an implementation that runs the method directly.
 */
void install(jsi::Runtime& runtime, std::shared_ptr<Dispatcher> dispatcher);

/**
 * Installs Nitro into the given JS `runtime`.
 * This will create `global.NitroModulesProxy`, Nitro's entry-point,
 * which can be used to create all registered HybridObjects from JS.
 *
 * No `Dispatcher` will be installed, meaning Nitro can only use synchronous
 * methods.
 */
void install(jsi::Runtime& runtime);

} // namespace margelo::nitro
