# v1.3.2

- 版本：1.3.2（versionCode 6）
- 构建日期：2026-11-19
- 文件：`YuansuGIF-v1.3.2.apk`
- SHA-256：`F3306003F917205424945E99F0B74DF0DBF41F12C35C3049D16656CDD69CA195`

功能修改：

- 转 GIF 选择视频时改用系统照片选择器（Android 13+ `ACTION_PICK_IMAGES`），只显示视频。
- 作品库导入改为照片选择器：
  - 「照片 / GIF」：只显示图片，包含 JPG、PNG、WebP、GIF；
  - 「视频」：只显示视频，包含 MP4、MOV、WebM 等。
- Android 10–12 回退到系统相册选择器，不再使用 `ACTION_OPEN_DOCUMENT` 文件选择器。
- 保留 v1.3.1 的私密多媒体库、搜索、文件夹、视频预览、保存到手机、分享原格式和大小预估修正。
