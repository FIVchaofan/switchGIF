package com.yuansu.gif;

import android.content.ContentResolver;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.MediaMetadataRetriever;
import android.net.Uri;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 私密多媒体库：GIF、图片、视频都放在应用内部目录。
 * 公共相册不会扫描到这里；只有用户主动分享或“保存到手机”时才会产生外部副本。
 *
 * 文件夹是应用内的虚拟文件夹，底层文件保持扁平存储，避免隐私目录里出现
 * 可被文件管理器直接浏览的层级结构，也让分享 URI 始终只指向单个文件。
 */
public final class GifStore {
    public static final String AUTHORITY = "com.yuansu.gif.files";
    public static final String ROOT_FOLDER = "";

    private static final Object LOCK = new Object();
    private static final String PREFS = "private_library_v1";
    private static final String PREFS_KEY = "folders";
    private static final Map<String, String> MIME_BY_EXT = new LinkedHashMap<>();

    static {
        MIME_BY_EXT.put("gif", "image/gif");
        MIME_BY_EXT.put("png", "image/png");
        MIME_BY_EXT.put("jpg", "image/jpeg");
        MIME_BY_EXT.put("jpeg", "image/jpeg");
        MIME_BY_EXT.put("webp", "image/webp");
        MIME_BY_EXT.put("bmp", "image/bmp");
        MIME_BY_EXT.put("heic", "image/heic");
        MIME_BY_EXT.put("heif", "image/heif");
        MIME_BY_EXT.put("avif", "image/avif");
        MIME_BY_EXT.put("mp4", "video/mp4");
        MIME_BY_EXT.put("m4v", "video/mp4");
        MIME_BY_EXT.put("mov", "video/quicktime");
        MIME_BY_EXT.put("webm", "video/webm");
        MIME_BY_EXT.put("mkv", "video/x-matroska");
        MIME_BY_EXT.put("3gp", "video/3gpp");
        MIME_BY_EXT.put("avi", "video/x-msvideo");
        MIME_BY_EXT.put("mpg", "video/mpeg");
        MIME_BY_EXT.put("mpeg", "video/mpeg");
    }

    private final Context context;
    private final File directory;
    private final SharedPreferences prefs;
    private JSONArray folderNames = new JSONArray();
    private JSONObject itemFolders = new JSONObject();

    public GifStore(Context context) {
        this.context = context.getApplicationContext();
        this.directory = new File(this.context.getFilesDir(), "gifs");
        if (!directory.isDirectory()) directory.mkdirs();
        this.prefs = this.context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        synchronized (LOCK) {
            loadFoldersLocked();
            cleanupLocked();
        }
    }

    public File getDirectory() {
        return directory;
    }

    public static boolean isAllowedName(String name) {
        return !"file".equals(kindOf(name));
    }

    public static String extensionOf(String name) {
        if (name == null) return "";
        int dot = name.lastIndexOf('.');
        if (dot < 0 || dot == name.length() - 1) return "";
        return name.substring(dot + 1).toLowerCase(Locale.US);
    }

    public static String mimeOf(String name) {
        return MIME_BY_EXT.getOrDefault(extensionOf(name), "application/octet-stream");
    }

    public static String kindOf(String name) {
        String mime = mimeOf(name);
        if ("image/gif".equals(mime)) return "gif";
        if (mime.startsWith("image/")) return "image";
        if (mime.startsWith("video/")) return "video";
        return "file";
    }

    public File resolve(String name) {
        if (name == null) return null;
        String trimmed = name.trim();
        if (trimmed.isEmpty() || !trimmed.equals(new File(trimmed).getName())) return null;
        if (!isAllowedName(trimmed)) return null;
        try {
            File candidate = new File(directory, trimmed).getCanonicalFile();
            if (!directory.getCanonicalFile().equals(candidate.getParentFile())) return null;
            return candidate.isFile() ? candidate : null;
        } catch (IOException error) {
            return null;
        }
    }

    public List<Item> listItems() {
        synchronized (LOCK) {
            cleanupLocked();
            File[] files = directory.listFiles((dir, name) ->
                    new File(dir, name).isFile() && isAllowedName(name));
            List<Item> result = new ArrayList<>();
            if (files != null) {
                for (File file : files) {
                    result.add(itemForLocked(file));
                }
            }
            result.sort(Comparator.comparingLong((Item item) -> item.modified).reversed()
                    .thenComparing(item -> item.name));
            return result;
        }
    }

    public List<String> folders() {
        synchronized (LOCK) {
            cleanupLocked();
            List<String> result = new ArrayList<>();
            for (int index = 0; index < folderNames.length(); index++) {
                String name = folderNames.optString(index, "");
                if (!name.isEmpty()) result.add(name);
            }
            result.sort(String.CASE_INSENSITIVE_ORDER);
            return result;
        }
    }

    public String folderOf(String name) {
        synchronized (LOCK) {
            return folderOfLocked(name);
        }
    }

    public String importFrom(Context context, Uri uri, String preferredName) throws IOException {
        if (uri == null) throw new IOException("没有选择文件");
        ContentResolver resolver = context.getContentResolver();
        String mime = normalizeMime(resolver.getType(uri));
        String extension = extensionOf(preferredName);
        if (!MIME_BY_EXT.containsKey(extension)) extension = extensionForMime(mime);
        if (extension.isEmpty()) throw new IOException("只支持 GIF、图片或视频文件");
        String kind = kindOf("file." + extension);
        if ("file".equals(kind)) throw new IOException("只支持 GIF、图片或视频文件");

        File temp = File.createTempFile("library-import-", "." + extension, context.getCacheDir());
        try {
            try (InputStream input = resolver.openInputStream(uri);
                 OutputStream output = new FileOutputStream(temp)) {
                if (input == null) throw new IOException("无法读取文件");
                copy(input, output);
            }
            if (temp.length() == 0) throw new IOException("文件为空");
            validate(temp, extension);
            String name = ensureExtension(preferredName, extension);
            String saved = save(temp, name);
            ensureThumbnail(saved);
            return saved;
        } finally {
            if (temp.exists() && !temp.delete()) temp.deleteOnExit();
        }
    }

    public String save(File temp, String desiredName) throws IOException {
        synchronized (LOCK) {
            if (temp == null || !temp.isFile() || temp.length() == 0) {
                throw new IOException("文件数据为空");
            }
            File target = uniqueFileLocked(safeNameWithExtension(desiredName, "gif"));
            if (!temp.renameTo(target)) {
                try {
                    copy(temp, target);
                } catch (IOException error) {
                    target.delete();
                    throw error;
                }
                if (!temp.delete()) temp.deleteOnExit();
            }
            return target.getName();
        }
    }

    public String rename(String oldName, String requestedName) throws IOException {
        synchronized (LOCK) {
            File source = resolve(oldName);
            if (source == null) throw new IOException("文件不存在或已被删除");
            String sourceName = source.getName();
            String extension = extensionOf(sourceName);
            String base = stripExtension(requestedName);
            if (base.isEmpty()) throw new IOException("请输入文件名");
            String targetName = safeBase(base, 60) + "." + extension;
            File target = new File(directory, targetName);
            if (source.getName().equals(targetName)) return targetName;
            if (target.exists()) throw new IOException("这个名称已经存在");
            if (!source.renameTo(target)) {
                try {
                    copy(source, target);
                } catch (IOException error) {
                    target.delete();
                    throw error;
                }
                if (!source.delete()) throw new IOException("重命名失败");
            }
            File oldThumb = thumbnailFile(sourceName);
            if (oldThumb.isFile()) {
                File newThumb = thumbnailFile(targetName);
                if (!oldThumb.renameTo(newThumb)) {
                    try {
                        copy(oldThumb, newThumb);
                        oldThumb.delete();
                    } catch (IOException ignored) {
                    }
                }
            }
            String folder = folderOfLocked(oldName);
            if (!folder.isEmpty()) {
                itemFolders.remove(oldName);
                try {
                    itemFolders.put(targetName, folder);
                } catch (Exception ignored) {
                }
                persistLocked();
            }
            return targetName;
        }
    }

    public boolean delete(String name) {
        synchronized (LOCK) {
            File file = resolve(name);
            if (file == null) return false;
            boolean deleted = file.delete();
            if (deleted) {
                File thumb = thumbnailFile(name);
                if (thumb.exists()) thumb.delete();
            }
            if (deleted && itemFolders.has(name)) {
                itemFolders.remove(name);
                persistLocked();
            }
            return deleted;
        }
    }

    public Uri uriFor(String name) {
        return new Uri.Builder()
                .scheme("content")
                .authority(AUTHORITY)
                .appendPath("file")
                .appendPath(name)
                .build();
    }

    public String createFolder(String requested) throws IOException {
        synchronized (LOCK) {
            String name = safeFolderName(requested);
            if (findFolderLocked(name) != null) throw new IOException("文件夹已存在");
            try {
                folderNames.put(name);
            } catch (Exception error) {
                throw new IOException("文件夹创建失败", error);
            }
            persistLocked();
            return name;
        }
    }

    public String renameFolder(String oldName, String requested) throws IOException {
        synchronized (LOCK) {
            String old = findFolderLocked(oldName);
            if (old == null) throw new IOException("文件夹不存在");
            String name = safeFolderName(requested);
            String existing = findFolderLocked(name);
            if (existing != null && !existing.equals(old)) throw new IOException("文件夹已存在");
            int index = indexOfFolderLocked(old);
            if (index < 0) throw new IOException("文件夹不存在");
            try {
                folderNames.put(index, name);
            } catch (Exception error) {
                throw new IOException("文件夹重命名失败", error);
            }
            List<String> keys = new ArrayList<>();
            for (java.util.Iterator<String> iterator = itemFolders.keys(); iterator.hasNext(); ) {
                keys.add(iterator.next());
            }
            for (String item : keys) {
                if (old.equals(itemFolders.optString(item, ""))) {
                    try {
                        itemFolders.put(item, name);
                    } catch (Exception ignored) {
                    }
                }
            }
            persistLocked();
            return name;
        }
    }

    public int deleteFolder(String name) throws IOException {
        synchronized (LOCK) {
            String folder = findFolderLocked(name);
            if (folder == null) throw new IOException("文件夹不存在");
            int index = indexOfFolderLocked(folder);
            if (index >= 0) folderNames.remove(index);
            int moved = 0;
            List<String> keys = new ArrayList<>();
            for (java.util.Iterator<String> iterator = itemFolders.keys(); iterator.hasNext(); ) {
                keys.add(iterator.next());
            }
            for (String item : keys) {
                if (folder.equals(itemFolders.optString(item, ""))) {
                    itemFolders.remove(item);
                    moved += 1;
                }
            }
            persistLocked();
            return moved;
        }
    }

    public void moveToFolder(String name, String folder) throws IOException {
        synchronized (LOCK) {
            if (resolve(name) == null) throw new IOException("文件不存在或已被删除");
            if (folder == null || folder.trim().isEmpty()) {
                itemFolders.remove(name);
            } else {
                String existing = findFolderLocked(folder);
                if (existing == null) throw new IOException("文件夹不存在");
                try {
                    itemFolders.put(name, existing);
                } catch (Exception error) {
                    throw new IOException("移动失败", error);
                }
            }
            persistLocked();
        }
    }

    public static String safeName(String requested) {
        return safeNameWithExtension(requested, "gif");
    }

    private static String safeNameWithExtension(String requested, String fallbackExtension) {
        String raw = requested == null ? "" : requested.trim();
        raw = raw.replaceAll("[\\\\/:*?\"<>|\\r\\n\\t]", "_");
        if (raw.isEmpty()) raw = "作品";
        String extension = extensionOf(raw);
        String base;
        if (MIME_BY_EXT.containsKey(extension)) {
            base = raw.substring(0, raw.length() - extension.length() - 1);
        } else {
            base = raw;
            extension = fallbackExtension;
        }
        if (!MIME_BY_EXT.containsKey(extension)) extension = "gif";
        return safeBase(base, 64) + "." + extension;
    }

    private static String safeBase(String requested, int maxLength) {
        String base = requested == null ? "" : requested.trim();
        base = base.replaceAll("[\\\\/:*?\"<>|\\r\\n\\t]", "_");
        base = base.replaceAll("[. ]+$", "");
        if (base.isEmpty()) base = "作品";
        if (base.length() > maxLength) base = base.substring(0, maxLength).trim();
        if (base.isEmpty()) base = "作品";
        return base;
    }

    private static String stripExtension(String name) {
        String raw = name == null ? "" : name.trim();
        String extension = extensionOf(raw);
        if (MIME_BY_EXT.containsKey(extension)) {
            return raw.substring(0, raw.length() - extension.length() - 1);
        }
        return raw;
    }

    private static String ensureExtension(String preferredName, String extension) {
        String raw = preferredName == null ? "" : preferredName.trim();
        if (raw.isEmpty()) raw = "导入的作品";
        if (!MIME_BY_EXT.containsKey(extensionOf(raw))) {
            raw = raw + "." + extension;
        }
        return raw;
    }

    private static String normalizeMime(String mime) {
        if (mime == null) return "";
        int semicolon = mime.indexOf(';');
        if (semicolon >= 0) mime = mime.substring(0, semicolon);
        return mime.trim().toLowerCase(Locale.US);
    }

    private static String extensionForMime(String mime) {
        if (mime == null) return "";
        for (Map.Entry<String, String> entry : MIME_BY_EXT.entrySet()) {
            if (entry.getValue().equals(mime)) return entry.getKey();
        }
        return "";
    }

    private static void validate(File file, String extension) throws IOException {
        if ("gif".equals(extension)) {
            try (FileInputStream input = new FileInputStream(file)) {
                byte[] header = new byte[6];
                if (input.read(header) != 6) throw new IOException("文件不是有效的 GIF");
                String magic = new String(header, java.nio.charset.StandardCharsets.US_ASCII);
                if (!"GIF87a".equals(magic) && !"GIF89a".equals(magic)) {
                    throw new IOException("请选择 GIF 文件");
                }
            }
            return;
        }
        String kind = kindOf("file." + extension);
        if ("image".equals(kind)) {
            BitmapFactory.Options options = new BitmapFactory.Options();
            options.inJustDecodeBounds = true;
            BitmapFactory.decodeFile(file.getAbsolutePath(), options);
            if (options.outWidth <= 0 || options.outHeight <= 0) {
                throw new IOException("图片无法识别");
            }
            return;
        }
        if ("video".equals(kind)) {
            MediaMetadataRetriever retriever = new MediaMetadataRetriever();
            try {
                retriever.setDataSource(file.getAbsolutePath());
                String duration = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION);
                if (duration == null) throw new IOException("视频无法识别");
            } catch (Exception error) {
                if (error instanceof IOException) throw (IOException) error;
                throw new IOException("视频无法识别", error);
            } finally {
                try {
                    retriever.release();
                } catch (Exception ignored) {
                }
            }
        }
    }

    public File thumbnailFile(String name) {
        File thumbs = new File(directory, ".thumbs");
        if (!thumbs.isDirectory()) thumbs.mkdirs();
        return new File(thumbs, name + ".jpg");
    }

    public boolean hasThumbnail(String name) {
        return thumbnailFile(name).isFile();
    }

    public void ensureThumbnail(String name) {
        synchronized (LOCK) {
            File source = resolve(name);
            if (source == null || !"video".equals(kindOf(name))) return;
            File thumb = thumbnailFile(name);
            if (thumb.isFile() && thumb.length() > 0) return;
            createThumbnail(source, thumb);
        }
    }

    private void createThumbnail(File source, File thumb) {
        MediaMetadataRetriever retriever = new MediaMetadataRetriever();
        Bitmap bitmap = null;
        Bitmap scaled = null;
        try {
            retriever.setDataSource(source.getAbsolutePath());
            bitmap = retriever.getFrameAtTime(0, MediaMetadataRetriever.OPTION_CLOSEST_SYNC);
            if (bitmap == null) {
                bitmap = retriever.getFrameAtTime(500_000, MediaMetadataRetriever.OPTION_CLOSEST_SYNC);
            }
            if (bitmap == null) return;
            int width = bitmap.getWidth();
            int height = bitmap.getHeight();
            if (width > 360) {
                int targetHeight = Math.max(1, Math.round(height * (360f / width)));
                scaled = Bitmap.createScaledBitmap(bitmap, 360, targetHeight, true);
            } else {
                scaled = bitmap;
            }
            try (FileOutputStream output = new FileOutputStream(thumb)) {
                scaled.compress(Bitmap.CompressFormat.JPEG, 76, output);
            }
        } catch (Exception ignored) {
            if (thumb.exists()) thumb.delete();
        } finally {
            if (scaled != null && scaled != bitmap) scaled.recycle();
            if (bitmap != null) bitmap.recycle();
            try {
                retriever.release();
            } catch (Exception ignored) {
            }
        }
    }

    private Item itemForLocked(File file) {
        String name = file.getName();
        boolean thumbnail = false;
        if ("video".equals(kindOf(name))) {
            File thumb = thumbnailFile(name);
            if (!thumb.isFile() || thumb.length() == 0) createThumbnail(file, thumb);
            thumbnail = thumb.isFile() && thumb.length() > 0;
        }
        return new Item(
                name,
                folderOfLocked(name),
                kindOf(name),
                mimeOf(name),
                file.length(),
                file.lastModified(),
                thumbnail);
    }

    private String folderOfLocked(String name) {
        String folder = itemFolders.optString(name, "");
        if (folder.isEmpty()) return ROOT_FOLDER;
        return findFolderLocked(folder) == null ? ROOT_FOLDER : folder;
    }

    private String findFolderLocked(String requested) {
        if (requested == null) return null;
        String needle = requested.trim();
        for (int index = 0; index < folderNames.length(); index++) {
            String name = folderNames.optString(index, "");
            if (name.equalsIgnoreCase(needle)) return name;
        }
        return null;
    }

    private int indexOfFolderLocked(String folder) {
        for (int index = 0; index < folderNames.length(); index++) {
            if (folder.equals(folderNames.optString(index, ""))) return index;
        }
        return -1;
    }

    private String safeFolderName(String requested) throws IOException {
        String name = requested == null ? "" : requested.trim();
        name = name.replaceAll("[\\\\/:*?\"<>|\\r\\n\\t]", "_").trim();
        if (name.isEmpty()) throw new IOException("请输入文件夹名称");
        if (name.length() > 40) name = name.substring(0, 40).trim();
        if (name.isEmpty()) throw new IOException("请输入文件夹名称");
        return name;
    }

    private void loadFoldersLocked() {
        String raw = prefs.getString(PREFS_KEY, "");
        if (raw == null || raw.isEmpty()) return;
        try {
            JSONObject data = new JSONObject(raw);
            JSONArray folders = data.optJSONArray("folders");
            JSONObject items = data.optJSONObject("items");
            if (folders != null) folderNames = folders;
            if (items != null) itemFolders = items;
        } catch (Exception ignored) {
            folderNames = new JSONArray();
            itemFolders = new JSONObject();
        }
    }

    private void persistLocked() {
        try {
            JSONObject data = new JSONObject();
            data.put("folders", folderNames);
            data.put("items", itemFolders);
            prefs.edit().putString(PREFS_KEY, data.toString()).commit();
        } catch (Exception ignored) {
        }
    }

    private void cleanupLocked() {
        boolean changed = false;
        List<String> stale = new ArrayList<>();
        for (java.util.Iterator<String> iterator = itemFolders.keys(); iterator.hasNext(); ) {
            String name = iterator.next();
            File file = new File(directory, name);
            String folder = itemFolders.optString(name, "");
            if (!file.isFile() || (!folder.isEmpty() && findFolderLocked(folder) == null)) {
                stale.add(name);
            }
        }
        for (String name : stale) {
            itemFolders.remove(name);
            changed = true;
        }
        if (changed) persistLocked();
    }

    private File uniqueFileLocked(String name) {
        File candidate = new File(directory, name);
        if (!candidate.exists()) return candidate;
        String extension = extensionOf(name);
        String base = name.substring(0, name.length() - extension.length() - 1);
        for (int index = 1; index < 10000; index++) {
            candidate = new File(directory, base + " (" + index + ")." + extension);
            if (!candidate.exists()) return candidate;
        }
        return new File(directory, base + "-" + System.currentTimeMillis() + "." + extension);
    }

    private static void copy(File source, File target) throws IOException {
        try (InputStream input = new FileInputStream(source);
             OutputStream output = new FileOutputStream(target)) {
            copy(input, output);
        }
    }

    private static void copy(InputStream input, OutputStream output) throws IOException {
        byte[] buffer = new byte[64 * 1024];
        int read;
        while ((read = input.read(buffer)) != -1) {
            output.write(buffer, 0, read);
        }
    }

    public static final class Item {
        public final String name;
        public final String folder;
        public final String type;
        public final String mime;
        public final long size;
        public final long modified;
        public final boolean thumbnail;

        Item(String name, String folder, String type, String mime, long size, long modified, boolean thumbnail) {
            this.name = name;
            this.folder = folder;
            this.type = type;
            this.mime = mime;
            this.size = size;
            this.modified = modified;
            this.thumbnail = thumbnail;
        }
    }
}
