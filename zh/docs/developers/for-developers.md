---
title: 针对开发者
description: 面向贡献者的实现入口说明。
---

# 针对开发者

本页仍在整理中。

如果你当前想了解实现路径，建议先从以下位置开始：

- `src/App.vue`：应用级流程与页面切换。
- `src/pages/HomePage.vue`：首页上的项目创建、打开与导入逻辑。
- `src/pages/EditorPage.vue`：编辑器工作区、列表编辑器与项目详情弹窗。
- `src/services/audioPreview.ts`：实时试听逻辑。
- `src/services/bveExport.ts` 与 `src-tauri/src/native.rs`：导出流程。
