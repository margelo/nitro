import * as React from 'react'
import { PixelRatio, Platform, type LayoutRectangle, View } from 'react-native'
import {
  describe,
  expect,
  fn,
  it,
  render,
  waitUntil,
} from 'react-native-harness'
import { screen } from '@react-native-harness/ui'
import { callback } from 'react-native-nitro-modules'
import {
  HybridTestObjectCpp,
  HybridTestObjectSwiftKotlin,
  RecyclableTestView,
  type RecyclableTestViewRef,
  TestView,
  type TestViewRef,
} from 'react-native-nitro-test'
import * as UPNG from 'upng-js'

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}

interface ImageSize {
  width: number
  height: number
}

interface PixelCoverage {
  blue: number
  red: number
  opaque: number
}

interface ViewCapture {
  size: ImageSize
  pixelCoverage: PixelCoverage
}

function getPngSize(data: Uint8Array): ImageSize {
  const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10]
  const actualSignature = Array.from(data.subarray(0, pngSignature.length))
  if (actualSignature.some((byte, index) => byte !== pngSignature[index])) {
    throw new Error('Harness UI did not return a valid PNG screenshot.')
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  return {
    width: view.getUint32(16),
    height: view.getUint32(20),
  }
}

const COLOR_DOMINANCE_MARGIN = 50

function getPixelCoverage(data: Uint8Array): PixelCoverage {
  const copiedData = Uint8Array.from(data)
  const decodedImage = UPNG.decode(copiedData.buffer)
  const rgbaBuffer = UPNG.toRGBA8(decodedImage)[0]
  if (rgbaBuffer == null) {
    throw new Error('Failed to decode the Harness UI PNG screenshot.')
  }

  const rgba = new Uint8Array(rgbaBuffer)
  const pixelCount = rgba.length / 4
  if (pixelCount === 0) {
    throw new Error('Harness UI returned an empty PNG screenshot.')
  }

  let bluePixels = 0
  let redPixels = 0
  let opaquePixels = 0
  for (let index = 0; index < rgba.length; index += 4) {
    const red = rgba[index] ?? 0
    const green = rgba[index + 1] ?? 0
    const blue = rgba[index + 2] ?? 0
    const alpha = rgba[index + 3] ?? 0

    if (alpha > 250) {
      opaquePixels += 1
    }
    if (
      alpha > 250 &&
      blue - red > COLOR_DOMINANCE_MARGIN &&
      blue - green > COLOR_DOMINANCE_MARGIN
    ) {
      bluePixels += 1
    }
    if (
      alpha > 250 &&
      red - green > COLOR_DOMINANCE_MARGIN &&
      red - blue > COLOR_DOMINANCE_MARGIN
    ) {
      redPixels += 1
    }
  }

  return {
    blue: bluePixels / pixelCount,
    red: redPixels / pixelCount,
    opaque: opaquePixels / pixelCount,
  }
}

async function captureView(testID: string): Promise<ViewCapture> {
  const element = await screen.findByTestId(testID)
  const screenshot = await screen.screenshot(element)
  if (screenshot == null) {
    throw new Error(`Failed to capture the mounted View "${testID}".`)
  }

  return {
    size: getPngSize(screenshot.data),
    pixelCoverage: getPixelCoverage(screenshot.data),
  }
}

function expectRenderedSize(
  actualSize: ImageSize,
  expectedSize: ImageSize
): void {
  expect(actualSize).toEqual({
    width: PixelRatio.getPixelSizeForLayoutSize(expectedSize.width),
    height: PixelRatio.getPixelSizeForLayoutSize(expectedSize.height),
  })
}

const MIN_EXPECTED_PIXEL_COVERAGE = 0.95

function expectBlue(actualCoverage: PixelCoverage): void {
  expect(actualCoverage.blue).toBeGreaterThanOrEqual(
    MIN_EXPECTED_PIXEL_COVERAGE
  )
  expect(actualCoverage.opaque).toBeGreaterThanOrEqual(
    MIN_EXPECTED_PIXEL_COVERAGE
  )
}

function expectRed(actualCoverage: PixelCoverage): void {
  expect(actualCoverage.red).toBeGreaterThanOrEqual(MIN_EXPECTED_PIXEL_COVERAGE)
  expect(actualCoverage.opaque).toBeGreaterThanOrEqual(
    MIN_EXPECTED_PIXEL_COVERAGE
  )
}

const INITIAL_SIZE = { width: 80, height: 60 }
const RESIZED_SIZE = { width: 160, height: 120 }
const RENDER_TIMEOUT = 4_000
const SUPPORTS_NATIVE_VIEW_RECYCLING =
  Platform.OS === 'ios' || Number(Platform.Version) >= 28

async function waitForRecyclableViewRemoval(
  view: RecyclableTestViewRef,
  testID: string,
  expectedOnDropViewCount: number,
  expectedPrepareForRecycleCount: number
): Promise<void> {
  await waitUntil(
    () =>
      screen.queryByTestId(testID) === null &&
      view.getOnDropViewCount() === expectedOnDropViewCount &&
      view.getPrepareForRecycleCount() === expectedPrepareForRecycleCount,
    { timeout: RENDER_TIMEOUT }
  )
}

describe('TestView', () => {
  it('renders with native props, layout, pixels, methods, and callbacks', async () => {
    const viewRef = deferred<TestViewRef>()
    const layout = deferred<LayoutRectangle>()
    const callbackFinished = deferred<void>()
    let mountedView: TestViewRef | undefined
    let callbackSawUpdatedState = false
    const onSomeCallback = fn(() => {
      callbackSawUpdatedState = mountedView?.hasBeenCalled === true
      callbackFinished.resolve(undefined)
    })

    await render(
      <TestView
        testID="test-view-initial"
        style={INITIAL_SIZE}
        hybridRef={callback((view) => viewRef.resolve(view))}
        isBlue={true}
        hasBeenCalled={false}
        colorScheme="dark"
        someCallback={callback(onSomeCallback)}
        onLayout={({ nativeEvent }) => layout.resolve(nativeEvent.layout)}
      />,
      { timeout: RENDER_TIMEOUT }
    )

    mountedView = await viewRef.promise
    const reportedLayout = await layout.promise
    expect(reportedLayout.width).toBeCloseTo(INITIAL_SIZE.width, 0)
    expect(reportedLayout.height).toBeCloseTo(INITIAL_SIZE.height, 0)
    expect(mountedView.isBlue).toBe(true)
    expect(mountedView.hasBeenCalled).toBe(false)
    expect(mountedView.colorScheme).toBe('dark')
    expect(mountedView.getOnDropViewCount()).toBe(0)
    expect(HybridTestObjectCpp.getIsViewBlue(mountedView)).toBe(true)
    expect(HybridTestObjectSwiftKotlin.getIsViewBlue(mountedView)).toBe(true)

    const capture = await captureView('test-view-initial')
    expectRenderedSize(capture.size, INITIAL_SIZE)
    expectBlue(capture.pixelCoverage)

    mountedView.someMethod()
    await callbackFinished.promise
    expect(mountedView.hasBeenCalled).toBe(true)
    expect(callbackSawUpdatedState).toBe(true)
    expect(onSomeCallback).toHaveBeenCalledTimes(1)
  })

  it('updates every prop, changes pixels, and resizes the same native view', async () => {
    const initialRef = deferred<TestViewRef>()
    const initialCallback = fn()
    const renderResult = await render(
      <TestView
        testID="test-view-updates"
        style={INITIAL_SIZE}
        hybridRef={callback((view) => initialRef.resolve(view))}
        isBlue={true}
        hasBeenCalled={false}
        colorScheme="dark"
        someCallback={callback(initialCallback)}
      />,
      { timeout: RENDER_TIMEOUT }
    )

    const firstView = await initialRef.promise
    const blueCapture = await captureView('test-view-updates')
    expectRenderedSize(blueCapture.size, INITIAL_SIZE)
    expectBlue(blueCapture.pixelCoverage)

    const updatedRef = deferred<TestViewRef>()
    const updatedCallbackFinished = deferred<void>()
    const updatedCallback = fn(() => updatedCallbackFinished.resolve(undefined))
    const updatedHybridRef = callback((view: TestViewRef) =>
      updatedRef.resolve(view)
    )
    const updatedSomeCallback = callback(updatedCallback)

    await renderResult.rerender(
      <TestView
        testID="test-view-updates"
        style={INITIAL_SIZE}
        hybridRef={updatedHybridRef}
        isBlue={false}
        hasBeenCalled={true}
        colorScheme="light"
        someCallback={updatedSomeCallback}
      />
    )

    const updatedView = await updatedRef.promise
    expect(updatedView.equals(firstView)).toBe(true)
    expect(updatedView.isBlue).toBe(false)
    expect(updatedView.hasBeenCalled).toBe(true)
    expect(updatedView.colorScheme).toBe('light')
    expect(updatedView.getOnDropViewCount()).toBe(0)
    expect(HybridTestObjectCpp.getIsViewBlue(updatedView)).toBe(false)
    expect(HybridTestObjectSwiftKotlin.getIsViewBlue(updatedView)).toBe(false)

    updatedView.someMethod()
    await updatedCallbackFinished.promise
    expect(initialCallback).not.toHaveBeenCalled()
    expect(updatedCallback).toHaveBeenCalledTimes(1)

    const redCapture = await captureView('test-view-updates')
    expectRenderedSize(redCapture.size, INITIAL_SIZE)
    expectRed(redCapture.pixelCoverage)

    const resizedLayout = deferred<LayoutRectangle>()
    await renderResult.rerender(
      <TestView
        testID="test-view-updates"
        style={RESIZED_SIZE}
        hybridRef={updatedHybridRef}
        isBlue={false}
        hasBeenCalled={true}
        colorScheme="light"
        someCallback={updatedSomeCallback}
        onLayout={({ nativeEvent }) =>
          resizedLayout.resolve(nativeEvent.layout)
        }
      />
    )

    const reportedResizedLayout = await resizedLayout.promise
    expect(reportedResizedLayout.width).toBeCloseTo(RESIZED_SIZE.width, 0)
    expect(reportedResizedLayout.height).toBeCloseTo(RESIZED_SIZE.height, 0)
    expect(firstView.isBlue).toBe(false)
    expect(firstView.hasBeenCalled).toBe(true)
    expect(firstView.colorScheme).toBe('light')

    const resizedCapture = await captureView('test-view-updates')
    expectRenderedSize(resizedCapture.size, RESIZED_SIZE)
    expectRed(resizedCapture.pixelCoverage)
  })

  it('preserves an omitted native default while applying another prop', async () => {
    const viewRef = deferred<TestViewRef>()
    const stableHybridRef = callback((view: TestViewRef) =>
      viewRef.resolve(view)
    )
    const stableSomeCallback = callback(fn())
    const renderResult = await render(
      <TestView
        testID="test-view-native-default"
        style={INITIAL_SIZE}
        hybridRef={stableHybridRef}
        isBlue={false}
        hasBeenCalled={false}
        colorScheme="dark"
        someCallback={stableSomeCallback}
      />,
      { timeout: RENDER_TIMEOUT }
    )

    const view = await viewRef.promise
    expect(view.isBlue).toBe(false)
    expect(view.getIsBlueSetterCallCount()).toBe(1)
    expect(view.nativeDefaultValue).toBe(42)
    expect(view.getNativeDefaultValueSetterCallCount()).toBe(0)

    const updatedViewRef = deferred<TestViewRef>()
    await renderResult.rerender(
      <TestView
        testID="test-view-native-default"
        style={INITIAL_SIZE}
        hybridRef={callback((updatedView) =>
          updatedViewRef.resolve(updatedView)
        )}
        isBlue={true}
        hasBeenCalled={false}
        colorScheme="dark"
        someCallback={stableSomeCallback}
      />
    )

    await updatedViewRef.promise
    expect(view.isBlue).toBe(true)
    expect(view.getIsBlueSetterCallCount()).toBe(2)
    expect(view.nativeDefaultValue).toBe(42)
    expect(view.getNativeDefaultValueSetterCallCount()).toBe(0)
  })

  it('only calls native setters for changed Nitro props', async () => {
    const viewRef = deferred<TestViewRef>()
    const stableHybridRef = callback((view: TestViewRef) =>
      viewRef.resolve(view)
    )
    const stableSomeCallback = callback(fn())
    const renderResult = await render(
      <TestView
        testID="test-view-setter-counts"
        style={INITIAL_SIZE}
        hybridRef={stableHybridRef}
        isBlue={false}
        hasBeenCalled={false}
        colorScheme="dark"
        someCallback={stableSomeCallback}
        nativeDefaultValue={1}
      />,
      { timeout: RENDER_TIMEOUT }
    )

    const view = await viewRef.promise
    expect(view.getIsBlueSetterCallCount()).toBe(1)
    expect(view.getNativeDefaultValueSetterCallCount()).toBe(1)

    const nativeDefaultUpdatedRef = deferred<TestViewRef>()
    await renderResult.rerender(
      <TestView
        testID="test-view-setter-counts"
        style={INITIAL_SIZE}
        hybridRef={callback((updatedView) =>
          nativeDefaultUpdatedRef.resolve(updatedView)
        )}
        isBlue={false}
        hasBeenCalled={false}
        colorScheme="dark"
        someCallback={stableSomeCallback}
        nativeDefaultValue={2}
      />
    )

    await nativeDefaultUpdatedRef.promise

    const isBlueUpdatedRef = deferred<TestViewRef>()
    const isBlueUpdatedHybridRef = callback((updatedView: TestViewRef) =>
      isBlueUpdatedRef.resolve(updatedView)
    )
    expect(view.isBlue).toBe(false)
    expect(view.nativeDefaultValue).toBe(2)
    expect(view.getIsBlueSetterCallCount()).toBe(1)
    expect(view.getNativeDefaultValueSetterCallCount()).toBe(2)

    await renderResult.rerender(
      <TestView
        testID="test-view-setter-counts"
        style={INITIAL_SIZE}
        hybridRef={isBlueUpdatedHybridRef}
        isBlue={true}
        hasBeenCalled={false}
        colorScheme="dark"
        someCallback={stableSomeCallback}
        nativeDefaultValue={2}
      />
    )

    await isBlueUpdatedRef.promise
    expect(view.isBlue).toBe(true)
    expect(view.nativeDefaultValue).toBe(2)
    expect(view.getIsBlueSetterCallCount()).toBe(2)
    expect(view.getNativeDefaultValueSetterCallCount()).toBe(2)

    const resizedLayout = deferred<LayoutRectangle>()
    await renderResult.rerender(
      <TestView
        testID="test-view-setter-counts"
        style={RESIZED_SIZE}
        hybridRef={isBlueUpdatedHybridRef}
        isBlue={true}
        hasBeenCalled={false}
        colorScheme="dark"
        someCallback={stableSomeCallback}
        nativeDefaultValue={2}
        onLayout={({ nativeEvent }) =>
          resizedLayout.resolve(nativeEvent.layout)
        }
      />
    )

    const reportedResizedLayout = await resizedLayout.promise
    expect(reportedResizedLayout.width).toBeCloseTo(RESIZED_SIZE.width, 0)
    expect(reportedResizedLayout.height).toBeCloseTo(RESIZED_SIZE.height, 0)
    expect(view.getIsBlueSetterCallCount()).toBe(2)
    expect(view.getNativeDefaultValueSetterCallCount()).toBe(2)
  })

  it('unmounts and creates a fresh native view when remounted', async () => {
    const firstRef = deferred<TestViewRef>()
    const renderResult = await render(
      <TestView
        testID="test-view-lifecycle"
        style={INITIAL_SIZE}
        hybridRef={callback((view) => firstRef.resolve(view))}
        isBlue={true}
        hasBeenCalled={false}
        colorScheme="dark"
        someCallback={callback(fn())}
      />,
      { timeout: RENDER_TIMEOUT }
    )
    const firstView = await firstRef.promise
    const initialOnDropViewCount = firstView.getOnDropViewCount()
    expect(screen.queryByTestId('test-view-lifecycle')).not.toBeNull()

    renderResult.unmount()
    await waitUntil(
      () =>
        screen.queryByTestId('test-view-lifecycle') === null &&
        firstView.getOnDropViewCount() === initialOnDropViewCount + 1,
      { timeout: RENDER_TIMEOUT }
    )
    expect(screen.queryByTestId('test-view-lifecycle')).toBeNull()
    expect(firstView.getOnDropViewCount()).toBe(initialOnDropViewCount + 1)

    const secondRef = deferred<TestViewRef>()
    await render(
      <TestView
        testID="test-view-lifecycle"
        style={INITIAL_SIZE}
        hybridRef={callback((view) => secondRef.resolve(view))}
        isBlue={false}
        hasBeenCalled={true}
        colorScheme="light"
        someCallback={callback(fn())}
      />,
      { timeout: RENDER_TIMEOUT }
    )
    const secondView = await secondRef.promise

    expect(secondView.equals(firstView)).toBe(false)
    expect(secondView.isBlue).toBe(false)
    expect(secondView.hasBeenCalled).toBe(true)
    expect(secondView.colorScheme).toBe('light')
    expect(secondView.getOnDropViewCount()).toBe(0)
    const remountedCapture = await captureView('test-view-lifecycle')
    expectRenderedSize(remountedCapture.size, INITIAL_SIZE)
    expectRed(remountedCapture.pixelCoverage)
  })
})

describe('multiple RecyclableTestViews', () => {
  it('keeps instances isolated while one is updated and recycled', async () => {
    const firstRef = deferred<RecyclableTestViewRef>()
    const secondRef = deferred<RecyclableTestViewRef>()
    const firstHybridRef = callback((view: RecyclableTestViewRef) =>
      firstRef.resolve(view)
    )
    const secondHybridRef = callback((view: RecyclableTestViewRef) =>
      secondRef.resolve(view)
    )

    const renderResult = await render(
      <View style={{ flexDirection: 'row' }}>
        <RecyclableTestView
          key="first"
          testID="isolated-recyclable-view-first"
          style={INITIAL_SIZE}
          hybridRef={firstHybridRef}
          isBlue={false}
        />
        <RecyclableTestView
          key="second"
          testID="isolated-recyclable-view-second"
          style={INITIAL_SIZE}
          hybridRef={secondHybridRef}
          isBlue={false}
        />
      </View>,
      { timeout: RENDER_TIMEOUT }
    )

    const firstView = await firstRef.promise
    const secondView = await secondRef.promise
    const firstOnDropViewCount = firstView.getOnDropViewCount()
    const firstPrepareForRecycleCount = firstView.getPrepareForRecycleCount()
    const secondOnDropViewCount = secondView.getOnDropViewCount()
    const secondPrepareForRecycleCount = secondView.getPrepareForRecycleCount()
    expect(firstView.equals(secondView)).toBe(false)
    expect(firstView.isBlue).toBe(false)
    expect(secondView.isBlue).toBe(false)
    expect(firstView.getInvalidLifecycleOrderCount()).toBe(0)
    expect(secondView.getInvalidLifecycleOrderCount()).toBe(0)

    const initialFirstCapture = await captureView(
      'isolated-recyclable-view-first'
    )
    const initialSecondCapture = await captureView(
      'isolated-recyclable-view-second'
    )
    expectRenderedSize(initialFirstCapture.size, INITIAL_SIZE)
    expectRenderedSize(initialSecondCapture.size, INITIAL_SIZE)
    expectRed(initialFirstCapture.pixelCoverage)
    expectRed(initialSecondCapture.pixelCoverage)

    const updatedFirstRef = deferred<RecyclableTestViewRef>()
    const updatedFirstHybridRef = callback((view: RecyclableTestViewRef) =>
      updatedFirstRef.resolve(view)
    )
    await renderResult.rerender(
      <View style={{ flexDirection: 'row' }}>
        <RecyclableTestView
          key="first"
          testID="isolated-recyclable-view-first"
          style={INITIAL_SIZE}
          hybridRef={updatedFirstHybridRef}
          isBlue={true}
        />
        <RecyclableTestView
          key="second"
          testID="isolated-recyclable-view-second"
          style={INITIAL_SIZE}
          hybridRef={secondHybridRef}
          isBlue={false}
        />
      </View>
    )

    await updatedFirstRef.promise
    expect(firstView.isBlue).toBe(true)
    expect(secondView.isBlue).toBe(false)
    expect(firstView.getOnDropViewCount()).toBe(firstOnDropViewCount)
    expect(firstView.getPrepareForRecycleCount()).toBe(
      firstPrepareForRecycleCount
    )
    expect(secondView.getOnDropViewCount()).toBe(secondOnDropViewCount)
    expect(secondView.getPrepareForRecycleCount()).toBe(
      secondPrepareForRecycleCount
    )

    const updatedFirstCapture = await captureView(
      'isolated-recyclable-view-first'
    )
    const unchangedSecondCapture = await captureView(
      'isolated-recyclable-view-second'
    )
    expectBlue(updatedFirstCapture.pixelCoverage)
    expectRed(unchangedSecondCapture.pixelCoverage)

    await renderResult.rerender(
      <View style={{ flexDirection: 'row' }}>
        <RecyclableTestView
          key="second"
          testID="isolated-recyclable-view-second"
          style={INITIAL_SIZE}
          hybridRef={secondHybridRef}
          isBlue={false}
        />
      </View>
    )

    await waitForRecyclableViewRemoval(
      firstView,
      'isolated-recyclable-view-first',
      firstOnDropViewCount + 1,
      firstPrepareForRecycleCount + (SUPPORTS_NATIVE_VIEW_RECYCLING ? 1 : 0)
    )
    expect(screen.queryByTestId('isolated-recyclable-view-first')).toBeNull()
    expect(firstView.getOnDropViewCount()).toBe(firstOnDropViewCount + 1)
    expect(firstView.getPrepareForRecycleCount()).toBe(
      firstPrepareForRecycleCount + (SUPPORTS_NATIVE_VIEW_RECYCLING ? 1 : 0)
    )
    expect(firstView.getInvalidLifecycleOrderCount()).toBe(0)
    expect(secondView.isBlue).toBe(false)
    expect(secondView.getOnDropViewCount()).toBe(secondOnDropViewCount)
    expect(secondView.getPrepareForRecycleCount()).toBe(
      secondPrepareForRecycleCount
    )
    expect(secondView.getInvalidLifecycleOrderCount()).toBe(0)
    const mountedSiblingCapture = await captureView(
      'isolated-recyclable-view-second'
    )
    expectRed(mountedSiblingCapture.pixelCoverage)

    const remountedFirstRef = deferred<RecyclableTestViewRef>()
    const remountedFirstLayout = deferred<LayoutRectangle>()
    await renderResult.rerender(
      <View style={{ flexDirection: 'row' }}>
        <RecyclableTestView
          key="first"
          testID="isolated-recyclable-view-first"
          style={INITIAL_SIZE}
          hybridRef={callback((view) => remountedFirstRef.resolve(view))}
          isBlue={true}
          onLayout={({ nativeEvent }) =>
            remountedFirstLayout.resolve(nativeEvent.layout)
          }
        />
        <RecyclableTestView
          key="second"
          testID="isolated-recyclable-view-second"
          style={INITIAL_SIZE}
          hybridRef={secondHybridRef}
          isBlue={false}
        />
      </View>
    )

    const remountedFirstView = await remountedFirstRef.promise
    await remountedFirstLayout.promise
    expect(remountedFirstView.equals(firstView)).toBe(
      SUPPORTS_NATIVE_VIEW_RECYCLING
    )
    expect(remountedFirstView.equals(secondView)).toBe(false)
    expect(remountedFirstView.isBlue).toBe(true)
    expect(remountedFirstView.getOnDropViewCount()).toBe(
      SUPPORTS_NATIVE_VIEW_RECYCLING ? firstOnDropViewCount + 1 : 0
    )
    expect(remountedFirstView.getPrepareForRecycleCount()).toBe(
      SUPPORTS_NATIVE_VIEW_RECYCLING ? firstPrepareForRecycleCount + 1 : 0
    )
    expect(remountedFirstView.getInvalidLifecycleOrderCount()).toBe(0)
    expect(secondView.isBlue).toBe(false)
    expect(secondView.getOnDropViewCount()).toBe(secondOnDropViewCount)
    expect(secondView.getPrepareForRecycleCount()).toBe(
      secondPrepareForRecycleCount
    )

    const remountedFirstCapture = await captureView(
      'isolated-recyclable-view-first'
    )
    const finalSecondCapture = await captureView(
      'isolated-recyclable-view-second'
    )
    expectBlue(remountedFirstCapture.pixelCoverage)
    expectRed(finalSecondCapture.pixelCoverage)
  })
})

describe('RecyclableTestView', () => {
  it('renders, changes pixels, and resizes the same native view', async () => {
    const initialRef = deferred<RecyclableTestViewRef>()
    const initialLayout = deferred<LayoutRectangle>()
    const renderResult = await render(
      <RecyclableTestView
        testID="recyclable-view-updates"
        style={INITIAL_SIZE}
        hybridRef={callback((view) => initialRef.resolve(view))}
        isBlue={false}
        onLayout={({ nativeEvent }) =>
          initialLayout.resolve(nativeEvent.layout)
        }
      />,
      { timeout: RENDER_TIMEOUT }
    )

    const firstView = await initialRef.promise
    const reportedInitialLayout = await initialLayout.promise
    expect(reportedInitialLayout.width).toBeCloseTo(INITIAL_SIZE.width, 0)
    expect(reportedInitialLayout.height).toBeCloseTo(INITIAL_SIZE.height, 0)
    expect(firstView.isBlue).toBe(false)
    expect(firstView.getInvalidLifecycleOrderCount()).toBe(0)
    const initialOnDropViewCount = firstView.getOnDropViewCount()
    const initialPrepareForRecycleCount = firstView.getPrepareForRecycleCount()

    const redCapture = await captureView('recyclable-view-updates')
    expectRenderedSize(redCapture.size, INITIAL_SIZE)
    expectRed(redCapture.pixelCoverage)

    const updatedRef = deferred<RecyclableTestViewRef>()
    const updatedHybridRef = callback((view: RecyclableTestViewRef) =>
      updatedRef.resolve(view)
    )
    await renderResult.rerender(
      <RecyclableTestView
        testID="recyclable-view-updates"
        style={INITIAL_SIZE}
        hybridRef={updatedHybridRef}
        isBlue={true}
      />
    )

    const updatedView = await updatedRef.promise
    expect(updatedView.equals(firstView)).toBe(true)
    expect(updatedView.isBlue).toBe(true)
    expect(updatedView.getPrepareForRecycleCount()).toBe(
      initialPrepareForRecycleCount
    )

    const blueCapture = await captureView('recyclable-view-updates')
    expectRenderedSize(blueCapture.size, INITIAL_SIZE)
    expectBlue(blueCapture.pixelCoverage)

    const resizedLayout = deferred<LayoutRectangle>()
    await renderResult.rerender(
      <RecyclableTestView
        testID="recyclable-view-updates"
        style={RESIZED_SIZE}
        hybridRef={updatedHybridRef}
        isBlue={true}
        onLayout={({ nativeEvent }) =>
          resizedLayout.resolve(nativeEvent.layout)
        }
      />
    )

    const reportedResizedLayout = await resizedLayout.promise
    expect(reportedResizedLayout.width).toBeCloseTo(RESIZED_SIZE.width, 0)
    expect(reportedResizedLayout.height).toBeCloseTo(RESIZED_SIZE.height, 0)
    expect(firstView.isBlue).toBe(true)
    expect(firstView.getPrepareForRecycleCount()).toBe(
      initialPrepareForRecycleCount
    )
    expect(firstView.getOnDropViewCount()).toBe(initialOnDropViewCount)

    const resizedCapture = await captureView('recyclable-view-updates')
    expectRenderedSize(resizedCapture.size, RESIZED_SIZE)
    expectBlue(resizedCapture.pixelCoverage)
  })

  it('reuses and resets the native view across recycling cycles', async () => {
    const firstRef = deferred<RecyclableTestViewRef>()
    const renderResult = await render(
      <RecyclableTestView
        testID="recyclable-view-lifecycle"
        style={INITIAL_SIZE}
        hybridRef={callback((view) => firstRef.resolve(view))}
        isBlue={true}
      />,
      { timeout: RENDER_TIMEOUT }
    )
    const firstView = await firstRef.promise
    expect(firstView.isBlue).toBe(true)
    expect(firstView.nativeDefaultValue).toBe(42)
    expect(firstView.getNativeDefaultValueSetterCallCount()).toBe(0)
    const initialOnDropViewCount = firstView.getOnDropViewCount()
    const initialPrepareForRecycleCount = firstView.getPrepareForRecycleCount()

    const initialCapture = await captureView('recyclable-view-lifecycle')
    expectRenderedSize(initialCapture.size, INITIAL_SIZE)
    expectBlue(initialCapture.pixelCoverage)

    await renderResult.rerender(<View />)
    await waitForRecyclableViewRemoval(
      firstView,
      'recyclable-view-lifecycle',
      initialOnDropViewCount + 1,
      initialPrepareForRecycleCount + (SUPPORTS_NATIVE_VIEW_RECYCLING ? 1 : 0)
    )
    expect(screen.queryByTestId('recyclable-view-lifecycle')).toBeNull()
    expect(firstView.getOnDropViewCount()).toBe(initialOnDropViewCount + 1)
    expect(firstView.getPrepareForRecycleCount()).toBe(
      initialPrepareForRecycleCount + (SUPPORTS_NATIVE_VIEW_RECYCLING ? 1 : 0)
    )
    expect(firstView.getInvalidLifecycleOrderCount()).toBe(0)
    const firstNativeDefaultSetterCountAfterRecycle =
      firstView.getNativeDefaultValueSetterCallCount()
    expect(firstNativeDefaultSetterCountAfterRecycle).toBe(0)

    const secondRef = deferred<RecyclableTestViewRef>()
    const secondLayout = deferred<LayoutRectangle>()
    await renderResult.rerender(
      <RecyclableTestView
        testID="recyclable-view-lifecycle"
        style={RESIZED_SIZE}
        hybridRef={callback((view) => secondRef.resolve(view))}
        isBlue={false}
        nativeDefaultValue={0}
        onLayout={({ nativeEvent }) => secondLayout.resolve(nativeEvent.layout)}
      />
    )

    const secondView = await secondRef.promise
    const reportedSecondLayout = await secondLayout.promise
    expect(secondView.equals(firstView)).toBe(SUPPORTS_NATIVE_VIEW_RECYCLING)
    expect(secondView.getPrepareForRecycleCount()).toBe(
      SUPPORTS_NATIVE_VIEW_RECYCLING ? initialPrepareForRecycleCount + 1 : 0
    )
    expect(secondView.getOnDropViewCount()).toBe(
      SUPPORTS_NATIVE_VIEW_RECYCLING ? initialOnDropViewCount + 1 : 0
    )
    expect(secondView.getInvalidLifecycleOrderCount()).toBe(0)
    expect(secondView.isBlue).toBe(false)
    expect(secondView.nativeDefaultValue).toBe(0)
    expect(secondView.getNativeDefaultValueSetterCallCount()).toBe(1)
    expect(reportedSecondLayout.width).toBeCloseTo(RESIZED_SIZE.width, 0)
    expect(reportedSecondLayout.height).toBeCloseTo(RESIZED_SIZE.height, 0)

    const secondCapture = await captureView('recyclable-view-lifecycle')
    expectRenderedSize(secondCapture.size, RESIZED_SIZE)
    expectRed(secondCapture.pixelCoverage)

    await renderResult.rerender(<View />)
    await waitForRecyclableViewRemoval(
      secondView,
      'recyclable-view-lifecycle',
      SUPPORTS_NATIVE_VIEW_RECYCLING ? initialOnDropViewCount + 2 : 1,
      SUPPORTS_NATIVE_VIEW_RECYCLING ? initialPrepareForRecycleCount + 2 : 0
    )
    expect(screen.queryByTestId('recyclable-view-lifecycle')).toBeNull()
    expect(secondView.getOnDropViewCount()).toBe(
      SUPPORTS_NATIVE_VIEW_RECYCLING ? initialOnDropViewCount + 2 : 1
    )
    expect(secondView.getPrepareForRecycleCount()).toBe(
      (SUPPORTS_NATIVE_VIEW_RECYCLING ? initialPrepareForRecycleCount + 1 : 0) +
        (SUPPORTS_NATIVE_VIEW_RECYCLING ? 1 : 0)
    )
    expect(secondView.getInvalidLifecycleOrderCount()).toBe(0)
    const secondNativeDefaultSetterCountAfterRecycle =
      secondView.getNativeDefaultValueSetterCallCount()
    expect(secondNativeDefaultSetterCountAfterRecycle).toBe(
      SUPPORTS_NATIVE_VIEW_RECYCLING ? 0 : 1
    )

    const thirdRef = deferred<RecyclableTestViewRef>()
    const thirdLayout = deferred<LayoutRectangle>()
    await renderResult.rerender(
      <RecyclableTestView
        testID="recyclable-view-lifecycle"
        style={INITIAL_SIZE}
        hybridRef={callback((view) => thirdRef.resolve(view))}
        isBlue={true}
        onLayout={({ nativeEvent }) => thirdLayout.resolve(nativeEvent.layout)}
      />
    )

    const thirdView = await thirdRef.promise
    const reportedThirdLayout = await thirdLayout.promise
    expect(thirdView.equals(secondView)).toBe(SUPPORTS_NATIVE_VIEW_RECYCLING)
    expect(thirdView.equals(firstView)).toBe(SUPPORTS_NATIVE_VIEW_RECYCLING)
    expect(thirdView.getPrepareForRecycleCount()).toBe(
      SUPPORTS_NATIVE_VIEW_RECYCLING ? initialPrepareForRecycleCount + 2 : 0
    )
    expect(thirdView.getOnDropViewCount()).toBe(
      SUPPORTS_NATIVE_VIEW_RECYCLING ? initialOnDropViewCount + 2 : 0
    )
    expect(thirdView.getInvalidLifecycleOrderCount()).toBe(0)
    expect(thirdView.isBlue).toBe(true)
    expect(thirdView.nativeDefaultValue).toBe(42)
    expect(thirdView.getNativeDefaultValueSetterCallCount()).toBe(0)
    expect(reportedThirdLayout.width).toBeCloseTo(INITIAL_SIZE.width, 0)
    expect(reportedThirdLayout.height).toBeCloseTo(INITIAL_SIZE.height, 0)

    const thirdCapture = await captureView('recyclable-view-lifecycle')
    expectRenderedSize(thirdCapture.size, INITIAL_SIZE)
    expectBlue(thirdCapture.pixelCoverage)
  })
})
