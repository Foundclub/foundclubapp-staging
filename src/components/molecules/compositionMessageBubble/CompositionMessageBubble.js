// @ts-nocheck
/* eslint-disable no-nested-ternary */
import { useNavigation } from '@react-navigation/native';
import dayjs from 'dayjs';
import {
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import 'dayjs/locale/fr';

import useTheme from '@/theme/themeContext';

import RenderedTacticalField from '@/components/tactical/RenderedTacticalField';

import { RouteNames } from '@/navigation/routeNames';

// Mini field dimensions
const MINI_FIELD_WIDTH = 220;
const MINI_FIELD_HEIGHT = 150;
const MINI_TOKEN_SIZE = 24;

/**
 * @typedef {{ id?: string; documentId?: string; firstname?: string; lastname?: string }} CompositionPlayer
 * @typedef {{ playerId?: string; positionX?: number; positionY?: number }} CompositionPlacement
 * @typedef {{
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

  const formattedDate = eventDate ? dayjs(eventDate).locale('fr').format('DD/MM/YYYY') : '';

  const handlePress = () => {
    navigation.navigate(RouteNames.EventStack, {
      params: {
        canEdit: false,
        editorMode: 'event',
        editorSource: type === 'lineup_share' ? 'published' : null,
        editorSourceLabel: type === 'lineup_share' ? "Composition d'equipes publiee" : null,
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
        <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
          {type === 'lineup_share' ? "Composition d'equipes publiee" : 'Composition du match'}
        </Text>
        {formattedDate ? (
          <Text style={[Fonts.p3, { color: Colors.neutral00 }]}>
            {formattedDate}
          </Text>
        ) : null}
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
        <Text style={[Fonts.p4, { color: Colors.primary500 }]}>
          {type === 'lineup_share'
            ? `${teamName || 'Equipe'}${publishedVersion ? ` · v${publishedVersion}` : ''}`
            : 'Appuyer pour voir la composition'}
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
    alignItems: 'center',
    paddingVertical: 8,
  },
  header: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
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
