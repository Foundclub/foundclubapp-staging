import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import useTheme from '@/theme/themeContext';

// COLL-C2B (02/10) — design HY521H1 (`.places`) : la place d une installation, en image. Sert a
// la carte « Place libre » (attribuer) et a la ligne de capacite du planning.

/**
 * Les places d une installation en image : un rond par place, plein quand elle est prise.
 * @param {{ capacite: number, prises: number, pleine: boolean }} props
 * @returns {import('react').ReactElement} Les ronds.
 */
function RondsDePlaces({ capacite, pleine, prises }) {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const couleur = pleine ? Colors.warning500 : Colors.success500;
  const nombre = Math.max(1, Math.min(10, Number(capacite) || 1));
  return (
    <View
      accessibilityLabel={t(
        'collectiviteCreneaux.attribuer.places',
        'Places prises : {{prises}} sur {{capacite}}',
        {
          capacite: nombre,
          prises: Math.min(prises, nombre),
        },
      )}
      accessibilityRole="image"
      style={{ flexDirection: 'row', gap: 4 }}
    >
      {Array.from({ length: nombre }, (_, index) => (
        <View
          key={`place-${index + 1}`}
          style={{
            backgroundColor: index < prises ? couleur : 'transparent',
            borderColor: couleur,
            borderRadius: 999,
            borderWidth: 1.5,
            height: 10,
            width: 10,
          }}
        />
      ))}
    </View>
  );
}

export default RondsDePlaces;
