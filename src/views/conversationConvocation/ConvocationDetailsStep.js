import { useTranslation } from 'react-i18next';
import {
  StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import TimePickerInput from '@/components/molecules/timePickerInput/TimePickerInput';

import { RENDEZ_VOUS_LIEU_MAX } from './convocationWizardUtils';

/**
 * MESSAGERIE-1C — ETAPE 4 « DETAILS » (pack messagerie §3.12, §5).
 *
 * « Rendez-vous », « Infos » (texte libre), et l'interrupteur « Demander Present / Absent ». Les
 * infos partent dans le groupe, en message, juste apres la convocation.
 *
 * 🕐 CONVOC-RDV (decision d'Adel du 08/10, `rdv lot`) — LE RENDEZ-VOUS N'EST PLUS TAPE. L'heure se
 * choisit au selecteur partage (`TimePickerInput`, decision `heure A` : la roue s'ouvre sur
 * l'exemple et « OK » l'ecrit) ; le lieu est un champ court, pre-rempli avec celui de l'evenement.
 * Les deux partent DANS la convocation (`rendezVous`), et la carte les affiche.
 *
 * 🔒 Un evenement dont l'organisateur a coupe les reponses (`rsvpEnabled: false`) : le serveur
 * refuserait toute reponse. L'interrupteur est alors eteint et verrouille, et le dit (meme regle
 * que la feuille « Publier » du plateau, FINITIONS5).
 * @param {object} props
 * @param {boolean} props.askResponses
 * @param {number} props.benchCount
 * @param {string} props.infos
 * @param {string} props.meetingPlace
 * @param {boolean} [props.meetingPlaceRefused] - Le lieu porte un telephone, un courriel, un lien.
 * @param {string} props.meetingTime - `HH:mm`, ou vide.
 * @param {string} props.meetingTimeExample - L'exemple sur lequel la roue s'ouvre.
 * @param {(value: boolean) => void} props.onChangeAsk
 * @param {(value: string) => void} props.onChangeInfos
 * @param {(value: string) => void} props.onChangeMeetingPlace
 * @param {(value: string) => void} props.onChangeMeetingTime
 * @param {number} props.pitchCount
 * @param {boolean} [props.responsesLocked]
 * @returns {import('react').ReactElement}
 */
function ConvocationDetailsStep({
  askResponses,
  benchCount,
  infos,
  meetingPlace,
  meetingPlaceRefused = false,
  meetingTime,
  meetingTimeExample,
  onChangeAsk,
  onChangeInfos,
  onChangeMeetingPlace,
  onChangeMeetingTime,
  pitchCount,
  responsesLocked = false,
}) {
  const { t } = useTranslation();
  const { Colors, Fonts } = useTheme();
  const caps = [Fonts.p3Bold, styles.caps, { color: withAlpha(Colors.neutral00, 0.6) }];
  const bordureDuLieu = meetingPlaceRefused ? Colors.error500 : withAlpha(Colors.neutral00, 0.14);
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
      {/* Le lieu prend la forme de la boite du selecteur d'heure : la rangee se lit d'un bloc. */}
      <View style={styles.rendezVous}>
        <View style={styles.heure}>
          <TimePickerInput
            label={t('conversationConvocation.details.meetingTime')}
            onChange={onChangeMeetingTime}
            placeholder={meetingTimeExample}
            testID="convocation-meeting-time"
            value={meetingTime}
          />
        </View>
        <View style={styles.lieu}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {t('conversationConvocation.details.meetingPlace')}
          </Text>
          <TextInput
            accessibilityLabel={t('conversationConvocation.details.meetingPlaceLabel')}
            maxLength={RENDEZ_VOUS_LIEU_MAX}
            onChangeText={onChangeMeetingPlace}
            placeholder={t('conversationConvocation.details.meetingPlaceholder')}
            placeholderTextColor={Colors.neutral300}
            style={[
              Fonts.p1,
              styles.lieuChamp,
              {
                backgroundColor: Colors.primary700,
                borderColor: bordureDuLieu,
                color: Colors.neutral00,
              },
            ]}
            testID="convocation-meeting-place"
            value={meetingPlace}
          />
        </View>
      </View>
      {meetingPlaceRefused ? (
        <Text style={[Fonts.p3, { color: Colors.error500 }]}>
          {t('conversationConvocation.details.meetingPlaceError')}
        </Text>
      ) : null}

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
  heure: {
    width: 128,
  },
  lieu: {
    flex: 1,
    gap: 4,
  },
  // La hauteur de la boite du selecteur : 16 + 23 + 16 de texte, 1 + 1 de bordure.
  lieuChamp: {
    borderRadius: 12,
    borderWidth: 1,
    height: 57,
    lineHeight: undefined,
    paddingHorizontal: 16,
    paddingVertical: 0,
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
  rendezVous: {
    flexDirection: 'row',
    gap: 10,
  },
  root: {
    gap: 10,
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
