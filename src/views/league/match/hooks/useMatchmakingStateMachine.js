import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import MatchmakingService from '@/services/league/MatchmakingService';
import { getEntityDocumentId } from '@/utils/entityId';

const POLLING_VIEWS = new Set(['radar', 'locker_room']);

const buildSearchStatusLabel = (minutesElapsed, division, searchInsights) => {
  const divisionLabel = division || '?';
  const matched = Array.isArray(searchInsights?.matchedCriteria) ? searchInsights.matchedCriteria : [];
  const blocked = Array.isArray(searchInsights?.blockedCriteria) ? searchInsights.blockedCriteria : [];
  const criteriaDetails = matched.length || blocked.length
    ? ` Match: ${matched.join(', ') || '-'} | En attente: ${blocked.join(', ') || '-'}`
    : '';
  if (searchInsights?.candidateFound) {
    const nextExpansion = Number(searchInsights?.nextExpansionInSec || 0);
    const isTierBlocked = blocked.includes('elo') || blocked.includes('division');
    if (isTierBlocked) {
      return nextExpansion > 0
        ? `Adversaire potentiel trouve, on cherche encore un niveau proche (palier suivant dans ${nextExpansion}s).${criteriaDetails}`
        : `Adversaire potentiel trouve, recherche en ouverture de palier.${criteriaDetails}`;
    }

    if (nextExpansion > 0) {
      return `Adversaires detectes. Affinage en cours (${nextExpansion}s avant elargissement).${criteriaDetails}`;
    }
  }

  if (minutesElapsed < 5) {
    return `Recherche precise (ELO strict, Div ${divisionLabel}).${criteriaDetails}`;
  }
  if (minutesElapsed < 15) {
    return `Elargissement : Division +/- 1...${criteriaDetails}`;
  }
  if (minutesElapsed < 30) {
    return `Recherche etendue : Division +/- 2...${criteriaDetails}`;
  }
  return `Recherche globale (Toutes divisions)...${criteriaDetails}`;
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
      setSearchStatus(buildSearchStatusLabel(minutesElapsed, mySquad?.division, searchInsights));
    }, 10000);

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
    viewState,
  ]);

  return { searchStatus };
};
