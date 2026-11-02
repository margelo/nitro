internal import NitroModulesAppleCxx

/// Receives errors that cannot be delivered to a caller, for example because
/// nobody awaits the call that threw.
///
/// Errors reported here are currently logged in debug builds.
public enum GlobalErrorHandler {
  /// Reports an `error` that happened in the given `source`.
  ///
  /// This never throws, so it is safe to call from `catch` blocks and deinitializers.
  ///
  /// ```swift
  /// do {
  ///   try onDismiss.callSync()
  /// } catch {
  ///   GlobalErrorHandler.reportError(source: .uiCallback, error: error)
  /// }
  /// ```
  public static func reportError(source: ErrorSource, error: Error) {
    margelo.nitro.GlobalErrorHandler.reportError(source.cppValue, error.toCpp())
  }
}
