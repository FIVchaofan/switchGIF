package com.yuansu.gif;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;

/**
 * 只读 ContentProvider，用于把私密库里的一张图片、一段视频或 GIF
 * 临时分享/预览给其他应用。它不写入 MediaStore，也不暴露目录列表。
 */
public class GifFileProvider extends ContentProvider {
    public static final String AUTHORITY = GifStore.AUTHORITY;

    private GifStore store;

    @Override
    public boolean onCreate() {
        Context context = getContext();
        if (context == null) return false;
        store = new GifStore(context);
        return true;
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection,
                        String[] selectionArgs, String sortOrder) {
        String name = uri.getLastPathSegment();
        File file = store == null ? null : store.resolve(name);
        if (file == null) return null;

        String[] columns = projection != null ? projection
                : new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE};
        MatrixCursor cursor = new MatrixCursor(columns, 1);
        Object[] row = new Object[columns.length];
        for (int index = 0; index < columns.length; index++) {
            if (OpenableColumns.DISPLAY_NAME.equals(columns[index])) {
                row[index] = file.getName();
            } else if (OpenableColumns.SIZE.equals(columns[index])) {
                row[index] = file.length();
            } else {
                row[index] = null;
            }
        }
        cursor.addRow(row);
        return cursor;
    }

    @Override
    public String getType(Uri uri) {
        String name = uri.getLastPathSegment();
        return store != null && store.resolve(name) != null ? GifStore.mimeOf(name) : null;
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        if (mode != null && !mode.equals("r")) throw new FileNotFoundException("只读");
        String name = uri.getLastPathSegment();
        File file = store == null ? null : store.resolve(name);
        if (file == null) throw new FileNotFoundException("文件不存在");
        return ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        throw new UnsupportedOperationException("read-only provider");
    }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) {
        return 0;
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) {
        return 0;
    }
}
