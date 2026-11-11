#pragma once
#ifdef __OBJC__
#import <UIKit/UIKit.h>
#endif

// Expose the Apple bridge types used by the unmodified Nitro Swift sources.
#include "AnyMapUtils.hpp"
#include "ArrayBufferHolder.hpp"
#include "DateToChronoDate.hpp"
#include "PromiseHolder.hpp"
#include "Result.hpp"
#include "RuntimeError.hpp"
