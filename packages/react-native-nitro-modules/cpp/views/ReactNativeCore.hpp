#pragma once

// React Native 0.89+ (RN_STRICT_API) rejects direct includes of headers that have
// an umbrella.
// Do not include <cxxreact/ReactNativeVersion.h> here: this header is reachable from public headers
// (exposed in the NitroModules modulemap), and pulling `cxxreact` in breaks `use_frameworks!` builds.
// See https://github.com/margelo/nitro/issues/1520
#if __has_include(<React/RendererCore.h>)
#include <React/RendererCore.h>
#else
#include <react/renderer/core/ConcreteComponentDescriptor.h>
#include <react/renderer/core/Props.h>
#include <react/renderer/core/RawProps.h>
#include <react/renderer/core/RawPropsParser.h>
#include <react/renderer/core/RawValue.h>
#endif
