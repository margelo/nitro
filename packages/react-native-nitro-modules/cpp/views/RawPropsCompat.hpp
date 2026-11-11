//
// Created by Marc Rousavy on 29.06.26.
//

#pragma once

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
void initializeDynamicProps(facebook::react::Props& props, const facebook::react::Props& sourceProps,
                            const facebook::react::RawProps& rawProps, bool (*filterObjectKeys)(const std::string&));

} // namespace margelo::nitro::RawPropsCompat
