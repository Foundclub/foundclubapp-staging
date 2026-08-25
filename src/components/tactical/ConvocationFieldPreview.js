import { StyleSheet, Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import { buildConvocationFieldTokens } from '@/views/playerConvocation/playerConvocationUtils';

import { getCompositionPlayerInitials } from '@/utils/compositionPlayer';
import { getTacticalFieldAspectRatio, getTacticalSportKey } from '@/utils/tacticalField';

import RenderedTacticalField from './RenderedTacticalField';

const TOKEN_SIZE = 28;

/**
 * ⚽ S5-D (vague S) — LE TERRAIN D UNE CONVOCATION PUBLIEE, EN LECTURE SEULE.
 *
 * 🗣️ Retour de recette d Adel (26/08) : « une fois la composition publiee, ca
 * doit afficher LE TERRAIN avec les joueurs places directement dans l onglet,
 * sans devoir cliquer le bouton du bas ».
 *
 * 🧨 POURQUOI CE FICHIER EXISTE PLUTOT QU UN 4e RENDU DANS `EventDetails` :
 * `RenderedTacticalField` ne dessine que le TERRAIN — les jetons sont reecrits
 * chez chaque appelant, et ils l etaient deja TROIS fois au 26/08 :
 *   · `CompositionMessageBubble` (mini-carte du tchat, positions en pixels)
 *   · `PlayerConvocationScreen` (positions en %, jeton du lecteur agrandi)
 *   · les tableaux de detection
 * En ecrire un quatrieme aurait fige un quatrieme endroit a corriger le jour ou
 * la forme d un placement change. Ce composant n INVENTE rien : il assemble des
 * pieces qui existaient toutes — le terrain, l assembleur
 * (`buildConvocationFieldTokens`), les initiales et le ratio du sport.
 *
 * ♻️ Le motif de placement vient de `PlayerConvocationScreen` : positions en
 * POURCENTAGE. C est ce qui le rend independant de la largeur reelle — la meme
 * compo se dessine juste dans une carte etroite comme dans un onglet pleine
 * largeur, sans recalcul.
 *
 * ⛔ AUCUNE INTERACTION. C est un apercu : ni glisser-deposer, ni appui. Le
 * geste vit sur l ecran complet, ou il est deja teste.
 * @param {object} props
 * @param {any[]} [props.placements] Les placements du pack publie.
 * @param {any[]} [props.snapshotPlayers] Les personnes, telles que le serveur les envoie.
 * @param {string} [props.sportContext] Le sport, pour les traces du terrain.
 * @param {any} [props.style] Style additionnel, si l appelant veut imposer sa taille.
 * @returns {import('react').ReactElement | null} Le terrain, ou null si personne n est place.
 */
function ConvocationFieldPreview({
  placements = [], snapshotPlayers = [], sportContext, style,
}) {
  const { Colors, Fonts } = useTheme();

  const sport = getTacticalSportKey(sportContext);
  const tokens = buildConvocationFieldTokens({ placements, snapshotPlayers });

  // ⛔ Un terrain VIDE est pire que pas de terrain : il donne a croire que la
  // compo est vide, alors qu elle peut simplement etre sans placement — une
  // convocation publiee sans composition (S5-c). L appelant montre alors sa
  // liste de convoques, et ce composant se tait.
  if (!tokens.length) return null;

  return (
    <RenderedTacticalField
      sport={sport}
      style={[styles.field, { aspectRatio: 1 / getTacticalFieldAspectRatio(sport) }, style]}
    >
      {tokens.map((/** @type {any} */ { placement, player }) => (
        <View
          key={String(placement?.playerId || '')}
          style={[
            styles.token,
            {
              backgroundColor: Colors.primary500,
              borderColor: Colors.primary100,
              left: `${placement?.positionX || 0}%`,
              top: `${placement?.positionY || 0}%`,
            },
          ]}
        >
          {/* Encre primary900 sur pastille primary500 : neutral00 y tombe a
              2,40:1 (echec WCAG AA), primary900 rend 7,96:1 — THEME.md. */}
          <Text numberOfLines={1} style={[Fonts.p4Bold, { color: Colors.primary900 }]}>
            {getCompositionPlayerInitials(player)}
          </Text>
        </View>
      ))}
    </RenderedTacticalField>
  );
}

const styles = StyleSheet.create({
  field: {
    borderRadius: 16,
    // La LARGEUR est prise, la hauteur se deduit du ratio du sport. C est ce
    // qui permet au meme composant de servir un onglet pleine largeur sans
    // qu aucun appelant n ait a calculer une hauteur en points.
    width: '100%',
  },
  token: {
    alignItems: 'center',
    borderRadius: TOKEN_SIZE / 2,
    borderWidth: 2,
    height: TOKEN_SIZE,
    justifyContent: 'center',
    // Le jeton est CENTRE sur sa position, pas accroche par son coin : sans ces
    // deux marges negatives, toute la compo glisse d un demi-jeton vers le bas
    // a droite, et un joueur pose sur la ligne parait hors du terrain.
    marginLeft: -(TOKEN_SIZE / 2),
    marginTop: -(TOKEN_SIZE / 2),
    position: 'absolute',
    width: TOKEN_SIZE,
  },
});

export default ConvocationFieldPreview;
