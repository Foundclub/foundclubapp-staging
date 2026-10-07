import { useTranslation } from 'react-i18next';
import {
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';

import { EXTRAIT_CITE, NOM_CITE } from './typographieDuFil';

/**
 * MSG1A (§3.3) — LA BARRE « REPONSE EN COURS », AU-DESSUS DE LA SAISIE (SPECS.md §1).
 *
 * Rayon 16, fond du champ (`primary800`) et son bord (`primary700`), filet gauche de 4 a la
 * couleur de l'auteur cite, nom 12,5/700, extrait 13 sur une ligne (avec l'icone du
 * contenu), fermeture ronde de 28.
 * @param {object} props
 * @param {string} props.couleur - La couleur de l'auteur cite.
 * @param {string} [props.icone] - Le glyphe du contenu cite.
 * @param {string} props.nom - L'auteur cite.
 * @param {() => void} props.onFermer - Abandonne la reponse.
 * @param {string} props.texte - L'extrait.
 * @returns {import('react').ReactElement} La barre.
 */
function BarreDeReponse({
  couleur, icone = '', nom, onFermer, texte,
}) {
  const { Colors } = useTheme();
  const { t } = useTranslation();
  const couleurDuTexte = withAlpha(Colors.neutral00, 0.7);

  return (
    <View
      style={[styles.barre, { backgroundColor: Colors.primary800, borderColor: Colors.primary700 }]}
      testID="barre-de-reponse"
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
      <TouchableOpacity
        accessibilityLabel={t('conversation.reply.cancel', 'Annuler la réponse')}
        accessibilityRole="button"
        hitSlop={8}
        onPress={onFermer}
        style={[styles.fermer, { backgroundColor: withAlpha(Colors.neutral00, 0.08) }]}
        testID="barre-de-reponse-fermer"
      >
        <GlyphIcon color={Colors.neutral00} name="xmark" size={16} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  barre: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
    overflow: 'hidden',
    paddingBottom: 8,
    paddingRight: 8,
    paddingTop: 8,
  },
  contenu: {
    flex: 1,
    minWidth: 0,
  },
  extrait: {
    flexShrink: 1,
  },
  fermer: {
    alignItems: 'center',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  filet: {
    alignSelf: 'stretch',
    borderBottomRightRadius: 3,
    borderTopRightRadius: 3,
    width: 4,
  },
  ligne: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
});

export default BarreDeReponse;
