import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { invalidateAfterAction } from '@/domains/refresh/afterAction';
import { withAlpha } from '@/theme/colors';
import localeDesFormats from '@/theme/strings/localeDesFormats';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import SkeletonLoader from '@/components/atoms/skeletonLoader/SkeletonLoader';
import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import { describeCoachPromptTitle } from '@/components/organisms/matchStats/matchStatsPromptModel';
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

import {
  buildConsistencyIssues,
  buildInitialQuantitative,
  buildResponsePayload,
  getFigureKeys,
  getFooterMode,
  getMatchOutcome,
  getMinutesPresets,
  getPlusLimit,
  isGoalkeeperPosition,
  MINUTES_STEP,
  normalizeSport,
  sanitizeFigure,
  toFigure,
} from './playerMatchResponseModel';

// ST-REPONSE (02/10) — « MON RETOUR DE MATCH », REFAIT SUR LA PLANCHE VALIDÉE PAR ADEL.
// Design : https://claude.ai/artifact/9S18FWsXHaN9PBSZ3koNSF, page 4, « P4-reponse-tel » (9 états).
// La question d'abord ; un vrai sélecteur « je connais / je ne sais pas » ; UN temps de jeu que
// les pastilles remplissent ; deux grilles de notes séparées ; une ligne qui dit qui lit ;
// un pied fixe ; « Envoyée le … » quand elle est partie ; l'en-tête reste en erreur.
// Ce qui part au serveur et ce qui bloque l'envoi : `playerMatchResponseModel.js`.
// Témoin : `__tests__/PlayerMatchResponseScreen.STREPONSE.test.js`.

const PARTICIPATIONS = ['played', 'present_no_play', 'not_involved'];
const RATINGS = Array.from({ length: 10 }, (_, index) => index + 1);

/**
 * Le message d'erreur que renvoie l'API, sinon le repli.
 * @param {any} error L'erreur de la requête.
 * @param {string} fallbackMessage Le repli.
 * @returns {string} Le message.
 */
const getApiErrorMessage = (error, fallbackMessage) => (
  error?.response?.data?.error?.message
  || error?.response?.data?.message
  || error?.message
  || fallbackMessage
);

/**
 * Met la première lettre en capitale (« ton entraîneur » en début de phrase).
 * @param {string} value Le texte.
 * @returns {string} Le texte, capitale en tête.
 */
const capitalize = (value) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : value);

/**
 * L'écran « Mon retour de match » du joueur.
 * @param {object} props Les propriétés de l'écran.
 * @param {any} props.navigation La navigation.
 * @param {any} props.route La route et ses paramètres.
 * @returns {import('react').ReactElement} L'écran.
 */
function PlayerMatchResponseScreen({ navigation, route }) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const { userData } = useAuth();
  const { bottomInset, sceneBottomInset } = useBottomDockLayout();
  // Le dock n'existe que sous les onglets League : côté club, l'écran est posé AU-DESSUS des
  // onglets (`EventStack`), et réserver sa place laissait un vide sous le pied fixe.
  // Même règle que `SquadDetailsScreen`.
  const hasTabBar = (useContext(BottomTabBarHeightContext) || 0) > 0;
  const footerBottomPadding = hasTabBar ? sceneBottomInset : Math.max(bottomInset, 16);
  const queryClient = useQueryClient();
  const sourceType = route?.params?.sourceType === 'league' ? 'league' : 'event';
  const eventId = route?.params?.eventId || null;
  const matchId = route?.params?.matchId || null;
  const requestedTeamId = route?.params?.teamId || null;
  const routeMatchLabel = route?.params?.matchLabel || null;
  const forceUnknownStats = Boolean(route?.params?.forceUnknownStats);
  const hydratedKeyRef = useRef(null);
  // Le titre appartient à l'écran : les quatre appelants passent encore « Mon retour
  // post-match » dans la route, la planche dit « Mon retour de match ».
  const pageTitle = t('playerMatchResponseScreen.screenTitle', 'Mon retour de match');

  const eventQuery = useGetEventMyMatchResponse(eventId || '', requestedTeamId || undefined, {
    enabled: Boolean(sourceType === 'event' && eventId),
  });
  const leagueQuery = useGetLeagueMyMatchResponse(matchId || '', requestedTeamId || undefined, {
    enabled: Boolean(sourceType === 'league' && matchId),
  });

  const responseQuery = sourceType === 'event' ? eventQuery : leagueQuery;
  const responsePayload = responseQuery.data || null;
  const savedResponse = responsePayload?.response || null;
  const isMissingSourceId = sourceType === 'event' ? !eventId : !matchId;
  const sport = normalizeSport(responsePayload?.sport || route?.params?.sport || 'football');
  const isGoalkeeper = isGoalkeeperPosition(userData?.position);
  const score = responsePayload?.score;
  const [participation, setParticipation] = useState(null);
  const [isChoosing, setIsChoosing] = useState(false);
  const [doesKnowStats, setDoesKnowStats] = useState(true);
  const [rating, setRating] = useState(null);
  const [teamRating, setTeamRating] = useState(null);
  const [comment, setComment] = useState('');
  const [quantitative, setQuantitative] = useState(/** @type {any} */ ({}));

  useEffect(() => {
    const hydrateKey = [
      sourceType,
      eventId || matchId || 'source',
      requestedTeamId || 'auto',
      savedResponse?.documentId || 'empty',
      savedResponse?.updatedAt || savedResponse?.submittedAt || 'fresh',
    ].join(':');

    if (!responsePayload || hydratedKeyRef.current === hydrateKey) return;
    hydratedKeyRef.current = hydrateKey;

    setParticipation(savedResponse?.participation || null);
    setDoesKnowStats(savedResponse?.quantitativeState !== 'unknown');
    setRating(savedResponse?.selfRating ?? null);
    setTeamRating(savedResponse?.teamRating ?? null);
    setComment(savedResponse?.selfComment || '');
    setQuantitative(buildInitialQuantitative(savedResponse, sport));
  }, [eventId, matchId, requestedTeamId, responsePayload, savedResponse, sourceType, sport]);

  useEffect(() => {
    if (!forceUnknownStats) return;
    if (savedResponse?.status === 'submitted') return;

    setParticipation((current) => current || 'played');
    setDoesKnowStats(false);
  }, [forceUnknownStats, savedResponse?.status]);

  const isSubmitted = savedResponse?.status === 'submitted';
  // Le prénom de qui a saisi le score : c'est lui que la planche nomme.
  // Sans lui, « ton entraîneur ».
  const coachFirstName = score?.recordedBy?.firstname || null;
  const coachName = coachFirstName
    || t('playerMatchResponseScreen.coachFallback', 'ton entraîneur');
  const coachAtStart = capitalize(coachName);

  const titreDeSecours = routeMatchLabel
    || responsePayload?.event?.name
    || responsePayload?.team?.name
    || t('playerMatchResponseScreen.match', 'Match');
  // 🎨 FINITIONS15 point 9g — « AS Montrivage — Test-COMPO » (planche P4) : l'écran se titre SEUL,
  // par la règle des cartes, quand le serveur nomme l'adversaire (`event.opponentName`, `null`
  // inconnu) et le club (`team.clubName`). Serveur d'avant : le titre d'avant.
  const serveurNommeLAdversaire = sourceType === 'event'
    && Object.prototype.hasOwnProperty.call(responsePayload?.event || {}, 'opponentName');
  const matchName = serveurNommeLAdversaire
    ? describeCoachPromptTitle(
      {
        label: titreDeSecours,
        opponentName: responsePayload?.event?.opponentName,
        sourceType: 'event',
      },
      responsePayload?.team?.clubName || responsePayload?.team?.name,
    )
    : titreDeSecours;

  const matchMeta = useMemo(() => {
    const locale = localeDesFormats();
    const rawDate = responsePayload?.event?.date || responsePayload?.match?.date || null;
    const date = rawDate && !Number.isNaN(new Date(rawDate).getTime())
      ? new Date(rawDate).toLocaleDateString(locale, {
        day: 'numeric', month: 'short', weekday: 'short',
      })
      : null;
    const teamName = responsePayload?.team?.name || route?.params?.teamName || null;
    const lead = [teamName, date].filter(Boolean).join(' · ');
    const outcome = getMatchOutcome(score);
    const scoreText = `${score?.scoreFor} - ${score?.scoreAgainst}`;
    const scoreOptions = { score: scoreText, ...SANS_ECHAPPEMENT };
    const outcomeLabels = {
      draw: t('playerMatchResponseScreen.outcome.draw', 'Nul {{score}}', scoreOptions),
      loss: t('playerMatchResponseScreen.outcome.loss', 'Défaite {{score}}', scoreOptions),
      pending: t('playerMatchResponseScreen.scorePending', 'Score en attente'),
      win: t('playerMatchResponseScreen.outcome.win', 'Victoire {{score}}', scoreOptions),
    };
    let source = null;
    if (score?.source === 'manual' && coachFirstName) {
      source = t('playerMatchResponseScreen.recordedBy', 'saisi par {{name}}', {
        name: coachFirstName, ...SANS_ECHAPPEMENT,
      });
    } else if (score?.source === 'league_validated') {
      source = t('playerMatchResponseScreen.leagueValidatedScore', 'Score ligue validé');
    } else if (score?.source === 'external_sync') {
      source = t('playerMatchResponseScreen.officialScoreSynced', 'Score officiel synchronisé');
    }
    return { lead, outcome: outcomeLabels[outcome], source };
  }, [coachFirstName, responsePayload, route?.params?.teamName, score, t]);

  const sentLabel = useMemo(() => {
    const raw = savedResponse?.submittedAt || savedResponse?.updatedAt || null;
    if (!isSubmitted || !raw || Number.isNaN(new Date(raw).getTime())) return null;
    const locale = localeDesFormats();
    const moment = new Date(raw);
    return t('playerMatchResponseScreen.sentOn', 'Envoyée le {{date}} à {{time}}', {
      date: moment.toLocaleDateString(locale, { day: 'numeric', month: 'short' }),
      time: moment.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
      ...SANS_ECHAPPEMENT,
    });
  }, [isSubmitted, savedResponse?.submittedAt, savedResponse?.updatedAt, t]);

  const consistencyIssues = useMemo(() => buildConsistencyIssues({
    doesKnowStats, participation, quantitative, score, sport,
  }), [doesKnowStats, participation, quantitative, score, sport]);
  const fieldsInError = useMemo(
    () => new Set(consistencyIssues.map((issue) => issue.field)),
    [consistencyIssues],
  );

  /**
   * Le titre et l'explication d'une incohérence, dans la langue de l'écran.
   * @param {{ code: string, limit: number, value: number }} issue L'incohérence.
   * @returns {{ hint: string, title: string }} Ses deux phrases.
   */
  // Des clefs ÉCRITES EN ENTIER, une par cas : `scripts/i18n/clefs.js` ne lit pas un gabarit.
  const describeIssue = useCallback((issue) => {
    const options = { count: issue.value, limit: issue.limit, ...SANS_ECHAPPEMENT };
    switch (issue.code) {
      case 'cleanSheetConceded':
        return {
          hint: t(
            'playerMatchResponseScreen.issue.cleanSheetConcededHint',
            'Un clean sheet veut dire 0 but encaissé.',
          ),
          title: t('playerMatchResponseScreen.issue.cleanSheetConceded', {
            ...options,
            defaultValue_one: 'Clean sheet, avec {{count}} but encaissé',
            defaultValue_other: 'Clean sheet, avec {{count}} buts encaissés',
          }),
        };
      case 'cleanSheetScored':
        return {
          hint: t(
            'playerMatchResponseScreen.issue.cleanSheetScoredHint',
            "Un clean sheet veut dire que l'adversaire n'a pas marqué.",
          ),
          title: t(
            'playerMatchResponseScreen.issue.cleanSheetScored',
            "Clean sheet, alors que l'adversaire a marqué",
          ),
        };
      case 'concededOverScore':
        return {
          hint: t(
            'playerMatchResponseScreen.issue.concededOverScoreHint',
            "Tes buts encaissés ne peuvent pas dépasser le score de l'adversaire.",
          ),
          title: t('playerMatchResponseScreen.issue.concededOverScore', {
            ...options,
            defaultValue_one: '{{count}} but encaissé, pour un score adverse de {{limit}}',
            defaultValue_other: '{{count}} buts encaissés, pour un score adverse de {{limit}}',
          }),
        };
      case 'pointsOverScore':
        return {
          hint: t(
            'playerMatchResponseScreen.issue.pointsOverScoreHint',
            'Tes points ne peuvent pas dépasser le score de ton équipe.',
          ),
          title: t('playerMatchResponseScreen.issue.pointsOverScore', {
            ...options,
            defaultValue_one: '{{count}} point, pour un score de {{limit}}',
            defaultValue_other: '{{count}} points, pour un score de {{limit}}',
          }),
        };
      case 'threesOverPoints':
        return {
          hint: t(
            'playerMatchResponseScreen.issue.threesOverPointsHint',
            'Tes paniers à 3 points valent plus que tes points marqués.',
          ),
          title: t('playerMatchResponseScreen.issue.threesOverPoints', {
            ...options,
            defaultValue_one: '{{count}} panier à 3 points, pour {{limit}} points',
            defaultValue_other: '{{count}} paniers à 3 points, pour {{limit}} points',
          }),
        };
      default:
        return {
          hint: t(
            'playerMatchResponseScreen.issue.goalsOverScoreHint',
            'Tes buts ne peuvent pas dépasser le score de ton équipe.',
          ),
          title: t('playerMatchResponseScreen.issue.goalsOverScore', {
            ...options,
            defaultValue_one: '{{count}} but, pour un score de {{limit}}',
            defaultValue_other: '{{count}} buts, pour un score de {{limit}}',
          }),
        };
    }
  }, [t]);

  const updateField = useCallback((field, value) => {
    setQuantitative((current) => ({
      ...current,
      [field]: field === 'cleanSheet' ? Boolean(value) : sanitizeFigure(field, value),
    }));
  }, []);

  const adjustField = useCallback((field, delta) => {
    setQuantitative((current) => ({
      ...current,
      [field]: sanitizeFigure(field, String(Math.max(0, toFigure(current?.[field]) + delta))),
    }));
  }, []);

  // H9 — LA MEME LISTE QUE `MatchStatsEditor` : deux copies d'une liste finissent par diverger.
  const invalidateQueries = useCallback(
    () => invalidateAfterAction(queryClient, 'submitMatchStats'),
    [queryClient],
  );

  const buildPayload = useCallback((status) => buildResponsePayload({
    comment,
    doesKnowStats,
    isGoalkeeper,
    participation,
    quantitative,
    rating,
    sport,
    teamId: requestedTeamId,
    teamRating,
  }, status), [
    comment, doesKnowStats, isGoalkeeper, participation, quantitative, rating,
    requestedTeamId, sport, teamRating,
  ]);

  // Défaut 22 du relevé du 01/10 : `replace(EventDetails)` empilait une 2e fiche du match sous
  // la première. On revient d'où l'on vient ; on ne remplace que si l'écran a été ouvert seul.
  const leaveAfterSubmit = useCallback(() => {
    if (navigation.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    if (sourceType === 'event' && eventId) {
      navigation.replace(RouteNames.EventDetails, { eventId });
      return;
    }
    if (sourceType === 'league' && matchId) {
      navigation.replace(RouteNames.LeagueMatchDetails, { matchId });
    }
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
      Alert.alert(t('common.error', 'Erreur'), getApiErrorMessage(error, t(
        'playerMatchResponseScreen.saveError',
        "Impossible d'enregistrer ta réponse.",
      )));
    },
    onSuccess: async (_result, status) => {
      await invalidateQueries();
      await responseQuery.refetch();
      if (status === 'draft') {
        Alert.alert(
          t('playerMatchResponseScreen.draftSaved', 'Brouillon enregistré'),
          t('playerMatchResponseScreen.resumeLater', 'Tu peux reprendre ta réponse plus tard.'),
        );
        return;
      }
      Alert.alert(
        t('playerMatchResponseScreen.thankYou', 'Merci'),
        participation === 'played'
          ? t('playerMatchResponseScreen.matchSaved', 'Ton match est enregistré.')
          : t(
            'playerMatchResponseScreen.feedbackSaved',
            'Ton retour post-match a bien été enregistré.',
          ),
        [{ onPress: leaveAfterSubmit, text: 'OK' }],
      );
    },
  });

  const save = useCallback((status) => {
    if (!participation) {
      Alert.alert(
        t('playerMatchResponseScreen.participation', 'Participation'),
        t('playerMatchResponseScreen.sayIfPlayedFirst', "Indique d'abord si tu as joué ce match."),
      );
      return;
    }
    // Le serveur refuse aussi un BROUILLON incohérent : on le dit avant de l'envoyer.
    if (consistencyIssues.length > 0) {
      const { hint, title } = describeIssue(consistencyIssues[0]);
      Alert.alert(title, hint);
      return;
    }
    saveMutation.mutate(status);
  }, [consistencyIssues, describeIssue, participation, saveMutation, t]);

  const chooseParticipation = useCallback((value) => {
    setParticipation(value);
    setIsChoosing(false);
  }, []);

  const isSaving = saveMutation.isPending;
  const footerMode = getFooterMode({ isSubmitted, participation });
  const canSend = Boolean(participation) && consistencyIssues.length === 0 && !isSaving;
  const hasRatings = participation === 'played' || participation === 'present_no_play';

  const surfaces = useMemo(() => ({
    card: {
      backgroundColor: withAlpha(Colors.primary700, 0.45),
      borderColor: withAlpha(Colors.primary500, 0.24),
      borderRadius: 16,
      borderWidth: 1,
    },
    field: {
      backgroundColor: withAlpha(Colors.primary800, 0.85),
      borderColor: withAlpha(Colors.primary500, 0.24),
      borderRadius: 12,
      borderWidth: 1,
    },
  }), [Colors]);

  const renderHeader = () => (
    <View
      style={[
        Alignments.row,
        Alignments.alignCenter,
        Spaces.gap[8],
        Spaces.paddingHorizontal[16],
        Spaces.paddingVertical[8],
      ]}
    >
      <HeaderBackButton onPress={() => navigation.goBack()} withDefaultMargin={false} />
      <Text
        accessibilityRole="header"
        numberOfLines={1}
        style={[Fonts.h4Bold, Fonts.neutral00, Alignments.fill]}
      >
        {pageTitle}
      </Text>
    </View>
  );

  const renderMatchCard = () => (
    <View
      style={[
        surfaces.card, Spaces.paddingHorizontal[16], Spaces.paddingVertical[12], Spaces.gap[4],
      ]}
    >
      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{matchName}</Text>
      <Text style={[Fonts.p3, Fonts.neutral300]}>
        {matchMeta.lead ? `${matchMeta.lead} · ` : ''}
        <Text style={[Fonts.p3Bold, Fonts.neutral100]}>{matchMeta.outcome}</Text>
        {matchMeta.source ? ` · ${matchMeta.source}` : ''}
      </Text>
    </View>
  );

  const participationLabels = {
    not_involved: [
      t('playerMatchResponseScreen.notInvolved', "Je n'étais pas concerné·e"),
      t(
        'playerMatchResponseScreen.notInvolvedDescription',
        'Tu ne seras plus relancé·e pour ce match',
      ),
    ],
    played: [
      t('playerMatchResponseScreen.played', "J'ai joué"),
      t('playerMatchResponseScreen.playedHint', "Tes chiffres, ta note et celle de l'équipe"),
    ],
    present_no_play: [
      t('playerMatchResponseScreen.presentNoPlay', "J'étais là sans jouer"),
      t('playerMatchResponseScreen.presentNoPlayHint', 'Tes deux notes, sans chiffres'),
    ],
  };

  const renderParticipationRow = (value) => {
    const isSelected = participation === value;
    const [label, hint] = participationLabels[value];
    // Description : sur toutes les lignes tant que rien n'est choisi, puis sur la seule choisie.
    const showHint = !participation || isSelected;
    return (
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ checked: isSelected }}
        key={value}
        onPress={() => (isSelected && !isChoosing && value !== 'not_involved'
          ? setIsChoosing(true)
          : chooseParticipation(value))}
        style={[
          surfaces.card,
          Alignments.row,
          Alignments.alignCenter,
          Spaces.gap[12],
          Spaces.paddingHorizontal[16],
          Spaces.paddingVertical[12],
          { minHeight: 52 },
          isSelected && {
            backgroundColor: withAlpha(Colors.primary500, 0.12),
            borderColor: Colors.primary500,
          },
        ]}
      >
        <View
          style={[
            Alignments.center,
            {
              borderColor: isSelected ? Colors.primary500 : Colors.neutral400,
              borderRadius: 12,
              borderWidth: 2,
              height: 24,
              width: 24,
            },
          ]}
        >
          {isSelected ? (
            <View style={{
              backgroundColor: Colors.primary500, borderRadius: 6, height: 12, width: 12,
            }}
            />
          ) : null}
        </View>
        <View style={[Alignments.fill]}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{label}</Text>
          {showHint ? <Text style={[Fonts.p3, Fonts.neutral300]}>{hint}</Text> : null}
        </View>
      </Pressable>
    );
  };

  const renderParticipation = () => {
    const showAll = !participation || participation === 'not_involved' || isChoosing;
    return (
      <View style={Spaces.gap[8]}>
        {showAll ? (
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
            {t('playerMatchResponseScreen.didYouPlay', 'As-tu joué ce match ?')}
          </Text>
        ) : null}
        <View accessibilityRole="radiogroup" style={Spaces.gap[8]}>
          {(showAll ? PARTICIPATIONS : [participation]).map(renderParticipationRow)}
        </View>
      </View>
    );
  };

  const renderStepButton = ({
    disabled, label, onPress, sign,
  }) => (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[Alignments.center, { height: 44, opacity: disabled ? 0.4 : 1, width: 44 }]}
    >
      <Text style={[Fonts.h4Bold, Fonts.primary200]}>{sign}</Text>
    </Pressable>
  );

  const renderCounter = ({
    field, label, minusLabel, plusLabel, step = 1, suffix = null,
  }) => {
    const value = toFigure(quantitative?.[field]);
    const hasError = fieldsInError.has(field);
    return (
      <View
        style={[
          surfaces.field,
          Alignments.row,
          Alignments.alignCenter,
          hasError && {
            backgroundColor: withAlpha(Colors.error500, 0.12),
            borderColor: Colors.error500,
          },
        ]}
      >
        {renderStepButton({
          disabled: value <= 0,
          label: minusLabel,
          onPress: () => adjustField(field, -step),
          sign: '−',
        })}
        <View style={[Alignments.fill, Alignments.row, Alignments.center, Spaces.gap[4]]}>
          <TextInput
            accessibilityLabel={label}
            keyboardType="number-pad"
            onChangeText={(text) => updateField(field, text)}
            selectTextOnFocus
            style={[
              Fonts.h4Bold,
              hasError ? Fonts.error500 : Fonts.neutral00,
              Fonts.textCenter,
              { minWidth: 32, paddingVertical: 0 },
            ]}
            value={String(quantitative?.[field] ?? '0')}
          />
          {suffix ? <Text style={[Fonts.p2Bold, Fonts.neutral200]}>{suffix}</Text> : null}
        </View>
        {renderStepButton({
          disabled: value >= getPlusLimit(field, score),
          label: plusLabel,
          onPress: () => adjustField(field, step),
          sign: '+',
        })}
      </View>
    );
  };

  const renderMinutes = () => {
    const minutes = toFigure(quantitative?.minutesPlayed);
    return (
      <View style={Spaces.gap[8]}>
        <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
          <GlyphIcon color={Colors.primary200} name="clock" size={16} />
          <Text style={[Fonts.p3Bold, Fonts.neutral100]}>
            {t('playerMatchResponseScreen.playingTime', 'Temps de jeu')}
          </Text>
        </View>
        <View accessibilityRole="radiogroup" style={[Alignments.row, Spaces.gap[8]]}>
          {getMinutesPresets(sport).map((preset) => {
            const isActive = String(quantitative?.minutesPlayed ?? '') !== ''
              && minutes === preset.minutes;
            const label = {
              full: t('playerMatchResponseScreen.wholeMatch', 'Tout le match'),
              half: t('playerMatchResponseScreen.oneHalf', 'Une mi-temps'),
              none: t('playerMatchResponseScreen.didNotPlay', 'Pas joué'),
            }[preset.key];
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: isActive }}
                key={preset.key}
                onPress={() => updateField('minutesPlayed', String(preset.minutes))}
                style={[
                  Alignments.fill,
                  Alignments.center,
                  Spaces.paddingHorizontal[4],
                  {
                    backgroundColor: isActive
                      ? Colors.primary500
                      : withAlpha(Colors.primary700, 0.6),
                    borderColor: isActive ? Colors.primary500 : withAlpha(Colors.primary500, 0.24),
                    borderRadius: 22,
                    borderWidth: 1,
                    minHeight: 44,
                  },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[Fonts.p3Bold, isActive ? Fonts.primary900 : Fonts.neutral00]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {renderCounter({
          field: 'minutesPlayed',
          label: t('playerMatchResponseScreen.minutesField', 'Temps de jeu, en minutes'),
          minusLabel: t('playerMatchResponseScreen.fewerMinutes', 'Moins de minutes'),
          plusLabel: t('playerMatchResponseScreen.moreMinutes', 'Plus de minutes'),
          step: MINUTES_STEP,
          suffix: t('playerMatchResponseScreen.minutesUnit', 'min'),
        })}
      </View>
    );
  };

  // Libellé, « − » et « + » de chaque chiffre : des clefs écrites en entier
  // (voir `describeIssue`).
  const figureLabels = {
    assists: [
      t('playerMatchResponseScreen.assists', 'Passes décisives'),
      t('playerMatchResponseScreen.minus.assists', 'Une passe de moins'),
      t('playerMatchResponseScreen.plus.assists', 'Une passe de plus'),
    ],
    goals: [
      t('playerMatchResponseScreen.goals', 'Buts'),
      t('playerMatchResponseScreen.minus.goals', 'Un but de moins'),
      t('playerMatchResponseScreen.plus.goals', 'Un but de plus'),
    ],
    goalsConceded: [
      t('playerMatchResponseScreen.goalsConceded', 'Buts encaissés'),
      t('playerMatchResponseScreen.minus.goalsConceded', 'Un but encaissé de moins'),
      t('playerMatchResponseScreen.plus.goalsConceded', 'Un but encaissé de plus'),
    ],
    points: [
      t('playerMatchResponseScreen.points', 'Points'),
      t('playerMatchResponseScreen.minus.points', 'Un point de moins'),
      t('playerMatchResponseScreen.plus.points', 'Un point de plus'),
    ],
    rebounds: [
      t('playerMatchResponseScreen.rebounds', 'Rebonds'),
      t('playerMatchResponseScreen.minus.rebounds', 'Un rebond de moins'),
      t('playerMatchResponseScreen.plus.rebounds', 'Un rebond de plus'),
    ],
    threePointsMade: [
      t('playerMatchResponseScreen.threePointers', '3 pts'),
      t('playerMatchResponseScreen.minus.threePointsMade', 'Un panier à 3 points de moins'),
      t('playerMatchResponseScreen.plus.threePointsMade', 'Un panier à 3 points de plus'),
    ],
  };

  const renderFigures = () => (
    <View style={[Alignments.row, Alignments.wrap, Spaces.gap[12]]}>
      {getFigureKeys(sport, isGoalkeeper).map((field) => {
        const [label, minusLabel, plusLabel] = figureLabels[field];
        return (
          <View key={field} style={[Spaces.gap[8], { flexBasis: '45%', flexGrow: 1 }]}>
            <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[4]]}>
              {field === 'goals' ? (
                <SvgIcon color={Colors.primary200} height={12} name="soccer-ball" width={12} />
              ) : null}
              <Text numberOfLines={1} style={[Fonts.p3Bold, Fonts.neutral100]}>{label}</Text>
            </View>
            {renderCounter({
              field,
              label,
              minusLabel,
              plusLabel,
            })}
          </View>
        );
      })}
      {sport === 'football' && isGoalkeeper ? (
        <View
          style={[
            surfaces.field,
            Alignments.row,
            Alignments.alignCenter,
            Spaces.gap[12],
            Spaces.paddingHorizontal[16],
            { minHeight: 52, width: '100%' },
          ]}
        >
          <Text style={[Fonts.p2Bold, Fonts.neutral00, Alignments.fill]}>
            {t('playerMatchResponseScreen.cleanSheet', 'Clean sheet')}
          </Text>
          <Switch
            accessibilityLabel={t('playerMatchResponseScreen.cleanSheet', 'Clean sheet')}
            onValueChange={(value) => updateField('cleanSheet', value)}
            thumbColor={Colors.neutral00}
            trackColor={{ false: Colors.neutral600, true: Colors.primary500 }}
            value={Boolean(quantitative?.cleanSheet)}
          />
        </View>
      ) : null}
    </View>
  );

  const renderIssues = () => (consistencyIssues.length ? (
    <View
      accessibilityRole="alert"
      style={[
        Spaces.gap[8],
        Spaces.padding[16],
        {
          backgroundColor: withAlpha(Colors.error500, 0.12),
          borderColor: Colors.error500,
          borderRadius: 16,
          borderWidth: 1,
        },
      ]}
    >
      {consistencyIssues.map((issue) => {
        const { hint, title } = describeIssue(issue);
        return (
          <View key={issue.code} style={Spaces.gap[4]}>
            <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
              <GlyphIcon color={Colors.error300} name="triangleExclamation" size={16} />
              <Text style={[Fonts.p2Bold, Fonts.error300, Alignments.fill]}>{title}</Text>
            </View>
            <Text style={[Fonts.p2, Fonts.neutral100]}>{hint}</Text>
          </View>
        );
      })}
      <Text style={[Fonts.p3, Fonts.neutral200]}>
        {t(
          'playerMatchResponseScreen.issue.scoreUnchanged',
          "Le score du match ne change pas : corrige tes chiffres avant l'envoi.",
        )}
      </Text>
    </View>
  ) : null);

  const renderKnowledge = () => (
    <View style={Spaces.gap[16]}>
      <SegmentedControl
        centerContent
        onChange={(value) => setDoesKnowStats(value === 'known')}
        options={[
          {
            label: t('playerMatchResponseScreen.knowMyFigures', 'Je connais mes chiffres'),
            value: 'known',
          },
          { label: t('playerMatchResponseScreen.dontKnow', 'Je ne sais pas'), value: 'unknown' },
        ]}
        value={doesKnowStats ? 'known' : 'unknown'}
      />
      {doesKnowStats ? (
        <>
          {renderMinutes()}
          {renderFigures()}
          {renderIssues()}
        </>
      ) : (
        <>
          <View style={[surfaces.card, Alignments.row, Spaces.gap[12], Spaces.padding[16]]}>
            <GlyphIcon color={Colors.primary200} name="circleCheck" size={20} />
            <Text style={[Fonts.p2, Fonts.neutral200, Alignments.fill]}>
              {t(
                'playerMatchResponseScreen.unknownFiguresInfo',
                'Aucun problème. {{coach}} saisira tes chiffres sur la feuille ; '
                  + "donne quand même ta note et celle de l'équipe.",
                { coach: coachAtStart, ...SANS_ECHAPPEMENT },
              )}
            </Text>
          </View>
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {t('playerMatchResponseScreen.ratingsBelow', 'Tes notes sont juste en dessous.')}
          </Text>
        </>
      )}
    </View>
  );

  const renderRatingGrid = ({
    accent, label, onSelect, selectedValue,
  }) => (
    <View style={Spaces.gap[8]}>
      <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
        <View style={{
          backgroundColor: accent, borderRadius: 4, height: 8, width: 8,
        }}
        />
        <Text style={[Fonts.p3Bold, Fonts.neutral100]}>{label}</Text>
      </View>
      <View accessibilityRole="radiogroup" style={[Alignments.row, Alignments.wrap, Spaces.gap[8]]}>
        {RATINGS.map((value) => {
          const isActive = selectedValue === value;
          const optionLabel = t('playerMatchResponseScreen.ratingA11y', '{{label}} : {{value}}', {
            label, value, ...SANS_ECHAPPEMENT,
          });
          return (
            <Pressable
              accessibilityLabel={optionLabel}
              accessibilityRole="radio"
              accessibilityState={{ checked: isActive }}
              key={value}
              onPress={() => onSelect(value)}
              style={[
                Alignments.center,
                {
                  backgroundColor: isActive ? accent : withAlpha(Colors.primary700, 0.6),
                  borderColor: isActive ? accent : withAlpha(Colors.primary500, 0.24),
                  borderRadius: 12,
                  borderWidth: 1,
                  flexBasis: '17%',
                  flexGrow: 1,
                  minHeight: 44,
                },
              ]}
            >
              <Text style={[Fonts.p2Bold, isActive ? Fonts.primary900 : Fonts.neutral00]}>
                {value}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const renderRatings = () => {
    const played = participation === 'played';
    const coachOptions = { coach: coachAtStart, ...SANS_ECHAPPEMENT };
    const readersLine = played && doesKnowStats
      ? t(
        'playerMatchResponseScreen.readersFigures',
        '{{coach}} lit tes chiffres, tes notes et ton mot. Tes coéquipiers, jamais.',
        coachOptions,
      )
      : t(
        'playerMatchResponseScreen.readersRatings',
        '{{coach}} lit tes notes et ton mot. Tes coéquipiers, jamais.',
        coachOptions,
      );
    return (
      <View style={Spaces.gap[16]}>
        {renderRatingGrid({
          accent: Colors.primary500,
          label: played
            ? t('playerMatchResponseScreen.myPerformance', 'Ma performance')
            : t('playerMatchResponseScreen.myRating', 'Ma note'),
          onSelect: setRating,
          selectedValue: rating,
        })}
        {played ? (
          <View style={{ backgroundColor: withAlpha(Colors.primary500, 0.24), height: 1 }} />
        ) : null}
        {renderRatingGrid({
          accent: Colors.success500,
          label: t('playerMatchResponseScreen.teamMatch', "Le match de l'équipe"),
          onSelect: setTeamRating,
          selectedValue: teamRating,
        })}
        <View style={Spaces.gap[8]}>
          <Text style={[Fonts.p3Bold, Fonts.neutral100]}>
            {t('playerMatchResponseScreen.commentLabel', 'Un mot sur le match')}
          </Text>
          <TextInput
            accessibilityLabel={t('playerMatchResponseScreen.commentLabel', 'Un mot sur le match')}
            maxLength={1200}
            multiline
            onChangeText={setComment}
            placeholder={t(
              'playerMatchResponseScreen.commentPlaceholder',
              'Mon ressenti, ce qui a bien marché, ce qui était plus compliqué…',
            )}
            placeholderTextColor={Colors.neutral400}
            style={[
              surfaces.field,
              Fonts.p2,
              Fonts.neutral00,
              Spaces.padding[12],
              { minHeight: 88, textAlignVertical: 'top' },
            ]}
            value={comment}
          />
        </View>
        <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
          <GlyphIcon color={Colors.neutral300} name="lock" size={16} />
          <Text style={[Fonts.p3, Fonts.neutral300, Alignments.fill]}>{readersLine}</Text>
        </View>
      </View>
    );
  };

  /**
   * Le mot sous un chiffre de la réponse envoyée (« 1 but », « 0 passe »).
   * @param {string} key La clé du chiffre.
   * @param {number} count Sa valeur.
   * @returns {string} Le mot, accordé.
   */
  const summaryLabel = (key, count) => {
    switch (key) {
      case 'assists':
        return t('playerMatchResponseScreen.summary.assists', {
          count, defaultValue_one: 'passe', defaultValue_other: 'passes',
        });
      case 'goals':
        return t('playerMatchResponseScreen.summary.goals', {
          count, defaultValue_one: 'but', defaultValue_other: 'buts',
        });
      case 'goalsConceded':
        return t('playerMatchResponseScreen.summary.goalsConceded', {
          count, defaultValue_one: 'encaissé', defaultValue_other: 'encaissés',
        });
      case 'points':
        return t('playerMatchResponseScreen.summary.points', {
          count, defaultValue_one: 'point', defaultValue_other: 'points',
        });
      case 'rebounds':
        return t('playerMatchResponseScreen.summary.rebounds', {
          count, defaultValue_one: 'rebond', defaultValue_other: 'rebonds',
        });
      case 'threePointsMade':
        return t('playerMatchResponseScreen.summary.threePointsMade', {
          count, defaultValue_one: 'à 3 pts', defaultValue_other: 'à 3 pts',
        });
      default:
        return t('playerMatchResponseScreen.summary.minutes', {
          count, defaultValue_one: 'minute', defaultValue_other: 'minutes',
        });
    }
  };

  const renderSentSummary = () => {
    if (!isSubmitted || !savedResponse) return null;
    const cells = [];
    const sentFigures = savedResponse.participation === 'played'
      && savedResponse.quantitativeState === 'completed';
    if (sentFigures) {
      const minutes = toFigure(savedResponse.minutesPlayed);
      cells.push({ key: 'minutes', label: summaryLabel('minutes', minutes), value: minutes });
      getFigureKeys(sport, isGoalkeeper).forEach((key) => {
        const value = toFigure(savedResponse.sportPayload?.[key]);
        cells.push({ key, label: summaryLabel(key, value), value });
      });
    }
    if (savedResponse.selfRating) {
      cells.push({
        key: 'self',
        label: t('playerMatchResponseScreen.summary.myRating', 'ma note'),
        value: savedResponse.selfRating,
      });
    }
    if (savedResponse.teamRating) {
      cells.push({
        key: 'team',
        label: t('playerMatchResponseScreen.summary.teamRating', "l'équipe"),
        value: savedResponse.teamRating,
      });
    }
    if (!cells.length) return null;
    return (
      <View
        style={[surfaces.card, Alignments.row, Alignments.wrap, Spaces.gap[16], Spaces.padding[12]]}
      >
        {cells.map((cell) => (
          <View key={cell.key} style={[Alignments.alignCenter, { minWidth: 48 }]}>
            <Text style={[Fonts.h4Bold, Fonts.neutral00]}>{cell.value}</Text>
            <Text style={[Fonts.caption, Fonts.neutral300]}>{cell.label}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderSentBanner = () => (sentLabel ? (
    <View
      style={[
        Alignments.row,
        Spaces.gap[12],
        Spaces.padding[16],
        {
          backgroundColor: withAlpha(Colors.success500, 0.12),
          borderColor: withAlpha(Colors.success500, 0.4),
          borderRadius: 16,
          borderWidth: 1,
        },
      ]}
    >
      <GlyphIcon color={Colors.success200} name="circleCheck" size={20} />
      <View style={[Alignments.fill, Spaces.gap[4]]}>
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{sentLabel}</Text>
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {t(
            'playerMatchResponseScreen.sentCanCorrect',
            'Tu peux encore la corriger ; {{coach}} verra la nouvelle version.',
            { coach: coachName, ...SANS_ECHAPPEMENT },
          )}
        </Text>
      </View>
    </View>
  ) : null);

  const renderFooter = () => {
    const sendTitle = footerMode === 'correction'
      ? t('playerMatchResponseScreen.saveCorrection', 'Enregistrer la correction')
      : t('playerMatchResponseScreen.send', 'Envoyer');
    return (
      <View
        style={[
          Alignments.row,
          Spaces.gap[12],
          Spaces.paddingHorizontal[16],
          Spaces.paddingTop[12],
          {
            backgroundColor: withAlpha(Colors.primary900, 0.92),
            borderTopColor: withAlpha(Colors.primary500, 0.24),
            borderTopWidth: 1,
            paddingBottom: footerBottomPadding,
          },
        ]}
      >
        {footerMode === 'pair' ? (
          <View style={Alignments.fill}>
            <Button
              disabled={!participation || isSaving}
              isLoading={isSaving && saveMutation.variables === 'draft'}
              onPress={() => save('draft')}
              title={t('playerMatchResponseScreen.draft', 'Brouillon')}
              variant="Secondary"
            />
          </View>
        ) : null}
        <View style={Alignments.fill}>
          <Button
            disabled={!canSend}
            isLoading={isSaving && saveMutation.variables === 'submitted'}
            onPress={() => save('submitted')}
            title={sendTitle}
            variant="Primary"
          />
        </View>
      </View>
    );
  };

  const renderNotice = ({ action, body, title }) => (
    <View style={[Alignments.fill, Alignments.justifyCenter, Spaces.paddingHorizontal[16]]}>
      <View accessibilityRole="alert" style={[surfaces.card, Spaces.gap[12], Spaces.padding[24]]}>
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{title}</Text>
        <Text style={[Fonts.p2, Fonts.neutral200]}>{body}</Text>
        <View style={{ alignSelf: 'flex-start' }}>{action}</View>
      </View>
    </View>
  );

  const backButton = (
    <Button
      onPress={() => navigation.goBack()}
      title={t('common.back', 'Retour')}
      variant="SecondaryLight"
    />
  );

  const skeletonBlock = [ApplicationStyle.borderRadius16, { backgroundColor: Colors.primary700 }];
  let body;
  if (isMissingSourceId) {
    body = renderNotice({
      action: backButton,
      body: t(
        'playerMatchResponseScreen.missingRouteInfo',
        "Cette route n'a pas reçu les informations nécessaires pour charger ton retour "
          + 'post-match.',
      ),
      title: t('playerMatchResponseScreen.matchNotFound', 'Match introuvable'),
    });
  } else if (responseQuery.isLoading && !responsePayload) {
    // Pendant le chargement : la carte du match et la question, en squelette (planche, état 9).
    body = (
      <View style={[Spaces.paddingHorizontal[16], Spaces.paddingTop[16]]}>
        <SkeletonLoader isActive wrapperStyle={[Spaces.gap[16]]}>
          <View style={[...skeletonBlock, { height: 64 }]} />
          <View style={[...skeletonBlock, { height: 24, width: '60%' }]} />
          {PARTICIPATIONS.map((value) => (
            <View key={value} style={[...skeletonBlock, { height: 64 }]} />
          ))}
        </SkeletonLoader>
      </View>
    );
  } else if (responseQuery.error && !responsePayload) {
    body = renderNotice({
      action: (
        <Button
          onPress={() => responseQuery.refetch()}
          title={t('playerMatchResponseScreen.tryAgain', 'Réessayer')}
          variant="SecondaryLight"
        />
      ),
      body: t(
        'playerMatchResponseScreen.loadErrorHint',
        'Vérifie ta connexion, puis réessaie. Ce que tu as déjà rempli est gardé.',
      ),
      title: t(
        'playerMatchResponseScreen.loadErrorTitle',
        "Ton questionnaire n'a pas pu être chargé.",
      ),
    });
  } else if (!responsePayload) {
    body = renderNotice({
      action: backButton,
      body: t(
        'playerMatchResponseScreen.noFeedbackAvailable',
        "Aucun retour joueur n'est disponible pour ce match.",
      ),
      title: t('playerMatchResponseScreen.questionnaireUnavailable', 'Questionnaire indisponible'),
    });
  } else {
    body = (
      <>
        <ScrollView
          contentContainerStyle={[
            Spaces.paddingHorizontal[16],
            Spaces.paddingTop[8],
            Spaces.paddingBottom[24],
            Spaces.gap[16],
          ]}
          keyboardShouldPersistTaps="handled"
          style={Alignments.fill}
        >
          {renderSentBanner()}
          {renderMatchCard()}
          {renderParticipation()}
          {renderSentSummary()}
          {participation === 'played' ? renderKnowledge() : null}
          {hasRatings ? renderRatings() : null}
        </ScrollView>
        {renderFooter()}
      </>
    );
  }

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="edge-to-edge"
      contentContainerStyle={[Alignments.fill]}
      keyboardAvoiding
    >
      {renderHeader()}
      {body}
    </ScreenContainer>
  );
}

export default PlayerMatchResponseScreen;
