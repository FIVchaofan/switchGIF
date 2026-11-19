package com.yuansu.gif;

import android.app.Activity;
import android.content.pm.ActivityInfo;
import android.graphics.Color;
import android.os.Bundle;
import android.view.WindowManager;
import android.widget.MediaController;
import android.widget.Toast;
import android.widget.VideoView;

import java.io.File;

/**
 * 使用系统 MediaPlayer 播放私密库里的视频，避免 WebView 对大文件/自定义 Range
 * 支持不一致导致一直转圈。文件不离开应用，也不写入相册。
 */
public class VideoPlayerActivity extends Activity {
    private VideoView videoView;
    private int position;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.BLACK);
        getWindow().setNavigationBarColor(Color.BLACK);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR);

        String name = getIntent().getStringExtra("name");
        GifStore store = new GifStore(this);
        File file = store.resolve(name);
        if (file == null) {
            Toast.makeText(this, "视频不存在或已被删除。", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        videoView = new VideoView(this);
        videoView.setBackgroundColor(Color.BLACK);
        setContentView(videoView);

        MediaController controller = new MediaController(this);
        controller.setAnchorView(videoView);
        videoView.setMediaController(controller);
        videoView.setVideoPath(file.getAbsolutePath());
        videoView.setOnPreparedListener(mp -> {
            mp.setLooping(false);
            if (position > 0) {
                videoView.seekTo(position);
                position = 0;
            }
            videoView.start();
        });
        videoView.setOnErrorListener((mp, what, extra) -> {
            Toast.makeText(this, "这个视频的编码无法播放。", Toast.LENGTH_LONG).show();
            return true;
        });
        videoView.requestFocus();
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (videoView != null) {
            position = videoView.getCurrentPosition();
            if (videoView.isPlaying()) videoView.pause();
        }
    }

    @Override
    protected void onDestroy() {
        if (videoView != null) {
            try {
                videoView.stopPlayback();
            } catch (Exception ignored) {
            }
            videoView = null;
        }
        super.onDestroy();
    }
}
