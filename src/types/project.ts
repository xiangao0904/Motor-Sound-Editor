import type { ID, ISODateString, TimestampInfo } from "./common";
import type { AudioAsset, Track } from "./track";

export const APP_VERSION = "0.0.1";
export const PROJECT_SCHEMA_VERSION = 1;

export interface ProjectMeta extends TimestampInfo {
  id: ID;
  name: string;
  author?: string;
  appVersion: string;
  schemaVersion: number;

  /** 模拟器参数 */
  maxSpeed: number;
  acceleration: number;
  brakeDeceleration: number;

  /** 预留字段 */
  description?: string;
  lastOpenedAt?: ISODateString;
}

/** project.json */
export interface ProjectFile {
  meta: ProjectMeta;
}

/** tracks.json */
export interface TracksFile {
  activeTrackId: ID | null;
  tracks: Track[];
  assets: AudioAsset[];
}

/** 运行中使用的完整工程对象 */
export interface ProjectDocument {
  project: ProjectFile;
  tracks: TracksFile;
}

/** 首页卡片数据 */
export interface ProjectCardItem {
  id: ID;
  name: string;
  filePath: string;
  lastModified: ISODateString;
  previewImagePath?: string;
}

/** 新建工程参数 */
export interface CreateProjectPayload {
  name: string;
  maxSpeed?: number;
  acceleration?: number;
  brakeDeceleration?: number;
  author?: string;
}
