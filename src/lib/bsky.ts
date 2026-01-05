import { get } from 'svelte/store';
import { session } from './auth/session';
import { IDS, type TriLinesEntry, type TriLinesLine, type TriLinesLike } from './types';
import { Agent, RichText, type BlobRef } from '@atproto/api';
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
  const sessionDid = get(session).did!;

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

  // 2. Initial Create of Custom Record (to get URI/Rkey)
  const initialRecord: Omit<TriLinesEntry, 'uri' | 'cid'> = {
    lines: processedLines,
    createdAt,
    sharedPost: undefined,
    authorDid: sessionDid,
    hubRef: HUB_URI
  };

  const { data: entryData } = await agent.api.com.atproto.repo.createRecord({
    repo: sessionDid,
    collection: IDS.TriLinesEntry,
    record: initialRecord as any,
  });

  const entryUri = entryData.uri;
  const entryCid = entryData.cid;
  const rkey = entryUri.split('/').pop();

  if (!rkey) throw new Error("Failed to generate rkey");

  let sharedPost;

  // 3. Share to Bluesky if requested
  if (shareToBluesky) {
    try {
      // Create a summary for the post
      const rawSummary = lines.map(l => l.text).join('\n');
      const summary = rawSummary.length > 200
        ? rawSummary.substring(0, 200) + '...'
        : rawSummary;

      // Get localized template and language code
      const currentLocale = get(locale);
      const template = get(t)('share.template');
      const entryUrl = `https://trilinesat.suibari.com/entry/${sessionDid}/${rkey}`;
      const postText = `${template}\n\n${summary}\n\n${entryUrl}\n\n#TriLinesAt`;

      const rt = new RichText({ text: postText });
      await rt.detectFacets(agent);

      const post = await agent.api.com.atproto.repo.createRecord({
        repo: sessionDid,
        collection: 'app.bsky.feed.post',
        record: {
          $type: 'app.bsky.feed.post',
          text: rt.text,
          facets: rt.facets,
          createdAt,
          langs: [currentLocale],
          embed: processedLines.filter(l => l.image).length > 0 ? {
            $type: 'app.bsky.embed.images',
            images: processedLines
              .filter(l => l.image)
              .slice(0, 4)
              .map(l => ({
                image: l.image!,
                alt: l.text.slice(0, 300) || "Diary Image" // Use line text as alt, truncated
              }))
          } : undefined
        },
      });
      sharedPost = { uri: post.data.uri, cid: post.data.cid };

      // 4. Update the Custom Record with sharedPost info
      const updatedRecord = {
        ...initialRecord,
        sharedPost
      };

      // We use applyWrites or putRecord. putRecord is simpler for single update.
      // But we need to use com.atproto.repo.putRecord
      await agent.api.com.atproto.repo.putRecord({
        repo: sessionDid,
        collection: IDS.TriLinesEntry,
        rkey: rkey,
        record: updatedRecord as any,
        swapRecord: entryCid // optimistic concurrency control
      });

    } catch (e) {
      console.warn("Failed to share to Bluesky or update record", e);
      // We don't fail the whole operation if sharing fails, 
      // but the user might want to know. For now, we return the entryData.
    }
  }

  // Return the initial entry data (or could return updated, but UI just needs URI usually)
  return entryData;
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

export async function getGlobalFeed(cursor?: string, limit = 50) {
  // Use Constellation to find all diary entries linking to the HUB_URI
  const endpoint = 'https://constellation.microcosm.blue/links';
  const url = new URL(endpoint);
  url.searchParams.set('target', HUB_URI);
  url.searchParams.set('collection', IDS.TriLinesEntry);
  url.searchParams.set('path', '.hubRef');
  url.searchParams.set('limit', limit.toString());
  if (cursor) {
    url.searchParams.set('cursor', cursor);
  }

  try {
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error('Constellation feed fetch failed');

    const data = await res.json();
    // Handle various Constellation response formats
    // If paginated, it might return { cursor: "...", links: [...] }
    const rawLinks = Array.isArray(data) ? data : (data.linking_records || data.links || []);
    const nextCursor = !Array.isArray(data) ? data.cursor : undefined;

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
        // console.warn("Failed to resolve global entry", e);
        return null;
      }
    }));

    // Filter out failed resolutions and sort
    const posts = entries.filter(Boolean) as any[];
    posts.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return { posts, cursor: nextCursor };
  } catch (e) {
    console.warn("Global feed fetch failed", e);
    return { posts: [], cursor: undefined };
  }
}

export async function getAllEntriesForRanking() {
  // Constellation links limit is typically 100, so we must loop.
  const MAX_ITEMS = 10000;
  let allPosts: any[] = [];
  let cursor: string | undefined = undefined;

  // Safety break to prevent infinite loops logic error
  let loops = 0;
  const MAX_LOOPS = 25; // 25 * 100 = 2500 approx

  do {
    // Determine limit for this request (try to get 100 at a time)
    const { posts, cursor: nextCursor } = await getGlobalFeed(cursor, 100);

    if (posts.length === 0) break;

    allPosts = [...allPosts, ...posts];
    cursor = nextCursor;
    loops++;

    // Break if we have enough or no more pages
    if (allPosts.length >= MAX_ITEMS) break;

  } while (cursor && loops < MAX_LOOPS);

  return allPosts;
}

// Helper to get profiles (ensures agent is available)
export async function getProfiles(actors: string[]) {
  const { session } = await import("$lib/auth/session");
  const s = get(session);
  if (!s.agent) throw new Error("Not authenticated");

  const chunks = [];
  for (let i = 0; i < actors.length; i += 25) {
    chunks.push(actors.slice(i, i + 25));
  }

  const results = await Promise.all(chunks.map(async (chunk) => {
    try {
      const { data } = await s.agent!.app.bsky.actor.getProfiles({
        actors: chunk,
      });
      return data.profiles;
    } catch (e) {
      console.warn("Failed to fetch profile chunk", chunk, e);
      return [];
    }
  }));

  const allProfiles = results.flat();

  return allProfiles.reduce((acc, p) => {
    acc[p.did] = p;
    return acc;
  }, {} as Record<string, any>);
}

export async function getFollows(did: string) {
  const agent = new Agent('https://api.bsky.app');
  let follows: any[] = [];
  let cursor: string | undefined;

  // Limit to 2000 users (20 loops * 100 limit)
  for (let i = 0; i < 20; i++) {
    const { data } = await agent.app.bsky.graph.getFollows({
      actor: did,
      limit: 100, // Max allowed per request
      cursor: cursor,
    });

    follows = [...follows, ...data.follows];
    cursor = data.cursor;

    if (!cursor) break;
  }

  return follows;
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
