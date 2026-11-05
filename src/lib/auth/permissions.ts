import { IDS } from '$lib/types';

// These collections changed during the NSID migration. Old grants remain valid
// for the legacy collections but cannot authorize writes to the new ones.
export function hasCurrentWritePermissions(scope: string): boolean {
  const scopes = scope.split(' ');
  if (scopes.includes('transition:generic')) return true;
  return [IDS.TriLinesEntry, IDS.TriLinesLike].every(collection =>
    scopes.some(grant => {
      if (!grant.startsWith('repo:')) return false;
      const [target, query] = grant.slice(5).split('?');
      if (target !== collection && target !== '*') return false;
      const actions = new URLSearchParams(query).getAll('action');
      return actions.length === 0 || ['create', 'update', 'delete'].every(action => actions.includes(action));
    })
  );
}

export function isPermissionError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const err = error as { status?: number; error?: string; message?: string };
  return err.status === 403 || /scope/i.test(err.error ?? '') || /scope/i.test(err.message ?? '');
}
