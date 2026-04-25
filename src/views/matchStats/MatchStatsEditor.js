import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';
import useBottomDockLayout from '@/navigation/useBottomDockLayout';

import {
  useGetEventMatchStats,
  useGetLeagueMatchStats,
} from '@/services/matchStats/matchStatsQueries';
import {
  saveEventMatchStatsDraft,
  saveLeagueMatchStatsDraft,
  submitEventMatchStats,
  submitLeagueMatchStats,
} from '@/services/matchStats/matchStatsService';

const FOOTBALL_FIELDS = [
  { key: 'goals', label: 'Buts' },
  { key: 'assists', label: 'Passes D' },
  { key: 'goalsConceded', label: 'Buts encaisses' },
];

const BASKETBALL_FIELDS = [
  { key: 'points', label: 'Points' },
  { key: 'assists', label: 'Passes D' },
  { key: 'rebounds', label: 'Rebonds' },
  { key: 'threePointsMade', label: '3 pts' },
];

const normalizeSport = (value) => {
  const raw = String(value || '').toLowerCase();
  if (raw.includes('basket')) return 'basketball';
  return 'football';
};

const getSportLabel = (sport) => (normalizeSport(sport) === 'basketball' ? 'Basketball' : 'Football');

const getFieldConfig = (sport) => (normalizeSport(sport) === 'basketball'
  ? BASKETBALL_FIELDS
  : FOOTBALL_FIELDS);

const sanitizeNumericInput = (value) => String(value || '').replace(/[^\d]/g, '');

const shiftNumericStringValue = (value, delta, max = 999) => {
  const parsed = Number.parseInt(String(value || '0'), 10) || 0;
  const nextValue = Math.max(0, Math.min(max, parsed + delta));
  return String(nextValue);
};

const getLineKey = (line) => (
  line?.userDocumentId
  || line?.documentId
  || (line?.manualPlayerName ? `manual:${line.manualPlayerName}` : null)
  || (line?.key ? String(line.key) : null)
);

const buildInitialLines = (players, report, sport) => {
  const fields = getFieldConfig(sport);
  const existingLines = Array.isArray(report?.playerLines) ? report.playerLines : [];
  const existingMap = new Map(existingLines.map((line) => [getLineKey(line), line]));

  return (Array.isArray(players) ? players : []).map((player) => {
    const playerKey = getLineKey(player);
    const existing = existingMap.get(playerKey) || null;
    const suggestedPayload = player?.suggestedStats?.sportPayload || {};
    const payload = existing?.sportPayload || suggestedPayload;
    const baseLine = {
      key: playerKey || `player:${Math.random().toString(36).slice(2)}`,
      label: player?.label || [player?.firstname, player?.lastname].filter(Boolean).join(' ').trim() || player?.manualPlayerName || 'Joueur',
      manualPlayerName: player?.isManual ? (player?.label || player?.manualPlayerName || '') : (existing?.manualPlayerName || null),
      minutesPlayed: String(existing?.minutesPlayed ?? player?.suggestedStats?.minutesPlayed ?? 0),
      userDocumentId: player?.documentId || existing?.userDocumentId || null,
    };

    fields.forEach((field) => {
      baseLine[field.key] = String(payload?.[field.key] ?? 0);
    });

    if (normalizeSport(sport) === 'football') {
      baseLine.cleanSheet = Boolean(payload?.cleanSheet);
    }

    return baseLine;
  });
};

const serializeLine = (line, sport) => {
  const serialized = {
    manualPlayerName: line?.manualPlayerName || undefined,
    minutesPlayed: Number.parseInt(String(line?.minutesPlayed || '0'), 10) || 0,
    userDocumentId: line?.userDocumentId || undefined,
  };

  getFieldConfig(sport).forEach((field) => {
    serialized[field.key] = Number.parseInt(String(line?.[field.key] || '0'), 10) || 0;
  });

  if (normalizeSport(sport) === 'football') {
    serialized.cleanSheet = Boolean(line?.cleanSheet);
  }

  return serialized;
};

const buildInitialCoachReviews = (players, report) => {
  const existingReviews = Array.isArray(report?.coachPlayerReviews) ? report.coachPlayerReviews : [];
  const existingReviewMap = new Map(
    existingReviews.map((review) => [
      review?.userDocumentId || review?.manualPlayerName || review?.label,
      review,
    ]),
  );

  return (Array.isArray(players) ? players : []).map((player) => {
    const reviewKey = player?.documentId || player?.manualPlayerName || player?.label;
    const existing = existingReviewMap.get(reviewKey) || null;
    return {
      comment: existing?.comment || '',
      key: reviewKey,
      label: player?.label || 'Joueur',
      playerResponse: Array.isArray(report?.playerResponses)
        ? report.playerResponses.find((entry) => entry?.userDocumentId === player?.documentId) || null
        : null,
      rating: existing?.rating ?? null,
      userDocumentId: player?.documentId || null,
    };
  });
};

const serializeCoachReview = (review) => {
  if (!review?.comment && (review?.rating === null || review?.rating === undefined)) return null;
  return {
    comment: String(review?.comment || '').trim() || null,
    rating: review?.rating ?? null,
    userDocumentId: review?.userDocumentId || undefined,
  };
};

const isLineCompleted = (line, sport) => {
  if ((Number.parseInt(String(line?.minutesPlayed || '0'), 10) || 0) > 0) {
    return true;
  }

  return getFieldConfig(sport).some((field) => (Number.parseInt(String(line?.[field.key] || '0'), 10) || 0) > 0);
};

const buildScoreSummary = (score) => {
  if (score?.scoreFor === null || score?.scoreAgainst === null || score?.scoreFor === undefined || score?.scoreAgainst === undefined) {
    return 'Score a completer';
  }
  return `${score.scoreFor} - ${score.scoreAgainst}`;
};

const chunkFields = (fields, size = 2) => {
  const rows = [];
  for (let index = 0; index < fields.length; index += size) {
    rows.push(fields.slice(index, index + size));
  }
  return rows;
};

const getNumericStatValue = (value) => Number.parseInt(String(value || '0'), 10) || 0;

const getNullableNumericStatValue = (value) => {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, parsed);
};

const clampNumericInput = (value, max = 999) => {
  const sanitized = sanitizeNumericInput(value);
  if (!sanitized) return '';
  const parsed = Number.parseInt(sanitized, 10) || 0;
  return String(Math.max(0, Math.min(max, parsed)));
};

const getApiErrorMessage = (error, fallbackMessage) => (
  error?.response?.data?.error?.message
  || error?.response?.data?.message
  || error?.message
  || fallbackMessage
);

const getScoreSourceLabel = (score) => {
  if (score?.source === 'league_validated') return 'Score ligue valide';
  if (score?.source === 'external_sync') return 'Score officiel synchronise';
  if (score?.source === 'manual') return 'Score saisi dans FoundClub';
  return 'Score en attente';
};

const getReportStatusMeta = ({ isFinalized, isReviewRequired, isWaitingOfficial }, Colors) => {
  if (isReviewRequired) {
    return {
      backgroundColor: `${Colors.warning500}20`,
      borderColor: `${Colors.warning500}45`,
      label: 'Verification requise',
      textColor: Colors.warning500,
    };
  }

  if (isFinalized) {
    return {
      backgroundColor: `${Colors.success500}20`,
      borderColor: `${Colors.success500}45`,
      label: 'Stats publiees',
      textColor: Colors.success500,
    };
  }

  if (isWaitingOfficial) {
    return {
      backgroundColor: `${Colors.gold500}20`,
      borderColor: `${Colors.gold500}45`,
      label: 'Score officiel en attente',
      textColor: Colors.gold500,
    };
  }

  return {
    backgroundColor: `${Colors.primary500}20`,
    borderColor: `${Colors.primary500}45`,
    label: 'Brouillon en cours',
    textColor: Colors.primary500,
  };
};

const buildMatchStatsConsistencyIssues = ({
  playerLines,
  scoreAgainst,
  scoreFor,
  sport,
}) => {
  const lines = Array.isArray(playerLines) ? playerLines : [];
  if (!lines.length) return [];

  const normalizedSport = normalizeSport(sport);
  const resolvedScoreFor = getNullableNumericStatValue(scoreFor);
  const resolvedScoreAgainst = getNullableNumericStatValue(scoreAgainst);
  const issues = [];

  if (normalizedSport === 'basketball') {
    const totalPoints = lines.reduce(
      (accumulator, line) => accumulator + getNumericStatValue(line?.points),
      0,
    );
    const totalThreePointPoints = lines.reduce(
      (accumulator, line) => accumulator + (getNumericStatValue(line?.threePointsMade) * 3),
      0,
    );

    if (resolvedScoreFor !== null && totalPoints > resolvedScoreFor) {
      issues.push(`Les points saisis (${totalPoints}) depassent le score final (${resolvedScoreFor}).`);
    }

    if (totalThreePointPoints > totalPoints) {
      issues.push('Les tirs a 3 points saisis depassent le total des points marques.');
    }

    const invalidThreePointLine = lines.find((line) => (
      (getNumericStatValue(line?.threePointsMade) * 3) > getNumericStatValue(line?.points)
    ));
    if (invalidThreePointLine) {
      issues.push(`Les 3 points de ${invalidThreePointLine?.label || 'ce joueur'} depassent ses points marques.`);
    }

    return issues;
  }

  const totalGoals = lines.reduce(
    (accumulator, line) => accumulator + getNumericStatValue(line?.goals),
    0,
  );
  const totalAssists = lines.reduce(
    (accumulator, line) => accumulator + getNumericStatValue(line?.assists),
    0,
  );

  if (resolvedScoreFor !== null && totalGoals > resolvedScoreFor) {
    issues.push(`Les buts saisis (${totalGoals}) depassent le score final (${resolvedScoreFor}).`);
  }

  if (totalAssists > totalGoals) {
    issues.push(`Les passes decisives (${totalAssists}) depassent les buts marques (${totalGoals}).`);
  }

  if (resolvedScoreAgainst !== null) {
    const invalidConcededLine = lines.find((line) => (
      getNumericStatValue(line?.goalsConceded) > resolvedScoreAgainst
    ));
    if (invalidConcededLine) {
      issues.push(`Les buts encaisses de ${invalidConcededLine?.label || 'ce joueur'} depassent le score adverse (${resolvedScoreAgainst}).`);
    }

    if (resolvedScoreAgainst > 0 && lines.some((line) => Boolean(line?.cleanSheet))) {
      issues.push('Le clean sheet n est possible que si le score adverse est a 0.');
    }
  }

  const invalidCleanSheetLine = lines.find((line) => (
    Boolean(line?.cleanSheet) && getNumericStatValue(line?.goalsConceded) > 0
  ));
  if (invalidCleanSheetLine) {
    issues.push(`Le clean sheet de ${invalidCleanSheetLine?.label || 'ce joueur'} impose 0 but encaisse.`);
  }

  return issues;
};

/**
 *
 * @param root0
 * @param root0.navigation
 * @param root0.route
 */
function MatchStatsEditor({ navigation, route }) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const { height, width } = useWindowDimensions();
  const { sceneBottomInset } = useBottomDockLayout();
  const queryClient = useQueryClient();
  const sourceType = route?.params?.sourceType === 'league' ? 'league' : 'event';
  const eventId = route?.params?.eventId || null;
  const matchId = route?.params?.matchId || null;
  const requestedTeamId = route?.params?.teamId || null;
  const initialTitle = route?.params?.title || 'Stats du match';
  const hydratedReportKeyRef = useRef(null);

  const eventStatsQuery = useGetEventMatchStats(eventId || '', requestedTeamId || undefined, {
    enabled: Boolean(sourceType === 'event' && eventId),
  });

  const leagueStatsQuery = useGetLeagueMatchStats(matchId || '', requestedTeamId || undefined, {
    enabled: Boolean(sourceType === 'league' && matchId),
  });

  const statsQuery = sourceType === 'event' ? eventStatsQuery : leagueStatsQuery;
  const statsPayload = statsQuery.data || null;
  const sport = normalizeSport(statsPayload?.sport || route?.params?.sport || 'football');
  const isScoreLocked = Boolean(statsPayload?.score?.locked);
  const isWaitingOfficial = Boolean(statsPayload?.score?.waitingOfficial);
  const reportStatus = statsPayload?.report?.status || 'draft';
  const isFinalized = reportStatus === 'final';
  const isReviewRequired = Boolean(statsPayload?.report?.needsReview);
  const isReadOnly = isFinalized && !isReviewRequired;
  const isCompactMobile = width < 390 || height < 760;
  const sectionPadding = isCompactMobile ? 14 : 16;
  const sectionGap = isCompactMobile ? 10 : 12;
  const scoreInputHeight = isCompactMobile ? 64 : 72;
  const statInputHeight = isCompactMobile ? 48 : 52;
  const scrollBottomPadding = Math.max(sceneBottomInset, 24);
  const teamName = statsPayload?.team?.name || route?.params?.teamName || '';
  const headerSurfaceColor = `${Colors.primary700}D9`;
  const heroSurfaceColor = `${Colors.primary700}F0`;
  const counterBorderColor = `${Colors.primary500}3D`;
  const counterButtonColor = `${Colors.primary500}24`;
  const counterSurfaceColor = `${Colors.primary500}16`;
  const pillSurfaceColor = `${Colors.primary500}1A`;
  const playerCardSurfaceColor = `${Colors.primary500}14`;
  const statusMeta = useMemo(() => getReportStatusMeta({
    isFinalized,
    isReviewRequired,
    isWaitingOfficial,
  }, Colors), [Colors, isFinalized, isReviewRequired, isWaitingOfficial]);
  const playerStatRows = useMemo(() => chunkFields(getFieldConfig(sport), 2), [sport]);
  const excludedNoShowPlayers = useMemo(
    () => (Array.isArray(statsPayload?.excludedNoShowPlayers) ? statsPayload.excludedNoShowPlayers : []),
    [statsPayload?.excludedNoShowPlayers],
  );

  const [scoreFor, setScoreFor] = useState('');
  const [scoreAgainst, setScoreAgainst] = useState('');
  const [playerLines, setPlayerLines] = useState([]);
  const [collectiveRating, setCollectiveRating] = useState(null);
  const [collectiveComment, setCollectiveComment] = useState('');
  const [coachReviews, setCoachReviews] = useState([]);

  useEffect(() => {
    const reportKey = [
      statsPayload?.sourceType,
      statsPayload?.report?.documentId || 'empty',
      statsPayload?.score?.externalResultVersion || 'no-score-version',
      statsPayload?.score?.scoreFor ?? 'no-score-for',
      statsPayload?.score?.scoreAgainst ?? 'no-score-against',
      statsPayload?.report?.needsReview ? 'review' : 'stable',
      statsPayload?.team?.documentId || requestedTeamId || 'auto',
    ].join(':');

    if (!statsPayload || hydratedReportKeyRef.current === reportKey) {
      return;
    }

    hydratedReportKeyRef.current = reportKey;
    setScoreFor(
      statsPayload?.score?.scoreFor === null || statsPayload?.score?.scoreFor === undefined
        ? ''
        : String(statsPayload.score.scoreFor),
    );
    setScoreAgainst(
      statsPayload?.score?.scoreAgainst === null || statsPayload?.score?.scoreAgainst === undefined
        ? ''
        : String(statsPayload.score.scoreAgainst),
    );
    setPlayerLines(buildInitialLines(statsPayload?.availablePlayers, statsPayload?.report, sport));
    setCollectiveRating(statsPayload?.report?.collectiveRating ?? null);
    setCollectiveComment(statsPayload?.report?.collectiveComment || '');
    setCoachReviews(buildInitialCoachReviews(
      statsPayload?.availablePlayers,
      {
        ...(statsPayload?.report || {}),
        playerResponses: statsPayload?.playerResponses || [],
      },
    ));
  }, [requestedTeamId, sport, statsPayload]);

  const completedPlayers = useMemo(
    () => playerLines.filter((line) => isLineCompleted(line, sport)).length,
    [playerLines, sport],
  );

  const consistencyIssues = useMemo(() => buildMatchStatsConsistencyIssues({
    playerLines,
    scoreAgainst,
    scoreFor,
    sport,
  }), [playerLines, scoreAgainst, scoreFor, sport]);

  const hasConsistencyIssues = consistencyIssues.length > 0;

  const hasScore = useMemo(
    () => scoreFor.trim() !== '' && scoreAgainst.trim() !== '',
    [scoreAgainst, scoreFor],
  );

  const matchLabel = useMemo(() => {
    if (sourceType === 'league') {
      return route?.params?.matchLabel || initialTitle;
    }
    return statsPayload?.event?.name || initialTitle;
  }, [initialTitle, route?.params?.matchLabel, sourceType, statsPayload?.event?.name]);

  const submitConfirmationMessage = useMemo(() => {
    if (isReviewRequired) {
      return 'Le score officiel a change. Cette publication confirme la nouvelle version des stats pour ton equipe.';
    }

    return 'Apres publication, ce rapport devient la version officielle des statistiques pour cette equipe.';
  }, [isReviewRequired]);

  const submitButtonTitle = useMemo(() => {
    if (isReadOnly) return 'Rapport finalise';
    if (isReviewRequired) return 'Mettre a jour apres score officiel';
    return 'Publier les stats';
  }, [isReadOnly, isReviewRequired]);

  const submitHelperText = useMemo(() => {
    if (isReadOnly) {
      return 'Ce rapport est deja finalise. Les agregations joueur et equipe sont a jour.';
    }

    if (isReviewRequired) {
      return 'Le score officiel a change. Verifie les lignes puis republie directement cette version.';
    }

    if (hasConsistencyIssues) {
      return 'Corrige les incoherences entre le score final et les statistiques joueur avant de continuer.';
    }

    return 'Le brouillon reste modifiable tant que tu ne publies pas ce rapport.';
  }, [hasConsistencyIssues, isReadOnly, isReviewRequired]);

  const invalidateRelatedQueries = useCallback(async () => {
    if (sourceType === 'event' && eventId) {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['event', eventId] }),
        queryClient.invalidateQueries({ queryKey: ['eventMatchResult', eventId] }),
        queryClient.invalidateQueries({ queryKey: ['eventMatchStats', eventId] }),
        queryClient.invalidateQueries({ queryKey: ['pendingMatchStatsPrompts'] }),
        queryClient.invalidateQueries({ queryKey: ['personalStats'] }),
        requestedTeamId
          ? queryClient.invalidateQueries({ queryKey: ['teamPerformanceStats', requestedTeamId] })
          : Promise.resolve(),
      ]);
      return;
    }

    if (sourceType === 'league' && matchId) {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['league-match', matchId] }),
        queryClient.invalidateQueries({ queryKey: ['leagueMatchStats', matchId] }),
        queryClient.invalidateQueries({ queryKey: ['pendingMatchStatsPrompts'] }),
        queryClient.invalidateQueries({ queryKey: ['personalStats'] }),
        requestedTeamId
          ? queryClient.invalidateQueries({ queryKey: ['teamPerformanceStats', requestedTeamId] })
          : Promise.resolve(),
      ]);
    }
  }, [eventId, matchId, queryClient, requestedTeamId, sourceType]);

  const buildPayload = useCallback(() => ({
    coachPlayerReviews: coachReviews.map(serializeCoachReview).filter(Boolean),
    collectiveComment: collectiveComment.trim() || null,
    collectiveRating,
    playerLines: playerLines.map((line) => serializeLine(line, sport)),
    ...(sourceType === 'event' ? {
      scoreAgainst: hasScore ? Number.parseInt(scoreAgainst, 10) : undefined,
      scoreFor: hasScore ? Number.parseInt(scoreFor, 10) : undefined,
    } : {}),
    ...(requestedTeamId ? { teamId: requestedTeamId } : {}),
  }), [coachReviews, collectiveComment, collectiveRating, hasScore, playerLines, requestedTeamId, scoreAgainst, scoreFor, sourceType, sport]);

  const redirectToReviewScreen = useCallback(() => {
    if (sourceType === 'event' && eventId) {
      navigation.replace(RouteNames.EventDetails, { eventId });
      return;
    }

    if (sourceType === 'league' && matchId) {
      navigation.replace(RouteNames.LeagueMatchDetails, { matchId });
      return;
    }

    navigation.goBack();
  }, [eventId, matchId, navigation, sourceType]);

  const saveDraftMutation = useMutation({
    mutationFn: () => {
      const payload = buildPayload();
      if (sourceType === 'event') {
        return saveEventMatchStatsDraft(eventId, payload);
      }
      return saveLeagueMatchStatsDraft(matchId, payload);
    },
    onError: (error) => {
      Alert.alert('Erreur', getApiErrorMessage(error, 'Impossible d enregistrer ce brouillon de stats.'));
    },
    onSuccess: async () => {
      await invalidateRelatedQueries();
      await statsQuery.refetch();
      Alert.alert('Brouillon enregistre', 'Le brouillon des stats du match a bien ete enregistre.');
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => {
      const payload = buildPayload();
      if (sourceType === 'event') {
        return submitEventMatchStats(eventId, payload);
      }
      return submitLeagueMatchStats(matchId, payload);
    },
    onError: (error) => {
      Alert.alert('Erreur', getApiErrorMessage(error, 'Impossible de publier ces statistiques.'));
    },
    onSuccess: async () => {
      await invalidateRelatedQueries();
      Alert.alert(
        'Stats publiees',
        isReviewRequired
          ? 'Le rapport a ete mis a jour apres la synchronisation du score officiel.'
          : 'Les statistiques du match sont maintenant finalisees.',
        [{ onPress: redirectToReviewScreen, text: 'OK' }],
      );
    },
  });

  const updateLineValue = useCallback((lineKey, field, value) => {
    setPlayerLines((current) => current.map((line) => (line.key === lineKey
      ? { ...line, [field]: value }
      : line)));
  }, []);

  const updateCoachReview = useCallback((reviewKey, field, value) => {
    setCoachReviews((current) => current.map((review) => (review.key === reviewKey
      ? { ...review, [field]: value }
      : review)));
  }, []);

  const getLineFieldMaxValue = useCallback((currentLines, lineKey, field) => {
    const lines = Array.isArray(currentLines) ? currentLines : [];
    const currentLine = lines.find((line) => line.key === lineKey) || null;
    const otherLines = lines.filter((line) => line.key !== lineKey);
    const resolvedScoreFor = getNullableNumericStatValue(scoreFor);
    const resolvedScoreAgainst = getNullableNumericStatValue(scoreAgainst);

    if (normalizeSport(sport) === 'basketball') {
      if (field === 'points') {
        if (resolvedScoreFor === null) return 999;
        const otherPoints = otherLines.reduce(
          (accumulator, line) => accumulator + getNumericStatValue(line?.points),
          0,
        );
        return Math.max(0, resolvedScoreFor - otherPoints);
      }

      if (field === 'threePointsMade') {
        const maxByLinePoints = Math.floor(getNumericStatValue(currentLine?.points) / 3);
        if (resolvedScoreFor === null) {
          return maxByLinePoints;
        }
        const otherThreePointPoints = otherLines.reduce(
          (accumulator, line) => accumulator + (getNumericStatValue(line?.threePointsMade) * 3),
          0,
        );
        const maxByScore = Math.floor(Math.max(0, resolvedScoreFor - otherThreePointPoints) / 3);
        return Math.max(0, Math.min(maxByLinePoints, maxByScore));
      }

      return 999;
    }

    if (field === 'goals') {
      if (resolvedScoreFor === null) return 999;
      const otherGoals = otherLines.reduce(
        (accumulator, line) => accumulator + getNumericStatValue(line?.goals),
        0,
      );
      return Math.max(0, resolvedScoreFor - otherGoals);
    }

    if (field === 'assists') {
      const totalGoals = lines.reduce(
        (accumulator, line) => accumulator + getNumericStatValue(line?.goals),
        0,
      );
      const assistsWithoutCurrent = otherLines.reduce(
        (accumulator, line) => accumulator + getNumericStatValue(line?.assists),
        0,
      );
      const maxByGoals = Math.max(0, totalGoals - assistsWithoutCurrent);
      if (resolvedScoreFor === null) return maxByGoals;
      return Math.max(0, Math.min(maxByGoals, resolvedScoreFor - assistsWithoutCurrent));
    }

    if (field === 'goalsConceded') {
      if (resolvedScoreAgainst === null) return 999;
      return resolvedScoreAgainst;
    }

    return 999;
  }, [scoreAgainst, scoreFor, sport]);

  const updateLineNumericValue = useCallback((lineKey, field, value) => {
    setPlayerLines((current) => current.map((line) => {
      if (line.key !== lineKey) return line;
      const maxValue = getLineFieldMaxValue(current, lineKey, field);
      return {
        ...line,
        [field]: clampNumericInput(value, maxValue),
      };
    }));
  }, [getLineFieldMaxValue]);

  const adjustLineValue = useCallback((lineKey, field, delta) => {
    setPlayerLines((current) => current.map((line) => {
      if (line.key !== lineKey) return line;
      const maxValue = getLineFieldMaxValue(current, lineKey, field);
      return {
        ...line,
        [field]: clampNumericInput(
          String(getNumericStatValue(line?.[field]) + delta),
          maxValue,
        ),
      };
    }));
  }, [getLineFieldMaxValue]);

  const adjustScoreValue = useCallback((field, delta) => {
    const setter = field === 'scoreFor' ? setScoreFor : setScoreAgainst;
    setter((current) => shiftNumericStringValue(current, delta));
  }, []);

  const renderCounterField = ({
    containerStyle,
    disabled = false,
    label,
    large = false,
    onChangeText,
    onDecrement,
    onIncrement,
    value,
  }) => {
    const fieldHeight = large ? scoreInputHeight : statInputHeight;
    const fieldRadius = large ? 18 : 16;
    const valueTextStyle = large ? Fonts.h2Bold : Fonts.p1Bold;
    const actionTextStyle = large ? Fonts.h3Bold : Fonts.h4Bold;
    let actionWidth = isCompactMobile ? 28 : 30;
    if (large) {
      actionWidth = isCompactMobile ? 34 : 38;
    }

    return (
      <View style={containerStyle}>
        {label ? (
          <Text style={[Fonts.p4Bold, Fonts.neutral100, Spaces.marginBottom[8]]}>{label}</Text>
        ) : null}
        <View
          style={[
            Alignments.row,
            Alignments.alignCenter,
            {
              backgroundColor: counterSurfaceColor,
              borderColor: counterBorderColor,
              borderRadius: fieldRadius,
              borderWidth: 1,
              minHeight: fieldHeight,
              overflow: 'hidden',
            },
          ]}
        >
          <Pressable
            android_ripple={{ borderless: false, color: `${Colors.primary200}22` }}
            disabled={disabled}
            hitSlop={8}
            onPress={() => onDecrement?.()}
            style={[
              Alignments.justifyCenter,
              Alignments.alignCenter,
              {
                alignSelf: 'stretch',
                backgroundColor: counterButtonColor,
                borderRightColor: counterBorderColor,
                borderRightWidth: 1,
                opacity: disabled ? 0.45 : 1,
                width: actionWidth,
              },
            ]}
          >
            <Text style={[actionTextStyle, { color: Colors.primary200 }]}>-</Text>
          </Pressable>
          <TextInput
            editable={!disabled}
            keyboardType="number-pad"
            maxLength={3}
            onChangeText={(nextValue) => onChangeText(sanitizeNumericInput(nextValue))}
            placeholder="0"
            placeholderTextColor={Colors.primary200}
            selectTextOnFocus
            style={[
              valueTextStyle,
              Fonts.neutral00,
              Fonts.textCenter,
              {
                flex: 1,
                minHeight: fieldHeight,
                minWidth: large ? 56 : 34,
                paddingHorizontal: large ? 10 : 6,
                paddingVertical: 0,
              },
            ]}
            value={String(value || '')}
          />
          <Pressable
            android_ripple={{ borderless: false, color: `${Colors.primary200}22` }}
            disabled={disabled}
            hitSlop={8}
            onPress={() => onIncrement?.()}
            style={[
              Alignments.justifyCenter,
              Alignments.alignCenter,
              {
                alignSelf: 'stretch',
                backgroundColor: counterButtonColor,
                borderLeftColor: counterBorderColor,
                borderLeftWidth: 1,
                opacity: disabled ? 0.45 : 1,
                width: actionWidth,
              },
            ]}
          >
            <Text style={[actionTextStyle, { color: Colors.primary200 }]}>+</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const handleSaveDraft = useCallback(() => {
    if (isReviewRequired) {
      Alert.alert(
        'Revision requise',
        'Le score officiel a change. Verifie les lignes puis republie directement cette version.',
      );
      return;
    }

    if (sourceType === 'event' && !hasScore && !isScoreLocked) {
      Alert.alert('Score manquant', 'Renseigne le score du match avant d enregistrer ce brouillon.');
      return;
    }

    if (hasConsistencyIssues) {
      Alert.alert('Corrections requises', consistencyIssues.join('\n'));
      return;
    }

    saveDraftMutation.mutate();
  }, [consistencyIssues, hasConsistencyIssues, hasScore, isReviewRequired, isScoreLocked, saveDraftMutation, sourceType]);

  const handleSubmit = useCallback(() => {
    if (sourceType === 'event' && !hasScore) {
      Alert.alert('Score requis', 'Le score final doit etre enregistre avant de publier les stats.');
      return;
    }

    if (hasConsistencyIssues) {
      Alert.alert('Corrections requises', consistencyIssues.join('\n'));
      return;
    }

    Alert.alert(
      isReviewRequired ? 'Mettre a jour apres score officiel ?' : 'Publier les stats du match ?',
      submitConfirmationMessage,
      [
        { style: 'cancel', text: 'Annuler' },
        {
          onPress: () => submitMutation.mutate(),
          text: isReviewRequired ? 'Mettre a jour' : 'Publier',
        },
      ],
    );
  }, [consistencyIssues, hasConsistencyIssues, hasScore, isReviewRequired, sourceType, submitConfirmationMessage, submitMutation]);

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[Spaces.paddingBottom[24], Spaces.paddingTop[0], Alignments.fill]}
    >
      <View
        style={[
          Spaces.marginHorizontal[16],
          Spaces.marginTop[isCompactMobile ? 8 : 12],
          Spaces.marginBottom[8],
          Spaces.paddingHorizontal[12],
          Spaces.paddingVertical[10],
          Alignments.row,
          Alignments.alignCenter,
          {
            backgroundColor: headerSurfaceColor,
            borderColor: counterBorderColor,
            borderRadius: 22,
            borderWidth: 1,
          },
        ]}
      >
        <HeaderBackButton onPress={() => navigation.goBack()} />
        <View style={[Alignments.alignCenter, { flex: 1 }, Spaces.gap[4]]}>
          <Text style={[Fonts.h3Bold, Fonts.neutral00]}>{initialTitle}</Text>
          {teamName ? <Text style={[Fonts.p2, Fonts.neutral100]}>{teamName}</Text> : null}
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          Spaces.paddingHorizontal[16],
          { paddingBottom: scrollBottomPadding },
          Spaces.gap[isCompactMobile ? 12 : 16],
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            ApplicationStyle.borderRadius24,
            Spaces.padding[sectionPadding],
            Spaces.gap[sectionGap],
            {
              backgroundColor: heroSurfaceColor,
              borderColor: counterBorderColor,
              borderWidth: 1,
            },
          ]}
        >
          <View style={[Spaces.gap[4]]}>
            <Text style={[Fonts.p4Bold, Fonts.primary500]}>Bilan equipe</Text>
            <Text style={[Fonts.h2Bold, Fonts.neutral00]}>{matchLabel}</Text>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {sourceType === 'event' ? "Bilan collectif de l'evenement" : 'Bilan collectif du match ligue'}
            </Text>
          </View>

          <View style={[Alignments.row, Spaces.gap[8], { flexWrap: 'wrap' }]}>
            <View
              style={[
                Spaces.paddingHorizontal[12],
                Spaces.paddingVertical[6],
                {
                  backgroundColor: statusMeta.backgroundColor,
                  borderColor: statusMeta.borderColor,
                  borderRadius: 999,
                  borderWidth: 1,
                },
              ]}
            >
              <Text style={[Fonts.p4Bold, { color: statusMeta.textColor }]}>{statusMeta.label}</Text>
            </View>
            <View style={[ApplicationStyle.backgroundColor.primary500, ApplicationStyle.borderRadius16, Spaces.paddingHorizontal[12], Spaces.paddingVertical[6]]}>
              <Text style={[Fonts.p3Bold, Fonts.neutral00]}>{buildScoreSummary(statsPayload?.score)}</Text>
            </View>
            <View
              style={[
                Spaces.paddingHorizontal[12],
                Spaces.paddingVertical[6],
                {
                  backgroundColor: pillSurfaceColor,
                  borderColor: counterBorderColor,
                  borderRadius: 16,
                  borderWidth: 1,
                },
              ]}
            >
              <Text style={[Fonts.p3Bold, Fonts.neutral00]}>{`${completedPlayers}/${playerLines.length} joueurs completes`}</Text>
            </View>
            <View
              style={[
                Spaces.paddingHorizontal[12],
                Spaces.paddingVertical[6],
                {
                  backgroundColor: pillSurfaceColor,
                  borderColor: counterBorderColor,
                  borderRadius: 16,
                  borderWidth: 1,
                },
              ]}
            >
              <Text style={[Fonts.p3Bold, Fonts.neutral00]}>{getSportLabel(sport)}</Text>
            </View>
          </View>
        </View>

        {statsQuery.isLoading ? (
          <View style={[ApplicationStyle.backgroundColor.primary700, ApplicationStyle.borderRadius24, Spaces.padding[24]]}>
            <Text style={[Fonts.p1, Fonts.neutral00, Fonts.textCenter]}>Chargement des stats du match...</Text>
          </View>
        ) : null}

        {statsQuery.error ? (
          <View style={[ApplicationStyle.backgroundColor.primary700, ApplicationStyle.borderRadius24, Spaces.padding[24], Spaces.gap[8]]}>
            <Text style={[Fonts.p1Bold, Fonts.neutral00]}>Impossible de charger ce rapport.</Text>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {String(statsQuery.error?.message || 'Une erreur est survenue.')}
            </Text>
            <Button onPress={() => statsQuery.refetch()} title="Réessayer" variant="Secondary" />
          </View>
        ) : null}

        {!statsQuery.isLoading && !statsQuery.error ? (
          <>
            {isReviewRequired ? (
              <View
                style={[
                  ApplicationStyle.borderRadius24,
                  Spaces.padding[sectionPadding],
                  Spaces.gap[8],
                  {
                    backgroundColor: `${Colors.warning500}14`,
                    borderColor: `${Colors.warning500}45`,
                    borderWidth: 1,
                  },
                ]}
              >
                <Text style={[Fonts.h4Bold, { color: Colors.warning500 }]}>Score officiel mis a jour</Text>
                <Text style={[Fonts.p2, Fonts.neutral100]}>
                  Le score synchronise depuis la competition officielle a change apres une saisie precedente. Verifie les statistiques joueur puis republie ce rapport.
                </Text>
              </View>
            ) : null}

            {hasConsistencyIssues ? (
              <View
                style={[
                  ApplicationStyle.borderRadius24,
                  Spaces.padding[sectionPadding],
                  Spaces.gap[8],
                  {
                    backgroundColor: `${Colors.warning500}14`,
                    borderColor: `${Colors.warning500}45`,
                    borderWidth: 1,
                  },
                ]}
              >
                <Text style={[Fonts.h4Bold, { color: Colors.warning500 }]}>Corrections requises</Text>
                {consistencyIssues.map((issue) => (
                  <Text key={issue} style={[Fonts.p3, Fonts.neutral100]}>
                    {`\u2022 ${issue}`}
                  </Text>
                ))}
              </View>
            ) : null}

            <View style={[ApplicationStyle.backgroundColor.primary700, ApplicationStyle.borderRadius24, Spaces.padding[sectionPadding], Spaces.gap[sectionGap]]}>
              <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
                <View style={{ flex: 1 }}>
                  <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Score final</Text>
                  <Text style={[Fonts.p3, Fonts.neutral100]}>{getScoreSourceLabel(statsPayload?.score)}</Text>
                </View>
                <View
                  style={[
                    Spaces.paddingHorizontal[12],
                    Spaces.paddingVertical[8],
                    {
                      backgroundColor: pillSurfaceColor,
                      borderColor: counterBorderColor,
                      borderRadius: 16,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <Text style={[Fonts.p3Bold, isScoreLocked ? Fonts.primary100 : Fonts.neutral00]}>
                    {isScoreLocked ? 'Verrouille' : 'Editable'}
                  </Text>
                </View>
              </View>

              {isWaitingOfficial ? (
                <Text style={[Fonts.p2, Fonts.primary100]}>
                  Le score officiel est encore attendu depuis la synchronisation externe.
                </Text>
              ) : null}

              <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12]]}>
                {renderCounterField({
                  containerStyle: { flex: 1 },
                  disabled: isScoreLocked || isReadOnly,
                  label: 'Notre score',
                  large: true,
                  onChangeText: setScoreFor,
                  onDecrement: () => adjustScoreValue('scoreFor', -1),
                  onIncrement: () => adjustScoreValue('scoreFor', 1),
                  value: scoreFor,
                })}
                <Text style={[Fonts.h2Bold, Fonts.neutral00]}>-</Text>
                {renderCounterField({
                  containerStyle: { flex: 1 },
                  disabled: isScoreLocked || isReadOnly,
                  label: 'Score adverse',
                  large: true,
                  onChangeText: setScoreAgainst,
                  onDecrement: () => adjustScoreValue('scoreAgainst', -1),
                  onIncrement: () => adjustScoreValue('scoreAgainst', 1),
                  value: scoreAgainst,
                })}
              </View>

              {sourceType === 'league' ? (
                <Text style={[Fonts.p3, Fonts.neutral100]}>
                  Le score ligue valide reste la source officielle pour ce rapport.
                </Text>
              ) : null}
            </View>

            <View style={[ApplicationStyle.backgroundColor.primary700, ApplicationStyle.borderRadius24, Spaces.padding[sectionPadding], Spaces.gap[sectionGap]]}>
              <View style={[Spaces.gap[4]]}>
                <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Bilan collectif</Text>
                <Text style={[Fonts.p3, Fonts.neutral100]}>
                  Donne une note d equipe sur 10 et un commentaire collectif visible par ton groupe.
                </Text>
              </View>
              <View style={[Alignments.row, Alignments.wrap, Spaces.gap[8]]}>
                {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => {
                  const isActive = collectiveRating === value;
                  return (
                    <TouchableOpacity
                      key={value}
                      onPress={() => setCollectiveRating(value)}
                      style={[
                        Spaces.paddingHorizontal[12],
                        Spaces.paddingVertical[10],
                        {
                          backgroundColor: isActive ? `${Colors.primary500}24` : pillSurfaceColor,
                          borderColor: isActive ? `${Colors.primary200}CC` : counterBorderColor,
                          borderRadius: 16,
                          borderWidth: 1,
                          minWidth: 44,
                        },
                      ]}
                    >
                      <Text style={[Fonts.p3Bold, isActive ? Fonts.primary100 : Fonts.neutral00, Fonts.textCenter]}>
                        {value}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TextInput
                multiline
                numberOfLines={4}
                onChangeText={setCollectiveComment}
                placeholder="Ressenti collectif, dynamique du groupe, points forts, points a travailler..."
                placeholderTextColor={Colors.neutral400}
                style={[
                  Fonts.p2,
                  Fonts.neutral00,
                  ApplicationStyle.backgroundColor.primary900,
                  { borderRadius: 20 },
                  Spaces.padding[16],
                  {
                    borderColor: counterBorderColor,
                    borderWidth: 1,
                    minHeight: 120,
                    textAlignVertical: 'top',
                  },
                ]}
                value={collectiveComment}
              />
              <View
                style={[
                  ApplicationStyle.backgroundColor.primary900,
                  { borderRadius: 20 },
                  Spaces.padding[12],
                  {
                    borderColor: counterBorderColor,
                    borderWidth: 1,
                  },
                ]}
              >
                <Text style={[Fonts.p4Bold, Fonts.primary100]}>
                  {`${statsPayload?.report?.responseCompletionCount ?? 0}/${statsPayload?.report?.responseEligibleCount ?? playerLines.length} joueurs ont repondu`}
                </Text>
              </View>
            </View>

            <View style={[ApplicationStyle.backgroundColor.primary700, ApplicationStyle.borderRadius24, Spaces.padding[sectionPadding], Spaces.gap[sectionGap]]}>
              <View style={[Spaces.gap[4]]}>
                <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Retours individuels optionnels</Text>
                <Text style={[Fonts.p3, Fonts.neutral100]}>
                  Tu peux ajouter une note et un commentaire prive a chaque joueur si tu le souhaites.
                </Text>
              </View>
              {coachReviews.length ? coachReviews.map((review) => (
                <View
                  key={review.key}
                  style={[
                    Spaces.padding[sectionPadding],
                    Spaces.gap[12],
                    {
                      backgroundColor: playerCardSurfaceColor,
                      borderColor: counterBorderColor,
                      borderRadius: 20,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{review.label}</Text>
                      <Text style={[Fonts.p4, Fonts.neutral100]}>
                        {review?.playerResponse?.stateLabel || 'Pas encore de retour joueur'}
                      </Text>
                    </View>
                    <View style={[Alignments.row, Alignments.wrap, Spaces.gap[6], { justifyContent: 'flex-end', maxWidth: 180 }]}>
                      {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => {
                        const isActive = review.rating === value;
                        return (
                          <TouchableOpacity
                            key={`${review.key}-${value}`}
                            onPress={() => updateCoachReview(review.key, 'rating', value)}
                            style={[
                              Spaces.paddingHorizontal[10],
                              Spaces.paddingVertical[6],
                              {
                                backgroundColor: isActive ? `${Colors.primary500}24` : pillSurfaceColor,
                                borderColor: isActive ? `${Colors.primary200}CC` : counterBorderColor,
                                borderRadius: 14,
                                borderWidth: 1,
                                minWidth: 36,
                              },
                            ]}
                          >
                            <Text style={[Fonts.p4Bold, isActive ? Fonts.primary100 : Fonts.neutral00, Fonts.textCenter]}>
                              {value}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                  <TextInput
                    multiline
                    numberOfLines={3}
                    onChangeText={(value) => updateCoachReview(review.key, 'comment', value)}
                    placeholder="Commentaire prive pour ce joueur"
                    placeholderTextColor={Colors.neutral400}
                    style={[
                      Fonts.p3,
                      Fonts.neutral00,
                      ApplicationStyle.backgroundColor.primary900,
                      { borderRadius: 20 },
                      Spaces.padding[14],
                      {
                        borderColor: counterBorderColor,
                        borderWidth: 1,
                        minHeight: 94,
                        textAlignVertical: 'top',
                      },
                    ]}
                    value={review.comment}
                  />
                </View>
              )) : (
                <View style={[ApplicationStyle.backgroundColor.primary900, { borderRadius: 20 }, Spaces.padding[20], Spaces.gap[8]]}>
                  <Text style={[Fonts.p2Bold, Fonts.neutral00, Fonts.textCenter]}>Aucun joueur disponible.</Text>
                  <Text style={[Fonts.p3, Fonts.neutral100, Fonts.textCenter]}>
                    Les retours individuels apparaitront ici des que la liste joueur sera disponible.
                  </Text>
                </View>
              )}
            </View>

            {excludedNoShowPlayers.length ? (
              <View
                style={[
                  ApplicationStyle.backgroundColor.primary700,
                  ApplicationStyle.borderRadius24,
                  Spaces.padding[sectionPadding],
                  Spaces.gap[12],
                  {
                    borderColor: `${Colors.warning500}40`,
                    borderWidth: 1,
                  },
                ]}
              >
                <Text style={[Fonts.h4Bold, { color: Colors.warning500 }]}>Joueurs non pointes</Text>
                <Text style={[Fonts.p3, Fonts.neutral100]}>
                  Ces joueurs restent visibles pour le coach, mais ils ne sont pas inclus dans les stats tant que leur attendance n&apos;a pas ete corrigee.
                </Text>
                <View style={[Alignments.row, Alignments.wrap, Spaces.gap[8]]}>
                  {excludedNoShowPlayers.map((player) => (
                    <View
                      key={player?.documentId || player?.label || player?.manualPlayerName}
                      style={[
                        Spaces.paddingHorizontal[10],
                        Spaces.paddingVertical[6],
                        {
                          backgroundColor: `${Colors.warning500}18`,
                          borderColor: `${Colors.warning500}3A`,
                          borderRadius: 999,
                          borderWidth: 1,
                        },
                      ]}
                    >
                      <Text style={[Fonts.p4Bold, Fonts.neutral00]}>
                        {player?.label || player?.manualPlayerName || 'Joueur'}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={[ApplicationStyle.backgroundColor.primary700, ApplicationStyle.borderRadius24, Spaces.padding[sectionPadding], Spaces.gap[sectionGap]]}>
              <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
                <View style={[Spaces.gap[4], { flex: 1 }]}>
                  <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Stats joueurs</Text>
                  <Text style={[Fonts.p3, Fonts.neutral100]}>
                    Temps de jeu et statistiques cles adaptees au sport du match.
                  </Text>
                </View>
                <View
                  style={[
                    Spaces.paddingHorizontal[10],
                    Spaces.paddingVertical[6],
                    {
                      backgroundColor: pillSurfaceColor,
                      borderColor: counterBorderColor,
                      borderRadius: 16,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
                    {`${playerLines.length} ${playerLines.length > 1 ? 'lignes' : 'ligne'}`}
                  </Text>
                </View>
              </View>

              {playerLines.length ? playerLines.map((line) => {
                const isQuantitativeLockedByPlayer = Boolean(
                  line?.playerResponse?.status === 'submitted'
                  && line?.playerResponse?.quantitativeState === 'completed',
                );
                const lineInputsDisabled = isReadOnly || isQuantitativeLockedByPlayer;

                return (
                  <View
                    key={line.key}
                    style={[
                      Spaces.padding[sectionPadding],
                      Spaces.gap[14],
                      {
                        backgroundColor: playerCardSurfaceColor,
                        borderColor: counterBorderColor,
                        borderRadius: 20,
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{line.label}</Text>
                        <Text style={[Fonts.p4, Fonts.neutral100]}>
                          {line.userDocumentId ? 'Joueur FoundClub' : 'Joueur manuel'}
                        </Text>
                      </View>
                      {normalizeSport(sport) === 'football' ? (
                        <TouchableOpacity
                          disabled={lineInputsDisabled}
                          onPress={() => updateLineValue(line.key, 'cleanSheet', !line.cleanSheet)}
                          style={[
                            Spaces.paddingHorizontal[10],
                            Spaces.paddingVertical[6],
                            {
                              backgroundColor: line.cleanSheet ? `${Colors.primary500}2B` : pillSurfaceColor,
                              borderColor: line.cleanSheet ? `${Colors.primary200}C7` : counterBorderColor,
                              borderRadius: 14,
                              borderWidth: 1,
                              opacity: lineInputsDisabled ? 0.55 : 1,
                            },
                          ]}
                        >
                          <Text style={[Fonts.p4Bold, Fonts.neutral00]}>Clean sheet</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>

                    {isQuantitativeLockedByPlayer ? (
                      <View
                        style={[
                          ApplicationStyle.backgroundColor.primary900,
                          ApplicationStyle.borderRadius16,
                          Spaces.padding[12],
                          Spaces.gap[4],
                          {
                            borderColor: counterBorderColor,
                            borderWidth: 1,
                          },
                        ]}
                      >
                        <Text style={[Fonts.p4Bold, Fonts.primary100]}>Quantites verrouillees</Text>
                        <Text style={[Fonts.p4, Fonts.neutral100]}>
                          Ce joueur a deja valide ses stats personnelles. Les chiffres restent proteges, mais tu peux toujours ajouter un retour qualitatif plus haut.
                        </Text>
                      </View>
                    ) : null}

                    <View>
                      {renderCounterField({
                        containerStyle: { flex: 1 },
                        disabled: lineInputsDisabled,
                        label: 'Minutes jouees',
                        onChangeText: (value) => updateLineNumericValue(line.key, 'minutesPlayed', value),
                        onDecrement: () => adjustLineValue(line.key, 'minutesPlayed', -1),
                        onIncrement: () => adjustLineValue(line.key, 'minutesPlayed', 1),
                        value: line.minutesPlayed,
                      })}
                    </View>

                    {playerStatRows.map((row) => (
                      <View key={row.map((field) => field.key).join(':')} style={[Alignments.row, Spaces.gap[12]]}>
                        {row.map((field) => (
                          <View key={field.key} style={{ flex: 1 }}>
                            {renderCounterField({
                              containerStyle: { flex: 1 },
                              disabled: lineInputsDisabled,
                              label: field.label,
                              onChangeText: (value) => updateLineNumericValue(line.key, field.key, value),
                              onDecrement: () => adjustLineValue(line.key, field.key, -1),
                              onIncrement: () => adjustLineValue(line.key, field.key, 1),
                              value: line[field.key],
                            })}
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                );
              }) : (
                <View style={[ApplicationStyle.backgroundColor.primary900, { borderRadius: 20 }, Spaces.padding[20], Spaces.gap[8]]}>
                  <Text style={[Fonts.p2Bold, Fonts.neutral00, Fonts.textCenter]}>Aucun joueur disponible pour ce rapport.</Text>
                  <Text style={[Fonts.p3, Fonts.neutral100, Fonts.textCenter]}>
                    Publie d abord la convocation ou verifie le roster de l equipe pour alimenter cette liste.
                  </Text>
                </View>
              )}
            </View>

            <View style={[ApplicationStyle.backgroundColor.primary700, ApplicationStyle.borderRadius24, Spaces.padding[sectionPadding], Spaces.gap[sectionGap]]}>
              <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Actions</Text>
              <Button
                disabled={isReadOnly || isReviewRequired || hasConsistencyIssues || saveDraftMutation.isPending || submitMutation.isPending}
                isLoading={saveDraftMutation.isPending}
                onPress={handleSaveDraft}
                title="Sauvegarder le brouillon"
                variant="Secondary"
              />
              <Button
                disabled={hasConsistencyIssues || isReadOnly || submitMutation.isPending}
                isLoading={submitMutation.isPending}
                onPress={handleSubmit}
                title={submitButtonTitle}
                variant="Primary"
              />
              <Text style={[Fonts.p3, Fonts.neutral100]}>{submitHelperText}</Text>
            </View>
          </>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

export default MatchStatsEditor;
