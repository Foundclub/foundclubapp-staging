import client from '../client';

/**
 * Search users inside a club / multisport scope.
 * @param {object} params
 * @param {string} [params.clubId]
 * @param {boolean} [params.isSuperAdmin]
 * @param {number} [params.limit]
 * @param {string} [params.multisportId]
 * @param {string} [params.query]
 * @returns {Promise<any[]>}
 */
export const searchScopedUsers = async ({
  clubId,
  isSuperAdmin = false,
  limit = 100,
  multisportId,
  query = '',
} = {}) => {
  const normalizedQuery = String(query || '').trim();

  if (!isSuperAdmin && !clubId && !multisportId) {
    return [];
  }

  const nameFilters = normalizedQuery
    ? [
      { firstname: { $containsi: normalizedQuery } },
      { lastname: { $containsi: normalizedQuery } },
      { username: { $containsi: normalizedQuery } },
    ]
    : [];

  /** @type {Record<string, unknown>} */
  let filters = {};

  if (isSuperAdmin) {
    filters = nameFilters.length > 0 ? { $or: nameFilters } : {};
  } else if (multisportId) {
    const scopeFilter = {
      $or: [
        { club: { parentMultisport: { documentId: { $eq: multisportId } } } },
        { myTeams: { club: { parentMultisport: { documentId: { $eq: multisportId } } } } },
        { trainedTeams: { club: { parentMultisport: { documentId: { $eq: multisportId } } } } },
      ],
    };
    filters = nameFilters.length > 0
      ? { $and: [{ $or: nameFilters }, scopeFilter] }
      : scopeFilter;
  } else if (clubId) {
    const scopeFilter = {
      $or: [
        { club: { documentId: { $eq: clubId } } },
        { myTeams: { club: { documentId: { $eq: clubId } } } },
        { trainedTeams: { club: { documentId: { $eq: clubId } } } },
      ],
    };
    filters = nameFilters.length > 0
      ? { $and: [{ $or: nameFilters }, scopeFilter] }
      : scopeFilter;
  }

  const response = await client.get('/users', {
    params: {
      filters,
      limit,
      populate: ['avatar', 'club', 'role', 'myTeams', 'trainedTeams'],
      start: 0,
    },
  });

  return Array.isArray(response?.data) ? response.data : [];
};

/**
 * Search users (for mercato)
 * @param {object} params
 * @param {boolean} [params.isLookingForClub]
 * @param {string} [params.role]
 * @param {string} [params.q]
 * @param {string|string[]} [params.activity] - Sport/activity filter
 * @param {string|string[]} [params.activityNames] - Preferred sport names (canonical filter)
 * @param {string|string[]} [params.category] - Section (M/F) filter
 * @param {string|string[]} [params.position] - Position filter
 * @param {string} [params.geohash] - Location geohash filter
 * @param {number} [params.page]
 * @param {number} [params.pageSize]
 * @returns {Promise<any>}
 */
export const searchUsers = async (params = {}) => {
  const {
    activity,
    activityNames,
    category,
    geohash,
    isLookingForClub,
    page = 1,
    pageSize = 25,
    position,
    q,
    role,
  } = params;

  const filters = {
    filters: {},
    pagination: {
      page,
      pageSize,
    },
    populate: ['avatar', 'role', 'section'],
  };

  // Core filter: only show users looking for a club
  if (typeof isLookingForClub === 'boolean') {
    filters.filters.isLookingForClub = isLookingForClub;
  }

  // Role filter
  if (role) {
    filters.filters.role = {
      name: {
        $containsi: role,
      },
    };
  }

  // Text search (name)
  if (q) {
    filters.filters.$or = [
      { firstname: { $containsi: q } },
      { lastname: { $containsi: q } },
      { username: { $containsi: q } },
    ];
  }

  // Sport/Activity filter (preferredSport field)
  let canonicalActivityNames = [];
  if (Array.isArray(activityNames)) {
    canonicalActivityNames = activityNames;
  } else if (activityNames) {
    canonicalActivityNames = [activityNames];
  }

  if (canonicalActivityNames.length > 0) {
    filters.filters.$and = [
      ...(filters.filters.$and || []),
      {
        $or: canonicalActivityNames
          .map((name) => String(name || '').trim())
          .filter(Boolean)
          .map((name) => ({ preferredSport: { $eqi: name } })),
      },
    ];
  } else if (activity) {
    // Legacy fallback
    const activityValues = Array.isArray(activity) ? activity : [activity];
    if (activityValues.length > 0) {
      filters.filters.preferredSport = { $in: activityValues };
    }
  }

  // Section/Category filter
  if (category) {
    const categoryValues = Array.isArray(category) ? category : [category];
    if (categoryValues.length > 0) {
      filters.filters.section = {
        documentId: { $in: categoryValues },
      };
    }
  }

  // Position filter
  if (position) {
    const positionValues = Array.isArray(position) ? position : [position];
    if (positionValues.length > 0) {
      filters.filters.position = { $in: positionValues };
    }
  }

  // Geohash/location filter (requires backend support)
  // Note: This may need custom backend implementation
  // For now, we pass it but Strapi standard API may not support it
  if (geohash) {
    filters.filters.geohash = { $startsWith: geohash };
  }

  const response = await client.get('/users', { params: filters });
  return response.data;
};
