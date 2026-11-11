import * as React from 'react'
import { PixelRatio, type ViewStyle } from 'react-native'
import { describe, expect, it, render, waitFor } from 'react-native-harness'
import { screen } from '@react-native-harness/ui'
import { PaddedTestView } from 'react-native-nitro-test'
import * as UPNG from 'upng-js'

const TEST_ID = 'padded-test-view'
const COLOR_DOMINANCE_MARGIN = 50
const SIZE = { width: 120, height: 100 }
const NATIVE_PADDING = 7
const UPDATED_PADDING = {
  paddingLeft: 20,
  paddingTop: 4,
  paddingRight: 8,
  paddingBottom: 12,
}

async function expectNativePadding(): Promise<void> {
  const element = await screen.findByTestId(TEST_ID)
  const screenshot = await screen.screenshot(element)
  if (screenshot == null) {
    throw new Error('Failed to capture the padded view.')
  }

  const image = UPNG.decode(Uint8Array.from(screenshot.data).buffer)
  const rgba = UPNG.toRGBA8(image)[0]
  if (rgba == null) {
    throw new Error('Failed to decode the padded view screenshot.')
  }

  expect({ width: image.width, height: image.height }).toEqual({
    width: PixelRatio.getPixelSizeForLayoutSize(SIZE.width),
    height: PixelRatio.getPixelSizeForLayoutSize(SIZE.height),
  })

  const padding = PixelRatio.getPixelSizeForLayoutSize(NATIVE_PADDING)
  const right = image.width - padding
  const bottom = image.height - padding
  const pixels = new DataView(rgba)
  for (let offset = 0; offset < rgba.byteLength; offset += 4) {
    const pixel = offset / 4
    const x = pixel % image.width
    const y = Math.floor(pixel / image.width)
    const isContent = x >= padding && x < right && y >= padding && y < bottom
    const red = pixels.getUint8(offset)
    const green = pixels.getUint8(offset + 1)
    const blue = pixels.getUint8(offset + 2)
    const alpha = pixels.getUint8(offset + 3)
    const matchesColor = isContent
      ? blue - red > COLOR_DOMINANCE_MARGIN &&
        blue - green > COLOR_DOMINANCE_MARGIN
      : red - green > COLOR_DOMINANCE_MARGIN &&
        red - blue > COLOR_DOMINANCE_MARGIN
    if (!matchesColor || alpha < 250) {
      throw new Error(
        `Expected ${isContent ? 'blue content' : 'red padding'} at (${x}, ${y}), received rgba(${red}, ${green}, ${blue}, ${alpha}).`
      )
    }
  }
}

describe('PaddedTestView', () => {
  it('keeps native padding at 7 when React sets 1, changes it, or removes it', async () => {
    const style: ViewStyle = {
      width: SIZE.width,
      height: SIZE.height,
      backgroundColor: '#ff0000',
    }
    const result = await render(
      <PaddedTestView testID={TEST_ID} style={style} />,
      { timeout: 4000 }
    )
    await waitFor(expectNativePadding, { timeout: 4000 })

    await result.rerender(
      <PaddedTestView testID={TEST_ID} style={[style, { padding: 1 }]} />
    )
    await waitFor(expectNativePadding, { timeout: 4000 })

    await result.rerender(
      <PaddedTestView testID={TEST_ID} style={[style, UPDATED_PADDING]} />
    )
    await waitFor(expectNativePadding, { timeout: 4000 })

    await result.rerender(<PaddedTestView testID={TEST_ID} style={style} />)
    await waitFor(expectNativePadding, { timeout: 4000 })
  })
})
