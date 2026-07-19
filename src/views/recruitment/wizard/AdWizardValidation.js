import { Text, TouchableOpacity, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { useAdWizard } from './AdWizardContext';
import {
  getAdWizardStepCount,
  getAdWizardValidationStepIndex,
} from './adWizardStepUtils';

const VALIDATION_MODES = [
  {
    eyebrow: 'Fluide',
    helper: 'Idéal si tes critères sont déjà très précis.',
    highlights: ['Réponse immédiate', 'Parcours plus rapide'],
    label: 'Automatique',
    summary: 'Les joueurs compatibles sont acceptés sans attendre une validation manuelle.',
    value: 'auto',
  },
  {
    eyebrow: 'Contrôle',
    helper: 'Recommandé si tu souhaites valider chaque profil.',
    highlights: ['Validation capitaine', 'Tri avant confirmation'],
    label: 'Manuelle',
    summary: "Tu confirmes chaque candidature avant qu'elle ne rejoigne l'événement.",
    value: 'manual',
  },
];

/**
 * Wizard step for choosing auto or manual validation.
 * @param {{ navigation: any }} props
 * @returns {import('react').ReactElement}
 */
function AdWizardValidation({ navigation }) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { dispatch, state } = useAdWizard();

  const handleSelectMode = (mode) => {
    dispatch({ payload: mode, type: 'SET_VALIDATION_MODE' });
  };

  const handleNext = () => {
    navigation.navigate(RouteNames.AdWizardDescription);
  };

  const cardSurfaceStyle = {
    backgroundColor: 'rgba(4, 31, 44, 0.82)',
    borderColor: 'rgba(1, 179, 244, 0.24)',
  };

  return (
    <WizardStepLayout
      nextLabel="Suivant"
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      stepCount={getAdWizardStepCount(state)}
      stepIndex={getAdWizardValidationStepIndex(state)}
      subtitle="Choisis comment les candidatures liées à cette détection seront traitées."
      title="Mode de validation"
    >
      <View style={[Spaces.gap[24], Spaces.paddingBottom[32]]}>
        {state.event ? (
          <View style={[ApplicationStyle.card, Spaces.padding[24], Spaces.gap[24], cardSurfaceStyle]}>
            <Text style={[Fonts.p3Bold, Fonts.primary500]}>
              Annonce liée à une détection
            </Text>
            <Text style={[Fonts.h4, Fonts.neutral00]}>
              {state.event.name || state.event.type?.name || 'Événement'}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral100, { lineHeight: 24 }]}>
              Ce réglage détermine la manière dont les candidatures seront acceptées sur cette annonce.
            </Text>
          </View>
        ) : null}

        {VALIDATION_MODES.map((mode) => {
          const isSelected = state.validationMode === mode.value;

          return (
            <TouchableOpacity
              activeOpacity={0.92}
              key={mode.value}
              onPress={() => handleSelectMode(mode.value)}
              style={[
                ApplicationStyle.card,
                Spaces.padding[24],
                Spaces.gap[24],
                {
                  backgroundColor: isSelected ? 'rgba(1, 179, 244, 0.16)' : 'rgba(4, 31, 44, 0.82)',
                  borderColor: isSelected ? Colors.primary500 : 'rgba(1, 179, 244, 0.24)',
                  borderWidth: isSelected ? 1.5 : 1,
                },
              ]}
            >
              <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[16]]}>
                <View
                  style={[
                    Spaces.paddingHorizontal[12],
                    Spaces.paddingVertical[8],
                    {
                      backgroundColor: isSelected ? 'rgba(1, 179, 244, 0.20)' : 'rgba(255, 255, 255, 0.06)',
                      borderColor: isSelected ? 'rgba(1, 179, 244, 0.36)' : 'rgba(255, 255, 255, 0.08)',
                      borderRadius: 999,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <Text style={[Fonts.p4Bold, isSelected ? Fonts.primary500 : Fonts.neutral300]}>
                    {mode.eyebrow}
                  </Text>
                </View>

                <View
                  style={{
                    alignItems: 'center',
                    backgroundColor: isSelected ? Colors.primary500 : 'transparent',
                    borderColor: isSelected ? Colors.primary500 : 'rgba(1, 179, 244, 0.32)',
                    borderRadius: 14,
                    borderWidth: 1.5,
                    height: 28,
                    justifyContent: 'center',
                    width: 28,
                  }}
                >
                  {isSelected ? (
                    <Text style={[Fonts.p3Bold, { color: Colors.neutral900 }]}>OK</Text>
                  ) : null}
                </View>
              </View>

              <View style={[Spaces.gap[12]]}>
                <Text style={[Fonts.h4, Fonts.neutral00]}>{mode.label}</Text>
                <Text style={[Fonts.p2, Fonts.neutral100, { lineHeight: 24 }]}>{mode.summary}</Text>
                <Text style={[Fonts.p3, Fonts.neutral300]}>{mode.helper}</Text>
              </View>

              <View style={[Alignments.row, Alignments.wrap, Spaces.gap[12]]}>
                {mode.highlights.map((highlight) => (
                  <View
                    key={highlight}
                    style={[
                      ApplicationStyle.card,
                      Spaces.paddingHorizontal[12],
                      Spaces.paddingVertical[8],
                      {
                        backgroundColor: 'rgba(1, 179, 244, 0.08)',
                        borderColor: 'rgba(1, 179, 244, 0.20)',
                      },
                    ]}
                  >
                    <Text style={[Fonts.p4Bold, Fonts.neutral100]}>{highlight}</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          );
        })}

        <View
          style={[
            ApplicationStyle.card,
            Spaces.padding[24],
            Spaces.gap[16],
            {
              backgroundColor: 'rgba(1, 179, 244, 0.08)',
              borderColor: 'rgba(1, 179, 244, 0.18)',
            },
          ]}
        >
          <Text style={[Fonts.p3Bold, Fonts.primary500]}>À retenir</Text>
          <Text style={[Fonts.p2, Fonts.neutral100, { lineHeight: 24 }]}>
            Tu pourras toujours consulter les profils reçus ensuite dans le détail de l&apos;annonce.
          </Text>
        </View>
      </View>
    </WizardStepLayout>
  );
}

export default AdWizardValidation;
