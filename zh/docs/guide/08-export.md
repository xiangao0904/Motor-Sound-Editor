---
title: 导出流程
description: 将电机音效工程导出为 BVE、OpenBVE 或 MTR 可用的文件包。
---

# 导出流程

在编辑器或首页项目菜单中打开 **Export Package**，选择格式和采样率，再选择 ZIP 文件保存位置。

## 导出哪些轨道

导出使用已启用、未静音且分配了音频的轨道。至少需要一条这样的轨道。隐藏状态只影响编辑器视图，不影响导出。

## 格式与文件

| 格式 | 压缩包中的主要文件 | 适用场景 |
| --- | --- | --- |
| BVE | `vehicle.txt`、`motornoise/motornoise.txt`、四张 CSV 曲线表、`sound/Sound.txt`、WAV | BVE 风格的电机音效数据包 |
| OpenBVE | `train.dat`、`sound.cfg`、`motor0.wav` 等 | OpenBVE 的 `train.dat` 电机音效表 |
| MTR | `sounds.json`、`sound.cfg`、四张 CSV 曲线表、OGG | MTR 音效资源包 |

OpenBVE 的 `train.dat` 包含 `#MOTOR_P1`、`#MOTOR_P2`、`#MOTOR_B1`、`#MOTOR_B2` 四组数据。每行对应 0.2 km/h，记录音频索引、音高和音量。`sound.cfg` 的 `[Motor]` 区段把索引连到 WAV 文件。[格式说明](https://openbve-project.net/documentation_hugo/en/trains/train_dat.html) · [音频配置说明](https://openbve-project.net/documentation_hugo/en/trains/sound_cfg.html)

OpenBVE 在牵引和制动状态下各能同时播放两路电机音。导出时，软件会按速度检查音量大于零的轨道；如果任一速度有三条或更多轨道同时发声，会提示对应速度，需先调整轨道音量或合并音源。轨道可以在不同速度区间轮换使用。OpenBVE 的音高值按工程播放倍率乘以 100，音量值按工程音量乘以 128 写出；OpenBVE 对音量的实际响度还会受车辆动力参数影响。

导出的 `train.dat` 含可解析的默认车辆参数。这些参数只是便于预览的起点；放入正式车辆前，请根据车辆数据检查加速度、制动、车厢和驾驶室等设置。若已有车辆文件，可将导出包中的四组 `#MOTOR_*` 数据及对应 `sound.cfg`、WAV 合并进现有车辆。

## 音频与采样率

可选 `22050`、`32000`、`44100`、`48000`、`96000 Hz`，默认 `44100 Hz`。BVE 和 OpenBVE 输出 WAV；源文件是 OGG 时会自动转换。MTR 输出 OGG，并可设置衰减距离 `16`、`32` 或 `64`。

保留 `.msep` 工程文件，后续修改曲线或音频时可直接继续编辑。
