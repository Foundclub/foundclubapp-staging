import { useTranslation } from 'react-i18next';
import {
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';

import { EXTRAIT_CITE, NOM_CITE } from './typographieDuFil';

/**
 * MSG1A (§3.3) — LA CITATION, DANS LA BULLE (SPECS.md §1 « Citation dans une bulle »).
 *
 * Rayon 10, fond « carte » (plus sombre que la bulle), filet de 4 a la couleur de
 * l'auteur cite, son nom en 12,5/700, l'extrait en 13/18 sur une ligne avec l'icone du
 * contenu (photo, document, sondage, vocal, composition, evenement). Largeur min 190.
 * Un appui ramene au message cite (la fonction d'avant MSG1A, inchangee).
 * @param {object} props
 * @param {string} props.couleur - La couleur de l'auteur cite.
 * @param {boolean} [props.estAMoi] - Dans MA bulle (carte plus sombre).
 * @param {string} [props.icone] - Le glyphe du contenu cite, ou rien.
 * @param {string} props.nom - L'auteur cite.
 * @param {() => void} [props.onPress] - Remonte au message cite.
 * @param {string} props.texte - L'extrait.
 * @returns {import('react').ReactElement} La citation.
 */
function CitationDansLaBulle({
  couleur, estAMoi = false, icone = '', nom, onPress, texte,
}) {
  const { Colors } = useTheme();
  const { t } = useTranslation();
  const couleurDuTexte = withAlpha(Colors.neutral00, estAMoi ? 0.78 : 0.7);

  return (
    <TouchableOpacity
      accessibilityHint={t('conversation.quote.hint', 'Remonte au message cité')}
      accessibilityLabel={`${nom} : ${texte}`}
      accessibilityRole="button"
      activeOpacity={0.85}
      disabled={!onPress}
      onPress={onPress}
      style={[
        styles.carte,
        {
          backgroundColor: estAMoi
            ? withAlpha(Colors.neutral900, 0.22)
            : withAlpha(Colors.primary900, 0.3),
        },
      ]}
      testID="citation-dans-la-bulle"
    >
      <View style={[styles.filet, { backgroundColor: couleur }]} />
      <View style={styles.contenu}>
        <Text numberOfLines={1} style={[NOM_CITE, { color: couleur }]}>{nom}</Text>
        <View style={styles.ligne}>
          {icone ? <GlyphIcon color={couleurDuTexte} name={icone} size={14} /> : null}
          <Text numberOfLines={1} style={[EXTRAIT_CITE, styles.extrait, { color: couleurDuTexte }]}>
            {texte}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  carte: {
    borderRadius: 10,
    flexDirection: 'row',
    marginBottom: 5,
    marginTop: 2,
    minWidth: 190,
    overflow: 'hidden',
  },
  contenu: {
    flexShrink: 1,
    minWidth: 0,
    paddingBottom: 6,
    paddingLeft: 8,
    paddingRight: 10,
    paddingTop: 5,
  },
  extrait: {
    flexShrink: 1,
  },
  filet: {
    width: 4,
  },
  ligne: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
});

export default CitationDansLaBulle;
