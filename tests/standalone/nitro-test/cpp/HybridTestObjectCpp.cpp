//
//  HybridTestObjectCpp.cpp
//  NitroTest
//
//  Created by Marc Rousavy on 30.07.24.
//

#include "HybridTestObjectCpp.hpp"
#include "vendor/json/json.hpp"
#include <NitroModules/AnyJSON.hpp>
#include <NitroModules/NitroLogger.hpp>
#include <NitroModules/ThreadPool.hpp>
#include <NitroTestExternal/HybridSharedSpecializationsCppSpec.hpp>
#include <chrono>
#include <sstream>
#include <thread>

#include "HybridCppBase.hpp"
#include "HybridCppChild.hpp"
#include "HybridCppGrandchild.hpp"

namespace margelo::nitro::test {

const std::shared_ptr<const HybridClass>& HybridTestObjectCpp::Class::get() {
  static const auto hybridClass = HybridClass::create<Class>(
      [](HybridClass& clazz) { clazz.registerRawHybridMethod("rawJsiFunc", 0, &HybridTestObjectCpp::rawJsiFunc); });
  return hybridClass;
}

HybridTestObjectCpp::HybridTestObjectCpp(const std::optional<HybridPlatformObjectSpecCxx>& nativeFactory)
    : _nativeFactory(nativeFactory.has_value() ? nativeFactory.value() : HybridPlatformObjectSpecCxx::create()) {}

size_t HybridTestObjectCpp::getExternalMemorySize() noexcept {
  return _string.size();
}

double HybridTestObjectCpp::getReadonlyNumber() {
  return 42.0;
}

double HybridTestObjectCpp::getSharedNumber() {
  return _sharedNumber.load(std::memory_order_relaxed);
}

void HybridTestObjectCpp::setSharedNumber(double value) {
  _sharedNumber.store(value, std::memory_order_relaxed);
}

double HybridTestObjectCpp::staticAdd(double a, double b) {
  return a + b;
}

bool HybridTestObjectCpp::staticNegate(bool value) {
  return !value;
}

std::string HybridTestObjectCpp::staticConcat(const std::string& a, const std::string& b) {
  return a + b;
}

StaticPoint HybridTestObjectCpp::staticBouncePoint(const StaticPoint& point) {
  return point;
}

void HybridTestObjectCpp::staticThrow(const std::string& message) {
  throw std::runtime_error(message);
}

// Properties
double HybridTestObjectCpp::getComputedValue() {
  return _computedValueStorage * 2;
}

void HybridTestObjectCpp::setComputedValue(double value) {
  _computedValueStorage = value + 1;
}

double HybridTestObjectCpp::getNumberValue() {
  return _number;
}

void HybridTestObjectCpp::setNumberValue(double numberValue) {
  _number = numberValue;
}

bool HybridTestObjectCpp::getBoolValue() {
  return _bool;
}

void HybridTestObjectCpp::setBoolValue(bool boolValue) {
  _bool = boolValue;
}

std::string HybridTestObjectCpp::getStringValue() {
  return _string;
}

void HybridTestObjectCpp::setStringValue(const std::string& stringValue) {
  _string = stringValue;
}

int64_t HybridTestObjectCpp::getInt64Value() {
  return _int64Value;
}

void HybridTestObjectCpp::setInt64Value(int64_t int64Value) {
  _int64Value = int64Value;
}

uint64_t HybridTestObjectCpp::getUint64Value() {
  return _uint64Value;
}

void HybridTestObjectCpp::setUint64Value(uint64_t uint64Value) {
  _uint64Value = uint64Value;
}

nitro::NullType HybridTestObjectCpp::getNullValue() {
  return _null;
}

void HybridTestObjectCpp::setNullValue(nitro::NullType value) {
  _null = value;
}

std::optional<std::string> HybridTestObjectCpp::getOptionalString() {
  return _optionalString;
}

void HybridTestObjectCpp::setOptionalString(const std::optional<std::string>& optionalString) {
  _optionalString = optionalString;
}

std::optional<std::string> HybridTestObjectCpp::getStringOrUndefined() {
  return _optionalString;
}

void HybridTestObjectCpp::setStringOrUndefined(const std::optional<std::string>& stringOrUndefined) {
  _optionalString = stringOrUndefined;
}

std::variant<nitro::NullType, std::string> HybridTestObjectCpp::getStringOrNull() {
  return _nullableString;
}

void HybridTestObjectCpp::setStringOrNull(const std::variant<nitro::NullType, std::string>& stringOrNull) {
  _nullableString = stringOrNull;
}

std::optional<std::vector<std::string>> HybridTestObjectCpp::getOptionalArray() {
  return _optionalArray;
}

void HybridTestObjectCpp::setOptionalArray(const std::optional<std::vector<std::string>>& optionalArray) {
  _optionalArray = optionalArray;
}

std::optional<std::shared_ptr<HybridTestObjectCppSpec>> HybridTestObjectCpp::getOptionalHybrid() {
  return _optionalHybrid;
}

void HybridTestObjectCpp::setOptionalHybrid(const std::optional<std::shared_ptr<HybridTestObjectCppSpec>>& optionalHybrid) {
  _optionalHybrid = optionalHybrid;
}

std::variant<double, std::string> HybridTestObjectCpp::getSomeVariant() {
  return _variant;
}

void HybridTestObjectCpp::setSomeVariant(const std::variant<double, std::string>& variant) {
  _variant = variant;
}

std::tuple<double, std::string> HybridTestObjectCpp::getSomeTuple() {
  return _tuple;
}

void HybridTestObjectCpp::setSomeTuple(const std::tuple<double, std::string>& tuple) {
  _tuple = tuple;
}

std::shared_ptr<HybridTestObjectCppSpec> HybridTestObjectCpp::getThisObject() {
  return shared_cast<HybridTestObjectCppSpec>();
}

std::optional<Powertrain> HybridTestObjectCpp::getOptionalEnum() {
  return _optionalEnum;
}

void HybridTestObjectCpp::setOptionalEnum(const std::optional<Powertrain>& optionalEnum) {
  _optionalEnum = optionalEnum;
}

std::optional<OldEnum> HybridTestObjectCpp::getOptionalOldEnum() {
  return _optionalOldEnum;
}

void HybridTestObjectCpp::setOptionalOldEnum(const std::optional<OldEnum>& optionalOldEnum) {
  _optionalOldEnum = optionalOldEnum;
}

std::optional<TruckPowertrain> HybridTestObjectCpp::getOptionalEnumPlusOne() {
  return _optionalEnumPlusOne;
}

void HybridTestObjectCpp::setOptionalEnumPlusOne(const std::optional<TruckPowertrain>& optionalEnumPlusOne) {
  _optionalEnumPlusOne = optionalEnumPlusOne;
}

std::optional<Callback<void(double /* value */)>> HybridTestObjectCpp::getOptionalCallback() {
  return _optionalCallback;
}

bool HybridTestObjectCpp::getHasBoolean() {
  return false;
}

bool HybridTestObjectCpp::getIsBoolean() {
  return false;
}

bool HybridTestObjectCpp::getIsBooleanWritable() {
  return _isBooleanWritable;
}

void HybridTestObjectCpp::setIsBooleanWritable(bool isBooleanWritable) {
  _isBooleanWritable = isBooleanWritable;
}

bool HybridTestObjectCpp::getHasBooleanWritable() {
  return _hasBooleanWritable;
}

void HybridTestObjectCpp::setHasBooleanWritable(bool hasBooleanWritable) {
  _hasBooleanWritable = hasBooleanWritable;
}

bool HybridTestObjectCpp::getIsolatedBoolean() {
  return _isolatedBoolean;
}

void HybridTestObjectCpp::setIsolatedBoolean(bool isolatedBoolean) {
  _isolatedBoolean = isolatedBoolean;
}

std::string HybridTestObjectCpp::getIsTextValue() {
  return _isTextValue;
}

void HybridTestObjectCpp::setIsTextValue(const std::string& isTextValue) {
  _isTextValue = isTextValue;
}

void HybridTestObjectCpp::setOptionalCallback(const std::optional<Callback<void(double /* value */)>>& callback) {
  _optionalCallback = callback;
}

// Methods
double HybridTestObjectCpp::addNumbers(double a, double b) {
  return a + b;
}

std::string HybridTestObjectCpp::addStrings(const std::string& a, const std::string& b) {
  return a + b;
}

void HybridTestObjectCpp::simpleFunc() {
  // do nothing
}

std::shared_ptr<HybridObject> HybridTestObjectCpp::bounceAnyHybrid(const std::shared_ptr<HybridObject>& object) {
  return object;
}

CustomString HybridTestObjectCpp::bounceCustomType(CustomString value) {
  return value;
}

void HybridTestObjectCpp::multipleArguments(double num, const std::string& str, bool boo) {
  Logger::log(LogLevel::Info, Class::name, "Arguments received! num: %f | str: %s | boo: %i", num, str.c_str(), boo);
}

nitro::NullType HybridTestObjectCpp::bounceNull(nitro::NullType value) {
  return value;
}

std::vector<std::string> HybridTestObjectCpp::bounceStrings(const std::vector<std::string>& array) {
  return array;
}

std::vector<double> HybridTestObjectCpp::bounceNumbers(const std::vector<double>& array) {
  return array;
}

std::vector<Person> HybridTestObjectCpp::bounceStructs(const std::vector<Person>& array) {
  return array;
}

std::vector<std::vector<Person>> HybridTestObjectCpp::bounceNestedArray(const std::vector<std::vector<Person>>& array) {
  return array;
}

PartialPerson HybridTestObjectCpp::bouncePartialStruct(const PartialPerson& person) {
  return person;
}

std::string HybridTestObjectCpp::sumUpAllPassengers(const std::vector<Car>& cars) {
  std::ostringstream oss;
  bool first = true;

  for (const auto& car : cars) {
    for (const auto& passenger : car.passengers) {
      if (!first) {
        // separator
        oss << ", ";
      }
      oss << passenger.name << " (" << passenger.age << ")";
      first = false;
    }
  }

  return oss.str();
}

std::vector<Powertrain> HybridTestObjectCpp::bounceEnums(const std::vector<Powertrain>& array) {
  return array;
}

void HybridTestObjectCpp::complexEnumCallback(const std::vector<Powertrain>& array,
                                              const Callback<void(const std::vector<Powertrain>& /* array */)>& callback) {
  callback(array);
}

std::vector<Powertrain>
HybridTestObjectCpp::callEnumArrayCallback(const std::vector<Powertrain>& array,
                                           const Callback<std::vector<Powertrain>(const std::vector<Powertrain>&)>& callback) {
  return callback.callSync(array);
}

Callback<std::vector<Powertrain>(const std::vector<Powertrain>&)> HybridTestObjectCpp::getEnumArrayCallback() {
  return Callback<std::vector<Powertrain>(const std::vector<Powertrain>&)>::make(
      [](const std::vector<Powertrain>& array) { return array; });
}

Promise<std::vector<Powertrain>>
HybridTestObjectCpp::callEnumArrayPromiseCallback(const Callback<Promise<std::vector<Powertrain>>()>& callback) {
  return Promise<std::vector<Powertrain>>::async([=]() {
    Promise<std::vector<Powertrain>> promise = callback().await().get();
    return promise.await().get();
  });
}

Promise<std::vector<Powertrain>> HybridTestObjectCpp::awaitEnumArrayPromise(const Promise<std::vector<Powertrain>>& promise) {
  return Promise<std::vector<Powertrain>>::async([=]() { return promise.await().get(); });
}

std::vector<std::vector<std::optional<Person>>> HybridTestObjectCpp::callNestedStructCallback(
    const std::vector<std::vector<std::optional<Person>>>& value,
    const Callback<std::vector<std::vector<std::optional<Person>>>(const std::vector<std::vector<std::optional<Person>>>&)>& callback) {
  return callback.callSync(value);
}

std::vector<HybridChildSpecCxx> HybridTestObjectCpp::bounceHybridObjects(const std::vector<HybridChildSpecCxx>& array) {
  return array;
}

std::vector<Callback<void()>> HybridTestObjectCpp::bounceFunctions(const std::vector<Callback<void()>>& functions) {
  return functions;
}

std::vector<AnyJSON> HybridTestObjectCpp::bounceMaps(const std::vector<AnyJSON>& maps) {
  return maps;
}

std::vector<Promise<double>> HybridTestObjectCpp::bouncePromises(const std::vector<Promise<double>>& promises) {
  return promises;
}

std::vector<ArrayBuffer> HybridTestObjectCpp::bounceArrayBuffers(const std::vector<ArrayBuffer>& arrayBuffers) {
  return arrayBuffers;
}

std::vector<std::optional<std::string>> HybridTestObjectCpp::bounceOptionals(const std::vector<std::optional<std::string>>& strings,
                                                                             const std::vector<std::optional<ArrayBuffer>>& arrayBuffers) {
  return strings;
}

std::vector<std::variant<nitro::NullType, std::string>>
HybridTestObjectCpp::bounceNulls(const std::vector<std::variant<nitro::NullType, std::string>>& strings) {
  return strings;
}

std::vector<std::optional<std::variant<nitro::NullType, std::string>>>
HybridTestObjectCpp::bounceOptionalNulls(const std::vector<std::optional<std::variant<nitro::NullType, std::string>>>& strings) {
  return strings;
}

std::unordered_map<std::string, std::optional<std::string>>
HybridTestObjectCpp::bounceOptionalMap(const std::unordered_map<std::string, std::optional<std::string>>& map) {
  return map;
}

std::unordered_map<std::string, std::variant<nitro::NullType, std::string>>
HybridTestObjectCpp::bounceNullMap(const std::unordered_map<std::string, std::variant<nitro::NullType, std::string>>& map) {
  return map;
}

std::unordered_map<std::string, std::optional<std::variant<nitro::NullType, std::string>>> HybridTestObjectCpp::bounceOptionalNullMap(
    const std::unordered_map<std::string, std::optional<std::variant<nitro::NullType, std::string>>>& map) {
  return map;
}

AnyJSON HybridTestObjectCpp::createMap() {
  auto array = nlohmann::json::array({getNumberValue(), getBoolValue(), getStringValue(), getInt64Value()});
  nlohmann::json object = {
      {"number", getNumberValue()}, {"bool", getBoolValue()}, {"string", getStringValue()},
      {"int64", getInt64Value()},   {"null", nullptr},        {"array", array},
  };
  auto nestedObject = object;
  nestedObject["array"].push_back(array);
  object["object"] = std::move(nestedObject);
  return AnyJSON{object.dump()};
}

AnyJSON HybridTestObjectCpp::mapRoundtrip(const AnyJSON& map) {
  return map;
}

std::vector<std::string> HybridTestObjectCpp::getMapKeys(const AnyJSON& map) {
  const auto object = nlohmann::json::parse(map.stringRepresentation);
  if (!object.is_object()) {
    throw std::invalid_argument("getMapKeys() expects a JSON object.");
  }
  std::vector<std::string> keys;
  keys.reserve(object.size());
  for (const auto& [key, value] : object.items()) {
    keys.push_back(key);
  }
  return keys;
}

AnyJSON HybridTestObjectCpp::mergeMaps(const AnyJSON& a, const AnyJSON& b) {
  auto first = nlohmann::json::parse(a.stringRepresentation);
  const auto second = nlohmann::json::parse(b.stringRepresentation);
  if (!first.is_object() || !second.is_object()) {
    throw std::invalid_argument("mergeMaps() expects two JSON objects.");
  }
  first.update(second);
  return AnyJSON{first.dump()};
}

AnyJSON HybridTestObjectCpp::copyAnyMap(const AnyJSON& map) {
  return map;
}

AnyJSON HybridTestObjectCpp::createJSON(const std::string& json) {
  // Keep the text unvalidated so malformed input reaches JSIConverter<AnyJSON>::toJSI.
  return AnyJSON{json};
}

Promise<AnyJSON> HybridTestObjectCpp::createJSONAsync(const std::string& json) {
  return Promise<AnyJSON>::async([json]() { return AnyJSON{json}; });
}

Promise<AnyJSON> HybridTestObjectCpp::createResolvedJSON(const std::string& json) {
  return Promise<AnyJSON>::resolved(AnyJSON{json});
}

Promise<AnyJSON> HybridTestObjectCpp::createPendingJSON() {
  if (_pendingJSON) {
    throw std::runtime_error("A pending JSON Promise is already waiting for completion.");
  }
  _pendingJSON = Promise<AnyJSON>::pending();
  return _pendingJSON.value();
}

void HybridTestObjectCpp::resolvePendingJSONOnWorker(const std::string& json) {
  if (!_pendingJSON) {
    throw std::runtime_error("No pending JSON Promise is waiting for completion.");
  }
  // Only JS calls access the slot; the worker owns the extracted Promise.
  auto promise = std::move(_pendingJSON.value());
  _pendingJSON.reset();
  ThreadPool::shared().run([promise = std::move(promise), json]() { promise.resolve(AnyJSON{json}); });
}

double HybridTestObjectCpp::funcThatThrows() {
  throw std::runtime_error("This function will only work after sacrificing seven lambs!");
}

Promise<void> HybridTestObjectCpp::callCallbackThatReturnsPromiseVoid(const Callback<Promise<void>()>& callback) {
  return Promise<void>::async([=]() {
    Promise<Promise<void>> callPromise = callback();
    std::future<Promise<void>> callFuture = callPromise.await();
    Promise<void> resultPromise = callFuture.get();
    std::future<void> future = resultPromise.await();
    future.get();
  });
}

Promise<void> HybridTestObjectCpp::funcThatThrowsBeforePromise() {
  throw std::runtime_error("This function will only work after sacrificing eight lambs!");
}

void HybridTestObjectCpp::throwError(const std::exception_ptr& error) {
  std::rethrow_exception(error);
}

std::string HybridTestObjectCpp::tryOptionalParams(double /* num */, bool /* value */, const std::optional<std::string>& str) {
  if (str.has_value()) {
    return str.value();
  } else {
    return "value omitted!";
  }
}

std::string HybridTestObjectCpp::tryMiddleParam(double /* num */, const std::optional<bool>& boo, const std::string& str) {
  return str;
}

std::optional<Powertrain> HybridTestObjectCpp::tryOptionalEnum(const std::optional<Powertrain>& value) {
  return value;
}

bool HybridTestObjectCpp::tryTrailingOptional(double /* num */, const std::string& str, const std::optional<bool>& boo) {
  return boo.has_value() ? boo.value() : false;
}

std::variant<double, std::string>
HybridTestObjectCpp::passVariant(const std::variant<bool, std::vector<double>, std::vector<std::string>, double, std::string>& either) {
  if (std::holds_alternative<std::string>(either)) {
    return std::get<std::string>(either);
  } else if (std::holds_alternative<double>(either)) {
    return std::get<double>(either);
  } else {
    return {"holds something else!"};
  }
}

std::variant<HybridBaseSpecCxx, OptionalWrapper>
HybridTestObjectCpp::passAllEmptyObjectVariant(const std::variant<HybridBaseSpecCxx, OptionalWrapper>& variant) {
  return variant;
}

std::variant<ArrayBuffer, Callback<void(double /* value */)>, WrappedJsStruct, Promise<double>, AnyJSON>
HybridTestObjectCpp::bounceComplexVariant(
    const std::variant<ArrayBuffer, Callback<void(double /* value */)>, WrappedJsStruct, Promise<double>, AnyJSON>& variant) {
  return variant;
}

std::variant<OldEnum, bool> HybridTestObjectCpp::getVariantEnum(const std::variant<OldEnum, bool>& variant) {
  return variant;
}

std::variant<Powertrain, Car> HybridTestObjectCpp::bounceVariantUnionEnum(const std::variant<Powertrain, Car>& variant) {
  return variant;
}

std::variant<WeirdNumbersEnum, bool> HybridTestObjectCpp::getVariantWeirdNumbersEnum(const std::variant<WeirdNumbersEnum, bool>& variant) {
  return variant;
}

std::variant<Person, Car> HybridTestObjectCpp::getVariantObjects(const std::variant<Person, Car>& variant) {
  return variant;
}

std::variant<std::shared_ptr<HybridTestObjectCppSpec>, Person>
HybridTestObjectCpp::getVariantHybrid(const std::variant<std::shared_ptr<HybridTestObjectCppSpec>, Person>& variant) {
  return variant;
}

std::variant<std::shared_ptr<HybridTestObjectCppSpec>, Powertrain>
HybridTestObjectCpp::getVariantHybridEnum(const std::variant<std::shared_ptr<HybridTestObjectCppSpec>, Powertrain>& variant) {
  return variant;
}

std::variant<std::tuple<double, double>, std::tuple<double, double, double>>
HybridTestObjectCpp::getVariantTuple(const std::variant<std::tuple<double, double>, std::tuple<double, double, double>>& variant) {
  return variant;
}

std::variant<std::string, Car> HybridTestObjectCpp::passNamedVariant(const std::variant<std::string, Car>& variant) {
  return variant;
}

std::tuple<double, double, double> HybridTestObjectCpp::flip(const std::tuple<double, double, double>& tuple) {
  return {std::get<2>(tuple), std::get<1>(tuple), std::get<0>(tuple)};
}

std::tuple<double, std::string, bool> HybridTestObjectCpp::passTuple(const std::tuple<double, std::string, bool>& tuple) {
  return tuple;
}

int64_t HybridTestObjectCpp::calculateFibonacciSync(double value) {
  return calculateFibonacci(value);
}

std::unordered_map<std::string, std::variant<bool, double>>
HybridTestObjectCpp::bounceMap(const std::unordered_map<std::string, std::variant<bool, double>>& map) {
  return map;
}

std::unordered_map<std::string, double> HybridTestObjectCpp::bounceSimpleMap(const std::unordered_map<std::string, double>& map) {
  return map;
}

std::unordered_map<std::string, std::string> HybridTestObjectCpp::extractMap(const MapWrapper& mapWrapper) {
  return mapWrapper.map;
}

Promise<int64_t> HybridTestObjectCpp::calculateFibonacciAsync(double value) {
  return Promise<int64_t>::async([this, value]() -> int64_t { return this->calculateFibonacci(value); });
}

Promise<void> HybridTestObjectCpp::wait(double seconds) {
  return Promise<void>::async([=]() {
    std::chrono::nanoseconds nanoseconds(static_cast<int64_t>(seconds * 1'000'000'000));
    std::this_thread::sleep_for(nanoseconds);
  });
}

void HybridTestObjectCpp::callCallback(const Callback<void()>& callback) {
  callback();
}

void HybridTestObjectCpp::callInlineCallback(const InlineCallback<void()>& callback) {
  callback.call();
}

double HybridTestObjectCpp::callInlineCallbackWithValue(double value, const InlineCallback<double(double)>& callback) {
  return callback.call(value);
}

Callback<void(double /* num */)> HybridTestObjectCpp::createNativeCallback(const Callback<void(double /* num */)>& wrappingJsCallback) {
  return Callback<void(double)>::make([=](double num) { wrappingJsCallback(num); });
}

void HybridTestObjectCpp::callWithOptional(const std::optional<double>& value,
                                           const Callback<void(const std::optional<double>& /* maybe */)>& callback) {
  callback(value);
}

Promise<double> HybridTestObjectCpp::callSumUpNTimes(const Callback<double()>& callback, double n) {
  return Promise<double>::async([=]() {
    double result = 0;
    for (size_t i = 0; i < n; i++) {
      std::future<double> future = callback().await();
      double current = future.get();
      result += current;
    }
    return result;
  });
}

Promise<double> HybridTestObjectCpp::callbackAsyncPromise(const Callback<Promise<double>()>& callback) {
  return Promise<double>::async([=]() {
    std::future<Promise<double>> future = callback().await();
    Promise<double> promise = future.get();
    std::future<double> innerFuture = promise.await();
    double innerResult = innerFuture.get();
    return innerResult;
  });
}

Promise<ArrayBuffer> HybridTestObjectCpp::callbackAsyncPromiseBuffer(const Callback<Promise<ArrayBuffer>()>& callback) {
  return Promise<ArrayBuffer>::async([=]() {
    std::future<Promise<ArrayBuffer>> future = callback().await();
    Promise<ArrayBuffer> promise = future.get();
    std::future<ArrayBuffer> innerFuture = promise.await();
    ArrayBuffer innerResult = innerFuture.get();
    return innerResult;
  });
}

Callback<void(double /* value */)> HybridTestObjectCpp::getComplexCallback() {
  return Callback<void(double)>::make([](double value) { Logger::log(LogLevel::Info, Class::name, "Callback called with %f", value); });
}

void HybridTestObjectCpp::twoOptionalCallbacks(double value, const std::optional<Callback<void(double /* value */)>>& first,
                                               const std::optional<Callback<void(const std::string& /* value */)>>& second) {
  if (first.has_value()) {
    first.value()(value);
  }
  if (second.has_value()) {
    second.value()("Hello!");
  }
}

void HybridTestObjectCpp::errorCallback(const Callback<void(const std::exception_ptr& /* error */)>& onError) {
  std::runtime_error error("Some Error!");
  onError(std::make_exception_ptr(error));
}

Promise<double> HybridTestObjectCpp::getValueFromJSCallbackAndWait(const Callback<double()>& getValue) {
  return Promise<double>::async([=]() -> double {
    Promise<double> promise = getValue();
    std::future<double> future = promise.await();
    future.wait();
    double value = future.get();
    return value;
  });
}

Promise<double> HybridTestObjectCpp::awaitAndGetPromise(const Promise<double>& promise) {
  auto newPromise = Promise<double>::pending();
  promise.addOnResolvedListener([=](double result) { newPromise.resolve(std::move(result)); });
  promise.addOnRejectedListener([=](const std::exception_ptr& error) { newPromise.reject(std::exception_ptr(error)); });
  return newPromise;
}

Promise<Car> HybridTestObjectCpp::awaitAndGetComplexPromise(const Promise<Car>& promise) {
  auto newPromise = Promise<Car>::pending();
  promise.addOnResolvedListener([=](const Car& result) { newPromise.resolve(Car(result)); });
  promise.addOnRejectedListener([=](const std::exception_ptr& error) { newPromise.reject(std::exception_ptr(error)); });
  return newPromise;
}

Promise<void> HybridTestObjectCpp::awaitPromise(const Promise<void>& promise) {
  auto newPromise = Promise<void>::pending();
  promise.addOnResolvedListener([=]() { newPromise.resolve(); });
  promise.addOnRejectedListener([=](const std::exception_ptr& error) { newPromise.reject(std::exception_ptr(error)); });
  return newPromise;
}

Promise<void> HybridTestObjectCpp::promiseThrows() {
  return Promise<void>::async([=]() { throw std::runtime_error("Promise throws :)"); });
}

Promise<double> HybridTestObjectCpp::promiseReturnsInstantly() {
  return Promise<double>::resolved(55);
}

Promise<double> HybridTestObjectCpp::promiseReturnsInstantlyAsync() {
  return Promise<double>::async([=]() { return 55; });
}

Promise<double> HybridTestObjectCpp::createPendingPromise() {
  if (_pendingPromise) {
    throw std::runtime_error("A pending Promise is already waiting for completion.");
  }
  _pendingPromise = Promise<double>::pending();
  return _pendingPromise.value();
}

void HybridTestObjectCpp::resolvePendingPromiseOnWorker() {
  if (!_pendingPromise) {
    throw std::runtime_error("No pending Promise is waiting for completion.");
  }
  // Only JS calls access the slot; the worker owns the extracted Promise.
  auto promise = std::move(_pendingPromise.value());
  _pendingPromise.reset();
  ThreadPool::shared().run([promise = std::move(promise)]() { promise.resolve(55); });
}

Promise<void> HybridTestObjectCpp::promiseThatResolvesVoidInstantly() {
  return Promise<void>::resolved();
}

Promise<std::optional<double>> HybridTestObjectCpp::promiseThatResolvesToUndefined() {
  return Promise<std::optional<double>>::resolved(std::nullopt);
}

Promise<std::optional<double>> HybridTestObjectCpp::awaitNullablePromise() {
  return Promise<std::optional<double>>::async([]() {
    auto promise = Promise<std::optional<double>>::resolved(std::nullopt);
    return promise.await().get();
  });
}

void HybridTestObjectCpp::callAll(const Callback<void()>& first, const Callback<void()>& second, const Callback<void()>& third) {
  first();
  second();
  third();
}

Promise<void> HybridTestObjectCpp::getValueFromJsCallback(const Callback<std::string()>& callback,
                                                          const Callback<void(const std::string& /* valueFromJs */)>& andThenCall) {
  return Promise<void>::async([=]() {
    Promise<std::string> promise = callback();
    std::future<std::string> future = promise.await();
    std::string jsValue = future.get();
    andThenCall(jsValue);
  });
}

void HybridTestObjectCpp::callSyncCallback(double value, const Callback<void(double /* value */)>& callback) {
  callback.callSync(value);
}

Promise<double> HybridTestObjectCpp::callAsyncCallback(double value, const Callback<double(double /* value */)>& callback) {
  return callback.callAsync(value);
}

Promise<void> HybridTestObjectCpp::callAsyncVoidCallback(const Callback<void()>& callback) {
  return callback.callAsync();
}

Promise<bool> HybridTestObjectCpp::callAsyncBooleanCallback(bool value, const Callback<bool(bool /* value */)>& callback) {
  return callback.callAsync(value);
}

Promise<double> HybridTestObjectCpp::awaitAsyncCallback(double value, const Callback<double(double /* value */)>& callback) {
  return Promise<double>::async([=]() {
    std::future<double> future = callback.callAsync(value).await();
    double result = future.get();
    return result + 1;
  });
}

void HybridTestObjectCpp::callAndForgetCallback(double value, const Callback<double(double /* value */)>& callback) {
  callback.callAndForget(value);
}

Promise<double> HybridTestObjectCpp::callNativeCallbackAsync(double value) {
  auto callback = Callback<double(double)>::make([](double input) { return input * 2; });
  return callback.callAsync(value);
}

Promise<void> HybridTestObjectCpp::callThrowingNativeCallbackAsync(const std::string& message) {
  auto callback = Callback<void()>::make([message]() { throw std::runtime_error(message); });
  return callback.callAsync();
}

void HybridTestObjectCpp::callThrowingNativeCallbackAndForget(const std::string& message) {
  auto callback = Callback<void()>::make([message]() { throw std::runtime_error(message); });
  callback.callAndForget();
}

Promise<double> HybridTestObjectCpp::callInlineCallbackThenEscape(double value,
                                                                  const InlineCallback<double(double /* value */)>& callback) {
  double first = callback.call(value);
  Callback<double(double)> escaped = callback.escape();
  return escaped.callAsync(first);
}

Callback<void(double /* value */)>
HybridTestObjectCpp::getSharedNumberCallback(const std::shared_ptr<external::HybridSharedSpecializationsCppSpec>& shared) {
  return shared->getNumberCallback();
}

Car HybridTestObjectCpp::getCar() {
  return Car(2018, "Lamborghini", "Huracan Performante", 640, Powertrain::GAS, std::nullopt, {}, true, std::nullopt, {100, 10},
             std::nullopt);
}

bool HybridTestObjectCpp::isCarElectric(const Car& car) {
  return car.powertrain == Powertrain::ELECTRIC;
}

bool HybridTestObjectCpp::areCarsEqual(const Car& a, const Car& b) {
  return a == b;
}

std::optional<Person> HybridTestObjectCpp::getDriver(const Car& car) {
  if (car.driver.has_value()) {
    return car.driver.value();
  } else {
    return std::nullopt;
  }
}

Car HybridTestObjectCpp::bounceCar(const Car& car) {
  return car;
}

void HybridTestObjectCpp::jsStyleObjectAsParameters(const JsStyleStruct& params) {
  params.onChanged(params.value);
}

UnsignedScalar HybridTestObjectCpp::roundtripUnsignedScalar(const UnsignedScalar& value) {
  return value;
}

UnsignedValues HybridTestObjectCpp::roundtripUnsignedValues(const UnsignedValues& value) {
  return value;
}

WrappedJsStruct HybridTestObjectCpp::bounceWrappedJsStyleStruct(const WrappedJsStruct& value) {
  return value;
}

OptionalWrapper HybridTestObjectCpp::bounceOptionalWrapper(const OptionalWrapper& wrapper) {
  return wrapper;
}

OptionalCallback HybridTestObjectCpp::bounceOptionalCallback(const OptionalCallback& value) {
  return value;
}

std::optional<OptionalEnumWrapper> HybridTestObjectCpp::bounceOptionalEnumStruct(const std::optional<OptionalEnumWrapper>& value) {
  return value;
}

ArrayBuffer HybridTestObjectCpp::createArrayBufferFromNativeBuffer(bool /* value */) {
  // Let's just use the move method here for native buffer to test this too.
  std::vector<uint8_t> data;
  data.resize(1024 * 1024 * 10); // 10 MB
  for (size_t i = 0; i < data.size(); i++) {
    data[i] = i % 255;
  }
  return ArrayBuffer::move(std::move(data));
}

ArrayBuffer HybridTestObjectCpp::createArrayBuffer() {
  size_t size = 1024 * 1024 * 10; // 10MB
  uint8_t* buffer = new uint8_t[size];
  return ArrayBuffer::wrap(buffer, size, [=]() { delete[] buffer; });
}

ArrayBuffer HybridTestObjectCpp::wrapArrayBuffer(double size) {
  size_t byteSize = static_cast<size_t>(size);
  uint8_t* data = new uint8_t[byteSize];
  auto deleteCount = _wrappedArrayBufferDeleteCount;
  ArrayBuffer buffer = ArrayBuffer::wrap(data, byteSize, [data, deleteCount]() {
    delete[] data;
    (*deleteCount)++;
  });
  _wrappedArrayBuffers.push_back(buffer);
  return buffer;
}

void HybridTestObjectCpp::releaseWrappedArrayBuffers() {
  _wrappedArrayBuffers.clear();
}

double HybridTestObjectCpp::getWrappedArrayBufferDeleteCount() {
  return static_cast<double>(_wrappedArrayBufferDeleteCount->load());
}

ArrayBuffer HybridTestObjectCpp::createHardwareBuffer(double width, double height, double layers, HardwareBufferFormat format) {
  // C++ doesn't have HardwareBuffers - create a normal ArrayBuffer of the same byte size instead.
  size_t size;
  switch (format) {
    case HardwareBufferFormat::BLOB:
      // BLOB buffers hold `width` bytes flat.
      size = static_cast<size_t>(width);
      break;
    case HardwareBufferFormat::RGB_565:
      size = static_cast<size_t>(width) * static_cast<size_t>(height) * static_cast<size_t>(layers) * 2;
      break;
    case HardwareBufferFormat::RGBA_8888:
      size = static_cast<size_t>(width) * static_cast<size_t>(height) * static_cast<size_t>(layers) * 4;
      break;
    case HardwareBufferFormat::RGBA_FP16:
      size = static_cast<size_t>(width) * static_cast<size_t>(height) * static_cast<size_t>(layers) * 8;
      break;
    default:
      throw std::runtime_error("Unknown HardwareBufferFormat!");
  }
  return ArrayBuffer::allocate(size);
}

ArrayBuffer HybridTestObjectCpp::copyBuffer(const ArrayBuffer& buffer) {
  return ArrayBuffer::copy(buffer);
}

ArrayBuffer HybridTestObjectCpp::bounceArrayBuffer(const ArrayBuffer& buffer) {
  return buffer;
}

double HybridTestObjectCpp::getBufferLastItem(const ArrayBuffer& buffer) {
  size_t size = buffer.size();
  if (size == 0) {
    throw std::runtime_error("ArrayBuffer's size is 0!");
  }
  uint8_t* data = buffer.data();
  if (data == nullptr) {
    throw std::runtime_error("ArrayBuffer's data is null!");
  }
  uint8_t lastItem = data[size - 1];
  return static_cast<double>(lastItem);
}

void HybridTestObjectCpp::setAllValuesTo(const ArrayBuffer& buffer, double value) {
  size_t size = buffer.size();
  if (size == 0) {
    throw std::runtime_error("ArrayBuffer's size is 0!");
  }
  uint8_t* data = buffer.data();
  if (data == nullptr) {
    throw std::runtime_error("ArrayBuffer's data is null!");
  }

  for (size_t i = 0; i < size; i++) {
    data[i] = static_cast<uint8_t>(value);
  }
}

Promise<ArrayBuffer> HybridTestObjectCpp::createArrayBufferAsync() {
  return Promise<ArrayBuffer>::async([this]() -> ArrayBuffer { return this->createArrayBuffer(); });
}

std::shared_ptr<HybridTestObjectCppSpec> HybridTestObjectCpp::newTestObject() {
  return std::make_shared<HybridTestObjectCpp>();
}

Promise<std::shared_ptr<HybridTestObjectCppSpec>> HybridTestObjectCpp::newTestObjectAsync() {
  // Resolves a HybridObject off the JS thread (on the Nitro ThreadPool). The near-instant closure
  // keeps the resolve()-vs-toJSI window wide so the C++ Promise `_state` race surfaces under TSan.
  return Promise<std::shared_ptr<HybridTestObjectCppSpec>>::async(
      []() -> std::shared_ptr<HybridTestObjectCppSpec> { return std::make_shared<HybridTestObjectCpp>(); });
}

jsi::Value HybridTestObjectCpp::rawJsiFunc(jsi::Runtime& runtime, const jsi::Value&, const jsi::Value* args, size_t count) {
  jsi::Array array(runtime, count);
  for (size_t i = 0; i < count; i++) {
    array.setValueAtIndex(runtime, i, jsi::Value(runtime, args[i]));
  }
  return array;
}

HybridBaseSpecCxx HybridTestObjectCpp::createBase() {
  return _nativeFactory.createBase();
}

HybridChildSpecCxx HybridTestObjectCpp::createChild() {
  return _nativeFactory.createChild();
}

HybridBaseSpecCxx HybridTestObjectCpp::createBaseActualChild() {
  return _nativeFactory.createChild();
}

HybridGrandchildSpecCxx HybridTestObjectCpp::createGrandchild() {
  return HybridGrandchildSpecCxx::create();
}

HybridChildSpecCxx HybridTestObjectCpp::createChildActualGrandchild() {
  return HybridGrandchildSpecCxx::create();
}

HybridBaseSpecCxx HybridTestObjectCpp::createBaseActualGrandchild() {
  return HybridGrandchildSpecCxx::create();
}

HybridGrandchildSpecCxx HybridTestObjectCpp::bounceGrandchild(const HybridGrandchildSpecCxx& grandchild) {
  return grandchild;
}

HybridChildSpecCxx HybridTestObjectCpp::bounceChild(const HybridChildSpecCxx& child) {
  return child;
}

HybridBaseSpecCxx HybridTestObjectCpp::bounceBase(const HybridBaseSpecCxx& base) {
  return base;
}

HybridBaseSpecCxx HybridTestObjectCpp::bounceChildBase(const HybridChildSpecCxx& child) {
  return child;
}

HybridChildSpecCxx HybridTestObjectCpp::castBase(const HybridBaseSpecCxx& base) {
  try {
    return HybridChildSpecCxx::fromNative(base.getNativeObject());
  } catch (const std::exception&) {
    throw std::runtime_error("Cannot cast Base to Child!");
  }
}

std::optional<HybridBaseSpecCxx> HybridTestObjectCpp::getRetainedBase() {
  return _retainedBase;
}

void HybridTestObjectCpp::setRetainedBase(const std::optional<HybridBaseSpecCxx>& base) {
  _retainedBase = base;
}

double HybridTestObjectCpp::readBaseValue(const HybridBaseSpecCxx& base) {
  return base.getBaseValue();
}

double HybridTestObjectCpp::readChildBaseValue(const HybridChildSpecCxx& child) {
  return child.getBaseValue();
}

Size HybridTestObjectCpp::bounceSizeThroughBase(const HybridBaseSpecCxx& base, const Size& size) {
  return base.bounceSize(size);
}

Promise<Size> HybridTestObjectCpp::mapSizeThroughBase(const HybridBaseSpecCxx& base, const Size& size,
                                                      const Callback<Size(const Size&)>& callback) {
  return base.mapSize(size, callback);
}

std::variant<std::string, Car> HybridTestObjectCpp::bounceVariantThroughChild(const HybridChildSpecCxx& child,
                                                                              const std::variant<std::string, Car>& variant) {
  return child.bounceVariant(variant);
}

std::string HybridTestObjectCpp::readExternalValue(const adapters::NitroTestExternal::HybridSomeExternalObjectSpecCxx& externalObject) {
  return externalObject.getValue();
}

void HybridTestObjectCpp::callExternalNumberCallback(const adapters::NitroTestExternal::HybridSomeExternalObjectSpecCxx& externalObject,
                                                     double value) {
  externalObject.getNumberCallback()(value);
}

OptionalPrimitivesHolder HybridTestObjectCpp::createExternalOptionalPrimitives(
    const adapters::NitroTestExternal::HybridSomeExternalObjectSpecCxx& externalObject, const std::optional<double>& optionalNumber,
    const std::optional<bool>& optionalBoolean, const std::optional<uint64_t>& optionalUInt64,
    const std::optional<int64_t>& optionalInt64) {
  return externalObject.createOptionalPrimitivesHolder(optionalNumber, optionalBoolean, optionalUInt64, optionalInt64);
}

HybridBaseSpecCxx HybridTestObjectCpp::createAlternativeBase() {
  return _nativeFactory.createAlternativeBase();
}

std::shared_ptr<HybridCppBaseSpec> HybridTestObjectCpp::createCppBase() {
  return std::make_shared<HybridCppBase>();
}

std::shared_ptr<HybridCppChildSpec> HybridTestObjectCpp::createCppChild() {
  return std::make_shared<HybridCppChild>();
}

std::shared_ptr<HybridCppGrandchildSpec> HybridTestObjectCpp::createCppGrandchild() {
  return std::make_shared<HybridCppGrandchild>();
}

std::shared_ptr<HybridCppBaseSpec> HybridTestObjectCpp::createCppBaseActualChild() {
  return std::make_shared<HybridCppChild>();
}

std::shared_ptr<HybridCppBaseSpec> HybridTestObjectCpp::bounceCppBase(const std::shared_ptr<HybridCppBaseSpec>& base) {
  return base;
}

std::shared_ptr<HybridCppChildSpec> HybridTestObjectCpp::castCppBase(const std::shared_ptr<HybridCppBaseSpec>& base) {
  auto child = std::dynamic_pointer_cast<HybridCppChildSpec>(base);
  if (child == nullptr) {
    throw std::runtime_error("Cannot cast CppBase to CppChild!");
  }
  return child;
}

double HybridTestObjectCpp::callbackSync(const Callback<double()>& callback) {
  double value = callback.callSync();
  return value;
}

Callback<double()> HybridTestObjectCpp::getSyncNumberCallback() {
  return Callback<double()>::make([]() -> double { return 55; });
}

Callback<int64_t(int64_t /* value */)>
HybridTestObjectCpp::bounceSyncInt64Callback(const Callback<int64_t(int64_t /* value */)>& callback) {
  return callback;
}

adapters::NitroTestExternal::HybridSomeExternalObjectSpecCxx
HybridTestObjectCpp::bounceExternalHybrid(const adapters::NitroTestExternal::HybridSomeExternalObjectSpecCxx& externalObject) {
  return externalObject;
}

ExternalObjectStruct HybridTestObjectCpp::bounceExternalStruct(const ExternalObjectStruct& externalStruct) {
  return externalStruct;
}

std::variant<adapters::NitroTestExternal::HybridSomeExternalObjectSpecCxx, std::string> HybridTestObjectCpp::bounceExternalVariant(
    const std::variant<adapters::NitroTestExternal::HybridSomeExternalObjectSpecCxx, std::string>& variant) {
  return variant;
}

adapters::NitroTestExternal::HybridSomeExternalObjectSpecCxx HybridTestObjectCpp::createExternalVariantFromFunc(
    const Callback<adapters::NitroTestExternal::HybridSomeExternalObjectSpecCxx()>& factory) {
  auto obj = factory.callSync();
  return obj;
}

adapters::NitroTestExternal::HybridSomeExternalObjectSpecCxx HybridTestObjectCpp::createInternalObject() {
  return _nativeFactory.createInternalObject();
}

void HybridTestObjectCpp::dispose() {
  if (this->_optionalCallback.has_value()) {
    this->_optionalCallback.value()(13.0);
  }
}

} // namespace margelo::nitro::test
