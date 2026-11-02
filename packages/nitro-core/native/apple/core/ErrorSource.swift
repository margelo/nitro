internal import NitroModulesAppleCxx

/// Where an error reported to `GlobalErrorHandler` happened.
public enum ErrorSource: Sendable {
  /// A JS callback called asynchronously, without a caller waiting for its result.
  case jsCallback
  /// A native callback called without a caller waiting for its result.
  case nativeCallback
  /// A JS microtask, such as a Promise continuation, run after a native call into JS.
  case microtask
  /// A `setTimeout` or `setInterval` callback.
  case timer
  /// A `requestAnimationFrame` callback.
  case animationFrame
  /// A UI event callback, such as a key press or a completed view controller presentation.
  case uiCallback

  internal var cppValue: margelo.nitro.ErrorSource {
    switch self {
    case .jsCallback: return .JSCallback
    case .nativeCallback: return .NativeCallback
    case .microtask: return .Microtask
    case .timer: return .Timer
    case .animationFrame: return .AnimationFrame
    case .uiCallback: return .UICallback
    }
  }
}
