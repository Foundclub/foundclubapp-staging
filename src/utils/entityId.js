const isNil = (value) => value === null || value === undefined;

export const normalizeEntityId = (value) => {
  if (isNil(value)) return '';
  return String(value).trim();
};

export const areSameEntityId = (left, right) => {
  const a = normalizeEntityId(left);
  const b = normalizeEntityId(right);
  return a !== '' && a === b;
};

export const getEntityDocumentId = (entity) => {
  if (!entity) return '';

  if (typeof entity === 'string' || typeof entity === 'number') {
    return normalizeEntityId(entity);
  }

  const docId = normalizeEntityId(entity.documentId);
  if (docId) return docId;

  const legacyId = normalizeEntityId(entity.id);
  return legacyId;
};

export const requireDocumentId = (entityOrId, label = 'entity') => {
  const resolvedId = getEntityDocumentId(entityOrId);
  if (!resolvedId) {
    throw new Error(`Missing ${label} documentId`);
  }
  return resolvedId;
};

