const SCALAR_TYPES = new Set([
  'biginteger',
  'boolean',
  'date',
  'datetime',
  'decimal',
  'email',
  'enumeration',
  'float',
  'integer',
  'string',
  'text',
  'uid',
]);

const HIDDEN_FIELDS = new Set([
  'confirmationToken',
  'createdAt',
  'documentId',
  'id',
  'password',
  'provider',
  'publishedAt',
  'resetPasswordToken',
  'updatedAt',
]);

const OVERRIDE_RULES = [
  {
    badgeFields: ['type', 'status', 'isActive'],
    keyFields: ['name', 'sport', 'category', 'section', 'city'],
    match: (uid = '') => uid.includes('level.'),
    titleFields: ['name', 'label'],
  },
  {
    badgeFields: ['role', 'status', 'isActive'],
    keyFields: ['email', 'phoneNumber', 'city', 'section', 'preferredSport'],
    match: (uid = '') => uid.includes('user.'),
    titleFields: ['fullname', 'firstname', 'username', 'email'],
  },
  {
    badgeFields: ['status', 'validationMode', 'reservationMode'],
    keyFields: ['startTime', 'endTime', 'date', 'location', 'capacity'],
    match: (uid = '') => uid.includes('event.'),
    titleFields: ['name', 'title', 'label'],
  },
  {
    badgeFields: ['isLeague', 'status', 'type'],
    keyFields: ['sport', 'city', 'section', 'points', 'division'],
    match: (uid = '') => uid.includes('team.'),
    titleFields: ['name', 'title', 'label'],
  },
  {
    badgeFields: ['status', 'type', 'isActive'],
    keyFields: ['city', 'address', 'sport', 'section', 'owner'],
    match: (uid = '') => uid.includes('club.'),
    titleFields: ['name', 'title', 'label'],
  },
];

const DEFAULT_TITLE_FIELDS = [
  'fullname',
  'name',
  'title',
  'label',
  'firstname',
  'username',
  'email',
  'phoneNumber',
];

const DEFAULT_KEY_FIELDS = [
  'status',
  'type',
  'category',
  'city',
  'section',
  'email',
  'phoneNumber',
  'date',
  'startTime',
  'endTime',
];

const DEFAULT_BADGE_FIELDS = ['status', 'type', 'isActive', 'validationMode', 'role'];

const SORT_MODES = {
  alpha: 'alpha',
  created: 'created',
  updated: 'updated',
};

const SORT_OPTIONS = [
  {
    key: SORT_MODES.updated,
    label: 'MAJ récente',
  },
  {
    key: SORT_MODES.created,
    label: 'Création récente',
  },
  {
    key: SORT_MODES.alpha,
    label: 'Alpha',
  },
];

const normalizeString = (/** @type {any} */ value) => String(value || '').trim();

const toLabel = (/** @type {any} */ rawKey) => normalizeString(rawKey)
  .replace(/_/g, ' ')
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/^./, (/** @type {string} */ char) => char.toUpperCase());

const truncate = (/** @type {any} */ value, maxLength = 52) => {
  const normalized = normalizeString(value);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}...`;
};

const normalizeComparisonValue = (/** @type {any} */ value) => normalizeString(value).toLowerCase();

const isDateLikeField = (/** @type {string} */ key = '') => (
  /date$/i.test(key)
  || /at$/i.test(key)
  || /time$/i.test(key)
);

const formatDate = (/** @type {any} */ value) => {
  const normalized = normalizeString(value);
  if (!normalized) return '';
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return normalized;
  return parsed.toLocaleString('fr-FR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const getRule = (/** @type {string} */ uid = '') => OVERRIDE_RULES.find((candidate) => candidate.match(uid)) || null;

const getScalarAttributeNames = (/** @type {any[]} */ attributes = []) => attributes
  .filter((/** @type {any} */ attribute) => SCALAR_TYPES.has(String(attribute?.type || '')))
  .map((/** @type {any} */ attribute) => normalizeString(attribute?.name))
  .filter(Boolean);

const getListFieldNames = (/** @type {string} */ uid, /** @type {any[]} */ attributes = []) => {
  const scalarNames = getScalarAttributeNames(attributes);
  const rule = getRule(uid);
  const selected = [
    ...DEFAULT_TITLE_FIELDS,
    ...(rule?.titleFields || []),
    ...DEFAULT_KEY_FIELDS,
    ...(rule?.keyFields || []),
    ...DEFAULT_BADGE_FIELDS,
    ...(rule?.badgeFields || []),
    'createdAt',
    'updatedAt',
    'documentId',
  ]
    .map((field) => normalizeString(field))
    .filter((field) => (
      field === 'documentId'
      || field === 'createdAt'
      || field === 'updatedAt'
      || scalarNames.includes(field)
    ));

  return Array.from(new Set(selected)).slice(0, 18);
};

const getAlphaSortField = (/** @type {string} */ uid, /** @type {any[]} */ attributes = []) => {
  const scalarNames = getScalarAttributeNames(attributes);
  const rule = getRule(uid);
  const candidates = [
    ...(rule?.titleFields || []),
    ...DEFAULT_TITLE_FIELDS,
    'documentId',
  ]
    .map((field) => normalizeString(field))
    .filter(Boolean);

  const first = candidates.find((field) => scalarNames.includes(field));
  return first || 'documentId';
};

const getSortValue = (/** @type {string} */ sortMode, /** @type {string} */ alphaField) => {
  if (sortMode === SORT_MODES.created) {
    return ['createdAt:desc'];
  }
  if (sortMode === SORT_MODES.alpha) {
    return [`${alphaField}:asc`];
  }
  return ['updatedAt:desc'];
};

const resolveRawFieldValue = (/** @type {Record<string, any>} */ entry = {}, /** @type {string} */ fieldName = '') => {
  if (fieldName === 'fullname') {
    const firstname = normalizeString(entry?.firstname);
    const lastname = normalizeString(entry?.lastname);
    return `${firstname} ${lastname}`.trim();
  }
  return entry?.[fieldName];
};

const summarizeComplex = (/** @type {any} */ value) => {
  if (Array.isArray(value)) {
    if (!value.length) return '0 element';
    const first = value[0];
    if (first && typeof first === 'object') {
      const firstLabel = normalizeString(first?.name || first?.title || first?.label || first?.documentId);
      if (firstLabel) {
        return `${value.length} éléments (ex: ${truncate(firstLabel, 24)})`;
      }
    }
    return `${value.length} éléments`;
  }

  if (value && typeof value === 'object') {
    const locationLabel = normalizeString(
      value?.description
      || value?.label
      || value?.address?.description
      || value?.address?.label
      || value?.name
      || value?.title
      || value?.documentId,
    );
    if (locationLabel) {
      return truncate(locationLabel, 56);
    }
    return `${Object.keys(value).length} champs`;
  }

  return '';
};

const normalizeFieldValue = (/** @type {string} */ fieldName, /** @type {any} */ value) => {
  if (value === null || value === undefined) return '';

  if (typeof value === 'boolean') {
    return value ? 'Oui' : 'Non';
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'string') {
    if (isDateLikeField(fieldName)) {
      return formatDate(value);
    }
    return truncate(value);
  }

  return summarizeComplex(value);
};

const getTitle = (/** @type {Record<string, any>} */ entry, /** @type {string} */ uid) => {
  const rule = getRule(uid);
  const candidates = [
    ...(rule?.titleFields || []),
    ...DEFAULT_TITLE_FIELDS,
    'documentId',
  ];

  const matchingTitle = candidates.find((candidate) => {
    const raw = resolveRawFieldValue(entry, candidate);
    const normalized = normalizeFieldValue(candidate, raw);
    return Boolean(normalized);
  });

  if (matchingTitle) {
    const raw = resolveRawFieldValue(entry, matchingTitle);
    return normalizeFieldValue(matchingTitle, raw);
  }

  return 'Sans titre';
};

const getBadgeTone = (/** @type {string} */ fieldName, /** @type {any} */ rawValue) => {
  const key = normalizeString(fieldName).toLowerCase();
  const value = normalizeString(rawValue).toLowerCase();

  if (key === 'isactive' || key === 'active') {
    return rawValue ? 'success' : 'danger';
  }

  if (value === 'accepted' || value === 'approved' || value === 'confirmed') return 'success';
  if (value === 'pending' || value === 'open') return 'warning';
  if (value === 'declined' || value === 'cancelled' || value === 'inactive') return 'danger';
  return 'neutral';
};

const getBadges = (/** @type {Record<string, any>} */ entry, /** @type {string} */ uid) => {
  const rule = getRule(uid);
  const candidates = [...(rule?.badgeFields || []), ...DEFAULT_BADGE_FIELDS];
  const deduped = Array.from(new Set(candidates));

  return deduped
    .map((fieldName) => {
      const raw = resolveRawFieldValue(entry, fieldName);
      const normalized = normalizeFieldValue(fieldName, raw);
      if (!normalized) return null;
      return {
        key: fieldName,
        label: `${toLabel(fieldName)}: ${normalized}`,
        tone: getBadgeTone(fieldName, raw),
      };
    })
    .filter(Boolean)
    .slice(0, 3);
};

const getKeyFields = (/** @type {Record<string, any>} */ entry, /** @type {string} */ uid, maxFields = 3) => {
  const rule = getRule(uid);
  const explicit = [...(rule?.keyFields || []), ...DEFAULT_KEY_FIELDS];
  const allEntryFields = Object.keys(entry || {});
  const candidates = [...explicit, ...allEntryFields];
  const used = new Set();
  const result = /** @type {Array<any>} */ ([]);

  candidates.forEach((fieldName) => {
    if (result.length >= maxFields) return;
    const normalizedKey = normalizeString(fieldName);
    if (!normalizedKey || used.has(normalizedKey) || HIDDEN_FIELDS.has(normalizedKey)) return;

    const raw = resolveRawFieldValue(entry, normalizedKey);
    const value = normalizeFieldValue(normalizedKey, raw);
    if (!value) return;

    used.add(normalizedKey);
    result.push({
      key: normalizedKey,
      label: toLabel(normalizedKey),
      value,
    });
  });

  return result;
};

const getShortDocumentId = (/** @type {any} */ documentId) => {
  const normalized = normalizeString(documentId);
  if (!normalized) return '';
  if (normalized.length <= 14) return normalized;
  return `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
};

const getComplexFields = (/** @type {Record<string, any>} */ entry = {}, /** @type {any[]} */ attributes = []) => {
  const attributePairs = (attributes || []).reduce((/** @type {Array<[string, any]>} */ pairs, /** @type {any} */ attribute) => {
    const name = normalizeString(attribute?.name);
    if (name) pairs.push([name, attribute]);
    return pairs;
  }, /** @type {Array<[string, any]>} */ ([]));
  const attributeMap = new Map(attributePairs);

  return Object.entries(entry || {})
    .filter(([key, value]) => {
      if (HIDDEN_FIELDS.has(key)) return false;
      if (value === null || value === undefined) return false;

      const attribute = attributeMap.get(key);
      if (attribute?.type === 'relation' || attribute?.type === 'media') return true;
      if (Array.isArray(value)) return true;
      if (typeof value === 'object') return true;
      return false;
    })
    .map(([key, value]) => ({
      key,
      label: toLabel(key),
      value: summarizeComplex(value),
    }))
    .filter((item) => Boolean(item.value))
    .slice(0, 10);
};

export const SUPERADMIN_SORT_MODES = SORT_MODES;
export const SUPERADMIN_SORT_OPTIONS = SORT_OPTIONS;

export const getListRequestConfig = (/** @type {{ attributes: any[], sortMode: string, uid: string }} */ { attributes, sortMode, uid }) => {
  const alphaField = getAlphaSortField(uid, attributes);

  return {
    fields: getListFieldNames(uid, attributes),
    sort: getSortValue(sortMode, alphaField),
  };
};

export const getEntryCardViewModel = (/** @type {{ entry: Record<string, any>, uid: string }} */ { entry, uid }) => {
  const title = getTitle(entry, uid);
  const titleComparison = normalizeComparisonValue(title);
  const filteredFields = getKeyFields(entry, uid, 5)
    .filter((field) => {
      const fieldValue = normalizeComparisonValue(field?.value);
      if (!fieldValue) return false;
      return fieldValue !== titleComparison;
    })
    .slice(0, 3);

  return {
    badges: getBadges(entry, uid),
    documentId: normalizeString(entry?.documentId),
    fields: filteredFields,
    shortDocumentId: getShortDocumentId(entry?.documentId),
    title,
    updatedAt: formatDate(entry?.updatedAt || ''),
  };
};

export const getEntryDetailViewModel = (/** @type {{ attributes: any[], entry: Record<string, any>, uid: string }} */ { attributes, entry, uid }) => ({
  badges: getBadges(entry, uid),
  complexFields: getComplexFields(entry, attributes),
  createdAt: formatDate(entry?.createdAt || ''),
  documentId: normalizeString(entry?.documentId),
  keyFields: getKeyFields(entry, uid, 8),
  shortDocumentId: getShortDocumentId(entry?.documentId),
  title: getTitle(entry, uid),
  updatedAt: formatDate(entry?.updatedAt || ''),
});

export const formatJsonPreview = (/** @type {any} */ value, maxLength = 9000) => {
  try {
    const serialized = JSON.stringify(value, null, 2);
    if (serialized.length <= maxLength) {
      return serialized;
    }
    return `${serialized.slice(0, maxLength)}\n...`;
  } catch (_error) {
    return String(value || '');
  }
};
