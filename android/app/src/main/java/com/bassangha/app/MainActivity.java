package com.bassangha.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {

    private static final int STORAGE_PERMISSION_REQUEST = 4001;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SaveToDownloads.class);
        super.onCreate(savedInstanceState);
        askForStoragePermissionOnce();
    }

    /**
     * The very first time the app opens, the ANDROID SYSTEM dialog asks for
     * storage/media access (not an in-app dialog). Once granted, every
     * download inside the app (receipts, ID card, reports) is written
     * straight into the device's Downloads folder.
     *
     * Note: on Android 10+ the actual Downloads writes use MediaStore and
     * would work without any permission — this visible grant is requested
     * so the user explicitly sees and allows storage access, and so that
     * very old (Android 9 and below) devices can write to Downloads too.
     */
    private void askForStoragePermissionOnce() {
        List<String> need = new ArrayList<>();
        if (Build.VERSION.SDK_INT >= 33) {
            // Android 13+ granular media permission
            if (!granted(Manifest.permission.READ_MEDIA_IMAGES)) {
                need.add(Manifest.permission.READ_MEDIA_IMAGES);
            }
        } else if (Build.VERSION.SDK_INT >= 29) {
            // Android 10–12
            if (!granted(Manifest.permission.READ_EXTERNAL_STORAGE)) {
                need.add(Manifest.permission.READ_EXTERNAL_STORAGE);
            }
        } else {
            // Android 9 and below — real write access is needed
            if (!granted(Manifest.permission.WRITE_EXTERNAL_STORAGE)) {
                need.add(Manifest.permission.WRITE_EXTERNAL_STORAGE);
            }
            if (!granted(Manifest.permission.READ_EXTERNAL_STORAGE)) {
                need.add(Manifest.permission.READ_EXTERNAL_STORAGE);
            }
        }
        if (!need.isEmpty()) {
            ActivityCompat.requestPermissions(
                    this, need.toArray(new String[0]), STORAGE_PERMISSION_REQUEST);
        }
    }

    private boolean granted(String permission) {
        return ContextCompat.checkSelfPermission(this, permission)
                == PackageManager.PERMISSION_GRANTED;
    }
}
