import { useTranslation } from 'react-i18next';
import {
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import { buildEventSummary } from './convocationWizardUtils';

/**
 * MESSAGERIE-1C — le rappel de l'evenement en tete des etapes Joueurs, Placement et Details
 * (pack messagerie §3.12) : la puce du type, le titre, quand et ou. « Changer » ramene a
 * l'etape Evenement — seulement a la creation : une convocation publiee garde son evenement.
 * @param {object} props
 * @param {any} props.event Une carte d'evenement, ou le resume d'une convocation publiee.
 * @param {() => void} [props.onChange] Absent = pas de bouton « Changer ».
 * @returns {import('react').ReactElement | null}
 */
function ConvocationEventRecap({ event, onChange }) {
  const { t } = useTranslation();
  const { Colors, Fonts } = useTheme();
  if (!event) return null;

  const summary = buildEventSummary(event);
  const typeColors = {
    match: Colors.error500,
    other: Colors.primary500,
    training: Colors.success500,
  };
  const typeColor = typeColors[summary.typeKey];
  const line = [summary.when, summary.place].filter(Boolean).join(' · ');

  return (
    <View
      style={[styles.card, { backgroundColor: Colors.primary700 }]}
      testID="convocation-event-recap"
    >
      <View style={styles.text}>
        {summary.typeLabel ? (
          <View style={styles.typeRow}>
            <View style={[styles.typeDot, { backgroundColor: typeColor }]} />
            <Text numberOfLines={1} style={[Fonts.p4Bold, styles.typeLabel, { color: typeColor }]}>
              {summary.typeLabel.toUpperCase()}
            </Text>
          </View>
        ) : null}
        <Text numberOfLines={1} style={[Fonts.p2Bold, styles.title, { color: Colors.neutral00 }]}>
          {summary.title}
        </Text>
        {line ? (
          <Text numberOfLines={1} style={[Fonts.p3, styles.line, { color: Colors.neutral300 }]}>
            {line}
          </Text>
        ) : null}
      </View>
      {onChange ? (
        <TouchableOpacity
          accessibilityRole="button"
          hitSlop={8}
          onPress={onChange}
          testID="convocation-event-change"
        >
          <Text style={[Fonts.p2Bold, { color: Colors.primary500 }]}>
            {t('conversationConvocation.event.change')}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  line: {
    fontSize: 12.5,
  },
  text: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  title: {
    fontSize: 15.5,
  },
  typeDot: {
    borderRadius: 4,
    height: 7,
    width: 7,
  },
  typeLabel: {
    fontSize: 11,
    letterSpacing: 1.4,
  },
  typeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
});

export default ConvocationEventRecap;
