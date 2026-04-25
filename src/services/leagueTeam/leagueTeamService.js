import { Platform } from 'react-native';

import { getAuthTokens } from '@/domains/auth/authUseCases';

import client from '@/services/client';

import { clampLeagueDivision } from '@/utils/league/division';

import { getUploadEndpoint } from '@/config/runtimeUrls';

/**
 * @typedef {object} LeagueTeamData
 * @property {string} name
 * @property {string} captain - User ID
 * @property {object} home_base
 * @property {number} [elo]
 * @property {number} [division_points]
 * @property {number} [season_points]
 * @property {number} [highest_streak]
 */
/**
 * @typedef {{ uri?: string, path?: string, filename?: string, fileName?: string, mime?: string, type?: string }} UploadAsset
 */
/**
 * @typedef {LeagueTeamData & {
 *  documentId?: string,
 *  logo?: UploadAsset | null,
 *  cover?: UploadAsset | null,
 *  crest?: number | string | null
 * }} LeagueTeamMutationData
 */
/**
 * @typedef {{
 *  city?: unknown,
 *  radius?: number | string,
 *  category?: unknown,
 *  division?: number | string,
 *  sport?: unknown,
 *  section?: unknown,
 *  query?: unknown,
 * }} SquadSearchFilters
 */
/**
 * @typedef {{ lat: number, lng: number }} Coordinates
 */
/**
 * @typedef {Record<string, any> & {
 *  documentId?: string,
 *  id?: string | number,
 *  name?: string,
 *  sport?: string,
 *  home_base?: unknown,
 *  attributes?: Record<string, unknown>,
 * }} GenericTeamPayload
 */

/**
 * Create a new league team
 * @param {LeagueTeamMutationData} teamData
 * @param {{ legalAcceptance?: object }} [options]
 * @returns {Promise<object>}
 */
export const createLeagueTeam = async (teamData, options = {}) => {
  const { cover, logo, ...baseData } = teamData;
  const data = /** @type {Record<string, unknown>} */ ({
    ...baseData,
    ...(options.legalAcceptance ? { legalAcceptance: options.legalAcceptance } : {}),
  });

  try {
    // 1. Handle File Uploads first
    if (logo) {
      console.log('[LeagueTeam] Uploading Logo...');
      const logoId = await uploadFile(logo);
      data.crest = logoId; // Set ID
    }

    if (cover) {
      console.log('[LeagueTeam] Uploading Cover...');
      const coverId = await uploadFile(cover);
      data.cover = coverId; // Set ID
    }

    const response = await client.post('/league-teams', {
      data,
    });
    console.log('[DEBUG] createLeagueTeam response:', JSON.stringify(response.data, null, 2));
    return response.data?.data;
  } catch (error) {
    console.error('Error creating league team:', error);
    throw error;
  }
};

/**
 * Get league teams for a user (Captain)
 * @param {string} userId
 * @returns {Promise<Team[]>}
 */
export const getMyLeagueTeam = async (userId) => {
  try {
    const response = await client.get('/league-teams', {
      params: {
        filters: {
          $or: [
            {
              captain: {
                documentId: {
                  $eq: userId,
                },
              },
            },
            {
              co_captains: {
                documentId: {
                  $eq: userId,
                },
              },
            },
            {
              roster: {
                documentId: {
                  $eq: userId,
                },
              },
            },
          ],
        },
        populate: '*',
      },
    });
    return response.data?.data || [];
  } catch (error) {
    console.error('Error fetching league team:', error);
    throw error;
  }
};

/**
 * Get league squads where the current user has a pending join request.
 * @param {string} userId
 * @returns {Promise<Team[]>}
 */
export const getPendingLeagueTeams = async (userId) => {
  try {
    const response = await client.get('/league-teams', {
      params: {
        filters: {
          join_requests: {
            documentId: {
              $eq: userId,
            },
          },
        },
        populate: ['crest'],
        sort: ['name:asc'],
      },
    });
    return response.data?.data || [];
  } catch (error) {
    console.error('Error fetching pending league teams:', error);
    throw error;
  }
};

/**
 * Get league squads where the current user has a pending invitation.
 * @param {string} userId
 * @returns {Promise<Team[]>}
 */
export const getInvitedLeagueTeams = async (userId) => {
  try {
    const response = await client.get('/league-teams', {
      params: {
        filters: {
          invitations: {
            documentId: {
              $eq: userId,
            },
          },
        },
        populate: ['crest'],
        sort: ['name:asc'],
      },
    });
    return response.data?.data || [];
  } catch (error) {
    console.error('Error fetching invited league teams:', error);
    throw error;
  }
};

/**
 * Check if team name is unique
 * @param {string} name
 * @returns {Promise<boolean>}
 */
export const checkTeamNameUnique = async (name) => {
  try {
    const normalizedName = String(name || '').trim().replace(/\s+/g, ' ');
    if (!normalizedName) return false;

    const response = await client.get('/league-teams', {
      params: {
        filters: {
          name: {
            $eqi: normalizedName,
          },
        },
      },
    });
    return response.data?.data?.length === 0;
  } catch (error) {
    return false;
  }
};

/**
 * Upload a file to Strapi using native fetch to avoid Axios/Android issues
 * @param {UploadAsset} file
 * @returns {Promise<number>} - The uploaded file ID
 */
const uploadFile = async (file) => {
  const uploadEndpoint = getUploadEndpoint();
  try {
    if (!uploadEndpoint) {
      throw new Error('Upload endpoint is missing');
    }

    const rawUri = file?.path || file?.uri;
    if (!rawUri) {
      throw new Error('Invalid file object provided for upload');
    }

    const uriWithoutQuery = String(rawUri).split('?')[0];
    const extension = uriWithoutQuery.includes('.') ? uriWithoutQuery.split('.').pop() : 'jpg';
    const fileName = file.filename || file.fileName || `league_upload_${Date.now()}.${extension || 'jpg'}`;
    const mimeType = file.mime || file.type || 'image/jpeg';
    const uri = Platform.OS === 'ios' ? String(rawUri).replace(/^file:\/\//, '') : String(rawUri);

    const formData = new FormData();

    formData.append('files', /** @type {any} */ ({
      name: fileName,
      type: mimeType,
      uri,
    }));

    // Get token for upload
    const token = getAuthTokens()?.token;

    const response = await fetch(uploadEndpoint, {
      body: formData,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        Accept: 'application/json',
      },
      method: 'POST',
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = errorText;
      try {
        const errorPayload = JSON.parse(errorText);
        errorMessage = errorPayload?.error?.message || errorPayload?.message || errorText;
      } catch (_error) {
        // Keep raw response text when the server does not return JSON.
      }
      throw new Error(`Upload failed: ${response.status} ${errorMessage}`);
    }

    const data = await response.json();
    if (data && data[0] && data[0].id) {
      return data[0].id;
    }
    throw new Error('No ID received from upload');
  } catch (e) {
    console.error('File upload error:', e);
    if (e instanceof TypeError && String(e.message || '').includes('Network request failed')) {
      throw new Error(`Impossible de joindre l'upload Strapi (${uploadEndpoint}). Verifiez que l'API locale est lancee et accessible depuis l'emulateur.`);
    }
    throw e;
  }
};

/**
 * Update a league team
 * @param {LeagueTeamMutationData} teamData
 * @returns {Promise<object>}
 */
export const updateLeagueTeam = async (teamData) => {
  const {
    cover, documentId, logo, ...baseData
  } = teamData;
  const data = /** @type {Record<string, unknown>} */ ({ ...baseData });

  try {
    // 1. Handle File Uploads first
    if (logo) {
      console.log('[LeagueTeam] Uploading Logo...');
      const logoId = await uploadFile(logo);
      data.crest = logoId; // Set ID
    }

    if (cover) {
      console.log('[LeagueTeam] Uploading Cover...');
      const coverId = await uploadFile(cover);
      data.cover = coverId; // Set ID
    }

    // 2. Update Team Data
    // Now we just send a standard JSON update with IDs
    const response = await client.put(`/league-teams/${documentId}`, {
      data,
    });

    return response.data?.data;
  } catch (error) {
    console.error('Error updating league team:', error);
    throw error;
  }
};

/**
 * Get a single league team by ID
 * @param {string} id
 * @returns {Promise<object>}
 */
export const getLeagueTeamById = async (id) => {
  try {
    const response = await client.get(`/league-teams/${id}`, {
      params: {
        populate: {
          captain: { populate: ['avatar'] },
          co_captains: { populate: ['avatar'] },
          cover: true,
          crest: true,
          invitations: { populate: ['avatar'] },
          join_requests: { populate: ['avatar'] },
          roster: { populate: ['avatar'] },
          slots: { populate: ['participants'] },
        },
      },
    });
    return response.data?.data;
  } catch (error) {
    console.error('Error fetching league team by id:', error);
    throw error;
  }
};
/**
 * Get ranking for a specific division
 * @param {number} division
 * @returns {Promise<Team[]>}
 */
export const getRanking = async (division = 5) => {
  const normalizedDivision = clampLeagueDivision(division);
  try {
    const response = await client.get('/league-teams', {
      params: {
        filters: {
          division: { $eq: normalizedDivision },
        },
        populate: ['crest'],
        sort: ['division_points:desc', 'season_points:desc', 'wins:desc', 'elo:desc'],
      },
    });
    return response.data?.data || [];
  } catch (error) {
    console.error('Error fetching ranking:', error);
    throw error;
  }
};
/**
 * Delete a league team
 * @param {string} documentId
 * @returns {Promise<void>}
 */
// ... existing exports ...

export const deleteLeagueTeam = async (documentId) => {
  try {
    await client.delete(`/league-teams/${documentId}`);
  } catch (error) {
    console.error('Error deleting league team:', error);
    throw error;
  }
};

/**
 * Search squads with filters
 * @param {SquadSearchFilters} filters
 * @returns {Promise<any[]>}
 */
export const searchSquads = async (filters) => {
  try {
    const safeFilters = /** @type {SquadSearchFilters} */ (filters || {});

    /**
     * @param {unknown} value
     * @returns {unknown}
     */
    const normalizeFilterValue = (value) => {
      if (!value) return null;
      if (typeof value === 'object') {
        const safeValue = /** @type {Record<string, unknown>} */ (value);
        return safeValue.value ?? safeValue.label ?? null;
      }
      return value;
    };

    /**
     * @param {unknown} value
     * @returns {string}
     */
    const normalizeText = (value) => String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    /**
     * @param {unknown} value
     * @returns {string | null}
     */
    const resolveSportToken = (value) => {
      const normalized = normalizeText(value);
      if (!normalized) return null;

      if (
        normalized === 'football'
                || normalized === 'foot'
                || normalized === 'football a 5'
                || normalized === 'futsal'
                || normalized === 'five'
                || normalized === 'urban soccer'
      ) {
        return 'football5';
      }

      if (normalized === 'padel') {
        return 'padel';
      }

      return normalized;
    };

    /**
     * @param {unknown} value
     * @returns {'Male' | 'Female' | 'Mixed' | null}
     */
    const normalizeSectionFilter = (value) => {
      const normalized = String(value || '').trim().toLowerCase();
      if (!normalized) return null;
      if (['homme', 'male', 'masculin', 'men'].includes(normalized)) return 'Male';
      if (['female', 'feminin', 'femme', 'women'].includes(normalized)) return 'Female';
      if (['mixed', 'mixte'].includes(normalized)) return 'Mixed';
      return null;
    };

    /**
     * @param {unknown} value
     * @returns {Coordinates | null}
     */
    const parseCoordinates = (value) => {
      if (!value) return null;
      if (typeof value === 'string' && value.includes('|')) {
        const [lngRaw, latRaw] = value.split('|');
        const lat = Number.parseFloat(latRaw);
        const lng = Number.parseFloat(lngRaw);
        if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
        return null;
      }
      if (typeof value === 'object') {
        const safeValue = /** @type {Record<string, any>} */ (value);
        const lat = Number.parseFloat(safeValue.lat ?? safeValue.latitude);
        const lng = Number.parseFloat(safeValue.lng ?? safeValue.longitude ?? safeValue.lon);
        if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };

        const rawValue = safeValue.value ?? safeValue.address?.value;
        if (typeof rawValue === 'string' && rawValue.includes('|')) {
          const [lngRaw, latRaw] = rawValue.split('|');
          const parsedLat = Number.parseFloat(latRaw);
          const parsedLng = Number.parseFloat(lngRaw);
          if (Number.isFinite(parsedLat) && Number.isFinite(parsedLng)) {
            return { lat: parsedLat, lng: parsedLng };
          }
        }

        const geometryCoordinates = safeValue.geometry?.coordinates;
        if (Array.isArray(geometryCoordinates) && geometryCoordinates.length >= 2) {
          const geometryLng = Number.parseFloat(geometryCoordinates[0]);
          const geometryLat = Number.parseFloat(geometryCoordinates[1]);
          if (Number.isFinite(geometryLat) && Number.isFinite(geometryLng)) {
            return { lat: geometryLat, lng: geometryLng };
          }
        }

        const directCoordinates = safeValue.coordinates;
        if (Array.isArray(directCoordinates) && directCoordinates.length >= 2) {
          const first = Number.parseFloat(directCoordinates[0]);
          const second = Number.parseFloat(directCoordinates[1]);
          if (Number.isFinite(first) && Number.isFinite(second)) {
            // Prefer [lng, lat] legacy format.
            return { lat: second, lng: first };
          }
        }
      }
      return null;
    };

    /**
     * @param {GenericTeamPayload} team
     * @returns {Coordinates | null}
     */
    const getTeamCoordinates = (team) => {
      const homeBase = team?.home_base;
      if (!homeBase) return null;
      if (typeof homeBase === 'string') {
        try {
          const parsed = JSON.parse(homeBase);
          return (
            parseCoordinates(parsed)
                        || parseCoordinates(parsed?.address)
                        || parseCoordinates(parsed?.home_base)
          );
        } catch (_error) {
          return null;
        }
      }
      const homeBaseObject = /** @type {Record<string, any>} */ (
        typeof homeBase === 'object' && homeBase !== null ? homeBase : {}
      );
      return (
        parseCoordinates(homeBase)
                || parseCoordinates(homeBaseObject.address)
                || parseCoordinates(homeBaseObject.home_base)
      );
    };

    /**
     * @param {GenericTeamPayload} team
     * @returns {string}
     */
    const getHomeBaseCity = (team) => {
      const homeBase = team?.home_base;
      if (!homeBase) return '';
      if (typeof homeBase === 'string') {
        try {
          const parsed = JSON.parse(homeBase);
          const fallbackText = [
            parsed?.city,
            parsed?.label,
            parsed?.address,
            parsed?.address_line,
            parsed?.address?.city,
            parsed?.address?.label,
            parsed?.address?.address,
            parsed?.home_base?.city,
            parsed?.home_base?.label,
            parsed?.home_base?.address,
            parsed?.context,
            parsed?.properties?.city,
            parsed?.properties?.label,
          ].find((item) => typeof item === 'string' && item.trim().length > 0) || '';
          return String(fallbackText).toLowerCase();
        } catch (_error) {
          return '';
        }
      }
      const homeBaseObject = /** @type {Record<string, any>} */ (
        typeof homeBase === 'object' && homeBase !== null ? homeBase : {}
      );
      const fallbackText = [
        homeBaseObject.city,
        homeBaseObject.label,
        homeBaseObject.address,
        homeBaseObject.address_line,
        homeBaseObject.address?.city,
        homeBaseObject.address?.label,
        homeBaseObject.address?.address,
        homeBaseObject.home_base?.city,
        homeBaseObject.home_base?.label,
        homeBaseObject.home_base?.address,
        homeBaseObject.context,
        homeBaseObject.properties?.city,
        homeBaseObject.properties?.label,
      ].find((item) => typeof item === 'string' && item.trim().length > 0) || '';
      return String(fallbackText).toLowerCase();
    };

    /**
     * @param {Coordinates | null} a
     * @param {Coordinates | null} b
     * @returns {number}
     */
    const getDistanceKm = (a, b) => {
      if (!a || !b) return Number.POSITIVE_INFINITY;
      /**
       * @param {number} value
       * @returns {number}
       */
      const toRad = (value) => (value * Math.PI) / 180;
      const R = 6371;
      const dLat = toRad(b.lat - a.lat);
      const dLng = toRad(b.lng - a.lng);
      const lat1 = toRad(a.lat);
      const lat2 = toRad(b.lat);
      const hav = Math.sin(dLat / 2) ** 2
                + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
      return 2 * R * Math.asin(Math.sqrt(hav));
    };

    /**
     * @param {unknown} cityValue
     * @returns {string[]}
     */
    const buildCityNeedles = (cityValue) => {
      if (!cityValue) return [];

      const cityObject = typeof cityValue === 'object'
        ? /** @type {Record<string, unknown>} */ (cityValue)
        : null;
      const rawLabel = cityObject?.label || String(cityValue || '');
      const explicitCity = cityObject?.city || '';
      const cleanedLabel = normalizeText(rawLabel)
        .replace(/\(\s*\d{5}\s*\)/g, ' ')
        .replace(/\b\d{5}\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const firstToken = cleanedLabel.split(' ').find((/** @type {string} */ token) => token.length >= 3) || '';

      return [...new Set([
        normalizeText(explicitCity),
        cleanedLabel,
        firstToken,
      ].filter((/** @type {string} */ needle) => needle.length >= 3))];
    };

    /**
     * @param {GenericTeamPayload} team
     * @param {string[]} cityNeedles
     * @returns {boolean}
     */
    const isCityTextMatch = (team, cityNeedles) => {
      if (!cityNeedles.length) return true;

      const teamName = normalizeText(team?.name);
      const homeBaseCity = normalizeText(getHomeBaseCity(team));

      return cityNeedles.some((/** @type {string} */ needle) => {
        const matchesCity = homeBaseCity
          ? (homeBaseCity.includes(needle) || needle.includes(homeBaseCity))
          : false;
        const matchesName = teamName ? teamName.includes(needle) : false;
        return matchesCity || matchesName;
      });
    };

    /**
     * @param {GenericTeamPayload} team
     * @returns {GenericTeamPayload}
     */
    const normalizeTeamPayload = (team) => {
      const attributes = team?.attributes && typeof team.attributes === 'object' ? team.attributes : {};
      const merged = { ...attributes, ...team };
      if (!merged.documentId && merged.id !== undefined && merged.id !== null) {
        merged.documentId = String(merged.id);
      }
      return merged;
    };

    /** @type {Record<string, unknown>} */
    const query = {
      populate: ['crest'],
    };

    /** @type {Array<Record<string, unknown>>} */
    const conditions = [];
    const cityRaw = safeFilters?.city;
    const requestedSportToken = resolveSportToken(normalizeFilterValue(safeFilters?.sport));
    // Older league squads were created with the French accent while the current
    // creation flow normalizes the category to "Senior".
    const seniorCategoryValues = ['Senior', 'Sénior', 'senior', 'sénior'];
    const section = normalizeSectionFilter(normalizeFilterValue(safeFilters?.section));
    const divisionRaw = normalizeFilterValue(safeFilters?.division);
    const searchQuery = String(safeFilters?.query || '').trim();
    const cityNeedles = buildCityNeedles(cityRaw);
    const cityAsRecord = typeof safeFilters?.city === 'object' && safeFilters?.city !== null
      ? /** @type {Record<string, unknown>} */ (safeFilters.city)
      : null;
    const centerCoordinates = parseCoordinates(cityAsRecord?.value || safeFilters?.city);

    conditions.push({ category: { $in: seniorCategoryValues } });

    if (section) {
      conditions.push({ section: { $eq: section } });
    }

    const division = Number.parseInt(String(/** @type {any} */ (divisionRaw ?? '')), 10);
    if (Number.isFinite(division) && division >= 1 && division <= 5) {
      conditions.push({ division: { $eq: division } });
    }

    if (searchQuery.length >= 2) {
      conditions.push({ name: { $containsi: searchQuery } });
    }

    if (conditions.length === 1) {
      const [singleCondition] = conditions;
      query.filters = singleCondition;
    } else if (conditions.length > 1) {
      query.filters = { $and: conditions };
    }

    const response = await client.get('/league-teams', { params: query });
    let squads = /** @type {GenericTeamPayload[]} */ (Array.isArray(response?.data?.data)
      ? response.data.data.map(normalizeTeamPayload)
      : []);

    if (requestedSportToken) {
      squads = squads.filter((/** @type {GenericTeamPayload} */ team) => {
        const teamSport = normalizeText(team?.sport);
        if (!teamSport) return false;

        if (requestedSportToken === 'football5') {
          return teamSport.includes('football') || teamSport.includes('futsal');
        }

        if (requestedSportToken === 'padel') {
          return teamSport.includes('padel');
        }

        return teamSport.includes(requestedSportToken);
      });
    }

    if (cityNeedles.length && !centerCoordinates) {
      squads = squads.filter((/** @type {GenericTeamPayload} */ team) => isCityTextMatch(team, cityNeedles));
    }

    const radius = Number.parseInt(String(safeFilters?.radius ?? ''), 10);
    if (Number.isFinite(radius) && radius > 0 && centerCoordinates) {
      squads = squads.filter((/** @type {GenericTeamPayload} */ team) => {
        const teamCoordinates = getTeamCoordinates(team);
        if (!teamCoordinates) {
          return isCityTextMatch(team, cityNeedles);
        }
        const distance = getDistanceKm(centerCoordinates, teamCoordinates);
        if (Number.isFinite(distance) && distance <= radius) {
          return true;
        }

        const swappedCoordinates = {
          lat: teamCoordinates.lng,
          lng: teamCoordinates.lat,
        };
        const swappedDistance = getDistanceKm(centerCoordinates, swappedCoordinates);
        return Number.isFinite(swappedDistance) && swappedDistance <= radius;
      });
    }

    return squads;
  } catch (error) {
    console.error('Error searching squads:', error);
    throw error;
  }
};

/**
 * Request to join a squad
 * @param {string} teamId
 * @param {string} userId
 * @param {{ legalAcceptance?: object }} [options]
 */
export const requestToJoinSquad = async (teamId, userId, options = {}) => {
  try {
    await client.post(`/league-teams/${teamId}/request-join`, {
      data: {
        ...(options.legalAcceptance ? { legalAcceptance: options.legalAcceptance } : {}),
        userId,
      },
    });
  } catch (error) {
    console.error('Error requesting to join squad:', error);
    throw error;
  }
};

/**
 * Invite a user to join a squad
 * @param {string} teamId
 * @param {string} userId
 */
export const inviteUserToSquad = async (teamId, userId) => {
  try {
    await client.post(`/league-teams/${teamId}/invite`, {
      data: {
        userId,
      },
    });
  } catch (error) {
    console.error('Error inviting user to squad:', error);
    throw error;
  }
};

/**
 * Join a squad from a shared invite link
 * @param {string} teamId
 * @param {string} userId
 * @param {{ legalAcceptance?: object }} [options]
 */
export const joinSquadViaInviteLink = async (teamId, userId, options = {}) => {
  try {
    await client.post(`/league-teams/${teamId}/join-invite-link`, {
      data: {
        ...(options.legalAcceptance ? { legalAcceptance: options.legalAcceptance } : {}),
        userId,
      },
    });
  } catch (error) {
    console.error('Error joining squad from invite link:', error);
    throw error;
  }
};

/**
 * Cancel a pending join request for a squad
 * @param {string} teamId
 * @param {string} userId
 */
export const cancelJoinRequest = async (teamId, userId) => {
  try {
    await client.post(`/league-teams/${teamId}/cancel-join-request`, {
      data: {
        userId,
      },
    });
  } catch (error) {
    console.error('Error cancelling join request:', error);
    throw error;
  }
};

/**
 * Respond to a join request
 * @param {string} teamId
 * @param {string} userId
 * @param {boolean} accept
 */
export const respondToJoinRequest = async (teamId, userId, accept) => {
  try {
    await client.post(`/league-teams/${teamId}/respond-join-request`, {
      data: {
        accept,
        userId,
      },
    });
  } catch (error) {
    console.error('Error responding to join request:', error);
    throw error;
  }
};

/**
 * Respond to a squad invitation
 * @param {string} teamId
 * @param {string} userId
 * @param {boolean} accept
 * @param {{ legalAcceptance?: object }} [options]
 */
export const respondToSquadInvite = async (teamId, userId, accept, options = {}) => {
  try {
    await client.post(`/league-teams/${teamId}/respond-invitation`, {
      data: {
        accept,
        ...(options.legalAcceptance ? { legalAcceptance: options.legalAcceptance } : {}),
        userId,
      },
    });
  } catch (error) {
    console.error('Error responding to squad invitation:', error);
    throw error;
  }
};

/**
 * Assign a squad member as captain.
 * @param {string} teamId
 * @param {string} userId
 * @param {'add' | 'transfer'} mode
 */
export const assignSquadCaptain = async (teamId, userId, mode = 'add') => {
  try {
    const response = await client.post(`/league-teams/${teamId}/assign-captain`, {
      data: {
        mode,
        userId,
      },
    });
    return response.data?.data || response.data;
  } catch (error) {
    console.error('Error assigning squad captain:', error);
    throw error;
  }
};
