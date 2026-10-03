import { useMutation, useQueryClient } from '@tanstack/react-query';
import i18next from 'i18next';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  ScrollView,
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
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import ScreenContainer from '@/components/templates/ScreenContainer';
import { buildMatchEncartLines } from '@/views/event/matchEncartLines';

import { RouteNames } from '@/navigation/routeNames';
import useBottomDockLayout from '@/navigation/useBottomDockLayout';

import {
  useGetEventMatchStats,
  useGetLeagueMatchStats,
} from '@/services/matchStats/matchStatsQueries';
import {
  remindEventMatchResponses,
  saveEventMatchResult,
  saveEventMatchStatsDraft,
  saveLeagueMatchStatsDraft,
  submitEventMatchStats,
  submitLeagueMatchStats,
} from '@/services/matchStats/matchStatsService';

import {
  clampMatchStatsValue,
  getMatchStatsFieldMax,
  MAX_MATCH_SCORE,
  MAX_STAT_VALUE,
} from '@/utils/matchStatsBounds';

// Même motif que `EventDetails.web.js` : `import/order` veut `@/responsive` AVANT les voisins,
// `perfectionist` APRÈS ; les deux règles se contredisent sur ce seul bloc.
/* eslint-disable perfectionist/sort-imports */
import { useIsDesktop } from '@/responsive';
import {
  AlerteFeuille,
  BilanPublie,
  BlocRetours,
  Compteur,
  FicheDuJoueur,
  NotesSurDix,
  TableauDesJoueurs,
  useSurfacesFeuille,
} from './FeuilleDeMatchBlocs';
import {
  corrigerLaFeuille,
  direLeCompte,
  estUneLigneVide,
  joindreLesNoms,
  MOYENNE_MIN_REPONSES,
} from './feuilleDeMatchModel';
/* eslint-enable perfectionist/sort-imports */

/**
 * @typedef {Record<string, any>} MatchStatsLine
 */

const FOOTBALL_FIELDS = [
  {
    key: 'goals',
    get label() {
      return i18next.t('matchStatsEditor.goals', 'Buts');
    },
  },
  {
    key: 'assists',
    get label() {
      return i18next.t('matchStatsEditor.assists', 'Passes décisives');
    },
  },
  {
    key: 'goalsConceded',
    get label() {
      return i18next.t('matchStatsEditor.goalsConceded', 'Buts encaissés');
    },
  },
];

const BASKETBALL_FIELDS = [
  {
    key: 'points',
    get label() {
      return i18next.t('matchStatsEditor.points', 'Points');
    },
  },
  {
    key: 'assists',
    get label() {
      return i18next.t('matchStatsEditor.assists', 'Passes décisives');
    },
  },
  {
    key: 'rebounds',
    get label() {
      return i18next.t('matchStatsEditor.rebounds', 'Rebonds');
    },
  },
  {
    key: 'threePointsMade',
    get label() {
      return i18next.t('matchStatsEditor.threePointers', '3 pts');
    },
  },
];

const normalizeSport = (/** @type {any} */ value) => {
  const raw = String(value || '').toLowerCase();
  if (raw.includes('basket')) return 'basketball';
  return 'football';
};

const getFieldConfig = (/** @type {any} */ sport) => (normalizeSport(sport) === 'basketball'
  ? BASKETBALL_FIELDS
  : FOOTBALL_FIELDS);

const sanitizeNumericInput = (/** @type {any} */ value) => String(value || '').replace(/[^\d]/g, '');

const shiftNumericStringValue = (/** @type {any} */ value, /** @type {number} */ delta, max = MAX_MATCH_SCORE) => {
  const parsed = Number.parseInt(String(value || '0'), 10) || 0;
  const nextValue = Math.max(0, Math.min(max, parsed + delta));
  return String(nextValue);
};

const getLineKey = (/** @type {any} */ line) => (
  line?.userDocumentId
  || line?.documentId
  || (line?.manualPlayerName ? `manual:${line.manualPlayerName}` : null)
  || (line?.key ? String(line.key) : null)
);

/**
 * Les lignes de la feuille, une par joueur.
 *
 * 🧨 ST-MATCH10 — DÉFAUT 19 (planche, état 2) : un brouillon enregistré AVANT la
 * réponse du joueur porte une ligne VIDE, et elle écrasait sa réponse (« la ligne
 * de Hugo reste vide alors qu'il a envoyé 90 min et 1 but »). Une ligne vide cède
 * désormais la place aux chiffres que le joueur a ENVOYÉS ; une ligne que
 * l'entraîneur a remplie garde ses chiffres (il a pu corriger la réponse).
 * @param {any[]} players - Les joueurs de la feuille (`availablePlayers`).
 * @param {any} report - La feuille enregistrée, s'il y en a une.
 * @param {any} sport - Le sport.
 * @param {any[]} responses - Les réponses des joueurs (`playerResponses`).
 * @returns {MatchStatsLine[]} Les lignes, en texte (comme les compteurs).
 */
const buildInitialLines = (players, report, sport, responses) => {
  const fields = getFieldConfig(sport);
  const existingLines = Array.isArray(report?.playerLines) ? report.playerLines : [];
  const existingMap = new Map(existingLines.map((/** @type {any} */ line) => [getLineKey(line), line]));
  const submitted = new Set((Array.isArray(responses) ? responses : [])
    .filter((/** @type {any} */ response) => response?.status === 'submitted')
    .map((/** @type {any} */ response) => response?.userDocumentId)
    .filter(Boolean));

  return (Array.isArray(players) ? players : []).map((/** @type {any} */ player) => {
    const playerKey = getLineKey(player);
    const existing = existingMap.get(playerKey) || null;
    const hasSentFigures = Boolean(player?.suggestedStats && player?.documentId)
      && submitted.has(player.documentId);
    const takesSentFigures = Boolean(player?.suggestedStats)
      && (!existing || (hasSentFigures && estUneLigneVide(existing)));
    const source = takesSentFigures ? player.suggestedStats : existing;
    const payload = source?.sportPayload || {};
    const baseLine = /** @type {MatchStatsLine} */ ({
      firstname: player?.firstname || null,
      key: playerKey || `player:${Math.random().toString(36).slice(2)}`,
      label: player?.label || [player?.firstname, player?.lastname].filter(Boolean).join(' ').trim() || player?.manualPlayerName || i18next.t(
        'matchStatsEditor.player',
        'Joueur',
      ),
      lastname: player?.lastname || null,
      manualPlayerName: player?.isManual ? (player?.label || player?.manualPlayerName || '') : (existing?.manualPlayerName || null),
      minutesPlayed: String(source?.minutesPlayed ?? 0),
      // Ce que le joueur a envoyé : la ligne dit « repris de sa réponse » tant qu'elle
      // les garde.
      responseFigures: hasSentFigures ? player.suggestedStats : null,
      userDocumentId: player?.documentId || existing?.userDocumentId || null,
    });

    fields.forEach((field) => {
      baseLine[field.key] = String(payload?.[field.key] ?? 0);
    });

    if (normalizeSport(sport) === 'football') {
      baseLine.cleanSheet = Boolean(payload?.cleanSheet);
    }

    return baseLine;
  });
};

const serializeLine = (/** @type {MatchStatsLine} */ line, /** @type {any} */ sport) => {
  const serialized = /** @type {MatchStatsLine} */ ({
    manualPlayerName: line?.manualPlayerName || undefined,
    minutesPlayed: Number.parseInt(String(line?.minutesPlayed || '0'), 10) || 0,
    userDocumentId: line?.userDocumentId || undefined,
  });

  getFieldConfig(sport).forEach((field) => {
    serialized[field.key] = Number.parseInt(String(line?.[field.key] || '0'), 10) || 0;
  });

  if (normalizeSport(sport) === 'football') {
    serialized.cleanSheet = Boolean(line?.cleanSheet);
  }

  return serialized;
};

const buildInitialCoachReviews = (/** @type {any[]} */ players, /** @type {any} */ report) => {
  const existingReviews = Array.isArray(report?.coachPlayerReviews) ? report.coachPlayerReviews : [];
  const existingReviewMap = new Map(
    existingReviews.map((/** @type {any} */ review) => [
      review?.userDocumentId || review?.manualPlayerName || review?.label,
      review,
    ]),
  );

  return (Array.isArray(players) ? players : []).map((/** @type {any} */ player) => {
    const reviewKey = player?.documentId || player?.manualPlayerName || player?.label;
    const existing = existingReviewMap.get(reviewKey) || null;
    return {
      comment: existing?.comment || '',
      key: reviewKey,
      label: player?.label || i18next.t('matchStatsEditor.player', 'Joueur'),
      lineKey: getLineKey(player),
      rating: existing?.rating ?? null,
      userDocumentId: player?.documentId || null,
    };
  });
};

const serializeCoachReview = (/** @type {any} */ review) => {
  if (!review?.comment && (review?.rating === null || review?.rating === undefined)) return null;
  return {
    comment: String(review?.comment || '').trim() || null,
    rating: review?.rating ?? null,
    userDocumentId: review?.userDocumentId || undefined,
  };
};

const getNumericStatValue = (/** @type {any} */ value) => Number.parseInt(String(value || '0'), 10) || 0;

const getNullableNumericStatValue = (/** @type {any} */ value) => {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, parsed);
};

const clampNumericInput = (/** @type {any} */ value, max = MAX_STAT_VALUE) => {
  const sanitized = sanitizeNumericInput(value);
  if (!sanitized) return '';
  const parsed = Number.parseInt(sanitized, 10) || 0;
  return String(Math.max(0, Math.min(max, parsed)));
};

const getApiErrorMessage = (/** @type {any} */ error, /** @type {string} */ fallbackMessage) => (
  error?.response?.data?.error?.message
  || error?.response?.data?.message
  || error?.message
  || fallbackMessage
);

/**
 * « le 1 oct. à 22:39 ».
 * @param {string | null | undefined} iso - Une date ISO.
 * @returns {{ date: string, time: string } | null} Le jour et l'heure, ou rien.
 */
const lireLeMoment = (iso) => {
  if (!iso) return null;
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return null;
  return {
    date: instant.toLocaleDateString(localeDesFormats(), { day: 'numeric', month: 'short' }),
    time: instant.toLocaleTimeString(localeDesFormats(), { hour: '2-digit', minute: '2-digit' }),
  };
};

/**
 * « sam. 5 sept. ».
 * @param {string | null | undefined} iso - Une date ISO.
 * @returns {string} Le jour, ou rien.
 */
const lireLeJour = (iso) => {
  if (!iso) return '';
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return '';
  return instant.toLocaleDateString(localeDesFormats(), {
    day: 'numeric', month: 'short', weekday: 'short',
  });
};

const ONGLETS = /** @type {const} */ (['score', 'players', 'feedback']);

// ==========================================================================
// 📐 ST-MATCH10 — LA FEUILLE DE MATCH DE L'ENTRAÎNEUR (écran 10 du design des
// statistiques validé le 02/10 ; planches P3-editeur-tel et P3-editeur-ordi).
//
// Avant : onze blocs empilés sur plusieurs milliers de points (60 compteurs pour 15
// joueurs de football), « Publier » tout en bas, l'incohérence dite trois fois.
// Maintenant :
//   · au TÉLÉPHONE, trois onglets « Score et bilan · Joueurs · Retours » ;
//   · sur ORDINATEUR (≥ 1 024 points), les trois côte à côte ; un joueur ouvert
//     prend la place de deux colonnes (le tableau à gauche, son panneau à droite) ;
//   · une ligne par joueur, et le détail dans SA feuille ;
//   · une barre d'action collante, une seule alerte qui nomme le joueur, une
//     confirmation à deux boutons qui dit qui recevra quoi.
// 🔒 L'état SECU-STATS est la base : l'écran est réservé à l'encadrement (le joueur
// n'y entre plus, le serveur refuse le dirigeant qui n'entraîne pas).
// ==========================================================================

/**
 * @param {{ navigation: any; route: any }} props
 */
function MatchStatsEditor({ navigation, route }) {
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const SpacesAny = /** @type {any} */ (Spaces);
  const surfaces = useSurfacesFeuille();
  const { userData } = useAuth();
  const ordinateur = useIsDesktop();
  const { sceneBottomInset } = useBottomDockLayout();
  const queryClient = useQueryClient();
  const sourceType = route?.params?.sourceType === 'league' ? 'league' : 'event';
  const eventId = route?.params?.eventId || null;
  const matchId = route?.params?.matchId || null;
  const requestedTeamId = route?.params?.teamId || null;
  const hydratedReportKeyRef = useRef(/** @type {string | null} */ (null));

  const eventStatsQuery = useGetEventMatchStats(eventId || '', requestedTeamId || undefined, {
    enabled: Boolean(sourceType === 'event' && eventId),
  });

  const leagueStatsQuery = useGetLeagueMatchStats(matchId || '', requestedTeamId || undefined, {
    enabled: Boolean(sourceType === 'league' && matchId),
  });

  const statsQuery = sourceType === 'event' ? eventStatsQuery : leagueStatsQuery;
  const statsPayload = /** @type {any} */ (statsQuery.data || null);
  const sport = normalizeSport(statsPayload?.sport || route?.params?.sport || 'football');
  const isScoreLocked = Boolean(statsPayload?.score?.locked);
  const isWaitingOfficial = Boolean(statsPayload?.score?.waitingOfficial);
  const reportStatus = statsPayload?.report?.status || 'draft';
  const isFinalized = reportStatus === 'final';
  const isReviewRequired = Boolean(statsPayload?.report?.needsReview);
  // « Modifier » rouvre une feuille publiée (états 8 et 3 ordinateur) ; la republier
  // prévient les joueurs. Tant qu'on ne republie pas, rien ne change côté serveur.
  const [isEditingPublished, setIsEditingPublished] = useState(false);
  const isReadOnly = isFinalized && !isReviewRequired && !isEditingPublished;
  const teamName = statsPayload?.team?.name || route?.params?.teamName || '';
  const excludedNoShowPlayers = useMemo(
    () => (Array.isArray(statsPayload?.excludedNoShowPlayers) ? statsPayload.excludedNoShowPlayers : []),
    [statsPayload?.excludedNoShowPlayers],
  );

  const [scoreFor, setScoreFor] = useState('');
  const [scoreAgainst, setScoreAgainst] = useState('');
  const [playerLines, setPlayerLines] = useState(/** @type {MatchStatsLine[]} */ ([]));
  const [collectiveRating, setCollectiveRating] = useState(/** @type {number | null} */ (null));
  const [collectiveComment, setCollectiveComment] = useState('');
  const [coachReviews, setCoachReviews] = useState(/** @type {any[]} */ ([]));
  const [activeTab, setActiveTab] = useState(/** @type {typeof ONGLETS[number]} */ ('score'));
  const [openLineKey, setOpenLineKey] = useState(/** @type {string | null} */ (null));
  const [isConfirming, setIsConfirming] = useState(false);

  const hydrate = useCallback((/** @type {any} */ payload) => {
    setScoreFor(
      payload?.score?.scoreFor === null || payload?.score?.scoreFor === undefined
        ? ''
        : String(payload.score.scoreFor),
    );
    setScoreAgainst(
      payload?.score?.scoreAgainst === null || payload?.score?.scoreAgainst === undefined
        ? ''
        : String(payload.score.scoreAgainst),
    );
    setPlayerLines(buildInitialLines(
      payload?.availablePlayers,
      payload?.report,
      sport,
      payload?.playerResponses,
    ));
    setCollectiveRating(payload?.report?.collectiveRating ?? null);
    setCollectiveComment(payload?.report?.collectiveComment || '');
    setCoachReviews(buildInitialCoachReviews(payload?.availablePlayers, payload?.report));
  }, [sport]);

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
    hydrate(statsPayload);
  }, [hydrate, requestedTeamId, statsPayload]);

  // Les réponses des joueurs : LE compte, le même que la carte « Après le match »
  // (défaut 19).
  const responseItems = useMemo(
    () => (Array.isArray(statsPayload?.playerResponses) ? statsPayload.playerResponses : []),
    [statsPayload?.playerResponses],
  );
  const responsesByPlayer = useMemo(
    () => new Map(responseItems.map((/** @type {any} */ item) => [item?.userDocumentId, item])),
    [responseItems],
  );
  const responseEligibleCount = responseItems.length;
  const responseCompletionCount = useMemo(
    () => responseItems.filter((/** @type {any} */ item) => item?.status === 'submitted').length,
    [responseItems],
  );

  const remindResponsesMutation = useMutation({
    mutationFn: () => remindEventMatchResponses(
      eventId || '',
      statsPayload?.team?.documentId || requestedTeamId,
    ),
    onError: (/** @type {any} */ error) => {
      Alert.alert(t(
        'common.error',
        'Erreur',
      ), getApiErrorMessage(error, t(
        'matchStatsEditor.reminderSendError',
        "Impossible d'envoyer la relance.",
      )));
    },
    onSuccess: (/** @type {any} */ result) => {
      const remindedCount = Number(result?.remindedCount || 0);
      // 🔁 ST-VUES2 (02/10) — la relance est idempotente PAR JOUR côté serveur : au 2e appui le
      // même jour, personne n'est relancé et le serveur le dit (`alreadyRemindedCount`). Dire
      // « aucune relance nécessaire » serait faux : il en manque toujours.
      if (remindedCount === 0 && Number(result?.alreadyRemindedCount || 0) > 0) {
        Alert.alert(t('stMatch.relance.alreadyToday', 'Déjà relancés aujourd’hui'));
        return;
      }
      Alert.alert(
        t('matchStatsEditor.reminderSent', 'Relance envoyée'),
        remindedCount > 0
          ? t(
            'matchStatsEditor.playersReminded',
            '{{remindedCount}} joueur·se·s relancé·e·s pour leur retour post-match.',
            { remindedCount, ...SANS_ECHAPPEMENT },
          )
          : t('matchStatsEditor.noReminderNeeded', 'Aucune relance nécessaire pour ce match.'),
      );
    },
  });

  // 📐 L'ALERTE UNIQUE (état 6) : chaque incohérence dite une fois, le joueur nommé.
  const corrections = useMemo(() => corrigerLaFeuille({
    lignes: playerLines,
    scoreAdverse: scoreAgainst,
    scorePour: scoreFor,
    sport,
    t,
  }), [playerLines, scoreAgainst, scoreFor, sport, t]);
  const hasConsistencyIssues = corrections.length > 0;
  const linesToCheck = useMemo(
    () => new Set(corrections.flatMap((correction) => correction.lignes)),
    [corrections],
  );

  const hasScore = useMemo(
    () => scoreFor.trim() !== '' && scoreAgainst.trim() !== '',
    [scoreAgainst, scoreFor],
  );

  // 📐 ST-MATCH10-BIS (point 1) — « AS Montrivage — Test-COMPO » : le serveur nomme
  // l'adversaire (`event.opponentName`, `null` s'il est inconnu) et le club de l'équipe. Un
  // serveur d'avant ne rend pas le champ : le nom de l'événement reste.
  const opponentName = statsPayload?.event?.opponentName || '';
  const serverNamesOpponent = sourceType === 'event'
    && Object.prototype.hasOwnProperty.call(statsPayload?.event || {}, 'opponentName');
  const ourSide = statsPayload?.team?.clubName || teamName;
  let matchLabel = statsPayload?.event?.name || '';
  if (sourceType === 'league') {
    matchLabel = route?.params?.matchLabel || '';
  } else if (serverNamesOpponent && ourSide) {
    matchLabel = [
      ourSide,
      opponentName || t('stMatch.feuille.opponentUnknown', 'adversaire à confirmer'),
    ].join(' — ');
  }

  // H9 — UNE SEULE LISTE DE CLES, PARTAGEE AVEC L ECRAN JOUEUR.
  // Cet ecran tenait sa propre liste, `PlayerMatchResponseScreen` la sienne, et
  // les deux avaient derive : celle-ci oubliait `eventMyMatchResponse`. Le motif
  // du lot INSTANT (`invalidateAfterAction`) existait deja — on le REUTILISE
  // plutot que d entretenir un troisieme mecanisme.
  const invalidateRelatedQueries = useCallback(
    () => invalidateAfterAction(queryClient, 'submitMatchStats'),
    [queryClient],
  );

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

  // 🧨 ST-MATCH10 — LE SCORE CORRIGÉ DANS LA FEUILLE ÉTAIT PERDU. Le serveur n'écrit le
  // score reçu avec la feuille que s'il n'en a encore AUCUN (`saveEventMatchStatsDraft` :
  // `if (!scoreState.available …)`) : une fois le score saisi (écran 9), les compteurs de
  // la feuille ne changeaient plus rien, et une feuille corrigée de 2 - 1 à 3 - 1 se
  // faisait refuser « 3 buts pour un score de 2 ». Un score changé passe donc d'abord par
  // la route du score (`PUT /events/:id/match-result`, celle de l'écran 9).
  const saveScoreIfChanged = useCallback(async () => {
    const savedScore = statsPayload?.score;
    if (sourceType !== 'event' || !eventId || !hasScore || isScoreLocked) return;
    if (!savedScore?.available) return;
    const nextFor = Number.parseInt(scoreFor, 10);
    const nextAgainst = Number.parseInt(scoreAgainst, 10);
    const isUnchanged = nextFor === Number(savedScore.scoreFor)
      && nextAgainst === Number(savedScore.scoreAgainst);
    if (isUnchanged) return;
    await saveEventMatchResult(eventId, {
      scoreAgainst: nextAgainst,
      scoreFor: nextFor,
      teamId: statsPayload?.team?.documentId || requestedTeamId || undefined,
    });
  }, [
    eventId, hasScore, isScoreLocked, requestedTeamId, scoreAgainst, scoreFor, sourceType,
    statsPayload?.score, statsPayload?.team?.documentId,
  ]);

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
    mutationFn: async () => {
      await saveScoreIfChanged();
      const payload = buildPayload();
      if (sourceType === 'event') {
        return saveEventMatchStatsDraft(eventId, payload);
      }
      return saveLeagueMatchStatsDraft(matchId, payload);
    },
    onError: (error) => {
      Alert.alert(t('common.error', 'Erreur'), getApiErrorMessage(error, t(
        'stMatch.feuille.draftError',
        'Le brouillon n’a pas pu être enregistré. Réessaie.',
      )));
    },
    onSuccess: async () => {
      await invalidateRelatedQueries();
      await statsQuery.refetch();
      Alert.alert(
        t('stMatch.feuille.draftSaved', 'Brouillon enregistré'),
        t(
          'stMatch.feuille.draftSavedBody',
          'Les joueurs ne voient rien tant que tu ne publies pas.',
        ),
      );
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      await saveScoreIfChanged();
      const payload = buildPayload();
      if (sourceType === 'event') {
        return submitEventMatchStats(eventId, payload);
      }
      return submitLeagueMatchStats(matchId, payload);
    },
    onError: (error) => {
      setIsConfirming(false);
      Alert.alert(t(
        'common.error',
        'Erreur',
      ), getApiErrorMessage(error, t(
        'stMatch.feuille.publishError',
        'La feuille n’a pas pu être publiée. Réessaie.',
      )));
    },
    onSuccess: async () => {
      setIsConfirming(false);
      setIsEditingPublished(false);
      await invalidateRelatedQueries();
      Alert.alert(
        t('stMatch.gerer.published', 'Feuille publiée'),
        isReviewRequired
          ? t(
            'matchStatsEditor.reportUpdatedAfterSync',
            'Le rapport a été mis à jour après la synchronisation du score officiel.',
          )
          : t(
            'matchStatsEditor.statsNowFinalised',
            'Les statistiques du match sont maintenant finalisées.',
          ),
        [{ onPress: redirectToReviewScreen, text: 'OK' }],
      );
    },
  });

  const updateLineValue = useCallback((/** @type {string} */ lineKey, /** @type {string} */ field, /** @type {any} */ value) => {
    setPlayerLines((current) => current.map((line) => (line.key === lineKey
      ? { ...line, [field]: value }
      : line)));
  }, []);

  const updateCoachReview = useCallback((/** @type {string} */ reviewKey, /** @type {string} */ field, /** @type {any} */ value) => {
    setCoachReviews((current) => current.map((review) => (review.key === reviewKey
      ? { ...review, [field]: value }
      : review)));
  }, []);

  const getLineFieldMaxValue = useCallback((/** @type {MatchStatsLine[]} */ currentLines, /** @type {string} */ lineKey, /** @type {string} */ field) => {
    const lines = Array.isArray(currentLines) ? currentLines : [];
    const currentLine = lines.find((/** @type {MatchStatsLine} */ line) => line.key === lineKey) || null;
    const otherLines = lines.filter((/** @type {MatchStatsLine} */ line) => line.key !== lineKey);
    const resolvedScoreFor = getNullableNumericStatValue(scoreFor);
    const resolvedScoreAgainst = getNullableNumericStatValue(scoreAgainst);

    if (normalizeSport(sport) === 'basketball') {
      if (field === 'points') {
        if (resolvedScoreFor === null) return MAX_STAT_VALUE;
        const otherPoints = otherLines.reduce(
          (/** @type {number} */ accumulator, /** @type {MatchStatsLine} */ line) => accumulator + getNumericStatValue(line?.points),
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
          (/** @type {number} */ accumulator, /** @type {MatchStatsLine} */ line) => accumulator + (getNumericStatValue(line?.threePointsMade) * 3),
          0,
        );
        const maxByScore = Math.floor(Math.max(0, resolvedScoreFor - otherThreePointPoints) / 3);
        return Math.max(0, Math.min(maxByLinePoints, maxByScore));
      }

      return getMatchStatsFieldMax(field);
    }

    if (field === 'goals') {
      if (resolvedScoreFor === null) return MAX_STAT_VALUE;
      const otherGoals = otherLines.reduce(
        (/** @type {number} */ accumulator, /** @type {MatchStatsLine} */ line) => accumulator + getNumericStatValue(line?.goals),
        0,
      );
      return Math.max(0, resolvedScoreFor - otherGoals);
    }

    if (field === 'assists') {
      const totalGoals = lines.reduce(
        (/** @type {number} */ accumulator, /** @type {MatchStatsLine} */ line) => accumulator + getNumericStatValue(line?.goals),
        0,
      );
      const assistsWithoutCurrent = otherLines.reduce(
        (/** @type {number} */ accumulator, /** @type {MatchStatsLine} */ line) => accumulator + getNumericStatValue(line?.assists),
        0,
      );
      const maxByGoals = Math.max(0, totalGoals - assistsWithoutCurrent);
      if (resolvedScoreFor === null) return maxByGoals;
      return Math.max(0, Math.min(maxByGoals, resolvedScoreFor - assistsWithoutCurrent));
    }

    if (field === 'goalsConceded') {
      if (resolvedScoreAgainst === null) return MAX_STAT_VALUE;
      return resolvedScoreAgainst;
    }

    // H6 — le filet de dernier recours rendait 999 pour TOUT, minutes comprises :
    // 999 minutes pour un match de 90 etaient publiables. Le serveur les REFUSE
    // desormais, donc la borne affichee doit etre la MEME que la sienne.
    return getMatchStatsFieldMax(field);
  }, [scoreAgainst, scoreFor, sport]);

  const updateLineNumericValue = useCallback((/** @type {string} */ lineKey, /** @type {string} */ field, /** @type {any} */ value) => {
    setPlayerLines((current) => current.map((line) => {
      if (line.key !== lineKey) return line;
      const maxValue = getLineFieldMaxValue(current, lineKey, field);
      return {
        ...line,
        [field]: clampNumericInput(value, maxValue),
      };
    }));
  }, [getLineFieldMaxValue]);

  const adjustLineValue = useCallback((/** @type {string} */ lineKey, /** @type {string} */ field, /** @type {number} */ delta) => {
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

  const adjustScoreValue = useCallback((/** @type {string} */ field, /** @type {number} */ delta) => {
    const setter = field === 'scoreFor' ? setScoreFor : setScoreAgainst;
    setter((current) => shiftNumericStringValue(current, delta));
  }, []);

  // H6 — la frappe au clavier n avait AUCUN plafond : `999999999 - 0` etait
  // accepte, envoye, et ecrit en base. Le serveur le REFUSE desormais ; la
  // saisie doit donc s arreter a la meme borne, sinon on remplit tout le
  // formulaire pour se prendre un refus a l envoi.
  const updateScoreFor = useCallback((/** @type {string} */ value) => {
    setScoreFor(clampMatchStatsValue(value, MAX_MATCH_SCORE));
  }, []);

  const updateScoreAgainst = useCallback((/** @type {string} */ value) => {
    setScoreAgainst(clampMatchStatsValue(value, MAX_MATCH_SCORE));
  }, []);

  const alertMissingScore = useCallback((/** @type {string} */ message) => {
    setActiveTab('score');
    Alert.alert(t('stMatch.feuille.scoreMissing', 'Score manquant'), message);
  }, [t]);

  const handleSaveDraft = useCallback(() => {
    if (sourceType === 'event' && !hasScore && !isScoreLocked) {
      alertMissingScore(t(
        'stMatch.feuille.scoreMissingDraft',
        'Saisis le score du match avant d’enregistrer le brouillon.',
      ));
      return;
    }
    // L'alerte unique est déjà affichée : le bouton est éteint, rien de plus à dire.
    if (hasConsistencyIssues) return;
    saveDraftMutation.mutate();
  }, [
    alertMissingScore, hasConsistencyIssues, hasScore, isScoreLocked, saveDraftMutation, sourceType, t,
  ]);

  const handleSubmit = useCallback(() => {
    if (sourceType === 'event' && !hasScore) {
      alertMissingScore(t(
        'stMatch.feuille.scoreMissingPublish',
        'Saisis le score du match avant de publier la feuille.',
      ));
      return;
    }
    if (hasConsistencyIssues) return;
    // 📐 État 7 — plus de fenêtre du système (`window.confirm` sur le site) : une fenêtre
    // de la feuille, à deux boutons, qui dit qui recevra quoi.
    setIsConfirming(true);
  }, [alertMissingScore, hasConsistencyIssues, hasScore, sourceType, t]);

  const cancelEditing = useCallback(() => {
    setIsEditingPublished(false);
    setOpenLineKey(null);
    if (statsPayload) hydrate(statsPayload);
  }, [hydrate, statsPayload]);

  // ── Ce que l'écran dit ──
  const isLoading = Boolean(statsQuery.isLoading);
  const hasError = Boolean(statsQuery.error) && !isLoading;
  const isReady = !isLoading && !hasError && Boolean(statsPayload);
  const responsesLine = responseEligibleCount > 0
    ? direLeCompte(responseCompletionCount, responseEligibleCount, t)
    : '';
  const metaLine = [teamName, responsesLine].filter(Boolean).join(' · ');
  // Ordinateur (planche P3-editeur-ordi) : « le match · l'équipe · le jour », sous le titre.
  const matchDay = lireLeJour(statsPayload?.event?.date);
  const desktopSubtitle = [matchLabel, teamName, matchDay].filter(Boolean).join(' · ');
  const publishedAt = lireLeMoment(statsPayload?.report?.finalizedAt);
  const firstNameOf = (/** @type {any} */ line) => String(
    line?.firstname || String(line?.label || '').split(' ')[0] || '',
  ).trim();

  /** @type {{ texte: string, ton: 'primary' | 'success' | 'warning' } | null} */
  let statusPill = null;
  if (isReady) {
    if (isReviewRequired) {
      statusPill = { texte: t('stMatch.feuille.statusReview', 'À vérifier'), ton: 'warning' };
    } else if (isFinalized) {
      statusPill = {
        texte: publishedAt
          ? t('stMatch.feuille.statusPublishedOn', 'Publiée le {{date}} à {{time}}', {
            ...publishedAt, ...SANS_ECHAPPEMENT,
          })
          : t('stMatch.carte.sheetPublished', 'Publiée'),
        ton: 'success',
      };
    } else if (isWaitingOfficial) {
      statusPill = {
        texte: t('stMatch.feuille.statusWaitingOfficial', 'Score officiel attendu'),
        ton: 'warning',
      };
    } else {
      statusPill = { texte: t('stMatch.feuille.statusDraft', 'Brouillon'), ton: 'primary' };
    }
  }
  const pillColors = {
    primary: Colors.primary500,
    success: Colors.success500,
    warning: Colors.warning500,
  };
  const renderPill = () => (statusPill ? (
    <View
      style={[
        SpacesAny.paddingHorizontal[12],
        SpacesAny.paddingVertical[4],
        {
          backgroundColor: withAlpha(pillColors[statusPill.ton], 0.16),
          borderColor: withAlpha(pillColors[statusPill.ton], 0.45),
          borderRadius: 999,
          borderWidth: 1,
        },
      ]}
    >
      <Text
        style={[
          Fonts.p4Bold,
          statusPill.ton === 'primary' ? Fonts.primary200 : { color: pillColors[statusPill.ton] },
        ]}
      >
        {statusPill.texte}
      </Text>
    </View>
  ) : null);

  // Ton retour : qui le recevra à la publication (état 7), qui l'a reçu (état 8).
  const receivers = coachReviews
    .filter((review) => Boolean(String(review?.comment || '').trim())
      || (review?.rating !== null && review?.rating !== undefined))
    .map((review) => firstNameOf(
      playerLines.find((line) => line.key === review.lineKey) || review,
    ));

  // « moyenne B » (Adel, 02/10) : sous 3 réponses, la moyenne des joueurs EST la note d'un
  // coéquipier ; elle reste cachée, pour l'entraîneur aussi (même seuil que la carte).
  const playersAverage = statsPayload?.playerCollectiveRating || null;
  const isAverageVisible = playersAverage?.average !== null && playersAverage?.average !== undefined
    && !playersAverage?.hidden
    && Number(playersAverage?.count) >= MOYENNE_MIN_REPONSES;

  // ── Les libellés de la barre d'action (repris par l'alerte unique) ──
  const republish = isReviewRequired || isEditingPublished;
  const showsDraftButton = !isReviewRequired && !isEditingPublished;
  let publishLabel = ordinateur
    ? t('stMatch.feuille.publishLong', 'Publier la feuille')
    : t('stMatch.feuille.publish', 'Publier');
  if (republish) publishLabel = t('stMatch.feuille.republish', 'Republier');
  const draftLabel = ordinateur
    ? t('stMatch.feuille.saveDraftLong', 'Enregistrer le brouillon')
    : t('stMatch.feuille.saveDraft', 'Brouillon');
  // 📐 ST-MATCH10-BIS (point 4, « brouillon A », tranché par le chef) : le serveur refuse un
  // brouillon incohérent (`assertMatchStatsConsistency`) ; « Brouillon » s'éteint donc avec
  // « Publier », et l'alerte unique le DIT (un bouton éteint sans raison est un bouton cassé).
  const waitsForFixLine = showsDraftButton
    ? t('stMatch.feuille.waitsForFixBoth', '« {{draft}} » et « {{publish}} » attendent la correction.', {
      draft: draftLabel, publish: publishLabel, ...SANS_ECHAPPEMENT,
    })
    : t('stMatch.feuille.waitsForFixOne', '« {{publish}} » attend la correction.', {
      publish: publishLabel, ...SANS_ECHAPPEMENT,
    });

  // ── Les alertes, en haut, une de chaque au plus ──
  const savedReportScore = statsPayload?.report
    && Number.isFinite(Number(statsPayload.report.scoreFor))
    && statsPayload.report.scoreFor !== null
    ? `${statsPayload.report.scoreFor} - ${statsPayload.report.scoreAgainst}`
    : '';
  const officialScore = statsPayload?.score?.available
    ? `${statsPayload.score.scoreFor} - ${statsPayload.score.scoreAgainst}`
    : '';
  const renderAlerts = () => (
    <>
      {isReviewRequired ? (
        <AlerteFeuille
          lignes={[officialScore && savedReportScore && officialScore !== savedReportScore
            ? t(
              'stMatch.feuille.reviewChanged',
              // eslint-disable-next-line max-len
              '{{official}} au lieu de {{sheet}}. Vérifie les buts de chaque joueur, puis republie.',
              { official: officialScore, sheet: savedReportScore, ...SANS_ECHAPPEMENT },
            )
            : t(
              'stMatch.rappel.reviewGeneric',
              'Le score officiel ne correspond plus à ta feuille. Vérifie les buts, puis republie.',
            )]}
          titre={t('stMatch.rappel.reviewTitle', 'Le score officiel a changé')}
        />
      ) : null}
      {hasConsistencyIssues && !isReadOnly ? (
        <AlerteFeuille
          lignes={[...corrections.map((correction) => correction.texte), waitsForFixLine]}
          titre={t('stMatch.feuille.corrections', {
            count: corrections.length,
            defaultValue_one: '{{count}} correction',
            defaultValue_other: '{{count}} corrections',
          })}
        />
      ) : null}
    </>
  );

  // ── Onglet 1 : Score et bilan ──
  const scoreSource = statsPayload?.score?.source;
  const scoreAuthorLine = statsPayload?.score?.available
    ? buildMatchEncartLines({
      available: true,
      canManage: true,
      canSeeDetails: true,
      // Seule la ligne « Saisi par … » est lue ici : le reste de l'encart ne sert pas.
      coachFirstname: null,
      isFinished: true,
      locale: localeDesFormats(),
      publishedLines: null,
      recordedAt: statsPayload?.score?.recordedAt || null,
      recordedBy: statsPayload?.score?.recordedBy || null,
      scoreAgainst: statsPayload?.score?.scoreAgainst,
      scoreFor: statsPayload?.score?.scoreFor,
      source: scoreSource,
      startTimeLabel: null,
      t,
      viewerDocumentId: userData?.documentId || null,
      waitingOfficial: isWaitingOfficial,
    }).authorLine
    : null;
  const ourTeam = ourSide || t('stMatch.score.us', 'Mon équipe');
  const theOpponent = opponentName || t('stMatch.score.opponent', 'Adversaire');
  const scoreDisabled = isScoreLocked || isReadOnly;

  const renderScoreAndReview = () => {
    if (isReadOnly) {
      const receivedLine = receivers.length === 1
        ? t('stMatch.feuille.receivedOne', '{{name}} a reçu ton retour.', {
          name: receivers[0], ...SANS_ECHAPPEMENT,
        })
        : t('stMatch.feuille.receivedMany', {
          count: receivers.length,
          defaultValue_one: '{{count}} joueur a reçu ton retour.',
          defaultValue_other: '{{count}} joueurs ont reçu ton retour.',
        });
      const answeredLine = responseEligibleCount > 0
        ? t('stMatch.feuille.responsesSentence', {
          count: responseCompletionCount,
          defaultValue_one: '{{count}} sur {{total}} a répondu.',
          defaultValue_other: '{{count}} sur {{total}} ont répondu.',
          total: responseEligibleCount,
        })
        : '';
      return (
        <BilanPublie
          adversaire={theOpponent}
          equipe={ourTeam}
          etiquetteDuScore={scoreSource === 'external_sync' || scoreSource === 'league_validated'
            ? t('stMatch.encart.officialScore', 'Score officiel')
            : t('stMatch.encart.scoreEntered', 'Score saisi')}
          ligneOk={[receivers.length ? receivedLine : '', answeredLine].filter(Boolean).join(' ')}
          motDuCoach={collectiveComment}
          moyenne={isAverageVisible
            ? {
              libelle: t('stMatch.carte.playersRating', {
                count: Number(playersAverage?.count || 0),
                defaultValue_one: 'Les joueurs · {{count}} note',
                defaultValue_other: 'Les joueurs · {{count}} notes',
              }),
              valeur: `${playersAverage?.average}/10`,
            }
            : {
              libelle: t('stMatch.feuille.playersRatingHidden', 'Les joueurs : dès 3 réponses'),
              valeur: '—',
            }}
          noteEquipe={collectiveRating}
          score={hasScore ? `${scoreFor} - ${scoreAgainst}` : '– –'}
        />
      );
    }
    const isOfficial = scoreSource === 'external_sync' || scoreSource === 'league_validated';
    return (
      <View style={SpacesAny.gap[16]}>
        <View style={[Alignments.row, Alignments.alignEnd, SpacesAny.gap[8]]}>
          <Compteur
            desactive={scoreDisabled}
            descriptionMoins={t('stMatch.score.minus', 'Un but de moins pour {{team}}', {
              team: ourTeam, ...SANS_ECHAPPEMENT,
            })}
            descriptionPlus={t('stMatch.score.plus', 'Un but de plus pour {{team}}', {
              team: ourTeam, ...SANS_ECHAPPEMENT,
            })}
            grand
            libelle={ourTeam}
            onChangeText={updateScoreFor}
            onMoins={() => adjustScoreValue('scoreFor', -1)}
            onPlus={() => adjustScoreValue('scoreFor', 1)}
            valeur={scoreFor}
          />
          <Text style={[Fonts.h3Bold, Fonts.neutral200, { lineHeight: 56 }]}>-</Text>
          <Compteur
            desactive={scoreDisabled}
            descriptionMoins={t('stMatch.score.minus', 'Un but de moins pour {{team}}', {
              team: opponentName || t('stMatch.score.theOpponent', 'l’adversaire'),
              ...SANS_ECHAPPEMENT,
            })}
            descriptionPlus={t('stMatch.score.plus', 'Un but de plus pour {{team}}', {
              team: opponentName || t('stMatch.score.theOpponent', 'l’adversaire'),
              ...SANS_ECHAPPEMENT,
            })}
            grand
            libelle={theOpponent}
            onChangeText={updateScoreAgainst}
            onMoins={() => adjustScoreValue('scoreAgainst', -1)}
            onPlus={() => adjustScoreValue('scoreAgainst', 1)}
            valeur={scoreAgainst}
          />
        </View>
        {scoreAuthorLine && !isOfficial ? (
          <Text style={[Fonts.p3, Fonts.neutral300, Fonts.textCenter]}>{scoreAuthorLine}</Text>
        ) : null}
        {isOfficial ? (
          <View
            style={[Alignments.row, Alignments.alignCenter, Alignments.justifyCenter, SpacesAny.gap[8]]}
          >
            <GlyphIcon color={Colors.warning400} name="lock" size={16} />
            <Text style={[Fonts.p3, Fonts.warning400]}>
              {scoreSource === 'league_validated'
                ? t('stMatch.feuille.leagueLock', 'Score validé par la ligue')
                : t('stMatch.feuille.officialLock', 'Score officiel de la fédération')}
            </Text>
          </View>
        ) : null}
        {isWaitingOfficial && !statsPayload?.score?.available ? (
          <Text style={[Fonts.p3, Fonts.warning400, Fonts.textCenter]}>
            {t(
              'stMatch.encart.federationPending',
              "La fédération n'a pas encore publié le score.",
            )}
          </Text>
        ) : null}
        <View style={SpacesAny.gap[8]}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {t('stMatch.feuille.teamRating', 'Ta note de l’équipe')}
          </Text>
          <NotesSurDix
            libelle={t('stMatch.feuille.teamRating', 'Ta note de l’équipe')}
            onChoisir={setCollectiveRating}
            valeur={collectiveRating}
          />
        </View>
        <View style={SpacesAny.gap[8]}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {t('stMatch.feuille.teamWord', 'Ton mot à l’équipe')}
          </Text>
          <TextInput
            accessibilityLabel={t('stMatch.feuille.teamWord', 'Ton mot à l’équipe')}
            maxLength={1200}
            multiline
            onChangeText={setCollectiveComment}
            placeholder={t(
              'matchStatsEditor.teamCommentPlaceholder',
              'Ressenti collectif, dynamique du groupe, points forts, points à travailler...',
            )}
            placeholderTextColor={Colors.neutral400}
            style={[
              surfaces.champ,
              Fonts.p2,
              Fonts.neutral00,
              SpacesAny.padding[12],
              { minHeight: 96, textAlignVertical: 'top' },
            ]}
            value={collectiveComment}
          />
          <View style={[Alignments.row, Alignments.alignCenter, SpacesAny.gap[8]]}>
            <SvgIcon color={Colors.neutral300} height={14} name="users" width={14} />
            <Text style={[Fonts.p3, Fonts.neutral300, Alignments.fill]}>
              {teamName
                ? t('stMatch.feuille.readByTeam', 'Lu par les joueurs de l’équipe {{team}}.', {
                  team: teamName, ...SANS_ECHAPPEMENT,
                })
                : t('stMatch.feuille.readByTeamUnnamed', 'Lu par les joueurs de l’équipe.')}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  // ── Onglet 2 : Joueurs ──
  const coachRatingByLine = useMemo(
    () => new Map(coachReviews.map((review) => [review.lineKey, review.rating ?? null])),
    [coachReviews],
  );
  const scoredGoals = playerLines
    .reduce((total, line) => total + getNumericStatValue(line?.goals), 0);
  const knownScoreFor = getNullableNumericStatValue(scoreFor);

  const renderPlayers = () => {
    if (!playerLines.length) {
      return (
        <View style={[Alignments.alignCenter, SpacesAny.gap[12], SpacesAny.paddingVertical[24]]}>
          <SvgIcon color={Colors.primary200} height={40} name="users" width={40} />
          <Text style={[Fonts.h4Bold, Fonts.neutral00, Fonts.textCenter]}>
            {t('stMatch.feuille.emptyTitle', 'Aucun joueur sur cette feuille')}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200, Fonts.textCenter]}>
            {sourceType === 'event'
              ? t(
                'stMatch.feuille.emptyText',
                // eslint-disable-next-line max-len
                'Les joueurs viennent de la convocation du match. Publie-la, ou ajoute l’équipe au match.',
              )
              : t(
                'stMatch.feuille.emptyTextLeague',
                'Les joueurs viennent de l’effectif de l’équipe.',
              )}
          </Text>
          {sourceType === 'event' && eventId ? (
            <Button
              onPress={() => navigation.navigate(RouteNames.EventDetails, { eventId })}
              title={t('stMatch.feuille.emptyAction', 'Ouvrir la page du match')}
              variant="Secondary"
            />
          ) : null}
        </View>
      );
    }
    return (
      <View style={SpacesAny.gap[12]}>
        {excludedNoShowPlayers.length ? (
          <View style={[surfaces.encart, SpacesAny.padding[12], SpacesAny.gap[4]]}>
            <Text style={[Fonts.p3Bold, Fonts.warning400]}>
              {t('stMatch.feuille.noShowTitle', 'Non pointés à l’appel')}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {excludedNoShowPlayers
                .map((/** @type {any} */ player) => player?.label || player?.manualPlayerName)
                .filter(Boolean)
                .join(', ')}
            </Text>
            <Text style={[Fonts.p4, Fonts.neutral300]}>
              {t(
                'stMatch.feuille.noShowText',
                'Ils ne comptent pas dans la feuille tant que l’appel n’est pas corrigé.',
              )}
            </Text>
          </View>
        ) : null}
        <TableauDesJoueurs
          aVerifier={linesToCheck}
          lignes={playerLines}
          notesDuCoach={coachRatingByLine}
          onOuvrir={setOpenLineKey}
          ordinateur={ordinateur}
          reponses={responsesByPlayer}
          selection={ordinateur ? openLineKey : null}
          sport={sport}
        />
        <Text style={[Fonts.p3, Fonts.neutral300]}>
          {ordinateur
            ? t('stMatch.feuille.clickHint', 'Clique une ligne pour ses chiffres et ton retour.')
            : t(
              'stMatch.feuille.tapHint',
              'Touche un joueur pour ses chiffres et ton retour individuel.',
            )}
        </Text>
        {sport === 'football' && knownScoreFor !== null && scoredGoals < knownScoreFor ? (
          <View
            style={[
              Alignments.row, Alignments.alignCenter, SpacesAny.gap[8],
              surfaces.encart, SpacesAny.padding[12],
            ]}
          >
            <SvgIcon color={Colors.primary200} height={18} name="soccer-ball" width={18} />
            <Text style={[Fonts.p2, Fonts.neutral200, Alignments.fill]}>
              {[
                t('stMatch.feuille.scorersInfo', {
                  count: scoredGoals,
                  defaultValue_one: '{{count}} but sur {{total}} a un buteur.',
                  defaultValue_other: '{{count}} buts sur {{total}} ont un buteur.',
                  total: knownScoreFor,
                }),
                t('stMatch.feuille.scorersMissing', {
                  count: knownScoreFor - scoredGoals,
                  defaultValue_one: '{{count}} but restera « sans buteur ».',
                  defaultValue_other: '{{count}} buts resteront « sans buteur ».',
                }),
              ].join(' ')}
            </Text>
          </View>
        ) : null}
      </View>
    );
  };

  // ── La feuille d'un joueur (état 4 ; panneau de droite sur ordinateur) ──
  const openLine = openLineKey
    ? playerLines.find((line) => line.key === openLineKey) || null
    : null;
  const openReview = openLine
    ? coachReviews.find((review) => review.lineKey === openLine.key) || null
    : null;
  const openResponse = openLine ? responsesByPlayer.get(openLine.userDocumentId) || null : null;
  const closePlayer = useCallback(() => setOpenLineKey(null), []);
  const renderPlayerSheet = () => (openLine ? (
    <FicheDuJoueur
      lectureSeule={isReadOnly}
      ligne={openLine}
      maximum={(/** @type {string} */ field) => getLineFieldMaxValue(
        playerLines,
        openLine.key,
        field,
      )}
      moment={lireLeMoment(openResponse?.submittedAt)}
      onAjuster={(/** @type {string} */ field, /** @type {number} */ delta) => (
        adjustLineValue(openLine.key, field, delta)
      )}
      onChiffre={(/** @type {string} */ field, /** @type {string} */ value) => (
        updateLineNumericValue(openLine.key, field, value)
      )}
      onCleanSheet={(/** @type {boolean} */ value) => (
        updateLineValue(openLine.key, 'cleanSheet', value)
      )}
      onCommentaire={(/** @type {string} */ value) => (
        openReview && updateCoachReview(openReview.key, 'comment', value)
      )}
      onFermer={closePlayer}
      onNote={(/** @type {number} */ value) => (
        openReview && updateCoachReview(openReview.key, 'rating', value)
      )}
      reponse={openResponse}
      retour={openReview}
      sport={sport}
    />
  ) : null);
  const validateButton = (
    <Button
      onPress={closePlayer}
      title={t('stMatch.feuille.validate', 'Valider')}
      variant="Primary"
    />
  );

  // ── Onglet 3 : Retours ──
  const renderFeedback = () => (
    <BlocRetours
      attendues={responseEligibleCount}
      onRelancer={sourceType === 'event' && eventId ? () => remindResponsesMutation.mutate() : null}
      recues={responseCompletionCount}
      relanceEnCours={remindResponsesMutation.isPending}
      reponses={responseItems}
    />
  );

  const tabLabels = {
    feedback: t('stMatch.feuille.tabFeedback', 'Retours'),
    players: t('stMatch.feuille.tabPlayers', 'Joueurs · {{n}}', { n: playerLines.length }),
    score: t('stMatch.feuille.tabScore', 'Score et bilan'),
  };

  const renderSkeleton = () => (
    <SkeletonLoader isActive wrapperStyle={[SpacesAny.gap[16]]}>
      {[120, 72, 160].map((hauteur) => (
        <View key={hauteur} style={[surfaces.carte, { height: hauteur }]} />
      ))}
    </SkeletonLoader>
  );

  const renderError = () => (
    <View
      accessibilityRole="alert"
      style={[surfaces.carte, SpacesAny.padding[16], SpacesAny.gap[8]]}
    >
      <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
        {t('stMatch.feuille.errorTitle', 'La feuille n’a pas pu être lue.')}
      </Text>
      <Text style={[Fonts.p2, Fonts.neutral200]}>
        {t(
          'stMatch.feuille.errorBody',
          'Vérifie ta connexion, puis réessaie. Ton brouillon est gardé.',
        )}
      </Text>
      <View style={Alignments.selfStart}>
        <Button
          onPress={() => statsQuery.refetch()}
          title={t('stMatch.score.retry', 'Réessayer')}
          variant="Secondary"
        />
      </View>
    </View>
  );

  /**
   * Une colonne de la feuille sur ordinateur.
   * @param {string} testID - Son nom pour les témoins.
   * @param {string} titre - Son titre (celui de l'onglet du téléphone).
   * @param {any} contenu - Ce qu'elle porte.
   * @param {number} [flex] - Sa part de la largeur.
   * @returns {import('react').ReactElement} La colonne.
   */
  const renderColumn = (testID, titre, contenu, flex = 1) => (
    <View
      style={[surfaces.carte, SpacesAny.padding[16], SpacesAny.gap[16], { flex, minWidth: 0 }]}
      testID={testID}
    >
      <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>{titre}</Text>
      {contenu}
    </View>
  );

  const renderDesktopColumns = () => (openLine ? (
    <View style={[Alignments.row, SpacesAny.gap[16], { alignItems: 'flex-start' }]}>
      {renderColumn('feuille-colonne-joueurs', tabLabels.players, renderPlayers(), 3)}
      <View
        style={[surfaces.carte, SpacesAny.padding[16], SpacesAny.gap[16], { flex: 2, minWidth: 0 }]}
        testID="feuille-panneau-joueur"
      >
        {renderPlayerSheet()}
        {validateButton}
      </View>
    </View>
  ) : (
    <View style={[Alignments.row, SpacesAny.gap[16], { alignItems: 'flex-start' }]}>
      {renderColumn('feuille-colonne-score', tabLabels.score, renderScoreAndReview())}
      {/* Le tableau porte 5 colonnes de chiffres : un peu plus large que ses voisines. */}
      {renderColumn('feuille-colonne-joueurs', tabLabels.players, renderPlayers(), 1.4)}
      {renderColumn('feuille-colonne-retours', tabLabels.feedback, renderFeedback())}
    </View>
  ));

  const renderPhoneTab = () => {
    if (activeTab === 'players') return renderPlayers();
    if (activeTab === 'feedback') return renderFeedback();
    return renderScoreAndReview();
  };

  // ── La barre d'action collante (amélioration 4) ──
  const isBusy = saveDraftMutation.isPending || submitMutation.isPending;
  let actions = null;
  if (isReady) {
    if (isReadOnly) {
      actions = (
        <Button
          icon="edit"
          onPress={() => setIsEditingPublished(true)}
          title={t('stMatch.feuille.edit', 'Modifier')}
          variant="Secondary"
        />
      );
    } else {
      const publishButton = (
        <View style={Alignments.fill}>
          <Button
            disabled={hasConsistencyIssues || isBusy}
            isLoading={submitMutation.isPending}
            onPress={handleSubmit}
            title={publishLabel}
            variant="Primary"
          />
        </View>
      );
      let secondButton = null;
      if (isEditingPublished && !isReviewRequired) {
        secondButton = (
          <View style={Alignments.fill}>
            <Button
              onPress={cancelEditing}
              title={t('matchStatsEditor.cancel', 'Annuler')}
              variant="Secondary"
            />
          </View>
        );
      } else if (showsDraftButton) {
        secondButton = (
          <View style={Alignments.fill}>
            <Button
              disabled={hasConsistencyIssues || isBusy}
              isLoading={saveDraftMutation.isPending}
              onPress={handleSaveDraft}
              title={draftLabel}
              variant="Secondary"
            />
          </View>
        );
      }
      actions = (
        <>
          {secondButton}
          {publishButton}
        </>
      );
    }
  }

  // ── La confirmation à deux boutons (état 7) ──
  // 📐 ST-MATCH10-BIS (point 2) — qui est prévenu de quoi : le parent d'un mineur reçoit SON
  // retour (`sendCoachFeedbackToParents`, ST-RETOURS). L'éditeur ne connaît pas l'âge : la
  // phrase dit « s'il est mineur », comme la fiche du joueur (phrase A, tranchée par le chef).
  let receiversSentence = '';
  if (receivers.length === 1) {
    receiversSentence = t(
      'stMatch.feuille.confirmReceiverOne',
      '{{name}} et, s’il est mineur, ses parents recevront ton retour individuel.',
      { name: receivers[0], ...SANS_ECHAPPEMENT },
    );
  } else if (receivers.length > 1) {
    receiversSentence = t('stMatch.feuille.confirmReceiversMany', {
      count: receivers.length,
      // eslint-disable-next-line max-len
      defaultValue_one: '{{count}} joueur recevra ton retour individuel ; s’il est mineur, ses parents aussi.',
      // eslint-disable-next-line max-len
      defaultValue_other: '{{names}} recevront leur retour individuel ; pour un mineur, ses parents aussi.',
      names: joindreLesNoms(receivers, t),
      ...SANS_ECHAPPEMENT,
    });
  }
  const confirmationText = [
    receiversSentence,
    teamName
      ? t(
        'stMatch.feuille.confirmTeam',
        'Les joueurs de l’équipe {{team}} verront le score, ta note de l’équipe et ton mot.',
        { team: teamName, ...SANS_ECHAPPEMENT },
      )
      : t(
        'stMatch.feuille.confirmTeamUnnamed',
        'Les joueurs de l’équipe verront le score, ta note de l’équipe et ton mot.',
      ),
    t('stMatch.feuille.confirmEditable', 'Tu pourras la modifier et la republier.'),
  ].filter(Boolean).join(' ');

  return (
    <ScreenContainer
      bgImage="bg2"
      boundedHeight
      contentContainerStyle={[SpacesAny.paddingTop[0], SpacesAny.paddingBottom[0], Alignments.fill]}
    >
      <View
        style={[
          Alignments.row, Alignments.alignCenter, SpacesAny.gap[8],
          SpacesAny.paddingHorizontal[16], SpacesAny.paddingTop[8],
        ]}
      >
        <HeaderBackButton onPress={() => navigation.goBack()} withDefaultMargin={false} />
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          style={[
            ordinateur ? Fonts.h2Bold : Fonts.h4Bold,
            Fonts.neutral00,
            Alignments.fill,
            ordinateur ? null : Fonts.textCenter,
          ]}
        >
          {t('stMatch.feuille.title', 'Feuille de match')}
        </Text>
        {ordinateur ? renderPill() : <View style={{ width: 44 }} />}
      </View>

      <View
        style={[
          ordinateur ? null : Alignments.alignCenter,
          SpacesAny.gap[8],
          SpacesAny.paddingHorizontal[16],
          SpacesAny.paddingTop[8],
        ]}
      >
        {ordinateur && desktopSubtitle ? (
          <Text numberOfLines={2} style={[Fonts.p2, Fonts.neutral200]}>{desktopSubtitle}</Text>
        ) : null}
        {!ordinateur && matchLabel ? (
          <Text numberOfLines={2} style={[Fonts.p2Bold, Fonts.neutral00, Fonts.textCenter]}>
            {matchLabel}
          </Text>
        ) : null}
        {!ordinateur && isReady ? (
          <View
            style={[
              Alignments.row, Alignments.alignCenter, Alignments.wrap, SpacesAny.gap[8],
              Alignments.justifyCenter,
            ]}
          >
            {renderPill()}
            {metaLine ? <Text style={[Fonts.p3, Fonts.neutral300]}>{metaLine}</Text> : null}
          </View>
        ) : null}
      </View>

      {!ordinateur && !hasError ? (
        <View style={[SpacesAny.paddingHorizontal[16], SpacesAny.paddingTop[8]]}>
          <SegmentedControl
            centerContent
            fitLabels
            onChange={(/** @type {any} */ value) => setActiveTab(value)}
            options={ONGLETS.map((value) => ({ label: tabLabels[value], value }))}
            value={activeTab}
          />
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={[SpacesAny.padding[16], SpacesAny.gap[16]]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={Alignments.fill}
      >
        {isLoading ? renderSkeleton() : null}
        {hasError ? renderError() : null}
        {isReady ? (
          <>
            {renderAlerts()}
            {ordinateur ? renderDesktopColumns() : renderPhoneTab()}
          </>
        ) : null}
      </ScrollView>

      {actions ? (
        <View
          style={[
            Alignments.row,
            SpacesAny.gap[12],
            SpacesAny.paddingHorizontal[16],
            SpacesAny.paddingTop[12],
            {
              alignSelf: ordinateur ? 'flex-end' : 'stretch',
              borderTopColor: withAlpha(Colors.neutral300, 0.18),
              borderTopWidth: ordinateur ? 0 : 1,
              minWidth: ordinateur ? 420 : undefined,
              paddingBottom: Math.max(sceneBottomInset, 12),
            },
          ]}
          testID="feuille-barre"
        >
          {actions}
        </View>
      ) : null}

      {!ordinateur ? (
        <BottomModal
          close={closePlayer}
          footerComponent={(
            <View style={[SpacesAny.paddingHorizontal[16], SpacesAny.paddingBottom[16]]}>
              {validateButton}
            </View>
          )}
          isVisible={Boolean(openLine)}
          maxContentHeightRatio={0.85}
        >
          <View style={[SpacesAny.paddingHorizontal[16], SpacesAny.paddingBottom[16]]}>
            {renderPlayerSheet()}
          </View>
        </BottomModal>
      ) : null}

      <BottomModal
        close={() => setIsConfirming(false)}
        isVisible={isConfirming}
        webPresentation="dialog"
      >
        <View
          accessibilityRole="alert"
          style={[SpacesAny.paddingHorizontal[16], SpacesAny.paddingBottom[16], SpacesAny.gap[12]]}
          testID="feuille-confirmation"
        >
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
            {republish
              ? t('stMatch.feuille.confirmRepublishTitle', 'Republier la feuille ?')
              : t('stMatch.feuille.confirmTitle', 'Publier la feuille ?')}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>{confirmationText}</Text>
          <View style={[Alignments.row, SpacesAny.gap[8], { justifyContent: 'flex-end' }]}>
            <Button
              onPress={() => setIsConfirming(false)}
              size="small"
              title={t('matchStatsEditor.cancel', 'Annuler')}
              variant="Ghost"
            />
            <Button
              isLoading={submitMutation.isPending}
              onPress={() => submitMutation.mutate()}
              size="small"
              title={republish
                ? t('stMatch.feuille.republish', 'Republier')
                : t('stMatch.feuille.publish', 'Publier')}
              variant="Primary"
            />
          </View>
        </View>
      </BottomModal>
    </ScreenContainer>
  );
}

export default MatchStatsEditor;
