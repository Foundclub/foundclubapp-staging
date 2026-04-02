import { Text, TouchableOpacity, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { useAdWizard } from './AdWizardContext';
import { getAdWizardStepCount } from './adWizardStepUtils';

const VALIDATION_MODES = [
  {
    eyebrow: 'Fluide',
    helper: 'Id\u00E9al si vos crit\u00E8res sont d\u00E9j\u00E0 tr\u00E8s pr\u00E9cis.',
    highlights: ['R\u00E9ponse imm\u00E9diate', 'Parcours plus rapide'],
    label: 'Automatique',
    summary: 'Les joueurs compatibles sont accept\u00E9s sans attendre une validation manuelle.',
    value: 'auto',
  },
  {
    eyebrow: 'Contr\u00F4le',
    helper: 'Recommand\u00E9 si vous souhaitez valider chaque profil.',
    highlights: ['Validation capitaine', 'Tri avant confirmation'],
    label: 'Manuelle',
    summary: "Vous confirmez chaque candidature avant qu'elle ne rejoigne l'\u00E9v\u00E9nement.",
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
      stepIndex={4}
      subtitle={'Choisissez comment les candidatures li\u00E9es \u00E0 cette d\u00E9tection seront trait\u00E9es.'}
      title="Mode de validation"
    >
      <View style={[Spaces.gap[20]]}>
        {state.event ? (
          <View style={[ApplicationStyle.card, Spaces.padding[20], Spaces.gap[12], cardSurfaceStyle]}>
            <Text style={[Fonts.p3Bold, Fonts.primary500]}>
              {'Annonce li\u00E9e \u00E0 une d\u00E9tection'}
            </Text>
            <Text style={[Fonts.h4, Fonts.neutral00]}>
              {state.event.name || state.event.type?.name || '\u00C9v\u00E9nement'}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {'Ce r\u00E9glage d\u00E9termine la mani\u00E8re dont les candidatures seront accept\u00E9es sur cette annonce.'}
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
                Spaces.padding[20],
                Spaces.gap[16],
                {
                  backgroundColor: isSelected ? 'rgba(1, 179, 244, 0.16)' : 'rgba(4, 31, 44, 0.82)',
                  borderColor: isSelected ? Colors.primary500 : 'rgba(1, 179, 244, 0.24)',
                  borderWidth: isSelected ? 1.5 : 1,
                },
              ]}
            >
              <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
                <View
                  style={[
                    Spaces.paddingHorizontal[10],
                    Spaces.paddingVertical[6],
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

              <View style={[Spaces.gap[8]]}>
                <Text style={[Fonts.h4, Fonts.neutral00]}>{mode.label}</Text>
                <Text style={[Fonts.p2, Fonts.neutral100]}>{mode.summary}</Text>
                <Text style={[Fonts.p3, Fonts.neutral300]}>{mode.helper}</Text>
              </View>

              <View style={[Alignments.row, Alignments.wrap, Spaces.gap[8]]}>
                {mode.highlights.map((highlight) => (
                  <View
                    key={highlight}
                    style={[
                      ApplicationStyle.card,
                      Spaces.paddingHorizontal[10],
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
            Spaces.padding[20],
            Spaces.gap[12],
            {
              backgroundColor: 'rgba(255, 219, 102, 0.08)',
              borderColor: 'rgba(255, 219, 102, 0.24)',
            },
          ]}
        >
          <Text style={[Fonts.p3Bold, Fonts.gold500]}>{'\u00C0 retenir'}</Text>
          <Text style={[Fonts.p2, Fonts.neutral100]}>
            {"Vous pourrez toujours consulter les profils re\u00E7us ensuite dans le d\u00E9tail de l'annonce."}
          </Text>
        </View>
      </View>
    </WizardStepLayout>
  );
}

export default AdWizardValidation;
