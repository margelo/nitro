---
description: Troubleshoot common Nitro Modules setup, build, codegen, iOS, Android, and native dependency issues in React Native projects.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Troubleshooting

This guide helps you troubleshoot issues in Nitro and should give you enough context to open a well-formed issue, even if you're not a native developer.

## Minimum requirements

First, make sure you meet the [minimum requirements](../getting-started/minimum-requirements) for Nitro.

## Ask for help

If you want to ask for help, join our [Margelo Community Discord](https://margelo.com/discord). Be respectful of everyone's time.

## Run the example app

Each release of Nitro contains a pre-built release version of the [Nitro Example app](https://github.com/margelo/nitro/tree/main/tests/react-native/apps/example). You can run this by following the ["Running the Example app" guide](running-example-app).

## Build error

If your app fails to build after installing Nitro or a library powered by Nitro, make sure to post full build logs:

<Tabs groupId="platform">
  <TabItem value="ios" label="iOS" default>

  1. Build the app with Xcode.
  2. When the build fails in Xcode, open the "Report Navigator" tab from within the left sidebar:

      <img alt="Report Navigator tab in Xcode" src="/img/troubleshoot-xcode-1.png" />

  3. Then, find the most recent build attempt and click on "Build":

      <img alt="Last build report in Xcode" src="/img/troubleshoot-xcode-2.png" />

  4. Scroll through the build report and find the step(s) that failed to build. They usually have a ❌ icon on the left. Click on the parent item's hamburger menu on the right to open the full logs:

      <img alt="Error line in the build report" src="/img/troubleshoot-xcode-3.png" />

  5. Scroll down through the build logs (the long part is just the command invocation) to find the actual error messages:

      <img alt="Bottom of error logs" src="/img/troubleshoot-xcode-4.png" />

  6. Copy those bottom logs only (not the build command invocation above) and create a GitHub issue with that.

  </TabItem>
  <TabItem value="android" label="Android">

  1. Build the app with Android Studio.
  2. When the build fails in Android Studio, open the "Build" tab from within the bottom left sidebar:

      <img alt="Build tab in Android Studio" src="/img/troubleshoot-android-1.png" />

  3. Find the top-most entry in the Build window (which contains full unfiltered logs) and click it:

      <img alt="Build tab in Android Studio" src="/img/troubleshoot-android-2.png" />

  4. Copy those full logs and paste them in the GitHub issue (or serve via pastebin). Make sure they actually contain the **error** message and not just something like "BUILD FAILED in 7s" (which is what most people post):

      <img alt="Build logs in Android Studio" src="/img/troubleshoot-android-3.png" />

  </TabItem>
</Tabs>

## Nitro was installed twice

If your app crashes at startup with:

```
Nitro was installed twice: once with native version X and once with JS version Y.
```

...then two different copies of `react-native-nitro-modules` ended up in your project - the native build linked one, and Metro bundled the other.

The most common cause is **installing a Nitro pre-release** (e.g. `0.37.0-beta.0`). Semver ranges never match pre-release versions, so a library declaring `"react-native-nitro-modules": "*"` as a required peer dependency does not consider the beta a match - and your package manager silently installs a second, stable copy inside that library's `node_modules` to satisfy the peer.

To fix it:

1. Check how many copies you have:
   ```sh
   npm ls react-native-nitro-modules
   ```
2. If a library nests its own copy, ask the library author to mark the peer dependency as [optional](../getting-started/how-to-build-a-nitro-module#11-install-nitro-and-nitrogen).
3. As a workaround until then, force a single version from your app's `package.json`:
   ```json title="package.json"
   {
     "overrides": {
       "react-native-nitro-modules": "0.37.0-beta.0"
     }
   }
   ```
   (use `resolutions` instead of `overrides` for Yarn)
4. Delete `node_modules` and reinstall - package managers often leave the stale nested copy on disk even after the lockfile is fixed.

## Runtime error

If your app crashes at runtime, make sure to inspect the native logs.

<Tabs groupId="platform">
  <TabItem value="ios" label="iOS" default>

  1. Run your app through Xcode
  2. If the app hits an unhandled error, it should pause in Xcode. Share the line it stopped in, and also the call-stack (stacktrace) on the left side.
  3. If the app didn't pause, then it might have been a handled error - in this case just check the Xcode logs at the bottom:

      <img alt="Bottom of runtime logs" src="/img/troubleshoot-xcode-logs.png" />

  </TabItem>
  <TabItem value="android" label="Android">

  1. Run your app through Android Studio by using the Debug button (🪲)
  2. If the app hits an unhandled error, it should pause in Android Studio. Share the line it stopped in, and also the call-stack (stacktrace) on the bottom window.
  3. If the app didn't pause, then it might have been a handled error - in this case just check the Android Logcat logs at the bottom:

      <img alt="Bottom of runtime logs" src="/img/troubleshoot-android-logs.png" />

  </TabItem>
</Tabs>
