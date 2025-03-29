import { ActivityIndicator } from 'react-native';
// hooks
import useTheme from '../../../theme/themeContext';

/**
 * Small loader component.
 * @param {object} props
 * @param {number | 'small' | 'large'} [props.size]
 * @param {string} [props.color]
 * @returns {import('react').ReactElement}
 */
function Loader({ size = 'small', color = null }) {
  const { Colors } = useTheme();
  return <ActivityIndicator size={size} color={color || Colors.primary500} />;
}

export default Loader;
