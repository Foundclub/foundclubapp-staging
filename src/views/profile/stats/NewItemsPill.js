import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

/**
 * ST-VUES2 — LA PASTILLE CYAN « 1 NOUVEAU » (écran 16 du design validé, « Suivi »).
 * Le style de la planche (`.pastille-cyan`) : fond primary500 à 12 %, bord à 45 %,
 * texte primary200. Rien sous 1 : une rangée sans nouveauté garde sa valeur.
 * @param {object} props - Les propriétés du composant.
 * @param {number} props.count - Combien d'éléments sont nouveaux.
 * @returns {import('react').ReactElement | null} La pastille, ou rien.
 */
function NewItemsPill({ count }) {
  const { t } = useTranslation();
  const { Colors, Fonts } = useTheme();
  if (!(count > 0)) return null;

  return (
    <View
      style={{
        backgroundColor: withAlpha(Colors.primary500, 0.12),
        borderColor: withAlpha(Colors.primary500, 0.45),
        borderRadius: 24,
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 4,
      }}
    >
      <Text numberOfLines={1} style={[Fonts.p4Bold, { color: Colors.primary200 }]}>
        {t('newItemsPill.count', { count })}
      </Text>
    </View>
  );
}

export default NewItemsPill;
