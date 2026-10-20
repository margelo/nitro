//
// Created by Marc Rousavy on 21.08.26.
//

#include <NitroModules/RawPropsCompat.hpp>

#if defined(ANDROID) && !defined(FOLLY_NO_CONFIG)
#define FOLLY_NO_CONFIG 1
#endif

#if defined(ANDROID) && !defined(RN_SERIALIZABLE_STATE)
// NitroModules does not inherit this flag from React Native's app CMake setup.
// Match the Android Props layout before accessing its dynamic props.
#define RN_SERIALIZABLE_STATE
#endif

#include <react/renderer/core/Props.h>
#include <react/renderer/core/RawProps.h>

namespace margelo::nitro::RawPropsCompat {

void initializeDynamicProps([[maybe_unused]] facebook::react::Props& props, [[maybe_unused]] const facebook::react::Props& sourceProps,
                            [[maybe_unused]] const facebook::react::RawProps& rawProps,
                            [[maybe_unused]] bool (*filterObjectKeys)(const std::string&)) {
#ifdef ANDROID
  // Nitro's custom descriptor must preserve base View props while filtering out Nitro values.
  props.initializeDynamicProps(sourceProps, rawProps, filterObjectKeys);
#endif
}

} // namespace margelo::nitro::RawPropsCompat
