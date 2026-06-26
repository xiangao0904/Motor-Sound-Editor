# Motor Sound Editor (MSE)

![Version](https://img.shields.io/github/v/release/xiangao0904/Motor-Sound-Editor?label=version&style=flat-square&color=0078d4&logo=github)
![Platform](https://img.shields.io/badge/platform-Windows-brightgreen)
![Tech Stack](https://img.shields.io/badge/stack-Vue3%20|%20Tauri%20|%20Rust-orange)

**Motor Sound Editor** 是一款面向 BVE 风格列车电机音制作的桌面编辑器。它把原本需要手写 CSV 的工作变成可视化曲线编辑，并提供多轨实时预览、`.msep` 工程打包和一键导出。

![EditorPage](./public/editpage2.png)

## 核心功能

- **可视化曲线编辑**：编辑牵引和制动状态下，随速度变化的音高与音量曲线。
- **多轨实时预览**：在牵引、惰行、制动状态间切换，直接试听多轨叠加效果。
- **便携工程格式**：使用 `.msep` 打包曲线、轨道和音频素材，移动工程时不丢资源。
- **BVE 导出**：生成 `vehicle.txt`、`motornoise.txt`、CSV 曲线表和 WAV 音频。
- **MTR 导出**：生成 MTR 可用的声音文件、`sound.cfg`、CSV 曲线表和 `sounds.json`。
- **Windows 集成**：支持单实例运行和 `.msep` 文件关联。

## 开发

### 环境要求

- Node.js
- pnpm
- Rust 工具链
- Windows 平台所需的 Tauri 构建依赖

### 常用命令

```bash
pnpm install
pnpm tauri dev
pnpm build
pnpm tauri build
```

## 工程格式

`.msep` 是基于 zip 的工程归档格式，内部包含工程信息、轨道和曲线数据，以及打包后的音频素材。这样工程可以在不同电脑之间移动，不需要重新整理音频引用。

## 许可证

本项目使用 MIT License。
