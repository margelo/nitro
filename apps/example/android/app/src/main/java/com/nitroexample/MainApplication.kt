package com.margelo.nitroexample

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.internal.featureflags.ReactNativeFeatureFlags
import com.facebook.react.internal.featureflags.ReactNativeFeatureFlagsOverrides_RNOSS_Stable_Android
import com.facebook.react.internal.featureflags.ReactNativeFeatureFlagsProvider

private val stableFlagsWithNitroViewRecycling: ReactNativeFeatureFlagsProvider =
  object : ReactNativeFeatureFlagsProvider by ReactNativeFeatureFlagsOverrides_RNOSS_Stable_Android() {
    override fun enablePreparedTextLayout(): Boolean = false

    override fun enableViewRecycling(): Boolean = true

    override fun enableViewRecyclingForImage(): Boolean = false

    override fun enableViewRecyclingForScrollView(): Boolean = false

    override fun enableViewRecyclingForText(): Boolean = false

    override fun enableViewRecyclingForView(): Boolean = false
  }

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList = PackageList(this).packages,
    )
  }
 

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
    // RN 0.87 installs its Stable provider above. Replace it before reactHost is
    // accessed, and re-audit these internal flags whenever RN or releaseLevel changes.
    val previouslyAccessedFlags =
      ReactNativeFeatureFlags.dangerouslyForceOverride(
        stableFlagsWithNitroViewRecycling,
      )
    check(previouslyAccessedFlags == null) {
      "Feature flags were accessed before enabling View recycling: $previouslyAccessedFlags"
    }
  }
}
