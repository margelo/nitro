//
//  HybridChild.hpp
//  NitroTest
//
//  Created by Marc Rousavy on 03.10.24.
//

#pragma once

#include "HybridBase.hpp"
#include "HybridChildSpec.hpp"

namespace margelo::nitro::test {

using namespace facebook;

class HybridChild : public virtual HybridChildSpec, public virtual HybridBase {
public:
  explicit HybridChild() : HybridObject(HybridChildSpec::TAG) {}

public:
  double getBaseValue() override {
    return 20;
  }
  double getChildValue() override {
    return 30;
  }

  std::variant<std::string, Car> bounceVariant(const std::variant<std::string, Car>& variant) override {
    return variant;
  }

  std::string toString() override {
    return "HybridChild custom toString() :)";
  }
};

}; // namespace margelo::nitro::test
