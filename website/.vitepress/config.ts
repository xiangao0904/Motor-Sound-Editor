import { defineConfig } from "vitepress";

const rootNav = [
  { text: "Product", link: "/" },
  { text: "Docs", link: "/docs/" },
  { text: "Download", link: "/download/" },
];

const zhNav = [
  { text: "产品", link: "/zh/" },
  { text: "文档", link: "/zh/docs/" },
  { text: "下载", link: "/zh/download/" },
];

const rootSidebar = [
  {
    text: "Getting Started",
    items: [
      { text: "Docs Home", link: "/docs/" },
      { text: "Quick Start", link: "/docs/guide/getting-started" },
    ],
  },
  {
    text: "Guides",
    items: [
      { text: "Home & Projects", link: "/docs/guide/home" },
      { text: "Editor & Track Layers", link: "/docs/guide/editor" },
      { text: "Export Workflow", link: "/docs/guide/export" },
      { text: "FAQ", link: "/docs/guide/faq" },
    ],
  },
];

const zhSidebar = [
  {
    text: "开始使用",
    items: [
      { text: "文档首页", link: "/zh/docs/" },
      { text: "快速开始", link: "/zh/docs/guide/getting-started" },
    ],
  },
  {
    text: "指南占位",
    items: [
      { text: "首页与工程", link: "/zh/docs/guide/home" },
      { text: "编辑器与轨道层", link: "/zh/docs/guide/editor" },
      { text: "导出到 BVE", link: "/zh/docs/guide/export" },
      { text: "常见问题", link: "/zh/docs/guide/faq" },
    ],
  },
];

export default defineConfig({
  title: "Motor Sound Editor",
  description:
    "A premium product site and docs hub for a desktop railway motor sound editor.",
  lang: "en-US",
  cleanUrls: true,
  lastUpdated: true,
  appearance: false,
  head: [
    ["meta", { name: "theme-color", content: "#0b0d10" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:title", content: "Motor Sound Editor" }],
    [
      "meta",
      {
        property: "og:description",
        content:
          "Build editable .msep projects, shape pitch and volume curves, preview layered motor sound in real time, and package projects through a clean native export workflow.",
      },
    ],
    ["link", { rel: "preconnect", href: "https://fonts.googleapis.com" }],
    [
      "link",
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossorigin: "",
      },
    ],
    [
      "link",
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Sora:wght@600;700;800&display=swap",
      },
    ],
  ],
  markdown: {
    theme: {
      light: "github-light",
      dark: "github-dark",
    },
  },
  locales: {
    root: {
      label: "English",
      lang: "en-US",
      title: "Motor Sound Editor",
      description:
        "Desktop railway motor sound editing, preview, and native export workflows.",
      themeConfig: {
        nav: rootNav,
        sidebar: {
          "/docs/": rootSidebar,
        },
        search: {
          provider: "local",
        },
        outline: {
          label: "On This Page",
          level: [2, 3],
        },
        docFooter: {
          prev: "Previous page",
          next: "Next page",
        },
        sidebarMenuLabel: "Menu",
        returnToTopLabel: "Back to top",
        lastUpdatedText: "Last updated",
        footer: {
          message:
            "Windows-first desktop editor · Current source version v0.0.1",
          copyright:
            "Motor Sound Editor website built with VitePress.",
        },
      },
    },
    zh: {
      label: "简体中文",
      lang: "zh-CN",
      link: "/zh/",
      title: "Motor Sound Editor",
      description: "简体中文站点结构已预留，后续将补充完整翻译内容。",
      themeConfig: {
        nav: zhNav,
        sidebar: {
          "/zh/docs/": zhSidebar,
        },
        search: {
          provider: "local",
        },
        outline: {
          label: "本页内容",
          level: [2, 3],
        },
        docFooter: {
          prev: "上一页",
          next: "下一页",
        },
        sidebarMenuLabel: "菜单",
        returnToTopLabel: "返回顶部",
        lastUpdatedText: "最后更新",
        footer: {
          message: "简体中文内容预留中 · 当前优先维护英文主站",
          copyright:
            "Motor Sound Editor bilingual structure reserved for future translation.",
        },
      },
    },
  },
});
