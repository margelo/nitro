---
description: Learn how Nitro Hybrid Views render native view components in React Native while keeping Hybrid Object state and type-safe native bindings.
---

# Hybrid Views

A **Hybrid View** is just a [**Hybrid Object**](hybrid-objects) that can also be rendered.
It has one additional class-member, `view`:

<div className="side-by-side-container">
<div className="side-by-side-block">

```ts title="Camera.nitro.ts"
export interface CameraProps
       extends HybridViewProps {
  enableFlash: boolean
}
export interface CameraMethods
       extends HybridViewMethods { }

// highlight-next-line
export type CameraView =
  HybridView<CameraProps, CameraMethods>
```

</div>
<div className="side-by-side-block">

```swift title="HybridCamera.swift"
class HybridCamera : HybridCameraSpec {
  var enableFlash: Bool = false

  var view: UIView {
    get {
      return CameraPreviewView()
    }
  }
}
```

</div>
</div>

## Defining `HybridViewProps` and `HybridViewMethods`

Your `HybridView` type is parameterized by two interfaces:

- `HybridViewProps`: properties implemented natively and settable from React props (no defaults; you define all props)
- `HybridViewMethods`: methods implemented natively and callable from JS after obtaining a `hybridRef` (define these as method signatures)

### HybridViewProps Definition

`HybridViewProps` should contain properties with Nitro supported types (see the [Typing System](../types/typing-system)).

```ts
export interface CameraProps extends HybridViewProps {
  enableFlash: boolean
  zoom: number
  onCaptured: (path: string) => void
}
```

### HybridViewMethods Definition

Define your view’s callable API using **method signatures**, not `methodName: () => ...` property syntax.

```ts title="Bad ❌"
export interface CameraMethods extends HybridViewMethods {
  takePhoto: () => Promise<string>
  setZoom: (zoom: number) => void
}
```

```ts title="Good ✅"
export interface CameraMethods extends HybridViewMethods {
  takePhoto(): Promise<string>
  setZoom(zoom: number): void
}
```


## Rendering Hybrid Views

Unlike a **Hybrid Object**, **Hybrid Views** should not be created manually. Instead, you should use the `getHostComponent(...)` function to get a renderable version of your Hybrid View:

```ts
export const Camera = getHostComponent<CameraProps, CameraMethods>(
  'Camera',
  () => CameraViewConfig
)
```

This can then be rendered in React;

```tsx
function App() {
  return <Camera />
}
```

Internally, the `<Camera />` view will create the `HybridCamera` hybrid object - one hybrid object per view.

## Accessing the underlying Hybrid Object

To access the actual underlying object, you can use the `hybridRef`:

```jsx
function App() {
  return (
    <Camera
      hybridRef={callback((ref) => {
        console.log(ref.name) // <-- HybridCamera
        const image = ref.takePhoto()
      })}
    />
  )
}
```

> Note: If you're wondering about the `callback(...)` syntax, see ["Callbacks have to be wrapped"](../guides/view-components#callbacks-have-to-be-wrapped).

## Full Guides

Check out the [View Components](../guides/view-components) section for a full guide on Hybrid Views.
