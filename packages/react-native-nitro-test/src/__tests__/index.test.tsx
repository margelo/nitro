import * as React from 'react'
import { Text } from 'react-native'

// Type-level regression tests for https://github.com/margelo/nitro/issues/873.
//
// They are verified by `tsc --noEmit` (`bun typecheck`) - a `@ts-expect-error`
// that stops erroring fails the type check. Nothing here is rendered: the views
// are declared type-only, because importing the real ones would pull in the
// native `NitroModules` TurboModule, which does not exist under jest.
type NitroTest = typeof import('../index')
declare const ChildrenTestView: NitroTest['ChildrenTestView']
declare const TestView: NitroTest['TestView']

function acceptsChildren(): React.ReactElement {
  return (
    <ChildrenTestView isBlue={true}>
      <Text>Hello</Text>
    </ChildrenTestView>
  )
}

function acceptsNoChildren(): React.ReactElement {
  return <ChildrenTestView isBlue={true} />
}

function rejectsChildrenOnALeafView(): React.ReactElement {
  return (
    <TestView
      isBlue={true}
      hasBeenCalled={false}
      colorScheme="dark"
      someCallback={{ f: () => {} }}
    >
      {/* @ts-expect-error - `TestView` is a leaf View and cannot render children. */}
      <Text>Hello</Text>
    </TestView>
  )
}

function doesNotExposeChildrenOnTheHybridObject(): React.ReactElement {
  return (
    <ChildrenTestView
      isBlue={true}
      hybridRef={{
        f: (ref) => {
          // `children` is a React concept - it is not a member of the Hybrid Object.
          // @ts-expect-error - `children` does not exist on the Hybrid Object.
          const children = ref.children
          expect(children).toBeUndefined()
          ref.getNativeChildCount()
        },
      }}
    />
  )
}

it('type-checks Nitro View children', () => {
  expect([
    acceptsChildren,
    acceptsNoChildren,
    rejectsChildrenOnALeafView,
    doesNotExposeChildrenOnTheHybridObject,
  ]).toHaveLength(4)
})
