import * as React from 'react'
import { PixelRatio, type ViewStyle } from 'react-native'
import { describe, expect, it, render, waitFor } from 'react-native-harness'
import { screen } from '@react-native-harness/ui'
import { PaddedTestView } from 'react-native-nitro-test'
import * as UPNG from 'upng-js'

const TEST_ID = 'padded-test-view'
const COLOR_DOMINANCE_MARGIN = 50
const SIZE = { width: 120, height: 100 }
const INITIAL_PADDING = { paddingLeft: 8, paddingTop: 12, paddingRight: 20, paddingBottom: 4 }
const UPDATED_PADDING = { paddingLeft: 20, paddingTop: 4, paddingRight: 8, paddingBottom: 12 }
const NO_PADDING = { paddingLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0 }

type Padding = typeof INITIAL_PADDING

async function expectRenderedPadding(padding: Padding): Promise<void> {
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

  const left = PixelRatio.getPixelSizeForLayoutSize(padding.paddingLeft)
  const top = PixelRatio.getPixelSizeForLayoutSize(padding.paddingTop)
  const right = image.width - PixelRatio.getPixelSizeForLayoutSize(padding.paddingRight)
  const bottom = image.height - PixelRatio.getPixelSizeForLayoutSize(padding.paddingBottom)
  const pixels = new DataView(rgba)
  for (let offset = 0; offset < rgba.byteLength; offset += 4) {
    const pixel = offset / 4
    const x = pixel % image.width
    const y = Math.floor(pixel / image.width)
    const isContent = x >= left && x < right && y >= top && y < bottom
    const red = pixels.getUint8(offset)
    const green = pixels.getUint8(offset + 1)
    const blue = pixels.getUint8(offset + 2)
    const alpha = pixels.getUint8(offset + 3)
    const matchesColor = isContent
      ? blue - red > COLOR_DOMINANCE_MARGIN && blue - green > COLOR_DOMINANCE_MARGIN
      : red - green > COLOR_DOMINANCE_MARGIN && red - blue > COLOR_DOMINANCE_MARGIN
    if (!matchesColor || alpha < 250) {
      throw new Error(
        `Expected ${isContent ? 'blue content' : 'red padding'} at (${x}, ${y}), received rgba(${red}, ${green}, ${blue}, ${alpha}).`
      )
    }
  }
}

describe('PaddedTestView', () => {
  it('applies, updates, and removes base padding around native content', async () => {
    const style: ViewStyle = { width: SIZE.width, height: SIZE.height, backgroundColor: '#ff0000' }
    const result = await render(<PaddedTestView testID={TEST_ID} style={[style, INITIAL_PADDING]} />, { timeout: 4000 })
    await waitFor(() => expectRenderedPadding(INITIAL_PADDING), { timeout: 4000 })

    await result.rerender(<PaddedTestView testID={TEST_ID} style={[style, UPDATED_PADDING]} />)
    await waitFor(() => expectRenderedPadding(UPDATED_PADDING), { timeout: 4000 })

    await result.rerender(<PaddedTestView testID={TEST_ID} style={style} />)
    await waitFor(() => expectRenderedPadding(NO_PADDING), { timeout: 4000 })
  })
})
