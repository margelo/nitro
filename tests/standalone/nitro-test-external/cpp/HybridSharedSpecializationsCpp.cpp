//
//  HybridSharedSpecializationsCpp.cpp
//  NitroTestExternal
//

#include "HybridSharedSpecializationsCpp.hpp"
#include <future>

namespace margelo::nitro::test::external {

Callback<void(double)> HybridSharedSpecializationsCpp::getNumberCallback() {
  return _numberCallback;
}

void HybridSharedSpecializationsCpp::setNumberCallback(const Callback<void(double)>& numberCallback) {
  _numberCallback = numberCallback;
}

Promise<void> HybridSharedSpecializationsCpp::resolveVoid() {
  return Promise<void>::resolved();
}

Promise<double> HybridSharedSpecializationsCpp::resolveNumber(double value) {
  return Promise<double>::async([=]() { return value; });
}

Promise<std::string> HybridSharedSpecializationsCpp::resolveString(const std::string& value) {
  return Promise<std::string>::resolved(std::string(value));
}

Promise<void> HybridSharedSpecializationsCpp::awaitVoid(const Promise<void>& promise) {
  auto newPromise = Promise<void>::pending();
  promise.addOnResolvedListener([=]() { newPromise.resolve(); });
  promise.addOnRejectedListener([=](const std::exception_ptr& error) { newPromise.reject(std::exception_ptr(error)); });
  return newPromise;
}

Promise<double> HybridSharedSpecializationsCpp::awaitNumber(const Promise<double>& promise) {
  auto newPromise = Promise<double>::pending();
  promise.addOnResolvedListener([=](double result) { newPromise.resolve(std::move(result)); });
  promise.addOnRejectedListener([=](const std::exception_ptr& error) { newPromise.reject(std::exception_ptr(error)); });
  return newPromise;
}

void HybridSharedSpecializationsCpp::callVoid(const Callback<void()>& callback) {
  callback();
}

void HybridSharedSpecializationsCpp::callWithNumber(double value, const Callback<void(double)>& callback) {
  callback(value);
}

void HybridSharedSpecializationsCpp::callWithString(const std::string& value, const Callback<void(const std::string&)>& callback) {
  callback(value);
}

Promise<double> HybridSharedSpecializationsCpp::mapNumber(double value, const Callback<double(double)>& callback) {
  return Promise<double>::async([=]() -> double {
    Promise<double> promise = callback(value);
    std::future<double> future = promise.await();
    return future.get();
  });
}

Callback<void(double)> HybridSharedSpecializationsCpp::wrapNumberCallback(const Callback<void(double)>& callback) {
  return Callback<void(double)>::make([=](double value) { callback(value); });
}

SharedCallbackStruct HybridSharedSpecializationsCpp::bounceCallbackStruct(const SharedCallbackStruct& value) {
  return value;
}

Promise<void> HybridSharedSpecializationsCpp::callVoidPromiseCallback(const Callback<Promise<void>()>& callback) {
  return Promise<void>::async([=]() {
    Promise<Promise<void>> callPromise = callback();
    Promise<void> resultPromise = callPromise.await().get();
    resultPromise.await().get();
  });
}

Promise<double> HybridSharedSpecializationsCpp::callNumberPromiseCallback(const Callback<Promise<double>()>& callback) {
  return Promise<double>::async([=]() -> double {
    Promise<Promise<double>> callPromise = callback();
    Promise<double> resultPromise = callPromise.await().get();
    return resultPromise.await().get();
  });
}

void HybridSharedSpecializationsCpp::callInline(const InlineCallback<void()>& callback) {
  callback.call();
}

double HybridSharedSpecializationsCpp::callInlineWithNumber(double value, const InlineCallback<double(double)>& callback) {
  return callback.call(value);
}

} // namespace margelo::nitro::test::external
