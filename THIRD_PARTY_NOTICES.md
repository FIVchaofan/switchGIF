# 第三方开源组件

本项目内置以下开源视频播放组件，没有调用系统播放器应用。

## IjkPlayer

- 项目：Bilibili ijkplayer
- 源码：https://github.com/bilibili/ijkplayer
- 版本：0.8.8
- 使用模块：
  - `ijkplayer-java`（Java API）
  - `ijkplayer-arm64`、`ijkplayer-armv7a`、`ijkplayer-x86_64`（native 库）
- 许可证：LGPL-2.1 / GPL-2.0（以 ijkplayer 项目发布说明为准）
- 版权：Copyright (c) 2015 Bilibili

本项目将 IjkPlayer 作为独立的 Java/native 组件打包，未修改其源码。IjkPlayer 的完整源码和许可证可从上面的项目地址获取。

## AndroidX / FFmpeg.wasm

- FFmpeg.wasm：https://github.com/ffmpegwasm/ffmpeg.wasm
- 许可证：MIT
- 仅用于 GIF 编码，运行在 WebView 的 WASM 沙箱内。
