import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { isValid, parseISO } from 'date-fns';
import {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Platform,
  Text,
  View,
} from 'react-native';

import { withViewerChildrenTitles } from '@/domains/event/viewerChildren';
import useTheme from '@/theme/themeContext';

import Loader from '@/components/atoms/loader/Loader';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import PlanningFullscreenButton from '@/components/organisms/planning/PlanningFullscreenButton';
import PlanningCalendarView from '@/components/organisms/planningCalendarView';
import PlanningWeekTimelineView from '@/components/organisms/planningWeekTimelineView';

import { RouteNames } from '@/navigation/routeNames';

import { useMesReservationsAuPlanning } from '@/services/complexe/complexeJoueurQueries';
import { getMyPlanning } from '@/services/event/eventService';
import { keepPreviousPageData } from '@/services/queryOptions';

import {
  getPlanningDefaultDate,
  getPlanningRange,
  normalizePlanningItems,
} from '@/utils/planning/planningSlots';

import useVueInitiale from '@/hooks/useVueInitiale';

const PERSONAL_PLANNING_STALE_MS = 60 * 1000;

/**
 * Personal planning content.
 * @param {{
 *   dateVisee?: string,
 *   datesAVenir?: Array<Date | null> | null,
 *   onDataResolved?: () => void, onSummaryPress?: () => void, withChildren?: boolean,
 * }} props - PARENT-PLANNING (06/10, « calendrier B ») : `withChildren` (un compte qui A des
 *   enfants, dit par la liste du planning) demande AUSSI leurs creneaux a venir ; sans elle,
 *   rien ne change. R17-VUE (19/10) : `datesAVenir`, les jours des evenements de la liste du
 *   dessous (null tant qu elle n est pas lue) ; ils disent ou s ouvrir quand 3 jours sont vides.
 *   T3-RESA-PLANNING (03/11) : `dateVisee` (AAAA-MM-JJ), le jour a montrer a l arrivee, celui de
 *   la reservation de « Voir mon planning ».
 * @returns {import('react').ReactElement}
 */
function PersonalPlanningContainer({
  datesAVenir, dateVisee, onDataResolved, onSummaryPress, withChildren = false,
}) {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const {
    Alignments,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const [currentDate, setCurrentDate] = useState(getPlanningDefaultDate());
  const [viewMode, setViewMode] = useState('3days');
  const hasEmittedReadyRef = useRef(false);
  const isWebPlanning = Platform.OS === 'web';

  const planningRange = useMemo(
    () => getPlanningRange(currentDate, viewMode),
    [currentDate, viewMode],
  );
  const {
    creneaux: reservations, joursAVenir, lu: reservationsLues,
  } = useMesReservationsAuPlanning(t, planningRange);
  const datesDeLaListe = useMemo(
    () => (datesAVenir ? [...datesAVenir, ...joursAVenir] : undefined),
    [datesAVenir, joursAVenir],
  );
  const {
    data: eventsData, isError, isLoading, isPlaceholderData,
  } = useQuery({
    placeholderData: keepPreviousPageData,
    queryFn: () => getMyPlanning(
      withChildren ? { ...planningRange, withChildren: true } : planningRange,
    ),
    // La cle d avant reste celle de tous les comptes sans enfant ; un parent a la sienne.
    queryKey: withChildren
      ? ['planning', 'personal', planningRange.from, planningRange.to, 'withChildren']
      : ['planning', 'personal', planningRange.from, planningRange.to],
    staleTime: PERSONAL_PLANNING_STALE_MS,
  });

  // PARENT-PLANNING (06/10) — un ECHEC libere aussi la liste du planning. Sur le site, elle
  // attend ce signal ; le role Parent n a pas le droit de lire ce calendrier (403) : sans
  // cette sortie, sa liste — les evenements de son enfant compris — ne partait jamais.
  useEffect(() => {
    if ((!eventsData && !isError) || hasEmittedReadyRef.current) {
      return;
    }

    hasEmittedReadyRef.current = true;
    onDataResolved?.();
  }, [eventsData, isError, onDataResolved, hasEmittedReadyRef]);

  // 🗓️ R17-VUE (19/10, REC17-010) — a l arrivee, « 3 jours » vides ⇒ la semaine s il y a quelque
  // chose dedans, sinon le mois du prochain evenement (lu dans la liste du dessous, deja demandee
  // par l ecran : aucune lecture de plus). Un choix fait a la main l emporte. Sans liste (prop
  // absente), rien ne change.
  const appliquerLaVue = useCallback((/** @type {{ date: Date, vue: string }} */ decision) => {
    if (decision.vue === '3days') return;
    setViewMode(decision.vue);
    setCurrentDate(decision.date);
  }, []);
  const { enDecision, garderLeChoix } = useVueInitiale({
    actif: !isError && datesAVenir !== undefined,
    appliquer: appliquerLaVue,
    datesDeLaListe,
    evenements: eventsData && !isPlaceholderData && reservationsLues
      ? [...(eventsData.data || []), ...reservations]
      : undefined,
    listeConnue: datesAVenir !== null,
    vueDeBase: '3days',
  });
  const choisirLaVue = useCallback((/** @type {string} */ vue) => {
    garderLeChoix();
    setViewMode(vue);
  }, [garderLeChoix]);
  const choisirLaDate = useCallback((/** @type {Date} */ date) => {
    garderLeChoix();
    setCurrentDate(date);
  }, [garderLeChoix]);

  // T3-RESA-PLANNING (03/11) : « Voir mon planning » ouvre le jour de la reservation, y compris
  // sur un onglet deja monte ; un choix fait a la main ne revient pas en arriere ensuite.
  useEffect(() => {
    const jour = dateVisee ? parseISO(dateVisee) : null;
    if (!jour || !isValid(jour)) return;
    garderLeChoix();
    setCurrentDate(jour);
  }, [dateVisee, garderLeChoix]);

  const viewOptions = useMemo(() => ([
    { label: 'Semaine', value: 'week' },
    { label: '3 Jours', value: '3days' },
    { label: 'Mois', value: 'month' },
  ]), []);

  const modeDescription = useMemo(() => {
    if (viewMode === 'month') {
      return t('planning.mode.monthDescription', 'Vue globale du mois');
    }

    if (viewMode === 'week') {
      return t('planning.mode.weekDescription', 'Vue détaillée de la semaine');
    }

    return t('planning.mode.threeDaysDescription', 'Vue condensée sur 3 jours');
  }, [t, viewMode]);

  if ((isLoading && !eventsData) || enDecision) {
    return <Loader />;
  }

  const events = withViewerChildrenTitles(
    normalizePlanningItems([...(eventsData?.data || []), ...reservations]),
    t,
  );

  const handleEventPress = (event) => {
    // T3-RESA-PLANNING (03/11) : une reservation ouvre SA fiche, pas celle d un evenement.
    if (event?.raw?.reservationTerrain) {
      /** @type {any} */ (navigation).navigate(RouteNames.ReserverMaReservation, {
        reservationId: event.documentId,
      });
      return;
    }
    // R17-EVT-1-BIS (b) (20/10) : vue Mois, l événement de la Ville (sans documentId) ouvre SA
    // fiche, comme son bloc dans la grille.
    if (event?.raw?.evenementDeLaVille) {
      ouvrirLEvenementDeLaVille(event.raw.evenementDeLaVille);
      return;
    }
    if (!event?.documentId) return;

    navigation.navigate(RouteNames.EventStack, {
      params: { eventId: event.documentId },
      screen: RouteNames.EventDetails,
    });
  };

  // 🏛️ R17-EVT-1 (20/10) — « Mon planning » (niveau 3) : le bloc clair d un evenement de la Ville
  // ouvre sa fiche (le serveur l a verse, sans `documentId` de seance).
  const ouvrirLEvenementDeLaVille = (/** @type {any} */ evenement) => {
    if (evenement?.documentId) {
      /** @type {any} */ (navigation).navigate(RouteNames.EvenementDeLaVille, {
        evenementId: evenement.documentId,
      });
    }
  };

  const handleOpenFullscreen = () => {
    navigation.navigate(RouteNames.PlanningWeekFullscreen, {
      contextLabel: t('planning.fullscreen.personal', 'Mon planning'),
      date: currentDate.toISOString(),
      sourceType: 'personal',
      ...(withChildren ? { withChildren: true } : {}),
    });
  };

  const planningView = viewMode === 'month' ? (
    <PlanningCalendarView
      currentDate={currentDate}
      events={events}
      onDateSelect={choisirLaDate}
      onEventPress={handleEventPress}
    />
  ) : (
    <PlanningWeekTimelineView
      currentDate={currentDate}
      events={events}
      expandToContent={isWebPlanning}
      mode={viewMode}
      onDateChange={choisirLaDate}
      onEvenementVillePress={ouvrirLEvenementDeLaVille}
      onEventPress={handleEventPress}
      onSummaryPress={onSummaryPress}
      scrollEnabled={!isWebPlanning}
    />
  );

  return (
    <View style={{ width: '100%' }}>
      <View style={[Alignments.alignCenter, Spaces.marginBottom[16], { width: '100%' }]}>
        <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12], { width: '100%' }]}>
          <View style={{ flex: 1 }}>
            {/* REPRISE-PLACE (01/11, point 6) : « Semaine » sortait coupé à 390 px sur le site. */}
            <SegmentedControl
              centerContent
              fitLabels
              onChange={choisirLaVue}
              options={viewOptions}
              value={viewMode}
            />
          </View>
          <PlanningFullscreenButton
            borderColor={`${Colors.primary500}66`}
            onPress={handleOpenFullscreen}
          />
        </View>
        <Text style={[Fonts.p3, Fonts.primary100, Fonts.textCenter, Spaces.marginTop[8]]}>
          {modeDescription}
        </Text>
      </View>

      <View style={{ width: '100%' }}>
        {planningView}
      </View>
    </View>
  );
}

export default memo(PersonalPlanningContainer);
