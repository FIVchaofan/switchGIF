package com.yuansu.gif;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.database.Cursor;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private static final String TAG = "YuanSuGif";
    private static final String APP_HOST = "app.local";
    private static final int REQUEST_PICK_VIDEO = 1001;
    private static final int REQUEST_IMPORT_IMAGE = 1002;
    private static final int REQUEST_IMPORT_VIDEO = 1003;
    private static final String[] IMAGE_MIME_TYPES = {
            "image/gif", "image/jpeg", "image/png", "image/webp",
            "image/bmp", "image/heic", "image/heif", "image/avif"
    };
    private static final String[] VIDEO_MIME_TYPES = {
            "video/mp4", "video/quicktime", "video/webm",
            "video/x-matroska", "video/3gpp", "video/x-msvideo", "video/mpeg"
    };

    private WebView webView;
    private View loadingOverlay;
    private GifStore gifStore;
    private ValueCallback<Uri[]> filePathCallback;
    private final GifBridge bridge = new GifBridge();
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(10, 12, 14));
        getWindow().setNavigationBarColor(Color.rgb(10, 12, 14));
        gifStore = new GifStore(this);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(10, 12, 14));
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setUserAgentString(settings.getUserAgentString() + " YuanSuGif/1.0");

        webView.addJavascriptInterface(bridge, "AndroidBridge");
        webView.setWebViewClient(new LocalClient());
        webView.setWebChromeClient(new LocalChromeClient());

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(10, 12, 14));
        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        loadingOverlay = buildLoadingOverlay();
        root.addView(loadingOverlay, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        mainHandler.postDelayed(this::hideLoadingOverlay, 12000);
        webView.loadUrl("https://" + APP_HOST + "/index.html");
    }

    private View buildLoadingOverlay() {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        box.setBackgroundColor(Color.rgb(10, 12, 14));

        ProgressBar spinner = new ProgressBar(this);
        spinner.setIndeterminate(true);
        spinner.setIndeterminateTintList(ColorStateList.valueOf(Color.rgb(215, 255, 99)));
        LinearLayout.LayoutParams spinnerParams = new LinearLayout.LayoutParams(dp(30), dp(30));
        box.addView(spinner, spinnerParams);

        TextView title = new TextView(this);
        title.setText("原速 GIF");
        title.setTextColor(Color.rgb(242, 244, 234));
        title.setTextSize(22);
        title.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        titleParams.topMargin = dp(20);
        box.addView(title, titleParams);

        TextView subtitle = new TextView(this);
        subtitle.setText("正在准备本地转换引擎…");
        subtitle.setTextColor(Color.rgb(147, 154, 144));
        subtitle.setTextSize(12);
        subtitle.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams subtitleParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        subtitleParams.topMargin = dp(8);
        box.addView(subtitle, subtitleParams);
        return box;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void hideLoadingOverlay() {
        if (loadingOverlay == null || loadingOverlay.getVisibility() != View.VISIBLE) {
            return;
        }
        loadingOverlay.animate()
                .alpha(0f)
                .setDuration(260)
                .withEndAction(() -> {
                    if (loadingOverlay != null) {
                        loadingOverlay.setVisibility(View.GONE);
                    }
                })
                .start();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQUEST_PICK_VIDEO) {
            Uri[] result = null;
            if (resultCode == RESULT_OK && data != null) {
                Uri uri = data.getData();
                if (uri != null) {
                    try {
                        getContentResolver().takePersistableUriPermission(
                                uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    } catch (SecurityException ignored) {
                        // The temporary grant is still enough for this session.
                    }
                    result = new Uri[]{uri};
                }
            }
            if (filePathCallback != null) {
                filePathCallback.onReceiveValue(result);
                filePathCallback = null;
            }
            return;
        }
        if (requestCode == REQUEST_IMPORT_IMAGE || requestCode == REQUEST_IMPORT_VIDEO) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                importMedia(data.getData());
            } else {
                importCallback(false, "已取消导入", null);
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    private void importMedia(Uri uri) {
        try {
            getContentResolver().takePersistableUriPermission(
                    uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } catch (SecurityException ignored) {
            // Copying starts immediately, so the temporary grant is enough.
        }
        final String displayName = queryDisplayName(uri);
        io.execute(() -> {
            try {
                String name = gifStore.importFrom(this, uri, displayName);
                importCallback(true, "已导入作品库", name);
            } catch (Exception error) {
                importCallback(false, error.getMessage() == null ? "导入失败" : error.getMessage(), null);
            }
        });
    }

    private boolean launchMediaPicker(int requestCode, String mime, String[] mimeTypes, boolean video) {
        Uri collection = video
                ? MediaStore.Video.Media.EXTERNAL_CONTENT_URI
                : MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
        if (Build.VERSION.SDK_INT >= 33) {
            Intent picker = new Intent(MediaStore.ACTION_PICK_IMAGES);
            picker.setType(mime);
            picker.putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes);
            picker.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            if (startPicker(picker, requestCode)) return true;
        }
        Intent gallery = new Intent(Intent.ACTION_PICK);
        gallery.setDataAndType(collection, mime);
        gallery.putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes);
        gallery.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        return startPicker(gallery, requestCode);
    }

    private boolean startPicker(Intent intent, int requestCode) {
        try {
            if (intent.resolveActivity(getPackageManager()) == null) return false;
            startActivityForResult(intent, requestCode);
            return true;
        } catch (Exception error) {
            Log.w(TAG, "start media picker failed", error);
            return false;
        }
    }

    private String queryDisplayName(Uri uri) {
        try (Cursor cursor = getContentResolver().query(
                uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                String name = cursor.getString(0);
                if (name != null && !name.trim().isEmpty()) return name;
            }
        } catch (Exception ignored) {
        }
        return "导入的GIF.gif";
    }

    private void importCallback(boolean ok, String message, String name) {
        String nameLiteral = name == null ? "null" : JSONObject.quote(name);
        String script = "window.onMediaImported(" + ok + ","
                + JSONObject.quote(message) + "," + nameLiteral + ")";
        mainHandler.post(() -> {
            if (webView != null) webView.evaluateJavascript(script, null);
        });
    }

    @Override
    public void onBackPressed() {
        if (bridge.isBusy()) {
            Toast.makeText(this, "正在处理，请稍候…", Toast.LENGTH_SHORT).show();
            return;
        }
        if (webView == null) {
            super.onBackPressed();
            return;
        }
        webView.evaluateJavascript(
                "(window.androidBack && window.androidBack()) ? '1' : '0'",
                value -> {
                    if (!"\"1\"".equals(value)) {
                        finish();
                    }
                });
    }

    @Override
    protected void onDestroy() {
        bridge.cancelSave();
        if (webView != null) {
            webView.removeJavascriptInterface("AndroidBridge");
            webView.destroy();
            webView = null;
        }
        io.shutdownNow();
        super.onDestroy();
    }

    private final class LocalClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            return uri == null || !APP_HOST.equals(uri.getHost());
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (uri == null || !APP_HOST.equals(uri.getHost())) {
                return null;
            }
            String path = uri.getPath();
            if (path != null && path.startsWith("/library/")) {
                return serveLibrary(uri, request);
            }
            if (path != null && path.startsWith("/thumb/")) {
                return serveThumbnail(uri);
            }
            return serveAsset(path);
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            super.onPageFinished(view, url);
            mainHandler.postDelayed(MainActivity.this::hideLoadingOverlay, 120);
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request,
                                    android.webkit.WebResourceError error) {
            Log.w(TAG, "web error: " + request.getUrl() + " " + error.getDescription());
        }
    }

    private final class LocalChromeClient extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                         FileChooserParams params) {
            if (filePathCallback != null) {
                filePathCallback.onReceiveValue(null);
            }
            filePathCallback = callback;
            boolean launched = launchMediaPicker(
                    REQUEST_PICK_VIDEO, "video/*", VIDEO_MIME_TYPES, true);
            if (!launched) {
                filePathCallback = null;
                callback.onReceiveValue(null);
                Toast.makeText(MainActivity.this, "没有找到可用的照片选择器。", Toast.LENGTH_SHORT).show();
                return false;
            }
            return true;
        }

        @Override
        public void onPermissionRequest(PermissionRequest request) {
            request.deny();
        }

        @Override
        public boolean onConsoleMessage(ConsoleMessage message) {
            Log.d(TAG, message.message() + " @" + message.lineNumber());
            return true;
        }
    }

    private WebResourceResponse serveLibrary(Uri uri, WebResourceRequest request) {
        String name = uri.getLastPathSegment();
        File file = gifStore == null ? null : gifStore.resolve(name);
        if (file == null) return errorResponse(404);
        try {
            long length = file.length();
            long start = 0;
            long end = length - 1;
            boolean partial = false;
            String range = null;
            if (request != null) {
                for (Map.Entry<String, String> header : request.getRequestHeaders().entrySet()) {
                    if ("range".equalsIgnoreCase(header.getKey())) {
                        range = header.getValue();
                        break;
                    }
                }
            }
            if (range != null && range.toLowerCase(Locale.US).startsWith("bytes=")) {
                String spec = range.substring(6).split(",")[0].trim();
                int dash = spec.indexOf('-');
                if (dash >= 0) {
                    String startText = spec.substring(0, dash).trim();
                    String endText = spec.substring(dash + 1).trim();
                    try {
                        if (startText.isEmpty() && !endText.isEmpty()) {
                            long suffix = Long.parseLong(endText);
                            start = Math.max(0, length - suffix);
                        } else if (!startText.isEmpty()) {
                            start = Long.parseLong(startText);
                        }
                        if (!endText.isEmpty() && !startText.isEmpty()) {
                            end = Long.parseLong(endText);
                        }
                    } catch (NumberFormatException ignored) {
                        start = 0;
                        end = length - 1;
                    }
                    start = Math.max(0, Math.min(start, length - 1));
                    end = Math.max(start, Math.min(end, length - 1));
                    partial = true;
                }
            }

            InputStream stream = new FileInputStream(file);
            long skipped = 0;
            while (skipped < start) {
                long step = stream.skip(start - skipped);
                if (step <= 0) break;
                skipped += step;
            }
            if (partial) stream = new BoundedInputStream(stream, end - start + 1);
            WebResourceResponse response = new WebResourceResponse(GifStore.mimeOf(file.getName()), null, stream);
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", "no-store");
            headers.put("Accept-Ranges", "bytes");
            headers.put("Content-Length", String.valueOf(end - start + 1));
            if (partial) {
                headers.put("Content-Range", "bytes " + start + "-" + end + "/" + length);
                response.setStatusCodeAndReasonPhrase(206, "Partial Content");
            }
            response.setResponseHeaders(headers);
            return response;
        } catch (IOException error) {
            return errorResponse(404);
        }
    }

    private WebResourceResponse serveThumbnail(Uri uri) {
        String name = uri.getLastPathSegment();
        if (gifStore == null || gifStore.resolve(name) == null) return errorResponse(404);
        File file = gifStore.thumbnailFile(name);
        if (!file.isFile()) return errorResponse(404);
        try {
            InputStream stream = new FileInputStream(file);
            WebResourceResponse response = new WebResourceResponse("image/jpeg", null, stream);
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", "no-store");
            headers.put("Content-Length", String.valueOf(file.length()));
            response.setResponseHeaders(headers);
            return response;
        } catch (IOException error) {
            return errorResponse(404);
        }
    }

    private WebResourceResponse serveAsset(String path) {
        String clean = path == null ? "index.html" : path.replaceFirst("^/+", "");
        if (clean.isEmpty()) {
            clean = "index.html";
        }
        if (clean.contains("..") || clean.startsWith("/")) {
            return errorResponse(404);
        }

        String assetPath = "web/" + clean;
        String mime = mimeFor(clean);
        boolean textual = mime.startsWith("text/") || mime.contains("javascript")
                || mime.contains("json") || mime.contains("svg");
        try {
            InputStream stream = getAssets().open(assetPath);
            WebResourceResponse response = new WebResourceResponse(
                    mime, textual ? "UTF-8" : null, stream);
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", "no-cache");
            headers.put("Access-Control-Allow-Origin", "*");
            response.setResponseHeaders(headers);
            return response;
        } catch (IOException error) {
            return errorResponse(404);
        }
    }

    private WebResourceResponse errorResponse(int code) {
        WebResourceResponse response = new WebResourceResponse(
                "text/plain", "UTF-8",
                new ByteArrayInputStream("Not found".getBytes(StandardCharsets.UTF_8)));
        response.setStatusCodeAndReasonPhrase(code, "Not Found");
        return response;
    }

    private static String mimeFor(String path) {
        String lower = path.toLowerCase(Locale.US);
        if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
        if (lower.endsWith(".css")) return "text/css";
        if (lower.endsWith(".js")) return "application/javascript";
        if (lower.endsWith(".wasm")) return "application/wasm";
        if (lower.endsWith(".json")) return "application/json";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        if (lower.endsWith(".woff2")) return "font/woff2";
        return "application/octet-stream";
    }

    private static final class BoundedInputStream extends InputStream {
        private final InputStream input;
        private long remaining;

        BoundedInputStream(InputStream input, long remaining) {
            this.input = input;
            this.remaining = remaining;
        }

        @Override
        public int read() throws IOException {
            if (remaining <= 0) return -1;
            int value = input.read();
            if (value >= 0) remaining -= 1;
            return value;
        }

        @Override
        public int read(byte[] buffer, int offset, int length) throws IOException {
            if (remaining <= 0) return -1;
            int allowed = (int) Math.min(length, remaining);
            int read = input.read(buffer, offset, allowed);
            if (read > 0) remaining -= read;
            return read;
        }

        @Override
        public void close() throws IOException {
            input.close();
        }
    }

    public final class GifBridge {
        private final Object lock = new Object();
        private FileOutputStream saveStream;
        private File tempFile;
        private String pendingName;
        private boolean saveError;
        private volatile boolean busy;

        @JavascriptInterface
        public void setBusy(boolean value) {
            busy = value;
            runOnUiThread(() -> {
                if (value) {
                    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                } else {
                    getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                }
            });
        }

        @JavascriptInterface
        public boolean isBusy() {
            return busy;
        }

        @JavascriptInterface
        public void toast(String message) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, message, Toast.LENGTH_SHORT).show());
        }

        @JavascriptInterface
        public void beginSave(String filename) {
            synchronized (lock) {
                closeStreamLocked();
                deleteTempLocked();
                pendingName = GifStore.safeName(filename);
                saveError = false;
                try {
                    tempFile = File.createTempFile("yuansu-gif-", ".gif", getCacheDir());
                    saveStream = new FileOutputStream(tempFile);
                } catch (IOException error) {
                    saveError = true;
                    tempFile = null;
                    saveStream = null;
                }
            }
        }

        @JavascriptInterface
        public void appendSave(String base64) {
            synchronized (lock) {
                if (saveStream == null || saveError) return;
                try {
                    byte[] chunk = Base64.decode(base64, Base64.DEFAULT);
                    saveStream.write(chunk);
                } catch (IllegalArgumentException | IOException error) {
                    saveError = true;
                }
            }
        }

        @JavascriptInterface
        public void finishSave() {
            File file;
            String name;
            boolean failed;
            synchronized (lock) {
                closeStreamLocked();
                file = tempFile;
                name = pendingName;
                failed = saveError || file == null || !file.isFile() || file.length() == 0;
                tempFile = null;
                pendingName = null;
            }
            if (failed) {
                if (file != null) file.delete();
                callback(false, "保存失败，请重试。", null);
                return;
            }
            final File exportFile = file;
            final String exportName = name;
            io.execute(() -> saveToLibrary(exportFile, exportName));
        }

        @JavascriptInterface
        public void cancelSave() {
            synchronized (lock) {
                closeStreamLocked();
                deleteTempLocked();
                pendingName = null;
                saveError = false;
            }
        }

        @JavascriptInterface
        public String listGifs() {
            JSONArray array = new JSONArray();
            for (GifStore.Item entry : gifStore.listItems()) {
                try {
                    JSONObject item = new JSONObject();
                    item.put("name", entry.name);
                    item.put("folder", entry.folder);
                    item.put("type", entry.type);
                    item.put("mime", entry.mime);
                    item.put("size", entry.size);
                    item.put("modified", entry.modified);
                    item.put("thumbnail", entry.thumbnail);
                    item.put("uri", gifStore.uriFor(entry.name).toString());
                    array.put(item);
                } catch (Exception ignored) {
                }
            }
            return array.toString();
        }

        @JavascriptInterface
        public String listFolders() {
            JSONArray array = new JSONArray();
            for (String folder : gifStore.folders()) array.put(folder);
            return array.toString();
        }

        @JavascriptInterface
        public String createFolder(String name) {
            return folderResult(() -> {
                String created = gifStore.createFolder(name);
                return "name=" + created;
            });
        }

        @JavascriptInterface
        public String renameFolder(String oldName, String requested) {
            return folderResult(() -> {
                String renamed = gifStore.renameFolder(oldName, requested);
                return "name=" + renamed;
            });
        }

        @JavascriptInterface
        public String deleteFolder(String name) {
            return folderResult(() -> {
                int moved = gifStore.deleteFolder(name);
                return "moved=" + moved;
            });
        }

        @JavascriptInterface
        public String moveToFolder(String name, String folder) {
            return folderResult(() -> {
                gifStore.moveToFolder(name, folder);
                return "";
            });
        }

        private String folderResult(java.util.concurrent.Callable<String> action) {
            JSONObject result = new JSONObject();
            try {
                String extra = action.call();
                result.put("ok", true);
                if (extra != null && extra.startsWith("name=")) {
                    result.put("name", extra.substring(5));
                } else if (extra != null && extra.startsWith("moved=")) {
                    result.put("moved", Integer.parseInt(extra.substring(6)));
                }
            } catch (Exception error) {
                try {
                    result.put("ok", false);
                    result.put("error", error.getMessage() == null ? "操作失败" : error.getMessage());
                } catch (Exception ignored) {
                }
            }
            return result.toString();
        }

        @JavascriptInterface
        public String renameGif(String oldName, String requestedName) {
            JSONObject result = new JSONObject();
            try {
                String name = gifStore.rename(oldName, requestedName);
                result.put("ok", true);
                result.put("name", name);
            } catch (Exception error) {
                try {
                    result.put("ok", false);
                    result.put("error", error.getMessage() == null ? "重命名失败" : error.getMessage());
                } catch (Exception ignored) {
                }
            }
            return result.toString();
        }

        @JavascriptInterface
        public String deleteGif(String name) {
            JSONObject result = new JSONObject();
            try {
                boolean deleted = gifStore.delete(name);
                result.put("ok", deleted);
                if (!deleted) result.put("error", "文件不存在或已被删除");
            } catch (Exception error) {
                try {
                    result.put("ok", false);
                    result.put("error", "删除失败");
                } catch (Exception ignored) {
                }
            }
            return result.toString();
        }

        @JavascriptInterface
        public void pickImagesToImport() {
            runOnUiThread(() -> {
                if (!launchMediaPicker(REQUEST_IMPORT_IMAGE, "image/*", IMAGE_MIME_TYPES, false)) {
                    importCallback(false, "没有找到可用的照片选择器", null);
                }
            });
        }

        @JavascriptInterface
        public void pickVideosToImport() {
            runOnUiThread(() -> {
                if (!launchMediaPicker(REQUEST_IMPORT_VIDEO, "video/*", VIDEO_MIME_TYPES, true)) {
                    importCallback(false, "没有找到可用的照片选择器", null);
                }
            });
        }

        @JavascriptInterface
        public void saveMediaToGallery(String name) {
            File file = gifStore == null ? null : gifStore.resolve(name);
            if (file == null) {
                galleryCallback(false, "文件不存在或已被删除。");
                return;
            }
            io.execute(() -> {
                try {
                    GifGalleryExporter.export(MainActivity.this, file, file.getName());
                    galleryCallback(true, "已保存到手机相册。");
                } catch (Exception error) {
                    Log.w(TAG, "export media to gallery failed", error);
                    galleryCallback(false, "保存到手机失败，请重试。");
                }
            });
        }

        private void galleryCallback(boolean ok, String message) {
            String script = "window.onGallerySaved(" + ok + ","
                    + JSONObject.quote(message) + ")";
            mainHandler.post(() -> {
                if (webView != null) webView.evaluateJavascript(script, null);
            });
        }

        @JavascriptInterface
        public void shareMedia(String name) {
            File file = gifStore == null ? null : gifStore.resolve(name);
            if (file == null) {
                toast("文件不存在或已被删除。");
                return;
            }
            final Uri uri = gifStore.uriFor(file.getName());
            final String mime = GifStore.mimeOf(file.getName());
            runOnUiThread(() -> {
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType(mime);
                send.putExtra(Intent.EXTRA_STREAM, uri);
                send.setClipData(ClipData.newRawUri(file.getName(), uri));
                send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                startActivity(Intent.createChooser(send, "分享作品"));
            });
        }

        private void closeStreamLocked() {
            if (saveStream != null) {
                try {
                    saveStream.flush();
                    saveStream.close();
                } catch (IOException ignored) {
                }
                saveStream = null;
            }
        }

        private void deleteTempLocked() {
            if (tempFile != null) {
                tempFile.delete();
                tempFile = null;
            }
        }

        private void saveToLibrary(File file, String desiredName) {
            try {
                String savedName = gifStore.save(file, desiredName);
                callback(true, "已保存到作品库", savedName);
            } catch (Exception error) {
                Log.w(TAG, "save gif failed", error);
                callback(false, "保存失败，请重试。", null);
            } finally {
                file.delete();
            }
        }

        private void callback(boolean ok, String message, String name) {
            String nameLiteral = name == null ? "null" : JSONObject.quote(name);
            String script = "window.onGifSaved(" + ok + ","
                    + JSONObject.quote(message) + "," + nameLiteral + ")";
            mainHandler.post(() -> {
                if (webView != null) {
                    webView.evaluateJavascript(script, null);
                }
            });
        }
    }
}
