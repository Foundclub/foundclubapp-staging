import { useTranslation } from 'react-i18next';
import {
  StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

/**
 * MESSAGERIE-1C — ETAPE 4 « DETAILS » (pack messagerie §3.12, §5).
 *
 * « Rendez-vous » (prerempli « 13h30 au club » a la creation), « Infos » (texte libre), et
 * l'interrupteur « Demander Present / Absent ». Le rendez-vous et les infos n'ont aucun champ
 * dans la composition : ils partent dans le groupe, en message, juste apres la convocation.
 *
 * 🔒 Un evenement dont l'organisateur a coupe les reponses (`rsvpEnabled: false`) : le serveur
 * refuserait toute reponse. L'interrupteur est alors eteint et verrouille, et le dit (meme regle
 * que la feuille « Publier » du plateau, FINITIONS5).
 * @param {object} props
 * @param {boolean} props.askResponses
 * @param {number} props.benchCount
 * @param {string} props.infos
 * @param {string} props.meetingPoint
 * @param {(value: boolean) => void} props.onChangeAsk
 * @param {(value: string) => void} props.onChangeInfos
 * @param {(value: string) => void} props.onChangeMeetingPoint
 * @param {number} props.pitchCount
 * @param {boolean} [props.responsesLocked]
 * @returns {import('react').ReactElement}
 */
function ConvocationDetailsStep({
  askResponses,
  benchCount,
  infos,
  meetingPoint,
  onChangeAsk,
  onChangeInfos,
  onChangeMeetingPoint,
  pitchCount,
  responsesLocked = false,
}) {
  const { t } = useTranslation();
  const { Colors, Fonts } = useTheme();
  const caps = [Fonts.p3Bold, styles.caps, { color: withAlpha(Colors.neutral00, 0.6) }];
  const field = [
    Fonts.p2,
    styles.field,
    {
      backgroundColor: Colors.primary800,
      borderColor: Colors.primary700,
      color: Colors.neutral00,
    },
  ];

  return (
    <View style={styles.root} testID="convocation-step-details">
      <Text style={caps}>{t('conversationConvocation.details.meeting')}</Text>
      <TextInput
        accessibilityLabel={t('conversationConvocation.details.meetingLabel')}
        onChangeText={onChangeMeetingPoint}
        placeholder={t('conversationConvocation.details.meetingPlaceholder')}
        placeholderTextColor={Colors.neutral400}
        style={[field, styles.single]}
        testID="convocation-meeting"
        value={meetingPoint}
      />

      <Text style={[caps, styles.spaced]}>{t('conversationConvocation.details.infos')}</Text>
      <TextInput
        accessibilityLabel={t('conversationConvocation.details.infosLabel')}
        multiline
        numberOfLines={3}
        onChangeText={onChangeInfos}
        placeholder={t('conversationConvocation.details.infosPlaceholder')}
        placeholderTextColor={Colors.neutral400}
        style={[field, styles.multi]}
        testID="convocation-infos"
        textAlignVertical="top"
        value={infos}
      />

      <View style={[styles.askCard, { backgroundColor: Colors.primary700 }]}>
        <View style={styles.askText}>
          <Text style={[Fonts.p2Bold, styles.askTitle, { color: Colors.neutral00 }]}>
            {t('conversationConvocation.details.ask')}
          </Text>
          <Text style={[Fonts.p3, styles.askHint, { color: withAlpha(Colors.neutral00, 0.6) }]}>
            {responsesLocked
              ? t('conversationConvocation.details.askLocked')
              : t('conversationConvocation.details.askHint')}
          </Text>
        </View>
        <Switch
          accessibilityLabel={t('conversationConvocation.details.ask')}
          disabled={responsesLocked}
          onValueChange={onChangeAsk}
          testID="convocation-ask"
          thumbColor={Colors.neutral00}
          trackColor={{ false: withAlpha(Colors.neutral00, 0.18), true: Colors.primary500 }}
          value={askResponses}
        />
      </View>

      <Text style={[Fonts.p3, styles.summary, { color: withAlpha(Colors.neutral00, 0.7) }]}>
        {t('conversationConvocation.details.summary', { bench: benchCount, pitch: pitchCount })}
      </Text>
      <Text style={[Fonts.p3, styles.posted, { color: withAlpha(Colors.neutral00, 0.55) }]}>
        {t('conversationConvocation.details.postedHint')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  askCard: {
    alignItems: 'center',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  askHint: {
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 3,
  },
  askText: {
    flex: 1,
  },
  askTitle: {
    fontSize: 15,
  },
  caps: {
    fontSize: 12,
    letterSpacing: 1.2,
  },
  field: {
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 15,
    paddingHorizontal: 14,
  },
  multi: {
    lineHeight: 21,
    minHeight: 88,
    paddingVertical: 12,
  },
  posted: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  root: {
    gap: 10,
  },
  single: {
    height: 46,
  },
  spaced: {
    marginTop: 8,
  },
  summary: {
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
});

export default ConvocationDetailsStep;
