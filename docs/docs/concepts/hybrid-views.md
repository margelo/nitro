---
description:
  Learn how Nitro Hybrid Views render native view components in React Native while keeping Hybrid Object state and type-safe native
  bindings.
---

# Hybrid Views

A **Hybrid View** is just a [**Hybrid Object**](hybrid-objects) that can also be rendered in react-native. It has one additional
class-member, `view`:

<div className="side-by-side-container">
<div className="side-by-side-block">

```ts title="CameraView.nitro.ts"
@iOS(...)
@Android(...)
export declare class CameraView extends HybridView {
  enableFlash: boolean
  takePhoto(): Promise<Image>
}
export * from '#nitro/CameraView'
```

</div>
<div className="side-by-side-block">

```swift title="HybridCameraView.swift"
class HybridCameraView : HybridCameraViewSpec {
  let view: UIView = CameraPreviewView()
  var enableFlash: Bool = false
  func takePhoto() -> any Promise<any HybridImageSpec> {
    ...
  }
}
```

</div>
</div>

## Rendering Hybrid Views

Nitrogen generates a React Native Fabric component for each Hybrid View. Fabric creates its native instance; the spec does not expose a
public JavaScript constructor:

```tsx
import { CameraViewComponent } from './CameraView.nitro'

function App() {
  return <CameraViewComponent />
}
```

Internally, the `<CameraViewComponent />` view will create the `HybridCameraView` hybrid object and mount its `.view` - one hybrid object
per view.

## Accessing the underlying Hybrid Object

To access the actual underlying object, you can use the `hybridRef`:

```jsx
function App() {
  return (
    <CameraViewComponent
      hybridRef={(ref) => {
        console.log(ref.toString()) // <-- [HybridObject CameraView]
        ref.takePhoto()
      }}
    />
  )
}
```

## Full Guides

Check out the [View Components](../guides/view-components) section for a full guide on Hybrid Views.
