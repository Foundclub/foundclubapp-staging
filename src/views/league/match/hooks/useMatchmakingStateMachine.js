import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import MatchmakingService from '@/services/league/MatchmakingService';

import { getEntityDocumentId } from '@/utils/entityId';

const POLLING_VIEWS = new Set(['locker_room', 'match_found', 'radar']);

/**
 * @param {number} seconds
 * @returns {string}
 */
const formatSecondsCompact = (seconds) => {
  const safe = Math.max(0, Number(seconds) || 0);
  const min = Math.floor(safe / 60);
  const sec = safe % 60;
  if (min <= 0) return `${sec}s`;
  return `${min}m ${String(sec).padStart(2, '0')}s`;
};

/**
 * @param {Record<string, any> | null} searchInsights
 * @param {number} updatedAtMs
 * @param {number} [nowMs]
 * @returns {number}
 */
const computeRemainingExpansionSec = (searchInsights, updatedAtMs, nowMs = Date.now()) => {
  const base = Number(searchInsights?.nextExpansionInSec || 0);
  if (!Number.isFinite(base) || base <= 0) return 0;
  if (!Number.isFinite(updatedAtMs) || updatedAtMs <= 0) return base;
  const elapsedSec = Math.max(0, Math.floor((nowMs - updatedAtMs) / 1000));
  return Math.max(0, base - elapsedSec);
};

/**
 * @param {Record<string, any> | null} searchInsights
 * @returns {boolean}
 */
const hasTierBlocking = (searchInsights) => {
  const blockedCriteria = searchInsights?.blockedCriteria;
  const blocked = Array.isArray(blockedCriteria) ? blockedCriteria : [];
  return blocked.includes('elo') || blocked.includes('division');
};

/**
 * @param {...unknown} values
 * @returns {string | null}
 */
const pickFirstText = (...values) => {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return null;
};

/**
 * @param {unknown} value
 * @returns {any}
 */
const parseMaybeJson = (value) => {
  if (value && typeof value === 'object') return value;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return value;
  }
};

/**
 * @param {string | null} cityLabel
 * @param {number | string | null | undefined} radiusKm
 * @returns {string}
 */
const formatZoneLine = (cityLabel, radiusKm) => {
  const safeRadius = Number.isFinite(Number(radiusKm)) ? Number(radiusKm) : null;
  const city = cityLabel || 'votre zone';
  if (!safeRadius) return `Zone: ${city}.`;
  return `Zone: ${city} - rayon ${safeRadius} km.`;
};

/**
 * @param {MatchRequest | null} matchRequest
 * @param {Team | null} mySquad
 * @returns {{ cityLabel: string | null, radiusKm: number }}
 */
const extractSearchZone = (matchRequest, mySquad) => {
  const requestLocation = parseMaybeJson(matchRequest?.location);
  const squadHomeBase = parseMaybeJson(mySquad?.home_base);
  const cityLabel = pickFirstText(
    requestLocation?.city,
    requestLocation?.label,
    requestLocation?.address,
    squadHomeBase?.city,
    squadHomeBase?.label,
    squadHomeBase?.address,
  );

  const radiusKm = Number(matchRequest?.radius || squadHomeBase?.radius || mySquad?.radius || 20);
  return { cityLabel, radiusKm };
};

/**
 * @typedef {{
 *  division?: number,
 *  searchInsights?: Record<string, any> | null,
 *  nextExpansionInSec?: number,
 *  cityLabel?: string | null,
 *  radiusKm?: number | string,
 * }} SearchStatusInput
 */
/**
 * @param {SearchStatusInput} input
 * @returns {string}
 */
const buildSearchStatusLabel = ({
  cityLabel,
  division,
  nextExpansionInSec,
  radiusKm,
  searchInsights,
}) => {
  const divisionLabel = division ? `Division ${division}` : 'votre niveau';
  const tier = Number(searchInsights?.tier || 0) || 1;
  const geoRelaxationKm = Number(searchInsights?.geoRelaxationKm || 0);
  const safeNextExpansionInSec = Number(nextExpansionInSec ?? 0);
  const nextExpansion = Number.isFinite(safeNextExpansionInSec)
    ? Math.max(0, safeNextExpansionInSec)
    : Number(searchInsights?.nextExpansionInSec || 0);

  const zoneLine = formatZoneLine(cityLabel || null, radiusKm);
  const criteriaLine = `Critère prioritaire: ${divisionLabel} avec un ELO similaire.`;

  if (searchInsights?.candidateFound && hasTierBlocking(searchInsights)) {
    if (nextExpansion > 0) {
      return `Statut: adversaire potentiel trouvé.\n${criteriaLine}\n${zoneLine}\nSuite: match auto dans ${formatSecondsCompact(nextExpansion)} si aucun meilleur profil.`;
    }
    return `Statut: adversaire potentiel trouvé.\n${criteriaLine}\n${zoneLine}\nSuite: recherche élargie en cours.`;
  }

  if (tier <= 1) {
    return `Statut: recherche précise en cours.\n${criteriaLine}\n${zoneLine}`;
  }

  if (tier === 2) {
    return `Statut: recherche élargie niveau 1.\nCritère actuel: ${divisionLabel} +/-1 avec un ELO proche.\n${zoneLine}`;
  }

  if (tier === 3) {
    return `Statut: recherche élargie niveau 2.\nCritère actuel: ${divisionLabel} +/-2.\nZone étendue temporairement (+${geoRelaxationKm} km).\n${zoneLine}`;
  }

  return `Statut: recherche large.\nObjectif: trouver un match rapidement avec les meilleures compatibilités restantes.\nZone étendue temporairement (+${geoRelaxationKm} km).\n${zoneLine}`;
};

/**
 * @typedef {object} UseMatchmakingStateMachineParams
 * @property {MatchRequest | null} matchRequest
 * @property {Team | null} mySquad
 * @property {(statusData: MatchmakingStatus) => void} [onAutoSearchingDetected]
 * @property {() => void} [onConnectionError]
 * @property {(statusData: MatchmakingStatus, options?: {silent?: boolean}) => void} [onMatched]
 * @property {(statusData: MatchmakingStatus) => void} [onSearchingStatus]
 * @property {() => void} [onRecoverFromBackground]
 * @property {string} viewState
 */

/**
 * @param {UseMatchmakingStateMachineParams} params
 * @returns {{searchStatus: string, serverNow: string | null}}
 */
export const useMatchmakingStateMachine = ({
  matchRequest,
  mySquad,
  onAutoSearchingDetected,
  onConnectionError,
  onMatched,
  onRecoverFromBackground,
  onSearchingStatus,
  viewState,
}) => {
  const appStateRef = useRef(AppState.currentState);
  const failureCountRef = useRef(0);
  const [searchStatus, setSearchStatus] = useState('Initialisation...');
  const [searchInsights, setSearchInsights] = useState(/** @type {Record<string, any> | null} */ (null));
  const [searchInsightsUpdatedAt, setSearchInsightsUpdatedAt] = useState(0);
  const [serverNow, setServerNow] = useState(/** @type {string | null} */ (null));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      appStateRef.current = nextAppState;

      if (nextAppState === 'active' && viewState === 'connection_error') {
        failureCountRef.current = 0;
        onRecoverFromBackground?.();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [onRecoverFromBackground, viewState]);

  useEffect(() => {
    if (!POLLING_VIEWS.has(viewState)) return undefined;
    const squadId = getEntityDocumentId(mySquad);
    if (!squadId) return undefined;

    const pollingInterval = setInterval(async () => {
      if (appStateRef.current.match(/inactive|background/)) return;

      try {
        const statusData = await MatchmakingService.getActiveRequest(squadId);
        failureCountRef.current = 0;
        setServerNow(statusData?.serverNow || null);

        if (statusData?.state === 'matched') {
          onMatched?.(statusData, { silent: viewState === 'match_found' });
          return;
        }

        if (statusData?.state === 'searching') {
          onSearchingStatus?.(statusData);
        }

        if (statusData?.searchInsights) {
          setSearchInsights(statusData.searchInsights);
          setSearchInsightsUpdatedAt(Date.now());
        }

        if ((viewState === 'locker_room' || viewState === 'match_found') && statusData?.state === 'searching') {
          onAutoSearchingDetected?.(statusData);
        }
      } catch (error) {
        failureCountRef.current += 1;
        if (failureCountRef.current >= 3) {
          onConnectionError?.();
        }
      }
    }, 5000);

    const statusTextInterval = setInterval(() => {
      if (!matchRequest?.createdAt) return;
      const createdAt = new Date(matchRequest.createdAt).getTime();
      if (Number.isNaN(createdAt)) return;
      const nextExpansionInSec = computeRemainingExpansionSec(searchInsights, searchInsightsUpdatedAt);
      const zone = extractSearchZone(matchRequest, mySquad);
      setSearchStatus(buildSearchStatusLabel({
        cityLabel: zone.cityLabel,
        division: mySquad?.division,
        nextExpansionInSec,
        radiusKm: zone.radiusKm,
        searchInsights,
      }));
    }, 1000);

    return () => {
      clearInterval(pollingInterval);
      clearInterval(statusTextInterval);
    };
  }, [
    matchRequest?.createdAt,
    mySquad,
    onAutoSearchingDetected,
    onConnectionError,
    onMatched,
    onSearchingStatus,
    searchInsights,
    searchInsightsUpdatedAt,
    viewState,
  ]);

  return { searchStatus, serverNow };
};
