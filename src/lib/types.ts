import type { BlobRef } from '@atproto/api';

export interface TriLinesLine {
  text: string;
  image?: BlobRef;
}

export interface TriLinesEntry {
  uri: string;
  cid: string;
  lines: { text: string; image?: BlobRef }[];
  createdAt: string;
  sharedPost?: {
    uri: string;
    cid: string;
  };
}

export interface TriLinesLike {
  subject: {
    uri: string;
    cid: string;
  };
  createdAt: string;
}

export const IDS = {
  TriLinesEntry: 'blue.trilinesat.diary',
  TriLinesLike: 'blue.trilinesat.like',
};
