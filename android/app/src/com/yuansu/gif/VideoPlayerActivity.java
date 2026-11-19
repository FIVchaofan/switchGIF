package com.yuansu.gif;

import android.app.Activity;
import android.content.pm.ActivityInfo;
import android.graphics.Color;
import android.graphics.Matrix;
import android.graphics.SurfaceTexture;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.Surface;
import android.view.TextureView;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.SeekBar;
import android.widget.TextView;
import android.widget.Toast;

import java.io.File;
import java.util.Locale;

import tv.danmaku.ijk.media.player.IjkMediaPlayer;

/**
 * 内置开源 IjkPlayer（Bilibili ijkplayer，LGPL/GPL）播放私密库视频。
 * 视频画面渲染到 TextureView，控制条由应用自己绘制，不启动任何系统播放器。
 */
public class VideoPlayerActivity extends Activity implements TextureView.SurfaceTextureListener {
    private IjkMediaPlayer player;
    private TextureView textureView;
    private FrameLayout rootView;
    private Surface surface;
    private SeekBar seekBar;
    private TextView playButton;
    private TextView timeText;
    private TextView titleText;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean prepared;
    private boolean tracking;
    private long durationMs;
    private int videoWidth;
    private int videoHeight;
    private String videoName;

    private final Runnable tick = new Runnable() {
        @Override
        public void run() {
            updateProgress();
            handler.postDelayed(this, 500);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.BLACK);
        getWindow().setNavigationBarColor(Color.BLACK);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR);

        videoName = getIntent().getStringExtra("name");
        GifStore store = new GifStore(this);
        File file = store.resolve(videoName);
        if (file == null) {
            Toast.makeText(this, "视频不存在或已被删除。", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        buildViews(file.getName());
        try {
            player = new IjkMediaPlayer();
            player.setOption(IjkMediaPlayer.OPT_CATEGORY_PLAYER, "framedrop", 1);
            player.setScreenOnWhilePlaying(true);
            if (surface != null) player.setSurface(surface);
            player.setOnPreparedListener(mp -> {
                prepared = true;
                durationMs = Math.max(0, mp.getDuration());
                seekBar.setMax(1000);
                playButton.setText("❚❚");
                mp.start();
                updateProgress();
            });
            player.setOnCompletionListener(mp -> {
                playButton.setText("▶");
                seekBar.setProgress(1000);
                timeText.setText(format(durationMs) + " / " + format(durationMs));
            });
            player.setOnErrorListener((mp, what, extra) -> {
                Toast.makeText(this, "这个视频的编码无法播放。", Toast.LENGTH_LONG).show();
                playButton.setText("▶");
                return true;
            });
            player.setOnVideoSizeChangedListener((mp, width, height, sarNum, sarDen) ->
                    applyAspect(width, height));
            player.setDataSource(file.getAbsolutePath());
            player.prepareAsync();
        } catch (Throwable error) {
            Toast.makeText(this, "开源播放器初始化失败：" + error.getMessage(), Toast.LENGTH_LONG).show();
            finish();
            return;
        }
        handler.post(tick);
    }

    private void buildViews(String title) {
        rootView = new FrameLayout(this);
        rootView.setBackgroundColor(Color.BLACK);
        rootView.addOnLayoutChangeListener((v, left, top, right, bottom,
                                             oldLeft, oldTop, oldRight, oldBottom) ->
                fitTextureToVideo());

        textureView = new TextureView(this);
        textureView.setSurfaceTextureListener(this);
        rootView.addView(textureView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        LinearLayout top = new LinearLayout(this);
        top.setGravity(Gravity.CENTER_VERTICAL);
        top.setPadding(dp(10), dp(8), dp(12), dp(8));
        top.setBackgroundColor(0x99080A0B);

        TextView back = new TextView(this);
        back.setText("‹");
        back.setTextColor(Color.WHITE);
        back.setTextSize(30);
        back.setGravity(Gravity.CENTER);
        back.setPadding(dp(8), 0, dp(14), dp(2));
        back.setOnClickListener(v -> finish());
        top.addView(back, new LinearLayout.LayoutParams(dp(44), dp(44)));

        titleText = new TextView(this);
        titleText.setText(title);
        titleText.setTextColor(Color.WHITE);
        titleText.setTextSize(14);
        titleText.setSingleLine(true);
        titleText.setEllipsize(android.text.TextUtils.TruncateAt.END);
        top.addView(titleText, new LinearLayout.LayoutParams(0,
                LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

        FrameLayout.LayoutParams topParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT);
        topParams.gravity = Gravity.TOP;
        rootView.addView(top, topParams);

        LinearLayout bottom = new LinearLayout(this);
        bottom.setGravity(Gravity.CENTER_VERTICAL);
        bottom.setPadding(dp(12), dp(8), dp(12), dp(14));
        bottom.setBackgroundColor(0x99080A0B);

        playButton = new TextView(this);
        playButton.setText("▶");
        playButton.setTextColor(Color.rgb(215, 255, 99));
        playButton.setTextSize(20);
        playButton.setGravity(Gravity.CENTER);
        playButton.setOnClickListener(v -> togglePlay());
        bottom.addView(playButton, new LinearLayout.LayoutParams(dp(44), dp(44)));

        seekBar = new SeekBar(this);
        seekBar.setMax(1000);
        seekBar.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override
            public void onProgressChanged(SeekBar bar, int progress, boolean fromUser) {
                if (fromUser && durationMs > 0) {
                    timeText.setText(format(progress * durationMs / 1000) + " / " + format(durationMs));
                }
            }

            @Override
            public void onStartTrackingTouch(SeekBar bar) {
                tracking = true;
            }

            @Override
            public void onStopTrackingTouch(SeekBar bar) {
                tracking = false;
                if (player != null && durationMs > 0) {
                    player.seekTo(bar.getProgress() * durationMs / 1000);
                }
            }
        });
        bottom.addView(seekBar, new LinearLayout.LayoutParams(0,
                LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

        timeText = new TextView(this);
        timeText.setText("00:00 / 00:00");
        timeText.setTextColor(Color.WHITE);
        timeText.setTextSize(10);
        timeText.setPadding(dp(8), 0, dp(2), 0);
        bottom.addView(timeText, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        FrameLayout.LayoutParams bottomParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT);
        bottomParams.gravity = Gravity.BOTTOM;
        rootView.addView(bottom, bottomParams);

        setContentView(rootView);
    }

    private void togglePlay() {
        if (player == null || !prepared) return;
        if (player.isPlaying()) {
            player.pause();
            playButton.setText("▶");
        } else {
            player.start();
            playButton.setText("❚❚");
        }
    }

    private void updateProgress() {
        if (player == null || !prepared) return;
        long position = Math.max(0, player.getCurrentPosition());
        if (!tracking && durationMs > 0) {
            int progress = (int) Math.min(1000, position * 1000 / durationMs);
            seekBar.setProgress(progress);
        }
        if (!tracking) {
            timeText.setText(format(position) + " / " + format(durationMs));
        }
    }

    private void applyAspect(int width, int height) {
        if (width <= 0 || height <= 0) return;
        videoWidth = width;
        videoHeight = height;
        fitTextureToVideo();
    }

    private void fitTextureToVideo() {
        if (videoWidth <= 0 || videoHeight <= 0 || textureView == null || rootView == null) return;
        int rootWidth = rootView.getWidth();
        int rootHeight = rootView.getHeight();
        if (rootWidth <= 0 || rootHeight <= 0) return;
        float scale = Math.min(rootWidth / (float) videoWidth, rootHeight / (float) videoHeight);
        int width = Math.max(1, Math.round(videoWidth * scale));
        int height = Math.max(1, Math.round(videoHeight * scale));
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(width, height);
        params.gravity = Gravity.CENTER;
        if (textureView.getLayoutParams() == null
                || textureView.getLayoutParams().width != width
                || textureView.getLayoutParams().height != height) {
            textureView.setLayoutParams(params);
        }
        textureView.setTransform(new Matrix());
    }

    private static String format(long ms) {
        long total = Math.max(0, ms) / 1000;
        return String.format(Locale.US, "%02d:%02d", total / 60, total % 60);
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override
    public void onSurfaceTextureAvailable(SurfaceTexture texture, int width, int height) {
        surface = new Surface(texture);
        if (player != null) player.setSurface(surface);
    }

    @Override
    public void onSurfaceTextureSizeChanged(SurfaceTexture texture, int width, int height) {
    }

    @Override
    public boolean onSurfaceTextureDestroyed(SurfaceTexture texture) {
        if (player != null) player.setSurface(null);
        if (surface != null) {
            surface.release();
            surface = null;
        }
        return true;
    }

    @Override
    public void onSurfaceTextureUpdated(SurfaceTexture texture) {
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (player != null && player.isPlaying()) {
            player.pause();
            playButton.setText("▶");
        }
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (player != null) {
            try {
                player.stop();
            } catch (Exception ignored) {
            }
            player.release();
            player = null;
        }
        if (surface != null) {
            surface.release();
            surface = null;
        }
        super.onDestroy();
    }
}

