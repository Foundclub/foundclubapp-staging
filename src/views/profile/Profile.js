import { useFocusEffect } from '@react-navigation/native';
import { useMutation } from '@tanstack/react-query';
import { format as formatDate } from 'date-fns';
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Dimensions,
  Image,
  Linking,
  Platform,
  RefreshControl, Text, TouchableOpacity, useWindowDimensions, View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { getUserRoleKey } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import { navigateToRequestsHub } from '@/domains/requests/requestNavigation';
import {
  endSentenceAfterName,
  formatCollectiviteOfferedBy,
  getActiveClubNotCovered,
  getActiveClubOfferPayer,
  getSubscriptionBadgeLevel,
  getSubscriptionQuotaItems,
} from '@/domains/subscription/subscriptionDecision';
import { TutorialIds } from '@/domains/tutorial/tutorialIds';
import { useAppContext } from '@/store/appContext';
import {
  anglaisDisponible,
  enregistrerChoixDeLangue,
  langueEffective,
  lireChoixDeLangue,
} from '@/theme/strings/langue';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import MarqueeText from '@/components/atoms/marqueeText/MarqueeText';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';
import OnboardingWrapper from '@/components/molecules/onboardingWrapper/OnboardingWrapper';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import TutorialFlowBoundary from '@/components/molecules/tutorial/TutorialFlowBoundary';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';
import useOuvrirLAssistance from '@/views/chat/useOuvrirLAssistance';
import EntreeComplexe from '@/views/complexe/components/EntreeComplexe';
import PastilleDEtat from '@/views/profile/parent/PastilleDEtat';
import useMesEnfantsEnBref from '@/views/profile/parent/useMesEnfantsEnBref';
import NombreAVenir from '@/views/reserverTerrain/components/NombreAVenir';

import { RouteNames } from '@/navigation/routeNames';
import { navigateOrExplainOnWeb } from '@/navigation/webNavigationGuard';

import { deleteAccount } from '@/services/auth/authService';
import {
  useCollectiviteRequests,
  useMyCollectivites,
} from '@/services/collectivite/collectiviteQueries';
import { useMyFacilityReports } from '@/services/facilityReport/facilityReportQueries';

import { COMPLEXES_GERANT, COMPLEXES_JOUEUR } from '@/config/fonctionsMasquees';
import { SUPPORT_CONTACT_MAILTO } from '@/config/legalUrls';
import {
  isBirthdateUnderAge,
  MINOR_PARENT_ACCOUNT_REQUIRED_UNDER_AGE,
  PARENTAL_POWER_ENDS_AGE,
} from '@/constants/parentalDeclaration';
import { useTour } from '@/context/useTour';
import { getItem, removeItem, setItem } from '@/platform/storage';

/** @typedef {import('@/store/types').AuthSession} AuthSession */

/**
 * 🏛️ VILLE-T18B point 4 (T18, G12b) — la clé, sur l'appareil, de la Ville que gère un compte
 * « Ville seule ». La feuille « Changer de compte » ne sait d'un compte NON actif que ce que sa
 * session a gardé (son rôle « Authenticated », « Membre ») : la Ville qu'il gère ne se lit
 * (`/collectivites/mine`) qu'en étant ce compte. « Mon compte » l'écrit, la feuille la relit.
 * @param {string | null | undefined} userDocumentId - Le compte.
 * @returns {string} La clé de stockage.
 */
const cleVilleGeree = (userDocumentId) => `coll-compte:ville-geree:${userDocumentId || 'anonyme'}`;

// Design 13c « l'abonnement au centre » : jetons de surface locaux (translucides,
// hors palette de tokens car spécifiques à cet écran).
const SURFACE = {
  cardBg: 'rgba(4,31,44,0.82)',
  cardBorder: 'rgba(1,179,244,0.24)',
  divider: 'rgba(255,255,255,0.08)',
  iconTileClub: 'rgba(255,40,79,0.12)',
  iconTileDefault: 'rgba(1,179,244,0.12)',
  quotaTrack: 'rgba(255,255,255,0.08)',
  sectionBg: 'rgba(255,255,255,0.04)',
  sectionBorder: 'rgba(255,255,255,0.09)',
};

/**
 * PAR-L7 (13/10, design parent E02, décision D1 A d'Adel du 12/10) — « MON COMPTE » D'UN PARENT :
 * sa famille d'abord. L'ordre de la planche 1 : « Mes enfants », son profil (voir, modifier), ses
 * alertes, puis sa carte de collection. Une rangée absente de cette liste garde sa place d'avant,
 * après elles ; les rangées de la Ville restent EN TÊTE (COLL 1c : pour un agent municipal, c'est
 * LA raison d'ouvrir l'app). Les autres rôles gardent leur ordre.
 */
const ORDRE_DU_PARENT = Object.freeze(['myChildren', 'view', 'edit', 'alerts', 'myCard']);

/**
 * Le rang d'une rangée dans « Mon compte » d'un parent (plus petit = plus haut).
 * @param {{ key: string }} rangee - La rangée.
 * @returns {number} - -1 pour la Ville, puis l'ordre de la planche, puis le reste.
 */
const rangPourLeParent = (rangee) => {
  if (rangee.key.startsWith('collectivite-')) return -1;
  const rang = ORDRE_DU_PARENT.indexOf(rangee.key);
  return rang === -1 ? ORDRE_DU_PARENT.length : rang;
};

/**
 * Profile screen component. Displays user information and profile management options.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Profile screen component
 */
function Profile({ navigation, route }) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const { i18n, t } = useTranslation();
  const [{ fcmToken }] = useAppContext();
  const {
    accountSubscriptionAccessLevel,
    addAccount,
    authSessions,
    canEditClub,
    canManageTeam,
    clubVerificationSummary,
    entitlementsSummary,
    freeUsageSummary,
    isParentMode,
    logoutMutation,
    refetchUserData,
    subscriptionAccessLevel,
    subscriptionSummary,
    switchAccount,
    userData,
    userDataError,
    userDataLoading,
  } = useAuth();

  const [isAccountModalVisible, setIsAccountModalVisible] = useState(false);
  const [switchingAccountId, setSwitchingAccountId] = useState(/** @type {string | null} */ (null));
  // 🔤 I18N-0 — le réglage « Langue ». `null` = suivre la langue du téléphone.
  const [choixDeLangue, setChoixDeLangue] = useState(() => lireChoixDeLangue());
  const [isLanguageChoiceOpen, setIsLanguageChoiceOpen] = useState(false);
  // 🛟 MSG-SUPPORT (20/10, décision d'Adel « 3 ») — « Nous contacter » propose les DEUX : écrire à
  // l'assistance (la conversation dans l'app) ou envoyer un e-mail (le lien de R24).
  const [isContactChoiceOpen, setIsContactChoiceOpen] = useState(false);
  const assistance = useOuvrirLAssistance({ navigation });
  const safeAuthSessions = authSessions || [];
  const hasMultipleConnectedAccounts = safeAuthSessions.length > 1;
  const currentRoleKey = getUserRoleKey(userData?.role?.type || userData?.role?.name);
  const tour = useTour();
  // GUIDE-RELANCE (décision d'Adel 3- A, 28/10) : guide déjà lancé ⇒ petit menu.
  const [isGuideChoiceOpen, setIsGuideChoiceOpen] = useState(false);
  const isGuideInProgress = Boolean(tour.isGuide && tour.isTourActive);
  /**
   * Choix du menu du guide : le menu se referme, puis le guide part.
   * @param {() => void} action - Ce que fait le choix.
   * @returns {void}
   */
  const chooseGuide = (action) => {
    setIsGuideChoiceOpen(false);
    action();
  };
  const canShowSubscriptionExperience = currentRoleKey === 'coach'
    || currentRoleKey === 'president'
    || currentRoleKey === 'superAdmin';
  const isSuperAdmin = currentRoleKey === 'superAdmin';
  // D39 puis D41 — les roles dont la page profil est deja editable
  // (« voir = modifier »). Meme juge que partout : `getUserRoleKey`, jamais une
  // seconde regle. Le dirigeant a rejoint la liste le 2026-08-08 : sa page D06
  // edite champ par champ depuis le 5 aout, donc sa seconde rangee de menu
  // menait au meme sujet par un AUTRE formulaire.
  const hasEditableProfilePage = currentRoleKey === 'player'
    || currentRoleKey === 'coach'
    || currentRoleKey === 'president';
  // PAR-L7 (13/10, design E02) — le parent lit combien il a d'enfants (« Mes enfants · 2 »).
  // Les autres rôles gardent leur menu tel quel : rien n'est lu pour eux.
  // PAR-L12 (D6 A) — un compte sportif en MODE PARENT lit aussi « Mon compte » comme un parent.
  const estParent = currentRoleKey === 'parent' || isParentMode === true;
  const mesEnfants = useMesEnfantsEnBref({ actif: estParent });
  const multisportClubs = useMemo(
    () => userData?.multisportClubs || [],
    [userData?.multisportClubs],
  );

  useEffect(() => {
    if (!route?.params?.openAccountModal) return;
    setIsAccountModalVisible(true);
    navigation.setParams({ openAccountModal: false });
  }, [navigation, route?.params?.openAccountModal]);

  const canManageClub = useMemo(() => {
    if (!userData?.club?.documentId) {
      return false;
    }
    return canEditClub(userData?.club?.documentId);
  }, [userData, canEditClub]);

  // ABOPARCLUB (2026-09-29) — DEUX NIVEAUX, ET CHACUN A SA PLACE. Les compteurs
  // gratuits sont ceux du club AFFICHE (dans AIKI non couvert, ils reviennent) ;
  // la puce et la phrase disent ce que le compte PAIE (piege a du lot : le
  // « Club 100 » paye pour un autre club ne disparait pas de la carte).
  const paidSubscriptionAccessLevel = accountSubscriptionAccessLevel || subscriptionAccessLevel;
  const visibleSubscriptionQuotaItems = useMemo(
    () => getSubscriptionQuotaItems(freeUsageSummary, subscriptionAccessLevel).slice(0, 2),
    [freeUsageSummary, subscriptionAccessLevel],
  );
  // ABOCLUB (2026-09-28) — la carte « Mon abonnement » disait « Tes droits Club
  // sont actifs » a un dirigeant dont l'offre Club couvre un AUTRE club que
  // celui qu'il regarde. Meme juge que l'ecran Abonnement qu'elle ouvre.
  const uncoveredActiveClub = useMemo(() => getActiveClubNotCovered({
    clubVerificationSummary,
    entitlementsSummary,
    subscriptionAccessLevel: paidSubscriptionAccessLevel,
    userData,
  }), [clubVerificationSummary, entitlementsSummary, paidSubscriptionAccessLevel, userData]);
  // TEXTES-COLLECTIVITES (01/10) — la carte disait « Tes droits Club sont actifs. Ton club est
  // en cours de certification » pour un ESSAI, une offre PAYEE et une offre OFFERTE par la
  // Ville. Elle nomme desormais qui paie (`getActiveClubOfferPayer`, meme `offeredBy` que
  // « Mon abonnement » et le bandeau de la fiche du club).
  const activeClubDocumentId = clubVerificationSummary?.clubDocumentId
    || userData?.club?.documentId;
  const offerPayer = useMemo(() => getActiveClubOfferPayer({
    clubDocumentId: activeClubDocumentId,
    entitlementsSummary,
    subscriptionSummary,
  }), [activeClubDocumentId, entitlementsSummary, subscriptionSummary]);

  // Check if user is admin of a MultisportClub
  const canManageMultisportClub = useMemo(() => multisportClubs.length > 0, [multisportClubs]);

  // Get the first multisport club for quick access
  const firstMultisportClub = useMemo(() => multisportClubs[0] || null, [multisportClubs]);

  // 🏛️ COLLECTIVITES 1c — la porte d entree de « Ma collectivite ». Elle n existe que pour
  // un gestionnaire : `/collectivites/mine` est vide pour tout autre compte, et le serveur
  // garde chaque ecran derriere (policy is-gestionnaire-collectivite). Un agent municipal
  // n a souvent AUCUN club : la porte ne depend donc ni du club, ni du role.
  const { data: myCollectivites } = useMyCollectivites();
  const managedCollectivites = Array.isArray(myCollectivites) ? myCollectivites : [];
  // 🏛️ COLL-ACCUEIL (01/10, planche « Mon compte, la porte secondaire ») — la pastille du nombre
  // de demandes en attente sur la rangée de la Ville (même lecture, même clef que « Demandes » :
  // elle suit chaque décision). Un compte « Ville seule » (aucun rôle sportif) ne voit que
  // l'espace de sa Ville et son compte : ni carte d'abonnement, ni rangées sportives.
  // ponytail: la pastille ne compte que la PREMIÈRE Ville (un hook par Ville serait un hook en
  // boucle) ; un agent qui gère deux Villes voit le nombre de la première. Voie de sortie : un
  // total par Ville rendu par /collectivites/mine.
  const premiereVilleGeree = managedCollectivites[0] || null;
  const demandesEnAttente = useCollectiviteRequests(premiereVilleGeree?.documentId, 'pending');
  const nombreDemandesVille = Array.isArray(demandesEnAttente.data)
    ? demandesEnAttente.data.length
    : 0;
  const estVilleSeule = currentRoleKey === 'new' && managedCollectivites.length > 0;
  // R17-SIGNALER-1 (19/10, P11-securite-ou-ca-vit 6) — « Mes signalements » n'apparaît que si on
  // en a envoyé un ; « 1 en cours » tant que la Ville ne l'a pas clos.
  const mesSignalements = useMyFacilityReports({ enabled: !estVilleSeule });
  const nombreDeSignalements = Array.isArray(mesSignalements.data?.data)
    ? mesSignalements.data.data.length
    : 0;
  const signalementsEnCours = Number(mesSignalements.data?.meta?.openCount) || 0;
  // VILLE-T18B point 4 — « Mon compte » est la porte de la feuille « Changer de compte » : il
  // retient, pour CE compte, la Ville qu'il gère (ou l'efface quand il n'en gère plus), et la
  // feuille ouverte depuis un AUTRE compte la relit (cleVilleGeree).
  // ponytail: une Ville retirée à un compte reste écrite sur l'appareil jusqu'à sa prochaine
  // ouverture de « Mon compte » ; voie de sortie : la Ville gérée rendue par /users/me.
  const villeGereeRetenue = estVilleSeule ? (premiereVilleGeree?.name || '') : '';
  useEffect(() => {
    if (!userData?.documentId || !Array.isArray(myCollectivites)) return;
    const cle = cleVilleGeree(userData.documentId);
    if (villeGereeRetenue) setItem(cle, villeGereeRetenue);
    else removeItem(cle);
  }, [myCollectivites, userData?.documentId, villeGereeRetenue]);

  /**
   * Retient la langue choisie et la parle tout de suite.
   * @param {'fr' | 'en' | null} choix - La langue, ou `null` pour celle du téléphone.
   * @returns {void}
   */
  const handleChooseLanguage = (choix) => {
    enregistrerChoixDeLangue(choix);
    setChoixDeLangue(choix);
    setIsLanguageChoiceOpen(false);
    i18n?.changeLanguage(langueEffective());
  };

  const handleEditUser = () => {
    navigation.navigate(RouteNames.ProfileEdit);
  };

  const handleViewProfile = () => {
    navigation.navigate(RouteNames.UserDetails);
  };

  const handleOpenMyCard = () => {
    navigation.navigate(RouteNames.PlayerCard);
  };

  // L33 — cap sur le HUB, volontairement : « Mon compte » est un geste de
  // GESTION, pas un moment d'achat. Le catalogue reste a un tap, par la rangee
  // « Changer d'offre » du hub.
  const handleOpenSubscriptionOverview = () => {
    if (!canShowSubscriptionExperience) {
      return;
    }
    navigation.navigate(RouteNames.SubscriptionOverview);
  };

  const handleLogout = () => {
    logoutMutation.mutate(fcmToken || '');
  };

  const handleLogoutFromAccountSwitcher = () => {
    setIsAccountModalVisible(false);
    handleLogout();
  };

  const handleOpenClub = () => {
    navigation.navigate(RouteNames.ClubStack, {
      params: { clubId: userData?.club?.documentId },
      screen: RouteNames.Club,
    });
  };

  /**
   * Opens the multisport club dashboard screen.
   * @param {string | undefined} cmId - The documentId of the MultisportClub
   */
  const handleOpenMultisportClub = (cmId) => {
    if (!cmId) return;
    navigation.navigate(RouteNames.CMDashboard, { cmId });
  };

  /**
   * Opens the team screen.
   * @param {string} teamId - The ID of the team to open
   * @returns {void}
   */
  const handleOpenTeam = (teamId) => {
    navigation.navigate(RouteNames.TeamStack, {
      params: { teamId },
      screen: RouteNames.TeamDetails,
    });
  };

  const deleteAccountMutation = useMutation({
    mutationFn: deleteAccount,
    onError: (error) => {
      const normalizedError = /** @type {any} */ (error);
      // Extract specific error message if available
      const errorMessage = normalizedError?.response?.data?.error?.message
        || normalizedError?.message
        || t('profile.alerts.deleteError', 'Une erreur est survenue lors de la suppression du compte.');

      Alert.alert(t('common.error'), errorMessage);
    },
    onSuccess: () => {
      logoutMutation.mutate(fcmToken || '');
    },
  });

  const handleDeleteAccount = () => {
    Alert.alert(
      t('profile.alerts.deleteAlert.title'),
      // Lot L28 : on annonce ce que la suppression FAIT (retrait des inscriptions
      // a venir, staff prevenu, historique conserve). L ancienne cle `subtitle`
      // renvoyait vers un formulaire de contact alors que ce bouton supprime le
      // compte immediatement — elle reste en place, plus personne ne l affiche.
      // FINITIONS18 · POINT 15 (decision d'Adel « abo-suppr oui », 06/10) — la suppression
      // n'arrete PAS un abonnement pris sur l'App Store ou Google Play : l'ecran le dit, apres les
      // consequences, avant les boutons. Rien ne change a la facturation ni au parcours.
      `${t('profile.alerts.deleteAlert.consequences')}\n\n${t(
        'profile.alerts.deleteAlert.abonnement',
        // eslint-disable-next-line max-len
        'La suppression de ton compte n’arrête pas un abonnement pris sur l’App Store ou Google Play : résilie-le dans les réglages de ton téléphone.',
      )}`,
      [
        {
          style: 'cancel',
          text: t('profile.alerts.deleteAlert.actions.cancel'),
        },
        {
          onPress: () => {
            deleteAccountMutation.mutate();
          },
          style: 'destructive',
          text: t('profile.alerts.deleteAlert.actions.confirm'),
        },
      ],
    );
  };

  const handleOpenRequestsHub = () => {
    navigateToRequestsHub(navigation, {
      initialFilter: 'all',
      source: 'profile',
    });
  };

  const handleSwitchAccount = async (/** @type {AuthSession} */ session) => {
    const targetId = session?.user?.documentId || session?.user?.id;
    if (!targetId || switchingAccountId) return;

    setSwitchingAccountId(targetId);
    try {
      await switchAccount(session);
      setIsAccountModalVisible(false);
    } finally {
      setSwitchingAccountId(null);
    }
  };

  const handleAddAccount = () => {
    // Keep a little room for multi-role QA and real multi-account users.
    const MAX_ACCOUNTS = 7;
    if (safeAuthSessions.length >= MAX_ACCOUNTS) {
      Alert.alert(
        t('profile.alerts.maxAccounts.title'),
        t('profile.alerts.maxAccounts.message', { count: MAX_ACCOUNTS }),
      );
      return;
    }
    setIsAccountModalVisible(false);
    addAccount();
  };

  const handleToggleAccountSwitcher = () => {
    if (Platform.OS === 'web') {
      setIsAccountModalVisible((currentValue) => !currentValue);
      return;
    }

    setIsAccountModalVisible(true);
  };

  // R24 — un lien de contact qui n'ouvre rien vaut un lien absent : si aucune
  // application e-mail ne repond (simulateur, telephone sans compte configure),
  // on affiche l'adresse en toutes lettres au lieu de ne rien faire.
  const handleContactSupport = () => {
    Promise.resolve(Linking.openURL(SUPPORT_CONTACT_MAILTO)).catch(() => {
      Alert.alert(
        t('profile.contactSupport.unavailableTitle'),
        t('profile.contactSupport.unavailableBody'),
      );
    });
  };

  useFocusEffect(
    useCallback(() => {
      refetchUserData();
    }, [refetchUserData]),
  );

  let activeProfileTutorialId = TutorialIds.PROFILE_MAIN;
  if (route?.params?.tutorialId === TutorialIds.ACCOUNT_SWITCHER_MODAL) {
    activeProfileTutorialId = TutorialIds.ACCOUNT_SWITCHER_MODAL;
  } else if (route?.params?.tutorialId === TutorialIds.LOGOUT_CONFIRMATION) {
    activeProfileTutorialId = TutorialIds.LOGOUT_CONFIRMATION;
  }
  const isProfileMainTutorial = activeProfileTutorialId === TutorialIds.PROFILE_MAIN;
  const isAccountSwitcherTutorial = activeProfileTutorialId === TutorialIds.ACCOUNT_SWITCHER_MODAL;
  const isLogoutTutorial = activeProfileTutorialId === TutorialIds.LOGOUT_CONFIRMATION;

  // ----- Identité compacte -----
  const identityFirstName = userData?.firstname || '';
  const identityLastName = userData?.lastname || '';
  const identityFullName = `${identityFirstName} ${identityLastName}`.trim();
  const identityRoleLabel = t(`profile.identity.roles.${currentRoleKey}`, t('profile.identity.roles.new'));
  const identityClubName = userData?.club?.name
    || firstMultisportClub?.name
    || userData?.myTeams?.[0]?.club?.name
    || userData?.myTeams?.[0]?.name
    || '';
  let identitySubline = identityClubName
    ? t('profile.identity.roleWithClub', {
      club: identityClubName, role: identityRoleLabel, ...SANS_ECHAPPEMENT,
    })
    : identityRoleLabel;
  // COLL-ACCUEIL — un compte Ville seule lisait « Membre » : il est GESTIONNAIRE de sa Ville.
  if (estVilleSeule) {
    identitySubline = t('collectiviteAccueil.compte.gestionnaire', 'Gestionnaire · {{ville}}', {
      ville: premiereVilleGeree?.name || '',
      ...SANS_ECHAPPEMENT,
    });
  }
  let identityClub = null;
  let identityClubOnPress = null;
  if (userData?.club) {
    identityClub = userData.club;
    identityClubOnPress = handleOpenClub;
  } else if (firstMultisportClub) {
    identityClub = firstMultisportClub;
    identityClubOnPress = () => handleOpenMultisportClub(firstMultisportClub.documentId);
  } else if (userData?.myTeams?.[0]) {
    identityClub = userData.myTeams[0].club || userData.myTeams[0];
    identityClubOnPress = () => handleOpenTeam(userData.myTeams[0].documentId || '');
  }

  const identityContent = (
    <View style={[Alignments.row, Alignments.alignCenter, { gap: 12 }]}>
      {/* L14 : un seul medaillon pour tout le monde — ProfileAvatar rend la
          photo si elle existe, sinon les initiales. Le repli maison qui vivait
          ici (2e variante de medaillon dans l'app) a ete supprime. */}
      <ProfileAvatar
        imageStyle={{ borderRadius: 27 }}
        imageUrl={userData?.avatar?.url}
        name={identityFullName}
        size={54}
        style={[
          ApplicationStyle.borderColor.neutral00,
          ApplicationStyle.borderWidth1,
          { borderRadius: 27 },
        ]}
      />
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        {/* MARQUEE — mon propre nom se lit en entier, sans manger le bouton. */}
        <MarqueeText
          style={[Fonts.neutral00, { fontFamily: 'Montserrat-Bold', fontSize: 17 }]}
          text={identityFullName}
        />
        <Text numberOfLines={1} style={{ color: Colors.neutral300, fontSize: 12 }}>
          {identitySubline}
        </Text>
      </View>
      {identityClub ? (
        <TouchableOpacity
          accessibilityRole="button"
          disabled={!identityClubOnPress}
          onPress={identityClubOnPress || undefined}
        >
          <ClubLogoMark
            club={identityClub}
            logoStyle={[
              ApplicationStyle.borderWidth1,
              ApplicationStyle.borderColor.neutral00,
              { borderRadius: 17 },
            ]}
            name={identityClub?.name}
            size={34}
          />
        </TouchableOpacity>
      ) : null}
    </View>
  );

  // ----- Carte abonnement (chip 4 états + jauges humaines) -----
  // ABOPARCLUB — recette du 29/09 (tournee 4, defaut 4) : meme badge que
  // « Mon abonnement », jamais « Club · actif » a cote de « pas ton club ».
  const badgeAccessLevel = getSubscriptionBadgeLevel({
    activeClubLevel: subscriptionAccessLevel,
    paidLevel: paidSubscriptionAccessLevel,
    uncoveredActiveClub,
  });
  const subscriptionChip = useMemo(() => {
    switch (badgeAccessLevel) {
      case 'CLUB':
        return {
          container: { backgroundColor: 'rgba(133,103,255,0.16)', borderColor: 'rgba(133,103,255,0.55)' },
          label: t('profile.subscription.states.club'),
          showClock: false,
          textColor: Colors.violet200,
        };
      case 'CLUB_UNVERIFIED':
        return {
          container: { backgroundColor: 'rgba(133,103,255,0.10)', borderColor: 'rgba(133,103,255,0.45)' },
          label: t('profile.subscription.states.clubUnverified'),
          // R10 — plus de sablier : les deux etats Club ouvrent les memes droits,
          // et l'horloge suggerait au client une attente qui ne le concerne pas.
          showClock: false,
          textColor: Colors.violet200,
        };
      case 'TEAM':
        return {
          container: { backgroundColor: 'rgba(1,179,244,0.12)', borderColor: 'rgba(1,179,244,0.45)' },
          label: t('profile.subscription.states.team'),
          showClock: false,
          textColor: Colors.primary200,
        };
      default:
        return {
          container: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.22)' },
          label: t('profile.subscription.states.free'),
          showClock: false,
          textColor: Colors.neutral200,
        };
    }
  }, [badgeAccessLevel, Colors, t]);

  const subscriptionStatusKey = {
    CLUB: 'club',
    CLUB_UNVERIFIED: 'clubUnverified',
    FREE: 'free',
    TEAM: 'team',
  }[paidSubscriptionAccessLevel] || 'free';
  let subscriptionStatusText = t(`profile.subscription.status.${subscriptionStatusKey}`);
  // OFFRIR-ABONNEMENT (07/10) — offerte par FoundClub (console SuperAdmin) : la meme phrase
  // que l'offre de la Ville, jamais « Payé par ton club ».
  const offertePar = offerPayer?.kind === 'foundclub'
    ? 'FoundClub'
    : offerPayer?.kind === 'collectivite' && formatCollectiviteOfferedBy(offerPayer.name);
  if (offertePar && !uncoveredActiveClub) {
    subscriptionStatusText = t(
      'profile.subscription.offeredBy',
      'Offert par {{who}} : toutes les équipes de ton club sont couvertes.',
      { who: offertePar, ...SANS_ECHAPPEMENT },
    );
  } else if (offerPayer?.kind === 'trial' && !uncoveredActiveClub) {
    subscriptionStatusText = offerPayer.endsAt
      ? t('profile.subscription.payer.trialUntil', 'Essai Club jusqu’au {{date}}.', {
        date: formatDate(new Date(offerPayer.endsAt), 'd MMMM'),
        ...SANS_ECHAPPEMENT,
      })
      : t('profile.subscription.payer.trial', 'Essai Club en cours.');
  } else if (offerPayer?.kind === 'paid' && !uncoveredActiveClub) {
    subscriptionStatusText = subscriptionStatusKey === 'clubUnverified'
      ? t(
        'profile.subscription.payer.paidUnverified',
        'Payé par ton club. Ton club est en cours de certification par la plateforme.',
      )
      : t(
        'profile.subscription.payer.paid',
        'Payé par ton club : les droits Club sont actifs sur tout ton club.',
      );
  }
  if (uncoveredActiveClub) {
    const [coveredClubName] = uncoveredActiveClub.coveredClubNames;
    // Le nom du club finit la phrase : s'il porte deja son point, on n'en
    // ajoute pas un second (« 'AIKI-ADVENTURE'.. », recette du 29/09).
    subscriptionStatusText = coveredClubName && uncoveredActiveClub.activeClubName
      ? endSentenceAfterName(t(
        'profile.subscription.otherClub.named',
        'Ton offre Club couvre {{coveredClubs}}, pas ton club {{clubName}}.',
        {
          clubName: uncoveredActiveClub.activeClubName,
          coveredClubs: uncoveredActiveClub.coveredClubNames.join(', '),
          ...SANS_ECHAPPEMENT,
        },
      ))
      : t(
        'profile.subscription.otherClub.unnamed',
        'Ton offre Club couvre un autre club que ton club actuel.',
      );
  }

  const renderQuotaGauge = (item) => {
    const remaining = Number(item.remaining) || 0;
    const total = Number(item.total) || 0;
    const isAvailable = remaining > 0;
    const ratio = total > 0 ? Math.min(1, Math.max(0, remaining / total)) : 0;
    const label = t(`profile.subscription.quota.labels.${item.quotaType}`, item.label);
    const value = isAvailable
      ? t('profile.subscription.quota.remaining', { count: remaining })
      : t('profile.subscription.quota.used');

    return (
      <View key={item.quotaType} style={{ gap: 6 }}>
        <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, { gap: 8 }]}>
          <Text style={{ color: Colors.neutral00, fontFamily: 'Montserrat-Bold', fontSize: 12.5 }}>
            {label}
          </Text>
          <Text style={{ color: isAvailable ? Colors.primary200 : Colors.neutral400, fontSize: 12 }}>
            {value}
          </Text>
        </View>
        <View style={{
          backgroundColor: SURFACE.quotaTrack, borderRadius: 3, height: 5, overflow: 'hidden',
        }}
        >
          <View style={{
            backgroundColor: Colors.primary500,
            borderRadius: 3,
            height: 5,
            width: `${isAvailable ? ratio * 100 : 0}%`,
          }}
          />
        </View>
      </View>
    );
  };

  const subscriptionCard = canShowSubscriptionExperience ? (
    <View style={{
      backgroundColor: SURFACE.cardBg,
      borderColor: SURFACE.cardBorder,
      borderRadius: 18,
      borderWidth: 1,
      gap: 14,
      padding: 16,
    }}
    >
      <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, { gap: 12 }]}>
        <Text style={{ color: Colors.neutral00, fontFamily: 'Montserrat-Black', fontSize: 15 }}>
          {t('profile.subscription.title')}
        </Text>
        <View style={[
          Alignments.row,
          Alignments.alignCenter,
          {
            borderRadius: 999,
            borderWidth: 1,
            gap: 4,
            paddingHorizontal: 10,
            paddingVertical: 5,
          },
          subscriptionChip.container,
        ]}
        >
          {subscriptionChip.showClock ? (
            <Image
              source={Images.clock}
              style={{ height: 11, tintColor: subscriptionChip.textColor, width: 11 }}
            />
          ) : null}
          <Text style={{ color: subscriptionChip.textColor, fontFamily: 'Montserrat-Bold', fontSize: 11 }}>
            {subscriptionChip.label}
          </Text>
        </View>
      </View>

      {visibleSubscriptionQuotaItems.length ? (
        <View style={{ gap: 12 }}>
          {visibleSubscriptionQuotaItems.map(renderQuotaGauge)}
        </View>
      ) : null}
      {/* ABOPARCLUB — dans un club non couvert, les compteurs du club ET la
          phrase qui dit ou l'offre payee s'applique : l'un n'efface pas l'autre. */}
      {!visibleSubscriptionQuotaItems.length || uncoveredActiveClub ? (
        <Text style={{ color: Colors.neutral200, fontSize: 12.5, lineHeight: 18 }}>
          {subscriptionStatusText}
        </Text>
      ) : null}

      <View style={{ backgroundColor: SURFACE.divider, height: 1 }} />

      <TouchableOpacity
        accessibilityRole="button"
        onPress={handleOpenSubscriptionOverview}
        style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}
      >
        <Text style={{ color: Colors.primary500, fontFamily: 'Montserrat-Bold', fontSize: 12.5 }}>
          {t('profile.subscription.cta')}
        </Text>
        <Image source={Images.arrowRight} style={[ApplicationStyle.icon16, ApplicationStyle.tintColor.primary500]} />
      </TouchableOpacity>
    </View>
  ) : null;

  // ----- Rangées de section -----
  const sectionLabelStyle = {
    color: Colors.neutral300,
    fontFamily: 'Montserrat-Bold',
    fontSize: 11.5,
    letterSpacing: 0.6,
    textTransform: /** @type {const} */ ('uppercase'),
  };
  const sectionCardStyle = {
    backgroundColor: SURFACE.sectionBg,
    borderColor: SURFACE.sectionBorder,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
  };

  /**
   * @param {{ key: string, icon: any, label: string, onPress: () => void,
   *   destructive?: boolean, isLast?: boolean, value?: string, badge?: number,
   *   nombre?: number, a11y?: string, accessoire?: import('react').ReactNode }} params -
   *   `nombre` (PAR-L7) : un compte qui n'est pas une alerte (« 2 » enfants), dit par une pastille
   *   cyan, jamais par la pastille rouge. `accessoire` (RESA-L6B-1) : ce qui se lit lui-même (le
   *   nombre de « Mes réservations »), posé à la place de cette pastille.
   */
  const renderAccountRow = ({
    a11y = undefined, accessoire = null, badge = 0, destructive = false, icon, isLast = false,
    key, label, nombre = 0, onPress, value = undefined,
  }) => (
    <TouchableOpacity
      accessibilityLabel={a11y}
      accessibilityRole="button"
      key={key}
      onPress={onPress}
      style={[
        Alignments.row,
        Alignments.alignCenter,
        {
          gap: 12,
          minHeight: 48,
          paddingVertical: 12,
        },
        !isLast && { borderBottomColor: SURFACE.divider, borderBottomWidth: 1 },
      ]}
    >
      <View style={{
        alignItems: 'center',
        backgroundColor: destructive ? SURFACE.iconTileClub : SURFACE.iconTileDefault,
        borderRadius: 9,
        height: 30,
        justifyContent: 'center',
        width: 30,
      }}
      >
        <Image
          source={icon}
          style={{ height: 16, tintColor: destructive ? Colors.error300 : Colors.primary200, width: 16 }}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={1}
          style={{
            color: destructive ? Colors.error300 : Colors.neutral00,
            fontFamily: 'Montserrat-Bold',
            fontSize: 13.5,
          }}
        >
          {label}
        </Text>
        {/* COLL-ACCUEIL — la rangée de la Ville : son nom, puis « Ma collectivité » dessous. */}
        {value ? (
          <Text numberOfLines={1} style={[Fonts.p3, Fonts.neutral300]}>{value}</Text>
        ) : null}
      </View>
      {nombre > 0 ? (
        <PastilleDEtat testID={`${key}-nombre`} texte={String(nombre)} ton="compte" />
      ) : null}
      {accessoire}
      {badge > 0 ? (
        <View
          style={{
            alignItems: 'center',
            // Même jeton que la pastille de la cloche (NotificationBadge) : 5,2:1.
            backgroundColor: Colors.error700,
            borderRadius: 999,
            justifyContent: 'center',
            minWidth: 24,
            paddingHorizontal: 6,
          }}
          testID={`${key}-compteur`}
        >
          <Text style={[Fonts.p3Bold, Fonts.neutral00]}>{String(badge)}</Text>
        </View>
      ) : null}
      {destructive ? null : (
        <Image source={Images.arrowRight} style={[ApplicationStyle.icon16, ApplicationStyle.tintColor.neutral400]} />
      )}
    </TouchableOpacity>
  );

  const activityRows = [
    // 🏛️ COLLECTIVITES 1c — en tete : pour un agent municipal, c est LA raison d ouvrir l app.
    // COLL-ACCUEIL (01/10) — la PORTE SECONDAIRE : le nom de la Ville en titre, « Ma
    // collectivité » dessous, la pastille des demandes. Elle ouvre l'espace de la Ville (barre
    // Accueil · Demandes · Planning · Messages) ; sur le site, son accueil (menu latéral).
    // Un compte mixte y lit « ‹ Mon compte » pour revenir ; un compte Ville seule y REVIENT
    // (l'espace est déjà sa racine : `pop`).
    ...managedCollectivites.map((collectivite, index) => {
      const badge = index === 0 ? nombreDemandesVille : 0;
      const nom = collectivite?.name || '';
      return {
        // COLL-FIX2 (T10) : le singulier a sa phrase (« 1 demandes » vu sur la porte jumelle).
        a11y: badge > 0
          ? t(
            badge === 1
              ? 'collectiviteAccueil.compte.rangeeA11yDemande'
              : 'collectiviteAccueil.compte.rangeeA11yDemandes',
            badge === 1
              ? '{{nom}}, ma collectivité, 1 demande en attente'
              : '{{nom}}, ma collectivité, {{nombre}} demandes en attente',
            { nom, nombre: badge, ...SANS_ECHAPPEMENT },
          )
          : t('collectiviteAccueil.compte.rangeeA11y', '{{nom}}, ma collectivité', {
            nom,
            ...SANS_ECHAPPEMENT,
          }),
        badge,
        icon: Images.flag,
        key: `collectivite-${collectivite?.documentId}`,
        label: nom,
        onPress: () => {
          if (Platform.OS === 'web') {
            navigation.navigate(RouteNames.CollectiviteHome, {
              collectiviteId: collectivite?.documentId,
            });
            return;
          }
          navigation.navigate(RouteNames.CollectiviteSpace, {
            collectiviteId: collectivite?.documentId,
            ...(estVilleSeule ? {} : {
              returnLabel: t('collectiviteAccueil.compte.retourMonCompte', 'Mon compte'),
            }),
          }, { pop: true });
        },
        value: t('collectivite.home.kicker', 'Ma collectivité'),
      };
    }),
    // RESA-L6B-1 (19/10) — « Mes réservations » (E-P10) EN TÊTE de la rubrique, pour tout
    // pratiquant (planche EP10 état 5, choix S-19 validé avec les planches le 13/10), avec le
    // nombre de réservations à venir. Caché par `COMPLEXES_JOUEUR` (éteint : rien de plus, rien
    // n'est lu). RESA-L6B-2 (20/10) : « Mes complexes favoris » (E-P11) juste après (planche EP10
    // état 5), sans compteur (rien n'est lu ici).
    ...(COMPLEXES_JOUEUR ? [{
      accessoire: <NombreAVenir />,
      icon: Images.calendar,
      key: 'mesReservations',
      label: t('reserverTerrain.mesReservations.titre', 'Mes réservations'),
      onPress: () => navigation.navigate(RouteNames.ReserverMesReservations),
    }, {
      icon: Images.heart,
      key: 'mesFavoris',
      label: t('reserverTerrain.favoris.titre', 'Mes complexes favoris'),
      onPress: () => navigation.navigate(RouteNames.ReserverFavoris),
    }] : []),
    {
      icon: Images.trophy, key: 'myCard', label: t('profile.actions.myCard', 'Ma carte de collection'), onPress: handleOpenMyCard,
    },
    {
      icon: Images.users, key: 'view', label: t('profile.actions.view'), onPress: handleViewProfile,
    },
    // D39 puis D41 — LA FUSION, cote menu. Le pack demande que « Infos profil »
    // et « Modifier mes informations » ne fassent plus qu'une entree : quand la
    // page profil EST editable, une seconde rangee mene au meme endroit sous un
    // autre nom. D39 l'a fait pour le joueur et l'entraineur ; D41 termine par
    // le DIRIGEANT (arbitrage Adel du 2026-08-08, option A de l'audit D38), pour
    // qui le crayon de la carte identite devient le seul acces au formulaire.
    // ⛔ `ProfileEdit` reste debout : il garde ses autres points d'entree, son
    // URL web `/profile/edit`, et cette rangee-ci pour les comptes sans role.
    ...(hasEditableProfilePage ? [] : [{
      icon: Images.edit, key: 'edit', label: t('profile.actions.edit'), onPress: handleEditUser,
    }]),
    // 🏠 A17 (lot ACCUEIL, décision d'Adel du 30/09, option A) — LES DEUX LIGNES QUI
    // MANQUAIENT. La rubrique « Mon profil » a quitté l'accueil ; ses cases vivent
    // ici, avec les MÊMES règles de rôle que là-bas : ni historique ni cotisation
    // pour le parent (P0 — il ne joue pas, il ne cotise pas pour lui), pas de
    // cotisation pour le super admin (D72 — il ne paie rien).
    ...(currentRoleKey === 'parent' ? [] : [{
      icon: Images.clock,
      key: 'sportsHistory',
      label: t('profile.actions.sportsHistory'),
      // Sans `returnRoute`, l'assistant referme sur « Mon compte » (`goBack`).
      onPress: () => navigation.navigate(RouteNames.HistoryWizardCategory, { resetContext: true }),
    }]),
    ...(currentRoleKey === 'parent' || isSuperAdmin ? [] : [{
      icon: Images.euroCircle,
      key: 'myLicenses',
      label: t('profile.actions.myLicenses'),
      onPress: () => navigation.navigate(RouteNames.MyLicenses),
    }]),
    ...(canManageClub ? [{
      icon: Images.shield, key: 'manageClub', label: t('profile.actions.manageClub'), onPress: handleOpenClub,
    }] : []),
    ...(canManageMultisportClub && firstMultisportClub ? [{
      icon: Images.shield,
      key: 'manageMultisportClub',
      label: t('profile.actions.manageClub'),
      onPress: () => handleOpenMultisportClub(firstMultisportClub.documentId),
    }] : []),
    // 👨‍👧 PARENT P2 — LA RANGEE QUI MANQUAIT. Aucune des 8 rangees ne parlait
    // d'enfant, alors qu'un enfant de moins de 13 ans n'a PAS de compte : il
    // vit comme une fiche portee par celui de son parent, et c'est donc ici,
    // dans le menu du compte, que ca se gere.
    //
    // 🔓 VISIBLE DES QUATRE ROLES, et ce n'est pas un oubli de garde : le
    // serveur declare les 4 gestes « enfant declare » dans les QUATRE cartes
    // applicatives (GO Adel du 07/09 — « avoir des enfants » est une CAPACITE,
    // pas un privilege de role). La cacher aux trois autres rendrait un ecran
    // INATTEIGNABLE alors que le droit existe. Ce qui change d'un role a
    // l'autre, c'est l'INSISTANCE : le parent a en plus une case dediee sur son
    // accueil (P0). Jamais la permission.
    {
      icon: Images.users,
      key: 'myChildren',
      label: t('profile.actions.myChildren', 'Mes enfants'),
      onPress: () => navigation.navigate(RouteNames.MyChildren),
      // PAR-L7 (E02) — le parent lit combien il en a ; « 0 » ne s'écrit jamais.
      ...(mesEnfants.total > 0 ? {
        a11y: `${t('profile.actions.myChildren', 'Mes enfants')}, ${t('myChildren.list.count', {
          count: mesEnfants.total,
        })}`,
        nombre: mesEnfants.total,
      } : {}),
    },
    // 🔗 PARENT-LIEN (30/09) — LA PORTE DE L ENFANT. Un parent DEMANDE le lien ; c est ici que
    // l enfant l accepte, la refuse, voit qui est relie et le retire. Visible de 13 a 17 ans
    // (age CONNU : sans date, la porte reste fermee), et de quiconque est deja relie — il doit
    // pouvoir retirer le lien, meme devenu majeur. Un adulte sans lien n a rien a y faire.
    ...((userData?.parentAccount?.documentId
      || (
        Boolean(userData?.birthdate)
        && !isBirthdateUnderAge(userData?.birthdate, MINOR_PARENT_ACCOUNT_REQUIRED_UNDER_AGE)
        && isBirthdateUnderAge(userData?.birthdate, PARENTAL_POWER_ENDS_AGE)
      )) ? [{
        icon: Images.users,
        key: 'myParent',
        label: t('profile.actions.myParent', 'Mon parent'),
        onPress: () => navigateOrExplainOnWeb(navigation, RouteNames.MyParentLink),
      }] : []),
    {
      icon: Images.bell,
      key: 'alerts',
      label: t('profile.actions.manageAlerts'),
      onPress: () => navigation.navigate(RouteNames.SearchAlerts),
    },
    ...(canManageTeam ? [{
      icon: Images.envelope, key: 'requests', label: t('profile.actions.manageRequests'), onPress: handleOpenRequestsHub,
    }] : []),
    ...(nombreDeSignalements > 0 ? [{
      icon: Images.flag,
      key: 'facilityReports',
      label: signalementsEnCours
        ? [
          t('facilityReports.membre.mesTitre', 'Mes signalements'),
          t('facilityReports.membre.compteur', { count: signalementsEnCours }),
        ].join(' · ')
        : t('facilityReports.membre.mesTitre', 'Mes signalements'),
      onPress: () => navigation.navigate(RouteNames.MyFacilityReports),
    }] : []),
  ];

  // COLL-ACCUEIL — compte Ville seule : l'espace de la Ville, rien de sportif.
  // PAR-L7 (E02) — un parent : sa famille d'abord (`ORDRE_DU_PARENT`, tri stable).
  let lignesActivite = activityRows;
  if (estVilleSeule) {
    lignesActivite = activityRows.filter((row) => row.key.startsWith('collectivite-'));
  } else if (estParent) {
    lignesActivite = [...activityRows].sort((a, b) => rangPourLeParent(a) - rangPourLeParent(b));
  }

  const profileActivitySection = (
    <View style={{ gap: 10 }}>
      <Text style={sectionLabelStyle}>
        {estParent
          ? t('profile.sections.familyProfile', 'Ma famille et mon profil')
          : t('profile.sections.profileActivity')}
      </Text>
      <View style={sectionCardStyle}>
        {lignesActivite.map((row, index) => renderAccountRow({
          ...row,
          isLast: index === lignesActivite.length - 1,
        }))}
      </View>
    </View>
  );

  // 🔤 I18N-0 — une rangée « Langue · <choix> » qui déplie les trois choix sur
  // place. Pas d'`Alert` : sur le web elle ne s'ouvre pas, et cet écran y sert aussi.
  const nomDesLangues = { en: t('profile.language.en'), fr: t('profile.language.fr') };
  const nomDuChoix = (/** @type {'fr' | 'en' | null} */ choix) => (
    choix ? nomDesLangues[choix] : t('profile.language.auto')
  );
  const languageRows = [
    {
      icon: Images.flag,
      key: 'language',
      label: `${t('profile.actions.language')} · ${nomDuChoix(choixDeLangue)}`,
      onPress: () => setIsLanguageChoiceOpen((ouvert) => !ouvert),
    },
    ...(isLanguageChoiceOpen
      ? /** @type {Array<'fr' | 'en' | null>} */ ([null, 'fr', 'en']).map((choix) => ({
        icon: choix === choixDeLangue ? Images.check : Images.flag,
        key: `language-${choix || 'auto'}`,
        label: nomDuChoix(choix),
        onPress: () => handleChooseLanguage(choix),
      }))
      : []),
  ];

  const accountNonLogoutRows = [
    // Garde-fou du 14/09 : pas de choix de langue tant que l anglais est fermé (production).
    ...(anglaisDisponible() ? languageRows : []),
    // VILLE-T18B point 3 (T18, G12) — l'icône « personnes » de la planche P1-porte-tel. `share2`
    // est une TUILE opaque (fond bleu) : teintée par la rangée, elle devenait un carré plein.
    {
      icon: Images.users,
      key: 'switchAccount',
      label: t('profile.actions.switchAccount'),
      onPress: handleToggleAccountSwitcher,
    },
    // 🚫 BLOQUER (K3) — la porte de sortie. Apple et Google demandent que
    // l on puisse DEBLOQUER aussi facilement que bloquer : c est ici que la
    // liste se relit et se defait.
    {
      icon: Images.shield,
      key: 'blockedUsers',
      label: t('userBlock.screen.title', 'Personnes bloquées'),
      onPress: () => navigation.navigate(RouteNames.BlockedUsers),
    },
    // CARTECODE Q1 C — « Compte privé », séparé de « Ouvert au recrutement » (profil).
    {
      icon: Images.shield,
      key: 'privacy',
      label: t('profile.privacy.title', 'Confidentialité'),
      onPress: () => navigateOrExplainOnWeb(navigation, RouteNames.PrivacySettings),
    },
    // R24 — Apple 1.5 exige un moyen FACILE de joindre l'editeur DANS l'app.
    // Le seul bouton nomme « Nous contacter » ouvrait jusqu'ici la fenetre
    // « je ne trouve pas mon club » du tunnel d'affiliation : une demande aux
    // superadmins, pas un canal vers nous, et invisible hors onboarding.
    // Guide Entraîneur (TUTOE, règle 7 du pack) : il se relance d'ici, sur
    // téléphone seulement (le site ne joue aucun tour).
    // GUIDE-RELANCE (3- A et 5- A) : déjà lancé, il ouvre un menu au lieu de tout
    // refaire en vrai ; en pause (« Plus tard »), une pastille le dit.
    ...(currentRoleKey === 'coach' && Platform.OS !== 'web' ? [{
      accessoire: isGuideInProgress && tour.tourStatus === 'paused' ? (
        <PastilleDEtat
          testID="coachGuide-pause"
          texte={t('profile.coachGuide.paused', 'En pause')}
          ton="attente"
        />
      ) : null,
      icon: Images.flag,
      key: 'coachGuide',
      label: t('profile.actions.coachGuide', 'Guide entraîneur·e'),
      onPress: () => (tour.hasGuideHistory
        ? setIsGuideChoiceOpen((ouvert) => !ouvert)
        : tour.startTour('coach')),
    }] : []),
    ...(currentRoleKey === 'coach' && Platform.OS !== 'web' && isGuideChoiceOpen
      && tour.hasGuideHistory ? [
        ...(isGuideInProgress ? [{
          icon: Images.flag,
          key: 'coachGuide-resume',
          label: t('profile.coachGuide.resume', 'Reprendre là où j’en étais'),
          onPress: () => chooseGuide(() => tour.resumeTour({ pop: true })),
        }] : []),
        {
          icon: Images.flag,
          key: 'coachGuide-review',
          label: t('profile.coachGuide.review', 'Revoir le guide sans rien créer'),
          onPress: () => chooseGuide(() => tour.startTour('coach', { review: true })),
        },
        // Un bonus remplacerait la progression en cours : seulement sans guide en cours.
        ...(isGuideInProgress ? [] : [{
          icon: Images.flag,
          key: 'coachGuide-bonus',
          label: t('profile.coachGuide.bonus', 'Faire un bonus'),
          onPress: () => chooseGuide(() => tour.startTour('coach', { fromMission: 'coach_b1' })),
        }]),
      ] : []),
    {
      icon: Images.envelope,
      key: 'contactSupport',
      label: t('profile.actions.contactSupport', 'Nous contacter'),
      onPress: () => setIsContactChoiceOpen((ouvert) => !ouvert),
    },
    ...(isContactChoiceOpen ? [
      {
        a11y: assistance.erreur
          ? t('assistance.ligne.erreur', 'L’assistance ne s’ouvre pas. Réessaie dans un instant.')
          : undefined,
        icon: Images.send,
        key: 'contactSupport-assistance',
        label: t('profile.contactSupport.ecrire', 'Écrire à l’assistance'),
        onPress: assistance.ouvrir,
        value: assistance.erreur ? t('profile.contactSupport.reessayer', 'Réessaie') : undefined,
      },
      {
        icon: Images.envelope,
        key: 'contactSupport-email',
        label: t('profile.contactSupport.email', 'Envoyer un e-mail'),
        onPress: handleContactSupport,
      },
    ] : []),
    ...(isSuperAdmin ? [
      {
        icon: Images.shield,
        key: 'adminDashboardClassic',
        label: t('profile.actions.adminDashboardClassic'),
        onPress: () => navigation.navigate(RouteNames.AdminStack, { screen: RouteNames.AdminDashboard }),
      },
      {
        icon: Images.flag,
        key: 'superAdminLeagueDashboard',
        label: t('profile.actions.superAdminLeagueDashboard'),
        onPress: () => navigation.navigate(RouteNames.AdminStack, { screen: RouteNames.SuperAdminHome }),
      },
    ] : []),
  ];

  const logoutRow = renderAccountRow({
    destructive: true,
    icon: Images.arrowRight,
    isLast: true,
    key: 'logout',
    label: t('profile.actions.logout'),
    onPress: handleLogout,
  });

  const accountSection = (
    <View style={{ gap: 10 }}>
      <Text style={sectionLabelStyle}>{t('profile.sections.account')}</Text>
      <View style={sectionCardStyle}>
        {/* Les rangées non destructives gardent toujours un trait (la déconnexion suit). */}
        {accountNonLogoutRows.map((row) => renderAccountRow({ ...row, isLast: false }))}
        {isLogoutTutorial ? (
          <OnboardingWrapper
            description={t(
              'profile.tutorial.logout.description',
              'Ce bouton lance la confirmation de déconnexion de ta session.',
            )}
            id="profile-logout-action"
            order={2}
            spotlight={{
              borderRadius: 16, overlayOpacity: 0.4, paddingX: 2, paddingY: 2,
            }}
            title={t('profile.actions.logout', 'Déconnexion')}
          >
            {logoutRow}
          </OnboardingWrapper>
        ) : logoutRow}
      </View>
    </View>
  );

  // ----- Bascule de compte (modal / panneau web) : logique inchangée -----
  // SUPADM (recette iPhone d'Adel du 23/10, capture 03) — avec 7 comptes, la feuille montait
  // presque en haut, mais la liste s'arrêtait à 70 % de l'écran (le plafond par défaut de la zone
  // qui défile) : une bande vide dessous, « Ajouter un compte » coupé. La bibliothèque règle la
  // hauteur de la feuille sur le CONTENU, plafonné à l'écran moins sa marge du haut (BottomModal :
  // `topInset={insets.top + 20}`) ; la zone qui défile reçoit le même plafond, et la remplit.
  // Contexte lu sans exiger son fournisseur : 0 de marge s'il manque (témoins).
  const margesDeLEcran = useContext(SafeAreaInsetsContext);
  const { height: hauteurDeLaFenetre } = useWindowDimensions();
  const plafondDeLaFeuilleDesComptes = Math.max(
    0.7,
    (hauteurDeLaFenetre - (margesDeLEcran?.top || 0) - 20) / Dimensions.get('screen').height,
  );
  const accountSwitcherContent = (
    <View style={[Spaces.gap[12], Spaces.paddingVertical[16]]}>
      {!hasMultipleConnectedAccounts ? (
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {t('profile.accountSwitcher.singleAccountHint')}
        </Text>
      ) : null}
      {safeAuthSessions.map((session, index) => {
        const isCurrent = session?.user?.documentId === userData?.documentId;
        const sessionKey = session?.user?.documentId || session?.user?.id || `session-${index}`;
        // For current user, use userData which has full info; for others use session data
        const user = isCurrent ? userData : session?.user;
        const displayName = user?.firstname && user?.lastname
          ? `${user.firstname} ${user.lastname}`
          : user?.phone || user?.username || t('profile.accountSwitcher.fallbackName', 'Compte');
        // FINITIONS8 (point 9) : le NOM du role en base (« Entraineur », « SuperAdmin »)
        // s'affichait tel quel ; il se lit par profile.identity.roles, comme la carte
        // d'identite de cet ecran.
        // FINITIONS14 (T13-bis) — « Authenticated » (aucun rôle sportif) était traduit
        // « Dirigeant » (règle de janvier) ; il suit la règle de la carte d'identité : « Membre ».
        let roleName = t('profile.accountSwitcher.fallbackRole', 'Utilisateur');
        if (user?.role?.name) {
          const sessionRoleKey = getUserRoleKey(user.role.type || user.role.name);
          roleName = t(
            `profile.identity.roles.${sessionRoleKey}`,
            t('profile.identity.roles.new'),
          );
          // VILLE-T18B point 4 (T18, G12b) — la carte d'un compte « Ville seule » dit
          // « Gestionnaire · Ville de X » depuis COLL-ACCUEIL : la feuille la suit encore.
          // « Membre » reste le mot d'un compte sans rôle sportif ni Ville.
          const villeGeree = isCurrent
            ? villeGereeRetenue
            : getItem(cleVilleGeree(user?.documentId));
          if (sessionRoleKey === 'new' && villeGeree) {
            roleName = t('collectiviteAccueil.compte.gestionnaire', 'Gestionnaire · {{ville}}', {
              ville: villeGeree,
              ...SANS_ECHAPPEMENT,
            });
          }
        }
        const avatarUrl = isCurrent ? userData?.avatar?.url : session?.user?.avatar?.url;

        return (
          <TouchableOpacity
            disabled={Boolean(switchingAccountId)}
            key={sessionKey}
            onPress={() => !isCurrent && !switchingAccountId && handleSwitchAccount(session)}
            style={[
              Alignments.row,
              Alignments.alignCenter,
              Spaces.padding[12],
              ApplicationStyle.borderRadius8,
              ApplicationStyle.backgroundColor.primary700,
              isCurrent && { borderColor: '#01b3f4', borderWidth: 1 },
              switchingAccountId && { opacity: 0.6 },
            ]}
          >
            <ProfileAvatar
              imageUrl={avatarUrl}
              name={displayName}
              size={40}
              style={{ marginRight: 12 }}
            />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={[Fonts.p1Bold, Fonts.neutral00]}>
                {displayName}
              </Text>
              <Text style={[Fonts.p2, Fonts.neutral200]}>
                {roleName}
              </Text>
            </View>
            {switchingAccountId === (session?.user?.documentId || session?.user?.id) && (
              <Text style={[Fonts.p2Bold, Fonts.primary500]}>{t('profile.accountSwitcher.switching')}</Text>
            )}
            {isCurrent && switchingAccountId !== (session?.user?.documentId || session?.user?.id) && (
              <Text style={[Fonts.p2Bold, Fonts.primary500]}>{t('profile.accountSwitcher.active')}</Text>
            )}
          </TouchableOpacity>
        );
      })}

      <Button
        onPress={handleAddAccount}
        title={t('profile.actions.addAccount')}
        variant="Secondary"
      />
      <Button
        disabled={logoutMutation.isPending}
        isLoading={logoutMutation.isPending}
        onPress={handleLogoutFromAccountSwitcher}
        title={t('profile.actions.logout')}
        variant="Secondary"
      />
    </View>
  );

  const accountSwitcherPanel = (
    <View
      style={[
        Spaces.gap[12],
        Spaces.padding[16],
        ApplicationStyle.borderRadius12,
        ApplicationStyle.borderWidth1,
        ApplicationStyle.borderColor.primary100,
        ApplicationStyle.backgroundColor.primary700,
      ]}
    >
      <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
          {t('profile.accountSwitcher.title')}
        </Text>
        <TouchableOpacity onPress={() => setIsAccountModalVisible(false)}>
          <Text style={[Fonts.p2Bold, Fonts.primary500]}>
            {t('profile.accountSwitcher.close')}
          </Text>
        </TouchableOpacity>
      </View>
      {accountSwitcherContent}
    </View>
  );

  const accountSwitcherTutorialContent = isAccountSwitcherTutorial ? (
    <OnboardingWrapper
      description={t(
        'profile.tutorial.accountSwitcher.description',
        'Choisis un compte actif ou ajoute un nouveau compte connecté.',
      )}
      id="profile-account-switcher-modal"
      order={1}
      spotlight={{
        borderRadius: 16, overlayOpacity: 0.4, paddingX: 2, paddingY: 2,
      }}
      title={t('profile.accountSwitcher.title', 'Changer de compte')}
    >
      {accountSwitcherPanel}
    </OnboardingWrapper>
  ) : accountSwitcherPanel;

  return (
    <TutorialFlowBoundary
      onForceStartHandled={() => {
        navigation.setParams({
          startTutorial: undefined,
          tutorialId: undefined,
          tutorialSource: undefined,
          tutorialStartToken: undefined,
        });
      }}
      routeParams={route?.params}
      tutorialId={activeProfileTutorialId}
      userId={userData?.documentId}
    >
      <ScreenContainer
        bgImage="bg2"
        bottomInsetMode="screen"
        contentContainerStyle={[
          Spaces.paddingTop[0],
          Spaces.paddingBottom[12],
          Alignments.fill,
        ]}
      >
        {/* En-tête : titre centré. La flèche retour ronde est fournie par le header natif de la stack. */}
        <View style={[Alignments.alignCenter, { gap: 8 }]}>
          <Text style={[Fonts.h3Bold, Fonts.neutral00, { letterSpacing: 1 }]}>
            {t('profile.titles.profile').toUpperCase()}
          </Text>
          <View style={{ backgroundColor: Colors.neutral00, height: 2, width: 80 }} />
        </View>

        <ScrollView
          contentContainerStyle={{
            flexGrow: 1, gap: 18, paddingBottom: 8, paddingTop: 20,
          }}
          refreshControl={(
            <RefreshControl
              onRefresh={() => {
                refetchUserData();
              }}
              refreshing={userDataLoading}
            />
        )}
          showsVerticalScrollIndicator={false}
          style={[Alignments.fill]}
        >
          <WithDataWrapper
            error={userDataError?.message}
            isLoading={userDataLoading}
          >
            {identityContent}
          </WithDataWrapper>

          {subscriptionCard}

          {isProfileMainTutorial ? (
            <OnboardingWrapper
              description={t(
                'profile.tutorial.mainActions.description',
                'Depuis cette zone, tu peux consulter ton profil, gérer tes demandes et '
                  + 'changer de compte.',
              )}
              id="profile-main-actions"
              order={1}
              spotlight={{
                borderRadius: 16, overlayOpacity: 0.4, paddingX: 2, paddingY: 2,
              }}
              title={t('profile.tutorial.mainActions.title', 'Actions profil')}
            >
              {profileActivitySection}
            </OnboardingWrapper>
          ) : profileActivitySection}

          {/* RESA-L5A1 (13/10) — « Je gère un complexe » (planche E-G01, état 1, AT-01), caché
              par l'interrupteur `COMPLEXES_GERANT` tant que le serveur des complexes n'est pas
              livré. */}
          {COMPLEXES_GERANT ? <EntreeComplexe compteId={userData?.documentId || null} /> : null}

          {accountSection}

          {Platform.OS === 'web' && isAccountModalVisible ? accountSwitcherTutorialContent : null}
        </ScrollView>

        {/* Pied fixe : lien discret, toujours visible sous la liste (design 13c). */}
        <View style={[Alignments.fullWidth, Alignments.alignCenter, { paddingTop: 12 }]}>
          <TouchableOpacity onPress={handleDeleteAccount}>
            <Text style={[Fonts.p2, Fonts.neutral300, Fonts.underlineText]}>
              {t('profile.actions.deleteAccount')}
            </Text>
          </TouchableOpacity>
        </View>

        {Platform.OS === 'web' ? null : (
          <BottomModal
            close={() => setIsAccountModalVisible(false)}
            contentContainerStyle={{ paddingBottom: 8 }}
            hideCloseButton
            isVisible={isAccountModalVisible}
            maxContentHeightRatio={plafondDeLaFeuilleDesComptes}
            useSafeAreaBottomInset={false}
          >
            {isAccountSwitcherTutorial ? (
              <OnboardingWrapper
                description={t(
                  'profile.tutorial.accountSwitcher.description',
                  'Choisis un compte actif ou ajoute un nouveau compte connecté.',
                )}
                id="profile-account-switcher-modal"
                order={1}
                spotlight={{
                  borderRadius: 16, overlayOpacity: 0.4, paddingX: 2, paddingY: 2,
                }}
                title={t('profile.accountSwitcher.title', 'Changer de compte')}
              >
                {accountSwitcherContent}
              </OnboardingWrapper>
            ) : accountSwitcherContent}
          </BottomModal>
        )}
      </ScreenContainer>
    </TutorialFlowBoundary>
  );
}
export default Profile;
