import { View } from 'react-native';

import useTheme from '@/theme/themeContext';
import { renderMap } from '@/platform/maps';

/**
 * Web map explorer aligned with the shared mobile props.
 * @param {object} props
 * @param {any[]} [props.items]
 * @param {(item: any) => void} [props.onMarkerPress]
 * @param {'event' | 'club'} [props.type]
 * @returns {import('react').ReactElement}
 */
function SearchMap({ items = [], onMarkerPress, type = 'event' }) {
  const { Spaces } = useTheme();

  return (
    <View style={[Spaces.marginTop[12], { minHeight: 320 }]}>
      <View style={{ flex: 1 }}>
        {renderMap({
          height: 320,
          items,
          message: type === 'club'
            ? 'Aucun club geolocalisable pour le moment.'
            : 'Aucun evenement geolocalisable pour le moment.',
          onMarkerPress,
          type,
        })}
      </View>
    </View>
  );
}

export default SearchMap;
