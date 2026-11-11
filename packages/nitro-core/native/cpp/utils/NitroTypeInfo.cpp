//
//  NitroTypeInfo.cpp
//  Nitro
//
//  Created by Marc Rousavy on 23.02.25.
//

#include "NitroTypeInfo.hpp"

#if __has_include(<cxxabi.h>)
#include <cxxabi.h>
#endif

namespace margelo::nitro {

std::string TypeInfo::getCurrentExceptionName() {
#if __has_include(<cxxabi.h>)
  std::string name = __cxxabiv1::__cxa_current_exception_type()->name();
  return demangleName(name);
#else
  return "<unknown>";
#endif
}

std::string TypeInfo::replaceRegex(const std::string& original, const std::string& pattern, const std::string& replacement) {
  static std::unordered_map<std::string, std::regex> cache;

  auto found = cache.find(pattern);
  if (found != cache.end()) {
    return std::regex_replace(original, found->second, replacement);
  }

  std::regex regex(pattern);
  cache.emplace(pattern, regex);
  return std::regex_replace(original, regex, replacement);
}

std::string TypeInfo::demangleName(const std::string& typeName, [[maybe_unused]] bool removeNamespace) {
#ifdef NITRO_DEBUG
  // In debug, we demangle the name using Cxx ABI and prettify it.
  std::string name = typeName;
#if __has_include(<cxxabi.h>)
  int status = 0;
  char* demangled_name = abi::__cxa_demangle(name.c_str(), nullptr, nullptr, &status);
  if (demangled_name != nullptr) {
    name = demangled_name;
    std::free(demangled_name);
  }
#endif

#ifdef ANDROID
  // std::__ndk1 -> std::__1
  name = replaceRegex(name, R"(std::__ndk1)", "std::__1");
#endif

  // Make a few edge-cases nicer.
  name = replaceRegex(name, R"(std::__1::basic_string<char, std::__1::char_traits<char>, std::__1::allocator<char> ?>)", "std::string");
  name = replaceRegex(name, R"(std::__1::vector<([^>]+), std::__1::allocator<\1>>)", "std::vector<$1>");
  name = replaceRegex(name, R"(std::__1::map<([^,]+), ([^>]+), std::__1::less<\1>, std::__1::allocator<std::__1::pair<const \1, \2>>>)",
                      "std::map<$1, $2>");
  name = replaceRegex(name, R"(std::__1::shared_ptr<([^>]+)>)", "std::shared_ptr<$1>");
  name = replaceRegex(name, R"(std::__1::unique_ptr<([^>]+), std::__1::default_delete<\1>>)", "std::unique_ptr<$1>");
  name = replaceRegex(
      name,
      R"(std::__1::unordered_map<([^,]+), ([^>]+), std::__1::hash<\1>, std::__1::equal_to<\1>, std::__1::allocator<std::__1::pair<const \1, \2>>>)",
      "std::unordered_map<$1, $2>");

  if (removeNamespace) {
    // replace `margelo::nitro::HybridObject` -> `HybridObject`
    name = replaceRegex(name, R"(\b(?!std::)[a-zA-Z_]\w*::)", "");
  }

  return name;
#else
  // In release, we don't do any of that. Just return the ugly name.
  return typeName;
#endif
}

} // namespace margelo::nitro
