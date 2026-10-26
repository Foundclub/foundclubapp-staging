import { useTranslation } from 'react-i18next';
import {
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import ConvocationGlyph from '@/components/atoms/convocationGlyph/ConvocationGlyph';
import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';

import { FORMAT_LIST, FORMAT_PITCH } from './convocationWizardUtils';

/**
 * 📋 CONVLISTE (26/10, planche A1, « 1- A » d'Adel) — « COMMENT VEUX-TU CONVOQUER ? ».
 *
 * La feuille s'ouvre juste apres « Convocation », par-dessus le fil : « En liste » (3 etapes) ou
 * « En composition » (4 etapes, le tunnel d'avant). Le dernier choix de l'equipe porte sa
 * pastille ; « En liste » reste en premier.
 * @param {object} props
 * @param {number} [props.bottomInset] Le retrait de la barre systeme, en points.
 * @param {'list' | 'pitch' | ''} [props.lastChoice]
 * @param {() => void} props.onClose
 * @param {(format: 'list' | 'pitch') => void} props.onPick
 * @param {string} props.title « Nouvelle convocation ».
 * @returns {import('react').ReactElement}
 */
function ConvocationModeSheet({
  bottomInset = 0, lastChoice = '', onClose, onPick, title,
}) {
  const { t } = useTranslation();
  const { Colors, Fonts } = useTheme();

  const options = [
    {
      format: FORMAT_LIST, glyph: 'check', hint: 'listHint', label: 'list',
    },
    {
      format: FORMAT_PITCH, glyph: 'clipboardUser', hint: 'pitchHint', label: 'pitch',
    },
  ];

  return (
    <View style={styles.root} testID="convocation-mode-sheet">
      <TouchableOpacity
        accessibilityLabel={t('conversationConvocation.mode.close')}
        accessibilityRole="button"
        activeOpacity={1}
        onPress={onClose}
        style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(Colors.neutral900, 0.6) }]}
        testID="convocation-mode-backdrop"
      />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: Colors.primary900,
            borderTopColor: withAlpha(Colors.neutral00, 0.12),
            paddingBottom: Math.max(bottomInset, 12) + 22,
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: withAlpha(Colors.neutral00, 0.3) }]} />
        <View style={styles.header}>
          <Text
            accessibilityRole="header"
            style={[Fonts.p1Bold, styles.title, { color: Colors.neutral00 }]}
          >
            {title}
          </Text>
          <TouchableOpacity
            accessibilityLabel={t('conversationConvocation.mode.close')}
            accessibilityRole="button"
            onPress={onClose}
            style={[styles.close, { backgroundColor: withAlpha(Colors.neutral00, 0.08) }]}
            testID="convocation-mode-close"
          >
            <SvgIcon color={Colors.neutral00} height={16} name="close" width={16} />
          </TouchableOpacity>
        </View>
        <Text style={[Fonts.p2Bold, { color: withAlpha(Colors.neutral00, 0.78) }]}>
          {t('conversationConvocation.mode.question')}
        </Text>
        {options.map((option) => {
          const isLast = lastChoice === option.format;
          return (
            <TouchableOpacity
              accessibilityRole="button"
              key={option.format}
              onPress={() => onPick(/** @type {'list' | 'pitch'} */ (option.format))}
              style={[
                styles.option,
                {
                  backgroundColor: Colors.primary800,
                  borderColor: isLast ? Colors.primary500 : withAlpha(Colors.neutral00, 0.14),
                },
              ]}
              testID={`convocation-mode-${option.format}`}
            >
              <View style={[styles.icon, { backgroundColor: withAlpha(Colors.primary500, 0.14) }]}>
                <ConvocationGlyph color={Colors.primary500} name={option.glyph} size={24} />
              </View>
              <View style={styles.optionText}>
                <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>
                  {t(`conversationConvocation.mode.${option.label}`)}
                </Text>
                <Text style={[Fonts.p3, styles.hint, { color: withAlpha(Colors.neutral00, 0.75) }]}>
                  {t(`conversationConvocation.mode.${option.hint}`)}
                </Text>
              </View>
              {isLast ? (
                <Text
                  style={[
                    Fonts.p4Bold,
                    styles.badge,
                    { backgroundColor: Colors.primary500, color: Colors.primary900 },
                  ]}
                >
                  {t('conversationConvocation.mode.lastChoice')}
                </Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
        <Text style={[Fonts.p3, styles.later, { color: withAlpha(Colors.neutral00, 0.7) }]}>
          {t('conversationConvocation.mode.later')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 10,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  close: {
    alignItems: 'center',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  handle: {
    alignSelf: 'center',
    borderRadius: 3,
    height: 5,
    width: 40,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingTop: 6,
  },
  hint: {
    lineHeight: 18,
    marginTop: 4,
  },
  icon: {
    alignItems: 'center',
    borderRadius: 14,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  later: {
    marginTop: 2,
    textAlign: 'center',
  },
  option: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 14,
    minHeight: 88,
    padding: 16,
  },
  optionText: {
    flex: 1,
    minWidth: 0,
  },
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  // Sur ordinateur (le site), la feuille garde une largeur de telephone, centree.
  sheet: {
    alignSelf: 'center',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    gap: 12,
    maxWidth: 560,
    paddingHorizontal: 16,
    paddingTop: 10,
    width: '100%',
  },
  title: {
    flex: 1,
    fontSize: 20,
  },
});

export default ConvocationModeSheet;
