//
// Created by Marc Rousavy on 21.08.26.
//

#include "RawPropsCompat.hpp"

#if defined(ANDROID) && !defined(FOLLY_NO_CONFIG)
#define FOLLY_NO_CONFIG 1
#endif

#if defined(ANDROID) && !defined(RN_SERIALIZABLE_STATE)
// NitroModules does not inherit this flag from React Native's app CMake setup.
// Match the Android Props layout before accessing its dynamic props.
#define RN_SERIALIZABLE_STATE
#endif

#include <cxxreact/ReactNativeVersion.h>
#include <react/renderer/core/Props.h>
#include <react/renderer/core/RawProps.h>
#include <react/renderer/core/RawPropsParser.h>

#if defined(ANDROID) && REACT_NATIVE_VERSION_MAJOR == 0 && REACT_NATIVE_VERSION_MINOR >= 84 && REACT_NATIVE_VERSION_MINOR < 87
#include <react/featureflags/ReactNativeFeatureFlags.h>
#endif

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

void initializeDynamicProps([[maybe_unused]] facebook::react::Props& props, [[maybe_unused]] const facebook::react::Props& sourceProps,
                            [[maybe_unused]] const facebook::react::RawProps& rawProps,
                            [[maybe_unused]] bool (*filterObjectKeys)(const std::string&)) {
#ifdef ANDROID
#if REACT_NATIVE_VERSION_MAJOR > 0 || REACT_NATIVE_VERSION_MINOR >= 87
  // React Native 0.87 moved this out of the Props constructor. Nitro's custom
  // descriptor must preserve base View props while filtering out Nitro values.
  props.initializeDynamicProps(sourceProps, rawProps, filterObjectKeys);
#elif REACT_NATIVE_VERSION_MINOR >= 84
  // These versions skip constructor initialization when exclusive props updates are enabled.
  if (facebook::react::ReactNativeFeatureFlags::enableExclusivePropsUpdateAndroid()) {
    props.initializeDynamicProps(sourceProps, rawProps, filterObjectKeys);
  }
#endif
#endif
}

} // namespace margelo::nitro::RawPropsCompat
