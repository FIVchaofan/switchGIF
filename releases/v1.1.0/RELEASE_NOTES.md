# v1.1.0

- 版本：1.1.0（versionCode 2）
- 构建日期：2026-11-18
- 文件：`YuansuGIF-v1.1.0.apk`
- SHA-256：`E935629FA3BFEC00E5D3C9E33B3781F713FFA5C618B9D9694D5A8E6ED4772E15`

在 1.0.0 基础上：

- 新增私密作品库：转换完成自动保存，不再写入相册。
- 作品库支持预览、重命名、分享、删除。
- 分享使用只读 ContentProvider，仅临时授权单张 GIF。
- 无 INTERNET、相册读取、存储权限。
- 作品保存在应用内部 `filesDir/gifs`，卸载应用会删除。
