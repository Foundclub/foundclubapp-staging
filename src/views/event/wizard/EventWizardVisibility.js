import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { useEventWizard } from './EventWizardContext';
import {
  getEventWizardStepCount,
  getEventWizardVisibilityStepIndex,
  shouldSkipEventWizardParticipantsStep,
} from './eventWizardDetectionUtils';

const VISIBILITY_OPTIONS = [
  {
    description:
      "L'evenement peut etre decouvert publiquement selon les regles du club et de l'application.",
    helper:
      'Utile pour les portes ouvertes, initiations et evenements visibles a plus grande echelle.',
    key: 'open',
    title: 'Evenement public',
  },
  {
    description:
      "L'evenement reste reserve au groupe concerne, aux membres invites et aux encadrants autorises.",
    helper:
      'Ideal pour les entrainements, convocations internes et evenements reserves a une equipe.',
    key: 'closed',
    title: 'Evenement prive',
  },
];

const PARTICIPANT_IDENTITY_OPTIONS = [
  {
    description:
      'Les participants apparaissent avec leur nom, leur prenom et leur photo selon les regles habituelles.',
    helper:
      "Pratique quand les participants doivent pouvoir s'identifier facilement entre eux.",
    key: 'VISIBLE',
    title: 'Identites visibles',
  },
  {
    description:
      'Les autres utilisateurs verront uniquement le nombre de participants et des profils anonymises.',
    helper:
      'Recommande si tu veux proteger les mineurs ou limiter la diffusion des identites.',
    key: 'ANONYMIZED',
    title: 'Participants anonymises',
  },
];

/**
 *
 * @param root0
 * @param root0.navigation
 */
function EventWizardVisibility({ navigation }) {
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
    navigation.navigate(
      shouldSkipEventWizardParticipantsStep(projectedState)
        ? RouteNames.EventWizardValidationMode
        : RouteNames.EventWizardParticipants,
    );
  };

  return (
    <WizardStepLayout
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      stepCount={getEventWizardStepCount(projectedState)}
      stepIndex={getEventWizardVisibilityStepIndex(projectedState)}
      subtitle={t(
        'eventWizard.steps.visibility.subtitle',
        "Choisis d'abord si l'evenement est public ou prive, puis regle la visibilite des participants.",
      )}
      title={t('eventWizard.steps.visibility.title')}
    >
      <View style={[Spaces.gap[24], Spaces.paddingBottom[24]]}>
        <View style={[Spaces.gap[16]]}>
          <Text style={[Fonts.h4, Fonts.neutral00]}>
            {t('eventWizard.steps.visibility.eventAccessTitle', "Visibilite de l'evenement")}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {t(
              'eventWizard.steps.visibility.eventAccessSubtitle',
              "Definis si l'evenement peut etre vu publiquement ou s'il reste reserve au groupe.",
            )}
          </Text>
          {VISIBILITY_OPTIONS.map((option) => {
            const selected = sessionStatus === option.key;
            return renderOptionCard(
              option,
              selected,
              () => setSessionStatus(option.key),
              option.key === 'open' ? 'Selection actuelle : public' : 'Selection actuelle : prive',
            );
          })}
        </View>

        <View style={[Spaces.gap[16]]}>
          <Text style={[Fonts.h4, Fonts.neutral00]}>
            {t('eventWizard.steps.visibility.participantPrivacyTitle', 'Visibilite des participants')}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {t(
              'eventWizard.steps.visibility.participantPrivacySubtitle',
              'Choisissez si les noms, prenoms et photos des participants restent visibles.',
            )}
          </Text>
          {PARTICIPANT_IDENTITY_OPTIONS.map((option) => {
            const selected = participantIdentityVisibility === option.key;
            return renderOptionCard(
              option,
              selected,
              () => setParticipantIdentityVisibility(option.key),
              option.key === 'VISIBLE'
                ? 'Selection actuelle : identites visibles'
                : 'Selection actuelle : participants anonymises',
            );
          })}
        </View>
      </View>
    </WizardStepLayout>
  );
}

export default EventWizardVisibility;
