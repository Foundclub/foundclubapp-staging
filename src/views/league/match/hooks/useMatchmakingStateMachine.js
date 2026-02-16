import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import MatchmakingService from '@/services/league/MatchmakingService';
import { getEntityDocumentId } from '@/utils/entityId';

const POLLING_VIEWS = new Set(['radar', 'locker_room']);

const formatSecondsCompact = (seconds) => {
  const safe = Math.max(0, Number(seconds) || 0);
  const min = Math.floor(safe / 60);
  const sec = safe % 60;
  if (min <= 0) return `${sec}s`;
  return `${min}m ${String(sec).padStart(2, '0')}s`;
};

const computeRemainingExpansionSec = (searchInsights, updatedAtMs, nowMs = Date.now()) => {
  const base = Number(searchInsights?.nextExpansionInSec || 0);
  if (!Number.isFinite(base) || base <= 0) return 0;
  if (!Number.isFinite(updatedAtMs) || updatedAtMs <= 0) return base;
  const elapsedSec = Math.max(0, Math.floor((nowMs - updatedAtMs) / 1000));
  return Math.max(0, base - elapsedSec);
};

const hasTierBlocking = (searchInsights) => {
  const blocked = Array.isArray(searchInsights?.blockedCriteria) ? searchInsights.blockedCriteria : [];
  return blocked.includes('elo') || blocked.includes('division');
};

const buildSearchStatusLabel = (minutesElapsed, division, searchInsights, nextExpansionInSec) => {
  const divisionLabel = division || '?';
  const matched = Array.isArray(searchInsights?.matchedCriteria) ? searchInsights.matchedCriteria : [];
  const blocked = Array.isArray(searchInsights?.blockedCriteria) ? searchInsights.blockedCriteria : [];
  const tier = Number(searchInsights?.tier || 0) || (minutesElapsed < 5 ? 1 : minutesElapsed < 15 ? 2 : minutesElapsed < 30 ? 3 : 4);
  const geoRelaxationKm = Number(searchInsights?.geoRelaxationKm || 0);
  const policyVersion = searchInsights?.policyVersion ? ` [${searchInsights.policyVersion}]` : '';
  const remainingExpansion = Number.isFinite(nextExpansionInSec)
    ? Math.max(0, nextExpansionInSec)
    : Number(searchInsights?.nextExpansionInSec || 0);
  const criteriaDetails = matched.length || blocked.length
    ? ` Match: ${matched.join(', ') || '-'} | En attente: ${blocked.join(', ') || '-'}`
    : '';
  if (searchInsights?.candidateFound) {
    const nextExpansion = remainingExpansion;
    const isTierBlocked = blocked.includes('elo') || blocked.includes('division');
    if (isTierBlocked) {
      return nextExpansion > 0
        ? `Adversaire potentiel trouve, on cherche encore un niveau proche (palier suivant dans ${formatSecondsCompact(nextExpansion)}).${criteriaDetails}`
        : `Adversaire potentiel trouve, recherche en ouverture de palier.${criteriaDetails}`;
    }

    if (nextExpansion > 0) {
      return `Adversaires detectes. Affinage en cours (${formatSecondsCompact(nextExpansion)} avant elargissement, geo +${geoRelaxationKm}km).${criteriaDetails}${policyVersion}`;
    }
  }

  if (tier <= 1) {
    return `Recherche precise (ELO strict, Div ${divisionLabel}, geo +${geoRelaxationKm}km).${criteriaDetails}${policyVersion}`;
  }
  if (tier === 2) {
    return `Elargissement : Division +/- 1, ELO <= 200 (geo +${geoRelaxationKm}km).${criteriaDetails}${policyVersion}`;
  }
  if (tier === 3) {
    return `Recherche etendue : Division +/- 2 (geo +${geoRelaxationKm}km).${criteriaDetails}${policyVersion}`;
  }
  return `Recherche globale (Toutes divisions, geo +${geoRelaxationKm}km).${criteriaDetails}${policyVersion}`;
};

export const useMatchmakingStateMachine = ({
  matchRequest,
  mySquad,
  onAutoSearchingDetected,
  onConnectionError,
  onMatched,
  onRecoverFromBackground,
  viewState,
}) => {
  const appStateRef = useRef(AppState.currentState);
  const failureCountRef = useRef(0);
  const [searchStatus, setSearchStatus] = useState('Initialisation...');
  const [searchInsights, setSearchInsights] = useState(null);
  const [searchInsightsUpdatedAt, setSearchInsightsUpdatedAt] = useState(0);
  const [candidateFallbackCountdown, setCandidateFallbackCountdown] = useState(null);

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

        if (statusData?.state === 'matched') {
          onMatched?.(statusData);
          return;
        }

        if (statusData?.searchInsights) {
          setSearchInsights(statusData.searchInsights);
          setSearchInsightsUpdatedAt(Date.now());
        }

        if (viewState === 'locker_room' && statusData?.state === 'searching') {
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
      const minutesElapsed = (Date.now() - createdAt) / (1000 * 60);
      const nextExpansionInSec = computeRemainingExpansionSec(searchInsights, searchInsightsUpdatedAt);
      setSearchStatus(buildSearchStatusLabel(minutesElapsed, mySquad?.division, searchInsights, nextExpansionInSec));

      if (searchInsights?.candidateFound && hasTierBlocking(searchInsights) && nextExpansionInSec > 0) {
        setCandidateFallbackCountdown(nextExpansionInSec);
      } else {
        setCandidateFallbackCountdown(null);
      }
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
    searchInsights,
    searchInsightsUpdatedAt,
    viewState,
  ]);

  return { candidateFallbackCountdown, searchStatus };
};
