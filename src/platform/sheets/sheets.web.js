const activeSheets = new Map();
const listeners = new Set();

const emitChange = () => {
  const snapshot = Array.from(activeSheets.values());
  listeners.forEach((listener) => listener(snapshot));
};

export const getActiveSheetsSnapshot = () => Array.from(activeSheets.values());

export const subscribeSheets = (listener) => {
  if (typeof listener !== 'function') {
    return () => {};
  }

  listeners.add(listener);
  listener(getActiveSheetsSnapshot());

  return () => {
    listeners.delete(listener);
  };
};

export const openSheet = (config = {}) => {
  const id = config.id || `sheet-${Date.now()}-${Math.round(Math.random() * 1000)}`;
  activeSheets.set(id, { ...config, id });
  emitChange();
  return id;
};

export const closeSheet = (id) => {
  if (!id || !activeSheets.has(id)) return;

  const existingSheet = activeSheets.get(id);
  activeSheets.delete(id);
  emitChange();

  if (typeof existingSheet?.onClose === 'function') {
    existingSheet.onClose();
  }
};

export const closeAllSheets = () => {
  Array.from(activeSheets.keys()).forEach((sheetId) => {
    closeSheet(sheetId);
  });
};

export default {
  closeAllSheets,
  closeSheet,
  getActiveSheetsSnapshot,
  openSheet,
  subscribeSheets,
};
