import * as React from 'react'
import { PixelRatio, View, type LayoutRectangle } from 'react-native'
import { describe, expect, it, render, waitUntil } from 'react-native-harness'
import { screen } from '@react-native-harness/ui'
import { callback } from 'react-native-nitro-modules'
import {
  ChildrenContainerTestView,
  type ChildrenContainerTestViewRef,
  ChildrenTestView,
  type ChildrenTestViewRef,
  TestView,
} from 'react-native-nitro-test'
import * as UPNG from 'upng-js'

// Regression tests for https://github.com/margelo/nitro/issues/873 - rendering
// React children inside a Nitro View.

const RENDER_TIMEOUT = 4_000
const CONTAINER_SIZE = { width: 120, height: 120 }
/** Height of a single child, so exactly two of them fill the container. */
const CHILD_HEIGHT = CONTAINER_SIZE.height / 2

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

interface DecodedImage {
  width: number
  height: number
  rgba: Uint8Array
}

async function captureView(testID: string): Promise<DecodedImage> {
  const element = await screen.findByTestId(testID)
  const screenshot = await screen.screenshot(element)
  if (screenshot == null) {
    throw new Error(`Failed to capture the mounted View "${testID}".`)
  }
  const copiedData = Uint8Array.from(screenshot.data)
  const decodedImage = UPNG.decode(copiedData.buffer)
  const rgbaBuffer = UPNG.toRGBA8(decodedImage)[0]
  if (rgbaBuffer == null) {
    throw new Error('Failed to decode the Harness UI PNG screenshot.')
  }
  return {
    width: decodedImage.width,
    height: decodedImage.height,
    rgba: new Uint8Array(rgbaBuffer),
  }
}

type Color = 'red' | 'green' | 'blue' | 'other'

function classify(red: number, green: number, blue: number): Color {
  const margin = 50
  if (red - green > margin && red - blue > margin) return 'red'
  if (green - red > margin && green - blue > margin) return 'green'
  if (blue - red > margin && blue - green > margin) return 'blue'
  return 'other'
}

/** The colors at the vertical center of the top and the bottom half of a View. */
async function captureHalves(testID: string): Promise<[Color, Color]> {
  const { width, height, rgba } = await captureView(testID)
  const sample = (yFraction: number): Color => {
    const x = Math.floor(width / 2)
    const y = Math.floor(height * yFraction)
    const offset = (y * width + x) * 4
    return classify(rgba[offset]!, rgba[offset + 1]!, rgba[offset + 2]!)
  }
  return [sample(0.25), sample(0.75)]
}

/** The fraction of pixels of a View that are dominantly red. */
async function getRedCoverage(testID: string): Promise<number> {
  const { rgba } = await captureView(testID)
  let redPixels = 0
  for (let i = 0; i < rgba.length; i += 4) {
    if (
      rgba[i + 3]! > 250 &&
      classify(rgba[i]!, rgba[i + 1]!, rgba[i + 2]!) === 'red'
    ) {
      redPixels += 1
    }
  }
  return redPixels / (rgba.length / 4)
}

async function expectNativeChildCount(
  view: { getNativeChildCount(): number },
  expectedCount: number,
  context = ''
): Promise<void> {
  try {
    await waitUntil(() => view.getNativeChildCount() === expectedCount, {
      timeout: RENDER_TIMEOUT,
    })
  } catch {
    throw new Error(
      `Expected ${expectedCount} native children${context}, but the native View has ${view.getNativeChildCount()}.`
    )
  }
  expect(view.getNativeChildCount()).toBe(expectedCount)
}

/** A full-width, half-height colored box - `key` also picks its color. */
function ColorBox({ name }: { name: 'a' | 'b' | 'c' }): React.ReactElement {
  const backgroundColor = { a: 'red', b: 'lime', c: 'blue' }[name]
  return (
    <View
      testID={`children-box-${name}`}
      style={{ height: CHILD_HEIGHT, backgroundColor }}
    />
  )
}

describe('Nitro View children', () => {
  it('mounts a React child into the native View', async () => {
    const viewRef = deferred<ChildrenTestViewRef>()
    await render(
      <ChildrenTestView
        testID="children-initial"
        style={CONTAINER_SIZE}
        isBlue={true}
        hybridRef={callback((view) => viewRef.resolve(view))}
      >
        <View
          testID="children-initial-child"
          style={{ width: 20, height: 20 }}
        />
      </ChildrenTestView>,
      { timeout: RENDER_TIMEOUT }
    )

    const view = await viewRef.promise
    await expectNativeChildCount(view, 1)
    expect(screen.queryByTestId('children-initial-child')).not.toBeNull()
  })

  it('renders children on top of the native View', async () => {
    const viewRef = deferred<ChildrenTestViewRef>()
    await render(
      <ChildrenTestView
        testID="children-zorder"
        style={CONTAINER_SIZE}
        isBlue={true}
        hybridRef={callback((view) => viewRef.resolve(view))}
      >
        <View style={{ flex: 1, backgroundColor: 'red' }} />
      </ChildrenTestView>,
      { timeout: RENDER_TIMEOUT }
    )

    const view = await viewRef.promise
    await expectNativeChildCount(view, 1)
    // Before this feature, the child was mounted *behind* the Nitro View on
    // iOS, so the blue native View covered it completely.
    expect(await getRedCoverage('children-zorder')).toBeGreaterThan(0.95)
  })

  it('positions children with Yoga, honouring padding and border', async () => {
    const viewRef = deferred<ChildrenTestViewRef>()
    const childLayout = deferred<LayoutRectangle>()
    await render(
      <ChildrenTestView
        testID="children-layout"
        style={{
          width: 200,
          height: 200,
          padding: 20,
          borderWidth: 2,
          borderColor: 'black',
          borderRadius: 20,
        }}
        isBlue={true}
        hybridRef={callback((view) => viewRef.resolve(view))}
      >
        <View
          testID="children-layout-child"
          style={{ flex: 1, backgroundColor: 'red' }}
          onLayout={({ nativeEvent }) =>
            childLayout.resolve(nativeEvent.layout)
          }
        />
      </ChildrenTestView>,
      { timeout: RENDER_TIMEOUT }
    )

    const view = await viewRef.promise
    await expectNativeChildCount(view, 1)

    // Yoga insets the child by border + padding.
    const layout = await childLayout.promise
    expect(layout.x).toBeCloseTo(22, 0)
    expect(layout.y).toBeCloseTo(22, 0)
    expect(layout.width).toBeCloseTo(156, 0)
    expect(layout.height).toBeCloseTo(156, 0)

    // ...and the child is rendered at that size on screen, i.e. the native
    // container did not inset it a second time. Device pixels are rounded, so
    // allow the screenshot to be off by one physical pixel per edge.
    const expectedPixels = PixelRatio.getPixelSizeForLayoutSize(156)
    const rendered = await captureView('children-layout-child')
    expect(Math.abs(rendered.width - expectedPixels)).toBeLessThanOrEqual(2)
    expect(Math.abs(rendered.height - expectedPixels)).toBeLessThanOrEqual(2)
  })

  it('adds and removes children', async () => {
    const viewRef = deferred<ChildrenTestViewRef>()
    const renderChildren = (children: React.ReactNode) => (
      <ChildrenTestView
        testID="children-add-remove"
        style={CONTAINER_SIZE}
        isBlue={true}
        hybridRef={callback((view) => viewRef.resolve(view))}
      >
        {children}
      </ChildrenTestView>
    )

    const renderResult = await render(
      renderChildren(<ColorBox key="a" name="a" />),
      { timeout: RENDER_TIMEOUT }
    )
    const view = await viewRef.promise
    await expectNativeChildCount(view, 1)
    expect(await captureHalves('children-add-remove')).toEqual(['red', 'blue'])

    // Add a second child below the first one.
    await renderResult.rerender(
      renderChildren([
        <ColorBox key="a" name="a" />,
        <ColorBox key="b" name="b" />,
      ])
    )
    await expectNativeChildCount(view, 2)
    expect(await captureHalves('children-add-remove')).toEqual(['red', 'green'])

    // Remove the first one - the second one moves up.
    await renderResult.rerender(renderChildren(<ColorBox key="b" name="b" />))
    await expectNativeChildCount(view, 1)
    expect(screen.queryByTestId('children-box-a')).toBeNull()
    expect(await captureHalves('children-add-remove')).toEqual([
      'green',
      'blue',
    ])
  })

  it('reorders and replaces children', async () => {
    const viewRef = deferred<ChildrenTestViewRef>()
    const renderChildren = (children: React.ReactNode) => (
      <ChildrenTestView
        testID="children-reorder"
        style={CONTAINER_SIZE}
        isBlue={true}
        hybridRef={callback((view) => viewRef.resolve(view))}
      >
        {children}
      </ChildrenTestView>
    )

    const renderResult = await render(
      renderChildren([
        <ColorBox key="a" name="a" />,
        <ColorBox key="b" name="b" />,
      ]),
      { timeout: RENDER_TIMEOUT }
    )
    const view = await viewRef.promise
    await expectNativeChildCount(view, 2)
    expect(await captureHalves('children-reorder')).toEqual(['red', 'green'])

    // Reorder the very same (keyed) children.
    await renderResult.rerender(
      renderChildren([
        <ColorBox key="b" name="b" />,
        <ColorBox key="a" name="a" />,
      ])
    )
    await expectNativeChildCount(view, 2)
    expect(await captureHalves('children-reorder')).toEqual(['green', 'red'])

    // Replace both of them with a different child.
    await renderResult.rerender(renderChildren(<ColorBox key="c" name="c" />))
    await expectNativeChildCount(view, 1)
    expect(screen.queryByTestId('children-box-a')).toBeNull()
    expect(screen.queryByTestId('children-box-b')).toBeNull()
    expect(screen.queryByTestId('children-box-c')).not.toBeNull()
  })

  it('goes from no children to children and back', async () => {
    const viewRef = deferred<ChildrenTestViewRef>()
    const renderChildren = (isVisible: boolean) => (
      <ChildrenTestView
        testID="children-conditional"
        style={CONTAINER_SIZE}
        isBlue={true}
        hybridRef={callback((view) => viewRef.resolve(view))}
      >
        {isVisible && <ColorBox key="a" name="a" />}
      </ChildrenTestView>
    )

    const renderResult = await render(renderChildren(false), {
      timeout: RENDER_TIMEOUT,
    })
    const view = await viewRef.promise
    await expectNativeChildCount(view, 0)
    expect(await captureHalves('children-conditional')).toEqual([
      'blue',
      'blue',
    ])

    await renderResult.rerender(renderChildren(true))
    await expectNativeChildCount(view, 1)
    expect(await captureHalves('children-conditional')).toEqual(['red', 'blue'])

    await renderResult.rerender(renderChildren(false))
    await expectNativeChildCount(view, 0)
    expect(await captureHalves('children-conditional')).toEqual([
      'blue',
      'blue',
    ])

    // Unmounting an emptied container must not crash either.
    renderResult.unmount()
    await waitUntil(
      () => screen.queryByTestId('children-conditional') === null,
      { timeout: RENDER_TIMEOUT }
    )
  })

  it('nests Nitro Views inside each other', async () => {
    const outerRef = deferred<ChildrenTestViewRef>()
    const innerRef = deferred<ChildrenTestViewRef>()
    const leafLayout = deferred<LayoutRectangle>()

    await render(
      <ChildrenTestView
        testID="children-nested-outer"
        style={{ width: 200, height: 200, padding: 10 }}
        isBlue={true}
        hybridRef={callback((view) => outerRef.resolve(view))}
      >
        <ChildrenTestView
          testID="children-nested-inner"
          style={{ width: 100, height: 100, padding: 10 }}
          isBlue={false}
          hybridRef={callback((view) => innerRef.resolve(view))}
        >
          <View
            testID="children-nested-leaf"
            style={{ flex: 1 }}
            onLayout={({ nativeEvent }) =>
              leafLayout.resolve(nativeEvent.layout)
            }
          />
        </ChildrenTestView>
        <TestView
          testID="children-nested-leaf-nitro"
          style={{ width: 40, height: 40 }}
          isBlue={true}
          hasBeenCalled={false}
          colorScheme="dark"
          someCallback={callback(() => {})}
        />
      </ChildrenTestView>,
      { timeout: RENDER_TIMEOUT }
    )

    const outer = await outerRef.promise
    const inner = await innerRef.promise
    // A nested Nitro View and a leaf Nitro View are both just children.
    await expectNativeChildCount(outer, 2)
    await expectNativeChildCount(inner, 1)

    // The innermost child is positioned relative to the inner Nitro View.
    const layout = await leafLayout.promise
    expect(layout.x).toBeCloseTo(10, 0)
    expect(layout.y).toBeCloseTo(10, 0)
    expect(layout.width).toBeCloseTo(80, 0)
    expect(screen.queryByTestId('children-nested-leaf-nitro')).not.toBeNull()
  })

  it('survives repeated child updates', async () => {
    const viewRef = deferred<ChildrenTestViewRef>()
    const renderChildren = (keys: number[]) => (
      <ChildrenTestView
        testID="children-stress"
        style={{ width: 120, height: 200 }}
        isBlue={true}
        hybridRef={callback((view) => viewRef.resolve(view))}
      >
        {keys.map((key) => (
          // The background color keeps React Native from flattening the View
          // away, so every React child is also a native child.
          <View
            key={key}
            style={{ width: 20, height: 10, backgroundColor: 'red' }}
          />
        ))}
      </ChildrenTestView>
    )

    const renderResult = await render(renderChildren([1, 2, 3]), {
      timeout: RENDER_TIMEOUT,
    })
    const view = await viewRef.promise
    await expectNativeChildCount(view, 3)

    const steps = [
      [],
      [1],
      [1, 2],
      [3, 1],
      [],
      [1, 2, 3, 4, 5],
      [5, 4, 3, 2, 1],
      [3],
    ]
    for (let round = 0; round < 2; round++) {
      for (const step of steps) {
        await renderResult.rerender(renderChildren(step))
        await expectNativeChildCount(
          view,
          step.length,
          ` after round ${round}, step [${step.join(',')}]`
        )
      }
    }

    // No stale, duplicated or leaked native children after all of that.
    await renderResult.rerender(renderChildren([1, 2, 3]))
    await expectNativeChildCount(view, 3)
  })

  it('mounts children into an overridden childrenContainer', async () => {
    const viewRef = deferred<ChildrenContainerTestViewRef>()
    const renderChildren = (children: React.ReactNode) => (
      <ChildrenContainerTestView
        testID="children-container"
        style={CONTAINER_SIZE}
        isBlue={true}
        hybridRef={callback((view) => viewRef.resolve(view))}
      >
        {children}
      </ChildrenContainerTestView>
    )

    const renderResult = await render(
      renderChildren(<ColorBox key="a" name="a" />),
      { timeout: RENDER_TIMEOUT }
    )
    const view = await viewRef.promise
    await expectNativeChildCount(view, 1)
    // The child landed in the container, not in `view` - which still holds
    // exactly one child of its own, the container.
    expect(view.getViewChildCount()).toBe(1)

    // The container spans the View, so Yoga's frames still land correctly and
    // the children are drawn on top of the native View.
    expect(await captureHalves('children-container')).toEqual(['red', 'blue'])

    await renderResult.rerender(
      renderChildren([
        <ColorBox key="a" name="a" />,
        <ColorBox key="b" name="b" />,
      ])
    )
    await expectNativeChildCount(view, 2)
    expect(view.getViewChildCount()).toBe(1)
    expect(await captureHalves('children-container')).toEqual(['red', 'green'])

    await renderResult.rerender(renderChildren(null))
    await expectNativeChildCount(view, 0)
    expect(view.getViewChildCount()).toBe(1)
  })

  it('keeps a leaf Nitro View working exactly as before', async () => {
    await render(
      <TestView
        testID="children-leaf-regression"
        style={CONTAINER_SIZE}
        isBlue={true}
        hasBeenCalled={false}
        colorScheme="dark"
        someCallback={callback(() => {})}
      />,
      { timeout: RENDER_TIMEOUT }
    )
    await waitUntil(
      () => screen.queryByTestId('children-leaf-regression') !== null,
      { timeout: RENDER_TIMEOUT }
    )
    expect(screen.queryByTestId('children-leaf-regression')).not.toBeNull()
  })
})
