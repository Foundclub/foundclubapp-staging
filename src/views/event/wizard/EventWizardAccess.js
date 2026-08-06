// @ts-nocheck
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { isTrainingEventType } from '@/domains/event/eventUseCases';
import useTheme from '@/theme/themeContext';

import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { useEventWizard } from './EventWizardContext';
import {
  getEventWizardAccessStepIndex,
  getEventWizardNextRoute,
  getEventWizardStepCount,
  isTournamentEventType,
} from './eventWizardDetectionUtils';

// D08 — L'ACCES DE L'EVENEMENT EN UN SEUL ECRAN.
// D10 — ET EN DEUX PAIRES DE PILULES.
//
// Cet ecran reunit ce qui vivait dans `EventWizardVisibility` (public/prive et
// visibilite des participants) et dans `EventWizardValidationMode` (validation
// automatique ou manuelle).
//
// Le pack du 2026-08-05 (maquette 08) le resume ainsi : « Deux choix binaires =
// deux paires de pilules, avec UNE ligne d'explication dynamique sous chacune —
// moitie moins de texte affiche qu'avant. » Les quatre grandes cartes de choix
// (titre + description + phrase d'aide + pastille de selection, soit ~30 lignes
// de texte a l'ecran) deviennent donc deux bascules et deux lignes.
//
// ⚠️ AUCUNE VALEUR DE DONNEE NE CHANGE. `sessionStatus` reste `open`/`closed`,
// `validationMode` reste `auto`/`manual`, `participantIdentityVisibility` reste
// `VISIBLE`/`ANONYMIZED` : ce sont les chaines deja en base.
//
// Le bloc « validation » ne s'affiche PAS pour un tournoi, exactement comme
// avant : le tunnel tournoi ne traversait jamais `EventWizardValidationMode`,
// son `validationMode` etant deduit du mode d'inscription
// (`EventWizardTournamentSettings`).

/**
 * Intitule de groupe de la grammaire `focus` : petites capitales espacees.
 * @param {object} props
 * @param {string} props.children Le libelle.
 * @returns {import('react').ReactElement}
 */
function GroupLabel({ children }) {
  const { Fonts, Spaces } = useTheme();
  return (
    <Text
      style={[
        Fonts.p4Bold,
        Fonts.neutral200,
        Spaces.marginBottom[8],
        { letterSpacing: 1, textTransform: 'uppercase' },
      ]}
    >
      {children}
    </Text>
  );
}

/**
 * La ligne d'explication qui suit une paire de pilules. Elle dit la
 * CONSEQUENCE du choix courant — c'est elle qui remplace les descriptions
 * portees par les anciennes cartes.
 * @param {object} props
 * @param {string} props.children Le texte.
 * @returns {import('react').ReactElement}
 */
function ChoiceHint({ children }) {
  const { Fonts, Spaces } = useTheme();
  return (
    <Text
      style={[
        Fonts.p3,
        Fonts.neutral200,
        Spaces.marginTop[8],
        // Deux lignes reservees : sans plancher, basculer d'une explication
        // courte a une longue ferait sauter tout ce qui suit.
        { lineHeight: 18, minHeight: 36 },
      ]}
    >
      {children}
    </Text>
  );
}

/**
 *
 * @param root0
 * @param root0.navigation
 */
function EventWizardAccess({ navigation }) {
  const {
    Alignments,
    ApplicationStyle,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { dispatch, state } = useEventWizard();

  const [participantIdentityVisibility, setParticipantIdentityVisibility] = useState(
    state.participantIdentityVisibility || 'VISIBLE',
  );
  const [sessionStatus, setSessionStatus] = useState(state.sessionStatus || 'open');
  const [validationMode, setValidationMode] = useState(state.validationMode || 'auto');
  const [externalParticipantValidationMode, setExternalParticipantValidationMode] = useState(
    state.externalParticipantValidationMode || 'manual',
  );
  // La visibilite des identites est le seul reglage « avance » du pack : il
  // reste replie tant que personne ne le demande, mais sa VALEUR est toujours
  // lisible sur la rangee — un reglage cache dont on ignore l'etat serait pire
  // qu'un reglage deplie.
  const [isIdentityExpanded, setIsIdentityExpanded] = useState(false);

  const isTraining = isTrainingEventType(state.type?.name);
  const isTournament = isTournamentEventType(state?.type?.name);
  const isOpenTraining = isTraining && sessionStatus !== 'closed';

  // La visibilite choisie ici decide encore de la forme du parcours (un
  // entrainement prive saute l'etape Participants) : le compteur et l'ecran
  // suivant se calculent donc sur l'etat PROJETE, pas sur l'etat enregistre.
  const projectedState = useMemo(() => ({
    ...state,
    participantIdentityVisibility,
    sessionStatus,
  }), [participantIdentityVisibility, sessionStatus, state]);

  const advancedRowStyle = [
    ApplicationStyle.card,
    Alignments.row,
    Alignments.alignCenter,
    Spaces.paddingHorizontal[16],
    Spaces.gap[12],
    {
      backgroundColor: 'rgba(4, 31, 44, 0.82)',
      borderColor: 'rgba(1, 179, 244, 0.24)',
      borderWidth: 1,
      minHeight: 52,
    },
  ];

  const visibilityOptions = [
    { label: t('eventWizard.steps.access.visibilityPublic', 'Public'), value: 'open' },
    { label: t('eventWizard.steps.access.visibilityPrivate', 'Privé'), value: 'closed' },
  ];
  const validationOptions = [
    { label: t('eventEdit.fields.validationMode.options.auto', 'Automatique'), value: 'auto' },
    { label: t('eventEdit.fields.validationMode.options.manual', 'Manuelle'), value: 'manual' },
  ];
  const identityOptions = [
    { label: t('eventWizard.steps.access.identityVisible', 'Visibles'), value: 'VISIBLE' },
    { label: t('eventWizard.steps.access.identityAnonymized', 'Anonymisées'), value: 'ANONYMIZED' },
  ];

  const identityValueLabel = participantIdentityVisibility === 'ANONYMIZED'
    ? t('eventWizard.steps.access.identityAnonymized', 'Anonymisées')
    : t('eventWizard.steps.access.identityVisible', 'Visibles');

  const handleNext = () => {
    dispatch({
      payload: {
        participantIdentityVisibility,
        sessionStatus,
      },
      type: 'SET_META',
    });

    // Un tournoi n'a jamais regle sa validation ici : on ne touche donc pas a
    // `validationMode`, qui vient de l'ecran « Reglages du tournoi ».
    if (!isTournament) {
      dispatch({
        payload: {
          externalParticipantValidationMode: isOpenTraining
            ? externalParticipantValidationMode
            : (state.externalParticipantValidationMode || externalParticipantValidationMode),
          validationMode,
        },
        type: 'SET_VALIDATION_MODE',
      });
    }

    navigation.navigate(getEventWizardNextRoute(RouteNames.EventWizardAccess, projectedState));
  };

  return (
    <WizardStepLayout
      headerVariant="focus"
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      stepCount={getEventWizardStepCount(projectedState)}
      stepIndex={getEventWizardAccessStepIndex(projectedState)}
      subtitle={t(
        'eventWizard.steps.access.subtitleShort',
        "Qui voit l'événement, et comment on s'y inscrit.",
      )}
      title={t('eventWizard.steps.access.titleShort', 'Accès')}
    >
      <View style={[Spaces.paddingBottom[24]]}>
        <View>
          <GroupLabel>
            {t('eventWizard.steps.access.visibilityGroup', 'Visibilité')}
          </GroupLabel>
          <SegmentedControl
            centerContent
            onChange={setSessionStatus}
            options={visibilityOptions}
            value={sessionStatus}
          />
          <ChoiceHint>
            {sessionStatus === 'closed'
              ? t(
                'eventWizard.steps.access.visibilityPrivateHint',
                "Réservé aux membres de l'équipe et aux invités.",
              )
              : t(
                'eventWizard.steps.access.visibilityPublicHint',
                'Découvrable par tous — recommandé pour une détection.',
              )}
          </ChoiceHint>
        </View>

        {!isTournament ? (
          <View style={[Spaces.marginTop[16]]}>
            <GroupLabel>
              {t(
                isTraining
                  ? 'eventWizard.steps.access.validationGroupInternal'
                  : 'eventWizard.steps.access.validationGroup',
                isTraining ? 'Validation des membres internes' : 'Validation des présences',
              )}
            </GroupLabel>
            <SegmentedControl
              centerContent
              onChange={setValidationMode}
              options={validationOptions}
              value={validationMode}
            />
            <ChoiceHint>
              {validationMode === 'manual'
                ? t(
                  'eventWizard.steps.access.validationManualHint',
                  'Le coach valide chaque participant, un par un.',
                )
                : t(
                  'eventWizard.steps.access.validationAutoHint',
                  'Les participants confirment seuls leur présence — recommandé.',
                )}
            </ChoiceHint>

            {isOpenTraining ? (
              <View style={[Spaces.marginTop[16]]}>
                <GroupLabel>
                  {t(
                    'eventWizard.steps.validation.externalTitle',
                    'Validation des joueurs externes',
                  )}
                </GroupLabel>
                <SegmentedControl
                  centerContent
                  onChange={setExternalParticipantValidationMode}
                  options={validationOptions}
                  value={externalParticipantValidationMode}
                />
                <ChoiceHint>
                  {externalParticipantValidationMode === 'manual'
                    ? t(
                      'eventWizard.steps.access.externalManualHint',
                      'Chaque joueur exterieur au club passe par toi.',
                    )
                    : t(
                      'eventWizard.steps.access.externalAutoHint',
                      'Les joueurs exterieurs au club rejoignent la séance sans validation.',
                    )}
                </ChoiceHint>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={[Spaces.marginTop[16]]}>
          <GroupLabel>
            {t('eventWizard.steps.access.advancedGroup', 'Avancé')}
          </GroupLabel>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ expanded: isIdentityExpanded }}
            onPress={() => setIsIdentityExpanded((current) => !current)}
            style={advancedRowStyle}
          >
            <Text style={[Fonts.p2, Fonts.neutral00, { flex: 1 }]}>
              {t('eventWizard.steps.access.identityRow', 'Identités des participants')}
            </Text>
            <Text style={[Fonts.p3Bold, Fonts.neutral200]}>
              {identityValueLabel}
            </Text>
            <Text style={[Fonts.p3Bold, Fonts.neutral300]}>
              {isIdentityExpanded ? '−' : '›'}
            </Text>
          </TouchableOpacity>

          {isIdentityExpanded ? (
            <View style={[Spaces.marginTop[8]]}>
              <SegmentedControl
                centerContent
                onChange={setParticipantIdentityVisibility}
                options={identityOptions}
                value={participantIdentityVisibility}
              />
              <ChoiceHint>
                {participantIdentityVisibility === 'ANONYMIZED'
                  ? t(
                    'eventWizard.steps.access.identityAnonymizedHint',
                    'Les autres ne verront que le nombre de participants.',
                  )
                  : t(
                    'eventWizard.steps.access.identityVisibleHint',
                    'Les participants apparaissent avec leur nom et leur photo.',
                  )}
              </ChoiceHint>
            </View>
          ) : null}
        </View>
      </View>
    </WizardStepLayout>
  );
}

export default EventWizardAccess;
