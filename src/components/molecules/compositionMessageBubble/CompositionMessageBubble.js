// @ts-nocheck
/* eslint-disable no-nested-ternary */
import { useNavigation } from '@react-navigation/native';
import dayjs from 'dayjs';
import {
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import 'dayjs/locale/fr';

import { getAuthRuntimeSnapshot } from '@/store/authRuntime';
import useTheme from '@/theme/themeContext';

import RenderedTacticalField from '@/components/tactical/RenderedTacticalField';
import { getViewerConvocationRole } from '@/views/playerConvocation/playerConvocationUtils';

import { RouteNames } from '@/navigation/routeNames';

// Mini field dimensions
const MINI_FIELD_WIDTH = 220;
const MINI_FIELD_HEIGHT = 150;
const MINI_TOKEN_SIZE = 24;

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
    const initials = player ? getPlayerInitials(player) : '?';
    const left = ((positionX || 0) / 100) * MINI_FIELD_WIDTH - MINI_TOKEN_SIZE / 2;
    const top = ((positionY || 0) / 100) * MINI_FIELD_HEIGHT - MINI_TOKEN_SIZE / 2;

    return (
      <View
        key={`${playerId || 'unknown'}-${positionX || 0}-${positionY || 0}`}
        style={[
          styles.miniToken,
          {
            backgroundColor: Colors.primary500,
            left,
            top,
          },
        ]}
      >
        {/* Initiales sur pastille primary500 : encre primary900 (cf. THEME.md). */}
        <Text style={[styles.miniTokenText, { color: Colors.primary900 }]}>
          {initials}
        </Text>
      </View>
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
            match, le quand et le ou descendent dans le pied de carte. */}
        <Text numberOfLines={1} style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
          {type === 'lineup_share' ? "Composition d'équipes publiée" : 'Composition du match'}
        </Text>
      </View>

      <RenderedTacticalField sport={sport} style={styles.miniField}>
        {renderMiniTokens()}
        <View style={[styles.countBadge, { backgroundColor: Colors.primary500 }]}>
          <Text style={[Fonts.p3Bold, { color: Colors.primary900 }]}>
            {isMultiTeamComposition ? teams.length : previewPlacements.length}
            {' '}
            {isMultiTeamComposition ? 'equipe(s)' : `joueur${previewPlacements.length > 1 ? 's' : ''}`}
          </Text>
        </View>
      </RenderedTacticalField>

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
    position: 'absolute',
    right: 6,
    top: 6,
  },
  footer: {
    alignItems: 'flex-start',
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
  miniTokenText: {
    fontSize: 8,
    fontWeight: '700',
  },
});

export default CompositionMessageBubble;
