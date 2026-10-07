import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator, StyleSheet, Text, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import EventCardNew from '@/components/molecules/eventCard/EventCardNew';

import ConvocationGlyph from './ConvocationGlyph';

/**
 * MESSAGERIE-1C — ETAPE 1 « EVENEMENT » (pack messagerie §3.12, §5).
 *
 * Les evenements a venir de l'equipe, avec les GRANDES CARTES EXISTANTES (`EventCardNew`, mode
 * « share » comme la feuille « Evenement » du fil) : la carte n'est pas modifiee, elle sert au
 * planning. L'evenement choisi a un anneau cyan et une pastille coche.
 * @param {object} props
 * @param {any[]} props.events
 * @param {boolean} [props.isLoading]
 * @param {(event: any) => void} props.onSelect
 * @param {string} [props.selectedEventId]
 * @returns {import('react').ReactElement}
 */
function ConvocationEventStep({
  events, isLoading = false, onSelect, selectedEventId = '',
}) {
  const { t } = useTranslation();
  const { Colors, Fonts } = useTheme();
  const caps = [Fonts.p3Bold, styles.caps, { color: withAlpha(Colors.neutral00, 0.6) }];

  return (
    <View style={styles.list} testID="convocation-step-event">
      <Text accessibilityRole="header" style={caps}>
        {t('conversationConvocation.event.question')}
      </Text>
      {isLoading ? (
        <View style={styles.state}>
          <ActivityIndicator color={Colors.primary500} />
          <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>
            {t('conversationConvocation.event.loading')}
          </Text>
        </View>
      ) : null}
      {!isLoading && events.length === 0 ? (
        <Text style={[Fonts.p2, styles.state, { color: Colors.neutral300 }]}>
          {t('conversationConvocation.event.empty')}
        </Text>
      ) : null}
      {events.map((event) => {
        const eventId = String(event?.documentId || '');
        const isSelected = eventId === String(selectedEventId || '');
        return (
          <View
            accessibilityHint={isSelected ? t('conversationConvocation.event.selected') : undefined}
            accessibilityState={{ selected: isSelected }}
            key={eventId}
            style={[
              styles.cardFrame,
              isSelected ? { borderColor: Colors.primary500 } : styles.cardFrameIdle,
            ]}
            testID={`convocation-event-${eventId}`}
          >
            <EventCardNew item={event} mode="share" onPress={() => onSelect(event)} />
            {isSelected ? (
              <View
                pointerEvents="none"
                style={[
                  styles.check,
                  { backgroundColor: Colors.primary500, borderColor: Colors.primary900 },
                ]}
                testID="convocation-event-check"
              >
                <ConvocationGlyph color={Colors.primary900} name="check" size={17} />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  caps: {
    fontSize: 12,
    letterSpacing: 1.2,
  },
  cardFrame: {
    borderRadius: 26,
    borderWidth: 2.5,
    position: 'relative',
  },
  cardFrameIdle: {
    borderColor: 'transparent',
  },
  check: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 3,
    height: 32,
    justifyContent: 'center',
    position: 'absolute',
    right: -6,
    top: -8,
    width: 32,
  },
  list: {
    gap: 14,
  },
  state: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 12,
  },
});

export default ConvocationEventStep;
