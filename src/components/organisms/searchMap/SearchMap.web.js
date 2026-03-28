import { TouchableOpacity, View } from 'react-native';

import useTheme from '@/theme/themeContext';
import { renderMap } from '@/platform/maps';

/**
 * Lightweight web fallback for the mobile map explorer.
 * @param {object} props
 * @param {() => void} [props.onToggleMap]
 * @returns {import('react').ReactElement}
 */
function SearchMap({ onToggleMap }) {
  const { Spaces } = useTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onToggleMap}
      style={[Spaces.marginTop[12]]}
    >
      <View>
        {renderMap({
          height: 320,
          message: 'La carte FoundClub sera adaptee pour le web dans une prochaine vague.',
        })}
      </View>
    </TouchableOpacity>
  );
}

export default SearchMap;
