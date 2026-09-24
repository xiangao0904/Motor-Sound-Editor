---
title: 针对开发者
description: 面向贡献者与代码阅读者的开发入口，帮助理解 Motor Sound Editor 的架构、数据流与实现边界。
---

# 针对开发者

应用把工程曲线编辑与音源处理分成两个页面。OpenBVE 导入在前端解析 `train.dat`；导出由 Rust 生成 ZIP 与音频文件。

如果你当前想了解实现路径，建议先从以下位置开始：

- `src/App.vue`：应用级流程与页面切换。
- `src/pages/HomePage.vue`：首页上的项目创建、打开与导入逻辑。
- `src/pages/EditorPage.vue`：编辑器工作区、列表编辑器与项目详情弹窗。
- `src/services/audioPreview.ts`：实时试听逻辑。
- `src/pages/AudioEditorPage.vue`、`src/pages/SpectralEditorPanel.vue`：循环、音高与频谱编辑。
- `src/services/projectImport.ts`：BVE、MTR、OpenBVE 外部工程导入。
- `src/services/projectExport.ts`、`src/services/nativeInterop.ts`、`src-tauri/src/native.rs`：导出校验、Tauri 调用与打包。
