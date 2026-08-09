import {
  Image, Text, TouchableOpacity, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

// D50 — les deux briques du hub « Mon club ».
//
// Une rangee-valeur est un bouton de 52 pt : tuile-icone 30, libelle, compteur
// gris, chevron. Elle porte SON etiquette d'accessibilite complete (libelle +
// valeur), sans quoi un lecteur d'ecran annoncerait « Sports » sans jamais dire
// combien il y en a — le compteur est l'information, pas une decoration.
//
// Le separateur est une bordure HAUTE portee par la rangee, et non un trait
// pose entre deux rangees : c'est ce qui evite un trait orphelin sous la
// derniere quand une rangee disparait.

/**
 * Une rangee-valeur du hub : icone, libelle, compteur, chevron.
 * @param {{
 *  divider?: boolean;
 *  icon: any;
 *  label: string;
 *  onPress: () => void;
 *  value: string;
 * }} props - Les proprietes de la rangee.
 * @returns {import('react').ReactElement} La rangee.
 */
export function ClubHubRow({
  divider = false,
  icon,
  label,
  onPress,
  value,
}) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();

  return (
    <TouchableOpacity
      accessibilityLabel={`${label}, ${value}`}
      accessibilityRole="button"
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        Alignments.row,
        Alignments.alignCenter,
        Spaces.gap[12],
        {
          borderTopColor: withAlpha(Colors.neutral00, 0.08),
          borderTopWidth: divider ? 1 : 0,
          minHeight: 52,
        },
      ]}
    >
      <View
        style={[
          Alignments.alignCenter,
          Alignments.justifyCenter,
          {
            backgroundColor: withAlpha(Colors.primary500, 0.12),
            borderRadius: 10,
            height: 30,
            width: 30,
          },
        ]}
      >
        <Image
          source={icon}
          style={[ApplicationStyle.icon16, ApplicationStyle.tintColor.primary500]}
        />
      </View>
      <Text numberOfLines={1} style={[Fonts.p2Bold, Fonts.neutral100, { flex: 1 }]}>
        {label}
      </Text>
      <Text numberOfLines={1} style={[Fonts.p3Bold, Fonts.neutral400]}>
        {value}
      </Text>
      <Image
        source={Images.arrowRight}
        style={[ApplicationStyle.icon16, ApplicationStyle.tintColor.neutral600]}
      />
    </TouchableOpacity>
  );
}

/**
 * Un groupe du hub : une etiquette en capitales, puis une carte qui porte ses
 * rangees. La carte est le SEUL conteteur borde — une rangee n'a jamais sa
 * propre carte, sinon on dessine une carte dans une carte.
 * @param {{
 *  children: import('react').ReactNode;
 *  label: string;
 * }} props - Les proprietes du groupe.
 * @returns {import('react').ReactElement} Le groupe.
 */
export function ClubHubGroup({ children, label }) {
  const {
    Colors, Fonts, Spaces,
  } = useTheme();

  return (
    <View style={[Spaces.gap[8]]}>
      <Text style={[Fonts.p3Bold, Fonts.neutral400, { textTransform: 'uppercase' }]}>
        {label}
      </Text>
      <View
        style={[
          Spaces.paddingHorizontal[12],
          {
            backgroundColor: withAlpha(Colors.neutral00, 0.04),
            borderColor: withAlpha(Colors.neutral00, 0.09),
            borderRadius: 16,
            borderWidth: 1,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}
