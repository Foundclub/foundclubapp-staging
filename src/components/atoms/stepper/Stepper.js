import { Dimensions, View } from 'react-native';

import useTheme from '../../../theme/themeContext';

/**
 * Stepper component.
 * @param {object} props - Component props.
 * @param {number} props.steps - Steps.
 * @param {number} props.currentStep - Current step.
 * @returns {React.ReactElement} Stepper component
 */
function Stepper({ currentStep, steps }) {
  const { Alignments, ApplicationStyle } = useTheme();
  const windowWidth = Dimensions.get('window').width;

  return (
    <View style={[
      Alignments.fullWidth,
      Alignments.relative,
      { height: 4, width: windowWidth - 155 },
    ]}
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
          { height: 4, width: `${(currentStep / steps) * 100}%` },
        ]}
      />
    </View>
  );
}

export default Stepper;
