import {
  defineConfig,
  type HeadConfig,
  type TransformContext,
} from "vitepress";
import fs from "node:fs";
import path from "node:path";

const sectionMap: Record<string, { en: string; zh: string }> = {
  guide: { en: "Manual", zh: "使用手册" },
  samples: { en: "Sample Projects", zh: "示例文件" },
  tutorials: { en: "Tutorials", zh: "教程" },
  developers: { en: "For Developers", zh: "针对开发者" },
  miscellaneous: { en: "Miscellaneous", zh: "杂项" },
};

function getOrder(fileName: string): number {
  const match = fileName.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 999;
}

function stripNumberPrefix(fileName: string): string {
  return fileName.replace(/^\d+-/, "");
}

function getFileTitle(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const match = content.match(/^title:\s*(.*)$/m);

    if (match && match[1]) {
      const title = match[1].trim().replace(/^["']|["']$/g, "");
      return title.length > 0 ? title : null;
    }
  } catch {
    console.error(`读取标题失败: ${filePath}`);
  }

  return null;
}

function generateRewrites() {
  const rewrites: Record<string, string> = {};
  const roots = ["docs", "zh/docs"];

  roots.forEach((root) => {
    const docsRootDir = path.resolve(process.cwd(), `./${root}`);
    if (!fs.existsSync(docsRootDir)) return;

    Object.keys(sectionMap).forEach((folder) => {
      const folderPath = path.join(docsRootDir, folder);
      if (!fs.existsSync(folderPath)) return;

      const files = fs.readdirSync(folderPath).filter((f) => f.endsWith(".md"));

      files.forEach((file) => {
        const stripped = stripNumberPrefix(file);

        if (file !== stripped) {
          rewrites[`${root}/${folder}/${file}`] =
            `${root}/${folder}/${stripped}`;
        }
      });
    });
  });

  return rewrites;
}

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
            targetFilePath = path.resolve(
              process.cwd(),
              `./zh/docs/${folder}/${file}`,
            );
            link = `/zh/docs/${folder}/${cleanNameBase}`;
          } else {
            targetFilePath = path.resolve(
              process.cwd(),
              `./docs/${folder}/${cleanNameBase}.md`,
            );

            if (!fs.existsSync(targetFilePath)) {
              targetFilePath = path.resolve(
                process.cwd(),
                `./docs/${folder}/${file}`,
              );
            }

            link = `/docs/${folder}/${cleanNameBase}`;
          }

          const title = getFileTitle(targetFilePath);
          if (!title) return null;

          return { text: title, link: encodeURI(link) };
        })
        .filter(
          (item): item is { text: string; link: string } => item !== null,
        );

      if (items.length === 0) return null;

      return {
        text: lang === "zh" ? sectionMap[folder].zh : sectionMap[folder].en,
        items,
        collapsed: false,
      };
    })
    .filter((section) => section !== null);
}

const defaultSiteUrl = "https://motor-sound-editor.pages.dev";
const seoTitleSuffix = "BVE and openBVE Train Motor Sound Editor";
const siteBase = normalizeBase(process.env.SITE_BASE ?? "/");
const siteUrl = normalizeSiteUrl(process.env.SITE_URL ?? defaultSiteUrl);
const rewrites = generateRewrites();

const withSiteBase = (p: string) =>
  p.startsWith("/") ? `${siteBase}${p.slice(1)}` : p;

const cardImageUrl = toAbsoluteSiteUrl("/card-1.png");

const installerUrl =
  "https://github.com/InfiniteGraphics/Motor-Sound-Editor/releases/download/v1.1.1/Motor.Sound.Editor_1.1.1_x64-setup.exe";

const siteDescription =
  "Motor Sound Editor is a visual BVE and openBVE train sound editor for creating VVVF-style motor sound projects with curve editing, live preview, and export-ready packaging.";

const baseKeywords = [
  "motor sound editor",
  "BVE motor sound editor",
  "openBVE motor sound editor",
  "train sound editor",
  "VVVF sound editor",
  "BVE sound project editor",
];

function normalizeBase(base: string): string {
  const prefixed = base.startsWith("/") ? base : `/${base}`;
  const normalized = prefixed.replace(/\/+/g, "/");
  return normalized.endsWith("/") ? normalized : `${normalized}/`;
}

function normalizeSiteUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function toAbsoluteSiteUrl(routePath: string): string {
  return new URL(withSiteBase(routePath), `${siteUrl}/`).toString();
}

function toRoutePath(relativePath: string): string {
  const rewrittenPath = rewrites[relativePath] ?? relativePath;

  if (rewrittenPath === "index.md") return "/";
  if (rewrittenPath === "zh/index.md") return "/zh/";

  if (rewrittenPath.endsWith("/index.md")) {
    return `/${rewrittenPath.slice(0, -"index.md".length)}`;
  }

  return `/${rewrittenPath.replace(/\.md$/, ".html")}`;
}

function getSeoTitle(pageTitle: string | undefined): string {
  const resolvedTitle = pageTitle?.trim() || "Motor Sound Editor";
  return `${resolvedTitle} | ${seoTitleSuffix}`;
}

function getSeoKeywords(routePath: string): string {
  const keywords = [...baseKeywords];

  if (routePath.startsWith("/docs/") || routePath.startsWith("/zh/docs/")) {
    keywords.push(
      "motor sound editor documentation",
      "BVE train sound workflow",
    );
  }

  if (routePath.includes("/guide/export")) {
    keywords.push("BVE sound export");
  }

  return keywords.join(", ");
}

function getAlternatePages(routePath: string) {
  if (routePath === "/" || routePath === "/zh/") {
    return [
      { lang: "en-US", href: toAbsoluteSiteUrl("/") },
      { lang: "zh-CN", href: toAbsoluteSiteUrl("/zh/") },
    ];
  }

  if (routePath.startsWith("/docs/")) {
    return [
      { lang: "en-US", href: toAbsoluteSiteUrl(routePath) },
      { lang: "zh-CN", href: toAbsoluteSiteUrl(`/zh${routePath}`) },
    ];
  }

  if (routePath.startsWith("/zh/docs/")) {
    const englishRoute = routePath.replace(/^\/zh/, "");
    return [
      { lang: "en-US", href: toAbsoluteSiteUrl(englishRoute) },
      { lang: "zh-CN", href: toAbsoluteSiteUrl(routePath) },
    ];
  }

  return [];
}

function buildSeoHead(context: TransformContext): HeadConfig[] {
  const routePath = toRoutePath(context.pageData.relativePath);
  const canonicalUrl = toAbsoluteSiteUrl(routePath);
  const description = context.description || siteDescription;
  const title = getSeoTitle(context.pageData.title);
  const alternatePages = getAlternatePages(routePath);
  const head: HeadConfig[] = [
    ["link", { rel: "canonical", href: canonicalUrl }],
    ["meta", { name: "keywords", content: getSeoKeywords(routePath) }],
    [
      "meta",
      { name: "robots", content: "index, follow, max-image-preview:large" },
    ],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:site_name", content: "Motor Sound Editor" }],
    ["meta", { property: "og:title", content: title }],
    ["meta", { property: "og:description", content: description }],
    ["meta", { property: "og:url", content: canonicalUrl }],
    ["meta", { property: "og:image", content: cardImageUrl }],
    ["meta", { property: "og:image:width", content: "1200" }],
    ["meta", { property: "og:image:height", content: "630" }],
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
    ["meta", { name: "twitter:title", content: title }],
    ["meta", { name: "twitter:description", content: description }],
    ["meta", { name: "twitter:image", content: cardImageUrl }],
  ];

  alternatePages.forEach((page) => {
    head.push([
      "link",
      { rel: "alternate", hreflang: page.lang, href: page.href },
    ]);
  });

  if (alternatePages.length > 0) {
    head.push([
      "link",
      {
        rel: "alternate",
        hreflang: "x-default",
        href: alternatePages[0].href,
      },
    ]);
  }

  return head;
}

export default defineConfig({
  base: siteBase,
  lang: "en-US",
  title: "Motor Sound Editor",
  titleTemplate: `:title | ${seoTitleSuffix}`,
  description: siteDescription,
  sitemap: {
    hostname: siteUrl,
  },
  lastUpdated: true,
  rewrites,
  transformHead(context) {
    return buildSeoHead(context);
  },
  head: [
    [
      "meta",
      { name: "msvalidate.01", content: "211ADBCB24156FB6910E7B92519E40F5" },
    ],
    [
      "meta",
      {
        name: "google-site-verification",
        content: "-1Qe3G3cvhKJLgdg9qdnKINhTLB4YHSqBUAkvS3WnMs",
      },
    ],
    [
      "link",
      { rel: "icon", href: withSiteBase("/64x64.png"), type: "image/png" },
    ],
    ["link", { rel: "preconnect", href: "https://fonts.googleapis.com" }],
    [
      "link",
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
    ],
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
    logo: {
      src: "64x64.png",
      alt: "Motor Sound Editor logo",
    },
    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/InfiniteGraphics/Motor-Sound-Editor",
      },
    ],
    search: {
      provider: "local",
      options: {
        locales: {
          zh: {
            translations: {
              button: {
                buttonText: "搜索文档",
                buttonAriaLabel: "搜索文档",
              },
              modal: {
                noResultsText: "无法找到相关结果",
                resetButtonTitle: "清除查询条件",
                footer: {
                  selectText: "选择",
                  navigateText: "切换",
                  closeText: "关闭",
                },
              },
            },
          },
        },
      },
    },
  },
  locales: {
    root: {
      label: "English",
      lang: "en-US",
      link: "/",
      themeConfig: {
        logoLink: "/docs/",
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
        logoLink: "/zh/docs/",
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
