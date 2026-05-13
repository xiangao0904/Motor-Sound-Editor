---
title: 背景故事
description: 阅读 Motor Sound Editor 的开发历程，了解它如何从早期原型成长为现代化的 BVE 列车音效编辑器。
---
# 这个软件是怎么折腾出来的

既然软件终于做出来并上线了，我想在文档的最后简单聊聊它背后的开发故事。这不算什么正经的技术分享，更多是我个人的一点碎碎念，记录一下这个小工具是怎么从一个想法变成现实的。

最早接触 RealTrainMod 的时候，我用过 RTM Sound Maker，第一次觉得不用手写 JavaScript 就能做出 VVVF 音效(RTM 的电机音需要写js)，是一种挺痛快的体验。后来还玩过一段时间的 OpenBVE 和 HMMSIM，也接触过 ZBX 的电机音编辑器。

等到 NTE 出现，我开始尝试了 MTR，在制作我的 Ocean Cruiser 时，当时想给它做一个 BVE 格式的电机音。但当时并没有什么现成的可视化工具能直接原生导出这种格式。我只能在 Excel 里手写 CSV，再导进 Motornoise Audition 去预览。每次改完都得重复这一整套繁琐的流程，实在是有些许折磨人。也就是那个时候，我动了念头，想自己做一个能拉曲线、调参数的图形工具。


第一次真的动手是 2024 年 4 月底，先画了几张简单的 UI 草图，打算用 C# 的 WPF 把东西搭起来。但写了一阵之后，WPF 的种种限制让我觉得处处别扭，那个版本很快就被我搁下了。

![早期的 UI 设计草图](/docs/earlyui.png)
<p style="text-align:center">早期的 UI 设计稿</p>

![WPF版本](/docs/wpf.png)
<p style="text-align:center">WPF版本</p>

到 2025 年 1 月，我又把这个想法捡起来，这次换成了 Avalonia UI。它用起来比 WPF 顺手不少，类 CSS 的样式系统和数据绑定也都更对我胃口。

![Avalonia UI 版本的开发画面](/docs/ava.png)
<p style="text-align:center">Avalonia UI 版本的开发画面</p>


可写着写着，新问题又来了。界面虽然更灵活了，但整个 .NET 和 C# 那套开发模式——比如 MVVM——放在我这种小工具上，始终有种用牛刀杀鸡的笨重感。开发效率一直上不去，填坑的过程越变越累。好不容易拖到后来，连打开项目的动力都没了，这个东西就这么再一次被搁置了（相关代码存放在旧仓库的 [`BVE5-Motor-Assistance`](https://github.com/xiangao0904/BVE5-Motor-Assistance)）。



直到后来，我看到了 Tauri，才有了重新把这个坑填完的念头。

Tauri 最吸引我的一点是，它可以直接用前端的技术来写界面。前端的生态发达程度不用多说，各种现成的组件库用起来非常方便。前端生态有多丰富不用多说，各种组件库拿过来就能用，而 Tauri 又不像 Electron 那样带一整个 Chromium，它调用系统原生的 WebView，最终打出来的包只有十几 MB，运行效率也相当不错。于是我又把项目从头捡了起来。


这回我也重置了之前旧版 UI，重新画了一套看着更舒服的界面。这次前端用的是 Vue，后端接上 Rust，整体开发体验比之前好了不止一点。

![新版 UI 的设计图或重构过程中的截图](/docs/newui.png)
<p style="text-align:center">新版 UI 的设计草图</p>

另外还得提一嘴现在 AI Coding Agent 的发达。有了 AI 的辅助，以前那些让我觉得头疼、实现起来很麻烦的逻辑，现在都能很顺畅地解决。可以说，如果没有现在这么强大的 Coding Agent，这个项目这次大抵还是做不出来的。

![Motor Sound Editor v0.0.1 最终界面](/editpage.png)
<p style="text-align:center">软件v0.0.1</p>

做这个工具的初衷只是想让自己做音效时少受点罪，现在它终于完成了。如果你也和我一样，曾经被手搓 CSV 折磨过，希望这个小工具能帮你省下一些时间。另外，如果你平时也喜欢自己写点跨平台的小软件，Tauri 确实值得认真试一试。
