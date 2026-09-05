//
//  HybridTestObjectCpp.cpp
//  NitroTest
//
//  Created by Marc Rousavy on 30.07.24.
//

#include "HybridTestObjectCpp.hpp"
#include <NitroModules/AnyMap.hpp>
#include <NitroModules/NitroLogger.hpp>
#include <NitroModules/ThreadPool.hpp>
#include <chrono>
#include <sstream>
#include <thread>

#include "HybridBase.hpp"
#include "HybridChild.hpp"
#include "HybridSomeInternalObject.hpp"

namespace margelo::nitro::test {

size_t HybridTestObjectCpp::getExternalMemorySize() noexcept {
  return _string.size();
}

// Properties
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

NullType HybridTestObjectCpp::getNullValue() {
  return _null;
}

void HybridTestObjectCpp::setNullValue(NullType value) {
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

void HybridTestObjectCpp::setOptionalEnum(std::optional<Powertrain> optionalEnum) {
  _optionalEnum = optionalEnum;
}

std::optional<OldEnum> HybridTestObjectCpp::getOptionalOldEnum() {
  return _optionalOldEnum;
}

void HybridTestObjectCpp::setOptionalOldEnum(std::optional<OldEnum> optionalOldEnum) {
  _optionalOldEnum = optionalOldEnum;
}

std::optional<TruckPowertrain> HybridTestObjectCpp::getOptionalEnumPlusOne() {
  return _optionalEnumPlusOne;
}

void HybridTestObjectCpp::setOptionalEnumPlusOne(std::optional<TruckPowertrain> optionalEnumPlusOne) {
  _optionalEnumPlusOne = optionalEnumPlusOne;
}

std::optional<std::function<void(double)>> HybridTestObjectCpp::getOptionalCallback() {
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

void HybridTestObjectCpp::setOptionalCallback(const std::optional<std::function<void(double)>>& callback) {
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
  Logger::log(LogLevel::Info, TAG, "Arguments received! num: %f | str: %s | boo: %i", num, str.c_str(), boo);
}

NullType HybridTestObjectCpp::bounceNull(NullType value) {
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
                                              const std::function<void(const std::vector<Powertrain>& /* array */)>& callback) {
  callback(array);
}

std::vector<std::shared_ptr<HybridChildSpec>>
HybridTestObjectCpp::bounceHybridObjects(const std::vector<std::shared_ptr<HybridChildSpec>>& array) {
  return array;
}

std::vector<std::function<void()>> HybridTestObjectCpp::bounceFunctions(const std::vector<std::function<void()>>& functions) {
  return functions;
}

std::vector<std::shared_ptr<AnyMap>> HybridTestObjectCpp::bounceMaps(const std::vector<std::shared_ptr<AnyMap>>& maps) {
  return maps;
}

std::vector<std::shared_ptr<Promise<double>>>
HybridTestObjectCpp::bouncePromises(const std::vector<std::shared_ptr<Promise<double>>>& promises) {
  return promises;
}

std::vector<std::shared_ptr<ArrayBuffer>>
HybridTestObjectCpp::bounceArrayBuffers(const std::vector<std::shared_ptr<ArrayBuffer>>& arrayBuffers) {
  return arrayBuffers;
}

std::vector<std::optional<std::string>>
HybridTestObjectCpp::bounceOptionals(const std::vector<std::optional<std::string>>& strings,
                                     const std::vector<std::optional<std::shared_ptr<ArrayBuffer>>>& /* arrayBuffers */) {
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

std::shared_ptr<AnyMap> HybridTestObjectCpp::createMap() {
  auto map = AnyMap::make();
  map->setDouble("number", getNumberValue());
  map->setBoolean("bool", getBoolValue());
  map->setString("string", getStringValue());
  map->setInt64("int64", getInt64Value());
  map->setNull("null");
  std::vector<AnyValue> array{getNumberValue(), getBoolValue(), getStringValue(), getInt64Value()};
  map->setArray("array", array);
  std::vector<AnyValue> nestedArray{getNumberValue(), getBoolValue(), getStringValue(), getInt64Value(), array};
  map->setObject("object", {{"number", getNumberValue()},
                            {"bool", getBoolValue()},
                            {"string", getStringValue()},
                            {"int64", getInt64Value()},
                            {"null", nitro::null},
                            {"array", nestedArray}});
  return map;
}

std::shared_ptr<AnyMap> HybridTestObjectCpp::mapRoundtrip(const std::shared_ptr<AnyMap>& map) {
  return map;
}

std::vector<std::string> HybridTestObjectCpp::getMapKeys(const std::shared_ptr<AnyMap>& map) {
  return map->getAllKeys();
}

std::shared_ptr<AnyMap> HybridTestObjectCpp::mergeMaps(const std::shared_ptr<AnyMap>& a, const std::shared_ptr<AnyMap>& b) {
  a->merge(b);
  return a;
}

std::shared_ptr<AnyMap> HybridTestObjectCpp::copyAnyMap(const std::shared_ptr<AnyMap>& map) {
  auto keys = map->getAllKeys();
  auto newMap = AnyMap::make(keys.size());
  for (const auto& key : keys) {
    auto any = map->getAny(key);
    newMap->setAny(key, any);
  }
  return newMap;
}

double HybridTestObjectCpp::funcThatThrows() {
  throw std::runtime_error("This function will only work after sacrificing seven lambs!");
}

std::shared_ptr<Promise<void>> HybridTestObjectCpp::callCallbackThatReturnsPromiseVoid(
    const std::function<std::shared_ptr<Promise<std::shared_ptr<Promise<void>>>>()>& callback) {
  return Promise<void>::async([=]() {
    std::shared_ptr<Promise<std::shared_ptr<Promise<void>>>> callPromise = callback();
    std::future<std::shared_ptr<Promise<void>>> callFuture = callPromise->await();
    std::shared_ptr<Promise<void>> resultPromise = callFuture.get();
    std::future<void> future = resultPromise->await();
    future.wait();
  });
}

std::shared_ptr<Promise<void>> HybridTestObjectCpp::funcThatThrowsBeforePromise() {
  throw std::runtime_error("This function will only work after sacrificing eight lambs!");
}

void HybridTestObjectCpp::throwError(const std::exception_ptr& error) {
  std::rethrow_exception(error);
}

std::string HybridTestObjectCpp::tryOptionalParams(double /* num */, bool /* boo */, const std::optional<std::string>& str) {
  if (str.has_value()) {
    return str.value();
  } else {
    return "value omitted!";
  }
}

std::string HybridTestObjectCpp::tryMiddleParam(double /* num */, std::optional<bool> /* boo */, const std::string& str) {
  return str;
}

std::optional<Powertrain> HybridTestObjectCpp::tryOptionalEnum(std::optional<Powertrain> value) {
  return value;
}

bool HybridTestObjectCpp::tryTrailingOptional(double /* num */, const std::string& /* str */, std::optional<bool> boo) {
  return boo.has_value() ? boo.value() : false;
}

std::chrono::system_clock::time_point HybridTestObjectCpp::add1Hour(std::chrono::system_clock::time_point date) {
  return date + std::chrono::hours(1);
}
std::chrono::system_clock::time_point HybridTestObjectCpp::currentDate() {
  return std::chrono::system_clock::now();
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

std::variant<std::shared_ptr<HybridBaseSpec>, OptionalWrapper>
HybridTestObjectCpp::passAllEmptyObjectVariant(const std::variant<std::shared_ptr<HybridBaseSpec>, OptionalWrapper>& variant) {
  return variant;
}

ComplexVariant HybridTestObjectCpp::bounceComplexVariant(const ComplexVariant& variant) {
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

std::shared_ptr<Promise<int64_t>> HybridTestObjectCpp::calculateFibonacciAsync(double value) {
  return Promise<int64_t>::async([this, value]() -> int64_t { return this->calculateFibonacci(value); });
}

std::shared_ptr<Promise<void>> HybridTestObjectCpp::wait(double seconds) {
  return Promise<void>::async([=]() {
    std::chrono::nanoseconds nanoseconds(static_cast<int64_t>(seconds * 1'000'000'000));
    std::this_thread::sleep_for(nanoseconds);
  });
}

void HybridTestObjectCpp::callCallback(const std::function<void()>& callback) {
  callback();
}

std::function<void(double)> HybridTestObjectCpp::createNativeCallback(const std::function<void(double /* num */)>& wrappingJsCallback) {
  return [=](double num) { wrappingJsCallback(num); };
}

void HybridTestObjectCpp::callWithOptional(std::optional<double> value,
                                           const std::function<void(std::optional<double> /* maybe */)>& callback) {
  callback(value);
}

std::shared_ptr<Promise<double>> HybridTestObjectCpp::callSumUpNTimes(const std::function<std::shared_ptr<Promise<double>>()>& callback,
                                                                      double n) {
  return Promise<double>::async([=]() {
    double result = 0;
    for (size_t i = 0; i < n; i++) {
      std::future<double> future = callback()->await();
      double current = future.get();
      result += current;
    }
    return result;
  });
}

std::shared_ptr<Promise<double>>
HybridTestObjectCpp::callbackAsyncPromise(const std::function<std::shared_ptr<Promise<std::shared_ptr<Promise<double>>>>()>& callback) {
  return Promise<double>::async([=]() {
    std::future<std::shared_ptr<Promise<double>>> future = callback()->await();
    std::shared_ptr<Promise<double>> promise = future.get();
    std::future<double> innerFuture = promise->await();
    double innerResult = innerFuture.get();
    return innerResult;
  });
}

std::shared_ptr<Promise<std::shared_ptr<ArrayBuffer>>> HybridTestObjectCpp::callbackAsyncPromiseBuffer(
    const std::function<std::shared_ptr<Promise<std::shared_ptr<Promise<std::shared_ptr<ArrayBuffer>>>>>()>& callback) {
  return Promise<std::shared_ptr<ArrayBuffer>>::async([=]() {
    std::future<std::shared_ptr<Promise<std::shared_ptr<ArrayBuffer>>>> future = callback()->await();
    std::shared_ptr<Promise<std::shared_ptr<ArrayBuffer>>> promise = future.get();
    std::future<std::shared_ptr<ArrayBuffer>> innerFuture = promise->await();
    std::shared_ptr<ArrayBuffer> innerResult = innerFuture.get();
    return innerResult;
  });
}

std::function<void(double)> HybridTestObjectCpp::getComplexCallback() {
  return [](double value) { Logger::log(LogLevel::Info, TAG, "Callback called with %f", value); };
}

void HybridTestObjectCpp::twoOptionalCallbacks(double value, const std::optional<std::function<void(double /* value */)>>& first,
                                               const std::optional<std::function<void(const std::string& /* value */)>>& second) {
  if (first.has_value()) {
    first.value()(value);
  }
  if (second.has_value()) {
    second.value()("Hello!");
  }
}

void HybridTestObjectCpp::errorCallback(const std::function<void(const std::exception_ptr& /* error */)>& onError) {
  std::runtime_error error("Some Error!");
  onError(std::make_exception_ptr(error));
}

std::shared_ptr<Promise<double>>
HybridTestObjectCpp::getValueFromJSCallbackAndWait(const std::function<std::shared_ptr<Promise<double>>()>& getValue) {
  return Promise<double>::async([=]() -> double {
    std::shared_ptr<Promise<double>> promise = getValue();
    std::future<double> future = promise->await();
    future.wait();
    double value = future.get();
    return value;
  });
}

std::shared_ptr<Promise<double>> HybridTestObjectCpp::awaitAndGetPromise(const std::shared_ptr<Promise<double>>& promise) {
  auto newPromise = Promise<double>::create();
  promise->addOnResolvedListener([=](double result) { newPromise->resolve(result); });
  promise->addOnRejectedListener([=](const std::exception_ptr& error) { newPromise->reject(error); });
  return newPromise;
}

std::shared_ptr<Promise<Car>> HybridTestObjectCpp::awaitAndGetComplexPromise(const std::shared_ptr<Promise<Car>>& promise) {
  auto newPromise = Promise<Car>::create();
  promise->addOnResolvedListener([=](const Car& result) { newPromise->resolve(result); });
  promise->addOnRejectedListener([=](const std::exception_ptr& error) { newPromise->reject(error); });
  return newPromise;
}

std::shared_ptr<Promise<void>> HybridTestObjectCpp::awaitPromise(const std::shared_ptr<Promise<void>>& promise) {
  auto newPromise = Promise<void>::create();
  promise->addOnResolvedListener([=]() { newPromise->resolve(); });
  promise->addOnRejectedListener([=](const std::exception_ptr& error) { newPromise->reject(error); });
  return newPromise;
}

std::shared_ptr<Promise<void>> HybridTestObjectCpp::promiseThrows() {
  return Promise<void>::async([=]() { throw std::runtime_error("Promise throws :)"); });
}

std::shared_ptr<Promise<double>> HybridTestObjectCpp::promiseReturnsInstantly() {
  return Promise<double>::resolved(55);
}

std::shared_ptr<Promise<double>> HybridTestObjectCpp::promiseReturnsInstantlyAsync() {
  return Promise<double>::async([=]() { return 55; });
}

std::shared_ptr<Promise<double>> HybridTestObjectCpp::createPendingPromise() {
  if (_pendingPromise) {
    throw std::runtime_error("A pending Promise is already waiting for completion.");
  }
  _pendingPromise = Promise<double>::create();
  return _pendingPromise;
}

void HybridTestObjectCpp::resolvePendingPromiseOnWorker() {
  if (!_pendingPromise) {
    throw std::runtime_error("No pending Promise is waiting for completion.");
  }
  // Only JS calls access the slot; the worker owns the extracted Promise.
  auto promise = std::move(_pendingPromise);
  ThreadPool::shared().run([promise = std::move(promise)]() { promise->resolve(55); });
}

std::shared_ptr<Promise<void>> HybridTestObjectCpp::promiseThatResolvesVoidInstantly() {
  return Promise<void>::resolved();
}

std::shared_ptr<Promise<std::optional<double>>> HybridTestObjectCpp::promiseThatResolvesToUndefined() {
  return Promise<std::optional<double>>::resolved(std::nullopt);
}

std::shared_ptr<Promise<std::optional<double>>> HybridTestObjectCpp::awaitNullablePromise() {
  return Promise<std::optional<double>>::async([]() {
    auto promise = Promise<std::optional<double>>::resolved(std::nullopt);
    return promise->await().get();
  });
}

void HybridTestObjectCpp::callAll(const std::function<void()>& first, const std::function<void()>& second,
                                  const std::function<void()>& third) {
  first();
  second();
  third();
}

std::shared_ptr<Promise<void>>
HybridTestObjectCpp::getValueFromJsCallback(const std::function<std::shared_ptr<Promise<std::string>>()>& callback,
                                            const std::function<void(const std::string& /* valueFromJs */)>& andThenCall) {
  return Promise<void>::async([=]() {
    std::shared_ptr<Promise<std::string>> promise = callback();
    std::future<std::string> future = promise->await();
    std::string jsValue = future.get();
    andThenCall(jsValue);
  });
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

std::shared_ptr<ArrayBuffer> HybridTestObjectCpp::createArrayBufferFromNativeBuffer(bool /* copy */) {
  // Let's just use the move method here for native buffer to test this too.
  std::vector<uint8_t> data;
  data.resize(1024 * 1024 * 10); // 10 MB
  for (size_t i = 0; i < data.size(); i++) {
    data[i] = i % 255;
  }
  return ArrayBuffer::move(std::move(data));
}

std::shared_ptr<ArrayBuffer> HybridTestObjectCpp::createArrayBuffer() {
  size_t size = 1024 * 1024 * 10; // 10MB
  uint8_t* buffer = new uint8_t[size];
  return std::make_shared<NativeArrayBuffer>(buffer, size, [=]() { delete[] buffer; });
}

std::shared_ptr<ArrayBuffer> HybridTestObjectCpp::createHardwareBuffer(double width, double height, double layers,
                                                                       HardwareBufferFormat format) {
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

std::shared_ptr<ArrayBuffer> HybridTestObjectCpp::copyBuffer(const std::shared_ptr<ArrayBuffer>& buffer) {
  return ArrayBuffer::copy(buffer);
}

std::shared_ptr<ArrayBuffer> HybridTestObjectCpp::bounceArrayBuffer(const std::shared_ptr<ArrayBuffer>& buffer) {
  return buffer;
}

double HybridTestObjectCpp::getBufferLastItem(const std::shared_ptr<ArrayBuffer>& buffer) {
  size_t size = buffer->size();
  if (size == 0) {
    throw std::runtime_error("ArrayBuffer's size is 0!");
  }
  uint8_t* data = buffer->data();
  if (data == nullptr) {
    throw std::runtime_error("ArrayBuffer's data is null!");
  }
  uint8_t lastItem = data[size - 1];
  return static_cast<double>(lastItem);
}

void HybridTestObjectCpp::setAllValuesTo(const std::shared_ptr<ArrayBuffer>& buffer, double value) {
  size_t size = buffer->size();
  if (size == 0) {
    throw std::runtime_error("ArrayBuffer's size is 0!");
  }
  uint8_t* data = buffer->data();
  if (data == nullptr) {
    throw std::runtime_error("ArrayBuffer's data is null!");
  }

  for (size_t i = 0; i < size; i++) {
    data[i] = static_cast<uint8_t>(value);
  }
}

std::shared_ptr<Promise<std::shared_ptr<ArrayBuffer>>> HybridTestObjectCpp::createArrayBufferAsync() {
  return Promise<std::shared_ptr<ArrayBuffer>>::async([this]() -> std::shared_ptr<ArrayBuffer> { return this->createArrayBuffer(); });
}

std::shared_ptr<HybridTestObjectCppSpec> HybridTestObjectCpp::newTestObject() {
  return std::make_shared<HybridTestObjectCpp>();
}

std::shared_ptr<Promise<std::shared_ptr<HybridTestObjectCppSpec>>> HybridTestObjectCpp::newTestObjectAsync() {
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

std::shared_ptr<HybridBaseSpec> HybridTestObjectCpp::createBase() {
  return std::make_shared<HybridBase>();
}

std::shared_ptr<HybridChildSpec> HybridTestObjectCpp::createChild() {
  return std::make_shared<HybridChild>();
}

std::shared_ptr<HybridBaseSpec> HybridTestObjectCpp::createBaseActualChild() {
  return std::make_shared<HybridChild>();
}

std::shared_ptr<HybridChildSpec> HybridTestObjectCpp::bounceChild(const std::shared_ptr<HybridChildSpec>& child) {
  return child;
}

std::shared_ptr<HybridBaseSpec> HybridTestObjectCpp::bounceBase(const std::shared_ptr<HybridBaseSpec>& base) {
  return base;
}

std::shared_ptr<HybridBaseSpec> HybridTestObjectCpp::bounceChildBase(const std::shared_ptr<HybridChildSpec>& child) {
  return child;
}

std::shared_ptr<HybridChildSpec> HybridTestObjectCpp::castBase(const std::shared_ptr<HybridBaseSpec>& base) {
  auto child = std::dynamic_pointer_cast<HybridChildSpec>(base);
  if (child == nullptr) {
    throw std::runtime_error("Cannot cast Base to Child!");
  }
  return child;
}

bool HybridTestObjectCpp::getIsViewBlue(const std::shared_ptr<HybridTestViewSpec>& view) {
  return view->getIsBlue();
}

double HybridTestObjectCpp::callbackSync(const std::function<double()>& callback) {
  double value = callback();
  return value;
}

std::shared_ptr<margelo::nitro::test::external::HybridSomeExternalObjectSpec> HybridTestObjectCpp::bounceExternalHybrid(
    const std::shared_ptr<margelo::nitro::test::external::HybridSomeExternalObjectSpec>& externalObject) {
  return externalObject;
}

ExternalObjectStruct HybridTestObjectCpp::bounceExternalStruct(const ExternalObjectStruct& externalStruct) {
  return externalStruct;
}

StringOrExternal HybridTestObjectCpp::bounceExternalVariant(const StringOrExternal& variant) {
  return variant;
}

std::shared_ptr<margelo::nitro::test::external::HybridSomeExternalObjectSpec> HybridTestObjectCpp::createExternalVariantFromFunc(
    const std::function<std::shared_ptr<margelo::nitro::test::external::HybridSomeExternalObjectSpec>()>& factory) {
  auto obj = factory();
  return obj;
}

std::shared_ptr<margelo::nitro::test::external::HybridSomeExternalObjectSpec> HybridTestObjectCpp::createInternalObject() {
  return std::make_shared<HybridSomeInternalObject>();
}

void HybridTestObjectCpp::dispose() {
  if (this->_optionalCallback.has_value()) {
    this->_optionalCallback.value()(13.0);
  }
}

} // namespace margelo::nitro::test
