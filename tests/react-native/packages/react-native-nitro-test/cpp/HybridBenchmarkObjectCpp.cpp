#include "HybridBenchmarkObjectCpp.hpp"
#include <NitroModules/ThreadPool.hpp>

namespace margelo::nitro::test {

double HybridBenchmarkObjectCpp::getNumberValue() {
  return _number;
}

void HybridBenchmarkObjectCpp::setNumberValue(double numberValue) {
  _number = numberValue;
}

std::shared_ptr<HybridBenchmarkObjectCppSpec> HybridBenchmarkObjectCpp::getThisObject() {
  return shared_cast<HybridBenchmarkObjectCppSpec>();
}

void HybridBenchmarkObjectCpp::simpleFunc() {
  // do nothing
}

double HybridBenchmarkObjectCpp::addNumbers(double a, double b) {
  return a + b;
}

std::string HybridBenchmarkObjectCpp::addStrings(const std::string& a, const std::string& b) {
  return a + b;
}

std::vector<double> HybridBenchmarkObjectCpp::bounceNumbers(const std::vector<double>& array) {
  return array;
}

Car HybridBenchmarkObjectCpp::bounceCar(const Car& car) {
  return car;
}

std::unordered_map<std::string, double> HybridBenchmarkObjectCpp::bounceSimpleMap(const std::unordered_map<std::string, double>& map) {
  return map;
}

std::string HybridBenchmarkObjectCpp::tryOptionalParams(double /* num */, bool /* boo */, const std::optional<std::string>& str) {
  if (str.has_value()) {
    return str.value();
  } else {
    return "value omitted!";
  }
}

std::variant<double, std::string> HybridBenchmarkObjectCpp::passVariant(
    const std::variant<bool, std::vector<double>, std::vector<std::string>, double, std::string>& either) {
  if (std::holds_alternative<std::string>(either)) {
    return std::get<std::string>(either);
  } else if (std::holds_alternative<double>(either)) {
    return std::get<double>(either);
  } else {
    return {"holds something else!"};
  }
}

std::shared_ptr<HybridBenchmarkObjectCppSpec> HybridBenchmarkObjectCpp::newBenchmarkObject() {
  return std::make_shared<HybridBenchmarkObjectCpp>();
}

ArrayBuffer HybridBenchmarkObjectCpp::bounceArrayBuffer(const ArrayBuffer& buffer) {
  return buffer;
}

ArrayBuffer HybridBenchmarkObjectCpp::copyBuffer(const ArrayBuffer& buffer) {
  return ArrayBuffer::copy(buffer);
}

double HybridBenchmarkObjectCpp::callbackSync(const Callback<double()>& callback) {
  double value = callback.callSync();
  return value;
}

Promise<double> HybridBenchmarkObjectCpp::promiseReturnsInstantly() {
  return Promise<double>::resolved(55);
}

Promise<double> HybridBenchmarkObjectCpp::createPendingPromise() {
  if (_pendingPromise) {
    throw std::runtime_error("A pending Promise is already waiting for completion.");
  }
  _pendingPromise = Promise<double>::pending();
  return _pendingPromise.value();
}

void HybridBenchmarkObjectCpp::resolvePendingPromiseOnWorker() {
  if (!_pendingPromise) {
    throw std::runtime_error("No pending Promise is waiting for completion.");
  }
  // Only JS calls access the slot; the worker owns the extracted Promise.
  auto promise = std::move(_pendingPromise.value());
  _pendingPromise.reset();
  ThreadPool::shared().run([promise = std::move(promise)]() { promise.resolve(55); });
}

} // namespace margelo::nitro::test
