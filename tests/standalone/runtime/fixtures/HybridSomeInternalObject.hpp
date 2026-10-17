//
//  HybridSomeInternalObject.hpp
//  NitroTest
//
//  Created by Marc Rousavy on 14.08.25.
//

#pragma once

#include <NitroTestExternal/HybridSomeExternalObjectSpec.hpp>

namespace margelo::nitro::test {

using namespace facebook;

class HybridSomeInternalObject : public virtual margelo::nitro::test::external::HybridSomeExternalObjectSpec {
public:
  HybridSomeInternalObject() : HybridObject(TAG) {}

public:
  std::string getValue() override {
    return "This is overridden!";
  }

  external::OptionalPrimitivesHolder createOptionalPrimitivesHolder(std::optional<double> optionalNumber,
                                                                    std::optional<bool> optionalBoolean,
                                                                    std::optional<uint64_t> optionalUInt64,
                                                                    std::optional<int64_t> optionalInt64) override {
    return external::OptionalPrimitivesHolder{optionalNumber, optionalBoolean, optionalUInt64, optionalInt64};
  }
};

}; // namespace margelo::nitro::test
