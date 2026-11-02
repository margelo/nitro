#pragma once

// React Native 0.89+ (RN_STRICT_API) rejects direct includes of headers that have
// an umbrella, and makes <cxxreact/ReactNativeVersion.h> private.
#if __has_include(<React/Utils.h>)
#include <React/Utils.h>
#else
#include <cxxreact/ReactNativeVersion.h>
#endif

#if __has_include(<React/RendererCore.h>)
#include <React/RendererCore.h>
#else
#include <react/renderer/core/ConcreteComponentDescriptor.h>
#include <react/renderer/core/Props.h>
#include <react/renderer/core/RawProps.h>
#include <react/renderer/core/RawPropsParser.h>
#include <react/renderer/core/RawValue.h>
#endif
