package com.yuansu.gif;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Environment;
import android.provider.MediaStore;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * 只有用户明确点击“保存到手机”时，才把作品导出成一份相册可见的副本。
 * 图片/GIF 进 Pictures，视频进 Movies；作品库里的原文件不会被删除或移动。
 */
public final class GifGalleryExporter {
    private GifGalleryExporter() {
    }

    public static String export(Context context, File source, String displayName) throws IOException {
        if (source == null || !source.isFile() || source.length() == 0) {
            throw new IOException("文件不存在");
        }
        String name = displayName == null || displayName.trim().isEmpty()
                ? source.getName() : displayName.trim();
        String mime = GifStore.mimeOf(name);
        boolean video = mime.startsWith("video/");
        if (video) {
            if (!name.toLowerCase(java.util.Locale.US).matches(".*\\.(mp4|m4v|mov|webm|mkv|3gp|avi|mpg|mpeg)$")) {
                name += ".mp4";
                mime = "video/mp4";
            }
        }

        ContentResolver resolver = context.getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
        values.put(MediaStore.MediaColumns.MIME_TYPE, mime);
        values.put(MediaStore.MediaColumns.RELATIVE_PATH,
                (video ? Environment.DIRECTORY_MOVIES : Environment.DIRECTORY_PICTURES) + "/原速GIF");
        values.put(MediaStore.MediaColumns.IS_PENDING, 1);

        Uri collection = video
                ? MediaStore.Video.Media.EXTERNAL_CONTENT_URI
                : MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
        Uri uri = null;
        try {
            uri = resolver.insert(collection, values);
            if (uri == null) throw new IOException("无法写入相册");
            try (InputStream input = new FileInputStream(source);
                 OutputStream output = resolver.openOutputStream(uri)) {
                if (output == null) throw new IOException("无法写入相册");
                byte[] buffer = new byte[64 * 1024];
                int read;
                while ((read = input.read(buffer)) != -1) {
                    output.write(buffer, 0, read);
                }
            }
            ContentValues done = new ContentValues();
            done.put(MediaStore.MediaColumns.IS_PENDING, 0);
            resolver.update(uri, done, null, null);
            return name;
        } catch (Exception error) {
            if (uri != null) {
                try {
                    resolver.delete(uri, null, null);
                } catch (Exception ignored) {
                }
            }
            if (error instanceof IOException) throw (IOException) error;
            throw new IOException("保存到相册失败", error);
        }
    }
}
