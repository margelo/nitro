---
description: Check the React Native, iOS/macOS/tvOS/visionOS, Android, and environment requirements needed to use Nitro Modules.
---

import Tabs from '@theme/Tabs'; import TabItem from '@theme/TabItem';

# Minimum Requirements

Nitro V1's React Native package requires React Native 0.88 or newer with the New Architecture.

<Tabs groupId="platform">
  <TabItem value="apple" label="Apple" default>
    - iOS 16, macOS 13, tvOS 16 or visionOS 1 or higher
    - Xcode with Swift 6.4 or higher
    - CocoaPods or Swift Package Manager integration

  </TabItem>
  <TabItem value="android" label="Android">
    Use the Android SDK, NDK, and Gradle versions required by your React Native release.

  </TabItem>

</Tabs>

Keep the package manager your React Native app already uses. See [Installation](../resources/for-library-users) for CocoaPods and Swift
Package Manager setup. Both build the same Nitro runtime and generated bindings.

Standalone `nitro-core` projects do not depend on React Native.
