//
//  HybridTestObjectSwift.swift
//  NitroTest
//
//  Created by Marc Rousavy on 11.08.24.
//

import Dispatch
import NitroModules
import NitroTestExternal

class HybridTestObjectSwift: HybridTestObjectSwiftKotlinSpec {
  private var pendingPromise: Promise<Double>?

  var optionalArray: [String]? = []

  var someVariant: Variant_Double_String = .first(55)

  var numberValue: Double = 0.0

  var boolValue: Bool = false

  var stringValue: String = ""

  var memorySize: Int {
    return stringValue.utf8.count
  }

  var int64Value: Int64 = 0

  var uint64Value: UInt64 = 0

  var nullValue: NullType = .null

  var optionalString: String? = nil

  var stringOrUndefined: String? = nil

  var stringOrNull: Variant_NullType_String = .first(.null)

  var optionalHybrid: (any HybridTestObjectSwiftKotlinSpec)? = nil

  var optionalEnum: Powertrain? = nil

  var optionalOldEnum: OldEnum? = nil

  var optionalEnumPlusOne: TruckPowertrain? = nil

  var optionalCallback: ((Double) -> Void)? = nil

  let hasBoolean = false
  let isBoolean = false
  var hasBooleanWritable = false
  var isBooleanWritable = false

  var thisObject: any HybridTestObjectSwiftKotlinSpec {
    return self
  }

  func simpleFunc() throws {
    // do nothing
  }

  func addNumbers(a: Double, b: Double) throws -> Double {
    return a + b
  }

  func addStrings(a: String, b: String) throws -> String {
    return a + b
  }

  func multipleArguments(num: Double, str: String, boo: Bool) throws {
    print("Arguments received! num: \(num) | str: \(str) | boo: \(boo)")
  }

  func bounceNull(value: NullType) -> NullType {
    return value
  }

  func callCallback(callback: @escaping (() -> Void)) throws {
    callback()
  }

  func callCallbackThatReturnsPromiseVoid(callback: @escaping () -> Promise<Promise<Void>>) throws
    -> Promise<Void>
  {
    return Promise.async {
      let callPromise = callback()
      let resultPromise = try await callPromise.await()
      try await resultPromise.await()
    }
  }

  func createNativeCallback(wrappingJsCallback: @escaping (_ num: Double) -> Void) throws -> (
    _ num: Double
  ) -> Void {
    return { num in
      wrappingJsCallback(num)
    }
  }

  func callWithOptional(value: Double?, callback: @escaping ((_ maybe: Double?) -> Void)) throws {
    callback(value)
  }

  func getValueFromJSCallbackAndWait(getValue: @escaping (() -> Promise<Double>)) throws -> Promise<
    Double
  > {
    return .async {
      let jsResult = try await getValue().await()
      return jsResult
    }
  }

  func getValueFromJsCallback(
    callback: @escaping (() -> Promise<String>),
    andThenCall: @escaping ((_ valueFromJs: String) -> Void)
  ) throws -> Promise<Void> {
    return .async {
      let jsResult = try await callback().await()
      andThenCall(jsResult)
    }
  }

  func callSumUpNTimes(callback: @escaping (() -> Promise<Double>), n: Double) throws -> Promise<
    Double
  > {
    var result = 0.0
    return Promise.async {
      for _ in 1...Int(n) {
        let current = try await callback().await()
        result += current
      }
      return result
    }
  }

  func callbackAsyncPromise(callback: @escaping (() -> Promise<Promise<Double>>)) throws -> Promise<
    Double
  > {
    return Promise.async {
      let promise = try await callback().await()
      let result = try await promise.await()
      return result
    }
  }

  func callbackAsyncPromiseBuffer(callback: @escaping (() -> Promise<Promise<ArrayBuffer>>)) throws
    -> Promise<ArrayBuffer>
  {
    return Promise.async {
      let promise = try await callback().await()
      let result = try await promise.await()
      return result
    }
  }

  func getComplexCallback() throws -> (Double) -> Void {
    return { value in print("Callback called with \(value).") }
  }

  func twoOptionalCallbacks(
    value: Double, first: ((_ value: Double) -> Void)?, second: ((_ value: String) -> Void)?
  ) throws {
    if let first {
      first(value)
    }
    if let second {
      second("Hello")
    }
  }

  func errorCallback(onError: @escaping (_ error: Error) -> Void) throws {
    let error = RuntimeError.error(withMessage: "Some Error!")
    onError(error)
  }

  func bounceStrings(array: [String]) throws -> [String] {
    return array
  }

  func bounceNumbers(array: [Double]) throws -> [Double] {
    return array
  }

  func bounceStructs(array: [Person]) throws -> [Person] {
    return array
  }

  func bounceNestedArray(array: [[Person]]) throws -> [[Person]] {
    return array
  }

  func bouncePartialStruct(person: PartialPerson) throws -> PartialPerson {
    return person
  }

  func sumUpAllPassengers(cars: [Car]) throws -> String {
    let passengers = cars.flatMap { car in car.passengers }
    let stringified = passengers.map { passenger in
      let ageString = stringify(passenger.age)
      return "\(passenger.name) (\(ageString))"
    }
    return stringified.joined(separator: ", ")
  }

  func bounceEnums(array: [Powertrain]) throws -> [Powertrain] {
    return array
  }

  func complexEnumCallback(
    array: [Powertrain], callback: @escaping ((_ array: [Powertrain]) -> Void)
  ) throws {
    callback(array)
  }

  func bounceHybridObjects(array: [any HybridChildSpec]) -> [any HybridChildSpec] {
    return array
  }

  func bounceFunctions(functions: [() -> Void]) throws -> [() -> Void] {
    return functions
  }

  func bounceMaps(maps: [AnyMap]) throws -> [AnyMap] {
    return maps
  }

  func bouncePromises(promises: [Promise<Double>]) throws -> [Promise<Double>] {
    return promises
  }

  func bounceArrayBuffers(arrayBuffers: [ArrayBuffer]) throws -> [ArrayBuffer] {
    return arrayBuffers
  }

  func bounceOptionals(strings: [String?], arrayBuffers: [ArrayBuffer?]) throws -> [String?] {
    return strings
  }

  func bounceNulls(strings: [Variant_NullType_String]) throws -> [Variant_NullType_String] {
    return strings
  }

  func bounceOptionalNulls(strings: [Variant_NullType_String?]) throws
    -> [Variant_NullType_String?]
  {
    return strings
  }

  func createMap() throws -> AnyMap {
    let map = AnyMap()
    map.setDouble(key: "number", value: numberValue)
    map.setBoolean(key: "bool", value: boolValue)
    map.setString(key: "string", value: stringValue)
    map.setInt64(key: "int64", value: int64Value)
    map.setNull(key: "null")
    let array: [AnyValue] = [
      .number(numberValue), .bool(boolValue), .string(stringValue), .int64(int64Value),
    ]
    map.setArray(key: "array", value: array)
    map.setObject(
      key: "object",
      value: [
        "number": .number(numberValue),
        "bool": .bool(boolValue),
        "string": .string(stringValue),
        "int64": .int64(int64Value),
        "null": .null,
        "array": .array([
          .number(numberValue), .bool(boolValue), .string(stringValue), .int64(int64Value),
          .array(array),
        ]),
      ])
    return map
  }

  func mapRoundtrip(map: AnyMap) throws -> AnyMap {
    return map
  }

  func getMapKeys(map: AnyMap) throws -> [String] {
    return map.getAllKeys()
  }

  func mergeMaps(a: AnyMap, b: AnyMap) throws -> AnyMap {
    a.merge(other: b)
    return a
  }

  func copyAnyMap(map: AnyMap) throws -> AnyMap {
    let dictionary = map.toDictionary()
    return try AnyMap.fromDictionary(dictionary)
  }

  func newTestObject() throws -> any HybridTestObjectSwiftKotlinSpec {
    return HybridTestObjectSwift()
  }

  func newTestObjectAsync() throws -> Promise<any HybridTestObjectSwiftKotlinSpec> {
    return Promise.parallel { HybridTestObjectSwift() }
  }

  func funcThatThrows() throws -> Double {
    throw RuntimeError.error(
      withMessage: "This function will only work after sacrificing seven lambs!")
  }

  func funcThatThrowsBeforePromise() throws -> Promise<Void> {
    throw RuntimeError.error(
      withMessage: "This function will only work after sacrificing eight lambs!")
  }

  func throwError(error: Error) throws {
    throw error
  }

  func tryOptionalParams(num: Double, boo: Bool, str: String?) throws -> String {
    if let str {
      return str
    } else {
      return "value omitted!"
    }
  }

  func tryMiddleParam(num: Double, boo: Bool?, str: String) throws -> String {
    return str
  }

  func tryOptionalEnum(value: Powertrain?) throws -> Powertrain? {
    return value
  }

  func tryTrailingOptional(num: Double, str: String, boo: Bool?) throws -> Bool {
    return boo ?? false
  }

  func add1Hour(date: Date) throws -> Date {
    let oneHourInSeconds = 1.0 * 60 * 60
    return date + oneHourInSeconds
  }
  func currentDate() throws -> Date {
    return .now
  }

  func bounceMap(map: [String: Variant_Bool_Double]) throws -> [String: Variant_Bool_Double] {
    return map
  }

  func bounceSimpleMap(map: [String: Double]) throws -> [String: Double] {
    return map
  }

  func bounceOptionalMap(map: [String: String?]) throws -> [String: String?] {
    return map
  }

  func bounceNullMap(map: [String: Variant_NullType_String]) throws -> [String:
    Variant_NullType_String]
  {
    return map
  }

  func bounceOptionalNullMap(map: [String: Variant_NullType_String?]) throws -> [String:
    Variant_NullType_String?]
  {
    return map
  }

  func extractMap(mapWrapper: MapWrapper) throws -> [String: String] {
    return mapWrapper.map
  }

  func getVariantHybrid(variant: Variant__any_HybridTestObjectSwiftKotlinSpec__Person) throws
    -> Variant__any_HybridTestObjectSwiftKotlinSpec__Person
  {
    return variant
  }

  func passVariant(either: Variant_Bool__Double___String__Double_String) throws
    -> Variant_Double_String
  {
    switch either {
    case .fourth(let double):
      return .first(double)
    case .fifth(let string):
      return .second(string)
    default:
      return .second("holds something else!")
    }
  }

  func passAllEmptyObjectVariant(variant: Variant__any_HybridBaseSpec__OptionalWrapper) throws
    -> Variant__any_HybridBaseSpec__OptionalWrapper
  {
    return variant
  }

  func bounceComplexVariant(variant: CoreTypesVariant) throws -> CoreTypesVariant {
    return variant
  }

  func getVariantEnum(variant: Variant_OldEnum_Bool) throws -> Variant_OldEnum_Bool {
    return variant
  }

  func bounceVariantUnionEnum(variant: Variant_Powertrain_Car) throws -> Variant_Powertrain_Car {
    return variant
  }

  func getVariantWeirdNumbersEnum(variant: Variant_WeirdNumbersEnum_Bool) throws
    -> Variant_WeirdNumbersEnum_Bool
  {
    return variant
  }

  func getVariantObjects(variant: Variant_Person_Car) throws -> Variant_Person_Car {
    return variant
  }

  func passNamedVariant(variant: NamedVariant) throws -> NamedVariant {
    return variant
  }

  func calculateFibonacciSync(value: Double) throws -> Int64 {
    let n = Int64(value)
    if n <= 1 {
      return n
    }

    var a = Int64(0)
    var b = Int64(1)
    for _ in 2...n {
      let temp = a + b
      a = b
      b = temp
    }
    return b
  }

  func calculateFibonacciAsync(value: Double) throws -> Promise<Int64> {
    return Promise.async {
      return try self.calculateFibonacciSync(value: value)
    }
  }

  func wait(seconds: Double) throws -> Promise<Void> {
    return Promise.async {
      let nanoseconds = UInt64((seconds * 1_000_000_000).rounded())
      try await Task.sleep(nanoseconds: nanoseconds)
    }
  }

  func promiseThrows() throws -> Promise<Void> {
    return Promise.async {
      throw RuntimeError.error(withMessage: "Promise throws :)")
    }
  }

  func promiseReturnsInstantly() throws -> Promise<Double> {
    return Promise.resolved(withResult: 55.0)
  }

  func promiseReturnsInstantlyAsync() throws -> Promise<Double> {
    return Promise.async {
      return 55.0
    }
  }

  func createPendingPromise() throws -> Promise<Double> {
    guard pendingPromise == nil else {
      throw RuntimeError.error(withMessage: "A pending Promise is already waiting for completion.")
    }
    let promise = Promise<Double>()
    pendingPromise = promise
    return promise
  }

  func resolvePendingPromiseOnWorker() throws {
    guard let promise = pendingPromise else {
      throw RuntimeError.error(withMessage: "No pending Promise is waiting for completion.")
    }
    // Only JS calls access the slot; the worker owns the extracted Promise.
    pendingPromise = nil
    DispatchQueue.global().async {
      promise.resolve(withResult: 55.0)
    }
  }

  func promiseThatResolvesVoidInstantly() throws -> Promise<Void> {
    return Promise.resolved()
  }

  func promiseThatResolvesToUndefined() throws -> Promise<Double?> {
    return Promise.resolved(withResult: nil)
  }

  func awaitNullablePromise() throws -> Promise<Double?> {
    return Promise.async {
      try await Promise<Double?>.resolved(withResult: nil).await()
    }
  }

  func awaitAndGetPromise(promise: Promise<Double>) throws -> Promise<Double> {
    return .async {
      let result = try await promise.await()
      return result
    }
  }
  func awaitAndGetComplexPromise(promise: Promise<Car>) throws -> Promise<Car> {
    return .async {
      let result = try await promise.await()
      return result
    }
  }
  func awaitPromise(promise: Promise<Void>) throws -> Promise<Void> {
    return .async {
      try await promise.await()
    }
  }

  func callAll(
    first: @escaping (() -> Void), second: @escaping (() -> Void), third: @escaping (() -> Void)
  ) throws {
    first()
    second()
    third()
  }

  func getCar() throws -> Car {
    return Car(
      year: 2018, make: "Lamborghini", model: "Huracán", power: 640, powertrain: .gas, driver: nil,
      passengers: [], isFast: true, favouriteTrack: nil, performanceScores: [100, 10],
      someVariant: nil)
  }

  func isCarElectric(car: Car) throws -> Bool {
    return car.powertrain == .electric
  }

  func areCarsEqual(a: Car, b: Car) throws -> Bool {
    return a == b
  }

  func getDriver(car: Car) throws -> Person? {
    return car.driver
  }

  func bounceCar(car: Car) -> Car {
    return car
  }

  func jsStyleObjectAsParameters(params: JsStyleStruct) throws {
    params.onChanged(params.value)
  }

  func bounceWrappedJsStyleStruct(value: WrappedJsStruct) throws -> WrappedJsStruct {
    return value
  }

  func bounceOptionalWrapper(wrapper: OptionalWrapper) throws -> OptionalWrapper {
    return wrapper
  }

  func bounceOptionalCallback(value: OptionalCallback) throws -> OptionalCallback {
    return value
  }

  func bounceOptionalEnumStruct(value: OptionalEnumWrapper?) throws -> OptionalEnumWrapper? {
    return value
  }

  func createArrayBufferFromNativeBuffer(copy: Bool) throws -> ArrayBuffer {
    let data = Data(count: 1024 * 1024 * 10)  // 10 MB
    if copy {
      return try ArrayBuffer.copy(data: data)
    } else {
      // TODO: `Data` cannot be safely wrapped yet on iOS.
      return try ArrayBuffer.copy(data: data)
    }
  }

  func createHardwareBuffer(
    width: Double, height: Double, layers: Double, format: HardwareBufferFormat
  ) throws -> ArrayBuffer {
    // iOS doesn't have HardwareBuffers - create a `Data` of the same byte size instead.
    let bytesPerPixel: Int
    switch format {
    case .rgb565:
      bytesPerPixel = 2
    case .rgba8888:
      bytesPerPixel = 4
    case .rgbaFp16:
      bytesPerPixel = 8
    case .blob:
      // BLOB buffers hold `width` bytes flat.
      let data = Data(count: Int(width))
      return try ArrayBuffer.copy(data: data)
    }
    let size = Int(width) * Int(height) * Int(layers) * bytesPerPixel
    let data = Data(count: size)
    return try ArrayBuffer.copy(data: data)
  }

  func createArrayBuffer() throws -> ArrayBuffer {
    return ArrayBuffer.allocate(size: 1024 * 1024 * 10)  // 10 MB
  }

  func createArrayBufferAsync() throws -> Promise<ArrayBuffer> {
    return Promise.async { try self.createArrayBuffer() }
  }

  func copyBuffer(buffer: ArrayBuffer) throws -> ArrayBuffer {
    return ArrayBuffer.copy(of: buffer)
  }

  func bounceArrayBuffer(buffer: ArrayBuffer) throws -> ArrayBuffer {
    return buffer
  }

  func getBufferLastItem(buffer: ArrayBuffer) throws -> Double {
    let lastByte = buffer.data.advanced(by: buffer.size - 1)
    return Double(lastByte.pointee)
  }

  func setAllValuesTo(buffer: ArrayBuffer, value: Double) throws {
    memset(buffer.data, Int32(value), buffer.size)
  }

  func createChild() throws -> any HybridChildSpec {
    return HybridChild()
  }

  func createBase() throws -> any HybridBaseSpec {
    return HybridBase()
  }

  func createBaseActualChild() throws -> any HybridBaseSpec {
    return HybridChild()
  }

  func bounceChild(child: any HybridChildSpec) throws -> any HybridChildSpec {
    return child
  }

  func bounceBase(base: any HybridBaseSpec) throws -> any HybridBaseSpec {
    return base
  }

  func bounceChildBase(child: any HybridChildSpec) throws -> any HybridBaseSpec {
    return child
  }

  func castBase(base: any HybridBaseSpec) throws -> any HybridChildSpec {
    guard let child = base as? HybridChildSpec else {
      throw RuntimeError.error(withMessage: "Cannot cast Base to Child!")
    }
    return child
  }

  func getIsViewBlue(view: any HybridTestViewSpec) throws -> Bool {
    guard let view = view as? HybridTestView else { return false }
    return view.isBlue
  }

  func callbackSync(callback: @escaping () -> Double) throws -> Double {
    let value = callback()
    return value
  }

  func bounceExternalHybrid(externalObject: (any HybridSomeExternalObjectSpec)) throws -> (
    any HybridSomeExternalObjectSpec
  ) {
    return externalObject
  }

  func bounceExternalStruct(externalStruct: ExternalObjectStruct) throws -> ExternalObjectStruct {
    return externalStruct
  }

  func bounceExternalVariant(variant: StringOrExternal) throws -> StringOrExternal {
    return variant
  }

  func createExternalVariantFromFunc(factory: @escaping () -> (any HybridSomeExternalObjectSpec))
    throws -> (any HybridSomeExternalObjectSpec)
  {
    let obj = factory()
    return obj
  }

  func createInternalObject() -> any HybridSomeExternalObjectSpec {
    return HybridSomeInternalObject()
  }

  func dispose() {
    if let optionalCallback {
      optionalCallback(13.0)
    }
  }

  private let formatter: NumberFormatter = {
    let formatter = NumberFormatter()
    formatter.minimumFractionDigits = 0
    formatter.maximumFractionDigits = 16
    formatter.minimumIntegerDigits = 1
    formatter.numberStyle = .decimal
    return formatter
  }()
  private func stringify(_ value: Double) -> String {
    return formatter.string(for: value) ?? "\(value)"
  }
}
