# v1.3.4

- 版本：1.3.4（versionCode 8）
- 构建日期：2026-11-19
- 文件：`YuansuGIF-v1.3.4.apk`
- SHA-256：`6DB2C573F82110B6D7EE467D98F5D9745D109ADF8B62B27215291A1A7C46D83A`
- 大小：约 15.5 MB

修改：

- **不再调用系统播放器**。作品库视频改用应用内置的开源 **IjkPlayer**（Bilibili ijkplayer）。
- 使用 `TextureView` + 自定义控制条播放，支持播放/暂停、进度拖动、时间显示，不跳出应用。
- 自带 arm64-v8a、armeabi-v7a、x86_64 三套 native 库。
- 修复大文件/自定义 Range 导致的转圈和无法播放。
- 编辑页本地源视频继续在加载完成后静音自动播放，减少加载动画停留。
- 第三方组件许可证见 `THIRD_PARTY_NOTICES.md`。
