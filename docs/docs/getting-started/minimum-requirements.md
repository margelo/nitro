---
description: Check the React Native, iOS, Android, Swift, Kotlin, Gradle, and C++ requirements needed to use Nitro Modules.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Minimum Requirements

Nitro is a Framework built on top of newer APIs like `jsi::NativeState`.
The React Native package requires the New Architecture. Make sure your app meets the minimum requirements:

<Tabs groupId="platform">
  <TabItem value="ios" label="iOS" default>
    - react-native 0.78 or higher
    - Xcode 16.4 or higher
    - Swift 5.9 or higher
  </TabItem>
  <TabItem value="android" label="Android">
    - react-native 0.78 or higher
    - `compileSdkVersion` 34 or higher
    - `ndkVersion` 27 or higher
  </TabItem>
</Tabs>

If your React Native version allows opting out of the New Architecture, set `newArchEnabled=true` in `android/gradle.properties` and run `RCT_NEW_ARCH_ENABLED=1 bundle exec pod install` in your `ios` directory. Rebuild the app after changing these settings.

Standalone `nitro-core` projects do not depend on React Native or its architecture settings.
