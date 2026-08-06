import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { useEventWizard } from './EventWizardContext';
import {
  getEventWizardNextRoute,
  getEventWizardParticipantsStepIndex,
  getEventWizardStepCount,
  shouldExplainDetectionSlotsDisabled,
  shouldSkipEventWizardParticipantsStep,
} from './eventWizardDetectionUtils';

const MIN_PARTICIPANTS = 1;
const MAX_PARTICIPANTS = 200;
const CAPACITY_PRESETS = [8, 10, 12, 14, 18, 22];
// Pack « tunnel evenement » du 2026-08-05 : un evenement neuf s'ouvre sur
// « Capacite fixe » a 12, pas sur « Illimite ».
const DEFAULT_CAPACITY = 12;

// 🔴 CE QUE LE PACK DEMANDE ET QUE D10 NE FAIT PAS — mesure, pas oubli.
//
// La maquette 07 replie les postes recherches DANS cet ecran, derriere un
// interrupteur, et sa legende dit mot pour mot : « L'ancien ecran 8/11
// disparait ». Ce serait un CHANGEMENT D'ENCHAINEMENT : `EventWizardDetectionSlots`
// est une etape a part entiere de la chaine ecrite par D08
// (`eventWizardDetectionUtils.js` → `getEventWizardStepRoutes`), et c'est elle
// qui met une detection a 9 etapes la ou le pack en montre 8.
// Le prompt de ce lot l'interdit explicitement : « Aucun changement
// d'enchainement. Si le design l'exige, D08 a rate quelque chose : signale-le,
// ne le repare pas ici. » ⇒ signale, et les postes restent leur propre ecran.

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
 *
 * @param root0
 * @param root0.navigation
 */
function EventWizardParticipants({ navigation }) {
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
  const [capacityMode, setCapacityMode] = useState(
    state.capacityMode === 'unlimited' ? 'unlimited' : 'fixed',
  );
  const [capacityValue, setCapacityValue] = useState(state.capacity || DEFAULT_CAPACITY);
  const [externalParticipantLimitValue, setExternalParticipantLimitValue] = useState(
    state.externalParticipantLimit || 3,
  );
  const [totalPlayersValue, setTotalPlayersValue] = useState(state.totalPlayers || 5);

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
  if (isTraining && isOpenTraining) {
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

    navigation.navigate(getEventWizardNextRoute(RouteNames.EventWizardParticipants, state));
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
      isNextDisabled={hasInvalidPlayersConfig}
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
