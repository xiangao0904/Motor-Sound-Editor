import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readText(relativePath) {
  return readFileSync(resolve(rootDir, relativePath), "utf8");
}

function writeText(relativePath, content) {
  const path = resolve(rootDir, relativePath);
  const current = readFileSync(path, "utf8");

  if (current !== content) {
    writeFileSync(path, content, "utf8");
    console.log(`synced ${relativePath}`);
  }
}

function replaceRequired(content, pattern, replacement, relativePath) {
  if (!pattern.test(content)) {
    throw new Error(`Could not find version field in ${relativePath}`);
  }

  return content.replace(pattern, replacement);
}

const packageJson = JSON.parse(readText("package.json"));
const version = packageJson.version;

if (
  typeof version !== "string" ||
  !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)
) {
  throw new Error(`package.json version must be a valid semver string, got: ${version}`);
}

const tauriConfigPath = "src-tauri/tauri.conf.json";
const cargoTomlPath = "src-tauri/Cargo.toml";
const projectTypesPath = "src/types/project.ts";

writeText(
  tauriConfigPath,
  replaceRequired(
    readText(tauriConfigPath),
    /"version":\s*"[^"]+"/,
    `"version": "${version}"`,
    tauriConfigPath,
  ),
);

writeText(
  cargoTomlPath,
  replaceRequired(
    readText(cargoTomlPath),
    /^version\s*=\s*"[^"]+"/m,
    `version = "${version}"`,
    cargoTomlPath,
  ),
);

writeText(
  projectTypesPath,
  replaceRequired(
    readText(projectTypesPath),
    /export const APP_VERSION = "[^"]+";/,
    `export const APP_VERSION = "${version}";`,
    projectTypesPath,
  ),
);
