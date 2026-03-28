import storageBackend, { getStorageBackend } from './backend';

export const getItem = (key) => storageBackend.getString(key);

export const setItem = (key, value) => {
  storageBackend.set(key, value);
};

export const removeItem = (key) => {
  storageBackend.delete(key);
};

export const clearScoped = (prefix) => {
  storageBackend.getAllKeys()
    .filter((key) => key.startsWith(prefix))
    .forEach((key) => storageBackend.delete(key));
};

export {
  getStorageBackend,
  storageBackend,
};

export default storageBackend;
