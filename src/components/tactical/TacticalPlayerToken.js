import { useMemo } from 'react';
import {
  Image, StyleSheet, Text, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import { getImageUrl } from '@/utils/imageUrl';

/**
 * @typedef {import('./types').TacticalPlayer} TacticalPlayer
 */

/**
 * 🧩 COMPOLECT-2 — LE JETON, SANS LE GLISSEMENT.
 *
 * 🧨 CE QUI A OBLIGE A CETTE SEPARATION, mesure du 2026-08-27 : faire lire le
 * jeton de la creation par l apercu de l onglet « Convocations » a rendu
 * **21 suites ROUGES d un coup**. Cause : `DraggableToken` importe
 * `react-native-reanimated` — que jest ne sait pas analyser (il est hors des
 * `transformIgnorePatterns`) — et cet import ne sert QU AU FANTOME qui suit le
 * doigt. Tout ecran qui voulait le jeton heritait donc du moteur d animation.
 *
 * ⇒ Les APPARENCES (terrain et banc) vivent ici : elles ne connaissent que
 *   `View`, `Text` et `Image`. Le FANTOME reste dans `DraggableToken`, avec sa
 *   dependance.
 * ⇒ `DraggableToken` garde son API mot pour mot et delegue ici : **aucun des
 *   6 ecrans qui l emploient ne change**, aucun de leurs doubles de test non
 *   plus. C est ce qui rend cette separation sure.
 *
 * ⛔ CE N EST PAS UN 4e RENDU DE JETON — c est le CONTRAIRE : c est le seul, et
 * il est maintenant atteignable par un ecran qui ne fait pas glisser.
 */

/**
 * L avatar et les initiales d une personne, tels que le jeton les dessine.
 *
 * ⚠️ Un joueur saisi A LA MAIN n a jamais de photo : il n a pas de compte, et
 * une photo homonyme serait pire que des initiales.
 * @param {any} player
 * @returns {{ avatarUri: string | null, initials: string }}
 */
export const useTokenIdentity = (player) => {
  const initials = useMemo(() => {
    const first = player?.firstname?.charAt(0)?.toUpperCase() || '';
    const last = player?.lastname?.charAt(0)?.toUpperCase() || '';
    return first + last || '?';
  }, [player]);

  const isManualPlayer = useMemo(
    () => player?.isManual || String(player?.id || '').startsWith('manual_'),
    [player],
  );

  const avatarUri = useMemo(() => {
    if (isManualPlayer) return null;
    if (!player?.avatar) return null;

    let rawUrl = null;
    if (typeof player.avatar === 'string') {
      rawUrl = player.avatar;
    } else if (player.avatar?.url && typeof player.avatar.url === 'string') {
      rawUrl = player.avatar.url;
    } else if (
      player.avatar?.formats?.thumbnail?.url
      && typeof player.avatar.formats.thumbnail.url === 'string'
    ) {
      rawUrl = player.avatar.formats.thumbnail.url;
    }

    return rawUrl ? getImageUrl(rawUrl) : null;
  }, [player?.avatar, isManualPlayer]);

  return { avatarUri, initials };
};

/**
 * Le jeton d un joueur : sa tete sur le terrain, ou sa carte au banc.
 * @param {object} props
 * @param {TacticalPlayer} props.player
 * @param {boolean} [props.isOnField] - Tete flottante du terrain plutot que carte de banc.
 * @returns {import('react').ReactElement}
 */
function TacticalPlayerToken({ isOnField = false, player }) {
  const { Colors } = useTheme();
  const { avatarUri, initials } = useTokenIdentity(player);

  // Field Token - Round floating head style
  if (isOnField) {
    return (
      <View
        style={[
          styles.fieldToken,
          {
            backgroundColor: Colors.primary700,
            borderColor: Colors.neutral00,
            shadowColor: Colors.primary500,
          },
        ]}
      >
        <View style={[styles.fieldAvatarContainer, { borderColor: Colors.neutral00 }]}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.fieldAvatar} />
          ) : (
            <View
              style={[
                styles.fieldInitialsContainer,
                { backgroundColor: Colors.primary600 },
              ]}
            >
              <Text style={[styles.fieldInitials, { color: Colors.neutral00 }]}>{initials}</Text>
            </View>
          )}
        </View>

        {player?.number && (
          <View
            style={[
              styles.jerseyBadge,
              {
                backgroundColor: Colors.primary900 || Colors.neutral900,
                borderColor: Colors.neutral00,
              },
            ]}
          >
            <Text style={[styles.jerseyNumber, { color: Colors.neutral00 }]}>{player.number}</Text>
          </View>
        )}

        <View style={[styles.fieldNameBadge, { backgroundColor: `${Colors.primary900 || Colors.neutral900}A6` }]}>
          <Text numberOfLines={1} style={[styles.fieldName, { color: Colors.neutral00 }]}>
            {player?.firstname || ''}
          </Text>
        </View>
      </View>
    );
  }

  // Bench Token - Card style
  return (
    <View
      style={[
        styles.benchToken,
        {
          backgroundColor: Colors.primary900 || Colors.neutral800,
          borderColor: `${Colors.primary500}55`,
          shadowColor: Colors.primary500,
        },
      ]}
    >
      <View style={[styles.benchAvatarCircle, { backgroundColor: `${Colors.primary500}22`, borderColor: `${Colors.primary500}40` }]}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.benchAvatar} />
        ) : (
          <Text style={[styles.benchInitials, { color: Colors.neutral00 }]}>{initials}</Text>
        )}
      </View>

      {player?.number && (
        <View style={[styles.benchJerseyBadge, { backgroundColor: Colors.primary500 }]}>
          {/* Encre unique sur primary500 : le blanc y tombe a 2,40:1 (echec
              WCAG AA), primary900 rend 7,96:1 — THEME.md. */}
          <Text style={[styles.benchJerseyNumber, { color: Colors.primary900 }]}>
            {player.number}
          </Text>
        </View>
      )}

      <View style={styles.benchNameContainer}>
        <Text numberOfLines={1} style={[styles.benchFirstName, { color: Colors.neutral00 }]}>
          {player?.firstname || ''}
        </Text>
        <Text numberOfLines={1} style={[styles.benchLastName, { color: Colors.neutral300 }]}>
          {player?.lastname || ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // === FIELD TOKEN (On pitch) ===
  benchAvatar: {
    borderRadius: 22,
    height: 44,
    width: 44,
  },
  benchAvatarCircle: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 44,
  },
  benchFirstName: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  benchInitials: {
    fontSize: 14,
    fontWeight: '700',
  },
  benchJerseyBadge: {
    alignItems: 'center',
    borderRadius: 9,
    height: 18,
    justifyContent: 'center',
    position: 'absolute',
    right: 4,
    top: 4,
    width: 18,
  },
  benchJerseyNumber: {
    fontSize: 9,
    fontWeight: '700',
  },
  benchLastName: {
    fontSize: 8,
    fontWeight: '500',
    textAlign: 'center',
  },
  benchNameContainer: {
    alignItems: 'center',
    marginTop: 4,
    paddingHorizontal: 4,
    width: '100%',
  },
  benchToken: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 2,
    elevation: 6,
    height: 88,
    marginHorizontal: 4,
    paddingTop: 9,
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    width: 72,
  },
  fieldAvatar: {
    borderRadius: 20,
    height: 40,
    width: 40,
  },
  fieldAvatarContainer: {
    borderRadius: 22,
    borderWidth: 2,
    height: 44,
    overflow: 'hidden',
    width: 44,
  },
  fieldInitials: {
    fontSize: 14,
    fontWeight: '800',
  },
  fieldInitialsContainer: {
    alignItems: 'center',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  fieldName: {
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { height: 1, width: 0 },
    textShadowRadius: 2,
  },
  fieldNameBadge: {
    alignItems: 'center',
    borderRadius: 999,
    marginTop: 2,
    maxWidth: 65,
    minWidth: 42,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  fieldToken: {
    alignItems: 'center',
    borderRadius: 29,
    borderWidth: 3,
    elevation: 12,
    height: 72,
    paddingTop: 4,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    width: 58,
  },
  jerseyBadge: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 2,
    height: 20,
    justifyContent: 'center',
    position: 'absolute',
    right: -2,
    top: -2,
    width: 20,
  },
  jerseyNumber: {
    fontSize: 9,
    fontWeight: '800',
  },
});

export default TacticalPlayerToken;
