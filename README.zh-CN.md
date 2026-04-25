# Motor Sound Editor (MSE)

![Version](https://img.shields.io/badge/version-0.0.1-blue)
![Platform](https://img.shields.io/badge/platform-Windows-brightgreen)
![Tech Stack](https://img.shields.io/badge/stack-Vue3%20|%20Tauri%20|%20Rust-orange)

**Motor Sound Editor** 是一款专为 BVE 开发流程设计的专业电机音可视化编辑器。它将开发者从繁琐的 CSV 表格手工编辑中解放出来，提供了一套直观、高效的桌面端工作流，用于构建、预览、保存和导出高质量的列车电机音工程。

![编辑器界面](./website/public/editpage2.png)

---

## 🚀 核心价值

* **可视化曲线编辑**：通过直观的图表界面编辑基于速度的音调（Pitch）与音量（Volume）曲线，支持牵引与制动两套独立数据。
* **实时多轨预览**：内置实时音频渲染引擎，可在牵引、惰行、制动三种模拟状态下即时试听多轨叠加效果。
* **原生工程管理**：使用 `.msep` 格式打包所有素材与配置，确保工程的完整性与可移植性。
* **一键 BVE 导出**：自动生成 `vehicle.txt`、`motornoise.txt` 及相关 CSV 表格，并自动完成音频重采样与格式转换（OGG 转 WAV）。

