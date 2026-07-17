import { supabase, isSupabaseConfigured } from './supabase';
import { getVisitsRaw, saveVisitsList, updateVisit, getDeletedVisitIds, saveDeletedVisitIds } from './storage';
import { generateFieldDebrief } from './ai';

/** Returns true if the browser currently has a network connection. */
export const isOnline = () =>
  typeof navigator !== 'undefined' ? navigator.onLine : true;

/**
 * Synchronize deletion queue: permanently remove visits from Supabase that were deleted locally.
 * Keeps any IDs that failed to delete so they retry on the next sync cycle.
 */
export const syncDeletedVisits = async () => {
  if (!isOnline() || !isSupabaseConfigured()) return false;

  try {
    const deletedIds = await getDeletedVisitIds();
    if (deletedIds.length === 0) return true;

    console.log(`[Sync] Syncing ${deletedIds.length} deletion(s) to Supabase...`);

    const results = await Promise.allSettled(
      deletedIds.map(async (id) => {
        const { error } = await supabase.from('visits').delete().eq('id', id);
        if (error) {
          console.error(`[Sync] Failed to delete visit ${id} from Supabase:`, error.message);
          throw error;
        }
        return id;
      })
    );

    // Keep only the IDs that failed so they retry next cycle
    const remainingIds = deletedIds.filter((_, i) => results[i].status === 'rejected');
    await saveDeletedVisitIds(remainingIds);
    return true;
  } catch (err) {
    console.error('[Sync] syncDeletedVisits failed:', err);
    return false;
  }
};

/**
 * Upload all locally queued visits (syncStatus === 'pending') to Supabase.
 *
 * Deferred AI summaries are generated sequentially (not concurrently) before the
 * upsert batch — this prevents simultaneous Groq calls from hitting rate limits when
 * the device comes back online with several offline visits queued.
 */
export const syncPendingVisits = async () => {
  if (!isOnline() || !isSupabaseConfigured()) return false;

  try {
    const localVisits = await getVisitsRaw();
    const pending = localVisits.filter((v) => v.syncStatus === 'pending');

    if (pending.length === 0) return true;

    console.log(`[Sync] Pushing ${pending.length} pending visit(s) to Supabase...`);

    // Generate missing AI summaries sequentially to avoid concurrent rate-limit bursts
    for (const visit of pending) {
      if (!visit.aiSummary) {
        try {
          const aiResult = await generateFieldDebrief(visit);
          if (aiResult) {
            visit.aiSummary = aiResult;
            // Patch local record without touching syncStatus
            await updateVisit(visit.id, { aiSummary: aiResult });
          }
        } catch (aiErr) {
          console.warn(`[Sync] Deferred AI summary failed for visit ${visit.id}:`, aiErr);
        }
      }
    }

    // Batch upsert all pending visits (with or without an AI summary)
    await Promise.allSettled(
      pending.map(async (visit) => {
        const { syncStatus, ...supabasePayload } = visit;

        const { error } = await supabase.from('visits').upsert(supabasePayload);
        if (error) {
          console.error(`[Sync] Upload failed for visit ${visit.id}:`, error.message);
          return;
        }

        await updateVisit(visit.id, { syncStatus: 'synced' });
      })
    );

    return true;
  } catch (err) {
    console.error('[Sync] syncPendingVisits failed:', err);
    return false;
  }
};

/**
 * Pull visits from Supabase (last 30 days) and merge into local IndexedDB.
 * Remote wins only when the local copy is already synced and remote is newer.
 */
export const pullVisitsFromSupabase = async () => {
  if (!isOnline() || !isSupabaseConfigured()) return false;

  try {
    // Limit pull to the last 30 days — avoids fetching the entire history on every cycle
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: remoteVisits, error } = await supabase
      .from('visits')
      .select('*')
      .gte('updatedAt', thirtyDaysAgo)
      .order('updatedAt', { ascending: false });

    if (error) {
      console.error('[Sync] Failed to pull from Supabase:', error.message);
      return false;
    }

    if (!remoteVisits?.length) return true;

    const localVisits = await getVisitsRaw();
    const deletedIds = await getDeletedVisitIds();
    let changed = false;
    const merged = [...localVisits];

    remoteVisits.forEach((remote) => {
      // Never re-import a locally deleted visit
      if (deletedIds.includes(remote.id)) return;

      const idx = merged.findIndex((v) => v.id === remote.id);

      if (idx === -1) {
        merged.push({ ...remote, syncStatus: 'synced' });
        changed = true;
      } else {
        const local = merged[idx];
        // Only overwrite if local is already clean and remote is genuinely newer
        if (local.syncStatus === 'synced') {
          const remoteTs = new Date(remote.updatedAt || remote.createdAt || remote.date).getTime();
          const localTs = new Date(local.updatedAt || local.createdAt || local.date).getTime();
          if (remoteTs > localTs) {
            merged[idx] = { ...remote, syncStatus: 'synced' };
            changed = true;
          }
        }
      }
    });

    if (changed) {
      await saveVisitsList(merged);
      console.log('[Sync] Local database updated with remote changes.');
    }

    return true;
  } catch (err) {
    console.error('[Sync] pullVisitsFromSupabase failed:', err);
    return false;
  }
};

/**
 * Mark any local visits missing from Supabase as 'pending' so they re-upload.
 * Uses a lightweight id-only query to minimise data transfer.
 */
export const reconcileMissingVisits = async () => {
  if (!isOnline() || !isSupabaseConfigured()) return false;

  try {
    const { data: remoteVisits, error } = await supabase.from('visits').select('id');

    if (error) {
      console.error('[Sync] Reconcile fetch failed:', error.message);
      return false;
    }

    const remoteIds = new Set(remoteVisits.map((v) => v.id));
    const localVisits = await getVisitsRaw();
    let updated = false;

    const reconciled = localVisits.map((visit) => {
      if (!remoteIds.has(visit.id) && visit.syncStatus !== 'pending') {
        updated = true;
        return { ...visit, syncStatus: 'pending' };
      }
      return visit;
    });

    if (updated) {
      console.log('[Sync] Marking orphaned local visits as pending...');
      await saveVisitsList(reconciled);
    }

    return true;
  } catch (err) {
    console.error('[Sync] reconcileMissingVisits failed:', err);
    return false;
  }
};

/**
 * Full sync cycle: reconcile → push deletes → push pending → pull remote.
 * Each step dispatches a 'sync-completed' CustomEvent on success so components
 * can independently refresh — partial success (e.g. pull fails) still triggers
 * a refresh after a successful push.
 */
export const syncAll = async () => {
  if (!isOnline() || !isSupabaseConfigured()) {
    return { success: false, reason: 'offline_or_not_configured' };
  }

  await syncDeletedVisits();
  await reconcileMissingVisits();

  const pushed = await syncPendingVisits();
  if (pushed) window.dispatchEvent(new CustomEvent('sync-completed'));

  const pulled = await pullVisitsFromSupabase();
  if (pulled) window.dispatchEvent(new CustomEvent('sync-completed'));

  return { success: pushed && pulled };
};

/** Count visits queued for upload. */
export const getPendingSyncCount = async () => {
  try {
    const visits = await getVisitsRaw();
    return visits.filter((v) => v.syncStatus === 'pending').length;
  } catch {
    return 0;
  }
};

/**
 * Register online/focus event listeners for background sync.
 * Call once from the app shell (Layout) — not auto-run on import.
 */
export const initSyncListeners = () => {
  if (typeof window === 'undefined') return;

  window.addEventListener('online', () => {
    console.log('[Sync] Device is online, triggering background synchronization...');
    syncAll();
  });

  let lastFocusSyncTime = 0;
  const FOCUS_SYNC_COOLDOWN = 60_000; // 60 seconds

  window.addEventListener('focus', () => {
    const now = Date.now();
    if (isOnline() && now - lastFocusSyncTime > FOCUS_SYNC_COOLDOWN) {
      lastFocusSyncTime = now;
      console.log('[Sync] Tab focused, running background sync (cooldown active)');
      syncPendingVisits();
    }
  });
};
