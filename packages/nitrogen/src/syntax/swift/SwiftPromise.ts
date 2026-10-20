import { NitroConfig } from '../../config/NitroConfig.js'
import { indent } from '../../utils.js'
import { createFileMetadataString } from '../helpers.js'
import type { SourceFile } from '../SourceFile.js'
import type { SwiftPromiseType } from './types/SwiftPromiseType.js'
import { getImportsCode } from '../getImportCode.js'
import { SwiftBorrowedPointerType } from './types/SwiftBorrowedPointerType.js'

export function createSwiftPromiseBridge(type: SwiftPromiseType): SourceFile[] {
  const promiseType = type.type
  const swiftClassName = type.specializationName
  const bridgeNamespace = NitroConfig.current.getSwiftBridgeNamespace('swift')

  const swiftImports = getImportsCode([
    { language: 'swift', name: 'NitroModules', access: 'public' },
    { language: 'swift', name: 'CxxStdlib', access: 'internal' },
    { language: 'swift', name: 'Dispatch', access: 'public' },
    ...type.getRequiredImports('swift'),
    ...promiseType.getRequiredImports('swift'),
  ])

  const swiftResultType = promiseType.resultingType.getCode('swift', {
    context: 'type-argument',
  })
  const resolvedType = type.adapterResultingType
  const needsAdapter = resolvedType instanceof SwiftBorrowedPointerType
  const pendingCall = needsAdapter ? `${bridgeNamespace}.create_${swiftClassName}()` : `${swiftClassName}.__pending()`
  const rejectCall = needsAdapter ? `bridge.reject_${swiftClassName}(self, error.toCpp())` : 'reject(consuming: error.toCpp())'
  const rejectedListenerCall = needsAdapter ? `bridge.listenRejected_${swiftClassName}(self, ` : 'addOnRejectedListener('
  const resolvedListenerCall = needsAdapter ? `bridge.listen_${swiftClassName}(self, ` : 'addOnResolvedListener('
  let resolveBody: string
  let addOnResolvedListenerBody: string
  if (resolvedType.kind === 'void') {
    // Resolve without a payload.
    resolveBody = 'resolve()'
    addOnResolvedListenerBody = `
addOnResolvedListener(.init { () -> Void in
  listener(())
})
`.trim()
  } else {
    // Resolve a payload, either directly or through borrowed Swift storage.
    const resolvedValue = resolvedType.fromSwift('result')
    if (needsAdapter) {
      resolveBody = resolvedType.borrow('swift', {
        value: resolvedValue,
        pointer: 'pointer',
        body: `bridge.resolve_${swiftClassName}(self, pointer)`,
      })
    } else {
      resolveBody = `resolve(consuming: ${resolvedValue})`
    }
    const listenerType = resolvedType.getCode('swift', {
      context: 'type-argument',
    })
    addOnResolvedListenerBody = `
${resolvedListenerCall}.init { (value: ${listenerType}) -> Void in
  listener(${resolvedType.toSwift('value')})
})
`.trim()
  }

  let resolveFunction: string
  // TODO: Move these factories into core once Swift can infer their concrete
  // C++ specialization from an existential Promise<T> return type. The constrained
  // extensions below currently provide shorthand calls such as `.async { ... }`.
  let resolvedFunction = ''
  let addOnResolvedListenerFunction: string
  if (promiseType.resultingType.kind === 'void') {
    // It's a void specialization
    resolveFunction = `
public func __nitroResolve(result: ()) {
  ${indent(resolveBody, '  ')}
}
`.trim()
    addOnResolvedListenerFunction = `
public func __nitroAddOnResolvedListener(_ listener: @escaping @Sendable (()) -> Void) {
  ${indent(addOnResolvedListenerBody, '  ')}
}
`.trim()
    resolvedFunction = `
public static func resolved() -> Self {
  let promise = ${swiftClassName}.pending()
  promise.resolve(result: ())
  return promise
}
`.trim()
  } else {
    resolveFunction = `
public func __nitroResolve(result: ${swiftResultType}) {
  ${indent(resolveBody, '  ')}
}
`.trim()
    addOnResolvedListenerFunction = `
public func __nitroAddOnResolvedListener(_ listener: @escaping @Sendable (${swiftResultType}) -> Void) {
  ${indent(addOnResolvedListenerBody, '  ')}
}
`.trim()
    resolvedFunction = `
public static func resolved(with result: ${swiftResultType}) -> Self {
  let promise = ${swiftClassName}.pending()
  promise.resolve(result: result)
  return promise
}
`.trim()
  }

  const swiftCode = `
${createFileMetadataString(`${swiftClassName}.swift`)}

${swiftImports}

public typealias ${swiftClassName} = ${bridgeNamespace}.${swiftClassName}

extension ${swiftClassName} {
  public typealias T = ${swiftResultType}
  private typealias bridge = ${bridgeNamespace}

  ${indent(resolveFunction, '  ')}
  public func __nitroReject(error: any Error) {
    ${rejectCall}
  }

  ${indent(addOnResolvedListenerFunction, '  ')}
  public func __nitroAddOnRejectedListener(_ listener: @escaping @Sendable (any Error) -> Void) {
    ${rejectedListenerCall}.init { (exceptionPtr: std.exception_ptr) -> Void in
      listener(RuntimeError.from(cppError: exceptionPtr))
    })
  }
}

extension Promise<${swiftResultType}> where Self == ${swiftClassName} {
  public static func pending() -> Self {
    return ${pendingCall}
  }

  ${indent(resolvedFunction, '  ')}
  public static func rejected(with error: any Error) -> Self {
    let promise = ${swiftClassName}.pending()
    promise.reject(error: error)
    return promise
  }

  public static func \`async\`(
    _ priority: TaskPriority? = nil,
    _ run: sending @escaping @isolated(any) () async throws -> sending ${swiftResultType}
  ) -> Self {
    let promise = ${swiftClassName}.pending()
    Task(priority: priority) { () async -> Void in
      do {
        promise.resolve(result: try await run())
      } catch {
        promise.reject(error: error)
      }
    }
    return promise
  }

  public static func parallel(
    _ queue: DispatchQueue = .global(),
    _ run: @escaping @Sendable () throws -> ${swiftResultType}
  ) -> Self {
    let promise = ${swiftClassName}.pending()
    queue.async { () -> Void in
      do {
        promise.resolve(result: try run())
      } catch {
        promise.reject(error: error)
      }
    }
    return promise
  }
}

extension Promise<${swiftResultType}> {
  func toCpp() -> ${swiftClassName} {
    if let self = self as? ${swiftClassName} {
      return self
    } else {
      let promise = ${swiftClassName}.pending()
      self.addOnResolvedListener { (result: ${swiftResultType}) -> Void in
        promise.resolve(result: result)
      }
      self.addOnRejectedListener { (error: any Error) -> Void in
        promise.reject(error: error)
      }
      return promise
    }
  }
}
`.trim()

  const sourceFiles: SourceFile[] = [
    {
      content: swiftCode,
      language: 'swift',
      name: `${swiftClassName}.swift`,
      platform: 'ios',
      subdirectory: [],
    },
  ]

  return sourceFiles
}
