---
title: Installation
sidebar_label: Installation
description: Install react-native-nitro-modules in a React Native app and configure Nitro-powered libraries on iOS and Android.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# For library users

Nitro V1 requires React Native 0.88 or newer with the New Architecture. Install the Nitro alpha package alongside libraries built for V1:

<Tabs groupId="package-manager">
  <TabItem value="npm" label="npm" default>
    ```sh
    npm i react-native-nitro-modules@alpha
    ```
  </TabItem>
  <TabItem value="yarn" label="yarn">
    ```sh
    yarn add react-native-nitro-modules@alpha
    ```
  </TabItem>
  <TabItem value="pnpm" label="pnpm">
    ```sh
    pnpm add react-native-nitro-modules@alpha
    ```
  </TabItem>
  <TabItem value="bun" label="bun">
    ```sh
    bun i react-native-nitro-modules@alpha
    ```
  </TabItem>
</Tabs>

For iOS, use Xcode with Swift 6.4 or newer and set up Swift Package Manager from your app directory:

```sh
npx react-native spm
```

If your project already uses CocoaPods, convert it with `npx react-native spm add --deintegrate` first. The conversion needs CocoaPods to remove its existing integration. Open the app's `.xcodeproj` in Xcode after setup.

Keep Nitro and the libraries' generated bindings on matching V1 versions. The [minimum requirements](../getting-started/minimum-requirements) describe the supported native toolchains.
