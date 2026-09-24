# Motor Sound Editor (MSE)

![Version](https://img.shields.io/github/v/release/xiangao0904/Motor-Sound-Editor?label=version&style=flat-square&color=0078d4&logo=github)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-brightgreen)
![Tech Stack](https://img.shields.io/badge/stack-Vue3%20|%20Tauri%20|%20Rust-orange)

**Motor Sound Editor** 是一款面向 BVE 风格列车电机音制作的桌面编辑器。它把原本需要手写 CSV 的工作变成可视化曲线编辑，并提供多轨实时预览、`.msep` 工程打包和一键导出。

![EditorPage](./public/editpage2.png)

## 核心功能

- **可视化曲线编辑**：编辑牵引和制动状态下，随速度变化的音高与音量曲线。
- **多轨实时预览**：在牵引、惰行、制动状态间切换，直接试听多轨叠加效果。
- **便携工程格式**：使用 `.msep` 打包曲线、轨道和音频素材，移动工程时不丢资源。
- **BVE 导出**：生成 `vehicle.txt`、`motornoise.txt`、CSV 曲线表和 WAV 音频。
- **MTR 导出**：生成 MTR 可用的声音文件、`sound.cfg`、CSV 曲线表和 `sounds.json`。
- **桌面系统集成**：在 Windows 和 macOS 上支持单实例运行与 `.msep` 文件关联。

## 下载与安装

请从 [Releases](https://github.com/xiangao0904/Motor-Sound-Editor/releases) 页面下载对应平台的安装包。macOS Universal 安装包同时支持 Apple Silicon 和 Intel Mac。打开 DMG 后，将 **Motor Sound Editor** 拖入“应用程序”文件夹即可。

### macOS 安全提示

当前 macOS 安装包使用 ad-hoc 签名，没有 Apple Developer ID 签名，也没有经过 Apple 公证。macOS 因此可能提示“无法验证开发者”或“应用已损坏”。

请先确认安装包来自本仓库的官方 Releases 页面。首次打开被阻止后，可以前往“系统设置 → 隐私与安全性”，点击“仍要打开”。如果系统仍然阻止运行，可在终端执行：

```bash
xattr -dr com.apple.quarantine "/Applications/Motor Sound Editor.app"
open "/Applications/Motor Sound Editor.app"
```

这条命令只会移除该应用的下载隔离属性，不会关闭系统的 Gatekeeper。

## 开发

### 环境要求

- Node.js
- pnpm
- Rust 工具链
- 目标平台所需的 Tauri 构建依赖

### 常用命令

```bash
pnpm install
pnpm tauri dev
pnpm build
pnpm tauri build
```

可以在 GitHub Actions 中手动运行 `Build macOS` 工作流。推送 `v1.2.1` 这类版本标签时，工作流还会构建 Universal DMG 和 ZIP，并将文件附加到对应的 GitHub Release。

## 工程格式

`.msep` 是基于 zip 的工程归档格式，内部包含工程信息、轨道和曲线数据，以及打包后的音频素材。这样工程可以在不同电脑之间移动，不需要重新整理音频引用。

## 许可证

本项目使用 MIT License。
