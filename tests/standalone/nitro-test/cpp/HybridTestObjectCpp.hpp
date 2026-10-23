//
//  HybridTestObjectCpp.hpp
//  NitroTest
//
//  Created by Marc Rousavy on 30.07.24.
//

#pragma once

#include <NitroTest/HybridPlatformObjectSpecCxx.hpp>
#include <NitroTest/HybridTestObjectCppSpec.hpp>
#include <atomic>
#include <jsi/jsi.h>

namespace margelo::nitro::test {

using namespace facebook;

using ComplexVariant = std::variant<ArrayBuffer, Callback<void(double /* value */)>, WrappedJsStruct, Promise<double>, AnyJSON>;

using StringOrExternal = std::variant<adapters::NitroTestExternal::HybridSomeExternalObjectSpecCxx, std::string>;

class HybridTestObjectCpp : public HybridTestObjectCppSpec {
public:
  struct Class {
    using Base = HybridTestObjectCppSpec::Class;
    static constexpr const char* name = "TestObjectCpp";
    static const std::shared_ptr<const HybridClass>& get();
  };

  explicit HybridTestObjectCpp(const std::optional<HybridPlatformObjectSpecCxx>& nativeFactory = std::nullopt);

  static double getReadonlyNumber();
  static double getSharedNumber();
  static void setSharedNumber(double value);

  static double staticAdd(double a, double b);
  static bool staticNegate(bool value);
  static std::string staticConcat(const std::string& a, const std::string& b);
  static StaticPoint staticBouncePoint(const StaticPoint& point);
  static void staticThrow(const std::string& message);

protected:
  size_t getExternalMemorySize() noexcept override;

private:
  HybridPlatformObjectSpecCxx _nativeFactory;
  static inline std::atomic<double> _sharedNumber{0.0};
  double _computedValueStorage = 0.0;
  double _number = 0.0;
  bool _bool = false;
  std::string _string;
  int64_t _int64Value = 0;
  uint64_t _uint64Value = 0;
  NullType _null = nitro::null;
  std::optional<std::string> _optionalString;
  std::variant<nitro::NullType, std::string> _nullableString;
  std::variant<double, std::string> _variant;
  std::tuple<double, std::string> _tuple;
  std::optional<std::vector<std::string>> _optionalArray;
  std::optional<std::shared_ptr<HybridTestObjectCppSpec>> _optionalHybrid;
  std::optional<HybridBaseSpecCxx> _retainedBase;
  std::optional<Powertrain> _optionalEnum;
  std::optional<OldEnum> _optionalOldEnum;
  std::optional<TruckPowertrain> _optionalEnumPlusOne;
  std::optional<Callback<void(double)>> _optionalCallback;
  bool _hasBooleanWritable = false;
  bool _isBooleanWritable = false;
  std::optional<Promise<double>> _pendingPromise;
  std::optional<Promise<AnyJSON>> _pendingJSON;
  bool _isolatedBoolean = false;
  std::string _isTextValue;

private:
  static inline uint64_t calculateFibonacci(int count) noexcept {
    if (count <= 0) [[unlikely]]
      return 0;
    if (count == 1) [[unlikely]]
      return 1;

    return calculateFibonacci(count - 1) + calculateFibonacci(count - 2);
  }

public:
  // Properties and methods
  double getComputedValue() override;
  void setComputedValue(double value) override;
  double getNumberValue() override;
  void setNumberValue(double numberValue) override;
  bool getBoolValue() override;
  void setBoolValue(bool boolValue) override;
  std::string getStringValue() override;
  void setStringValue(const std::string& stringValue) override;
  int64_t getInt64Value() override;
  void setInt64Value(int64_t int64Value) override;
  uint64_t getUint64Value() override;
  void setUint64Value(uint64_t uint64Value) override;
  nitro::NullType getNullValue() override;
  void setNullValue(nitro::NullType nullValue) override;
  std::optional<std::string> getOptionalString() override;
  void setOptionalString(const std::optional<std::string>& optionalString) override;
  std::optional<std::string> getStringOrUndefined() override;
  void setStringOrUndefined(const std::optional<std::string>& stringOrUndefined) override;
  std::variant<nitro::NullType, std::string> getStringOrNull() override;
  void setStringOrNull(const std::variant<nitro::NullType, std::string>& stringOrNull) override;
  std::optional<std::vector<std::string>> getOptionalArray() override;
  void setOptionalArray(const std::optional<std::vector<std::string>>& optionalArray) override;
  std::variant<double, std::string> getSomeVariant() override;
  void setSomeVariant(const std::variant<double, std::string>& someVariant) override;
  std::variant<std::string, Car> passNamedVariant(const std::variant<std::string, Car>& variant) override;
  std::variant<HybridBaseSpecCxx, OptionalWrapper>
  passAllEmptyObjectVariant(const std::variant<HybridBaseSpecCxx, OptionalWrapper>& variant) override;
  std::variant<ArrayBuffer, Callback<void(double /* value */)>, WrappedJsStruct, Promise<double>, AnyJSON> bounceComplexVariant(
      const std::variant<ArrayBuffer, Callback<void(double /* value */)>, WrappedJsStruct, Promise<double>, AnyJSON>& variant) override;
  std::tuple<double, std::string> getSomeTuple() override;
  void setSomeTuple(const std::tuple<double, std::string>& someTuple) override;
  std::shared_ptr<HybridTestObjectCppSpec> getThisObject() override;
  std::optional<std::shared_ptr<HybridTestObjectCppSpec>> getOptionalHybrid() override;
  void setOptionalHybrid(const std::optional<std::shared_ptr<HybridTestObjectCppSpec>>& optionalHybrid) override;
  std::optional<Powertrain> getOptionalEnum() override;
  void setOptionalEnum(const std::optional<Powertrain>& optionalEnum) override;
  std::optional<OldEnum> getOptionalOldEnum() override;
  void setOptionalOldEnum(const std::optional<OldEnum>& optionalOldEnum) override;
  std::optional<TruckPowertrain> getOptionalEnumPlusOne() override;
  void setOptionalEnumPlusOne(const std::optional<TruckPowertrain>& optionalEnumPlusOne) override;
  std::optional<Callback<void(double /* value */)>> getOptionalCallback() override;
  void setOptionalCallback(const std::optional<Callback<void(double /* value */)>>& optionalCallback) override;
  bool getHasBoolean() override;
  bool getIsBoolean() override;
  bool getIsBooleanWritable() override;
  void setIsBooleanWritable(bool isBooleanWritable) override;
  bool getHasBooleanWritable() override;
  void setHasBooleanWritable(bool hasBooleanWritable) override;
  bool getIsolatedBoolean() override;
  void setIsolatedBoolean(bool isolatedBoolean) override;
  std::string getIsTextValue() override;
  void setIsTextValue(const std::string& isTextValue) override;
  double addNumbers(double a, double b) override;
  std::string addStrings(const std::string& a, const std::string& b) override;
  void simpleFunc() override;
  std::shared_ptr<HybridObject> bounceAnyHybrid(const std::shared_ptr<HybridObject>& object) override;
  CustomString bounceCustomType(CustomString value) override;
  void multipleArguments(double num, const std::string& str, bool boo) override;
  nitro::NullType bounceNull(nitro::NullType value) override;
  AnyJSON createMap() override;
  AnyJSON mapRoundtrip(const AnyJSON& map) override;
  std::vector<std::string> getMapKeys(const AnyJSON& map) override;
  AnyJSON mergeMaps(const AnyJSON& a, const AnyJSON& b) override;
  AnyJSON copyAnyMap(const AnyJSON& map) override;
  AnyJSON createJSON(const std::string& json) override;
  Promise<AnyJSON> createJSONAsync(const std::string& json) override;
  Promise<AnyJSON> createResolvedJSON(const std::string& json) override;
  Promise<AnyJSON> createPendingJSON() override;
  void resolvePendingJSONOnWorker(const std::string& json) override;
  double funcThatThrows() override;
  Promise<void> funcThatThrowsBeforePromise() override;
  void throwError(const std::exception_ptr& error) override;
  std::string tryOptionalParams(double num, bool boo, const std::optional<std::string>& str) override;
  std::string tryMiddleParam(double num, const std::optional<bool>& boo, const std::string& str) override;
  std::optional<Powertrain> tryOptionalEnum(const std::optional<Powertrain>& value) override;
  bool tryTrailingOptional(double num, const std::string& str, const std::optional<bool>& boo) override;
  std::variant<double, std::string>
  passVariant(const std::variant<bool, std::vector<double>, std::vector<std::string>, double, std::string>& either) override;
  std::vector<std::string> bounceStrings(const std::vector<std::string>& array) override;
  std::vector<double> bounceNumbers(const std::vector<double>& array) override;
  std::vector<Person> bounceStructs(const std::vector<Person>& array) override;
  std::vector<std::vector<Person>> bounceNestedArray(const std::vector<std::vector<Person>>& array) override;
  PartialPerson bouncePartialStruct(const PartialPerson& person) override;
  std::string sumUpAllPassengers(const std::vector<Car>& cars) override;
  std::vector<Powertrain> bounceEnums(const std::vector<Powertrain>& array) override;
  void complexEnumCallback(const std::vector<Powertrain>& array,
                           const Callback<void(const std::vector<Powertrain>& /* array */)>& callback) override;
  std::vector<Powertrain> callEnumArrayCallback(const std::vector<Powertrain>& array,
                                                const Callback<std::vector<Powertrain>(const std::vector<Powertrain>&)>& callback) override;
  Callback<std::vector<Powertrain>(const std::vector<Powertrain>&)> getEnumArrayCallback() override;
  Promise<std::vector<Powertrain>> callEnumArrayPromiseCallback(const Callback<Promise<std::vector<Powertrain>>()>& callback) override;
  Promise<std::vector<Powertrain>> awaitEnumArrayPromise(const Promise<std::vector<Powertrain>>& promise) override;
  std::vector<std::vector<std::optional<Person>>> callNestedStructCallback(
      const std::vector<std::vector<std::optional<Person>>>& value,
      const Callback<std::vector<std::vector<std::optional<Person>>>(const std::vector<std::vector<std::optional<Person>>>&)>& callback)
      override;
  std::vector<uint64_t> bounceUnsignedArray(const std::vector<uint64_t>& array) override;
  std::vector<std::vector<uint64_t>> bounceNestedUnsignedArray(const std::vector<std::vector<uint64_t>>& array) override;
  std::optional<std::vector<uint64_t>> bounceOptionalUnsignedArray(const std::optional<std::vector<uint64_t>>& array) override;
  Promise<std::vector<uint64_t>> bounceUnsignedArrayAsync(const std::vector<uint64_t>& array) override;
  std::vector<uint64_t> callUnsignedArrayCallback(const std::vector<uint64_t>& array,
                                                  const Callback<std::vector<uint64_t>(const std::vector<uint64_t>&)>& callback) override;

  std::vector<HybridChildSpecCxx> bounceHybridObjects(const std::vector<HybridChildSpecCxx>& array) override;
  std::vector<Callback<void()>> bounceFunctions(const std::vector<Callback<void()>>& functions) override;
  std::vector<AnyJSON> bounceMaps(const std::vector<AnyJSON>& maps) override;
  std::unordered_map<std::string, double> bounceSimpleMap(const std::unordered_map<std::string, double>& map) override;
  std::unordered_map<std::string, std::optional<std::string>>
  bounceOptionalMap(const std::unordered_map<std::string, std::optional<std::string>>& map) override;
  std::unordered_map<std::string, std::variant<nitro::NullType, std::string>>
  bounceNullMap(const std::unordered_map<std::string, std::variant<nitro::NullType, std::string>>& map) override;
  std::unordered_map<std::string, std::optional<std::variant<nitro::NullType, std::string>>>
  bounceOptionalNullMap(const std::unordered_map<std::string, std::optional<std::variant<nitro::NullType, std::string>>>& map) override;
  std::vector<Promise<double>> bouncePromises(const std::vector<Promise<double>>& promises) override;
  std::vector<ArrayBuffer> bounceArrayBuffers(const std::vector<ArrayBuffer>& arrayBuffers) override;
  std::vector<std::optional<std::string>> bounceOptionals(const std::vector<std::optional<std::string>>& strings,
                                                          const std::vector<std::optional<ArrayBuffer>>& arrayBuffers) override;
  std::vector<std::variant<nitro::NullType, std::string>>
  bounceNulls(const std::vector<std::variant<nitro::NullType, std::string>>& strings) override;
  std::vector<std::optional<std::variant<nitro::NullType, std::string>>>
  bounceOptionalNulls(const std::vector<std::optional<std::variant<nitro::NullType, std::string>>>& strings) override;
  std::variant<OldEnum, bool> getVariantEnum(const std::variant<OldEnum, bool>& variant) override;
  std::variant<Powertrain, Car> bounceVariantUnionEnum(const std::variant<Powertrain, Car>& variant) override;
  std::variant<WeirdNumbersEnum, bool> getVariantWeirdNumbersEnum(const std::variant<WeirdNumbersEnum, bool>& variant) override;
  std::variant<Person, Car> getVariantObjects(const std::variant<Person, Car>& variant) override;
  std::variant<std::shared_ptr<HybridTestObjectCppSpec>, Person>
  getVariantHybrid(const std::variant<std::shared_ptr<HybridTestObjectCppSpec>, Person>& variant) override;
  std::variant<std::shared_ptr<HybridTestObjectCppSpec>, Powertrain>
  getVariantHybridEnum(const std::variant<std::shared_ptr<HybridTestObjectCppSpec>, Powertrain>& variant) override;
  std::variant<std::tuple<double, double>, std::tuple<double, double, double>>
  getVariantTuple(const std::variant<std::tuple<double, double>, std::tuple<double, double, double>>& variant) override;
  std::tuple<double, double, double> flip(const std::tuple<double, double, double>& tuple) override;
  std::tuple<double, std::string, bool> passTuple(const std::tuple<double, std::string, bool>& tuple) override;
  std::unordered_map<std::string, std::variant<bool, double>>
  bounceMap(const std::unordered_map<std::string, std::variant<bool, double>>& map) override;
  std::unordered_map<std::string, std::string> extractMap(const MapWrapper& mapWrapper) override;
  int64_t calculateFibonacciSync(double value) override;
  Promise<int64_t> calculateFibonacciAsync(double value) override;
  Promise<void> wait(double seconds) override;
  void callCallback(const Callback<void()>& callback) override;
  void callInlineCallback(const InlineCallback<void()>& callback) override;
  double callInlineCallbackWithValue(double value, const InlineCallback<double(double)>& callback) override;
  Promise<void> callCallbackThatReturnsPromiseVoid(const Callback<Promise<void>()>& callback) override;
  Callback<void(double /* num */)> createNativeCallback(const Callback<void(double /* num */)>& wrappingJsCallback) override;
  void callWithOptional(const std::optional<double>& value,
                        const Callback<void(const std::optional<double>& /* maybe */)>& callback) override;
  Promise<double> getValueFromJSCallbackAndWait(const Callback<double()>& getValue) override;
  void callAll(const Callback<void()>& first, const Callback<void()>& second, const Callback<void()>& third) override;
  Promise<double> callSumUpNTimes(const Callback<double()>& callback, double n) override;
  Promise<double> callbackAsyncPromise(const Callback<Promise<double>()>& callback) override;
  Promise<ArrayBuffer> callbackAsyncPromiseBuffer(const Callback<Promise<ArrayBuffer>()>& callback) override;
  Callback<void(double /* value */)> getComplexCallback() override;
  void twoOptionalCallbacks(double value, const std::optional<Callback<void(double /* value */)>>& first,
                            const std::optional<Callback<void(const std::string& /* value */)>>& second) override;
  void errorCallback(const Callback<void(const std::exception_ptr& /* error */)>& onError) override;
  Promise<void> getValueFromJsCallback(const Callback<std::string()>& callback,
                                       const Callback<void(const std::string& /* valueFromJs */)>& andThenCall) override;
  void callSyncCallback(double value, const Callback<void(double /* value */)>& callback) override;
  Promise<double> callAsyncCallback(double value, const Callback<double(double /* value */)>& callback) override;
  Promise<void> callAsyncVoidCallback(const Callback<void()>& callback) override;
  Promise<bool> callAsyncBooleanCallback(bool value, const Callback<bool(bool /* value */)>& callback) override;
  Promise<double> awaitAsyncCallback(double value, const Callback<double(double /* value */)>& callback) override;
  void callAndForgetCallback(double value, const Callback<double(double /* value */)>& callback) override;
  Promise<double> callNativeCallbackAsync(double value) override;
  Promise<void> callThrowingNativeCallbackAsync(const std::string& message) override;
  void callThrowingNativeCallbackAndForget(const std::string& message) override;
  Promise<double> callInlineCallbackThenEscape(double value, const InlineCallback<double(double /* value */)>& callback) override;
  Callback<void(double /* value */)>
  getSharedNumberCallback(const std::shared_ptr<external::HybridSharedSpecializationsCppSpec>& shared) override;
  Promise<double> awaitAndGetPromise(const Promise<double>& promise) override;
  Promise<Car> awaitAndGetComplexPromise(const Promise<Car>& promise) override;
  Promise<void> awaitPromise(const Promise<void>& promise) override;
  Promise<void> promiseThrows() override;
  Promise<double> promiseReturnsInstantly() override;
  Promise<double> promiseReturnsInstantlyAsync() override;
  Promise<double> createPendingPromise() override;
  void resolvePendingPromiseOnWorker() override;
  Promise<void> promiseThatResolvesVoidInstantly() override;
  Promise<std::optional<double>> promiseThatResolvesToUndefined() override;
  Promise<std::optional<double>> awaitNullablePromise() override;
  Car getCar() override;
  bool isCarElectric(const Car& car) override;
  bool areCarsEqual(const Car& a, const Car& b) override;
  std::optional<Person> getDriver(const Car& car) override;
  Car bounceCar(const Car& car) override;
  void jsStyleObjectAsParameters(const JsStyleStruct& params) override;
  UnsignedScalar roundtripUnsignedScalar(const UnsignedScalar& value) override;
  UnsignedValues roundtripUnsignedValues(const UnsignedValues& value) override;
  WrappedJsStruct bounceWrappedJsStyleStruct(const WrappedJsStruct& value) override;
  OptionalWrapper bounceOptionalWrapper(const OptionalWrapper& wrapper) override;
  OptionalCallback bounceOptionalCallback(const OptionalCallback& value) override;
  std::optional<OptionalEnumWrapper> bounceOptionalEnumStruct(const std::optional<OptionalEnumWrapper>& value) override;
  ArrayBuffer createArrayBufferFromNativeBuffer(bool copy) override;
  ArrayBuffer createArrayBuffer() override;
  ArrayBuffer copyBuffer(const ArrayBuffer& buffer) override;
  ArrayBuffer bounceArrayBuffer(const ArrayBuffer& buffer) override;
  double getBufferLastItem(const ArrayBuffer& buffer) override;
  void setAllValuesTo(const ArrayBuffer& buffer, double value) override;
  Promise<ArrayBuffer> createArrayBufferAsync() override;
  ArrayBuffer createHardwareBuffer(double width, double height, double layers, HardwareBufferFormat format) override;
  std::shared_ptr<HybridTestObjectCppSpec> newTestObject() override;
  Promise<std::shared_ptr<HybridTestObjectCppSpec>> newTestObjectAsync() override;
  HybridBaseSpecCxx createBase() override;
  HybridChildSpecCxx createChild() override;
  HybridBaseSpecCxx createBaseActualChild() override;
  HybridGrandchildSpecCxx createGrandchild() override;
  HybridChildSpecCxx createChildActualGrandchild() override;
  HybridBaseSpecCxx createBaseActualGrandchild() override;
  HybridGrandchildSpecCxx bounceGrandchild(const HybridGrandchildSpecCxx& grandchild) override;
  HybridChildSpecCxx bounceChild(const HybridChildSpecCxx& child) override;
  HybridBaseSpecCxx bounceBase(const HybridBaseSpecCxx& base) override;
  HybridBaseSpecCxx bounceChildBase(const HybridChildSpecCxx& child) override;
  HybridChildSpecCxx castBase(const HybridBaseSpecCxx& base) override;
  std::optional<HybridBaseSpecCxx> getRetainedBase() override;
  void setRetainedBase(const std::optional<HybridBaseSpecCxx>& base) override;
  double readBaseValue(const HybridBaseSpecCxx& base) override;
  double readChildBaseValue(const HybridChildSpecCxx& child) override;
  Size bounceSizeThroughBase(const HybridBaseSpecCxx& base, const Size& size) override;
  Promise<Size> mapSizeThroughBase(const HybridBaseSpecCxx& base, const Size& size, const Callback<Size(const Size&)>& callback) override;
  std::variant<std::string, Car> bounceVariantThroughChild(const HybridChildSpecCxx& child,
                                                           const std::variant<std::string, Car>& variant) override;
  std::string readExternalValue(const adapters::NitroTestExternal::HybridSomeExternalObjectSpecCxx& externalObject) override;
  void callExternalNumberCallback(const adapters::NitroTestExternal::HybridSomeExternalObjectSpecCxx& externalObject,
                                  double value) override;
  OptionalPrimitivesHolder
  createExternalOptionalPrimitives(const adapters::NitroTestExternal::HybridSomeExternalObjectSpecCxx& externalObject,
                                   const std::optional<double>& optionalNumber, const std::optional<bool>& optionalBoolean,
                                   const std::optional<uint64_t>& optionalUInt64, const std::optional<int64_t>& optionalInt64) override;
  HybridBaseSpecCxx createAlternativeBase() override;
  std::shared_ptr<HybridCppBaseSpec> createCppBase() override;
  std::shared_ptr<HybridCppChildSpec> createCppChild() override;
  std::shared_ptr<HybridCppGrandchildSpec> createCppGrandchild() override;
  std::shared_ptr<HybridCppBaseSpec> createCppBaseActualChild() override;
  std::shared_ptr<HybridCppBaseSpec> bounceCppBase(const std::shared_ptr<HybridCppBaseSpec>& base) override;
  std::shared_ptr<HybridCppChildSpec> castCppBase(const std::shared_ptr<HybridCppBaseSpec>& base) override;
  double callbackSync(const Callback<double()>& callback) override;
  Callback<double()> getSyncNumberCallback() override;
  Callback<int64_t(int64_t /* value */)> bounceSyncInt64Callback(const Callback<int64_t(int64_t /* value */)>& callback) override;
  adapters::NitroTestExternal::HybridSomeExternalObjectSpecCxx
  bounceExternalHybrid(const adapters::NitroTestExternal::HybridSomeExternalObjectSpecCxx& externalObject) override;
  adapters::NitroTestExternal::HybridSomeExternalObjectSpecCxx createInternalObject() override;
  ExternalObjectStruct bounceExternalStruct(const ExternalObjectStruct& externalStruct) override;
  std::variant<adapters::NitroTestExternal::HybridSomeExternalObjectSpecCxx, std::string>
  bounceExternalVariant(const std::variant<adapters::NitroTestExternal::HybridSomeExternalObjectSpecCxx, std::string>& variant) override;
  adapters::NitroTestExternal::HybridSomeExternalObjectSpecCxx
  createExternalVariantFromFunc(const Callback<adapters::NitroTestExternal::HybridSomeExternalObjectSpecCxx()>& factory) override;

  jsi::Value rawJsiFunc(jsi::Runtime& runtime, const jsi::Value& thisValue, const jsi::Value* args, size_t count);
  void dispose() override;

protected:
  const std::shared_ptr<const HybridClass>& getHybridClass() override {
    return Class::get();
  }
};

} // namespace margelo::nitro::test
