//
//  NitroTypeInfo.hpp
//  Nitro
//
//  Created by Marc Rousavy on 17.07.24.
//

#pragma once

#include "NitroDefines.hpp"
#include <regex>
#include <sstream>
#include <string>
#include <type_traits>
#include <typeindex>

namespace margelo::nitro {

struct TypeInfo final {
public:
  TypeInfo() = delete;

  /**
   * Get the name of the currently thrown exception
   */
  static std::string getCurrentExceptionName();

  /**
   * Get a friendly name of the given `type_info` (if possible, demangled)
   */
  static inline std::string getFriendlyTypename(const std::type_info& type, bool removeNamespace = false) {
    std::string typeName = type.name();
    return demangleName(typeName, removeNamespace);
  }

  /**
   * Get a friendly name of the given `type_index` (if possible, demangled)
   */
  static inline std::string getFriendlyTypename(const std::type_index& typeIndex, bool removeNamespace = false) {
    std::string typeName = typeIndex.name();
    return demangleName(typeName, removeNamespace);
  }

  /**
   * Get a friendly name of the type `T` (if possible, demangled)
   */
  template <typename T>
  static inline std::string getFriendlyTypename(bool removeNamespace = false) {
    return getFriendlyTypename(typeid(T), removeNamespace);
  }

  template <typename... Types>
  static inline std::string getFriendlyTypenames(bool removeNamespace = false) {
    std::ostringstream stream;
    ((stream << TypeInfo::getFriendlyTypename<Types>(removeNamespace) << ", "), ...);
    std::string string = stream.str();
    return string.substr(0, string.length() - 2);
  }

private:
  static std::string replaceRegex(const std::string& original, const std::string& pattern, const std::string& replacement);

  static std::string demangleName(const std::string& typeName, bool removeNamespace = false);
};

} // namespace margelo::nitro
