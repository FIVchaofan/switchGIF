# v1.3.5

- 版本：1.3.5（versionCode 9）
- 构建日期：2026-11-19
- 文件：`YuansuGIF-v1.3.5.apk`
- SHA-256：`994CDC91A3F9122C3D328EC4B47265829516D11AB126FDF77B04C6CF195E54CD`

修复：

- **内置 IjkPlayer 视频画面畸变**：不再用 `TextureView.setTransform` 拉伸画面，而是按视频宽高比调整 `TextureView` 的实际布局尺寸，居中显示；横屏/竖屏视频都会保持原始宽高比，黑边填充。
- 保留 v1.3.4 的内置开源 IjkPlayer、自定义控制条、本地视频自动播放、照片选择器和私密多媒体库。
