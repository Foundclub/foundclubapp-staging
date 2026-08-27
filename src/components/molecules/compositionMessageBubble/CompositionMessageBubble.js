// @ts-nocheck
/* eslint-disable no-nested-ternary */
import { useNavigation } from '@react-navigation/native';
import dayjs from 'dayjs';
import {
  Image, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import 'dayjs/locale/fr';

import { getAuthRuntimeSnapshot } from '@/store/authRuntime';
import useTheme from '@/theme/themeContext';

import RenderedTacticalField from '@/components/tactical/RenderedTacticalField';
import { useTokenIdentity } from '@/components/tactical/TacticalPlayerToken';
import {
  buildConvocationFieldTokens,
  getPersonName,
  getViewerConvocationRole,
} from '@/views/playerConvocation/playerConvocationUtils';

import { RouteNames } from '@/navigation/routeNames';

// Mini field dimensions
const MINI_FIELD_WIDTH = 220;
const MINI_FIELD_HEIGHT = 150;
const MINI_TOKEN_SIZE = 34;

/**
 * @typedef {{ id?: string; documentId?: string; firstname?: string; lastname?: string }} CompositionPlayer
 * @typedef {{ playerId?: string; positionX?: number; positionY?: number }} CompositionPlacement
 * @typedef {{
 *   eventAddress?: string;
 *   eventId?: string;
 *   eventDate?: string;
 *   eventName?: string;
 *   manualPlayers?: CompositionPlayer[];
 *   placements?: CompositionPlacement[];
 *   publishedVersion?: number;
 *   reservePlayers?: CompositionPlayer[];
 *   schemaVersion?: number;
 *   snapshotPlayers?: CompositionPlayer[];
 *   sport?: string;
 *   sportContext?: string;
 *   teamName?: string;
 *   teamPlayers?: CompositionPlayer[];
 *   teams?: Array<{ id?: string; name?: string; placements?: CompositionPlacement[] }>;
 *   type?: string;
 * }} CompositionPayload
 */

const getPlayerId = (player) => String(player?.documentId || player?.id || '').trim();

/**
 * U06 — le lieu, tel qu'il arrive du serveur.
 *
 * ⛔ Un lieu absent est DIT, jamais invente : la carte ecrit « Lieu non precise »
 * plutot que de laisser un trou que le lecteur comblerait tout seul.
 * ⚠️ Le DEBALLAGE d'une adresse emballee en JSON se fait UNE fois, cote serveur
 * (`extractHumanAddressLabel`, `event-composition.ts`). Ici on ne garde que le
 * garde-fou : tout ce qui n'est pas une chaine non vide vaut « absent », pour
 * qu'aucun objet brut n'arrive a l'ecran.
 * @param {unknown} value
 * @returns {string}
 */
const readableAddress = (value) => (typeof value === 'string' ? value.trim() : '');

const getPlayerInitials = (player) => `${player?.firstname?.charAt(0) || ''}${player?.lastname?.charAt(0) || ''}`.toUpperCase() || '?';

/**
 * 🔎 COMPOLECT-2 — LE JETON DE LA MINI-CARTE, ENFIN LISIBLE.
 *
 * 🗣️ Adel, 27/08 : « un jeton "JM" grand comme rien ». Il mesurait 24 pt et ne
 * portait que des initiales, alors que la personne a souvent une photo dans la
 * meme charge.
 *
 * ⛔ CE N EST PAS LE JETON DE LA CREATION, ET C EST VOULU : celui-la fait
 * 58 x 72 pt, il couvrirait un tiers d une carte de message large de 250. La
 * mini-carte RESTE une vignette — on l agrandit et on lui donne la photo, on ne
 * la transforme pas en ecran.
 * ♻️ La lecture de l avatar (les 3 formes que le serveur envoie, et le repli en
 * initiales) est celle de `TacticalPlayerToken` : un composant a part pour que
 * le crochet soit appele une fois par jeton, jamais dans une boucle.
 * @param {object} props
 * @param {any} props.player
 * @param {any} props.style
 * @returns {import('react').ReactElement}
 */
function MiniPlayerToken({ player, style }) {
  const { Colors, Fonts } = useTheme();
  const { avatarUri, initials } = useTokenIdentity(player);

  return (
    <View style={[styles.miniToken, { backgroundColor: Colors.primary500 }, style]}>
      {avatarUri ? (
        <Image source={{ uri: avatarUri }} style={styles.miniTokenPhoto} />
      ) : (
        /* Initiales sur pastille primary500 : encre primary900 (cf. THEME.md). */
        <Text style={[Fonts.p4Bold, styles.miniTokenText, { color: Colors.primary900 }]}>
          {initials || getPlayerInitials(player)}
        </Text>
      )}
    </View>
  );
}

/**
 * 🔢 La pastille du compte — « 1 equipe(s) » ou « 11 joueurs ».
 *
 * 🧨 COMPOLECT-2 : elle etait posee EN ABSOLU DANS le terrain, ou elle
 * recouvrait les jetons du coin haut droit (capture d'Adel du 27/08). Elle
 * remonte dans l'entete, a cote du titre.
 * ⚠️ Elle vit dans son PROPRE composant, et ce n'est pas cosmetique : le
 * contrat de theme lit la proximite des lignes, et un fond `primary500` pose
 * juste sous une encre `neutral00` (le titre) se lit comme un contraste rate.
 * Ici les deux couleurs ne se touchent plus.
 * @param {object} props
 * @param {string} props.label
 * @returns {import('react').ReactElement}
 */
function CountBadge({ label }) {
  const { Colors, Fonts } = useTheme();

  return (
    <View style={[styles.countBadge, { backgroundColor: Colors.primary500 }]}>
      {/* Encre primary900 sur primary500 : le blanc y echoue en WCAG AA. */}
      <Text style={[Fonts.p4Bold, { color: Colors.primary900 }]}>{label}</Text>
    </View>
  );
}

/**
 * Mini composition preview for chat messages
 * @param {object} props
 * @param {CompositionPayload | null | undefined} props.composition - The composition data
 * @param {boolean} [props.isMe] - Whether sent by current user
 * @returns {import('react').ReactElement | null}
 */
function CompositionMessageBubble({ composition, isMe = false }) {
  const { Colors, Fonts } = useTheme();
  const navigation = useNavigation();

  if (!composition) return null;

  const {
    eventAddress,
    eventDate,
    eventId,
    eventName,
    manualPlayers = [],
    placements = [],
    publishedVersion,
    reservePlayers = [],
    schemaVersion = 2,
    snapshotPlayers = [],
    sport = 'football',
    sportContext,
    teamName,
    teamPlayers = [],
    teams = [],
    type,
  } = composition;
  const isMultiTeamComposition = Number(schemaVersion) === 3 || Array.isArray(teams);
  const previewPlacements = isMultiTeamComposition
    ? (Array.isArray(teams?.[0]?.placements) ? teams[0].placements : [])
    : placements;

  const allPlayers = [...teamPlayers, ...manualPlayers, ...reservePlayers, ...snapshotPlayers];

  // 🧾 R6 (vague R) — LES NOMS, ENFIN ECRITS.
  //
  // 🧨 Constat de recette du 24/08 : « la liste des convoques doit se voir dans
  // le groupe de messages de l equipe ». La carte partait deja toute seule a la
  // publication et annonçait « 11 joueurs » — onze QUI ? Les personnes
  // voyageaient DEJA dans sa propre charge (`snapshotPlayers`,
  // `reservePlayers`) : le lecteur du tchat devait ouvrir un ecran pour savoir
  // s il en faisait partie. ⇒ ZERO changement serveur : la donnee etait la.
  //
  // ♻️ `buildConvocationFieldTokens` est le MEME assembleur que l ecran du
  // joueur convoque et que l onglet « Convocation » : il apparie un placement a
  // sa personne et JETTE les placements orphelins — jamais de ligne vide a la
  // place d un nom qu on n a pas.
  const starters = buildConvocationFieldTokens({
    placements: previewPlacements,
    snapshotPlayers: allPlayers,
  });
  const benchPlayers = reservePlayers.filter((player) => getPersonName(player));

  // ⛔ LE MINI-TERRAIN N A JAMAIS DESSINE QUE LA PREMIERE EQUIPE — c est un
  // apercu, et il le reste : 250 pt de large ne portent pas quatre effectifs.
  // Mais une liste qui s arreterait la SANS RIEN DIRE ferait croire au lecteur
  // qu il a vu tout le monde. La carte compte donc ce qu elle ne montre pas.
  const otherTeamsCount = isMultiTeamComposition && Array.isArray(teams)
    ? Math.max(0, teams.length - 1)
    : 0;
  const otherTeamsLine = otherTeamsCount > 0
    ? `+ ${otherTeamsCount} autre équipe${otherTeamsCount > 1 ? 's' : ''} dans cette composition`
    : '';

  // U06 — l'heure etait DEJA dans `eventDate` (champ `datetime` cote serveur) et
  // partait a la poubelle : la carte n'en gardait que le jour.
  const eventMoment = eventDate ? dayjs(eventDate).locale('fr') : null;
  const formattedDate = eventMoment ? eventMoment.format('DD/MM/YYYY') : '';
  const formattedTime = eventMoment ? eventMoment.format('HH:mm') : '';
  const whenLine = [formattedDate, formattedTime].filter(Boolean).join(' · ');
  const addressLine = readableAddress(eventAddress) || 'Lieu non précisé';
  const teamLine = `${teamName || 'Equipe'}${publishedVersion ? ` · v${publishedVersion}` : ''}`;
  // Une carte de composition SANS evenement rattache (partage libre) n'a ni
  // quand ni ou a annoncer : on ne lui colle pas un « Lieu non precise » qui ne
  // repond a aucune question.
  const hasEventContext = Boolean(eventName || whenLine);

  // 🥇 AC08 — LA BULLE MENE ENFIN AU BON ECRAN (constat D-23 d'Adel : « quand on
  // clique pour ouvrir la compo, c'est nul »). Elle envoyait TOUT LE MONDE sur le
  // tableau du coach desactive. Un convoque va desormais sur SON terrain ; les
  // autres gardent la vue d'ensemble en lecture seule, telle quelle.
  //
  // ♻️ L'identite se lit dans l'instantane d'authentification — le MEME que
  // `client.native.js` interroge avant chaque requete. `useAuth` tirerait tout le
  // client HTTP dans une carte de tchat qui n'appelle rien.
  const handlePress = () => {
    const { auth } = getAuthRuntimeSnapshot();
    const viewerConvocationRole = getViewerConvocationRole(
      {
        published: {
          reservePlayerIds: reservePlayers.map((player) => getPlayerId(player)).filter(Boolean),
          teams: isMultiTeamComposition ? teams : [{ placements }],
        },
      },
      auth?.user?.documentId || auth?.user?.id,
    );

    if (eventId && viewerConvocationRole) {
      navigation.navigate(RouteNames.EventStack, {
        params: { eventId },
        screen: RouteNames.PlayerConvocation,
      });
      return;
    }

    // COMPOLECT-2 (D1) - LA CARTE MENE AU MEME TERRAIN QUE PARTOUT AILLEURS.
    //
    // Adel, 27/08 : « quand je clique sur "ouvrir la compo", je vois le terrain
    // avec le banc en plein ecran, COMME QUAND JE CREE LA COMPO ». COMPOLECT-1 a
    // rebranche l'onglet « Convocation » de l'evenement, mais PAS cette carte :
    // elle envoyait encore sur `TacticalBoardV2`, un AUTRE plateau (1864 lignes,
    // panneau de banc de 276 pt) qui ne ressemble pas a l'ecran de creation.
    // Un coach n'est JAMAIS convoque sur sa propre compo : c'est donc toujours
    // cette branche-ci qu'il prenait, et jamais celle du dessus.
    //
    // ZERO CALCUL NEUF : `starters` et `benchPlayers` sont deja assembles plus
    // haut pour dessiner le mini-terrain de la carte elle-meme.
    //
    // DEUX CAS GARDENT L'ANCIEN PLATEAU, et ce sont exactement ceux
    // d'`EventDetails` (D6) : sans titulaire dessinable, un terrain vide ferait
    // croire a une compo perdue ; avec plusieurs equipes, le plateau ne dessine
    // QU'UN terrain et en cacherait une sans rien dire.
    if (eventId && starters.length > 0 && otherTeamsCount === 0) {
      navigation.navigate(RouteNames.EventStack, {
        params: {
          canEdit: false,
          eventId,
          eventLabel: eventName,
          readOnly: true,
          // Titulaires PUIS remplacants : le plateau retrouve le banc tout seul
          // en retirant de cette liste ceux que les placements portent.
          selectedPlayers: [...starters.map((token) => token.player), ...benchPlayers],
          sport: sportContext || sport,
          startPlacements: starters.map((token) => token.placement),
          teamName,
        },
        screen: RouteNames.MatchCompositionBoard,
      });
      return;
    }

    navigation.navigate(RouteNames.EventStack, {
      params: {
        canEdit: false,
        editorMode: 'event',
        editorSource: type === 'lineup_share' ? 'published' : null,
        editorSourceLabel: type === 'lineup_share' ? "Composition d'équipes publiée" : null,
        eventId,
        eventName,
        existingComposition: isMultiTeamComposition
          ? {
            manualPlayers,
            reservePlayerIds: reservePlayers.map((player) => getPlayerId(player)).filter(Boolean),
            reserveSnapshotPlayers: reservePlayers,
            schemaVersion: 3,
            snapshotPlayers,
            sportContext,
            teams,
          }
          : {
            manualPlayers,
            placements,
            sportContext,
          },
        multiTeamComposition: isMultiTeamComposition,
        players: allPlayers,
        readOnly: true,
        sport,
        teamName,
      },
      screen: RouteNames.TacticalBoardV2,
    });
  };

  const renderMiniTokens = () => previewPlacements.map((placement) => {
    const { playerId, positionX, positionY } = placement;
    const player = allPlayers.find((entry) => getPlayerId(entry) === String(playerId || '').trim());
    const left = ((positionX || 0) / 100) * MINI_FIELD_WIDTH - MINI_TOKEN_SIZE / 2;
    const top = ((positionY || 0) / 100) * MINI_FIELD_HEIGHT - MINI_TOKEN_SIZE / 2;

    return (
      <MiniPlayerToken
        key={`${playerId || 'unknown'}-${positionX || 0}-${positionY || 0}`}
        player={player}
        style={{ left, top }}
      />
    );
  });

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={handlePress}
      style={[
        styles.container,
        {
          alignSelf: isMe ? 'flex-end' : 'flex-start',
          backgroundColor: Colors.neutral800,
          borderColor: Colors.neutral700,
        },
      ]}
    >
      <View style={[styles.header, { borderBottomColor: Colors.neutral700 }]}>
        {/* U06 — l'intitule tient desormais sur UNE ligne. A 250 px de large, il
            partageait sa rangee avec la date : les deux se coupaient. Le nom du
            match, le quand et le ou descendent dans le pied de carte.
            🧨 COMPOLECT-2 — MAIS UNE LIGNE NE SUFFISAIT PAS : sur la capture
            d'Adel du 27/08 il lisait « Composition d'équipes publi… ». Le titre
            prend DEUX lignes, et la pastille du compte vient a cote de lui —
            elle etait posee PAR-DESSUS le terrain, ou elle cachait les jetons
            du coin haut droit. */}
        <Text
          numberOfLines={2}
          style={[Fonts.p2Bold, styles.headerTitle, { color: Colors.neutral00 }]}
        >
          {type === 'lineup_share' ? "Composition d'équipes publiée" : 'Composition du match'}
        </Text>
        <CountBadge
          label={isMultiTeamComposition
            ? `${teams.length} equipe(s)`
            : `${previewPlacements.length} joueur${previewPlacements.length > 1 ? 's' : ''}`}
        />
      </View>

      <RenderedTacticalField sport={sport} style={styles.miniField}>
        {renderMiniTokens()}
      </RenderedTacticalField>

      {/* 🧾 R6 — QUI EST CONVOQUE. Le bloc entier disparait quand il n y a
          personne : une section « Sur le banc » suivie de rien se lit comme un
          bug, et un pack sans remplacant est le cas normal. */}
      {starters.length > 0 || benchPlayers.length > 0 ? (
        <View style={[styles.roster, { borderTopColor: Colors.neutral700 }]}>
          {starters.length > 0 ? (
            <Text style={[Fonts.p4Bold, { color: Colors.neutral00 }]}>Sur le terrain</Text>
          ) : null}
          {starters.map((token) => (
            <Text
              key={`terrain-${token?.placement?.playerId}`}
              numberOfLines={1}
              style={[Fonts.p4, { color: Colors.neutral200 }]}
            >
              {getPersonName(token.player)}
            </Text>
          ))}

          {benchPlayers.length > 0 ? (
            <Text style={[Fonts.p4Bold, { color: Colors.neutral00 }]}>Sur le banc</Text>
          ) : null}
          {benchPlayers.map((player) => (
            <Text
              key={`banc-${getPlayerId(player)}`}
              numberOfLines={1}
              style={[Fonts.p4, { color: Colors.neutral200 }]}
            >
              {getPersonName(player)}
            </Text>
          ))}

          {otherTeamsLine ? (
            <Text style={[Fonts.p4, { color: Colors.neutral200 }]}>{otherTeamsLine}</Text>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.footer, { backgroundColor: Colors.neutral900 }]}>
        {hasEventContext ? (
          <>
            {eventName ? (
              <Text numberOfLines={2} style={[Fonts.p3Bold, { color: Colors.neutral00 }]}>
                {eventName}
              </Text>
            ) : null}
            {whenLine ? (
              <Text numberOfLines={1} style={[Fonts.p4, { color: Colors.neutral200 }]}>
                {whenLine}
              </Text>
            ) : null}
            <Text numberOfLines={2} style={[Fonts.p4, { color: Colors.neutral200 }]}>
              {addressLine}
            </Text>
          </>
        ) : null}
        <Text numberOfLines={1} style={[Fonts.p4, { color: Colors.primary500 }]}>
          {type === 'lineup_share' ? teamLine : 'Appuyer pour voir la composition'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: 4,
    overflow: 'hidden',
    width: 250,
  },
  countBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  footer: {
    alignItems: 'flex-start',
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  header: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  headerTitle: {
    flex: 1,
  },
  miniField: {
    alignSelf: 'center',
    borderRadius: 8,
    height: MINI_FIELD_HEIGHT,
    margin: 8,
    overflow: 'hidden',
    width: MINI_FIELD_WIDTH,
  },
  miniToken: {
    alignItems: 'center',
    borderColor: '#FFF',
    borderRadius: MINI_TOKEN_SIZE / 2,
    borderWidth: 2,
    height: MINI_TOKEN_SIZE,
    justifyContent: 'center',
    position: 'absolute',
    width: MINI_TOKEN_SIZE,
  },
  miniTokenPhoto: {
    borderRadius: MINI_TOKEN_SIZE / 2,
    height: MINI_TOKEN_SIZE,
    width: MINI_TOKEN_SIZE,
  },
  miniTokenText: {
    fontWeight: '700',
  },
  // R6 — memes rembourrages que le pied de carte : la liste est une TROISIEME
  // bande de la meme carte, pas un encart pose dessus. Seul le filet du haut la
  // separe du terrain.
  roster: {
    borderTopWidth: 1,
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});

export default CompositionMessageBubble;
