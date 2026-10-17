//
// Created by Marc Rousavy on 21.08.26.
//

#include "RawPropsCompat.hpp"

#if defined(ANDROID) && !defined(FOLLY_NO_CONFIG)
#define FOLLY_NO_CONFIG 1
#endif

#include <cxxreact/ReactNativeVersion.h>
#include <react/renderer/core/RawProps.h>
#include <react/renderer/core/RawPropsParser.h>

namespace margelo::nitro::RawPropsCompat {

const facebook::react::RawValue* at(const facebook::react::RawProps& props, const char* name) {
#if REACT_NATIVE_VERSION_MAJOR > 0 || REACT_NATIVE_VERSION_MINOR > 86
  // React Native 0.87 introduced the canonical single-argument overload.
  return props.at(name);
#else
  return props.at(name, nullptr, nullptr);
#endif
}

facebook::react::RawPropsParser makePropsParser() {
#if REACT_NATIVE_VERSION_MAJOR > 0 || REACT_NATIVE_VERSION_MINOR >= 85
  // Since React Native 0.85, the RawPropsParser has JSI parsing always enabled by default.
  return facebook::react::RawPropsParser();
#else
  return facebook::react::RawPropsParser(true);
#endif
}

} // namespace margelo::nitro::RawPropsCompat
