---
title: 快速开始
description: Motor Sound Editor 用户首次使用指南。
---

# 快速开始

Motor Sound Editor 面向希望在可视化编辑器中创作分层电机音效的用户，而不是手工维护原始模拟器表格。当前版本重点覆盖桌面应用里已经落地的三类核心流程：项目创作、实时预览与导出打包。

![Motor Sound Editor 首页](/homepage.png)

## 1. 准备工作

### 操作系统要求

**Windows** 是目前软件的主要支持平台。

### 下载与安装

- **获取软件**：你可以直接通过[这个安装包链接](https://github.com/xiangao0904/Motor-Sound-Editor/releases/download/v1.0.0/Motor.Sound.Editor_1.0.0_x64-setup.exe)下载当前 Windows 安装程序。
- **快速安装**：下载完成后，运行安装程序即可。无需额外安装运行库，Tauri 所需组件已随应用打包。

### 示例文件

如果你想先拿现成的 `.msep` 工程熟悉编辑器，可以直接下载这些示例：

- [caf_train_sound.msep](https://github.com/xiangao0904/Motor-Sound-Editor/releases/download/v1.0.0/caf_train_sound.msep) — 贡献者：lx9702
- [class323.msep](https://github.com/xiangao0904/Motor-Sound-Editor/releases/download/v1.0.0/class323.msep) — 贡献者：K.L1

### 数据与素材

- **素材**：至少准备一段电机音源文件，支持 `.wav` 或 `.ogg`。
- **参数**：准备车辆的基础性能参数，例如最高时速、加速度和制动减速度。

## 2. 核心工作流

你可以通过以下 6 个步骤快速体验软件的核心功能：

### 第一步：创建项目

![新建文件](/docs/newproject.png)

1. 启动应用，在首页点击 **New Project**。
2. 输入项目名称，例如 `MyTrainMotor`。
3. 设定 **Max Speed** 和 **Acceleration** 等默认参数。
4. 确认后进入编辑器。

### 第二步：管理轨道并导入音频

![导入音频](/docs/importaudio.png)

1. 在 **Track Layers** 面板中，确保当前有一条激活轨道。
2. 在 **Track Details** 区域点击文件选择图标。
3. 选择 `.wav` 或 `.ogg` 音频文件。

### 第三步：绘制音高与音量曲线

![绘制曲线](/docs/trackline.png)

1. 在工具栏中切换到 **Keyframe** 模式。
2. 在图表中为 **Traction Pitch** 和 **Traction Volume** 添加关键帧，左键添加，右键删除。
3. 如需精细调整，可以切换到 **Move** 模式拖动关键帧，或在 **List Editor** 中直接输入数值。

### 第四步：实时预览

![实时预览](/docs/rt-preview.png)

1. 按下 `Space` 开始播放音频。
2. 使用 `W` 向牵引方向切换状态，使用 `S` 向制动方向切换状态。
3. 修改 **Current Speed**，或切换到 **Select** 模式后点击图表空白区域，快速调整试听速度。

### 第五步：保存项目

- 按下 `Ctrl+S` 将项目保存为 `.msep`。
- `.msep` 是软件的专属工程格式，会将项目设置、曲线数据和音频素材一起打包保存，便于移动与继续编辑。

### 第六步：导出 BVE 压缩包

![导出](/docs/output.png)

1. 点击工具栏或菜单中的 **Export**。
2. 在弹出的对话框中选择 **BVE**。
3. 选择采样率，通常推荐 `44100 Hz`。
4. 软件会生成一个 `.zip` 压缩包，其中包含 BVE 所需的 `vehicle.txt`、`motornoise.txt` 和转换后的 WAV 音频。

## 3. 常用快捷键

熟练使用快捷键可以明显提升编辑效率：

| 快捷键 | 功能 |
| :--- | :--- |
| **Space** | 播放 / 暂停预览 |
| **W** | 向牵引方向切换状态 |
| **S** | 向制动方向切换状态 |
| **Ctrl+S** | 保存项目 |
| **Ctrl+Z / Ctrl+Y** | 撤销 / 重做 |
| **Delete** | 删除选中的关键帧 |
