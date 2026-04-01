import { useEffect, useMemo } from 'react';
import {
  Modal, Pressable, StyleSheet, Text, View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import DivisionBadge from '@/components/atoms/league/DivisionBadge';
import LeagueModalHeader from '@/components/molecules/header/LeagueModalHeader';

import { clampLeagueDivision, isMaxDivision } from '@/utils/league/division';

const AUTO_HIDE_MS = 4800;

const formatDelta = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '0';
  return `${parsed >= 0 ? '+' : ''}${parsed}`;
};

const getStatusUi = (status, colors) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'valid') {
    return { chip: 'Résultat validé', color: colors.success500 };
  }
  if (normalized === 'forfeit') {
    return { chip: 'Forfait', color: colors.warning500 };
  }
  if (normalized === 'no_show') {
    return { chip: 'No-show', color: colors.error500 };
  }
  return { chip: 'Match annulé', color: colors.error500 };
};

/**
 * @param {{
 *  onClose?: () => void;
 *  onOpenDetails?: () => void;
 *  onRelaunchSearch?: () => void;
 *  payload?: any;
 *  visible: boolean;
 * }} props
 */
function MatchFinalPosterModal({
  onClose,
  onOpenDetails,
  onRelaunchSearch,
  payload,
  visible,
}) {
  const { Colors, Fonts } = useTheme();
  const entry = useSharedValue(0);
  const eloProgress = useSharedValue(0);
  const recap = payload?.recap || {};
  const finalStatus = String(payload?.finalStatus || recap?.finalStatus || payload?.phase || '').toLowerCase();
  const statusUi = useMemo(
    () => getStatusUi(finalStatus, Colors),
    [Colors, finalStatus],
  );

  useEffect(() => {
    if (!visible || !payload) return undefined;
    entry.value = 0;
    eloProgress.value = 0;
    entry.value = withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) });
    eloProgress.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
    const timer = setTimeout(() => {
      onClose?.();
    }, AUTO_HIDE_MS);
    return () => clearTimeout(timer);
  }, [eloProgress, entry, onClose, payload, visible]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: entry.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: entry.value,
    transform: [{ translateY: 20 - (entry.value * 20) }, { scale: 0.94 + (entry.value * 0.06) }],
  }));

  const eloFillStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, Math.min(1, eloProgress.value)) * 100}%`,
  }));

  if (!visible || !payload) return null;

  const scoreLabel = recap?.scoreLabel || `${recap?.myScore ?? '-'}-${recap?.opponentScore ?? '-'}`;
  const eloBefore = Number.isFinite(Number(recap?.eloBefore)) ? Number(recap.eloBefore) : 0;
  const eloAfter = Number.isFinite(Number(recap?.eloAfter)) ? Number(recap.eloAfter) : eloBefore;
  const parsedDivisionBefore = Number.isFinite(Number(recap?.divisionBefore)) ? Number(recap.divisionBefore) : null;
  const parsedDivisionAfter = Number.isFinite(Number(recap?.divisionAfter)) ? Number(recap.divisionAfter) : parsedDivisionBefore;
  const divisionBefore = parsedDivisionBefore !== null ? clampLeagueDivision(parsedDivisionBefore) : null;
  const divisionAfter = parsedDivisionAfter !== null ? clampLeagueDivision(parsedDivisionAfter) : 5;
  const divisionChanged = Boolean(divisionBefore && divisionAfter && divisionBefore !== divisionAfter && recap?.divisionChanged !== false);
  const delta = formatDelta(recap?.eloDelta);
  const divisionLabel = divisionChanged
    ? `Division ${divisionBefore} -> ${divisionAfter}`
    : `Division ${divisionAfter || 5}`;
  let divisionStatusLabel = 'Maintien';
  if (divisionChanged) {
    divisionStatusLabel = divisionAfter < divisionBefore ? 'Promotion' : 'Relégation';
  } else if (isMaxDivision(divisionAfter)) {
    divisionStatusLabel = 'Division max atteinte';
  }

  return (
    <Modal animationType="none" onRequestClose={onClose} transparent visible={visible}>
      <Animated.View style={[styles.overlay, overlayStyle]}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
        <Animated.View
          style={[
            styles.poster,
            cardStyle,
            {
              backgroundColor: 'rgba(1, 36, 52, 0.96)',
              borderColor: Colors.gold500,
            },
          ]}
        >
          <LeagueModalHeader title="Fin de match" />

          <View style={styles.headerRow}>
            <View />
            <View style={[styles.statusChip, { backgroundColor: `${statusUi.color}2A`, borderColor: statusUi.color }]}>
              <Text style={[Fonts.p3Bold, { color: statusUi.color }]}>{statusUi.chip}</Text>
            </View>
          </View>

          <Text style={[Fonts.h1Bold, { color: Colors.gold500, marginTop: 12, textAlign: 'center' }]}>{scoreLabel}</Text>
          <Text style={[Fonts.p2, { color: Colors.neutral200, marginTop: 4, textAlign: 'center' }]}>
            {recap?.resultLabel || recap?.result || 'Résultat enregistré'}
          </Text>

          <View
            style={[
              styles.eloCard,
              {
                backgroundColor: 'rgba(1, 53, 75, 0.42)',
                borderColor: 'rgba(1, 179, 244, 0.35)',
              },
            ]}
          >
            <View style={styles.eloHeader}>
              <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
                ELO avant:
                {eloBefore}
              </Text>
              <Text style={[Fonts.h4Bold, { color: Number(recap?.eloDelta) >= 0 ? Colors.success500 : Colors.error500 }]}>{delta}</Text>
              <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
                ELO après:
                {eloAfter}
              </Text>
            </View>
            <View style={[styles.eloTrack, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
              <Animated.View
                style={[
                  styles.eloFill,
                  eloFillStyle,
                  { backgroundColor: Number(recap?.eloDelta) >= 0 ? Colors.success500 : Colors.error500 },
                ]}
              />
            </View>
          </View>

          <View style={styles.divisionRow}>
            <DivisionBadge
              division={divisionAfter || 5}
              showChrome={false}
              showLabel={false}
              size={72}
            />
            <View style={{ alignItems: 'center' }}>
              <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>{divisionLabel}</Text>
              <Text style={[Fonts.p3, { color: Colors.neutral300, marginTop: 2 }]}>{divisionStatusLabel}</Text>
            </View>
          </View>

          <View style={styles.actions}>
            <Button onPress={onOpenDetails} title="Voir détails" variant="Primary" />
            <Button
              onPress={onRelaunchSearch}
              style={{ borderColor: Colors.gold500 }}
              textStyle={{ color: Colors.gold500 }}
              title="Relancer une recherche"
              variant="Secondary"
            />
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 10,
    marginTop: 14,
  },
  divisionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
  },
  eloCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
    padding: 12,
  },
  eloFill: {
    borderRadius: 999,
    height: 6,
  },
  eloHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  eloTrack: {
    borderRadius: 999,
    height: 6,
    marginTop: 10,
    overflow: 'hidden',
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  poster: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  statusChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});

export default MatchFinalPosterModal;
