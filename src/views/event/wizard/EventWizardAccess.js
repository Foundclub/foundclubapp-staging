// @ts-nocheck
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { hasExternalAudience, isTrainingEventType } from '@/domains/event/eventUseCases';
import useTheme from '@/theme/themeContext';

import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { useEventWizard } from './EventWizardContext';
import {
  getDefaultSessionStatusForEventType,
  getEventWizardAccessStepIndex,
  getEventWizardExitRoute,
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
 * @param {{ navigation: any, route: any }} props Proprietes d'ecran.
 * @returns {import('react').ReactElement} L'etape rendue.
 */
function EventWizardAccess({ navigation, route }) {
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
  // 🔒 AA10 ③ — le repli suit le TYPE, il ne rouvre pas l'evenement. Un
  // `|| 'open'` ici annulerait le defaut prive au premier etat incomplet.
  const [sessionStatus, setSessionStatus] = useState(
    state.sessionStatus || getDefaultSessionStatusForEventType(state.type?.name),
  );
  const [validationMode, setValidationMode] = useState(state.validationMode || 'auto');
  // La visibilite des identites est le seul reglage « avance » du pack : il
  // reste replie tant que personne ne le demande, mais sa VALEUR est toujours
  // lisible sur la rangee — un reglage cache dont on ignore l'etat serait pire
  // qu'un reglage deplie.
  const [isIdentityExpanded, setIsIdentityExpanded] = useState(false);

  const isTraining = isTrainingEventType(state.type?.name);
  const isTournament = isTournamentEventType(state?.type?.name);

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

  // R8 (D1) — UN REGLAGE QUI NE COMMANDE PERSONNE NE SE PROPOSE PAS.
  //
  // Sur un evenement prive, tout le monde est convie : la validation n'a aucun
  // effet (AA01, GO Adel du 2026-08-20). Le bloc entier disparait donc — et le
  // reglage des externes avec lui, puisqu'un prive n'en accueille aucun.
  // La regle se lit dans `hasExternalAudience`, ecrite une seule fois et
  // partagee avec les deux ecrans de modification.
  const canBeAskedToJoin = hasExternalAudience({ sessionStatus });
  const showValidationBlock = !isTournament && canBeAskedToJoin;

  // S11 (vague S) — REGLE CORRIGEE PAR ADEL LE 2026-08-25.
  //
  // R8 avait renomme cette pilule « Validation des demandes exterieures », ce
  // qui etait vrai a ce moment-la. Ca ne l'est plus : depuis S11 le serveur met
  // TOUJOURS une demande venue du dehors en attente de validation, sur les
  // TROIS portes d'entree. Ce reglage ne commande donc plus que les MEMBRES des
  // equipes conviees — la seule audience qui lui reste, et pour qui rien n'a
  // change. Le libelle le dit.
  const validationGroupLabel = isTraining
    ? t('eventWizard.steps.access.validationGroupInternal', 'Validation des membres internes')
    : t('eventWizard.steps.access.validationGroupMembers', 'Validation des membres');
  const validationHint = validationMode === 'manual'
    ? t(
      'eventWizard.steps.access.validationManualHint',
      'Le coach valide chaque participant, un par un.',
    )
    : t(
      'eventWizard.steps.access.validationAutoHint',
      'Les participants confirment seuls leur présence — recommandé.',
    );

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
          // S11 — les demandes exterieures sont validees a la main, toujours.
          // Il n'y a plus rien a choisir : on enregistre la seule valeur vraie,
          // pour que ce que porte l'evenement dise la meme chose que le serveur.
          externalParticipantValidationMode: 'manual',
          validationMode,
        },
        type: 'SET_VALIDATION_MODE',
      });
    }

    navigation.navigate(getEventWizardExitRoute(
      getEventWizardNextRoute(RouteNames.EventWizardAccess, projectedState),
      route?.params,
    ));
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

        {showValidationBlock ? (
          <View style={[Spaces.marginTop[16]]}>
            <GroupLabel>
              {validationGroupLabel}
            </GroupLabel>
            <SegmentedControl
              centerContent
              onChange={setValidationMode}
              options={validationOptions}
              value={validationMode}
            />
            <ChoiceHint>
              {validationHint}
            </ChoiceHint>

            {/* S11 — CE N'EST PLUS UN CHOIX, C'EST UNE INFORMATION. Le serveur
                met toute demande venue du dehors en attente, quoi qu'on lui
                envoie : proposer « automatique » ici serait un bouton sans fil. */}
            <View style={[Spaces.marginTop[16]]}>
              <GroupLabel>
                {t(
                  'eventWizard.steps.access.externalGroup',
                  'Demandes extérieures',
                )}
              </GroupLabel>
              <ChoiceHint>
                {t(
                  'eventWizard.steps.access.externalAlwaysManualHint',
                  'Les demandes extérieures sont validées par toi.',
                )}
              </ChoiceHint>
            </View>
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
