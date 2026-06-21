/**
 * storage.js
 * Wraps localForage (IndexedDB) with clean CRUD operations for
 * users, visits, photos, audio blobs, and app settings.
 */

import localforage from 'localforage';
import { generateId } from '../utils/helpers';

// ---------------------------------------------------------------------------
// Configure the localForage instance
// ---------------------------------------------------------------------------
localforage.config({
  name: 'field-visit-debrief',
  storeName: 'app_data',
  description: 'Field Visit Debrief Tool — offline data store',
});

// ========================== 1. User / Session ==============================

/**
 * Save the current user profile.
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
 * Remove user data (logout).
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
 * Save a new visit. Generates a unique ID, attaches timestamps, and
 * appends the visit to the persisted array.
 *
 * @param {{
 *   date: string,
 *   state: string,
 *   district: string,
 *   block: string,
 *   programArea: string,
 *   stakeholders: string[],
 *   notes: string,
 *   voiceTranscription: string | null,
 *   aiSummary: object | null,
 *   officerName: string
 * }} visitData
 * @returns {Promise<object>} The saved visit (including generated `id` and `createdAt`).
 */
export const saveVisit = async (visitData) => {
  try {
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
      createdAt: visitData.createdAt || new Date().toISOString(),
      updatedAt: visitData.updatedAt || new Date().toISOString(),
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
 * Get all visits, sorted by creation timestamp descending (newest first).
 * @returns {Promise<object[]>}
 */
export const getVisits = async () => {
  try {
    const visits = (await localforage.getItem('visits')) || [];
    return visits.sort((a, b) => {
      const timeA = new Date(a.createdAt || a.created_at || a.date).getTime();
      const timeB = new Date(b.createdAt || b.created_at || b.date).getTime();
      return timeB - timeA;
    });
  } catch (error) {
    console.error('[storage] getVisits failed:', error);
    return [];
  }
};

/**
 * Get a single visit by its ID.
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
 * Update an existing visit (e.g. to attach an AI summary).
 * Merges `updates` into the matched visit object.
 *
 * @param {string} id
 * @param {object} updates — fields to merge into the visit.
 * @returns {Promise<object | null>} The updated visit, or null if not found.
 */
export const updateVisit = async (id, updates) => {
  try {
    const visits = (await localforage.getItem('visits')) || [];
    const index = visits.findIndex((v) => v.id === id);
    if (index === -1) return null;

    // Force syncStatus to 'pending' unless explicitly set otherwise (e.g., when syncing)
    const newSyncStatus = updates.syncStatus || 'pending';
    visits[index] = { 
      ...visits[index], 
      ...updates, 
      updatedAt: updates.updatedAt || new Date().toISOString(),
      syncStatus: newSyncStatus
    };
    await localforage.setItem('visits', visits);
    return visits[index];
  } catch (error) {
    console.error('[storage] updateVisit failed:', error);
    throw error;
  }
};

/**
 * Delete a visit by its ID.
 * @param {string} id
 * @returns {Promise<boolean>} `true` if the visit existed and was removed.
 */
export const deleteVisit = async (id) => {
  try {
    const visits = (await localforage.getItem('visits')) || [];
    const filtered = visits.filter((v) => v.id !== id);

    if (filtered.length === visits.length) return false; // nothing removed

    await localforage.setItem('visits', filtered);

    return true;
  } catch (error) {
    console.error('[storage] deleteVisit failed:', error);
    throw error;
  }
};

/**
 * Get visits filtered by role.
 * - `field_officer` → only visits where `officerName` matches `userName`.
 * - `manager` → all visits (no filter).
 *
 * @param {string} role  — `'field_officer'` or `'manager'`
 * @param {string} userName — the current user's name (used for officer filter)
 * @returns {Promise<object[]>}
 */
export const getVisitsByRole = async (role, userName) => {
  try {
    const visits = await getVisits(); // already sorted
    if (role === 'field_officer') {
      return visits.filter((v) => v.officerName === userName);
    }
    return visits; // manager sees everything
  } catch (error) {
    console.error('[storage] getVisitsByRole failed:', error);
    return []; // manager sees everything
  }
};

/**
 * Save the entire list of visits directly (used for seeding).
 * @param {object[]} visitsList
 * @returns {Promise<void>}
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
 * Get the raw list of visits directly from localForage without sorting.
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

// Media storage removed per user specifications. Voice transcription is direct on-the-fly without storage.

// ============================= 5. Settings =================================

/** Default settings used when no persisted settings exist. */
const DEFAULT_SETTINGS = {
  groqApiKey: '',
};

/**
 * Save application settings.
 * @param {object} settings — e.g. `{ groqApiKey: '...' }`
 * @returns {Promise<object>} The saved settings.
 */
export const saveSettings = async (settings) => {
  try {
    const merged = { ...DEFAULT_SETTINGS, ...settings };
    await localforage.setItem('settings', merged);
    return merged;
  } catch (error) {
    console.error('[storage] saveSettings failed:', error);
    throw error;
  }
};

/**
 * Retrieve application settings.
 * Returns defaults when no settings have been saved yet.
 * @returns {Promise<object>}
 */
export const getSettings = async () => {
  try {
    const settings = await localforage.getItem('settings');
    return settings || { ...DEFAULT_SETTINGS };
  } catch (error) {
    console.error('[storage] getSettings failed:', error);
    return { ...DEFAULT_SETTINGS };
  }
};

// ============================== 6. Utility =================================

/**
 * Wipe **all** data from the store (used by the settings/reset page).
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
 * Gather high-level storage statistics.
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
