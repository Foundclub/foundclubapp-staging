const isJsonCandidate = (value) => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return (
    trimmed.startsWith('{')
    || trimmed.startsWith('[')
    || trimmed.startsWith('"')
    || trimmed === 'null'
    || trimmed === 'true'
    || trimmed === 'false'
    || /^-?\d/.test(trimmed)
  );
};

const safeJsonParse = (value, fallback = null) => {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  if (typeof value !== 'string') {
    return value;
  }

  if (!isJsonCandidate(value)) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
};

export default safeJsonParse;
