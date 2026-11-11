//
//  HybridBase.hpp
//  NitroTest
//
//  Created by Marc Rousavy on 03.10.24.
//

#pragma once

#include "HybridBaseSpec.hpp"

namespace margelo::nitro::test {

using namespace facebook;

class HybridBase : public virtual HybridBaseSpec {
public:
  HybridBase() : HybridObject(TAG) {}

public:
  double getBaseValue() override {
    return 10;
  }
};

}; // namespace margelo::nitro::test
