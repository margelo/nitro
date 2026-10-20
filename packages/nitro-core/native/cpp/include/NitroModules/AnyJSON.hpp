//
//  AnyJSON.hpp
//  NitroModules
//
//  Created by Marc Rousavy on 02.10.26.
//

#pragma once

#include <string>

namespace margelo::nitro {

  /**
   * Any kind of JSON-representable value.
   *
   * A JSON value is bridged via its string representation:
   * - `JSON.parse(..)` will be used to convert this to JS.
   * - `JSON.stringify(..)` will be used to convert this from JS.
   */
  struct AnyJSON {
    std::string stringRepresentation;

    /**
     * Compares the JSON text byte by byte. Values that only differ in
     * key order or whitespace are not equal.
     */
    friend bool operator==(const AnyJSON& lhs, const AnyJSON& rhs) = default;
  };

} // namespace margelo::nitro
