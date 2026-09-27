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
  sharedNagiPost?: {
    uri: string;
    cid: string;
  };
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
  TriLinesEntry: 'blue.trilinesat.diary',
  TriLinesLike: 'blue.trilinesat.like',
  NagiPost: 'com.suibari.nagi.post',
  NagiReaction: 'com.suibari.nagi.reaction',
};

// UI View Type (extends PDS record with transient state)
export interface TriLinesEntryView extends TriLinesEntry {
  likeCount?: number;
  viewerLike?: string; // URI if liked by viewer
  viewerSharedLike?: boolean; // Viewer liked the crossposted Bluesky/Nagi post
  likeAvatars?: any[]; // ProfileView[]
  candidateDids?: string[]; // Temp list for batch fetching
}
