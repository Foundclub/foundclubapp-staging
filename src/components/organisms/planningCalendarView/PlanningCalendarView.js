import { FlashList } from '@shopify/flash-list';
import {
  format,
  parseISO,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';

import { etiquetteDuPlanning } from '@/domains/collectivite/evenementDeLaVille';
import { pendingDeciderLabel } from '@/domains/event/pendingDeciderLabel';
import {
  closureBandLabel,
  closureHoursLabel,
  closureOfDay,
} from '@/domains/facilityClosure/facilityClosureDisplay';
import { withAlpha } from '@/theme/colors';
import localeDesFormats from '@/theme/strings/localeDesFormats';
import useTheme from '@/theme/themeContext';

import Hachures from '@/components/atoms/hachures/Hachures';
import MarqueeText from '@/components/atoms/marqueeText/MarqueeText';

import { resolveFacilityPlanningColor } from '@/utils/facilityPlanningColor';
import {
  getPlanningDefaultDate,
  getPlanningDisplayTitle,
  getPlanningItemDate,
  getPlanningTimeLabel,
  getPlanningTypeLabel,
  isPlanningPendingParticipation,
} from '@/utils/planning/planningSlots';

LocaleConfig.locales.fr = {
  dayNames: ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'],
  dayNamesShort: ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'],
  monthNames: [
    'Janvier',
    'Février',
    'Mars',
    'Avril',
    'Mai',
    'Juin',
    'Juillet',
    'Août',
    'Septembre',
    'Octobre',
    'Novembre',
    'Décembre',
  ],
  monthNamesShort: [
    'Janv.',
    'Févr.',
    'Mars',
    'Avril',
    'Mai',
    'Juin',
    'Juil.',
    'Août',
    'Sept.',
    'Oct.',
    'Nov.',
    'Déc.',
  ],
  today: "Aujourd'hui",
};
// I18N-2 : les mêmes libellés en anglais. Les noms de jours et de mois sont des
// données de calendrier, pas des phrases : ils vivent ici, pas dans fr.js.
LocaleConfig.locales.en = {
  dayNames: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  dayNamesShort: ['Sun.', 'Mon.', 'Tue.', 'Wed.', 'Thu.', 'Fri.', 'Sat.'],
  monthNames: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
  monthNamesShort: [
    'Jan.',
    'Feb.',
    'Mar.',
    'Apr.',
    'May',
    'Jun.',
    'Jul.',
    'Aug.',
    'Sep.',
    'Oct.',
    'Nov.',
    'Dec.',
  ],
  today: 'Today',
};
LocaleConfig.defaultLocale = 'fr';

const hexToRgba = (hex, alpha) => {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#') || hex.length !== 7) {
    return `rgba(1, 179, 244, ${alpha})`;
  }

  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

/**
 *
 * @param {object} root0
 * @param root0.colors
 * @param {((count: number) => string) | null} [root0.compterLesSeances] - R17-PLANNING-2 : avec
 *   elle, chaque pastille porte son nombre de seances et le jour se lit « 7, 3 seances ».
 * @param root0.date
 * @param root0.eventsByDate
 * @param {any} [root0.fermetureDuJour] - COLL-C4B-BIS : la fermeture du jour, ou null.
 * @param root0.fonts
 * @param {string | null} [root0.libelleDeFermeture] - Ce que dit la plage (lecteur d ecran).
 * @param root0.onPress
 * @param root0.selectedDate
 * @param root0.state
 * @param root0.todayKey
 */
function PlanningCalendarDay({
  colors,
  compterLesSeances = null,
  date,
  eventsByDate,
  fermetureDuJour = null,
  fonts,
  libelleDeFermeture = null,
  onPress,
  selectedDate,
  state,
  todayKey,
}) {
  const dateString = date?.dateString;
  if (!dateString) return null;
  // COLL-C4B-BIS (03/10) : un jour ferme toute la journee se HACHURE (comme la grille, planche
  // P4v3-fermer) ; un jour bloque (une plage) se cerne d orange.
  const journeeFermee = Boolean(fermetureDuJour) && fermetureDuJour.kind !== 'block';
  const jourBloque = Boolean(fermetureDuJour) && !journeeFermee;
  let testIDDuJour;
  if (journeeFermee) testIDDuJour = `jour-ferme-${dateString}`;
  else if (jourBloque) testIDDuJour = `jour-bloque-${dateString}`;

  // R17-EVT-1-BIS (b) (20/10) : un événement de la Ville n'est pas une séance : un repère CLAIR
  // à part, jamais compté dans les pastilles des séances.
  const duJour = eventsByDate.get(dateString) || [];
  const avecEvenementVille = duJour.some((event) => event?.raw?.evenementDeLaVille);
  const dayEvents = duJour.filter((event) => !event?.raw?.evenementDeLaVille);
  const hasPendingEvent = dayEvents.some((event) => isPlanningPendingParticipation(event));
  // R17-PLANNING-2 (20/10) : le nombre de seances de chaque couleur (planche P10-planning-ordi 3,
  // « une pastille par installation avec son nombre de seances »).
  /** @type {Map<string, number>} */
  const seancesParCouleur = new Map();
  dayEvents.forEach((event) => {
    // COLL-C2B (02/10) : sur le planning d une installation, la couleur du CLUB (displayColor,
    // COLL1D) passe avant celle, commune, de l installation — comme dans la grille.
    const couleur = event?.displayColor || resolveFacilityPlanningColor(event?.facility)
      || colors.primary500;
    if (couleur) seancesParCouleur.set(couleur, (seancesParCouleur.get(couleur) || 0) + 1);
  });
  const uniqueColors = [...seancesParCouleur.keys()].slice(0, 3);
  // Avec les nombres, « +n » compte les seances des couleurs qui n ont pas de pastille.
  const extraCount = compterLesSeances
    ? dayEvents.length - uniqueColors.reduce((total, couleur) => (
      total + (seancesParCouleur.get(couleur) || 0)), 0)
    : Math.max(0, dayEvents.length - 3);
  const libelleDuJour = [
    libelleDeFermeture,
    compterLesSeances && dayEvents.length ? compterLesSeances(dayEvents.length) : null,
  ].filter(Boolean);
  const isSelected = dateString === selectedDate;
  const isCurrentDay = dateString === todayKey;
  const isDisabled = state === 'disabled';

  let dayColor = colors.neutral00;
  if (isSelected) {
    dayColor = colors.neutral00;
  } else if (isCurrentDay) {
    dayColor = colors.primary500;
  }
  let borderColor = isCurrentDay ? colors.primary500 : 'transparent';
  let fondDuJour = 'transparent';
  // FINITIONS12-COLL (03/10) — un jour FERME choisi garde un fond leger : le bleu plein
  // recouvrait ses hachures (tournee T11, C25_4 : « le 7 est cerne, pas hachure »).
  if (isSelected) {
    fondDuJour = journeeFermee ? withAlpha(colors.primary500, 0.3) : colors.primary500;
  }
  if (fermetureDuJour) borderColor = colors.warning500;

  return (
    <TouchableOpacity
      accessibilityLabel={libelleDuJour.length
        ? [date.day, ...libelleDuJour].join(', ')
        : undefined}
      onPress={() => onPress(dateString)}
      style={styles.dayCellTouch}
    >
      <View
        style={[
          styles.dayCell,
          {
            backgroundColor: fondDuJour,
            borderColor,
            borderStyle: jourBloque ? 'dashed' : 'solid',
            opacity: isDisabled ? 0.4 : 1,
            overflow: 'hidden',
          },
        ]}
        testID={testIDDuJour}
      >
        {journeeFermee ? <Hachures color={colors.warning500} intensite={2} /> : null}
        <Text
          style={[
            fonts.p3Bold,
            {
              color: dayColor,
              fontSize: 13,
            },
          ]}
        >
          {date.day}
        </Text>

        {hasPendingEvent ? (
          <View style={[styles.pendingDayBadge, { backgroundColor: colors.warning500 || colors.gold500 || '#F5A623' }]}>
            <Text style={styles.pendingDayBadgeText}>!</Text>
          </View>
        ) : null}

        <View style={styles.dayMarkersRow}>
          {avecEvenementVille ? (
            <View
              style={[styles.dayMarker, { backgroundColor: colors.primary100 }]}
              testID={`jour-evenement-ville-${dateString}`}
            />
          ) : null}
          {uniqueColors.map((color) => (compterLesSeances ? (
            <View
              key={`${dateString}-${color}`}
              style={[styles.dayPill, { backgroundColor: color }]}
              testID={`pastille-${dateString}-${color}`}
            >
              <Text style={[fonts.p3Bold, styles.dayPillText, { color: colors.neutral900 }]}>
                {seancesParCouleur.get(color)}
              </Text>
            </View>
          ) : (
            <View
              key={`${dateString}-${color}`}
              style={[styles.dayMarker, { backgroundColor: color }]}
            />
          )))}
          {extraCount > 0 ? (
            <Text
              style={[
                fonts.p3Bold,
                {
                  color: isSelected ? colors.neutral00 : colors.primary500,
                  fontSize: 9,
                },
              ]}
            >
              +
              {extraCount}
            </Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

/**
 * Monthly planning view with colored day markers and a daily event list.
 * @param {{
 *   closures?: Array<any>;
 *   compterLesSeances?: ((count: number) => string) | null;
 *   currentDate?: Date;
 *   events?: Array<any>;
 *   onDateSelect?: (date: Date) => void;
 *   onEventPress?: (event: any) => void;
 * }} props
 * @returns {import('react').ReactElement}
 */
function PlanningCalendarView({
  closures = [],
  compterLesSeances = null,
  currentDate: propDate,
  events = [],
  onDateSelect,
  onEventPress,
}) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  // I18N-2 : le calendrier parle la langue de l app (lue au rendu, pas à l import).
  LocaleConfig.defaultLocale = localeDesFormats() === 'en-GB' ? 'en' : 'fr';
  const [internalDate, setInternalDate] = useState(format(getPlanningDefaultDate(), 'yyyy-MM-dd'));

  const selectedDate = useMemo(() => {
    if (propDate) return format(propDate, 'yyyy-MM-dd');
    return internalDate;
  }, [internalDate, propDate]);

  const handleDateChange = useCallback((dateString) => {
    if (onDateSelect) {
      onDateSelect(parseISO(dateString));
      return;
    }

    setInternalDate(dateString);
  }, [onDateSelect]);

  const eventsByDate = useMemo(() => {
    const map = new Map();

    events.forEach((event) => {
      const eventDate = getPlanningItemDate(event);
      if (!eventDate) return;

      const key = format(eventDate, 'yyyy-MM-dd');
      const currentItems = map.get(key) || [];
      map.set(key, [...currentItems, event]);
    });

    return map;
  }, [events]);

  const selectedEvents = useMemo(
    () => eventsByDate.get(selectedDate) || [],
    [eventsByDate, selectedDate],
  );

  const renderPlanningListCard = useCallback(({ item }) => {
    // R17-EVT-1-BIS (b) (20/10) : l'événement de la Ville, sa carte CLAIRE (pleine s'il prend toute
    // l'installation, en contour à côté), comme son bloc dans la grille ; elle s'ouvre pareil.
    const evenementVille = item?.raw?.evenementDeLaVille;
    if (evenementVille) {
      const plein = Boolean(evenementVille.takesPlace);
      return (
        <TouchableOpacity
          accessibilityLabel={t(
            'collectiviteEvenement.planning.aria',
            'Événement de la Ville : {{nom}}, {{heures}}, {{place}}',
            {
              heures: `${evenementVille.startTime || ''} – ${evenementVille.endTime || ''}`,
              interpolation: { escapeValue: false },
              nom: evenementVille.name,
              place: etiquetteDuPlanning(t, evenementVille),
            },
          )}
          accessibilityRole="button"
          onPress={() => onEventPress?.(item)}
          style={[Spaces.marginBottom[12], {
            backgroundColor: plein ? Colors.primary100 : withAlpha(Colors.primary100, 0.18),
            borderColor: Colors.primary100,
            borderRadius: 12,
            borderWidth: plein ? 0 : 1.5,
            gap: 2,
            padding: 12,
          }]}
          testID={`liste-evenement-ville-${evenementVille.documentId}`}
        >
          <Text
            style={[Fonts.p4Bold, {
              color: plein ? Colors.primary700 : Colors.primary100,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
            }]}
          >
            {etiquetteDuPlanning(t, evenementVille)}
          </Text>
          <Text numberOfLines={2} style={[Fonts.p2Bold, { color: plein ? Colors.primary700 : Colors.neutral00 }]}>
            {evenementVille.name}
          </Text>
          <Text style={[Fonts.p3, { color: plein ? Colors.primary700 : Colors.neutral300 }]}>
            {`${evenementVille.startTime || ''} – ${evenementVille.endTime || ''}`}
          </Text>
        </TouchableOpacity>
      );
    }
    const accentColor = item?.displayColor
      || resolveFacilityPlanningColor(item?.facility)
      || Colors.primary500;
    const typeLabel = getPlanningTypeLabel(item);
    const facilityName = item?.facility?.name || null;
    const isPendingParticipation = isPlanningPendingParticipation(item);
    const pendingAccentColor = Colors.warning500 || Colors.gold500 || '#F5A623';
    // MARQUE-MAIRIE (14/10, COL-003, « D3- B ») — la seance attend une decision : les mots de la
    // grille (COLL-R-A4), au meme ton ; un serveur d avant ne pose rien.
    const attente = pendingDeciderLabel(item?.raw?.pendingDecider ?? item?.pendingDecider, t);
    const timeLabel = getPlanningTimeLabel(item) || t('planning.labels.noTime', 'Sans horaire');

    return (
      <TouchableOpacity
        onPress={() => onEventPress?.(item)}
        style={[
          ApplicationStyle.backgroundColor.primary700,
          ApplicationStyle.borderRadius24,
          Spaces.marginBottom[12],
          Spaces.padding[16],
          {
            borderColor: hexToRgba(accentColor, 0.45),
            borderLeftColor: accentColor,
            borderLeftWidth: 4,
            borderWidth: 1,
          },
        ]}
      >
        <Text numberOfLines={2} style={[Fonts.p1Bold, Fonts.neutral00]}>
          {getPlanningDisplayTitle(item)}
        </Text>

        {isPendingParticipation ? (
          <View
            style={[
              styles.pendingStatusPill,
              {
                backgroundColor: hexToRgba(pendingAccentColor, 0.16),
                borderColor: hexToRgba(pendingAccentColor, 0.4),
              },
            ]}
          >
            <Text style={[Fonts.p4Bold, { color: pendingAccentColor }]}>
              {t('planning.status.pendingParticipation', 'Demande en attente')}
            </Text>
          </View>
        ) : null}

        {attente ? (
          <View
            style={[
              styles.pendingStatusPill,
              {
                backgroundColor: hexToRgba(pendingAccentColor, 0.16),
                borderColor: hexToRgba(pendingAccentColor, 0.4),
              },
            ]}
          >
            <Text
              style={[Fonts.p4Bold, { color: Colors.warning400 || pendingAccentColor }]}
              testID="seance-en-attente"
            >
              {attente}
            </Text>
          </View>
        ) : null}

        {typeLabel ? (
          <Text numberOfLines={1} style={[Fonts.p3, { color: Colors.neutral300, marginTop: 6 }]}>
            {typeLabel}
          </Text>
        ) : null}

        {facilityName ? (
          <MarqueeText
            containerStyle={{ marginTop: 6 }}
            style={[Fonts.p3Bold, { color: accentColor }]}
            text={facilityName}
          />
        ) : null}

        <Text numberOfLines={1} style={[Fonts.p3, { color: Colors.neutral300, marginTop: 6 }]}>
          {timeLabel}
        </Text>
      </TouchableOpacity>
    );
  }, [
    ApplicationStyle.backgroundColor.primary700,
    ApplicationStyle.borderRadius24,
    Colors.neutral00,
    Colors.neutral300,
    Colors.gold500,
    Colors.primary100,
    Colors.primary500,
    Colors.primary700,
    Colors.warning400,
    Colors.warning500,
    Fonts.neutral00,
    Fonts.p1Bold,
    Fonts.p2Bold,
    Fonts.p3,
    Fonts.p3Bold,
    Fonts.p4Bold,
    Spaces.marginBottom,
    Spaces.padding,
    onEventPress,
    t,
  ]);

  const renderEmptyList = useCallback(() => (
    <View
      style={[
        ApplicationStyle.backgroundColor.primary900,
        ApplicationStyle.borderRadius16,
        Alignments.alignCenter,
        Spaces.padding[24],
        Spaces.marginVertical[24],
      ]}
    >
      <Text style={[Fonts.p1Bold, Fonts.neutral00, Fonts.textCenter]}>
        {t('planning.noEventsForDate', 'Aucun événement ce jour-là')}
      </Text>
    </View>
  ), [
    Alignments.alignCenter,
    ApplicationStyle.backgroundColor.primary900,
    ApplicationStyle.borderRadius16,
    Fonts.neutral00,
    Fonts.p1Bold,
    Fonts.textCenter,
    Spaces.marginVertical,
    Spaces.padding,
    t,
  ]);

  const todayKey = format(getPlanningDefaultDate(), 'yyyy-MM-dd');

  // COLL-C4B-BIS (03/10) — les fermetures du mois (`meta.closures` du planning d une installation).
  const fermetureDe = useCallback(
    (/** @type {string | undefined} */ jour) => (jour ? closureOfDay(closures, jour) : null),
    [closures],
  );
  const renderDayComponent = useCallback(({ date, state }) => {
    const fermetureDuJour = fermetureDe(date?.dateString);
    return (
      <PlanningCalendarDay
        colors={Colors}
        compterLesSeances={compterLesSeances}
        date={date}
        eventsByDate={eventsByDate}
        fermetureDuJour={fermetureDuJour}
        fonts={Fonts}
        libelleDeFermeture={fermetureDuJour ? closureBandLabel(t, fermetureDuJour) : null}
        onPress={handleDateChange}
        selectedDate={selectedDate}
        state={state}
        todayKey={todayKey}
      />
    );
  }, [
    Colors,
    Fonts,
    compterLesSeances,
    eventsByDate,
    fermetureDe,
    handleDateChange,
    selectedDate,
    t,
    todayKey,
  ]);
  const fermetureDuJourChoisi = fermetureDe(selectedDate);

  return (
    <View style={Alignments.fill}>
      <View style={[Spaces.paddingHorizontal[24], Spaces.marginBottom[12], Alignments.alignEnd]}>
        <TouchableOpacity
          onPress={() => handleDateChange(todayKey)}
          style={[
            ApplicationStyle.borderRadius16,
            Spaces.paddingHorizontal[12],
            Spaces.paddingVertical[8],
            {
              backgroundColor: ApplicationStyle.backgroundColor.primary700.backgroundColor,
              borderColor: Colors.primary500,
              borderWidth: 1,
            },
          ]}
        >
          <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
            {t('planning.actions.today', "Aujourd'hui")}
          </Text>
        </TouchableOpacity>
      </View>

      <Calendar
        current={selectedDate}
        dayComponent={renderDayComponent}
        enableSwipeMonths
        firstDay={1}
        markingType="custom"
        onDayPress={(day) => handleDateChange(day.dateString)}
        onMonthChange={(month) => handleDateChange(month.dateString)}
        // FINITIONS7 — sans lui, la bibliotheque nomme ses fleches « undefined.header.leftArrow »
        // (tournee 8). Elle les cache elle-meme au lecteur d ecran : l en-tete, « ajustable »,
        // change de mois d un balayage vers le haut ou le bas.
        testID="planning-calendar"
        theme={{
          arrowColor: Colors.primary500,
          calendarBackground: 'transparent',
          dayTextColor: Colors.neutral00,
          indicatorColor: Colors.primary500,
          monthTextColor: Colors.neutral00,
          textDayFontFamily: 'Montserrat-Regular',
          textDayFontSize: 14,
          textDayHeaderFontFamily: 'Montserrat-Regular',
          textDayHeaderFontSize: 12,
          textDisabledColor: Colors.neutral600,
          textMonthFontFamily: 'Montserrat-Bold',
          textMonthFontSize: 16,
          textSectionTitleColor: Colors.neutral400,
          todayTextColor: Colors.primary500,
        }}
      />

      <View style={[Spaces.paddingHorizontal[24], Spaces.marginTop[24], Alignments.fill]}>
        <Text style={[Fonts.h3, Fonts.neutral00, Fonts.textCenter, Spaces.marginBottom[16]]}>
          {format(parseISO(selectedDate), 'EEEE d MMMM yyyy', { locale: fr })}
        </Text>

        {/* COLL-C4B-BIS : le jour choisi est ferme ou bloque — la liste commence par la plage. */}
        {fermetureDuJourChoisi ? (
          <View
            style={[
              Spaces.padding[16],
              Spaces.marginBottom[12],
              {
                borderColor: hexToRgba(Colors.warning500, 0.55),
                borderRadius: 24,
                borderWidth: 1,
                gap: 4,
                overflow: 'hidden',
              },
            ]}
            testID="mois-fermeture-du-jour"
          >
            <Hachures color={Colors.warning500} />
            <Text style={[Fonts.p1Bold, { color: Colors.warning400 }]}>
              {closureBandLabel(t, fermetureDuJourChoisi)}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral100]}>
              {closureHoursLabel(t, fermetureDuJourChoisi)}
            </Text>
          </View>
        ) : null}

        <View style={Alignments.fill}>
          <FlashList
            contentContainerStyle={{ paddingBottom: 100 }}
            data={selectedEvents}
            keyExtractor={(item, index) => item?.documentId || String(item?.id || index)}
            ListEmptyComponent={renderEmptyList}
            renderItem={renderPlanningListCard}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dayCell: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 38,
    paddingHorizontal: 2,
    paddingTop: 4,
  },
  dayCellTouch: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 32,
  },
  dayMarker: {
    borderRadius: 999,
    height: 4,
    marginHorizontal: 1.5,
    width: 4,
  },
  dayMarkersRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 3,
    minHeight: 10,
  },
  dayPill: {
    alignItems: 'center',
    borderRadius: 999,
    height: 14,
    justifyContent: 'center',
    marginHorizontal: 1.5,
    minWidth: 14,
    paddingHorizontal: 3,
  },
  dayPillText: {
    fontSize: 9,
    lineHeight: 11,
  },
  pendingDayBadge: {
    alignItems: 'center',
    borderRadius: 999,
    height: 12,
    justifyContent: 'center',
    position: 'absolute',
    right: -2,
    top: 0,
    width: 12,
  },
  pendingDayBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
    lineHeight: 8,
  },
  pendingStatusPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});

export default PlanningCalendarView;
