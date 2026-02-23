import React from 'react';
import {
  Modal, Pressable, StyleSheet, Text, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

/**
 *
 * @param root0
 * @param root0.onClose
 * @param root0.onOpenMatch
 * @param root0.onRelaunchSearch
 * @param root0.payload
 * @param root0.visible
 */
function MatchRecapSheet({
  onClose,
  onOpenMatch,
  onRelaunchSearch,
  payload,
  visible,
}) {
  const { Colors, Fonts } = useTheme();
  if (!visible || !payload) return null;

  const recap = payload.recap || {};
  const scoreLabel = recap.scoreLabel || `${recap.myScore ?? '-'} - ${recap.opponentScore ?? '-'}`;
  const eloDeltaLabel = recap.eloDeltaLabel || `${recap.eloDelta >= 0 ? '+' : ''}${recap.eloDelta ?? 0}`;

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: 'rgba(10, 28, 43, 0.97)',
              borderColor: Colors.primary500,
            },
          ]}
        >
          <Text style={[Fonts.h3, { color: Colors.gold500, textAlign: 'center' }]}>Recap de fin de match</Text>
          <Text style={[Fonts.h2Bold, { color: Colors.neutral00, textAlign: 'center' }]}>{scoreLabel}</Text>
          <Text style={[Fonts.p2, { color: Colors.neutral300, textAlign: 'center' }]}>
            {recap.resultLabel || recap.result || 'Resultat valide'}
          </Text>

          <View style={[styles.statRow, { borderColor: 'rgba(255,255,255,0.12)' }]}>
            <View style={styles.statBlock}>
              <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>ELO avant</Text>
              <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>{recap.eloBefore ?? '-'}</Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>Delta</Text>
              <Text style={[Fonts.h4Bold, { color: recap.eloDelta >= 0 ? Colors.success500 : Colors.error500 }]}>{eloDeltaLabel}</Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>ELO apres</Text>
              <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>{recap.eloAfter ?? '-'}</Text>
            </View>
          </View>

          <View style={styles.buttons}>
            <Button
              onPress={onOpenMatch}
              title="Voir le detail"
              variant="Primary"
            />
            <Button
              onPress={onRelaunchSearch}
              style={{ borderColor: Colors.gold500 }}
              textStyle={{ color: Colors.gold500 }}
              title="Relancer une recherche"
              variant="Secondary"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  buttons: {
    gap: 10,
    marginTop: 8,
  },
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
    flex: 1,
    justifyContent: 'flex-end',
    padding: 12,
  },
  sheet: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  statBlock: {
    alignItems: 'center',
    flex: 1,
  },
  statRow: {
    borderBottomWidth: 1,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 8,
    paddingVertical: 12,
  },
});

export default MatchRecapSheet;
