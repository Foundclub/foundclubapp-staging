package com.foundclub.installreferrer

import com.android.installreferrer.api.InstallReferrerClient
import com.android.installreferrer.api.InstallReferrerStateListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.concurrent.atomic.AtomicBoolean

class FoundClubInstallReferrerModule(
  reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  @ReactMethod
  fun getInstallReferrer(promise: Promise) {
    val client = InstallReferrerClient.newBuilder(reactApplicationContext).build()
    val settled = AtomicBoolean(false)

    fun resolve(value: String) {
      if (settled.compareAndSet(false, true)) promise.resolve(value)
      client.endConnection()
    }

    fun reject(code: String, message: String, error: Throwable? = null) {
      if (settled.compareAndSet(false, true)) promise.reject(code, message, error)
      client.endConnection()
    }

    client.startConnection(object : InstallReferrerStateListener {
      override fun onInstallReferrerSetupFinished(responseCode: Int) {
        when (responseCode) {
          InstallReferrerClient.InstallReferrerResponse.OK -> try {
            resolve(client.installReferrer.installReferrer)
          } catch (error: Throwable) {
            reject("install_referrer_read_failed", "Google Play install referrer could not be read.", error)
          }
          InstallReferrerClient.InstallReferrerResponse.FEATURE_NOT_SUPPORTED ->
            reject("install_referrer_unsupported", "Google Play install referrer is not supported.")
          InstallReferrerClient.InstallReferrerResponse.SERVICE_UNAVAILABLE ->
            reject("install_referrer_unavailable", "Google Play install referrer is temporarily unavailable.")
          else -> reject("install_referrer_error", "Google Play install referrer returned code $responseCode.")
        }
      }

      override fun onInstallReferrerServiceDisconnected() {
        reject("install_referrer_disconnected", "Google Play install referrer disconnected.")
      }
    })
  }

  companion object {
    const val NAME = "FoundClubInstallReferrer"
  }
}
