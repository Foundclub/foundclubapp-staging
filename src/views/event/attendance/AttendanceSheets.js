import { useEffect, useState } from 'react';
import {
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ChoiceChipGroup from '@/components/molecules/choiceChipGroup/ChoiceChipGroup';

import {
  buildArrivedAtIso,
  countPresence,
  formatTimeInZone,
  listNeverSeen,
  resolveLateMinutesFromArrivalTime,
} from './attendanceCallModel';

const styles = StyleSheet.create({
  action: {
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
  },
  body: { gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
  footer: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12,
  },
  footerButton: {
    alignItems: 'center',
    borderRadius: 100,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
  },
  header: { gap: 4, paddingHorizontal: 16, paddingTop: 16 },
  input: {
    borderRadius: 12, borderWidth: 1, minHeight: 44, paddingHorizontal: 12,
  },
  nameRow: { justifyContent: 'center', minHeight: 44 },
  namesBox: { borderRadius: 12, gap: 4, padding: 12 },
});

/**
 * 2D — CLOTURER L APPEL.
 *
 * ⛔ CE BOUTON N ECRIT RIEN, ET LA FEUILLE LE DIT. Aucune route de cloture
 * n existe cote serveur : c est le cron `eventAbsenceFinalizationGovernance`
 * qui passe les non-pointes en « Non pointé », a la fin du match. Ecrire
 * « 4 personnes vont passer en Non pointé » sur un bouton qui ne fait que
 * quitter le mode en ferait un MENTEUR — il rendrait la main sans avoir rien
 * ecrit, et le coach croirait la feuille close.
 *
 * ✅ Ce qu elle annonce, en revanche, est vrai et verifiable : QUI le fera
 * (le serveur), QUAND (le premier passage du cron apres la fin), et jusqu a
 * quand on peut encore corriger (la fermeture de la fenetre).
 * @param {object} props - Les proprietes de la feuille.
 * @param {boolean} props.isVisible - La feuille est-elle ouverte.
 * @param {any[]} props.items - Les lignes de la feuille de presence.
 * @param {() => void} props.onClose - Fermer sans quitter le mode.
 * @param {() => void} props.onConfirm - Quitter le mode d appel.
 * @param {any} props.payloadData - La reponse de `list`.
 * @param {number | null} props.sweepAtMs - Le premier passage du cron.
 * @param {number | null} props.closesAtMs - La fermeture de la fenetre.
 * @param {(key: string, fallback: string) => string} props.t - Le traducteur.
 * @returns {import('react').ReactElement} - La feuille.
 */
export function AttendanceCloseSheet({
  closesAtMs,
  isVisible,
  items,
  onClose,
  onConfirm,
  payloadData,
  sweepAtMs,
  t,
}) {
  const { Colors, Fonts } = useTheme();
  const timezone = payloadData?.timezone;
  const presence = countPresence(items);
  const neverSeen = listNeverSeen(items);
  const identitiesHidden = Boolean(payloadData?.participantIdentitiesHidden);
  const markedCount = items.length - presence.waiting;

  // 🗣️ Toutes les chaines de la feuille, au meme endroit.
  const mots = {
    anonymous: t('eventDetails.attendanceCall.row.anonymous', 'Participant·e'),
    arrived: t('eventDetails.attendanceCall.presence.arrived', 'Arrivé·e·s'),
    arrivedLate: t('eventDetails.attendanceCall.close.arrivedLate', 'Arrivé·e·s en retard'),
    confirm: t('eventDetails.attendanceCall.close.confirm', 'Clôturer'),
    confirmLabel: t(
      'eventDetails.attendanceCall.close.confirmLabel',
      "Clôturer l'appel maintenant",
    ),
    keepGoing: t('eventDetails.attendanceCall.close.keepGoing', "Continuer l'appel"),
    marked: t('eventDetails.attendanceCall.close.marked', 'pointés'),
    neverSeen: t('eventDetails.attendanceCall.close.neverSeen', 'jamais vus'),
    title: t('eventDetails.attendanceCall.close.title', "CLÔTURER L'APPEL"),
  };

  const heureBalayage = formatTimeInZone(sweepAtMs, timezone);
  const heureFermeture = formatTimeInZone(closesAtMs, timezone);

  return (
    <BottomModal
      close={onClose}
      footerComponent={(
        <View style={styles.footer}>
          <TouchableOpacity
            accessibilityLabel={mots.keepGoing}
            accessibilityRole="button"
            onPress={onClose}
            style={[styles.footerButton, { borderColor: Colors.neutral500 }]}
          >
            <Text style={[Fonts.p3Bold, { color: Colors.neutral200 }]}>
              {mots.keepGoing}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityLabel={mots.confirmLabel}
            accessibilityRole="button"
            onPress={onConfirm}
            style={[styles.footerButton, {
              backgroundColor: Colors.primary500, borderColor: Colors.primary500,
            }]}
          >
            <Text style={[Fonts.p3Bold, { color: Colors.primary900 }]}>
              {mots.confirm}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      headerComponent={(
        <View style={styles.header}>
          <Text style={[Fonts.p4Bold, { color: Colors.neutral400 }]}>
            {mots.title}
          </Text>
          <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
            {`${markedCount} ${mots.marked} · ${neverSeen.length} ${mots.neverSeen}`}
          </Text>
        </View>
      )}
      isVisible={isVisible}
      snapPoints={['68%']}
    >
      <View style={styles.body}>
        <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
          {`${presence.arrived} ${mots.arrived}`}
        </Text>
        <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
          {`${presence.late} ${mots.arrivedLate}`}
        </Text>

        {/* 🗣️ LA VERITE, PAS UNE PROMESSE : qui le fait, quand, et jusqu a
            quand on peut revenir dessus. */}
        <Text style={[Fonts.p4, { color: Colors.neutral300 }]}>
          {`${t(
            'eventDetails.attendanceCall.close.serverWill',
            'Le serveur les passera en « Non pointé » après la fin du match, vers',
          )} ${heureBalayage}.`}
        </Text>
        <Text style={[Fonts.p4, { color: Colors.neutral300 }]}>
          {`${t(
            'eventDetails.attendanceCall.close.stillCorrect',
            'Tu pourras encore corriger jusqu\'à',
          )} ${heureFermeture}.`}
        </Text>

        <ScrollView contentContainerStyle={[styles.namesBox, {
          backgroundColor: withAlpha(Colors.primary900, 0.6),
        }]}
        >
          {neverSeen.map((item, index) => (
            <View key={item?.user?.documentId || index} style={styles.nameRow}>
              <Text style={[Fonts.p3, { color: Colors.neutral00 }]}>
                {identitiesHidden
                  ? `${mots.anonymous} ${index + 1}`
                  : `${item?.user?.firstname || ''} ${item?.user?.lastname || ''}`.trim()}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </BottomModal>
  );
}

/**
 * 2E — RETARD CONSTATE.
 *
 * ⌨️ « Jamais un clavier par défaut » : le retard se pose en DEUX APPUIS
 * (un palier courant, puis l heure exacte seulement si besoin). Aucune saisie
 * ne prend le focus — au bord d un terrain, un clavier qui s ouvre tout seul
 * mange l ecran.
 *
 * 🧨 L ENVOI PORTE `arrivedAt`, ET C EST OBLIGATOIRE : sans lui le serveur
 * pose SON instant courant, meme quand `lateMinutes` vaut 10. L ecran
 * afficherait « Arrivé +10 min à 18:42 » pour un match de 18:00.
 * @param {object} props - Les proprietes de la feuille.
 * @param {number | null} props.eventStartMs - Le debut, pour calculer l heure.
 * @param {boolean} props.isCorrection - Corriger (patchLate) plutot que pointer.
 * @param {boolean} props.isVisible - La feuille est-elle ouverte.
 * @param {any} props.item - La ligne visee.
 * @param {() => void} props.onClose - Fermer.
 * @param {(payload: any) => void} props.onSubmit - Envoyer.
 * @param {(key: string, fallback: string) => string} props.t - Le traducteur.
 * @param {string} [props.timezone] - Le fuseau du club.
 * @returns {import('react').ReactElement} - La feuille.
 */
export function AttendanceLateSheet({
  eventStartMs,
  isCorrection = false,
  isVisible,
  item,
  onClose,
  onSubmit,
  t,
  timezone,
}) {
  const { Colors, Fonts } = useTheme();
  const [choix, setChoix] = useState('0');
  const [heureLibre, setHeureLibre] = useState('');
  const [note, setNote] = useState('');

  // Chaque ouverture repart propre : garder le choix precedent ferait poser un
  // retard de +30 a quelqu un qui arrive a l heure.
  useEffect(() => {
    if (!isVisible) return;
    setChoix(String(Number(item?.attendance?.lateMinutes || 0)));
    setHeureLibre('');
    setNote(String(item?.attendance?.note || ''));
  }, [isVisible, item]);

  const estLibre = choix === 'custom';
  // 🧨 « Autre heure » n est pas decoratif : sans cette conversion, saisir
  // 18:25 partait au serveur en `lateMinutes: 0` — le palier existait a
  // l ecran et ne faisait rien.
  const minutesLibres = resolveLateMinutesFromArrivalTime({
    arrivalTime: heureLibre,
    eventStartMs,
    timeZone: timezone,
  });
  const minutes = estLibre ? (minutesLibres ?? 0) : Number(choix);
  const arrivedAt = buildArrivedAtIso({ eventStartMs, lateMinutes: minutes });
  const motArrive = t('eventDetails.attendanceCall.late.preview', 'Arrivé');
  const motA = t('eventDetails.attendanceCall.late.previewAt', 'à');
  const heureArrivee = formatTimeInZone(arrivedAt, timezone);
  const apercu = minutes > 0
    ? `${motArrive} +${minutes} min ${motA} ${heureArrivee}`
    : t('eventDetails.attendanceCall.late.onTimePreview', "Arrivé à l'heure");

  return (
    <BottomModal
      close={onClose}
      footerComponent={(
        <View style={styles.footer}>
          <TouchableOpacity
            accessibilityLabel={t('eventDetails.attendanceCall.late.cancel', 'Fermer')}
            accessibilityRole="button"
            onPress={onClose}
            style={[styles.footerButton, { borderColor: Colors.neutral500 }]}
          >
            <Text style={[Fonts.p3Bold, { color: Colors.neutral200 }]}>
              {t('eventDetails.attendanceCall.late.cancel', 'Fermer')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityLabel={t('eventDetails.attendanceCall.late.submit', 'Enregistrer')}
            accessibilityRole="button"
            onPress={() => onSubmit({
              arrivedAt,
              isCorrection,
              lateMinutes: minutes,
              note: note.trim() || null,
              userId: item?.user?.documentId,
            })}
            style={[styles.footerButton, {
              backgroundColor: Colors.primary500, borderColor: Colors.primary500,
            }]}
          >
            <Text style={[Fonts.p3Bold, { color: Colors.primary900 }]}>
              {t('eventDetails.attendanceCall.late.submit', 'Enregistrer')}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      isVisible={isVisible}
      snapPoints={['52%']}
    >
      <View style={styles.body}>
        <ChoiceChipGroup
          onSelect={(/** @type {any} */ valeur) => setChoix(String(valeur))}
          options={[
            { label: t('eventDetails.attendanceCall.late.onTime', "À l'heure"), value: '0' },
            { label: '+5', value: '5' },
            { label: '+10', value: '10' },
            { label: '+15', value: '15' },
            { label: '+30', value: '30' },
            { label: t('eventDetails.attendanceCall.late.custom', 'Autre heure'), value: 'custom' },
          ]}
          selectedValue={choix}
          title={t('eventDetails.attendanceCall.late.title', 'RETARD CONSTATÉ')}
        />

        {/* La saisie libre n existe QUE si on l a demandee — c est ce qui tient
            la promesse « jamais un clavier par défaut ». */}
        {estLibre && (
          <TextInput
            keyboardType="numbers-and-punctuation"
            onChangeText={setHeureLibre}
            placeholder={t(
              'eventDetails.attendanceCall.late.customPlaceholder',
              'Heure d\'arrivée (HH:MM)',
            )}
            placeholderTextColor={Colors.neutral400}
            style={[styles.input, { borderColor: Colors.neutral500, color: Colors.neutral00 }]}
            value={heureLibre}
          />
        )}

        <TextInput
          multiline
          onChangeText={setNote}
          placeholder={t('eventDetails.attendanceCall.late.note', 'Note du staff (optionnel)')}
          placeholderTextColor={Colors.neutral400}
          style={[styles.input, { borderColor: Colors.neutral500, color: Colors.neutral00 }]}
          value={note}
        />

        <Text style={[Fonts.p3Bold, { color: Colors.warning500 }]}>{apercu}</Text>
      </View>
    </BottomModal>
  );
}
