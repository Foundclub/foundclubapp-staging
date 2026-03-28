const activeSheets = new Map();

export const openSheet = (config = {}) => {
  const id = config.id || `sheet-${Date.now()}`;
  activeSheets.set(id, config);
  return id;
};

export const closeSheet = (id) => {
  activeSheets.delete(id);
};

export default {
  closeSheet,
  openSheet,
};
