//
//  NitroDefines.hpp
//  Nitro
//
//  Created by Marc Rousavy on 29.07.24.
//

#ifndef NitroDefines_h
#define NitroDefines_h

// Sets the version of the native Nitro core library
#define NITRO_VERSION "0.37.1"

// Sets whether to use debug or optimized production build flags
// (`_DEBUG` is what MSVC defines for debug configurations)
#if defined(DEBUG) || defined(_DEBUG)
#define NITRO_DEBUG
#endif
#ifdef NDEBUG
#undef NITRO_DEBUG
#endif
#ifdef ANDROID
#ifndef NDEBUG
#define NITRO_DEBUG
#endif
#endif

// Helper to find out if a C++ compiler attribute is available
#ifdef __has_attribute
#define _CXX_INTEROP_HAS_ATTRIBUTE(x) __has_attribute(x)
#else
#define _CXX_INTEROP_HAS_ATTRIBUTE(x) 0
#endif

// Closed/Final Enums
#if _CXX_INTEROP_HAS_ATTRIBUTE(enum_extensibility)
// Enum is marked as closed/not extensible
#define CLOSED_ENUM __attribute__((enum_extensibility(closed)))
#else
#define CLOSED_ENUM
#endif

// Nullability
#if defined(__clang__)
#define NON_NULL _Nonnull
#define NULLABLE _Nullable
#else
#define NON_NULL
#define NULLABLE
#endif

// Contiguous memory in pointers (__restrict)
#if defined(__clang__)
#define CONTIGUOUS_MEMORY __restrict__
#elif defined(_MSC_VER)
#define CONTIGUOUS_MEMORY __restrict
#else
#define CONTIGUOUS_MEMORY
#endif

// Swift Support
#if __has_include(<swift/bridging>)
// Swift's bridging header defines those things
#include <swift/bridging>
#define SWIFT_PRIVATE __attribute__((swift_private))
#else
// If we don't have Swift bridging header, those macros do nothing
#define SWIFT_NAME(_name)
#define SWIFT_PRIVATE
#define SWIFT_COMPUTED_PROPERTY
#define SWIFT_NONCOPYABLE
#endif

#endif /* NitroDefines_h */
