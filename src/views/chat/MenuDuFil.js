import {
  Modal, Pressable, StyleSheet, Text, TouchableOpacity,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import { LIGNE_DE_MENU } from '@/components/molecules/bulleDuFil/typographieDuFil';

/**
 * @typedef {object} EntreeDuMenu
 * @property {string} cle - Stable, sert de `testID` (`menu-du-fil-<cle>`).
 * @property {string} libelle
 * @property {any} icone - Nom d'un glyphe de `GlyphIcon`.
 * @property {() => void} onPress
 * @property {boolean} [danger] - En rouge (signaler, bloquer...).
 * @property {boolean} [desactive]
 */

/**
 * MSG1A (§3.16) — LE PETIT MENU ⋮ DU FIL (pack : 230 de large, sous l'en-tete a droite,
 * lignes de 48 avec leur icone). Il remplace la feuille « Gerer le groupe / Signaler /
 * Fermer » : toucher a cote suffit a fermer, il n'y a plus de « Fermer ».
 * @param {object} props
 * @param {EntreeDuMenu[]} props.entrees
 * @param {() => void} props.onClose
 * @param {number} [props.haut] - Distance du haut de l'ecran (sous l'en-tete).
 * @param {boolean} props.visible
 * @returns {import('react').ReactElement}
 */
function MenuDuFil({
  entrees, haut = 108, onClose, visible,
}) {
  const { Colors } = useTheme();

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <Pressable onPress={onClose} style={styles.fond} testID="menu-du-fil-fond">
        <Pressable
          onPress={() => {}}
          style={[
            styles.carte,
            {
              backgroundColor: Colors.chatSheet,
              borderColor: withAlpha(Colors.neutral00, 0.08),
              top: haut,
            },
          ]}
          testID="menu-du-fil"
        >
          {entrees.map((entree, index) => {
            const couleur = entree.danger ? Colors.chatDanger : Colors.neutral00;
            return (
              <TouchableOpacity
                accessibilityRole="button"
                disabled={entree.desactive}
                key={entree.cle}
                onPress={entree.onPress}
                style={[
                  styles.ligne,
                  index
                    ? { borderTopColor: withAlpha(Colors.neutral00, 0.07), borderTopWidth: 1 }
                    : null,
                  entree.desactive ? styles.eteinte : null,
                ]}
                testID={`menu-du-fil-${entree.cle}`}
              >
                <GlyphIcon color={couleur} name={entree.icone} size={20} />
                <Text numberOfLines={1} style={[LIGNE_DE_MENU, styles.libelle, { color: couleur }]}>
                  {entree.libelle}
                </Text>
              </TouchableOpacity>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  carte: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'absolute',
    right: 12,
    width: 230,
  },
  eteinte: {
    opacity: 0.5,
  },
  fond: {
    flex: 1,
  },
  libelle: {
    flex: 1,
  },
  ligne: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    height: 48,
    paddingHorizontal: 18,
  },
});

export default MenuDuFil;
