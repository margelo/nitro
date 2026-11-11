//
//  RecyclableView.swift
//  NitroModules
//
//  Created by Marc Rousavy on 13.01.25.
//

/// A `HybridView` that can also be recycled.
public protocol RecyclableView {
  /**
    * Called when the view is going to be recycled to
    * be re-used later on with different props.
    *
    * This is a good place to reset any internal state
    * to it's default value.
    */
  func prepareForRecycle()
}
