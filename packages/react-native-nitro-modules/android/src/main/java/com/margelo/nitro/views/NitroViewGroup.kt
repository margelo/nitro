package com.margelo.nitro.views

import android.annotation.SuppressLint
import android.content.Context
import android.view.ViewGroup

/**
 * Base [ViewGroup] for [HybridView]s that render React children. Return one of these
 * (or a subclass) from your `HybridView`'s `view` when it should host children.
 */
public open class NitroViewGroup(context: Context) : ViewGroup(context) {
  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
    // No-op: React Native positions each child.
  }

  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    setMeasuredDimension(
      MeasureSpec.getSize(widthMeasureSpec),
      MeasureSpec.getSize(heightMeasureSpec),
    )
  }

  @SuppressLint("MissingSuperCall")
  override fun requestLayout() {
    // No-op: React Native drives layout, not Android.
  }
}
