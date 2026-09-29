import { Platform } from 'react-native';

/**
 * ANNUAIRE-E1 (29/09) — les propriétés qui font d'un texte un TITRE, avec son rang.
 *
 * Sur le site, react-native-web rend un texte `role="heading"` + `aria-level` en vraie balise
 * <h1>…<h6> : c'est ce que Google lit comme structure de page (la fiche club de l'app est montée
 * sur l'annuaire). Au téléphone, `accessibilityRole="header"` fait annoncer le titre par le
 * lecteur d'écran ; le rang n'y existe pas.
 *
 * ⚠️ `aria-level` n'est pas dans les types de React Native : l'objet est rendu tel quel et
 * s'étale sur le texte.
 * @param {number} rang Le rang du titre (1 = le titre de la page).
 * @returns {Record<string, any>} Les propriétés à étaler sur un <Text>.
 */
const proprietesDeTitre = (rang) => (Platform.OS === 'web'
  ? { 'aria-level': rang, role: 'heading' }
  : { accessibilityRole: 'header' });

export default proprietesDeTitre;
