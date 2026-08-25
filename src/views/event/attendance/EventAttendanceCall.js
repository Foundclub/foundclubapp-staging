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
import ScreenContainer from '@/components/templates/ScreenContainer';

import { useGetEvent, useGetEventAttendance } from '@/services/event/eventQueries';

import {
  buildArrivedAtIso,
  countAnswers,
  countCalled,
  countPresence,
  describeBulkOutcome,
  formatShortDateInZone,
  formatTimeInZone,
  isMarked,
  listUnmarkedIds,
  resolveAttendanceWindow,
  resolveCallMode,
  resolveEventEndMs,
  resolveNoShowSweepMs,
  resolveServerClockMs,
  toMsOrNull,
} from './attendanceCallModel';
import AttendanceRow from './AttendanceRow';
import { AttendanceCloseSheet, AttendanceLateSheet } from './AttendanceSheets';
import { useAttendanceCallMutations } from './useAttendanceCallMutations';

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
  eventBanner: { gap: 4 },
  footer: { gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  header: {
    alignItems: 'center', flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 12,
  },
  headerTexts: { flex: 1 },
  list: { gap: 8 },
  pill: {
    borderRadius: 100, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 4,
  },
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

  const [elapsedMs, setElapsedMs] = useState(0);
  const [bulkMessage, setBulkMessage] = useState('');
  // Les trois feuilles. `sheetItem` porte la ligne visee par 2E et 2F.
  const [openSheet, setOpenSheet] = useState('');
  const [sheetItem, setSheetItem] = useState(/** @type {any} */ (null));

  const payloadData = attendancePayload?.data;
  const items = /** @type {any[]} */ (
    useMemo(() => payloadData?.items || [], [payloadData?.items])
  );
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
  // 🔢 APPEL (26/08) — LE COMPTEUR COMPTE LES POINTES, PAS LES ARRIVES.
  // `items.length - presence.waiting` ne voyait que les `arrivedAt` ; une
  // absence posee a la main (D7bis) n en a pas et compte pourtant.
  const markedCount = useMemo(() => countCalled(items), [items]);

  const markedItems = useMemo(() => items.filter(isMarked), [items]);

  const teamName = event?.team?.name || '';
  const heureDebut = formatTimeInZone(payloadData?.eventStartAt || event?.date, timezone);

  // 🗣️ TOUTES LES CHAINES DE L ECRAN, AU MEME ENDROIT. Les replis francais
  // sont la SOURCE : `fr.js` appartient au lot L4, ce lot-ci n y ecrit pas —
  // i18next rendra le repli tant que la clef n existe pas.
  const mots = {
    answersNo: t('eventDetails.attendanceCall.answers.no', 'Absent·e·s'),
    answersNone: t('eventDetails.attendanceCall.answers.none', 'Sans réponse'),
    answersYes: t('eventDetails.attendanceCall.answers.yes', 'Présent·e·s'),
    closeCall: t('eventDetails.attendanceCall.footer.close', "Clôturer l'appel"),
    declaredLate: t('eventDetails.attendanceCall.row.declaredLate', 'Retard annoncé'),
    markSomeone: t(
      'eventDetails.attendanceCall.footer.markSomeone',
      'Pointe au moins une personne',
    ),
    outOf: t('eventDetails.attendanceCall.footer.outOf', 'sur'),
    presenceArrived: t('eventDetails.attendanceCall.presence.arrived', 'Arrivé·e·s'),
    presenceLate: t('eventDetails.attendanceCall.presence.late', 'En retard'),
    presenceWaiting: t('eventDetails.attendanceCall.presence.waiting', 'En attente'),
    title: t('eventDetails.attendanceCall.header.title', 'APPEL'),
  };

  const eventStartMs = toMsOrNull(payloadData?.eventStartAt) ?? toMsOrNull(event?.date);

  /**
   * 🧨 « À L HEURE » DOIT DIRE L HEURE, SINON IL POSE UN RETARD.
   *
   * Sans `lateMinutes` ni `arrivedAt`, `performCoachArrival` prend sa branche
   * automatique : il pose SON instant courant et RECALCULE le retard depuis le
   * debut. Un coach qui appuie sur ✓ a 18h07 pour un match de 18h00 ecrivait
   * donc « arrivé en retard, +7 min » — pour un joueur qu il vient de declarer
   * a l heure, et sur le bouton qui porte une COCHE VERTE.
   *
   * ⛔ Ce n est pas un cas de bord : c est le geste le plus frequent de
   * l ecran, et il se produit des la premiere minute de jeu.
   *
   * `buildArrivedAtIso` existait deja (attendanceCallModel.js) et servait la
   * feuille de retard : le chemin est CONSERVE (decision D7-c), il est
   * simplement employe aussi ici.
   */
  const handleMark = useCallback((/** @type {any} */ item) => {
    coachArrivalMutation.mutate({
      payload: {
        arrivedAt: buildArrivedAtIso({ eventStartMs, lateMinutes: 0 }),
        lateMinutes: 0,
      },
      userId: item?.user?.documentId,
    });
  }, [coachArrivalMutation, eventStartMs]);

  const handleUnmarkOne = useCallback((/** @type {any} */ item) => {
    resetMutation.mutate({ userId: item?.user?.documentId });
  }, [resetMutation]);

  const handleMarkAll = useCallback(() => {
    const userIds = listUnmarkedIds(items);
    if (userIds.length === 0) return;
    bulkMutation.mutate({ userIds }, {
      onSuccess: (/** @type {any} */ summary) => setBulkMessage(describeBulkOutcome(summary, t)),
    });
  }, [bulkMutation, items, t]);

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

  const handleUnmarkAll = useCallback(() => {
    // 🔒 On ne vise QUE les lignes qui portent un `arrivedAt` : `reset` efface
    // aussi la declaration que le joueur avait faite lui-meme.
    markedItems.forEach(
      (/** @type {any} */ item) => resetMutation.mutate({ userId: item?.user?.documentId }),
    );
  }, [markedItems, resetMutation]);

  const renderCounter = (
    /** @type {number} */ valeur,
    /** @type {string} */ libelle,
    /** @type {string} */ couleur,
  ) => (
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
    // 🧨 DEFAUT TROUVE A LA RELECTURE : ce cadre servait AUSSI quand la fenetre
    // etait DEJA FERMEE (mode `closed`), et il affichait alors « Ouvre à 17:30 »
    // pour un appel termine depuis des heures. Le bouton reste desactive dans
    // les deux cas, mais il ne raconte pas la meme chose.
    const estFerme = mode === 'closed';
    const heureOuverture = formatTimeInZone(attendanceWindow.opensAtMs, timezone);
    const heureFermeture = formatTimeInZone(attendanceWindow.closesAtMs, timezone);
    const libelleBouton = estFerme
      ? `${t('eventDetails.attendanceCall.closed.since', 'Fermé depuis')} ${heureFermeture}`
      : `${t('eventDetails.attendanceCall.before.opensAt', 'Ouvre à')} ${heureOuverture}`;
    const phraseFenetre = estFerme
      ? t(
        'eventDetails.attendanceCall.closed.explain',
        "L'appel est clos. Il restait ouvert jusqu'à 2 h après la fin du match.",
      )
      : t(
        'eventDetails.attendanceCall.before.explain',
        "L'appel est ouvert dès la création de l'événement"
        + ' et se ferme 2 h après la fin.',
      );
    const signalled = items.filter(
      (/** @type {any} */ item) => Number(item?.attendance?.declaredLateMinutes || 0) > 0,
    );

    const typeLibelle = String(event?.type?.name || '').toUpperCase();
    const dateCourte = formatShortDateInZone(payloadData?.eventStartAt || event?.date, timezone);
    const heureFin = formatTimeInZone(resolveEventEndMs({ event, payloadData }), timezone);
    const creneau = [dateCourte, [heureDebut, heureFin].filter(Boolean).join(' – ')]
      .filter(Boolean).join(' · ');

    return (
      <>
        {/* Le rappel de CE QU ON VA POINTER — type, equipe, creneau. */}
        <View style={styles.eventBanner}>
          {typeLibelle !== '' && (
            <Text style={[Fonts.p4Bold, { color: Colors.primary200 }]}>{typeLibelle}</Text>
          )}
          {teamName !== '' && (
            <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>{teamName}</Text>
          )}
          {creneau !== '' && (
            <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>{creneau}</Text>
          )}
        </View>

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
            <Text style={[Fonts.p2Bold, { color: Colors.neutral400 }]}>{libelleBouton}</Text>
          </TouchableOpacity>

          <Text style={[Fonts.p4, { color: Colors.neutral300 }]}>{phraseFenetre}</Text>
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
            {signalled.map((/** @type {any} */ item, /** @type {number} */ index) => {
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

      {bulkMessage !== '' && (
        <Text style={[Fonts.p4, { color: Colors.warning500 }]}>{bulkMessage}</Text>
      )}

      {/* 🧱 UNE SEULE LISTE, DANS L ORDRE DE LA FEUILLE DE PRESENCE.
          Les deux onglets (« Attendus » / « Sans réponse ») et la section
          « DÉJÀ POINTÉS » disparaissent : ils faisaient SAUTER une ligne
          d une pile a l autre au moment precis ou le doigt la touchait, et
          obligeaient le coach a chercher deux fois la meme personne. Une
          ligne pointee reste desormais exactement ou elle etait — c est ce
          qui rend les trois boutons corrigeables en un tap. */}
      <View style={styles.list}>
        {items.map((/** @type {any} */ item, /** @type {number} */ index) => (
          <AttendanceRow
            identitiesHidden={identitiesHidden}
            item={item}
            key={item?.user?.documentId || index}
            onLate={(/** @type {any} */ cible) => { setSheetItem(cible); setOpenSheet('late'); }}
            onOnTime={handleMark}
            onUnmark={handleUnmarkOne}
            position={index + 1}
            t={t}
          />
        ))}
      </View>
    </>
  );

  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="edge-to-edge" style={[styles.screen]}>
      {/* 📐 L ENTETE DU PACK : le titre dit CE QUE C EST, le sous-titre dit
          POUR QUI, et la pastille dit OU ON EN EST. L ancienne version
          inversait les deux premiers — le titre portait « 0 pointé sur 22 »
          et le mot « APPEL » etait relegue en sous-titre, colle au nom de
          l equipe. Le chiffre a maintenant sa place a lui. */}
      <View style={styles.header}>
        <HeaderBackButton onPress={() => navigation.goBack()} />
        <View style={styles.headerTexts}>
          <Text style={[Fonts.h3Black, { color: Colors.neutral00 }]}>{mots.title}</Text>
          <Text numberOfLines={1} style={[Fonts.p3, { color: Colors.neutral300 }]}>
            {[teamName, heureDebut].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {mode === 'open' && (
          <View style={[styles.pill, {
            backgroundColor: Colors.primary800,
            borderColor: withAlpha(Colors.neutral00, 0.12),
          }]}
          >
            <Text style={[Fonts.p3Black, { color: Colors.neutral200 }]}>
              {`${markedCount} / ${items.length}`}
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

    </ScreenContainer>
  );
}

export default EventAttendanceCall;
