export type ID = string;

export type ISODateString = string;

export interface Point2D {
  x: number;
  y: number;
}

export interface Range {
  min: number;
  max: number;
}

export interface TimestampInfo {
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
