---
description: Understand Nitro Modules, the React Native library structure for type-safe native modules backed by Hybrid Objects and statically compiled JSI bindings.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Nitro Modules

A **Nitro Module** is a library built with Nitro. It may contain one or more [**Hybrid Objects**](hybrid-objects).

## Structure

A Nitro Module contains the usual react-native library structure, with `ios/` and `android/` folders, a `package.json`, and a `*.podspec` file for iOS.
In addition to the base react-native library template, a Nitro Module also contains:

- A TypeScript setup
- A `nitro.json` configuration file

## Creating a Nitro Module

### 1. Initialize the template

To create a new Nitro Module, simply run `nitrogen init <moduleName>`:

```sh
npx nitrogen@latest init react-native-math
```

### 2. Implement your Hybrid Objects

Once you set up the library, you can start implementing your Hybrid Objects!


<Tabs groupId="nitrogen-or-not">
  <TabItem value="nitrogen" label="With Nitrogen ✨" default>

  With [Nitrogen](nitrogen) you can ✨ automagically ✨ generate all native interfaces from your TypeScript definitions.
  After implementing the generated specs, register them using the `HybridObjectRegistry`.

  See [Hybrid Objects (Implementation)](hybrid-objects#implementation) for more information.

  </TabItem>
  <TabItem value="manually" label="Manually">

  If you don't want to use Nitrogen, simply create your native C++ classes that inherit from `HybridObject`, and register them using the `HybridObjectRegistry`.

  See [Hybrid Objects (Implementation)](hybrid-objects#implementation) for more information.

  </TabItem>
</Tabs>

### 3. Set up an example app

After creating a Nitro Module, it's time to set up an example app to test your library!

<Tabs groupId="expo-or-bare">
  <TabItem value="expo" label="Expo" default>
  ```sh
  npx create-expo-app@latest
  ```
  </TabItem>
  <TabItem value="bare" label="Bare RN">
  ```sh
  npx @react-native-community/cli@latest init NitroMathExample
  ```
  </TabItem>
</Tabs>

:::tip
The Hybrid Objects from your Nitro Module will be registered in the `HybridObjectRegistry`. This registration process needs to be called from somewhere:
- In React Native, this happens in the `*Package.kt` file which calls `.initializeNative()`.
- If you are not using React Native, you need to manually call `.initializeNative()` in your library's entry point.
:::
