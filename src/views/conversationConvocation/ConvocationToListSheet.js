import { useTranslation } from 'react-i18next';
import {
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

/**
 * 📋 CONVLISTE-FIN (chef 26/10, planche C3) — « PASSER EN LISTE ? », LA FEUILLE DE LA PLANCHE.
 *
 * Posee PAR-DESSUS le tunnel, dans sa fenetre (pas de seconde Modal) : elle remplace la fenetre
 * systeme (Alert ; `window.confirm` au site). Elle dit ce qui reste et ce qui sera efface.
 * @param {object} props
 * @param {number} [props.bottomInset] Le retrait de la barre systeme, en points.
 * @param {() => void} props.onConfirm « Passer en liste ».
 * @param {() => void} props.onKeep « Garder la composition », ou le fond touche.
 * @returns {import('react').ReactElement}
 */
function ConvocationToListSheet({ bottomInset = 0, onConfirm, onKeep }) {
  const { t } = useTranslation();
  const { Colors, Fonts } = useTheme();

  return (
    <View style={[StyleSheet.absoluteFill, styles.root]} testID="convocation-tolist-sheet">
      <TouchableOpacity
        accessibilityLabel={t('conversationConvocation.mode.keepPitch')}
        accessibilityRole="button"
        activeOpacity={1}
        onPress={onKeep}
        style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(Colors.neutral900, 0.62) }]}
      />
      <View
        accessibilityViewIsModal
        style={[
          styles.sheet,
          {
            backgroundColor: Colors.primary800,
            paddingBottom: Math.max(bottomInset, 12) + 22,
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: withAlpha(Colors.neutral00, 0.3) }]} />
        <Text
          accessibilityRole="header"
          style={[Fonts.p1Bold, styles.title, { color: Colors.neutral00 }]}
        >
          {t('conversationConvocation.mode.toListTitle')}
        </Text>
        <Text style={[Fonts.p2, styles.line, { color: withAlpha(Colors.neutral00, 0.85) }]}>
          {t('conversationConvocation.mode.toListMessage')}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={onConfirm}
          style={[styles.button, { backgroundColor: Colors.primary500 }]}
          testID="convocation-tolist-confirm"
        >
          <Text style={[Fonts.p2Bold, { color: Colors.primary900 }]}>
            {t('conversationConvocation.mode.toList')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={onKeep}
          style={[
            styles.button,
            styles.outline,
            { borderColor: withAlpha(Colors.neutral00, 0.35) },
          ]}
          testID="convocation-tolist-keep"
        >
          <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
            {t('conversationConvocation.mode.keepPitch')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 26,
    height: 52,
    justifyContent: 'center',
  },
  handle: {
    alignSelf: 'center',
    borderRadius: 3,
    height: 5,
    width: 40,
  },
  line: {
    lineHeight: 21,
  },
  outline: {
    borderWidth: 1.5,
  },
  root: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  // Sur ordinateur (le site), la feuille garde une largeur de telephone, centree.
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 14,
    maxWidth: 560,
    paddingHorizontal: 20,
    paddingTop: 10,
    width: '100%',
  },
  title: {
    fontSize: 20,
    marginTop: 6,
  },
});

export default ConvocationToListSheet;
