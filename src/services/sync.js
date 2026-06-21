import { supabase, isSupabaseConfigured } from './supabase';
import { getVisitsRaw, saveVisitsList, updateVisit } from './storage';
import { generateFieldDebrief } from './ai';

// Helper to check browser connectivity
export const isOnline = () => {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
};

/**
 * Upload all locally queued visits (syncStatus === 'pending') to Supabase.
 * Local changes win and upsert into the remote database.
 */
export const syncPendingVisits = async () => {
  if (!isOnline() || !isSupabaseConfigured()) {
    return false;
  }

  try {
    const localVisits = await getVisitsRaw();
    const pending = localVisits.filter(v => v.syncStatus === 'pending');

    if (pending.length === 0) {
      return true;
    }

    console.log(`[Sync] Pushing ${pending.length} pending visits to Supabase...`);

    for (const visit of pending) {
      let visitToUpload = { ...visit };

      // If the visit was saved offline without an AI summary, generate it now!
      if (!visitToUpload.aiSummary) {
        console.log(`[Sync] Generating deferred AI summary for visit ${visit.id}...`);
        try {
          const aiResult = await generateFieldDebrief(visitToUpload);
          if (aiResult) {
            visitToUpload.aiSummary = aiResult;
            // Update local storage with the generated summary
            await updateVisit(visit.id, { aiSummary: aiResult });
          }
        } catch (aiErr) {
          console.warn(`[Sync] Failed to generate AI summary for visit ${visit.id}:`, aiErr);
        }
      }

      // Omit the local-only syncStatus flag when writing to database
      const { syncStatus, ...supabasePayload } = visitToUpload;

      const { error } = await supabase
        .from('visits')
        .upsert(supabasePayload);

      if (error) {
        console.error(`[Sync] Failed to upload visit ${visit.id}:`, error.message);
        // Continue with other visits, don't halt the entire queue
        continue;
      }

      // Mark local copy as synced
      await updateVisit(visit.id, { syncStatus: 'synced' });
    }

    return true;
  } catch (err) {
    console.error('[Sync] syncPendingVisits failed:', err);
    return false;
  }
};

/**
 * Pull all visits from Supabase and merge them into local IndexedDB.
 * Ensures the device has the latest data logged on other devices.
 */
export const pullVisitsFromSupabase = async () => {
  if (!isOnline() || !isSupabaseConfigured()) {
    return false;
  }

  try {
    console.log('[Sync] Fetching latest visits from Supabase...');
    const { data: remoteVisits, error } = await supabase
      .from('visits')
      .select('*');

    if (error) {
      console.error('[Sync] Failed to pull from Supabase:', error.message);
      return false;
    }

    if (!remoteVisits || remoteVisits.length === 0) {
      return true;
    }

    const localVisits = await getVisitsRaw();
    let localChanged = false;
    const mergedList = [...localVisits];

    remoteVisits.forEach(remote => {
      const localIndex = mergedList.findIndex(v => v.id === remote.id);

      if (localIndex === -1) {
        // Visit doesn't exist locally — insert it
        mergedList.push({
          ...remote,
          syncStatus: 'synced'
        });
        localChanged = true;
      } else {
        const local = mergedList[localIndex];
        
        // Only overwrite local if it is already synced (no unsaved offline edits)
        // AND remote has a newer updatedAt timestamp
        if (local.syncStatus === 'synced') {
          const remoteTime = new Date(remote.updatedAt || remote.created_at).getTime();
          const localTime = new Date(local.updatedAt || local.createdAt).getTime();
 
          if (remoteTime > localTime) {
            mergedList[localIndex] = {
              ...remote,
              syncStatus: 'synced'
            };
            localChanged = true;
          }
        }
      }
    });

    if (localChanged) {
      await saveVisitsList(mergedList);
      console.log('[Sync] Local database updated with remote changes');
    }

    return true;
  } catch (err) {
    console.error('[Sync] pullVisitsFromSupabase failed:', err);
    return false;
  }
};

/**
 * Reconciles local and remote databases. If a visit exists locally but is
 * missing from the remote database, it is marked as 'pending' so it will sync.
 */
export const reconcileMissingVisits = async () => {
  if (!isOnline() || !isSupabaseConfigured()) {
    return false;
  }

  try {
    const { data: remoteVisits, error } = await supabase
      .from('visits')
      .select('id');

    if (error) {
      console.error('[Sync] Failed to fetch remote IDs for reconciliation:', error.message);
      return false;
    }

    const remoteIds = new Set(remoteVisits.map(v => v.id));
    const localVisits = await getVisitsRaw();
    let updated = false;

    const reconciledVisits = localVisits.map(visit => {
      if (!remoteIds.has(visit.id) && visit.syncStatus !== 'pending') {
        updated = true;
        return { ...visit, syncStatus: 'pending' };
      }
      return visit;
    });

    if (updated) {
      console.log(`[Sync] Found local visits missing from remote database. Marking them as pending...`);
      await saveVisitsList(reconciledVisits);
    }

    return true;
  } catch (err) {
    console.error('[Sync] reconcileMissingVisits failed:', err);
    return false;
  }
};

/**
 * Run a full sync cycle: reconcile missing visits, push pending visits, then pull remote visits.
 * Dispatches a 'sync-completed' window event on success.
 */
export const syncAll = async () => {
  if (!isOnline() || !isSupabaseConfigured()) {
    return { success: false, reason: 'offline_or_not_configured' };
  }

  // 1. Mark any local visits not yet present in Supabase as pending
  await reconcileMissingVisits();

  // 2. Push pending visits and pull remote visits
  const pushed = await syncPendingVisits();
  const pulled = await pullVisitsFromSupabase();

  const success = pushed && pulled;
  if (success) {
    // Notify components to refresh their lists
    window.dispatchEvent(new CustomEvent('sync-completed'));
  }

  return { success };
};

/**
 * Get count of visits currently queued for upload.
 */
export const getPendingSyncCount = async () => {
  try {
    const visits = await getVisitsRaw();
    return visits.filter(v => v.syncStatus === 'pending').length;
  } catch (err) {
    return 0;
  }
};

// --- Automatic listeners ---
if (typeof window !== 'undefined') {
  // Listen for browser coming online
  window.addEventListener('online', () => {
    console.log('[Sync] Device is online, triggering background synchronization...');
    syncAll();
  });

  let lastFocusSyncTime = 0;
  const FOCUS_SYNC_COOLDOWN = 60000; // 60 seconds

  // Trigger sync on tab focus or initial load
  window.addEventListener('focus', () => {
    const now = Date.now();
    if (isOnline() && (now - lastFocusSyncTime > FOCUS_SYNC_COOLDOWN)) {
      lastFocusSyncTime = now;
      console.log('[Sync] Tab focused, running background sync (cooldown active)');
      syncPendingVisits();
    }
  });
}
