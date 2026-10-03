import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  format,
  isSameDay,
  isWithinInterval,
  startOfDay,
  startOfWeek,
  subDays,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Directions, Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { images as Images } from '@/theme/images';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Hachures from '@/components/atoms/hachures/Hachures';

import { resolveFacilityPlanningColor } from '@/utils/facilityPlanningColor';
import {
  getPlanningDefaultDate,
  getPlanningDisplayTitle,
  getPlanningItemDate,
  getPlanningItemWindow,
  getPlanningTimeLabel,
  getPlanningTypeLabel,
  isPlanningPendingParticipation,
  resolvePlanningCardContent,
} from '@/utils/planning/planningSlots';

const DEFAULT_HOUR_HEIGHT = 60;
const DEFAULT_COLLAPSED_HEIGHT = 18;
const DEFAULT_MIN_EVENT_HEIGHT = 28;
const DEFAULT_TIME_COLUMN_WIDTH = 56;
// COLL-FIX-PLANNING (tournee T9, capture T9_C29_2) — sous cette largeur (en points), un bloc ne
// montre plus que deux ou trois lettres par ligne (« AS / … / 1… ») : les seances qui se
// chevauchent se REGROUPENT alors en une seule carte (« 2 séances », voir layoutEvents).
const LARGEUR_LISIBLE_MIN = 44;
// PLANNING-PORTRAIT (01/10, D6 A) : le mode « jour » (plein ecran tenu droit) montre
// une colonne ; tout autre mode que ceux-la garde ses 3 jours.
const PAGE_DAYS_BY_MODE = /** @type {Record<string, number>} */ ({ day: 1, week: 7 });
const PALETTE = ['#FF4D4D', '#4D79FF', '#FFB34D', '#4DFFB3', '#9D4DFF', '#FF4D94'];

const hexToRgba = (hex, alpha) => {
  if (!hex || !hex.startsWith('#') || hex.length !== 7) {
    return `rgba(1, 179, 244, ${alpha})`;
  }

  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const getDayKey = (day) => format(day, 'yyyy-MM-dd');

const extractTime = (event) => {
  const planningWindow = getPlanningItemWindow(event);
  const startAt = planningWindow?.startAt;
  const endAt = planningWindow?.endAt;

  if (!startAt || !endAt) {
    return null;
  }

  return {
    endHour: endAt.getHours(),
    endMinute: endAt.getMinutes(),
    startHour: startAt.getHours(),
    startMinute: startAt.getMinutes(),
  };
};

const getEventColor = (event, fallbackColor) => {
  // COLL1D — le planning d'une installation pose la couleur du CLUB de chaque bloc
  // (assignClubPlanningColors) : elle passe avant celle, commune, de l'installation.
  if (event?.displayColor) return event.displayColor;
  const facilityColor = resolveFacilityPlanningColor(event?.facility);
  if (facilityColor) return facilityColor;

  const typeLabel = getPlanningTypeLabel(event)
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (typeLabel?.includes('match')) return '#FF4D4D';
  if (typeLabel?.includes('reservation') || typeLabel?.includes('reunion')) return '#FFB34D';
  if (typeLabel?.includes('entrainement')) return '#4D79FF';

  const seed = event?.team?.name || getPlanningDisplayTitle(event) || 'planning';
  const hash = Array.from(seed).reduce(
    (value, character) => value * 31 + character.charCodeAt(0),
    11,
  );

  return PALETTE[Math.abs(hash) % PALETTE.length] || fallbackColor;
};

/**
 * FINITIONS2 (recette du 29/09) — UN BLOC QU'AUCUN APPUI N'OUVRE N'EST PAS UN
 * BOUTON. Le planning d'une installation partagee montre les creneaux des
 * AUTRES clubs sans leur identifiant (le serveur ne le donne qu'au club du
 * lecteur) : ces blocs ne menaient nulle part, mais TalkBack les annoncait
 * « cliquables ». Les quatre ecrans qui montent cette vue ouvrent un bloc par
 * son `documentId`, et ne font rien sans lui : la regle est donc ici, une fois.
 * Le bloc inerte reste lu d'un seul tenant (`accessible`), sans role de bouton.
 * PLANNING-PORTRAIT (01/10) — SAUF si l'ecran sait le lire autrement : la mairie
 * ouvre une fiche en lecture (SPEC Collectivites §2 C), par `onReadOnlyEventPress`.
 * @param {object} props
 * @param {string} [props.accessibilityLabel]
 * @param {any} props.children
 * @param {any} props.event
 * @param {Function} [props.onEventPress]
 * @param {Function} [props.onReadOnlyEventPress]
 * @param {any} props.style
 * @returns {JSX.Element}
 */
function EventBlock({
  accessibilityLabel, children, event, onEventPress, onReadOnlyEventPress, style,
}) {
  if (onEventPress && event?.documentId) {
    return (
      <TouchableOpacity
        accessibilityLabel={accessibilityLabel}
        onPress={() => onEventPress(event)}
        style={style}
      >
        {children}
      </TouchableOpacity>
    );
  }
  if (onReadOnlyEventPress) {
    return (
      <TouchableOpacity
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        onPress={() => onReadOnlyEventPress(event)}
        style={style}
      >
        {children}
      </TouchableOpacity>
    );
  }
  return <View accessibilityLabel={accessibilityLabel} accessible style={style}>{children}</View>;
}

/**
 * La grille du planning : une semaine, trois jours, ou un jour.
 * @param {object} root0
 * @param {string} [root0.cardDisplayProfile] - 'default', 'teamFocused' ou 'clubFocused'.
 * @param {any} [root0.currentDate]
 * @param {any[]} [root0.events]
 * @param {string} [root0.mode] - 'week' (7 jours), 'day' (1 jour) ; sinon 3 jours.
 * @param {Function} [root0.onDateChange]
 * @param {Function} [root0.onEventPress]
 * @param {Function} [root0.onReadOnlyEventPress] - Ouvre en lecture un bloc sans identifiant.
 * @param {Function} [root0.onSummaryPress]
 * @param {boolean} [root0.scrollEnabled]
 * @param {boolean} [root0.compactFullscreen]
 * @param {boolean} [root0.expandToContent]
 * @param {boolean} [root0.showHeader]
 * @param {boolean} [root0.showUntimedSection]
 * @param {number} [root0.firstHour] - COLL-C2B : la grille commence au plus tard a cette heure
 *   (l ouverture de l installation), pour qu une heure libre du matin se touche.
 * @param {(jour: Date, heure: number, colonne?: number) => void} [root0.onFreeSlotPress] -
 *   COLL-C2B : toucher une heure de la grille (la mairie attribue). Sans elle, rien ne se touche
 *   hors des blocs. COLL-C2B-BIS : avec des colonnes de plateaux, la case dit aussi SA colonne
 *   (0 a n-1).
 * @param {Array<{ key: string, label: string }>} [root0.lanes] - COLL-C2B (D66) : en mode
 *   « jour », une colonne par plateau, nommee en tete.
 * @param {(evenement: any) => number} [root0.laneOf] - La colonne d un bloc (0 a lanes.length-1).
 */
function PlanningWeekTimelineView({
  cardDisplayProfile = 'default',
  compactFullscreen = false,
  currentDate: propDate,
  events = [],
  expandToContent = false,
  firstHour,
  laneOf,
  lanes,
  mode = '3days',
  onDateChange,
  onEventPress,
  onFreeSlotPress,
  onReadOnlyEventPress,
  onSummaryPress,
  scrollEnabled = true,
  showHeader = true,
  showUntimedSection = true,
}) {
  const { t } = useTranslation();
  const { Colors, Fonts } = useTheme();
  const [internalDate, setInternalDate] = useState(getPlanningDefaultDate());
  const pendingAccentColor = Colors.warning500 || Colors.gold500 || '#F5A623';
  const currentDate = propDate || internalDate;
  const nowReference = getPlanningDefaultDate();
  const scrollViewRef = useRef(null);
  // La largeur MESUREE de la grille ; 0 tant qu elle ne l est pas (alors rien ne se regroupe).
  const [largeurGrille, setLargeurGrille] = useState(0);
  const mesurerLaGrille = useCallback((/** @type {any} */ evenement) => {
    setLargeurGrille(Math.round(evenement?.nativeEvent?.layout?.width || 0));
  }, []);
  const hourHeight = compactFullscreen ? 44 : DEFAULT_HOUR_HEIGHT;
  const collapsedHeight = compactFullscreen ? 12 : DEFAULT_COLLAPSED_HEIGHT;
  const minEventHeight = compactFullscreen ? 22 : DEFAULT_MIN_EVENT_HEIGHT;
  const timeColumnWidth = compactFullscreen ? 42 : DEFAULT_TIME_COLUMN_WIDTH;

  const weekDays = useMemo(() => {
    if (mode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      return Array.from({ length: 7 }, (_, index) => addDays(start, index));
    }

    if (mode === 'day') return [currentDate];

    return [currentDate, addDays(currentDate, 1), addDays(currentDate, 2)];
  }, [currentDate, mode]);

  const weekEvents = useMemo(() => {
    if (!events.length) return [];

    const start = startOfDay(weekDays[0]);
    const end = endOfDay(weekDays[weekDays.length - 1]);
    return events.filter((event) => {
      const eventDate = getPlanningItemDate(event);
      return eventDate ? isWithinInterval(eventDate, { end, start }) : false;
    });
  }, [events, weekDays]);

  const untimedEvents = useMemo(
    () => weekEvents.filter((event) => !event?.hasExplicitTime),
    [weekEvents],
  );
  const timedEvents = useMemo(
    () => weekEvents.filter((event) => event?.hasExplicitTime),
    [weekEvents],
  );

  const displayStartHour = useMemo(() => {
    // COLL-C2B : avec `firstHour`, la grille ouvre au plus tard a l ouverture de l installation.
    const ouverture = typeof firstHour === 'number' ? firstHour : 23;
    if (!timedEvents.length) return typeof firstHour === 'number' ? firstHour : 8;
    return timedEvents.reduce((hour, event) => {
      const eventTime = extractTime(event);
      if (!eventTime) return hour;
      return Math.min(hour, eventTime.startHour);
    }, ouverture);
  }, [firstHour, timedEvents]);
  // COLL-C2B (D66) : les colonnes de plateaux ne valent qu en mode « jour ».
  const colonnesDePlateaux = mode === 'day' && Array.isArray(lanes) && lanes.length > 0
    ? lanes
    : null;

  // 🖥️ COLL-C4B-BIS (03/10, « P4v3-fermer-ordi ») : une JOURNEE fermee (plage `closureBand` d une
  // fermeture, pas d un blocage) n ouvre pas les heures creuses — « Libre jusqu a 17:30 » reste
  // replie, la plage les couvre toutes. Seule dans la page, elle les ouvre : la journee se lit.
  const heuresOuvrantes = useMemo(() => {
    const sansJourneeFermee = timedEvents.filter((/** @type {any} */ event) => (
      !event?.raw?.closureBand || event.raw.closureBand.kind === 'block'
    ));
    return sansJourneeFermee.length ? sansJourneeFermee : timedEvents;
  }, [timedEvents]);

  const activeHours = useMemo(() => {
    const values = new Set();

    heuresOuvrantes.forEach((event) => {
      const eventTime = extractTime(event);
      if (!eventTime) return;
      const { endHour, endMinute, startHour } = eventTime;
      if (endHour < startHour) {
        for (let hour = startHour; hour <= 23; hour += 1) values.add(hour);
        const inclusiveEnd = endMinute > 0 ? endHour : endHour - 1;
        for (let hour = 0; hour <= inclusiveEnd; hour += 1) values.add(hour);
        return;
      }

      const inclusiveEnd = endMinute > 0 ? endHour : endHour - 1;
      for (let hour = startHour; hour <= inclusiveEnd; hour += 1) values.add(hour);
    });

    return values;
  }, [heuresOuvrantes]);

  const timelineBlocks = useMemo(() => {
    const blocks = [];
    let emptyStart = null;

    for (let hour = displayStartHour; hour <= 23; hour += 1) {
      if (activeHours.has(hour)) {
        if (emptyStart !== null) {
          blocks.push({
            end: hour - 1, id: `collapsed-${emptyStart}`, start: emptyStart, type: 'collapsed',
          });
          emptyStart = null;
        }
        blocks.push({ type: 'hour', value: hour });
      } else if (emptyStart === null) {
        emptyStart = hour;
      }
    }

    if (emptyStart !== null) {
      blocks.push({
        end: 23, id: `collapsed-${emptyStart}-23`, start: emptyStart, type: 'collapsed',
      });
    }

    return blocks;
  }, [activeHours, displayStartHour]);

  const { hourPositions, totalHeight } = useMemo(() => {
    const positions = {};
    let y = 0;

    timelineBlocks.forEach((block) => {
      if (block.type === 'hour') {
        positions[block.value] = y;
        y += hourHeight;
        return;
      }

      for (let hour = block.start; hour <= block.end; hour += 1) {
        positions[hour] = y;
      }
      y += collapsedHeight;
    });

    return { hourPositions: positions, totalHeight: y };
  }, [collapsedHeight, hourHeight, timelineBlocks]);

  useEffect(() => {
    if (!scrollViewRef.current || hourPositions[displayStartHour] === undefined) return undefined;

    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollTo({ animated: true, y: Math.max(0, hourPositions[displayStartHour] - 12) });
    }, 100);

    return () => clearTimeout(timer);
  }, [displayStartHour, hourPositions, weekDays]);

  const layoutEvents = useMemo(() => {
    const overflowLimit = mode === 'week' ? 2 : 3;
    // T9 (C29_2) : la colonne d un jour est-elle trop etroite pour n blocs cote a cote ?
    const largeurDuJour = largeurGrille > 0 ? largeurGrille / weekDays.length : 0;
    const tropEtroit = (/** @type {number} */ colonnes) => largeurDuJour > 0
      && colonnes > 1 && largeurDuJour / colonnes < LARGEUR_LISIBLE_MIN;
    const byDay = weekDays.map(() => []);

    timedEvents.forEach((event) => {
      const date = getPlanningItemDate(event);
      if (!date) return;

      const dayIndex = differenceInCalendarDays(date, weekDays[0]);
      if (dayIndex < 0 || dayIndex >= weekDays.length) return;

      const {
        endHour,
        endMinute,
        startHour,
        startMinute,
      } = extractTime(event) || {};

      if (
        typeof startHour !== 'number'
        || typeof startMinute !== 'number'
        || typeof endHour !== 'number'
        || typeof endMinute !== 'number'
      ) {
        return;
      }

      const startBase = hourPositions[startHour] ?? 0;
      const endBase = hourPositions[endHour] ?? totalHeight;
      const top = startBase + (
        activeHours.has(startHour) ? (startMinute / 60) * hourHeight : (startMinute / 60) * collapsedHeight
      );

      let bottom = totalHeight;
      if (endHour >= startHour) {
        bottom = endBase + (
          activeHours.has(endHour) ? (endMinute / 60) * hourHeight : (endMinute / 60) * collapsedHeight
        );
      }

      // COLL-C4B-BIS : une JOURNEE fermee couvre toute la colonne (`.ferme-bande` : top 0,
      // bottom 0).
      const journeeFermee = Boolean(event?.raw?.closureBand)
        && event.raw.closureBand.kind !== 'block';
      const positionedEvent = {
        ...event,
        bottom: journeeFermee ? totalHeight : Math.max(top + minEventHeight, bottom),
        color: getEventColor(event, Colors.primary500),
        dayIndex,
        top: journeeFermee ? 0 : top,
      };

      byDay[dayIndex].push(positionedEvent);
    });

    // COLL-C2B (D66, design P4v3-plateaux ecran 3) : une colonne PAR PLATEAU, nommee en tete ;
    // chaque bloc va dans la sienne. ponytail: deux blocs du meme plateau a la meme heure se
    // superposent (c est un depassement, que l attribution a deja signale) ; sortie : les
    // decaler dans leur colonne comme les grappes ci-dessous.
    if (colonnesDePlateaux) {
      const largeur = 100 / colonnesDePlateaux.length;
      return byDay.flatMap((dayEvents) => dayEvents.map((/** @type {any} */ event) => {
        // COLL-C4B-BIS : la plage fermee passe sous TOUTES les colonnes de plateaux.
        if (event.raw?.closureBand) {
          return {
            ...event,
            colIndex: 0,
            displayType: 'event',
            height: event.bottom - event.top,
            leftPercent: 0,
            widthPercent: 100,
          };
        }
        const colonne = Math.max(0, Math.min(
          colonnesDePlateaux.length - 1,
          Number(laneOf ? laneOf(event) : 0) || 0,
        ));
        return {
          ...event,
          colIndex: colonne,
          displayType: 'event',
          height: event.bottom - event.top,
          leftPercent: colonne * largeur,
          widthPercent: largeur,
        };
      }));
    }

    return byDay.flatMap((dayEvents, dayIndex) => {
      // T9 (C29_2), puis COLL-C4B-BIS (03/10, « P4v3-fermer-ordi ») : une plage fermee (COLL-C4B)
      // ne prend JAMAIS la place d une seance : elle se pose en FOND, sur toute la largeur du jour,
      // sous les seances — sur un telephone comme sur la semaine large de l ordinateur.
      /** @type {any[]} */
      const enFond = dayEvents.filter((/** @type {any} */ event) => event.raw?.closureBand);
      const fond = enFond.map((/** @type {any} */ event) => ({
        ...event,
        colIndex: 0,
        displayType: 'event',
        height: event.bottom - event.top,
        leftPercent: 0,
        widthPercent: 100,
      }));
      const sortedEvents = dayEvents
        .filter((event) => !enFond.includes(event))
        .sort((left, right) => {
          if (left.top === right.top) return left.bottom - right.bottom;
          return left.top - right.top;
        });

      const clusters = [];
      sortedEvents.forEach((event) => {
        const currentCluster = clusters[clusters.length - 1];
        if (currentCluster && event.top < currentCluster.end) {
          currentCluster.end = Math.max(currentCluster.end, event.bottom);
          currentCluster.events.push(event);
        } else {
          clusters.push({ end: event.bottom, events: [event], start: event.top });
        }
      });

      return [...fond, ...clusters.flatMap((cluster) => {
        const columns = [];
        const laidOutEvents = [];

        cluster.events.forEach((event) => {
          let columnIndex = columns.findIndex((column) => (column[column.length - 1]?.bottom || 0) <= event.top);
          if (columnIndex === -1) {
            columnIndex = columns.length;
            columns.push([]);
          }

          const nextEvent = { ...event, colIndex: columnIndex };
          columns[columnIndex].push(nextEvent);
          laidOutEvents.push(nextEvent);
        });

        const hiddenEvents = laidOutEvents.filter((event) => event.colIndex >= overflowLimit);
        const visibleEvents = laidOutEvents.filter((event) => event.colIndex < overflowLimit);
        const columnsToRender = hiddenEvents.length > 0 ? overflowLimit + 1 : Math.max(columns.length, 1);

        // T9 (C29_2) : trop etroit pour les poser cote a cote — UNE carte pour la grappe.
        if (tropEtroit(columnsToRender)) {
          return [{
            dayDate: weekDays[dayIndex],
            dayIndex,
            displayType: 'grappe',
            events: cluster.events,
            height: Math.max(cluster.end - cluster.start, minEventHeight),
            key: `grappe-${getDayKey(weekDays[dayIndex])}-${Math.round(cluster.start)}`,
            leftPercent: 0,
            top: cluster.start,
            widthPercent: 100,
          }];
        }

        const visibleLayout = visibleEvents.map((event) => ({
          ...event,
          displayType: 'event',
          height: event.bottom - event.top,
          leftPercent: event.colIndex * (100 / columnsToRender),
          widthPercent: 100 / columnsToRender,
        }));

        if (!hiddenEvents.length) {
          return visibleLayout;
        }

        return [
          ...visibleLayout,
          {
            count: hiddenEvents.length,
            dayDate: weekDays[dayIndex],
            dayIndex,
            displayType: 'overflow',
            height: Math.max(cluster.end - cluster.start, minEventHeight),
            key: `overflow-${getDayKey(weekDays[dayIndex])}-${Math.round(cluster.start)}`,
            leftPercent: overflowLimit * (100 / columnsToRender),
            top: cluster.start,
            widthPercent: 100 / columnsToRender,
          },
        ];
      })];
    });
  }, [
    Colors.primary500, activeHours, collapsedHeight, colonnesDePlateaux, hourHeight, hourPositions,
    largeurGrille, laneOf, minEventHeight, mode, timedEvents, totalHeight, weekDays,
  ]);

  const untimedByDay = useMemo(() => weekDays.map((day) => (
    untimedEvents.filter((event) => {
      const eventDate = getPlanningItemDate(event);
      return eventDate ? isSameDay(eventDate, day) : false;
    })
  )), [untimedEvents, weekDays]);

  const dayEventCounts = useMemo(() => {
    const counts = new Map();
    weekDays.forEach((day) => counts.set(getDayKey(day), 0));

    weekEvents.forEach((event) => {
      // COLL-C4B-BIS : la plage fermee n est pas une seance.
      if (event?.raw?.closureBand) return;
      const eventDate = getPlanningItemDate(event);
      if (!eventDate) return;
      const key = getDayKey(eventDate);
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    return counts;
  }, [weekDays, weekEvents]);
  const pendingEventDayKeys = useMemo(() => new Set(
    weekEvents
      .filter((event) => isPlanningPendingParticipation(event))
      .map((event) => {
        const eventDate = getPlanningItemDate(event);
        return eventDate ? getDayKey(eventDate) : null;
      })
      .filter(Boolean),
  ), [weekEvents]);

  const dateRangeText = useMemo(() => {
    const start = format(weekDays[0], 'd MMM', { locale: fr });
    const end = format(weekDays[weekDays.length - 1], 'd MMM yyyy', { locale: fr });
    return `${start} - ${end}`;
  }, [weekDays]);

  // Periode vide : le resume n'est pas rendu (voir summarySection), l'etat vide
  // porte seul le message. Ce libelle ne concerne donc que les periodes remplies.
  const summaryText = useMemo(() => t('planningWeekTimelineViewV2.summary', {
    count: weekEvents.length,
    daysCount: weekDays.length,
    defaultValue_one: '{{count}} événement sur {{daysCount}} jours',
    defaultValue_other: '{{count}} événements sur {{daysCount}} jours',
  }), [t, weekDays.length, weekEvents.length]);

  const nowLine = useMemo(() => {
    if (!timedEvents.length) return null;

    const todayIndex = weekDays.findIndex((day) => isSameDay(day, nowReference));
    if (todayIndex === -1) return null;

    const now = nowReference;
    const hour = now.getHours();
    const minute = now.getMinutes();
    const base = hourPositions[hour];
    if (base === undefined) return null;

    return {
      dayIndex: todayIndex,
      top: base + (activeHours.has(hour) ? (minute / 60) * hourHeight : (minute / 60) * collapsedHeight),
    };
  }, [activeHours, collapsedHeight, hourHeight, hourPositions, nowReference, timedEvents.length, weekDays]);

  const handleDateUpdate = (nextDate) => {
    if (onDateChange) {
      onDateChange(nextDate);
      return;
    }

    setInternalDate(nextDate);
  };

  const pageDays = PAGE_DAYS_BY_MODE[mode] || 3;
  const handlePrevPage = () => handleDateUpdate(subDays(currentDate, pageDays));
  const handleNextPage = () => handleDateUpdate(addDays(currentDate, pageDays));
  const handleOverflowPress = (date) => {
    handleDateUpdate(date);
    onSummaryPress?.();
  };

  const renderOverflowCard = (event, left, width) => (
    <TouchableOpacity
      key={event.key}
      onPress={() => handleOverflowPress(event.dayDate)}
      style={[styles.overflowCard, {
        borderColor: 'rgba(255,255,255,0.12)',
        height: Math.max(event.height - 2, minEventHeight),
        left: `${left}%`,
        top: event.top + 1,
        width: `${width}%`,
      }]}
    >
      <Text style={[Fonts.p3Bold, { color: Colors.neutral00, fontSize: mode === 'week' ? 10 : 11 }]}>
        +
        {event.count}
      </Text>
      <Text style={[Fonts.p3, { color: Colors.neutral300, fontSize: 9, textAlign: 'center' }]}>
        {t('planningWeekTimelineViewV2.more', 'plus')}
      </Text>
    </TouchableOpacity>
  );

  // COLL-FIX-PLANNING (T9_C29_2) — des seances qui se chevauchent dans une colonne trop etroite :
  // UNE carte, la pastille de chaque club et « 2 séances » ; l appui ouvre ce jour (comme « +n »).
  const renderGrappeCard = (
    /** @type {any} */ event,
    /** @type {number} */ left,
    /** @type {number} */ width,
  ) => {
    const seances = event.events.filter((/** @type {any} */ e) => !e.raw?.closureBand);
    const nombre = seances.length || event.events.length;
    const mot = t('planningWeekTimelineViewV2.grappe', {
      count: nombre,
      defaultValue_one: 'séance',
      defaultValue_other: 'séances',
    });
    const aDeplacer = event.events.some((/** @type {any} */ e) => e.raw?.closure);
    return (
      <TouchableOpacity
        accessibilityLabel={[`${nombre} ${mot}`, ...seances.map((/** @type {any} */ e) => (
          [e.title, getPlanningTimeLabel(e)].filter(Boolean).join(', ')
        ))].join(' ; ')}
        accessibilityRole="button"
        key={event.key}
        onPress={() => handleOverflowPress(event.dayDate)}
        style={[styles.overflowCard, {
          borderColor: aDeplacer ? pendingAccentColor : 'rgba(255,255,255,0.18)',
          height: Math.max(event.height - 2, minEventHeight),
          left: `${left}%`,
          top: event.top + 1,
          width: `${width}%`,
        }]}
        testID="planning-grappe"
      >
        <View style={styles.grappeDots}>
          {seances.map((/** @type {any} */ e) => (
            <View
              key={`${e.documentId || e.title}-${e.top}`}
              style={[styles.grappeDot, { backgroundColor: e.color || Colors.primary500 }]}
            />
          ))}
        </View>
        <Text style={[Fonts.p3Bold, { color: Colors.neutral00, fontSize: 12 }]}>{nombre}</Text>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          numberOfLines={1}
          style={[Fonts.p3, { color: Colors.neutral200, fontSize: 9 }]}
        >
          {mot}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderTimedEventCard = (event, left, width) => {
    // COLL-C4B (02/10, design P4v3-fermer ecran 4) — une plage FERMEE ou BLOQUEE par la Ville :
    // orange (attention), avec ce qu elle dit ; la mairie la touche (lecture seule ailleurs). Elle
    // n est jamais une seance : ni club, ni equipe.
    // COLL-C4B-BIS (03/10) : de VRAIES hachures (`.ferme-bande` : rayures a 135 degres) et un bord
    // PLEIN, comme la planche — plus des pointilles sur un fond uni.
    if (event?.raw?.closureBand) {
      return (
        <EventBlock
          accessibilityLabel={[event.title, getPlanningTimeLabel(event)].filter(Boolean).join(', ')}
          event={event}
          key={event.id || `fermeture-${event.dayIndex}-${event.top}`}
          onReadOnlyEventPress={onReadOnlyEventPress}
          style={[styles.eventCard, {
            backgroundColor: 'transparent',
            borderColor: hexToRgba(pendingAccentColor, 0.55),
            borderStyle: 'solid',
            borderWidth: 1,
            height: event.height - 2,
            left: `${left}%`,
            paddingHorizontal: mode === 'week' ? 3 : 6,
            paddingVertical: 4,
            top: event.top + 1,
            width: `${width}%`,
          }]}
        >
          <Hachures color={pendingAccentColor} />
          <Text
            numberOfLines={4}
            style={[
              Fonts.p3Bold,
              {
                color: Colors.warning400 || pendingAccentColor,
                fontSize: mode === 'week' ? 9 : 11,
              },
            ]}
          >
            {event.title}
          </Text>
        </EventBlock>
      );
    }
    // COLL-C4B — une seance que la fermeture touche GARDE sa place (D16), cernee d orange.
    const aDeplacer = Boolean(event?.raw?.closure);
    const color = event.color || Colors.primary500;
    const isPendingParticipation = isPlanningPendingParticipation(event);
    const cardAccentColor = isPendingParticipation ? pendingAccentColor : color;
    // COLL-C3B (02/10, design P8v2-demande-ordi) — une place DEMANDEE a la Ville et en attente
    // de sa decision (contrat C2A §7 : origin « request », pending) : pointilles orange.
    const isPendingRequest = event?.raw?.origin === 'request' && event?.raw?.pending === true;
    const isCompact = event.height < 62;
    const isTiny = event.height < 38;
    const cardContent = resolvePlanningCardContent(event, { profile: cardDisplayProfile });
    const {
      compactDateTimeLabel,
      contextLabel,
      isClubFocusedCard,
      isTeamFocusedCard,
      primaryLabel,
      quaternaryMetaLabel,
      secondaryDateTimeLabel,
      tertiaryLocationLabel,
      typeLabel,
    } = cardContent;
    let secondaryLabel = contextLabel;
    if (isTeamFocusedCard) {
      secondaryLabel = isTiny ? compactDateTimeLabel : secondaryDateTimeLabel;
    }
    let tertiaryLabel = null;
    if (isTeamFocusedCard) {
      tertiaryLabel = tertiaryLocationLabel;
    } else if (
      tertiaryLocationLabel
      && tertiaryLocationLabel !== contextLabel
      && tertiaryLocationLabel !== primaryLabel
    ) {
      tertiaryLabel = tertiaryLocationLabel;
    }

    const metaLabel = quaternaryMetaLabel;
    const showPrimaryAsType = !isTeamFocusedCard && Boolean(typeLabel);
    // PLANNING-PORTRAIT : sur un bloc d'installation, l'equipe reste lisible des qu'il y
    // a deux lignes de place (« AS Montrivage » / « U15 »).
    let canShowSecondary = !isCompact && Boolean(secondaryLabel);
    if (isTeamFocusedCard) canShowSecondary = Boolean(secondaryLabel);
    if (isClubFocusedCard) canShowSecondary = !isTiny && Boolean(secondaryLabel);
    const canShowTertiary = isTeamFocusedCard
      ? !isTiny && Boolean(tertiaryLabel)
      : !isCompact && Boolean(tertiaryLabel);
    const canShowMeta = !isCompact && Boolean(metaLabel);

    let primaryFontSize = 10;
    if (mode === 'week') {
      if (isTeamFocusedCard) {
        primaryFontSize = isTiny ? 9 : 10;
      } else {
        primaryFontSize = isTiny ? 8 : 9;
      }
    } else if (isTiny) {
      primaryFontSize = 9;
    }

    let secondaryFontSize = mode === 'week' ? 10 : 11;
    if (isTeamFocusedCard) {
      secondaryFontSize = mode === 'week' ? 8 : 9;
    }
    let primaryMinimumFontScale = 0.8;
    let primaryPaddingHorizontal = mode === 'week' ? 4 : 6;
    if (showPrimaryAsType) {
      primaryMinimumFontScale = mode === 'week' ? 0.52 : 0.58;
      primaryPaddingHorizontal = mode === 'week' ? 3 : 4;
    } else if (isTeamFocusedCard) {
      primaryMinimumFontScale = mode === 'week' ? 0.72 : 0.78;
    }

    // Le lecteur d'ecran entend le bloc entier, meme quand une ligne ne tient pas.
    const blockAccessibilityLabel = isClubFocusedCard
      ? [[primaryLabel, contextLabel].filter(Boolean).join(' · '), getPlanningTimeLabel(event)]
        .filter(Boolean).join(', ')
      : undefined;

    return (
      <EventBlock
        accessibilityLabel={blockAccessibilityLabel}
        event={event}
        key={event.documentId || `${event.dayIndex}-${event.top}`}
        onEventPress={onEventPress}
        onReadOnlyEventPress={onReadOnlyEventPress}
        style={[styles.eventCard, {
          backgroundColor: hexToRgba(cardAccentColor, isTiny ? 0.22 : 0.18),
          borderColor: hexToRgba(cardAccentColor, isTiny ? 0.42 : 0.34),
          borderLeftColor: cardAccentColor,
          borderLeftWidth: mode === 'week' ? 2 : 3,
          // COLL-C4B-BIS (03/10) : Android ne trace des pointilles que si les QUATRE bords ont la
          // meme epaisseur et la meme couleur ; sinon, un trait plein (photo T10_C25_5).
          ...(isPendingRequest || aDeplacer ? {
            borderColor: pendingAccentColor,
            borderLeftColor: pendingAccentColor,
            borderLeftWidth: aDeplacer ? 2 : 1,
            borderStyle: 'dashed',
            borderWidth: aDeplacer ? 2 : 1,
          } : {}),
          height: event.height - 2,
          justifyContent: isTiny ? 'center' : 'flex-start',
          left: `${left}%`,
          paddingHorizontal: primaryPaddingHorizontal,
          paddingVertical: mode === 'week' ? 4 : 6,
          top: event.top + 1,
          width: `${width}%`,
        }]}
      >
        {isPendingParticipation ? (
          <View style={[styles.pendingCornerDot, { backgroundColor: pendingAccentColor }]} />
        ) : null}
        {isPendingParticipation ? (
          <View style={[styles.pendingEventBadge, { backgroundColor: hexToRgba(pendingAccentColor, 0.18), borderColor: hexToRgba(pendingAccentColor, 0.38) }]}>
            <Text style={[styles.pendingEventBadgeText, { color: pendingAccentColor }]}>
              {isTiny
                ? t('planningWeekTimelineViewV2.pendingShort', 'Attente')
                : t('planningWeekTimelineViewV2.pending', 'En attente')}
            </Text>
          </View>
        ) : null}
        <Text
          adjustsFontSizeToFit
          minimumFontScale={primaryMinimumFontScale}
          numberOfLines={1}
          style={[Fonts.p3Bold, {
            color: showPrimaryAsType ? color : Colors.neutral00,
            // PLANNING-PORTRAIT (constat T7, capture D1) : seule ligne autorisee a
            // retrecir, elle tombait a ZERO de hauteur des que le bloc debordait (blocs
            // d'1 h 30) — on lisait l'equipe sans le club. La premiere ligne garde sa
            // place ; ce sont les dernieres que le bloc coupe (`overflow: hidden`).
            flexShrink: 0,
            fontSize: primaryFontSize,
            letterSpacing: showPrimaryAsType ? 0.35 : 0,
            lineHeight: primaryFontSize + 2,
            marginBottom: canShowSecondary ? 2 : 0,
          }]}
        >
          {primaryLabel}
        </Text>
        {canShowSecondary ? (
          <Text
            numberOfLines={1}
            style={[isTeamFocusedCard ? Fonts.p3 : Fonts.p3Bold, {
              color: Colors.neutral00,
              fontSize: secondaryFontSize,
              lineHeight: mode === 'week' ? secondaryFontSize + 2 : secondaryFontSize + 2,
              marginTop: 2,
            }]}
          >
            {secondaryLabel}
          </Text>
        ) : null}
        {/* COLL-C4B-BIS : « a deplacer » sous le club et l equipe, comme la planche (ecran 4). */}
        {aDeplacer && !isTiny ? (
          <Text
            numberOfLines={1}
            style={[
              Fonts.p3Bold,
              { color: pendingAccentColor, fontSize: mode === 'week' ? 8 : 10 },
            ]}
            testID="a-deplacer"
          >
            {t('collectiviteFermetures.planning.aDeplacer', 'à déplacer')}
          </Text>
        ) : null}
        {canShowTertiary ? (
          <Text
            numberOfLines={1}
            style={[isTeamFocusedCard ? Fonts.p3 : Fonts.p3Bold, {
              color: isTeamFocusedCard ? Colors.neutral200 : color,
              fontSize: 9,
              marginTop: 2,
            }]}
          >
            {tertiaryLabel}
          </Text>
        ) : null}
        {!isTiny && !isTeamFocusedCard && getPlanningTimeLabel(event) ? (
          <Text numberOfLines={1} style={[Fonts.p3, { color: Colors.neutral300, fontSize: 9, marginTop: 2 }]}>
            {getPlanningTimeLabel(event)}
          </Text>
        ) : null}
        {canShowMeta ? (
          <Text numberOfLines={1} style={[Fonts.p3, { color: Colors.neutral300, fontSize: 8, marginTop: 2 }]}>
            {metaLabel}
          </Text>
        ) : null}
        {event.leagueMatch || event.league_match ? (
          <View style={[styles.leagueDot, { backgroundColor: Colors.gold500 || '#D4AF37' }]} />
        ) : null}
      </EventBlock>
    );
  };

  const flingLeft = Gesture.Fling().direction(Directions.LEFT).onEnd(() => {
    'worklet';

    runOnJS(handleNextPage)();
  });

  const flingRight = Gesture.Fling().direction(Directions.RIGHT).onEnd(() => {
    'worklet';

    runOnJS(handlePrevPage)();
  });

  const emptyTitle = weekEvents.length === 0
    ? t('planningWeekTimelineViewV2.noEventInThisPeriod', 'Aucun événement sur cette période')
    : t('planningWeekTimelineViewV2.noEventWithATime', 'Aucun événement avec horaire');
  const emptyDescription = weekEvents.length === 0
    // « ton A » (01/10) : la grille sert la mairie ET les clubs, ni « tu » ni « vous ».
    ? t('planningWeekTimelineViewV2.changeThePeriodToSee', 'Les flèches mènent aux autres dates.')
    : t(
      'planningWeekTimelineViewV2.thisPeriodSEventsAre',
      'Les événements de cette période sont uniquement dans la section « Sans horaire ».',
    );

  const summarySection = (() => {
    if (compactFullscreen) return null;

    // Periode vide : l'etat vide plus bas dit deja « Aucun evenement sur cette
    // periode » et donne la marche a suivre. On ne double pas le message.
    if (weekEvents.length === 0) return null;

    if (onSummaryPress) {
      return (
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={onSummaryPress}
          style={styles.summaryRow}
        >
          <View style={[styles.summaryDot, { backgroundColor: Colors.primary500 }]} />
          <Text style={[Fonts.p3, styles.summaryText, { color: Colors.neutral00 }]}>{summaryText}</Text>
          <Image resizeMode="contain" source={Images.arrowRight} style={styles.summaryArrow} />
        </TouchableOpacity>
      );
    }

    return (
      <View style={styles.summaryRow}>
        <View style={[styles.summaryDot, { backgroundColor: Colors.primary500 }]} />
        <Text style={[Fonts.p3, styles.summaryText, { color: Colors.neutral00 }]}>{summaryText}</Text>
      </View>
    );
  })();
  const untimedSection = showUntimedSection && untimedEvents.length > 0 ? (
    <View style={[styles.untimedSection, compactFullscreen ? styles.compactUntimedSection : null, { borderBottomColor: 'rgba(255,255,255,0.10)' }]}>
      <View style={[styles.untimedLabelColumn, { width: timeColumnWidth }]}>
        <Text style={[Fonts.p3Bold, styles.untimedLabel, { color: Colors.neutral200 }]}>
          {t('planningWeekTimelineViewV2.noTime', 'Sans horaire')}
        </Text>
      </View>
      <View style={styles.untimedColumns}>
        {untimedByDay.map((dayEvents, index) => (
          <View key={getDayKey(weekDays[index])} style={styles.untimedDayColumn}>
            {dayEvents.slice(0, 2).map((event) => {
              const color = getEventColor(event, Colors.primary500);
              const cardContent = resolvePlanningCardContent(event, { profile: cardDisplayProfile });
              const { isTeamFocusedCard, primaryLabel } = cardContent;
              const contextLabel = isTeamFocusedCard
                ? (cardContent.tertiaryLocationLabel || cardContent.quaternaryMetaLabel || null)
                : cardContent.contextLabel;
              const isPendingParticipation = isPlanningPendingParticipation(event);
              const cardAccentColor = isPendingParticipation ? pendingAccentColor : color;
              const textTransform = isTeamFocusedCard || !getPlanningTypeLabel(event)
                ? 'none'
                : 'uppercase';
              return (
                <EventBlock
                  event={event}
                  key={event.documentId || `${getDayKey(weekDays[index])}-${getPlanningDisplayTitle(event)}`}
                  onEventPress={onEventPress}
                  onReadOnlyEventPress={onReadOnlyEventPress}
                  style={[
                    styles.untimedCard,
                    compactFullscreen ? styles.compactUntimedCard : null,
                    {
                      backgroundColor: hexToRgba(cardAccentColor, 0.18),
                      borderColor: hexToRgba(cardAccentColor, 0.32),
                      borderLeftColor: cardAccentColor,
                    },
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[Fonts.p4Bold, {
                      color: isTeamFocusedCard ? Colors.neutral00 : color,
                      fontSize: 10,
                      letterSpacing: isTeamFocusedCard ? 0 : 0.35,
                      marginBottom: contextLabel ? 2 : 0,
                      textTransform,
                    }]}
                  >
                    {primaryLabel}
                  </Text>
                  {isPendingParticipation ? (
                    <View style={[styles.pendingInlineBadge, { backgroundColor: hexToRgba(pendingAccentColor, 0.18), borderColor: hexToRgba(pendingAccentColor, 0.35) }]}>
                      <Text style={[styles.pendingInlineBadgeText, { color: pendingAccentColor }]}>
                        {t('planningWeekTimelineViewV2.pending', 'En attente')}
                      </Text>
                    </View>
                  ) : null}
                  {contextLabel ? (
                    <Text numberOfLines={2} style={[Fonts.p3Bold, styles.untimedCardText, { color: Colors.neutral00 }]}>
                      {contextLabel}
                    </Text>
                  ) : null}
                </EventBlock>
              );
            })}
            {dayEvents.length > 2 ? (
              <TouchableOpacity onPress={() => handleOverflowPress(weekDays[index])} style={styles.untimedMoreButton}>
                <Text style={[Fonts.p3Bold, { color: Colors.primary500, fontSize: 11 }]}>
                  +
                  {dayEvents.length - 2}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  ) : null;

  // COLL-C2B (02/10, design P5v2-vues) : la mairie touche une heure libre ⇒ « Attribuer pour
  // la saison ». Les cases sont rendues AVANT les blocs : un bloc garde son propre geste.
  // COLL-C2B-BIS (03/10, planches 24 et 29) : en colonnes de plateaux, UNE case par plateau, dans
  // sa colonne ; la toucher dit la colonne, et « Attribuer » s ouvre avec ce plateau.
  const colonnesDesCases = colonnesDePlateaux || [null];
  const largeurDUneCase = 100 / (weekDays.length * colonnesDesCases.length);
  // COLL-C4B-BIS (03/10, tournee T10 : « un jour ferme dit 1 place libre ») : sous une plage
  // fermee ou bloquee, aucune heure n est libre — ni au doigt, ni au lecteur d ecran.
  const plagesFermeesParJour = new Map();
  timedEvents.forEach((/** @type {any} */ event) => {
    const fermeture = event?.raw?.closureBand;
    const date = getPlanningItemDate(event);
    if (!fermeture || !date) return;
    const temps = extractTime(event);
    const plage = fermeture.kind === 'block' && temps
      ? {
        end: temps.endHour * 60 + temps.endMinute,
        start: temps.startHour * 60 + temps.startMinute,
      }
      : { end: 24 * 60, start: 0 };
    const cle = getDayKey(date);
    plagesFermeesParJour.set(cle, [...(plagesFermeesParJour.get(cle) || []), plage]);
  });
  const estFermee = (
    /** @type {Date} */ jour,
    /** @type {number} */ debut,
    /** @type {number} */ fin,
  ) => (
    (plagesFermeesParJour.get(getDayKey(jour)) || [])
      .some((/** @type {any} */ plage) => plage.start < fin && debut < plage.end)
  );
  const cellulesLibres = onFreeSlotPress ? timelineBlocks.flatMap((block) => {
    const heure = block.type === 'hour' ? block.value : block.start;
    const hauteur = block.type === 'hour' ? hourHeight : collapsedHeight;
    const heureLue = `${String(heure).padStart(2, '0')}:00`;
    const finDeLaCase = (block.type === 'hour' ? block.value + 1 : block.end + 1) * 60;
    const joursOuverts = weekDays
      .map((day, dayIndex) => ({ day, dayIndex }))
      .filter(({ day }) => !estFermee(day, heure * 60, finDeLaCase));
    return joursOuverts.flatMap(({ day, dayIndex }) => colonnesDesCases.map((
      colonne,
      colonneIndex,
    ) => (
      <TouchableOpacity
        accessibilityLabel={colonne
          ? t(
            'collectiviteCreneaux.vues.heureLibrePlateau',
            'Heure libre, {{plateau}}, {{jour}} {{heure}} : attribuer',
            {
              heure: heureLue,
              jour: format(day, 'EEEE d MMMM', { locale: fr }),
              plateau: colonne.label,
              ...SANS_ECHAPPEMENT,
            },
          )
          : t(
            'collectiviteCreneaux.vues.heureLibre',
            'Heure libre, {{jour}} {{heure}} : attribuer',
            {
              heure: heureLue,
              jour: format(day, 'EEEE d MMMM', { locale: fr }),
              ...SANS_ECHAPPEMENT,
            },
          )}
        accessibilityRole="button"
        key={`libre-${getDayKey(day)}-${heure}${colonne ? `-${colonne.key}` : ''}`}
        onPress={() => (colonne
          ? onFreeSlotPress(day, heure, colonneIndex)
          : onFreeSlotPress(day, heure))}
        style={{
          height: hauteur,
          left: `${((dayIndex * colonnesDesCases.length) + colonneIndex) * largeurDUneCase}%`,
          position: 'absolute',
          top: /** @type {Record<number, number>} */ (hourPositions)[heure] ?? 0,
          width: `${largeurDUneCase}%`,
        }}
        testID={`heure-libre-${getDayKey(day)}-${heure}${colonne ? `-${colonne.key}` : ''}`}
      />
    )));
  }) : null;
  // COLL-C2B (D66) : le nom de chaque plateau, en tete de sa colonne (mode « jour »).
  const tetesDePlateaux = colonnesDePlateaux ? (
    <View style={{ flexDirection: 'row', marginBottom: 4 }}>
      <View style={{ width: timeColumnWidth }} />
      {colonnesDePlateaux.map((colonne) => (
        <Text
          key={colonne.key}
          numberOfLines={1}
          style={[Fonts.p3Bold, { color: Colors.neutral200, flex: 1, textAlign: 'center' }]}
        >
          {colonne.label}
        </Text>
      ))}
    </View>
  ) : null;

  const timelineBody = (
    <View style={styles.container}>
      {showHeader ? (
        <View style={[styles.headerSpacing, compactFullscreen ? styles.compactHeaderSpacing : null]}>
          <View
            style={[
              styles.headerCard,
              compactFullscreen ? styles.compactHeaderCard : null,
              { backgroundColor: Colors.primary700, borderColor: `${Colors.primary500}33` },
            ]}
          >
            <TouchableOpacity hitSlop={styles.hitSlop} onPress={handlePrevPage}>
              <Image
                resizeMode="contain"
                source={Images.arrowLeft}
                style={[
                  styles.headerArrow,
                  compactFullscreen ? styles.compactHeaderArrow : null,
                  { tintColor: Colors.primary500 },
                ]}
              />
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              {!compactFullscreen ? (
                <Text style={[styles.headerTitle, { color: Colors.primary200 }]}>
                  Planning
                </Text>
              ) : null}
              <Text style={[Fonts.p1Bold, compactFullscreen ? styles.compactHeaderDate : null, { color: Colors.neutral00 }]}>
                {dateRangeText}
              </Text>
            </View>

            <TouchableOpacity hitSlop={styles.hitSlop} onPress={handleNextPage}>
              <Image
                resizeMode="contain"
                source={Images.arrowRight}
                style={[
                  styles.headerArrow,
                  compactFullscreen ? styles.compactHeaderArrow : null,
                  { tintColor: Colors.primary500 },
                ]}
              />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <View
        style={[
          styles.panel,
          compactFullscreen ? styles.compactPanel : null,
          { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.10)' },
        ]}
      >
        {summarySection}

        <View style={[styles.daysRow, compactFullscreen ? styles.compactDaysRow : null, { borderBottomColor: 'rgba(255,255,255,0.12)' }]}>
          <View style={{ width: timeColumnWidth }} />
          {weekDays.map((day) => {
            const dayKey = getDayKey(day);
            const isTodayColumn = isSameDay(day, nowReference);
            const eventCount = dayEventCounts.get(dayKey) || 0;
            const hasPendingEvent = pendingEventDayKeys.has(dayKey);
            let badgeBackground = 'transparent';

            if (isTodayColumn) {
              badgeBackground = Colors.primary500;
            } else if (eventCount > 0) {
              badgeBackground = Colors.neutral800;
            }

            return (
              <View key={dayKey} style={styles.dayColumnHeader}>
                <Text
                  style={[
                    Fonts.p3,
                    styles.dayLabel,
                    compactFullscreen ? styles.compactDayLabel : null,
                    { color: isTodayColumn ? Colors.primary500 : Colors.neutral300, fontWeight: isTodayColumn ? '700' : '400' },
                  ]}
                >
                  {format(day, 'EEE', { locale: fr }).replace('.', '')}
                </Text>
                <View style={styles.dayBadgeWrapper}>
                  <View
                    style={[
                      styles.dayBadge,
                      compactFullscreen ? styles.compactDayBadge : null,
                      { backgroundColor: badgeBackground },
                    ]}
                  >
                    <Text style={[Fonts.h3, styles.dayBadgeText, { color: Colors.neutral00 }]}>
                      {format(day, 'd')}
                    </Text>
                    {eventCount > 0 && !isTodayColumn ? (
                      <View
                        style={[
                          styles.dayCountBadge,
                          {
                            backgroundColor: Colors.primary500,
                            borderColor: Colors.neutral700,
                          },
                        ]}
                      >
                        <Text style={styles.dayCountText}>{eventCount}</Text>
                      </View>
                    ) : null}
                    {hasPendingEvent ? (
                      <View
                        style={[
                          styles.pendingDayBadge,
                          { backgroundColor: pendingAccentColor },
                        ]}
                      >
                        <Text style={styles.pendingDayBadgeText}>!</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {tetesDePlateaux}

        {!compactFullscreen ? untimedSection : null}

        {(() => {
          if (timedEvents.length === 0) {
            return (
              <View style={styles.emptyState}>
                {/* Android coupait « période » : un titre gras sans largeur */}
                {/* ni centrage ne passe pas à la ligne. */}
                <Text style={[Fonts.p2Bold, styles.emptyTitle, { color: Colors.neutral00 }]}>
                  {emptyTitle}
                </Text>
                <Text style={[Fonts.p3, { color: Colors.neutral300, textAlign: 'center' }]}>{emptyDescription}</Text>
              </View>
            );
          }

          if (expandToContent) {
            return (
              <View style={[styles.scrollContent, compactFullscreen ? styles.compactScrollContent : null]}>
                <View style={styles.timelineRow}>
                  <View style={{ width: timeColumnWidth }}>
                    {timelineBlocks.map((block) => (
                      <View key={block.type === 'hour' ? `hour-${block.value}` : block.id} style={[styles.timeCell, { height: block.type === 'hour' ? hourHeight : collapsedHeight }]}>
                        {block.type === 'hour' ? (
                          <Text style={[Fonts.p3, styles.hourText, { color: Colors.neutral300 }]}>{`${block.value}:00`}</Text>
                        ) : (
                          <Text style={styles.collapsedText}>…</Text>
                        )}
                      </View>
                    ))}
                  </View>

                  <View onLayout={mesurerLaGrille} style={[styles.gridContainer, { borderRightColor: 'rgba(255,255,255,0.10)', borderTopColor: 'rgba(255,255,255,0.10)' }]} testID="planning-grille">
                    <View style={[StyleSheet.absoluteFillObject, styles.dayBackgroundRow]}>
                      {weekDays.map((day) => (
                        <View
                          key={`bg-${getDayKey(day)}`}
                          style={[styles.dayBackgroundColumn, {
                            backgroundColor: isSameDay(day, nowReference) ? hexToRgba(Colors.primary500, 0.05) : 'transparent',
                            borderLeftColor: 'rgba(255,255,255,0.10)',
                          }]}
                        />
                      ))}
                    </View>

                    {timelineBlocks.map((block) => (
                      <View
                        key={`grid-${block.type === 'hour' ? block.value : block.id}`}
                        style={[styles.gridLine, {
                          backgroundColor: block.type === 'collapsed' ? 'rgba(255,255,255,0.05)' : 'transparent',
                          borderBottomColor: 'rgba(255,255,255,0.10)',
                          height: block.type === 'hour' ? hourHeight : collapsedHeight,
                        }]}
                      />
                    ))}

                    {cellulesLibres}

                    {nowLine ? (
                      <View style={[styles.nowLineContainer, { left: `${(nowLine.dayIndex * 100) / weekDays.length}%`, top: nowLine.top, width: `${100 / weekDays.length}%` }]}>
                        <View style={styles.nowLineTrack}>
                          <View style={[styles.nowDot, { backgroundColor: Colors.primary500 }]} />
                          <View style={[styles.nowLine, { backgroundColor: Colors.primary500 }]} />
                        </View>
                      </View>
                    ) : null}

                    {layoutEvents.map((event) => {
                      const dayWidth = 100 / weekDays.length;
                      const left = (event.dayIndex * dayWidth) + ((event.leftPercent || 0) * (dayWidth / 100));
                      const width = (event.widthPercent || 100) * (dayWidth / 100);

                      if (event.displayType === 'overflow') {
                        return renderOverflowCard(event, left, width);
                      }
                      if (event.displayType === 'grappe') {
                        return renderGrappeCard(event, left, width);
                      }

                      return renderTimedEventCard(event, left, width);
                    })}
                  </View>
                </View>
              </View>
            );
          }

          return (
            <ScrollView
              contentContainerStyle={[styles.scrollContent, compactFullscreen ? styles.compactScrollContent : null]}
              nestedScrollEnabled={scrollEnabled}
              ref={scrollViewRef}
              scrollEnabled={scrollEnabled}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.timelineRow}>
                <View style={{ width: timeColumnWidth }}>
                  {timelineBlocks.map((block) => (
                    <View key={block.type === 'hour' ? `hour-${block.value}` : block.id} style={[styles.timeCell, { height: block.type === 'hour' ? hourHeight : collapsedHeight }]}>
                      {block.type === 'hour' ? (
                        <Text style={[Fonts.p3, styles.hourText, { color: Colors.neutral300 }]}>{`${block.value}:00`}</Text>
                      ) : (
                        <Text style={styles.collapsedText}>…</Text>
                      )}
                    </View>
                  ))}
                </View>

                <View onLayout={mesurerLaGrille} style={[styles.gridContainer, { borderRightColor: 'rgba(255,255,255,0.10)', borderTopColor: 'rgba(255,255,255,0.10)' }]} testID="planning-grille">
                  <View style={[StyleSheet.absoluteFillObject, styles.dayBackgroundRow]}>
                    {weekDays.map((day) => (
                      <View
                        key={`bg-${getDayKey(day)}`}
                        style={[styles.dayBackgroundColumn, {
                          backgroundColor: isSameDay(day, nowReference) ? hexToRgba(Colors.primary500, 0.05) : 'transparent',
                          borderLeftColor: 'rgba(255,255,255,0.10)',
                        }]}
                      />
                    ))}
                  </View>

                  {timelineBlocks.map((block) => (
                    <View
                      key={`grid-${block.type === 'hour' ? block.value : block.id}`}
                      style={[styles.gridLine, {
                        backgroundColor: block.type === 'collapsed' ? 'rgba(255,255,255,0.05)' : 'transparent',
                        borderBottomColor: 'rgba(255,255,255,0.10)',
                        height: block.type === 'hour' ? hourHeight : collapsedHeight,
                      }]}
                    />
                  ))}

                  {cellulesLibres}

                  {nowLine ? (
                    <View style={[styles.nowLineContainer, { left: `${(nowLine.dayIndex * 100) / weekDays.length}%`, top: nowLine.top, width: `${100 / weekDays.length}%` }]}>
                      <View style={styles.nowLineTrack}>
                        <View style={[styles.nowDot, { backgroundColor: Colors.primary500 }]} />
                        <View style={[styles.nowLine, { backgroundColor: Colors.primary500 }]} />
                      </View>
                    </View>
                  ) : null}

                  {layoutEvents.map((event) => {
                    const dayWidth = 100 / weekDays.length;
                    const left = (event.dayIndex * dayWidth) + ((event.leftPercent || 0) * (dayWidth / 100));
                    const width = (event.widthPercent || 100) * (dayWidth / 100);

                    if (event.displayType === 'overflow') {
                      return renderOverflowCard(event, left, width);
                    }
                    if (event.displayType === 'grappe') {
                      return renderGrappeCard(event, left, width);
                    }

                    return renderTimedEventCard(event, left, width);
                  })}
                </View>
              </View>
            </ScrollView>
          );
        })()}
        {compactFullscreen ? untimedSection : null}
      </View>
    </View>
  );

  if (Platform.OS === 'web') {
    return timelineBody;
  }

  return (
    <GestureDetector gesture={Gesture.Simultaneous(flingLeft, flingRight)}>
      {timelineBody}
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  collapsedText: { color: '#6E7C84', fontSize: 10 },
  compactDayBadge: { height: 24, minWidth: 24, width: 24 },
  compactDayLabel: { fontSize: 8, marginBottom: 1 },
  compactDaysRow: { marginBottom: 2, paddingBottom: 3 },
  compactHeaderArrow: { height: 14, width: 14 },
  compactHeaderCard: { borderRadius: 16, paddingHorizontal: 8, paddingVertical: 3 },
  compactHeaderDate: { fontSize: 12 },
  compactHeaderSpacing: { paddingBottom: 2, paddingTop: 1 },
  compactPanel: { borderRadius: 14, paddingHorizontal: 2 },
  compactScrollContent: { paddingBottom: 8, paddingTop: 0 },
  compactUntimedCard: { marginBottom: 4, paddingHorizontal: 6, paddingVertical: 4 },
  compactUntimedSection: { marginTop: 6, paddingBottom: 4, paddingTop: 4 },
  container: { backgroundColor: 'transparent', flex: 1 },
  dayBackgroundColumn: { borderLeftWidth: 1, flex: 1 },
  dayBackgroundRow: { flexDirection: 'row' },
  dayBadge: {
    alignItems: 'center', borderRadius: 999, height: 32, justifyContent: 'center', minWidth: 32, position: 'relative', width: 32,
  },
  dayBadgeText: { fontSize: 14, fontWeight: '700' },
  dayBadgeWrapper: { alignItems: 'center', justifyContent: 'center', minHeight: 32 },
  dayColumnHeader: { alignItems: 'center', flex: 1 },
  dayCountBadge: {
    alignItems: 'center', borderRadius: 6, borderWidth: 1, height: 14, justifyContent: 'center', position: 'absolute', right: -4, top: -4, width: 14,
  },
  dayCountText: { color: '#FFFFFF', fontSize: 8, fontWeight: '700' },
  dayLabel: { fontSize: 11, marginBottom: 6, textTransform: 'uppercase' },
  daysRow: {
    alignItems: 'flex-end', borderBottomWidth: 1, flexDirection: 'row', marginBottom: 8, paddingBottom: 8,
  },
  emptyState: { alignItems: 'center', paddingHorizontal: 16, paddingVertical: 28 },
  emptyTitle: { alignSelf: 'stretch', marginBottom: 6, textAlign: 'center' },
  eventCard: {
    borderRadius: 8, borderWidth: 1, overflow: 'hidden', position: 'absolute',
  },
  grappeDot: { borderRadius: 999, height: 6, width: 6 },
  grappeDots: { flexDirection: 'row', gap: 3, marginBottom: 2 },
  gridContainer: {
    borderRightWidth: 1, borderTopWidth: 1, flex: 1, position: 'relative',
  },
  gridLine: { borderBottomWidth: 1 },
  headerArrow: { height: 18, width: 18 },
  headerCard: {
    alignItems: 'center', borderRadius: 22, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8,
  },
  headerCenter: { alignItems: 'center' },
  headerSpacing: { paddingBottom: 12, paddingTop: 8 },
  headerTitle: {
    fontSize: 13, fontWeight: '700', letterSpacing: 1, marginBottom: 2, textTransform: 'uppercase',
  },
  hitSlop: {
    bottom: 10, left: 10, right: 10, top: 10,
  },
  hourText: { fontSize: 11, fontWeight: '700', marginTop: -8 },
  leagueDot: {
    borderColor: 'rgba(0,18,24,0.8)', borderRadius: 999, borderWidth: 1, height: 10, position: 'absolute', right: 3, top: 3, width: 10,
  },
  nowDot: {
    borderRadius: 999, height: 8, marginRight: 4, width: 8,
  },
  nowLine: { flex: 1, height: 2 },
  nowLineContainer: { position: 'absolute' },
  nowLineTrack: { alignItems: 'center', flexDirection: 'row', paddingHorizontal: 2 },
  overflowCard: {
    alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8, borderStyle: 'dashed', borderWidth: 1, justifyContent: 'center', paddingHorizontal: 4, position: 'absolute',
  },
  panel: {
    borderRadius: 18, borderWidth: 1, overflow: 'hidden', paddingHorizontal: 8,
  },
  pendingCornerDot: {
    borderRadius: 999,
    height: 7,
    position: 'absolute',
    right: 4,
    top: 4,
    width: 7,
  },
  pendingDayBadge: {
    alignItems: 'center',
    borderRadius: 999,
    height: 12,
    justifyContent: 'center',
    left: -3,
    position: 'absolute',
    top: -3,
    width: 12,
  },
  pendingDayBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
    lineHeight: 8,
  },
  pendingEventBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pendingEventBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    lineHeight: 10,
  },
  pendingInlineBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pendingInlineBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 11,
  },
  scrollContent: { paddingBottom: 50, paddingTop: 6 },
  summaryArrow: {
    height: 12, marginLeft: 8, tintColor: '#FFFFFF', width: 12,
  },
  summaryDot: {
    borderRadius: 999, height: 6, marginRight: 8, width: 6,
  },
  summaryRow: {
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center', paddingBottom: 6, paddingTop: 8,
  },
  summaryText: { fontWeight: '700' },
  timeCell: { alignItems: 'center', justifyContent: 'flex-start' },
  timelineRow: { flexDirection: 'row' },
  untimedCard: {
    borderLeftWidth: 3, borderRadius: 10, borderWidth: 1, marginBottom: 6, paddingHorizontal: 8, paddingVertical: 6,
  },
  untimedCardText: { fontSize: 11 },
  untimedColumns: { flex: 1, flexDirection: 'row' },
  untimedDayColumn: { flex: 1, paddingHorizontal: 4 },
  untimedLabel: { fontSize: 11 },
  untimedLabelColumn: { justifyContent: 'flex-start', paddingRight: 8 },
  untimedMoreButton: {
    alignItems: 'center', borderColor: 'rgba(1,179,244,0.35)', borderRadius: 10, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 6,
  },
  untimedSection: {
    borderBottomWidth: 1, flexDirection: 'row', marginBottom: 8, paddingBottom: 8, paddingTop: 4,
  },
});

export default memo(PlanningWeekTimelineView);
