import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  addDays,
  format,
  isSameDay,
  isSameMonth,
  isSameWeek,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfWeek,
} from 'date-fns';
import { enGB, fr } from 'date-fns/locale';
import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getUserRoleKey } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import {
  closureBandLabel,
  closureBandsForRange,
  closureCoversDay,
  closureDaysLabel,
  closureHoursLabel,
  closureTagLabel,
  closureTouchesBlock,
} from '@/domains/facilityClosure/facilityClosureDisplay';
import {
  capitalize,
  fromMinutes,
  fullMomentsOfPlanning,
  isoWeekdayOf,
  momentLabel,
  timeRange,
  toMinutes,
  weekdayName,
} from '@/domains/seasonSlot/seasonSlotDisplay';
import { withAlpha } from '@/theme/colors';
import localeDesFormats from '@/theme/strings/localeDesFormats';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Loader from '@/components/atoms/loader/Loader';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import FacilityClosureBanner from '@/components/molecules/facilityClosure/FacilityClosureBanner';
import FacilityPlanningList from '@/components/organisms/planning/FacilityPlanningList';
import PlanningCalendarView from '@/components/organisms/planningCalendarView';
import PlanningWeekTimelineView from '@/components/organisms/planningWeekTimelineView';
import RondsDePlaces from '@/components/organisms/seasonSlot/RondsDePlaces';
import SeasonSlotForm from '@/components/organisms/seasonSlot/SeasonSlotForm';
import SeasonSlotManage from '@/components/organisms/seasonSlot/SeasonSlotManage';
import ScreenContainer from '@/components/templates/ScreenContainer';
import { PanneauDeFermeture } from '@/views/collectivite/CollectiviteFermeture';
import EcrireAuxDirigeants from '@/views/collectivite/components/EcrireAuxDirigeants';

import { RouteNames } from '@/navigation/routeNames';

import {
  useCollectiviteClubs,
  useCollectiviteInstallations,
  useManagingCollectiviteId,
} from '@/services/collectivite/collectiviteQueries';
import {
  getClubPlanning,
  getMyPlanning,
} from '@/services/event/eventService';
import { useClubCollectiviteFacilities } from '@/services/facility/facilityQueries';
import { getFacilityPlanning } from '@/services/facility/facilityService';
import {
  getClubSharedPlanning,
  getCMPlanning,
} from '@/services/multisportClub/multisportClubService';

import {
  lockToPortrait,
  unlockAllOrientations,
} from '@/utils/device/orientation';
import {
  FACILITY_CONFLICT_MODES,
  getFacilityConflictMode,
} from '@/utils/facilityConflictMode';
import { assignClubPlanningColors } from '@/utils/facilityPlanningColor';
import {
  lireVueRetenue,
  pageDAujourdhui,
  pageSuivante,
  plageDeLaVue,
  retenirVue,
  VUES,
  vuesProposees,
} from '@/utils/planning/installationPlanningViews';
import {
  getPlanningDefaultDate,
  getPlanningItemDate,
  getPlanningPeakOccupancy,
  getPlanningRange,
  getPlanningTimeLabel,
  normalizePlanningItems,
} from '@/utils/planning/planningSlots';

import { useIsDesktop } from '@/responsive';

const PERSONAL_PLANNING_STALE_MS = 60 * 1000;

/**
 * COLL-C2B (02/10) — la locale date-fns de la langue de l app.
 * @returns {import('date-fns').Locale} fr ou en-GB.
 */
const localeDesDates = () => (localeDesFormats() === 'en-GB' ? enGB : fr);

/**
 * COLL-C2B (02/10) — une place EN ATTENTE (contrat C2A §7) ne compte pas encore.
 * @param {any} evenement - Un bloc du planning.
 * @returns {boolean} Vrai si la place est confirmee.
 */
const nEstPasEnAttente = (evenement) => evenement?.raw?.pending !== true;

/**
 * COLL-C2B (02/10) — « 2 – 8 mars 2026 », ou « 28 sept. – 4 oct. 2026 » (design P5).
 * @param {{ from: string, to: string }} periode - La semaine affichee.
 * @returns {string} La semaine, dite courte.
 */
const semaineCourte = ({ from, to }) => {
  const debut = parseISO(from);
  const fin = parseISO(to);
  const locale = localeDesDates();
  const deDebut = isSameMonth(debut, fin)
    ? format(debut, 'd', { locale })
    : format(debut, 'd MMM', { locale });
  return `${deDebut} – ${format(fin, 'd MMM yyyy', { locale })}`;
};

// COLL1B (29/09) — `facility` : le planning d UNE installation, lu par tout membre d un
// club qui l utilise (route du lot 1b). Lecture seule : chaque bloc dit « club · equipe »,
// seuls ceux du club du lecteur s ouvrent (le serveur ne donne l id que de ceux-la).
const FULLSCREEN_SOURCE_TYPES = {
  club: 'club',
  clubShared: 'clubShared',
  cm: 'cm',
  facility: 'facility',
  personal: 'personal',
};

const getInitialDate = (rawDate) => {
  if (typeof rawDate === 'string') {
    const parsedDate = new Date(rawDate);
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
  }

  return getPlanningDefaultDate();
};

const getPlanningQuery = ({
  clubId,
  cmId,
  facilityId,
  planningRange,
  sectionId,
  sourceType,
}) => {
  switch (sourceType) {
    case FULLSCREEN_SOURCE_TYPES.club:
      return {
        enabled: Boolean(clubId),
        queryFn: () => getClubPlanning(clubId, {
          facilityId: facilityId || undefined,
          from: planningRange.from,
          to: planningRange.to,
        }),
        queryKey: ['planning', 'fullscreen', 'club', clubId, planningRange.from, planningRange.to, facilityId || 'all'],
      };
    case FULLSCREEN_SOURCE_TYPES.clubShared:
      return {
        enabled: Boolean(clubId && cmId),
        queryFn: () => getClubSharedPlanning(cmId, clubId, {
          from: planningRange.from,
          installationId: facilityId || undefined,
          to: planningRange.to,
        }),
        queryKey: ['planning', 'fullscreen', 'club-shared', cmId, clubId, planningRange.from, planningRange.to, facilityId || 'all'],
      };
    case FULLSCREEN_SOURCE_TYPES.cm:
      return {
        enabled: Boolean(cmId),
        queryFn: () => getCMPlanning(cmId, {
          from: planningRange.from,
          installationId: facilityId || undefined,
          sectionId: sectionId || undefined,
          to: planningRange.to,
        }),
        queryKey: ['planning', 'fullscreen', 'cm', cmId, planningRange.from, planningRange.to, facilityId || 'all', sectionId || 'all'],
      };
    case FULLSCREEN_SOURCE_TYPES.facility:
      return {
        enabled: Boolean(facilityId),
        queryFn: () => getFacilityPlanning(facilityId, {
          from: planningRange.from,
          to: planningRange.to,
        }),
        queryKey: [
          'planning', 'fullscreen', 'facility', facilityId, planningRange.from, planningRange.to,
        ],
      };
    case FULLSCREEN_SOURCE_TYPES.personal:
    default:
      return {
        enabled: true,
        queryFn: () => getMyPlanning(planningRange),
        queryKey: ['planning', 'fullscreen', 'personal', planningRange.from, planningRange.to],
      };
  }
};

/**
 * Dedicated fullscreen week-planning screen.
 * @returns {import('react').ReactElement}
 */
function PlanningWeekFullscreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Images,
    Spaces,
  } = useTheme();

  const sourceType = route?.params?.sourceType || FULLSCREEN_SOURCE_TYPES.personal;
  const clubId = route?.params?.clubId || null;
  const cmId = route?.params?.cmId || null;
  const contextLabel = route?.params?.contextLabel || null;
  const facilityId = route?.params?.facilityId || null;
  const sectionId = route?.params?.sectionId || null;

  const [currentDate, setCurrentDate] = useState(getInitialDate(route?.params?.date));
  // PLANNING-PORTRAIT (01/10, decision d'Adel « D6 A ») : l'ecran SUIT le telephone.
  // Tenu droit, une semaine ne laissait que ~50 pt par jour (mesure FINITIONS5) : on y
  // montre UN jour ; tourne, la semaine, comme avant.
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;
  const isFacilitySource = sourceType === FULLSCREEN_SOURCE_TYPES.facility;
  // COLL-C2B (02/10) — design P5v2-vues : 5 vues sur le planning d une installation. Jour par
  // defaut sur telephone, Semaine sur le site, la vue choisie RETENUE ; telephone tourne : la
  // semaine (D6 A). Les autres plannings gardent leur regle : le jour tenu droit, la semaine
  // tourne.
  const [vueChoisie, setVueChoisie] = useState(() => lireVueRetenue(Platform.OS));
  /** @type {string} */
  let vue = isLandscape ? VUES.semaine : VUES.jour;
  if (isFacilitySource) {
    vue = isLandscape && Platform.OS !== 'web' ? VUES.semaine : vueChoisie;
  }
  const choisirVue = useCallback((/** @type {string} */ nouvelle) => {
    setVueChoisie(nouvelle);
    retenirVue(nouvelle);
  }, []);
  const pageDays = vue === VUES.semaine ? 7 : 1;

  // L'orientation n'est plus FORCEE en paysage (V1803) : elle est LIBEREE, et l'app
  // revient en portrait en sortant. Le module natif savait deja le faire
  // (`unlockToUserPreference`) : aucune nouvelle construction de l'app n'est requise.
  useFocusEffect(useCallback(() => {
    const timer = setTimeout(() => {
      unlockAllOrientations();
    }, 10);

    return () => {
      clearTimeout(timer);
      lockToPortrait();
    };
  }, []));

  const planningRange = useMemo(
    () => (isFacilitySource
      ? plageDeLaVue(vue, currentDate)
      : getPlanningRange(currentDate, 'week')),
    [currentDate, isFacilitySource, vue],
  );
  const planningQuery = useMemo(() => getPlanningQuery({
    clubId,
    cmId,
    facilityId,
    planningRange,
    sectionId,
    sourceType,
  }), [clubId, cmId, facilityId, planningRange, sectionId, sourceType]);
  const {
    data,
    error,
    isFetching,
    isLoading,
    refetch,
  } = useQuery({
    staleTime: PERSONAL_PLANNING_STALE_MS,
    // COLL-C2B (02/10) — design P5, etat « chargement » : la grille d une installation RESTE
    // (voilee) pendant la lecture d une autre semaine ; avant, une roue remplacait tout.
    ...(isFacilitySource ? { placeholderData: keepPreviousData } : {}),
    ...planningQuery,
  });

  // COLL1D — le texte de capacite parle a CELUI qui lit : les « depassements » et les
  // « demandes en attente » ne regardent que ceux qui posent des evenements (entraineur,
  // dirigeant) ; un joueur ou un parent lit ce qui est libre.
  // PLANNING-PORTRAIT (01/10) — ET celui qui GERE l'installation : un agent de mairie dont
  // le compte est « joueur » lisait le texte du membre. C'est le serveur qui dit qu'il la
  // gere (ses collectivites, puis leurs installations), jamais le role du compte.
  const { userData } = /** @type {any} */ (useAuth()) || {};
  const managingCollectiviteId = useManagingCollectiviteId(facilityId, {
    enabled: isFacilitySource,
  });
  const readsAsOrganizer = Boolean(managingCollectiviteId)
    || ['coach', 'president', 'superAdmin'].includes(
      getUserRoleKey(userData?.role?.type || userData?.role?.name),
    );

  // COLL1D — sur le planning d'UNE installation, une couleur par club (SPEC §2 C) :
  // tous les blocs y partagent la meme installation, donc la meme couleur sans cela.
  // COLL-C2B (02/10) — design P5-jour : une place EN ATTENTE (contrat C2A §7, `pending`) se lit
  // « en attente » a sa place ; un MEMBRE voit son club en couleur et les autres en gris.
  const normalizedEvents = useMemo(() => normalizePlanningItems(data?.data || []), [data]);
  // 🖥️ COLL-C4B-BIS (03/10, « P4v3-fermer-ordi ») — la fermeture EN SAISIE dans le panneau de
  // droite (ordinateur) : « le jour ferme se hachure pendant la saisie, et les seances touchees se
  // cernent d orange ». Rien n est ecrit tant que la mairie n a pas confirme.
  const [brouillon, setBrouillon] = useState(/** @type {any} */ (null));
  const events = useMemo(() => {
    if (!isFacilitySource) return normalizedEvents;
    return assignClubPlanningColors(normalizedEvents).map((/** @type {any} */ evenement) => {
      const brut = evenement.raw || {};
      const duClubDuLecteur = Boolean(evenement.documentId) || brut.isOwnClub === true;
      // Le brouillon cerne ce qu il toucherait ; en MODIFIANT une fermeture, il libere aussi ce
      // qu elle ne touche plus (la regle du serveur, §13.3 : closureTouchesBlock).
      const touche = closureTouchesBlock(evenement, brouillon);
      const liberee = Boolean(brouillon?.documentId)
        && brut.closure?.documentId === brouillon.documentId;
      const cerne = touche || liberee
        ? {
          raw: {
            ...brut,
            closure: touche ? { documentId: brouillon.documentId, kind: brouillon.kind } : null,
          },
        }
        : {};
      return {
        ...evenement,
        ...cerne,
        displayColor: readsAsOrganizer || duClubDuLecteur
          ? evenement.displayColor
          : Colors.neutral500,
        // COLL-C3B (02/10) — et le club qui DEMANDE voit sa demande « en attente de la mairie »,
        // a sa place (P8v2-demande, etat 4 : « Comme dans ton planning »).
        participationStatus: (readsAsOrganizer || duClubDuLecteur) && brut.pending === true
          ? 'pending'
          : evenement.participationStatus,
      };
    });
  }, [Colors.neutral500, brouillon, isFacilitySource, normalizedEvents, readsAsOrganizer]);
  const hasEvents = events.length > 0;
  // SPEC Collectivites §2 C : la mairie touche le bloc d'un AUTRE club -> une fiche en
  // lecture (club, equipe, horaires, contact GENERAL du club, D15). Pour tout autre
  // lecteur, ce bloc reste inerte (FINITIONS2).
  const [readOnlyBlock, setReadOnlyBlock] = useState(/** @type {any} */ (null));
  // COLL-C4B (02/10) — la plage FERMEE ou BLOQUEE que la mairie a touchee (Modifier, Rouvrir).
  const [fermetureOuverte, setFermetureOuverte] = useState(/** @type {any} */ (null));
  // COLL-C2B (02/10) — ce que la mairie a ouvert : « attribuer », « gerer » ou « modifier ».
  const [panneau, setPanneau] = useState(/** @type {any} */ (null));
  // COLL-FIX-PLANNING (G4) — ces trois fenetres du bas s affichent par un PORTAIL pose AU-DESSUS
  // de la navigation : en quittant l ecran (Ecrire aux dirigeants, Modifier, une seance), elles
  // resteraient par-dessus l ecran suivant. Elles se ferment quand l ecran perd la main (« blur »).
  useEffect(() => /** @type {any} */ (navigation).addListener?.('blur', () => {
    setReadOnlyBlock(null);
    setFermetureOuverte(null);
    setPanneau(null);
  }), [navigation]);
  const attachedClubs = useCollectiviteClubs(
    readOnlyBlock || panneau ? managingCollectiviteId : null,
  );
  const readOnlyBlockContact = (attachedClubs.data || []).find(
    (club) => club?.documentId && club.documentId === readOnlyBlock?.club?.documentId,
  ) || null;
  const readOnlyBlockDate = readOnlyBlock ? getPlanningItemDate(readOnlyBlock) : null;
  const showsContact = !attachedClubs.isLoading;
  const hasContact = Boolean(readOnlyBlockContact?.email || readOnlyBlockContact?.phoneNumber);
  // COLL1B : ouvert par un lien du site (params reduits a l adresse), l ecran d une
  // installation retrouve son nom et sa capacite dans la reponse du serveur.
  const serverFacility = sourceType === FULLSCREEN_SOURCE_TYPES.facility
    ? data?.meta?.facility || null
    : null;
  const facilityMeta = route?.params?.facilityMeta || serverFacility;
  const contextDetailLabel = route?.params?.contextDetailLabel || serverFacility?.name || null;
  const facilityPlanningSummary = useMemo(() => {
    if (!facilityId || !facilityMeta) return null;

    const occupancy = getPlanningPeakOccupancy(events);
    const maxSlots = Math.max(1, Number(facilityMeta?.maxSlots || 1));
    const peakConcurrent = occupancy.maxConcurrent;
    const remainingAtPeak = Math.max(0, maxSlots - peakConcurrent);

    return {
      allowsImmediateConfirmation: getFacilityConflictMode(facilityMeta) === FACILITY_CONFLICT_MODES.ALLOW_AND_NOTIFY,
      eventCount: occupancy.itemCount,
      facilityColor: facilityMeta?.planningColor || Colors.primary500,
      maxSlots,
      peakConcurrent,
      reachedCapacity: peakConcurrent >= maxSlots,
      remainingAtPeak,
      requiresApproval: getFacilityConflictMode(facilityMeta) === FACILITY_CONFLICT_MODES.PENDING_VALIDATION,
    };
  }, [Colors.primary500, events, facilityId, facilityMeta]);
  const weekLabel = useMemo(() => {
    const fromDate = parseISO(planningRange.from);
    const toDate = parseISO(planningRange.to);
    return `${format(fromDate, 'd MMM', { locale: fr })} - ${format(toDate, 'd MMM yyyy', { locale: fr })}`;
  }, [planningRange.from, planningRange.to]);
  // COLL-C2B (02/10) — design P5 : sur le planning d une installation, la barre dit « Mer. 4
  // mars » (ou « Aujourd hui, jeu. 1 oct. ») tenu droit, « 2 – 8 mars 2026 » tourne.
  const jourDeLaBarre = capitalize(format(currentDate, 'EEE d MMM', { locale: localeDesDates() }));
  let pageLabel = isLandscape
    ? weekLabel
    : format(currentDate, 'EEEE d MMMM yyyy', { locale: fr });
  if (isFacilitySource) {
    const locale = localeDesDates();
    if (vue === VUES.mois) {
      pageLabel = capitalize(format(currentDate, 'MMMM yyyy', { locale }));
    } else if (vue === VUES.troisJours) {
      pageLabel = `${capitalize(format(addDays(currentDate, -1), 'EEE d MMM', { locale }))} – ${
        format(addDays(currentDate, 1), 'EEE d MMM', { locale })}`;
    } else {
      pageLabel = vue === VUES.jour ? jourDeLaBarre : semaineCourte(planningRange);
    }
    if (vue === VUES.jour && isSameDay(currentDate, getPlanningDefaultDate())) {
      pageLabel = t('collectiviteCreneaux.planning.aujourdhui', 'Aujourd’hui, {{jour}}', {
        jour: format(currentDate, 'EEE d MMM', { locale: localeDesDates() }),
        ...SANS_ECHAPPEMENT,
      });
    }
  }
  const planningContextLabel = useMemo(() => {
    if (contextLabel) {
      return contextLabel;
    }

    switch (sourceType) {
      case FULLSCREEN_SOURCE_TYPES.club:
        return t('planning.fullscreen.club', 'Planning club');
      case FULLSCREEN_SOURCE_TYPES.clubShared:
        return t('planning.fullscreen.clubShared', 'Planning partage');
      case FULLSCREEN_SOURCE_TYPES.cm:
        return t('planning.fullscreen.cm', 'Planning omnisport');
      case FULLSCREEN_SOURCE_TYPES.facility:
        return t('planning.fullscreen.facility', 'Planning de l’installation');
      case FULLSCREEN_SOURCE_TYPES.personal:
      default:
        return t('planning.fullscreen.personal', 'Mon planning');
    }
  }, [contextLabel, sourceType, t]);
  const planningContextDisplayLabel = useMemo(() => {
    if (!contextDetailLabel) {
      return planningContextLabel;
    }
    // COLL-C2B (02/10) — design P5 : « Planning · Gymnase des Tilleuls ».
    if (isFacilitySource && !contextLabel) {
      return t('collectiviteCreneaux.planning.contexte', 'Planning · {{installation}}', {
        installation: contextDetailLabel,
        ...SANS_ECHAPPEMENT,
      });
    }

    return `${planningContextLabel} - ${contextDetailLabel}`;
  }, [contextDetailLabel, contextLabel, isFacilitySource, planningContextLabel, t]);
  const isCurrentWeek = useMemo(
    () => isSameWeek(currentDate, getPlanningDefaultDate(), { weekStartsOn: 1 }),
    [currentDate],
  );
  // « Aujourd'hui » ramene a la page du jour : la semaine en paysage, le jour en portrait.
  let isCurrentPage = isLandscape
    ? isCurrentWeek
    : isSameDay(currentDate, getPlanningDefaultDate());
  if (isFacilitySource) isCurrentPage = pageDAujourdhui(vue, currentDate, getPlanningDefaultDate());
  // Le nom des fleches dit ce qu elles font (lecteur d ecran).
  /** @type {Record<string, string[]>} */
  const nomsDesFleches = {
    [VUES.jour]: [
      t('personalPlanningWeekFullscreen.previousDay', 'Jour précédent'),
      t('personalPlanningWeekFullscreen.nextDay', 'Jour suivant'),
    ],
    [VUES.mois]: [
      t('collectiviteCreneaux.vues.moisPrecedent', 'Mois précédent'),
      t('collectiviteCreneaux.vues.moisSuivant', 'Mois suivant'),
    ],
    [VUES.troisJours]: [
      t('collectiviteCreneaux.vues.joursPrecedents', 'Jours précédents'),
      t('collectiviteCreneaux.vues.joursSuivants', 'Jours suivants'),
    ],
  };
  const [flecheGauche, flecheDroite] = nomsDesFleches[vue] || [
    t('personalPlanningWeekFullscreen.previousWeek', 'Semaine précédente'),
    t('personalPlanningWeekFullscreen.nextWeek', 'Semaine suivante'),
  ];
  const facilitySummaryMessage = useMemo(() => {
    if (!facilityPlanningSummary) return '';

    // COLL1D — le texte du MEMBRE : ce qui est libre, sans les regles de reservation.
    if (!readsAsOrganizer) {
      return facilityPlanningSummary.reachedCapacity
        ? t(
          'facilityList.planning.member.full',
          'Complet au moment le plus chargé de la semaine : plus aucune place libre.',
        )
        : t('facilityList.planning.member.available', {
          count: facilityPlanningSummary.remainingAtPeak,
          defaultValue_one: '{{count}} place libre au moment le plus chargé de la semaine.',
          defaultValue_other: '{{count}} places libres au moment le plus chargé de la semaine.',
        });
    }

    if (facilityPlanningSummary.reachedCapacity) {
      if (facilityPlanningSummary.allowsImmediateConfirmation) {
        return t(
          'facilityList.planning.capacityReachedOverflow',
          'La capacité a déjà été atteinte sur cette période. Les nouveaux dépassements restent autorises et notifieront les dirigeants.',
        );
      }

      return t(
        'facilityList.planning.capacityReachedStrict',
        'La capacité a déjà été atteinte sur cette période. Les nouveaux dépassements passeront en demande en attente.',
      );
    }

    return t(
      'facilityList.planning.capacityAvailable',
      'Places encore libres au moment le plus chargé : {{count}}.',
      { count: facilityPlanningSummary.remainingAtPeak },
    );
  }, [facilityPlanningSummary, readsAsOrganizer, t]);

  // ─── COLL-C2B (02/10) — design P5-jour, P5-semaine : le planning d UNE installation ──────
  // La capacite en UNE ligne, la place en image (REPRIS e10 n°3) ; la legende par club (n°5) ;
  // la demande en attente a sa place (NOUVEAU). Le jour tenu droit, la semaine tourne.
  // Pour un membre (joueur, parent) : ni capacite ni demande (RETIRE, « ne le concerne pas »).
  const blocsDeLaPage = useMemo(() => {
    if (vue === VUES.jour) {
      return events.filter((/** @type {any} */ evenement) => {
        const jour = getPlanningItemDate(evenement);
        return jour ? isSameDay(jour, currentDate) : false;
      });
    }
    if (vue === VUES.troisJours) {
      const debut = startOfDay(addDays(currentDate, -1));
      const fin = startOfDay(addDays(currentDate, 2));
      return events.filter((/** @type {any} */ evenement) => {
        const jour = getPlanningItemDate(evenement);
        return jour ? isWithinInterval(jour, { end: fin, start: debut }) && jour < fin : false;
      });
    }
    return events;
  }, [currentDate, events, vue]);
  const blocsEnAttente = readsAsOrganizer
    ? blocsDeLaPage.filter((/** @type {any} */ evenement) => evenement.raw?.pending === true)
    : [];
  const ligneDeCapacite = useMemo(() => {
    if (!isFacilitySource || !facilityPlanningSummary || !readsAsOrganizer) return null;
    // Le mois n a pas de « moment complet » lisible ; la Liste le dit jour par jour.
    if (vue === VUES.mois || vue === VUES.liste) return null;
    // Une demande EN ATTENTE ne prend pas encore de place.
    const confirmes = blocsDeLaPage.filter(nEstPasEnAttente);
    const capacite = facilityPlanningSummary.maxSlots;
    const plein = fullMomentsOfPlanning(confirmes, capacite)[0] || null;
    const pic = Math.min(capacite, getPlanningPeakOccupancy(confirmes).maxConcurrent);
    // COLL-FIX2 (03/10), planche 25 (T10_C25_5) : un jour FERMÉ (toute la journée) disait encore
    // « 1 place libre au plus chargé ». La fermeture le dit, pas une place.
    const jourFerme = vue === VUES.jour
      && (Array.isArray(data?.meta?.closures) ? data.meta.closures : []).some((fermeture) => (
        fermeture?.kind !== 'block'
        && closureCoversDay(fermeture, format(currentDate, 'yyyy-MM-dd'))
      ));
    let suite;
    if (jourFerme) {
      suite = t('collectiviteCreneaux.planning.fermeJour', 'fermeture ce jour-là');
    } else if (plein) {
      suite = t('collectiviteCreneaux.liste.complet', 'complet {{moment}}', {
        moment: vue === VUES.jour
          ? `${format(plein.start, 'HH:mm')} – ${format(plein.end, 'HH:mm')}`
          : momentLabel(plein),
        ...SANS_ECHAPPEMENT,
      });
    } else if (pic === 0) {
      suite = vue === VUES.jour
        ? t('collectiviteCreneaux.planning.libreJour', 'libre toute la journée')
        : t('collectiviteCreneaux.planning.libreSemaine', 'libre toute la semaine');
    } else {
      suite = t('collectiviteCreneaux.planning.placesLibres', {
        count: capacite - pic,
        defaultValue_one: '{{count}} place libre au plus chargé',
        defaultValue_other: '{{count}} places libres au plus chargé',
      });
    }
    const equipes = t('collectiviteCreneaux.liste.capacite', {
      count: capacite,
      defaultValue_one: '{{count}} équipe à la fois',
      defaultValue_other: '{{count}} équipes à la fois',
    });
    return {
      capacite,
      pic: plein || jourFerme ? capacite : pic,
      plein: Boolean(plein) || jourFerme,
      texte: `${equipes} · ${suite}`,
    };
  // eslint-disable-next-line max-len
  }, [blocsDeLaPage, currentDate, data?.meta?.closures, facilityPlanningSummary, isFacilitySource, readsAsOrganizer, t, vue]);
  const legende = useMemo(() => {
    if (!isFacilitySource) return [];
    const parClub = new Map();
    const ajouter = (/** @type {any} */ evenement, /** @type {string} */ libelle) => {
      const cle = evenement.club?.documentId || evenement.club?.name;
      if (cle && !parClub.has(cle)) parClub.set(cle, { couleur: evenement.displayColor, libelle });
    };
    const confirmes = blocsDeLaPage.filter(nEstPasEnAttente);
    if (!readsAsOrganizer) {
      // Le membre : son club en couleur, « Autres clubs » en gris (REPRIS e18).
      const duLecteur = (/** @type {any} */ evenement) => Boolean(evenement.documentId)
        || evenement.raw?.isOwnClub === true;
      confirmes.filter(duLecteur).forEach((evenement) => ajouter(
        evenement,
        t('collectiviteCreneaux.planning.tonClub', '{{club}}, ton club', {
          club: evenement.club?.name || '',
          ...SANS_ECHAPPEMENT,
        }),
      ));
      const elements = [...parClub.values()];
      if (blocsDeLaPage.some((evenement) => !duLecteur(evenement))) {
        elements.push({
          couleur: Colors.neutral500,
          libelle: t('collectiviteCreneaux.planning.autresClubs', 'Autres clubs'),
        });
      }
      return elements;
    }
    confirmes.forEach((evenement) => ajouter(evenement, evenement.club?.name || ''));
    const elements = [...parClub.values()]
      .filter((element) => element.libelle)
      .sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr'));
    if (blocsEnAttente.length) {
      elements.push({
        couleur: Colors.warning500,
        libelle: t('collectiviteCreneaux.planning.demandeEnAttente', 'Demande en attente'),
      });
    }
    return elements;
  }, [Colors.neutral500, Colors.warning500, blocsDeLaPage, blocsEnAttente.length, isFacilitySource,
    readsAsOrganizer, t]);
  // « Trancher » : seulement pour la mairie, et vers SES demandes (lot 3a).
  const nombreEnAttente = managingCollectiviteId ? blocsEnAttente.length : 0;
  const ligneEnAttente = vue !== VUES.jour
    ? t('collectiviteCreneaux.planning.enAttenteSemaine', {
      count: nombreEnAttente,
      defaultValue_one: '{{count}} demande en attente cette semaine.',
      defaultValue_other: '{{count}} demandes en attente cette semaine.',
    })
    : t('collectiviteCreneaux.planning.enAttenteJour', {
      count: nombreEnAttente,
      defaultValue_one: '{{count}} demande en attente sur ce jour.',
      defaultValue_other: '{{count}} demandes en attente sur ce jour.',
    });
  // Contrat C2A §7 : d ou vient la place (creneau attribue, demande, seance du club).
  const origineDe = (/** @type {any} */ bloc) => {
    const brut = bloc?.raw || {};
    if (brut.origin === 'slot') {
      if (brut.slot?.source === 'request') {
        return t(
          'collectiviteCreneaux.planning.origineDemandeSerie',
          'Demande acceptée (chaque semaine)',
        );
      }
      return t(
        'collectiviteCreneaux.planning.origineCreneau',
        'Créneau attribué : chaque {{jour}}, du {{debut}} au {{fin}}',
        {
          debut: brut.slot?.validFrom
            ? format(parseISO(brut.slot.validFrom), 'd MMM', { locale: localeDesDates() })
            : '',
          fin: brut.slot?.validUntil
            ? format(parseISO(brut.slot.validUntil), 'd MMM', { locale: localeDesDates() })
            : '',
          jour: weekdayName(brut.slot?.weekday).toLocaleLowerCase(),
          ...SANS_ECHAPPEMENT,
        },
      );
    }
    if (brut.origin === 'request') {
      return brut.pending
        ? t('collectiviteCreneaux.planning.origineAttente', 'Demande en attente de décision')
        : t('collectiviteCreneaux.planning.origineDemande', 'Demande acceptée');
    }
    if (brut.origin === 'club') {
      return t('collectiviteCreneaux.planning.origineClub', 'Séance du club');
    }
    return null;
  };
  const origineDuBloc = origineDe(readOnlyBlock);

  // ─── COLL-C2B (02/10) — design P5v2-vues : la MAIRIE touche pour agir ───────────────────
  // Une heure libre ⇒ « Attribuer pour la saison », deja remplie du jour et de l heure ; un
  // creneau attribue ⇒ « Modifier le creneau », « Retirer le creneau ». Tout autre lecteur
  // consulte (D2 : le planning d une installation de la Ville se LIT).
  // PAS ENCORE, aucun bouton tant qu ils n existent pas (points d accroche nommes) :
  // « Bloquer pour la Ville » et « Bloquer ce jeudi seulement » (C4b) ; « Demander ce
  // creneau » du dirigeant (C3b). « Ecrire aux dirigeants » (D73) : BRANCHE par COLL-C4A2.
  const peutAttribuer = isFacilitySource && Boolean(managingCollectiviteId);
  const ouvertureDuJour = toMinutes(facilityMeta?.openingTime) ?? 8 * 60;
  const fermetureDuJour = toMinutes(facilityMeta?.closingTime) ?? 22 * 60;
  // COLL-C4B (02/10) — les plages fermees ou bloquees de la fenetre (`meta.closures`, contrat §13).
  // COLL-C4B-BIS : plus le brouillon du panneau (a la place de la fermeture qu il modifie).
  const fermeturesDuServeur = Array.isArray(data?.meta?.closures) ? data.meta.closures : [];
  const fermeturesDessinees = brouillon
    ? [
      ...fermeturesDuServeur.filter((/** @type {any} */ fermeture) => !brouillon.documentId
        || fermeture?.documentId !== brouillon.documentId),
      { ...brouillon, enSaisie: true },
    ]
    : fermeturesDuServeur;
  const bandesDeFermeture = isFacilitySource
    ? normalizePlanningItems(closureBandsForRange(
      fermeturesDessinees,
      planningRange,
      { closing: fermetureDuJour, opening: ouvertureDuJour },
      (/** @type {any} */ fermeture) => closureBandLabel(t, fermeture),
    ))
    : [];
  const attribuerA = useCallback((
    /** @type {Date} */ jour,
    /** @type {number} */ debut,
    /** @type {number} */ fin,
    /** @type {number | null} */ plateau = null,
  ) => {
    const debutTexte = fromMinutes(debut);
    const finTexte = fromMinutes(Math.min(debut + 90, fin > debut ? fin : debut + 90));
    setReadOnlyBlock(null);
    setPanneau({
      compact: true,
      // COLL-C4B : le jour exact, pour « Bloquer pour la Ville » (un blocage tient en UN jour).
      date: format(jour, 'yyyy-MM-dd'),
      // COLL-C2B-BIS (planches 24 et 29) : touchee dans la colonne d un plateau, l heure le garde.
      initial: {
        endTime: finTexte,
        startTime: debutTexte,
        weekday: isoWeekdayOf(jour),
        ...(plateau ? { plateau } : {}),
      },
      titre: `${weekdayName(isoWeekdayOf(jour))} ${timeRange(debutTexte, finTexte)}`,
      type: 'attribuer',
    });
  }, []);
  // COLL-C3B (02/10, design P8v2-demande) — un DIRIGEANT ou un ENTRAINEUR d un club rattache
  // touche une heure libre du planning d une installation de la Ville ⇒ « Demander ce creneau »,
  // deja rempli du jour et de l heure. La Ville decide (le serveur fait la demande).
  const clubDuLecteur = userData?.club?.documentId || null;
  const villesDuClub = useClubCollectiviteFacilities(
    isFacilitySource && !managingCollectiviteId && readsAsOrganizer ? clubDuLecteur : null,
  );
  const peutDemander = !peutAttribuer && Boolean(clubDuLecteur)
    && (Array.isArray(villesDuClub.data) ? villesDuClub.data : [])
      .some((/** @type {any} */ installation) => installation?.documentId === facilityId);
  const demanderA = (/** @type {Date | null} */ jour, /** @type {number | null} */ heure) => {
    /** @type {Record<string, any>} */
    const params = { clubId: clubDuLecteur, facilityId };
    if (jour) params.date = format(jour, 'yyyy-MM-dd');
    if (heure !== null) {
      params.startTime = fromMinutes(heure * 60);
      params.endTime = fromMinutes(Math.min(heure * 60 + 90, fermetureDuJour));
    }
    /** @type {any} */ (navigation).navigate(RouteNames.ClubSlotRequest, params);
  };
  let toucherUneHeureLibre;
  if (peutAttribuer) {
    // COLL-C2B-BIS : la colonne touchee (vue Jour, D66) est le plateau n° colonne + 1 ; la colonne
    // « Indifferent » (la derniere, apres les plateaux nommes) n en porte aucun.
    const nombreDePlateaux = Array.isArray(facilityMeta?.plateaux)
      ? facilityMeta.plateaux.length
      : 0;
    toucherUneHeureLibre = (
      /** @type {Date} */ jour,
      /** @type {number} */ heure,
      /** @type {number | undefined} */ colonne,
    ) => attribuerA(
      jour,
      heure * 60,
      heure * 60 + 90,
      Number.isInteger(colonne) && Number(colonne) < nombreDePlateaux ? Number(colonne) + 1 : null,
    );
  } else if (peutDemander) {
    toucherUneHeureLibre = (/** @type {Date} */ jour, /** @type {number} */ heure) => (
      demanderA(jour, heure)
    );
  }
  // Un bloc venu d un creneau attribue (contrat C2A §7, `slot`) se gere comme dans l onglet
  // « Creneaux » : le meme formulaire, la meme feuille.
  const creneauDuBloc = (/** @type {any} */ bloc) => {
    const brut = bloc?.raw || {};
    return {
      club: bloc?.club || null,
      documentId: brut.slot?.documentId,
      endTime: String(bloc?.endTime || '').slice(0, 5),
      facility: { documentId: facilityId, name: contextDetailLabel },
      plateau: brut.plateau || null,
      source: brut.slot?.source || 'attribution',
      startTime: String(bloc?.startTime || '').slice(0, 5),
      team: bloc?.team || null,
      validFrom: brut.slot?.validFrom || null,
      validUntil: brut.slot?.validUntil || null,
      weekday: Number(brut.slot?.weekday) || null,
    };
  };
  const creneauOuvert = peutAttribuer && readOnlyBlock?.raw?.slot?.documentId
    ? creneauDuBloc(readOnlyBlock)
    : null;
  const fermerPanneau = useCallback(() => setPanneau(null), []);
  const ouvrirUnBloc = (/** @type {any} */ bloc) => {
    if (bloc?.documentId) {
      /** @type {any} */ (navigation).navigate(RouteNames.EventStack, {
        params: { eventId: bloc.documentId },
        screen: RouteNames.EventDetails,
      });
      return;
    }
    if (managingCollectiviteId) setReadOnlyBlock(bloc);
  };
  // D66 (design P4v3-plateaux ecran 3) : en vue Jour, une colonne par plateau ; un bloc sans
  // plateau va dans « Indifferent ». Rien en vue Semaine (les jours sont trop etroits).
  const plateauxDuPlanning = Array.isArray(facilityMeta?.plateaux)
    ? facilityMeta.plateaux.map(String)
    : [];
  const colonneDuBloc = (/** @type {any} */ bloc) => {
    const numero = Number(bloc?.raw?.plateau?.number);
    const connu = numero >= 1 && numero <= plateauxDuPlanning.length;
    return connu ? numero - 1 : plateauxDuPlanning.length;
  };
  let colonnesDePlateaux;
  if (isFacilitySource && vue === VUES.jour && plateauxDuPlanning.length) {
    colonnesDePlateaux = plateauxDuPlanning.map((
      /** @type {string} */ nom,
      /** @type {number} */ index,
    ) => ({
      key: `plateau-${index + 1}`,
      label: nom,
    }));
    if (blocsDeLaPage.some((bloc) => colonneDuBloc(bloc) === plateauxDuPlanning.length)) {
      colonnesDePlateaux.push({
        key: 'indifferent',
        label: t('collectiviteCreneaux.attribuer.indifferent', 'Indifférent'),
      });
    }
  }
  /** @type {Record<string, string>} */
  const libellesDesVues = {
    [VUES.jour]: t('collectiviteCreneaux.vues.jour', 'Jour'),
    [VUES.liste]: t('collectiviteCreneaux.vues.liste', 'Liste'),
    [VUES.mois]: t('collectiviteCreneaux.vues.mois', 'Mois'),
    [VUES.semaine]: t('collectiviteCreneaux.vues.semaine', 'Semaine'),
    [VUES.troisJours]: t('collectiviteCreneaux.vues.troisJours', '3 jours'),
  };
  const clubsPourAttribuer = (Array.isArray(attachedClubs.data) ? attachedClubs.data : [])
    .filter((club) => club?.documentId && club?.name)
    .map((club) => ({ documentId: club.documentId, name: club.name }));

  // Design P5-semaine-ordi : sur le site, la mairie choisit l installation en haut (une
  // pastille a la couleur de chacune) ; un bloc ouvert = un panneau a droite.
  const isDesktop = useIsDesktop();
  // 🖥️ COLL-C4B-BIS — ouvert par « Fermer une installation » sur ordinateur (CollectiviteFermeture
  // cede la place au planning) : le panneau de la fermeture, d emblee.
  const fermetureDemandee = route?.params?.fermeture || null;
  useEffect(() => {
    if (!isDesktop || !fermetureDemandee) return;
    const lu = route?.params || {};
    setPanneau({
      closureId: lu.closureId || null,
      date: lu.date || null,
      endTime: lu.endTime || null,
      mode: fermetureDemandee === 'bloquer' ? 'bloquer' : 'fermer',
      startTime: lu.startTime || null,
      type: 'fermeture',
    });
  // La demande de l adresse ne vaut qu a l ouverture.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fermetureDemandee, isDesktop]);
  // Le jour saisi doit SE VOIR : la page le rejoint quand il est hors de la page affichee.
  const debutDuBrouillon = brouillon?.startDate || null;
  const dernierDebutSuivi = useRef(/** @type {string | null} */ (null));
  useEffect(() => {
    if (!debutDuBrouillon || debutDuBrouillon === dernierDebutSuivi.current) return;
    dernierDebutSuivi.current = debutDuBrouillon;
    const jour = parseISO(debutDuBrouillon);
    if (Number.isNaN(jour.getTime())) return;
    const visible = vue === VUES.jour
      ? isSameDay(jour, currentDate)
      : debutDuBrouillon >= planningRange.from && debutDuBrouillon <= planningRange.to;
    if (!visible) setCurrentDate(jour);
  }, [currentDate, debutDuBrouillon, planningRange.from, planningRange.to, vue]);
  const installationsDeLaVille = useCollectiviteInstallations(
    isFacilitySource && isDesktop ? managingCollectiviteId : null,
  );
  const ongletsDInstallations = Array.isArray(installationsDeLaVille.data)
    ? installationsDeLaVille.data.filter((/** @type {any} */ ligne) => ligne?.documentId)
    : [];

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleEventPress = useCallback((event) => {
    if (!event?.documentId) return;

    navigation.navigate(RouteNames.EventStack, {
      params: { eventId: event.documentId },
      screen: RouteNames.EventDetails,
    });
  }, [navigation]);

  // Ne s'ouvre que sur le bloc d'un autre club, et seulement pour celui qui gere.
  // COLL-C4B (02/10) — la plage fermee ou bloquee s ouvre aussi, pour la mairie seule.
  const handleReadOnlyEventPress = useMemo(() => {
    if (!managingCollectiviteId) return undefined;
    return (/** @type {any} */ event) => {
      if (event?.raw?.closureBand) {
        // COLL-C4B-BIS : la plage du brouillon n est pas encore une fermeture.
        if (event.raw.closureBand.enSaisie) return;
        setReadOnlyBlock(null);
        setFermetureOuverte(event.raw.closureBand);
        return;
      }
      setReadOnlyBlock(event);
    };
  }, [managingCollectiviteId]);
  const handleCloseReadOnlyBlock = useCallback(() => setReadOnlyBlock(null), []);

  // Les fleches de l'en-tete : un jour en portrait, une semaine en paysage.
  const handlePrevPage = useCallback(() => {
    setCurrentDate((previousDate) => (isFacilitySource
      ? pageSuivante(vue, previousDate, -1)
      : addDays(previousDate, -pageDays)));
  }, [isFacilitySource, pageDays, vue]);

  const handleNextPage = useCallback(() => {
    setCurrentDate((previousDate) => (isFacilitySource
      ? pageSuivante(vue, previousDate, 1)
      : addDays(previousDate, pageDays)));
  }, [isFacilitySource, pageDays, vue]);

  const handleNextWeek = useCallback(() => {
    setCurrentDate((previousDate) => addDays(previousDate, 7));
  }, []);

  const handleBackToCurrentWeek = useCallback(() => {
    setCurrentDate(getPlanningDefaultDate());
  }, []);
  // COLL-C2B (02/10) : plus de useMemo ici — la moitie de ses dependances (les gestes de la
  // mairie) se recree a chaque rendu ; la grille, elle, reste memorisee.
  const planningContent = (() => {
    // COLL-C2B (02/10) — l installation garde sa grille pendant la lecture (voile, plus bas).
    if (isLoading || (isFetching && !isFacilitySource)) {
      return <Loader />;
    }

    if (error) {
      return (
        <View
          style={{
            alignItems: 'center',
            alignSelf: 'center',
            backgroundColor: 'rgba(10, 23, 34, 0.84)',
            borderColor: 'rgba(255,255,255,0.08)',
            borderRadius: 24,
            borderWidth: 1,
            justifyContent: 'center',
            maxWidth: 520,
            padding: 24,
            width: '100%',
          }}
        >
          <Text style={[Fonts.h4Bold, Fonts.neutral00, Fonts.textCenter, Spaces.marginBottom[8]]}>
            {t(
              'personalPlanningWeekFullscreen.unableToLoadThePlanning',
              'Impossible de charger le planning',
            )}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral100, Fonts.textCenter, Spaces.marginBottom[16]]}>
            {/* « ton A » (01/10) : lu par la mairie ET les clubs, ni « tu » ni « vous ». */}
            {t(
              'personalPlanningWeekFullscreen.weekPlanningLoadError',
              'Le planning de cette semaine n’a pas pu être chargé. Réessayer, ou changer de '
                + 'semaine.',
            )}
          </Text>
          <Button
            onPress={() => refetch()}
            title={t(
              'personalPlanningWeekFullscreen.tryAgain',
              'Reessayer',
            )}
            variant="Primary"
          />
        </View>
      );
    }

    if (isFacilitySource && vue === VUES.mois) {
      return (
        <ScrollView contentContainerStyle={{ gap: 8, paddingBottom: 24 }}>
          <PlanningCalendarView
            currentDate={currentDate}
            events={events}
            onDateSelect={setCurrentDate}
            onEventPress={ouvrirUnBloc}
          />
          <Button
            onPress={() => choisirVue(VUES.jour)}
            title={t('collectiviteCreneaux.vues.ouvrirJournee', 'Ouvrir la journée')}
            variant="Secondary"
          />
        </ScrollView>
      );
    }

    if (isFacilitySource && vue === VUES.liste) {
      return (
        <FacilityPlanningList
          capacite={facilityPlanningSummary?.maxSlots || 1}
          debutDeSemaine={startOfWeek(currentDate, { weekStartsOn: 1 })}
          evenements={events}
          fermeture={fromMinutes(fermetureDuJour)}
          onBlockPress={ouvrirUnBloc}
          onFreePress={peutAttribuer ? attribuerA : undefined}
          origineDe={readsAsOrganizer ? origineDe : undefined}
          ouverture={fromMinutes(ouvertureDuJour)}
          ouvreLesAutresClubs={Boolean(managingCollectiviteId)}
        />
      );
    }

    if (!hasEvents) {
      return (
        <View
          style={{
            alignItems: 'center',
            alignSelf: 'center',
            backgroundColor: 'rgba(10, 23, 34, 0.84)',
            borderColor: 'rgba(255,255,255,0.08)',
            borderRadius: 24,
            borderWidth: 1,
            justifyContent: 'center',
            maxWidth: 520,
            padding: 24,
            width: '100%',
          }}
        >
          <Text style={[Fonts.h4Bold, Fonts.neutral00, Fonts.textCenter, Spaces.marginBottom[8]]}>
            {t('personalPlanningWeekFullscreen.noSlotThisWeek', 'Aucun créneau cette semaine')}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral100, Fonts.textCenter, Spaces.marginBottom[16]]}>
            {t(
              'personalPlanningWeekFullscreen.changeWeekToExploreThe',
              'Les flèches mènent aux autres dates.',
            )}
          </Text>
          <View style={[Alignments.row, Spaces.gap[12]]}>
            {!isCurrentWeek ? (
              <Button
                onPress={handleBackToCurrentWeek}
                title={t(
                  'personalPlanningWeekFullscreen.today',
                  'Aujourd’hui',
                )}
                variant="Secondary"
              />
            ) : null}
            <Button
              onPress={handleNextWeek}
              title={t(
                'personalPlanningWeekFullscreen.nextWeek',
                'Semaine suivante',
              )}
              variant="Primary"
            />
          </View>
          {/* COLL-C2B : une semaine vide se remplit aussi (la mairie attribue). */}
          {peutAttribuer ? (
            <View style={Spaces.marginTop[12]}>
              <Button
                onPress={() => setPanneau({
                  compact: false,
                  initial: { weekday: isoWeekdayOf(currentDate) },
                  type: 'attribuer',
                })}
                title={t('collectiviteCreneaux.creneaux.attribuer', 'Attribuer un créneau')}
                variant="Secondary"
              />
            </View>
          ) : null}
        </View>
      );
    }

    const grilleDuPlanning = (
      <PlanningWeekTimelineView
        // Planning d'une installation : chaque bloc dit son club, puis son equipe.
        cardDisplayProfile={isFacilitySource ? 'clubFocused' : 'default'}
        compactFullscreen
        currentDate={vue === VUES.troisJours ? addDays(currentDate, -1) : currentDate}
        // COLL-C4B (02/10) — design P4v3-fermer ecran 4 : les plages fermees ou bloquees, posees
        // a cote des seances (jamais comptees comme une seance). Pas en colonnes de plateaux.
        events={colonnesDePlateaux ? events : [...bandesDeFermeture, ...events]}
        firstHour={isFacilitySource ? Math.floor(ouvertureDuJour / 60) : undefined}
        laneOf={colonnesDePlateaux ? colonneDuBloc : undefined}
        lanes={colonnesDePlateaux}
        mode={vue}
        onDateChange={vue === VUES.troisJours
          ? (/** @type {Date} */ ancre) => setCurrentDate(addDays(ancre, 1))
          : setCurrentDate}
        onEventPress={handleEventPress}
        onFreeSlotPress={toucherUneHeureLibre}
        onReadOnlyEventPress={handleReadOnlyEventPress}
        // COLL-FIX-PLANNING (T9_C29_2) : dans la semaine tenue droite, une grappe de seances
        // trop serrees ouvre ce jour en vue Jour (tourne, la semaine est imposee).
        onSummaryPress={isFacilitySource && !isLandscape ? () => choisirVue(VUES.jour) : undefined}
        scrollEnabled
        showHeader={false}
        showUntimedSection={false}
      />
    );
    if (!isFacilitySource) return grilleDuPlanning;

    // COLL-C2B (02/10) — design P5, etat 5 : la grille reste et se VOILE pendant la lecture.
    return (
      <View style={{ flex: 1 }}>
        {grilleDuPlanning}
        {isFetching ? (
          <View
            accessibilityState={{ busy: true }}
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              Alignments.alignCenter,
              Alignments.justifyCenter,
              { backgroundColor: withAlpha(Colors.primary900, 0.45), borderRadius: 18 },
            ]}
            testID="planning-voile"
          >
            <Loader />
          </View>
        ) : null}
      </View>
    );
  })();

  // ─── COLL-C4B (02/10) — design P4v3-fermer : la plage touchee, et « Bloquer pour la Ville » ───
  // 🖥️ COLL-C4B-BIS (03/10, « P4v3-fermer-ordi ») : sur ordinateur, le formulaire s ouvre dans le
  // panneau de droite, la semaine reste visible ; le telephone garde l ecran plein
  // (P4v3-fermer-tel).
  const ouvrirLaFermeture = (/** @type {Record<string, any>} */ extra) => {
    if (isDesktop) {
      setFermetureOuverte(null);
      setReadOnlyBlock(null);
      setPanneau({
        closureId: extra.closureId || null,
        date: extra.date || null,
        endTime: extra.endTime || null,
        mode: extra.mode || null,
        startTime: extra.startTime || null,
        type: 'fermeture',
      });
      return;
    }
    /** @type {any} */ (navigation).navigate(RouteNames.CollectiviteFermeture, {
      collectiviteId: managingCollectiviteId,
      facilityId,
      ...extra,
    });
  };
  const ficheDeFermeture = fermetureOuverte ? (
    <View
      style={[Spaces.paddingHorizontal[16], Spaces.paddingBottom[16], { gap: 8 }]}
      testID="planning-fermeture"
    >
      <Text style={[Fonts.p3Bold, { color: Colors.warning500 }]}>
        {closureTagLabel(t, fermetureOuverte)}
      </Text>
      <Text style={[Fonts.h4Bold, Fonts.neutral00]}>{closureDaysLabel(t, fermetureOuverte)}</Text>
      <Text style={[Fonts.p3, Fonts.neutral100]}>
        {[closureHoursLabel(t, fermetureOuverte), fermetureOuverte.label]
          .filter(Boolean)
          .join(' · ')}
      </Text>
      <Button
        onPress={() => {
          setFermetureOuverte(null);
          ouvrirLaFermeture({
            closureId: fermetureOuverte.documentId,
            facilityName: contextDetailLabel,
          });
        }}
        title={t('collectiviteFermetures.liste.modifier', 'Modifier')}
        variant="Secondary"
      />
      <Button
        onPress={() => {
          setFermetureOuverte(null);
          // « Rouvrir » se confirme dans l onglet « Fermetures » de l installation.
          /** @type {any} */ (navigation).navigate(RouteNames.CollectiviteInstallation, {
            collectiviteId: managingCollectiviteId,
            facilityId,
            onglet: 'fermetures',
          });
        }}
        title={t('collectiviteFermetures.liste.rouvrir', 'Rouvrir')}
        variant="Secondary"
      />
      <Button
        onPress={() => setFermetureOuverte(null)}
        title={t('personalPlanningWeekFullscreen.blockSheet.close', 'Fermer')}
        variant="Ghost"
      />
    </View>
  ) : null;

  let panneauRendu = null;
  if (panneau?.type === 'attribuer' || panneau?.type === 'modifier') {
    const titre = panneau.type === 'modifier'
      ? t('collectiviteCreneaux.gerer.modifier', 'Modifier le créneau')
      : panneau.titre || t('collectiviteCreneaux.creneaux.attribuer', 'Attribuer un créneau');
    panneauRendu = (
      <View style={[Spaces.paddingHorizontal[16], Spaces.paddingBottom[16], { gap: 12 }]}>
        <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>{titre}</Text>
        <SeasonSlotForm
          clubs={clubsPourAttribuer}
          compact={panneau.type === 'attribuer' && panneau.compact !== false}
          facilityId={facilityId}
          initial={panneau.initial}
          key={`${panneau.type}-${panneau.titre || panneau.creneau?.documentId || ''}`}
          onCancel={fermerPanneau}
          onDone={fermerPanneau}
          slot={panneau.type === 'modifier' ? panneau.creneau : null}
        />
        {/* COLL-C4B (02/10) — une heure libre : « Bloquer pour la Ville », deja rempli (P5v2). */}
        {panneau.type === 'attribuer' && panneau.date && peutAttribuer ? (
          <Button
            onPress={() => {
              fermerPanneau();
              ouvrirLaFermeture({
                date: panneau.date,
                endTime: panneau.initial?.endTime,
                facilityName: contextDetailLabel,
                mode: 'bloquer',
                startTime: panneau.initial?.startTime,
              });
            }}
            title={t('collectiviteFermetures.form.boutonBloquer', 'Bloquer pour la Ville')}
            variant="Secondary"
          />
        ) : null}
      </View>
    );
  } else if (panneau?.type === 'gerer') {
    panneauRendu = (
      <View style={[Spaces.paddingHorizontal[16], Spaces.paddingBottom[16]]}>
        <SeasonSlotManage
          canManage={peutAttribuer}
          etapeInitiale={panneau.etape || 'detail'}
          installationName={contextDetailLabel}
          key={`gerer-${panneau.creneau?.documentId}`}
          onClose={fermerPanneau}
          onModify={(/** @type {any} */ creneau) => setPanneau({ creneau, type: 'modifier' })}
          slot={panneau.creneau}
        />
      </View>
    );
  } else if (panneau?.type === 'fermeture' && isDesktop && peutAttribuer) {
    // 🖥️ COLL-C4B-BIS : fermer, bloquer, modifier — le panneau de droite (P4v3-fermer-ordi).
    panneauRendu = (
      <View style={Spaces.padding[16]}>
        <PanneauDeFermeture
          closureId={panneau.closureId}
          collectiviteId={managingCollectiviteId}
          date={panneau.date}
          endTime={panneau.endTime}
          facilityId={facilityId}
          facilityName={contextDetailLabel}
          key={`fermeture-${panneau.closureId || panneau.mode || 'fermer'}-${panneau.date || ''}`}
          mode={panneau.mode}
          onCancel={fermerPanneau}
          onDone={fermerPanneau}
          onDraftChange={setBrouillon}
          startTime={panneau.startTime}
        />
      </View>
    );
  }

  // « Trancher » : la file des demandes de la Ville (lot 3a).
  const ouvrirLesDemandes = () => {
    /** @type {any} */ (navigation).navigate(RouteNames.CollectiviteRequests, {
      collectiviteId: managingCollectiviteId,
    });
  };

  // La fiche d un bloc (SPEC §2 C, D15) : une feuille sur telephone, un panneau a droite sur
  // ordinateur (design P5-semaine-ordi : la semaine reste visible).
  const ficheDuBloc = (
    readOnlyBlock ? (
      <View style={[Spaces.gap[8], Spaces.paddingHorizontal[16], Spaces.paddingBottom[16]]}>
        <Text style={[Fonts.p4, Fonts.neutral200]}>
          {t('personalPlanningWeekFullscreen.blockSheet.title', 'Qui occupe l’installation')}
        </Text>
        <Text style={[Fonts.h4Bold, Fonts.neutral00]}>{readOnlyBlock.club?.name || ''}</Text>
        {readOnlyBlock.team?.name ? (
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{readOnlyBlock.team.name}</Text>
        ) : null}
        <Text style={[Fonts.p3, Fonts.neutral100]}>
          {[
            readOnlyBlockDate ? format(readOnlyBlockDate, 'EEEE d MMMM', { locale: fr }) : null,
            getPlanningTimeLabel(readOnlyBlock),
          ].filter(Boolean).join(' · ')}
        </Text>
        {/* COLL-C2B (02/10) — design P5-jour, etat 2 : l ORIGINE de la place (contrat C2A §7). */}
        {/* COLL-C4A2 — « Ecrire aux dirigeants » (D73) : la mairie ecrit en prive au club qui */}
        {/* occupe ce bloc. G4 : la fenetre du bas est hors navigation, l ecran passe la sienne. */}
        {peutAttribuer ? (
          <EcrireAuxDirigeants
            club={readOnlyBlock.club}
            collectiviteId={managingCollectiviteId}
            compact
            navigation={navigation}
            testID="planning-ecrire-aux-dirigeants"
          />
        ) : null}
        {origineDuBloc ? (
          <View style={[Spaces.marginTop[8], { gap: 2 }]}>
            <Text style={[Fonts.p4, Fonts.neutral300]}>
              {t('collectiviteCreneaux.planning.origineTitre', 'Origine de la place')}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral100]}>{origineDuBloc}</Text>
            {readOnlyBlock.raw?.plateau?.name ? (
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {t('collectiviteCreneaux.planning.plateau', 'Plateau : {{nom}}', {
                  nom: readOnlyBlock.raw.plateau.name,
                  ...SANS_ECHAPPEMENT,
                })}
              </Text>
            ) : null}
          </View>
        ) : null}
        <Text style={[Fonts.p2Bold, Fonts.neutral00, Spaces.marginTop[8]]}>
          {t('personalPlanningWeekFullscreen.blockSheet.contactTitle', 'Contact du club')}
        </Text>
        {showsContact ? null : <Loader />}
        {showsContact && readOnlyBlockContact?.email ? (
          <Text
            accessibilityRole="link"
            onPress={() => Linking.openURL(`mailto:${readOnlyBlockContact.email}`)}
            style={[Fonts.p3, Fonts.primary100]}
          >
            {t('personalPlanningWeekFullscreen.blockSheet.email', 'E-mail : {{email}}', {
              email: readOnlyBlockContact.email,
            })}
          </Text>
        ) : null}
        {showsContact && readOnlyBlockContact?.phoneNumber ? (
          <Text
            accessibilityRole="link"
            onPress={() => Linking.openURL(`tel:${readOnlyBlockContact.phoneNumber}`)}
            style={[Fonts.p3, Fonts.primary100]}
          >
            {t('personalPlanningWeekFullscreen.blockSheet.phone', 'Téléphone : {{phone}}', {
              phone: readOnlyBlockContact.phoneNumber,
            })}
          </Text>
        ) : null}
        {showsContact && !hasContact ? (
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t(
              'personalPlanningWeekFullscreen.blockSheet.noContact',
              'Aucun contact renseigné par le club.',
            )}
          </Text>
        ) : null}
        {creneauOuvert ? (
          <View style={{ gap: 4 }}>
            <Button
              onPress={() => {
                setReadOnlyBlock(null);
                setPanneau({ creneau: creneauOuvert, type: 'modifier' });
              }}
              title={t('collectiviteCreneaux.gerer.modifier', 'Modifier le créneau')}
              variant="Secondary"
            />
            <Button
              onPress={() => {
                setReadOnlyBlock(null);
                setPanneau({ creneau: creneauOuvert, etape: 'retirer', type: 'gerer' });
              }}
              title={t('collectiviteCreneaux.gerer.retirer', 'Retirer le créneau')}
              variant="Danger"
            />
          </View>
        ) : null}
        <Button
          onPress={handleCloseReadOnlyBlock}
          title={t('personalPlanningWeekFullscreen.blockSheet.close', 'Fermer')}
          variant="Secondary"
        />
      </View>
    ) : null
  );

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[{ paddingBottom: Math.max(insets.bottom, 8) }]}
      contentWidth="wide"
      responsivePadding
      style={[{ paddingHorizontal: 8 }]}
      withHeaderPadding={false}
    >
      <View style={{ flex: 1, paddingTop: Math.max(insets.top, 4) }}>
        {ongletsDInstallations.length > 1 ? (
          <View style={[Alignments.row, Alignments.wrap, Spaces.marginBottom[8], { gap: 8 }]}>
            {ongletsDInstallations.map((/** @type {any} */ ligne) => {
              const choisie = ligne.documentId === facilityId;
              return (
                <TouchableOpacity
                  accessibilityRole="tab"
                  accessibilityState={{ selected: choisie }}
                  key={ligne.documentId}
                  onPress={() => /** @type {any} */ (navigation).setParams?.({
                    contextDetailLabel: ligne.name || null,
                    facilityId: ligne.documentId,
                  })}
                  style={[
                    Alignments.row,
                    Alignments.alignCenter,
                    Spaces.paddingHorizontal[12],
                    {
                      backgroundColor: choisie
                        ? withAlpha(Colors.primary500, 0.18)
                        : withAlpha(Colors.neutral00, 0.04),
                      borderColor: choisie ? Colors.primary500 : withAlpha(Colors.neutral00, 0.15),
                      borderRadius: 999,
                      borderWidth: 1,
                      gap: 6,
                      minHeight: 36,
                    },
                  ]}
                >
                  <View
                    style={{
                      backgroundColor: ligne.planningColor || Colors.primary500,
                      borderRadius: 999,
                      height: 8,
                      width: 8,
                    }}
                  />
                  <Text style={[Fonts.p3Bold, Fonts.neutral00]}>{ligne.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}
        <View
          style={[
            Alignments.row,
            Alignments.alignCenter,
            Alignments.justifySpaceBetween,
            Spaces.marginBottom[8],
            {
              backgroundColor: 'rgba(255,255,255,0.04)',
              borderColor: `${Colors.primary500}26`,
              borderRadius: 16,
              borderWidth: 1,
              minHeight: 40,
              paddingHorizontal: 6,
              width: '100%',
            },
          ]}
        >
          <TouchableOpacity
            accessibilityLabel={flecheGauche}
            accessibilityRole="button"
            hitSlop={8}
            onPress={handlePrevPage}
            style={{
              alignItems: 'center',
              borderRadius: 10,
              height: 30,
              justifyContent: 'center',
              width: 30,
            }}
          >
            <Image
              resizeMode="contain"
              source={Images.arrowLeft}
              style={{ height: 12, tintColor: Colors.primary500, width: 12 }}
            />
          </TouchableOpacity>

          <View style={{ flex: 1, paddingHorizontal: 6 }}>
            <Text
              numberOfLines={1}
              style={[{
                color: Colors.primary500,
                fontFamily: Fonts?.p3Bold?.fontFamily,
                fontSize: 10,
                letterSpacing: 0.3,
                marginBottom: 1,
                textAlign: 'center',
                textTransform: 'uppercase',
              }]}
            >
              {planningContextDisplayLabel}
            </Text>
            <Text
              numberOfLines={1}
              style={[Fonts.p2Bold, Fonts.neutral00, Fonts.textCenter, { fontSize: 13 }]}
            >
              {pageLabel}
            </Text>
          </View>

          <TouchableOpacity
            accessibilityLabel={flecheDroite}
            accessibilityRole="button"
            hitSlop={8}
            onPress={handleNextPage}
            style={{
              alignItems: 'center',
              borderRadius: 10,
              height: 30,
              justifyContent: 'center',
              width: 30,
            }}
          >
            <Image
              resizeMode="contain"
              source={Images.arrowRight}
              style={{ height: 12, tintColor: Colors.primary500, width: 12 }}
            />
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityLabel={t(
              'personalPlanningWeekFullscreen.closeTheFullScreenPlanning',
              'Fermer le planning plein écran',
            )}
            accessibilityRole="button"
            hitSlop={8}
            onPress={handleClose}
            style={{
              alignItems: 'center',
              backgroundColor: 'rgba(255,255,255,0.04)',
              borderColor: `${Colors.primary500}66`,
              borderRadius: 12,
              borderWidth: 1,
              height: 30,
              justifyContent: 'center',
              marginLeft: 6,
              width: 30,
            }}
          >
            <Image
              source={Images.close}
              style={{ height: 12, tintColor: Colors.neutral00, width: 12 }}
            />
          </TouchableOpacity>
          {!isCurrentPage ? (
            <TouchableOpacity
              accessibilityLabel={isLandscape
                ? t(
                  'personalPlanningWeekFullscreen.backToTheCurrentWeek',
                  'Revenir à la semaine actuelle',
                )
                : t('personalPlanningWeekFullscreen.backToToday', 'Revenir à aujourd’hui')}
              accessibilityRole="button"
              hitSlop={8}
              onPress={handleBackToCurrentWeek}
              style={{
                alignItems: 'center',
                backgroundColor: 'rgba(1,179,244,0.14)',
                borderColor: `${Colors.primary500}66`,
                borderRadius: 12,
                borderWidth: 1,
                height: 30,
                justifyContent: 'center',
                marginLeft: 6,
                minWidth: 86,
                paddingHorizontal: 10,
              }}
            >
              <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
                {t('personalPlanningWeekFullscreen.today', 'Aujourd’hui')}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {isFacilitySource && !(isLandscape && Platform.OS !== 'web') ? (
          <View style={[Alignments.row, Spaces.marginBottom[8], { gap: 6 }]}>
            {vuesProposees(Platform.OS).map((option) => {
              const active = option === vue;
              return (
                <TouchableOpacity
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  key={option}
                  onPress={() => choisirVue(option)}
                  style={[
                    Alignments.alignCenter,
                    Alignments.justifyCenter,
                    {
                      backgroundColor: active ? withAlpha(Colors.primary500, 0.18) : 'transparent',
                      borderColor: active ? Colors.primary500 : withAlpha(Colors.neutral00, 0.12),
                      borderRadius: 10,
                      borderWidth: 1,
                      flex: 1,
                      minHeight: 36,
                    },
                  ]}
                  testID={`vue-${option}`}
                >
                  <Text
                    numberOfLines={1}
                    style={[Fonts.p3Bold, active ? Fonts.primary200 : Fonts.neutral200]}
                  >
                    {libellesDesVues[option]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        {!isLandscape ? (
          <Text style={[Fonts.p4, Fonts.neutral200, Fonts.textCenter, Spaces.marginBottom[8]]}>
            {t(
              'personalPlanningWeekFullscreen.rotateForWeek',
              'Téléphone à l’horizontale : toute la semaine.',
            )}
          </Text>
        ) : null}

        {isFacilitySource && facilityPlanningSummary ? (
          <View style={[Spaces.marginBottom[8], { gap: 6 }]}>
            {/* COLL-C4B (02/10) — la fermeture de la page, pour TOUS les lecteurs (P3b). */}
            <FacilityClosureBanner
              closure={Array.isArray(data?.meta?.closures) ? data.meta.closures[0] : null}
              testID="planning-bandeau-fermeture"
              withDays
            />
            {ligneDeCapacite ? (
              <View style={[Alignments.row, Alignments.alignCenter, { gap: 8 }]}>
                <RondsDePlaces
                  capacite={ligneDeCapacite.capacite}
                  pleine={ligneDeCapacite.plein}
                  prises={ligneDeCapacite.pic}
                />
                <Text
                  style={[
                    Fonts.p3Bold,
                    ligneDeCapacite.plein ? Fonts.warning500 : Fonts.success500,
                    { flexShrink: 1 },
                  ]}
                >
                  {ligneDeCapacite.texte}
                </Text>
              </View>
            ) : null}
            {/* Un dirigeant ou un entraineur garde la phrase qui lui dit ce que devient un */}
            {/* depassement (COLL1D) ; la mairie, qui tranche, lit « n demandes » plus bas. */}
            {readsAsOrganizer && !managingCollectiviteId && facilitySummaryMessage ? (
              <Text style={[Fonts.p4, Fonts.neutral200]}>{facilitySummaryMessage}</Text>
            ) : null}
            {/* COLL-C3B (02/10) — « Demander un creneau » (P8v2) : le club demande a la Ville. */}
            {peutDemander ? (
              <Button
                onPress={() => demanderA(currentDate, null)}
                size="sm"
                title={t('collectiviteDemandes.club.demanderCeCreneau', 'Demander un créneau')}
                variant="Secondary"
              />
            ) : null}
            {legende.length ? (
              <View style={[Alignments.row, Alignments.wrap, { columnGap: 12, rowGap: 4 }]}>
                {legende.map((element, index) => (
                  <View
                    key={`legende-${index + 1}`}
                    style={[Alignments.row, Alignments.alignCenter, { gap: 6 }]}
                  >
                    <View
                      style={{
                        backgroundColor: element.couleur,
                        borderRadius: 999,
                        height: 8,
                        width: 8,
                      }}
                    />
                    <Text style={[Fonts.p4, Fonts.neutral200]}>{element.libelle}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {nombreEnAttente ? (
              <View
                style={[
                  Alignments.row,
                  Alignments.alignCenter,
                  Spaces.paddingHorizontal[12],
                  {
                    backgroundColor: withAlpha(Colors.warning500, 0.08),
                    borderColor: withAlpha(Colors.warning500, 0.35),
                    borderRadius: 12,
                    borderWidth: 1,
                    gap: 8,
                  },
                ]}
              >
                <Text style={[Fonts.p3, Fonts.neutral100, { flex: 1 }]}>{ligneEnAttente}</Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={ouvrirLesDemandes}
                  style={{ justifyContent: 'center', minHeight: 44 }}
                >
                  <Text style={[Fonts.p3Bold, Fonts.primary200]}>
                    {t('collectiviteCreneaux.planning.trancher', 'Trancher')}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ) : null}

        {!isFacilitySource && facilityPlanningSummary ? (
          <View
            style={[
              ApplicationStyle.borderRadius16,
              ApplicationStyle.borderWidth1,
              Spaces.padding[12],
              Spaces.marginBottom[8],
              Spaces.gap[8],
              {
                backgroundColor: 'rgba(4, 31, 44, 0.88)',
                borderColor: `${facilityPlanningSummary.facilityColor}66`,
              },
            ]}
          >
            <View>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {t('facilityList.planning.capacityTitle', 'Capacité installation')}
              </Text>
              <Text style={[Fonts.p4, Fonts.neutral200]}>
                {facilityMeta?.name || t('facilityList.planning.selectedFacility', 'Installation sélectionnée')}
              </Text>
            </View>

            <View style={[Alignments.row, Alignments.wrap, Spaces.gap[8]]}>
              {[
                // PLANNING-PORTRAIT (01/10) — « 2 slots » et « Pic 2/2 » etaient du jargon
                // (COLL1D les cachait au seul membre) : des mots francais, pour tous, ceux
                // de la maquette de l'ecran 10 (« 2 equipes a la fois »).
                t(
                  'personalPlanningWeekFullscreen.slots',
                  {
                    count: facilityPlanningSummary.maxSlots,
                    defaultValue_one: '{{count}} équipe à la fois',
                    defaultValue_other: '{{count}} équipes à la fois',
                  },
                ),
                t(
                  'personalPlanningWeekFullscreen.peak',
                  'Au plus chargé : {{peak}} sur {{max}}',
                  {
                    max: facilityPlanningSummary.maxSlots,
                    peak: facilityPlanningSummary.peakConcurrent,
                  },
                ),
                t(
                  'personalPlanningWeekFullscreen.events',
                  {
                    count: facilityPlanningSummary.eventCount,
                    defaultValue_one: '{{count}} événement',
                    defaultValue_other: '{{count}} événements',
                  },
                ),
              ].map((label, index) => (
                <View
                  key={`${label}-${index + 1}`}
                  style={[
                    ApplicationStyle.borderRadius100,
                    ApplicationStyle.borderWidth1,
                    Spaces.paddingHorizontal[8],
                    Spaces.paddingVertical[4],
                    {
                      backgroundColor: index === 1
                        ? `${facilityPlanningSummary.facilityColor}22`
                        : 'rgba(255,255,255,0.05)',
                      borderColor: index === 1
                        ? `${facilityPlanningSummary.facilityColor}66`
                        : `${Colors.primary500}33`,
                    },
                  ]}
                >
                  <Text
                    style={[
                      Fonts.p4Bold,
                      index === 1 ? { color: facilityPlanningSummary.facilityColor } : Fonts.primary100,
                    ]}
                  >
                    {label}
                  </Text>
                </View>
              ))}
            </View>

            <Text
              style={[
                Fonts.p4,
                facilityPlanningSummary.reachedCapacity ? Fonts.warning500 : Fonts.neutral200,
              ]}
            >
              {facilitySummaryMessage}
            </Text>
          </View>
        ) : null}

        <View style={{ flex: 1, flexDirection: isDesktop ? 'row' : 'column', gap: 16 }}>
          <View style={{ flex: 1 }}>
            {planningContent}
          </View>
          {isDesktop && (readOnlyBlock || panneauRendu || ficheDeFermeture) ? (
            <ScrollView
              style={{
                backgroundColor: withAlpha(Colors.primary800, 0.85),
                borderColor: withAlpha(Colors.neutral00, 0.1),
                borderRadius: 24,
                borderWidth: 1,
                flexGrow: 0,
                width: 380,
              }}
            >
              {panneauRendu || ficheDeFermeture || ficheDuBloc}
            </ScrollView>
          ) : null}
        </View>
      </View>

      <BottomModal
        close={handleCloseReadOnlyBlock}
        isVisible={Boolean(readOnlyBlock) && !isDesktop}
      >
        {ficheDuBloc}
      </BottomModal>
      <BottomModal close={fermerPanneau} isVisible={Boolean(panneauRendu) && !isDesktop}>
        {panneauRendu}
      </BottomModal>
      <BottomModal
        close={() => setFermetureOuverte(null)}
        isVisible={Boolean(ficheDeFermeture) && !isDesktop}
      >
        {ficheDeFermeture}
      </BottomModal>
    </ScreenContainer>
  );
}

export default PlanningWeekFullscreen;
