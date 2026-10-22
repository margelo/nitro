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
    - Swift Package Manager integration (`npx react-native spm`)

  </TabItem>
  <TabItem value="android" label="Android">
    Use the Android SDK, NDK, and Gradle versions required by your React Native release.

  </TabItem>

</Tabs>

For an existing CocoaPods project, run `npx react-native spm add --deintegrate` from the app directory to convert its iOS integration. This
step requires CocoaPods to remove its existing integration. Nitro's podspec contains discovery metadata for the React Native CLI; native
builds use SwiftPM.

Standalone `nitro-core` projects do not depend on React Native.
