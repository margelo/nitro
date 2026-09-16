---
title: Testing Nitro Modules
description: Test TypeScript wrappers with Jest and run native Nitro bindings in an isolated React Native JavaScript runtime.
toc_min_heading_level: 2
toc_max_heading_level: 3
---

# Testing Nitro Modules

A Nitro Module crosses three boundaries: your TypeScript API, Nitrogen's generated bindings, and the native implementation. Test each boundary with the tool that can actually observe it.

| What you need to verify                               | Recommended test                                                  |
| ----------------------------------------------------- | ----------------------------------------------------------------- |
| TypeScript wrappers, validation, and fallback logic   | Jest with the Nitro boundary mocked                               |
| Generated Swift, Kotlin, and C++ bindings             | Run Nitrogen, then build the linked example app on both platforms |
| Calls through JSI into the real native implementation | React Native Harness on iOS and Android                           |

Jest runs in Node and cannot prove that native registration, conversion, threading, or generated bindings work. Keep those claims in a device or simulator test.

## Test TypeScript wrapper logic with Jest

Mock the smallest native boundary and test only the JavaScript or TypeScript behavior your library owns. For example, this wrapper creates a native `Math` Hybrid Object and adds input validation:

```ts title="src/Math.ts"
import { NitroModules, type HybridObject } from 'react-native-nitro-modules'

interface Math extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  add(a: number, b: number): number
}

const math = NitroModules.createHybridObject<Math>('Math')

export function addPositive(a: number, b: number): number {
  if (a < 0 || b < 0) {
    throw new Error('Expected positive numbers')
  }
  return math.add(a, b)
}
```

The Jest test replaces the Hybrid Object with a deterministic mock:

```ts title="src/__tests__/Math.test.ts"
const mockAdd = jest.fn((a: number, b: number) => a + b)

jest.mock('react-native-nitro-modules', () => ({
  NitroModules: {
    createHybridObject: () => ({ add: mockAdd }),
  },
}))

import { addPositive } from '../Math'

test('validates input before calling native code', () => {
  expect(() => addPositive(-1, 2)).toThrow('Expected positive numbers')
  expect(mockAdd).not.toHaveBeenCalled()

  expect(addPositive(2, 3)).toBe(5)
  expect(mockAdd).toHaveBeenCalledWith(2, 3)
})
```

This test covers the wrapper contract. It deliberately does not claim that `Math` is registered or that the Swift and Kotlin implementations return the correct value.

## Compile the generated bindings

Keep a small React Native example app in the library repository and link the Nitro Module into it. Add representative API shapes to the example's `*.nitro.ts` specs, then generate and build them in CI:

```sh
npx nitrogen
git diff --exit-code -- nitrogen/generated
```

After generation, build the example app for both platforms. A successful native build is the compile-time test for the generated Swift, Kotlin, and C++ surface. This is especially important for variants, tuples, optionals, inheritance, callbacks, and other shapes whose failures only appear in a native compiler.

Commit generated files when your library publishes them. The `git diff` check prevents a spec change from landing without its matching generated bindings.

## Test the native implementation with React Native Harness

[React Native Harness](https://github.com/software-mansion-labs/react-native-harness) loads a test bundle in a real React Native app. Nitro uses it in its own iOS and Android CI so tests execute through JSI against the registered native implementation.

### 1. Add the test runner

Install Harness and the platform runners as development dependencies in the example app:

```sh
npm install --save-dev react-native-harness \
  @react-native-harness/platform-android \
  @react-native-harness/platform-apple
```

Add a script and a Jest configuration:

```json title="package.json"
{
  "scripts": {
    "test:harness": "react-native-harness"
  }
}
```

```js title="jest.harness.config.mjs"
export default {
  preset: 'react-native-harness',
  testMatch: ['<rootDir>/**/__tests__/**/*.harness.[jt]s?(x)'],
}
```

### 2. Configure the linked app

Point Harness at the same entry point and component name used by the example app:

```js title="rn-harness.config.mjs"
import {
  androidEmulator,
  androidPlatform,
} from '@react-native-harness/platform-android'
import {
  applePlatform,
  appleSimulator,
} from '@react-native-harness/platform-apple'

export default {
  entryPoint: './index.js',
  appRegistryComponentName: 'MyExample',
  runners: [
    androidPlatform({
      name: 'android',
      device: androidEmulator(process.env.AVD_NAME, {
        apiLevel: Number(process.env.DEVICE_API_LEVEL),
        profile: process.env.DEVICE_PROFILE,
      }),
      bundleId: 'com.example.mynitromodule',
    }),
    applePlatform({
      name: 'ios',
      device: appleSimulator(process.env.DEVICE_MODEL, process.env.IOS_VERSION),
      bundleId: 'com.example.MyNitroModule',
    }),
  ],
  defaultRunner: 'android',
  resetEnvironmentBetweenTestFiles: 'runtime',
}
```

`resetEnvironmentBetweenTestFiles: 'runtime'` gives each test file a fresh JavaScript runtime. The native module remains the implementation linked into the host app.

### 3. Call the real Hybrid Object

Do not mock `react-native-nitro-modules` in a Harness test. Create the registered object and assert through its public TypeScript API:

```ts title="__tests__/math.harness.ts"
import { describe, expect, it } from 'react-native-harness'
import { NitroModules, type HybridObject } from 'react-native-nitro-modules'

interface Math extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  add(a: number, b: number): number
}

describe('Math', () => {
  it('calls the native implementation', () => {
    const math = NitroModules.createHybridObject<Math>('Math')
    expect(math.add(2, 3)).toBe(5)
  })
})
```

This one assertion covers native registration, Nitrogen's conversions, the Swift or Kotlin method, and the return path to JavaScript. Add separate cases for errors, promises, callbacks, or threading only when those behaviors are part of your API.

### 4. Build and run on both platforms

Build the example app before starting Harness. Pass the resulting app or APK explicitly:

```sh
HARNESS_APP_PATH=/absolute/path/to/MyExample.app \
  npm run test:harness -- --harnessRunner=ios

HARNESS_APP_PATH=/absolute/path/to/app-debug.apk \
  npm run test:harness -- --harnessRunner=android
```

Use a freshly built binary when native code or generated bindings change. A green JavaScript bundle with an old installed binary does not verify the new native implementation.

The Nitro repository contains runnable references for this setup:

- [`example/rn-harness.config.mjs`](https://github.com/margelo/nitro/blob/main/example/rn-harness.config.mjs) configures both platform runners.
- [`example/__tests__/nitro.harness.ts`](https://github.com/margelo/nitro/blob/main/example/__tests__/nitro.harness.ts) executes the same API against C++ and Swift/Kotlin Hybrid Objects.
- [`harness-ios.yml`](https://github.com/margelo/nitro/blob/main/.github/workflows/harness-ios.yml) and [`harness-android.yml`](https://github.com/margelo/nitro/blob/main/.github/workflows/harness-android.yml) show the complete CI build-and-run flow.

## Suggested CI order

Run the cheapest checks first and reserve devices for the cross-boundary tests:

1. Typecheck and run Jest wrapper tests.
2. Run Nitrogen and fail if generated output changed.
3. Build the linked example app for iOS and Android.
4. Run the Harness suite on both built apps.

This split keeps failures diagnostic: Jest points to wrapper logic, a native build points to generated or native source, and Harness points to runtime integration.
