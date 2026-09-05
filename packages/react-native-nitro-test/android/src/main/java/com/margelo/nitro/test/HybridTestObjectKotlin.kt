package com.margelo.nitro.test

import android.hardware.HardwareBuffer
import android.util.Log
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.core.AnyMap
import com.margelo.nitro.core.AnyValue
import com.margelo.nitro.core.ArrayBuffer
import com.margelo.nitro.core.NullType
import com.margelo.nitro.core.Promise
import com.margelo.nitro.core.resolved
import com.margelo.nitro.test.external.HybridSomeExternalObjectSpec
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.math.BigDecimal
import java.time.Instant

@Keep
@DoNotStrip
class HybridTestObjectKotlin : HybridTestObjectSwiftKotlinSpec() {
  private var pendingPromise: Promise<Double>? = null

  private companion object {
    val promiseScope = CoroutineScope(Dispatchers.Default)
  }

  override var numberValue: Double = 0.0
  override var boolValue: Boolean = false
  override var stringValue: String = ""
  override val memorySize: Long
    get() = stringValue.length.toLong()
  override var int64Value: Long = 0L
  override var uint64Value: ULong = 0u
  override var optionalString: String? = null
  override var stringOrUndefined: String? = null
  override var nullValue: NullType = NullType.NULL
  override var stringOrNull: Variant_NullType_String = Variant_NullType_String.create(NullType.NULL)
  override var optionalHybrid: HybridTestObjectSwiftKotlinSpec? = null
  override val thisObject: HybridTestObjectSwiftKotlinSpec
    get() = this
  override var someVariant: Variant_Double_String = Variant_Double_String.create(55.05)
  override var optionalArray: Array<String>? = null
  override var optionalEnum: Powertrain? = null
  override var optionalOldEnum: OldEnum? = null
  override var optionalEnumPlusOne: TruckPowertrain? = null
  override var optionalCallback: ((value: Double) -> Unit)? = null

  override val hasBoolean = false
  override val isBoolean = false
  override var hasBooleanWritable = false
  override var isBooleanWritable = false

  override fun simpleFunc() {
    // do nothing
  }

  override fun addNumbers(
    a: Double,
    b: Double,
  ): Double {
    return a + b
  }

  override fun addStrings(
    a: String,
    b: String,
  ): String {
    return a + b
  }

  override fun multipleArguments(
    num: Double,
    str: String,
    boo: Boolean,
  ) {
    Log.i(TAG, "Arguments received! num: $num | str: $str | boo: $boo")
  }

  override fun bounceNull(value: NullType): NullType {
    return value
  }

  override fun bounceStrings(array: Array<String>): Array<String> {
    return array
  }

  override fun bounceNumbers(array: DoubleArray): DoubleArray {
    return array
  }

  override fun bounceStructs(array: Array<Person>): Array<Person> {
    return array
  }

  override fun bounceNestedArray(array: Array<Array<Person>>): Array<Array<Person>> {
    return array
  }

  override fun bouncePartialStruct(person: PartialPerson): PartialPerson {
    return person
  }

  override fun sumUpAllPassengers(cars: Array<Car>): String {
    val strings =
      cars.flatMap { car ->
        return@flatMap car.passengers.map { passenger ->
          val ageString = stringify(passenger.age)
          return@map "${passenger.name} ($ageString)"
        }
      }
    return strings.joinToString(separator = ", ")
  }

  override fun bounceEnums(array: Array<Powertrain>): Array<Powertrain> {
    return array
  }

  override fun complexEnumCallback(
    array: Array<Powertrain>,
    callback: (array: Array<Powertrain>) -> Unit,
  ) {
    callback(array)
  }

  override fun bounceHybridObjects(array: Array<HybridChildSpec>): Array<HybridChildSpec> {
    return array
  }

  override fun bounceFunctions(functions: Array<() -> Unit>): Array<() -> Unit> {
    return functions
  }

  override fun bounceMaps(maps: Array<AnyMap>): Array<AnyMap> {
    return maps
  }

  override fun bouncePromises(promises: Array<Promise<Double>>): Array<Promise<Double>> {
    return promises
  }

  override fun bounceArrayBuffers(arrayBuffers: Array<ArrayBuffer>): Array<ArrayBuffer> {
    return arrayBuffers
  }

  override fun bounceOptionals(
    strings: Array<String?>,
    arrayBuffers: Array<ArrayBuffer?>,
  ): Array<String?> {
    return strings
  }

  override fun bounceNulls(strings: Array<Variant_NullType_String>): Array<Variant_NullType_String> {
    return strings
  }

  override fun bounceOptionalNulls(strings: Array<Variant_NullType_String?>): Array<Variant_NullType_String?> {
    return strings
  }

  override fun currentDate(): java.time.Instant {
    return Instant.now()
  }

  override fun add1Hour(date: Instant): Instant {
    val oneHourInSeconds = 1L * 60 * 60
    return date.plusSeconds(oneHourInSeconds)
  }

  override fun createMap(): AnyMap {
    val map = AnyMap()
    map.setDouble("number", numberValue)
    map.setBoolean("bool", boolValue)
    map.setString("string", stringValue)
    map.setInt64("int64", int64Value)
    map.setNull("null")
    val array = arrayOf(AnyValue(numberValue), AnyValue(boolValue), AnyValue(stringValue), AnyValue(int64Value))
    map.setAnyArray("array", array)
    map.setAnyObject(
      "object",
      mapOf(
        "number" to AnyValue(numberValue),
        "bool" to AnyValue(boolValue),
        "string" to AnyValue(stringValue),
        "int64" to AnyValue(int64Value),
        "null" to AnyValue(),
        "array" to
          AnyValue(
            arrayOf(
              AnyValue(numberValue),
              AnyValue(boolValue),
              AnyValue(stringValue),
              AnyValue(int64Value),
              AnyValue(array),
            ),
          ),
      ),
    )
    return map
  }

  override fun getMapKeys(map: AnyMap): Array<String> {
    return map.getAllKeys()
  }

  override fun mergeMaps(
    a: AnyMap,
    b: AnyMap,
  ): AnyMap {
    a.merge(b)
    return a
  }

  override fun copyAnyMap(map: AnyMap): AnyMap {
    val copy = map.toHashMap()
    return AnyMap.fromMap(copy, false)
  }

  override fun mapRoundtrip(map: AnyMap): AnyMap {
    return map
  }

  override fun funcThatThrows(): Double {
    throw Error("This function will only work after sacrificing seven lambs!")
  }

  override fun funcThatThrowsBeforePromise(): Promise<Unit> {
    throw Error("This function will only work after sacrificing eight lambs!")
  }

  override fun throwError(error: Throwable) {
    throw error
  }

  override fun tryOptionalParams(
    num: Double,
    boo: Boolean,
    str: String?,
  ): String {
    return str ?: "value omitted!"
  }

  override fun tryMiddleParam(
    num: Double,
    boo: Boolean?,
    str: String,
  ): String {
    return str
  }

  override fun tryOptionalEnum(value: Powertrain?): Powertrain? {
    return value
  }

  override fun tryTrailingOptional(
    num: Double,
    str: String,
    boo: Boolean?,
  ): Boolean {
    return boo ?: false
  }

  override fun bounceMap(map: Map<String, Variant_Boolean_Double>): Map<String, Variant_Boolean_Double> {
    return map
  }

  override fun bounceSimpleMap(map: Map<String, Double>): Map<String, Double> {
    return map
  }

  override fun bounceOptionalMap(map: Map<String, String?>): Map<String, String?> {
    return map
  }

  override fun bounceNullMap(map: Map<String, Variant_NullType_String>): Map<String, Variant_NullType_String> {
    return map
  }

  override fun bounceOptionalNullMap(map: Map<String, Variant_NullType_String?>): Map<String, Variant_NullType_String?> {
    return map
  }

  override fun extractMap(mapWrapper: MapWrapper): Map<String, String> {
    return mapWrapper.map
  }

  override fun calculateFibonacciSync(value: Double): Long {
    val n = value.toInt()
    if (n == 0) return 0L
    if (n == 1) return 1L

    var a = 0L
    var b = 1L
    for (i in 2..n) {
      val next = a + b
      a = b
      b = next
    }
    return b
  }

  override fun calculateFibonacciAsync(value: Double): Promise<Long> {
    return Promise.parallel { calculateFibonacciSync(value) }
  }

  override fun wait(seconds: Double): Promise<Unit> {
    return Promise.async { delay(seconds.toLong() * 1000) }
  }

  override fun promiseThrows(): Promise<Unit> {
    return Promise.async {
      throw Error("Promise throws :)")
    }
  }

  override fun promiseReturnsInstantly(): Promise<Double> {
    return Promise.resolved(55.0)
  }

  override fun promiseReturnsInstantlyAsync(): Promise<Double> {
    return Promise.async {
      return@async 55.0
    }
  }

  override fun createPendingPromise(): Promise<Double> {
    check(pendingPromise == null) { "A pending Promise is already waiting for completion." }
    val promise = Promise<Double>()
    pendingPromise = promise
    return promise
  }

  override fun resolvePendingPromiseOnWorker() {
    val promise = checkNotNull(pendingPromise) { "No pending Promise is waiting for completion." }
    // Only JS calls access the slot; the worker owns the extracted Promise.
    pendingPromise = null
    promiseScope.launch {
      promise.resolve(55.0)
    }
  }

  override fun promiseThatResolvesVoidInstantly(): Promise<Unit> {
    return Promise.resolved()
  }

  override fun promiseThatResolvesToUndefined(): Promise<Double?> {
    return Promise.resolved(null)
  }

  override fun awaitNullablePromise(): Promise<Double?> {
    return Promise.async {
      Promise.resolved<Double?>(null).await()
    }
  }

  override fun awaitAndGetPromise(promise: Promise<Double>): Promise<Double> {
    return Promise.async {
      val result = promise.await()
      return@async result
    }
  }

  override fun awaitAndGetComplexPromise(promise: Promise<Car>): Promise<Car> {
    return Promise.async {
      val result = promise.await()
      return@async result
    }
  }

  override fun awaitPromise(promise: Promise<Unit>): Promise<Unit> {
    return Promise.async {
      promise.await()
    }
  }

  override fun callCallback(callback: () -> Unit) {
    callback()
  }

  override fun callCallbackThatReturnsPromiseVoid(callback: () -> Promise<Promise<Unit>>): Promise<Unit> {
    return Promise.async {
      val callPromise = callback()
      val resultPromise = callPromise.await()
      resultPromise.await()
    }
  }

  override fun createNativeCallback(wrappingJsCallback: (num: Double) -> Unit): (Double) -> Unit {
    return { num ->
      wrappingJsCallback(num)
    }
  }

  override fun callWithOptional(
    value: Double?,
    callback: (maybe: Double?) -> Unit,
  ) {
    callback(value)
  }

  override fun getValueFromJSCallbackAndWait(getValue: (() -> Promise<Double>)): Promise<Double> {
    return Promise.async {
      val jsResult = getValue().await()
      return@async jsResult
    }
  }

  override fun getValueFromJsCallback(
    callback: (() -> Promise<String>),
    andThenCall: ((valueFromJs: String) -> Unit),
  ): Promise<Unit> {
    return Promise.async {
      val jsResult = callback().await()
      andThenCall(jsResult)
    }
  }

  override fun callAll(
    first: () -> Unit,
    second: () -> Unit,
    third: () -> Unit,
  ) {
    first()
    second()
    third()
  }

  override fun callSumUpNTimes(
    callback: () -> Promise<Double>,
    n: Double,
  ): Promise<Double> {
    var result = 0.0
    return Promise.async {
      for (i in 1..n.toInt()) {
        val current = callback().await()
        result += current
      }
      return@async result
    }
  }

  override fun callbackAsyncPromise(callback: () -> Promise<Promise<Double>>): Promise<Double> {
    return Promise.async {
      val promise = callback().await()
      val result = promise.await()
      return@async result
    }
  }

  override fun callbackAsyncPromiseBuffer(callback: () -> Promise<Promise<ArrayBuffer>>): Promise<ArrayBuffer> {
    return Promise.async {
      val promise = callback().await()
      val result = promise.await()
      return@async result
    }
  }

  override fun getComplexCallback(): (Double) -> Unit {
    return { value ->
      Log.i(TAG, "Callback called with $value.")
    }
  }

  override fun twoOptionalCallbacks(
    value: Double,
    first: ((value: Double) -> Unit)?,
    second: ((value: String) -> Unit)?,
  ) {
    first?.let { first ->
      first(value)
    }
    second?.let { second ->
      second("Hello!")
    }
  }

  override fun errorCallback(onError: (error: Throwable) -> Unit) {
    val error = Error("Some Error!")
    onError(error)
  }

  override fun getCar(): Car {
    return Car(2018.0, "Lamborghini", "Huracán", 640.0, Powertrain.GAS, null, emptyArray(), true, null, doubleArrayOf(100.0, 10.0), null)
  }

  override fun isCarElectric(car: Car): Boolean {
    return car.powertrain == Powertrain.ELECTRIC
  }

  override fun areCarsEqual(
    a: Car,
    b: Car,
  ): Boolean {
    return a.year == b.year &&
      a.make == b.make &&
      a.model == b.model &&
      a.power == b.power &&
      a.powertrain == b.powertrain &&
      a.driver == b.driver &&
      a.passengers.contentEquals(b.passengers) &&
      a.isFast == b.isFast &&
      a.favouriteTrack == b.favouriteTrack &&
      a.performanceScores.contentEquals(b.performanceScores) &&
      a.someVariant == b.someVariant
  }

  override fun getDriver(car: Car): Person? {
    return car.driver
  }

  override fun bounceCar(car: Car): Car {
    return car
  }

  override fun jsStyleObjectAsParameters(params: JsStyleStruct) {
    params.onChanged(params.value)
  }

  override fun bounceWrappedJsStyleStruct(value: WrappedJsStruct): WrappedJsStruct {
    return value
  }

  override fun bounceOptionalWrapper(wrapper: OptionalWrapper): OptionalWrapper {
    return wrapper
  }

  override fun bounceOptionalCallback(value: OptionalCallback): OptionalCallback {
    return value
  }

  override fun bounceOptionalEnumStruct(value: OptionalEnumWrapper?): OptionalEnumWrapper? {
    return value
  }

  override fun createArrayBufferFromNativeBuffer(copy: Boolean): ArrayBuffer {
    val hardwareBuffer =
      HardwareBuffer.create(
        1024,
        1024,
        HardwareBuffer.RGBA_8888,
        1,
        HardwareBuffer.USAGE_CPU_WRITE_OFTEN or HardwareBuffer.USAGE_CPU_READ_OFTEN,
      )
    if (copy) {
      return ArrayBuffer.copy(hardwareBuffer)
    } else {
      return ArrayBuffer.wrap(hardwareBuffer)
    }
  }

  private fun HardwareBufferFormat.toAndroidFormat(): Int =
    when (this) {
      HardwareBufferFormat.RGBA_8888 -> HardwareBuffer.RGBA_8888
      HardwareBufferFormat.RGB_565 -> HardwareBuffer.RGB_565
      HardwareBufferFormat.RGBA_FP16 -> HardwareBuffer.RGBA_FP16
      HardwareBufferFormat.BLOB -> HardwareBuffer.BLOB
    }

  override fun createHardwareBuffer(
    width: Double,
    height: Double,
    layers: Double,
    format: HardwareBufferFormat,
  ): ArrayBuffer {
    val hardwareBuffer =
      HardwareBuffer.create(
        width.toInt(),
        height.toInt(),
        format.toAndroidFormat(),
        layers.toInt(),
        HardwareBuffer.USAGE_CPU_WRITE_OFTEN or HardwareBuffer.USAGE_CPU_READ_OFTEN,
      )
    return ArrayBuffer.wrap(hardwareBuffer)
  }

  override fun createArrayBuffer(): ArrayBuffer {
    return ArrayBuffer.allocate(1024 * 1024 * 10) // 10 MB
  }

  override fun createArrayBufferAsync(): Promise<ArrayBuffer> {
    return Promise.async { createArrayBuffer() }
  }

  override fun passVariant(either: Variant_Boolean_DoubleArray_Array_String__Double_String): Variant_Double_String {
    return either.match(
      { bool -> Variant_Double_String.create("holds something else!") },
      { doubleArray -> Variant_Double_String.create("holds something else!") },
      { stringArray -> Variant_Double_String.create("holds something else!") },
      { double -> Variant_Double_String.create(double) },
      { string -> Variant_Double_String.create(string) },
    )
  }

  override fun passAllEmptyObjectVariant(variant: Variant_HybridBaseSpec_OptionalWrapper): Variant_HybridBaseSpec_OptionalWrapper {
    return variant
  }

  override fun bounceComplexVariant(variant: CoreTypesVariant): CoreTypesVariant {
    return variant
  }

  override fun getVariantEnum(variant: Variant_OldEnum_Boolean): Variant_OldEnum_Boolean {
    return variant
  }

  override fun bounceVariantUnionEnum(variant: Variant_Powertrain_Car): Variant_Powertrain_Car {
    return variant
  }

  override fun getVariantWeirdNumbersEnum(variant: Variant_WeirdNumbersEnum_Boolean): Variant_WeirdNumbersEnum_Boolean {
    return variant
  }

  override fun getVariantObjects(variant: Variant_Person_Car): Variant_Person_Car {
    return variant
  }

  override fun passNamedVariant(variant: NamedVariant): NamedVariant {
    return variant
  }

  override fun getVariantHybrid(variant: Variant_HybridTestObjectSwiftKotlinSpec_Person): Variant_HybridTestObjectSwiftKotlinSpec_Person {
    return variant
  }

  override fun getBufferLastItem(buffer: ArrayBuffer): Double {
    val byteBuffer = buffer.getBuffer(false)
    val lastItem = byteBuffer[buffer.size - 1]
    return lastItem.toDouble()
  }

  override fun setAllValuesTo(
    buffer: ArrayBuffer,
    value: Double,
  ) {
    val byteBuffer = buffer.getBuffer(false)
    byteBuffer.rewind()
    val byte = value.toInt().toByte()
    while (byteBuffer.hasRemaining()) {
      byteBuffer.put(byte)
    }
  }

  override fun copyBuffer(buffer: ArrayBuffer): ArrayBuffer {
    return ArrayBuffer.copy(buffer)
  }

  override fun bounceArrayBuffer(buffer: ArrayBuffer): ArrayBuffer {
    return buffer
  }

  override fun createChild(): HybridChildSpec {
    return HybridChild()
  }

  override fun createBase(): HybridBaseSpec {
    return HybridBase()
  }

  override fun createBaseActualChild(): HybridBaseSpec {
    return HybridChild()
  }

  override fun bounceChild(child: HybridChildSpec): HybridChildSpec {
    return child
  }

  override fun bounceBase(base: HybridBaseSpec): HybridBaseSpec {
    return base
  }

  override fun bounceChildBase(child: HybridChildSpec): HybridBaseSpec {
    return child
  }

  override fun castBase(base: HybridBaseSpec): HybridChildSpec {
    if (base !is HybridChildSpec) {
      throw Error("Cannot cast Base to Child!")
    }
    return base
  }

  override fun newTestObject(): HybridTestObjectSwiftKotlinSpec {
    return HybridTestObjectKotlin()
  }

  override fun newTestObjectAsync(): Promise<HybridTestObjectSwiftKotlinSpec> {
    return Promise.parallel<HybridTestObjectSwiftKotlinSpec> {
      HybridTestObjectKotlin()
    }
  }

  override fun getIsViewBlue(view: HybridTestViewSpec): Boolean {
    val cast = view as? HybridTestView ?: return false
    return cast.isBlue
  }

  override fun callbackSync(callback: () -> Double): Double {
    val value = callback()
    return value
  }

  override fun bounceExternalHybrid(externalObject: HybridSomeExternalObjectSpec): HybridSomeExternalObjectSpec {
    return externalObject
  }

  override fun bounceExternalStruct(externalStruct: ExternalObjectStruct): ExternalObjectStruct {
    return externalStruct
  }

  override fun bounceExternalVariant(variant: StringOrExternal): StringOrExternal {
    return variant
  }

  override fun createExternalVariantFromFunc(factory: () -> HybridSomeExternalObjectSpec): HybridSomeExternalObjectSpec {
    val obj = factory()
    return obj
  }

  override fun createInternalObject(): HybridSomeExternalObjectSpec {
    return HybridSomeInternalObject()
  }

  override fun dispose() {
    super.dispose()
    this.optionalCallback?.let { callback ->
      callback(13.0)
    }
  }

  private fun stringify(value: Double): String {
    return BigDecimal
      .valueOf(value)
      .stripTrailingZeros()
      .toPlainString()
  }
}
