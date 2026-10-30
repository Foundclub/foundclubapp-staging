import { createContext } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';

/**
 * CORR-SOCLE (30/10/2026, point 7 de la recette du site, décision d'Adel « A ») — sur le
 * téléphone, « Modifier mon profil », « Modifier le club », « Ajouter un·e entraîneur·e », la fiche
 * d'un club ou d'un joueur reçoivent leur titre et leur retour de l'en-tête de la pile native
 * (stacks/*Stack.js). Le site ne dessine jamais cet en-tête : ni titre, ni retour, et le vide du
 * haut restait. Le registre du site (`barreDeTitre`) pose cette barre fine (56 px, retour + titre),
 * collée en haut quand la page défile. Vrai sous la barre : `ScreenContainer.web` ne pose plus ses
 * 20 px du haut.
 */
export const BarreDeTitreDuSiteContext = createContext(false);

/**
 * La barre fine (retour + titre) au-dessus d'un écran du site.
 * @param {object} props
 * @param {import('react').ReactNode} props.children
 * @param {string} props.cleDuTitre - Clé de traduction du titre ; vide : le retour seul (comme
 *   l'en-tête `headerTitle: ''` du téléphone).
 * @returns {import('react').ReactElement}
 */
function BarreDeTitreDuSite({ children, cleDuTitre }) {
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();

  return (
    <BarreDeTitreDuSiteContext.Provider value>
      {/* Le cadre du site range ses enfants en ligne : la barre et l'écran forment une colonne. */}
      <View style={[Alignments.fill, { minWidth: 0, width: '100%' }]}>
        <View
          style={[
            Alignments.row,
            Alignments.alignCenter,
            Spaces.gap[8],
            Spaces.paddingHorizontal[24],
            {
              backgroundColor: Colors.primary700,
              height: 56,
              // @ts-ignore: react-native-web accepte `sticky`.
              position: 'sticky',
              top: 0,
              zIndex: 10,
            },
          ]}
          testID="barre-de-titre-du-site"
        >
          <HeaderBackButton withDefaultMargin={false} />
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            style={[Fonts.h4Bold, Fonts.neutral00, Fonts.textCenter, Alignments.fill]}
          >
            {cleDuTitre ? t(cleDuTitre) : ''}
          </Text>
          <View style={{ width: 44 }} />
        </View>
        {children}
      </View>
    </BarreDeTitreDuSiteContext.Provider>
  );
}

export default BarreDeTitreDuSite;
