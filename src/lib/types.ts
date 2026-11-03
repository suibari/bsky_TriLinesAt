import type { BlobRef } from '@atproto/api';

export interface TriLinesLine {
  text: string;
  image?: BlobRef;
  /** Alt text for the image (com.suibari.trilinesat.diary only). */
  alt?: string;
}

export interface TriLinesEntry {
  uri: string;
  cid: string;
  lines: TriLinesLine[];
  langs?: string[];
  createdAt: string;
  sharedPost?: {
    uri: string;
    cid: string;
  };
  /** Legacy (blue.trilinesat.diary only): Nagi crosspost. Nagi now shows diaries natively. */
  sharedNagiPost?: {
    uri: string;
    cid: string;
  };
  /** Repo DID resolved by the client. Not written to new records. */
  authorDid: string;
  hubRef?: string; // DID of the "Hub" for global feed aggregation
}

export interface TriLinesLike {
  subject: {
    uri: string;
    cid: string;
  };
  createdAt: string;
}

export const IDS = {
  /** Current diary NSID. All new entries are written here (shared with Nagi). */
  TriLinesEntry: 'com.suibari.trilinesat.diary',
  TriLinesLike: 'com.suibari.trilinesat.like',
  /** Legacy NSIDs. Read only: shown, edited and deleted, but never created. */
  LegacyTriLinesEntry: 'blue.trilinesat.diary',
  LegacyTriLinesLike: 'blue.trilinesat.like',
  NagiReaction: 'com.suibari.nagi.reaction',
} as const;

/** Every collection that holds diary entries, newest NSID first. */
export const ENTRY_COLLECTIONS = [IDS.TriLinesEntry, IDS.LegacyTriLinesEntry] as const;
/** Every collection that holds stars. */
export const LIKE_COLLECTIONS = [IDS.TriLinesLike, IDS.LegacyTriLinesLike] as const;

/** Collection segment of an at:// URI. */
export const collectionOf = (uri: string): string | undefined => uri.split('/')[3];
export const isLegacyEntry = (uri: string) => collectionOf(uri) === IDS.LegacyTriLinesEntry;

// UI View Type (extends PDS record with transient state)
export interface TriLinesEntryView extends TriLinesEntry {
  likeCount?: number;
  viewerLike?: string; // URI if liked by viewer
  viewerSharedLike?: boolean; // Viewer liked via Bluesky or reacted on Nagi (counted with stars)
  likeAvatars?: any[]; // ProfileView[]
  candidateDids?: string[]; // Temp list for batch fetching
}
