import { get } from 'svelte/store';
import { session } from './auth/session';
import { IDS, type TriLinesEntry, type TriLinesLine, type TriLinesLike } from './types';
import { Agent, type BlobRef } from '@atproto/api';
import { t, locale } from './i18n';

// HUB_URI is the target for Global Feed aggregation via Constellation.
// We link to the Developer's Profile Record (or a system DID) to ensure it's indexed.
const HUB_URI = 'at://did:plc:uixgxpiqf4i63p6rgpu7ytmx/app.bsky.actor.profile/self';

// Helper to get agent or throw
function getAgent(): Agent {
  const s = get(session);
  if (!s.agent) throw new Error('Not authenticated');
  return s.agent;
}

export async function uploadImage(blob: Blob): Promise<BlobRef> {
  const agent = getAgent();
  const { data } = await agent.uploadBlob(blob, { encoding: blob.type });
  return data.blob;
}

export async function createDiary(lines: { text: string; image?: Blob }[], shareToBluesky: boolean) {
  const agent = getAgent();

  // 1. Upload images
  const processedLines: TriLinesLine[] = [];
  for (const line of lines) {
    let imageBlob: BlobRef | undefined;
    if (line.image) {
      imageBlob = await uploadImage(line.image);
    }
    processedLines.push({
      text: line.text,
      image: imageBlob
    });
  }

  const createdAt = new Date().toISOString();
  let sharedPost;

  // 2. Share to Bluesky if requested
  if (shareToBluesky) {
    // Create a summary for the post
    const summary = lines.map(l => l.text).join('\n').substring(0, 200) + '...';

    // Get localized template and language code
    const currentLocale = get(locale);
    const template = get(t)('share.template');
    const postText = `${template}\n\n${summary}\n\n#TriLinesAt`;

    // Using createRecord directly is more robust than agent.post helper with OAuth sessions
    const post = await agent.api.com.atproto.repo.createRecord({
      repo: get(session).did!,
      collection: 'app.bsky.feed.post',
      record: {
        $type: 'app.bsky.feed.post',
        text: postText,
        createdAt,
        langs: [currentLocale],
      },
    });
    sharedPost = { uri: post.data.uri, cid: post.data.cid };
  }

  // 3. Create the Custom Record
  const record: Omit<TriLinesEntry, 'uri' | 'cid'> = {
    lines: processedLines,
    createdAt,
    sharedPost,
    authorDid: get(session).did!,
    hubRef: HUB_URI
  };

  const res = await agent.api.com.atproto.repo.createRecord({
    repo: get(session).did!,
    collection: IDS.TriLinesEntry,
    record: record as any,
  });

  return res;
}

export async function deleteRecord(uri: string) {
  const agent = getAgent();
  const sessionDid = get(session).did;

  if (!sessionDid) throw new Error("Not authenticated");

  // Parse URI to get collection and rkey
  // at://did/collection/rkey
  const parts = uri.split('/');
  const rkey = parts.pop();
  const collection = parts.pop();
  const repo = parts.pop();

  if (!repo || !collection || !rkey) throw new Error("Invalid URI");
  if (repo !== sessionDid) throw new Error("Cannot delete other user's post");

  await agent.api.com.atproto.repo.deleteRecord({
    repo,
    collection,
    rkey
  });
}

// Helper to get PDS endpoint
export async function getPds(did: string): Promise<string> {
  if (did.startsWith("did:plc:")) {
    const res = await fetch(`https://plc.directory/${did}`);
    if (!res.ok) throw new Error(`Failed to fetch PLC document: ${res.statusText}`);
    const doc = await res.json();
    const service = doc.service?.findLast((s: any) => s.type === "AtprotoPersonalDataServer");
    if (!service?.serviceEndpoint) throw new Error("PDS not found");
    return service.serviceEndpoint;
  } else if (did.startsWith("did:web:")) {
    const domain = did.replace('did:web:', '');
    const res = await fetch(`https://${domain}/.well-known/did.json`);
    if (!res.ok) throw new Error(`Failed to fetch DID document: ${res.statusText}`);
    const doc = await res.json();
    const service = doc.service?.findLast((s: any) => s.type === "AtprotoPersonalDataServer");
    if (!service?.serviceEndpoint) throw new Error("PDS not found");
    return service.serviceEndpoint;
  }
  throw new Error("Unsupported DID method");
}

export async function getEntries(did: string) {
  let agent = getAgent();

  // If getting someone else's entries, we might need their PDS
  // Optimization: If DID matches session DID, use existing authed agent (already on correct PDS)
  const sessionDid = get(session).did;

  if (did !== sessionDid) {
    // Only resolve PDS if it's NOT the current user
    try {
      const pds = await getPds(did);
      if (pds) {
        // Check if current agent is already on this PDS? (Assuming bsky.social default)
        // Actually, just creating a new unauthed agent for public read is fine for OTHER users.
        agent = new Agent(pds);
      }
    } catch (e) {
      console.warn('Failed to resolve PDS, trying default agent', e);
    }
  }

  const { data } = await agent.api.com.atproto.repo.listRecords({
    repo: did,
    collection: IDS.TriLinesEntry,
    limit: 20
  });
  return data.records.map((r: any) => ({
    ...r.value,
    uri: r.uri,
    cid: r.cid
  }));
}

// HUB_URI is the target for Global Feed aggregation via Constellation.
// We link to the Developer's Profile Record to ensure it's indexed as a valid backlink.

export async function getGlobalFeed() {
  // Use Constellation to find all diary entries linking to the HUB_URI
  const endpoint = 'https://constellation.microcosm.blue/links';
  const url = new URL(endpoint);
  url.searchParams.set('target', HUB_URI);
  url.searchParams.set('collection', IDS.TriLinesEntry);
  url.searchParams.set('path', '.hubRef');

  try {
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error('Constellation feed fetch failed');

    const data = await res.json();
    // Handle various Constellation response formats
    const rawLinks = Array.isArray(data) ? data : (data.linking_records || data.links || []);

    // Constellation minimal format check
    // Some responses only give {did, collection, rkey}. We need to fetch the actual records.
    const pdsCache: Record<string, string> = {};

    const entries = await Promise.all(rawLinks.map(async (item: any) => {
      try {
        // Normalize fields (Constellation varies between 'author'/'did' and 'uri'/'rkey')
        let did = item.author || item.did;
        const collection = item.collection || IDS.TriLinesEntry;
        const rkey = item.rkey || item.uri?.split('/').pop();

        // Ensure DID is a DID, not a handle
        if (did && !did.startsWith('did:')) {
          // Try to resolve handle
          try {
            // We can use the public agent for resolution if needed, 
            // but Constellation usually sends DIDs.
            // If we really got a handle, we must resolve it to get a canonical URI.
            const ag = new Agent('https://public.api.bsky.app'); // or bsky.social
            const { data } = await ag.resolveHandle({ handle: did });
            did = data.did;
          } catch {
            // if fail, keep as is (might fail later)
            console.warn(`Failed to resolve handle ${did} to DID`);
          }
        }

        const uri = item.uri || `at://${did}/${collection}/${rkey}`;

        // If we have the full value, use it
        if (item.value) {
          return {
            ...item.value,
            uri,
            cid: item.cid,
            authorDid: did,
          };
        }

        // Otherwise, we MUST fetch it from a PDS
        // We try to resolve the specific PDS for this user
        let pds = pdsCache[did];
        if (!pds) {
          try {
            pds = await getPds(did);
            pdsCache[did] = pds;
          } catch {
            pds = 'https://bsky.social'; // Fallback
          }
        }

        const pdsAgent = new Agent(pds);
        const { data: record } = await pdsAgent.api.com.atproto.repo.getRecord({
          repo: did,
          collection: collection,
          rkey: rkey,
        });

        return {
          ...record.value,
          uri: record.uri,
          cid: record.cid,
          authorDid: did,
        };
      } catch (e) {
        console.warn("Failed to resolve global entry", e);
        return null;
      }
    }));

    // Filter out failed resolutions and sort
    const posts = entries.filter(Boolean) as any[];
    posts.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return posts;
  } catch (e) {
    console.warn("Global feed fetch failed", e);
    return [];
  }
}

export async function getFollows(did: string) {
  const agent = new Agent('https://api.bsky.app');
  const { data } = await agent.app.bsky.graph.getFollows({
    actor: did,
    limit: 50,
  });
  return data.follows;
}

export async function likeEntry(uri: string, cid: string) {
  const agent = getAgent();
  const sessionDid = get(session).did;
  if (!sessionDid) throw new Error("Not authenticated");

  const record: TriLinesLike = {
    subject: { uri, cid },
    createdAt: new Date().toISOString()
  };

  const { data } = await agent.api.com.atproto.repo.createRecord({
    repo: sessionDid,
    collection: IDS.TriLinesLike,
    record: record as any
  });
  return data;
}

export async function unlikeEntry(uri: string) {
  const agent = getAgent();
  // Parse URI to get repo, collection, rkey
  const parts = uri.split('/');
  const rkey = parts.pop();
  const collection = parts.pop();
  const repo = parts.pop();

  if (!repo || !collection || !rkey) throw new Error("Invalid URI");

  await agent.api.com.atproto.repo.deleteRecord({
    repo,
    collection,
    rkey
  });
}

export async function getEntryLikes(uri: string) {
  if (!uri) return [];
  // Use Constellation to find likes
  // links?target={uri}&collection={collection}&path={path}
  const endpoint = 'https://constellation.microcosm.blue/links';
  const url = new URL(endpoint);
  url.searchParams.set('target', uri);
  url.searchParams.set('collection', IDS.TriLinesLike);
  url.searchParams.set('path', '.subject.uri');

  const res = await fetch(url.toString());
  if (!res.ok) {
    console.warn("Constellation fetch failed", res.status);
    return [];
  }
  const data = await res.json();
  // Constellation /links endpoint typically returns an array of links.
  // Newer XRPC endpoints might return { links: [...] } or { linking_records: [...] }.
  // We handle both for robustness.
  if (Array.isArray(data)) return data;
  return data.linking_records || (data as any).links || [];
}

export function getBlobUrl(did: string, blob: BlobRef): string {
  return `https://cdn.bsky.app/img/feed_fullsize/plain/${did}/${blob.ref.toString()}@jpeg`;
}
