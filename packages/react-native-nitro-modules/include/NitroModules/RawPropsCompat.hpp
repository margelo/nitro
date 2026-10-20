//
// Created by Marc Rousavy on 29.06.26.
//

#pragma once

#include <string>

namespace facebook::react {
class Props;
class RawProps;
} // namespace facebook::react

namespace margelo::nitro::RawPropsCompat {

void initializeDynamicProps(facebook::react::Props& props, const facebook::react::Props& sourceProps,
                            const facebook::react::RawProps& rawProps, bool (*filterObjectKeys)(const std::string&));

} // namespace margelo::nitro::RawPropsCompat
