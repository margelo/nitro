#pragma once

#include <NitroTest/HybridBenchmarkObjectCppSpec.hpp>

namespace margelo::nitro::test {

class HybridBenchmarkObjectCpp : public HybridBenchmarkObjectCppSpec {
public:
  HybridBenchmarkObjectCpp() = default;

  double getNumberValue() override;
  void setNumberValue(double numberValue) override;
  std::shared_ptr<HybridBenchmarkObjectCppSpec> getThisObject() override;
  void simpleFunc() override;
  double addNumbers(double a, double b) override;
  std::string addStrings(const std::string& a, const std::string& b) override;
  std::vector<double> bounceNumbers(const std::vector<double>& array) override;
  Car bounceCar(const Car& car) override;
  std::unordered_map<std::string, double> bounceSimpleMap(const std::unordered_map<std::string, double>& map) override;
  std::string tryOptionalParams(double /* num */, bool /* boo */, const std::optional<std::string>& str) override;
  std::variant<double, std::string>
  passVariant(const std::variant<bool, std::vector<double>, std::vector<std::string>, double, std::string>& either) override;
  std::shared_ptr<HybridBenchmarkObjectCppSpec> newBenchmarkObject() override;
  ArrayBuffer bounceArrayBuffer(const ArrayBuffer& buffer) override;
  ArrayBuffer copyBuffer(const ArrayBuffer& buffer) override;
  double callbackSync(const Callback<double()>& callback) override;
  Promise<double> promiseReturnsInstantly() override;
  Promise<double> createPendingPromise() override;
  void resolvePendingPromiseOnWorker() override;

private:
  double _number = 0.0;
  std::optional<Promise<double>> _pendingPromise;
};

} // namespace margelo::nitro::test
