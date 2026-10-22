import { Android, iOS } from 'nitro-core'
import { type HybridObject, type AnyJSON, type CustomType, type AnyHybridObject, type UInt64, type Int64, type Inline } from 'nitro-core'
import type { SomeExternalObject, OptionalPrimitivesHolder, CppOnlyValue } from 'nitro-test-external'
import type { Child } from './Child.nitro'
import type { Grandchild } from './Grandchild.nitro'
import type { Base, Size } from './Base.nitro'
import type { CppBase } from './CppBase.nitro'
import type { CppChild } from './CppChild.nitro'
import type { CppGrandchild } from './CppGrandchild.nitro'
import type { PlatformObject } from './PlatformObject.nitro'

export * from '#nitro/TestObjectCpp'
export * from '#nitro/TestObjectSwiftKotlin'

// Tuples become `std::tuple<...>` in C++.
// In contrast to arrays, they are length-checked, and can have different types inside them.
export type Float2 = [number, number]
export type Float3 = [number, number, number]
export type TestTuple = [number, string, boolean]

// Variants can have aliases/names
export type NamedVariant = string | Car

// A discriminating string union becomes an `enum` in C++.
// This one is string-backed.
export type Powertrain = 'electric' | 'gas' | 'hybrid'
type TruckPowertrain = Powertrain | 'diesel'

// A classic TypeScript enum also becomes an `enum` in C++.
// This one is number-backed.
export enum OldEnum {
  FIRST,
  SECOND,
  THIRD,
}

// Backed by numbers, but with custom number values.
export enum WeirdNumbersEnum {
  A = 0,
  B = 32,
  C = 64,
}

// A plain interface that does not inherit from `HybridObject` becomes a `struct` in C++.
// They can only have properties (get + set). No methods or native state.
export interface Car {
  year: number
  make: string
  model: string
  power: number
  powertrain: Powertrain
  driver?: Person
  passengers: Person[]
  isFast?: boolean
  favouriteTrack?: string
  performanceScores: number[]
  someVariant?: number | string
}

// A `type T = { ... }` declaration is the same as a `interface T { ... }` - it's a `struct` in C++.
export type Person = {
  name: string
  age: number
}

// A struct of numbers and a boolean that static methods pass by value.
export interface StaticPoint {
  x: number
  y: number
  visible: boolean
}

export interface UnsignedScalar {
  value: UInt64
}

export interface UnsignedValues {
  unsignedValue: UInt64
  optionalUnsigned?: UInt64
  values: UInt64[]
  nested: UInt64[][]
  record: Record<string, UInt64 | undefined>
  callbacks: ((value: UInt64) => UInt64)[]
}

interface JsStyleStruct {
  value: number
  onChanged: (num: number) => void
}
export interface WrappedJsStruct {
  value: JsStyleStruct
  items: JsStyleStruct[]
}
export interface OptionalWrapper {
  optionalArrayBuffer?: ArrayBuffer
  optionalString?: string
}
// A wide optional struct mixing primitive optionals with string-union enum optionals.
export interface OptionalEnumWrapper {
  count?: number
  weight?: number
  ttl?: number
  jitter?: number
  retries?: number
  delayMs?: number
  timeoutMs?: number
  ratio?: number
  threshold?: number
  enabled?: boolean
  active?: boolean
  shouldBuffer?: boolean
  shouldRetry?: boolean
  verbose?: boolean
  tier?: Powertrain
  region?: Powertrain
  stage?: Powertrain
  tone?: Powertrain
}
export interface ExternalObjectStruct {
  someExternal: SomeExternalObject
}
export type StringOrExternal = string | SomeExternalObject

interface OptionalCallback {
  callback?: (() => void) | number
}

interface SecondMapWrapper {
  second: Record<string, string>
}
interface MapWrapper {
  map: Record<string, string>
  secondMap: SecondMapWrapper
}
export type CustomString = CustomType<string, 'CustomString', { include: 'CustomString.hpp' }>

type CoreTypesVariant = ArrayBuffer | Promise<number> | ((value: number) => void) | WrappedJsStruct | AnyJSON

// Prefer `interface` + `extends` over `type` so TS doesn't flatten it
interface PartialPerson extends Partial<Person> {}

// A string union becomes an `enum` in C++/Swift/Kotlin.
// These map 1:1 to Android `HardwareBuffer` formats.
export type HardwareBufferFormat = 'rgba-8888' | 'rgb-565' | 'rgba-fp16' | 'blob'

// This is a C++-based `HybridObject`.
@iOS({
  language: 'c++',
  implementation: {
    className: 'HybridTestObjectCpp',
    include: '"HybridTestObjectCpp.hpp"',
  },
})
@Android({
  language: 'c++',
  implementation: {
    className: 'HybridTestObjectCpp',
    include: '"HybridTestObjectCpp.hpp"',
  },
})
export declare class TestObjectCpp extends HybridObject {
  constructor(nativeFactory?: PlatformObject)

  static readonly readonlyNumber: number
  static sharedNumber: number

  // Test Static Methods
  static staticAdd(a: number, b: number): number
  static staticNegate(value: boolean): boolean
  static staticConcat(a: string, b: string): string
  static staticBouncePoint(point: StaticPoint): StaticPoint
  static staticThrow(message: string): void

  // Test Primitives
  computedValue: number
  numberValue: number
  boolValue: boolean
  stringValue: string
  int64Value: Int64
  uint64Value: UInt64
  nullValue: null
  optionalString?: string
  stringOrUndefined: string | undefined
  stringOrNull: string | null
  optionalArray?: string[]
  optionalEnum?: Powertrain
  optionalOldEnum?: OldEnum
  optionalEnumPlusOne?: TruckPowertrain
  optionalCallback?: (value: number) => void

  // Kotlin/Swift simplify boolean names (has*/is*)
  readonly hasBoolean: boolean
  readonly isBoolean: boolean
  hasBooleanWritable: boolean
  isBooleanWritable: boolean
  // Kotlin only simplifies `is*` when it is not followed by a lowercase letter,
  // and it does so for every type - not just booleans.
  isolatedBoolean: boolean
  isTextValue: string

  // Basic function tests
  simpleFunc(): void
  addNumbers(a: number, b: number): number
  addStrings(a: string, b: string): string
  multipleArguments(num: number, str: string, boo: boolean): void
  bounceNull(value: null): null

  // Arrays
  bounceStrings(array: string[]): string[]
  bounceNumbers(array: number[]): number[]
  bounceStructs(array: Person[]): Person[]
  bounceNestedArray(array: Person[][]): Person[][]
  bouncePartialStruct(person: PartialPerson): PartialPerson
  sumUpAllPassengers(cars: Car[]): string
  bounceEnums(array: Powertrain[]): Powertrain[]
  complexEnumCallback(array: Powertrain[], callback: (array: Powertrain[]) => void): void

  // Container callbacks and promises
  callEnumArrayCallback(array: Powertrain[], callback: (array: Powertrain[]) => Powertrain[]): Powertrain[]
  getEnumArrayCallback(): (array: Powertrain[]) => Powertrain[]
  callEnumArrayPromiseCallback(callback: () => Promise<Powertrain[]>): Promise<Powertrain[]>
  awaitEnumArrayPromise(promise: Promise<Powertrain[]>): Promise<Powertrain[]>
  callNestedStructCallback(
    value: (Person | undefined)[][],
    callback: (value: (Person | undefined)[][]) => (Person | undefined)[][]
  ): (Person | undefined)[][]

  // Arrays (complex)
  bounceHybridObjects(array: Child[]): Child[]
  bounceFunctions(functions: (() => void)[]): (() => void)[]
  bounceMaps(maps: AnyJSON[]): AnyJSON[]
  bouncePromises(promises: Promise<number>[]): Promise<number>[]
  bounceArrayBuffers(arrayBuffers: ArrayBuffer[]): ArrayBuffer[]
  bounceOptionals(strings: (string | undefined)[], arrayBuffers: (ArrayBuffer | undefined)[]): (string | undefined)[]
  bounceNulls(strings: (string | null)[]): (string | null)[]
  bounceOptionalNulls(strings: (string | null | undefined)[]): (string | null | undefined)[]

  // Maps
  createMap(): AnyJSON
  createJSON(json: string): AnyJSON
  createJSONAsync(json: string): Promise<AnyJSON>
  createResolvedJSON(json: string): Promise<AnyJSON>
  createPendingJSON(): Promise<AnyJSON>
  resolvePendingJSONOnWorker(json: string): void
  mapRoundtrip(map: AnyJSON): AnyJSON
  getMapKeys(map: AnyJSON): string[]
  mergeMaps(a: AnyJSON, b: AnyJSON): AnyJSON
  copyAnyMap(map: AnyJSON): AnyJSON

  // Typed Maps (records)
  bounceMap(map: Record<string, number | boolean>): Record<string, number | boolean>
  bounceSimpleMap(map: Record<string, number>): Record<string, number>
  bounceOptionalMap(map: Record<string, string | undefined>): Record<string, string | undefined>
  bounceNullMap(map: Record<string, string | null>): Record<string, string | null>
  bounceOptionalNullMap(map: Record<string, string | null | undefined>): Record<string, string | null | undefined>
  extractMap(mapWrapper: MapWrapper): MapWrapper['map']

  // Errors
  funcThatThrows(): number
  funcThatThrowsBeforePromise(): Promise<void>
  throwError(error: Error): void

  // Optional parameters
  tryOptionalParams(num: number, boo: boolean, str?: string): string
  tryMiddleParam(num: number, boo: boolean | undefined, str: string): string
  tryOptionalEnum(value?: Powertrain): Powertrain | undefined
  tryTrailingOptional(num: number, str: string, boo?: boolean): boolean

  // Variants
  someVariant: number | string

  // Promises
  calculateFibonacciSync(value: number): Int64
  calculateFibonacciAsync(value: number): Promise<Int64>
  wait(seconds: number): Promise<void>
  promiseThrows(): Promise<void>
  promiseReturnsInstantly(): Promise<number>
  promiseReturnsInstantlyAsync(): Promise<number>
  // Stays pending until the separate JS call schedules its native completion.
  // Only one Promise may be waiting for that trigger on each TestObject.
  createPendingPromise(): Promise<number>
  resolvePendingPromiseOnWorker(): void
  promiseThatResolvesVoidInstantly(): Promise<void>
  promiseThatResolvesToUndefined(): Promise<number | undefined>
  awaitNullablePromise(): Promise<number | undefined>

  // Complex Promises
  awaitAndGetPromise(promise: Promise<number>): Promise<number>
  awaitAndGetComplexPromise(promise: Promise<Car>): Promise<Car>
  awaitPromise(promise: Promise<void>): Promise<void>

  // Callbacks
  callCallback(callback: () => void): void
  callInlineCallback(callback: Inline<() => void>): void
  callInlineCallbackWithValue(value: number, callback: Inline<(value: number) => number>): number
  callCallbackThatReturnsPromiseVoid(callback: () => Promise<void>): Promise<void>
  callAll(first: () => void, second: () => void, third: () => void): void
  callWithOptional(value: number | undefined, callback: (maybe: number | undefined) => void): void
  callSumUpNTimes(callback: () => number, n: number): Promise<number>
  callbackAsyncPromise(callback: () => Promise<number>): Promise<number>
  callbackAsyncPromiseBuffer(callback: () => Promise<ArrayBuffer>): Promise<ArrayBuffer>
  getComplexCallback(): (value: number) => void
  twoOptionalCallbacks(value: number, first?: (value: number) => void, second?: (value: string) => void): void
  errorCallback(onError: (error: Error) => void): void
  createNativeCallback(wrappingJsCallback: (num: number) => void): (num: number) => void

  // Callbacks that return values
  getValueFromJSCallbackAndWait(getValue: () => number): Promise<number>
  getValueFromJsCallback(callback: () => string, andThenCall: (valueFromJs: string) => void): Promise<void>

  // Callback calling conventions
  callSyncCallback(value: number, callback: (value: number) => void): void
  callAsyncCallback(value: number, callback: (value: number) => number): Promise<number>
  callAsyncVoidCallback(callback: () => void): Promise<void>
  callAsyncBooleanCallback(value: boolean, callback: (value: boolean) => boolean): Promise<boolean>
  awaitAsyncCallback(value: number, callback: (value: number) => number): Promise<number>
  callAndForgetCallback(value: number, callback: (value: number) => number): void
  callNativeCallbackAsync(value: number): Promise<number>
  callThrowingNativeCallbackAsync(message: string): Promise<void>
  callThrowingNativeCallbackAndForget(message: string): void
  callInlineCallbackThenEscape(value: number, callback: Inline<(value: number) => number>): Promise<number>

  // Objects
  getCar(): Car
  isCarElectric(car: Car): boolean
  areCarsEqual(a: Car, b: Car): boolean
  getDriver(car: Car): Person | undefined
  bounceCar(car: Car): Car
  jsStyleObjectAsParameters(params: JsStyleStruct): void
  roundtripUnsignedScalar(value: UnsignedScalar): UnsignedScalar
  roundtripUnsignedValues(value: UnsignedValues): UnsignedValues
  bounceWrappedJsStyleStruct(value: WrappedJsStruct): WrappedJsStruct
  bounceOptionalWrapper(wrapper: OptionalWrapper): OptionalWrapper
  bounceOptionalCallback(value: OptionalCallback): OptionalCallback
  bounceOptionalEnumStruct(value?: OptionalEnumWrapper): OptionalEnumWrapper | undefined

  // ArrayBuffers
  createArrayBuffer(): ArrayBuffer
  createArrayBufferFromNativeBuffer(copy: boolean): ArrayBuffer
  // On Android this creates an actual `HardwareBuffer` and wraps it,
  // on iOS/C++ it creates a normal `ArrayBuffer` of the same byte size.
  createHardwareBuffer(width: number, height: number, layers: number, format: HardwareBufferFormat): ArrayBuffer
  copyBuffer(buffer: ArrayBuffer): ArrayBuffer
  getBufferLastItem(buffer: ArrayBuffer): number
  setAllValuesTo(buffer: ArrayBuffer, value: number): void
  createArrayBufferAsync(): Promise<ArrayBuffer>
  bounceArrayBuffer(buffer: ArrayBuffer): ArrayBuffer

  // Complex variants
  passVariant(either: number | string | number[] | string[] | boolean): number | string
  getVariantEnum(variant: OldEnum | boolean): OldEnum | boolean
  bounceVariantUnionEnum(variant: Powertrain | Car): Powertrain | Car
  getVariantWeirdNumbersEnum(variant: WeirdNumbersEnum | boolean): WeirdNumbersEnum | boolean
  getVariantObjects(variant: Person | Car): Person | Car
  passNamedVariant(variant: NamedVariant): NamedVariant
  passAllEmptyObjectVariant(variant: OptionalWrapper | Base): OptionalWrapper | Base
  bounceComplexVariant(variant: CoreTypesVariant): CoreTypesVariant

  // Inheritance
  createChild(): Child
  createBase(): Base
  createBaseActualChild(): Base
  createGrandchild(): Grandchild
  createChildActualGrandchild(): Child
  createBaseActualGrandchild(): Base
  bounceGrandchild(grandchild: Grandchild): Grandchild
  bounceChild(child: Child): Child
  bounceBase(base: Base): Base
  bounceChildBase(child: Child): Base
  castBase(base: Base): Child

  // C++ calls the declared Swift implementation through its adapter.
  retainedBase?: Base
  readBaseValue(base: Base): number
  readChildBaseValue(child: Child): number
  bounceSizeThroughBase(base: Base, size: Size): Size
  mapSizeThroughBase(base: Base, size: Size, callback: (size: Size) => Size): Promise<Size>
  bounceVariantThroughChild(child: Child, variant: NamedVariant): NamedVariant
  readExternalValue(externalObject: SomeExternalObject): string
  createExternalOptionalPrimitives(
    externalObject: SomeExternalObject,
    optionalNumber?: number,
    optionalBoolean?: boolean,
    optionalUInt64?: UInt64,
    optionalInt64?: Int64
  ): OptionalPrimitivesHolder
  createAlternativeBase(): Base

  // A separate hierarchy keeps coverage of native C++ inheritance.
  createCppBase(): CppBase
  createCppChild(): CppChild
  createCppGrandchild(): CppGrandchild
  createCppBaseActualChild(): CppBase
  bounceCppBase(base: CppBase): CppBase
  castCppBase(base: CppBase): CppChild

  // Sync funcs
  callbackSync(callback: () => number): number
  getSyncNumberCallback(): () => number
  bounceSyncInt64Callback(callback: (value: Int64) => Int64): (value: Int64) => Int64

  // External HybridObjects
  bounceExternalHybrid(externalObject: SomeExternalObject): SomeExternalObject
  createInternalObject(): SomeExternalObject
  bounceExternalStruct(externalStruct: ExternalObjectStruct): ExternalObjectStruct
  bounceExternalVariant(variant: StringOrExternal): StringOrExternal
  createExternalVariantFromFunc(factory: () => SomeExternalObject): SomeExternalObject

  // Complex Variants + Tuples
  getVariantTuple(variant: Float2 | Float3): Float2 | Float3

  // Tuples
  someTuple: [number, string]
  flip(tuple: Float3): Float3
  passTuple(tuple: TestTuple): [number, string, boolean]

  // Type-specifics
  readonly thisObject: TestObjectCpp
  newTestObject(): TestObjectCpp
  // Returns a HybridObject from a Promise resolved off the JS thread. Used to reproduce the data
  // race between resolve() and JSIConverter::toJSI.
  newTestObjectAsync(): Promise<TestObjectCpp>
  optionalHybrid?: TestObjectCpp
  getVariantHybrid(variant: TestObjectCpp | Person): TestObjectCpp | Person
  getVariantHybridEnum(variant: TestObjectCpp | Powertrain): TestObjectCpp | Powertrain

  // Any HybridObject
  bounceAnyHybrid(object: AnyHybridObject): AnyHybridObject

  // Custom C++ JSI Converters
  bounceCustomType(value: CustomString): CustomString
}

// This is a Swift/Kotlin-based `HybridObject`.
@iOS({
  language: 'swift',
  implementation: { className: 'HybridTestObjectSwift' },
})
@Android({
  language: 'kotlin',
  implementation: { className: 'HybridTestObjectKotlin' },
})
export declare class TestObjectSwiftKotlin extends HybridObject {
  constructor()

  static readonly readonlyNumber: number
  static sharedNumber: number

  // Test Static Methods
  static staticAdd(a: number, b: number): number
  static staticNegate(value: boolean): boolean
  static staticConcat(a: string, b: string): string
  static staticBouncePoint(point: StaticPoint): StaticPoint
  static staticThrow(message: string): void

  // Test Primitives
  computedValue: number
  numberValue: number
  boolValue: boolean
  stringValue: string
  int64Value: Int64
  uint64Value: UInt64
  nullValue: null
  optionalString?: string
  stringOrUndefined: string | undefined
  stringOrNull: string | null
  optionalArray?: string[]
  optionalEnum?: Powertrain
  optionalOldEnum?: OldEnum
  optionalEnumPlusOne?: TruckPowertrain
  optionalCallback?: (value: number) => void

  // Kotlin/Swift simplify boolean names (has*/is*)
  readonly hasBoolean: boolean
  readonly isBoolean: boolean
  hasBooleanWritable: boolean
  isBooleanWritable: boolean
  // Kotlin only simplifies `is*` when it is not followed by a lowercase letter,
  // and it does so for every type - not just booleans.
  isolatedBoolean: boolean
  isTextValue: string

  // Basic function tests
  simpleFunc(): void
  addNumbers(a: number, b: number): number
  addStrings(a: string, b: string): string
  multipleArguments(num: number, str: string, boo: boolean): void
  bounceNull(value: null): null

  // Arrays
  bounceStrings(array: string[]): string[]
  bounceNumbers(array: number[]): number[]
  bounceStructs(array: Person[]): Person[]
  bounceNestedArray(array: Person[][]): Person[][]
  bouncePartialStruct(person: PartialPerson): PartialPerson
  sumUpAllPassengers(cars: Car[]): string
  bounceEnums(array: Powertrain[]): Powertrain[]
  complexEnumCallback(array: Powertrain[], callback: (array: Powertrain[]) => void): void

  // Container callbacks and promises
  callEnumArrayCallback(array: Powertrain[], callback: (array: Powertrain[]) => Powertrain[]): Powertrain[]
  getEnumArrayCallback(): (array: Powertrain[]) => Powertrain[]
  callEnumArrayPromiseCallback(callback: () => Promise<Powertrain[]>): Promise<Powertrain[]>
  awaitEnumArrayPromise(promise: Promise<Powertrain[]>): Promise<Powertrain[]>
  callNestedStructCallback(
    value: (Person | undefined)[][],
    callback: (value: (Person | undefined)[][]) => (Person | undefined)[][]
  ): (Person | undefined)[][]

  // Arrays (complex)
  bounceHybridObjects(array: Child[]): Child[]
  bounceFunctions(functions: (() => void)[]): (() => void)[]
  bounceMaps(maps: AnyJSON[]): AnyJSON[]
  bouncePromises(promises: Promise<number>[]): Promise<number>[]
  bounceArrayBuffers(arrayBuffers: ArrayBuffer[]): ArrayBuffer[]
  bounceOptionals(strings: (string | undefined)[], arrayBuffers: (ArrayBuffer | undefined)[]): (string | undefined)[]
  bounceNulls(strings: (string | null)[]): (string | null)[]
  bounceOptionalNulls(strings: (string | null | undefined)[]): (string | null | undefined)[]

  // Maps
  createMap(): AnyJSON
  mapRoundtrip(map: AnyJSON): AnyJSON
  getMapKeys(map: AnyJSON): string[]
  mergeMaps(a: AnyJSON, b: AnyJSON): AnyJSON
  copyAnyMap(map: AnyJSON): AnyJSON

  // Typed Maps (records)
  bounceMap(map: Record<string, number | boolean>): Record<string, number | boolean>
  bounceSimpleMap(map: Record<string, number>): Record<string, number>
  bounceOptionalMap(map: Record<string, string | undefined>): Record<string, string | undefined>
  bounceNullMap(map: Record<string, string | null>): Record<string, string | null>
  bounceOptionalNullMap(map: Record<string, string | null | undefined>): Record<string, string | null | undefined>
  extractMap(mapWrapper: MapWrapper): MapWrapper['map']

  // Errors
  funcThatThrows(): number
  funcThatThrowsBeforePromise(): Promise<void>
  throwError(error: Error): void

  // Optional parameters
  tryOptionalParams(num: number, boo: boolean, str?: string): string
  tryMiddleParam(num: number, boo: boolean | undefined, str: string): string
  tryOptionalEnum(value?: Powertrain): Powertrain | undefined
  tryTrailingOptional(num: number, str: string, boo?: boolean): boolean

  // Variants
  someVariant: number | string

  // Promises
  calculateFibonacciSync(value: number): Int64
  calculateFibonacciAsync(value: number): Promise<Int64>
  wait(seconds: number): Promise<void>
  promiseThrows(): Promise<void>
  promiseReturnsInstantly(): Promise<number>
  promiseReturnsInstantlyAsync(): Promise<number>
  // Stays pending until the separate JS call schedules its native completion.
  // Only one Promise may be waiting for that trigger on each TestObject.
  createPendingPromise(): Promise<number>
  resolvePendingPromiseOnWorker(): void
  promiseThatResolvesVoidInstantly(): Promise<void>
  promiseThatResolvesToUndefined(): Promise<number | undefined>
  awaitNullablePromise(): Promise<number | undefined>

  // Complex Promises
  awaitAndGetPromise(promise: Promise<number>): Promise<number>
  awaitAndGetComplexPromise(promise: Promise<Car>): Promise<Car>
  awaitPromise(promise: Promise<void>): Promise<void>

  // Callbacks
  callCallback(callback: () => void): void
  callInlineCallback(callback: Inline<() => void>): void
  callInlineCallbackWithValue(value: number, callback: Inline<(value: number) => number>): number
  callCallbackThatReturnsPromiseVoid(callback: () => Promise<void>): Promise<void>
  callAll(first: () => void, second: () => void, third: () => void): void
  callWithOptional(value: number | undefined, callback: (maybe: number | undefined) => void): void
  callSumUpNTimes(callback: () => number, n: number): Promise<number>
  callbackAsyncPromise(callback: () => Promise<number>): Promise<number>
  callbackAsyncPromiseBuffer(callback: () => Promise<ArrayBuffer>): Promise<ArrayBuffer>
  getComplexCallback(): (value: number) => void
  twoOptionalCallbacks(value: number, first?: (value: number) => void, second?: (value: string) => void): void
  errorCallback(onError: (error: Error) => void): void
  createNativeCallback(wrappingJsCallback: (num: number) => void): (num: number) => void

  // Callbacks that return values
  getValueFromJSCallbackAndWait(getValue: () => number): Promise<number>
  getValueFromJsCallback(callback: () => string, andThenCall: (valueFromJs: string) => void): Promise<void>

  // Callback calling conventions
  callSyncCallback(value: number, callback: (value: number) => void): void
  callAsyncCallback(value: number, callback: (value: number) => number): Promise<number>
  callAsyncVoidCallback(callback: () => void): Promise<void>
  callAsyncBooleanCallback(value: boolean, callback: (value: boolean) => boolean): Promise<boolean>
  awaitAsyncCallback(value: number, callback: (value: number) => number): Promise<number>
  callAndForgetCallback(value: number, callback: (value: number) => number): void
  callNativeCallbackAsync(value: number): Promise<number>
  callThrowingNativeCallbackAsync(message: string): Promise<void>
  callThrowingNativeCallbackAndForget(message: string): void
  callInlineCallbackThenEscape(value: number, callback: Inline<(value: number) => number>): Promise<number>

  // Objects
  getCar(): Car
  isCarElectric(car: Car): boolean
  areCarsEqual(a: Car, b: Car): boolean
  getDriver(car: Car): Person | undefined
  bounceCar(car: Car): Car
  jsStyleObjectAsParameters(params: JsStyleStruct): void
  roundtripUnsignedScalar(value: UnsignedScalar): UnsignedScalar
  roundtripUnsignedValues(value: UnsignedValues): UnsignedValues
  bounceWrappedJsStyleStruct(value: WrappedJsStruct): WrappedJsStruct
  bounceOptionalWrapper(wrapper: OptionalWrapper): OptionalWrapper
  bounceOptionalCallback(value: OptionalCallback): OptionalCallback
  bounceOptionalEnumStruct(value?: OptionalEnumWrapper): OptionalEnumWrapper | undefined

  // ArrayBuffers
  createArrayBuffer(): ArrayBuffer
  createArrayBufferFromNativeBuffer(copy: boolean): ArrayBuffer
  // On Android this creates an actual `HardwareBuffer` and wraps it,
  // on iOS/C++ it creates a normal `ArrayBuffer` of the same byte size.
  createHardwareBuffer(width: number, height: number, layers: number, format: HardwareBufferFormat): ArrayBuffer
  copyBuffer(buffer: ArrayBuffer): ArrayBuffer
  getBufferLastItem(buffer: ArrayBuffer): number
  setAllValuesTo(buffer: ArrayBuffer, value: number): void
  createArrayBufferAsync(): Promise<ArrayBuffer>
  bounceArrayBuffer(buffer: ArrayBuffer): ArrayBuffer

  // Complex variants
  passVariant(either: number | string | number[] | string[] | boolean): number | string
  getVariantEnum(variant: OldEnum | boolean): OldEnum | boolean
  bounceVariantUnionEnum(variant: Powertrain | Car): Powertrain | Car
  getVariantWeirdNumbersEnum(variant: WeirdNumbersEnum | boolean): WeirdNumbersEnum | boolean
  getVariantObjects(variant: Person | Car): Person | Car
  passNamedVariant(variant: NamedVariant): NamedVariant
  passAllEmptyObjectVariant(variant: OptionalWrapper | Base): OptionalWrapper | Base
  bounceComplexVariant(variant: CoreTypesVariant): CoreTypesVariant

  // Inheritance
  createChild(): Child
  createBase(): Base
  createBaseActualChild(): Base
  createGrandchild(): Grandchild
  createChildActualGrandchild(): Child
  createBaseActualGrandchild(): Base
  bounceGrandchild(grandchild: Grandchild): Grandchild
  bounceChild(child: Child): Child
  bounceBase(base: Base): Base
  bounceChildBase(child: Child): Base
  castBase(base: Base): Child

  // Sync funcs
  callbackSync(callback: () => number): number
  getSyncNumberCallback(): () => number
  bounceSyncInt64Callback(callback: (value: Int64) => Int64): (value: Int64) => Int64

  // External HybridObjects
  bounceExternalHybrid(externalObject: SomeExternalObject): SomeExternalObject
  createInternalObject(): SomeExternalObject
  bounceExternalStruct(externalStruct: ExternalObjectStruct): ExternalObjectStruct
  bounceExternalVariant(variant: StringOrExternal): StringOrExternal
  createExternalVariantFromFunc(factory: () => SomeExternalObject): SomeExternalObject

  // Type-specifics
  readonly thisObject: TestObjectSwiftKotlin
  bounceCppOnlyValue(value: CppOnlyValue): CppOnlyValue
  newTestObject(): TestObjectSwiftKotlin
  newTestObjectAsync(): Promise<TestObjectSwiftKotlin>
  optionalHybrid?: TestObjectSwiftKotlin
  getVariantHybrid(variant: TestObjectSwiftKotlin | Person): TestObjectSwiftKotlin | Person
}
