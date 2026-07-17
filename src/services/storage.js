/**
 * storage.js
 * Wraps localForage (IndexedDB) with clean CRUD operations for
 * users, visits, drafts, and app settings.
 */

import localforage from 'localforage';
import { generateId } from '../utils/helpers';

localforage.config({
  name: 'groundtruth',
  storeName: 'app_data',
  description: 'GroundTruth — offline data store',
});

// ========================== 1. User / Session ==============================

/**
 * Persist the current user profile.
 * @param {{ name: string, role: string }} userData
 * @returns {Promise<{ name: string, role: string, createdAt: string }>}
 */
export const saveUser = async (userData) => {
  try {
    const user = {
      name: userData.name,
      role: userData.role,
      createdAt: userData.createdAt || new Date().toISOString(),
    };
    await localforage.setItem('user', user);
    return user;
  } catch (error) {
    console.error('[storage] saveUser failed:', error);
    throw error;
  }
};

/**
 * Retrieve the current user profile.
 * @returns {Promise<{ name: string, role: string, createdAt: string } | null>}
 */
export const getUser = async () => {
  try {
    return await localforage.getItem('user');
  } catch (error) {
    console.error('[storage] getUser failed:', error);
    return null;
  }
};

/**
 * Remove user session (logout).
 * @returns {Promise<void>}
 */
export const clearUser = async () => {
  try {
    await localforage.removeItem('user');
  } catch (error) {
    console.error('[storage] clearUser failed:', error);
    throw error;
  }
};

// ============================== 2. Visits ==================================

/**
 * Save a new visit. Generates a unique ID and timestamps.
 * @param {object} visitData
 * @returns {Promise<object>} The saved visit with generated `id` and `createdAt`.
 */
export const saveVisit = async (visitData) => {
  try {
    const now = new Date().toISOString();
    const visit = {
      id: generateId(),
      date: visitData.date,
      state: visitData.state,
      district: visitData.district,
      block: visitData.block,
      programArea: visitData.programArea,
      stakeholders: visitData.stakeholders || [],
      notes: visitData.notes || '',
      voiceTranscription: visitData.voiceTranscription || null,
      aiSummary: visitData.aiSummary || null,
      officerName: visitData.officerName || '',
      createdAt: visitData.createdAt || now,
      updatedAt: visitData.updatedAt || now,
      syncStatus: visitData.syncStatus || 'pending',
    };

    const visits = (await localforage.getItem('visits')) || [];
    visits.push(visit);
    await localforage.setItem('visits', visits);
    return visit;
  } catch (error) {
    console.error('[storage] saveVisit failed:', error);
    throw error;
  }
};

/**
 * Get all visits sorted by creation timestamp descending (newest first).
 * @returns {Promise<object[]>}
 */
export const getVisits = async () => {
  try {
    const visits = (await localforage.getItem('visits')) || [];
    return visits.sort((a, b) => {
      const tA = new Date(a.createdAt || a.created_at || a.date).getTime();
      const tB = new Date(b.createdAt || b.created_at || b.date).getTime();
      return tB - tA;
    });
  } catch (error) {
    console.error('[storage] getVisits failed:', error);
    return [];
  }
};

/**
 * Get a single visit by ID.
 * @param {string} id
 * @returns {Promise<object | null>}
 */
export const getVisitById = async (id) => {
  try {
    const visits = (await localforage.getItem('visits')) || [];
    return visits.find((v) => v.id === id) || null;
  } catch (error) {
    console.error('[storage] getVisitById failed:', error);
    return null;
  }
};

/**
 * Merge `updates` into an existing visit.
 * `syncStatus` is only touched when explicitly included in `updates` —
 * this prevents AI summary patches from silently re-queuing already-synced visits.
 *
 * @param {string} id
 * @param {object} updates
 * @returns {Promise<object | null>} Updated visit, or null if not found.
 */
export const updateVisit = async (id, updates) => {
  try {
    const visits = (await localforage.getItem('visits')) || [];
    const index = visits.findIndex((v) => v.id === id);
    if (index === -1) return null;

    visits[index] = {
      ...visits[index],
      ...updates,
      updatedAt: updates.updatedAt || new Date().toISOString(),
      // Only update syncStatus if the caller explicitly provides it;
      // otherwise preserve whatever the visit already has.
      ...(updates.syncStatus !== undefined && { syncStatus: updates.syncStatus }),
    };

    await localforage.setItem('visits', visits);
    return visits[index];
  } catch (error) {
    console.error('[storage] updateVisit failed:', error);
    throw error;
  }
};

/**
 * Delete a visit by ID and queue it for cloud synchronization.
 * @param {string} id
 * @returns {Promise<boolean>} true if the visit was found and removed.
 */
export const deleteVisit = async (id) => {
  try {
    const visits = (await localforage.getItem('visits')) || [];
    const filtered = visits.filter((v) => v.id !== id);
    if (filtered.length === visits.length) return false;
    await localforage.setItem('visits', filtered);

    // Queue the visit ID for deletion on Supabase
    const deletedIds = (await localforage.getItem('deletedVisitIds')) || [];
    if (!deletedIds.includes(id)) {
      deletedIds.push(id);
      await localforage.setItem('deletedVisitIds', deletedIds);
    }
    return true;
  } catch (error) {
    console.error('[storage] deleteVisit failed:', error);
    throw error;
  }
};

/** Get the list of visit IDs queued for remote deletion. */
export const getDeletedVisitIds = async () => {
  try {
    return (await localforage.getItem('deletedVisitIds')) || [];
  } catch {
    return [];
  }
};

/** Save the list of visit IDs queued for remote deletion. */
export const saveDeletedVisitIds = async (ids) => {
  try {
    await localforage.setItem('deletedVisitIds', ids);
  } catch (error) {
    console.error('[storage] saveDeletedVisitIds failed:', error);
    throw error;
  }
};

/**
 * Get visits filtered by role.
 * - field_officer → only visits belonging to `userName`
 * - manager → all visits
 * @param {string} role
 * @param {string} userName
 * @returns {Promise<object[]>}
 */
export const getVisitsByRole = async (role, userName) => {
  try {
    const visits = await getVisits();
    if (role === 'field_officer') {
      return visits.filter((v) => v.officerName === userName);
    }
    return visits;
  } catch (error) {
    console.error('[storage] getVisitsByRole failed:', error);
    return [];
  }
};

/**
 * Overwrite the entire visits list (used by the sync engine for bulk merges).
 * @param {object[]} visitsList
 */
export const saveVisitsList = async (visitsList) => {
  try {
    await localforage.setItem('visits', visitsList);
  } catch (error) {
    console.error('[storage] saveVisitsList failed:', error);
    throw error;
  }
};

/**
 * Get the raw visits array without sorting (used by the sync engine).
 * @returns {Promise<object[]>}
 */
export const getVisitsRaw = async () => {
  try {
    return (await localforage.getItem('visits')) || [];
  } catch (error) {
    console.error('[storage] getVisitsRaw failed:', error);
    return [];
  }
};

// ============================== 3. Draft Autosave ==========================

/**
 * Persist a partial form state as a draft so nothing is lost on accidental refresh.
 * @param {object} draftData - Partial NewVisit form state
 * @returns {Promise<void>}
 */
export const saveDraft = async (draftData) => {
  try {
    await localforage.setItem('visit_draft', draftData);
  } catch (error) {
    console.error('[storage] saveDraft failed:', error);
  }
};

/**
 * Retrieve a previously saved draft, or null if none exists.
 * @returns {Promise<object | null>}
 */
export const getDraft = async () => {
  try {
    return await localforage.getItem('visit_draft');
  } catch (error) {
    console.error('[storage] getDraft failed:', error);
    return null;
  }
};

/**
 * Remove the draft after a successful form submission.
 * @returns {Promise<void>}
 */
export const clearDraft = async () => {
  try {
    await localforage.removeItem('visit_draft');
  } catch (error) {
    console.error('[storage] clearDraft failed:', error);
  }
};

// ============================== 4. Utility =================================

/**
 * Wipe all data from the store (used by the settings reset action).
 * @returns {Promise<void>}
 */
export const clearAllData = async () => {
  try {
    await localforage.clear();
  } catch (error) {
    console.error('[storage] clearAllData failed:', error);
    throw error;
  }
};

/**
 * Return high-level storage statistics.
 * @returns {Promise<{ visitCount: number, hasUser: boolean }>}
 */
export const getStorageStats = async () => {
  try {
    const visits = (await localforage.getItem('visits')) || [];
    return {
      visitCount: visits.length,
      hasUser: !!(await localforage.getItem('user')),
    };
  } catch (error) {
    console.error('[storage] getStorageStats failed:', error);
    return { visitCount: 0, hasUser: false };
  }
};
