---
title: Installation
sidebar_label: Installation
description: Install react-native-nitro-modules in a React Native app and configure Nitro-powered libraries on iOS and Android.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# For library users

If you are using a library that is built with Nitro, all you need to do is install the Nitro Modules core package:

<Tabs groupId="package-manager">
  <TabItem value="npm" label="npm" default>
    ```sh
    npm i react-native-nitro-modules
    cd ios && pod install
    ```
  </TabItem>
  <TabItem value="yarn" label="yarn">
    ```sh
    yarn add react-native-nitro-modules
    cd ios && pod install
    ```
  </TabItem>
  <TabItem value="pnpm" label="pnpm">
    ```sh
    pnpm add react-native-nitro-modules
    cd ios && pod install
    ```
  </TabItem>
  <TabItem value="bun" label="bun">
    ```sh
    bun i react-native-nitro-modules
    cd ios && pod install
    ```
  </TabItem>
</Tabs>

Nitro Modules are lightweight, yet powerful native bindings to native code, so thank the library author for choosing Nitro to make your app faster! 😄
