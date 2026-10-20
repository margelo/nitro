//
//  HybridSharedSpecializationsCpp.hpp
//  NitroTestExternal
//

#pragma once

#include <NitroTestExternal/HybridSharedSpecializationsCppSpec.hpp>
#include <string>

namespace margelo::nitro::test::external {

using namespace facebook;

/**
 * Implements the shared Promise and Callback specializations in C++, so the
 * second module exercises them without a Swift or Kotlin bridge.
 */
class HybridSharedSpecializationsCpp : public HybridSharedSpecializationsCppSpec {
public:
  HybridSharedSpecializationsCpp() = default;

public:
  Callback<void(double /* value */)> getNumberCallback() override;
  void setNumberCallback(const Callback<void(double /* value */)>& numberCallback) override;

public:
  Promise<void> resolveVoid() override;
  Promise<double> resolveNumber(double value) override;
  Promise<std::string> resolveString(const std::string& value) override;
  Promise<void> awaitVoid(const Promise<void>& promise) override;
  Promise<double> awaitNumber(const Promise<double>& promise) override;
  void callVoid(const Callback<void()>& callback) override;
  void callWithNumber(double value, const Callback<void(double /* value */)>& callback) override;
  void callWithString(const std::string& value, const Callback<void(const std::string& /* value */)>& callback) override;
  Promise<double> mapNumber(double value, const Callback<double(double /* value */)>& callback) override;
  Callback<void(double /* value */)> wrapNumberCallback(const Callback<void(double /* value */)>& callback) override;
  Promise<void> callVoidPromiseCallback(const Callback<Promise<void>()>& callback) override;
  Promise<double> callNumberPromiseCallback(const Callback<Promise<double>()>& callback) override;
  void callInline(const InlineCallback<void()>& callback) override;
  double callInlineWithNumber(double value, const InlineCallback<double(double /* value */)>& callback) override;

private:
  Callback<void(double)> _numberCallback = Callback<void(double)>::make([](double) {});
};

} // namespace margelo::nitro::test::external
