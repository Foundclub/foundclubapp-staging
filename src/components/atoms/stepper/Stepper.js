import { Dimensions, View } from 'react-native';

import useTheme from '../../../theme/themeContext';

/**
 * Stepper component.
 *
 * D15 - c'est desormais LA seule progression de l'inscription : elle sert les
 * trois parcours, etape club comprise. Le stepper segmente qui ne servait que
 * cette etape-la a ete supprime.
 *
 * Elle porte son role d'accessibilite : sans lui, un lecteur d'ecran ne voyait
 * que deux rectangles muets. Le compteur « n/N » affiche a cote reste, lui, du
 * ressort de l'appelant.
 * @param {object} props - Component props.
 * @param {number} props.steps - Steps.
 * @param {number} props.currentStep - Current step.
 * @returns {React.ReactElement | null} Stepper component, ou rien s'il n'y a pas de progression a montrer.
 */
function Stepper({ currentStep, steps }) {
  const { Alignments, ApplicationStyle } = useTheme();
  const windowWidth = Dimensions.get('window').width;

  const total = Math.max(0, Math.trunc(Number(steps) || 0));
  const filled = Math.min(total, Math.max(0, Math.trunc(Number(currentStep) || 0)));

  // D15 - `getStepNumber` rend 0 quand la route courante n'est dans aucun
  // parcours, et `views` peut etre vide : l'entete affichait alors « 0/13 ».
  // Pas de progression vaut mieux qu'un zero. Le garde est pose ICI, au seul
  // endroit que tous les appelants traversent - et il evite au passage la
  // division par zero de la largeur.
  if (total === 0 || filled === 0) return null;

  return (
    <View
      accessibilityLabel={`Étape ${filled} sur ${total}`}
      accessibilityRole="progressbar"
      style={[
        Alignments.fullWidth,
        Alignments.relative,
        { height: 4, width: windowWidth - 155 },
      ]}
      testID="onboarding-stepper"
    >
      <View
        style={[
          Alignments.absolute,
          Alignments.fullSize,
          ApplicationStyle.backgroundColor.neutral700,
          ApplicationStyle.borderRadius2,
        ]}
      />
      <View
        style={[
          Alignments.absolute,
          Alignments.fullHeight,
          ApplicationStyle.backgroundColor.primary500,
          ApplicationStyle.borderRadius2,
          { height: 4, width: `${(filled / total) * 100}%` },
        ]}
      />
    </View>
  );
}

export default Stepper;
