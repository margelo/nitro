import Dispatch
import NitroModules

class HybridBenchmarkObjectSwift: HybridBenchmarkObjectSwiftKotlinSpec {
  private var pendingPromise: Promise<Double>?
  var numberValue: Double = 0.0

  var thisObject: any HybridBenchmarkObjectSwiftKotlinSpec {
    return self
  }

  func simpleFunc() throws {
    // do nothing
  }

  func addNumbers(a: Double, b: Double) throws -> Double {
    return a + b
  }

  func addStrings(a: String, b: String) throws -> String {
    return a + b
  }

  func bounceNumbers(array: [Double]) throws -> [Double] {
    return array
  }

  func bounceCar(car: Car) -> Car {
    return car
  }

  func bounceSimpleMap(map: [String: Double]) throws -> [String: Double] {
    return map
  }

  func tryOptionalParams(num: Double, boo: Bool, str: String?) throws -> String {
    if let str {
      return str
    } else {
      return "value omitted!"
    }
  }

  func passVariant(either: Variant_Bool__Double___String__Double_String) throws
    -> Variant_Double_String
  {
    switch either {
    case .fourth(let double):
      return .first(double)
    case .fifth(let string):
      return .second(string)
    default:
      return .second("holds something else!")
    }
  }

  func newBenchmarkObject() throws -> any HybridBenchmarkObjectSwiftKotlinSpec {
    return HybridBenchmarkObjectSwift()
  }

  func bounceArrayBuffer(buffer: ArrayBuffer) throws -> ArrayBuffer {
    return buffer
  }

  func copyBuffer(buffer: ArrayBuffer) throws -> ArrayBuffer {
    return ArrayBuffer.copy(of: buffer)
  }

  func callbackSync(callback: @escaping () -> Double) throws -> Double {
    let value = callback()
    return value
  }

  func promiseReturnsInstantly() throws -> Promise<Double> {
    return Promise.resolved(withResult: 55.0)
  }

  func createPendingPromise() throws -> Promise<Double> {
    guard pendingPromise == nil else {
      throw RuntimeError.error(withMessage: "A pending Promise is already waiting for completion.")
    }
    let promise = Promise<Double>()
    pendingPromise = promise
    return promise
  }

  func resolvePendingPromiseOnWorker() throws {
    guard let promise = pendingPromise else {
      throw RuntimeError.error(withMessage: "No pending Promise is waiting for completion.")
    }
    // Only JS calls access the slot; the worker owns the extracted Promise.
    pendingPromise = nil
    DispatchQueue.global().async {
      promise.resolve(withResult: 55.0)
    }
  }
}
