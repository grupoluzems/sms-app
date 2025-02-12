package br.com.grupoluzems.smsapp

import android.app.Activity
import android.content.pm.PackageManager
import android.telephony.SmsManager
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.PermissionAwareActivity
import com.facebook.react.modules.core.PermissionListener

class DirectSmsModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext), PermissionListener {
    private var pendingPromise: Promise? = null
    private val PERMISSION_REQUEST_CODE = 123

    override fun getName() = "DirectSmsModule"

    @ReactMethod
    fun sendSms(phoneNumber: String, message: String, promise: Promise) {
        pendingPromise = promise

        if (hasPermission()) {
            sendSmsNow(phoneNumber, message)
        } else {
            requestPermission()
        }
    }

    private fun hasPermission(): Boolean {
        val activity = currentActivity ?: return false
        return ContextCompat.checkSelfPermission(
            activity,
            android.Manifest.permission.SEND_SMS
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun requestPermission() {
        val activity = currentActivity
        if (activity is PermissionAwareActivity) {
            activity.requestPermissions(
                arrayOf(android.Manifest.permission.SEND_SMS),
                PERMISSION_REQUEST_CODE,
                this
            )
        } else {
            pendingPromise?.reject("E_ACTIVITY_DOES_NOT_EXIST", "Activity doesn't exist")
            pendingPromise = null
        }
    }

    private fun sendSmsNow(phoneNumber: String, message: String) {
        try {
            val smsManager = SmsManager.getDefault()
            smsManager.sendTextMessage(phoneNumber, null, message, null, null)
            pendingPromise?.resolve("sent")
        } catch (e: Exception) {
            pendingPromise?.reject("E_SMS_SEND_FAILED", e.message)
        } finally {
            pendingPromise = null
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<String>,
        grantResults: IntArray
    ): Boolean {
        if (requestCode == PERMISSION_REQUEST_CODE) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                // Permission granted, get the pending phone number and message
                pendingPromise?.resolve("permission_granted")
            } else {
                pendingPromise?.reject("E_PERMISSION_DENIED", "Permission denied")
            }
            pendingPromise = null
            return true
        }
        return false
    }
}