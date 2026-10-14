package com.margelo.nitro.views

import android.annotation.SuppressLint
import android.content.Context
import android.view.ViewGroup

/**
 * A [ViewGroup] for [HybridView]s that render React children.
 *
 * React Native measures and positions every child itself, so this [ViewGroup]
 * deliberately does not lay out its children - just like React Native's own
 * `ReactViewGroup` does. Any [ViewGroup] works as a Hybrid View's `view`, but
 * one that lays out its own children (such as a `LinearLayout`) would fight
 * Fabric and move the children to the wrong place.
 */
open class NitroViewGroup(
  context: Context,
) : ViewGroup(context) {
  override fun onMeasure(
    widthMeasureSpec: Int,
    heightMeasureSpec: Int,
  ) {
    // React Native always measures with exact dimensions.
    setMeasuredDimension(
      MeasureSpec.getSize(widthMeasureSpec),
      MeasureSpec.getSize(heightMeasureSpec),
    )
  }

  override fun onLayout(
    changed: Boolean,
    left: Int,
    top: Int,
    right: Int,
    bottom: Int,
  ) {
    // No-op - React Native lays out each child itself.
  }

  @SuppressLint("MissingSuperCall")
  override fun requestLayout() {
    // No-op - React Native drives layout, so a layout request must not travel
    // up the Android view hierarchy.
  }
}
