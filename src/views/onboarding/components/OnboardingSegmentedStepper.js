import { StyleSheet, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

// Indicateur d'étape segmenté du handoff 6b : un segment par étape, les étapes
// franchies en cyan. Il remplace la barre continue (atoms/stepper/Stepper) pour
// l'étape club UNIQUEMENT — les autres écrans d'onboarding gardent la barre.
// Le compteur « 3/4 » disparaît de l'affichage : l'information passe par
// l'étiquette d'accessibilité, pour ne pas la perdre au lecteur d'écran.

/**
 * Indicateur d'étape segmenté.
 * @param {object} props
 * @param {number} props.currentStep - Nombre d'étapes franchies (1-based).
 * @param {number} props.steps - Nombre total d'étapes.
 * @returns {import('react').ReactElement | null}
 */
function OnboardingSegmentedStepper({ currentStep, steps }) {
  const { Colors } = useTheme();

  const total = Math.max(0, Math.trunc(Number(steps) || 0));
  if (total === 0) return null;
  const filled = Math.min(total, Math.max(0, Math.trunc(Number(currentStep) || 0)));

  return (
    <View
      accessibilityLabel={`Étape ${filled} sur ${total}`}
      accessibilityRole="progressbar"
      style={styles.row}
      testID="onboarding-segmented-stepper"
    >
      {Array.from({ length: total }, (unused, index) => (
        <View
          key={`segment-${String(index)}`}
          style={[
            styles.segment,
            {
              backgroundColor: index < filled
                ? Colors.primary500
                : withAlpha(Colors.neutral00, 0.16),
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    flexGrow: 1,
    gap: 6,
    minWidth: 120,
  },
  segment: {
    borderRadius: 2,
    flex: 1,
    height: 4,
  },
});

export default OnboardingSegmentedStepper;
