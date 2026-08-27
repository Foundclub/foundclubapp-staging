import { useTranslation } from 'react-i18next';
import {
  ScrollView, StyleSheet, Text, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import { buildConvocationFieldTokens } from '@/views/playerConvocation/playerConvocationUtils';

import { getCompositionPlayerId } from '@/utils/compositionPlayer';
import { getTacticalFieldAspectRatio, getTacticalSportKey } from '@/utils/tacticalField';

import RenderedTacticalField from './RenderedTacticalField';
import TacticalPlayerToken from './TacticalPlayerToken';

/**
 * ⚽ S5-D (vague S) — LE TERRAIN D UNE CONVOCATION PUBLIEE, EN LECTURE SEULE.
 *
 * 🗣️ Retour de recette d Adel (26/08) : « une fois la composition publiee, ca
 * doit afficher LE TERRAIN avec les joueurs places directement dans l onglet,
 * sans devoir cliquer le bouton du bas ».
 *
 * 🧨 COMPOLECT-2 (27/08) — CE QUI A CHANGE ICI, ET POURQUOI C EST LE POINT
 * CENTRAL DU LOT. Capture d Adel a l appui : ce composant dessinait une
 * PASTILLE DE 28 pt PORTANT DES INITIALES, alors que l ecran de CREATION
 * dessine un AVATAR PHOTO + PRENOM (`DraggableToken`). C est precisement ce qui
 * donne « ce n est pas le meme ecran ».
 * > « les cartes des joueurs ne sont pas les bonnes : ca doit etre les memes que
 * >   quand on cree la compo, avec la photo quand il y en a une. »
 * ⇒ Le jeton est desormais LE MEME OBJET des deux cotes, avec son repli en
 *   initiales seulement quand la personne n a pas de photo. Le repli est DANS
 *   `DraggableToken`, on ne le redecrit pas ici.
 * ⇒ Et le BANC descend avec lui : Adel « on ne voit pas le banc ». Il porte les
 *   MEMES mots que la creation (`matchComposition.board.bench.*`), y compris
 *   quand il est VIDE — un bandeau qui disparait a zero se lit comme un ecran
 *   different.
 *
 * 🧨 POURQUOI CE FICHIER EXISTE PLUTOT QU UN 4e RENDU DANS `EventDetails` :
 * `RenderedTacticalField` ne dessine que le TERRAIN — les jetons etaient
 * reecrits chez chaque appelant, et ils l etaient deja TROIS fois au 26/08 :
 *   · `CompositionMessageBubble` (mini-carte du tchat, positions en pixels)
 *   · `PlayerConvocationScreen` (positions en %, jeton du lecteur agrandi)
 *   · les tableaux de detection
 * En ecrire un quatrieme aurait fige un quatrieme endroit a corriger le jour ou
 * la forme d un placement change. Ce composant n INVENTE rien : il assemble des
 * pieces qui existaient toutes — le terrain, l assembleur
 * (`buildConvocationFieldTokens`), le jeton de la creation et le ratio du sport.
 *
 * ♻️ Le motif de placement vient de `PlayerConvocationScreen` : positions en
 * POURCENTAGE. C est ce qui le rend independant de la largeur reelle — la meme
 * compo se dessine juste dans une carte etroite comme dans un onglet pleine
 * largeur, sans recalcul.
 *
 * ⛔ AUCUNE INTERACTION. C est un apercu : ni glisser-deposer, ni appui. Le
 * geste vit sur l ecran complet, ou il est deja teste — ici `DraggableToken`
 * est pose SANS `GestureDetector`, donc aucun appui long ne peut le decoller.
 * @param {object} props
 * @param {any[]} [props.benchPlayers] Les remplacants, deja apparies a leur personne.
 * @param {any[]} [props.placements] Les placements du pack publie.
 * @param {any[]} [props.snapshotPlayers] Les personnes, telles que le serveur les envoie.
 * @param {string} [props.sportContext] Le sport, pour les traces du terrain.
 * @param {any} [props.style] Style additionnel, si l appelant veut imposer sa taille.
 * @returns {import('react').ReactElement | null} Le terrain, ou null si personne n est place.
 */
function ConvocationFieldPreview({
  benchPlayers = [], placements = [], snapshotPlayers = [], sportContext, style,
}) {
  const { Colors, Fonts } = useTheme();
  const { t } = useTranslation();

  const sport = getTacticalSportKey(sportContext);
  const tokens = buildConvocationFieldTokens({ placements, snapshotPlayers });

  // ⛔ Un terrain VIDE est pire que pas de terrain : il donne a croire que la
  // compo est vide, alors qu elle peut simplement etre sans placement — une
  // convocation publiee sans composition (S5-c). L appelant montre alors sa
  // liste de convoques, et ce composant se tait.
  if (!tokens.length) return null;

  return (
    <View style={styles.root}>
      <RenderedTacticalField
        sport={sport}
        style={[styles.field, { aspectRatio: 1 / getTacticalFieldAspectRatio(sport) }, style]}
      >
        {tokens.map((/** @type {any} */ { placement, player }) => (
          <View
            key={String(placement?.playerId || '')}
            style={[
              styles.token,
              { left: `${placement?.positionX || 0}%`, top: `${placement?.positionY || 0}%` },
            ]}
          >
            <TacticalPlayerToken isOnField player={player} />
          </View>
        ))}
      </RenderedTacticalField>

      {/* 🪑 LE BANC, AVEC LES MEMES MOTS QUE LA CREATION — et present MEME VIDE.
          Le plateau de creation ecrit « REMPLACANTS · 0 » et « Tout le monde est
          sur le terrain. » ; reprendre ces cles-la, plutot que d en inventer,
          est ce qui fait que les deux ecrans se lisent pareil. */}
      <View
        style={[
          styles.benchStrip,
          { borderTopColor: Colors.neutral700 },
        ]}
      >
        <Text style={[Fonts.p4Bold, styles.benchTitle, { color: Colors.neutral00 }]}>
          {t('matchComposition.board.bench.title', { count: benchPlayers.length }).toUpperCase()}
        </Text>
        <ScrollView
          contentContainerStyle={styles.benchContent}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {benchPlayers.length === 0 ? (
            <Text style={[Fonts.p4, { color: Colors.neutral300 }]}>
              {t('matchComposition.board.bench.empty')}
            </Text>
          ) : null}
          {benchPlayers.map((/** @type {any} */ player) => (
            <TacticalPlayerToken key={`banc-${getCompositionPlayerId(player)}`} player={player} />
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  benchContent: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  benchStrip: {
    borderTopWidth: 1,
    gap: 4,
    paddingTop: 8,
  },
  benchTitle: {
    letterSpacing: 0.6,
  },
  field: {
    borderRadius: 16,
    // La LARGEUR est prise, la hauteur se deduit du ratio du sport. C est ce
    // qui permet au meme composant de servir un onglet pleine largeur sans
    // qu aucun appelant n ait a calculer une hauteur en points.
    width: '100%',
    // 🧨 COMPOLECT-2 — ET ELLE EST PLAFONNEE. Un terrain de football fait 1,5
    // fois sa largeur : sur une colonne de 360 pt il en mesurait 540, plus haut
    // que la fenetre. C est ce qui coupait « Sur le terrain » en bas de l ecran
    // sur la capture d Adel. Le plafond garde le ratio (la largeur suit) et
    // laisse la place au banc et a la liste qui viennent dessous.
    maxHeight: 420,
  },
  root: {
    alignItems: 'stretch',
    gap: 8,
  },
  token: {
    // Le jeton est CENTRE sur sa position, pas accroche par son coin : sans ces
    // deux marges negatives, toute la compo glisse vers le bas a droite, et un
    // joueur pose sur la ligne parait hors du terrain.
    // ⚠️ Les valeurs sont la MOITIE du jeton de terrain de `DraggableToken`
    // (58 x 72), exactement comme le fait le plateau de creation.
    marginLeft: -29,
    marginTop: -36,
    position: 'absolute',
  },
});

export default ConvocationFieldPreview;
