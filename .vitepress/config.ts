import { defineConfig } from "vitepress";
import fs from "node:fs";
import path from "node:path";

// --- 1. 自动化核心逻辑 ---

const sectionMap: Record<string, { en: string; zh: string }> = {
  guide: { en: "Manual", zh: "使用手册" },
  tutorials: { en: "Tutorials", zh: "教程" },
  developers: { en: "For Developers", zh: "针对开发者" },
  miscellaneous: { en: "Miscellaneous", zh: "杂项" },
};

/**
 * 提取数字前缀用于排序 (例如 "01-intro.md" -> 1)
 */
function getOrder(fileName: string): number {
  const match = fileName.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 999;
}

/**
 * 去掉文件名开头的数字前缀 (例如 "01-intro.md" -> "intro.md")
 */
function stripNumberPrefix(fileName: string): string {
  return fileName.replace(/^\d+-/, "");
}

/**
 * 提取 Markdown 的 title
 */
function getFileTitle(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const match = content.match(/^title:\s*(.*)$/m);
    if (match && match[1]) {
      const title = match[1].trim().replace(/^["']|["']$/g, "");
      return title.length > 0 ? title : null;
    }
  } catch (e) {
    console.error(`读取标题失败: ${filePath}`);
  }
  return null;
}

/**
 * 动态生成 Rewrites 映射表
 */
function generateRewrites() {
  const rewrites: Record<string, string> = {};
  const zhDocsRootDir = path.resolve(process.cwd(), "./zh/docs");

  Object.keys(sectionMap).forEach((folder) => {
    const zhFolderPath = path.join(zhDocsRootDir, folder);
    if (!fs.existsSync(zhFolderPath)) return;

    const files = fs.readdirSync(zhFolderPath).filter((f) => f.endsWith(".md"));
    files.forEach((file) => {
      const stripped = stripNumberPrefix(file);
      if (file !== stripped) {
        rewrites[`zh/docs/${folder}/${file}`] = `zh/docs/${folder}/${stripped}`;
      }
    });
  });
  return rewrites;
}

/**
 * 自动生成侧边栏
 */
function generateSyncedSidebar(lang: "en" | "zh") {
  const zhDocsRootDir = path.resolve(process.cwd(), "./zh/docs");
  if (!fs.existsSync(zhDocsRootDir)) return [];

  return Object.keys(sectionMap)
    .map((folder) => {
      const zhFolderPath = path.join(zhDocsRootDir, folder);
      if (!fs.existsSync(zhFolderPath)) return null;

      const zhFiles = fs
        .readdirSync(zhFolderPath)
        .filter((f) => f.endsWith(".md") && f.toLowerCase() !== "index.md")
        .sort((a, b) => getOrder(a) - getOrder(b));

      const items = zhFiles
        .map((file) => {
          const zhFileNameBase = file.replace(".md", "");
          const cleanNameBase = stripNumberPrefix(zhFileNameBase);

          let targetFilePath: string;
          let link: string;

          if (lang === "zh") {
            targetFilePath = path.resolve(process.cwd(), `./zh/docs/${folder}/${file}`);
            link = `/zh/docs/${folder}/${cleanNameBase}`;
          } else {
            targetFilePath = path.resolve(process.cwd(), `./docs/${folder}/${cleanNameBase}.md`);
            link = `/docs/${folder}/${cleanNameBase}`;
          }

          const title = getFileTitle(targetFilePath);
          if (!title) return null;

          return { text: title, link: encodeURI(link) };
        })
        .filter((item): item is { text: string; link: string } => item !== null);

      if (items.length === 0) return null;

      return {
        text: lang === "zh" ? sectionMap[folder].zh : sectionMap[folder].en,
        items: items,
        collapsed: false,
      };
    })
    .filter((section) => section !== null);
}

// --- 2. 基础配置 ---

const githubPagesBase = "/Motor-Sound-Editor/";
const siteBase = process.env.GITHUB_ACTIONS ? githubPagesBase : "/";
const withSiteBase = (p: string) => (p.startsWith("/") ? `${siteBase}${p.slice(1)}` : p);

const installerUrl = "https://github.com/xiangao0904/Motor-Sound-Editor/releases/download/v1.0.0/Motor.Sound.Editor_1.0.0_x64-setup.exe";

export default defineConfig({
  base: siteBase,
  lang: "en-US",
  title: "Motor Sound Editor",
  description: "Official product site and user documentation.",
  
  rewrites: generateRewrites(),

  head: [
    ["link", { rel: "icon", href: withSiteBase("/64x64.png"), type: "image/png" }],
    ["link", { rel: "preconnect", href: "https://fonts.googleapis.com" }],
    ["link", { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" }],
    [
      "link",
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap",
      },
    ],
  ],
  appearance: false,
  themeConfig: {
    logo: "64x64.png",
    socialLinks: [{ icon: "github", link: "https://github.com/xiangao0904/Motor-Sound-Editor" }],

    // --- 新增：本地搜索配置 ---
    search: {
      provider: 'local',
      options: {
        locales: {
          zh: {
            translations: {
              button: {
                buttonText: '搜索文档',
                buttonAriaLabel: '搜索文档'
              },
              modal: {
                noResultsText: '无法找到相关结果',
                resetButtonTitle: '清除查询条件',
                footer: {
                  selectText: '选择',
                  navigateText: '切换',
                  closeText: '关闭'
                }
              }
            }
          }
        }
      }
    }
  },

  locales: {
    root: {
      label: "English",
      lang: "en-US",
      link: "/",
      themeConfig: {
        nav: [
          { text: "Product", link: "/" },
          { text: "Docs", link: "/docs/" },
          { text: "Download", link: installerUrl },
        ],
        sidebar: {
          "/docs/": [
            { text: "Documentation Home", link: "/docs/" },
            ...generateSyncedSidebar("en"),
          ],
        },
        footer: {
          message: "Built for simulator-grade motor sound authoring.",
          copyright: "Copyright © 2026 Motor Sound Editor",
        },
      },
    },
    zh: {
      label: "简体中文",
      lang: "zh-CN",
      link: "/zh/",
      themeConfig: {
        nav: [
          { text: "首页", link: "/zh/" },
          { text: "文档", link: "/zh/docs/" },
          { text: "下载", link: installerUrl },
        ],
        sidebar: {
          "/zh/docs/": [
            { text: "文档首页", link: "/zh/docs/" },
            ...generateSyncedSidebar("zh"),
          ],
        },
        outline: { label: "本页内容", level: [2, 3] },
        docFooter: { prev: "上一页", next: "下一页" },
        footer: {
          message: "面向模拟器级电机音效创作的桌面工具。",
          copyright: "Copyright © 2026 Motor Sound Editor",
        },
      },
    },
  },
});