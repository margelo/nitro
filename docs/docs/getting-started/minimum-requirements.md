---
description: Check the React Native, iOS, Android, Windows, Swift, Kotlin, Gradle, and C++ requirements needed to use Nitro Modules.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Minimum Requirements

Nitro is a Framework built on top of newer APIs like `jsi::NativeState`.
To use Nitro, make sure your app meets the minimum requirements:

<Tabs groupId="platform">
  <TabItem value="ios" label="iOS" default>
    - react-native 0.75 or higher
    - Xcode 16.4 or higher
    - Swift 5.9 or higher
  </TabItem>
  <TabItem value="android" label="Android">
    - react-native 0.75 or higher
    - `compileSdkVersion` 34 or higher
    - `ndkVersion` 27 or higher
  </TabItem>
  <TabItem value="windows" label="Windows">
    - react-native-windows 0.78 or higher (`ReactContext::CallInvoker()` was added in 0.78)
    - Visual Studio 2022 with the "Desktop development with C++" workload (toolset v143)
    - Hybrid Objects must be implemented in C++ - see [Windows](../guides/windows.md)
  </TabItem>
</Tabs>
