import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Checkbox from '@/components/atoms/checkbox/Checkbox';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import PositionSelectionList from '@/components/organisms/positionSelectionList/PositionSelectionList';

import { RouteNames } from '@/navigation/routeNames';

import { useGetTeam } from '@/services/team/teamQueries';

import {
  getCompositionPlayerAvatarUrl,
  getCompositionPlayerId,
  getCompositionPlayerLabel,
} from '@/utils/compositionPlayer';

import { getPositionValuesForSport } from '@/constants/positions';
import { useEventWizard } from './EventWizardContext';
import {
  getDefaultCapacityModeForEventType,
  getEventWizardExitRoute,
  getEventWizardNextRoute,
  getEventWizardParticipantsStepIndex,
  getEventWizardSportName,
  getEventWizardStepCount,
  shouldExplainDetectionSlotsDisabled,
  shouldOfferDetectionSlots,
  shouldOfferMatchCallUp,
  shouldSkipEventWizardParticipantsStep,
} from './eventWizardDetectionUtils';

const MIN_PARTICIPANTS = 1;
const MAX_PARTICIPANTS = 200;
const CAPACITY_PRESETS = [8, 10, 12, 14, 18, 22];
// Pack « tunnel evenement » du 2026-08-05 : un evenement neuf s'ouvre sur
// « Capacite fixe » a 12, pas sur « Illimite ».
const DEFAULT_CAPACITY = 12;

// ✅ CE QUE D10 AVAIT SIGNALE, ET QUE D58 EXECUTE — 2026-08-10.
//
// D10 avait mesure l'ecart et s'etait interdit de le combler : la maquette 07
// replie les postes recherches DANS cet ecran, derriere un interrupteur, et sa
// legende dit mot pour mot « L'ancien ecran 8/11 disparait ». C'etait un
// CHANGEMENT D'ENCHAINEMENT, que son prompt lui interdisait.
//
// Decision d'Adel du 2026-08-09 : « on fusionne ». `EventWizardDetectionSlots`
// n'existe plus — ni ecran, ni route. Les postes sont la section ci-dessous,
// derriere un interrupteur eteint par defaut (pack §2.5), et une detection
// repasse de 9 a 8 etapes. La donnee, elle, n'a pas bouge : meme
// `SET_DETECTION_SLOTS`, meme forme `[{ position, quantity }]`.

/** Le plafond par poste, repris tel quel de l'ecran fusionne. */
const MAX_SLOT_QUANTITY = 10;

const normalizeSlots = (slots = []) => (
  Array.isArray(slots)
    ? slots
      .filter((slot) => slot?.position && Number(slot?.quantity) > 0)
      .map((slot) => ({
        position: String(slot.position),
        quantity: Math.max(1, Math.min(MAX_SLOT_QUANTITY, Number(slot.quantity) || 1)),
      }))
    : []
);

const clampParticipants = (value) => (
  Math.min(MAX_PARTICIPANTS, Math.max(MIN_PARTICIPANTS, value))
);

const isReservationTypeName = (typeName = '') => {
  const normalized = String(typeName || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return normalized.includes('reservation');
};

const isTrainingTypeName = (typeName = '') => {
  const normalized = String(typeName || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return normalized.includes('entrainement');
};

/**
 * @param {{ navigation: any, route: any }} props Proprietes d'ecran.
 * @returns {import('react').ReactElement} L'etape rendue.
 */
function EventWizardParticipants({ navigation, route }) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { dispatch, state } = useEventWizard();

  // Le mode est memorise DANS l'etat du tunnel, et pas deduit de `capacity`.
  // Sans ca, « Illimite » (qui enregistre `capacity: null`) serait indiscernable
  // d'un ecran jamais visite : revenir en arriere effacerait le choix de
  // l'organisateur et rouvrirait sur « Capacite fixe ».
  // ⚠️ `buildWizardFormData` (Recap) ne lit que des champs nommes : ce marqueur
  // ne part donc PAS au serveur.
  //
  // AC04 — TROIS etats, pas deux : `unlimited`, `fixed`, et `null` = « pas
  // encore tranche ». Seul le troisieme laisse le TYPE decider, et c'est ce qui
  // ouvre un match sur « Illimite » sans jamais ecraser un choix fait a la main.
  const [capacityMode, setCapacityMode] = useState(() => (
    state.capacityMode === 'unlimited' || state.capacityMode === 'fixed'
      ? state.capacityMode
      : getDefaultCapacityModeForEventType(state.type?.name)
  ));
  const [capacityValue, setCapacityValue] = useState(state.capacity || DEFAULT_CAPACITY);
  const [externalParticipantLimitValue, setExternalParticipantLimitValue] = useState(
    state.externalParticipantLimit || 3,
  );
  const [totalPlayersValue, setTotalPlayersValue] = useState(state.totalPlayers || 5);

  // D58 — les postes recherches, replies ici. L'interrupteur part allume si des
  // postes sont deja saisis : revenir sur l'etape ne doit pas les cacher.
  const initialSlots = useMemo(() => normalizeSlots(state.detectionSlots), [state.detectionSlots]);
  const [areSlotsEnabled, setAreSlotsEnabled] = useState(initialSlots.length > 0);
  const [slots, setSlots] = useState(initialSlots);

  // AC04 — LA CONVOCATION D'UN MATCH.
  //
  // 🧩 On ne reecrit pas `MatchCallUpSelection` : cet ecran-la se pose SUR un
  // evenement existant (il lit `event.team.players`, pre-coche depuis la
  // composition deja enregistree, et enchaîne sur le terrain). Ici l'evenement
  // n'existe pas encore. Ce qui est reutilise, ce sont les briques partagees —
  // `Checkbox`, `ProfileAvatar`, `getCompositionPlayerId/Label` — et surtout la
  // MEME donnee de sortie : une liste d'identifiants de joueurs, que le Recap
  // envoie ensuite dans `draft.selectedPlayerIds`.
  //
  // 🚨 Pourquoi on RAPPELLE l'equipe : l'etape 2 la depose dans le tunnel via
  // `useGetTeams({ summary: true })`, et ce mode ne rend des joueurs que leur
  // `documentId` (`teamService.js:194`). Sans ce rappel, la liste afficherait
  // trois fois « Joueur ».
  const shouldOfferCallUp = shouldOfferMatchCallUp(state);
  const organizerTeamId = String(state.team?.documentId || state.team?.id || '');
  //
  // Q2 (constat d'Adel en recette du 2026-08-23) : `isLoading` n'est PAS du
  // confort. Sans lui, "la requete vole encore" et "l'equipe est vraiment
  // vide" rendent le MEME ecran -- `squadPlayers` vaut [] dans les deux cas --
  // et l'etape annonce a tort "Cette equipe n'a encore aucun joueur", avec un
  // compteur "0 sur 0", pendant tout le vol du GET /teams/:id.
  const { data: fullOrganizerTeam, isLoading: isLoadingSquad } = useGetTeam(organizerTeamId, {
    enabled: shouldOfferCallUp && Boolean(organizerTeamId),
  });
  const squadPlayers = useMemo(() => {
    /** @type {any[]} */
    const source = fullOrganizerTeam?.players || [];
    return source.filter((player) => Boolean(getCompositionPlayerId(player)));
  }, [fullOrganizerTeam?.players]);

  const [calledUpIds, setCalledUpIds] = useState(
    /** @type {string[]} */ (Array.isArray(state.matchCallUpPlayerIds)
      ? state.matchCallUpPlayerIds
      : []),
  );
  // « A-t-on deja touche a la liste ? » — sans ce marqueur, une convocation
  // videe a la main serait recochee en entier au rendu suivant.
  const [hasTouchedCallUp, setHasTouchedCallUp] = useState(
    Array.isArray(state.matchCallUpPlayerIds) && state.matchCallUpPlayerIds.length > 0,
  );

  // L'effectif de base EST la convocation de depart : on decoche les absents.
  useEffect(() => {
    if (!shouldOfferCallUp || hasTouchedCallUp || squadPlayers.length === 0) return;
    setCalledUpIds(squadPlayers.map(getCompositionPlayerId));
  }, [hasTouchedCallUp, shouldOfferCallUp, squadPlayers]);

  const handleToggleCallUp = (/** @type {string} */ playerId) => {
    setHasTouchedCallUp(true);
    setCalledUpIds((current) => (current.includes(playerId)
      ? current.filter((identifiant) => identifiant !== playerId)
      : [...current, playerId]));
  };

  const isReservation = useMemo(
    () => isReservationTypeName(state.type?.name),
    [state.type?.name],
  );
  const isTraining = useMemo(
    () => isTrainingTypeName(state.type?.name),
    [state.type?.name],
  );
  const isOpenTraining = isTraining && state.sessionStatus !== 'closed';
  const shouldSkipParticipantsStep = useMemo(
    () => shouldSkipEventWizardParticipantsStep(state),
    [state],
  );

  const clampedCapacity = clampParticipants(capacityValue);
  const clampedExternalParticipantLimit = clampParticipants(externalParticipantLimitValue);
  const clampedTotalPlayers = clampParticipants(totalPlayersValue);
  let normalizedCapacity = null;
  if (!isTraining && capacityMode !== 'unlimited') {
    normalizedCapacity = clampedCapacity;
  }
  const shouldCollectInternalPlayers = isReservation || (isTraining && !isOpenTraining);
  const normalizedTotalPlayers = shouldCollectInternalPlayers ? clampedTotalPlayers : null;
  let normalizedExternalParticipantLimit = null;
  if (isTraining) {
    normalizedExternalParticipantLimit = isOpenTraining
      ? clampedExternalParticipantLimit
      : (state.externalParticipantLimit ?? null);
  }
  const projectedState = {
    ...state,
    capacity: normalizedCapacity,
    externalParticipantLimit: normalizedExternalParticipantLimit,
    totalPlayers: normalizedTotalPlayers,
  };
  const shouldShowDetectionDisabledHint = shouldExplainDetectionSlotsDisabled(projectedState);

  // D58 — la section « Postes recherches ». Meme regle qu'a l'epoque de l'ecran
  // separe : detection + sport a postes + non recurrent.
  const shouldOfferSlots = shouldOfferDetectionSlots(projectedState);
  const sportName = getEventWizardSportName(state);
  const positions = useMemo(() => getPositionValuesForSport(sportName), [sportName]);
  const slotsTotal = useMemo(
    () => slots.reduce((sum, slot) => sum + Number(slot.quantity || 0), 0),
    [slots],
  );
  const capacityLimit = normalizedCapacity;
  const slotsExceedCapacity = (
    shouldOfferSlots
    && areSlotsEnabled
    && capacityLimit !== null
    && slotsTotal > capacityLimit
  );

  const getSlotQuantity = (position) => {
    const slot = slots.find((item) => item.position === position);
    return slot ? slot.quantity : 0;
  };

  const isSlotSelected = (position) => slots.some((item) => item.position === position);

  const handleToggleSlotPosition = (position) => {
    setSlots((current) => (
      current.some((item) => item.position === position)
        ? current.filter((item) => item.position !== position)
        : [...current, { position, quantity: 1 }]
    ));
  };

  const handleSlotQuantityChange = (position, delta) => {
    setSlots((current) => current.map((item) => (
      item.position === position
        ? {
          ...item,
          quantity: Math.max(1, Math.min(MAX_SLOT_QUANTITY, item.quantity + delta)),
        }
        : item
    )));
  };

  const handleSlotsEnabledChange = (nextEnabled) => {
    setAreSlotsEnabled(nextEnabled);
    if (!nextEnabled) setSlots([]);
  };

  const hasInvalidPlayersConfig = (
    isReservation
    && capacityMode === 'fixed'
    && clampedTotalPlayers > clampedCapacity
  );

  const canDecreaseCapacity = capacityMode === 'fixed' && clampedCapacity > MIN_PARTICIPANTS;
  const canIncreaseCapacity = capacityMode === 'fixed' && clampedCapacity < MAX_PARTICIPANTS;
  const canDecreaseExternalLimit = clampedExternalParticipantLimit > MIN_PARTICIPANTS;
  const canIncreaseExternalLimit = clampedExternalParticipantLimit < MAX_PARTICIPANTS;
  const canDecreaseTotal = clampedTotalPlayers > MIN_PARTICIPANTS;
  const canIncreaseTotal = (
    clampedTotalPlayers < MAX_PARTICIPANTS
    && (isTraining || capacityMode === 'unlimited' || clampedTotalPlayers < clampedCapacity)
  );

  // La ligne d'aide dit la CONSEQUENCE du reglage courant, pas son intitule :
  // elle remplace a elle seule la carte « Resume » et le rappel « tu pourras
  // modifier », que le pack supprime tous les deux.
  let capacityLabel = t(
    'eventWizard.steps.participants.hintFixed',
    'Les inscriptions restent libres dans la limite des {{count}} places.',
    { count: clampedCapacity },
  );
  if (capacityMode === 'unlimited') {
    capacityLabel = t(
      'eventWizard.steps.participants.hintUnlimited',
      'Aucun plafond : tout le monde peut s inscrire.',
    );
  }
  if (isTraining) {
    capacityLabel = isOpenTraining
      ? t(
        'eventWizard.steps.participants.trainingOpenCapacity',
        'Illimité en interne + quota externe',
      )
      : t(
        'eventWizard.steps.participants.trainingPrivateCapacity',
        'Illimité (entraînement prive)',
      );
  }

  // ⚠️ CLE NEUVE, et c'est voulu : `…participants.subtitle` existe deja dans
  // `fr.js` avec l'ancienne phrase, et `fr.js` gagne toujours sur le repli.
  // Modifier cette ligne-la compterait comme une SUPPRESSION dans le diff, ce
  // que le lot s'interdit. Une cle neuve porte donc la copy du pack.
  let participantsSubtitleKey = 'eventWizard.steps.participants.subtitleQuestion';
  let participantsSubtitleFallback = "Combien de joueurs peuvent s'inscrire ?";
  if (shouldOfferCallUp) {
    // AC04 — sur un match, la question de l'etape n'est plus « combien ? » mais
    // « qui ? ». Cle neuve, meme raison qu'au-dessus : `fr.js` gagne toujours
    // sur le repli, et retoucher une valeur existante compterait comme une
    // suppression dans le diff.
    participantsSubtitleKey = 'eventWizard.steps.participants.matchCallUpSubtitle';
    participantsSubtitleFallback = 'Coche les joueurs que tu convoques.';
  } else if (isTraining && isOpenTraining) {
    participantsSubtitleKey = 'eventWizard.steps.participants.trainingOpenSubtitle';
    participantsSubtitleFallback = 'Définis uniquement combien de joueurs externes a l équipe tu veux accepter.';
  } else if (isTraining) {
    participantsSubtitleKey = 'eventWizard.steps.participants.trainingSubtitle';
    participantsSubtitleFallback = 'Définis tes joueurs attendus pour cet entraînement.';
  }

  const surfaceStyle = {
    backgroundColor: 'rgba(4, 31, 44, 0.82)',
    borderColor: 'rgba(1, 179, 244, 0.24)',
    borderWidth: 1,
  };
  const capacityModeControlWrapperStyle = {
    alignSelf: 'center',
    maxWidth: 540,
    width: '100%',
  };

  // 44 pt : la cible tactile de la grammaire `focus` (lot D05).
  const counterButtonStyle = (isEnabled) => ([
    ApplicationStyle.card,
    Alignments.alignCenter,
    Alignments.justifyCenter,
    {
      backgroundColor: isEnabled ? 'rgba(1, 179, 244, 0.12)' : 'rgba(1, 179, 244, 0.06)',
      borderColor: 'rgba(1, 179, 244, 0.28)',
      borderRadius: 16,
      height: 48,
      opacity: isEnabled ? 1 : 0.45,
      width: 48,
    },
  ]);

  const handleNext = () => {
    if (
      isReservation
      && normalizedCapacity !== null
      && normalizedTotalPlayers !== null
      && normalizedTotalPlayers > normalizedCapacity
    ) {
      Alert.alert(
        t('common.error', 'Erreur'),
        t(
          'eventWizard.steps.participants.totalPlayersExceedsCapacity',
          'Le nombre de joueurs attendus ne peut pas dépasser la capacité max.',
        ),
      );
      return;
    }

    dispatch({
      payload: {
        capacity: normalizedCapacity,
        capacityMode,
        externalParticipantLimit: normalizedExternalParticipantLimit,
        totalPlayers: normalizedTotalPlayers,
      },
      type: 'SET_PARTICIPANTS',
    });

    // AC04 — le choix de convocation, garde en memoire jusqu'a la creation.
    // ⛔ Meme garde que les postes : on n'ecrit que si la section etait offerte.
    if (shouldOfferCallUp) {
      dispatch({
        payload: squadPlayers
          .map(getCompositionPlayerId)
          .filter((playerId) => calledUpIds.includes(playerId)),
        type: 'SET_MATCH_CALL_UP',
      });
    }

    // D58 — l'enregistrement que faisait l'ecran fusionne, au meme format.
    // ⛔ Uniquement quand la section est offerte : hors de ce cas l'ancien ecran
    // n'etait pas traverse du tout, et ecrire ici effacerait des postes deja
    // saisis (une detection qu'on repasse en recurrente, par exemple).
    if (shouldOfferSlots) {
      dispatch({
        payload: areSlotsEnabled ? normalizeSlots(slots) : [],
        type: 'SET_DETECTION_SLOTS',
      });
    }

    navigation.navigate(getEventWizardExitRoute(
      getEventWizardNextRoute(RouteNames.EventWizardParticipants, state),
      route?.params,
    ));
  };

  useEffect(() => {
    if (!shouldSkipParticipantsStep) return;

    // Garde-fou : quand l'etape est sautee, elle ne figure plus dans la chaine
    // et `getEventWizardNextRoute` ne saurait pas d'ou repartir. C'est le seul
    // endroit du tunnel ou l'ecran suivant est nomme en clair.
    if (typeof navigation.replace === 'function') {
      navigation.replace(RouteNames.EventWizardAccess);
      return;
    }

    navigation.navigate(RouteNames.EventWizardAccess);
  }, [navigation, shouldSkipParticipantsStep]);

  if (shouldSkipParticipantsStep) {
    return null;
  }

  return (
    <WizardStepLayout
      headerVariant="focus"
      isNextDisabled={hasInvalidPlayersConfig || slotsExceedCapacity}
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      stepCount={getEventWizardStepCount(projectedState)}
      stepIndex={getEventWizardParticipantsStepIndex(projectedState)}
      subtitle={t(participantsSubtitleKey, participantsSubtitleFallback)}
      title={t('eventWizard.steps.participants.title', 'Participants')}
    >
      <View style={[Spaces.gap[16]]}>
        {!isTraining ? (
          <>
            {/* Deux choix binaires = une paire de pilules, sans carte ni titre
                au-dessus : la question est deja dans le sous-titre de l'entete.
                C'est le « moitie moins de texte » du pack. */}
            <View style={capacityModeControlWrapperStyle}>
              <SegmentedControl
                centerContent
                onChange={setCapacityMode}
                options={[
                  {
                    label: t('eventWizard.steps.participants.unlimited', 'Illimite'),
                    value: 'unlimited',
                  },
                  {
                    label: t('eventWizard.steps.participants.fixed', 'Capacité fixe'),
                    value: 'fixed',
                  },
                ]}
                value={capacityMode}
              />
            </View>

            {capacityMode === 'fixed' ? (
              <View style={[Spaces.gap[8]]}>
                <View
                  style={[
                    ApplicationStyle.card,
                    Alignments.row,
                    Alignments.alignCenter,
                    Alignments.justifySpaceBetween,
                    Spaces.padding[8],
                    surfaceStyle,
                  ]}
                >
                  <TouchableOpacity
                    accessibilityLabel={t(
                      'eventWizard.steps.participants.decrease',
                      'Un joueur de moins',
                    )}
                    accessibilityRole="button"
                    disabled={!canDecreaseCapacity}
                    onPress={() => setCapacityValue((value) => clampParticipants(value - 1))}
                    style={counterButtonStyle(canDecreaseCapacity)}
                  >
                    <Text style={[Fonts.h3, Fonts.primary500]}>-</Text>
                  </TouchableOpacity>

                  <View style={[Spaces.paddingHorizontal[12]]}>
                    <Text style={[Fonts.h1Black, Fonts.neutral00, { textAlign: 'center' }]}>
                      {clampedCapacity}
                    </Text>
                    <Text style={[Fonts.p3, Fonts.neutral200, { textAlign: 'center' }]}>
                      {t('eventWizard.steps.participants.playersUnit', 'joueurs max')}
                    </Text>
                  </View>

                  <TouchableOpacity
                    accessibilityLabel={t(
                      'eventWizard.steps.participants.increase',
                      'Un joueur de plus',
                    )}
                    accessibilityRole="button"
                    disabled={!canIncreaseCapacity}
                    onPress={() => setCapacityValue((value) => clampParticipants(value + 1))}
                    style={counterButtonStyle(canIncreaseCapacity)}
                  >
                    <Text style={[Fonts.h3, Fonts.primary500]}>+</Text>
                  </TouchableOpacity>
                </View>

                {/* Les 6 valeurs rapides, sur UNE rangee, cibles a 44 pt. Le
                    titre « Valeurs rapides » disparait : six nombres alignes
                    sous un compteur n'ont pas besoin qu'on les nomme. */}
                <View style={[Alignments.row, { columnGap: 8, flexWrap: 'wrap', rowGap: 8 }]}>
                  {CAPACITY_PRESETS.map((preset) => {
                    const selected = clampedCapacity === preset;
                    return (
                      <TouchableOpacity
                        accessibilityRole="button"
                        key={`capacity-preset-${preset}`}
                        onPress={() => setCapacityValue(preset)}
                        style={[
                          ApplicationStyle.card,
                          Alignments.alignCenter,
                          Alignments.justifyCenter,
                          {
                            backgroundColor: selected ? Colors.primary500 : 'rgba(1, 179, 244, 0.08)',
                            borderColor: selected ? Colors.primary500 : 'rgba(1, 179, 244, 0.26)',
                            borderRadius: 12,
                            flexGrow: 1,
                            minHeight: 44,
                            minWidth: 44,
                          },
                        ]}
                      >
                        <Text style={[Fonts.p1Bold, selected ? Fonts.neutral900 : Fonts.neutral100]}>
                          {preset}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </>
        ) : null}

        {/* AC04 — LA CONVOCATION : l'effectif de l'equipe, a cocher. C'est la
            reponse au constat ① d'Adel du 2026-08-20. */}
        {shouldOfferCallUp ? (
          <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[12], surfaceStyle]}>
            <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {t('eventWizard.steps.participants.matchCallUpTitle', 'Convocation')}
              </Text>
              {isLoadingSquad ? null : (
                <Text style={[Fonts.p3, Fonts.neutral300]}>
                  {t(
                    'eventWizard.steps.participants.matchCallUpCount',
                    '{{count}} sur {{total}}',
                    { count: calledUpIds.length, total: squadPlayers.length },
                  )}
                </Text>
              )}
            </View>

            {/* Q2 -- l'effectif vole encore : on le DIT, au lieu de laisser
                croire que l'equipe est vide. */}
            {isLoadingSquad ? (
              <ActivityIndicator
                accessibilityLabel={t('common.loading', 'Chargement...')}
                color={Colors.primary500}
                size="large"
              />
            ) : null}

            {!isLoadingSquad && squadPlayers.length === 0 ? (
              <Text style={[Fonts.p3, Fonts.neutral300, { lineHeight: 18 }]}>
                {t(
                  'eventWizard.steps.participants.matchCallUpEmpty',
                  "Cette équipe n'a encore aucun joueur. Tu pourras convoquer depuis la fiche du match.",
                )}
              </Text>
            ) : null}

            {squadPlayers.map((/** @type {any} */ player) => {
              const playerId = getCompositionPlayerId(player);
              const playerLabel = getCompositionPlayerLabel(player);
              const isCalledUp = calledUpIds.includes(playerId);

              return (
                <TouchableOpacity
                  accessibilityLabel={playerLabel}
                  accessibilityRole="button"
                  key={`call-up-${playerId}`}
                  onPress={() => handleToggleCallUp(playerId)}
                  style={[
                    Alignments.row,
                    Alignments.alignCenter,
                    Spaces.gap[12],
                    { minHeight: 44, opacity: isCalledUp ? 1 : 0.55 },
                  ]}
                >
                  <Checkbox
                    disabled={false}
                    onValueChange={() => handleToggleCallUp(playerId)}
                    value={isCalledUp}
                  />
                  <ProfileAvatar
                    enablePreview={false}
                    imageUrl={getCompositionPlayerAvatarUrl(player)}
                    name={playerLabel}
                    size={32}
                  />
                  <Text
                    numberOfLines={1}
                    style={[Fonts.p2, Fonts.neutral00, { flex: 1 }]}
                  >
                    {playerLabel}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {/* La ligne dit la CONSEQUENCE, comme le reste de l'etape : la
                convocation part en BROUILLON, elle ne previent encore
                personne. C'est « Publier la convocation », depuis la fiche du
                match, qui la rend visible aux joueurs. */}
            <Text style={[Fonts.p3, Fonts.neutral300, { lineHeight: 18 }]}>
              {t(
                'eventWizard.steps.participants.matchCallUpHint',
                'Tu pourras encore la modifier, puis la publier depuis la fiche du match.',
              )}
            </Text>
          </View>
        ) : null}

        {shouldCollectInternalPlayers ? (
          <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[12], surfaceStyle]}>
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {isTraining
                ? t('eventWizard.steps.participants.trainingTotalPlayers', 'Joueurs attendus (interne)')
                : t('eventEdit.fields.totalPlayers.label')}
            </Text>
            <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}>
              <TouchableOpacity
                disabled={!canDecreaseTotal}
                onPress={() => setTotalPlayersValue((value) => clampParticipants(value - 1))}
                style={counterButtonStyle(canDecreaseTotal)}
              >
                <Text style={[Fonts.h3, Fonts.primary500]}>-</Text>
              </TouchableOpacity>
              <Text style={[Fonts.h1, Fonts.neutral00]}>
                {clampedTotalPlayers}
              </Text>
              <TouchableOpacity
                disabled={!canIncreaseTotal}
                onPress={() => setTotalPlayersValue((value) => clampParticipants(value + 1))}
                style={counterButtonStyle(canIncreaseTotal)}
              >
                <Text style={[Fonts.h3, Fonts.primary500]}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {isOpenTraining ? (
          <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[12], surfaceStyle]}>
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {t('eventWizard.steps.participants.externalQuotaLabel', 'Places externes')}
            </Text>
            <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}>
              <TouchableOpacity
                disabled={!canDecreaseExternalLimit}
                onPress={() => setExternalParticipantLimitValue((value) => clampParticipants(value - 1))}
                style={counterButtonStyle(canDecreaseExternalLimit)}
              >
                <Text style={[Fonts.h3, Fonts.primary500]}>-</Text>
              </TouchableOpacity>
              <Text style={[Fonts.h1, Fonts.neutral00]}>
                {clampedExternalParticipantLimit}
              </Text>
              <TouchableOpacity
                disabled={!canIncreaseExternalLimit}
                onPress={() => setExternalParticipantLimitValue((value) => clampParticipants(value + 1))}
                style={counterButtonStyle(canIncreaseExternalLimit)}
              >
                <Text style={[Fonts.h3, Fonts.primary500]}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* Le pack remplace la carte « Resume » et son rappel « tu pourras
            modifier » par UNE ligne, qui dit la consequence du reglage courant.
            Rien n'est perdu : le Recap (etape 8) recapitule tout, et les
            valeurs saisies restent affichees dans leurs propres compteurs. */}
        <Text style={[Fonts.p3, Fonts.neutral300, { lineHeight: 18 }]}>
          {capacityLabel}
        </Text>

        {hasInvalidPlayersConfig ? (
          <Text style={[Fonts.p3, Fonts.error700]}>
            {t(
              'eventWizard.steps.participants.totalPlayersExceedsCapacity',
              'Le nombre de joueurs attendus ne peut pas dépasser la capacité max.',
            )}
          </Text>
        ) : null}

        {/* D58 — « Postes recherches », replie ici derriere un interrupteur
            (pack §2.5). Eteint par defaut : une detection se cree sans avoir a
            repondre a cette question. */}
        {shouldOfferSlots ? (
          <View style={[Spaces.gap[12]]}>
            <View
              style={[
                ApplicationStyle.card,
                Alignments.row,
                Alignments.alignCenter,
                Alignments.justifySpaceBetween,
                Spaces.padding[16],
                Spaces.gap[12],
                surfaceStyle,
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                  {t('eventWizard.steps.detectionSlots.title', 'Postes recherchés')}
                </Text>
                <Text style={[Fonts.p3, Fonts.neutral200, Spaces.marginTop[8], { lineHeight: 18 }]}>
                  {t(
                    'eventWizard.steps.detectionSlots.toggleHint',
                    'Optionnel : les joueurs candidateront ensuite sur un poste précis.',
                  )}
                </Text>
              </View>
              <Switch
                accessibilityLabel={t(
                  'eventWizard.steps.detectionSlots.title',
                  'Postes recherchés',
                )}
                accessibilityRole="switch"
                onValueChange={handleSlotsEnabledChange}
                thumbColor={areSlotsEnabled ? Colors.neutral00 : Colors.neutral300}
                trackColor={{ false: 'rgba(255,255,255,0.16)', true: Colors.primary500 }}
                value={areSlotsEnabled}
              />
            </View>

            {areSlotsEnabled && positions.length > 0 ? (
              <PositionSelectionList
                getQuantity={getSlotQuantity}
                isSelected={isSlotSelected}
                onQuantityChange={handleSlotQuantityChange}
                onToggle={handleToggleSlotPosition}
                positions={positions}
                selectedQuantityLabel={(quantity) => t(
                  'eventWizard.steps.detectionSlots.positionSummary',
                  '{{count}} place(s) sur ce poste',
                  { count: quantity },
                )}
                selectedSectionTitle={t(
                  'eventWizard.steps.detectionSlots.selectedSectionTitle',
                  'Postes actifs',
                )}
                sportName={sportName}
                unselectedActionLabel={t(
                  'eventWizard.steps.detectionSlots.unselectedActionLabel',
                  'Activer',
                )}
              />
            ) : null}

            {areSlotsEnabled && positions.length === 0 ? (
              <Text style={[Fonts.p3, Fonts.neutral300, { lineHeight: 18 }]}>
                {t(
                  'eventWizard.steps.detectionSlots.emptyPositions',
                  'Aucun poste n est actuellement défini pour ce sport.',
                )}
              </Text>
            ) : null}

            {/* Le compteur du pack : il dit ce qui reste libre, pas ce qui est
                pris. Sans plafond, « sur 12 » n'aurait aucun sens. */}
            {areSlotsEnabled && slotsTotal > 0 ? (
              <Text style={[Fonts.p3, Fonts.neutral300, { lineHeight: 18 }]}>
                {capacityLimit === null
                  ? t(
                    'eventWizard.steps.detectionSlots.slotsSummaryUnlimited',
                    '{{count}} place(s) fléchée(s) sur un poste précis.',
                    { count: slotsTotal },
                  )
                  : t(
                    'eventWizard.steps.detectionSlots.slotsSummaryFixed',
                    '{{count}} places fléchées sur {{capacity}} — les {{free}} autres restent libres.',
                    {
                      capacity: capacityLimit,
                      count: slotsTotal,
                      free: Math.max(0, capacityLimit - slotsTotal),
                    },
                  )}
              </Text>
            ) : null}

            {slotsExceedCapacity ? (
              <Text style={[Fonts.p3Bold, { color: Colors.warning500 }]}>
                {t(
                  'eventWizard.steps.detectionSlots.capacityWarning',
                  'Le total des places par poste dépasse la capacité de l événement.',
                )}
              </Text>
            ) : null}
          </View>
        ) : null}

        {shouldShowDetectionDisabledHint ? (
          <View style={[ApplicationStyle.card, Spaces.padding[16], surfaceStyle]}>
            <Text style={[Fonts.p3Bold, Fonts.gold500]}>
              {t(
                'eventWizard.steps.detectionSlots.recurrenceHintTitle',
                'Postes par détection indisponibles',
              )}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral200, Spaces.marginTop[8]]}>
              {t(
                'eventWizard.steps.detectionSlots.recurrenceHintBody',
                'Les postes recherches sont disponibles uniquement sur une détection simple, non recurrente.',
              )}
            </Text>
          </View>
        ) : null}
      </View>
    </WizardStepLayout>
  );
}

export default EventWizardParticipants;
