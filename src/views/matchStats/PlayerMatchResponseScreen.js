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
  useWindowDimensions,
  View,
} from 'react-native';

import { invalidateAfterAction } from '@/domains/refresh/afterAction';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';
import useBottomDockLayout from '@/navigation/useBottomDockLayout';

import {
  useGetEventMyMatchResponse,
  useGetLeagueMyMatchResponse,
} from '@/services/matchStats/matchStatsQueries';
import {
  saveEventMyMatchResponse,
  saveLeagueMyMatchResponse,
} from '@/services/matchStats/matchStatsService';

import { clampMatchStatsValue, getMatchStatsFieldMax } from '@/utils/matchStatsBounds';

const FOOTBALL_FIELDS = [
  { key: 'goals', label: 'Buts' },
  { key: 'assists', label: 'Passes décisives' },
  { key: 'goalsConceded', label: 'Buts encaissés' },
];

const BASKETBALL_FIELDS = [
  { key: 'points', label: 'Points' },
  { key: 'assists', label: 'Passes décisives' },
  { key: 'rebounds', label: 'Rebonds' },
  { key: 'threePointsMade', label: '3 pts' },
];

// H6 — cet ecran n avait AUCUNE borne haute : `sanitizeNumericInput` retirait
// bien le signe moins et la virgule, mais laissait passer 9999 minutes. Le
// serveur les REFUSE desormais : sans plafond ici, le joueur remplirait tout son
// formulaire pour se prendre un refus a l envoi.
const sanitizeNumericInput = (value, field) => clampMatchStatsValue(value, getMatchStatsFieldMax(field));

const normalizeSport = (value) => {
  const raw = String(value || '').toLowerCase();
  return raw.includes('basket') ? 'basketball' : 'football';
};

const getSportFields = (sport) => (normalizeSport(sport) === 'basketball' ? BASKETBALL_FIELDS : FOOTBALL_FIELDS);

const buildScoreSummary = (score) => {
  if (!score?.available) return 'Score en attente';
  return `${score?.scoreFor ?? '-'} - ${score?.scoreAgainst ?? '-'}`;
};

const getNumericValue = (value) => Number.parseInt(String(value || '0'), 10) || 0;

const buildPlayerConsistencyIssues = ({
  doesKnowStats,
  participation,
  quantitative,
  score,
  sport,
}) => {
  if (participation !== 'played' || !doesKnowStats || !score?.available) return [];

  const normalizedSport = normalizeSport(sport);
  const scoreFor = Number.isFinite(Number(score?.scoreFor)) ? Number(score.scoreFor) : null;
  const scoreAgainst = Number.isFinite(Number(score?.scoreAgainst)) ? Number(score.scoreAgainst) : null;
  const issues = [];

  if (normalizedSport === 'basketball') {
    const points = getNumericValue(quantitative?.points);
    const threePointsMade = getNumericValue(quantitative?.threePointsMade);

    if (scoreFor !== null && points > scoreFor) {
      issues.push(`Tes points ne peuvent pas dépasser le score officiel de ton équipe (${scoreFor}).`);
    }
    if ((threePointsMade * 3) > points) {
      issues.push('Le total de tirs a 3 points ne peut pas dépasser ton total de points.');
    }
    return issues;
  }

  const goals = getNumericValue(quantitative?.goals);
  const goalsConceded = getNumericValue(quantitative?.goalsConceded);
  const cleanSheet = Boolean(quantitative?.cleanSheet);

  if (scoreFor !== null && goals > scoreFor) {
    issues.push(`Tes buts ne peuvent pas dépasser le score officiel de ton équipe (${scoreFor}).`);
  }
  if (scoreAgainst !== null && goalsConceded > scoreAgainst) {
    issues.push(`Les buts encaissés ne peuvent pas dépasser le score officiel adverse (${scoreAgainst}).`);
  }
  if (scoreAgainst !== null && cleanSheet && scoreAgainst > 0) {
    issues.push('Un clean sheet est impossible si le score officiel indique un but adverse.');
  }
  if (cleanSheet && goalsConceded > 0) {
    issues.push('Un clean sheet implique 0 but encaisse.');
  }

  return issues;
};

const getScoreSourceLabel = (score) => {
  if (score?.source === 'league_validated') return 'Score ligue validé';
  if (score?.source === 'external_sync') return 'Score officiel synchronise';
  if (score?.source === 'manual') return 'Score saisi dans FoundClub';
  return 'Score en attente';
};

const getApiErrorMessage = (error, fallbackMessage) => (
  error?.response?.data?.error?.message
  || error?.response?.data?.message
  || error?.message
  || fallbackMessage
);

const buildInitialQuantitative = (response, sport) => {
  const fields = getSportFields(sport);
  const payload = response?.sportPayload || {};
  const initialValues = {
    minutesPlayed: String(response?.minutesPlayed ?? 0),
  };

  fields.forEach((field) => {
    initialValues[field.key] = String(payload?.[field.key] ?? 0);
  });

  if (normalizeSport(sport) === 'football') {
    initialValues.cleanSheet = Boolean(payload?.cleanSheet);
  }

  return initialValues;
};

/**
 *
 * @param root0
 * @param root0.navigation
 * @param root0.route
 */
function PlayerMatchResponseScreen({ navigation, route }) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const { width } = useWindowDimensions();
  const { sceneBottomInset } = useBottomDockLayout();
  const queryClient = useQueryClient();
  const sourceType = route?.params?.sourceType === 'league' ? 'league' : 'event';
  const eventId = route?.params?.eventId || null;
  const matchId = route?.params?.matchId || null;
  const requestedTeamId = route?.params?.teamId || null;
  const initialTitle = route?.params?.title || 'Mon retour post-match';
  const routeMatchLabel = route?.params?.matchLabel || null;
  const forceUnknownStats = Boolean(route?.params?.forceUnknownStats);
  const hydratedKeyRef = useRef(null);

  const eventQuery = useGetEventMyMatchResponse(eventId || '', requestedTeamId || undefined, {
    enabled: Boolean(sourceType === 'event' && eventId),
  });
  const leagueQuery = useGetLeagueMyMatchResponse(matchId || '', requestedTeamId || undefined, {
    enabled: Boolean(sourceType === 'league' && matchId),
  });

  const responseQuery = sourceType === 'event' ? eventQuery : leagueQuery;
  const responsePayload = responseQuery.data || null;
  const isMissingSourceId = sourceType === 'event' ? !eventId : !matchId;
  const sport = normalizeSport(responsePayload?.sport || route?.params?.sport || 'football');
  const [participation, setParticipation] = useState(null);
  const [doesKnowStats, setDoesKnowStats] = useState(true);
  const [rating, setRating] = useState(null);
  const [teamRating, setTeamRating] = useState(null);
  const [comment, setComment] = useState('');
  const [quantitative, setQuantitative] = useState(/** @type {any} */ ({}));
  const isCompactMobile = width < 390;
  const sectionPadding = isCompactMobile ? 16 : 24;
  const sectionGap = isCompactMobile ? 12 : 16;
  const scrollBottomPadding = Math.max(sceneBottomInset, 32);
  const heroSurfaceColor = `${Colors.primary700}F2`;
  const cardSurfaceColor = `${Colors.primary700}E8`;
  const insetSurfaceColor = `${Colors.primary700}C7`;
  const fieldSurfaceColor = `${Colors.primary700}B8`;
  const subtleBorderColor = `${Colors.primary500}40`;
  const activeSurfaceColor = `${Colors.primary500}24`;
  const activeBorderColor = `${Colors.primary200}CC`;
  const secondaryTextColor = Colors.neutral200;
  const headerCardMinHeight = isCompactMobile ? 88 : 96;

  useEffect(() => {
    const response = responsePayload?.response || null;
    const hydrateKey = [
      sourceType,
      eventId || matchId || 'source',
      requestedTeamId || 'auto',
      response?.documentId || 'empty',
      response?.updatedAt || response?.submittedAt || 'fresh',
    ].join(':');

    if (!responsePayload || hydratedKeyRef.current === hydrateKey) return;
    hydratedKeyRef.current = hydrateKey;

    setParticipation(response?.participation || null);
    setDoesKnowStats(response?.quantitativeState !== 'unknown');
    setRating(response?.selfRating ?? null);
    setTeamRating(response?.teamRating ?? null);
    setComment(response?.selfComment || '');
    setQuantitative(buildInitialQuantitative(response, sport));
  }, [eventId, matchId, requestedTeamId, responsePayload, sourceType, sport]);

  useEffect(() => {
    if (!forceUnknownStats) return;
    if (responsePayload?.response?.status === 'submitted') return;

    setParticipation((current) => current || 'played');
    setDoesKnowStats(false);
  }, [forceUnknownStats, responsePayload?.response?.status]);

  const scoreSummary = useMemo(() => buildScoreSummary(responsePayload?.score), [responsePayload?.score]);
  const scoreSourceLabel = useMemo(() => getScoreSourceLabel(responsePayload?.score), [responsePayload?.score]);
  const headerMatchLabel = useMemo(() => (
    routeMatchLabel
    || responsePayload?.event?.name
    || responsePayload?.match?.name
    || responsePayload?.team?.name
    || null
  ), [responsePayload?.event?.name, responsePayload?.match?.name, responsePayload?.team?.name, routeMatchLabel]);
  const pageTitle = initialTitle || 'Mon retour post-match';
  const heroMatchLabel = headerMatchLabel || 'Match';
  const isSubmitted = responsePayload?.response?.status === 'submitted';
  const isDraft = responsePayload?.response?.status === 'draft';
  let statusLabel = 'À faire';
  if (isSubmitted) {
    statusLabel = 'Envoyé';
  } else if (isDraft) {
    statusLabel = 'Brouillon';
  }
  const fieldRows = useMemo(() => {
    const fields = getSportFields(sport);
    const rows = [];
    for (let index = 0; index < fields.length; index += 2) {
      rows.push(fields.slice(index, index + 2));
    }
    return rows;
  }, [sport]);
  const consistencyIssues = useMemo(() => buildPlayerConsistencyIssues({
    doesKnowStats,
    participation,
    quantitative,
    score: responsePayload?.score,
    sport,
  }), [doesKnowStats, participation, quantitative, responsePayload?.score, sport]);

  const updateField = useCallback((field, value) => {
    setQuantitative((current) => ({
      ...current,
      [field]: field === 'cleanSheet' ? Boolean(value) : sanitizeNumericInput(value, field),
    }));
  }, []);

  // Clean sheet automatique : 0 but encaissé => activé (handoff 9f).
  useEffect(() => {
    if (normalizeSport(sport) !== 'football' || participation !== 'played' || !doesKnowStats) return;
    const conceded = Number.parseInt(String(quantitative?.goalsConceded ?? ''), 10);
    if (Number.isNaN(conceded)) return;
    setQuantitative((current) => {
      const shouldBeActive = conceded === 0;
      if (Boolean(current?.cleanSheet) === shouldBeActive) return current;
      return { ...current, cleanSheet: shouldBeActive };
    });
  }, [doesKnowStats, participation, quantitative?.goalsConceded, sport]);

  const adjustNumericField = useCallback((field, delta) => {
    setQuantitative((current) => {
      const nextValue = Math.max(0, (Number.parseInt(String(current?.[field] || '0'), 10) || 0) + delta);
      return {
        ...current,
        // H6 — le bouton « + » butait sur rien : il faut la MEME borne que la frappe.
        [field]: clampMatchStatsValue(String(nextValue), getMatchStatsFieldMax(field)),
      };
    });
  }, []);

  // H9 — LA MEME LISTE QUE `MatchStatsEditor`, et c est le but.
  // Cet ecran tenait sa propre copie, qui oubliait `eventMatchResult` et
  // `leagueTeamPerformanceStats` ; l editeur oubliait `eventMyMatchResponse`.
  // Deux copies d une meme liste finissent toujours par diverger.
  const invalidateQueries = useCallback(
    () => invalidateAfterAction(queryClient, 'submitMatchStats'),
    [queryClient],
  );

  const buildPayload = useCallback((status) => {
    let quantitativeState = 'not_applicable';
    if (participation === 'played') {
      quantitativeState = doesKnowStats ? 'completed' : 'unknown';
    }

    const payload = {
      participation: participation || 'not_involved',
      quantitativeState,
      selfComment: comment.trim() || null,
      selfRating: participation === 'not_involved' ? null : rating,
      status,
      teamRating: participation === 'not_involved' ? null : teamRating,
      ...(requestedTeamId ? { teamId: requestedTeamId } : {}),
    };

    if (participation === 'played' && doesKnowStats) {
      payload.minutesPlayed = Number.parseInt(String(quantitative?.minutesPlayed || '0'), 10) || 0;
      getSportFields(sport).forEach((field) => {
        payload[field.key] = Number.parseInt(String(quantitative?.[field.key] || '0'), 10) || 0;
      });
      if (normalizeSport(sport) === 'football') {
        payload.cleanSheet = Boolean(quantitative?.cleanSheet);
      }
    }

    return payload;
  }, [comment, doesKnowStats, participation, quantitative, rating, requestedTeamId, sport, teamRating]);

  const renderRatingScale = (selectedValue, onSelect) => (
    <View style={[Alignments.row, Alignments.wrap, Spaces.gap[8]]}>
      {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => {
        const isActive = selectedValue === value;
        return (
          <Pressable
            key={value}
            onPress={() => onSelect(value)}
            style={[
              Spaces.paddingHorizontal[12],
              Spaces.paddingVertical[10],
              {
                backgroundColor: isActive ? activeSurfaceColor : insetSurfaceColor,
                borderColor: isActive ? activeBorderColor : subtleBorderColor,
                borderRadius: 16,
                borderWidth: 1,
                minWidth: isCompactMobile ? 44 : 48,
              },
            ]}
          >
            <Text style={[Fonts.p2Bold, isActive ? Fonts.primary100 : Fonts.neutral00, Fonts.textCenter]}>
              {value}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

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

  const saveMutation = useMutation({
    mutationFn: (status) => {
      const payload = buildPayload(status);
      if (sourceType === 'event') {
        return saveEventMyMatchResponse(eventId, payload);
      }
      return saveLeagueMyMatchResponse(matchId, payload);
    },
    onError: (error) => {
      Alert.alert('Erreur', getApiErrorMessage(error, "Impossible d'enregistrer ta réponse."));
    },
    onSuccess: async (_result, status) => {
      await invalidateQueries();
      await responseQuery.refetch();
      if (status === 'draft') {
        Alert.alert('Brouillon enregistré', 'Tu peux reprendre ta réponse plus tard.');
        return;
      }
      Alert.alert(
        'Merci',
        participation === 'played'
          ? 'Ton match est enregistré.'
          : 'Ton retour post-match a bien été enregistré.',
        [{ onPress: redirectToReviewScreen, text: 'OK' }],
      );
    },
  });

  const handleSaveDraft = useCallback(() => {
    if (!participation) {
      Alert.alert('Participation', "Indique d'abord si tu as joué ce match.");
      return;
    }
    if (consistencyIssues.length > 0) {
      Alert.alert('Vérifier tes stats', consistencyIssues[0]);
      return;
    }
    saveMutation.mutate('draft');
  }, [consistencyIssues, participation, saveMutation]);

  const handleSubmit = useCallback(() => {
    if (!participation) {
      Alert.alert('Participation', "Indique d'abord si tu as joué ce match.");
      return;
    }
    if (consistencyIssues.length > 0) {
      Alert.alert('Vérifier tes stats', consistencyIssues[0]);
      return;
    }
    saveMutation.mutate('submitted');
  }, [consistencyIssues, participation, saveMutation]);

  const renderCounterField = ({ field, label }) => (
    <View style={{ flex: 1 }}>
      <Text style={[Fonts.p4Bold, Fonts.neutral100, Spaces.marginBottom[8]]}>{label}</Text>
      <View
        style={[
          { borderRadius: 20 },
          Alignments.row,
          Alignments.alignCenter,
          {
            backgroundColor: fieldSurfaceColor,
            borderColor: subtleBorderColor,
            borderWidth: 1,
            minHeight: isCompactMobile ? 52 : 56,
          },
        ]}
      >
        <Pressable
          hitSlop={8}
          onPress={() => adjustNumericField(field, -1)}
          style={[
            Alignments.justifyCenter,
            Alignments.alignCenter,
            {
              backgroundColor: `${Colors.primary500}12`,
              borderRightColor: subtleBorderColor,
              borderRightWidth: 1,
              minHeight: isCompactMobile ? 52 : 56,
              width: 44,
            },
          ]}
        >
          <Text style={[Fonts.h4Bold, Fonts.primary200]}>-</Text>
        </Pressable>
        <TextInput
          keyboardType="number-pad"
          onChangeText={(value) => updateField(field, value)}
          placeholder="0"
          placeholderTextColor={Colors.primary100}
          style={[
            Fonts.p2Bold,
            Fonts.neutral00,
            Fonts.textCenter,
            {
              flex: 1,
              minHeight: isCompactMobile ? 52 : 56,
              paddingHorizontal: 8,
            },
          ]}
          value={String(quantitative?.[field] || '')}
        />
        <Pressable
          hitSlop={8}
          onPress={() => adjustNumericField(field, 1)}
          style={[
            Alignments.justifyCenter,
            Alignments.alignCenter,
            {
              backgroundColor: `${Colors.primary500}12`,
              borderLeftColor: subtleBorderColor,
              borderLeftWidth: 1,
              minHeight: isCompactMobile ? 52 : 56,
              width: 44,
            },
          ]}
        >
          <Text style={[Fonts.h4Bold, Fonts.primary200]}>+</Text>
        </Pressable>
      </View>
    </View>
  );

  if (isMissingSourceId) {
    return (
      <ScreenContainer bgImage="bg2" contentContainerStyle={[Alignments.justifyCenter, Alignments.fill]}>
        <View style={[ApplicationStyle.borderRadius24, Spaces.padding[24], Spaces.gap[8], { backgroundColor: cardSurfaceColor }]}>
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Match introuvable</Text>
          <Text style={[Fonts.p2, Fonts.neutral100]}>
            Cette route n&apos;a pas recu les informations necessaires pour charger ton retour post-match.
          </Text>
          <Button onPress={() => navigation.goBack()} title="Retour" variant="Secondary" />
        </View>
      </ScreenContainer>
    );
  }

  if (responseQuery.isLoading && !responsePayload) {
    return (
      <ScreenContainer bgImage="bg2" contentContainerStyle={[Alignments.justifyCenter, Alignments.fill]}>
        <View style={[ApplicationStyle.borderRadius24, Spaces.padding[24], Spaces.gap[8], { backgroundColor: cardSurfaceColor }]}>
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Chargement du retour post-match</Text>
          <Text style={[Fonts.p2, Fonts.neutral100]}>
            Nous récupérons ton questionnaire et le score officiel du match.
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  if (responseQuery.error && !responsePayload) {
    return (
      <ScreenContainer bgImage="bg2" contentContainerStyle={[Alignments.justifyCenter, Alignments.fill]}>
        <View style={[ApplicationStyle.borderRadius24, Spaces.padding[24], Spaces.gap[12], { backgroundColor: cardSurfaceColor }]}>
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Chargement impossible</Text>
          <Text style={[Fonts.p2, Fonts.neutral100]}>
            {String(responseQuery.error?.message || 'Une erreur est survenue.')}
          </Text>
          <Button onPress={() => responseQuery.refetch()} title="Réessayer" variant="Primary" />
        </View>
      </ScreenContainer>
    );
  }

  if (!responsePayload) {
    return (
      <ScreenContainer bgImage="bg2" contentContainerStyle={[Alignments.justifyCenter, Alignments.fill]}>
        <View style={[ApplicationStyle.borderRadius24, Spaces.padding[24], Spaces.gap[12], { backgroundColor: cardSurfaceColor }]}>
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Questionnaire indisponible</Text>
          <Text style={[Fonts.p2, Fonts.neutral100]}>
            Aucun retour joueur n&apos;est disponible pour ce match.
          </Text>
          <Button onPress={() => navigation.goBack()} title="Retour" variant="Secondary" />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer bgImage="bg2" contentContainerStyle={[Spaces.paddingBottom[24], Spaces.paddingTop[0], Alignments.fill]}>
      <View
        style={[
          Spaces.marginHorizontal[16],
          Spaces.marginTop[16],
          Spaces.marginBottom[16],
          Spaces.paddingHorizontal[20],
          Spaces.paddingVertical[16],
          {
            backgroundColor: heroSurfaceColor,
            borderColor: subtleBorderColor,
            borderRadius: 22,
            borderWidth: 1,
            justifyContent: 'center',
            minHeight: headerCardMinHeight,
            position: 'relative',
          },
        ]}
      >
        <View
          style={{
            bottom: 0,
            justifyContent: 'center',
            left: 16,
            position: 'absolute',
            top: 0,
          }}
        >
          <HeaderBackButton onPress={() => navigation.goBack()} withDefaultMargin={false} />
        </View>
        <View style={[Alignments.alignCenter, Spaces.gap[8], { paddingHorizontal: 56 }]}>
          <Text style={[Fonts.h3Bold, Fonts.neutral00, Fonts.textCenter]}>{pageTitle}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          Spaces.paddingHorizontal[16],
          { paddingBottom: scrollBottomPadding },
          Spaces.gap[24],
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
              borderColor: subtleBorderColor,
              borderWidth: 1,
            },
          ]}
        >
          <Text style={[Fonts.p4Bold, Fonts.primary500]}>Ton match</Text>
          <Text style={[Fonts.h2Bold, Fonts.neutral00]}>
            {heroMatchLabel}
          </Text>
          <View style={[Alignments.row, Alignments.wrap, Spaces.gap[8], Spaces.marginTop[4]]}>
            <View style={[
              Spaces.paddingHorizontal[12],
              Spaces.paddingVertical[8],
              { backgroundColor: `${Colors.primary500}1A`, borderRadius: 16 },
            ]}
            >
              <Text style={[Fonts.p3Bold, Fonts.neutral00]}>{scoreSummary}</Text>
            </View>
            <View style={[
              Spaces.paddingHorizontal[12],
              Spaces.paddingVertical[8],
              {
                backgroundColor: insetSurfaceColor,
                borderColor: subtleBorderColor,
                borderRadius: 16,
                borderWidth: 1,
              },
            ]}
            >
              <Text style={[Fonts.p4Bold, Fonts.primary100]}>{scoreSourceLabel}</Text>
            </View>
            <View style={[
              Spaces.paddingHorizontal[12],
              Spaces.paddingVertical[8],
              {
                backgroundColor: insetSurfaceColor,
                borderColor: subtleBorderColor,
                borderRadius: 16,
                borderWidth: 1,
              },
            ]}
            >
              <Text style={[Fonts.p4Bold, Fonts.neutral00]}>{statusLabel}</Text>
            </View>
          </View>
        </View>

        {responseQuery.isLoading ? (
          <View style={[ApplicationStyle.borderRadius24, Spaces.padding[24], { backgroundColor: cardSurfaceColor }]}>
            <Text style={[Fonts.p2, Fonts.neutral00, Fonts.textCenter]}>Chargement de ton retour post-match...</Text>
          </View>
        ) : null}

        {responseQuery.error ? (
          <View style={[ApplicationStyle.borderRadius24, Spaces.padding[24], Spaces.gap[8], { backgroundColor: cardSurfaceColor }]}>
            <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Impossible de charger ce questionnaire.</Text>
            <Text style={[Fonts.p2, Fonts.neutral100]}>{String(responseQuery.error?.message || 'Une erreur est survenue.')}</Text>
            <Button onPress={() => responseQuery.refetch()} title="Réessayer" variant="Secondary" />
          </View>
        ) : null}

        {!responseQuery.isLoading && !responseQuery.error ? (
          <>
            <View style={[ApplicationStyle.borderRadius24, Spaces.padding[sectionPadding], Spaces.gap[sectionGap], { backgroundColor: cardSurfaceColor }]}>
              <View style={[Spaces.gap[8]]}>
                <Text style={[Fonts.h4Bold, Fonts.neutral00]}>As-tu participé au match ?</Text>
                <Text style={[Fonts.p2, { color: secondaryTextColor }]}>
                  Choisis le cas qui correspond le mieux à ta situation pour ce match.
                </Text>
              </View>
              <View style={[Spaces.gap[12]]}>
                {[
                  {
                    description: 'Tu peux ensuite renseigner tes stats et ton ressenti.',
                    label: "J'ai joué",
                    value: 'played',
                  },
                  {
                    description: 'Tu peux laisser une note et un commentaire, sans chiffres de match.',
                    label: "J'étais là mais je n'ai pas joué",
                    value: 'present_no_play',
                  },
                  {
                    description: 'Tu ne seras plus relancé·e pour ce match.',
                    label: "Je n'étais pas concerné·e",
                    value: 'not_involved',
                  },
                ].map((option) => {
                  const isActive = participation === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => setParticipation(option.value)}
                      style={[
                        { borderRadius: 20 },
                        Spaces.padding[16],
                        Spaces.gap[4],
                        {
                          backgroundColor: isActive ? activeSurfaceColor : insetSurfaceColor,
                          borderColor: isActive ? activeBorderColor : subtleBorderColor,
                          borderWidth: 1,
                        },
                      ]}
                    >
                      <Text style={[Fonts.p2Bold, isActive ? Fonts.primary100 : Fonts.neutral00]}>{option.label}</Text>
                      <Text style={[Fonts.p3, isActive ? Fonts.neutral00 : Fonts.neutral200]}>
                        {option.description}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {participation === 'played' ? (
              <View style={[ApplicationStyle.borderRadius24, Spaces.padding[sectionPadding], Spaces.gap[sectionGap], { backgroundColor: cardSurfaceColor }]}>
                <View style={[Spaces.gap[12]]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Mes stats quantitatives</Text>
                    <Text style={[Fonts.p2, { color: secondaryTextColor }]}>
                      Renseigne tes chiffres personnels, ou indique que tu ne les connais pas.
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setDoesKnowStats((current) => !current)}
                  >
                    <Text style={[Fonts.p3Bold, Fonts.neutral300, Fonts.textCenter]}>
                      {doesKnowStats ? 'Je ne connais pas mes stats' : 'Je connais mes stats'}
                    </Text>
                  </Pressable>
                </View>

                {doesKnowStats ? (
                  <>
                    <View style={[Spaces.gap[8]]}>
                      <Text style={[Fonts.p4Bold, Fonts.neutral100]}>Temps de jeu</Text>
                      <View style={[Alignments.row, Spaces.gap[8]]}>
                        {(normalizeSport(sport) === 'basketball'
                          ? [
                            { label: 'Pas joué', minutes: 0 },
                            { label: 'Une mi-temps', minutes: 20 },
                            { label: 'Tout le match', minutes: 40 },
                          ]
                          : [
                            { label: 'Pas joué', minutes: 0 },
                            { label: 'Une mi-temps', minutes: 45 },
                            { label: 'Tout le match', minutes: 90 },
                          ]
                        ).map((preset) => {
                          const isPresetActive = Number.parseInt(String(quantitative?.minutesPlayed || '0'), 10) === preset.minutes;
                          return (
                            <Pressable
                              key={preset.label}
                              onPress={() => updateField('minutesPlayed', String(preset.minutes))}
                              style={{
                                backgroundColor: isPresetActive ? Colors.primary500 : 'transparent',
                                borderColor: isPresetActive ? Colors.primary500 : `${Colors.primary500}4D`,
                                borderRadius: 999,
                                borderWidth: 1.5,
                                flex: 1,
                                paddingHorizontal: 4,
                                paddingVertical: 10,
                              }}
                            >
                              <Text
                                style={[
                                  Fonts.p4Bold,
                                  isPresetActive ? Fonts.primary900 : Fonts.neutral100,
                                  Fonts.textCenter,
                                ]}
                              >
                                {preset.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      <Text style={[Fonts.p4, Fonts.neutral400]}>
                        {`${Number.parseInt(String(quantitative?.minutesPlayed || '0'), 10) || 0} min — ajuste si besoin ci-dessous.`}
                      </Text>
                    </View>
                    {renderCounterField({ field: 'minutesPlayed', label: 'Temps de jeu (min)' })}
                    {fieldRows.map((row) => (
                      <View key={row.map((field) => field.key).join(':')} style={[Alignments.row, Spaces.gap[12]]}>
                        {row.map((field) => (
                          <View key={field.key} style={{ flex: 1 }}>
                            {renderCounterField({ field: field.key, label: field.label })}
                          </View>
                        ))}
                      </View>
                    ))}
                    {normalizeSport(sport) === 'football' ? (
                      <Pressable
                        onPress={() => updateField('cleanSheet', !quantitative?.cleanSheet)}
                        style={[
                          Alignments.row,
                          Alignments.alignCenter,
                          Spaces.gap[12],
                          {
                            backgroundColor: quantitative?.cleanSheet
                              ? 'rgba(39,214,163,0.07)'
                              : insetSurfaceColor,
                            borderColor: quantitative?.cleanSheet
                              ? `${Colors.success500}59`
                              : subtleBorderColor,
                            borderRadius: 14,
                            borderWidth: 1,
                            paddingHorizontal: 14,
                            paddingVertical: 11,
                          },
                        ]}
                      >
                        <View style={[Alignments.fill]}>
                          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>Clean sheet</Text>
                          <Text
                            style={[
                              Fonts.p4,
                              quantitative?.cleanSheet ? Fonts.success200 : Fonts.neutral400,
                              { marginTop: 1 },
                            ]}
                          >
                            {quantitative?.cleanSheet
                              ? 'Activé automatiquement — 0 but encaissé'
                              : "S'active à 0 but encaissé"}
                          </Text>
                        </View>
                        <View
                          style={{
                            backgroundColor: quantitative?.cleanSheet
                              ? `${Colors.success500}E6`
                              : 'rgba(255,255,255,0.14)',
                            borderRadius: 999,
                            height: 28,
                            width: 48,
                          }}
                        >
                          <View
                            style={{
                              backgroundColor: Colors.neutral00,
                              borderRadius: 999,
                              height: 22,
                              left: quantitative?.cleanSheet ? undefined : 3,
                              position: 'absolute',
                              right: quantitative?.cleanSheet ? 3 : undefined,
                              top: 3,
                              width: 22,
                            }}
                          />
                        </View>
                      </Pressable>
                    ) : null}
                    {consistencyIssues.length ? (
                      <View style={[{ borderRadius: 20 }, Spaces.padding[16], Spaces.gap[8], { backgroundColor: activeSurfaceColor, borderColor: `${Colors.warning500}66`, borderWidth: 1 }]}>
                        <Text style={[Fonts.p3Bold, Fonts.warning500]}>Vérification de cohérence</Text>
                        {consistencyIssues.map((issue) => (
                          <Text key={issue} style={[Fonts.p3, Fonts.neutral100]}>
                            {`- ${issue}`}
                          </Text>
                        ))}
                        <Text style={[Fonts.p4, Fonts.neutral200]}>
                          Le score officiel ne sera jamais modifié. Corrige simplement les chiffres avant l&apos;envoi.
                        </Text>
                      </View>
                    ) : null}
                  </>
                ) : (
                  <View style={[{ borderRadius: 20 }, Spaces.padding[16], Spaces.gap[8], { backgroundColor: insetSurfaceColor, borderColor: subtleBorderColor, borderWidth: 1 }]}>
                    <Text style={[Fonts.p2Bold, Fonts.neutral00]}>Aucun problème.</Text>
                    <Text style={[Fonts.p3, { color: secondaryTextColor }]}>
                      On enregistre que tu ne connais pas tes stats individuelles pour ce match. Tu peux quand même laisser ta note et ton ressenti.
                    </Text>
                  </View>
                )}
              </View>
            ) : null}

            {participation !== 'not_involved' ? (
              <View style={[ApplicationStyle.borderRadius24, Spaces.padding[sectionPadding], Spaces.gap[sectionGap], { backgroundColor: cardSurfaceColor }]}>
                <View style={[Spaces.gap[8]]}>
                  <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Mon ressenti</Text>
                  <Text style={[Fonts.p2, { color: secondaryTextColor }]}>
                    Note ton match et le match de l&apos;équipe, puis ajoute un commentaire si tu le souhaites.
                  </Text>
                </View>

                <View style={[Spaces.gap[12]]}>
                  <Text style={[Fonts.p3Bold, Fonts.neutral00]}>Ma performance</Text>
                  <Text style={[Fonts.p3, { color: secondaryTextColor }]}>
                    Comment tu évaluerais ta contribution personnelle sur ce match ?
                  </Text>
                  {renderRatingScale(rating, setRating)}
                </View>

                {participation === 'played' || participation === 'present_no_play' ? (
                  <View style={[Spaces.gap[12]]}>
                    <Text style={[Fonts.p3Bold, Fonts.neutral00]}>Le match de l&apos;équipe</Text>
                    <Text style={[Fonts.p3, { color: secondaryTextColor }]}>
                      Donne ton ressenti collectif sur la performance du groupe.
                    </Text>
                    {renderRatingScale(teamRating, setTeamRating)}
                  </View>
                ) : null}

                <TextInput
                  multiline
                  numberOfLines={4}
                  onChangeText={setComment}
                  placeholder="Mon ressenti, ce qui a bien marché, ce qui était plus compliqué…"
                  placeholderTextColor={Colors.neutral400}
                  style={[
                    Fonts.p2,
                    Fonts.neutral00,
                    { borderRadius: 20 },
                    Spaces.padding[16],
                    {
                      backgroundColor: fieldSurfaceColor,
                      borderColor: subtleBorderColor,
                      borderWidth: 1,
                      minHeight: isCompactMobile ? 120 : 132,
                      textAlignVertical: 'top',
                    },
                  ]}
                  value={comment}
                />
              </View>
            ) : null}

            <View style={[ApplicationStyle.borderRadius24, Spaces.padding[sectionPadding], Spaces.gap[16], { backgroundColor: cardSurfaceColor }]}>
              <View style={[Spaces.gap[8]]}>
                <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Actions</Text>
                <Text style={[Fonts.p2, { color: secondaryTextColor }]}>
                  Tu peux enregistrer un brouillon ou envoyer directement ton retour.
                </Text>
              </View>
              <Button
                disabled={!participation || saveMutation.isPending}
                isLoading={saveMutation.isPending}
                onPress={handleSaveDraft}
                title="Sauvegarder mon brouillon"
                variant="Secondary"
              />
              <Button
                disabled={!participation || saveMutation.isPending}
                isLoading={saveMutation.isPending}
                onPress={handleSubmit}
                title="Envoyer mon retour"
                variant="Primary"
              />
            </View>
          </>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

export default PlayerMatchResponseScreen;
