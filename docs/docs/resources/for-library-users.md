---
title: Installation
sidebar_label: Installation
description: Install react-native-nitro-modules in a React Native app and configure Nitro-powered libraries on iOS and Android.
---

import Tabs from '@theme/Tabs'; import TabItem from '@theme/TabItem';

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

For iOS, use Xcode with Swift 6.4 or newer. Choose the package manager your app uses:

[//]: # 'TODO: Remove the CocoaPods installation tab once React Native defaults to Swift Package Manager.'

<Tabs groupId="apple-package-manager">
  <TabItem value="cocoapods" label="CocoaPods" default>

Add Nitro's helper next to the React Native require in your `ios/Podfile`:

```ruby
require Pod::Executable.execute_command('node', [
  '-p',
  'require.resolve("react-native-nitro-modules/cocoapods.rb", {paths: [process.argv[1]]})',
  __dir__,
]).strip
```

Inside your app target, call `use_nitro_modules!` after `use_native_modules!`. Add `nitro_post_install(installer)` after
`react_native_post_install` in your existing hook:

```ruby
target 'MyApp' do
  config = use_native_modules!
  use_nitro_modules!
  use_react_native!(:path => config[:reactNativePath])

  post_install do |installer|
    react_native_post_install(installer, config[:reactNativePath])
    nitro_post_install(installer)
  end
end
```

Keep the other settings in your existing Podfile. Run `pod install` from `ios/`, then open the app's `.xcworkspace` in Xcode. Nitro's helper
adds the C++ and Swift bridge pods required by the runtime and your Nitro libraries. App targets sharing Nitro must use the same
`use_frameworks!` setting.

  </TabItem>
  <TabItem value="swiftpm" label="Swift Package Manager">

Run this from your app directory:

```sh
npx react-native spm
```

To convert a CocoaPods app to SwiftPM, use `npx react-native spm add --deintegrate` first. The conversion needs CocoaPods to remove its
existing integration. Open the app's `.xcodeproj` in Xcode after setup.

  </TabItem>
</Tabs>

Keep Nitro and the libraries' generated bindings on matching V1 versions. The
[minimum requirements](../getting-started/minimum-requirements) describe the supported native toolchains.
