import {
  Modal, Pressable, StyleSheet, Text, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

/**
 * @param {{
 *  onClose?: () => void,
 *  onOpenMatch?: () => void,
 *  onRelaunchSearch?: () => void,
 *  payload?: any,
 *  visible: boolean,
 * }} props
 * @returns {React.ReactElement | null}
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
  const pointsDelta = Number(recap.divisionPointsDelta ?? recap.eloDelta ?? 0);
  const pointsDeltaLabel = `${pointsDelta >= 0 ? '+' : ''}${pointsDelta}`;
  const baseDelta = Number(recap.basePointsDelta ?? 0);
  const streakBonus = Number(recap.streakBonus ?? 0);
  const divisionBefore = Number(recap.divisionBefore);
  const divisionAfter = Number(recap.divisionAfter);
  const hasDivisionMovement = Boolean(
    recap.divisionChanged
      && Number.isFinite(divisionBefore)
      && Number.isFinite(divisionAfter)
      && divisionBefore !== divisionAfter,
  );
  let divisionMovementType = 'Changement';
  if (recap.promotion) {
    divisionMovementType = 'Promotion';
  } else if (recap.relegation) {
    divisionMovementType = 'Relegation';
  }
  const divisionMovementLabel = hasDivisionMovement
    ? `${divisionMovementType} DIV ${divisionBefore} -> DIV ${divisionAfter}`
    : '';

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
          <Text style={[Fonts.h2Bold, { color: Colors.gold500, textAlign: 'center' }]}>{scoreLabel}</Text>
          <Text style={[Fonts.p2, { color: Colors.neutral300, textAlign: 'center' }]}>
            {recap.resultLabel || recap.result || 'Résultat validé'}
          </Text>

          {hasDivisionMovement ? (
            <Text style={[Fonts.p2Bold, { color: recap.promotion ? Colors.success500 : Colors.gold500, textAlign: 'center' }]}>
              {divisionMovementLabel}
            </Text>
          ) : null}

          <View style={[styles.statRow, { borderColor: 'rgba(255,255,255,0.12)' }]}>
            <View style={styles.statBlock}>
              <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>Points avant</Text>
              <Text style={[Fonts.h4Bold, { color: Colors.gold500 }]}>{recap.divisionPointsBefore ?? '-'}</Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>Total</Text>
              <Text style={[Fonts.h4Bold, { color: Colors.gold500 }]}>{pointsDeltaLabel}</Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>Points après</Text>
              <Text style={[Fonts.h4Bold, { color: Colors.gold500 }]}>{recap.divisionPointsAfter ?? '-'}</Text>
            </View>
          </View>

          <Text style={[Fonts.p3, { color: Colors.neutral300, textAlign: 'center' }]}>
            Resultat
            {' '}
            {baseDelta >= 0 ? '+' : ''}
            {baseDelta}
            {' | Bonus série '}
            {streakBonus >= 0 ? '+' : ''}
            {streakBonus}
            {' | Total points League '}
            {pointsDeltaLabel}
          </Text>

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
