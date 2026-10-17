import type {
  Car,
  CustomString,
  HardwareBufferFormat,
  OptionalEnumWrapper,
  OptionalWrapper,
  Person,
  WrappedJsStruct,
} from "../../specs/TestObject.nitro";

export const TEST_PERSON: Person = {
  age: 24,
  name: "Marc",
};
export const TEST_CAR: Car = {
  year: 2018,
  make: "Lamborghini",
  model: "Huracan Performante",
  power: 640,
  powertrain: "gas",
  driver: undefined, // <-- value needs to be explicitly set, to equal it with native's std::optional<..>
  passengers: [
    { age: 25, name: "Sebastian" },
    { age: 27, name: "Daniel" },
  ],
  isFast: true,
  favouriteTrack: undefined,
  performanceScores: [100, 0],
  someVariant: undefined,
};
export const TEST_CAR_2: Car = {
  year: 2006,
  make: "Mitsubishi",
  model: "Evolution IX",
  power: 280,
  powertrain: "gas",
  driver: TEST_PERSON,
  passengers: [
    { age: 18, name: "Lukas" },
    { age: 23, name: "Simon" },
  ],
  isFast: true,
  favouriteTrack: "the road",
  performanceScores: [2, 5],
  someVariant: "hello!",
};
export const TEST_MAP: Record<string, number | boolean> = {
  someKey: 55,
  some_other_key: 123,
  a_bool: true,
  another_bool: false,
};

// All pixel-based HardwareBuffer formats and their bytes-per-pixel
export const HARDWARE_BUFFER_FORMATS: {
  format: HardwareBufferFormat;
  bytesPerPixel: number;
}[] = [
  { format: "rgb-565", bytesPerPixel: 2 },
  { format: "rgba-8888", bytesPerPixel: 4 },
  { format: "rgba-fp16", bytesPerPixel: 8 },
];

export const TEST_MAP_2: Record<string, string> = {
  someKey: "someValue",
  anotherKey: "another-value",
  "third-key": "thirdValue",
};

export const TEST_MAP_3: Record<string, number> = {
  first: 14,
  second: 8247,
};

export const TEST_MAP_4: Record<
  string,
  number | boolean | string | bigint | null | Array<number>
> = {
  someKey: 55,
  some_other_key: 123,
  a_bool: true,
  another_bool: false,
  a_string: "hello",
  a_bigint: 1234567890n,
  a_null: null,
  a_array: [1, 2, 3],
};

export const TEST_WRAPPED_STRUCT: WrappedJsStruct = {
  value: {
    value: 55.3,
    onChanged: (_num: number) => {},
  },
  items: [],
};
export const TEST_OPTIONAL_WRAPPER: OptionalWrapper = {
  optionalArrayBuffer: new ArrayBuffer(1024),
  optionalString: "hello!",
};
export const TEST_OPTIONAL_ENUM_WRAPPER: OptionalEnumWrapper = {
  count: 7,
  weight: 1.5,
  ttl: 30000,
  jitter: 50,
  retries: 3,
  delayMs: 250,
  timeoutMs: 60000,
  ratio: 0.75,
  threshold: 100,
  enabled: true,
  active: false,
  shouldBuffer: true,
  shouldRetry: false,
  verbose: true,
  tier: "electric",
  region: "gas",
  stage: "hybrid",
  tone: "electric",
};
export const TEST_CUSTOM_TYPE: CustomString = "hello world!";

/**
 * A JS reference implementation of `TestObject.sumUpAllPassengers(...)`.
 */
export function sumUpAllPassengers(cars: Car[]): string {
  return cars
    .flatMap((c) =>
      c.passengers.flatMap((p) => `${p.name} (${p.age.toFixed(0)})`),
    )
    .join(", ");
}
