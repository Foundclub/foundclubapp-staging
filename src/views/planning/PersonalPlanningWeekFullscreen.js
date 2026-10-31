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
  Suspense, useCallback, useEffect, useMemo, useRef, useState,
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
  blocsDesEvenements,
  fermeturesSansLesEvenements,
} from '@/domains/collectivite/evenementDeLaVille';
import { withViewerChildrenTitles } from '@/domains/event/viewerChildren';
import {
  closureBandLabel,
  closureBandsForRange,
  closureCoversDay,
  closureDaysLabel,
  closureHoursLabel,
  closuresOfBanner,
  closureTagLabel,
  closureTouchesBlock,
} from '@/domains/facilityClosure/facilityClosureDisplay';
import { hoursLabel, shortDay } from '@/domains/relocation/relocationDisplay';
import {
  capitalize,
  finDuCreneau,
  fromMinutes,
  fullMomentsOfPlanning,
  isoWeekdayOf,
  momentLabel,
  slotWho,
  timeRange,
  toMinutes,
  weekdayName,
} from '@/domains/seasonSlot/seasonSlotDisplay';
import { creneauxEnVacances, vacancesDeLaPage } from '@/domains/seasonSlot/seasonSlotHolidays';
import { formeEnMots } from '@/domains/seasonSlot/seasonSlotWhen';
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
// R17-EVT-1-BIS (c) : le formulaire de l evenement de la Ville, charge a la demande.
import EvenementDeLaVilleForm
  from '@/components/organisms/evenementVille/EvenementVilleFormDiffere';
import SeasonSlotForm from '@/components/organisms/seasonSlot/SeasonSlotForm';
import SeasonSlotManage from '@/components/organisms/seasonSlot/SeasonSlotManage';
import ScreenContainer from '@/components/templates/ScreenContainer';
import ClubSlotRequest from '@/views/collectivite/ClubSlotRequest';
import { PanneauDeFermeture } from '@/views/collectivite/CollectiviteFermeture';
import EcrireAuxDirigeants from '@/views/collectivite/components/EcrireAuxDirigeants';

import { RouteNames } from '@/navigation/routeNames';

import { useGestesEvenementDeLaVille } from '@/services/collectivite/collectiviteEvenementQueries';
import {
  useCollectiviteClubs,
  useCollectiviteInstallations,
  useManagingCollectivite,
  useMyCollectivites,
} from '@/services/collectivite/collectiviteQueries';
import {
  getClubPlanning,
  getMyPlanning,
} from '@/services/event/eventService';
import { useClubCollectiviteFacilities } from '@/services/facility/facilityQueries';
import { getFacilityPlanning } from '@/services/facility/facilityService';
import { useFacilityClosures } from '@/services/facilityClosure/facilityClosureQueries';
import {
  getClubSharedPlanning,
  getCMPlanning,
} from '@/services/multisportClub/multisportClubService';
import { useFacilitySeasonSlots } from '@/services/seasonSlot/seasonSlotQueries';

import {
  lockToPortrait,
  unlockAllOrientations,
} from '@/utils/device/orientation';
import {
  FACILITY_CONFLICT_MODES,
  getFacilityConflictMode,
} from '@/utils/facilityConflictMode';
import { assignClubPlanningColors } from '@/utils/facilityPlanningColor';
import { toParisIsoFromLocalSelection } from '@/utils/parisTime';
import {
  aTrancherParLaVille,
  etatDeLaDemande,
  ligneDesDemandesEnAttente,
  lireVueRetenue,
  pageDAujourdhui,
  pageSuivante,
  plageDeLaVue,
  retenirVue,
  vueParDefaut,
  VUES,
  vuesProposees,
} from '@/utils/planning/installationPlanningViews';
import {
  getPlanningDefaultDate,
  getPlanningItemDate,
  getPlanningItemWindow,
  getPlanningPeakOccupancy,
  getPlanningRange,
  getPlanningTimeLabel,
  normalizePlanningItems,
} from '@/utils/planning/planningSlots';

import useVueInitiale from '@/hooks/useVueInitiale';
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
  withChildren = false,
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
      // PARENT-PLANNING (06/10, « calendrier B ») : un parent (parametre `withChildren`, pose par
      // « Mon planning ») voit AUSSI les creneaux a venir de ses enfants.
      return {
        enabled: true,
        queryFn: () => getMyPlanning(
          withChildren ? { ...planningRange, withChildren: true } : planningRange,
        ),
        queryKey: [
          'planning', 'fullscreen', 'personal', planningRange.from, planningRange.to,
          ...(withChildren ? ['withChildren'] : []),
        ],
      };
  }
};

/**
 * @typedef {import('@react-navigation/native').NavigationProp<{
 *   EventStack: import('@react-navigation/native').NavigatorScreenParams<{
 *     EventDetails: { eventId: string },
 *     EventEdit: { as?: string, eventId: string, mode?: string },
 *   }>,
 * }>} PlanningEventNavigation
 */

/**
 * Dedicated fullscreen week-planning screen.
 * @returns {import('react').ReactElement}
 */
function PlanningWeekFullscreen() {
  /** @type {PlanningEventNavigation} */
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
  const withChildren = /** @type {{ withChildren?: boolean } | undefined} */ (route?.params)
    ?.withChildren === true;

  const [currentDate, setCurrentDate] = useState(getInitialDate(route?.params?.date));
  // 🗓️ R17-VUE (19/10, REC17-010) — la vue a l arrivee ne se decide que pour un plein ecran
  // ouvert sur AUJOURD HUI ; ouvert sur une autre date, il garde cette date et sa vue.
  const [arriveeAujourdhui] = useState(() => isSameDay(currentDate, getPlanningDefaultDate()));
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
  // R17-VUE : arrivee sur aujourd hui, la regle passe AVANT la vue retenue (lue apres la decision).
  const [vueChoisie, setVueChoisie] = useState(() => (isFacilitySource && arriveeAujourdhui
    ? vueParDefaut(Platform.OS)
    : lireVueRetenue(Platform.OS)));
  // R17-VUE : la vue decidee a l arrivee (semaine, mois) sur les plannings sans choix de vue
  // (perso, club, omnisport) ; elle tombe quand le telephone tourne (la base redevient la sienne).
  const [vueImposee, setVueImposee] = useState(/** @type {string | null} */ (null));
  /** @type {string} */
  let vueDeBase = isLandscape ? VUES.semaine : VUES.jour;
  if (isFacilitySource) {
    vueDeBase = isLandscape && Platform.OS !== 'web' ? VUES.semaine : vueParDefaut(Platform.OS);
  }
  /** @type {string} */
  let vue = vueImposee || vueDeBase;
  if (isFacilitySource) {
    vue = isLandscape && Platform.OS !== 'web' ? VUES.semaine : vueChoisie;
  }

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
      : getPlanningRange(currentDate, vue === VUES.mois ? 'month' : 'week')),
    [currentDate, isFacilitySource, vue],
  );
  const planningQuery = useMemo(() => getPlanningQuery({
    clubId,
    cmId,
    facilityId,
    planningRange,
    sectionId,
    sourceType,
    withChildren,
  }), [clubId, cmId, facilityId, planningRange, sectionId, sourceType, withChildren]);
  const {
    data,
    error,
    isFetching,
    isLoading,
    isPlaceholderData,
    refetch,
  } = useQuery({
    staleTime: PERSONAL_PLANNING_STALE_MS,
    // COLL-C2B (02/10) — design P5, etat « chargement » : la grille d une installation RESTE
    // (voilee) pendant la lecture d une autre semaine ; avant, une roue remplacait tout.
    ...(isFacilitySource ? { placeholderData: keepPreviousData } : {}),
    ...planningQuery,
  });

  // 🗓️ R17-VUE (19/10, REC17-010) — jour vide ⇒ la semaine ; semaine vide mais un evenement plus
  // tard ⇒ le mois de ce prochain evenement (UNE lecture bornee, la meme source) ; sinon la base.
  // Installation : la vue retenue sur l appareil ne sert que si la regle garde la base (et la
  // decision n est jamais retenue : seul un choix fait a la main l est).
  const lectureDeLaSuite = useMemo(() => ({
    queryFn: (/** @type {{ from: string, to: string }} */ plage) => getPlanningQuery({
      clubId, cmId, facilityId, planningRange: plage, sectionId, sourceType, withChildren,
    }).queryFn(),
    queryKey: [
      'planning', 'fullscreen', 'suite', sourceType, clubId, cmId, facilityId, sectionId,
      withChildren,
    ],
  }), [clubId, cmId, facilityId, sectionId, sourceType, withChildren]);
  const appliquerLaVue = useCallback((/** @type {{ date: Date, vue: string }} */ decision) => {
    if (isFacilitySource) {
      setVueChoisie(decision.vue === vueDeBase ? lireVueRetenue(Platform.OS) : decision.vue);
    } else if (decision.vue !== vueDeBase) {
      setVueImposee(decision.vue);
    }
    if (decision.vue !== vueDeBase) setCurrentDate(decision.date);
  }, [isFacilitySource, vueDeBase]);
  const { enDecision, garderLeChoix } = useVueInitiale({
    actif: arriveeAujourdhui && planningQuery.enabled && !error,
    appliquer: appliquerLaVue,
    evenements: data && !isPlaceholderData ? (data.data || []) : undefined,
    lectureDeLaSuite,
    vueDeBase,
  });
  const choisirVue = useCallback((/** @type {string} */ nouvelle) => {
    garderLeChoix();
    if (!isFacilitySource) {
      setVueImposee(nouvelle);
      return;
    }
    setVueChoisie(nouvelle);
    retenirVue(nouvelle);
  }, [garderLeChoix, isFacilitySource]);
  // Le telephone tourne : la vue imposee tombe, et un choix fait avant la decision l emporte.
  const orientationVue = useRef(isLandscape);
  useEffect(() => {
    if (orientationVue.current === isLandscape) return;
    orientationVue.current = isLandscape;
    garderLeChoix();
    setVueImposee(null);
  }, [garderLeChoix, isLandscape]);

  // COLL1D — le texte de capacite parle a CELUI qui lit : les « depassements » et les
  // « demandes en attente » ne regardent que ceux qui posent des evenements (entraineur,
  // dirigeant) ; un joueur ou un parent lit ce qui est libre.
  // PLANNING-PORTRAIT (01/10) — ET celui qui GERE l'installation : un agent de mairie dont
  // le compte est « joueur » lisait le texte du membre. C'est le serveur qui dit qu'il la
  // gere (ses collectivites, puis leurs installations), jamais le role du compte.
  const { canManageEvent, userData } = /** @type {any} */ (useAuth()) || {};
  // COL-009 : `gestionConnue` — la reponse est sure (lectures revenues sans erreur).
  const {
    collectiviteId: managingCollectiviteId,
    connue: gestionConnue,
  } = useManagingCollectivite(facilityId, {
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
  // PARENT-PLANNING : le prenom de l enfant sur ses creneaux (les autres sources n en portent pas).
  const normalizedEvents = useMemo(
    () => withViewerChildrenTitles(normalizePlanningItems(data?.data || []), t),
    [data, t],
  );
  // 🎨 COLL-R-A6 (13/10, COL-019, D13 A) : la liste des clubs de la Ville est lue dès que la Ville
  // GÈRE l'installation (avant : seulement en ouvrant un bloc) — l'ordre de cette liste donne à
  // chaque club SA couleur, la même chaque semaine et dans « Créneaux » (même requête, même ordre).
  const attachedClubs = useCollectiviteClubs(managingCollectiviteId);
  const clubsDeLaVille = Array.isArray(attachedClubs.data) ? attachedClubs.data : null;
  // 🖥️ COLL-C4B-BIS (03/10, « P4v3-fermer-ordi ») — la fermeture EN SAISIE dans le panneau de
  // droite (ordinateur) : « le jour ferme se hachure pendant la saisie, et les seances touchees se
  // cernent d orange ». Rien n est ecrit tant que la mairie n a pas confirme.
  const [brouillon, setBrouillon] = useState(/** @type {any} */ (null));
  // 🏛️ COLL-R-APP-PLANNING (COL-014) — l instant de la regle « a trancher par la Ville », LE MEME
  // pour la grille, le bandeau, la legende et la liste de ce rendu. Relu a chaque rendu : une
  // demande dont l heure passe pendant que la page est ouverte cesse d etre comptee au suivant.
  const instantDuRendu = Date.now();
  const events = useMemo(() => {
    if (!isFacilitySource) return normalizedEvents;
    const maintenant = new Date(instantDuRendu);
    return assignClubPlanningColors(
      normalizedEvents,
      clubsDeLaVille,
    ).map((/** @type {any} */ evenement) => {
      const brut = evenement.raw || {};
      const duClubDuLecteur = Boolean(evenement.documentId) || brut.isOwnClub === true;
      // COL-014 : une demande restee sans reponse et dont l heure est passee reste DESSINEE (T05 :
      // rien n est detruit), en gris ; « en attente » ne dit plus que ce que la Ville peut trancher
      // (une seance qui attend SON DIRIGEANT, D32, n est pas une demande a la Ville).
      const etatDemande = etatDeLaDemande(evenement, maintenant);
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
        displayColor: (readsAsOrganizer || duClubDuLecteur) && etatDemande !== 'datePassee'
          ? evenement.displayColor
          : Colors.neutral500,
        // COLL-C3B (02/10) — et le club qui DEMANDE voit sa demande « en attente de la mairie »,
        // a sa place (P8v2-demande, etat 4 : « Comme dans ton planning »).
        participationStatus: (readsAsOrganizer || duClubDuLecteur) && etatDemande === 'aTrancher'
          ? 'pending'
          : evenement.participationStatus,
      };
    });
  }, [Colors.neutral500, brouillon, clubsDeLaVille, instantDuRendu, isFacilitySource,
    normalizedEvents, readsAsOrganizer]);
  const hasEvents = events.length > 0;
  // SPEC Collectivites §2 C : la mairie touche le bloc d'un AUTRE club -> une fiche en
  // lecture (club, equipe, horaires, contact GENERAL du club, D15). Pour tout autre
  // lecteur, ce bloc reste inerte (FINITIONS2).
  const [readOnlyBlock, setReadOnlyBlock] = useState(/** @type {any} */ (null));
  // COLL-C4B (02/10) — la plage FERMEE ou BLOQUEE que la mairie a touchee (Modifier, Rouvrir).
  const [fermetureOuverte, setFermetureOuverte] = useState(/** @type {any} */ (null));
  // COLL-C2B (02/10) — ce que la mairie a ouvert : « attribuer », « gerer » ou « modifier ».
  const [panneau, setPanneau] = useState(/** @type {any} */ (null));
  // COLL-C3B-BIS (planche 43) — la place que le club est en train de DEMANDER dans le panneau.
  const [brouillonDemande, setBrouillonDemande] = useState(/** @type {any} */ (null));
  // COLL-FIX-PLANNING (G4) — ces trois fenetres du bas s affichent par un PORTAIL pose AU-DESSUS
  // de la navigation : en quittant l ecran (Ecrire aux dirigeants, Modifier, une seance), elles
  // resteraient par-dessus l ecran suivant. Elles se ferment quand l ecran perd la main (« blur »).
  useEffect(() => /** @type {any} */ (navigation).addListener?.('blur', () => {
    setReadOnlyBlock(null);
    setFermetureOuverte(null);
    setPanneau(null);
  }), [navigation]);
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
  // COLL-C3B-BIS (planche 43, état A) — pendant la saisie dans le panneau, la place DEMANDÉE se
  // dessine dans la grille comme une demande en attente : pointillé orange, « U13 ? ».
  const evenementsAffiches = useMemo(() => {
    if (!brouillonDemande || brouillonDemande.facilityId !== facilityId) return events;
    const [annee, mois, jourDuMois] = String(brouillonDemande.date).split('-').map(Number);
    const instant = (/** @type {string} */ heure) => {
      const [h, m] = String(heure).split(':').map(Number);
      return toParisIsoFromLocalSelection(new Date(annee, mois - 1, jourDuMois, h, m, 0, 0));
    };
    const titre = `${brouillonDemande.equipe || '…'} ?`;
    const [place] = normalizePlanningItems([{
      brouillon: true,
      club: { documentId: userData?.club?.documentId || null, name: userData?.club?.name || '' },
      documentId: null,
      endAt: instant(brouillonDemande.endTime),
      endTime: `${brouillonDemande.endTime}:00.000`,
      facility: { documentId: facilityId, name: contextDetailLabel },
      hasExplicitTime: true,
      kind: 'event',
      origin: 'request',
      pending: true,
      startAt: instant(brouillonDemande.startTime),
      startTime: `${brouillonDemande.startTime}:00.000`,
      team: { name: titre },
      title: titre,
    }]);
    if (!place) return events;
    return [
      ...events,
      { ...place, displayColor: Colors.warning500, participationStatus: 'pending' },
    ];
  }, [
    brouillonDemande, Colors.warning500, contextDetailLabel, events, facilityId, userData?.club,
  ]);
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
  let pageLabel = vue === VUES.semaine
    ? weekLabel
    : format(currentDate, 'EEEE d MMMM yyyy', { locale: fr });
  // R17-VUE : le mois du prochain evenement (plannings perso, club, omnisport).
  if (vue === VUES.mois) pageLabel = capitalize(format(currentDate, 'MMMM yyyy', { locale: fr }));
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
  // « Aujourd'hui » ramene a la page du jour : la semaine en paysage, le jour en portrait (et,
  // R17-VUE, la semaine ou le mois decides a l arrivee).
  const isCurrentPage = pageDAujourdhui(vue, currentDate, getPlanningDefaultDate());
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
  // COL-014 : la regle de la liste « En attente » (T05), pas toute place `pending`.
  const blocsEnAttente = readsAsOrganizer
    ? blocsDeLaPage.filter((bloc) => aTrancherParLaVille(bloc, new Date(instantDuRendu)))
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
      && (Array.isArray(data?.meta?.closures) ? data.meta.closures : []).some((/** @type {any} */ fermeture) => (
        fermeture?.kind !== 'block'
        && closureCoversDay(fermeture, format(currentDate, 'yyyy-MM-dd'))
      ));
    // CORR-COLLECTIVITES 106 (31/10, Adel A) : une fermeture dans la plage affichée ; la semaine
    // n est pas « libre toute la semaine ».
    const debutPlage = String(planningRange.from).slice(0, 10);
    const finPlage = String(planningRange.to).slice(0, 10);
    const fermetureDansLaPlage = vue !== VUES.jour
      && (Array.isArray(data?.meta?.closures) ? data.meta.closures : []).some((/** @type {any} */ fermeture) => (
        fermeture?.kind !== 'block'
        && fermeture?.startDate
        && fermeture?.endDate
        && fermeture.startDate <= finPlage
        && debutPlage <= fermeture.endDate
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
      if (vue === VUES.jour) suite = t('collectiviteCreneaux.planning.libreJour', 'libre toute la journée');
      else if (fermetureDansLaPlage) {
        suite = t('collectiviteCreneaux.planning.libreHorsFermeture', 'libre en dehors de la fermeture');
      } else suite = t('collectiviteCreneaux.planning.libreSemaine', 'libre toute la semaine');
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
  }, [blocsDeLaPage, currentDate, data?.meta?.closures, facilityPlanningSummary, isFacilitySource, planningRange.from, planningRange.to, readsAsOrganizer, t, vue]);
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
  // FINITIONS13-COLL (04/10) : la période de la VUE (T13 : « cette semaine » en vue Mois).
  const ligneEnAttente = ligneDesDemandesEnAttente(t, vue, nombreEnAttente);
  // 📱 COLL-R-APP-PLANNING (12/10, COL-009) — TELEPHONE COUCHE (hors site), planche validee
  // P5-semaine-paysage et remede « G43 B » : UNE barre compacte (fleches, nom, dates, ligne de
  // capacite, croix), puis la grille ; le bandeau, la legende, la phrase, le bouton et la ligne des
  // demandes sont replies (ils prenaient ~60 % de la hauteur : une heure de grille, capture S12).
  const barreCompacte = isFacilitySource && isLandscape && Platform.OS !== 'web';
  // La phrase du dirigeant : une fois SUR que le compte ne gere pas l installation (compte double).
  // Incident 13 : places libres, la ligne de capacite le dit deja (deux lignes disaient « 1 place
  // libre ») ; complet, elle dit ce que devient un depassement.
  const phraseDuDirigeant = readsAsOrganizer && gestionConnue && !managingCollectiviteId
    && Boolean(facilitySummaryMessage)
    && (Boolean(facilityPlanningSummary?.reachedCapacity) || !ligneDeCapacite);
  // Contrat C2A §7 : d ou vient la place (creneau attribue, demande, seance du club).
  const origineDe = (/** @type {any} */ bloc) => {
    const brut = bloc?.raw || {};
    if (brut.origin === 'slot') {
      if (brut.slot?.source === 'request') {
        // R17-QUAND-1 : la forme de la série acceptée (« 1 sem. sur 2 », « 4 dates »).
        return t(
          'collectiviteCreneaux.planning.origineDemandeSerie',
          'Demande acceptée ({{rythme}})',
          { rythme: formeEnMots(t, brut.slot, { court: true }), ...SANS_ECHAPPEMENT },
        );
      }
      // FINITIONS15 point 3 (T14) : une SÉANCE du club posée dans le créneau en prend la place avec
      // SES heures (le serveur la rend `origin: 'slot'`, `kind` de séance) ; le créneau seul est
      // `kind: 'slot'`, à ses heures. « Créneau attribué » sous 18:00 – 19:00, pour un créneau de
      // 17:30 – 19:00, faisait croire à deux heures pour le même créneau.
      const seanceDansLeCreneau = Boolean(brut.kind) && brut.kind !== 'slot';
      return t(
        seanceDansLeCreneau
          ? 'collectiviteCreneaux.planning.origineSeanceDansCreneau'
          : 'collectiviteCreneaux.planning.origineCreneau',
        seanceDansLeCreneau
          ? 'Séance du club dans son créneau : {{rythme}}, du {{debut}} au {{fin}}'
          : 'Créneau attribué : {{rythme}}, du {{debut}} au {{fin}}',
        {
          debut: brut.slot?.validFrom
            ? format(parseISO(brut.slot.validFrom), 'd MMM', { locale: localeDesDates() })
            : '',
          // FINITIONS12-COLL : le dernier jour où il a lieu (retiré : la veille ; T11, C23).
          fin: finDuCreneau(brut.slot)
            ? format(parseISO(String(finDuCreneau(brut.slot))), 'd MMM', {
              locale: localeDesDates(),
            })
            : '',
          jour: weekdayName(brut.slot?.weekday).toLocaleLowerCase(),
          // R17-QUAND-1 : « chaque mardi », « un mercredi sur deux », ou ses dates.
          rythme: formeEnMots(t, brut.slot),
          ...SANS_ECHAPPEMENT,
        },
      );
    }
    if (brut.origin === 'request') {
      // COL-014 : restee sans reponse et passee, elle ne se tranche plus (T05).
      if (etatDeLaDemande(bloc, new Date(instantDuRendu)) === 'datePassee') {
        return t(
          'collectiviteCreneaux.planning.nonTrancheeDatePassee',
          'Non tranchée, date passée',
        );
      }
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
  // 🏛️ R17-EVT-1 (20/10, REC17-005) — les evenements de la Ville sur CETTE installation
  // (`meta.evenementsDeLaVille`) : un bloc CLAIR par jour ; leur blocage lie ne se dessine pas en
  // plus.
  const evenementsDeLaVille = isFacilitySource && Array.isArray(data?.meta?.evenementsDeLaVille)
    ? data.meta.evenementsDeLaVille
    : [];
  const fermeturesADessiner = fermeturesSansLesEvenements(fermeturesDuServeur, evenementsDeLaVille);
  // COLL-C4B-BIS (03/10), point 6 — LE BANDEAU suit la periode concernee (P3b-actu-tel ecran 6 :
  // « tant que la fermeture dure ou approche ») : la fermeture de la page d abord, sinon celle que
  // le serveur annonce (`meta.bandeau` : en cours, ou dans les 14 jours). Pour TOUS les lecteurs —
  // le membre d un club rattache lit la ; avant, seule la fermeture de la page s y disait.
  const fermeturesDeLInstallation = useFacilityClosures(isFacilitySource ? facilityId : null);
  // FINITIONS13-COLL (04/10) — TOUTES : celles de la page, puis celles que le serveur annonce
  // (`meta.bandeaux`), chacune une fois (tournée T13 : celle du 15 restait cachée par celle du 10).
  /** @type {any[]} */
  const fermeturesAnnoncees = [
    ...fermeturesDuServeur,
    ...closuresOfBanner(fermeturesDeLInstallation.data?.meta),
  ];
  const fermeturesDuBandeau = fermeturesAnnoncees.filter((fermeture, rang) => (
    !fermeture?.documentId
    || fermeturesAnnoncees.findIndex((autre) => autre?.documentId === fermeture.documentId) === rang
  ));
  const fermeturesDessinees = brouillon
    ? [
      ...fermeturesADessiner.filter((/** @type {any} */ fermeture) => !brouillon.documentId
        || fermeture?.documentId !== brouillon.documentId),
      { ...brouillon, enSaisie: true },
    ]
    : fermeturesADessiner;
  // 🌴 R17-QUAND-2 (planche P11-quand-ou-ca-vit, 5) — LES VACANCES SCOLAIRES de la zone que la page
  // montre (`meta.holidays`, serveur) : un bandeau violet, jamais confondu avec une fermeture, pour
  // tous les lecteurs. En vue Jour, le seul jour affiché ; sinon la période lue.
  const jourAffiche = format(currentDate, 'yyyy-MM-dd');
  const vacancesDeLaZone = isFacilitySource ? data?.meta?.holidays : null;
  const vacancesAffichees = vue === VUES.jour
    ? vacancesDeLaPage(vacancesDeLaZone, jourAffiche, jourAffiche)
    : vacancesDeLaPage(vacancesDeLaZone, planningRange.from, planningRange.to);
  // Les occurrences retirées sont absentes du planning. La lecture existante des séries
  // retrouve leur équipe ; elle reste réservée à la Ville et aux pages de vacances.
  const seriesDeLInstallation = useFacilitySeasonSlots(
    peutAttribuer && vacancesAffichees.length ? facilityId : null,
  );
  const absencesScolaires = (/** @type {string} */ jour) => (
    creneauxEnVacances(seriesDeLInstallation.data?.data, jour)
  );
  const ouvrirVacances = (
    /** @type {Date} */ jour,
    /** @type {number} */ debut,
    /** @type {number} */ fin,
    /** @type {number | null} */ plateau,
  ) => {
    const absences = absencesScolaires(format(jour, 'yyyy-MM-dd')).filter(({ creneau }) => (
      (toMinutes(creneau.startTime) ?? 0) < fin
      && debut < (toMinutes(creneau.endTime) ?? 0)
      && (!plateau || !creneau.plateau?.number || creneau.plateau.number === plateau)
    ));
    if (!absences.length) return false;
    setPanneau({
      absences, debut, fin, jour, plateau, type: 'vacances',
    });
    return true;
  };
  const bandesDeFermeture = isFacilitySource
    ? normalizePlanningItems(closureBandsForRange(
      fermeturesDessinees,
      planningRange,
      { closing: fermetureDuJour, opening: ouvertureDuJour },
      (/** @type {any} */ fermeture) => closureBandLabel(t, fermeture),
    ))
    : [];
  const blocsDesEvenementsDeLaVille = isFacilitySource
    ? normalizePlanningItems(blocsDesEvenements(evenementsDeLaVille, planningRange))
    : [];
  const ouvrirLEvenementDeLaVille = (/** @type {any} */ evenement) => {
    if (evenement?.documentId) {
      /** @type {any} */ (navigation).navigate(RouteNames.EvenementDeLaVille, {
        // CORR-COLLECTIVITES 97 (31/10, Adel A) : ouvert depuis la Ville, la fiche garde son espace.
        ...(route?.params?.espace === 'ville' ? { espace: 'ville' } : {}),
        evenementId: evenement.documentId,
      });
    }
  };
  const annotationsVacances = vue === VUES.jour ? absencesScolaires(jourAffiche)
    .filter(({ creneau }) => {
      const debut = toMinutes(creneau.startTime) ?? 0;
      const fin = toMinutes(creneau.endTime) ?? 0;
      // Ne pas annoncer une place libre si une séance ou une fermeture l'a reprise.
      return ![...bandesDeFermeture, ...blocsDesEvenementsDeLaVille, ...evenementsAffiches]
        .some((bloc) => {
          const plage = getPlanningItemWindow(bloc);
          return plage && format(plage.startAt, 'yyyy-MM-dd') === jourAffiche
            && plage.startAt.getHours() * 60 + plage.startAt.getMinutes() < fin
            && debut < plage.endAt.getHours() * 60 + plage.endAt.getMinutes();
        });
    })
    .map(({ creneau }) => ({
      day: jourAffiche,
      endMinutes: toMinutes(creneau.endTime) ?? 0,
      key: creneau.documentId,
      label: t(
        'personalPlanningWeekFullscreen.libreVacances',
        '{{heures}} · libre ({{equipe}} : sauf vacances)',
        {
          ...SANS_ECHAPPEMENT,
          equipe: creneau.team?.name || creneau.club?.name || '',
          heures: timeRange(creneau.startTime, creneau.endTime),
        },
      ),
      lane: creneau.plateau?.number ? creneau.plateau.number - 1 : 0,
      onPress: () => ouvrirVacances(
        currentDate,
        toMinutes(creneau.startTime) ?? 0,
        toMinutes(creneau.endTime) ?? 0,
        creneau.plateau?.number || null,
      ),
      startMinutes: toMinutes(creneau.startTime) ?? 0,
    })) : [];
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
  // COL-009 : seulement une fois SUR que le compte ne gere pas l installation (le compte double
  // voyait le bouton du club pendant la lecture de ses Villes).
  const villesDuClub = useClubCollectiviteFacilities(
    isFacilitySource && gestionConnue && !managingCollectiviteId && readsAsOrganizer
      ? clubDuLecteur
      : null,
  );
  const peutDemander = !peutAttribuer && gestionConnue && Boolean(clubDuLecteur)
    && (Array.isArray(villesDuClub.data) ? villesDuClub.data : [])
      .some((/** @type {any} */ installation) => installation?.documentId === facilityId);
  // R17-SIGNALER-1 (19/10, P10-signaler-tel 1 a) — « Un problème sur place ? Signale-le » : tout
  // membre d'un club qui utilise l'installation de la Ville (joueur, parent compris, Q1 A), pas la
  // Ville. Même
  // lecture que « Demander un créneau » (même clé : aucune requête de plus pour un encadrant) ; le
  // serveur rejuge à l'envoi.
  const villesPourSignaler = useClubCollectiviteFacilities(
    isFacilitySource && gestionConnue && !managingCollectiviteId ? clubDuLecteur : null,
  );
  const peutSignaler = Boolean(clubDuLecteur)
    && (Array.isArray(villesPourSignaler.data) ? villesPourSignaler.data : [])
      .some((/** @type {any} */ installation) => installation?.documentId === facilityId);
  // COLL-C3B-BIS (planche 43) : sur ordinateur, la demande s'ouvre en PANNEAU, à droite.
  const demandeEnPanneau = useIsDesktop();
  const demanderA = (/** @type {Date | null} */ jour, /** @type {number | null} */ heure) => {
    /** @type {Record<string, any>} */
    const params = { clubId: clubDuLecteur, facilityId };
    if (jour) params.date = format(jour, 'yyyy-MM-dd');
    if (heure !== null) {
      params.startTime = fromMinutes(heure * 60);
      params.endTime = fromMinutes(Math.min(heure * 60 + 90, fermetureDuJour));
    }
    if (demandeEnPanneau) {
      setPanneau({ initial: params, type: 'demander' });
      return;
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
    ) => {
      const plateau = Number.isInteger(colonne) && Number(colonne) < nombreDePlateaux
        ? Number(colonne) + 1 : null;
      if (!ouvrirVacances(jour, heure * 60, heure * 60 + 90, plateau)) {
        attribuerA(jour, heure * 60, heure * 60 + 90, plateau);
      }
    };
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
  const fermerPanneau = useCallback(() => {
    setPanneau(null);
    setBrouillonDemande(null);
    // Recolte 03/10 (COLL-C3B-BIS + COLL-C4B-BIS) : le brouillon de la fermeture s efface aussi.
    setBrouillon(null);
  }, []);
  const ouvrirUnBloc = (/** @type {any} */ bloc) => {
    // R17-EVT-1-BIS (b) (20/10) : vues Mois et Liste, l événement de la Ville ouvre SA fiche.
    if (bloc?.raw?.evenementDeLaVille) {
      ouvrirLEvenementDeLaVille(bloc.raw.evenementDeLaVille);
      return;
    }
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
    .map((club) => ({
      documentId: club.documentId, logoUrl: club.logo?.url || null, name: club.name,
    }));

  // Design P5-semaine-ordi : sur le site, la mairie choisit l installation en haut (une
  // pastille a la couleur de chacune) ; un bloc ouvert = un panneau a droite.
  const isDesktop = useIsDesktop();
  // 🏛️ COLL-R-APP-PLANNING (COL-012) — sur ordinateur, les fleches du haut entourent les dates.
  const flechesAutourDesDates = isFacilitySource && isDesktop;
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
  // 🏛️ R17-EVT-1-BIS (c) (20/10, tri du chef) — « Ajouter un événement de la Ville » dans le
  // panneau de droite, comme « Attribuer un créneau » (planche P10-evenement-ordi) : la Ville
  // (son nom, sa commune), l'envoi ; publié, le panneau se ferme et la grille se relit.
  const villesGerees = useMyCollectivites({ enabled: isFacilitySource && isDesktop });
  const villeGeree = (Array.isArray(villesGerees.data) ? villesGerees.data : [])
    .find((/** @type {any} */ ville) => ville?.documentId === managingCollectiviteId) || null;
  const { publier: publierEvenement } = useGestesEvenementDeLaVille(managingCollectiviteId);

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleEventPress = useCallback((event) => {
    if (!event?.documentId) return;

    // COLL-R-DEPLACER (14/10, COL-013, planche P5v4-deplacer-tel écran 1) — le bloc « à
    // déplacer » de son club ouvre « Déplacer la séance » pour qui peut la déplacer ; les autres
    // lisent la fiche. Forme imbriquée sur les deux plateformes : cet écran vit sur la RACINE
    // (allerDansLOnglet.test.js), et le site en fait la même adresse (/events/:id/edit).
    if (event?.raw?.closure && canManageEvent?.(event.raw)) {
      navigation.navigate(RouteNames.EventStack, {
        params: { eventId: event.documentId, mode: 'deplacer' }, screen: RouteNames.EventEdit,
      });
      return;
    }
    navigation.navigate(RouteNames.EventStack, {
      params: { eventId: event.documentId },
      screen: RouteNames.EventDetails,
    });
  }, [canManageEvent, navigation]);

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

  // Les fleches de l'en-tete : un jour en portrait, une semaine en paysage (R17-VUE : un mois).
  const handlePrevPage = useCallback(() => {
    setCurrentDate((previousDate) => pageSuivante(vue, previousDate, -1));
  }, [vue]);

  const handleNextPage = useCallback(() => {
    setCurrentDate((previousDate) => pageSuivante(vue, previousDate, 1));
  }, [vue]);

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
    // R17-VUE : et la roue tant que la vue d arrivee n est pas decidee (pas d eclair du vide).
    if (isLoading || (isFetching && !isFacilitySource) || enDecision) {
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

    // R17-VUE : le mois sert aussi aux plannings perso, club et omnisport (decide a l arrivee).
    if (vue === VUES.mois) {
      return (
        <ScrollView contentContainerStyle={{ gap: 8, paddingBottom: 24 }}>
          <PlanningCalendarView
            // COLL-C4B-BIS : les jours fermes du mois, marques (et le brouillon du panneau).
            closures={fermeturesDessinees}
            currentDate={currentDate}
            // R17-EVT-1-BIS (b) : les événements de la Ville de CETTE installation (repère clair).
            events={[...blocsDesEvenementsDeLaVille, ...evenementsAffiches]}
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
          // R17-EVT-1-BIS (b) : ses événements de la Ville (carte claire, heures prises).
          evenements={[...blocsDesEvenementsDeLaVille, ...events]}
          fermeture={fromMinutes(fermetureDuJour)}
          // COLL-C4B-BIS : un jour ferme n a aucune place libre (T10, planche 25).
          fermetures={fermeturesDessinees}
          onBlockPress={ouvrirUnBloc}
          onFreePress={peutAttribuer ? attribuerA : undefined}
          origineDe={readsAsOrganizer ? origineDe : undefined}
          ouverture={fromMinutes(ouvertureDuJour)}
          ouvreLesAutresClubs={Boolean(managingCollectiviteId)}
        />
      );
    }

    // COLL-C4B-BIS : une semaine FERMEE sans seance se dessine (la plage), comme la planche.
    // R17-EVT-1 (20/10) : une semaine avec un evenement de la Ville aussi (son bloc clair).
    if (!hasEvents && !bandesDeFermeture.length && !blocsDesEvenementsDeLaVille.length
      && !annotationsVacances.length) {
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
        // sous les seances (jamais comptees comme une seance). COLL-C4B-BIS : aussi en colonnes de
        // plateaux (la grille les pose sous toutes les colonnes).
        // Recolte 03/10 : avec COLL-C3B-BIS, les blocs affiches portent aussi la place « U13 ? » en pointille.
        events={[...bandesDeFermeture, ...blocsDesEvenementsDeLaVille, ...evenementsAffiches]}
        firstHour={isFacilitySource ? Math.floor(ouvertureDuJour / 60) : undefined}
        freeSlotAnnotations={annotationsVacances}
        // 🏛️ COLL-R-APP-PLANNING (COL-012) : des fleches aussi dans la rangee des jours (la ou est
        // le regard), les memes que celles du haut, avec leurs noms.
        flechesDesJours={isFacilitySource}
        laneOf={colonnesDePlateaux ? colonneDuBloc : undefined}
        lanes={colonnesDePlateaux}
        mode={vue}
        nomsDesFleches={[flecheGauche, flecheDroite]}
        onDateChange={vue === VUES.troisJours
          ? (/** @type {Date} */ ancre) => setCurrentDate(addDays(ancre, 1))
          : setCurrentDate}
        onEvenementVillePress={ouvrirLEvenementDeLaVille}
        onEventPress={handleEventPress}
        onFreeSlotPress={toucherUneHeureLibre}
        onReadOnlyEventPress={handleReadOnlyEventPress}
        // COLL-FIX-PLANNING (T9_C29_2) : dans la semaine tenue droite, une grappe de seances
        // trop serrees ouvre ce jour en vue Jour (tourne, la semaine est imposee).
        // C05 (Q2-09) : le jour de la grappe touchee, pas l ancre de la page des 3 jours.
        onSummaryPress={isFacilitySource && !isLandscape
          ? (/** @type {Date | undefined} */ jour) => {
            if (jour instanceof Date) setCurrentDate(jour);
            choisirVue(VUES.jour);
          }
          : undefined}
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
  // 📐 COLL-R-A7 (13/10, COL-005, decision d'Adel D4 A) : au telephone, « Attribuer » et
  // « Modifier » (« pareil », 4 etapes) s'ouvrent en PLEIN ECRAN (la fenetre du formulaire) ; le
  // site en grand ecran garde son panneau de droite. Une heure libre : « Bloquer pour la Ville »
  // reste sous la main, au bas du tunnel.
  let tunnelPleinEcran = null;
  const bloquerLaCase = () => {
    fermerPanneau();
    ouvrirLaFermeture({
      date: panneau.date,
      endTime: panneau.initial?.endTime,
      facilityName: contextDetailLabel,
      mode: 'bloquer',
      startTime: panneau.initial?.startTime,
    });
  };
  // R17-EVT-1-BIS (c) : une heure libre, l'événement de la Ville, déjà rempli (ce jour,
  // ces heures).
  const ajouterUnEvenement = () => setPanneau({
    initial: {
      date: panneau.date,
      endTime: panneau.initial?.endTime,
      facilityId,
      startTime: panneau.initial?.startTime,
    },
    type: 'evenement',
  });
  if (['attribuer', 'modifier'].includes(panneau?.type) && !isDesktop) {
    tunnelPleinEcran = (
      <SeasonSlotForm
        actionSecondaire={panneau.type === 'attribuer' && panneau.date && peutAttribuer ? {
          libelle: t('collectiviteFermetures.form.boutonBloquer', 'Bloquer pour la Ville'),
          onPress: bloquerLaCase,
        } : null}
        ajouterUnClub={() => {
          fermerPanneau();
          /** @type {any} */ (navigation).navigate(RouteNames.CollectiviteInviteClub, {
            collectiviteId: managingCollectiviteId, onglet: 'recherche',
          });
        }}
        clubs={clubsPourAttribuer}
        compact={panneau.type === 'attribuer' && panneau.compact !== false}
        facilityId={facilityId}
        guided
        initial={panneau.initial}
        key={`${panneau.type}-${panneau.titre || panneau.creneau?.documentId || ''}`}
        lectureDesClubs={attachedClubs}
        onCancel={fermerPanneau}
        onDone={fermerPanneau}
        pleinEcran
        slot={panneau.type === 'modifier' ? panneau.creneau : null}
      />
    );
  } else if (panneau?.type === 'attribuer' || panneau?.type === 'modifier') {
    const titre = panneau.type === 'modifier'
      ? t('collectiviteCreneaux.gerer.modifier', 'Modifier le créneau')
      : panneau.titre || t('collectiviteCreneaux.creneaux.attribuer', 'Attribuer un créneau');
    panneauRendu = (
      <View style={[Spaces.paddingHorizontal[16], Spaces.paddingBottom[16], { gap: 12 }]}>
        <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>{titre}</Text>
        <SeasonSlotForm
          ajouterUnClub={() => {
            fermerPanneau();
            /** @type {any} */ (navigation).navigate(RouteNames.CollectiviteInviteClub, {
              collectiviteId: managingCollectiviteId, onglet: 'recherche',
            });
          }}
          clubs={clubsPourAttribuer}
          compact={panneau.type === 'attribuer' && panneau.compact !== false}
          facilityId={facilityId}
          guided
          initial={panneau.initial}
          key={`${panneau.type}-${panneau.titre || panneau.creneau?.documentId || ''}`}
          lectureDesClubs={attachedClubs}
          onCancel={fermerPanneau}
          onDone={fermerPanneau}
          slot={panneau.type === 'modifier' ? panneau.creneau : null}
        />
        {/* COLL-C4B (02/10) — une heure libre : « Bloquer pour la Ville », deja rempli (P5v2). */}
        {panneau.type === 'attribuer' && panneau.date && peutAttribuer ? (
          <Button
            onPress={bloquerLaCase}
            title={t('collectiviteFermetures.form.boutonBloquer', 'Bloquer pour la Ville')}
            variant="Secondary"
          />
        ) : null}
        {/* R17-EVT-1-BIS (c) — une heure libre : l'événement de la Ville, à côté de la grille. */}
        {panneau.type === 'attribuer' && panneau.date && peutAttribuer ? (
          <Button
            onPress={ajouterUnEvenement}
            title={t('collectiviteEvenement.titre', 'Ajouter un événement de la Ville')}
            variant="Ghost"
          />
        ) : null}
      </View>
    );
  } else if (panneau?.type === 'evenement' && isDesktop && peutAttribuer) {
    panneauRendu = (
      <View style={[Spaces.paddingHorizontal[16], Spaces.paddingBottom[16]]}>
        <Suspense fallback={null}>
          <EvenementDeLaVilleForm
            collectiviteId={String(managingCollectiviteId)}
            collectiviteNom={String(villeGeree?.name || '')}
            collectiviteVille={String(villeGeree?.address?.city || '')}
            etroit
            initial={panneau.initial}
            installations={ongletsDInstallations}
            key={`evenement-${panneau.initial?.date || ''}-${panneau.initial?.startTime || ''}`}
            onClose={fermerPanneau}
            onPublier={async (/** @type {any} */ corps) => {
              await publierEvenement.mutateAsync(corps?.data ?? corps);
              fermerPanneau();
            }}
            presentation="panneau"
          />
        </Suspense>
      </View>
    );
  } else if (panneau?.type === 'vacances') {
    panneauRendu = (
      <View style={[Spaces.paddingHorizontal[16], Spaces.paddingBottom[16], { gap: 12 }]}>
        {panneau.absences.map((/** @type {{ creneau: any, retour: string | null }} */ absence) => (
          <Text key={absence.creneau.documentId} style={[Fonts.p2, Fonts.neutral00]}>
            {[
              t(
                'personalPlanningWeekFullscreen.absenceVacances',
                '{{club}} ne vient pas pendant les vacances scolaires ({{zone}}).',
                {
                  ...SANS_ECHAPPEMENT,
                  club: slotWho(absence.creneau),
                  zone: vacancesDeLaZone?.label || '',
                },
              ),
              absence.retour ? t(
                'personalPlanningWeekFullscreen.retourVacances',
                'Retour le {{jour}}.',
                {
                  ...SANS_ECHAPPEMENT,
                  // Le mois abrégé porte son point (« nov. ») : la phrase met le sien.
                  jour: format(parseISO(absence.retour), 'EEE d MMM', { locale: localeDesDates() })
                    .replace(/\.$/, ''),
                },
              ) : t(
                'personalPlanningWeekFullscreen.finVacances',
                'Aucune autre séance prévue sur ce créneau.',
              ),
            ].join(' ')}
          </Text>
        ))}
        <Button
          onPress={() => attribuerA(panneau.jour, panneau.debut, panneau.fin, panneau.plateau)}
          title={t('collectiviteCreneaux.creneaux.attribuer', 'Attribuer un créneau')}
          variant="Primary"
        />
        <Button onPress={fermerPanneau} title={t('common.close', 'Fermer')} variant="Secondary" />
      </View>
    );
  } else if (panneau?.type === 'demander') {
    // COLL-C3B-BIS (planche 43) — le club demande sans quitter le planning ; le brouillon de la
    // saisie remonte ici et se dessine dans la grille.
    panneauRendu = (
      <ClubSlotRequest
        enPanneau
        initial={panneau.initial}
        key={`demander-${panneau.initial?.date || ''}-${panneau.initial?.startTime || ''}`}
        onBrouillon={setBrouillonDemande}
        onFermer={fermerPanneau}
      />
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

  // COLL-R-DEPLACER (14/10) — la fermeture qui touche le bloc ouvert (la plage du serveur, ses
  // jours), et la proposition de place de la Ville encore en attente.
  const idDeLaFermeture = readOnlyBlock?.raw?.closure?.documentId || null;
  const fermetureTouchee = idDeLaFermeture
    ? fermeturesDuServeur.find(
      (/** @type {any} */ une) => une?.documentId === idDeLaFermeture,
    ) || null
    : null;
  let fermetureDuBloc = null;
  if (readOnlyBlock?.raw?.closure && !fermetureTouchee) {
    fermetureDuBloc = t(
      'deplacerSeance.ville.toucheeSansJours',
      'Touchée par une fermeture de la Ville',
    );
  } else if (fermetureTouchee) {
    const jours = closureDaysLabel(t, fermetureTouchee, { long: true });
    const unJour = !fermetureTouchee.endDate
      || fermetureTouchee.endDate === fermetureTouchee.startDate;
    fermetureDuBloc = t('deplacerSeance.ville.touchee', 'Touchée par la fermeture {{jours}}', {
      ...SANS_ECHAPPEMENT,
      jours: unJour
        ? t('collectiviteFermetures.confirmer.le', 'le {{jour}}', {
          ...SANS_ECHAPPEMENT, jour: jours,
        })
        : jours,
    });
  }
  const propositionDuBloc = readOnlyBlock?.raw?.relocationProposal?.status === 'pending'
    ? readOnlyBlock.raw.relocationProposal
    : null;
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
        {/* COLL-R-DEPLACER (14/10, « D9 = b », planche P5v4-deplacer-ville-tel, 1 b et 6 b) : */}
        {/* la fiche dit ENFIN la fermeture qui touche la séance, et la Ville qui gère peut */}
        {/* proposer une autre place (le serveur lui donne `eventId`) ; une proposition se lit. */}
        {fermetureDuBloc ? (
          <View
            style={{
              backgroundColor: withAlpha(Colors.warning500, 0.12),
              borderColor: withAlpha(Colors.warning500, 0.45),
              borderRadius: 12,
              borderWidth: 1,
              gap: 2,
              padding: 12,
            }}
            testID="planning-fiche-fermeture"
          >
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{fermetureDuBloc}</Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {propositionDuBloc
                ? t(
                  'deplacerSeance.ville.propositionEnvoyee',
                  'Proposition envoyée : {{lieu}} · {{jour}} · {{heures}}',
                  {
                    ...SANS_ECHAPPEMENT,
                    heures: hoursLabel(propositionDuBloc.startTime, propositionDuBloc.endTime),
                    jour: shortDay(propositionDuBloc.date),
                    lieu: propositionDuBloc.facility?.name || '',
                  },
                )
                : t(
                  'deplacerSeance.ville.aDeplacerParLeClub',
                  'À déplacer par le club. Vous pouvez lui proposer une place.',
                )}
            </Text>
          </View>
        ) : null}
        {peutAttribuer && readOnlyBlock.raw?.eventId && readOnlyBlock.raw?.closure ? (
          <Button
            onPress={() => {
              const proposer = {
                as: 'ville', eventId: readOnlyBlock.raw.eventId, mode: 'deplacer',
              };
              setReadOnlyBlock(null);
              navigation.navigate(RouteNames.EventStack, {
                params: proposer, screen: RouteNames.EventEdit,
              });
            }}
            title={t('deplacerSeance.ville.proposer', 'Proposer une autre place')}
            variant="Primary"
          />
        ) : null}
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
              // COL-009 (planche P5-semaine-paysage) : couche, UNE barre de 44 points.
              minHeight: barreCompacte ? 44 : 40,
              paddingHorizontal: 6,
              width: '100%',
            },
          ]}
        >
          {/* COL-012 (planches P5v2-vues-ordi, P5-semaine-ordi) : sur ordinateur, les */}
          {/* fleches ENTOURENT les dates ; le telephone les garde aux deux bouts (P5-jour-tel). */}
          {flechesAutourDesDates ? <View style={{ flex: 1 }} /> : null}
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

          <View
            style={flechesAutourDesDates
              ? { flexShrink: 1, minWidth: 200, paddingHorizontal: 6 }
              : { flex: 1, paddingHorizontal: 6 }}
          >
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

          {/* COL-009 : couche, la ligne de capacite monte dans la barre (P5-semaine-paysage). */}
          {barreCompacte && ligneDeCapacite ? (
            <Text
              numberOfLines={1}
              style={[
                Fonts.p3Bold,
                ligneDeCapacite.plein ? Fonts.warning500 : Fonts.success500,
                { flexShrink: 1, marginHorizontal: 6 },
              ]}
            >
              {ligneDeCapacite.texte}
            </Text>
          ) : null}

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
          {flechesAutourDesDates ? <View style={{ flex: 1 }} /> : null}

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

        {/* R17-VUE (tri du chef, 19/10) : inutile quand la semaine est deja affichee. */}
        {!isLandscape && vue !== VUES.semaine ? (
          <Text style={[Fonts.p4, Fonts.neutral200, Fonts.textCenter, Spaces.marginBottom[8]]}>
            {t(
              'personalPlanningWeekFullscreen.rotateForWeek',
              'Téléphone à l’horizontale : toute la semaine.',
            )}
          </Text>
        ) : null}

        {/* COL-009 : couche, tout ce bloc est replie ; il revient des qu on redresse. La */}
        {/* fermeture reste lisible dans la grille (hachures « Fermé · vacances »). */}
        {isFacilitySource && facilityPlanningSummary && !barreCompacte ? (
          <View style={[Spaces.marginBottom[8], { gap: 6 }]}>
            {/* COLL-C4B (02/10) — la fermeture de la page, pour TOUS les lecteurs (P3b). */}
            <FacilityClosureBanner
              closures={fermeturesDuBandeau}
              facilityType={facilityMeta?.type}
              testID="planning-bandeau-fermeture"
              withDays
            />
            {vacancesAffichees.map((periode) => (
              <View
                key={periode.key}
                style={[Alignments.row, Alignments.alignCenter, {
                  backgroundColor: withAlpha(Colors.violet500, 0.22),
                  borderColor: Colors.violet200,
                  borderRadius: 10,
                  borderWidth: 1,
                  gap: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                }]}
                testID={`planning-vacances-${periode.key}`}
              >
                <Text style={[Fonts.p3Bold, { color: Colors.violet200, flexShrink: 1 }]}>
                  {t('personalPlanningWeekFullscreen.vacances', '{{vacances}} · {{zone}}', {
                    vacances: periode.description || periode.name,
                    zone: vacancesDeLaZone?.label || '',
                    ...SANS_ECHAPPEMENT,
                  })}
                </Text>
              </View>
            ))}
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
            {/* COL-009 : une fois sur que le compte ne gere pas l installation. Incident 13 : */}
            {/* places libres, la ligne de capacite le dit deja ; la phrase reste quand c est */}
            {/* complet (ce que devient un depassement). */}
            {phraseDuDirigeant ? (
              <Text style={[Fonts.p4, Fonts.neutral200]}>{facilitySummaryMessage}</Text>
            ) : null}
            {/* R17-SIGNALER-1 — sous la barre, le lien pour signaler (P10-signaler-tel 1 a). */}
            {peutSignaler ? (
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => /** @type {any} */ (navigation).navigate(
                  RouteNames.FacilityReportNew,
                  {
                    facilityId,
                    ...(contextDetailLabel ? { facilityName: contextDetailLabel } : {}),
                  },
                )}
                style={[
                  Alignments.row,
                  Alignments.alignCenter,
                  Spaces.paddingHorizontal[12],
                  {
                    backgroundColor: withAlpha(Colors.primary500, 0.08),
                    borderColor: withAlpha(Colors.primary500, 0.45),
                    borderRadius: 12,
                    borderWidth: 1,
                    gap: 10,
                    minHeight: 48,
                  },
                ]}
                testID="planning-signaler"
              >
                <Image
                  source={Images.flag}
                  style={{ height: 18, tintColor: Colors.primary500, width: 18 }}
                />
                <Text style={[Fonts.p2Bold, Fonts.primary200, { flex: 1 }]}>
                  {t('facilityReports.membre.entreePlanning', 'Un problème sur place ? Signale-le')}
                </Text>
                <Image
                  source={Images.arrowRight}
                  style={{ height: 12, tintColor: Colors.primary200, width: 12 }}
                />
              </TouchableOpacity>
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
      {tunnelPleinEcran}
    </ScreenContainer>
  );
}

export default PlanningWeekFullscreen;
