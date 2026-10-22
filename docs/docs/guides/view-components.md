---
---

import Tabs from '@theme/Tabs'; import TabItem from '@theme/TabItem';

# View Components

Nitro provides first-class support for creating React Native Views.

Such views can be rendered within React Native apps using [Fabric](https://reactnative.dev/architecture/fabric-renderer), and are backed by
a C++ ShadowNode. The key difference to a Fabric view is that it uses Nitro for prop parsing, which is more lightweight, performant and
flexible.

:::note

Nitro Views require React Native 0.88 or newer with the New Architecture.

:::

## Create a Nitro View

### 1. Declaration

Declare a class extending `HybridView` in a `*.nitro.ts` file. Its writable properties become React props, and its methods are available
through the native ref:

```ts title="CameraView.nitro.ts"
import { iOS, type HybridView } from 'react-native-nitro-modules'

@iOS({
  language: 'swift',
  implementation: { className: 'HybridCameraView' },
})
export declare class CameraView extends HybridView {
  enableFlash: boolean
}
export * from '#nitro/CameraView'
```

Each view must extend `HybridView` directly and select one concrete Swift or Kotlin implementation per platform. Leave
`allowMultipleImplementations` omitted (false), and leave `allowInheritance` omitted or set it to `false`.

Fabric creates the native view. Omit a public constructor from the spec.

### 2. Code Generation

Then, run [nitrogen](../concepts/nitrogen):

<Tabs groupId="package-manager">
  <TabItem value="npm" label="npm" default>
    ```sh
    npx nitrogen
    ```

  </TabItem>
  <TabItem value="yarn" label="yarn">
    ```sh
    yarn nitrogen
    ```

  </TabItem>
  <TabItem value="pnpm" label="pnpm">
    ```sh
    pnpm nitrogen
    ```

  </TabItem>
  <TabItem value="bun" label="bun">
    ```sh
    bun nitrogen
    ```

  </TabItem>

</Tabs>

Nitrogen generates the native view bindings and the `CameraViewComponent` export, including its React props and ref types.

### 3. Implementation

Now it's time to implement the View - simply create a new Swift/Kotlin class/file, implement `HybridCameraViewSpec` and implement your
`.enableFlash` property, as well as the common `.view` accessor:

<Tabs groupId="native-view-language">
  <TabItem value="swift" label="Swift" default>
    ```swift title="HybridCameraView.swift"
    class HybridCameraView : HybridCameraViewSpec {
      // Props
      var enableFlash: Bool = false

      // View
      var view: UIView = UIView()
    }
    ```

  </TabItem>
  <TabItem value="kotlin" label="Kotlin">
    ```kotlin title="HybridCameraView.kt"
    class HybridCameraView(val context: ThemedReactContext) : HybridCameraViewSpec() {
      companion object : HybridCameraViewSpec.Companion {}

      // Props
      override var enableFlash: Boolean = false

      // View
      override val view: View = View(context)
    }
    ```

  </TabItem>

</Tabs>

### 4. Link the generated sources

The `@iOS` decorator's `implementation` selects `HybridCameraView` to automatically link the native class.

#### 4.1. Register View Manager (Android)

On Android, you additionally need to register the generated view manager in your React Native package:

```kotlin title="CameraPackage.kt"
// ...
public class CameraPackage: BaseReactPackage() {
  // ...

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    val viewManagers = ArrayList<ViewManager<*, *>>()
    // diff-add
    viewManagers.add(HybridCameraViewManager())
    return viewManagers
  }
}
```

### 5. Render the component

Finally, import the generated component from the spec and render it:

```tsx
import { CameraViewComponent } from './CameraView.nitro'

function App() {
  return <CameraViewComponent enableFlash={true} />
}
```

## Props

Since every `HybridView` is also a `HybridObject`, you can use any type that Nitro supports as a property - including custom types
(`interface`), `ArrayBuffer`, and even other `HybridObject`s!

For example, a custom `<ImageView>` component can be used to render custom `Image` types:

<div className="side-by-side-container">
<div className="side-by-side-block">

```ts title="Image.nitro.ts"
@iOS(...)
export declare class Image extends HybridObject {
  readonly width: number
  readonly height: number
  save(): Promise<string>
}
```

</div>
<div className="side-by-side-block">

```ts title="ImageView.nitro.ts"
import { type Image } from './Image.nitro.ts'
@iOS(...)
export declare class ImageView extends HybridView {
  image: Image
}
export * from '#nitro/ImageView'
```

</div>
</div>

Render the generated component with an existing image:

```tsx
import { ImageViewComponent } from './ImageView.nitro'

function App({ image }: { image: Image }) {
  return <ImageViewComponent image={image} />
}
```

### Threading

Since Nitro bridges props directly to JS, you are responsible for ensuring thread-safety.

- If props are set normally via React, they will be set on the UI Thread.
- If the user sets props on the view `hybridRef` (e.g. also if the `HybridView` is passed to a `HybridObject` in native), props _could_ be
  set on a different Thread, like the JS Thread.

### Before/After update

To batch prop changes, you can override `beforeUpdate()` and `afterUpdate()` in your views:

<Tabs groupId="native-view-language">
  <TabItem value="swift" label="Swift" default>
    ```swift title="HybridCameraView.swift"
    class HybridCameraView: HybridCameraViewSpec {
      // View
      var view: UIView = UIView()

      func beforeUpdate() { }
      func afterUpdate() { }
    }
    ```

  </TabItem>
  <TabItem value="kotlin" label="Kotlin">
    ```kotlin title="HybridCameraView.kt"
    class HybridCameraView(context: ThemedReactContext): HybridCameraViewSpec() {
      companion object : HybridCameraViewSpec.Companion {}

      // View
      override val view: View = View(context)

      override fun beforeUpdate() { }
      override fun afterUpdate() { }
    }
    ```

  </TabItem>

</Tabs>

### Callbacks

Pass functions directly to Nitro View props:

```tsx
@iOS(...)
export declare class CameraView extends HybridView {
  onCaptured: (image: Image) => void
}
export * from '#nitro/CameraView'

// In a component file, import CameraViewComponent from './CameraView.nitro'.
function App() {
  return <CameraViewComponent onCaptured={(image) => console.log(image)} />
}
```

### Recycling

For improved performance and lower memory footprint, Nitro Views can be _recycled_. To allow your view to be recycled, implement the
`RecyclableView` interface/protocol from Nitro:

<Tabs groupId="native-view-language">
  <TabItem value="swift" label="Swift" default>
    ```swift title="HybridMyView.swift"
    import NitroModules

    class HybridMyView: HybridMyViewSpec, RecyclableView {
      // ...
      func prepareForRecycle() {}
    }
    ```

  </TabItem>
  <TabItem value="kotlin" label="Kotlin">
    ```kotlin title="HybridMyView.kt"
    import com.margelo.nitro.views.RecyclableView

    class HybridMyView: HybridMyViewSpec(), RecyclableView {
      companion object : HybridMyViewSpec.Companion {}

      // ...
      override fun prepareForRecycle() {}
    }
    ```

  </TabItem>

</Tabs>

When Fabric decides to re-use a previously created view, the `prepareForRecycle()` method will be called. Inside that method you should
reset any internal state to its default values.

For example, an asynchronous Image component should reset its displayed image when it is being recycled, otherwise it would display an old
image while the new one is still loading:

```swift
class HybridImageView: HybridImageViewSpec, RecyclableView {
  var view: UIView { imageView }
  private var imageView = UIImageView()

  func prepareForRecycle() {
    // highlight-next-line
    imageView.image = nil
  }
}
```

## Methods

Since every `HybridView` is also a `HybridObject`, methods can be directly called on the object. Assuming our `<CameraViewComponent>`
component has a `takePhoto()` function like so:

```ts
@iOS(...)
export declare class CameraView extends HybridView {
  enableFlash: boolean
  takePhoto(): Promise<Image>
}
export * from '#nitro/CameraView'
```

To call the function, you would need to get a reference to the `HybridObject` first using `hybridRef`:

```jsx
function App() {
  return (
    <CameraViewComponent
      hybridRef={(ref) => {
        void ref.takePhoto().then((image) => console.log(image))
      }}
    />
  )
}
```

The `ref` from within `hybridRef`'s callback is pointing to the `HybridObject` directly - you can also pass this around freely.
