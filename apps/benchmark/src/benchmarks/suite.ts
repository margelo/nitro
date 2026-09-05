import {
  HybridTestObjectCpp,
  HybridTestObjectSwiftKotlin,
  type Car,
  type TestObjectCpp,
  type TestObjectSwiftKotlin,
} from 'react-native-nitro-test'
import { Platform } from 'react-native'
import { ExampleTurboModule } from '../turbo-module/ExampleTurboModule'
import type { BenchmarkDefinition, BenchmarkImplementation } from './types'

type TestObject = TestObjectCpp | TestObjectSwiftKotlin

const smallNumbers = Array.from({ length: 16 }, (_, index) => index + 1)
const largeNumbers = Array.from({ length: 1024 }, (_, index) => index + 1)
const smallBuffer = new ArrayBuffer(4 * 1024)
const largeBuffer = new ArrayBuffer(1024 * 1024)

const car: Car = {
  year: 2026,
  make: 'Margelo',
  model: 'Nitro',
  power: 900,
  powertrain: 'electric',
  driver: { name: 'Marc', age: 30 },
  passengers: [
    { name: 'Ada', age: 36 },
    { name: 'Grace', age: 40 },
  ],
  isFast: true,
  favouriteTrack: 'Spa-Francorchamps',
  performanceScores: [9.8, 9.9, 10],
  someVariant: 'fast',
}

const typedMap: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
}

function assertNumber(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} returned a non-finite checksum.`)
  }
  return value
}

function sumFromOne(count: number): number {
  return (count * (count + 1)) / 2
}

function sumFromZero(count: number): number {
  return (count * (count - 1)) / 2
}

function repeatedSequenceSum(iterations: number, length: number): number {
  const completeSequences = Math.floor(iterations / length)
  const remainder = iterations % length
  return completeSequences * sumFromOne(length) + sumFromOne(remainder)
}

function addNumbersChecksum(iterations: number): number {
  return repeatedSequenceSum(iterations, 1_000) + iterations * 2
}

function variantChecksum(iterations: number): number {
  const evenCount = Math.ceil(iterations / 2)
  const oddCount = Math.floor(iterations / 2)
  return evenCount * (evenCount - 1) + oddCount * 'nitro'.length
}

function collectJavaGarbage(): void {
  if (!ExampleTurboModule.collectGarbage())
    throw new Error('Java heap cleanup failed.')
}

function createObjectBenchmarks(
  object: TestObject,
  implementation: BenchmarkImplementation
): BenchmarkDefinition[] {
  const prefix = implementation
  const synchronousCallback = () => 1
  return [
    {
      id: `${prefix}/primitive/simple-func`,
      version: 2,
      family: 'primitive',
      implementation,
      kind: 'sync',
      expectedChecksum: sumFromOne,
      run(iterations) {
        let checksum = 0
        for (let index = 0; index < iterations; index++) {
          object.simpleFunc()
          checksum += index + 1
        }
        return assertNumber(checksum, 'simpleFunc')
      },
    },
    {
      id: `${prefix}/primitive/add-numbers`,
      version: 2,
      family: 'primitive',
      implementation,
      kind: 'sync',
      expectedChecksum: addNumbersChecksum,
      run(iterations) {
        let checksum = 0
        for (let index = 0; index < iterations; index++) {
          checksum += object.addNumbers(index % 1_000, 3)
        }
        return assertNumber(checksum, 'addNumbers')
      },
    },
    {
      id: `${prefix}/property/number-get-set`,
      version: 2,
      family: 'property',
      implementation,
      kind: 'sync',
      expectedChecksum: sumFromZero,
      run(iterations) {
        let checksum = 0
        for (let index = 0; index < iterations; index++) {
          object.numberValue = index
          checksum += object.numberValue
        }
        return assertNumber(checksum, 'numberValue')
      },
    },
    {
      id: `${prefix}/string/ascii-short`,
      version: 2,
      family: 'string',
      implementation,
      kind: 'sync',
      maxChunkIterations: 50_000,
      expectedChecksum: (iterations) => iterations * 12,
      run(iterations) {
        let checksum = 0
        for (let index = 0; index < iterations; index++) {
          checksum += object.addStrings('Nitro', 'Modules').length
        }
        return assertNumber(checksum, 'addStrings ASCII')
      },
    },
    {
      id: `${prefix}/string/unicode`,
      version: 2,
      family: 'string',
      implementation,
      kind: 'sync',
      maxChunkIterations: 50_000,
      expectedChecksum: (iterations) => iterations * 10,
      run(iterations) {
        let checksum = 0
        for (let index = 0; index < iterations; index++) {
          checksum += object.addStrings('🚀γειά', '世界🧪').length
        }
        return assertNumber(checksum, 'addStrings Unicode')
      },
    },
    createArrayBenchmark(object, implementation, 'small-16', smallNumbers),
    createArrayBenchmark(object, implementation, 'large-1024', largeNumbers),
    {
      id: `${prefix}/struct/nested-car`,
      version: 2,
      family: 'struct',
      implementation,
      kind: 'sync',
      maxChunkIterations: 5_000,
      expectedChecksum: (iterations) => iterations * 902,
      run(iterations) {
        let checksum = 0
        for (let index = 0; index < iterations; index++) {
          const result = object.bounceCar(car)
          checksum += result.power + result.passengers.length
        }
        return assertNumber(checksum, 'bounceCar')
      },
    },
    {
      id: `${prefix}/map/typed-eight-entries`,
      version: 2,
      family: 'map',
      implementation,
      kind: 'sync',
      maxChunkIterations: 5_000,
      expectedChecksum: (iterations) => iterations * 7,
      run(iterations) {
        let checksum = 0
        for (let index = 0; index < iterations; index++) {
          checksum += object.bounceSimpleMap(typedMap).seven ?? 0
        }
        return assertNumber(checksum, 'bounceSimpleMap')
      },
    },
    {
      id: `${prefix}/optional/trailing-string`,
      version: 2,
      family: 'optional',
      implementation,
      kind: 'sync',
      maxChunkIterations: 50_000,
      expectedChecksum: (iterations) =>
        Math.ceil(iterations / 2) * 5 + Math.floor(iterations / 2) * 14,
      run(iterations) {
        let checksum = 0
        for (let index = 0; index < iterations; index++) {
          const result = object.tryOptionalParams(
            index,
            true,
            index % 2 === 0 ? 'nitro' : undefined
          )
          checksum += result.length
        }
        return assertNumber(checksum, 'tryOptionalParams')
      },
    },
    {
      id: `${prefix}/variant/number-or-string`,
      version: 2,
      family: 'variant',
      implementation,
      kind: 'sync',
      maxChunkIterations: 50_000,
      expectedChecksum: variantChecksum,
      run(iterations) {
        let checksum = 0
        for (let index = 0; index < iterations; index++) {
          const result = object.passVariant(index % 2 === 0 ? index : 'nitro')
          checksum += typeof result === 'number' ? result : result.length
        }
        return assertNumber(checksum, 'passVariant')
      },
    },
    {
      id: `${prefix}/hybrid-object/create`,
      version: 2,
      family: 'hybrid-object',
      implementation,
      kind: 'sync',
      // Bound live JVM references; the runner collects between timed chunks
      // and accumulates enough chunks for a full ~150 ms measured sample.
      maxChunkIterations: 5_000,
      expectedChecksum: sumFromOne,
      run(iterations) {
        let checksum = 0
        for (let index = 0; index < iterations; index++) {
          checksum += object.newTestObject().addNumbers(index, 1)
        }
        return assertNumber(checksum, 'newTestObject')
      },
    },
    {
      id: `${prefix}/hybrid-object/return-existing`,
      version: 2,
      family: 'hybrid-object',
      implementation,
      kind: 'sync',
      maxChunkIterations: 50_000,
      expectedChecksum: sumFromOne,
      run(iterations) {
        let checksum = 0
        for (let index = 0; index < iterations; index++) {
          checksum += object.thisObject.addNumbers(index, 1)
        }
        return assertNumber(checksum, 'thisObject')
      },
    },
    createBufferBenchmark(
      object,
      implementation,
      'bounce-4-kib',
      smallBuffer,
      'bounce'
    ),
    createBufferBenchmark(
      object,
      implementation,
      'bounce-1-mib',
      largeBuffer,
      'bounce'
    ),
    createBufferBenchmark(
      object,
      implementation,
      'bounce-native-4-kib',
      object.copyBuffer(smallBuffer),
      'bounce'
    ),
    createBufferBenchmark(
      object,
      implementation,
      'bounce-native-1-mib',
      object.copyBuffer(largeBuffer),
      'bounce'
    ),
    createBufferBenchmark(
      object,
      implementation,
      'copy-4-kib',
      smallBuffer,
      'copy'
    ),
    createBufferBenchmark(
      object,
      implementation,
      'copy-1-mib',
      largeBuffer,
      'copy'
    ),
    {
      id: `${prefix}/callback/synchronous`,
      version: 2,
      family: 'callback',
      implementation,
      kind: 'sync',
      maxChunkIterations: 50_000,
      expectedChecksum: (iterations) => iterations,
      run(iterations) {
        let checksum = 0
        for (let index = 0; index < iterations; index++) {
          checksum += object.callbackSync(synchronousCallback)
        }
        return assertNumber(checksum, 'callbackSync')
      },
    },
    {
      id: `${prefix}/promise/immediate`,
      version: 2,
      family: 'promise',
      implementation,
      kind: 'async',
      // Release fulfilled Promise chains between chunks, outside the timer.
      maxChunkIterations: 5_000,
      collectNativeGarbage:
        implementation === 'nitro-platform' && Platform.OS === 'android'
          ? collectJavaGarbage
          : undefined,
      expectedChecksum: (iterations) => iterations * 55,
      async run(iterations) {
        let checksum = 0
        for (let index = 0; index < iterations; index++) {
          checksum += await object.promiseReturnsInstantly()
        }
        return assertNumber(checksum, 'promiseReturnsInstantly')
      },
    },
    {
      id: `${prefix}/promise/deferred-worker-with-trigger`,
      version: 1,
      family: 'promise',
      implementation,
      kind: 'async',
      maxChunkIterations: 5_000,
      collectNativeGarbage:
        implementation === 'nitro-platform' && Platform.OS === 'android'
          ? collectJavaGarbage
          : undefined,
      expectedChecksum: (iterations) => iterations * 55,
      async run(iterations) {
        let checksum = 0
        for (let index = 0; index < iterations; index++) {
          const promise = object.createPendingPromise()
          // Includes the trigger call: completion cannot race ahead of the
          // pending Promise's conversion to JS in createPendingPromise().
          object.resolvePendingPromiseOnWorker()
          checksum += await promise
        }
        return assertNumber(checksum, 'resolvePendingPromiseOnWorker')
      },
    },
  ]
}

function createArrayBenchmark(
  object: TestObject,
  implementation: BenchmarkImplementation,
  name: string,
  input: number[]
): BenchmarkDefinition {
  return {
    id: `${implementation}/array/${name}`,
    version: 2,
    family: 'array',
    implementation,
    kind: 'sync',
    maxChunkIterations: input.length >= 1_024 ? 1_000 : 10_000,
    expectedChecksum: (iterations) =>
      repeatedSequenceSum(iterations, input.length),
    run(iterations) {
      let checksum = 0
      for (let index = 0; index < iterations; index++) {
        const result = object.bounceNumbers(input)
        checksum += result[index % result.length] ?? 0
      }
      return assertNumber(checksum, `bounceNumbers ${name}`)
    },
  }
}

function createBufferBenchmark(
  object: TestObject,
  implementation: BenchmarkImplementation,
  name: string,
  input: ArrayBuffer,
  operation: 'bounce' | 'copy'
): BenchmarkDefinition {
  // Android direct ByteBuffers use ART's non-moving heap. Leave room for the
  // Java/HybridData cleaner stages as well as Hermes GC. Collect both heaps
  // between bounded copy chunks; cleanup is not part of the copy measurement.
  const javaBuffer =
    implementation === 'nitro-platform' && Platform.OS === 'android'
  return {
    id: `${implementation}/array-buffer/${name}`,
    version: 2,
    family: 'array-buffer',
    implementation,
    kind: 'sync',
    // Bounce does not copy the payload; its chunk bound is independent of size.
    maxChunkIterations:
      operation === 'bounce'
        ? 50_000
        : input.byteLength >= 1024 * 1024
          ? javaBuffer
            ? 10
            : 50
          : 5_000,
    collectNativeGarbage:
      javaBuffer && operation === 'copy' ? collectJavaGarbage : undefined,
    expectedChecksum: (iterations) =>
      input.byteLength * iterations + Math.floor(iterations / 2),
    run(iterations) {
      let checksum = 0
      for (let index = 0; index < iterations; index++) {
        const result =
          operation === 'bounce'
            ? object.bounceArrayBuffer(input)
            : object.copyBuffer(input)
        checksum += result.byteLength + (index % 2)
      }
      return assertNumber(checksum, `${operation}Buffer ${name}`)
    },
  }
}

export function createBenchmarkSuite(): BenchmarkDefinition[] {
  const javascript = {
    addNumbers: (left: number, right: number) => left + right,
  }
  const controls: BenchmarkDefinition[] = [
    {
      id: 'javascript/control/add-numbers',
      version: 2,
      family: 'control',
      implementation: 'javascript',
      kind: 'sync',
      expectedChecksum: addNumbersChecksum,
      run(iterations) {
        let checksum = 0
        for (let index = 0; index < iterations; index++) {
          checksum += javascript.addNumbers(index % 1_000, 3)
        }
        return assertNumber(checksum, 'JavaScript addNumbers')
      },
    },
    {
      id: 'turbo-module/control/add-numbers',
      version: 2,
      family: 'control',
      implementation: 'turbo-module',
      kind: 'sync',
      expectedChecksum: addNumbersChecksum,
      run(iterations) {
        let checksum = 0
        for (let index = 0; index < iterations; index++) {
          checksum += ExampleTurboModule.addNumbers(index % 1_000, 3)
        }
        return assertNumber(checksum, 'TurboModule addNumbers')
      },
    },
  ]

  return [
    ...controls,
    ...createObjectBenchmarks(HybridTestObjectCpp, 'nitro-cpp'),
    ...createObjectBenchmarks(HybridTestObjectSwiftKotlin, 'nitro-platform'),
  ]
}
