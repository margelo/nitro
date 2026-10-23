import { expect } from 'chai'
import { casesForTestObjects, waitFor } from './utils/cases'

import { NitroModules } from 'nitro-core'

import { HARDWARE_BUFFER_FORMATS } from './utils/fixtures'

import { isKotlin, type TestObject } from './utils/testObjects'

const LARGE_BUFFER_SIZE = 16 * 1024 * 1024

// `createArrayBuffer()` allocates 10 MiB on every platform
const NATIVE_ARRAY_BUFFER_SIZE = 10 * 1024 * 1024

// The bytes `fillTestPattern(...)` writes at the indices it returns
const TEST_PATTERN = [0, 255, 17, 42]

/**
 * Fills {@linkcode array} with a recognizable pattern and returns the indices
 * the tests sample: the first byte, a marker at 73, the middle and the last
 * byte.
 */
function fillTestPattern(array: Uint8Array): number[] {
  array.fill(17)
  array[0] = 0
  array[73] = 255
  const last = array.length - 1
  array[last] = 42
  return [0, 73, Math.floor(array.length / 2), last]
}

function bytesAt(array: Uint8Array, indices: number[]): number[] {
  return indices.map((index) => array[index])
}

const WRAPPED_BUFFER_COUNT = 100
const WRAPPED_BUFFER_SIZE = 1024

function wrapArrayBuffers(testObject: TestObject): ArrayBuffer[] {
  const buffers: ArrayBuffer[] = []
  for (let i = 0; i < WRAPPED_BUFFER_COUNT; i++) {
    const buffer = testObject.wrapArrayBuffer(WRAPPED_BUFFER_SIZE)
    expect(buffer.byteLength).to.equal(WRAPPED_BUFFER_SIZE)
    buffers.push(buffer)
  }
  return buffers
}

/**
 * Wraps buffers without keeping a JS reference to them after returning.
 */
function wrapAndDropArrayBuffers(testObject: TestObject): void {
  wrapArrayBuffers(testObject)
}

/**
 * Creates a JS ArrayBuffer of {@linkcode size} bytes where byte `i` is `i % 256`.
 */
function createCountingBuffer(size: number): ArrayBuffer {
  const array = new Uint8Array(size)
  for (let i = 0; i < size; i++) {
    array[i] = i % 256
  }
  return array.buffer
}

export const cases = {
  ...casesForTestObjects('ArrayBuffers', {
    'createArrayBuffer() returns a 10 MiB ArrayBuffer': (testObject) => {
      const buffer = testObject.createArrayBuffer()
      expect(buffer).to.be.instanceOf(ArrayBuffer)
      expect(Object.is(buffer.byteLength, NATIVE_ARRAY_BUFFER_SIZE)).to.equal(true)
    },

    'createArrayBufferFromNativeBuffer(copy) returns an ArrayBuffer': (testObject) => {
      const buffer = testObject.createArrayBufferFromNativeBuffer(true)
      expect(buffer).to.be.instanceOf(ArrayBuffer)
      expect(buffer.byteLength).to.be.greaterThan(0)
    },

    'createArrayBufferFromNativeBuffer(wrap) returns an ArrayBuffer': (testObject) => {
      const buffer = testObject.createArrayBufferFromNativeBuffer(false)
      expect(buffer).to.be.instanceOf(ArrayBuffer)
      expect(buffer.byteLength).to.be.greaterThan(0)
    },

    'getBufferLastItem(...) returns the last byte': (testObject) => {
      const buffer = new Uint8Array([13, 20, 55])
      expect(Object.is(testObject.getBufferLastItem(buffer.buffer), 55)).to.equal(true)
    },

    'setAllValuesTo(...) fills every byte': (testObject) => {
      const buffer = new Uint8Array(30)
      testObject.setAllValuesTo(buffer.buffer, 55)
      expect(buffer).to.deep.equal(new Uint8Array(30).fill(55))
    },

    'createArrayBufferAsync() resolves to a 10 MiB ArrayBuffer': async (testObject) => {
      const buffer = await testObject.createArrayBufferAsync()
      expect(buffer).to.be.instanceOf(ArrayBuffer)
      expect(Object.is(buffer.byteLength, NATIVE_ARRAY_BUFFER_SIZE)).to.equal(true)
    },

    'copyBuffer(JS) copies bytes into independent memory': (testObject) => {
      const bufferKinds = [
        { name: 'JS', create: () => new ArrayBuffer(1024) },
        {
          name: 'native allocation',
          create: () => testObject.createArrayBuffer(),
        },
        {
          name: 'native buffer',
          create: () => testObject.createArrayBufferFromNativeBuffer(false),
        },
        {
          name: 'NitroModules.createNativeArrayBuffer',
          create: () => NitroModules.createNativeArrayBuffer(1024),
        },
      ]
      const { name, create } = bufferKinds[0]!

      const original = create()
      const originalArray = new Uint8Array(original)
      const indices = fillTestPattern(originalArray)
      const last = originalArray.length - 1

      const copy = testObject.copyBuffer(original)
      const copyArray = new Uint8Array(copy)
      expect(Object.is(copy, original)).to.equal(false)
      expect(Object.is(copy.byteLength, original.byteLength)).to.equal(true)
      expect(bytesAt(copyArray, indices)).to.deep.equal(TEST_PATTERN)

      // JS writes to either buffer must leave the other buffer unchanged.
      originalArray[73] = 11
      originalArray[last] = 12
      expect([copyArray[73], testObject.getBufferLastItem(copy)], 'copy after writing to the original').to.deep.equal([255, 42])
      copyArray[73] = 21
      copyArray[last] = 22
      expect([originalArray[73], testObject.getBufferLastItem(original)], 'original after writing to the copy').to.deep.equal([11, 12])

      // Native writes must also stay within the chosen allocation.
      testObject.setAllValuesTo(original, 31)
      expect([copyArray[73], testObject.getBufferLastItem(copy)], 'copy after a native write to the original').to.deep.equal([21, 22])
      testObject.setAllValuesTo(copy, 41)
      expect(bytesAt(originalArray, indices), 'original after a native write to the copy').to.deep.equal([31, 31, 31, 31])
      expect(bytesAt(copyArray, indices), 'copy after a native write').to.deep.equal([41, 41, 41, 41])
    },

    'copyBuffer(native allocation) copies bytes into independent memory': (testObject) => {
      const bufferKinds = [
        { name: 'JS', create: () => new ArrayBuffer(1024) },
        {
          name: 'native allocation',
          create: () => testObject.createArrayBuffer(),
        },
        {
          name: 'native buffer',
          create: () => testObject.createArrayBufferFromNativeBuffer(false),
        },
        {
          name: 'NitroModules.createNativeArrayBuffer',
          create: () => NitroModules.createNativeArrayBuffer(1024),
        },
      ]
      const { name, create } = bufferKinds[1]!

      const original = create()
      const originalArray = new Uint8Array(original)
      const indices = fillTestPattern(originalArray)
      const last = originalArray.length - 1

      const copy = testObject.copyBuffer(original)
      const copyArray = new Uint8Array(copy)
      expect(Object.is(copy, original)).to.equal(false)
      expect(Object.is(copy.byteLength, original.byteLength)).to.equal(true)
      expect(bytesAt(copyArray, indices)).to.deep.equal(TEST_PATTERN)

      // JS writes to either buffer must leave the other buffer unchanged.
      originalArray[73] = 11
      originalArray[last] = 12
      expect([copyArray[73], testObject.getBufferLastItem(copy)], 'copy after writing to the original').to.deep.equal([255, 42])
      copyArray[73] = 21
      copyArray[last] = 22
      expect([originalArray[73], testObject.getBufferLastItem(original)], 'original after writing to the copy').to.deep.equal([11, 12])

      // Native writes must also stay within the chosen allocation.
      testObject.setAllValuesTo(original, 31)
      expect([copyArray[73], testObject.getBufferLastItem(copy)], 'copy after a native write to the original').to.deep.equal([21, 22])
      testObject.setAllValuesTo(copy, 41)
      expect(bytesAt(originalArray, indices), 'original after a native write to the copy').to.deep.equal([31, 31, 31, 31])
      expect(bytesAt(copyArray, indices), 'copy after a native write').to.deep.equal([41, 41, 41, 41])
    },

    'copyBuffer(native buffer) copies bytes into independent memory': (testObject) => {
      const bufferKinds = [
        { name: 'JS', create: () => new ArrayBuffer(1024) },
        {
          name: 'native allocation',
          create: () => testObject.createArrayBuffer(),
        },
        {
          name: 'native buffer',
          create: () => testObject.createArrayBufferFromNativeBuffer(false),
        },
        {
          name: 'NitroModules.createNativeArrayBuffer',
          create: () => NitroModules.createNativeArrayBuffer(1024),
        },
      ]
      const { name, create } = bufferKinds[2]!

      const original = create()
      const originalArray = new Uint8Array(original)
      const indices = fillTestPattern(originalArray)
      const last = originalArray.length - 1

      const copy = testObject.copyBuffer(original)
      const copyArray = new Uint8Array(copy)
      expect(Object.is(copy, original)).to.equal(false)
      expect(Object.is(copy.byteLength, original.byteLength)).to.equal(true)
      expect(bytesAt(copyArray, indices)).to.deep.equal(TEST_PATTERN)

      // JS writes to either buffer must leave the other buffer unchanged.
      originalArray[73] = 11
      originalArray[last] = 12
      expect([copyArray[73], testObject.getBufferLastItem(copy)], 'copy after writing to the original').to.deep.equal([255, 42])
      copyArray[73] = 21
      copyArray[last] = 22
      expect([originalArray[73], testObject.getBufferLastItem(original)], 'original after writing to the copy').to.deep.equal([11, 12])

      // Native writes must also stay within the chosen allocation.
      testObject.setAllValuesTo(original, 31)
      expect([copyArray[73], testObject.getBufferLastItem(copy)], 'copy after a native write to the original').to.deep.equal([21, 22])
      testObject.setAllValuesTo(copy, 41)
      expect(bytesAt(originalArray, indices), 'original after a native write to the copy').to.deep.equal([31, 31, 31, 31])
      expect(bytesAt(copyArray, indices), 'copy after a native write').to.deep.equal([41, 41, 41, 41])
    },

    'copyBuffer(NitroModules.createNativeArrayBuffer) copies bytes into independent memory': (testObject) => {
      const bufferKinds = [
        { name: 'JS', create: () => new ArrayBuffer(1024) },
        {
          name: 'native allocation',
          create: () => testObject.createArrayBuffer(),
        },
        {
          name: 'native buffer',
          create: () => testObject.createArrayBufferFromNativeBuffer(false),
        },
        {
          name: 'NitroModules.createNativeArrayBuffer',
          create: () => NitroModules.createNativeArrayBuffer(1024),
        },
      ]
      const { name, create } = bufferKinds[3]!

      const original = create()
      const originalArray = new Uint8Array(original)
      const indices = fillTestPattern(originalArray)
      const last = originalArray.length - 1

      const copy = testObject.copyBuffer(original)
      const copyArray = new Uint8Array(copy)
      expect(Object.is(copy, original)).to.equal(false)
      expect(Object.is(copy.byteLength, original.byteLength)).to.equal(true)
      expect(bytesAt(copyArray, indices)).to.deep.equal(TEST_PATTERN)

      // JS writes to either buffer must leave the other buffer unchanged.
      originalArray[73] = 11
      originalArray[last] = 12
      expect([copyArray[73], testObject.getBufferLastItem(copy)], 'copy after writing to the original').to.deep.equal([255, 42])
      copyArray[73] = 21
      copyArray[last] = 22
      expect([originalArray[73], testObject.getBufferLastItem(original)], 'original after writing to the copy').to.deep.equal([11, 12])

      // Native writes must also stay within the chosen allocation.
      testObject.setAllValuesTo(original, 31)
      expect([copyArray[73], testObject.getBufferLastItem(copy)], 'copy after a native write to the original').to.deep.equal([21, 22])
      testObject.setAllValuesTo(copy, 41)
      expect(bytesAt(originalArray, indices), 'original after a native write to the copy').to.deep.equal([31, 31, 31, 31])
      expect(bytesAt(copyArray, indices), 'copy after a native write').to.deep.equal([41, 41, 41, 41])
    },

    'bounceArrayBuffer(JS) shares memory across roundtrips': (testObject) => {
      const bufferKinds = [
        { name: 'JS', create: () => new ArrayBuffer(1024) },
        {
          name: 'native allocation',
          create: () => testObject.createArrayBuffer(),
        },
        {
          name: 'native buffer',
          create: () => testObject.createArrayBufferFromNativeBuffer(false),
        },
        {
          name: 'NitroModules.createNativeArrayBuffer',
          create: () => NitroModules.createNativeArrayBuffer(1024),
        },
      ]
      const { name, create } = bufferKinds[0]!

      const original = create()
      const originalArray = new Uint8Array(original)
      const indices = fillTestPattern(originalArray)
      const last = originalArray.length - 1

      const bounced = testObject.bounceArrayBuffer(original)
      const bouncedAgain = testObject.bounceArrayBuffer(bounced)
      const bouncedArray = new Uint8Array(bounced)
      const bouncedAgainArray = new Uint8Array(bouncedAgain)
      expect(Object.is(bounced.byteLength, original.byteLength)).to.equal(true)
      expect(Object.is(bouncedAgain.byteLength, original.byteLength)).to.equal(true)
      expect(bytesAt(bouncedArray, indices)).to.deep.equal(TEST_PATTERN)
      expect(bytesAt(bouncedAgainArray, indices)).to.deep.equal(TEST_PATTERN)

      // Mutating the original must reach both aliases and native readers.
      originalArray[73] = 11
      originalArray[last] = 12
      expect(
        [bouncedArray[73], testObject.getBufferLastItem(bounced), bouncedAgainArray[73], testObject.getBufferLastItem(bouncedAgain)],
        'aliases after writing to the original'
      ).to.deep.equal([11, 12, 11, 12])

      // Mutating the latest alias must reach the original and earlier alias.
      bouncedAgainArray[73] = 21
      bouncedAgainArray[last] = 22
      expect(
        [originalArray[73], testObject.getBufferLastItem(original), bouncedArray[73], testObject.getBufferLastItem(bounced)],
        'original and first alias after writing to the latest alias'
      ).to.deep.equal([21, 22, 21, 22])

      testObject.setAllValuesTo(bounced, 31)
      expect(bytesAt(originalArray, indices), 'original after a native write to the first alias').to.deep.equal([31, 31, 31, 31])
      expect(bytesAt(bouncedAgainArray, indices), 'latest alias after a native write to the first alias').to.deep.equal([31, 31, 31, 31])
    },

    'bounceArrayBuffer(native allocation) shares memory across roundtrips': (testObject) => {
      const bufferKinds = [
        { name: 'JS', create: () => new ArrayBuffer(1024) },
        {
          name: 'native allocation',
          create: () => testObject.createArrayBuffer(),
        },
        {
          name: 'native buffer',
          create: () => testObject.createArrayBufferFromNativeBuffer(false),
        },
        {
          name: 'NitroModules.createNativeArrayBuffer',
          create: () => NitroModules.createNativeArrayBuffer(1024),
        },
      ]
      const { name, create } = bufferKinds[1]!

      const original = create()
      const originalArray = new Uint8Array(original)
      const indices = fillTestPattern(originalArray)
      const last = originalArray.length - 1

      const bounced = testObject.bounceArrayBuffer(original)
      const bouncedAgain = testObject.bounceArrayBuffer(bounced)
      const bouncedArray = new Uint8Array(bounced)
      const bouncedAgainArray = new Uint8Array(bouncedAgain)
      expect(Object.is(bounced.byteLength, original.byteLength)).to.equal(true)
      expect(Object.is(bouncedAgain.byteLength, original.byteLength)).to.equal(true)
      expect(bytesAt(bouncedArray, indices)).to.deep.equal(TEST_PATTERN)
      expect(bytesAt(bouncedAgainArray, indices)).to.deep.equal(TEST_PATTERN)

      // Mutating the original must reach both aliases and native readers.
      originalArray[73] = 11
      originalArray[last] = 12
      expect(
        [bouncedArray[73], testObject.getBufferLastItem(bounced), bouncedAgainArray[73], testObject.getBufferLastItem(bouncedAgain)],
        'aliases after writing to the original'
      ).to.deep.equal([11, 12, 11, 12])

      // Mutating the latest alias must reach the original and earlier alias.
      bouncedAgainArray[73] = 21
      bouncedAgainArray[last] = 22
      expect(
        [originalArray[73], testObject.getBufferLastItem(original), bouncedArray[73], testObject.getBufferLastItem(bounced)],
        'original and first alias after writing to the latest alias'
      ).to.deep.equal([21, 22, 21, 22])

      testObject.setAllValuesTo(bounced, 31)
      expect(bytesAt(originalArray, indices), 'original after a native write to the first alias').to.deep.equal([31, 31, 31, 31])
      expect(bytesAt(bouncedAgainArray, indices), 'latest alias after a native write to the first alias').to.deep.equal([31, 31, 31, 31])
    },

    'bounceArrayBuffer(native buffer) shares memory across roundtrips': (testObject) => {
      const bufferKinds = [
        { name: 'JS', create: () => new ArrayBuffer(1024) },
        {
          name: 'native allocation',
          create: () => testObject.createArrayBuffer(),
        },
        {
          name: 'native buffer',
          create: () => testObject.createArrayBufferFromNativeBuffer(false),
        },
        {
          name: 'NitroModules.createNativeArrayBuffer',
          create: () => NitroModules.createNativeArrayBuffer(1024),
        },
      ]
      const { name, create } = bufferKinds[2]!

      const original = create()
      const originalArray = new Uint8Array(original)
      const indices = fillTestPattern(originalArray)
      const last = originalArray.length - 1

      const bounced = testObject.bounceArrayBuffer(original)
      const bouncedAgain = testObject.bounceArrayBuffer(bounced)
      const bouncedArray = new Uint8Array(bounced)
      const bouncedAgainArray = new Uint8Array(bouncedAgain)
      expect(Object.is(bounced.byteLength, original.byteLength)).to.equal(true)
      expect(Object.is(bouncedAgain.byteLength, original.byteLength)).to.equal(true)
      expect(bytesAt(bouncedArray, indices)).to.deep.equal(TEST_PATTERN)
      expect(bytesAt(bouncedAgainArray, indices)).to.deep.equal(TEST_PATTERN)

      // Mutating the original must reach both aliases and native readers.
      originalArray[73] = 11
      originalArray[last] = 12
      expect(
        [bouncedArray[73], testObject.getBufferLastItem(bounced), bouncedAgainArray[73], testObject.getBufferLastItem(bouncedAgain)],
        'aliases after writing to the original'
      ).to.deep.equal([11, 12, 11, 12])

      // Mutating the latest alias must reach the original and earlier alias.
      bouncedAgainArray[73] = 21
      bouncedAgainArray[last] = 22
      expect(
        [originalArray[73], testObject.getBufferLastItem(original), bouncedArray[73], testObject.getBufferLastItem(bounced)],
        'original and first alias after writing to the latest alias'
      ).to.deep.equal([21, 22, 21, 22])

      testObject.setAllValuesTo(bounced, 31)
      expect(bytesAt(originalArray, indices), 'original after a native write to the first alias').to.deep.equal([31, 31, 31, 31])
      expect(bytesAt(bouncedAgainArray, indices), 'latest alias after a native write to the first alias').to.deep.equal([31, 31, 31, 31])
    },

    'bounceArrayBuffer(NitroModules.createNativeArrayBuffer) shares memory across roundtrips': (testObject) => {
      const bufferKinds = [
        { name: 'JS', create: () => new ArrayBuffer(1024) },
        {
          name: 'native allocation',
          create: () => testObject.createArrayBuffer(),
        },
        {
          name: 'native buffer',
          create: () => testObject.createArrayBufferFromNativeBuffer(false),
        },
        {
          name: 'NitroModules.createNativeArrayBuffer',
          create: () => NitroModules.createNativeArrayBuffer(1024),
        },
      ]
      const { name, create } = bufferKinds[3]!

      const original = create()
      const originalArray = new Uint8Array(original)
      const indices = fillTestPattern(originalArray)
      const last = originalArray.length - 1

      const bounced = testObject.bounceArrayBuffer(original)
      const bouncedAgain = testObject.bounceArrayBuffer(bounced)
      const bouncedArray = new Uint8Array(bounced)
      const bouncedAgainArray = new Uint8Array(bouncedAgain)
      expect(Object.is(bounced.byteLength, original.byteLength)).to.equal(true)
      expect(Object.is(bouncedAgain.byteLength, original.byteLength)).to.equal(true)
      expect(bytesAt(bouncedArray, indices)).to.deep.equal(TEST_PATTERN)
      expect(bytesAt(bouncedAgainArray, indices)).to.deep.equal(TEST_PATTERN)

      // Mutating the original must reach both aliases and native readers.
      originalArray[73] = 11
      originalArray[last] = 12
      expect(
        [bouncedArray[73], testObject.getBufferLastItem(bounced), bouncedAgainArray[73], testObject.getBufferLastItem(bouncedAgain)],
        'aliases after writing to the original'
      ).to.deep.equal([11, 12, 11, 12])

      // Mutating the latest alias must reach the original and earlier alias.
      bouncedAgainArray[73] = 21
      bouncedAgainArray[last] = 22
      expect(
        [originalArray[73], testObject.getBufferLastItem(original), bouncedArray[73], testObject.getBufferLastItem(bounced)],
        'original and first alias after writing to the latest alias'
      ).to.deep.equal([21, 22, 21, 22])

      testObject.setAllValuesTo(bounced, 31)
      expect(bytesAt(originalArray, indices), 'original after a native write to the first alias').to.deep.equal([31, 31, 31, 31])
      expect(bytesAt(bouncedAgainArray, indices), 'latest alias after a native write to the first alias').to.deep.equal([31, 31, 31, 31])
    },

    'bounceArrayBuffer(js buffer) returns the same ArrayBuffer': (testObject) => {
      const originalArray = new Uint8Array(100)
      originalArray[73] = 4
      const bounced = testObject.bounceArrayBuffer(originalArray.buffer)
      expect(Object.is(bounced, originalArray.buffer)).to.equal(true)
      expect(Object.is(new Uint8Array(bounced)[73], 4)).to.equal(true)
    },

    'wrapArrayBuffer(...) is deleted once after native and then JS released it': async (testObject) => {
      const before = testObject.getWrappedArrayBufferDeleteCount()
      const deleted = () => testObject.getWrappedArrayBufferDeleteCount() - before
      const buffers = wrapArrayBuffers(testObject)

      testObject.releaseWrappedArrayBuffers()
      gc()
      expect(deleted(), 'deleted while JS still holds the buffers').to.equal(0)

      buffers.length = 0
      await waitFor(
        () => {
          gc()
          expect(deleted()).to.equal(WRAPPED_BUFFER_COUNT)
        },
        { timeout: 2000 }
      )
    },

    'wrapArrayBuffer(...) is deleted once after JS and then native released it': async (testObject) => {
      const before = testObject.getWrappedArrayBufferDeleteCount()
      const deleted = () => testObject.getWrappedArrayBufferDeleteCount() - before
      wrapAndDropArrayBuffers(testObject)

      gc()
      expect(deleted(), 'deleted while native still holds the buffers').to.equal(0)

      testObject.releaseWrappedArrayBuffers()
      await waitFor(
        () => {
          gc()
          expect(deleted()).to.equal(WRAPPED_BUFFER_COUNT)
        },
        { timeout: 2000 }
      )
    },
  }),
  ...casesForTestObjects('HardwareBuffers', {
    'createHardwareBuffer(rgb-565) size is in bytes': (testObject) => {
      const { format, bytesPerPixel } = HARDWARE_BUFFER_FORMATS[0]!

      const buffer = testObject.createHardwareBuffer(100, 100, 1, format)
      // On Android the row stride may be padded, so the size can be larger -
      // but if the size was computed in pixels instead of bytes, it'd be smaller.
      expect(buffer.byteLength).to.be.at.least(100 * 100 * bytesPerPixel)
    },

    'createHardwareBuffer(rgba-8888) size is in bytes': (testObject) => {
      const { format, bytesPerPixel } = HARDWARE_BUFFER_FORMATS[1]!

      const buffer = testObject.createHardwareBuffer(100, 100, 1, format)
      // On Android the row stride may be padded, so the size can be larger -
      // but if the size was computed in pixels instead of bytes, it'd be smaller.
      expect(buffer.byteLength).to.be.at.least(100 * 100 * bytesPerPixel)
    },

    'createHardwareBuffer(rgba-fp16) size is in bytes': (testObject) => {
      const { format, bytesPerPixel } = HARDWARE_BUFFER_FORMATS[2]!

      const buffer = testObject.createHardwareBuffer(100, 100, 1, format)
      // On Android the row stride may be padded, so the size can be larger -
      // but if the size was computed in pixels instead of bytes, it'd be smaller.
      expect(buffer.byteLength).to.be.at.least(100 * 100 * bytesPerPixel)
    },

    'createHardwareBuffer(blob) size is exactly `width` bytes': (testObject) => {
      // BLOB HardwareBuffers hold exactly `width` bytes flat.
      const buffer = testObject.createHardwareBuffer(12345, 1, 1, 'blob')
      expect(Object.is(buffer.byteLength, 12345)).to.equal(true)
    },

    'copyBuffer(createHardwareBuffer(..)) keeps size and data': (testObject) => {
      const original = testObject.createHardwareBuffer(100, 100, 1, 'rgba-8888')
      const originalArray = new Uint8Array(original)
      originalArray[originalArray.length - 1] = 42
      const copy = testObject.copyBuffer(original)
      const copyArray = new Uint8Array(copy)
      expect(Object.is(copy.byteLength, original.byteLength)).to.equal(true)
      expect(Object.is(copyArray[copyArray.length - 1], 42)).to.equal(true)
    },
  }),
  ...casesForTestObjects('ArrayBuffer edge cases', {
    'bounceArrayBuffer(empty buffer) returns the same buffer': (testObject) => {
      const empty = new ArrayBuffer(0)
      expect(Object.is(testObject.bounceArrayBuffer(empty), empty)).to.equal(true)
    },

    'copyBuffer(empty buffer) returns an empty ArrayBuffer': (testObject) => {
      const copy = testObject.copyBuffer(new ArrayBuffer(0))
      expect(copy).to.be.instanceOf(ArrayBuffer)
      expect(Object.is(copy.byteLength, 0)).to.equal(true)
    },

    'getBufferLastItem(1-byte buffer) returns that byte': (testObject) => {
      expect(Object.is(testObject.getBufferLastItem(new Uint8Array([42]).buffer), 42)).to.equal(true)
    },

    'setAllValuesTo(1-byte buffer) sets that byte': (testObject) => {
      const array = new Uint8Array(1)
      testObject.setAllValuesTo(array.buffer, 42)
      expect(Object.is(array[0], 42)).to.equal(true)
    },

    'getBufferLastItem(...) reads 0 as an unsigned byte': (testObject) => {
      const value = [0, 127, 128, 255][0]!

      const array = new Uint8Array([1, 2, value])
      expect(Object.is(testObject.getBufferLastItem(array.buffer), value)).to.equal(true)
    },

    'getBufferLastItem(...) reads 127 as an unsigned byte': (testObject) => {
      const value = [0, 127, 128, 255][1]!

      const array = new Uint8Array([1, 2, value])
      expect(Object.is(testObject.getBufferLastItem(array.buffer), value)).to.equal(true)
    },

    'getBufferLastItem(...) reads 128 as an unsigned byte': (testObject) => {
      const value = [0, 127, 128, 255][2]!

      const array = new Uint8Array([1, 2, value])
      expect(Object.is(testObject.getBufferLastItem(array.buffer), value)).to.equal(true)
    },

    'getBufferLastItem(...) reads 255 as an unsigned byte': (testObject) => {
      const value = [0, 127, 128, 255][3]!

      const array = new Uint8Array([1, 2, value])
      expect(Object.is(testObject.getBufferLastItem(array.buffer), value)).to.equal(true)
    },

    'setAllValuesTo(..., 0) writes 0 to every byte': (testObject) => {
      const value = [0, 128, 255][0]!

      const array = new Uint8Array(16).fill(7)
      testObject.setAllValuesTo(array.buffer, value)
      expect(array).to.deep.equal(new Uint8Array(16).fill(value))
    },

    'setAllValuesTo(..., 128) writes 128 to every byte': (testObject) => {
      const value = [0, 128, 255][1]!

      const array = new Uint8Array(16).fill(7)
      testObject.setAllValuesTo(array.buffer, value)
      expect(array).to.deep.equal(new Uint8Array(16).fill(value))
    },

    'setAllValuesTo(..., 255) writes 255 to every byte': (testObject) => {
      const value = [0, 128, 255][2]!

      const array = new Uint8Array(16).fill(7)
      testObject.setAllValuesTo(array.buffer, value)
      expect(array).to.deep.equal(new Uint8Array(16).fill(value))
    },

    'copyBuffer(...) copies every byte of an odd-sized buffer': (testObject) => {
      const original = createCountingBuffer(4099)
      const copy = testObject.copyBuffer(original)
      expect(Object.is(copy.byteLength, original.byteLength)).to.equal(true)
      // Compare the complete buffer contents through their byte views.
      expect(new Uint8Array(copy)).to.deep.equal(new Uint8Array(original))
    },

    'copyBuffer(16 MiB buffer) keeps its size and bytes': (testObject) => {
      const original = new Uint8Array(LARGE_BUFFER_SIZE)
      original[0] = 7
      original[LARGE_BUFFER_SIZE / 2] = 99
      original[LARGE_BUFFER_SIZE - 1] = 42
      const copy = new Uint8Array(testObject.copyBuffer(original.buffer))
      expect(Object.is(copy.byteLength, LARGE_BUFFER_SIZE)).to.equal(true)
      expect([copy[0], copy[LARGE_BUFFER_SIZE / 2], copy[LARGE_BUFFER_SIZE - 1]]).to.deep.equal([7, 99, 42])
    },

    'getBufferLastItem(view.buffer) reads the whole underlying buffer': (testObject) => {
      // `.buffer` of a view is the entire backing ArrayBuffer, not just the view.
      const view = new Uint8Array([1, 2, 3, 4]).subarray(0, 2)
      expect(Object.is(testObject.getBufferLastItem(view.buffer), 4)).to.equal(true)
    },

    'createArrayBuffer() returns independent memory every call': (testObject) => {
      const a = new Uint8Array(testObject.createArrayBuffer())
      const b = new Uint8Array(testObject.createArrayBuffer())
      a[0] = 1
      b[0] = 2
      expect([a[0], b[0]]).to.deep.equal([1, 2])
    },

    'getBufferLastItem(Uint8Array) throws a TypedArray hint': (testObject) => {
      const typedArray = new Uint8Array([1, 2, 3])
      // @ts-expect-error - a Uint8Array is not an ArrayBuffer
      const getLastItem = () => testObject.getBufferLastItem(typedArray)
      expect(getLastItem).to.throw(`${testObject.constructor.name}.getBufferLastItem(...)`)
      expect(getLastItem).to.throw(
        'Object "1,2,3" is not an ArrayBuffer! Are you maybe passing a TypedArray (e.g. Uint8Array)? Try to pass its `.buffer` value.'
      )
    },

    'getBufferLastItem({}) throws "is not an ArrayBuffer"': (testObject) => {
      // @ts-expect-error - a plain object is not an ArrayBuffer
      expect(() => testObject.getBufferLastItem({})).to.throw('Object "[object Object]" is not an ArrayBuffer!')
    },

    'getBufferLastItem(number) throws "not even an object"': (testObject) => {
      // @ts-expect-error - a number is not an ArrayBuffer
      expect(() => testObject.getBufferLastItem(55)).to.throw(`Value "55" is not an ArrayBuffer - in fact, it's not even an object!`)
    },
  }),
  ...casesForTestObjects('ArrayBuffer identity', {
    'bounceArrayBuffers(...) returns the same JS ArrayBuffers': (testObject) => {
      const a = new ArrayBuffer(8)
      const b = new ArrayBuffer(16)
      const result = testObject.bounceArrayBuffers([a, b, a])
      expect(result).to.have.length(3)
      expect(Object.is(result[0], a)).to.equal(true)
      expect(Object.is(result[1], b)).to.equal(true)
      expect(Object.is(result[2], a)).to.equal(true)
    },

    'bounceOptionalWrapper(...) keeps the same JS ArrayBuffer': (testObject) => {
      const buffer = new ArrayBuffer(8)
      expect(Object.is(testObject.bounceOptionalWrapper({ optionalArrayBuffer: buffer }).optionalArrayBuffer, buffer)).to.equal(true)
    },

    'bounceComplexVariant(...) returns the same JS ArrayBuffer': (testObject) => {
      const buffer = new ArrayBuffer(8)
      expect(Object.is(testObject.bounceComplexVariant(buffer), buffer)).to.equal(true)
    },
  }),
}

export const skips = {
  'ArrayBuffer edge cases / TestObjectSwiftKotlin / getBufferLastItem(...) reads 128 as an unsigned byte': {
    android: 'Existing main exclusion: !isKotlinSignedByte',
  },
  'ArrayBuffer edge cases / TestObjectSwiftKotlin / getBufferLastItem(...) reads 255 as an unsigned byte': {
    android: 'Existing main exclusion: !isKotlinSignedByte',
  },
  'ArrayBuffer edge cases / TestObjectCpp / getBufferLastItem(Uint8Array) throws a TypedArray hint': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
  'ArrayBuffer edge cases / TestObjectSwiftKotlin / getBufferLastItem(Uint8Array) throws a TypedArray hint': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
  'ArrayBuffer edge cases / TestObjectCpp / getBufferLastItem({}) throws "is not an ArrayBuffer"': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
  'ArrayBuffer edge cases / TestObjectSwiftKotlin / getBufferLastItem({}) throws "is not an ArrayBuffer"': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
  'ArrayBuffer edge cases / TestObjectCpp / getBufferLastItem(number) throws "not even an object"': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
  'ArrayBuffer edge cases / TestObjectSwiftKotlin / getBufferLastItem(number) throws "not even an object"': {
    release: 'Existing main exclusion: IS_DEBUG',
  },
} as const
