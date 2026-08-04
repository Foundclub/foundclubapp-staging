import { StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

/**
 * Enveloppe visuelle des cartes club — POINT DE VÉRITÉ UNIQUE.
 *
 * POURQUOI CE FICHIER EXISTE (L23) : deux cartes club rendaient le même fond
 * dégradé, chacune avec sa copie. Le dégradé était le CONTENEUR : il devait donc
 * se dimensionner sur ses enfants, et il tranchait la carte en plein milieu
 * (constaté à l'écran sur la build 2.6.1 (821) le 2026-08-01). La correction R07
 * a été appliquée à la carte de recherche… et jamais à celle de l'inscription.
 *
 * LE MOTIF, repris tel quel de `EventCardNew.js:703` — la carte qui, elle,
 * s'affichait correctement (§1 bis : on réutilise le motif du dépôt) :
 *   1. un conteneur ORDINAIRE porte la taille, donc la hauteur suit le contenu ;
 *   2. le dégradé est posé DERRIÈRE en `absoluteFill`, sans enfant ;
 *   3. `pointerEvents="none"` pour qu'il n'intercepte aucun appui ;
 *   4. `overflow: 'hidden'` sur le conteneur — INDISPENSABLE, sinon le dégradé
 *      déborde des coins arrondis.
 * Les points 1 à 4 sont ici et non chez l'appelant : c'est ce qui empêche une
 * troisième carte de reproduire le défaut.
 *
 * Ce composant ne fixe QUE le fond et la bordure. Le rayon, les marges
 * intérieures et l'écart entre blocs restent à l'appelant (`style`) : les deux
 * cartes ont des cotes différentes et doivent le rester.
 * @param {object} props
 * @param {import('react').ReactNode} props.children - Contenu de la carte.
 * @param {any} [props.style] - Cotes de l'appelant (rayon, marges, écart).
 * @returns {import('react').ReactElement}
 */
function ClubCardSurface({ children, style = null }) {
  const { Colors } = useTheme();

  return (
    <View
      style={[
        styles.surface,
        { borderColor: withAlpha(Colors.primary500, 0.25) },
        style,
      ]}
    >
      <LinearGradient
        colors={[withAlpha(Colors.primary700, 0.9), withAlpha(Colors.primary900, 0.96)]}
        end={{ x: 0, y: 1 }}
        pointerEvents="none"
        start={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    borderWidth: 1,
    // Le dégradé est en absoluteFill derrière le contenu : sans cette découpe
    // il dépasserait des coins arrondis posés par l'appelant.
    overflow: 'hidden',
  },
});

export default ClubCardSurface;
