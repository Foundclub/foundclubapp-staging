import {
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { useAdWizard } from './AdWizardContext';
import {
  getAdWizardDescriptionStepIndex,
  getAdWizardStepCount,
} from './adWizardStepUtils';

/**
 * Wizard step for the optional copy.
 * @param {{ navigation: any }} props
 * @returns {import('react').ReactElement}
 */
function AdWizardDescription({ navigation }) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { dispatch, state } = useAdWizard();

  const handleChange = (text) => {
    dispatch({ payload: text.slice(0, 500), type: 'SET_DESCRIPTION' });
  };

  const handleNext = () => {
    navigation.navigate(RouteNames.AdWizardRecap);
  };

  const handleSkip = () => {
    dispatch({ payload: '', type: 'SET_DESCRIPTION' });
    navigation.navigate(RouteNames.AdWizardRecap);
  };

  const cardSurfaceStyle = {
    backgroundColor: 'rgba(4, 31, 44, 0.82)',
    borderColor: 'rgba(1, 179, 244, 0.24)',
  };
  const contextualHighlights = [
    state.team?.name ? `\u00C9quipe : ${state.team.name}` : null,
    state.positions.length > 0
      ? `${state.positions.length} poste${state.positions.length > 1 ? 's' : ''} s\u00E9lectionn\u00E9${state.positions.length > 1 ? 's' : ''}`
      : null,
    state.address?.label ? `Lieu : ${state.address.label}` : null,
  ].filter(Boolean);
  const descriptionTips = [
    "Pr\u00E9cisez l'intensit\u00E9 ou le niveau de jeu attendu.",
    'Indiquez les horaires et le rythme des entra\u00EEnements.',
    "Mentionnez si une s\u00E9ance d'essai ou une d\u00E9tection est pr\u00E9vue.",
    "D\u00E9crivez l'ambiance et le projet sportif de l'\u00E9quipe.",
  ];

  return (
    <WizardStepLayout
      nextLabel="Suivant"
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      onSkip={handleSkip}
      showSkip
      stepCount={getAdWizardStepCount(state)}
      stepIndex={getAdWizardDescriptionStepIndex(state)}
      subtitle={'Ajoutez quelques d\u00E9tails pour rendre votre annonce plus claire et plus attractive.'}
      title="Description"
    >
      <View style={[Spaces.gap[20]]}>
        {contextualHighlights.length > 0 ? (
          <View style={[ApplicationStyle.card, Spaces.padding[20], Spaces.gap[12], cardSurfaceStyle]}>
            <Text style={[Fonts.p3Bold, Fonts.primary500]}>
              {'Contexte de l\'annonce'}
            </Text>
            <View style={[Spaces.gap[8]]}>
              {contextualHighlights.map((highlight) => (
                <Text key={highlight} style={[Fonts.p2, Fonts.neutral100]}>
                  {highlight}
                </Text>
              ))}
            </View>
          </View>
        ) : null}

        <View style={[ApplicationStyle.card, Spaces.padding[20], Spaces.gap[16], cardSurfaceStyle]}>
          <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
            <View style={[Spaces.gap[8], { flex: 1 }]}>
              <Text style={[Fonts.h4, Fonts.neutral00]}>{'Pr\u00E9sentez votre besoin'}</Text>
              <Text style={[Fonts.p2, Fonts.neutral100]}>
                Quelques lignes suffisent pour donner envie aux bons profils de candidater.
              </Text>
            </View>

            <View
              style={[
                Spaces.paddingHorizontal[10],
                Spaces.paddingVertical[6],
                {
                  backgroundColor: 'rgba(1, 179, 244, 0.14)',
                  borderColor: 'rgba(1, 179, 244, 0.32)',
                  borderRadius: 999,
                  borderWidth: 1,
                },
              ]}
            >
              <Text style={[Fonts.p4Bold, Fonts.primary500]}>Optionnel</Text>
            </View>
          </View>

          <TextInput
            multiline
            numberOfLines={7}
            onChangeText={handleChange}
            placeholder={'Ex. Nous recherchons un gardien exp\u00E9riment\u00E9 pour notre \u00E9quipe U20 qui \u00E9volue en r\u00E9gional. Entra\u00EEnements les mardis et jeudis soir, ambiance s\u00E9rieuse et bienveillante.'}
            placeholderTextColor={Colors.neutral500}
            style={[
              Fonts.p1,
              styles.input,
              {
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                borderColor: state.description.length > 0 ? Colors.primary500 : 'rgba(1, 179, 244, 0.18)',
                color: Colors.neutral00,
              },
            ]}
            textAlignVertical="top"
            value={state.description}
          />

          <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
            <Text style={[Fonts.p3, Fonts.neutral300]}>
              {state.description.length > 0
                ? 'Votre description est pr\u00EAte \u00E0 \u00EAtre publi\u00E9e.'
                : 'Vous pouvez aussi continuer sans description.'}
            </Text>
            <Text
              style={[
                Fonts.p3Bold,
                state.description.length >= 450 ? Fonts.gold500 : Fonts.neutral300,
              ]}
            >
              {state.description.length}
              {' '}
              / 500
            </Text>
          </View>
        </View>

        <View style={[ApplicationStyle.card, Spaces.padding[20], Spaces.gap[12], cardSurfaceStyle]}>
          <Text style={[Fonts.h4, Fonts.neutral00]}>{'Id\u00E9es \u00E0 inclure'}</Text>
          <View style={[Spaces.gap[12]]}>
            {descriptionTips.map((tip) => (
              <View key={tip} style={[Alignments.row, Spaces.gap[12]]}>
                <View
                  style={{
                    backgroundColor: Colors.primary500,
                    borderRadius: 999,
                    height: 8,
                    marginTop: 8,
                    width: 8,
                  }}
                />
                <Text style={[Fonts.p2, Fonts.neutral100, { flex: 1 }]}>{tip}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </WizardStepLayout>
  );
}

const styles = StyleSheet.create({
  input: {
    borderRadius: 18,
    borderWidth: 1,
    lineHeight: 22,
    minHeight: 170,
    padding: 20,
  },
});

export default AdWizardDescription;
