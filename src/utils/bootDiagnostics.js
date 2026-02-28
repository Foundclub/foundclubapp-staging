const BOOT_ERROR_STORAGE_KEY = 'boot:last-js-error';

/** @type {import('react-native-mmkv').MMKV | null} */
let bootStorageInstance = null;

const getBootStorage = () => {
  if (bootStorageInstance) return bootStorageInstance;

  try {
    const { MMKV } = require('react-native-mmkv');
    bootStorageInstance = new MMKV({
      id: 'boot-diagnostics-storage',
    });
  } catch (error) {
    console.warn('[BOOT] BOOT_STORAGE_INIT_FAILED', {
      error: error?.message || 'unknown',
    });
    bootStorageInstance = null;
  }

  return bootStorageInstance;
};

/**
 * @param {{
 *  context: string;
 *  isFatal: boolean;
 *  message: string;
 *  name: string;
 *  stack: string;
 *  timestamp: string;
 * }} payload
 */
export const persistBootError = (payload) => {
  try {
    const storage = getBootStorage();
    if (!storage) return;
    storage.set(BOOT_ERROR_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('[BOOT] BOOT_STORAGE_WRITE_FAILED', {
      error: error?.message || 'unknown',
    });
  }
};

/** @returns {null | {
 *  context: string;
 *  isFatal: boolean;
 *  message: string;
 *  name: string;
 *  stack: string;
 *  timestamp: string;
 * }} */
export const readPersistedBootError = () => {
  try {
    const storage = getBootStorage();
    if (!storage) return null;
    const raw = storage.getString(BOOT_ERROR_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.warn('[BOOT] BOOT_STORAGE_READ_FAILED', {
      error: error?.message || 'unknown',
    });
    return null;
  }
};

export const clearPersistedBootError = () => {
  try {
    const storage = getBootStorage();
    if (!storage) return;
    storage.delete(BOOT_ERROR_STORAGE_KEY);
  } catch (error) {
    console.warn('[BOOT] BOOT_STORAGE_CLEAR_FAILED', {
      error: error?.message || 'unknown',
    });
  }
};
