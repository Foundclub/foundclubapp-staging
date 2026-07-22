import client from '@/services/client';
import {
  getClubRequestById,
  getPendingAffiliationHelpRequests,
  processClubRequest,
  refuseClubRequest as refuseAffiliationClubRequest,
} from '@/services/clubRequest/clubRequestService';

import deviceRuntime from '@/platform/device';

/**
 * @typedef {{ q?: string; role?: string; page?: number; pageSize?: number }} AdminUsersParams
 * @typedef {{ q?: string; page?: number; pageSize?: number }} AdminClubsParams
 */

/**
 * Get admin dashboard stats
 * @returns {Promise<{revenue: number, reportsCount: number, eventsToday: number}>}
 */
export const getAdminStats = async () => {
  const result = await client.get('/admin-dashboard/stats');
  return result.data;
};

export const getDetectionVerificationQueue = async (params = {}) => {
  const result = await client.get('/admin-dashboard/detection-verification', {
    params,
  });
  return result.data;
};

export const updateDetectionVerification = async (documentId, payload = {}) => {
  const result = await client.put(`/admin-dashboard/detection-verification/${encodeURIComponent(String(documentId || '').trim())}`, payload);
  return result.data;
};

export const getNonPartnerCoachGovernance = async () => {
  const result = await client.get('/admin-dashboard/non-partner-coach-governance');
  return result.data;
};

export const updateNonPartnerCoachGovernance = async (payload = {}) => {
  const result = await client.put('/admin-dashboard/non-partner-coach-governance', payload);
  return result.data;
};

export const getNonPartnerCoachAffiliations = async (params = {}) => {
  const result = await client.get('/admin-dashboard/non-partner-coach-affiliations', {
    params,
  });
  return result.data;
};

export const updateNonPartnerCoachAffiliation = async (userDocumentId, clubDocumentId, payload = {}) => {
  const safeUserDocumentId = encodeURIComponent(String(userDocumentId || '').trim());
  const safeClubDocumentId = encodeURIComponent(String(clubDocumentId || '').trim());
  const result = await client.put(`/admin-dashboard/non-partner-coach-affiliations/${safeUserDocumentId}/${safeClubDocumentId}`, payload);
  return result.data;
};

export const getSubscriptionOps = async () => {
  const result = await client.get('/admin-dashboard/subscription-ops');
  return result.data;
};

export const createManualSubscription = async (payload = {}) => {
  const result = await client.post('/admin-dashboard/subscription-ops/subscriptions/manual', payload);
  return result.data;
};

export const createManualEntitlement = async (payload = {}) => {
  const result = await client.post('/admin-dashboard/subscription-ops/entitlements/manual', payload);
  return result.data;
};

export const updateManualEntitlement = async (documentId, payload = {}) => {
  const result = await client.put(`/admin-dashboard/subscription-ops/entitlements/${encodeURIComponent(String(documentId || '').trim())}`, payload);
  return result.data;
};

export const syncSubscriptionTeamEntitlements = async (documentId, payload = {}) => {
  const result = await client.post(`/admin-dashboard/subscription-ops/subscriptions/${encodeURIComponent(String(documentId || '').trim())}/sync-team-entitlements`, payload);
  return result.data;
};

export const migrateLegacySubscriptions = async (payload = {}) => {
  const result = await client.post('/admin-dashboard/subscription-ops/migrate-legacy', payload);
  return result.data;
};

/**
 * Get paginated subscriptions for subscription ops back-office.
 * @param {{ q?: string; status?: string; provider?: string; planCode?: string; page?: number; pageSize?: number }} params
 * @returns {Promise<any>}
 */
export const getSubscriptionOpsSubscriptions = async (params = {}) => {
  const result = await client.get('/admin-dashboard/subscription-ops/subscriptions', {
    params,
  });
  return result.data;
};

/**
 * Get paginated billing events for subscription ops back-office.
 * @param {{ processingStatus?: string; provider?: string; page?: number; pageSize?: number }} params
 * @returns {Promise<any>}
 */
export const getSubscriptionOpsBillingEvents = async (params = {}) => {
  const result = await client.get('/admin-dashboard/subscription-ops/billing-events', {
    params,
  });
  return result.data;
};

/**
 * Update a subscription status (superadmin) with entitlement cascade.
 * @param {string} documentId
 * @param {{ status?: string; reason?: string }} payload
 * @returns {Promise<any>}
 */
export const updateSubscriptionOpsStatus = async (documentId, payload = {}) => {
  const result = await client.post(`/admin-dashboard/subscription-ops/subscriptions/${encodeURIComponent(String(documentId || '').trim())}/status`, payload);
  return result.data;
};

/**
 * Retry a billing event from its stored payload.
 * @param {string} documentId
 * @param {{ reason?: string }} payload
 * @returns {Promise<any>}
 */
export const retrySubscriptionOpsBillingEvent = async (documentId, payload = {}) => {
  const result = await client.post(`/admin-dashboard/subscription-ops/billing-events/${encodeURIComponent(String(documentId || '').trim())}/retry`, payload);
  return result.data;
};

/**
 * Run the subscription reconciliation immediately.
 * @param {object} payload
 * @returns {Promise<any>}
 */
export const runSubscriptionOpsReconcile = async (payload = {}) => {
  const result = await client.post('/admin-dashboard/subscription-ops/reconcile', payload);
  return result.data;
};

export const getNotificationsHealth = async () => {
  const result = await client.get('/notifications/health', {
    params: {
      device: deviceRuntime.getDeviceId(),
    },
  });
  return result.data;
};

export const generateTestTournament = async (payload = {}) => {
  const result = await client.post('/admin-dashboard/test-data/tournament', payload);
  return result.data;
};

export const sendNotificationsHealthTest = async (payload = {}) => {
  const result = await client.post('/notifications/health/test', payload);
  return result.data;
};

export const retryNotificationDelivery = async (documentId) => {
  const result = await client.post(`/notifications/health/deliveries/${encodeURIComponent(documentId)}/retry`);
  return result.data;
};

export const purgeNotificationDeliveries = async (payload = {}) => {
  const result = await client.post('/notifications/health/purge', payload);
  return result.data;
};

/**
 * Get aggregated admin reports inbox.
 * @returns {Promise<{ data: Array<any> }>}
 */
export const getAdminReports = async () => {
  const [eventReportsResponse, messageReportsResponse] = await Promise.all([
    client.get('/event-reports', {
      params: {
        pagination: { page: 1, pageSize: 100 },
        populate: ['event', 'event.team', 'event.team.club', 'event.club', 'user', 'author', 'createdBy'],
        sort: ['createdAt:desc'],
      },
    }),
    client.get('/chat-message-reports', {
      params: {
        pagination: { page: 1, pageSize: 100 },
        populate: ['message', 'message.chat', 'message.author', 'chat', 'user', 'author', 'createdBy'],
        sort: ['createdAt:desc'],
      },
    }),
  ]);

  const eventReports = toCollectionItems(eventReportsResponse.data).map(mapEventReportItem);
  const messageReports = toCollectionItems(messageReportsResponse.data).map(mapMessageReportItem);

  return {
    data: [...eventReports, ...messageReports].sort(sortByCreatedAtDesc),
  };
};

const toCollectionItems = (payload) => {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
};

const toEntity = (value) => {
  if (!value) return null;

  if (Array.isArray(value)) {
    return value.map((item) => toEntity(item)).filter(Boolean);
  }

  if (typeof value !== 'object') {
    return value;
  }

  if (value?.data !== undefined) {
    return toEntity(value.data);
  }

  if (value?.attributes && typeof value.attributes === 'object') {
    return {
      id: value.id,
      ...value.attributes,
    };
  }

  return value;
};

const pickDocumentId = (...values) => {
  const candidate = values
    .map((value) => (typeof value === 'object' ? value?.documentId || value?.id : value))
    .find((value) => value !== undefined && value !== null && String(value).trim());

  return candidate !== undefined && candidate !== null ? String(candidate).trim() : null;
};

const pickFirstText = (...values) => values
  .map((value) => (value === undefined || value === null ? '' : String(value).trim()))
  .find(Boolean) || '';

const getPersonLabel = (person) => {
  const entity = toEntity(person);
  if (!entity || typeof entity !== 'object') return '';

  const fullname = [entity.firstname, entity.lastname].filter(Boolean).join(' ').trim();
  if (fullname) return fullname;

  return pickFirstText(entity.username, entity.email, entity.phoneNumber, entity.name);
};

const buildPersonLabel = (...people) => people.map(getPersonLabel).find(Boolean) || 'Utilisateur inconnu';

const normalizeReportStatus = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'pending';
  if (['en attente', 'new', 'open', 'pending'].includes(normalized)) return 'pending';
  if (['accepted', 'closed', 'done', 'processed', 'resolved'].includes(normalized)) return 'resolved';
  if (['dismissed', 'refused', 'rejected'].includes(normalized)) return 'rejected';
  return normalized;
};

export const ADMIN_CLAIM_ITEM_TYPES = Object.freeze({
  CLAIM: 'claim',
  CLUB_CREATION: 'club_creation',
  CLUB_NOT_FOUND: 'club_not_found',
  TEAM_NOT_FOUND: 'team_not_found',
});

const HELP_KINDS = [
  ADMIN_CLAIM_ITEM_TYPES.CLUB_CREATION,
  ADMIN_CLAIM_ITEM_TYPES.CLUB_NOT_FOUND,
  ADMIN_CLAIM_ITEM_TYPES.TEAM_NOT_FOUND,
];
const CLAIM_HELP_KINDS = [
  ADMIN_CLAIM_ITEM_TYPES.CLUB_NOT_FOUND,
  ADMIN_CLAIM_ITEM_TYPES.TEAM_NOT_FOUND,
];

const buildPendingClubRequestFilters = (requestKinds) => ({
  $or: [
    { state: 'En attente' },
    { state: 'pending' },
  ],
  requestKind: Array.isArray(requestKinds)
    ? { $in: requestKinds }
    : requestKinds,
});

const toBadgeLabel = (kind) => {
  if (kind === ADMIN_CLAIM_ITEM_TYPES.CLUB_CREATION) return 'CRÉATION DE CLUB';
  if (kind === ADMIN_CLAIM_ITEM_TYPES.CLUB_NOT_FOUND) return 'CLUB INTROUVABLE';
  if (kind === ADMIN_CLAIM_ITEM_TYPES.TEAM_NOT_FOUND) return 'ÉQUIPE INTROUVABLE';
  return 'REVENDICATION';
};

const toTimestamp = (value) => {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const mapEventReportItem = (item = {}) => {
  const report = toEntity(item) || {};
  const event = toEntity(report.event) || {};
  const team = toEntity(event.team) || {};
  const club = toEntity(team.club) || toEntity(event.club) || {};
  const eventDocumentId = pickDocumentId(event);

  return {
    authorLabel: buildPersonLabel(report.user, report.author, report.createdBy, report.reporter),
    createdAt: report.createdAt || report.updatedAt || null,
    documentId: pickDocumentId(report),
    message: pickFirstText(report.reason, report.comment, report.description, 'Signalement d\'événement'),
    raw: report,
    source: 'event',
    status: normalizeReportStatus(report.status || report.state),
    targetDocumentId: eventDocumentId,
    targetKind: eventDocumentId ? 'event' : null,
    targetLabel: pickFirstText(
      event.name,
      event.title,
      [team.name, club.name].filter(Boolean).join(' - '),
      'Evenement',
    ),
  };
};

const mapMessageReportItem = (item = {}) => {
  const report = toEntity(item) || {};
  const messageEntity = toEntity(report.message) || toEntity(report.chatMessage) || {};
  const chat = toEntity(messageEntity.chat) || toEntity(report.chat) || {};
  const author = toEntity(messageEntity.author) || toEntity(messageEntity.user) || {};
  const chatDocumentId = pickDocumentId(chat);
  const messagePreview = pickFirstText(
    messageEntity.content,
    messageEntity.text,
    messageEntity.body,
    report.reason,
  );

  return {
    authorLabel: buildPersonLabel(report.user, report.author, report.createdBy, report.reporter, author),
    createdAt: report.createdAt || report.updatedAt || null,
    documentId: pickDocumentId(report),
    message: pickFirstText(report.reason, report.comment, messagePreview, 'Signalement de message'),
    raw: report,
    source: 'message',
    status: normalizeReportStatus(report.status || report.state),
    targetDocumentId: chatDocumentId,
    targetKind: chatDocumentId ? 'conversation' : null,
    targetLabel: pickFirstText(
      chat.name,
      chat.title,
      author?.firstname ? `Conversation avec ${buildPersonLabel(author)}` : '',
      'Conversation',
    ),
  };
};

const sortByCreatedAtDesc = (a, b) => toTimestamp(b?.createdAt) - toTimestamp(a?.createdAt);

const normalizeHelpState = (state) => {
  const normalized = String(state || '').trim().toLowerCase();
  if (normalized === 'en attente' || normalized === 'pending') return 'pending';
  if (normalized === 'traitée' || normalized === 'traitee' || normalized === 'processed') return 'processed';
  if (normalized === 'refusée' || normalized === 'refusee' || normalized === 'refused') return 'refused';
  return normalized || 'pending';
};

const mapClaimRequestToAdminItem = (item = {}) => ({
  ...item,
  __isAffiliationHelp: false,
  __requestType: ADMIN_CLAIM_ITEM_TYPES.CLAIM,
  __typeLabel: toBadgeLabel(ADMIN_CLAIM_ITEM_TYPES.CLAIM),
});

const mapHelpRequestToAdminItem = (item = {}) => {
  const requestKind = HELP_KINDS.includes(item?.requestKind)
    ? item.requestKind
    : ADMIN_CLAIM_ITEM_TYPES.CLUB_NOT_FOUND;
  return {
    ...item,
    __isAffiliationHelp: true,
    __requestType: requestKind,
    __typeLabel: toBadgeLabel(requestKind),
    state: normalizeHelpState(item?.state),
  };
};

const fetchPendingClaimRequests = async (params = {}) => {
  const mergedParams = {
    ...params,
    filters: {
      state: 'pending',
      type: 'claim',
      ...(params.filters || {}),
    },
    pagination: {
      page: 1,
      pageSize: 100,
      ...(params.pagination || {}),
    },
    populate: params.populate || ['user', 'club', 'user.avatar', 'club.logo'],
    sort: params.sort || ['createdAt:desc'],
  };

  const result = await client.get('/club-membership-requests', {
    params: mergedParams,
  });
  return result.data;
};

/**
 * Get pending claim + affiliation help count.
 * @returns {Promise<any>}
 */
export const getPendingClubClaims = async () => {
  const [claimsResult, helpResult] = await Promise.all([
    fetchPendingClaimRequests({
      pagination: {
        page: 1,
        pageSize: 1,
      },
    }),
    getPendingAffiliationHelpRequests({
      filters: buildPendingClubRequestFilters(CLAIM_HELP_KINDS),
      pagination: {
        page: 1,
        pageSize: 1,
      },
    }),
  ]);

  const claimsCount = claimsResult?.meta?.pagination?.total || 0;
  const helpCount = helpResult?.meta?.pagination?.total || 0;
  const total = claimsCount + helpCount;

  return {
    data: [],
    meta: {
      counts: {
        affiliationHelp: helpCount,
        claims: claimsCount,
      },
      pagination: {
        page: 1,
        pageCount: total > 0 ? 1 : 0,
        pageSize: 1,
        total,
      },
    },
  };
};

/**
 * Get club claims request list
 * @param {object} params
 * @returns {Promise<any>}
 */
export const getClubClaimsRequestList = async (params = {}) => {
  const page = params?.pagination?.page || 1;
  const pageSize = params?.pagination?.pageSize || 25;

  const [claimsResult, helpResult] = await Promise.all([
    fetchPendingClaimRequests({
      pagination: {
        page: 1,
        pageSize: 200,
      },
    }),
    getPendingAffiliationHelpRequests({
      filters: buildPendingClubRequestFilters(CLAIM_HELP_KINDS),
      pagination: {
        page: 1,
        pageSize: 200,
      },
    }),
  ]);

  const claimItems = (claimsResult?.data || []).map(mapClaimRequestToAdminItem);
  const helpItems = (helpResult?.data || []).map(mapHelpRequestToAdminItem);

  const merged = [...claimItems, ...helpItems].sort(sortByCreatedAtDesc);
  const total = merged.length;
  const pageCount = total > 0 ? Math.ceil(total / pageSize) : 0;
  const start = (page - 1) * pageSize;
  const data = merged.slice(start, start + pageSize);

  return {
    data,
    meta: {
      counts: {
        affiliationHelp: helpItems.length,
        claims: claimItems.length,
      },
      pagination: {
        page,
        pageCount,
        pageSize,
        total,
      },
    },
  };
};

/**
 * Get dedicated club onboarding request count.
 * @returns {Promise<any>}
 */
export const getPendingClubOnboardingRequests = async (params = {}) => {
  const result = await getPendingAffiliationHelpRequests({
    filters: buildPendingClubRequestFilters(ADMIN_CLAIM_ITEM_TYPES.CLUB_CREATION),
    pagination: {
      page: 1,
      pageSize: 100,
    },
    ...params,
  });

  return {
    ...result,
    data: (result?.data || []).map(mapHelpRequestToAdminItem),
  };
};

/**
 * Get single club claim request
 * @param {string} documentId
 * @param {'claim'|'club_creation'|'club_not_found'|'team_not_found'} [requestType]
 * @returns {Promise<any>}
 */
export const getClubClaimRequest = async (documentId, requestType = undefined) => {
  const normalizedType = String(requestType || '').trim();
  const isHelpRequest = HELP_KINDS.includes(normalizedType);

  if (isHelpRequest) {
    const result = await getClubRequestById(documentId);
    return {
      ...result,
      data: mapHelpRequestToAdminItem(result?.data || {}),
    };
  }

  try {
    const result = await client.get(`/club-membership-requests/${documentId}`, {
      params: {
        populate: ['user', 'club', 'user.avatar', 'club.logo'],
      },
    });
    return {
      ...result.data,
      data: mapClaimRequestToAdminItem(result?.data?.data || result?.data?.attributes || result?.data),
    };
  } catch (error) {
    if (normalizedType) {
      throw error;
    }
    const fallback = await getClubRequestById(documentId);
    return {
      ...fallback,
      data: mapHelpRequestToAdminItem(fallback?.data || {}),
    };
  }
};

/**
 * Approve club claim
 * @param {string} documentId
 * @returns {Promise<any>}
 */
/**
 * Approve club claim
 * @param {string} documentId
 * @returns {Promise<any>}
 */
export const approveClubClaim = async (documentId) => {
  // Call the CUSTOM 'accept' endpoint which handles role logic
  // Route is POST /club-membership-requests/:id/accept
  const result = await client.post(`/club-membership-requests/${documentId}/accept`);
  return result.data;
};

/**
 * Refuse club claim
 * @param {string} documentId
 * @returns {Promise<any>}
 */
export const refuseClubClaim = async (documentId) => {
  // Call the CUSTOM 'refuse' endpoint
  // Route is POST /club-membership-requests/:id/refuse
  const result = await client.post(`/club-membership-requests/${documentId}/refuse`);
  return result.data;
};

/**
 * Process an affiliation help request (club/team not found).
 * @param {string} documentId
 * @param {{ adminNote?: string }} [payload]
 * @returns {Promise<any>}
 */
export const processAffiliationHelpRequest = async (documentId, payload = {}) => processClubRequest(documentId, payload);

/**
 * Refuse an affiliation help request (club/team not found).
 * @param {string} documentId
 * @param {{ adminNote?: string }} [payload]
 * @returns {Promise<any>}
 */
export const refuseAffiliationHelpRequest = async (documentId, payload = {}) => refuseAffiliationClubRequest(documentId, payload);

// ================== ADMIN USERS ==================

/**
 * Get admin users list with search and filters
 * @param {AdminUsersParams} params
 * @returns {Promise<any>}
 */
export const getAdminUsers = async (params = {}) => {
  const {
    page = 1, pageSize = 20, q, role,
  } = params;
  const filters = /** @type {any} */ ({
    filters: {},
    pagination: { page, pageSize },
    populate: ['avatar', 'role', 'club'],
    sort: ['createdAt:desc'],
  });

  if (q) {
    filters.filters.$or = [
      { firstname: { $containsi: q } },
      { lastname: { $containsi: q } },
      { email: { $containsi: q } },
    ];
  }
  if (role) {
    filters.filters.role = { type: role };
  }

  const response = await client.get('/users', { params: filters });
  return response.data;
};

/**
 * Get single user for admin
 * @param {string} documentId
 * @returns {Promise<any>}
 */
export const getAdminUser = async (documentId) => {
  const response = await client.get(`/users/${documentId}`, {
    params: {
      populate: ['avatar', 'role', 'club', 'club.logo'],
    },
  });
  return response.data;
};

/**
 * Update user (admin)
 * @param {string} documentId
 * @param {object} data
 * @returns {Promise<any>}
 */
export const updateAdminUser = async (documentId, data) => {
  const response = await client.put(`/users/${documentId}`, data);
  return response.data;
};

/**
 * Delete (anonymize) a user as superadmin.
 * @param {string} documentId
 * @param {{ reason?: string }} [payload]
 * @returns {Promise<any>}
 */
export const deleteAdminUser = async (documentId, payload = {}) => {
  const reason = String(payload?.reason || '').trim() || 'Suppression par un superadmin';
  const response = await client.delete(
    `/superadmin/users/${encodeURIComponent(String(documentId || '').trim())}`,
    { data: { reason } },
  );
  return response.data;
};

// ================== ADMIN CLUBS ==================

/**
 * Get admin clubs list with search
 * @param {AdminClubsParams} params
 * @returns {Promise<any>}
 */
export const getAdminClubs = async (params = {}) => {
  const { page = 1, pageSize = 20, q } = params;
  const filters = /** @type {any} */ ({
    filters: {},
    pagination: { page, pageSize },
    populate: ['logo', 'activites'],
    sort: ['createdAt:desc'],
  });

  if (q) {
    filters.filters.name = { $containsi: q };
  }

  const response = await client.get('/clubs', { params: filters });
  return response.data;
};

/**
 * Get single club for admin
 * @param {string} documentId
 * @returns {Promise<any>}
 */
export const getAdminClub = async (documentId) => {
  const response = await client.get(`/clubs/${documentId}`, {
    params: {
      populate: ['logo', 'members', 'members.avatar', 'activites', 'sponsor', 'sponsor.logo'],
    },
  });
  return response.data;
};

/**
 * Update club (admin)
 * @param {string} documentId
 * @param {object} data
 * @returns {Promise<any>}
 */
export const updateAdminClub = async (documentId, data) => {
  const response = await client.put(`/clubs/${documentId}`, { data });
  return response.data;
};

// ================== LEAGUE DISPUTES ==================

/**
 * Get League disputes list
 * @param {object} params
 * @returns {Promise<any>}
 */
export const getLeagueDisputes = async (params = {}) => {
  const defaultParams = {
    filters: {
      status: { $eq: 'disputed' },
    },
    pagination: {
      page: 1,
      pageSize: 25,
    },
    populate: [
      'team_a',
      'team_a.captain',
      'team_a.co_captains',
      'team_b',
      'team_b.captain',
      'team_b.co_captains',
      'chat',
    ],
    sort: ['updatedAt:desc'],
  };

  const response = await client.get('/league-matches', {
    params: {
      ...defaultParams,
      ...params,
    },
  });

  return response.data;
};

/**
 * Resolve a League dispute
 * @param {string} matchId
 * @param {{scoreA:number|string, scoreB:number|string, reason?:string}} payload
 * @returns {Promise<any>}
 */
export const resolveLeagueDispute = async (matchId, payload) => {
  const response = await client.post(`/league-matches/${matchId}/resolve-dispute`, {
    reason: payload.reason || 'Décision SuperAdmin',
    score_a: Number.parseInt(String(payload.scoreA), 10),
    score_b: Number.parseInt(String(payload.scoreB), 10),
  });
  return response.data;
};
