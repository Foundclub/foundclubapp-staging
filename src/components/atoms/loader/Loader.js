import { ActivityIndicator } from 'react-native';
// Hooks
import useTheme from '@/theme/themeContext';

/**
 * Small loader component.
 * @param {object} props
 * @param {number | 'small' | 'large'} [props.size]
 * @param {string} [props.color]
 * @returns {import('react').ReactElement}
 */
function Loader({ color = undefined, size = 'small' }) {
  const { Colors } = useTheme();
  return <ActivityIndicator color={color || Colors.primary500} size={size} />;
}

export default Loader;
