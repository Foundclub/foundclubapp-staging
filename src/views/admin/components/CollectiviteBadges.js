import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { collectiviteInitial } from '@/domains/collectivite/collectiviteConsole';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

/**
 * 🏛️ COLL-CONSOLE (02/10/2026) — les petites marques de la console des collectivités
 * (design HY521H1, page 2) : la pastille d'état et l'écusson d'une collectivité, la pastille
 * de l'offre d'un club. Partagées par la liste et la fiche.
 */

/**
 * Une pastille à point : un rond de couleur et son libellé.
 * @param {{ color: string, label: string, testID?: string }} props - La couleur et le texte.
 * @returns {import('react').ReactElement} La pastille.
 */
export function PastilleAPoint({ color, label, testID = undefined }) {
  const { Alignments, Fonts } = useTheme();
  return (
    <View style={[Alignments.row, Alignments.alignCenter, { gap: 6 }]} testID={testID}>
      <View style={{
        backgroundColor: color, borderRadius: 4, height: 8, width: 8,
      }}
      />
      <Text style={[Fonts.p3Bold, { color }]}>{label}</Text>
    </View>
  );
}

/**
 * L'état d'une collectivité : « Active » en vert, « Inactive » en orange (NULL = inactive,
 * comme le serveur).
 * @param {{ isActive: boolean }} props - L'état lu par le serveur.
 * @returns {import('react').ReactElement} La pastille.
 */
export function EtatCollectivite({ isActive }) {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  return (
    <PastilleAPoint
      color={isActive ? Colors.success500 : Colors.warning500}
      label={isActive
        ? t('adminCollectivites.status.active', 'Active')
        : t('adminCollectivites.status.inactive', 'Inactive')}
    />
  );
}

/**
 * L'écusson d'une collectivité : la lettre de son nom propre, dans un rond.
 * @param {{ name: string, size?: number }} props - Le nom officiel, la taille.
 * @returns {import('react').ReactElement} L'écusson.
 */
export function EcussonCollectivite({ name, size = 40 }) {
  const { Alignments, Colors, Fonts } = useTheme();
  return (
    <View
      style={[
        Alignments.alignCenter,
        Alignments.justifyCenter,
        {
          backgroundColor: withAlpha(Colors.primary500, 0.18),
          borderColor: withAlpha(Colors.primary500, 0.6),
          borderRadius: size / 2,
          borderWidth: 1,
          height: size,
          width: size,
        },
      ]}
    >
      <Text style={[Fonts.p1Bold, Fonts.primary200]}>{collectiviteInitial(name)}</Text>
    </View>
  );
}
