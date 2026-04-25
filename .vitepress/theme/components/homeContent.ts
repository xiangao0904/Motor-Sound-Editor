export type HomeLocale = "en" | "zh";

export interface HomeContent {
  navAriaLabel: string;
  sectionLinksAriaLabel: string;
  homeAriaLabel: string;
  languageSwitchLabel: string;
  languageSwitchHref: string;
  languageSwitchAriaLabel: string;
  navItems: Array<{ label: string; href: string }>;
  docsHref: string;
  downloadHref: string;
  downloadLabel: string;
  docsLabel: string;
  githubLabel: string;
  versionLabel: string;
  brandSubline: string;
  frameContext: string;
  showcaseAriaLabel: string;
  hero: {
    kicker: string;
    titleLines: string[];
    lead: string;
    primaryAction: string;
    secondaryAction: string;
    stats: Array<{ value: string; label: string }>;
    floatingLeft: { eyebrow: string; value: string; label: string };
    floatingRight: { eyebrow: string; value: string; label: string };
  };
  why: {
    kicker: string;
    title: string;
    titleLines?: string[];
    lead: string;
    cards: Array<{
      eyebrow: string;
      title: string;
      copy: string;
      tone: "legacy" | "modern";
      bullets: string[];
    }>;
  };
  features: {
    kicker: string;
    title: string;
    titleLines?: string[];
    lead: string;
    items: Array<{ icon: string; title: string; copy: string }>;
  };
  showcase: {
    kicker: string;
    title: string;
    titleLines?: string[];
    lead: string;
    cards: Array<{ label: string; title: string; copy: string; src: string; alt: string }>;
  };
  workflow: {
    kicker: string;
    title: string;
    titleLines?: string[];
    lead: string;
    steps: Array<{ number: string; title: string; copy: string; src: string; label: string }>;
  };
  foundation: {
    kicker: string;
    title: string;
    titleLines?: string[];
    lead: string;
    items: Array<{ title: string; copy: string }>;
    format: {
      badge: string;
      eyebrow: string;
      title: string;
      copy: string;
      map: string[];
    };
  };
  docs: {
    kicker: string;
    title: string;
    titleLines?: string[];
    lead: string;
    action: string;
    cards: Array<{ title: string; copy: string; href: string; cta: string }>;
  };
  finalCta: {
    kicker: string;
    title: string;
    titleLines?: string[];
    copy: string;
    primaryAction: string;
    secondaryAction: string;
  };
}

const installerUrl =
  "https://github.com/xiangao0904/Motor-Sound-Editor/releases/download/v1.0.0/Motor.Sound.Editor_1.0.0_x64-setup.exe";
const featureIcons = {
  curve: "M4 18C7.5 8.8 10.5 20 14 11.5C16 6.5 18.5 5.6 21 7.2M5 18h16M4 4.5v15",
  preview: "M4 12h3l2.2-5 4.6 11 3-7H21M5 20h14M5 4h14",
  native: "M13 2 4.5 13h7L9 22l10.5-13h-7L13 2Z",
  export: "M12 3v12m0 0 5-5m-5 5-5-5M4 20h16M6 6h4M14 6h4",
} as const;

export const homeContent: Record<HomeLocale, HomeContent> = {
  en: {
    navAriaLabel: "Main navigation",
    sectionLinksAriaLabel: "Page sections",
    homeAriaLabel: "Motor Sound Editor Home",
    languageSwitchLabel: "中文",
    languageSwitchHref: "/zh/",
    languageSwitchAriaLabel: "Switch to Simplified Chinese",
    navItems: [
      { label: "Why", href: "#why" },
      { label: "Features", href: "#features" },
      { label: "Interface", href: "#showcase" },
      { label: "Workflow", href: "#workflow" },
      { label: "Docs", href: "#docs" },
    ],
    docsHref: "/docs/",
    downloadHref: installerUrl,
    downloadLabel: "Download",
    docsLabel: "Documentation",
    githubLabel: "GitHub",
    versionLabel: "Latest release",
    brandSubline: "Professional Sound Authoring Suite",
    frameContext: "Workspace",
    showcaseAriaLabel: "Software interface preview",
    hero: {
      kicker: "Visual Workflow for BVE Motor Sound Design",
      titleLines: ["Design BVE", "motor sounds with", "visual precision."],
      lead: "A dedicated desktop environment for BVE motor sound creation. Map pitch and volume to speed through an intuitive curve editor and validate results with real-time feedback.",
      primaryAction: "Download for Windows",
      secondaryAction: "Read the Docs",
      stats: [
        { value: "Live", label: "multi-state preview" },
        { value: ".msep", label: "unified project format" },
        { value: "Rust", label: "high-performance core" },
      ],
      floatingLeft: { eyebrow: "Speed", value: "85 km/h", label: "Real-time" },
      floatingRight: { eyebrow: "State", value: "Coast", label: "Synchronized" },
    },
    why: {
      kicker: "The Problem",
      title: "Less time in spreadsheets, more time on sound design.",
      titleLines: ["Less time in", "spreadsheets.", "More time on", "sound design."],
      lead: "BVE motor sound production shouldn't be a tedious process of manual CSV editing and repeated trial-and-error testing.",
      cards: [
        {
          eyebrow: "Legacy Method",
          title: "Fragmented tools and slow feedback loops.",
          copy: "Editing raw CSV tables and managing scattered audio assets makes even small adjustments time-consuming and prone to errors.",
          tone: "legacy",
          bullets: ["Manual table entry", "Disconnected assets", "In-game testing required"],
        },
        {
          eyebrow: "The Editor",
          title: "A unified, visual workspace for sound modders.",
          copy: "Define behavior through speed-based curves, switch train states instantly, and hear the results immediately within the editor.",
          tone: "modern",
          bullets: ["Visual curve mapping", "Instant state switching", "Integrated export flow"],
        },
      ],
    },
    features: {
      kicker: "Core Features",
      title: "Tools built for professional simulator standards.",
      titleLines: ["Tools built for", "professional", "simulator standards."],
      lead: "Every feature is designed to streamline the transition from raw samples to a functional BVE sound package.",
      items: [
        {
          icon: featureIcons.curve,
          title: "Visual Curve Editor",
          copy: "Directly manipulate pitch and volume keyframes on a speed-based graph. No more manual coordinate entry.",
        },
        {
          icon: featureIcons.preview,
          title: "Multi-State Preview",
          copy: "Audit Traction, Coast, and Brake states seamlessly. Test how layers blend as you adjust the speed slider.",
        },
        {
          icon: featureIcons.native,
          title: "Native Performance",
          copy: "Powered by Rust and Tauri for a responsive, lightweight experience that handles complex projects with ease.",
        },
        {
          icon: featureIcons.export,
          title: "Automated Export",
          copy: "Generate standardized BVE-ready files with one click, ensuring consistent project structure and asset naming.",
        },
      ],
    },
    showcase: {
      kicker: "Interface",
      title: "An interface designed for clarity and focus.",
      titleLines: ["An interface", "designed for", "clarity and focus."],
      lead: "From project management to detailed curve editing, the workspace is optimized for the motor sound authoring workflow.",
      cards: [
        {
          label: "Project Gallery",
          title: "Centralized Management",
          copy: "Quickly access recent projects, manage metadata, and keep your workspace organized.",
          src: "/homepage.png",
          alt: "Project gallery view",
        },
        {
          label: "Editor Workspace",
          title: "Precise Control",
          copy: "Toggle between states, manage track layers, and refine curves in a single, cohesive view.",
          src: "/editpage.png",
          alt: "Editor workspace view",
        },
      ],
    },
    workflow: {
      kicker: "Workflow",
      title: "From raw audio to final package.",
      titleLines: ["From raw audio", "to final package."],
      lead: "A structured process that keeps you focused on the creative aspects of sound design.",
      steps: [
        {
          number: "01",
          title: "Initialize Project",
          copy: "Set up your workspace and import source audio into a structured .msep project container.",
          src: "/createfile.mp4",
          label: "Project setup",
        },
        {
          number: "02",
          title: "Map Behavior",
          copy: "Draw keyframes to define how sounds respond to speed changes across different drive states.",
          src: "/sculpt.mp4",
          label: "Curve editing",
        },
        {
          number: "03",
          title: "Validate Live",
          copy: "Use the internal transport controls to simulate train behavior and audit sound transitions.",
          src: "/validate.mp4",
          label: "Live preview",
        },
        {
          number: "04",
          title: "Package & Export",
          copy: "Export a fully formatted BVE motor sound set ready for immediate use in the simulator.",
          src: "/export.mp4",
          label: "Final export",
        },
      ],
    },
    foundation: {
      kicker: "Architecture",
      title: "A reliable foundation for project integrity.",
      titleLines: ["A reliable", "foundation for", "project integrity."],
      lead: "Combining high-performance native code with a portable project format designed for long-term maintenance.",
      items: [
        {
          title: "Visual-First Design",
          copy: "Replaces text-based configuration with intuitive graphical editing.",
        },
        {
          title: "Unified Project Format",
          copy: "The .msep container bundles data, curves, and audio to prevent broken file links.",
        },
        {
          title: "Desktop Optimized",
          copy: "A fast, native application built for stability and precision.",
        },
      ],
      format: {
        badge: ".msep",
        eyebrow: "Container Format",
        title: "All project assets in one place.",
        copy: "The .msep format ensures that curves, track settings, and audio files stay synchronized, making sharing and archiving effortless.",
        map: ["Metadata", "Curve Data", "Track Layers", "Audio Assets", "Build Config"],
      },
    },
    docs: {
      kicker: "Resources",
      title: "Comprehensive technical documentation.",
      titleLines: ["Comprehensive", "technical", "documentation."],
      lead: "Everything you need to master the motor sound authoring workflow, from setup to advanced export configurations.",
      action: "Open Docs",
      cards: [
        {
          title: "Getting Started",
          copy: "Installation guide and a walkthrough of your first motor sound project.",
          href: "/docs/guide/getting-started",
          cta: "Read Guide",
        },
        {
          title: "Editor Guide",
          copy: "In-depth explanation of curve editing, track layering, and state management.",
          href: "/docs/guide/editor",
          cta: "Read Guide",
        },
        {
          title: "Export Pipeline",
          copy: "Technical details on project packaging and BVE compatibility.",
          href: "/docs/guide/export",
          cta: "Read Guide",
        },
      ],
    },
    finalCta: {
      kicker: "Get Started",
      title: "Modernize your BVE sound design workflow today.",
      titleLines: ["Modernize your", "BVE sound design", "workflow today."],
      copy: "Download the latest release for Windows or explore the documentation to learn more.",
      primaryAction: "Download for Windows",
      secondaryAction: "Documentation",
    },
  },
  zh: {
    navAriaLabel: "主导航",
    sectionLinksAriaLabel: "页面章节",
    homeAriaLabel: "Motor Sound Editor 首页",
    languageSwitchLabel: "EN",
    languageSwitchHref: "/",
    languageSwitchAriaLabel: "切换到英文版",
    navItems: [
      { label: "定位", href: "#why" },
      { label: "功能特性", href: "#features" },
      { label: "界面展示", href: "#showcase" },
      { label: "工作流", href: "#workflow" },
      { label: "文档", href: "#docs" },
    ],
    docsHref: "/zh/docs/",
    downloadHref: installerUrl,
    downloadLabel: "下载",
    docsLabel: "技术文档",
    githubLabel: "GitHub",
    versionLabel: "最新版本",
    brandSubline: "专业音效创作套件",
    frameContext: "工作区预览",
    showcaseAriaLabel: "软件界面预览",
    hero: {
      kicker: "BVE 电机音效可视化创作工作流",
      titleLines: ["以直观的", "可视化方式", "设计 BVE 电机音效。"],
      lead: "专为 BVE 电机音效开发的桌面编辑器。通过可视化曲线编辑音高与音量随速度的变化，并借助实时反馈验证创作效果。",
      primaryAction: "下载 Windows 版",
      secondaryAction: "查阅文档",
      stats: [
        { value: "实时", label: "多状态预览" },
        { value: ".msep", label: "统一项目格式" },
        { value: "Rust", label: "高性能原生核心" },
      ],
      floatingLeft: { eyebrow: "当前速度", value: "85 km/h", label: "实时模拟" },
      floatingRight: { eyebrow: "运行状态", value: "惰行", label: "同步预览" },
    },
    why: {
      kicker: "核心价值",
      title: "摆脱表格，回归音效设计本身。",
      titleLines: ["摆脱表格。", "回归音效设计", "本身。"],
      lead: "BVE 电机音效制作不应是繁琐的 CSV 手工编辑与反复的进游戏测试流程。",
      cards: [
        {
          eyebrow: "传统方式",
          title: "工具链破碎，反馈循环缓慢。",
          copy: "手工维护 CSV 数据表和分散的音频文件既耗时又容易出错，即使是微调也需要极高的操作成本。",
          tone: "legacy",
          bullets: ["手工输入数据", "资源管理混乱", "依赖外部验证"],
        },
        {
          eyebrow: "使用编辑器",
          title: "统一的可视化创作空间。",
          copy: "在编辑器内直接定义音效行为，快速切换列车状态并即时听到调整后的结果。",
          tone: "modern",
          bullets: ["可视化曲线映射", "即时状态切换", "集成化导出"],
        },
      ],
    },
    features: {
      kicker: "功能特性",
      title: "符合专业模拟标准的生产力工具。",
      titleLines: ["符合专业", "模拟标准的", "生产力工具。"],
      lead: "每一项功能都旨在简化从原始素材到 BVE 音效包的转化过程。",
      items: [
        {
          icon: featureIcons.curve,
          title: "可视化曲线编辑器",
          copy: "在坐标图中直接操作关键帧，精调音高与音量曲线。不再需要手工填写坐标数据。",
        },
        {
          icon: featureIcons.preview,
          title: "多状态实时预览",
          copy: "无缝试听牵引、惰行与制动状态。在调节速度滑块的同时观察音层混合效果。",
        },
        {
          icon: featureIcons.native,
          title: "原生性能表现",
          copy: "基于 Rust 和 Tauri 构建，提供极致响应且轻量化的桌面体验，轻松应对大型复杂项目。",
        },
        {
          icon: featureIcons.export,
          title: "自动化导出流",
          copy: "一键生成符合 BVE 标准的音效包，确保项目结构、配置文件与资源命名的规范性。",
        },
      ],
    },
    showcase: {
      kicker: "界面展示",
      title: "为专注创作而优化的交互设计。",
      titleLines: ["为专注创作", "而优化的", "交互设计。"],
      lead: "从项目管理到细节化的曲线调校，工作区布局均针对音效创作流程进行了深度优化。",
      cards: [
        {
          label: "项目画廊",
          title: "集中化管理",
          copy: "快速访问近期项目，管理元数据，让您的创作空间保持井然有序。",
          src: "/homepage.png",
          alt: "项目画廊视图",
        },
        {
          label: "编辑器工作区",
          title: "精准控制",
          copy: "在统一视图中切换状态、管理音轨图层并精细化调整曲线参数。",
          src: "/editpage.png",
          alt: "编辑器工作区视图",
        },
      ],
    },
    workflow: {
      kicker: "工作流",
      title: "从素材到成品的全流程覆盖。",
      titleLines: ["从素材到成品的", "全流程覆盖。"],
      lead: "结构化的制作流程，让您能够全身心投入到声音设计的创意环节中。",
      steps: [
        {
          number: "01",
          title: "初始化项目",
          copy: "建立工作区并将源音频导入结构化的 .msep 项目容器中。",
          src: "/createfile.mp4",
          label: "项目初始化",
        },
        {
          number: "02",
          title: "行为映射",
          copy: "通过绘制关键帧，定义音效在不同运行状态下随速度变化的响应逻辑。",
          src: "/sculpt.mp4",
          label: "曲线编辑",
        },
        {
          number: "03",
          title: "实时验证",
          copy: "利用内置的传输控制模拟列车运行，即时审计声音过渡效果。",
          src: "/validate.mp4",
          label: "实时预览",
        },
        {
          number: "04",
          title: "封装与导出",
          copy: "导出完整格式化的 BVE 电机音效包，可直接用于模拟器。 ",
          src: "/export.mp4",
          label: "项目导出",
        },
      ],
    },
    foundation: {
      kicker: "技术架构",
      title: "稳固的项目管理基础。",
      titleLines: ["稳固的", "项目管理基础。"],
      lead: "高性能原生引擎结合可移植项目格式，为长效的项目维护提供保障。",
      items: [
        {
          title: "可视化导向",
          copy: "以图形化编辑取代文本配置，提升创作效率与直观度。",
        },
        {
          title: "统一项目格式",
          copy: ".msep 容器整合了数据与音频，有效规避资源链接断裂问题。",
        },
        {
          title: "桌面端优化",
          copy: "专为稳定性与精度打造的原生应用，响应迅速且稳定。",
        },
      ],
      format: {
        badge: ".msep",
        eyebrow: "容器格式",
        title: "项目资源，一站整合。",
        copy: ".msep 格式确保了曲线、音轨设置与音频文件的同步，让分享与归档变得轻松简单。",
        map: ["元数据", "曲线数据", "音轨图层", "音频资源", "构建配置"],
      },
    },
    docs: {
      kicker: "相关资源",
      title: "详尽的技术文档支持。",
      titleLines: ["详尽的", "技术文档支持。"],
      lead: "从环境搭建到高级导出配置，提供全方位的电机音效制作指南。",
      action: "打开文档",
      cards: [
        {
          title: "快速入门",
          copy: "安装指南及首个电机音效项目的新手引导。",
          href: "/zh/docs/guide/getting-started",
          cta: "阅读指南",
        },
        {
          title: "编辑器指南",
          copy: "深度解析曲线编辑、音轨分层及状态管理等核心功能。",
          href: "/zh/docs/guide/editor",
          cta: "阅读指南",
        },
        {
          title: "导出管线",
          copy: "关于项目封装规范及 BVE 兼容性的技术细节说明。",
          href: "/zh/docs/guide/export",
          cta: "阅读指南",
        },
      ],
    },
    finalCta: {
      kicker: "立即开始",
      title: "为您的 BVE 音效创作引入现代化工作流。",
      titleLines: ["为您的 BVE", "音效创作引入", "现代化工作流。"],
      copy: "下载 Windows 最新版本，或查阅文档以了解更多信息。",
      primaryAction: "下载 Windows 版",
      secondaryAction: "查看文档",
    },
  },
};
