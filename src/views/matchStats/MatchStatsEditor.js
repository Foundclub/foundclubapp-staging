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
    const payload = existing?.sportPayload || {};
    const baseLine = {
      key: playerKey || `player:${Math.random().toString(36).slice(2)}`,
      label: player?.label || [player?.firstname, player?.lastname].filter(Boolean).join(' ').trim() || player?.manualPlayerName || 'Joueur',
      manualPlayerName: player?.isManual ? (player?.label || player?.manualPlayerName || '') : (existing?.manualPlayerName || null),
      minutesPlayed: String(existing?.minutesPlayed ?? 0),
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

const buildIntegrityWarning = ({ playerLines, scoreFor, sport }) => {
  const targetScore = Number.parseInt(String(scoreFor || '0'), 10) || 0;
  if (!targetScore || !Array.isArray(playerLines) || !playerLines.length) return null;

  if (normalizeSport(sport) === 'basketball') {
    const totalPoints = playerLines.reduce(
      (accumulator, line) => accumulator + (Number.parseInt(String(line?.points || '0'), 10) || 0),
      0,
    );

    if (totalPoints > targetScore) {
      return `Les points saisis (${totalPoints}) depassent le score de l equipe (${targetScore}).`;
    }

    return null;
  }

  const totalGoals = playerLines.reduce(
    (accumulator, line) => accumulator + (Number.parseInt(String(line?.goals || '0'), 10) || 0),
    0,
  );

  if (totalGoals > targetScore) {
    return `Les buts saisis (${totalGoals}) depassent le score de l equipe (${targetScore}).`;
  }

  return null;
};

function MatchStatsEditor({ navigation, route }) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const { height, width } = useWindowDimensions();
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
  const teamName = statsPayload?.team?.name || route?.params?.teamName || '';
  const statusMeta = useMemo(() => getReportStatusMeta({
    isFinalized,
    isReviewRequired,
    isWaitingOfficial,
  }, Colors), [Colors, isFinalized, isReviewRequired, isWaitingOfficial]);

  const [scoreFor, setScoreFor] = useState('');
  const [scoreAgainst, setScoreAgainst] = useState('');
  const [playerLines, setPlayerLines] = useState([]);

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
  }, [requestedTeamId, sport, statsPayload]);

  const completedPlayers = useMemo(
    () => playerLines.filter((line) => isLineCompleted(line, sport)).length,
    [playerLines, sport],
  );

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
    const integrityWarning = buildIntegrityWarning({
      playerLines,
      scoreFor,
      sport,
    });

    if (integrityWarning) {
      return `${integrityWarning}\n\nTu peux corriger les lignes maintenant ou continuer malgre cet ecart.`;
    }

    if (isReviewRequired) {
      return 'Le score officiel a change. Cette publication confirme la nouvelle version des stats pour ton equipe.';
    }

    return 'Apres publication, ce rapport devient la version officielle des statistiques pour cette equipe.';
  }, [isReviewRequired, playerLines, scoreFor, sport]);

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

    return 'Le brouillon reste modifiable tant que tu ne publies pas ce rapport.';
  }, [isReadOnly, isReviewRequired]);

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
    playerLines: playerLines.map((line) => serializeLine(line, sport)),
    ...(sourceType === 'event' ? {
      scoreAgainst: hasScore ? Number.parseInt(scoreAgainst, 10) : undefined,
      scoreFor: hasScore ? Number.parseInt(scoreFor, 10) : undefined,
    } : {}),
    ...(requestedTeamId ? { teamId: requestedTeamId } : {}),
  }), [hasScore, playerLines, requestedTeamId, scoreAgainst, scoreFor, sourceType, sport]);

  const saveDraftMutation = useMutation({
    mutationFn: () => {
      const payload = buildPayload();
      if (sourceType === 'event') {
        return saveEventMatchStatsDraft(eventId, payload);
      }
      return saveLeagueMatchStatsDraft(matchId, payload);
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
    onSuccess: async () => {
      await invalidateRelatedQueries();
      Alert.alert(
        'Stats publiees',
        isReviewRequired
          ? 'Le rapport a ete mis a jour apres la synchronisation du score officiel.'
          : 'Les statistiques du match sont maintenant finalisees.',
        [{ onPress: () => navigation.goBack(), text: 'OK' }],
      );
    },
  });

  const updateLineValue = useCallback((lineKey, field, value) => {
    setPlayerLines((current) => current.map((line) => (line.key === lineKey
      ? { ...line, [field]: value }
      : line)));
  }, []);

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
    saveDraftMutation.mutate();
  }, [hasScore, isReviewRequired, isScoreLocked, saveDraftMutation, sourceType]);

  const handleSubmit = useCallback(() => {
    if (sourceType === 'event' && !hasScore) {
      Alert.alert('Score requis', 'Le score final doit etre enregistre avant de publier les stats.');
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
  }, [hasScore, isReviewRequired, sourceType, submitConfirmationMessage, submitMutation]);

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[Spaces.paddingBottom[24], Spaces.paddingTop[0], Alignments.fill]}
    >
      <View style={[Spaces.paddingHorizontal[16], Spaces.paddingTop[isCompactMobile ? 8 : 12], Spaces.paddingBottom[8], Alignments.row, Alignments.alignCenter]}>
        <HeaderBackButton onPress={() => navigation.goBack()} />
        <View style={[Alignments.alignCenter, { flex: 1 }, Spaces.gap[4]]}>
          <Text style={[Fonts.h3Bold, Fonts.neutral00]}>Stats du match</Text>
          {teamName ? <Text style={[Fonts.p2, Fonts.neutral100]}>{teamName}</Text> : null}
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={[Spaces.paddingHorizontal[16], Spaces.paddingBottom[24], Spaces.gap[isCompactMobile ? 12 : 16]]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[ApplicationStyle.backgroundColor.primary900, ApplicationStyle.borderRadius24, Spaces.padding[sectionPadding], Spaces.gap[sectionGap]]}>
          <View style={[Spaces.gap[4]]}>
            <Text style={[Fonts.p4Bold, Fonts.primary500]}>Rapport post-match</Text>
            <Text style={[Fonts.h2Bold, Fonts.neutral00]}>{matchLabel}</Text>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {sourceType === 'event' ? 'Rapport stats evenement' : 'Rapport stats ligue'}
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
            <View style={[ApplicationStyle.backgroundColor.primary700, ApplicationStyle.borderRadius16, Spaces.paddingHorizontal[12], Spaces.paddingVertical[6]]}>
              <Text style={[Fonts.p3Bold, Fonts.neutral00]}>{`${completedPlayers}/${playerLines.length} joueurs completes`}</Text>
            </View>
            <View style={[ApplicationStyle.backgroundColor.primary700, ApplicationStyle.borderRadius16, Spaces.paddingHorizontal[12], Spaces.paddingVertical[6]]}>
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
            <Button onPress={() => statsQuery.refetch()} title="Reessayer" variant="Secondary" />
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

            <View style={[ApplicationStyle.backgroundColor.primary700, ApplicationStyle.borderRadius24, Spaces.padding[sectionPadding], Spaces.gap[sectionGap]]}>
              <View style={[Alignments.row, Alignments.justifyBetween, Alignments.alignCenter, Spaces.gap[12]]}>
                <View style={{ flex: 1 }}>
                  <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Score final</Text>
                  <Text style={[Fonts.p3, Fonts.neutral100]}>{getScoreSourceLabel(statsPayload?.score)}</Text>
                </View>
                <View
                  style={[
                    ApplicationStyle.backgroundColor.primary900,
                    ApplicationStyle.borderRadius16,
                    Spaces.paddingHorizontal[12],
                    Spaces.paddingVertical[8],
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
                <View style={{ flex: 1 }}>
                  <Text style={[Fonts.p4Bold, Fonts.neutral100, Spaces.marginBottom[8]]}>Notre score</Text>
                  <TextInput
                    editable={!isScoreLocked && !isReadOnly}
                    keyboardType="number-pad"
                    maxLength={3}
                    onChangeText={(value) => setScoreFor(sanitizeNumericInput(value))}
                    style={[
                      Fonts.h2Bold,
                      Fonts.neutral00,
                      ApplicationStyle.backgroundColor.primary900,
                      ApplicationStyle.borderRadius16,
                      Fonts.textCenter,
                      { minHeight: scoreInputHeight },
                    ]}
                    value={scoreFor}
                  />
                </View>
                <Text style={[Fonts.h2Bold, Fonts.neutral00]}>-</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[Fonts.p4Bold, Fonts.neutral100, Spaces.marginBottom[8]]}>Score adverse</Text>
                  <TextInput
                    editable={!isScoreLocked && !isReadOnly}
                    keyboardType="number-pad"
                    maxLength={3}
                    onChangeText={(value) => setScoreAgainst(sanitizeNumericInput(value))}
                    style={[
                      Fonts.h2Bold,
                      Fonts.neutral00,
                      ApplicationStyle.backgroundColor.primary900,
                      ApplicationStyle.borderRadius16,
                      Fonts.textCenter,
                      { minHeight: scoreInputHeight },
                    ]}
                    value={scoreAgainst}
                  />
                </View>
              </View>

              {sourceType === 'league' ? (
                <Text style={[Fonts.p3, Fonts.neutral100]}>
                  Le score ligue valide reste la source officielle pour ce rapport.
                </Text>
              ) : null}
            </View>

            <View style={[ApplicationStyle.backgroundColor.primary700, ApplicationStyle.borderRadius24, Spaces.padding[sectionPadding], Spaces.gap[sectionGap]]}>
              <View style={[Alignments.row, Alignments.justifyBetween, Alignments.alignCenter, Spaces.gap[12]]}>
                <View style={[Spaces.gap[4], { flex: 1 }]}>
                  <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Stats joueurs</Text>
                  <Text style={[Fonts.p3, Fonts.neutral100]}>
                    Temps de jeu et statistiques cles adaptees au sport du match.
                  </Text>
                </View>
                <View style={[ApplicationStyle.backgroundColor.primary900, ApplicationStyle.borderRadius16, Spaces.paddingHorizontal[10], Spaces.paddingVertical[6]]}>
                  <Text style={[Fonts.p3Bold, Fonts.neutral00]}>{`${playerLines.length} lignes`}</Text>
                </View>
              </View>

              {playerLines.length ? playerLines.map((line) => (
                <View
                  key={line.key}
                  style={[
                    ApplicationStyle.backgroundColor.primary900,
                    ApplicationStyle.borderRadius20,
                    Spaces.padding[sectionPadding],
                    Spaces.gap[12],
                  ]}
                >
                  <View style={[Alignments.row, Alignments.justifyBetween, Alignments.alignCenter, Spaces.gap[12]]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{line.label}</Text>
                      <Text style={[Fonts.p4, Fonts.neutral100]}>
                        {line.userDocumentId ? 'Joueur FoundClub' : 'Joueur manuel'}
                      </Text>
                    </View>
                    {normalizeSport(sport) === 'football' ? (
                      <TouchableOpacity
                        disabled={isReadOnly}
                        onPress={() => updateLineValue(line.key, 'cleanSheet', !line.cleanSheet)}
                        style={[
                          ApplicationStyle.borderRadius16,
                          Spaces.paddingHorizontal[12],
                          Spaces.paddingVertical[8],
                          line.cleanSheet ? ApplicationStyle.backgroundColor.primary500 : ApplicationStyle.backgroundColor.primary700,
                        ]}
                      >
                        <Text style={[Fonts.p3Bold, Fonts.neutral00]}>Clean sheet</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <View style={[Alignments.row, Spaces.gap[12]]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[Fonts.p4Bold, Fonts.neutral100, Spaces.marginBottom[8]]}>Temps de jeu</Text>
                      <TextInput
                        editable={!isReadOnly}
                        keyboardType="number-pad"
                        maxLength={3}
                        onChangeText={(value) => updateLineValue(line.key, 'minutesPlayed', sanitizeNumericInput(value))}
                        style={[
                          Fonts.p1Bold,
                          Fonts.neutral00,
                          ApplicationStyle.backgroundColor.primary700,
                          ApplicationStyle.borderRadius16,
                          Fonts.textCenter,
                          { minHeight: statInputHeight },
                        ]}
                        value={line.minutesPlayed}
                      />
                    </View>
                    {getFieldConfig(sport).slice(0, 2).map((field) => (
                      <View key={field.key} style={{ flex: 1 }}>
                        <Text style={[Fonts.p4Bold, Fonts.neutral100, Spaces.marginBottom[8]]}>{field.label}</Text>
                        <TextInput
                          editable={!isReadOnly}
                          keyboardType="number-pad"
                          maxLength={3}
                          onChangeText={(value) => updateLineValue(line.key, field.key, sanitizeNumericInput(value))}
                          style={[
                            Fonts.p1Bold,
                            Fonts.neutral00,
                            ApplicationStyle.backgroundColor.primary700,
                            ApplicationStyle.borderRadius16,
                            Fonts.textCenter,
                            { minHeight: statInputHeight },
                          ]}
                          value={line[field.key]}
                        />
                      </View>
                    ))}
                  </View>

                  {getFieldConfig(sport).length > 2 ? (
                    <View style={[Alignments.row, Spaces.gap[12]]}>
                      {getFieldConfig(sport).slice(2).map((field) => (
                        <View key={field.key} style={{ flex: 1 }}>
                          <Text style={[Fonts.p4Bold, Fonts.neutral100, Spaces.marginBottom[8]]}>{field.label}</Text>
                          <TextInput
                            editable={!isReadOnly}
                            keyboardType="number-pad"
                            maxLength={3}
                            onChangeText={(value) => updateLineValue(line.key, field.key, sanitizeNumericInput(value))}
                            style={[
                              Fonts.p1Bold,
                              Fonts.neutral00,
                              ApplicationStyle.backgroundColor.primary700,
                              ApplicationStyle.borderRadius16,
                              Fonts.textCenter,
                              { minHeight: statInputHeight },
                            ]}
                            value={line[field.key]}
                          />
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              )) : (
                <View style={[ApplicationStyle.backgroundColor.primary900, ApplicationStyle.borderRadius20, Spaces.padding[20], Spaces.gap[8]]}>
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
                disabled={isReadOnly || isReviewRequired || saveDraftMutation.isPending || submitMutation.isPending}
                isLoading={saveDraftMutation.isPending}
                onPress={handleSaveDraft}
                title="Sauvegarder le brouillon"
                variant="Secondary"
              />
              <Button
                disabled={isReadOnly || submitMutation.isPending}
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
