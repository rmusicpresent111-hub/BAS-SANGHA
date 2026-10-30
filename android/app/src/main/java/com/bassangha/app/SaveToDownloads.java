package com.bassangha.app;

import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * Saves base64 files (payment receipt PDFs) straight into the device's
 * Downloads folder so they show up in the Files app.
 *
 * Android 10+ (API 29+): MediaStore.Downloads insert — no storage permission
 * required. Older devices: direct write to the public Downloads directory
 * (needs WRITE_EXTERNAL_STORAGE, declared with maxSdkVersion=28).
 */
@CapacitorPlugin(name = "SaveToDownloads")
public class SaveToDownloads extends Plugin {

    @PluginMethod
    public void save(PluginCall call) {
        String data = call.getString("data");
        String filename = call.getString("filename");
        String mime = call.getString("mime", "application/pdf");
        if (data == null || data.length() == 0 || filename == null || filename.length() == 0) {
            call.reject("data and filename are required");
            return;
        }

        try {
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            Uri uri;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
                values.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                values.put(MediaStore.MediaColumns.IS_PENDING, 1);
                uri = getContext().getContentResolver()
                        .insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri == null) {
                    call.reject("could not create file in Downloads");
                    return;
                }
                OutputStream os = getContext().getContentResolver().openOutputStream(uri);
                if (os == null) {
                    getContext().getContentResolver().delete(uri, null, null);
                    call.reject("could not open output stream");
                    return;
                }
                try {
                    os.write(bytes);
                    os.flush();
                } finally {
                    os.close();
                }
                ContentValues done = new ContentValues();
                done.put(MediaStore.MediaColumns.IS_PENDING, 0);
                getContext().getContentResolver().update(uri, done, null, null);
            } else {
                File dir = Environment
                        .getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                if (dir != null && !dir.exists()) {
                    dir.mkdirs();
                }
                File out = new File(dir, filename);
                FileOutputStream fos = new FileOutputStream(out);
                try {
                    fos.write(bytes);
                    fos.flush();
                } finally {
                    fos.close();
                }
                uri = Uri.fromFile(out);
            }

            JSObject ret = new JSObject();
            ret.put("uri", uri.toString());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("save failed: " + e.getMessage(), e);
        }
    }
}
