import {
  Image, StyleSheet, Text, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import { useTokenIdentity } from './TacticalPlayerToken';

/** Epaisseur du liseré blanc : elle se retire de la photo, pas du jeton. */
const BORDER_WIDTH = 2;

/**
 * 🙂 COMPOMSG — LE JETON DES PETITS TERRAINS : une tête ronde, rien d'autre.
 *
 * 🧨 La cause des photos absentes de « Tu es convoqué » (capture d'Adel du
 * 23/09) : la photo ÉTAIT dans la charge, mais cet écran dessinait ses propres
 * pastilles et n'y écrivait que des initiales — alors que la carte du fil, pour
 * les mêmes joueurs, montrait les photos. Deux dessins du même jeton finissent
 * toujours par diverger ; il n'y en a plus qu'un, ici, pour les deux vignettes.
 *
 * ♻️ La lecture de la photo (ses 3 formes serveur, le joueur ajouté à la main,
 * le repli en initiales) est celle du jeton de la création, `useTokenIdentity` :
 * elle n'est pas réécrite.
 *
 * ⛔ Pas de prénom sous la tête : sur une vignette de 130 pt de large, 11 noms
 * se chevaucheraient (maquette du pack, écran 9 : « jetons sans nom »). Les
 * noms s'écrivent sous le terrain, ou en plein écran.
 * @param {object} props
 * @param {any} props.player La personne, telle que le serveur l'envoie.
 * @param {number} [props.size] Diamètre, en points.
 * @param {boolean} [props.isHighlighted] Le jeton du lecteur : liseré plein.
 * @returns {import('react').ReactElement}
 */
function PlayerHeadToken({ isHighlighted = false, player, size = 24 }) {
  const { Colors, Fonts } = useTheme();
  const { avatarUri, initials } = useTokenIdentity(player);
  const inner = size - (BORDER_WIDTH * 2);

  return (
    <View
      style={[
        styles.token,
        {
          backgroundColor: Colors.primary500,
          borderColor: isHighlighted ? Colors.neutral00 : withAlpha(Colors.neutral00, 0.8),
          borderRadius: size / 2,
          height: size,
          width: size,
        },
      ]}
    >
      {avatarUri ? (
        <Image
          source={{ uri: avatarUri }}
          style={{ borderRadius: inner / 2, height: inner, width: inner }}
        />
      ) : (
        /* Initiales sur pastille primary500 : encre primary900 (THEME.md), le
           blanc y échoue en WCAG AA. */
        <Text numberOfLines={1} style={[Fonts.p4Bold, { color: Colors.primary900 }]}>
          {initials}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  token: {
    alignItems: 'center',
    borderWidth: BORDER_WIDTH,
    justifyContent: 'center',
    overflow: 'hidden',
  },
});

export default PlayerHeadToken;
