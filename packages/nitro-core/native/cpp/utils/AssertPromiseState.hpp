//
//  AssertPromiseState.hpp
//  NitroModules
//
//  Created by Marc Rousavy on 20.11.24.
//

#pragma once

namespace margelo::nitro {
template <typename TResult>
class Promise;

// Declared up here, next to the `Promise` forward declaration, because
// Promise.hpp (included below) uses PromiseTask and includes this header back.
// Whichever of the two is entered first must therefore have PromiseTask
// already visible — as happens when a build system compiles the module's
// public headers as a clang module and enters this one first.
enum PromiseTask { WANTS_TO_RESOLVE, WANTS_TO_REJECT };
} // namespace margelo::nitro

#include "NitroTypeInfo.hpp"
#include "Promise.hpp"
#include <exception>
#include <string>

namespace margelo::nitro {

template <typename TResult>
void assertPromiseState(Promise<TResult>& promise, PromiseTask task) {
  if (!promise.isPending()) [[unlikely]] {
    std::string taskString = task == WANTS_TO_RESOLVE ? "resolve" : "reject";
    std::string state = promise.isResolved() ? "resolved" : "rejected";
    throw std::runtime_error("Cannot " + taskString + " Promise<" + TypeInfo::getFriendlyTypename<TResult>() + "> - it is already " +
                             state + "!");
  }
}

} // namespace margelo::nitro
