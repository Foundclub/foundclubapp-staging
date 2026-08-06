// @ts-nocheck
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { isTrainingEventType } from '@/domains/event/eventUseCases';
import useTheme from '@/theme/themeContext';

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
//
// Cet ecran reunit ce qui vivait dans `EventWizardVisibility` (public/prive et
// visibilite des participants) et dans `EventWizardValidationMode` (validation
// automatique ou manuelle). Les deux rendus sont DEPLACES tels quels : aucune
// couleur, aucune police, aucun espacement n'est touche — la peinture est le
// sujet des lots D09 et D10.
//
// Le bloc « validation » ne s'affiche PAS pour un tournoi, exactement comme
// avant : le tunnel tournoi ne traversait jamais `EventWizardValidationMode`,
// son `validationMode` etant deduit du mode d'inscription
// (`EventWizardTournamentSettings`). L'afficher ici aurait ajoute un reglage
// qui n'existait pas.

const VISIBILITY_OPTIONS = [
  {
    description:
      "L'événement peut être decouvert publiquement selon les règles du club et de l'application.",
    helper:
      'Utile pour les portes ouvertes, initiations et événements visibles à plus grande échelle.',
    key: 'open',
    title: 'Événement public',
  },
  {
    description:
      "L'événement reste réserve au groupe concerne, aux membres invites et aux encadrants autorises.",
    helper:
      'Ideal pour les entraînements, convocations internes et événements reserves a une équipe.',
    key: 'closed',
    title: 'Événement prive',
  },
];

const PARTICIPANT_IDENTITY_OPTIONS = [
  {
    description:
      'Les participants apparaissent avec leur nom, leur prénom et leur photo selon les règles habituelles.',
    helper:
      "Pratique quand les participants doivent pouvoir s'identifier facilement entre eux.",
    key: 'VISIBLE',
    title: 'Identités visibles',
  },
  {
    description:
      'Les autres utilisateurs verront uniquement le nombre de participants et des profils anonymisés.',
    helper:
      'Recommande si tu veux proteger les mineurs ou limiter la diffusion des identités.',
    key: 'ANONYMIZED',
    title: 'Participants anonymisés',
  },
];

const buildValidationOptions = (t) => ([
  {
    detailOne: t(
      'eventWizard.steps.validation.autoRuleOne',
      'Check-in simplifie pour les joueurs',
    ),
    detailTwo: t(
      'eventWizard.steps.validation.autoRuleTwo',
      'Ideal pour les sessions ouvertes',
    ),
    icon: 'A',
    isRecommended: true,
    key: 'auto',
    subtitle: t(
      'eventWizard.steps.validation.autoDesc',
      'Les participants peuvent confirmer automatiquement leur présence.',
    ),
    title: t('eventEdit.fields.validationMode.options.auto'),
  },
  {
    detailOne: t(
      'eventWizard.steps.validation.manualRuleOne',
      'Controle total par le staff',
    ),
    detailTwo: t(
      'eventWizard.steps.validation.manualRuleTwo',
      'Recommande pour les groupes fermes',
    ),
    icon: 'M',
    isRecommended: false,
    key: 'manual',
    subtitle: t(
      'eventWizard.steps.validation.manualDesc',
      'Le coach valide manuellement les participants.',
    ),
    title: t('eventEdit.fields.validationMode.options.manual'),
  },
]);

function ValidationChoiceGroup({
  Alignments,
  ApplicationStyle,
  Colors,
  Fonts,
  helperBorderColor,
  helperCardBg,
  options,
  recommendedChipBg,
  recommendedChipBorder,
  selectedAccentBg,
  selectedCardBg,
  selectedValue,
  setSelectedValue,
  Spaces,
  title,
  unselectedCardBg,
}) {
  const cardBorder = `${Colors.primary500}52`;
  const cardBorderSoft = `${Colors.primary500}36`;

  return (
    <View style={[Spaces.gap[12]]}>
      <Text style={[Fonts.h4, Fonts.neutral00]}>
        {title}
      </Text>
      <View style={[Spaces.gap[16]]}>
        {options.map((option) => {
          const selected = selectedValue === option.key;
          return (
            <TouchableOpacity
              accessibilityRole="button"
              key={`${title}-${option.key}`}
              onPress={() => setSelectedValue(option.key)}
              style={[
                ApplicationStyle.card,
                Spaces.paddingHorizontal[16],
                Spaces.paddingVertical[16],
                {
                  backgroundColor: selected ? selectedCardBg : unselectedCardBg,
                  borderColor: selected ? cardBorder : cardBorderSoft,
                  borderRadius: 18,
                  borderWidth: 1,
                },
              ]}
            >
              <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}>
                <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12], { flex: 1 }]}>
                  <View
                    style={[
                      ApplicationStyle.card,
                      Alignments.alignCenter,
                      Alignments.justifyCenter,
                      {
                        backgroundColor: selected ? selectedAccentBg : `${Colors.primary500}14`,
                        borderColor: selected ? Colors.primary500 : `${Colors.primary500}2F`,
                        borderRadius: 999,
                        height: 32,
                        width: 32,
                      },
                    ]}
                  >
                    <Text style={[Fonts.p3Bold, Fonts.primary500]}>{option.icon}</Text>
                  </View>
                  <View style={[Spaces.gap[8], { flex: 1 }]}>
                    <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
                      <Text style={[Fonts.h4, selected ? Fonts.primary100 : Fonts.neutral00]}>
                        {option.title}
                      </Text>
                      {option.isRecommended ? (
                        <View
                          style={[
                            ApplicationStyle.card,
                            Spaces.paddingHorizontal[8],
                            Spaces.paddingVertical[4],
                            {
                              backgroundColor: recommendedChipBg,
                              borderColor: recommendedChipBorder,
                              borderRadius: 999,
                            },
                          ]}
                        >
                          <Text style={[Fonts.p3Bold, Fonts.primary500]}>
                            Recommande
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={[Fonts.p2, Fonts.neutral100, { lineHeight: 24 }]}>
                      {option.subtitle}
                    </Text>
                  </View>
                </View>
                <View
                  style={[
                    ApplicationStyle.card,
                    Alignments.alignCenter,
                    Alignments.justifyCenter,
                    {
                      backgroundColor: selected ? Colors.primary500 : 'transparent',
                      borderColor: selected ? Colors.primary500 : `${Colors.primary500}54`,
                      borderRadius: 999,
                      height: 22,
                      width: 22,
                    },
                  ]}
                >
                  <Text style={[Fonts.p3Bold, selected ? Fonts.neutral900 : Fonts.primary500]}>
                    {selected ? 'OK' : ''}
                  </Text>
                </View>
              </View>

              <View style={[Spaces.marginTop[12], Spaces.gap[8]]}>
                <Text style={[Fonts.p3, Fonts.neutral100, { lineHeight: 20 }]}>
                  {`- ${option.detailOne}`}
                </Text>
                <Text style={[Fonts.p3, Fonts.neutral100, { lineHeight: 20 }]}>
                  {`- ${option.detailTwo}`}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View
        style={[
          Alignments.row,
          Alignments.alignCenter,
          Spaces.gap[8],
          Spaces.paddingVertical[12],
          Spaces.paddingHorizontal[12],
          {
            backgroundColor: helperCardBg,
            borderColor: helperBorderColor,
            borderRadius: 14,
            borderWidth: 1,
          },
        ]}
      >
        <Text style={[Fonts.p3Bold, Fonts.primary500]}>
          Selection:
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral100]}>
          {selectedValue === 'manual' ? 'Manuelle' : 'Automatique'}
        </Text>
      </View>
    </View>
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
    Colors,
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

  const validationOptions = useMemo(() => buildValidationOptions(t), [t]);
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

  const cardSurfaceStyle = {
    backgroundColor: 'rgba(4, 31, 44, 0.82)',
    borderColor: 'rgba(1, 179, 244, 0.24)',
    borderWidth: 1,
  };

  const selectedAccentBg = `${Colors.primary500}2A`;
  const selectedCardBg = `${Colors.primary500}17`;
  const unselectedCardBg = `${Colors.primary700}D0`;
  const recommendedChipBg = `${Colors.primary500}21`;
  const recommendedChipBorder = `${Colors.primary500}55`;
  const helperCardBg = `${Colors.primary500}0F`;
  const helperCardBorder = `${Colors.primary500}3A`;

  const renderOptionCard = (option, selected, onPress, selectionLabel) => (
    <TouchableOpacity
      activeOpacity={0.92}
      key={option.key}
      onPress={onPress}
      style={[
        ApplicationStyle.card,
        Spaces.padding[24],
        Spaces.gap[16],
        selected
          ? {
            backgroundColor: 'rgba(1, 179, 244, 0.14)',
            borderColor: Colors.primary500,
            borderWidth: 1,
          }
          : cardSurfaceStyle,
      ]}
    >
      <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[16]]}>
        <View style={{ flex: 1 }}>
          <Text style={[Fonts.h4, selected ? Fonts.primary100 : Fonts.neutral00]}>
            {option.title}
          </Text>
        </View>
        <View
          style={[
            Alignments.alignCenter,
            Alignments.justifyCenter,
            {
              backgroundColor: selected ? `${Colors.primary500}18` : 'transparent',
              borderColor: selected ? Colors.primary500 : 'rgba(255,255,255,0.28)',
              borderRadius: 12,
              borderWidth: 2,
              height: 24,
              width: 24,
            },
          ]}
        >
          {selected ? (
            <View
              style={{
                backgroundColor: Colors.primary500,
                borderRadius: 5,
                height: 10,
                width: 10,
              }}
            />
          ) : null}
        </View>
      </View>
      <Text style={[Fonts.p2, Fonts.neutral200]}>
        {option.description}
      </Text>
      <View
        style={[
          Alignments.selfStart,
          Spaces.paddingHorizontal[12],
          Spaces.paddingVertical[8],
          {
            backgroundColor: selected ? `${Colors.primary500}16` : 'rgba(255,255,255,0.05)',
            borderColor: selected ? `${Colors.primary500}66` : 'rgba(255,255,255,0.08)',
            borderRadius: 999,
            borderWidth: 1,
          },
        ]}
      >
        <Text style={[selected ? Fonts.p3Bold : Fonts.p3, selected ? Fonts.primary100 : Fonts.neutral200]}>
          {selected ? selectionLabel : option.helper}
        </Text>
      </View>
    </TouchableOpacity>
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
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      stepCount={getEventWizardStepCount(projectedState)}
      stepIndex={getEventWizardAccessStepIndex(projectedState)}
      subtitle={t(
        'eventWizard.steps.access.subtitle',
        "Choisis qui voit l'événement, puis comment les présences sont validées.",
      )}
      title={t('eventWizard.steps.access.title', "Accès à l'événement")}
    >
      <View style={[Spaces.gap[24], Spaces.paddingBottom[24]]}>
        <View style={[Spaces.gap[16]]}>
          <Text style={[Fonts.h4, Fonts.neutral00]}>
            {t('eventWizard.steps.visibility.eventAccessTitle', "Visibilité de l'événement")}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {t(
              'eventWizard.steps.visibility.eventAccessSubtitle',
              "Définis si l'événement peut être vu publiquement ou s'il reste réserve au groupe.",
            )}
          </Text>
          {VISIBILITY_OPTIONS.map((option) => {
            const selected = sessionStatus === option.key;
            return renderOptionCard(
              option,
              selected,
              () => setSessionStatus(option.key),
              option.key === 'open' ? 'Sélection actuelle : public' : 'Sélection actuelle : prive',
            );
          })}
        </View>

        <View style={[Spaces.gap[16]]}>
          <Text style={[Fonts.h4, Fonts.neutral00]}>
            {t('eventWizard.steps.visibility.participantPrivacyTitle', 'Visibilité des participants')}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {t(
              'eventWizard.steps.visibility.participantPrivacySubtitle',
              'Choisis si les noms, prénoms et photos des participants restent visibles.',
            )}
          </Text>
          {PARTICIPANT_IDENTITY_OPTIONS.map((option) => {
            const selected = participantIdentityVisibility === option.key;
            return renderOptionCard(
              option,
              selected,
              () => setParticipantIdentityVisibility(option.key),
              option.key === 'VISIBLE'
                ? 'Sélection actuelle : identités visibles'
                : 'Sélection actuelle : participants anonymisés',
            );
          })}
        </View>

        {!isTournament ? (
          <View style={[Spaces.gap[16]]}>
            <ValidationChoiceGroup
              Alignments={Alignments}
              ApplicationStyle={ApplicationStyle}
              Colors={Colors}
              Fonts={Fonts}
              helperBorderColor={helperCardBorder}
              helperCardBg={helperCardBg}
              options={validationOptions}
              recommendedChipBg={recommendedChipBg}
              recommendedChipBorder={recommendedChipBorder}
              selectedAccentBg={selectedAccentBg}
              selectedCardBg={selectedCardBg}
              selectedValue={validationMode}
              setSelectedValue={setValidationMode}
              Spaces={Spaces}
              title={t(
                isTraining
                  ? 'eventWizard.steps.validation.internalTitle'
                  : 'eventWizard.steps.validation.defaultTitle',
                isTraining ? 'Validation des membres internes' : 'Validation principale',
              )}
              unselectedCardBg={unselectedCardBg}
            />

            {isOpenTraining ? (
              <ValidationChoiceGroup
                Alignments={Alignments}
                ApplicationStyle={ApplicationStyle}
                Colors={Colors}
                Fonts={Fonts}
                helperBorderColor={helperCardBorder}
                helperCardBg={helperCardBg}
                options={validationOptions}
                recommendedChipBg={recommendedChipBg}
                recommendedChipBorder={recommendedChipBorder}
                selectedAccentBg={selectedAccentBg}
                selectedCardBg={selectedCardBg}
                selectedValue={externalParticipantValidationMode}
                setSelectedValue={setExternalParticipantValidationMode}
                Spaces={Spaces}
                title={t(
                  'eventWizard.steps.validation.externalTitle',
                  'Validation des joueurs externes',
                )}
                unselectedCardBg={unselectedCardBg}
              />
            ) : null}
          </View>
        ) : null}
      </View>
    </WizardStepLayout>
  );
}

export default EventWizardAccess;
