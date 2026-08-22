import { useNavigation, useRoute } from '@react-navigation/native';
import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { useGetEvent, useGetEventAttendance } from '@/services/event/eventQueries';

import {
  countAnswers,
  countPresence,
  describeBulkOutcome,
  formatTimeInZone,
  isMarked,
  listUnanswered,
  listUnmarkedIds,
  resolveAttendanceWindow,
  resolveCallMode,
  resolveEventEndMs,
  resolveNoShowSweepMs,
  resolveServerClockMs,
  toMsOrNull,
} from './attendanceCallModel';
import AttendanceRow from './AttendanceRow';
import {
  AttendanceCloseSheet, AttendanceCorrectSheet, AttendanceLateSheet,
} from './AttendanceSheets';
import { useAttendanceCallMutations } from './useAttendanceCallMutations';

const TAB_EXPECTED = 'expected';
const TAB_UNANSWERED = 'unanswered';

// L horloge serveur avance d elle-meme, par pas de 30 s — c est le motif
// d `EventDetails` (AC10), recopie ici parce que ce fichier-la est verrouille.
const CLOCK_TICK_MS = 30000;

const styles = StyleSheet.create({
  banner: { borderRadius: 12, gap: 8, padding: 16 },
  counter: {
    alignItems: 'center', borderRadius: 12, flex: 1, gap: 4, paddingVertical: 12,
  },
  counters: { flexDirection: 'row', gap: 8 },
  disabledButton: {
    alignItems: 'center',
    borderRadius: 100,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 24,
  },
  footer: { gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  header: {
    alignItems: 'center', flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 12,
  },
  headerTexts: { flex: 1 },
  list: { gap: 8 },
  pill: { borderRadius: 100, paddingHorizontal: 12, paddingVertical: 4 },
  screen: { flex: 1 },
  scroll: { gap: 16, paddingBottom: 24, paddingHorizontal: 16 },
  signalledRow: {
    alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 52,
  },
  toolbar: { flexDirection: 'row', gap: 8 },
  toolbarButton: {
    alignItems: 'center',
    borderRadius: 100,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
  },
});

/**
 * L5-A — « FAIRE L APPEL » (planche 02 du pack detail d evenement).
 *
 * 🧱 LE MANQUE NUMERO UN DU PACK : le serveur savait tout faire (fenetre
 * horaire, pointage d un sans-reponse, envoi groupe de 100) et AUCUN ecran ne
 * s en servait. Le geste central — pointer quelqu un qui n a jamais repondu —
 * etait inatteignable au doigt.
 *
 * 🕐 DEUX MODES, JAMAIS MELANGES :
 *   · avant la fenetre (2A) : un bouton DESACTIVE qui dit a quelle heure ca
 *     ouvre, et les compteurs de REPONSES ;
 *   · dans la fenetre (2B/2C) : l appel, et les compteurs de PRESENCE REELLE.
 * « Réponse ≠ présence » est la confusion majeure que cette planche corrige :
 * les deux echelles ne se voient jamais ensemble.
 *
 * ⛔ CET ECRAN NE POSE JAMAIS UNE ABSENCE A LA PLACE DU JOUEUR. Pointer, c est
 * constater une presence ; ne pas pointer, c est « Non pointé » — un fait, pas
 * un jugement. Il n y a donc aucun bouton « Absent » ici.
 * @returns {import('react').ReactElement} - L ecran.
 */
function EventAttendanceCall() {
  const { Colors, Fonts } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();

  /** @type {any} */
  const params = useMemo(() => route.params || {}, [route.params]);
  const { eventId } = params;

  const { data: event } = useGetEvent(eventId);
  // 🧊 `refetchOnMount: 'always'` n est pas une precaution : sans lui, l ecran
  // herite du `serverNow` que l Apercu a lu il y a plusieurs minutes, et
  // affiche « Ouvre à 17:30 » alors qu il est 17:35.
  const { data: attendancePayload } = useGetEventAttendance(eventId, { refetchOnMount: 'always' });

  const [activeTab, setActiveTab] = useState(TAB_EXPECTED);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [bulkMessage, setBulkMessage] = useState('');
  // Les trois feuilles. `sheetItem` porte la ligne visee par 2E et 2F.
  const [openSheet, setOpenSheet] = useState('');
  const [sheetItem, setSheetItem] = useState(null);

  const payloadData = attendancePayload?.data;
  const items = useMemo(() => payloadData?.items || [], [payloadData?.items]);
  const timezone = payloadData?.timezone;
  const identitiesHidden = Boolean(payloadData?.participantIdentitiesHidden);

  const {
    bulkMutation, coachArrivalMutation, lateMinutesMutation, resetMutation,
  } = useAttendanceCallMutations(eventId);

  // AC10 — l horloge du SERVEUR, ou rien. Remise a zero a chaque nouveau
  // `serverNow`, avancee de 30 s en 30 s entre deux.
  useEffect(() => { setElapsedMs(0); }, [payloadData?.serverNow]);
  useEffect(() => {
    const timerId = setInterval(() => {
      setElapsedMs((previous) => previous + CLOCK_TICK_MS);
    }, CLOCK_TICK_MS);
    return () => clearInterval(timerId);
  }, []);

  const serverNowMs = resolveServerClockMs({ elapsedMs, serverNowIso: payloadData?.serverNow });
  const attendanceWindow = useMemo(
    () => resolveAttendanceWindow({ event, payloadData }),
    [event, payloadData],
  );
  const mode = resolveCallMode({ serverNowMs, window: attendanceWindow });

  const answers = useMemo(() => countAnswers(items), [items]);
  const presence = useMemo(() => countPresence(items), [items]);
  const markedCount = items.length - presence.waiting;

  const unansweredItems = useMemo(() => listUnanswered(items), [items]);
  const unmarkedItems = useMemo(() => items.filter((item) => !isMarked(item)), [items]);
  const markedItems = useMemo(() => items.filter(isMarked), [items]);

  const visibleUnmarked = activeTab === TAB_UNANSWERED
    ? unansweredItems.filter((item) => !isMarked(item))
    : unmarkedItems;

  const teamName = event?.team?.name || '';

  // 🗣️ TOUTES LES CHAINES DE L ECRAN, AU MEME ENDROIT. Les replis francais
  // sont la SOURCE : `fr.js` appartient au lot L4, ce lot-ci n y ecrit pas —
  // i18next rendra le repli tant que la clef n existe pas.
  const mots = {
    answersNo: t('eventDetails.attendanceCall.answers.no', 'Absent·e·s'),
    answersNone: t('eventDetails.attendanceCall.answers.none', 'Sans réponse'),
    answersYes: t('eventDetails.attendanceCall.answers.yes', 'Présent·e·s'),
    closeCall: t('eventDetails.attendanceCall.footer.close', "Clôturer l'appel"),
    declaredLate: t('eventDetails.attendanceCall.row.declaredLate', 'Retard annoncé'),
    markedOf: t('eventDetails.attendanceCall.header.markedOf', 'pointé sur'),
    markedSection: t('eventDetails.attendanceCall.markedSection', 'DÉJÀ POINTÉS'),
    markSomeone: t(
      'eventDetails.attendanceCall.footer.markSomeone',
      'Pointe au moins une personne',
    ),
    outOf: t('eventDetails.attendanceCall.footer.outOf', 'sur'),
    presenceArrived: t('eventDetails.attendanceCall.presence.arrived', 'Arrivé·e·s'),
    presenceLate: t('eventDetails.attendanceCall.presence.late', 'En retard'),
    presenceWaiting: t('eventDetails.attendanceCall.presence.waiting', 'En attente'),
    tabExpected: t('eventDetails.attendanceCall.tabs.expected', 'Attendus'),
    tabUnanswered: t('eventDetails.attendanceCall.tabs.unanswered', 'Sans réponse'),
  };

  const handleMark = useCallback((item) => {
    coachArrivalMutation.mutate({ payload: {}, userId: item?.user?.documentId });
  }, [coachArrivalMutation]);

  const handleMarkAll = useCallback(() => {
    const userIds = listUnmarkedIds(visibleUnmarked);
    if (userIds.length === 0) return;
    bulkMutation.mutate({ userIds }, {
      onSuccess: (/** @type {any} */ summary) => setBulkMessage(describeBulkOutcome(summary, t)),
    });
  }, [bulkMutation, t, visibleUnmarked]);

  const eventStartMs = toMsOrNull(payloadData?.eventStartAt) ?? toMsOrNull(event?.date);

  const handleLateSubmit = useCallback((/** @type {any} */ envoi) => {
    const payload = {
      arrivedAt: envoi.arrivedAt,
      lateMinutes: envoi.lateMinutes,
      note: envoi.note,
    };
    // 🧭 Pointer et CORRIGER ne sont pas la meme route : `coachArrival` cree
    // le pointage, `patchLate` retouche celui qui existe deja.
    if (envoi.isCorrection) lateMinutesMutation.mutate({ payload, userId: envoi.userId });
    else coachArrivalMutation.mutate({ payload, userId: envoi.userId });
    setOpenSheet('');
  }, [coachArrivalMutation, lateMinutesMutation]);

  const handleClearNote = useCallback(() => {
    // 🧨 `patchLate` EXIGE `lateMinutes` : on renvoie celui qui est en place.
    // Envoyer 0 pour effacer une note effacerait aussi le retard.
    lateMinutesMutation.mutate({
      payload: {
        lateMinutes: Number(sheetItem?.attendance?.lateMinutes || 0),
        note: null,
      },
      userId: sheetItem?.user?.documentId,
    });
    setOpenSheet('');
  }, [lateMinutesMutation, sheetItem]);

  const handleUnmark = useCallback(() => {
    resetMutation.mutate({ userId: sheetItem?.user?.documentId });
    setOpenSheet('');
  }, [resetMutation, sheetItem]);

  const handleUnmarkAll = useCallback(() => {
    // 🔒 On ne vise QUE les lignes qui portent un `arrivedAt` : `reset` efface
    // aussi la declaration que le joueur avait faite lui-meme.
    markedItems.forEach((item) => resetMutation.mutate({ userId: item?.user?.documentId }));
  }, [markedItems, resetMutation]);

  const renderCounter = (valeur, libelle, couleur) => (
    <View
      key={libelle}
      style={[styles.counter, { backgroundColor: withAlpha(Colors.primary900, 0.6) }]}
    >
      <Text style={[Fonts.h4Bold, { color: couleur }]}>{String(valeur)}</Text>
      <Text style={[Fonts.p4, { color: Colors.neutral300 }]}>{libelle}</Text>
    </View>
  );

  /* ---------------- CADRE 2A — avant l heure ---------------- */
  const renderBeforeWindow = () => {
    const heureOuverture = formatTimeInZone(attendanceWindow.opensAtMs, timezone);
    const signalled = items.filter(
      (item) => Number(item?.attendance?.declaredLateMinutes || 0) > 0,
    );

    return (
      <>
        <View style={[styles.banner, { backgroundColor: withAlpha(Colors.primary900, 0.6) }]}>
          <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
            {t('eventDetails.attendanceCall.before.title', "Faire l'appel")}
          </Text>
          <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
            {`${items.length} ${t('eventDetails.attendanceCall.before.expected', 'attendus')}`}
          </Text>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ disabled: true }}
            disabled
            style={[styles.disabledButton, { backgroundColor: Colors.neutral700 }]}
          >
            <Text style={[Fonts.p2Bold, { color: Colors.neutral400 }]}>
              {`${t('eventDetails.attendanceCall.before.opensAt', 'Ouvre à')} ${heureOuverture}`}
            </Text>
          </TouchableOpacity>

          <Text style={[Fonts.p4, { color: Colors.neutral300 }]}>
            {t(
              'eventDetails.attendanceCall.before.explain',
              "L'appel devient disponible 30 minutes avant le début,"
              + ' et reste ouvert 2 h après la fin.',
            )}
          </Text>
        </View>

        {/* ⚖️ Echelle des REPONSES — jamais celle des presences ici. */}
        <View style={styles.counters}>
          {renderCounter(answers.answeredYes, mots.answersYes, Colors.success500)}
          {renderCounter(answers.answeredNo, mots.answersNo, Colors.error300)}
          {renderCounter(answers.unanswered, mots.answersNone, Colors.neutral300)}
        </View>

        {signalled.length > 0 && (
          <View style={styles.list}>
            <Text style={[Fonts.p4Bold, { color: Colors.neutral400 }]}>
              {t('eventDetails.attendanceCall.before.alreadySignalled', 'DÉJÀ SIGNALÉ')}
            </Text>
            {signalled.map((item, index) => {
              const minutesSignalees = Number(item?.attendance?.declaredLateMinutes || 0);
              const nom = identitiesHidden
                ? `${t('eventDetails.attendanceCall.row.anonymous', 'Participant·e')} ${index + 1}`
                : `${item?.user?.firstname || ''} ${item?.user?.lastname || ''}`.trim();
              return (
                <View key={item?.user?.documentId || index} style={styles.signalledRow}>
                  <ProfileAvatar name={nom} size={40} />
                  <View style={styles.headerTexts}>
                    <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>{nom}</Text>
                    <Text style={[Fonts.p4, { color: Colors.warning500 }]}>
                      {`${mots.declaredLate} +${minutesSignalees} min`}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </>
    );
  };

  /* ---------------- CADRES 2B / 2C — l appel ---------------- */
  const renderOpenCall = () => (
    <>
      {/* ⚖️ Echelle des PRESENCES REELLES — jamais celle des reponses ici. */}
      <View style={styles.counters}>
        {renderCounter(presence.arrived, mots.presenceArrived, Colors.success500)}
        {renderCounter(presence.late, mots.presenceLate, Colors.warning500)}
        {renderCounter(presence.waiting, mots.presenceWaiting, Colors.neutral300)}
      </View>

      <View style={styles.toolbar}>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={handleMarkAll}
          style={[styles.toolbarButton, { borderColor: Colors.success500 }]}
        >
          <Text style={[Fonts.p3Bold, { color: Colors.success500 }]}>
            {t('eventDetails.attendanceCall.actions.markAll', 'Tout pointer')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={handleUnmarkAll}
          style={[styles.toolbarButton, { borderColor: Colors.neutral500 }]}
        >
          <Text style={[Fonts.p3Bold, { color: Colors.neutral200 }]}>
            {t('eventDetails.attendanceCall.actions.unmarkAll', 'Tout dépointer')}
          </Text>
        </TouchableOpacity>
      </View>

      <SegmentedControl
        onChange={setActiveTab}
        options={[
          {
            label: `${mots.tabExpected} · ${items.length}`,
            value: TAB_EXPECTED,
          },
          {
            label: `${mots.tabUnanswered} · ${unansweredItems.length}`,
            value: TAB_UNANSWERED,
          },
        ]}
        value={activeTab}
      />

      {activeTab === TAB_UNANSWERED && (
        <View style={[styles.banner, { backgroundColor: withAlpha(Colors.warning500, 0.12) }]}>
          <Text style={[Fonts.p3Bold, { color: Colors.neutral00 }]}>
            {t('eventDetails.attendanceCall.unanswered.title', "Ils n'ont jamais répondu")}
          </Text>
          {/* 🧨 La maquette annonce « Ils reçoivent une notification ». C est
              FAUX : `performCoachArrival` n envoie rien au joueur. La phrase
              est retiree — promettre une notification qui n arrive pas est
              pire que ne rien promettre. */}
          <Text style={[Fonts.p4, { color: Colors.neutral200 }]}>
            {t(
              'eventDetails.attendanceCall.unanswered.explain',
              'Si tu les pointes, ils passent en Présent·e et Arrivé·e en même temps.',
            )}
          </Text>
        </View>
      )}

      {bulkMessage !== '' && (
        <Text style={[Fonts.p4, { color: Colors.warning500 }]}>{bulkMessage}</Text>
      )}

      <View style={styles.list}>
        {visibleUnmarked.map((item, index) => (
          <AttendanceRow
            identitiesHidden={identitiesHidden}
            item={item}
            key={item?.user?.documentId || index}
            onLate={(/** @type {any} */ cible) => { setSheetItem(cible); setOpenSheet('late'); }}
            onMark={handleMark}
            position={index + 1}
            t={t}
            timezone={timezone}
          />
        ))}
      </View>

      {markedItems.length > 0 && (
        <View style={styles.list}>
          <Text style={[Fonts.p4Bold, { color: Colors.neutral400 }]}>
            {`${mots.markedSection} · ${markedItems.length}`}
          </Text>
          {markedItems.map((item, index) => (
            <AttendanceRow
              identitiesHidden={identitiesHidden}
              item={item}
              key={item?.user?.documentId || index}
              onCorrect={(/** @type {any} */ cible) => {
                setSheetItem(cible); setOpenSheet('correct');
              }}
              position={index + 1}
              t={t}
              timezone={timezone}
            />
          ))}
        </View>
      )}
    </>
  );

  const heureDebut = formatTimeInZone(payloadData?.eventStartAt || event?.date, timezone);

  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="edge-to-edge" style={styles.screen}>
      <View style={styles.header}>
        <HeaderBackButton onPress={() => navigation.goBack()} />
        <View style={styles.headerTexts}>
          <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
            {mode === 'open'
              ? `${markedCount} ${mots.markedOf} ${items.length}`
              : t('eventDetails.attendanceCall.header.title', 'APPEL')}
          </Text>
          <Text numberOfLines={1} style={[Fonts.p3, { color: Colors.neutral300 }]}>
            {`${teamName}${teamName && heureDebut ? ' · ' : ''}${heureDebut}`}
          </Text>
        </View>
        {mode === 'open' && (
          <View style={[styles.pill, { backgroundColor: Colors.success500 }]}>
            <Text style={[Fonts.p4Bold, { color: Colors.primary900 }]}>
              {t('eventDetails.attendanceCall.header.open', 'Ouvert')}
            </Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {mode === 'open' ? renderOpenCall() : renderBeforeWindow()}
      </ScrollView>

      {mode === 'open' && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          {markedCount === 0 ? (
            <View style={[styles.disabledButton, { backgroundColor: Colors.neutral700 }]}>
              <Text style={[Fonts.p2Bold, { color: Colors.neutral400 }]}>
                {mots.markSomeone}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => setOpenSheet('close')}
              style={[styles.disabledButton, { backgroundColor: Colors.primary500 }]}
            >
              <Text style={[Fonts.p2Bold, { color: Colors.primary900 }]}>
                {`${mots.closeCall} · ${markedCount} ${mots.outOf} ${items.length}`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      <AttendanceCloseSheet
        closesAtMs={attendanceWindow.closesAtMs}
        isVisible={openSheet === 'close'}
        items={items}
        onClose={() => setOpenSheet('')}
        onConfirm={() => { setOpenSheet(''); navigation.goBack(); }}
        payloadData={payloadData}
        sweepAtMs={resolveNoShowSweepMs(resolveEventEndMs({ event, payloadData }))}
        t={t}
      />

      <AttendanceLateSheet
        eventStartMs={eventStartMs}
        isCorrection={Boolean(sheetItem && isMarked(sheetItem))}
        isVisible={openSheet === 'late'}
        item={sheetItem}
        onClose={() => setOpenSheet('')}
        onSubmit={handleLateSubmit}
        t={t}
        timezone={timezone}
      />

      <AttendanceCorrectSheet
        isVisible={openSheet === 'correct'}
        item={sheetItem}
        onChangeTime={() => setOpenSheet('late')}
        onClearNote={handleClearNote}
        onClose={() => setOpenSheet('')}
        onUnmark={handleUnmark}
        t={t}
      />
    </ScreenContainer>
  );
}

export default EventAttendanceCall;
