import { useTranslation } from 'react-i18next';
import {
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import ConvocationGlyph from '@/components/atoms/convocationGlyph/ConvocationGlyph';

import { FORMAT_LIST } from './convocationWizardUtils';

/**
 * 📋 CONVLISTE (26/10, planches B1, B2, C1, C2, D1) — LE MODE EN COURS, ET LE PASSAGE A L'AUTRE.
 *
 * Une pastille (« En liste » / « En composition ») et un bouton qui dit ce qu'il fait (« Passer en
 * composition » / « Passer en liste »). Juste apres un passage en composition, une phrase dit que
 * les joueurs sont gardes, tous sur le terrain.
 * @param {object} props
 * @param {'list' | 'pitch'} props.format
 * @param {number} [props.keptCount] Joueurs gardes au passage en composition ; 0 = rien a dire.
 * @param {() => void} props.onSwitch
 * @returns {import('react').ReactElement}
 */
function ConvocationModeRow({ format, keptCount = 0, onSwitch }) {
  const { t } = useTranslation();
  const { Colors, Fonts } = useTheme();
  const isList = format === FORMAT_LIST;

  return (
    <View style={styles.wrap} testID="convocation-mode-row">
      <View style={styles.row}>
        <View style={[styles.chip, { backgroundColor: withAlpha(Colors.primary500, 0.12) }]}>
          <ConvocationGlyph
            color={Colors.primary200}
            name={isList ? 'check' : 'clipboardUser'}
            size={14}
          />
          <Text style={[Fonts.p3Bold, { color: Colors.primary200 }]}>
            {t(isList ? 'conversationConvocation.mode.list' : 'conversationConvocation.mode.pitch')}
          </Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          hitSlop={8}
          onPress={onSwitch}
          style={styles.switch}
          testID="convocation-mode-switch"
        >
          <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
            {t(isList
              ? 'conversationConvocation.mode.toPitch'
              : 'conversationConvocation.mode.toList')}
          </Text>
        </TouchableOpacity>
      </View>
      {keptCount > 0 ? (
        <Text
          style={[
            Fonts.p3,
            styles.notice,
            { backgroundColor: withAlpha(Colors.success500, 0.14), color: Colors.success100 },
          ]}
          testID="convocation-mode-kept"
        >
          {t('conversationConvocation.mode.toPitchDone', { count: keptCount })}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  notice: {
    borderRadius: 12,
    lineHeight: 18,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  switch: {
    justifyContent: 'center',
    minHeight: 44,
  },
  wrap: {
    gap: 8,
    marginBottom: 12,
  },
});

export default ConvocationModeRow;
