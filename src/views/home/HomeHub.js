import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  InteractionManager,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getUserRoleKey } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import { pendingDeciderLabel } from '@/domains/event/pendingDeciderLabel';
import {
  formatBannerShortTime,
  formatBannerTitle,
  normalizeHomeCounters,
  selectBannerDay,
  selectBannerLines,
  selectHomeAlerts,
  selectModerationTotal,
  selectMyApplicationsStatus,
  selectTriageTarget,
} from '@/domains/home/homeCounters';
import { navigateToRequestsHub } from '@/domains/requests/requestNavigation';
import { getDefaultRecruitmentTab, getRecruitmentRoleMode } from '@/domains/search/recruitmentFlow';
import {
  getCollectiviteOffer,
  getSubscriptionEntryPointLock,
  getSubscriptionQuotaItem,
  getSubscriptionStatusMeta,
} from '@/domains/subscription/subscriptionDecision';
import { TutorialIds } from '@/domains/tutorial/tutorialIds';
import { scrollTutorialTargetIntoViewOnWeb } from '@/domains/tutorial/tutorialWebRuntime';
import useFeatureTutorial from '@/domains/tutorial/useFeatureTutorial';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Loader from '@/components/atoms/loader/Loader';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import LeagueHeaderSwitch from '@/components/molecules/header/LeagueHeaderSwitch';
import HomeActionCard from '@/components/molecules/homeActionCard/HomeActionCard';
import HomeHeadBanner from '@/components/molecules/homeHeadBanner/HomeHeadBanner';
import NotificationBadge from '@/components/molecules/notificationBadge/NotificationBadge';
import OnboardingWrapper from '@/components/molecules/onboardingWrapper/OnboardingWrapper';
import PlayerModeBanner from '@/components/molecules/playerModeBanner/PlayerModeBanner';
import ProfileButton from '@/components/molecules/profileButton/ProfileButton';
import SubscriptionPaywallSheet
  from '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet';
import TourResumePill from '@/components/molecules/tour/TourResumePill';
import TourTarget from '@/components/molecules/tour/TourTarget';
import TutorialFlowBoundary from '@/components/molecules/tutorial/TutorialFlowBoundary';
import ExternalCompetitionPromptGate from '@/components/organisms/externalCompetitionPromptGate/ExternalCompetitionPromptGate';
import GlobalPromptModal from '@/components/organisms/popup/GlobalPromptModal';
import ScreenContainer from '@/components/templates/ScreenContainer';
// COLL-C4A (02/10) — le bandeau « Actualité de la Ville » (planche P3b-bandeau-tel).
import { resolveManageClubTarget } from '@/domains/home/manageClubTarget';

import { BandeauActualiteMembre } from '@/views/collectivite/components/BandeauActualiteVille';
import CollectiviteInvitationRow from '@/views/collectivite/components/CollectiviteInvitationRow';
import CollectivitePorteRow from '@/views/collectivite/components/CollectivitePorteRow';
import BasculeComplexe from '@/views/complexe/components/BasculeComplexe';
import FeuillePratiqueAussi from '@/views/home/FeuillePratiqueAussi';
import { compteARebours, sousTitreSeance } from '@/views/home/trainingCardText';
import { useHomeEventAnswer } from '@/views/home/useHomeEventAnswer';
import {
  libelleDeLaCarte,
  pastilleDeLaCarte,
  peutAvoirDesEnfants,
} from '@/views/profile/parent/mesEnfantsEnBref';
import PastilleDEtat from '@/views/profile/parent/PastilleDEtat';
import useMesEnfantsEnBref from '@/views/profile/parent/useMesEnfantsEnBref';
import { resolveLegacySearchTarget } from '@/views/search/searchRouteHelpers';

import { RouteNames } from '@/navigation/routeNames';
import { navigateOrExplainOnWeb } from '@/navigation/webNavigationGuard';

import { useAdminCollectivitesATraiter } from '@/services/collectivite/collectiviteQueries';
import { useHomeSummary } from '@/services/home/homeSummaryQueries';

import { setTutorialDebugState, tutorialDebugLog } from '@/utils/logger/tutorialDebug';
import { markBootStep } from '@/utils/performance/bootPerformance';

import {
  CARTES_ACCUEIL_MASQUEES,
  COMPLEXES_GERANT,
  LEAGUE_SUR_ACCUEIL,
} from '@/config/fonctionsMasquees';
import { POPUP_IDS } from '@/constants/popupRegistry';
import { ENABLE_STARTUP_TUTORIALS } from '@/constants/runtimeFlags';
import { useAppFeedback } from '@/context/AppFeedbackContext';
import { useAppMode } from '@/context/AppModeContext';
import {
  useBlockingOverlayLifecycle,
} from '@/context/BlockingOverlayContext';
import { useClubScope } from '@/context/ClubScopeContext';
import { useOnboarding } from '@/context/OnboardingContext';
import { usePopupEligibility } from '@/context/PopupManagerContext';
import { useStartupPhase } from '@/context/StartupPhaseContext';
import { useTour } from '@/context/TourContext';
import { useMyTraining } from '@/hooks/useTraining';

const ScreenContainerView = /** @type {any} */ (ScreenContainer);

// P0 PARENT — LES CASES QUE L'ACCUEIL RETIRE AU PARENT.
//
// Le role Parent est en production depuis le 03/09, et deux personnes reelles
// le portent. Elles lisaient « JOUEUR » en haut de l'ecran et recevaient les
// 13 cases du joueur, dont ces six qui ne veulent rien dire pour elles : un
// parent ne se fait pas recruter, ne depose pas de candidature, n'a pas
// d'historique sportif, ne cotise pas, n'a pas d'equipe pour un amical, et ne
// joue pas en League.
//
// ⚠️ Cette liste ne decide AUCUN droit — decision d'Adel du 2026-09-07 : « le
// role decide de l'INSISTANCE, jamais du DROIT ». Rien n'est verrouille ici,
// les ecrans restent atteignables par la recherche et par les liens ; seule la
// mise en avant change. Un autre role qui deviendrait parent plus tard garde
// donc son accueil entier.
//
// 🧪 Le temoin qui la lit : `src/views/home/__tests__/accueilParRole.test.js`.
// Il la prend ICI plutot que d'en recopier une seconde, qui divergerait.
// ⚠️ Ordre ALPHABETIQUE, impose par `perfectionist/sort-sets` — ce n'est pas
// l'ordre de l'ecran. C'est un ensemble : l'ordre n'a aucun effet.
const CARTES_MASQUEES_AU_PARENT = new Set([
  'league-entry',
  'profile-history',
  'profile-license',
  'search-ads',
  'search-amicaux',
  'search-my-activities',
]);

/**
 * @param {HomeCard} card
 * @returns {boolean}
 */
const estVisiblePourLeParent = (card) => !CARTES_MASQUEES_AU_PARENT.has(card.key);

// 🙈 A02 + A07 (lot ACCUEIL, decisions d'Adel du 30/09) — LES CASES QUE LES
// INTERRUPTEURS RETIRENT A TOUS. FoundClub League et « Reservations » ne sont pas
// prets : ils quittent l'accueil sans qu'une ligne de leur code soit supprimee.
// La liste vit dans `fonctionsMasquees.js` (un interrupteur = une ligne a
// changer) ; le registre humain est `D:/App/fc/FONCTIONS_MASQUEES.md`.
// Meme motif que le masque du parent : une liste nommee, appliquee en bout de
// chaine — une garde oubliee ne fait rougir aucun test, une liste nommee si.
// 🧪 Temoins : `accueilParRole.test.js`, `config/__tests__/fonctionsMasquees.test.js`.
const CARTES_MASQUEES_A_TOUS = new Set(CARTES_ACCUEIL_MASQUEES);

/**
 * Vrai si aucun interrupteur éteint ne retire cette case de l'accueil.
 * Il ne lit que la clef : n'importe quelle carte, typée ou littérale, convient.
 * @param {{ key: string }} card
 * @returns {boolean}
 */
const estAfficheeSurLAccueil = (card) => !CARTES_MASQUEES_A_TOUS.has(card.key);

// SUPADM (recette du 23/10) — l'écran de chaque ligne « À traiter » du SuperAdmin, les mêmes que
// ceux du bandeau (`headBanner`) : la carte « À traiter » ouvre celui de sa première ligne non vide.
/** @type {Record<string, string>} */
const ECRANS_A_TRAITER = {
  aLaUne: RouteNames.FeaturedRequestsList,
  clubsAOnboarder: RouteNames.AdminClubOnboardingList,
  demandesGestionnaire: RouteNames.AdminManagerRequests,
  mairiesAActiver: RouteNames.AdminCollectiviteList,
  revendications: RouteNames.AdminClaimList,
  signalements: RouteNames.AdminReports,
};

/**
 * @typedef {{
 *  id: string;
 *  order: number;
 *  title: any;
 *  description: any;
 *  nextAction?: any;
 *  nextLabel?: any;
 *  nextTargetStepId?: any;
 *  onNext?: any;
 * }} HomeCardTutorial
 */

/**
 * @typedef {{
 *  key: string;
 *  title: any;
 *  subtitle: any;
 *  onPress: () => void;
 *  accessibilityLabel?: string;
 *  titleCount?: number;
 *  footer?: import('react').ReactNode;
 *  disabled?: boolean;
 *  icon?: any;
 *  accentColor?: string;
 *  illustration?: import('react-native').ImageSourcePropType;
 *  illustrationPlacement?: { bottom?: number; height?: number; right?: number; width?: number };
 *  layout?: 'half' | 'full';
 *  emphasis?: 'default' | 'primary';
 *  tone?: 'default' | 'destructive';
 *  highlighted?: boolean;
 *  locked?: boolean;
 *  premiumScope?: 'club' | 'team';
 *  subtitleLines?: number;
 *  tutorial?: any;
 * }} HomeCard
 */

/**
 * @param {{
 *  title: any;
 *  cards: HomeCard[];
 *  Fonts: any;
 *  Spaces: import('@/theme/types').Spaces;
 *  Alignments: any;
 *  registerTutorialTargetNode?: (stepId: string, node: any) => void;
 * }} props
 */

/**
 *
 * @param root0
 * @param root0.Alignments
 * @param root0.cards
 * @param root0.Fonts
 * @param root0.registerTutorialTargetNode
 * @param root0.Spaces
 * @param root0.title
 */
function HomeSection({
  Alignments,
  cards,
  Fonts,
  registerTutorialTargetNode,
  Spaces,
  title,
}) {
  const { width: screenWidth } = useWindowDimensions();
  // D75 — `Images.homeIllustrations` EST la table de correspondance : ses clefs sont
  // exactement les clefs d'icone des cartes. Pas de seconde table a tenir a jour, et
  // une famille sans fichier retombe d'elle-meme sur le halo de HomeActionCard.
  // ⚠️ Le type `Images` est un mappe « clef -> ImageSourcePropType » : il aplatit
  // les tables imbriquees, donc indexer directement ajoute une erreur TS7053.
  const { Images } = useTheme();
  const illustrationsParFamille = /** @type {Record<string, any>} */ (Images.homeIllustrations);
  const tutorialTargetRefs = useRef(/** @type {Record<string, any>} */ ({}));
  if (!cards.length) return null;
  const isSingleCardSection = cards.length === 1;
  const isCompactScreen = screenWidth <= 340;

  return (
    <View style={[Spaces.gap[12]]}>
      <Text style={[Fonts.h4Bold, Fonts.neutral00]}>{title}</Text>
      <View style={[Alignments.row, Alignments.wrap, Alignments.justifySpaceBetween]}>
        {cards.map((card) => {
          const isFullCard = isCompactScreen || isSingleCardSection || card.layout === 'full';
          const cardContainerStyle = /** @type {import('react-native').ViewStyle} */ ({
            flexBasis: isFullCard ? '100%' : '48.5%',
            marginBottom: 14,
            maxWidth: isFullCard ? '100%' : '48.5%',
            width: isFullCard ? '100%' : '48.5%',
          });
          const assignTutorialTargetRef = (/** @type {any} */ node) => {
            tutorialTargetRefs.current[card.key] = node;
            if (typeof registerTutorialTargetNode === 'function' && card.tutorial?.id) {
              registerTutorialTargetNode(card.tutorial.id, node);
            }
          };

          // Guide (TUTOE) : ancre invisible de chaque carte (ex. « Ajouter un événement »).
          const body = (
            <TourTarget id={`home.card.${card.key}`} style={{ flex: 1 }}>
              <HomeActionCard
                accentColor={card.accentColor}
                accessibilityLabel={card.accessibilityLabel}
                badgeCount={card.badgeCount}
                disabled={card.disabled}
                emphasis={card.emphasis}
                footer={card.footer}
                hasAlert={card.hasAlert}
                highlighted={card.highlighted}
                icon={card.icon}
                illustration={card.illustration || illustrationsParFamille[card.icon]}
                illustrationPlacement={card.illustrationPlacement}
                locked={card.locked}
                onPress={card.onPress}
                premiumScope={card.premiumScope}
                subtitle={card.subtitle}
                subtitleLines={card.subtitleLines}
                title={card.title}
                titleCount={card.titleCount}
                tone={card.tone}
                tutorialTargetRef={card.tutorial ? assignTutorialTargetRef : undefined}
              />
            </TourTarget>
          );

          if (!card.tutorial) {
            return (
              <View key={card.key} style={cardContainerStyle}>
                {body}
              </View>
            );
          }

          return (
            <View key={card.key} style={cardContainerStyle}>
              <OnboardingWrapper
                description={card.tutorial.description}
                id={card.tutorial.id}
                nextAction={card.tutorial.nextAction}
                nextLabel={card.tutorial.nextLabel}
                nextTargetStepId={card.tutorial.nextTargetStepId}
                onNext={card.tutorial.onNext}
                order={card.tutorial.order}
                spotlight={{
                  borderRadius: 16,
                  overlayOpacity: 0.42,
                  paddingX: 0,
                  paddingY: 0,
                }}
                style={{
                  alignSelf: 'flex-start',
                  width: '100%',
                }}
                targetNodeResolver={() => tutorialTargetRefs.current[card.key] || null}
                title={card.tutorial.title}
              >
                {body}
              </OnboardingWrapper>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/**
 * @param {{
 *  actionLabel?: string;
 *  description: any;
 *  isLoading?: boolean;
 *  onAction?: () => void;
 *  title: any;
 * }} props
 */
function HomeHubStateView({
  actionLabel,
  description,
  isLoading = false,
  onAction,
  title,
}) {
  const {
    Alignments,
    ApplicationStyle,
    Fonts,
    Spaces,
  } = useTheme();

  return (
    <ScreenContainerView
      bgImage="bg2"
      contentContainerStyle={[
        Alignments.fill,
        Alignments.justifyCenter,
      ]}
      contentWidth="readable"
      responsivePadding
      withHeaderPadding={false}
    >
      <View
        style={[
          ApplicationStyle.borderRadius24,
          ApplicationStyle.borderWidth1,
          Spaces.padding[24],
          Spaces.gap[16],
          {
            alignSelf: 'center',
            backgroundColor: 'rgba(9, 24, 35, 0.88)',
            borderColor: 'rgba(255,255,255,0.08)',
            maxWidth: 560,
            width: '100%',
          },
        ]}
      >
        <Text style={[Fonts.h2, Fonts.neutral00]}>{title}</Text>
        <Text style={[Fonts.p1, Fonts.neutral100]}>{description}</Text>
        {isLoading ? (
          <View style={[Alignments.alignCenter, Spaces.paddingVertical[8]]}>
            <Loader />
          </View>
        ) : null}
        {onAction && actionLabel ? (
          <Button
            onPress={onAction}
            title={actionLabel}
            variant="Primary"
          />
        ) : null}
      </View>
    </ScreenContainerView>
  );
}

/**
 * @param {import('@react-navigation/stack').StackScreenProps<any> & { auth: ReturnType<typeof useAuth> }} props
 */
function HomeHubContent({ auth, navigation, route }) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Images,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { isGold, toggleMode } = useAppMode();
  const {
    currentStep,
    currentStepIndex,
    getStepById,
    isActive: isOnboardingActive,
    refreshCurrentStep,
    startOnboarding,
  } = /** @type {any} */ (useOnboarding());
  const {
    canShowLocalScreenPrompt,
    hasRecentStartupPrompt,
    isStartupStable,
  } = useStartupPhase();
  const {
    canPublishGovernedClubContent,
    canUseParentMode,
    canUsePlayerMode,
    clubVerificationSummary,
    entitlementsSummary,
    freeUsageSummary,
    governedPublishingBlockReason,
    isParentMode,
    isPlayerMode,
    nonPartnerCoachPublishingAccess,
    setDisplayMode,
    subscriptionAccessLevel,
    userData,
  } = auth;
  const clubScope = useClubScope() || {};
  const { showBanner } = useAppFeedback();

  const homeHubTutorial = useFeatureTutorial({
    routeParams: route?.params,
    tutorialId: TutorialIds.HOME_HUB,
    userId: userData?.documentId,
  });

  const [activeTutorialModal, setActiveTutorialModal] = useState(/** @type {'center' | 'feature' | null} */ (null));
  const [contextualPrompt, setContextualPrompt] = useState(/** @type {any | null} */ (null));
  const [isEntryGateVisible, setIsEntryGateVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { height: viewportHeight } = useWindowDimensions();
  const isFocused = useIsFocused();
  const scrollRef = useRef(/** @type {import('react-native').ScrollView | null} */ (null));
  const tutorialTargetNodesRef = useRef(/** @type {Record<string, any>} */ ({}));
  const refreshCurrentStepRef = useRef(refreshCurrentStep);
  const pendingNavigationActionRef = useRef(/** @type {null | (() => void)} */ (null));
  const previousTutorialStepRef = useRef(/** @type {{ id?: string; index?: number } | null} */ (null));
  const sectionAnchorsRef = useRef(/** @type {Record<string, { height: number; y: number }>} */ ({
    account: { height: 0, y: 0 },
    league: { height: 0, y: 0 },
    manage: { height: 0, y: 0 },
    profile: { height: 0, y: 0 },
    quick: { height: 0, y: 0 },
    search: { height: 0, y: 0 },
  }));
  const sectionViewRefs = useRef(/** @type {Record<string, any>} */ ({
    account: null,
    league: null,
    manage: null,
    profile: null,
    quick: null,
    search: null,
  }));

  const roleName = userData?.role?.name;
  // LOT RÔLES (2026-09-28) — en MODE JOUEUR, l'accueil est celui d'un joueur :
  // tout ce qui suit (section Gérer, bandeau, cartes) se déduit de `roleKey`.
  // `userData` n'est pas réécrit, et les droits ne bougent pas (useAuth).
  // PAR-L12 (13/10, décision D6 A d'Adel) — et en MODE PARENT (un sportif qui a des enfants),
  // l'accueil est celui d'un parent : « Mes enfants » en tête, les mêmes cases que le parent.
  /** @type {'player' | 'parent' | null} */
  let modeActif = null;
  if (isPlayerMode) modeActif = 'player';
  else if (isParentMode) modeActif = 'parent';
  const roleKey = modeActif || getUserRoleKey(roleName);
  const isCoach = roleKey === 'coach';
  const isPresident = roleKey === 'president';
  const isSuperAdmin = roleKey === 'superAdmin';
  // P0 — `getUserRoleKey` rend deja 'parent' (authUseCases.js:37) : le trou
  // n'etait pas la, il etait ici, ou personne ne lisait cette valeur.
  const isParent = roleKey === 'parent';
  // PAR-L7 (13/10) — mes enfants en bref : les lectures de « Mes enfants », avec ses cles
  // (l'ecran s'ouvrira deja rempli). REC17-001 : l'accueil n'en lit plus que DEUX choses, a-t-il
  // des enfants (la carte d'un sportif, le mode parent) et leurs prenoms (le bandeau E25) ; la
  // carte « Mes enfants » ne les nomme plus. Sur le role du COMPTE : les quatre roles du
  // club peuvent avoir des enfants ; le super admin et un compte neuf, non (rien ne part).
  const mesEnfants = useMesEnfantsEnBref({
    actif: Boolean(userData?.documentId) && peutAvoirDesEnfants(getUserRoleKey(roleName)),
  });
  // PAR-L12 (E25) — le bandeau nomme les enfants qui attendent dans le mode parent.
  const prenomsDesEnfants = useMemo(
    () => mesEnfants.lignes.map((ligne) => ligne.prenom),
    [mesEnfants.lignes],
  );
  // PAR-L12 (E27) — « Tu pratiques aussi un sport ? » : le premier appui d'un compte Parent.
  const [feuillePratiqueOuverte, setFeuillePratiqueOuverte] = useState(false);
  const ouvrirLaFeuillePratique = useCallback(() => setFeuillePratiqueOuverte(true), []);
  const fermerLaFeuillePratique = useCallback(() => setFeuillePratiqueOuverte(false), []);
  // D72 — « Mon abonnement » et « Ma cotisation » sont RETIREES du super admin
  // (pack accueil, tache 3) : il ne paie ni l'un ni l'autre.
  const canShowSubscriptionExperience = isCoach || isPresident;
  const hasManageSection = isCoach || isPresident;
  const isGovernedNonPartnerCoach = nonPartnerCoachPublishingAccess?.isNonPartnerCoach === true;
  const isPublishingGovernedBlocked = isGovernedNonPartnerCoach
    && canPublishGovernedClubContent !== true;
  const routeParams = route?.params;
  const scrollBottomPadding = tabBarHeight + insets.bottom + 16;
  const entryGateTopInset = Math.max(insets.top, 20) + 16;
  const entryGateBottomInset = Platform.OS === 'web'
    ? Math.max(tabBarHeight + insets.bottom, 112)
    : tabBarHeight + insets.bottom + 20;
  const entryGateMaxHeight = Math.max(260, viewportHeight - entryGateTopInset - entryGateBottomInset);

  const trainedTeamIds = useMemo(
    () => (userData?.trainedTeams || [])
      .map((/** @type {any} */ team) => team?.documentId)
      .filter(Boolean),
    [userData?.trainedTeams],
  );
  const clubId = userData?.club?.documentId;
  const cmId = clubScope.activeMultisportClubId || userData?.multisportClubs?.[0]?.documentId;
  const isTutorialCenterVisible = false;
  const isFeatureTutorialPickerVisible = false;
  const closeContextualPrompt = useCallback(() => {
    setContextualPrompt(null);
  }, []);
  const openContextualPrompt = useCallback((/** @type {any} */ promptConfig) => {
    setContextualPrompt(promptConfig);
  }, []);
  const homeHubEntryPopup = usePopupEligibility(
    POPUP_IDS.HOME_HUB_ENTRY_GATE,
    Boolean(isFocused && isEntryGateVisible),
    {
      cooldownKey: userData?.documentId || 'anonymous',
    },
  );
  const isHomeHubEntryGateVisible = false;
  useBlockingOverlayLifecycle(homeHubEntryPopup.descriptor.id, isHomeHubEntryGateVisible, {
    releaseDelayMs: 320,
  });
  const shouldRenderLegacyEntryGate = Platform.OS !== 'web' && isHomeHubEntryGateVisible;
  const isExternalCompetitionPromptEnabled = isFocused
    && isStartupStable
    && canShowLocalScreenPrompt
    && !hasRecentStartupPrompt
    && !isOnboardingActive
    && !homeHubTutorial.shouldForceStart
    && activeTutorialModal === null
    && !isHomeHubEntryGateVisible;

  const legacySearchTarget = useMemo(() => resolveLegacySearchTarget(routeParams, userData), [routeParams, userData]);
  const subscriptionStatusMeta = useMemo(
    () => getSubscriptionStatusMeta(subscriptionAccessLevel),
    [subscriptionAccessLevel],
  );
  const eventPublishQuotaItem = useMemo(
    () => getSubscriptionQuotaItem(freeUsageSummary, 'EVENT_PUBLISH', subscriptionAccessLevel),
    [freeUsageSummary, subscriptionAccessLevel],
  );

  // L10-C — les deux cartes de publication sont des POINTS D'ENTREE : quand le
  // quota gratuit est deja epuise, l'app le sait des le demarrage (bootstrap) et
  // doit le dire ICI, au lieu de laisser remplir le wizard entier pour refuser a
  // la fin (STRATEGIE_PAYWALL_2026_08_01 §2.3). Le juge est partage avec la
  // liste des equipes : une seule regle, un seul endroit.
  const addEventLock = useMemo(
    () => getSubscriptionEntryPointLock({
      freeUsageSummary,
      quotaType: 'EVENT_PUBLISH',
      roleKey,
      subscriptionAccessLevel,
    }),
    [freeUsageSummary, roleKey, subscriptionAccessLevel],
  );
  const addAdLock = useMemo(
    () => getSubscriptionEntryPointLock({
      freeUsageSummary,
      quotaType: 'RECRUITMENT_AD_PUBLISH',
      roleKey,
      subscriptionAccessLevel,
    }),
    [freeUsageSummary, roleKey, subscriptionAccessLevel],
  );
  const [subscriptionPaywallDecision, setSubscriptionPaywallDecision] = useState(null);

  const lastLegacyRedirectRef = useRef('');
  useEffect(() => {
    refreshCurrentStepRef.current = refreshCurrentStep;
  }, [refreshCurrentStep]);

  useEffect(() => {
    if (!legacySearchTarget) return;
    const redirectKey = JSON.stringify(legacySearchTarget);
    if (redirectKey === lastLegacyRedirectRef.current) return;
    lastLegacyRedirectRef.current = redirectKey;

    navigation.navigate(legacySearchTarget.routeName, legacySearchTarget.params);
    navigation.setParams({
      initialRecruitmentTab: undefined,
      initialSearchType: undefined,
      initialTab: undefined,
      timestamp: undefined,
    });
  }, [legacySearchTarget, navigation]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('blur', () => {
      tutorialDebugLog('homehub.blur.closeModals');
      setActiveTutorialModal(null);
      pendingNavigationActionRef.current = null;
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (isFocused) return;
    tutorialDebugLog('homehub.unfocused.resetModals');
    setActiveTutorialModal(null);
    setIsEntryGateVisible(false);
    pendingNavigationActionRef.current = null;
  }, [isFocused]);

  useEffect(() => {
    if (!isOnboardingActive) return;
    setActiveTutorialModal(null);
    setIsEntryGateVisible(false);
  }, [isOnboardingActive]);

  useEffect(() => {
    if (!isFocused || !userData?.documentId) {
      setIsEntryGateVisible(false);
      return;
    }
    if (!ENABLE_STARTUP_TUTORIALS || !isStartupStable || !canShowLocalScreenPrompt || hasRecentStartupPrompt) {
      setIsEntryGateVisible(false);
      return;
    }
    if (isOnboardingActive || homeHubTutorial.shouldForceStart) {
      setIsEntryGateVisible(false);
      return;
    }
    const shouldShowEntryGate = homeHubTutorial.entryGateChoice === 'pending';
    setIsEntryGateVisible((previousValue) => (
      previousValue === shouldShowEntryGate ? previousValue : shouldShowEntryGate
    ));
  }, [
    homeHubTutorial.entryGateChoice,
    homeHubTutorial.shouldForceStart,
    canShowLocalScreenPrompt,
    hasRecentStartupPrompt,
    isStartupStable,
    isFocused,
    isOnboardingActive,
    userData?.documentId,
  ]);

  useEffect(() => {
    if (!isHomeHubEntryGateVisible) return;
    homeHubEntryPopup.markShown(/** @type {any} */ ({
      userId: userData?.documentId || 'anonymous',
    }));
  }, [homeHubEntryPopup, isHomeHubEntryGateVisible, userData?.documentId]);

  const registerSectionAnchor = useCallback((/** @type {string} */ sectionKey, /** @type {any} */ event) => {
    const nextY = event?.nativeEvent?.layout?.y ?? 0;
    const nextHeight = event?.nativeEvent?.layout?.height ?? 0;
    const previous = sectionAnchorsRef.current[sectionKey];
    if (
      Math.abs((previous?.y || 0) - nextY) < 1
      && Math.abs((previous?.height || 0) - nextHeight) < 1
    ) {
      return;
    }
    sectionAnchorsRef.current[sectionKey] = {
      height: nextHeight,
      y: nextY,
    };
  }, []);

  const registerSectionViewRef = useCallback((/** @type {string} */ sectionKey, /** @type {any} */ node) => {
    sectionViewRefs.current[sectionKey] = node;
  }, []);

  const registerTutorialTargetNode = useCallback((/** @type {string} */ stepId, /** @type {any} */ node) => {
    if (!stepId) return;
    if (node) {
      tutorialTargetNodesRef.current[stepId] = node;
      return;
    }
    delete tutorialTargetNodesRef.current[stepId];
  }, []);

  const waitForWebScrollSettle = useCallback((/** @type {number} */ targetTop) => new Promise((resolve) => {
    if (Platform.OS !== 'web') {
      resolve(undefined);
      return;
    }

    const startTime = Date.now();
    const maxWaitMs = 1400;
    let lastScrollY = window.scrollY;
    let stableFrameCount = 0;

    const checkScroll = () => {
      const currentScrollY = window.scrollY;
      const hasReachedTarget = Math.abs(currentScrollY - targetTop) <= 2;
      const isStable = Math.abs(currentScrollY - lastScrollY) <= 1;

      if (hasReachedTarget && isStable) {
        stableFrameCount += 1;
      } else if (isStable) {
        stableFrameCount += 0.5;
      } else {
        stableFrameCount = 0;
      }

      if (stableFrameCount >= 2 || (Date.now() - startTime) >= maxWaitMs) {
        resolve(undefined);
        return;
      }

      lastScrollY = currentScrollY;
      requestAnimationFrame(checkScroll);
    };

    requestAnimationFrame(checkScroll);
  }), []);

  const scrollToSection = useCallback((/** @type {string} */ sectionKey) => {
    const SECTION_TARGET_TOP = 170;
    const REFRESH_DELAYS = Platform.OS === 'web'
      ? [140, 320, 560]
      : [80, 180, 320];
    const FINAL_REFRESH_DELAY = REFRESH_DELAYS[REFRESH_DELAYS.length - 1] || 0;

    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 5;

      const resolveAfterRefresh = () => {
        REFRESH_DELAYS.forEach((delay) => {
          setTimeout(() => {
            refreshCurrentStepRef.current?.();
          }, delay);
        });
        setTimeout(() => resolve(undefined), FINAL_REFRESH_DELAY + 40);
      };

      const tryScroll = () => {
        attempts += 1;
        if (Platform.OS === 'web') {
          const sectionView = sectionViewRefs.current[sectionKey];
          if (typeof sectionView?.getBoundingClientRect === 'function') {
            const rect = sectionView.getBoundingClientRect();
            if (!rect.width || !rect.height) {
              if (attempts < maxAttempts) {
                setTimeout(tryScroll, 120);
              } else {
                resolve(undefined);
              }
              return;
            }

            const nextTop = Math.max(
              0,
              window.scrollY + rect.top - SECTION_TARGET_TOP,
            );
            window.scrollTo({
              behavior: 'smooth',
              top: nextTop,
            });
            waitForWebScrollSettle(nextTop).then(resolveAfterRefresh);
            return;
          }

          if (typeof sectionView?.measureInWindow === 'function') {
            sectionView.measureInWindow((
              /** @type {number} */ _measuredX,
              /** @type {number} */ measuredY,
              /** @type {number} */ width,
              /** @type {number} */ height,
            ) => {
              if (!width || !height) {
                if (attempts < maxAttempts) {
                  setTimeout(tryScroll, 120);
                } else {
                  resolve(undefined);
                }
                return;
              }

              const nextTop = Math.max(
                0,
                window.scrollY + measuredY - SECTION_TARGET_TOP,
              );
              window.scrollTo({
                behavior: 'smooth',
                top: nextTop,
              });
              waitForWebScrollSettle(nextTop).then(resolveAfterRefresh);
            });
            return;
          }
        }

        const sectionAnchor = sectionAnchorsRef.current[sectionKey];
        if (!(sectionAnchor?.height > 0)) {
          if (attempts < maxAttempts) {
            setTimeout(tryScroll, 120);
          } else {
            resolve(undefined);
          }
          return;
        }

        const targetY = Math.max(
          0,
          (sectionAnchor.y || 0) - SECTION_TARGET_TOP,
        );

        scrollRef.current?.scrollTo({
          animated: true,
          y: targetY,
        });

        resolveAfterRefresh();
      };

      tryScroll();
    });
  }, [waitForWebScrollSettle]);

  const scrollToTop = useCallback(() => {
    const REFRESH_DELAYS = Platform.OS === 'web'
      ? [140, 320, 560]
      : [80, 180, 320];
    const FINAL_REFRESH_DELAY = REFRESH_DELAYS[REFRESH_DELAYS.length - 1] || 0;

    return new Promise((resolve) => {
      if (Platform.OS === 'web') {
        const targetTop = 0;
        window.scrollTo({
          behavior: 'smooth',
          top: targetTop,
        });
        waitForWebScrollSettle(targetTop).then(() => {
          REFRESH_DELAYS.forEach((delay) => {
            setTimeout(() => {
              refreshCurrentStepRef.current?.();
            }, delay);
          });
          setTimeout(() => resolve(undefined), FINAL_REFRESH_DELAY + 40);
        });
        return;
      }
      scrollRef.current?.scrollTo({
        animated: true,
        y: 0,
      });
      REFRESH_DELAYS.forEach((delay) => {
        setTimeout(() => {
          refreshCurrentStepRef.current?.();
        }, delay);
      });
      setTimeout(() => resolve(undefined), FINAL_REFRESH_DELAY + 40);
    });
  }, [waitForWebScrollSettle]);

  const scrollToTutorialTarget = useCallback((
    /** @type {string} */ targetStepId,
    /** @type {string | null} */ fallbackSectionKey = null,
  ) => {
    const runFallbackScroll = () => (
      fallbackSectionKey ? scrollToSection(fallbackSectionKey) : Promise.resolve(null)
    );

    const targetStep = /** @type {any} */ (getStepById(targetStepId));
    const getTargetNode = targetStep?.getTargetNode;
    const resolveTargetNode = () => (
      tutorialTargetNodesRef.current[targetStepId]
      || (typeof getTargetNode === 'function' ? getTargetNode() : null)
    );
    const targetNode = resolveTargetNode();
    let targetNodeSource = 'unresolved';
    if (tutorialTargetNodesRef.current[targetStepId]) {
      targetNodeSource = 'homehub-registry';
    } else if (typeof getTargetNode === 'function') {
      targetNodeSource = 'step-registry';
    }

    tutorialDebugLog('homehub.scrollToTutorialTarget', {
      fallbackSectionKey,
      targetStepId,
    });
    setTutorialDebugState({
      lastRequestedFallbackSection: fallbackSectionKey,
      lastRequestedTargetId: targetStepId,
      lastScrollMode: null,
      targetNodeFound: Boolean(targetNode),
      targetNodeSource,
      targetStepFound: Boolean(targetStep),
      windowScrollY: Platform.OS === 'web' && typeof window !== 'undefined' ? window.scrollY : null,
    });

    if (Platform.OS !== 'web') {
      setTutorialDebugState({
        lastFailureReason: 'homehub-scroll-non-web',
        lastScrollMode: 'fallback',
      });
      return runFallbackScroll();
    }

    if (!targetNode && typeof getTargetNode !== 'function') {
      setTutorialDebugState({
        lastFailureReason: 'homehub-scroll-target-missing',
        lastScrollMode: 'fallback',
      });
      return runFallbackScroll();
    }

    return scrollTutorialTargetIntoViewOnWeb(resolveTargetNode, {
      bottomInset: Math.max(tabBarHeight + insets.bottom, 112) + 16,
      preferredPlacement: 'above',
      tooltipGap: 24,
      tooltipHeight: 220,
      topInset: Math.max(insets.top, 16) + 88,
    }).then((resolvedLayout) => {
      if (!resolvedLayout) {
        setTutorialDebugState({
          lastFailureReason: 'homehub-scroll-target-unresolved',
          lastScrollMode: 'fallback',
          windowScrollY: Platform.OS === 'web' && typeof window !== 'undefined' ? window.scrollY : null,
        });
        return runFallbackScroll();
      }

      setTutorialDebugState({
        lastFailureReason: null,
        lastResolvedStepId: targetStepId,
        lastResolvedTargetId: targetStepId,
        lastScrollMode: 'target',
        windowScrollY: Platform.OS === 'web' && typeof window !== 'undefined' ? window.scrollY : null,
      });
      return resolvedLayout;
    });
  }, [getStepById, insets.bottom, insets.top, scrollToSection, tabBarHeight]);

  const scrollToSearchSection = useCallback(() => (
    scrollToTutorialTarget('homehub-searchEvents', 'search')
  ), [scrollToTutorialTarget]);

  const scrollToLeagueSection = useCallback(() => (
    scrollToTutorialTarget('homehub-league', 'league')
  ), [scrollToTutorialTarget]);

  // D72 — le raccourci de defilement vers « Navigation rapide » est retire avec
  // la section : il visait la premiere etape du tour de ce rayon, disparue.
  // 🏠 A17 + A21 (lot ACCUEIL) — meme sort pour ceux de « Mon profil » et de
  // « Compte » : ces rubriques vivent dans « Mon compte », le tour ne les vise plus.

  const getHomeHubSectionForStepId = useCallback((/** @type {string | undefined | null} */ stepId) => {
    if (!stepId || typeof stepId !== 'string') return null;
    if (!stepId.startsWith('homehub-')) return null;
    if (stepId === 'homehub-header') return 'top';

    const normalized = stepId.replace('homehub-', '');

    if (normalized.startsWith('manage')) return 'manage';
    if (normalized.startsWith('search')) return 'search';
    if (normalized === 'league') return 'league';
    if (normalized.startsWith('profile')) return 'profile';
    if (normalized.startsWith('quick')) return 'quick';
    if (normalized.startsWith('account') || normalized === 'tutorialCenter') return 'account';

    return null;
  }, []);

  useEffect(() => {
    if (!isOnboardingActive) {
      previousTutorialStepRef.current = null;
      return;
    }

    const currentId = currentStep?.id;
    const currentIndex = currentStepIndex;
    const previous = previousTutorialStepRef.current;

    const previousIndex = typeof previous?.index === 'number' ? previous.index : null;
    const isBackward = previousIndex !== null && typeof currentIndex === 'number' && currentIndex < previousIndex;

    if (isBackward) {
      const previousSection = getHomeHubSectionForStepId(previous?.id);
      const currentSection = getHomeHubSectionForStepId(currentId);

      if (currentSection && currentSection !== previousSection) {
        tutorialDebugLog('homehub.backwardScroll', {
          currentId,
          currentIndex,
          fromIndex: previousIndex,
          fromSection: previousSection,
          toSection: currentSection,
        });

        if (currentSection === 'top') {
          scrollToTop();
        } else {
          scrollToTutorialTarget(currentId, currentSection);
        }
      }
    }

    previousTutorialStepRef.current = {
      id: currentId,
      index: currentIndex,
    };
  }, [
    currentStep?.id,
    currentStepIndex,
    getHomeHubSectionForStepId,
    isOnboardingActive,
    scrollToTutorialTarget,
    scrollToTop,
  ]);

  const openFeatureTutorialPicker = useCallback(() => {
    setActiveTutorialModal('feature');
  }, []);

  const closeTutorialCenterModal = useCallback(() => {
    setActiveTutorialModal((previousModal) => (
      previousModal === 'center' ? null : previousModal
    ));
  }, []);

  const closeFeatureTutorialPicker = useCallback(() => {
    setActiveTutorialModal((previousModal) => (
      previousModal === 'feature' ? null : previousModal
    ));
  }, []);

  const closeTutorialModals = useCallback(() => {
    setActiveTutorialModal(null);
  }, []);

  const runPendingNavigation = useCallback((/** @type {number} */ delayMs) => {
    if (!isFocused) return undefined;
    const navigateAction = pendingNavigationActionRef.current;
    if (!navigateAction) return undefined;
    pendingNavigationActionRef.current = null;
    tutorialDebugLog('homehub.runPendingNavigation', { delayMs });

    const timer = setTimeout(() => {
      InteractionManager.runAfterInteractions(() => {
        requestAnimationFrame(() => {
          tutorialDebugLog('homehub.executePendingNavigation');
          navigateAction();
        });
      });
    }, delayMs);

    return () => clearTimeout(timer);
  }, [isFocused]);

  const navigateAfterClosingModals = useCallback((/** @type {() => void} */ navigateAction) => {
    pendingNavigationActionRef.current = navigateAction;
    tutorialDebugLog('homehub.navigateAfterClosingModals', {
      activeTutorialModal,
    });
    if (activeTutorialModal === null) {
      runPendingNavigation(0);
      return;
    }
    closeTutorialModals();
  }, [activeTutorialModal, closeTutorialModals, runPendingNavigation]);

  useEffect(() => {
    if (!isFocused) return undefined;
    if (activeTutorialModal !== null) return undefined;
    const MODAL_DISMISS_DELAY_MS = 320;
    return runPendingNavigation(MODAL_DISMISS_DELAY_MS);
  }, [activeTutorialModal, isFocused, runPendingNavigation]);

  const launchHomeTutorialFlow = useCallback(() => {
    let attempts = 0;
    const maxAttempts = 10;

    const tryStart = () => {
      attempts += 1;
      const didStart = /** @type {any} */ (startOnboarding)({ forceFromStart: true });

      if (didStart) {
        homeHubTutorial.markSeen('manual');
        return;
      }

      if (attempts < maxAttempts) {
        setTimeout(tryStart, 110);
      }
    };

    requestAnimationFrame(tryStart);
  }, [homeHubTutorial, startOnboarding]);

  const startHomeTutorial = useCallback(() => {
    closeTutorialModals();
    homeHubTutorial.resetTutorial();
    scrollToTop().finally(() => {
      InteractionManager.runAfterInteractions(() => {
        launchHomeTutorialFlow();
      });
    });
  }, [closeTutorialModals, homeHubTutorial, launchHomeTutorialFlow, scrollToTop]);

  const handleEntryStartTutorial = useCallback(() => {
    homeHubEntryPopup.trackEvent('accepted', /** @type {any} */ ({ action: 'start_tutorial' }));
    homeHubTutorial.setEntryChoice('start');
    homeHubTutorial.setAutoEnabled(true);
    setIsEntryGateVisible(false);
    closeTutorialModals();
    homeHubTutorial.resetTutorial();
    scrollToTop().finally(() => {
      InteractionManager.runAfterInteractions(() => {
        launchHomeTutorialFlow();
      });
    });
  }, [closeTutorialModals, homeHubEntryPopup, homeHubTutorial, launchHomeTutorialFlow, scrollToTop]);

  const handleEntrySkipTutorial = useCallback(() => {
    homeHubEntryPopup.dismiss();
    homeHubTutorial.skipAllAuto();
    setIsEntryGateVisible(false);
    closeTutorialModals();
  }, [closeTutorialModals, homeHubEntryPopup, homeHubTutorial]);

  const navigateToTutorial = useCallback((/** @type {string} */ tutorialId) => {
    const tutorialParams = {
      startTutorial: true,
      tutorialId,
      tutorialSource: 'homeHub',
      tutorialStartToken: Date.now(),
    };

    switch (tutorialId) {
      case TutorialIds.ACCOUNT_SWITCHER_MODAL:
        navigateAfterClosingModals(() => {
          navigation.navigate(RouteNames.ProfileStack, {
            params: { ...tutorialParams, openAccountModal: true },
            screen: RouteNames.Profile,
          });
        });
        return;
      case TutorialIds.CLUB_MEMBERSHIP_REQUESTS:
        if (!clubId) {
          showBanner({
            body: t('homeHub.alerts.noClub.description', 'Ton compte doit être rattaché à un club pour gérer ces demandes.'),
            title: t('homeHub.alerts.noClub.title', 'Club introuvable'),
            tone: 'error',
          });
          return;
        }
        navigateAfterClosingModals(() => {
          navigateToRequestsHub(navigation, {
            ...tutorialParams,
            initialFilter: 'club',
            source: 'home',
          });
        });
        return;
      case TutorialIds.EVENT_WIZARD_TYPE:
        navigateAfterClosingModals(() => {
          navigation.navigate(RouteNames.EventStack, {
            params: tutorialParams,
            screen: RouteNames.EventWizardType,
          });
        });
        return;
      case TutorialIds.FEATURED_REQUESTS:
        if (cmId) {
          navigateAfterClosingModals(() => {
            navigateToRequestsHub(navigation, {
              ...tutorialParams,
              initialFilter: 'featured',
              source: 'home',
            });
          });
          return;
        }
        if (clubId) {
          navigateAfterClosingModals(() => {
            navigateToRequestsHub(navigation, {
              ...tutorialParams,
              initialFilter: 'event',
              source: 'home',
            });
          });
        }
        return;
      case TutorialIds.HISTORY_WIZARD:
        navigateAfterClosingModals(() => {
          navigation.navigate(RouteNames.ProfileStack, {
            params: { ...tutorialParams, resetContext: true, returnRoute: RouteNames.HomeTab },
            screen: RouteNames.HistoryWizardCategory,
          });
        });
        return;
      case TutorialIds.LOGOUT_CONFIRMATION:
        navigateAfterClosingModals(() => {
          navigation.navigate(RouteNames.ProfileStack, {
            params: tutorialParams,
            screen: RouteNames.Profile,
          });
        });
        return;
      case TutorialIds.MESSAGING:
        navigateAfterClosingModals(() => {
          navigation.navigate(RouteNames.HomeTab, { params: tutorialParams, screen: RouteNames.Chat });
        });
        return;
      case TutorialIds.MY_TEAMS:
        navigateAfterClosingModals(() => {
          navigation.navigate(RouteNames.HomeTab, { params: tutorialParams, screen: RouteNames.MyTeamList });
        });
        return;
      case TutorialIds.PLANNING:
        navigateAfterClosingModals(() => {
          navigation.navigate(RouteNames.HomeTab, { params: tutorialParams, screen: RouteNames.MyEventList });
        });
        return;
      case TutorialIds.PROFILE_EDIT:
        navigateAfterClosingModals(() => {
          navigation.navigate(RouteNames.ProfileStack, { params: tutorialParams, screen: RouteNames.ProfileEdit });
        });
        return;
      case TutorialIds.PROFILE_MAIN:
        navigateAfterClosingModals(() => {
          navigation.navigate(RouteNames.ProfileStack, { params: tutorialParams, screen: RouteNames.Profile });
        });
        return;
      case TutorialIds.REQUESTS_DASHBOARD:
        navigateAfterClosingModals(() => {
          navigateToRequestsHub(navigation, {
            ...tutorialParams,
            initialFilter: 'all',
            source: 'home',
          });
        });
        return;
      case TutorialIds.SEARCH_CLUBS:
        navigateAfterClosingModals(() => {
          navigation.navigate(RouteNames.SearchClubs, tutorialParams);
        });
        return;
      case TutorialIds.SEARCH_EVENTS:
        navigateAfterClosingModals(() => {
          navigation.navigate(RouteNames.SearchEvents, tutorialParams);
        });
        return;
      case TutorialIds.SEARCH_RECRUITMENT:
        navigateAfterClosingModals(() => {
          navigation.navigate(RouteNames.SearchRecruitment, {
            ...tutorialParams,
            initialRecruitmentTab: getDefaultRecruitmentTab(userData),
          });
        });
        return;
      case TutorialIds.SEARCH_RESERVATIONS:
        navigateAfterClosingModals(() => {
          navigation.navigate(RouteNames.SearchReservations, tutorialParams);
        });
        return;
      case TutorialIds.TEAM_MEMBERSHIP_REQUESTS:
        if (!trainedTeamIds.length) {
          showBanner({
            body: t('homeHub.alerts.noTrainedTeams.description', 'Tu dois être entraîneur d\'au moins une équipe pour gérer les demandes d\'adhésion.'),
            title: t('homeHub.alerts.noTrainedTeams.title', 'Aucune équipe disponible'),
            tone: 'error',
          });
          return;
        }
        navigateAfterClosingModals(() => {
          navigateToRequestsHub(navigation, {
            ...tutorialParams,
            initialFilter: 'team',
            source: 'home',
          });
        });
        break;

      default:
    }
  }, [clubId, cmId, navigateAfterClosingModals, navigation, showBanner, t, trainedTeamIds, userData]);

  const handleResetAllTutorials = useCallback(() => {
    openContextualPrompt({
      body: t('homeHubTutorial.reset.description', 'Tous les tutoriels seront remis a zéro pour ce compte.'),
      primaryAction: {
        label: t('homeHubTutorial.reset.confirm', 'Réinitialiser'),
        onPress: () => {
          closeContextualPrompt();
          homeHubTutorial.resetAllTutorials();
          closeTutorialModals();
          scrollRef.current?.scrollTo({ animated: false, y: 0 });
          InteractionManager.runAfterInteractions(() => {
            launchHomeTutorialFlow();
          });
        },
        variant: 'Primary',
      },
      secondaryAction: {
        label: t('common.actions.cancel', 'Annuler'),
        onPress: closeContextualPrompt,
        variant: 'Secondary',
      },
      title: t('homeHubTutorial.reset.title', 'Réinitialiser les tutoriels'),
      tone: 'critical',
    });
  }, [closeContextualPrompt, closeTutorialModals, homeHubTutorial, launchHomeTutorialFlow, openContextualPrompt, t]);

  const handleOpenLeague = useCallback(() => {
    const targetRoute = RouteNames.LeagueHomeTab;
    if (!isGold) toggleMode();

    const currentRouteNames = navigation?.getState?.()?.routeNames || [];
    if (currentRouteNames.includes(targetRoute)) {
      navigation.navigate(targetRoute);
      return;
    }

    const parentNavigation = navigation?.getParent?.();
    const parentRouteNames = parentNavigation?.getState?.()?.routeNames || [];
    if (parentNavigation && parentRouteNames.includes(targetRoute)) {
      parentNavigation.navigate(targetRoute);
      return;
    }

    navigation.navigate(targetRoute);
  }, [isGold, navigation, toggleMode]);

  const handleAddEvent = useCallback(() => {
    if (isPublishingGovernedBlocked) {
      showBanner({
        body: t(
          'homeHub.alerts.nonPartnerCoachPublishingBlocked.description',
          "Ton club n'est pas encore certifié sur FoundClub. Un superadmin doit autoriser la publication avant de créer un événement.",
        ),
        title: t(
          'homeHub.alerts.nonPartnerCoachPublishingBlocked.title',
          'Publication en attente d autorisation',
        ),
        tone: 'warning',
      });
      return;
    }

    // Quota gratuit deja epuise : on vend ici plutot que de faire remplir le
    // wizard pour refuser au recapitulatif (§2.3).
    if (addEventLock) {
      setSubscriptionPaywallDecision(addEventLock.decision);
      return;
    }

    navigation.navigate(RouteNames.EventStack, { screen: RouteNames.EventWizardType });
  }, [addEventLock, isPublishingGovernedBlocked, navigation, showBanner, t]);

  const handleAddRecruitmentAd = useCallback(() => {
    if (isPublishingGovernedBlocked) {
      showBanner({
        body: t(
          'homeHub.alerts.nonPartnerCoachPublishingBlocked.adDescription',
          "Ton club n'est pas encore certifié sur FoundClub. Un superadmin doit autoriser la publication avant de créer une offre.",
        ),
        title: t(
          'homeHub.alerts.nonPartnerCoachPublishingBlocked.title',
          'Publication en attente d autorisation',
        ),
        tone: 'warning',
      });
      return;
    }

    if (addAdLock) {
      setSubscriptionPaywallDecision(addAdLock.decision);
      return;
    }

    navigation.navigate(RouteNames.AdWizardStack);
  }, [addAdLock, isPublishingGovernedBlocked, navigation, showBanner, t]);

  // Lot D35, §4 du pack : « Mes annonces » devient « Mes activites ». Un seul
  // point de changement — les DEUX cases de l accueil (branche president et
  // branche entraineur) passent par ce rappel.
  // Les sous-onglets de gestion de Recrutement RESTENT en place : tant que
  // « Mes activites » n a pas passe la recette emulateur, retirer l ancien
  // chemin priverait d acces sans filet.
  const handleOpenMyRecruitmentAds = useCallback(() => {
    // RW-PARENT (29/10) — « Mes activités » n'a pas encore d'adresse sur le site
    // (webRouteExemptions.js) : on l'explique au lieu d'un bouton qui ne fait rien.
    navigateOrExplainOnWeb(navigation, RouteNames.MyActivities);
  }, [navigation]);

  const handleOpenClubLicenses = useCallback(() => {
    if (!clubId) {
      showBanner({
        body: t('homeHub.alerts.missingContext.description', 'Aucun club disponible pour cette action.'),
        title: t('homeHub.alerts.missingContext.title', 'Contexte manquant'),
        tone: 'error',
      });
      return;
    }

    navigation.navigate(RouteNames.ClubStack, {
      params: { clubId },
      screen: RouteNames.ClubLicenses,
    });
  }, [clubId, navigation, showBanner, t]);

  const handleOpenRequestsHub = useCallback((/** @type {any} */ initialFilter = 'all') => {
    const hasRequestsContext = Boolean(clubId || cmId || trainedTeamIds.length);
    if (!hasRequestsContext) {
      showBanner({
        body: t('homeHub.alerts.missingContext.description', 'Aucun club disponible pour gérer les demandes à la une.'),
        title: t('homeHub.alerts.missingContext.title', 'Contexte manquant'),
        tone: 'error',
      });
      return;
    }

    navigateToRequestsHub(navigation, {
      initialFilter,
      source: 'home',
    });
  }, [clubId, cmId, navigation, showBanner, t, trainedTeamIds.length]);

  const handleOpenManageClub = useCallback(() => {
    // RWDIRIG3 : un dirigeant sans club va a la creation de son club (manageClubTarget.js).
    const cible = resolveManageClubTarget({ clubId, cmId, isPresident });
    if (cible) {
      navigation.navigate(cible.name, cible.params);
      return;
    }

    showBanner({
      body: t('homeHub.alerts.missingContext.description', 'Aucun club disponible pour gérer les demandes à la une.'),
      title: t('homeHub.alerts.missingContext.title', 'Contexte manquant'),
      tone: 'error',
    });
  }, [clubId, cmId, isPresident, navigation, showBanner, t]);

  // 🏠 A17 + A21 (lot ACCUEIL, 30/09) — les gestes de « Mon profil » et de
  // « Compte » (voir mon profil, le modifier, historique, alertes, cotisations,
  // changer de compte, deconnexion) sont partis avec leurs cases : ils existent
  // dans « Mon compte » (`Profile.js`), qui les porte deja ou les a recus.

  // L33 — cap sur le CARROUSEL : la carte d'accueil affiche un COMPTEUR
  // (« N événements offerts restants »), c'est un argument de vente. Le hub ne
  // porte plus de catalogue ; y renvoyer couterait un tap de plus a qui veut
  // payer. La gestion reste atteignable depuis « Mon compte ».
  // FINITIONS16 23 — decision L33 completee par Adel le 06/10 (`tuile B`) : un club dont l'offre
  // Club est COUVERTE PAR LA VILLE n'a rien a acheter ; la tuile ouvre « Mon abonnement » (le hub,
  // « Offert par la Ville… »). Les autres clubs : le carrousel, inchange. Meme juge et meme club
  // actif que « Mon compte » (Profile.js) et l'ecran qu'elle ouvre.
  const clubCouvertParLaVille = Boolean(getCollectiviteOffer({
    clubDocumentId: clubVerificationSummary?.clubDocumentId || userData?.club?.documentId,
    entitlementsSummary,
  }));
  const handleOpenSubscriptionOverview = useCallback(() => {
    navigation.navigate(RouteNames.ProfileStack, {
      screen: clubCouvertParLaVille
        ? RouteNames.SubscriptionOverview
        : RouteNames.SubscriptionOffers,
    });
  }, [clubCouvertParLaVille, navigation]);

  // S06 — OUVRIR L'EVENEMENT QUE LE BANDEAU VIENT DE NOMMER.
  //
  // Adel en recette de la `2.6.19` : « dans le bandeau, quand on clique dessus,
  // ca nous renvoie sur le PLANNING alors que ca devrait nous renvoyer sur les
  // details de l'evenement ». La ligne « prochain evenement » du dirigeant
  // appelait `handleOpenPlanning` — l'onglet du calendrier — alors qu'elle
  // affiche le nom et l'heure d'UN evenement precis, dont l'identifiant est deja
  // en main (`homeCounters.js` : `prochainEvenement` porte `{ id, label,
  // startsAt }`).
  //
  // ⚠️ `EventDetails` n'est PAS une route de la barre d'onglets : elle vit dans
  // `EventStack`. C'est pour ca que cette fonction existe une seule fois et que
  // les trois variantes du bandeau l'empruntent — les deux autres visaient bien
  // l'evenement, mais par un `navigate(EventDetails, …)` que le navigateur de
  // l'accueil ne sait pas resoudre. Le motif retenu est celui des six appelants
  // deja en place dans l'app (`EventListContent`, `PersonalPlanningContainer`,
  // `CMPlanningContent`, `FeaturedEvents`, `ReservationListContent`,
  // `EventMessageBubble`) — §1 bis, barreau 2 : on ne reinvente pas un chemin
  // qui existe.
  const handleOpenEvent = useCallback((eventId) => {
    if (!eventId) return;
    navigation.navigate(RouteNames.EventStack, {
      params: { eventId },
      screen: RouteNames.EventDetails,
    });
  }, [navigation]);

  // D72 — `handleOpenMyTeams` et `handleOpenMessaging` retires avec la section
  // « Navigation rapide » : « Equipes » et « Messages » sont deux onglets de la
  // barre du bas, ces deux raccourcis doublaient donc une destination existante.

  const roleLabel = useMemo(() => {
    if (isCoach) return t('homeHub.roles.coach', 'Coach / Prof');
    if (isPresident) return t('homeHub.roles.president', 'Dirigeant');
    // D72 — le super admin lisait « JOUEUR » sous le titre : il n'avait aucun
    // libelle de role. Le pack demande « ACCUEIL — SUPER ADMIN » (capture 04).
    if (isSuperAdmin) return t('homeHub.roles.superAdmin', 'Super admin');
    // P0 — le meme defaut que celui repare pour le super admin par D72, et il
    // durait depuis le 03/09 : faute de clef `homeHub.roles.parent`, un parent
    // lisait « JOUEUR » sous le titre de son propre accueil.
    if (isParent) return t('homeHub.roles.parent', 'Parent');
    return t('homeHub.roles.player', 'Pratiquant / Joueur');
  }, [isCoach, isParent, isPresident, isSuperAdmin, t]);

  // D72 — le rayon de tete change de nom avec le role : « Gerer mon club » pour
  // le dirigeant, « Mon club » pour l'entraineur (il n'administre pas, il y
  // travaille), « Administration » pour le super admin.
  const manageSectionTitle = useMemo(() => {
    if (isSuperAdmin) return t('homeHub.sections.administration', 'Administration');
    if (isCoach) return t('homeHub.sections.myClub', 'Mon club');
    return t('homeHub.sections.manageClub');
  }, [isCoach, isSuperAdmin, t]);

  const tutorialOptions = useMemo(() => {
    /** @type {{ id: any; label: any }[]} */
    const options = [
      { id: TutorialIds.SEARCH_EVENTS, label: t('homeHub.cards.search.events.title', 'Événement') },
      { id: TutorialIds.SEARCH_CLUBS, label: t('homeHub.cards.search.clubs.title', 'Club') },
      { id: TutorialIds.SEARCH_RESERVATIONS, label: t('homeHub.cards.search.reservations.title', 'Réservations') },
      { id: TutorialIds.SEARCH_RECRUITMENT, label: t('homeHub.cards.search.ads.title', 'Recrutement') },
      { id: TutorialIds.PROFILE_MAIN, label: t('homeHub.cards.profile.view.title', 'Voir mon profil') },
      { id: TutorialIds.PROFILE_EDIT, label: t('homeHub.cards.profile.edit.title', 'Modifier mon profil') },
      { id: TutorialIds.HISTORY_WIZARD, label: t('homeHub.cards.profile.history.title', 'Historique sportif') },
      { id: TutorialIds.PLANNING, label: t('homeHub.cards.quick.planning.title', 'Mon planning') },
      { id: TutorialIds.MY_TEAMS, label: t('homeHub.cards.quick.teams.title', 'Mes équipes') },
      { id: TutorialIds.MESSAGING, label: t('homeHub.cards.quick.chat.title', 'Messagerie') },
      { id: TutorialIds.ACCOUNT_SWITCHER_MODAL, label: t('homeHub.cards.account.switch.title', 'Changer de compte') },
      { id: TutorialIds.LOGOUT_CONFIRMATION, label: t('homeHub.cards.account.logout.title', 'Déconnexion') },
    ];

    if (isCoach || isPresident) {
      options.push(
        { id: TutorialIds.EVENT_WIZARD_TYPE, label: t('homeHub.cards.manage.addEvent.title', 'Ajouter un événement') },
        { id: TutorialIds.REQUESTS_DASHBOARD, label: t('homeHub.cards.manage.requests.title', 'Demandes') },
      );
    }

    return options;
  }, [isCoach, isPresident, t]);

  const scrollDownLabel = t('homeHubTutorial.actions.scrollDown', 'Descendre');
  const makeTutorial = useCallback((
    /** @type {string} */ id,
    /** @type {number} */ order,
    /** @type {any} */ fallbackTitle,
    /** @type {any} */ fallbackDesc,
    /** @type {any} */ options = {},
  ) => ({
    description: t(`homeHubTutorial.steps.${id}.description`, fallbackDesc),
    id: `homehub-${id}`,
    nextAction: options.nextAction,
    nextLabel: options.nextLabel,
    nextTargetStepId: options.nextTargetStepId,
    onNext: options.onNext,
    order,
    title: t(`homeHubTutorial.steps.${id}.title`, fallbackTitle),
  }), [t]);

  // Surbrillance de la carte « Ajouter un événement » pendant la semi-étape du tour.
  const { currentStep: tourCurrentStep } = useTour();
  const highlightAddEventCard = tourCurrentStep?.id === 'coach_find_event_card';

  // Badges d'offre informatifs sur les cartes du hub (handoff 12).
  // CORR-TEXTES (point 27) : un club que la Ville paie n'a rien à acheter ; un
  // badge « Offre Équipe / Offre Club » y fait croire au coach qu'il doit payer.
  const teamCardPremiumScope = (clubCouvertParLaVille
    || subscriptionAccessLevel === 'TEAM' || subscriptionAccessLevel === 'CLUB')
    ? undefined
    : /** @type {'team'} */ ('team');
  const clubCardPremiumScope = (clubCouvertParLaVille || subscriptionAccessLevel === 'CLUB')
    ? undefined
    : /** @type {'club'} */ ('club');

  // D72 — LES COMPTEURS DE L'ACCUEIL (pack accueil, tache 4).
  // ⛔ UN SEUL appel, au focus de l'ecran — jamais un par carte : l'accueil en
  // porte jusqu'a 20.
  //
  // ✅ COUTURE FAITE LE 2026-08-12 (lot D78) : `GET /app/home-summary` existe
  // depuis le lot serveur D76. Ce qui suit etait deja ecrit pour des valeurs non
  // nulles — seule la SOURCE a change, pas une ligne d'affichage.
  //
  // 🛟 UN ECHEC NE BLOQUE RIEN : en cas de panne, `data` reste `undefined` et
  // `normalizeHomeCounters` rend l'etat vide — donc exactement l'accueil d'avant
  // le lot, sans bandeau ni pastille. Aucun ecran d'erreur, aucune roue infinie.
  //
  // ⛔ `reservations` restera a 0 tant qu'aucune table ne portera cette file :
  // c'est une decision assumee de D76, pas un oubli de branchement.
  const { data: homeSummary } = useHomeSummary({
    enabled: isFocused && Boolean(userData?.documentId),
  });
  // ⚠️ Le memo n'est pas decoratif : `normalizeHomeCounters` fabrique un NOUVEL
  // objet a chaque appel, et `homeCounters` est la dependance de cinq memos plus
  // bas. Sans lui, tout l'ecran se recalculerait a chaque rendu — le motif exact
  // qui avait produit 402 rendus sur le board de compo (lot D42).
  const homeCounters = useMemo(() => normalizeHomeCounters(homeSummary), [homeSummary]);
  const homeAlerts = useMemo(() => selectHomeAlerts(homeCounters), [homeCounters]);
  // 🔴 A17 — le point « cotisation a payer » de la case « Mes cotisations », partie
  // dans « Mon compte », passe sur l'avatar qui y mene. Memes roles que la case :
  // ni le parent (P0) ni le super admin (D72) ne l'avaient.
  const cotisationAPayer = homeAlerts['profile-license'] === true && !isParent && !isSuperAdmin;

  // T02 — MA REPONSE AU PROCHAIN EVENEMENT, pour le bandeau du JOUEUR.
  //
  // ⛔ Le dirigeant et l'entraineur n'en ont pas besoin : leurs boutons OUVRENT
  // l'evenement (travail de S06), ils ne repondent pas. Sans identifiant,
  // `useGetEvent` ne lance aucun appel — ils ne paient donc pas la relecture.
  const isPlayerBanner = !isCoach && !isPresident && !isSuperAdmin;
  const {
    answer: myAnswer,
    canAnswer: canAnswerMyEvent,
    isAnswering,
    sentAnswer,
    submit: submitMyAnswer,
  } = useHomeEventAnswer(
    isPlayerBanner ? homeCounters.prochainEvenement?.id : '',
    // FINITIONS4 (D4) — l option est connue DES le premier affichage.
    { rsvpEnabled: homeCounters.prochainEvenement?.rsvpEnabled },
  );

  // COLL-CONSOLE-BIS (03/10/2026), planche 12 — les deux lignes « Collectivités » de « À traiter »,
  // comptées par les lectures de la console (aucune lecture neuve), pour le SuperAdmin seul.
  const { demandesGestionnaire, mairiesAActiver } = useAdminCollectivitesATraiter(isSuperAdmin);
  const collectivitesATraiter = useMemo(
    () => ({ demandesGestionnaire, mairiesAActiver }),
    [demandesGestionnaire, mairiesAActiver],
  );

  const headBanner = useMemo(() => {
    const descriptors = selectBannerLines(homeCounters, roleKey, collectivitesATraiter);
    // MARQUE-MAIRIE (14/10, COL-003, « D3- B » puis « 3- ok go » d Adel) — le prochain
    // evenement attend une decision : le bandeau le dit (« En attente de la mairie »). Le serveur
    // pose `pendingDecider` ; un serveur d avant ne le pose pas, et rien ne change.
    const attente = pendingDeciderLabel(homeCounters.prochainEvenement?.pendingDecider, t);
    /**
     * @param {string} screen
     * @returns {() => void}
     */
    const openAdmin = (screen) => () => navigation.navigate(RouteNames.AdminStack, { screen });

    if (isSuperAdmin) {
      const meta = {
        aLaUne: {
          icon: 'bell',
          label: t('homeHub.banner.superAdmin.featured', 'À la une — à valider'),
          onPress: openAdmin(RouteNames.FeaturedRequestsList),
        },
        clubsAOnboarder: {
          icon: 'users',
          label: t('homeHub.banner.superAdmin.onboarding', 'Clubs à onboarder'),
          onPress: openAdmin(RouteNames.AdminClubOnboardingList),
        },
        // COLL-CONSOLE-BIS (03/10) — planche 12.
        demandesGestionnaire: {
          icon: 'users',
          label: t(
            'collectiviteConsoleBis.accueil.demandesGestionnaire',
            'Demandes de gestionnaire',
          ),
          onPress: openAdmin(RouteNames.AdminManagerRequests),
        },
        mairiesAActiver: {
          icon: 'flag',
          label: t('collectiviteConsoleBis.accueil.mairiesAActiver', 'Mairies à activer'),
          onPress: openAdmin(RouteNames.AdminCollectiviteList),
        },
        revendications: {
          icon: 'shield',
          label: t('homeHub.banner.superAdmin.claims', 'Revendications de club'),
          onPress: openAdmin(RouteNames.AdminClaimList),
        },
        signalements: {
          icon: 'flag',
          label: t('homeHub.banner.superAdmin.reports', 'Signalements'),
          onPress: openAdmin(RouteNames.AdminReports),
        },
      };
      return {
        label: t('homeHub.banner.superAdmin.label', 'À traiter'),
        lines: descriptors.map((line) => ({
          ...meta[line.key], hasAlert: line.hasAlert, key: line.key, value: String(line.value),
        })),
        tone: Colors.error500,
        variant: 'list',
      };
    }

    if (isPresident) {
      // 📅 FINITIONS (recette émulateur du 28/09) — l'étiquette était « Aujourd'hui »
      // en dur, posée au-dessus du PROCHAIN événement quel que soit son jour : un
      // match du mercredi s'y lisait « aujourd'hui » un lundi. Elle suit désormais le
      // jour de cet événement (règle partagée `selectBannerDay`). Sans événement, le
      // bandeau ne liste que ce qui attend le dirigeant : il reste « Aujourd'hui ».
      const maintenant = new Date();
      const jourDuProchain = selectBannerDay(homeCounters.prochainEvenement?.startsAt, maintenant);
      const etiquettes = {
        later: t('homeHub.banner.when.later', 'À venir'),
        thisWeek: t('homeHub.banner.when.thisWeek', 'Cette semaine'),
        today: t('homeHub.banner.today.label', "Aujourd'hui"),
        tomorrow: t('homeHub.banner.when.tomorrow', 'Demain'),
      };
      const meta = {
        demandes: {
          icon: 'bell',
          label: t('homeHub.banner.today.requests', 'Demandes en attente'),
          onPress: () => handleOpenRequestsHub('all'),
          value: String(homeCounters.demandes),
        },
        impayes: {
          icon: 'euroCircle',
          label: t('homeHub.banner.today.unpaid', 'Cotisations impayées'),
          onPress: handleOpenClubLicenses,
          // Seule ligne dont le glyphe quitte le `tone` du bandeau : le pack
          // reserve l'orange a l'alerte financiere.
          tone: Colors.warning500,
          value: `${homeCounters.impayes.amount} €`,
        },
        prochainEvenement: {
          icon: 'calendar',
          label: homeCounters.prochainEvenement?.label,
          notice: attente || undefined,
          onPress: () => handleOpenEvent(homeCounters.prochainEvenement?.id),
          value: formatBannerShortTime(homeCounters.prochainEvenement?.startsAt, maintenant),
        },
      };
      return {
        label: etiquettes[jourDuProchain || 'today'],
        lines: descriptors.map((line) => ({
          ...meta[line.key], hasAlert: line.hasAlert, key: line.key,
        })),
        variant: 'list',
      };
    }

    if (isCoach) {
      const seance = homeCounters.prochaineSeance;
      if (!seance) return null;
      return {
        // ⚠️ NON CABLE : le pack veut que ce bouton ouvre la compo. La compo vit
        // dans un onglet d'EventDetails ; on ouvre donc l'evenement. Rien de plus
        // n'est fait ici — brancher l'onglet est le travail du lot qui livrera
        // l'endpoint, seul moment ou ce bandeau pourra etre vu.
        actions: [{
          key: 'compo',
          label: t('homeHub.banner.coach.action', 'Ouvrir la compo'),
          onPress: () => handleOpenEvent(seance.id),
        }],
        label: t('homeHub.banner.coach.label', 'Ma prochaine séance'),
        notice: pendingDeciderLabel(seance.pendingDecider, t) || undefined,
        subtitle: seance.opponent,
        tiles: [
          {
            key: 'convoques',
            label: t('homeHub.banner.coach.called', 'convoquées'),
            value: String(seance.convoques),
          },
          {
            key: 'sansReponse',
            label: t('homeHub.banner.coach.missing', 'réponses manquantes'),
            tone: seance.sansReponse > 0 ? Colors.warning500 : undefined,
            value: String(seance.sansReponse),
          },
        ],
        title: formatBannerTitle(seance.startsAt),
        titleSuffix: seance.team,
        variant: 'event',
      };
    }

    const evenement = homeCounters.prochainEvenement;
    if (!evenement) return null;
    // 🚫 POINTAGE (29/09) — « Les participants repondent » decochee par
    // l organisateur : pas de Present / Absent (le serveur les refuserait). Le
    // bandeau garde l evenement, et son bouton y mene — comme les autres roles.
    if (!canAnswerMyEvent) {
      return {
        actions: [{
          key: 'open',
          label: t('common.actions.seeMore', 'Voir le détail'),
          onPress: () => handleOpenEvent(evenement.id),
        }],
        label: t('homeHub.banner.player.label', 'Ma semaine'),
        notice: attente || undefined,
        subtitle: evenement.label,
        title: formatBannerTitle(evenement.startsAt),
        variant: 'event',
      };
    }
    // T02 — ICI, « Présent » et « Absent » REPONDENT. Ils n'emmenent plus nulle
    // part (constat d'Adel du 2026-08-17). Ce sont les deux seules reponses que le
    // serveur accepte : `POST /events/:id/rsvp` refuse tout le reste
    // (`event-rsvp.ts`, `ensureValidAnswer`).
    //
    // 🚨 L'ETAT AFFICHE VIENT DU SERVEUR, JAMAIS DU GESTE. `myAnswer` est relu sur
    // l'evenement apres la reponse ; un echec le laisse donc exactement ou il
    // etait, et le refus se dit dans une alerte (`useHomeEventAnswer`).
    //
    // ⏳ « En attente » COMPTE COMME UNE REPONSE DONNEE : sur un evenement a
    // validation manuelle — le DEFAUT cote serveur — repondre « Présent » cree une
    // demande `pending`. Laisser le bouton comme si de rien n'etait ferait
    // exactement le mal qu'on repare : croire qu'on a repondu sans l'avoir fait.
    const answeredPresent = myAnswer === 'present' || myAnswer === 'pending';
    const answeredAbsent = myAnswer === 'absent';
    const answerLabels = {
      absent: t('eventList.info.alreadyMissing'),
      pending: t('eventList.info.pendingRequest'),
      present: t('eventList.info.alreadyJoined'),
    };
    return {
      actions: [
        {
          disabled: isAnswering || answeredPresent,
          key: 'present',
          label: t('homeHub.banner.player.present', 'Présent'),
          onPress: () => submitMyAnswer('present'),
          variant: answeredPresent ? 'secondaryLight' : undefined,
        },
        {
          disabled: isAnswering || answeredAbsent,
          key: 'absent',
          label: t('homeHub.banner.player.absent', 'Absent'),
          onPress: () => submitMyAnswer('absent'),
          variant: answeredAbsent ? 'secondaryLight' : 'secondary',
        },
      ],
      // A05 (audit V1, decision d'Adel du 30/09) — « ✓ Réponse envoyée : X »
      // apres Present COMME apres Absent, pendant ~3 s (`useHomeEventAnswer`).
      // Le mot de la reponse est celui du bouton qu'on vient de toucher.
      confirmation: sentAnswer ? {
        answer: sentAnswer,
        answerLabel: sentAnswer === 'absent'
          ? t('homeHub.banner.player.absent', 'Absent')
          : t('homeHub.banner.player.present', 'Présent'),
        label: t('homeHub.banner.player.answerSent'),
      } : undefined,
      label: t('homeHub.banner.player.label', 'Ma semaine'),
      notice: attente || undefined,
      subtitle: evenement.label,
      title: formatBannerTitle(evenement.startsAt),
      // ⛔ AUCUN LIBELLE NEUF : ce sont les trois phrases que la fiche de
      // l'evenement affiche deja pour les memes trois etats — un joueur lit le
      // meme mot aux deux endroits.
      titleSuffix: myAnswer ? answerLabels[myAnswer] : undefined,
      variant: 'event',
    };
  }, [
    Colors.error500,
    Colors.warning500,
    handleOpenClubLicenses,
    handleOpenEvent,
    handleOpenRequestsHub,
    homeCounters,
    canAnswerMyEvent,
    collectivitesATraiter,
    isAnswering,
    isCoach,
    isPresident,
    isSuperAdmin,
    myAnswer,
    navigation,
    roleKey,
    sentAnswer,
    submitMyAnswer,
    t,
  ]);

  /** @type {HomeCard[]} */
  const manageSectionCards = useMemo(() => {
    if (isPresident) {
      return [
        {
          accentColor: Colors.primary500,
          emphasis: 'primary',
          icon: 'users',
          key: 'manage-club',
          onPress: handleOpenManageClub,
          subtitle: t('homeHub.cards.manage.manageClub.subtitle', 'Ton espace club pour tout piloter.'),
          subtitleLines: 2,
          title: t('homeHub.cards.manage.manageClub.title', 'Gérer mon club'),
          tutorial: makeTutorial('manageClub', 2, 'Gérer mon club', 'Accèdes à ton espace club pour piloter ton organisation.'),
        },
        {
          accentColor: Colors.primary500,
          hasAlert: homeAlerts['manage-requests'],
          icon: 'bell',
          key: 'manage-requests',
          onPress: () => handleOpenRequestsHub('all'),
          subtitle: t('homeHub.cards.manage.requests.subtitle'),
          title: t('homeHub.cards.manage.requests.title'),
          tutorial: makeTutorial(
            'manageRequests',
            3,
            'Demandes',
            'Regroupe et traite toutes les demandes depuis un seul écran.',
          ),
        },
        {
          accentColor: Colors.primary500,
          disabled: isPublishingGovernedBlocked,
          highlighted: highlightAddEventCard,
          icon: 'calendar',
          key: 'manage-add-event',
          locked: Boolean(addEventLock),
          onPress: handleAddEvent,
          premiumScope: addEventLock ? addEventLock.scope : teamCardPremiumScope,
          subtitle: addEventLock ? addEventLock.hint : t('homeHub.cards.manage.addEvent.subtitle'),
          subtitleLines: 2,
          title: t('homeHub.cards.manage.addEvent.title'),
          tutorial: makeTutorial(
            'manageAddEvent',
            4,
            'Ajouter un événement',
            'Crée un entraînement, match ou détection pour tes équipes.',
          ),
        },
        {
          accentColor: Colors.primary500,
          disabled: isPublishingGovernedBlocked,
          icon: 'running',
          key: 'manage-add-ad',
          locked: Boolean(addAdLock),
          onPress: handleAddRecruitmentAd,
          premiumScope: addAdLock ? addAdLock.scope : teamCardPremiumScope,
          subtitle: addAdLock
            ? addAdLock.hint
            : t('homeHub.cards.manage.addAd.subtitle', 'Publie une offre de recrutement.'),
          subtitleLines: 2,
          title: t('homeHub.cards.manage.addAd.title', 'Recruter'),
          tutorial: makeTutorial(
            'manageAddAd',
            5,
            'Recruter',
            'Publie une offre de recrutement pour cibler des profils précis.',
            {
              nextAction: 'scrollDown',
              nextLabel: scrollDownLabel,
              nextTargetStepId: 'homehub-searchEvents',
              onNext: scrollToSearchSection,
            },
          ),
        },
        {
          accentColor: Colors.primary500,
          hasAlert: homeAlerts['manage-my-ads'],
          icon: 'running',
          key: 'manage-my-ads',
          onPress: handleOpenMyRecruitmentAds,
          subtitle: t('homeHub.cards.manage.myAds.subtitle', 'Tes offres, tes matchs et les réponses reçues.'),
          subtitleLines: 2,
          title: t('homeHub.cards.manage.myAds.title', 'Mes activités'),
          tutorial: makeTutorial(
            'manageMyAds',
            6,
            t('homeHub.tutorial.myActivities.title', 'Mes activités'),
            t(
              'homeHub.tutorial.myActivities.description',
              'Retrouve tes offres, tes matchs proposés et les réponses reçues.',
            ),
            {
              nextAction: 'scrollDown',
              nextLabel: scrollDownLabel,
              nextTargetStepId: 'homehub-searchEvents',
              onNext: scrollToSearchSection,
            },
          ),
        },
        {
          accentColor: Colors.primary500,
          hasAlert: homeAlerts['manage-licenses'],
          icon: 'euroCircle',
          key: 'manage-licenses',
          onPress: handleOpenClubLicenses,
          premiumScope: clubCardPremiumScope,
          subtitle: t('homeHub.cards.manage.licenses.subtitle', 'Suis les statuts de tes membres.'),
          subtitleLines: 2,
          title: t('homeHub.cards.manage.licenses.title', 'Cotisations du club'),
          tutorial: makeTutorial(
            'manageLicenses',
            7,
            t('homeHub.tutorial.clubFees.title', 'Cotisations du club'),
            t(
              'homeHub.tutorial.clubFees.description',
              'Pilote les cotisations et relances depuis un tableau dédié.',
            ),
            {
              nextAction: 'scrollDown',
              nextLabel: scrollDownLabel,
              nextTargetStepId: 'homehub-searchEvents',
              onNext: scrollToSearchSection,
            },
          ),
        },
      ];
    }

    if (isCoach) {
      return [
        {
          accentColor: Colors.primary500,
          emphasis: 'primary',
          icon: 'users',
          key: 'manage-club',
          onPress: handleOpenManageClub,
          // D72 — cote entraineur la section entiere s'appelle « Mon club » : il
          // ne gere pas le club, il y travaille (pack accueil, tache 3).
          subtitle: t(
            'homeHub.cards.manage.manageClub.coachSubtitle',
            'L\'espace de ton club et de tes équipes.',
          ),
          subtitleLines: 2,
          title: t('homeHub.cards.manage.manageClub.coachTitle', 'Mon club'),
          tutorial: makeTutorial('manageClub', 2, 'Mon club', 'Accèdes à ton espace club pour piloter ton organisation.'),
        },
        {
          accentColor: Colors.primary500,
          hasAlert: homeAlerts['manage-requests'],
          icon: 'bell',
          key: 'manage-requests',
          onPress: () => handleOpenRequestsHub('all'),
          // Sans l'onglet « Club », reserve au dirigeant.
          subtitle: t('homeHub.cards.manage.requests.coachSubtitle', 'Équipes, événements, à la une.'),
          title: t('homeHub.cards.manage.requests.title'),
          tutorial: makeTutorial(
            'manageRequests',
            3,
            'Demandes',
            'Regroupe et traite toutes les demandes depuis un seul écran.',
          ),
        },
        {
          accentColor: Colors.primary500,
          disabled: isPublishingGovernedBlocked,
          highlighted: highlightAddEventCard,
          icon: 'calendar',
          key: 'manage-add-event',
          locked: Boolean(addEventLock),
          onPress: handleAddEvent,
          premiumScope: addEventLock ? addEventLock.scope : teamCardPremiumScope,
          subtitle: addEventLock ? addEventLock.hint : t('homeHub.cards.manage.addEvent.subtitle'),
          subtitleLines: 2,
          title: t('homeHub.cards.manage.addEvent.title'),
          tutorial: makeTutorial('manageAddEvent', 4, 'Ajouter un événement', 'Crée un entraînement, match ou détection pour tes équipes.'),
        },
        {
          accentColor: Colors.primary500,
          disabled: isPublishingGovernedBlocked,
          icon: 'running',
          key: 'manage-add-ad',
          locked: Boolean(addAdLock),
          onPress: handleAddRecruitmentAd,
          premiumScope: addAdLock ? addAdLock.scope : teamCardPremiumScope,
          subtitle: addAdLock
            ? addAdLock.hint
            : t('homeHub.cards.manage.addAd.subtitle', 'Publie une offre de recrutement.'),
          subtitleLines: 2,
          title: t('homeHub.cards.manage.addAd.title', 'Recruter'),
          tutorial: makeTutorial(
            'manageAddAd',
            5,
            'Recruter',
            'Publie une offre de recrutement pour cibler des profils précis.',
            {
              nextAction: 'scrollDown',
              nextLabel: scrollDownLabel,
              nextTargetStepId: 'homehub-searchEvents',
              onNext: scrollToSearchSection,
            },
          ),
        },
        {
          accentColor: Colors.primary500,
          hasAlert: homeAlerts['manage-my-ads'],
          icon: 'running',
          key: 'manage-my-ads',
          onPress: handleOpenMyRecruitmentAds,
          subtitle: t('homeHub.cards.manage.myAds.subtitle', 'Tes offres, tes matchs et les réponses reçues.'),
          subtitleLines: 2,
          title: t('homeHub.cards.manage.myAds.title', 'Mes activités'),
          tutorial: makeTutorial(
            'manageMyAds',
            6,
            t('homeHub.tutorial.myActivities.title', 'Mes activités'),
            t(
              'homeHub.tutorial.myActivities.description',
              'Retrouve tes offres, tes matchs proposés et les réponses reçues.',
            ),
            {
              nextAction: 'scrollDown',
              nextLabel: scrollDownLabel,
              nextTargetStepId: 'homehub-searchEvents',
              onNext: scrollToSearchSection,
            },
          ),
        },
        {
          accentColor: Colors.primary500,
          hasAlert: homeAlerts['manage-licenses'],
          icon: 'euroCircle',
          key: 'manage-licenses',
          onPress: handleOpenClubLicenses,
          // Décision d'Adel « 5- offre équipe » (27/10) : la cotisation de l'équipe est dans
          // l'offre Équipe, comme le récapitulatif des offres et la fiche d'équipe.
          premiumScope: teamCardPremiumScope,
          subtitle: t('homeHub.cards.manage.licenses.teamsSubtitle', 'Suis les paiements de tes équipes.'),
          subtitleLines: 2,
          title: t('homeHub.cards.manage.licenses.teamsTitle', 'Cotisations de mes équipes'),
          tutorial: makeTutorial(
            'manageLicenses',
            7,
            t('homeHub.tutorial.teamFees.title', 'Cotisations de mes équipes'),
            t(
              'homeHub.tutorial.teamFees.description',
              'Consulte les statuts de cotisation de tes équipes.',
            ),
            {
              nextAction: 'scrollDown',
              nextLabel: scrollDownLabel,
              nextTargetStepId: 'homehub-searchEvents',
              onNext: scrollToSearchSection,
            },
          ),
        },
      ];
    }

    // D72 — LA SECTION « ADMINISTRATION » DU SUPER ADMIN (pack accueil, tache 3).
    // Elle n'existait pas : le super admin tombait sur l'accueil d'un joueur, et
    // ses ecrans d'administration n'etaient atteignables que par la page profil
    // (Profile.js:624-637). Quatre cases, dans l'ordre du pack.
    if (isSuperAdmin) {
      const openAdminScreen = (/** @type {string} */ screen) => () => navigation.navigate(
        RouteNames.AdminStack,
        { screen },
      );
      return [
        {
          accentColor: Colors.primary500,
          // ⚠️ SEULE CARTE DU LOT A PORTER UN CHIFFRE, et la seule dont la
          // destination soit un choix par defaut : l'ecran « A traiter » qui
          // agrege les files N'EXISTE PAS. Les lignes du bandeau, elles, visent
          // chacune leur ecran reel.
          // SUPADM (recette du 23/10) — la carte disait 4 quand le bandeau disait 5,
          // et ouvrait toujours « Signalements », vide ce jour-la. Elle additionne
          // les memes lignes que le bandeau et ouvre la premiere non vide.
          badgeCount: selectModerationTotal(homeCounters, collectivitesATraiter),
          emphasis: 'primary',
          icon: 'bell',
          key: 'admin-triage',
          layout: 'full',
          onPress: openAdminScreen(
            ECRANS_A_TRAITER[selectTriageTarget(homeCounters, collectivitesATraiter)],
          ),
          subtitle: t(
            'homeHub.cards.admin.triage.subtitle',
            'Signalements, revendications, à la une, clubs à onboarder.',
          ),
          subtitleLines: 1,
          title: t('homeHub.cards.admin.triage.title', 'À traiter'),
        },
        {
          accentColor: Colors.primary500,
          icon: 'users',
          key: 'admin-users-clubs',
          onPress: openAdminScreen(RouteNames.AdminUserList),
          subtitle: t('homeHub.cards.admin.users.subtitle', 'Recherche, modération, fiches.'),
          subtitleLines: 2,
          title: t('homeHub.cards.admin.users.title', 'Utilisateurs et clubs'),
        },
        {
          accentColor: Colors.primary500,
          icon: 'chart',
          key: 'admin-dashboard',
          onPress: openAdminScreen(RouteNames.AdminDashboard),
          subtitle: t('homeHub.cards.admin.dashboard.subtitle', 'Les 23 tuiles de suivi.'),
          subtitleLines: 2,
          title: t('homeHub.cards.admin.dashboard.title', 'Dashboard complet'),
        },
        {
          accentColor: Colors.gold500,
          icon: 'flag',
          key: 'admin-league',
          onPress: openAdminScreen(RouteNames.SuperAdminHome),
          subtitle: t('homeHub.cards.admin.league.subtitle', 'Saisons, divisions, classements.'),
          subtitleLines: 2,
          title: t('homeHub.cards.admin.league.title', 'League'),
        },
      ];
    }

    return [];
  }, [
    addAdLock,
    addEventLock,
    clubCardPremiumScope,
    collectivitesATraiter,
    Colors.gold500,
    homeAlerts,
    homeCounters,
    isSuperAdmin,
    navigation,
    highlightAddEventCard,
    Colors.primary500,
    handleAddEvent,
    handleAddRecruitmentAd,
    handleOpenClubLicenses,
    handleOpenMyRecruitmentAds,
    handleOpenManageClub,
    handleOpenRequestsHub,
    isPublishingGovernedBlocked,
    isCoach,
    isPresident,
    makeTutorial,
    scrollDownLabel,
    scrollToSearchSection,
    t,
    teamCardPremiumScope,
  ]);

  /*
    ENTRAINEMENT PERSO (2026-09-06) — la section n a AUCUN garde de role, et c est
    une decision, pas un oubli : c est un entrainement PERSONNEL, et le Joueur est
    precisement la cible. `hasManageSection` et `canShowSubscriptionExperience`
    ci-dessus sont reserves au coach et au president ; celle-ci est pour tout le
    monde. Elle est aussi entierement GRATUITE : l ecran d abonnement etant
    verrouille sur coach/president/superAdmin, un Joueur qui verrait un mur payant
    ici n aurait AUCUN chemin vers l achat.
  */
  const { enrollment: trainingEnrollment, nextSession: trainingNextSession } = useMyTraining();

  /** @type {HomeCard[]} */
  const trainingCards = useMemo(() => {
    const nextDay = trainingNextSession?.day;
    const suitUnProgramme = Boolean(trainingEnrollment) && Boolean(nextDay);

    return [
      {
        accentColor: Colors.primary500,
        // 🪤 La mise en avant etait branchee sur « est-ce que je suis un programme ».
        // C etait a l envers : le joueur qu il faut convaincre est justement celui
        // qui n a rien commence, et il voyait la carte la plus eteinte de l ecran.
        highlighted: true,
        icon: 'clock',
        key: 'training-mine',
        layout: 'full',
        // RW-PARENT (29/10) — l'entraînement n'est pas sur le site (webRouteExemptions.js) : les
        // trois cartes disent « Bientôt sur le site » au lieu de ne rien faire.
        onPress: () => navigateOrExplainOnWeb(
          navigation,
          trainingEnrollment ? RouteNames.TrainingPlan : RouteNames.TrainingCatalog,
        ),
        subtitle: suitUnProgramme
          ? sousTitreSeance(nextDay, t)
          : t('training.home.myCard.emptySubtitle'),
        title: suitUnProgramme
          ? t('training.home.myCard.title', {
            countdown: compteARebours(trainingNextSession.plannedDate, t),
            day: nextDay.title,
            program: trainingEnrollment.program?.title || '',
            ...SANS_ECHAPPEMENT,
          })
          : t('training.home.myCard.emptyTitle'),
      },
      {
        accentColor: Colors.primary500,
        // 🪤 La loupe et le chronometre que le pack demande n existent PAS dans le
        // jeu d illustrations de l app (12 familles, aucune des deux). On prend ce
        // qui existe et qui dit la meme chose : le coureur pour « choisir un
        // entrainement », l horloge pour le compte a rebours de la prochaine
        // seance. Les deux dessins manquants sont a demander au designer.
        icon: 'running',
        key: 'training-find',
        onPress: () => navigateOrExplainOnWeb(navigation, RouteNames.TrainingCatalog),
        subtitle: t('training.home.findCard.subtitle'),
        title: t('training.home.findCard.title'),
      },
      {
        accentColor: Colors.primary500,
        icon: 'chart',
        key: 'training-logbook',
        onPress: () => navigateOrExplainOnWeb(navigation, RouteNames.TrainingLogbook),
        subtitle: t('training.home.logbookCard.subtitle'),
        title: t('training.home.logbookCard.title'),
      },
    ];
  }, [Colors.primary500, navigation, t, trainingEnrollment, trainingNextSession]);

  const searchCards = useMemo(() => {
    // A02 — League masquee : le tour ne descend plus vers une case absente.
    // Rallumee, la chaine d'avant revient telle quelle.
    const versLaLeague = LEAGUE_SUR_ACCUEIL ? {
      nextAction: 'scrollDown',
      nextLabel: scrollDownLabel,
      nextTargetStepId: 'homehub-league',
      onNext: scrollToLeagueSection,
    } : undefined;

    const cards = [
      {
        accentColor: Colors.primary500,
        icon: 'calendar',
        key: 'search-events',
        onPress: () => navigation.navigate(RouteNames.SearchEvents),
        subtitle: t('homeHub.cards.search.events.subtitle'),
        title: t('homeHub.cards.search.events.title'),
        tutorial: makeTutorial('searchEvents', 10, 'Rechercher un événement', 'Trouve des événements sportifs en utilisant les filtres de recherche.'),
      },
      {
        accentColor: Colors.primary500,
        icon: 'shield',
        key: 'search-clubs',
        onPress: () => navigation.navigate(RouteNames.SearchClubs),
        subtitle: t('homeHub.cards.search.clubs.subtitle'),
        title: t('homeHub.cards.search.clubs.title'),
        tutorial: makeTutorial('searchClubs', 11, 'Rechercher un club', 'Explore les clubs et ouvre leur fiche détaillée.'),
      },
      {
        accentColor: Colors.primary500,
        hasAlert: homeAlerts['search-reservations'],
        icon: 'stadium',
        key: 'search-reservations',
        onPress: () => navigation.navigate(RouteNames.SearchReservations),
        subtitle: t('homeHub.cards.search.reservations.subtitle'),
        title: t('homeHub.cards.search.reservations.title'),
        tutorial: makeTutorial('searchReservations', 12, 'Rechercher une réservation', 'Accèdes aux réservations et filtre selon ton activité.'),
      },
    ];

    if (hasManageSection) {
      cards.push({
        accentColor: Colors.primary500,
        icon: 'users',
        key: 'search-profiles',
        onPress: () => navigation.navigate(RouteNames.SearchRecruitment, {
          initialRecruitmentTab: 'profils',
        }),
        subtitle: t(
          'homeHub.cards.search.profiles.subtitle',
          'Trouve des profils ouverts.',
        ),
        title: t('homeHub.cards.search.profiles.title', 'Profils'),
        tutorial: makeTutorial(
          'searchProfiles',
          13,
          t('homeHub.tutorial.searchProfiles.title', 'Rechercher des profils'),
          t(
            'homeHub.tutorial.searchProfiles.description',
            'Accèdes directement aux profils ouverts au recrutement pour tes équipes.',
          ),
          versLaLeague,
        ),
      });
    }

    if (!hasManageSection) {
      cards.push({
        accentColor: Colors.primary500,
        icon: 'running',
        key: 'search-ads',
        onPress: () => navigation.navigate(RouteNames.SearchRecruitment, {
          initialRecruitmentTab: getDefaultRecruitmentTab(userData),
        }),
        subtitle: t('homeHub.cards.search.ads.subtitle'),
        title: t('homeHub.cards.search.ads.title'),
        tutorial: makeTutorial(
          'searchAds',
          14,
          'Rechercher des offres',
          'Consulte les offres de recrutement des clubs.',
          versLaLeague,
        ),
      });

      // D57 — LA PORTE QUI MANQUAIT. Le staff ouvre « Mes activites » depuis
      // « Gerer mon club » (D35, §4 du pack), mais `manageSectionCards` rend `[]`
      // des que le compte n'est ni entraineur ni president : un joueur n'avait
      // AUCUN moyen d'atteindre ses propres candidatures, alors que l'ecran
      // existe et porte pour lui l'onglet « Mes reponses ».
      // Volontairement SANS `tutorial` : les deux cases voisines se tiennent par
      // `nextTargetStepId`, et s'inserer au milieu de cette chaine la casserait.
      // MES-CANDIDATURES (audit V1, A12) — la case dit ce que la page dit : MEME regle
      // que MyActivitiesScreen. Le joueur lit « Mes candidatures » ; le super admin, qui
      // arrive ici mais voit la page du staff, lit « Mes activites » comme elle.
      const isMyActivitiesStaff = getRecruitmentRoleMode(userData) === 'staff';
      // A13 — l'attente s'ECRIT, en gris (« 1 en attente ») ; le rouge ne s'allume que
      // pour une reponse non vue (`search-my-activities`, homeCounters.js).
      const myApplicationsStatus = selectMyApplicationsStatus(homeCounters)
        .map(({ count, key }) => (key === 'unseen'
          ? t('homeHub.cards.search.myActivities.unseen', {
            count,
            defaultValue_one: '{{count}} nouvelle réponse',
            defaultValue_other: '{{count}} nouvelles réponses',
          })
          : t('homeHub.cards.search.myActivities.pending', {
            count,
            defaultValue_one: '{{count}} en attente',
            defaultValue_other: '{{count}} en attente',
          })));
      const myApplicationsSubtitle = myApplicationsStatus.length > 0
        ? myApplicationsStatus.join(' · ')
        : t('homeHub.cards.search.myActivities.subtitle', 'Tes candidatures et leurs réponses.');
      cards.push({
        accentColor: Colors.primary500,
        hasAlert: isMyActivitiesStaff
          ? homeAlerts['manage-my-ads']
          : homeAlerts['search-my-activities'],
        icon: 'running',
        key: 'search-my-activities',
        onPress: () => navigateOrExplainOnWeb(navigation, RouteNames.MyActivities),
        subtitle: isMyActivitiesStaff
          ? t(
            'homeHub.cards.manage.myAds.subtitle',
            'Tes offres, tes matchs et les réponses reçues.',
          )
          : myApplicationsSubtitle,
        subtitleLines: 2,
        title: isMyActivitiesStaff
          ? t('homeHub.cards.manage.myAds.title', 'Mes activités')
          : t('homeHub.cards.search.myActivities.title', 'Mes candidatures'),
      });
    }

    // Matchs amicaux : case A PART, bien distincte du recrutement (decision
    // d'Adel du 31/07, Q13 de la spec). La liste est publique : la carte est donc
    // montree a tout le monde, connecte ou non.
    cards.push({
      accentColor: Colors.primary500,
      hasAlert: homeAlerts['search-amicaux'],
      icon: 'flag',
      key: 'search-amicaux',
      onPress: () => navigation.navigate(RouteNames.SearchHub, { activeType: 'amicaux' }),
      subtitle: t('homeHub.cards.search.amicaux.subtitle', 'Trouve un adversaire.'),
      title: t('homeHub.cards.search.amicaux.title', 'Matchs amicaux'),
      tutorial: makeTutorial(
        'searchAmicaux',
        15,
        t('homeHub.tutorial.friendlies.title', 'Matchs amicaux'),
        t(
          'homeHub.tutorial.friendlies.description',
          'Consulte les équipes qui cherchent un match amical, et publie le tien.',
        ),
      ),
    });

    // 🧹 LE DOUBLON RETIRE LE 2026-09-11, vu a l ecran par Adel. Le lot P0 avait
    // pose ici « Chercher un club pour mon enfant », EN TETE : un raccourci vers
    // la recherche de clubs, en laissant « Club » deux cases plus bas. Les deux
    // ouvraient le MEME ecran (`RouteNames.SearchClubs`), sans aucun filtre pour
    // l enfant : deux portes pour une seule piece.
    // ⇒ Le parent cherche un club par « Club », comme tout le monde, ou depuis
    // la carte de SON enfant dans « Mes enfants » : ce chemin-la emmene l enfant
    // jusqu a la fiche du club (`MyChildren.js`, `chercherUnClub`).
    // 🧪 `accueilParRole.test.js` compte les cases qui ouvrent la recherche de
    // clubs : il en exige UNE.
    // 👨‍👧 LA PORTE « MES ENFANTS »
    // PARENT P2 (10/09) — LA PORTE QUI MANQUAIT. 🖥️ Trouve sur emulateur : l accueil
    // du parent n avait AUCUN chemin vers « Mes enfants ». Il fallait passer par le menu
    // du profil — pour quelqu un dont c est la SEULE raison d etre dans l app.
    //
    // REC17-001 (decision d'Adel du 17/10, recette iPhone) — UNE SEULE ENTREE. La carte ne
    // nomme plus les enfants : ni prenom, ni statut, ni fleche par enfant (les lignes de PAR-L7
    // E01 sont retirees). Elle ouvre « Mes enfants », et c'est LA qu'on choisit l'enfant ; la
    // meme carte avec 0, 1 ou 3 enfants. 🧪 `accueilMesEnfantsUneEntree.test.js` monte l'accueil.
    // ⛔ Volontairement SANS `tutorial` : les cases se tiennent par
    // `nextTargetStepId`, s inserer au milieu de la chaine la casserait
    // (meme raison que « Mes reponses », posee par D57).
    // `cards` est typé par sa PREMIÈRE case (littéral) : une case posée en tête ou en fin
    // depuis une variable n'y entre pas sans ce trait (même erreur, déjà là, avant L7).
    // REC17-001-B (choix d'Adel « carte B » du 22/10, planche 14 du parcours parent) — la même
    // porte dit l'essentiel : le nombre d'enfants dans un rond et UNE pastille, la plus urgente
    // (`pastilleDeLaCarte`, règle de « Mes enfants ») ; sans enfant, « Ajoute ton enfant ».
    // Toujours aucun prénom. Tant que les lectures n'ont pas répondu, la phrase d'avant.
    const enfantsConnus = mesEnfants.connu === true;
    const pastilleDesEnfants = enfantsConnus ? pastilleDeLaCarte(mesEnfants, t) : null;
    let sousTitreDesEnfants = t(
      'homeHub.cards.search.myChildren.subtitle',
      'Declare-les, corrige leur fiche, cherche-leur un club.',
    );
    if (enfantsConnus && mesEnfants.total === 0) {
      sousTitreDesEnfants = t('homeHub.cards.search.myChildren.empty', 'Ajoute ton enfant');
    }
    const carteMesEnfants = /** @type {any} */ ({
      accentColor: Colors.primary500,
      accessibilityLabel: libelleDeLaCarte(mesEnfants, t),
      emphasis: 'primary',
      footer: pastilleDesEnfants ? (
        <PastilleDEtat
          testID="carte-mes-enfants-pastille"
          texte={pastilleDesEnfants.texte}
          ton={pastilleDesEnfants.ton}
        />
      ) : null,
      icon: 'users',
      key: 'search-my-children',
      layout: 'full',
      onPress: () => navigation.navigate(RouteNames.ProfileStack, {
        screen: RouteNames.MyChildren,
      }),
      subtitle: pastilleDesEnfants ? '' : sousTitreDesEnfants,
      subtitleLines: 2,
      title: t('homeHub.cards.search.myChildren.title', 'Mes enfants'),
      titleCount: enfantsConnus ? mesEnfants.total : undefined,
    });

    if (isParent) {
      // ⚠️ Pour poser une 2e case en tete : UN SEUL `unshift(a, b)`. Deux
      // `unshift` successifs sortent dans l ordre INVERSE, et le temoin, qui lit
      // la source comme du texte, reste VERT (vu a l ecran le 10/09).
      cards.unshift(carteMesEnfants);

      return cards.filter(estVisiblePourLeParent).filter(estAfficheeSurLAccueil);
    }

    // PAR-L7 — un Joueur, un Entraineur ou un Dirigeant qui a des enfants gagne la MEME
    // porte, EN FIN de « Rechercher » : le role decide de l'INSISTANCE (le parent l'a en
    // tete), jamais de la capacite (« avoir des enfants » est une capacite, GO Adel 07/09).
    if (mesEnfants.total > 0) cards.push(carteMesEnfants);

    return cards.filter(estAfficheeSurLAccueil);
  }, [
    Colors.primary500,
    hasManageSection,
    homeAlerts,
    homeCounters,
    isParent,
    makeTutorial,
    mesEnfants,
    navigation,
    scrollDownLabel,
    scrollToLeagueSection,
    t,
    userData,
  ]);

  /** @type {HomeCard[]} */
  const leagueCards = useMemo(() => {
    // P0 — la section entiere disparait pour le parent : `HomeSection` rend
    // `null` des que la liste est vide, titre compris (HomeHub.js:159).
    if (isParent) return [];

    // A02 (decision d'Adel du 30/09, option A) — masquee pour TOUS par son
    // interrupteur (`LEAGUE_SUR_ACCUEIL`), code garde. 🏠 A17 : l'etape du tour ne
    // descend plus vers « Mon profil », qui a quitte l'accueil — c'est la derniere.
    return [{
      accentColor: Colors.gold500,
      icon: 'trophy',
      key: 'league-entry',
      layout: 'full',
      onPress: handleOpenLeague,
      subtitle: t('homeHub.cards.league.subtitle'),
      title: t('homeHub.cards.league.title'),
      tutorial: makeTutorial(
        'league',
        20,
        'FoundClub League',
        'Bascule vers FoundClub League pour les fonctionnalités compétitives.',
      ),
    }].filter(estAfficheeSurLAccueil);
  }, [Colors.gold500, handleOpenLeague, isParent, makeTutorial, t]);

  // 🏠 A17 + A21 (lot ACCUEIL, decision d'Adel du 30/09, option A) — LES RUBRIQUES
  // « MON PROFIL » ET « COMPTE » ONT QUITTE L'ACCUEIL. Elles vivent dans « Mon
  // compte » (l'avatar, `Profile.js`), ou CHAQUE case garde son chemin : voir mon
  // profil, le modifier, historique sportif, alertes, cotisations, changer de
  // compte, deconnexion. Le tableau avant/apres, role par role, est un temoin :
  // `views/profile/__tests__/Profile.monCompte.test.js`.
  //
  // 💰 SEULE « MON ABONNEMENT » RESTE ICI, pour le staff. C'est une entree de VENTE
  // (L33 : elle affiche le compteur d'evenements offerts et ouvre le carrousel),
  // gardee par `navigation/__tests__/subscriptionEntryPoints.test.js`. La retirer
  // toucherait a l'argent : c'est une decision d'Adel, pas d'un lot — question
  // posee au chef d'orchestre le 30/09. La retirer = rendre `[]` ici et mettre a
  // jour les deux temoins.
  /** @type {HomeCard[]} */
  const subscriptionCards = useMemo(() => {
    // D72 — le super admin ne paie rien : pas d'abonnement (pack accueil, tache 3).
    if (!canShowSubscriptionExperience) return [];

    const remainingFreeEvents = eventPublishQuotaItem?.remaining ?? 0;
    return [{
      accentColor: Colors.primary500,
      icon: 'euroCircle',
      key: 'profile-subscription',
      layout: 'full',
      onPress: handleOpenSubscriptionOverview,
      subtitle: eventPublishQuotaItem
        ? t('homeHub.cards.profile.subscription.quota', {
          count: remainingFreeEvents,
          defaultValue_one: '{{status}} · {{count}} événement offert restant',
          defaultValue_other: '{{status}} · {{count}} événements offerts restants',
          status: subscriptionStatusMeta.label,
          ...SANS_ECHAPPEMENT,
        })
        : t(
          'homeHub.cards.profile.subscription.fallbackSubtitle',
          'Consulte tes offres, quotas gratuits et équipes couvertes.',
        ),
      subtitleLines: 1,
      title: t('homeHub.cards.profile.subscription.title', 'Mon abonnement'),
    }];
  }, [
    Colors.primary500,
    canShowSubscriptionExperience,
    eventPublishQuotaItem,
    handleOpenSubscriptionOverview,
    subscriptionStatusMeta.label,
    t,
  ]);

  return (
    <ScreenContainerView
      bgImage="bg2"
      contentContainerStyle={[Spaces.paddingBottom[24], Alignments.column, Alignments.fill]}
      contentWidth="wide"
      responsivePadding
    >
      {/* GUIDE-ENTETE : la bulle du guide se pose sous le logo, la cloche et l’avatar. */}
      <TourTarget id="screen.header">
        <View style={[Spaces.marginTop[16], Spaces.marginBottom[24], Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}>
          {/* A01 — League masquee : le logo est un simple logo ; ICI, il remonte en haut. */}
          <LeagueHeaderSwitch onPress={scrollToTop} />
          <View style={{ alignItems: 'center', flexDirection: 'row' }}>
            <NotificationBadge />
            <ProfileButton hasAlert={cotisationAPayer} />
          </View>
        </View>
      </TourTarget>

      <ScrollView
        bounces={false}
        contentContainerStyle={[Spaces.gap[24], { paddingBottom: scrollBottomPadding }]}
        overScrollMode="never"
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
      >
        {/* TUTOE-CALIBRAGE (27/10) — guide en pause : « Reprendre le tour » DANS le flux,
            jamais par-dessus l'écran (ne couvre ni feuille ni bouton). */}
        <TourResumePill />
        {/* COLL-C4A (02/10) — EN TÊTE de l'accueil de chaque rôle du club : la dernière
            actualité de la Ville qu'il n'a ni ouverte ni masquée (le serveur la choisit). */}
        <BandeauActualiteMembre
          onOuvrir={(collectiviteId) => navigation.navigate(
            RouteNames.CollectiviteActualitesCanal,
            { collectiviteId },
          )}
        />
        {/* COLL-ACCUEIL (01/10) — compte mixte : la porte discrète vers l'espace de sa Ville. */}
        <CollectivitePorteRow />
        {/* CORR-INVITATION-VILLE (31/10) — invité par la Ville sans club encore : la carte qui
            rouvre l'invitation (et, sur le site, le retour au lien après la connexion). */}
        <CollectiviteInvitationRow navigation={navigation} />
        {/* LOT RÔLES — l'entrée dans le mode joueur, et SURTOUT le retour.
            PAR-L12 (E25) — trois positions : rôle du compte, joueur, parent. Le mode parent ne
            s'offre qu'à un compte qui a des enfants ; le compte Parent ouvre la feuille E27.
            RESA-L5A1 (13/10) — un compte qui gère un complexe lit, au même endroit, la bascule
            « mode complexe / mode joueur » (planche RB), qui reprend ce bandeau (mêmes
            propriétés depuis PAR-L12, RESA-RAT-APP 19/10) ; cachée par l'interrupteur
            `COMPLEXES_GERANT`.
            RESA-BASCULE (20/10/2026, planche RB-3) — pour un compte gérant à deux modes ou plus,
            la bascule est « Ton mode » : un changement de mode remonte la page (5c), et le
            compte Parent qui passe en Joueur par sa feuille lit « Ton compte est passé en
            Joueur. » (2c). */}
        {COMPLEXES_GERANT ? (
          <BasculeComplexe
            accountRoleKey={getUserRoleKey(roleName)}
            canUseParentMode={canUseParentMode === true && mesEnfants.total > 0}
            canUsePlayerMode={canUsePlayerMode === true}
            compteId={userData?.documentId || null}
            displayMode={modeActif}
            onChange={setDisplayMode}
            onMonter={scrollToTop}
            onPasseEnJoueur={() => showBanner({
              title: t('tonMode.passeEnJoueur'), tone: 'success',
            })}
            onPratiqueAussi={ouvrirLaFeuillePratique}
            prenoms={prenomsDesEnfants}
          />
        ) : (
          <PlayerModeBanner
            accountRoleKey={getUserRoleKey(roleName)}
            canUseParentMode={canUseParentMode === true && mesEnfants.total > 0}
            canUsePlayerMode={canUsePlayerMode === true}
            displayMode={modeActif}
            onChange={setDisplayMode}
            onPratiqueAussi={ouvrirLaFeuillePratique}
            prenoms={prenomsDesEnfants}
          />
        )}
        <FeuillePratiqueAussi
          isVisible={feuillePratiqueOuverte}
          onClose={fermerLaFeuillePratique}
          onDone={() => {
            setFeuillePratiqueOuverte(false);
            showBanner({ title: t('playerMode.sheet.done'), tone: 'success' });
          }}
          prenoms={prenomsDesEnfants}
        />
        {headBanner ? (
          <HomeHeadBanner
            actions={headBanner.actions}
            confirmation={headBanner.confirmation}
            label={headBanner.label}
            lines={headBanner.lines}
            subtitle={headBanner.subtitle}
            tiles={headBanner.tiles}
            title={headBanner.title}
            titleSuffix={headBanner.titleSuffix}
            tone={headBanner.tone}
            variant={headBanner.variant}
          />
        ) : null}
        <OnboardingWrapper
          description={t('homeHubTutorial.steps.header.description', 'Cette page te donne un accès rapide à toutes les fonctionnalités principales.')}
          id="homehub-header"
          nextAction={!hasManageSection ? 'scrollDown' : undefined}
          nextLabel={!hasManageSection ? scrollDownLabel : undefined}
          nextTargetStepId={!hasManageSection ? 'homehub-searchEvents' : undefined}
          onNext={!hasManageSection ? scrollToSearchSection : undefined}
          order={1}
          spotlight={{
            borderRadius: 14, overlayOpacity: 0.42, paddingX: 6, paddingY: 4,
          }}
          style={{ alignSelf: 'center' }}
          title={t('homeHubTutorial.steps.header.title', 'Accueil FoundClub')}
        >
          <View style={[Alignments.alignCenter, Spaces.gap[8], { minWidth: 220 }]}>
            <Text style={[Fonts.h3Bold, Fonts.neutral00]}>{t('homeHub.title', 'Accueil').toUpperCase()}</Text>
            <View style={[ApplicationStyle.separator, ApplicationStyle.backgroundColor.neutral00, { width: 96 }]} />
            <Text style={[Fonts.p2Bold, Fonts.primary500]}>{roleLabel.toUpperCase()}</Text>
          </View>
        </OnboardingWrapper>

        <View onLayout={(event) => registerSectionAnchor('manage', event)} ref={(node) => registerSectionViewRef('manage', node)}>
          {isPublishingGovernedBlocked ? (
            <View
              style={[
                ApplicationStyle.borderRadius24,
                Spaces.padding[16],
                Spaces.marginBottom[16],
                Spaces.gap[8],
                {
                  backgroundColor: 'rgba(163, 163, 163, 0.10)',
                  borderColor: 'rgba(163, 163, 163, 0.26)',
                  borderWidth: 1,
                },
              ]}
            >
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {t('homeHub.publishingBlocked.title', 'Publication réservée aux clubs certifiés')}
              </Text>
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {governedPublishingBlockReason === 'requires_superadmin_authorization'
                  ? t(
                    'homeHub.publishingBlocked.requiresSuperadmin',
                    "Ton club n'est pas encore certifié. Tu peux gérer ton organisation, mais un superadmin doit encore autoriser la publication des événements et des offres.", // eslint-disable-line max-len
                  )
                  : t(
                    'homeHub.publishingBlocked.temporary',
                    'La publication est temporairement bloquée pour ce club non certifié.',
                  )}
              </Text>
            </View>
          ) : null}
          <HomeSection Alignments={Alignments} cards={manageSectionCards} Fonts={Fonts} registerTutorialTargetNode={registerTutorialTargetNode} Spaces={Spaces} title={manageSectionTitle} />
        </View>
        <View onLayout={(event) => registerSectionAnchor('search', event)} ref={(node) => registerSectionViewRef('search', node)}>
          <HomeSection Alignments={Alignments} cards={searchCards} Fonts={Fonts} registerTutorialTargetNode={registerTutorialTargetNode} Spaces={Spaces} title={t('homeHub.sections.search')} />
        </View>
        {/*
          A02 — League masquee : son cadre n'est pas rendu du tout. Une vue vide
          compterait quand meme dans l'ecart entre sections (`gap`) et creuserait
          un trou de 24 px entre « Rechercher » et la suite.
        */}
        {leagueCards.length ? (
          <View
            onLayout={(event) => registerSectionAnchor('league', event)}
            ref={(node) => registerSectionViewRef('league', node)}
          >
            <HomeSection
              Alignments={Alignments}
              cards={leagueCards}
              Fonts={Fonts}
              registerTutorialTargetNode={registerTutorialTargetNode}
              Spaces={Spaces}
              title={t('homeHub.sections.league')}
            />
          </View>
        ) : null}
        {/* A17 + A21 — ce qui reste de « Mon profil » : l'abonnement (staff). */}
        <HomeSection
          Alignments={Alignments}
          cards={subscriptionCards}
          Fonts={Fonts}
          registerTutorialTargetNode={registerTutorialTargetNode}
          Spaces={Spaces}
          title={t('homeHub.sections.subscription')}
        />

        {/*
          🏁 « MON ENTRAÎNEMENT » EST LA DERNIÈRE SECTION DE L'ACCUEIL — décision
          d'Adel du 2026-09-08 : « la section mon entraînement doit être tout en bas,
          c'est en bonus ».

          ⚠️ CE QUE ÇA CHANGE, ET IL FAUT LE SAVOIR. Cette section n'a AUCUN garde de
          rôle, et c'était déjà une décision (voir le commentaire de `trainingCards`) :
          l'entraînement est PERSONNEL, et le Joueur en est la cible. Or pour un Joueur,
          un Parent ou un compte neuf, `manageSectionCards` rend `[]` et `HomeSection`
          ne dessine rien : la section « Entraînement » était jusqu'ici la PREMIÈRE
          chose qu'ils voyaient. Elle passe maintenant DERNIÈRE, sous « Déconnexion ».
          C'est assumé — mais si on veut un jour la remonter pour eux seuls, le
          couple de drapeaux existe déjà (`hasManageSection`, `isSuperAdmin`) et il
          suffit d'un test autour de cette ligne.

          🪤 On ne déplace QUE ce rendu, jamais la définition de `trainingCards` :
          `trainingCardText.test.js` lit le corps du memo par une TRANCHE de fichier
          bornée à `const searchCards`. Déplacer le memo après lui rendrait la tranche
          vide et ferait tomber 5 témoins sans rapport avec l'accueil.
        */}
        <HomeSection Alignments={Alignments} cards={trainingCards} Fonts={Fonts} registerTutorialTargetNode={registerTutorialTargetNode} Spaces={Spaces} title={t('homeHub.sections.training')} />
      </ScrollView>

      {isFocused ? (
        <>
          <BottomModal
            close={closeTutorialCenterModal}
            hideCloseButton={false}
            isVisible={isTutorialCenterVisible}
            scrollable={false}
            webPresentation="dialog"
          >
            <View style={[Spaces.gap[12], Spaces.paddingBottom[24]]}>
              <Text style={[Fonts.h3Bold, Fonts.neutral00]}>{t('homeHubTutorial.center.title', 'Tutoriels et aide')}</Text>
              <Text style={[Fonts.p2, Fonts.neutral200]}>{t('homeHubTutorial.center.subtitle', 'Relance un tutoriel ou réinitialise tous les guides.')}</Text>
              <Button onPress={startHomeTutorial} title={t('homeHubTutorial.center.actions.relaunchHome', 'Relancer le tutoriel Accueil')} variant="Primary" />
              <Button onPress={openFeatureTutorialPicker} title={t('homeHubTutorial.center.actions.pickFeature', 'Choisir un tutoriel de fonctionnalité')} variant="Secondary" />
              <Button onPress={handleResetAllTutorials} title={t('homeHubTutorial.center.actions.resetAll', 'Réinitialiser tous les tutoriels')} variant="Secondary" />
            </View>
          </BottomModal>

          <BottomModal
            close={closeFeatureTutorialPicker}
            hideCloseButton={false}
            isVisible={isFeatureTutorialPickerVisible}
            webPresentation="dialog"
          >
            <View style={[Spaces.gap[12], Spaces.paddingBottom[24]]}>
              <Text style={[Fonts.h3Bold, Fonts.neutral00]}>{t('homeHubTutorial.featurePicker.title', 'Choisir un tutoriel')}</Text>
              <Text style={[Fonts.p2, Fonts.neutral200]}>{t('homeHubTutorial.featurePicker.subtitle', 'Sélectionne une fonctionnalité à découvrir.')}</Text>
              {tutorialOptions.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  onPress={() => navigateToTutorial(option.id)}
                  style={[ApplicationStyle.borderRadius12, ApplicationStyle.borderWidth1, {
                    backgroundColor: 'rgba(23,56,68,0.94)', borderColor: `${Colors.primary500}66`, paddingHorizontal: 14, paddingVertical: 12,
                  }]}
                >
                  <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </BottomModal>
        </>
      ) : null}

      {shouldRenderLegacyEntryGate ? (
        <View
          style={[
            Platform.OS === 'web' ? null : Alignments.absolute,
            Alignments.justifyCenter,
            Alignments.alignCenter,
            Spaces.paddingHorizontal[24],
            /** @type {any} */ ({
              backgroundColor: 'rgba(0, 18, 24, 0.88)',
              bottom: 0,
              left: 0,
              paddingBottom: entryGateBottomInset,
              paddingTop: entryGateTopInset,
              position: Platform.OS === 'web' ? 'fixed' : 'absolute',
              right: 0,
              top: 0,
              zIndex: 60,
            }),
          ]}
        >
          <View
            style={[
              ApplicationStyle.backgroundColor.primary700,
              ApplicationStyle.borderRadius24,
              ApplicationStyle.borderWidth1,
              Spaces.padding[24],
              Spaces.gap[12],
              {
                alignSelf: 'center',
                borderColor: `${Colors.primary500}66`,
                maxHeight: entryGateMaxHeight,
                maxWidth: 380,
                width: '100%',
              },
            ]}
          >
            <Image
              resizeMode="contain"
              source={Images.logo}
              style={{
                alignSelf: 'center',
                height: 20,
                maxWidth: 186,
                minWidth: 140,
                width: '62%',
              }}
            />
            <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
              {t('homeHubTutorial.entry.title', 'Bienvenue sur FoundClub')}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {t(
                'homeHubTutorial.entry.subtitle',
                "FoundClub est un outil conçu pour t'accompagner dans toute ton aventure sportive, peu importe ton sport.",
              )}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {t(
                'homeHubTutorial.entry.description',
                'Tu peux lancer le tutoriel complet pour tout comprendre, ou explorer l\'application par toi-même.',
              )}
            </Text>
            <View style={[Spaces.gap[8], Spaces.marginTop[4]]}>
              <Button
                onPress={handleEntryStartTutorial}
                title={t('homeHubTutorial.entry.actions.start', 'Lancer le tutoriel complet')}
                variant="Primary"
              />
              <Button
                onPress={handleEntrySkipTutorial}
                title={t('homeHubTutorial.entry.actions.skip', 'Passer')}
                variant="Secondary"
              />
            </View>
          </View>
        </View>
      ) : null}

      <GlobalPromptModal
        body={t(
          'homeHubTutorial.entry.subtitle',
          "FoundClub est un outil conçu pour t'accompagner dans toute ton aventure sportive, peu importe ton sport.",
        )}
        headerContent={(
          <Image
            resizeMode="contain"
            source={Images.logo}
            style={{
              alignSelf: 'center',
              height: 20,
              maxWidth: 186,
              minWidth: 140,
              width: '62%',
            }}
          />
        )}
        onRequestClose={handleEntrySkipTutorial}
        primaryAction={{
          label: t('homeHubTutorial.entry.actions.start', 'Lancer le tutoriel complet'),
          onPress: handleEntryStartTutorial,
        }}
        secondaryAction={{
          label: t('homeHubTutorial.entry.actions.skip', 'Plus tard'),
          onPress: handleEntrySkipTutorial,
        }}
        supportingText={t(
          'homeHubTutorial.entry.description',
          "Tu peux lancer le tutoriel complet pour tout comprendre, ou explorer l'application par toi-même.",
        )}
        title={t('homeHubTutorial.entry.title', 'Bienvenue sur FoundClub')}
        visible={Platform.OS === 'web' && isHomeHubEntryGateVisible}
      />
      <GlobalPromptModal
        body={contextualPrompt?.body}
        inlineOnAndroid
        onRequestClose={closeContextualPrompt}
        primaryAction={contextualPrompt?.primaryAction}
        secondaryAction={contextualPrompt?.secondaryAction}
        title={contextualPrompt?.title || ''}
        tone={contextualPrompt?.tone || 'primary'}
        visible={Boolean(contextualPrompt)}
      />

      <ExternalCompetitionPromptGate
        enabled={isExternalCompetitionPromptEnabled}
        userData={userData}
      />

      <SubscriptionPaywallSheet
        close={() => setSubscriptionPaywallDecision(null)}
        decision={subscriptionPaywallDecision}
        isVisible={Boolean(subscriptionPaywallDecision)}
        navigation={navigation}
      />
    </ScreenContainerView>
  );
}

/**
 * @param {{ navigation: any; route: any }} props
 */
function HomeHub({ navigation, route }) {
  const auth = useAuth();
  const { t } = useTranslation();
  const userId = auth?.userData?.documentId;

  useEffect(() => {
    if (auth?.userData?.documentId) {
      markBootStep('home_hub_mounted', {
        userDocumentId: auth.userData.documentId,
      });
    }
  }, [auth?.userData?.documentId]);

  const handleForceStartHandled = useCallback(() => {
    navigation.setParams({
      startTutorial: undefined,
      tutorialId: undefined,
      tutorialSource: undefined,
      tutorialStartToken: undefined,
    });
  }, [navigation]);

  if (auth?.userDataLoading) {
    return (
      <HomeHubStateView
        description={t('homeHub.state.loading.description', 'Nous préparons ton espace FoundClub.')}
        isLoading
        title={t('homeHub.state.loading.title', "Chargement de l'accueil")}
      />
    );
  }

  if (auth?.userDataError) {
    return (
      <HomeHubStateView
        actionLabel={t('homeHub.state.error.retry', 'Réessayer')}
        description={t(
          'homeHub.state.error.description',
          'Impossible de charger ton espace pour le moment. Vérifie ton connexion puis relance le chargement.', // eslint-disable-line max-len
        )}
        onAction={() => {
          auth.refetchUserData?.();
        }}
        title={t('homeHub.state.error.title', 'Accueil indisponible')}
      />
    );
  }

  if (!auth?.userData) {
    return (
      <HomeHubStateView
        actionLabel={t('homeHub.state.noUser.refresh', 'Actualiser')}
        description={t(
          'homeHub.state.noUser.description',
          "Ton compte n'a pas encore été chargé. Relance le chargement pour afficher ton accueil personnalisé.", // eslint-disable-line max-len
        )}
        onAction={() => {
          auth.refetchUserData?.();
        }}
        title={t('homeHub.state.noUser.title', 'Compte introuvable')}
      />
    );
  }

  return (
    <TutorialFlowBoundary
      autoStart={false}
      onForceStartHandled={handleForceStartHandled}
      routeParams={route?.params}
      tutorialId={TutorialIds.HOME_HUB}
      userId={userId}
    >
      <HomeHubContent auth={auth} navigation={navigation} route={route} />
    </TutorialFlowBoundary>
  );
}

export default HomeHub;
