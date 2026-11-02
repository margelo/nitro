//
//  HybridTestObjectSwift.swift
//  NitroTest
//
//  Created by Marc Rousavy on 11.08.24.
//

import Dispatch
import Foundation
import NitroModules
import NitroModulesCxx
import NitroTestExternal
import os

class HybridTestObjectSwift: HybridTestObjectSwiftKotlinSpec {
  required override init() throws {
    try super.init()
  }

  static let readonlyNumber: Double = 42.0
  private static let sharedNumberStorage = OSAllocatedUnfairLock(initialState: 0.0)
  static var sharedNumber: Double {
    get { sharedNumberStorage.withLock { $0 } }
    set { sharedNumberStorage.withLock { $0 = newValue } }
  }

  static func staticAdd(a: Double, b: Double) throws -> Double {
    return a + b
  }

  static func staticNegate(value: Bool) throws -> Bool {
    return !value
  }

  static func staticConcat(a: String, b: String) throws -> String {
    return a + b
  }

  static func staticBouncePoint(point: StaticPoint) throws -> StaticPoint {
    return point
  }

  static func staticThrow(message: String) throws {
    throw RuntimeError(message)
  }

  private var pendingPromise: (any Promise<Double>)?

  var optionalArray: [String]? = []

  var someVariant: Variant_Double_String = .first(55)

  private var computedValueStorage: Double = 0.0
  var computedValue: Double {
    get { computedValueStorage * 2 }
    set { computedValueStorage = newValue + 1 }
  }

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

  var optionalCallback: (any Callback<Double, Void>)? = nil

  let hasBoolean = false
  let isBoolean = false
  var hasBooleanWritable = false
  var isBooleanWritable = false
  var isolatedBoolean = false
  var isTextValue = ""

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

  func bounceNull(value: NullType) throws -> NullType {
    return value
  }

  func callCallback(callback: any Callback<(), Void>) throws {
    callback()
  }

  func callInlineCallback(
    callback: borrowing some InlineCallback<(), Void> & ~Copyable & ~Escapable
  ) throws {
    try callback()
  }

  func callInlineCallbackWithValue(
    value: Double,
    callback: borrowing some InlineCallback<Double, Double> & ~Copyable & ~Escapable
  ) throws -> Double {
    return try callback(value)
  }

  func callCallbackThatReturnsPromiseVoid(callback: any Callback<(), any Promise<Void>>) throws
    -> any Promise<Void>
  {
    return .async {
      let resultPromise = try await callback()
      try await resultPromise.await()
    }
  }

  func createNativeCallback(wrappingJsCallback: any Callback<Double, Void>) throws
    -> any Callback<Double, Void>
  {
    return .native { num in
      wrappingJsCallback(num)
    }
  }

  func callWithOptional(value: Double?, callback: any Callback<Double?, Void>) throws {
    callback(value)
  }

  func getValueFromJSCallbackAndWait(getValue: any Callback<(), Double>) throws -> any Promise<
    Double
  > {
    return .async {
      let jsResult = try await getValue()
      return jsResult
    }
  }

  func getValueFromJsCallback(
    callback: any Callback<(), String>, andThenCall: any Callback<String, Void>
  ) throws -> any Promise<Void> {
    return .async {
      let jsResult = try await callback()
      andThenCall.callAndForget(jsResult)
    }
  }

  func callSyncCallback(value: Double, callback: any Callback<Double, Void>) throws {
    try callback.callSync(value)
  }

  func callAsyncCallback(value: Double, callback: any Callback<Double, Double>) throws -> any Promise<
    Double
  > {
    return callback.callAsync(value)
  }

  func callAsyncVoidCallback(callback: any Callback<(), Void>) throws -> any Promise<Void> {
    return callback.callAsync()
  }

  func callAsyncBooleanCallback(value: Bool, callback: any Callback<Bool, Bool>) throws
    -> any Promise<Bool>
  {
    return callback.callAsync(value)
  }

  func awaitAsyncCallback(value: Double, callback: any Callback<Double, Double>) throws
    -> any Promise<Double>
  {
    return .async {
      let result = try await callback.callAsync(value)
      return result + 1
    }
  }

  func callAndForgetCallback(value: Double, callback: any Callback<Double, Double>) throws {
    callback.callAndForget(value)
  }

  func callNativeCallbackAsync(value: Double) throws -> any Promise<Double> {
    let callback: any Callback<Double, Double> = .native { input in input * 2 }
    return callback.callAsync(value)
  }

  func callThrowingNativeCallbackAsync(message: String) throws -> any Promise<Void> {
    let callback: any Callback<(), Void> = .native { throw RuntimeError(message) }
    return callback.callAsync()
  }

  func callThrowingNativeCallbackAndForget(message: String) throws {
    let callback: any Callback<(), Void> = .native { throw RuntimeError(message) }
    callback.callAndForget()
  }

  func callInlineCallbackThenEscape(
    value: Double,
    callback: borrowing some InlineCallback<Double, Double> & ~Copyable & ~Escapable
  ) throws -> any Promise<Double> {
    let first = try callback(value)
    let escaped = callback.escape()
    return escaped.callAsync(first)
  }

  func getSharedNumberCallback(shared: any HybridSharedSpecializationsSpec) throws
    -> any Callback<Double, Void>
  {
    return shared.numberCallback
  }

  func callSumUpNTimes(callback: any Callback<(), Double>, n: Double) throws -> any Promise<Double> {
    var result = 0.0
    return .async {
      for _ in 0..<max(0, Int(n)) {
        let current = try await callback()
        result += current
      }
      return result
    }
  }

  func callbackAsyncPromise(callback: any Callback<(), any Promise<Double>>) throws -> any Promise<
    Double
  > {
    return .async {
      let promise = try await callback()
      let result = try await promise.await()
      return result
    }
  }

  func callbackAsyncPromiseBuffer(callback: any Callback<(), any Promise<ArrayBuffer>>) throws
    -> any Promise<ArrayBuffer>
  {
    let result: any Promise<ArrayBuffer> = .pending()
    let callbackResult = callback()
    callbackResult.addOnResolvedListener { promise in
      promise.addOnResolvedListener { buffer in result.resolve(result: buffer) }
      promise.addOnRejectedListener { error in result.reject(error: error) }
    }
    callbackResult.addOnRejectedListener { error in result.reject(error: error) }
    return result
  }

  func getComplexCallback() throws -> any Callback<Double, Void> {
    return .native { value in print("Callback called with \(value).") }
  }

  func twoOptionalCallbacks(
    value: Double, first: (any Callback<Double, Void>)?,
    second: (any Callback<String, Void>)?
  ) throws {
    if let first {
      first(value)
    }
    if let second {
      second("Hello")
    }
  }

  func errorCallback(onError: any Callback<any Error, Void>) throws {
    let error = RuntimeError("Some Error!")
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
    array: [Powertrain], callback: any Callback<[Powertrain], Void>
  ) throws {
    callback(array)
  }

  func callEnumArrayCallback(
    array: [Powertrain], callback: any Callback<[Powertrain], [Powertrain]>
  ) throws -> [Powertrain] {
    return try callback.callSync(array)
  }

  func getEnumArrayCallback() throws -> any Callback<[Powertrain], [Powertrain]> {
    return .native { array in array }
  }

  func callEnumArrayPromiseCallback(
    callback: any Callback<(), any Promise<[Powertrain]>>
  ) throws -> any Promise<[Powertrain]> {
    return .async {
      let promise = try await callback()
      return try await promise.await()
    }
  }

  func awaitEnumArrayPromise(promise: any Promise<[Powertrain]>) throws -> any Promise<[Powertrain]> {
    return .async {
      return try await promise.await()
    }
  }

  func callNestedStructCallback(
    value: [[Person?]], callback: any Callback<[[Person?]], [[Person?]]>
  ) throws -> [[Person?]] {
    return try callback.callSync(value)
  }

  func bounceUnsignedArray(array: [UInt64]) throws -> [UInt64] {
    return array
  }

  func bounceNestedUnsignedArray(array: [[UInt64]]) throws -> [[UInt64]] {
    return array
  }

  func bounceOptionalUnsignedArray(array: [UInt64]?) throws -> [UInt64]? {
    return array
  }

  func bounceUnsignedArrayAsync(array: [UInt64]) throws -> any Promise<[UInt64]> {
    return .async {
      return array
    }
  }

  func callUnsignedArrayCallback(
    array: [UInt64], callback: any Callback<[UInt64], [UInt64]>
  ) throws -> [UInt64] {
    return try callback.callSync(array)
  }

  func bounceUnsignedVariant(variant: Variant_UInt64_String) throws -> Variant_UInt64_String {
    return variant
  }

  func bounceUnsignedArrayVariant(variant: Variant__UInt64__String) throws -> Variant__UInt64__String {
    return variant
  }

  func bounceUnsignedMap(map: [String: UInt64]) throws -> [String: UInt64] {
    return map
  }

  func bounceUnsignedArrayMap(map: [String: [UInt64]]) throws -> [String: [UInt64]] {
    return map
  }

  func bounceUnsignedAsync(value: UInt64) throws -> any Promise<UInt64> {
    return .async {
      return value
    }
  }

  func callUnsignedCallbackAsync(value: UInt64, callback: any Callback<UInt64, UInt64>) throws
    -> any Promise<UInt64>
  {
    return callback.callAsync(value)
  }

  func callUnsignedArrayCallbackAsync(
    array: [UInt64], callback: any Callback<[UInt64], [UInt64]>
  ) throws -> any Promise<[UInt64]> {
    return callback.callAsync(array)
  }

  func bounceNestedUnsignedArrayAsync(array: [[UInt64]]) throws -> any Promise<[[UInt64]]> {
    return .async {
      return array
    }
  }

  func callNestedUnsignedArrayCallback(
    array: [[UInt64]], callback: any Callback<[[UInt64]], [[UInt64]]>
  ) throws -> [[UInt64]] {
    return try callback.callSync(array)
  }

  func bounceHybridObjects(array: [(any HybridChildSpec)]) throws -> [(any HybridChildSpec)] {
    return array
  }

  func bounceFunctions(functions: [any Callback<(), Void>]) throws -> [any Callback<(), Void>] {
    return functions
  }

  func bounceMaps(maps: [AnyJSON]) throws -> [AnyJSON] {
    return maps
  }

  func bouncePromises(promises: [any Promise<Double>]) throws -> [any Promise<Double>] {
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

  func bounceOptionalNulls(strings: [Variant_NullType_String?]) throws -> [Variant_NullType_String?] {
    return strings
  }

  func createMap() throws -> AnyJSON {
    let values: [Any] = [numberValue, boolValue, stringValue, int64Value]
    let fields: [String: Any] = [
      "number": numberValue,
      "bool": boolValue,
      "string": stringValue,
      "int64": int64Value,
      "null": NSNull(),
    ]
    var nestedObject = fields
    nestedObject["array"] = values + [values]
    var object = fields
    object["array"] = values
    object["object"] = nestedObject
    return AnyJSON(data: try JSONSerialization.data(withJSONObject: object))
  }

  func mapRoundtrip(map: AnyJSON) throws -> AnyJSON {
    return map
  }

  private func jsonObject(_ json: AnyJSON) throws -> [String: Any] {
    guard let object = try JSONSerialization.jsonObject(with: json.data) as? [String: Any] else {
      throw RuntimeError("Expected a JSON object.")
    }
    return object
  }

  func getMapKeys(map: AnyJSON) throws -> [String] {
    return Array(try jsonObject(map).keys)
  }

  func mergeMaps(a: AnyJSON, b: AnyJSON) throws -> AnyJSON {
    var object = try jsonObject(a)
    object.merge(try jsonObject(b)) { _, incoming in incoming }
    return AnyJSON(data: try JSONSerialization.data(withJSONObject: object))
  }

  func copyAnyMap(map: AnyJSON) throws -> AnyJSON {
    return map
  }

  func newTestObject() throws -> (any HybridTestObjectSwiftKotlinSpec) {
    return try HybridTestObjectSwift()
  }

  func newTestObjectAsync() throws -> any Promise<(any HybridTestObjectSwiftKotlinSpec)> {
    return .parallel { try HybridTestObjectSwift() }
  }

  func funcThatThrows() throws -> Double {
    throw RuntimeError("This function will only work after sacrificing seven lambs!")
  }

  func funcThatThrowsBeforePromise() throws -> any Promise<Void> {
    throw RuntimeError("This function will only work after sacrificing eight lambs!")
  }

  func throwError(error: any Error) throws {
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
    return Self.calculateFibonacci(value: value)
  }

  private static func calculateFibonacci(value: Double) -> Int64 {
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

  func calculateFibonacciAsync(value: Double) throws -> any Promise<Int64> {
    return .async {
      return Self.calculateFibonacci(value: value)
    }
  }

  func wait(seconds: Double) throws -> any Promise<Void> {
    return .async {
      let nanoseconds = UInt64((seconds * 1_000_000_000).rounded())
      try await Task.sleep(nanoseconds: nanoseconds)
    }
  }

  func promiseThrows() throws -> any Promise<Void> {
    return .async {
      throw RuntimeError("Promise throws :)")
    }
  }

  func promiseReturnsInstantly() throws -> any Promise<Double> {
    return .resolved(with: 55.0)
  }

  func promiseReturnsInstantlyAsync() throws -> any Promise<Double> {
    return .async {
      return 55.0
    }
  }

  func createPendingPromise() throws -> any Promise<Double> {
    guard pendingPromise == nil else {
      throw RuntimeError("A pending Promise is already waiting for completion.")
    }
    let promise: any Promise<Double> = .pending()
    pendingPromise = promise
    return promise
  }

  func resolvePendingPromiseOnWorker() throws {
    guard let promise = pendingPromise else {
      throw RuntimeError("No pending Promise is waiting for completion.")
    }
    // Only JS calls access the slot; the worker owns the extracted Promise.
    pendingPromise = nil
    DispatchQueue.global().async {
      promise.resolve(result: 55.0)
    }
  }

  func promiseThatResolvesVoidInstantly() throws -> any Promise<Void> {
    return .resolved()
  }

  func promiseThatResolvesToUndefined() throws -> any Promise<Double?> {
    return .resolved(with: nil)
  }

  func awaitNullablePromise() throws -> any Promise<Double?> {
    return .async {
      let promise: any Promise<Double?> = .resolved(with: nil)
      return try await promise.await()
    }
  }

  func awaitAndGetPromise(promise: any Promise<Double>) throws -> any Promise<Double> {
    return .async {
      let result = try await promise.await()
      return result
    }
  }
  func awaitAndGetComplexPromise(promise: any Promise<Car>) throws -> any Promise<Car> {
    return .async {
      let result = try await promise.await()
      return result
    }
  }
  func awaitPromise(promise: any Promise<Void>) throws -> any Promise<Void> {
    return .async {
      try await promise.await()
    }
  }

  func callAll(
    first: any Callback<(), Void>, second: any Callback<(), Void>, third: any Callback<(), Void>
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

  func bounceCar(car: Car) throws -> Car {
    return car
  }

  func jsStyleObjectAsParameters(params: JsStyleStruct) throws {
    params.onChanged(params.value)
  }

  func roundtripUnsignedScalar(value: UnsignedScalar) throws -> UnsignedScalar {
    return value
  }

  func roundtripUnsignedValues(value: UnsignedValues) throws -> UnsignedValues {
    return value
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
      // TODO: `Data` cannot be safely wrapped yet on Apple platforms.
      return try ArrayBuffer.copy(data: data)
    }
  }

  func createHardwareBuffer(
    width: Double, height: Double, layers: Double, format: HardwareBufferFormat
  ) throws -> ArrayBuffer {
    // Apple platforms don't have HardwareBuffers - create a `Data` of the same byte size instead.
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
    return Self.allocateArrayBuffer()
  }

  private static func allocateArrayBuffer() -> ArrayBuffer {
    return ArrayBuffer.allocate(1024 * 1024 * 10)  // 10 MB
  }

  func createArrayBufferAsync() throws -> any Promise<ArrayBuffer> {
    return .async { Self.allocateArrayBuffer() }
  }

  func copyBuffer(buffer: ArrayBuffer) throws -> ArrayBuffer {
    return ArrayBuffer.copy(buffer)
  }

  func bounceArrayBuffer(buffer: ArrayBuffer) throws -> ArrayBuffer {
    return buffer
  }

  func getBufferLastItem(buffer: ArrayBuffer) throws -> Double {
    return try buffer.withUnsafeBytes { bytes in
      guard let lastByte = bytes.last else {
        throw RuntimeError("ArrayBuffer's size is 0!")
      }
      return Double(lastByte)
    }
  }

  func setAllValuesTo(buffer: ArrayBuffer, value: Double) throws {
    try buffer.withUnsafeMutableBytes { bytes in
      guard let data = bytes.baseAddress, !bytes.isEmpty else {
        throw RuntimeError("ArrayBuffer's size is 0!")
      }
      memset(data, Int32(value), bytes.count)
    }
  }

  func createChild() throws -> (any HybridChildSpec) {
    return try HybridChild()
  }

  func createBase() throws -> (any HybridBaseSpec) {
    return try HybridBase()
  }

  func createBaseActualChild() throws -> (any HybridBaseSpec) {
    return try HybridChild()
  }

  func createGrandchild() throws -> (any HybridGrandchildSpec) {
    return try HybridGrandchild()
  }

  func createChildActualGrandchild() throws -> (any HybridChildSpec) {
    return try HybridGrandchild()
  }

  func createBaseActualGrandchild() throws -> (any HybridBaseSpec) {
    return try HybridGrandchild()
  }

  func bounceGrandchild(grandchild: (any HybridGrandchildSpec)) throws -> (any HybridGrandchildSpec) {
    return grandchild
  }

  func bounceChild(child: (any HybridChildSpec)) throws -> (any HybridChildSpec) {
    return child
  }

  func bounceBase(base: (any HybridBaseSpec)) throws -> (any HybridBaseSpec) {
    return base
  }

  func bounceChildBase(child: (any HybridChildSpec)) throws -> (any HybridBaseSpec) {
    return child
  }

  func castBase(base: (any HybridBaseSpec)) throws -> (any HybridChildSpec) {
    guard let child = base as? HybridChildSpec else {
      throw RuntimeError("Cannot cast Base to Child!")
    }
    return child
  }

  func callbackSync(callback: any Callback<(), Double>) throws -> Double {
    let value = try callback.callSync()
    return value
  }

  func getSyncNumberCallback() throws -> any Callback<(), Double> {
    return .native { 55 }
  }

  func bounceSyncInt64Callback(callback: any Callback<Int64, Int64>) throws
    -> any Callback<Int64, Int64>
  {
    return callback
  }

  func bounceExternalHybrid(externalObject: (any HybridSomeExternalObjectSpec)) throws -> (
    any HybridSomeExternalObjectSpec
  ) {
    return externalObject
  }

  func bounceExternalStruct(externalStruct: ExternalObjectStruct) throws -> ExternalObjectStruct {
    return externalStruct
  }

  func bounceCppOnlyValue(value: CppOnlyValue) throws -> CppOnlyValue {
    return value
  }

  func bounceExternalVariant(variant: StringOrExternal) throws -> StringOrExternal {
    return variant
  }

  func createExternalVariantFromFunc(factory: any Callback<(), (any HybridSomeExternalObjectSpec)>)
    throws -> (any HybridSomeExternalObjectSpec)
  {
    let obj = try factory.callSync()
    return obj
  }

  func createInternalObject() throws -> (any HybridSomeExternalObjectSpec) {
    return try HybridSomeInternalObject()
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
