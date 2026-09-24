//
// Created by Marc Rousavy on 29.06.26.
//

#pragma once

#include <functional>
#include <string>

namespace facebook::react {
class Props;
class RawProps;
class RawPropsParser;
class RawValue;
} // namespace facebook::react

namespace margelo::nitro::RawPropsCompat {

const facebook::react::RawValue* at(const facebook::react::RawProps& props, const char* name);
facebook::react::RawPropsParser makePropsParser();

/**
 * Fills `Props::rawProps` - the `folly::dynamic` that Android serializes to Java and applies
 * via `ViewManager.updateProperties` - for every prop that `filterObjectKeys` does not filter out.
 *
 * Nitro Views override `cloneProps`, so on React Native versions where `Props::Props` no longer
 * does this, nothing else would - and base `ViewProps` (`backgroundColor`, `opacity`, `testID`, ...)
 * would never reach the view on Android. On versions where the constructor still does it, this is a no-op.
 */
void initializeDynamicProps(facebook::react::Props& props, const facebook::react::Props& sourceProps,
                            const facebook::react::RawProps& rawProps, const std::function<bool(const std::string&)>& filterObjectKeys);

} // namespace margelo::nitro::RawPropsCompat
