import client from '@/services/client';

const unwrapResponse = (response) => response?.data ?? response;
const unwrapDataEnvelope = (response) => response?.data?.data || response?.data || response;

const encodeDocumentId = (value) => encodeURIComponent(String(value || '').trim());

export const getSuperadminLeaguePlatformSettings = async () => {
  const response = await client.get('/superadmin/league/platform-settings');
  return unwrapDataEnvelope(response);
};

export const updateSuperadminLeaguePlatformSettings = async (data) => {
  const response = await client.put('/superadmin/league/platform-settings', { data });
  return unwrapDataEnvelope(response);
};

export const getSuperadminLeagueDashboard = async () => {
  const response = await client.get('/superadmin/league/dashboard');
  return unwrapDataEnvelope(response);
};

export const getSuperadminLeagueSquads = async (params = {}) => {
  const response = await client.get('/superadmin/league/squads', { params });
  return unwrapResponse(response);
};

export const getSuperadminLeagueSquadDetail = async (documentId) => {
  const response = await client.get(`/superadmin/league/squads/${encodeDocumentId(documentId)}`);
  return unwrapDataEnvelope(response);
};

export const getSuperadminLeagueMatches = async (params = {}) => {
  const response = await client.get('/superadmin/league/matches', { params });
  return unwrapResponse(response);
};

export const getSuperadminLeagueDisputes = async (params = {}) => {
  const response = await client.get('/superadmin/league/disputes', { params });
  return unwrapResponse(response);
};

export const applySuperadminLeagueDisputeAction = async (documentId, data) => {
  const response = await client.post(`/superadmin/league/disputes/${encodeDocumentId(documentId)}/action`, { data });
  return unwrapResponse(response);
};

export const getSuperadminLeagueDivisions = async () => {
  const response = await client.get('/superadmin/league/divisions');
  return unwrapDataEnvelope(response);
};
