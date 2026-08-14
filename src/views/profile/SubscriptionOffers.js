import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getUserRoleKey } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import {
  findSubscriptionMonthlySiblingEntry,
  formatSubscriptionMonthlyEquivalentLabel,
  formatSubscriptionPriceLabel,
  formatSubscriptionYearlyDiscountLabel,
  getInitialTeamSelection,
  getSubscriptionBillingErrorMessage,
  getSubscriptionEntryPeriod,
  getSubscriptionEntryScope,
  getSubscriptionEntryTierRank,
  getSubscriptionSelectableTeams,
} from '@/domains/subscription/subscriptionBilling';
import {
  getSubscriptionQuotaItems,
  getSubscriptionTeamSlotSummary,
} from '@/domains/subscription/subscriptionDecision';
import {
  getActiveSubscriptionPurchaseRail,
  isSubscriptionPurchaseAvailable,
  performSubscriptionPlanChange,
  performSubscriptionPurchase,
  SUBSCRIPTION_PURCHASE_RAILS,
} from '@/domains/subscription/subscriptionPurchaseRail';
import {
  invalidateSubscriptionState,
  scheduleSubscriptionStateRefresh,
} from '@/domains/subscription/subscriptionRefresh';
import { useSubscriptionCatalog } from '@/domains/subscription/useSubscriptionCatalog';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Checkable from '@/components/atoms/checkable/Checkable';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import LegalFooter from '@/components/molecules/legalFooter/LegalFooter';
import TierSelector from '@/components/molecules/tierSelector/TierSelector';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

/**
 * @typedef {{
 *   billingPeriod?: string | null;
 *   displayName?: string | null;
 *   featureKeys?: string[] | null;
 *   maxTeams?: number | null;
 *   planCode?: string | null;
 *   referencePriceEurCents?: number | null;
 *   scopeType?: string | null;
 *   slotCount?: number | null;
 * }} SubscriptionCatalogEntry
 */

// Libelles des capacites du catalogue (deplaces depuis SubscriptionOverview.js
// par L33 : c'est ici que les benefices s'affichent desormais).
/** @type {Record<string, string>} */
const SUBSCRIPTION_FEATURE_LABELS = {
  'club.broadcast': 'Canal de diffusion',
  'club.multi_teams': 'Toutes les équipes du club',
  'club.profile': 'Fiche club complète',
  'club.roles': 'Rôles du club',
  composition: 'Composition d\'équipe',
  convocation: 'Convocations',
  'dues.club': 'Cotisations du club',
  'dues.team': 'Cotisations de l\'équipe',
  'events.unlimited': 'Événements illimités',
  facilities: 'Installations',
  'matches.unlimited': 'Matchs illimités',
  'recruitment.unlimited': 'Annonces illimitées',
  sponsors: 'Sponsors et partenaires',
};

const FREE_PLAN_INCLUDED_LABELS = [
  '1 équipe gratuite',
  'Événements et matchs en quantité limitée',
  'Annonces de recrutement limitées',
];

/** @type {Record<number, string>} */
const CLUB_TIER_LETTERS = { 1: 'S', 2: 'M', 3: 'L' };

// L33 — la pilule « Annuel » ne porte PLUS de tag de remise : le catalogue a
// deux grilles (Club x10, Equipe x7,5-7,7) et un tag unique serait faux pour la
// moitie des paliers. Le badge est calcule et porte par carte.
const BILLING_PERIOD_OPTIONS = [
  { id: 'monthly', label: 'Mensuel' },
  { id: 'yearly', label: 'Annuel' },
];

// R07 point 6 — la reserve posee SOUS le CTA collant, en plus du retrait
// systeme. C'est le meme nombre que le `bottomInsetExtra` par defaut de
// `ScreenContainer` (12) et que la reserve du pied de `BottomModal` : l'ecran
// garde donc exactement la hauteur qu'il avait, il change seulement de porteur.
const CTA_BOTTOM_RESERVE = 12;

const CARD_MAX_WIDTH = 306;
const CARD_GAP = 10;
// Une cle stable par carte : `key={index}` ferait rerendre toute la rangee des
// que l'ordre bougerait, et la regle react/no-array-index-key l'interdit.
const CARD_KEYS = ['gratuit', 'equipe', 'club'];

// L38 — carte d'ouverture selon la famille d'offre que le mur payant exigeait.
// Le defaut reste Équipe : c'est l'offre d'appel, et toutes les entrees sans
// portee (« Changer d'offre » depuis le hub, compteurs) doivent y atterrir.
/** @type {Record<string, number>} */
const CARD_INDEX_BY_FOCUS_SCOPE = { CLUB: 2, TEAM: 1 };
const DEFAULT_CARD_INDEX = 1;

/**
 * Capacites d'une entree, en libelles lisibles.
 * @param {SubscriptionCatalogEntry | null} entry
 * @param {string[]} [excludedFeatureKeys] - Capacites deja couvertes par l'offre inferieure.
 * @returns {string[]}
 */
const getEntryFeatureLabels = (entry, excludedFeatureKeys = []) => (
  Array.isArray(entry?.featureKeys) ? entry.featureKeys : []
)
  .filter(Boolean)
  .filter((featureKey) => !excludedFeatureKeys.includes(String(featureKey)))
  .map((featureKey) => SUBSCRIPTION_FEATURE_LABELS[String(featureKey)] || String(featureKey));

/**
 * Ecran 2 du parcours Abonnement (L33) : CHOISIR. Carrousel horizontal d'une
 * carte par offre, CTA collant qui suit la carte active, achat natif.
 *
 * C'est la seule surface de vente atteinte depuis un mur payant ou un compteur :
 * si elle cesse de proposer un bouton d'achat, un dirigeant carte bleue en main
 * n'a plus aucun chemin pour payer (regression L10-A).
 *
 * Param de route `focusScope` ('TEAM' | 'CLUB', L38) : famille d'offre exigee par
 * le mur payant d'ou l'on vient. Absent, le carrousel s'ouvre sur Équipe.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement | null}
 */
function SubscriptionOffers({ navigation, route }) {
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { width: windowWidth } = useWindowDimensions();
  // R07 point 6 — le retrait bas du telephone (barre de gestes / barre de
  // navigation). Il n'est JAMAIS ecrit en dur : il change d'un modele a l'autre.
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const {
    allMyTeams,
    clubVerificationSummary,
    freeUsageSummary,
    subscriptionAccessLevel,
    subscriptionSummary,
    userData,
  } = useAuth();

  const roleKey = getUserRoleKey(userData?.role?.type || userData?.role?.name);
  const canShowSubscriptionExperience = roleKey === 'coach'
    || roleKey === 'president'
    || roleKey === 'superAdmin';

  // Un mur payant qui exige Club doit ouvrir SUR la carte Club : atterrir sur
  // Équipe montre la mauvaise offre a quelqu'un a qui le serveur vient
  // precisement de dire qu'il lui faut Club. Portee absente ou inconnue : Équipe.
  const focusCardIndex = CARD_INDEX_BY_FOCUS_SCOPE[
    String(route?.params?.focusScope || '').trim().toUpperCase()
  ] || DEFAULT_CARD_INDEX;

  // L40 — l'origine est un COLIS : ce carrousel ne l'ouvre jamais, il la
  // transporte. La porte qui a envoye ici sait d'ou part la personne ; cet ecran
  // ne le sait pas, et l'ecran de succes encore moins. Absente, on garde le
  // retour a l'accueil.
  const resumeRouteName = String(route?.params?.resumeRouteName || '').trim();
  const resumeRouteParams = route?.params?.resumeRouteParams;

  // D89 — MEME COLIS, DEUX CHAMPS DE PLUS, POUR LE SAS DE FIN D'INSCRIPTION.
  //
  // `skipRouteName` = ou va celui qui PASSE sans acheter. C'est lui, et lui
  // seul, qui fait de cet ecran un sas : un mur payant transporte deja une
  // origine (`resumeRouteName`) sans etre un sas pour autant.
  // La porte de sortie n'existe que si une destination est nommee ⇒ un bouton
  // mort est impossible par construction, pas par precaution.
  const skipRouteName = String(route?.params?.skipRouteName || '').trim();
  const isOnboardingExit = Boolean(skipRouteName);
  // « Reprendre » promet une tache interrompue. En fin d'inscription il n'y a
  // rien a reprendre : le libelle du bouton de succes voyage donc avec le colis.
  const resumeCtaLabel = String(route?.params?.resumeCtaLabel || '').trim();

  const scrollRef = useRef(/** @type {any} */ (null));
  const [activeIndex, setActiveIndex] = useState(focusCardIndex);
  const [billingPeriod, setBillingPeriod] = useState('yearly');
  const [teamSlotCount, setTeamSlotCount] = useState(1);
  const [clubTier, setClubTier] = useState(1);
  const [activeActionPlanCode, setActiveActionPlanCode] = useState('');
  const [teamPlanModalState, setTeamPlanModalState] = useState(
    /** @type {{ actionMode: string; catalogEntry: SubscriptionCatalogEntry | null; selectedTeamDocumentIds: string[] }} */ ({
      actionMode: 'purchase',
      catalogEntry: null,
      selectedTeamDocumentIds: [],
    }),
  );

  const catalogQuery = useSubscriptionCatalog({ enabled: canShowSubscriptionExperience });
  const catalogEntries = catalogQuery.entries;

  const activePlanCodes = useMemo(
    () => (Array.isArray(subscriptionSummary?.activePlanCodes) ? subscriptionSummary.activePlanCodes : []),
    [subscriptionSummary?.activePlanCodes],
  );
  const primarySubscriptionDocumentId = String(
    Array.isArray(subscriptionSummary?.payerSubscriptionIds)
      ? subscriptionSummary.payerSubscriptionIds[0] || ''
      : '',
  ).trim();
  const currentClubDocumentId = String(
    clubVerificationSummary?.clubDocumentId || userData?.club?.documentId || '',
  ).trim();

  const isPurchaseAvailable = isSubscriptionPurchaseAvailable();
  const isTestPurchaseRail = getActiveSubscriptionPurchaseRail()
    === SUBSCRIPTION_PURCHASE_RAILS.TRUSTED_TEST;
  let purchaseHelperText = 'Le paiement in-app n\'est pas encore disponible sur cette version. Cette section reste en lecture pour le moment.';
  if (isTestPurchaseRail) {
    purchaseHelperText = 'Mode test actif : les changements d\'offre sont simulés pour la recette.';
  } else if (isPurchaseAvailable) {
    purchaseHelperText = 'Paiement sécurisé par le store. Changement immédiat, prorata géré automatiquement.';
  }

  const teamOptions = useMemo(() => getSubscriptionSelectableTeams(allMyTeams), [allMyTeams]);
  const teamSlotSummary = useMemo(
    () => getSubscriptionTeamSlotSummary(subscriptionSummary),
    [subscriptionSummary],
  );
  const quotaItems = useMemo(
    () => getSubscriptionQuotaItems(freeUsageSummary, subscriptionAccessLevel),
    [freeUsageSummary, subscriptionAccessLevel],
  );

  /**
   * Paliers d'une famille pour la periode choisie, du moins cher au plus cher.
   * Un palier absent du catalogue n'est JAMAIS affiche : mieux vaut une pilule
   * en moins qu'un prix invente.
   */
  const buildTiers = useCallback((/** @type {'TEAM' | 'CLUB'} */ scopeType) => catalogEntries
    .filter((entry) => getSubscriptionEntryScope(entry) === scopeType
      && getSubscriptionEntryPeriod(entry) === billingPeriod
      && Number(entry?.referencePriceEurCents) > 0)
    .sort((left, right) => getSubscriptionEntryTierRank(left) - getSubscriptionEntryTierRank(right))
    .map((entry) => ({
      entry,
      id: getSubscriptionEntryTierRank(entry),
      label: scopeType === 'CLUB'
        ? (CLUB_TIER_LETTERS[getSubscriptionEntryTierRank(entry)] || String(getSubscriptionEntryTierRank(entry)))
        : String(getSubscriptionEntryTierRank(entry)),
    }))
    .filter((option) => option.id > 0), [billingPeriod, catalogEntries]);

  const teamTiers = useMemo(() => buildTiers('TEAM'), [buildTiers]);
  const clubTiers = useMemo(() => buildTiers('CLUB'), [buildTiers]);

  // Le palier retenu retombe sur le premier disponible : bascule mensuel/annuel
  // ou catalogue incomplet ne doivent jamais laisser une carte vide.
  const resolvedTeamTier = teamTiers.some((option) => option.id === teamSlotCount)
    ? teamSlotCount
    : (teamTiers[0]?.id || 0);
  const resolvedClubTier = clubTiers.some((option) => option.id === clubTier)
    ? clubTier
    : (clubTiers[0]?.id || 0);
  const teamEntry = teamTiers.find((option) => option.id === resolvedTeamTier)?.entry || null;
  const clubEntry = clubTiers.find((option) => option.id === resolvedClubTier)?.entry || null;

  // R07 point 5 — COMBIEN D'EQUIPES COMPREND LA TAILLE CHOISIE.
  //
  // Constat d'Adel du 2026-08-13 : « il faut mieux expliquer l'offre Club :
  // dire que c'est la meme chose que l'offre Equipe, en indiquant selon
  // l'offre que tu choisis le nombre d'equipes que ca comprend ». La carte
  // n'affichait que les lettres S / M / L : un palier sans critere de choix.
  //
  // ⚠️ LE NOMBRE N'EST PAS UNE CONSTANTE DE L'APP : il vient du catalogue
  // SERVEUR (`maxTeams` de l'entree). Rien ici ne code en dur « S = 3 ». On
  // l'affiche donc tel que le catalogue le donne — et « illimitees » quand il
  // ne borne rien.
  // Phrase reprise MOT POUR MOT de `SubscriptionPaywallSheet.js` (l. 439-445),
  // qui la sert deja : deux surfaces de vente ne doivent pas dire la meme
  // chose de deux facons.
  const clubMaxTeams = Number(clubEntry?.maxTeams);
  const clubCoverageLabel = Number.isFinite(clubMaxTeams) && clubMaxTeams > 0
    ? `jusqu'à ${clubMaxTeams} équipes du club`
    : 'toutes les équipes du club';

  /**
   * Badge de remise d'une carte : calcule sur SES deux prix, jamais global.
   * L38 — la recherche de la jumelle mensuelle est partie dans
   * `subscriptionBilling`, ou les deux autres surfaces de vente la partagent.
   * @param {SubscriptionCatalogEntry | null} entry
   * @returns {string}
   */
  const getDiscountLabel = useCallback((entry) => {
    if (billingPeriod !== 'yearly') return '';
    return formatSubscriptionYearlyDiscountLabel(
      findSubscriptionMonthlySiblingEntry(catalogEntries, entry)?.referencePriceEurCents,
      entry?.referencePriceEurCents,
    );
  }, [billingPeriod, catalogEntries]);

  const teamFeatureKeys = useMemo(
    () => (Array.isArray(teamEntry?.featureKeys) ? teamEntry.featureKeys.map(String) : []),
    [teamEntry],
  );

  // D89 — QUITTER CET ECRAN. Depuis le sas d'inscription on REMPLACE : le
  // paywall ne doit rien laisser derriere lui, sinon le retour depuis la
  // bienvenue le rouvrirait (c'est exactement le defaut que D81 vient de
  // corriger sur les autres tunnels). Depuis le profil, on navigue comme avant :
  // la pile du profil, elle, doit rester intacte.
  // Le `typeof` n'est pas decoratif — la doublure de navigation d'un test, ou un
  // navigateur sans `replace`, ne doit pas transformer la porte de sortie en
  // bouton mort.
  const leaveOffers = useCallback((/** @type {string} */ routeName, /** @type {any} */ params) => {
    if (isOnboardingExit && typeof navigation?.replace === 'function') {
      navigation.replace(routeName, params);
      return;
    }
    navigation.navigate(routeName, params);
  }, [isOnboardingExit, navigation]);

  const closeTeamPlanModal = useCallback(() => {
    setTeamPlanModalState({
      actionMode: 'purchase',
      catalogEntry: null,
      selectedTeamDocumentIds: [],
    });
  }, []);

  // Les droits d'un achat store sont ouverts par le webhook, quelques secondes
  // APRES la reussite cote client : une invalidation immediate seule relit
  // l'ancien etat et le fige (L08). On arme le calendrier de convergence, puis
  // on attend la premiere lecture.
  const refreshSubscriptionContext = useCallback(async () => {
    scheduleSubscriptionStateRefresh(queryClient);
    await invalidateSubscriptionState(queryClient);
  }, [queryClient]);

  const subscriptionMutation = useMutation({
    mutationFn: async (/** @type {{ action: string; input: Record<string, any> }} */ { action, input }) => (
      action === 'change'
        ? performSubscriptionPlanChange(input)
        : performSubscriptionPurchase(input)
    ),
  });

  /**
   * Ce que l'ecran de succes doit annoncer pour l'offre qui vient d'etre
   * encaissee. La portee vient de l'ACHAT, jamais du cache d'abonnement : juste
   * apres l'achat, le webhook du store n'a pas encore converge (L08).
   * @param {SubscriptionCatalogEntry | null} catalogEntry
   * @param {{ isTeamSlotUpdate?: boolean }} [options]
   * @returns {Record<string, any>}
   */
  const buildPurchaseSuccessParams = useCallback((catalogEntry, options = {}) => {
    const isClubOffer = getSubscriptionEntryScope(catalogEntry) === 'CLUB';
    const slotCount = Number(catalogEntry?.slotCount || 0);
    const renewalDate = new Date();
    if (getSubscriptionEntryPeriod(catalogEntry) === 'monthly') {
      renewalDate.setMonth(renewalDate.getMonth() + 1);
    } else {
      renewalDate.setFullYear(renewalDate.getFullYear() + 1);
    }

    return {
      clubDocumentId: isClubOffer ? currentClubDocumentId : undefined,
      offerLabel: isClubOffer
        ? `Club ${CLUB_TIER_LETTERS[getSubscriptionEntryTierRank(catalogEntry)] || ''}`.trim()
        : `Équipe · ${slotCount} équipe${slotCount > 1 ? 's' : ''}`,
      offerScope: isClubOffer ? 'CLUB' : 'TEAM',
      // L40 — une simple reassignation de creneaux ne DEPLACE PAS l'echeance :
      // le serveur preserve la fenetre quand le payload omet les dates
      // (subscription-billing.ts:1181). Annoncer « aujourd'hui + 1 an » serait
      // un mensonge d'etiquette ; on prefere ne rien annoncer.
      renewalDateLabel: options.isTeamSlotUpdate
        ? undefined
        : format(renewalDate, 'd MMMM yyyy', { locale: fr }),
      // Sous cet ecran, dans la pile, il y a le CATALOGUE : « revenir » y
      // rouvrirait des offres a quelqu'un qui vient de payer. Sans origine
      // connue, on repart donc de l'accueil, comme le Recap du tour guide.
      // Avec une origine (L40), on y ramene la personne — et le bouton le dit :
      // « C'est parti ! » promet l'accueil, « Reprendre » promet la tache
      // interrompue. Un libelle qui se trompe de destination est un defaut a
      // part entiere.
      // D89 — un libelle FOURNI par la porte gagne : le sas d'inscription ne
      // reprend aucune tache, il continue vers la bienvenue.
      resumeCtaLabel: resumeCtaLabel || (resumeRouteName ? 'Reprendre' : 'C\'est parti !'),
      resumeMode: resumeRouteName ? 'route' : 'home',
      resumeRouteName: resumeRouteName || undefined,
      resumeRouteParams: resumeRouteName ? resumeRouteParams : undefined,
    };
  }, [currentClubDocumentId, resumeCtaLabel, resumeRouteName, resumeRouteParams]);

  /**
   * @param {object} params
   * @param {'change' | 'purchase'} params.action
   * @param {SubscriptionCatalogEntry} params.catalogEntry
   * @param {Record<string, any>} params.input
   * @returns {Promise<any>}
   */
  const commitSubscriptionMutation = useCallback(async (params) => {
    const { action, catalogEntry, input } = params;
    setActiveActionPlanCode(String(catalogEntry?.planCode || '').trim());

    try {
      const result = await subscriptionMutation.mutateAsync({ action, input });
      await refreshSubscriptionContext();
      closeTeamPlanModal();

      // L38 — l'ecran de succes (refondu par L11 puis par le lot design D1), et
      // non plus une alerte systeme. Le decalage d'ouverture des droits par le
      // webhook du store y est deja gere (calendrier de relances 0/2/5/10/20 s) :
      // on passe par le meme chemin que le Recap du tour guide.
      // L40 — un changement d'offre vers le MEME planCode n'est pas un achat :
      // c'est la reassignation de creneaux, sans passage store ni facturation
      // (subscriptionPurchaseRail.js:241). L'ecran de succes ne doit alors
      // annoncer aucune nouvelle echeance.
      leaveOffers(RouteNames.SubscriptionSuccess, buildPurchaseSuccessParams(catalogEntry, {
        isTeamSlotUpdate: action === 'change'
          && String(input?.currentPlanCode || '') === String(catalogEntry?.planCode || ''),
      }));

      return result;
    } catch (error) {
      // Pas de `throw` : aucun appelant ne rattrape cette promesse, et la
      // relancer produisait un rejet non traite APRES l'alerte (mesure L38).
      Alert.alert('Erreur abonnement', getSubscriptionBillingErrorMessage(error));
      return null;
    } finally {
      setActiveActionPlanCode('');
    }
  }, [
    buildPurchaseSuccessParams,
    closeTeamPlanModal,
    leaveOffers,
    refreshSubscriptionContext,
    subscriptionMutation,
  ]);

  /**
   * @param {SubscriptionCatalogEntry} catalogEntry
   * @param {'purchase' | 'change' | 'manage-team-slots'} [actionMode]
   */
  const openTeamPlanModal = useCallback((catalogEntry, actionMode = 'purchase') => {
    setTeamPlanModalState({
      actionMode,
      catalogEntry,
      selectedTeamDocumentIds: getInitialTeamSelection({
        availableTeams: teamOptions,
        coveredTeamDocumentIds: teamSlotSummary.coveredTeamDocumentIds,
        slotCount: Number(catalogEntry?.slotCount || 0),
      }),
    });
  }, [teamOptions, teamSlotSummary.coveredTeamDocumentIds]);

  /**
   * @param {SubscriptionCatalogEntry | null} catalogEntry
   */
  const handleChooseOffer = useCallback(async (catalogEntry) => {
    if (!catalogEntry) return;

    const scopeType = getSubscriptionEntryScope(catalogEntry);
    const hasPaidSubscription = Boolean(primarySubscriptionDocumentId);
    const action = hasPaidSubscription ? 'change' : 'purchase';

    // Une offre Équipe couvre des equipes NOMMEES : on demande lesquelles avant
    // d'encaisser quoi que ce soit.
    if (scopeType === 'TEAM') {
      openTeamPlanModal(
        catalogEntry,
        activePlanCodes.includes(catalogEntry?.planCode) ? 'manage-team-slots' : action,
      );
      return;
    }

    if (!currentClubDocumentId) {
      Alert.alert(
        'Club requis',
        'Rattache d abord ton compte a un club avant de prendre une offre Club.',
      );
      return;
    }

    if (!isPurchaseAvailable) {
      Alert.alert(
        'Checkout indisponible',
        'Le paiement in-app n\'est pas disponible sur ce build. Mets l\'app à jour puis réessaie.',
      );
      return;
    }

    /** @type {Record<string, any>} */
    const input = {
      catalogEntry,
      clubDocumentId: currentClubDocumentId,
      payerUserDocumentId: String(userData?.documentId || '').trim(),
      teamDocumentIds: [],
    };
    if (hasPaidSubscription) {
      input.currentPlanCode = String(activePlanCodes[0] || '');
      input.subscriptionDocumentId = primarySubscriptionDocumentId;
    }

    await commitSubscriptionMutation({ action, catalogEntry, input });
  }, [
    activePlanCodes,
    commitSubscriptionMutation,
    currentClubDocumentId,
    isPurchaseAvailable,
    openTeamPlanModal,
    primarySubscriptionDocumentId,
    userData?.documentId,
  ]);

  const selectedTeamPlanEntry = teamPlanModalState.catalogEntry;
  const selectedTeamSlotCount = Number(selectedTeamPlanEntry?.slotCount || 0);
  const selectedTeamIds = useMemo(
    () => (Array.isArray(teamPlanModalState.selectedTeamDocumentIds)
      ? teamPlanModalState.selectedTeamDocumentIds
      : []),
    [teamPlanModalState.selectedTeamDocumentIds],
  );
  const hasAtLeastOneSelectedTeam = selectedTeamIds.length > 0;
  const isSelectedTeamCountInvalid = selectedTeamIds.length > selectedTeamSlotCount;
  const isTeamSelectionConfirmDisabled = !selectedTeamPlanEntry
    || selectedTeamSlotCount <= 0
    || !hasAtLeastOneSelectedTeam
    || isSelectedTeamCountInvalid
    || !isPurchaseAvailable
    || subscriptionMutation.isPending;

  /**
   * @param {string} teamDocumentId
   */
  const handleToggleTeamSelection = useCallback((teamDocumentId) => {
    setTeamPlanModalState((currentState) => {
      const currentSelection = Array.isArray(currentState.selectedTeamDocumentIds)
        ? currentState.selectedTeamDocumentIds
        : [];
      if (currentSelection.includes(teamDocumentId)) {
        return {
          ...currentState,
          selectedTeamDocumentIds: currentSelection.filter((entry) => entry !== teamDocumentId),
        };
      }

      const slotCount = Number(currentState.catalogEntry?.slotCount || 0);
      if (currentSelection.length >= slotCount) {
        Alert.alert(
          'Slots Team atteints',
          `Cette offre couvre ${slotCount} équipe${slotCount > 1 ? 's' : ''} maximum.`,
        );
        return currentState;
      }

      return {
        ...currentState,
        selectedTeamDocumentIds: [...currentSelection, teamDocumentId],
      };
    });
  }, []);

  const handleConfirmTeamPlan = useCallback(async () => {
    if (!selectedTeamPlanEntry) return;

    if (teamOptions.length === 0) {
      Alert.alert(
        'Équipe requise',
        'Ajoute ou rattache d abord une équipe avant de prendre une offre Team.',
      );
      return;
    }

    if (!hasAtLeastOneSelectedTeam) {
      Alert.alert(
        'Équipe requise',
        'Sélectionne au moins une équipe à couvrir avec cette offre Team.',
      );
      return;
    }

    if (!isPurchaseAvailable) {
      Alert.alert(
        'Checkout indisponible',
        'Le paiement in-app n\'est pas disponible sur ce build. Mets l\'app à jour puis réessaie.',
      );
      return;
    }

    const action = primarySubscriptionDocumentId ? 'change' : 'purchase';
    /** @type {Record<string, any>} */
    const input = {
      catalogEntry: selectedTeamPlanEntry,
      payerUserDocumentId: String(userData?.documentId || '').trim(),
      teamDocumentIds: selectedTeamIds,
    };
    if (primarySubscriptionDocumentId) {
      // L40 — `currentPlanCode` EGAL au plan vise est ce qui fait prendre au rail
      // la branche « reassignation de creneaux » : aucun passage store, aucune
      // seconde facturation (subscriptionPurchaseRail.js:241). On le pointe donc
      // sur l'offre elle-meme quand on ne fait que changer les equipes couvertes.
      // `activePlanCodes[0]` ne suffit pas : le tableau peut porter PLUSIEURS
      // offres actives (subscriptionDecision.test.js:209), et une autre en tete
      // enverrait l'abonne repasser a la caisse pour ce qu'il paie deja.
      input.currentPlanCode = teamPlanModalState.actionMode === 'manage-team-slots'
        ? String(selectedTeamPlanEntry?.planCode || '')
        : String(activePlanCodes[0] || '');
      input.subscriptionDocumentId = primarySubscriptionDocumentId;
    }

    await commitSubscriptionMutation({
      action,
      catalogEntry: selectedTeamPlanEntry,
      input,
    });
  }, [
    activePlanCodes,
    commitSubscriptionMutation,
    hasAtLeastOneSelectedTeam,
    isPurchaseAvailable,
    primarySubscriptionDocumentId,
    selectedTeamIds,
    selectedTeamPlanEntry,
    teamOptions.length,
    teamPlanModalState.actionMode,
    userData?.documentId,
  ]);

  // La carte se resserre sur les petits ecrans plutot que de deborder : la carte
  // suivante doit TOUJOURS depasser du bord, c'est elle qui dit « ca se balaie ».
  const cardWidth = Math.min(CARD_MAX_WIDTH, Math.max(240, windowWidth - 64));

  /**
   * Fait defiler le carrousel jusqu'a la carte demandee.
   * @param {number} index
   */
  const goToCard = useCallback((index) => {
    setActiveIndex(index);
    scrollRef.current?.scrollTo?.({ animated: true, x: index * (cardWidth + CARD_GAP) });
  }, [cardWidth]);

  // La carte visee doit aussi etre AMENEE SOUS LES YEUX : `activeIndex` la
  // surligne et pilote le CTA, mais sans ce defilement elle resterait hors de
  // l'ecran. Une seule fois, au montage — ensuite c'est le doigt qui commande.
  useEffect(() => {
    if (focusCardIndex !== DEFAULT_CARD_INDEX) {
      goToCard(focusCardIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // D89 — LE FILET ANTI-CUL-DE-SAC, et c'est le seul risque grave de ce lot.
  //
  // Cet ecran rend `null` pour tout role autre qu'entraineur / dirigeant /
  // super-admin (l. 164) : une PAGE BLANCHE, sans un bouton. En fin
  // d'inscription, ce serait une porte fermee sur quelqu'un qui vient de remplir
  // 4 a 8 ecrans. `resolveOnboardingExitRoute` n'y envoie deja que les roles
  // servis — mais depuis ce lot la route est montee dans la pile du tunnel, donc
  // JOIGNABLE ; ce filet garantit que meme un appelant futur ne peut enfermer
  // personne. On ne bloque pas, on fait avancer : direction la bienvenue.
  useEffect(() => {
    if (isOnboardingExit && !canShowSubscriptionExperience) {
      leaveOffers(skipRouteName, undefined);
    }
  }, [canShowSubscriptionExperience, isOnboardingExit, leaveOffers, skipRouteName]);

  if (!canShowSubscriptionExperience) {
    return null;
  }

  const sidePadding = Math.max(16, Math.round((windowWidth - cardWidth) / 2));
  const isFreeLevel = subscriptionAccessLevel === 'FREE';

  const cardBaseStyle = {
    backgroundColor: withAlpha(Colors.primary800, 0.72),
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    width: cardWidth,
  };

  /**
   * Chip de statut d'une carte (le seul badge autorise sur la surface).
   * @param {{ label: string; tone: 'club' | 'neutral' | 'popular' }} props
   * @returns {import('react').ReactElement}
   */
  const renderChip = ({ label, tone }) => {
    const toneColor = { club: Colors.violet500, neutral: Colors.neutral400, popular: Colors.primary500 }[tone];
    const inkColor = { club: Colors.violet200, neutral: Colors.neutral200, popular: Colors.primary200 }[tone];

    return (
      <View
        style={{
          backgroundColor: withAlpha(toneColor, 0.14),
          borderColor: withAlpha(toneColor, 0.45),
          borderRadius: 999,
          borderWidth: 1,
          paddingHorizontal: 11,
          paddingVertical: 4,
        }}
      >
        <Text numberOfLines={1} style={[Fonts.p4Bold, { color: inkColor }]}>{label}</Text>
      </View>
    );
  };

  /**
   * Ancre prix unique d'une carte : montant, unite, equivalence et remise.
   * @param {SubscriptionCatalogEntry | null} entry
   * @returns {import('react').ReactElement}
   */
  const renderPrice = (entry) => {
    const priceLabel = formatSubscriptionPriceLabel(entry?.referencePriceEurCents, billingPeriod);
    const monthlyEquivalentLabel = billingPeriod === 'yearly'
      ? formatSubscriptionMonthlyEquivalentLabel(entry?.referencePriceEurCents)
      : '';
    const discountLabel = getDiscountLabel(entry);

    return (
      <View style={[Spaces.gap[4], Spaces.marginTop[12]]}>
        <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
          <Text style={[Fonts.h3Bold, Fonts.neutral00]}>{priceLabel}</Text>
          {discountLabel ? (
            <View
              style={{
                backgroundColor: withAlpha(Colors.success500, 0.14),
                borderColor: withAlpha(Colors.success500, 0.45),
                borderRadius: 999,
                borderWidth: 1,
                paddingHorizontal: 9,
                paddingVertical: 3,
              }}
            >
              <Text style={[Fonts.p4Bold, { color: Colors.success200 }]}>{discountLabel}</Text>
            </View>
          ) : null}
        </View>
        {monthlyEquivalentLabel ? (
          <Text style={[Fonts.p4, Fonts.primary200]}>{monthlyEquivalentLabel}</Text>
        ) : null}
      </View>
    );
  };

  /**
   * Liste de benefices d'une carte.
   * @param {{ dim?: boolean; items: string[]; lead?: string }} props
   * @returns {import('react').ReactElement | null}
   */
  const renderBenefits = ({ dim = false, items, lead = '' }) => {
    if (items.length === 0) return null;

    return (
      <View
        style={[
          Spaces.gap[8],
          Spaces.marginTop[12],
          Spaces.paddingTop[12],
          { borderTopColor: withAlpha(Colors.neutral00, 0.08), borderTopWidth: 1 },
        ]}
      >
        {lead ? <Text style={[Fonts.p4, Fonts.neutral300]}>{lead}</Text> : null}
        {items.map((item) => (
          <View key={item} style={[Alignments.row, Spaces.gap[8]]}>
            <Text style={[Fonts.p3Bold, { color: dim ? Colors.neutral500 : Colors.success500 }]}>✓</Text>
            <Text style={[Alignments.fill, Fonts.p3, dim ? Fonts.neutral300 : Fonts.neutral100]}>
              {item}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  /**
   * Rangee de paliers : legende a gauche, pilules a droite.
   * @param {{
   *   legend: string;
   *   onChange: (id: string | number) => void;
   *   options: Array<{ id: number; label: string }>;
   *   value: number;
   * }} props
   * @returns {import('react').ReactElement | null}
   */
  const renderTierRow = ({
    legend, onChange, options, value,
  }) => {
    if (options.length <= 1) return null;

    return (
      <View style={[Spaces.gap[8], Spaces.marginTop[12]]}>
        <Text style={[Fonts.p4Bold, Fonts.neutral300, { letterSpacing: 0.8, textTransform: 'uppercase' }]}>
          {legend}
        </Text>
        <TierSelector onChange={onChange} options={options} value={value} />
      </View>
    );
  };

  const isTeamEntryActivePlan = Boolean(teamEntry && activePlanCodes.includes(teamEntry?.planCode));
  const isClubEntryActivePlan = Boolean(clubEntry && activePlanCodes.includes(clubEntry?.planCode));

  /**
   * CTA collant de la carte active. Il ne ment jamais : desactive quand il n'y a
   * rien a acheter, et absent de tout prix quand le catalogue n'en donne pas.
   * @returns {{ disabled: boolean; entry: SubscriptionCatalogEntry | null; label: string; sub: string }}
   */
  const getActiveCta = () => {
    if (activeIndex === 0) {
      return {
        disabled: true,
        entry: null,
        label: isFreeLevel ? 'Ton plan actuel' : 'Gérer dans le store',
        sub: isFreeLevel
          ? 'Publie en quantité limitée, sans carte bancaire.'
          : 'Le retour au gratuit se gère dans ton store.',
      };
    }

    const entry = activeIndex === 1 ? teamEntry : clubEntry;
    const isActivePlan = activeIndex === 1 ? isTeamEntryActivePlan : isClubEntryActivePlan;
    const familyLabel = activeIndex === 1
      ? 'Équipe'
      : `Club ${CLUB_TIER_LETTERS[resolvedClubTier] || ''}`.trim();

    if (!entry) {
      return {
        disabled: true,
        entry: null,
        label: 'Offre indisponible',
        sub: 'Ce palier n\'est pas proposé pour cette période.',
      };
    }

    if (isActivePlan) {
      // L40 — une offre Équipe couvre des equipes NOMMEES, et son abonne doit
      // pouvoir changer lesquelles. Le seul chemin vers cette feuille
      // (`manage-team-slots`, l.402) exige `activePlanCodes.includes(planCode)`,
      // c'est-a-dire la condition MEME qui eteignait ce bouton : du code mort,
      // et une impasse pour qui a paye. Le CTA ne ment pas davantage qu'avant —
      // il n'y a toujours rien a acheter, mais il y a quelque chose a GERER,
      // alors il change de verbe.
      // Cote CLUB il n'y a rien de nommable (l'offre couvre tout le club) : le
      // bouton reste eteint, mot pour mot comme avant.
      if (getSubscriptionEntryScope(entry) === 'TEAM') {
        return {
          disabled: !isPurchaseAvailable,
          entry,
          label: 'Gérer mes équipes couvertes',
          sub: isPurchaseAvailable
            ? 'Change les équipes couvertes par ton offre, sans repayer.'
            : purchaseHelperText,
        };
      }

      return {
        disabled: true,
        entry,
        label: 'Ton offre actuelle',
        sub: 'Change de palier ou de période pour la remplacer.',
      };
    }

    const priceLabel = formatSubscriptionPriceLabel(entry?.referencePriceEurCents, billingPeriod);
    return {
      disabled: !isPurchaseAvailable,
      entry,
      label: `Choisir ${familyLabel} · ${priceLabel}`,
      sub: purchaseHelperText,
    };
  };

  const activeCta = getActiveCta();

  return (
    <ScreenContainer
      bgImage="bg2"
      // R07 point 6 — « il y a un probleme de padding en bas » (Adel,
      // 2026-08-13). Le mode `screen` reservait `insets.bottom + 12` SOUS le
      // CTA collant : ce panneau a sa propre couleur et son trait du haut, il
      // s'arretait donc au-dessus du bord et laissait une bande d'image de
      // fond en dessous — d'autant plus visible que le telephone a une encoche.
      // `edge-to-edge` est le mode prevu pour ca, et son contrat est ecrit dans
      // `ScreenContainer` : « pour les ecrans qui appliquent deja eux-memes
      // `insets.bottom` a leur contenu (sinon il serait compte deux fois) ».
      // C'est exactement ce que fait le panneau du CTA plus bas.
      // ⚠️ Le pendant HORIZONTAL existait deja (`marginHorizontal: -24`) : le
      // panneau touchait les bords gauche et droit, mais pas le bas.
      bottomInsetMode="edge-to-edge"
      contentContainerStyle={[Spaces.paddingBottom[0], Spaces.paddingTop[0]]}
    >
      <View style={[Alignments.fill, { marginHorizontal: -24 }]}>
        <ScrollView
          contentContainerStyle={[Spaces.paddingBottom[24]]}
          showsVerticalScrollIndicator={false}
          style={Alignments.fill}
        >
          <View style={{ paddingHorizontal: sidePadding + 24 }}>
            <TierSelector
              onChange={(periodId) => setBillingPeriod(String(periodId))}
              options={BILLING_PERIOD_OPTIONS}
              value={billingPeriod}
            />
          </View>

          {catalogQuery.isLoading && catalogEntries.length === 0 ? (
            <Text style={[Fonts.p2, Fonts.neutral200, Spaces.marginTop[16], { paddingHorizontal: sidePadding }]}>
              Chargement du catalogue abonnement...
            </Text>
          ) : null}
          {catalogQuery.error && catalogEntries.length === 0 ? (
            <Text style={[Fonts.p2, Fonts.neutral200, Spaces.marginTop[16], { paddingHorizontal: sidePadding }]}>
              {getSubscriptionBillingErrorMessage(catalogQuery.error)}
            </Text>
          ) : null}

          <ScrollView
            contentContainerStyle={{ columnGap: CARD_GAP, paddingHorizontal: sidePadding }}
            decelerationRate="fast"
            horizontal
            onMomentumScrollEnd={(event) => setActiveIndex(Math.max(0, Math.min(
              2,
              Math.round(event.nativeEvent.contentOffset.x / (cardWidth + CARD_GAP)),
            )))}
            ref={scrollRef}
            showsHorizontalScrollIndicator={false}
            snapToInterval={cardWidth + CARD_GAP}
            style={Spaces.marginTop[16]}
          >
            {/* Gratuit — l'etat atteint, jamais une offre a vendre. */}
            <View
              style={[cardBaseStyle, {
                borderColor: withAlpha(Colors.neutral00, 0.13),
                opacity: activeIndex === 0 ? 1 : 0.55,
              }]}
            >
              <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[8]]}>
                <Text style={[Fonts.h4Black, Fonts.neutral00]}>Gratuit</Text>
                {isFreeLevel ? renderChip({ label: 'Ton plan actuel', tone: 'neutral' }) : null}
              </View>
              <Text style={[Fonts.p4, Fonts.neutral400, Spaces.marginTop[4]]}>
                Pour découvrir FoundClub
              </Text>
              <View style={[Spaces.gap[4], Spaces.marginTop[12]]}>
                <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
                  {formatSubscriptionPriceLabel(0, billingPeriod)}
                </Text>
              </View>
              {renderBenefits({ dim: true, items: FREE_PLAN_INCLUDED_LABELS })}
              {quotaItems.length ? (
                <View
                  style={[
                    Spaces.gap[4],
                    Spaces.marginTop[12],
                    Spaces.paddingTop[12],
                    { borderTopColor: withAlpha(Colors.neutral00, 0.08), borderTopWidth: 1 },
                  ]}
                >
                  {quotaItems.map((item) => (
                    <View
                      key={item.quotaType}
                      style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[8]]}
                    >
                      <Text style={[Fonts.p4Bold, Fonts.neutral200]}>
                        {t(`profile.subscription.quota.labels.${item.quotaType}`, item.label)}
                      </Text>
                      <Text style={[Fonts.p4, Number(item.remaining) > 0 ? Fonts.primary200 : Fonts.neutral400]}>
                        {Number(item.remaining) > 0
                          ? t('profile.subscription.quota.remaining', { count: Number(item.remaining) })
                          : t('profile.subscription.quota.used')}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            {/* Équipe */}
            <View
              style={[cardBaseStyle, {
                borderColor: activeIndex === 1
                  ? Colors.primary500
                  : withAlpha(Colors.primary500, 0.35),
                opacity: activeIndex === 1 ? 1 : 0.55,
              }]}
            >
              <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[8]]}>
                <Text style={[Fonts.h4Black, Fonts.neutral00]}>Équipe</Text>
                {renderChip({
                  label: isTeamEntryActivePlan ? 'Ton offre actuelle' : 'Populaire',
                  tone: isTeamEntryActivePlan ? 'neutral' : 'popular',
                })}
              </View>
              <Text style={[Fonts.p4, Fonts.neutral400, Spaces.marginTop[4]]}>
                Pour les coachs — ta ou tes équipes
              </Text>
              {teamEntry ? renderPrice(teamEntry) : (
                <Text style={[Fonts.p3, Fonts.neutral300, Spaces.marginTop[12]]}>
                  Aucune offre Équipe pour cette période.
                </Text>
              )}
              {renderTierRow({
                legend: 'Équipes couvertes',
                onChange: (id) => setTeamSlotCount(Number(id)),
                options: teamTiers,
                value: resolvedTeamTier,
              })}
              {renderBenefits({ items: getEntryFeatureLabels(teamEntry) })}
            </View>

            {/* Club */}
            <View
              style={[cardBaseStyle, {
                borderColor: activeIndex === 2
                  ? Colors.violet500
                  : withAlpha(Colors.violet500, 0.35),
                opacity: activeIndex === 2 ? 1 : 0.55,
              }]}
            >
              <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[8]]}>
                <Text style={[Fonts.h4Black, Fonts.neutral00]}>Club</Text>
                {renderChip({
                  label: isClubEntryActivePlan ? 'Ton offre actuelle' : 'Certification incluse',
                  tone: isClubEntryActivePlan ? 'neutral' : 'club',
                })}
              </View>
              <Text style={[Fonts.p4, Fonts.neutral400, Spaces.marginTop[4]]}>
                {`Pour les dirigeants — ${clubCoverageLabel}`}
              </Text>
              {clubEntry ? renderPrice(clubEntry) : (
                <Text style={[Fonts.p3, Fonts.neutral300, Spaces.marginTop[12]]}>
                  Aucune offre Club pour cette période.
                </Text>
              )}
              {renderTierRow({
                legend: 'Taille du club',
                onChange: (id) => setClubTier(Number(id)),
                options: clubTiers,
                value: resolvedClubTier,
              })}
              {/* R07 point 5 — l'amorce dit ce que l'offre Club EST : l'offre
                  Equipe, appliquee a plusieurs equipes, plus des capacites de
                  club. Les capacites en dessous viennent du catalogue serveur
                  (sponsors, cotisations, installations...) : on n'en invente
                  aucune ici, et une capacite deja couverte par Equipe est
                  retiree de la liste pour que « plus : » reste vrai. */}
              {renderBenefits({
                // `club.multi_teams` est RETIRE de la liste, et ce n'est pas un
                // oubli : son libelle « Toutes les equipes du club » CONTREDISAIT
                // la couverture reelle des qu'elle est bornee. La carte annoncait
                // « jusqu'a 3 equipes du club » et, deux lignes plus bas,
                // « Toutes les equipes du club ». La couverture est desormais dite
                // deux fois et avec precision au-dessus : la repeter en plus vague
                // n'ajoutait rien et semait le doute.
                items: getEntryFeatureLabels(clubEntry, [...teamFeatureKeys, 'club.multi_teams']),
                lead: `Tout ce que fait l'offre Équipe, pour ${clubCoverageLabel}, plus :`,
              })}
            </View>
          </ScrollView>

          {/* Points de position — zone de tap elargie a 44 pt. */}
          <View style={[Alignments.row, Alignments.justifyCenter, Spaces.marginTop[12]]}>
            {CARD_KEYS.map((cardKey, index) => (
              <TouchableOpacity
                accessibilityLabel={`Carte ${index + 1} sur 3`}
                accessibilityRole="button"
                accessibilityState={{ selected: index === activeIndex }}
                key={cardKey}
                onPress={() => goToCard(index)}
                style={{
                  alignItems: 'center',
                  height: 44,
                  justifyContent: 'center',
                  paddingHorizontal: 8,
                }}
              >
                <View
                  style={{
                    backgroundColor: index === activeIndex
                      ? Colors.primary500
                      : withAlpha(Colors.neutral00, 0.22),
                    borderRadius: 999,
                    height: 7,
                    width: index === activeIndex ? 22 : 7,
                  }}
                />
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* CTA collant : en flux normal sous le defilement, pour que RIEN ne
            puisse se cacher dessous — un bandeau en surimpression obligerait a
            reserver une hauteur au jugé sur chaque taille d'ecran. */}
        <View
          style={[
            Spaces.gap[8],
            Spaces.paddingTop[12],
            {
              backgroundColor: Colors.primary900,
              borderTopColor: withAlpha(Colors.neutral00, 0.08),
              borderTopWidth: 1,
              paddingHorizontal: 24,
              // R07 point 6 — le panneau porte LUI-MEME le retrait systeme,
              // maintenant qu'il descend jusqu'au bord. Le plancher est donc
              // toujours la (le dernier bouton ne passe pas sous la barre de
              // gestes), mais il est DEDANS : plus de bande de fond en dessous.
              paddingBottom: insets.bottom + CTA_BOTTOM_RESERVE,
            },
          ]}
        >
          <Button
            disabled={activeCta.disabled}
            isLoading={subscriptionMutation.isPending
              && activeActionPlanCode === String(activeCta.entry?.planCode || '')}
            onPress={() => handleChooseOffer(activeCta.entry)}
            title={activeCta.label}
            variant="Primary"
          />
          <Text style={[Fonts.p4, Fonts.neutral300, Fonts.textCenter]}>{activeCta.sub}</Text>
          {/* D89 — LA PORTE DE SORTIE DU SAS D'INSCRIPTION.
              Un paywall obligatoire a la fin d'une inscription est un
              cul-de-sac : la personne vient de remplir 4 a 8 ecrans, et si elle
              ne peut pas fermer celui-ci, elle n'entre JAMAIS dans l'app. C'est
              donc un BOUTON pleine largeur, juste sous celui qui vend — pas un
              lien gris en pied de page. Il n'apparait que dans le sas
              (`skipRouteName` nomme sa destination) : la surface du profil, elle,
              ne change pas. */}
          {isOnboardingExit ? (
            <Button
              onPress={() => leaveOffers(skipRouteName, undefined)}
              title={t('profile.subscription.offers.skip', 'Continuer gratuitement')}
              variant="SecondaryLight"
            />
          ) : null}
          <LegalFooter restore={false} />
        </View>
      </View>

      <BottomModal
        close={closeTeamPlanModal}
        isVisible={Boolean(selectedTeamPlanEntry)}
        scrollable
        snapPoints={['82%']}
      >
        <View style={[Spaces.gap[16], Spaces.paddingBottom[24]]}>
          <View style={[Spaces.gap[4]]}>
            <Text style={[Fonts.h4Black, Fonts.neutral00]}>
              {teamPlanModalState.actionMode === 'manage-team-slots'
                ? 'Mettre à jour mes équipes couvertes'
                : 'Choisir les équipes couvertes'}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {selectedTeamPlanEntry
                ? `Cette offre couvre jusqu'à ${selectedTeamSlotCount} équipe${selectedTeamSlotCount > 1 ? 's' : ''}.`
                : ''}
            </Text>
          </View>

          {!isPurchaseAvailable ? (
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {'Le paiement in-app n\'est pas encore disponible sur cette version.'}
            </Text>
          ) : null}

          {teamOptions.length === 0 ? (
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {'Aucune équipe exploitable n\'a été trouvée sur ce compte pour une offre Équipe.'}
            </Text>
          ) : (
            <View style={[Spaces.gap[12]]}>
              {teamOptions.map((team) => {
                const teamDocumentId = String(team?.documentId || '').trim();
                const isSelected = selectedTeamIds.includes(teamDocumentId);
                const teamClubName = String(team?.club?.name || '').trim();

                return (
                  <Checkable
                    disableBounceAnimation
                    isChecked={isSelected}
                    key={teamDocumentId}
                    setIsChecked={() => handleToggleTeamSelection(teamDocumentId)}
                    text=""
                    type="square"
                    wrapperStyle={{
                      backgroundColor: isSelected
                        ? Colors.primary500
                        : withAlpha(Colors.neutral00, 0.04),
                    }}
                  >
                    <View style={[Alignments.fill, Spaces.gap[4]]}>
                      <Text style={[Fonts.p2Bold, isSelected ? Fonts.primary900 : Fonts.neutral00]}>
                        {team?.name || 'Équipe sans nom'}
                      </Text>
                      {teamClubName ? (
                        <Text style={[Fonts.p4, isSelected ? Fonts.primary900 : Fonts.neutral200]}>
                          {teamClubName}
                        </Text>
                      ) : null}
                    </View>
                  </Checkable>
                );
              })}
            </View>
          )}

          {isSelectedTeamCountInvalid ? (
            <Text style={[Fonts.p4, { color: Colors.error300 }]}>
              {'Trop d\'équipes sélectionnées pour cette formule.'}
            </Text>
          ) : null}

          {selectedTeamPlanEntry ? (
            <Text style={[Fonts.p4, Fonts.neutral300]}>
              {`${selectedTeamIds.length} / ${selectedTeamSlotCount} place${selectedTeamSlotCount > 1 ? 's' : ''} utilisée${selectedTeamIds.length > 1 ? 's' : ''}`}
            </Text>
          ) : null}

          <View style={[Spaces.gap[8]]}>
            <Button
              disabled={isTeamSelectionConfirmDisabled}
              isLoading={subscriptionMutation.isPending}
              onPress={handleConfirmTeamPlan}
              title={primarySubscriptionDocumentId ? 'Confirmer le changement' : 'Activer cette offre'}
              variant="PrimaryLight"
            />
            <Button
              onPress={closeTeamPlanModal}
              title="Annuler"
              variant="SecondaryLight"
            />
          </View>
        </View>
      </BottomModal>
    </ScreenContainer>
  );
}

export default SubscriptionOffers;
