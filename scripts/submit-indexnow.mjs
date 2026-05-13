const defaultSiteUrl = "https://motor-sound-editor.pages.dev";
const defaultIndexNowKey = "86c1f2f1c4f94d6caeb738f94d392d2a";

const siteUrl = (process.env.SITE_URL ?? defaultSiteUrl).replace(/\/+$/, "");
const key = process.env.INDEXNOW_KEY ?? defaultIndexNowKey;
const endpoint = process.env.INDEXNOW_ENDPOINT ?? "https://api.indexnow.org/indexnow";
const defaultUrls = ["/", "/docs/", "/zh/", "/zh/docs/"]
  .map((route) => `${siteUrl}${route === "/" ? "" : route}`)
  .join(",");

const urlList = (process.env.INDEXNOW_URLS ?? defaultUrls)
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);

const payload = {
  host: new URL(siteUrl).host,
  key,
  keyLocation: `${siteUrl}/${key}.txt`,
  urlList,
};

const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    "content-type": "application/json; charset=utf-8",
  },
  body: JSON.stringify(payload),
});

if (!response.ok) {
  const details = await response.text();
  throw new Error(`IndexNow submission failed (${response.status}): ${details}`);
}

console.log(`IndexNow submitted ${urlList.length} URL(s) for ${payload.host}.`);
console.log(
  "Run this after a Cloudflare Pages production deployment or from a deploy hook to notify search engines about the refreshed sitemap.",
);
