#!/bin/bash

# 备份 API 目录和相关文件到临时目录
mkdir -p /tmp/tauri-backup
mv app/api /tmp/tauri-backup/
mv app/manifest.ts /tmp/tauri-backup/
mv app/robots.ts /tmp/tauri-backup/
mv app/sitemap.ts /tmp/tauri-backup/
cp next.config.ts /tmp/tauri-backup/

# 使用 Tauri 配置并构建
cp next.config.tauri.ts next.config.ts
pnpm build

# 创建 index.html 重定向到默认语言
cp out/en.html out/index.html

# 恢复所有文件
mv /tmp/tauri-backup/api app/
mv /tmp/tauri-backup/manifest.ts app/
mv /tmp/tauri-backup/robots.ts app/
mv /tmp/tauri-backup/sitemap.ts app/
mv /tmp/tauri-backup/next.config.ts .
rm -rf /tmp/tauri-backup
