export const normalizeQueryKeyValue = (value) => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeQueryKeyValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        const nextValue = normalizeQueryKeyValue(value[key]);
        if (nextValue !== undefined) {
          acc[key] = nextValue;
        }
        return acc;
      }, {});
  }

  return value;
};

export const buildNormalizedQueryKey = (prefix, params = {}) => {
  const normalizedPrefix = Array.isArray(prefix) ? prefix : [prefix];
  return [...normalizedPrefix, normalizeQueryKeyValue(params)];
};
