import {
  readAudioMetadataBatch,
  readExternalFile,
} from "@/services/nativeInterop";
import { fileNameFromPath } from "@/services/msepProject";
import { measureAsync, measureSync } from "@/utils/perfTrace";
import type { ID } from "@/types/common";
import type { ProjectDocument } from "@/types/project";
import type {
  AudioAsset,
  CurveKind,
  Keyframe,
  Track,
  TrackCurve,
} from "@/types/track";
import { createDefaultTrack, createProjectDocument } from "@/types/factories";

export interface ImportedProjectResult {
  document: ProjectDocument;
  assetPayloads: Map<ID, Uint8Array>;
  warnings: string[];
  defaultProjectName: string;
}

type ImportEntryKind = "bve" | "mtr" | "openbve";
type ImportErrorCode =
  | "unsupported-entry"
  | "missing-file"
  | "invalid-config"
  | "invalid-csv";

interface ParsedIniSection {
  name: string;
  values: Map<string, string>;
}

interface MotorEntry {
  index: number;
  fileName: string;
}

interface ParsedMotorCsv {
  path: string;
  maxSpeed: number;
  columns: ParsedMotorCsvPoint[][];
}

interface ParsedMotorCsvPoint {
  speed: number;
  value: number;
}

interface ImportedAudioAsset {
  draft: ImportedTrackDraft;
  asset: AudioAsset;
  bytes: Uint8Array;
}

interface ImportedTrackDraft {
  track: Track;
  audioFileName: string;
  audioPath: string | null;
}

interface ImportedSourceData {
  kind: ImportEntryKind;
  defaultProjectName: string;
  audioBaseDir: string;
  motorEntries: MotorEntry[];
  tractionPitch: ParsedMotorCsv;
  tractionVolume: ParsedMotorCsv;
  brakePitch: ParsedMotorCsv;
  brakeVolume: ParsedMotorCsv;
}

const TRACK_COLORS = [
  "#FFE796",
  "#60A5FA",
  "#F97316",
  "#34D399",
  "#F472B6",
  "#A78BFA",
  "#FACC15",
  "#22D3EE",
];

const REQUIRED_MTR_CSV_FILES = [
  "powerfreq.csv",
  "powervol.csv",
  "brakefreq.csv",
  "brakevol.csv",
] as const;

export class ProjectImportError extends Error {
  code: ImportErrorCode;
  detail?: string;

  constructor(code: ImportErrorCode, detail?: string) {
    super(detail ?? code);
    this.name = "ProjectImportError";
    this.code = code;
    this.detail = detail;
  }
}

export function isVehicleConfigPath(filePath: string): boolean {
  return fileNameFromPath(filePath).toLowerCase() === "vehicle.txt";
}

export function isMtrSoundConfigPath(filePath: string): boolean {
  return fileNameFromPath(filePath).toLowerCase() === "sound.cfg";
}

export function isOpenBveTrainPath(filePath: string): boolean {
  return fileNameFromPath(filePath).toLowerCase() === "train.dat";
}

export function isExternalImportPath(filePath: string): boolean {
  return isVehicleConfigPath(filePath) || isMtrSoundConfigPath(filePath) || isOpenBveTrainPath(filePath);
}

export async function importExternalProject(
  entryPath: string,
): Promise<ImportedProjectResult> {
  return measureAsync("external import total", async () => {
    const kind = detectImportEntryKind(entryPath);
    const source = kind === "bve"
      ? await parseVehicleProject(entryPath)
      : kind === "openbve"
        ? await parseOpenBveProject(entryPath)
        : await parseMtrProject(entryPath);

    return buildImportedProject(source);
  });
}

function detectImportEntryKind(entryPath: string): ImportEntryKind {
  if (isVehicleConfigPath(entryPath)) return "bve";
  if (isMtrSoundConfigPath(entryPath)) return "mtr";
  if (isOpenBveTrainPath(entryPath)) return "openbve";

  throw new ProjectImportError("unsupported-entry", entryPath);
}

async function parseVehicleProject(entryPath: string): Promise<ImportedSourceData> {
  const vehicleText = await readTextWithFallback(entryPath);
  const vehicleSections = parseIniSections(vehicleText);
  const rootSection = getRequiredSection(vehicleSections, "");
  const soundPath = resolveRelativePath(
    dirname(entryPath),
    getRequiredValue(rootSection, "Sound"),
  );
  const motorNoisePath = resolveRelativePath(
    dirname(entryPath),
    getRequiredValue(rootSection, "MotorNoise"),
  );

  const soundText = await readTextWithFallback(soundPath);
  const soundSections = parseIniSections(soundText);
  const motorEntries = parseMotorEntries(getRequiredSection(soundSections, "Motor"));

  const motorNoiseText = await readTextWithFallback(motorNoisePath);
  const motorNoiseSections = parseIniSections(motorNoiseText);
  const powerSection = getRequiredSection(motorNoiseSections, "Power");
  const brakeSection = getRequiredSection(motorNoiseSections, "Brake");

  const [
    tractionPitch,
    tractionVolume,
    brakePitch,
    brakeVolume,
  ] = await Promise.all([
    parseMotorCsv(
      resolveRelativePath(
        dirname(motorNoisePath),
        getRequiredValue(powerSection, "Frequency"),
      ),
      motorEntries.length,
    ),
    parseMotorCsv(
      resolveRelativePath(dirname(motorNoisePath), getRequiredValue(powerSection, "Volume")),
      motorEntries.length,
    ),
    parseMotorCsv(
      resolveRelativePath(
        dirname(motorNoisePath),
        getRequiredValue(brakeSection, "Frequency"),
      ),
      motorEntries.length,
    ),
    parseMotorCsv(
      resolveRelativePath(dirname(motorNoisePath), getRequiredValue(brakeSection, "Volume")),
      motorEntries.length,
    ),
  ]);

  return {
    kind: "bve",
    defaultProjectName: fileNameFromPath(dirname(entryPath)) || "imported_project",
    audioBaseDir: dirname(soundPath),
    motorEntries,
    tractionPitch,
    tractionVolume,
    brakePitch,
    brakeVolume,
  };
}

async function parseMtrProject(entryPath: string): Promise<ImportedSourceData> {
  const soundCfgText = await readTextWithFallback(entryPath);
  const sections = parseIniSections(soundCfgText);
  const motorEntries = parseMotorEntries(getRequiredSection(sections, "Motor"));
  const baseDir = dirname(entryPath);

  const csvFiles = await Promise.all(
    REQUIRED_MTR_CSV_FILES.map((fileName) =>
      parseMotorCsv(resolveRelativePath(baseDir, fileName), motorEntries.length),
    ),
  );

  return {
    kind: "mtr",
    defaultProjectName: fileNameFromPath(baseDir) || "imported_project",
    audioBaseDir: baseDir,
    motorEntries,
    tractionPitch: csvFiles[0],
    tractionVolume: csvFiles[1],
    brakePitch: csvFiles[2],
    brakeVolume: csvFiles[3],
  };
}

interface OpenBveMotorRow {
  index: number;
  pitch: number;
  volume: number;
}

function parseOpenBveMotorSections(text: string): Map<string, OpenBveMotorRow[]> {
  const lines = text.replace(/^\uFEFF/u, "").split(/\r?\n/u);
  if (!/^(?:OPENBVE\d*|BVE\d+)$/iu.test((lines[0] ?? "").trim())) {
    throw new ProjectImportError("invalid-config", "train.dat: identifier");
  }
  const sections = new Map<string, OpenBveMotorRow[]>();
  let current: OpenBveMotorRow[] | null = null;
  for (const raw of lines.slice(1)) {
    const line = raw.split(";", 1)[0].trim();
    if (line.startsWith("#")) {
      const name = line.slice(1).trim().toUpperCase();
      current = /^MOTOR_[PB][12]$/u.test(name) ? [] : null;
      if (current) sections.set(name, current);
      continue;
    }
    if (!current) continue;
    if (current.length >= 10_000) throw new ProjectImportError("invalid-config", "train.dat: motor table too long");
    const cells = line.split(",").map((cell) => cell.trim());
    const index = cells[0] ? Number(cells[0]) : -1;
    const pitch = cells[1] ? Number(cells[1]) : 100;
    const volume = cells[2] ? Number(cells[2]) : 128;
    if (!Number.isInteger(index) || index < -1 || !Number.isFinite(pitch) || pitch <= 0 || !Number.isFinite(volume) || volume < 0) {
      throw new ProjectImportError("invalid-config", "train.dat: motor table");
    }
    current.push({ index, pitch, volume });
  }
  if (!["MOTOR_P1", "MOTOR_P2", "MOTOR_B1", "MOTOR_B2"].some((name) => sections.has(name))) {
    throw new ProjectImportError("invalid-config", "train.dat: motor sections");
  }
  return sections;
}

function openBveCurveColumns(
  sections: Map<string, OpenBveMotorRow[]>,
  prefix: "P" | "B",
  kind: CurveKind,
  entries: MotorEntry[],
  path: string,
): ParsedMotorCsv {
  const tables = [sections.get(`MOTOR_${prefix}1`) ?? [], sections.get(`MOTOR_${prefix}2`) ?? []];
  const rows = Math.max(1, ...tables.map((table) => table.length));
  const columns = entries.map((entry) => {
    const points: ParsedMotorCsvPoint[] = [];
    for (let row = 0; row < rows; row += 1) {
      const matches = tables.map((table) => table[Math.min(row, table.length - 1)])
        .filter((item): item is OpenBveMotorRow => !!item && item.index === entry.index);
      const loudest = matches.sort((a, b) => b.volume - a.volume)[0];
      points.push({
        speed: row / 5,
        value: kind === "pitch" ? (loudest?.pitch ?? 100) / 100 : (loudest?.volume ?? 0) / 128,
      });
    }
    return points;
  });
  return { path, maxSpeed: (rows - 1) / 5, columns };
}

async function parseOpenBveProject(entryPath: string): Promise<ImportedSourceData> {
  const sections = parseOpenBveMotorSections(await readTextWithFallback(entryPath));
  const baseDir = dirname(entryPath);
  const soundPath = resolveRelativePath(baseDir, "sound.cfg");
  const soundSections = await canReadFile(soundPath)
    ? parseIniSections(await readTextWithFallback(soundPath))
    : null;
  const mapped = soundSections?.get("motor")
    ? parseMotorEntries(getRequiredSection(soundSections, "Motor"))
    : [];
  const audioByIndex = new Map(mapped.map((entry) => [entry.index, entry.fileName]));
  const indices = new Set<number>();
  for (const table of sections.values()) for (const row of table) if (row.index >= 0) indices.add(row.index);
  if (indices.size === 0) throw new ProjectImportError("invalid-config", "train.dat: no motor sounds");
  const motorEntries = [...indices].sort((a, b) => a - b)
    .map((index) => ({ index, fileName: audioByIndex.get(index) ?? `motor${index}.wav` }));
  return {
    kind: "openbve",
    defaultProjectName: fileNameFromPath(baseDir) || "imported_project",
    audioBaseDir: baseDir,
    motorEntries,
    tractionPitch: openBveCurveColumns(sections, "P", "pitch", motorEntries, entryPath),
    tractionVolume: openBveCurveColumns(sections, "P", "volume", motorEntries, entryPath),
    brakePitch: openBveCurveColumns(sections, "B", "pitch", motorEntries, entryPath),
    brakeVolume: openBveCurveColumns(sections, "B", "volume", motorEntries, entryPath),
  };
}

export async function readTextWithFallback(path: string): Promise<string> {
  const bytes = await readRequiredFile(path);
  const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

  try {
    return stripBom(utf8Decoder.decode(bytes));
  } catch {
    try {
      return stripBom(new TextDecoder("gb18030", { fatal: true }).decode(bytes));
    } catch {
      return stripBom(new TextDecoder("utf-8").decode(bytes));
    }
  }
}

export function parseIniSections(text: string): Map<string, ParsedIniSection> {
  const sections = new Map<string, ParsedIniSection>();
  let currentSection = ensureIniSection(sections, "");

  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith(";") || line.startsWith("#")) {
      continue;
    }

    const sectionMatch = line.match(/^\[(.+)\]$/u);
    if (sectionMatch) {
      currentSection = ensureIniSection(sections, sectionMatch[1].trim());
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = normalizeConfigValue(line.slice(separatorIndex + 1).trim());
    if (!key) {
      continue;
    }

    currentSection.values.set(key.toLowerCase(), value);
  }

  return sections;
}

export async function parseMotorCsv(
  path: string,
  expectedTrackCount: number,
): Promise<ParsedMotorCsv> {
  const text = await measureAsync(`read CSV ${fileNameFromPath(path)}`, () =>
    readTextWithFallback(path),
  );

  return measureSync(`parse CSV ${fileNameFromPath(path)}`, () => {
    const columns = Array.from({ length: expectedTrackCount }, () => [] as ParsedMotorCsvPoint[]);
    let maxSpeed = 0;
    let hasDataRows = false;
    let parserMode: "dense" | "sparse" | null = null;
    let sparseTrackIndexByColumn: number[] = [];

    forEachNonEmptyLine(text, (line, rowIndex) => {
      if (!hasDataRows && line.toLowerCase().startsWith("bvets motor noise table")) {
        return;
      }

      if (!parserMode) {
        const firstRowParts = splitCsvLine(line);
        parserMode = firstRowParts[0] === "#" ? "sparse" : "dense";

        if (parserMode === "sparse") {
          sparseTrackIndexByColumn = parseSparseMotorCsvHeader(
            firstRowParts,
            path,
            expectedTrackCount,
          );
          hasDataRows = true;
          return;
        }
      }

      hasDataRows = true;
      const speed =
        parserMode === "sparse"
          ? parseSparseMotorCsvLine(
              line,
              path,
              rowIndex,
              sparseTrackIndexByColumn,
              columns,
            )
          : parseDenseMotorCsvLine(
              line,
              path,
              rowIndex,
              expectedTrackCount,
              columns,
            );

      if (speed !== null) {
        maxSpeed = Math.max(maxSpeed, speed);
      }
    });

    if (!hasDataRows) {
      throw new ProjectImportError("invalid-csv", fileNameFromPath(path));
    }

    return {
      path,
      maxSpeed,
      columns,
    };
  });
}

async function buildImportedProject(
  source: ImportedSourceData,
): Promise<ImportedProjectResult> {
  validateTrackCounts(source);

  const maxSpeed = resolveMaxSpeed(source);
  const document = createProjectDocument({
    name: source.defaultProjectName,
    maxSpeed,
    acceleration: 1.2,
    brakeDeceleration: 1.2,
  });
  document.tracks.tracks = [];
  document.tracks.assets = [];
  document.tracks.activeTrackId = null;

  const trackDrafts = source.motorEntries.map((entry, trackIndex) =>
    createImportedTrackDraft(source, entry, trackIndex, maxSpeed),
  );

  const importedAudio = await loadAvailableAudioAssets(
    trackDrafts,
    source.kind === "mtr",
  );
  const assetPayloads = new Map<ID, Uint8Array>();
  const assetIdByTrackId = new Map(
    importedAudio.map(({ draft, asset }) => [draft.track.id, asset.id]),
  );

  importedAudio.forEach(({ asset, bytes }) => {
    document.tracks.assets.push(asset);
    assetPayloads.set(asset.id, bytes);
  });

  document.tracks.tracks = trackDrafts.map(({ track }) => {
    track.assetId = assetIdByTrackId.get(track.id) ?? null;

    return track;
  });
  document.tracks.activeTrackId = document.tracks.tracks[0]?.id ?? null;

  const warnings = trackDrafts
    .filter(({ audioPath }) => audioPath === null)
    .map(({ audioFileName }) => audioFileName);

  return {
    document,
    assetPayloads,
    warnings,
    defaultProjectName: source.defaultProjectName,
  };
}

function validateTrackCounts(source: ImportedSourceData) {
  const expected = source.motorEntries.length;

  for (const csv of [
    source.tractionPitch,
    source.tractionVolume,
    source.brakePitch,
    source.brakeVolume,
  ]) {
    if (csv.columns.length !== expected) {
      throw new ProjectImportError("invalid-csv", fileNameFromPath(csv.path));
    }
  }
}

function resolveMaxSpeed(source: ImportedSourceData): number {
  const speeds = [
    source.tractionPitch.maxSpeed,
    source.tractionVolume.maxSpeed,
    source.brakePitch.maxSpeed,
    source.brakeVolume.maxSpeed,
  ].filter((value) => Number.isFinite(value) && value > 0);

  return speeds.length > 0 ? Math.max(...speeds) : 120;
}

function createImportedTrackDraft(
  source: ImportedSourceData,
  entry: MotorEntry,
  trackIndex: number,
  maxSpeed: number,
): ImportedTrackDraft {
  const track = createDefaultTrack(
    `motor${entry.index}`,
    maxSpeed,
    TRACK_COLORS[trackIndex % TRACK_COLORS.length],
  );

  track.curveSets.traction.pitch = createImportedCurve(
    "pitch",
    source.tractionPitch.columns[trackIndex],
  );
  track.curveSets.traction.volume = createImportedCurve(
    "volume",
    source.tractionVolume.columns[trackIndex],
  );
  track.curveSets.brake.pitch = createImportedCurve(
    "pitch",
    source.brakePitch.columns[trackIndex],
  );
  track.curveSets.brake.volume = createImportedCurve(
    "volume",
    source.brakeVolume.columns[trackIndex],
  );

  return {
    track,
    audioFileName: entry.fileName,
    audioPath: resolveReferencedAudioPath(entry.fileName, source.audioBaseDir),
  };
}

function createImportedCurve(
  kind: CurveKind,
  points: ParsedMotorCsvPoint[],
): TrackCurve {
  const keyframes: Keyframe[] = points.map(({ speed, value }) => ({
    id: crypto.randomUUID(),
    speed,
    value,
  }));

  return {
    kind,
    interpolation: "linear",
    keyframes,
  };
}

async function loadAvailableAudioAssets(
  trackDrafts: ImportedTrackDraft[],
  allowOggFallback: boolean,
): Promise<ImportedAudioAsset[]> {
  const resolvedAudio = await Promise.all(
    trackDrafts.map(async (draft) => {
      const audioFile = await findImportableAudioFile(
        draft.audioFileName,
        draft.audioPath,
        allowOggFallback,
      );
      if (!audioFile) {
        draft.audioPath = null;
        return null;
      }

      const bytes = await readRequiredFile(audioFile.path);
      return {
        draft,
        bytes,
        path: audioFile.path,
        fileName: fileNameFromPath(audioFile.path),
        format: audioFile.format,
      };
    }),
  );

  const metadata = await measureAsync("decode imported audio metadata", () =>
    readAudioMetadataBatch(
    resolvedAudio.flatMap((item) =>
      item
        ? [
            {
              path: item.path,
              fileName: item.fileName,
            },
          ]
        : [],
    ),
    ),
  );

  let metadataIndex = 0;
  return resolvedAudio.flatMap((item) => {
    if (!item) return [];

    const nextMetadata = metadata[metadataIndex];
    metadataIndex += 1;
    const asset: AudioAsset = {
      id: crypto.randomUUID(),
      fileName: item.fileName,
      originalPath: item.path,
      packagedPath: `Assets/${crypto.randomUUID()}-${item.fileName}`,
      format: item.format,
      size: item.bytes.byteLength,
      durationSec: nextMetadata?.durationSec,
      sampleRate: nextMetadata?.sampleRate,
      channels: nextMetadata?.channels,
    };
    item.draft.audioPath = item.path;

    return [{ draft: item.draft, asset, bytes: item.bytes }];
  });
}

async function findImportableAudioFile(
  configuredFileName: string,
  resolvedPath: string | null,
  allowOggFallback: boolean,
): Promise<{ path: string; format: "wav" | "ogg" } | null> {
  if (!resolvedPath) {
    return null;
  }

  const directExtension = extensionFromPath(resolvedPath);
  if ((directExtension === "wav" || directExtension === "ogg") && (await canReadFile(resolvedPath))) {
    return {
      path: resolvedPath,
      format: directExtension,
    };
  }

  if (allowOggFallback && configuredFileName.toLowerCase().endsWith(".wav")) {
    const oggPath = replaceExtension(resolvedPath, "ogg");
    if (await canReadFile(oggPath)) {
      return {
        path: oggPath,
        format: "ogg",
      };
    }
  }

  return null;
}

function resolveReferencedAudioPath(fileName: string, baseDir: string): string | null {
  const trimmed = fileName.trim();
  if (!trimmed) {
    return null;
  }

  return resolveRelativePath(baseDir, trimmed);
}

function parseMotorEntries(section: ParsedIniSection): MotorEntry[] {
  const entries = [...section.values.entries()]
    .map(([key, value]) => ({
      index: Number(key),
      fileName: value.trim(),
    }))
    .filter(
      (entry) =>
        Number.isInteger(entry.index) &&
        entry.index >= 0 &&
        entry.fileName.length > 0,
    )
    .sort((left, right) => left.index - right.index);

  if (entries.length === 0) {
    throw new ProjectImportError("invalid-config", section.name || "Motor");
  }

  return entries;
}

function getRequiredSection(
  sections: Map<string, ParsedIniSection>,
  name: string,
): ParsedIniSection {
  const section = sections.get(name.toLowerCase());
  if (!section) {
    throw new ProjectImportError("invalid-config", name);
  }

  return section;
}

function getRequiredValue(section: ParsedIniSection, key: string): string {
  const value = section.values.get(key.toLowerCase());
  if (!value) {
    throw new ProjectImportError("invalid-config", `${section.name || "root"}:${key}`);
  }

  return value;
}

function ensureIniSection(
  sections: Map<string, ParsedIniSection>,
  name: string,
): ParsedIniSection {
  const normalizedName = name.toLowerCase();
  const existing = sections.get(normalizedName);
  if (existing) {
    return existing;
  }

  const created = {
    name,
    values: new Map<string, string>(),
  };
  sections.set(normalizedName, created);
  return created;
}

function dirname(filePath: string): string {
  const normalized = normalizePath(filePath);
  const lastSeparator = normalized.lastIndexOf("/");
  if (lastSeparator <= 0) {
    return normalized.includes(":") ? normalized : ".";
  }

  return normalized.slice(0, lastSeparator);
}

function normalizePath(filePath: string): string {
  const replaced = filePath.replace(/\\/gu, "/");
  const rootMatch = replaced.match(/^(?:[A-Za-z]:|\/\/[^/]+\/[^/]+|\/)/u);
  const root = rootMatch?.[0] ?? "";
  const remainder = replaced.slice(root.length);
  const parts = remainder.split("/").filter((part) => part.length > 0);
  const normalizedParts: string[] = [];

  for (const part of parts) {
    if (part === ".") {
      continue;
    }

    if (part === "..") {
      if (normalizedParts.length > 0 && normalizedParts[normalizedParts.length - 1] !== "..") {
        normalizedParts.pop();
      } else if (!root) {
        normalizedParts.push(part);
      }
      continue;
    }

    normalizedParts.push(part);
  }

  const joined = normalizedParts.join("/");
  if (!root) {
    return joined || ".";
  }

  if (!joined) {
    return root.endsWith("/") ? root.slice(0, -1) : root;
  }

  return `${root}${root.endsWith("/") ? "" : "/"}${joined}`;
}

function resolveRelativePath(baseDir: string, nextPath: string): string {
  if (isAbsolutePath(nextPath)) {
    return normalizePath(nextPath);
  }

  return normalizePath(`${baseDir}/${nextPath}`);
}

function isAbsolutePath(filePath: string): boolean {
  return /^[A-Za-z]:[\\/]/u.test(filePath) || filePath.startsWith("\\\\") || filePath.startsWith("/");
}

function extensionFromPath(filePath: string): string | null {
  const match = fileNameFromPath(filePath).match(/\.([^.]+)$/u);
  return match ? match[1].toLowerCase() : null;
}

function replaceExtension(filePath: string, extension: string): string {
  return filePath.replace(/\.[^.]+$/u, `.${extension}`);
}

function normalizeConfigValue(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1).trim();
  }

  return value;
}

function splitCsvLine(line: string): string[] {
  return line.split(",").map((part) => part.trim());
}

function forEachNonEmptyLine(
  text: string,
  visitor: (line: string, rowIndex: number) => void,
) {
  let rowIndex = 0;
  let start = 0;

  for (let index = 0; index <= text.length; index += 1) {
    const char = text[index];
    if (index < text.length && char !== "\n") {
      continue;
    }

    const end = index > start && text[index - 1] === "\r" ? index - 1 : index;
    const line = text.slice(start, end).trim();
    if (line.length > 0) {
      visitor(line, rowIndex);
    }

    rowIndex += 1;
    start = index + 1;
  }
}

function parseDenseMotorCsvLine(
  line: string,
  path: string,
  rowIndex: number,
  expectedTrackCount: number,
  columns: ParsedMotorCsvPoint[][],
): number {
  const parts = splitCsvLine(line);
  if (parts.length !== expectedTrackCount + 1) {
    throw new ProjectImportError("invalid-csv", fileNameFromPath(path));
  }

  const speed = parseRequiredNumber(parts[0], path, rowIndex, 0);

  for (let columnIndex = 0; columnIndex < expectedTrackCount; columnIndex += 1) {
    const rawValue = parts[columnIndex + 1];
    if (!rawValue) {
      continue;
    }

    columns[columnIndex].push({
      speed,
      value: parseRequiredNumber(rawValue, path, rowIndex, columnIndex + 1),
    });
  }

  return speed;
}

function parseSparseMotorCsvHeader(
  headerParts: string[],
  path: string,
  expectedTrackCount: number,
): number[] {
  return headerParts.slice(1).map((part, index) => {
    if (!part) {
      return index;
    }

    const parsed = Number(part);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed >= expectedTrackCount) {
      throw new ProjectImportError("invalid-csv", fileNameFromPath(path));
    }

    return parsed;
  });
}

function parseSparseMotorCsvLine(
  line: string,
  path: string,
  rowIndex: number,
  trackIndexByColumn: number[],
  columns: ParsedMotorCsvPoint[][],
): number | null {
  const parts = splitCsvLine(line);
  const speedCell = parts[0] ?? "";
  if (!speedCell) {
    return null;
  }

  const speed = parseRequiredNumber(speedCell, path, rowIndex, 0);

  for (
    let columnOffset = 0;
    columnOffset < trackIndexByColumn.length;
    columnOffset += 1
  ) {
    const rawValue = parts[columnOffset + 1] ?? "";
    if (!rawValue) {
      continue;
    }

    const trackIndex = trackIndexByColumn[columnOffset];
    columns[trackIndex].push({
      speed,
      value: parseRequiredNumber(rawValue, path, rowIndex, columnOffset + 1),
    });
  }

  return speed;
}

async function canReadFile(path: string): Promise<boolean> {
  try {
    await readFileWithSeparatorFallback(path);
    return true;
  } catch {
    return false;
  }
}

async function readRequiredFile(path: string): Promise<Uint8Array> {
  try {
    return await readFileWithSeparatorFallback(path);
  } catch {
    throw new ProjectImportError("missing-file", path);
  }
}

async function readFileWithSeparatorFallback(path: string): Promise<Uint8Array> {
  try {
    return await readExternalFile(path);
  } catch (primaryError) {
    const alternatePath = swapPathSeparators(path);
    if (alternatePath !== path) {
      try {
        return await readExternalFile(alternatePath);
      } catch {
        // Fall through to the original error below.
      }
    }

    throw primaryError;
  }
}

function swapPathSeparators(path: string): string {
  if (path.includes("/")) {
    return path.replace(/\//gu, "\\");
  }

  if (path.includes("\\")) {
    return path.replace(/\\/gu, "/");
  }

  return path;
}

function stripBom(text: string): string {
  return text.replace(/^\uFEFF/u, "");
}

function parseRequiredNumber(
  value: string,
  path: string,
  rowIndex: number,
  columnIndex: number,
): number {
  if (!value) {
    throw new ProjectImportError(
      "invalid-csv",
      `${fileNameFromPath(path)}:${rowIndex + 1}:${columnIndex + 1}`,
    );
  }

  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    throw new ProjectImportError(
      "invalid-csv",
      `${fileNameFromPath(path)}:${rowIndex + 1}:${columnIndex + 1}`,
    );
  }

  return numberValue;
}
