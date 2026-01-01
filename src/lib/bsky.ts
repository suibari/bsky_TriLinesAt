import { get } from 'svelte/store';
import { session } from './auth/session';
import { IDS, type TriLinesEntry, type TriLinesLine } from './types';
import { Agent, type BlobRef } from '@atproto/api';

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
    const postText = `My 3-Line Diary for today.\n\n${summary}\n\n#TriLinesAt`;

    // Post logic (RichText would be better for links, but simple text for MVP)
    const post = await agent.post({
      text: postText,
      createdAt,
      // We would attach a link card (external embed) here ideally
    });
    sharedPost = { uri: post.uri, cid: post.cid };
  }

  // 3. Create the Custom Record
  const record: Omit<TriLinesEntry, 'uri' | 'cid'> = {
    lines: processedLines,
    createdAt,
    sharedPost
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

export async function getGlobalFeed() {
  // Global feed (Search) works on AppView.
  // Use api.bsky.app (AppView) for public unauthenticated search to avoid CORS/Auth issues.
  const agent = new Agent('https://api.bsky.app');
  const { data } = await agent.app.bsky.feed.searchPosts({
    q: '#TriLinesAt',
    sort: 'latest',
    limit: 30
  });
  return data.posts;
}

export async function getFollows(did: string) {
  // Follows are usually on AppView, and often public.
  // Use api.bsky.app for robust public fetching.
  const agent = new Agent('https://api.bsky.app');

  // Just fetch first 50 for MVP to avoid rate limits
  const { data } = await agent.app.bsky.graph.getFollows({
    actor: did,
    limit: 50,
  });
  return data.follows;
}

export async function getTimeline(follows: string[]) {
  // Fetch in parallel batches
  const results: any[] = [];
  const batchSize = 5;

  // Cache PDS URLs to avoid redundant lookups (many users might be on bsky.social)
  // Simple in-memory cache for this call
  const pdsCache: Record<string, string> = {};

  for (console.log('Fetching batch...'); ;) {
    const batch = follows.splice(0, batchSize);
    if (batch.length === 0) break;

    const promises = batch.map(async (did) => {
      try {
        // Optimization: Use authed agent for self
        const sessionDid = get(session).did;
        if (did === sessionDid && get(session).agent) {
          const r = await get(session).agent!.api.com.atproto.repo.listRecords({
            repo: did,
            collection: IDS.TriLinesEntry,
            limit: 5
          });
          return { did, records: r.data.records };
        }

        let serviceUrl = pdsCache[did];
        if (!serviceUrl) {
          try {
            serviceUrl = await getPds(did);
            pdsCache[did] = serviceUrl;
          } catch {
            serviceUrl = 'https://bsky.social'; // Fallback
          }
        }

        const agent = new Agent(serviceUrl);
        const r = await agent.api.com.atproto.repo.listRecords({
          repo: did,
          collection: IDS.TriLinesEntry,
          limit: 5
        });
        return { did, records: r.data.records };
      } catch (e) {
        console.warn(`Failed to fetch for ${did}`, e);
        return { did, records: [] };
      }
    });

    const chunk = await Promise.all(promises);
    results.push(...chunk);
  }

  // Flatten and sort
  const allEntries = results.flatMap(r =>
    r.records.map((rec: any) => ({
      ...rec.value,
      uri: rec.uri,
      cid: rec.cid,
      authorDid: r.did
    }))
  );

  allEntries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return allEntries;
}

export function getBlobUrl(did: string, blob: BlobRef): string {
  return `https://cdn.bsky.app/img/feed_fullsize/plain/${did}/${blob.ref.toString()}@jpeg`;
}
