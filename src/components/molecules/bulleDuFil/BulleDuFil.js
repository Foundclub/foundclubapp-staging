import { StyleSheet, Text, View } from 'react-native';
import { Path, Svg } from 'react-native-svg';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import { NOM_DE_L_AUTEUR, ROLE_DE_L_AUTEUR } from './typographieDuFil';

/** La queue du pack (svg 24 x 18), dessinee pour une bulle RECUE ; miroir pour les miennes. */
const TRACE_DE_LA_QUEUE = 'M6 0V9C6 13.5 3.8 16.6 0 18C4.6 18.6 8.8 17.6 11.6 15.6'
  + 'C13.6 17.2 16.4 18 20 18H24V0Z';

/**
 * MSG1A — LE CADRE D'UNE BULLE DU FIL, « MODELE WHATSAPP » (SPECS.md §1).
 *
 * 🫧 UN SEUL CADRE POUR TOUTES LES BULLES : texte, photo, sondage, vocal, composition,
 * evenement. Il porte ce que WhatsApp donne a chacune :
 *   · le fond — petrole (`chatBubbleMine`) pour les miennes, `primary700` pour les recues ;
 *   · la QUEUE, seulement sur la DERNIERE bulle d'un groupe (24 x 18, decalee de 6) ;
 *   · le NOM de l'auteur, en couleur, sur la PREMIERE bulle d'un groupe recu (groupes
 *     seulement : l'appelant decide et passe `nom` ou rien).
 * Le contenu (texte, carte...) est l'affaire de l'appelant.
 *
 * ⛔ La queue est dessinee AVANT le contenu : elle recouvre le coin arrondi, et un
 * texte pose dans ce coin doit passer PAR-DESSUS elle.
 * @param {object} props
 * @param {import('react').ReactNode} [props.children] - Le contenu de la bulle.
 * @param {boolean} [props.compacte] - Marge interieure de 3 (photo pleine bulle).
 * @param {string} [props.couleurDuNom] - La couleur du nom (stable par personne).
 * @param {boolean} [props.estAMoi] - Ma bulle (a droite, petrole) ou une bulle recue.
 * @param {boolean} [props.estDernier] - Derniere bulle du groupe : elle porte la queue.
 * @param {string} [props.nom] - Le nom a afficher en tete, ou rien.
 * @param {string} [props.role] - Le role du staff, a droite du nom (si la donnee existe).
 * @param {import('react-native').StyleProp<import('react-native').ViewStyle>} [props.style]
 * @param {string} [props.testID]
 * @returns {import('react').ReactElement} La bulle.
 */
function BulleDuFil({
  children = null,
  compacte = false,
  couleurDuNom = '',
  estAMoi = false,
  estDernier = true,
  nom = '',
  role = '',
  style = undefined,
  testID = undefined,
}) {
  const { Colors } = useTheme();
  const fond = estAMoi ? Colors.chatBubbleMine : Colors.primary700;

  return (
    <View
      style={[
        styles.cadre,
        compacte ? styles.compacte : styles.normale,
        { backgroundColor: fond },
        style,
      ]}
      testID={testID}
    >
      {estDernier ? (
        <Svg
          height={18}
          pointerEvents="none"
          style={[styles.queue, estAMoi ? styles.queueAMoi : styles.queueRecue]}
          testID="bulle-du-fil-queue"
          viewBox="0 0 24 18"
          width={24}
        >
          <Path d={TRACE_DE_LA_QUEUE} fill={fond} />
        </Svg>
      ) : null}
      {nom ? (
        <View style={[styles.ligneDuNom, compacte ? styles.ligneDuNomCompacte : null]}>
          <Text
            numberOfLines={1}
            style={[NOM_DE_L_AUTEUR, styles.nom, { color: couleurDuNom || Colors.primary500 }]}
            testID="bulle-du-fil-nom"
          >
            {nom}
          </Text>
          {role ? (
            <Text
              numberOfLines={1}
              style={[ROLE_DE_L_AUTEUR, { color: withAlpha(Colors.neutral00, 0.55) }]}
            >
              {role}
            </Text>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  cadre: {
    borderRadius: 18,
    maxWidth: '100%',
    minWidth: 0,
  },
  compacte: {
    padding: 3,
  },
  ligneDuNom: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
    marginBottom: 1,
  },
  ligneDuNomCompacte: {
    paddingBottom: 4,
    paddingHorizontal: 7,
    paddingTop: 3,
  },
  nom: {
    flexShrink: 1,
  },
  normale: {
    paddingBottom: 7,
    paddingHorizontal: 10,
    paddingTop: 6,
  },
  queue: {
    bottom: 0,
    position: 'absolute',
  },
  queueAMoi: {
    right: -6,
    transform: [{ scaleX: -1 }],
  },
  queueRecue: {
    left: -6,
  },
});

export default BulleDuFil;
