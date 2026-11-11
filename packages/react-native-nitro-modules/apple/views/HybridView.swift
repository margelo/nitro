//
//  HybridView.swift
//  NitroModules
//
//  Created by Marc Rousavy on 13.01.25.
//

#if canImport(UIKit)

  import UIKit

  /// A base protocol for all Swift-based Hybrid Views.
  public protocol HybridView: HybridObject {
    associatedtype ViewType: UIView
    /**
     * Get the ``UIView`` this HybridView is holding.
     *
     * This value should not change during the lifetime of this ``HybridView``.
     */
    var view: ViewType { get }

    /**
     * Called right before updating props.
     * React props are updated in a single batch/transaction.
     */
    func beforeUpdate()
    /**
     * Called right after updating props.
     * React props are updated in a single batch/transaction.
     */
    func afterUpdate()

    /**
     * Called when the `HybridView` is about
     * to be dropped and unmounted.
     * This is a good place to clean up view-related
     * resources.
     */
    func onDropView()
  }

  extension HybridView {
    public func beforeUpdate() { /* noop */  }
    public func afterUpdate() { /* noop */  }
    public func onDropView() { /* noop */  }
  }

  extension HybridView {
    // In a View, this could be the size of the UIView.
    public var memorySize: Int {
      return MemoryHelper.getSizeOf(self.view)
    }
  }

#endif
