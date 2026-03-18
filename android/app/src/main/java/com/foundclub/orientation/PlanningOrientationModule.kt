package com.foundclub.orientation

import android.content.pm.ActivityInfo
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil

class PlanningOrientationModule(
  reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  @ReactMethod
  fun lockToPortrait() {
    setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT)
  }

  @ReactMethod
  fun lockToLandscape() {
    setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE)
  }

  @ReactMethod
  fun unlockToUserPreference() {
    setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED)
  }

  private fun setRequestedOrientation(requestedOrientation: Int) {
    UiThreadUtil.runOnUiThread {
      currentActivity?.requestedOrientation = requestedOrientation
    }
  }

  companion object {
    const val NAME = "PlanningOrientation"
  }
}
