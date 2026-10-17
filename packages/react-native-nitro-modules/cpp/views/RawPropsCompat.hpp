//
// Created by Marc Rousavy on 29.06.26.
//

#pragma once

namespace facebook::react {
class RawProps;
class RawPropsParser;
class RawValue;
} // namespace facebook::react

namespace margelo::nitro::RawPropsCompat {

const facebook::react::RawValue* at(const facebook::react::RawProps& props, const char* name);
facebook::react::RawPropsParser makePropsParser();

} // namespace margelo::nitro::RawPropsCompat
