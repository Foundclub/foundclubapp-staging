// @ts-nocheck
import { differenceInYears, format } from 'date-fns';
import i18next from 'i18next';
import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getUserRoleKey } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import useMessaging from '@/domains/messaging/useMessaging';
import { toBlockedUserIdSet } from '@/domains/userBlock/userBlockFilters';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import MarqueeText from '@/components/atoms/marqueeText/MarqueeText';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import UserHistorySection from '@/components/organisms/userHistorySection/UserHistorySection';
import ScreenContainer from '@/components/templates/ScreenContainer';
import CoachFeedbackList, {
  CoachFeedbackViewBody,
  CoachWords,
  feedbackCardStyle,
  NewPill,
  parentCanOpenMatch,
  WhoCanReadLine,
} from '@/views/profile/coachFeedback/CoachFeedbackList';
import {
  feedbackMetaLine,
  newFeedbackKeys,
  seenFeedbackKeys,
  wantsChildFeedbackAlert,
} from '@/views/profile/coachFeedback/coachFeedbackModel';
import ouvrirUneVueDuProfil from '@/views/profile/ouvrirUneVueDuProfil';
import BlocMesEnfants from '@/views/profile/parent/BlocMesEnfants';
import ChildIdentityCard, { ligneDIdentite } from '@/views/profile/parent/ChildIdentityCard';
import ProfileCardThumb from '@/views/profile/ProfileCardThumb';
import SelfProfilePlayerCoach from '@/views/profile/SelfProfilePlayerCoach';
import SelfProfileUnified from '@/views/profile/SelfProfileUnified';
import MyStatsPage from '@/views/profile/stats/MyStatsPage';
import ProfileStatsForViewer from '@/views/profile/stats/ProfileStatsForViewer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetUserById } from '@/services/auth/authQueries';
import {
  useGetCoachFeedbackFollow,
  useUpdateCoachFeedbackFollow,
} from '@/services/coachFeedback/coachFeedbackQueries';
import { useUserCurrentLicense } from '@/services/license/licenseQueries';
import { useGetPersonalStats } from '@/services/matchStats/matchStatsQueries';
import {
  useBlockUser,
  useGetMyBlockedUsers,
  useUnblockUser,
} from '@/services/userBlock/userBlockQueries';
import {
  useGetMyHistories,
  useGetUserHistories,
} from '@/services/userHistory/userHistoryQueries';

import { getErrorMessage } from '@/utils/errors/displayError';
import { formatHeight } from '@/utils/heightCentimeters';
import safeJsonParse from '@/utils/safeJsonParse';

import { PARENTAL_POWER_ENDS_AGE } from '@/constants/parentalDeclaration';

const isFlagEnabled = (rawValue, defaultValue = false) => {
  if (rawValue === undefined || rawValue === null || rawValue === '') return defaultValue;
  const normalized = String(rawValue).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
};
const isGroupChatEnabled = isFlagEnabled(process.env.FC_CHAT_GROUP_V1, true);

const toComparableId = (value) => (
  value === undefined || value === null ? '' : String(value).trim()
);

const parseDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * L AGE DU PROFIL REGARDE — la derivee du serveur d abord (SECU-2).
 *
 * Depuis SECU-2, le serveur ne rend PLUS la date de naissance d un tiers : il
 * rend `age`, calcule chez lui (porte 1). La date, elle, n arrive plus que pour
 * SON PROPRIETAIRE, par `/me` — et c est ce profil-la que l ecran affiche quand
 * `isSelfProfile` est vrai (voir `const user = isSelfProfile ? ... ` plus bas).
 *
 * ⛔ On n invente donc aucun calcul sur une donnee absente : on prend l age
 * quand il est la, et on retombe sur la date UNIQUEMENT dans le cas ou elle
 * arrive encore.
 * @param {object | null | undefined} profil le compte regarde
 * @returns {number | null} annees revolues, ou null si on ne peut pas savoir
 */
const readProfileAge = (profil) => {
  if (typeof profil?.age === 'number' && Number.isFinite(profil.age)) {
    return profil.age;
  }

  const birthdate = parseDate(profil?.birthdate);
  return birthdate ? differenceInYears(new Date(), birthdate) : null;
};

const formatRoleLabel = (roleName) => {
  const normalized = String(roleName || '').trim().toLowerCase();
  if (!normalized) return i18next.t('userDetails.roleLabels.user', 'UTILISATEUR');
  if (normalized.includes('dirigeant')) {
    return i18next.t(
      'userDetails.roleLabels.president',
      'DIRIGEANT',
    );
  }
  if (normalized.includes('entra') || normalized.includes('coach')) {
    return i18next.t(
      'userDetails.roleLabels.coach',
      'Coach / Prof',
    );
  }
  if (normalized.includes('super')) return 'SUPERADMIN';
  if (normalized.includes('authenticated') || normalized.includes('joueur')) {
    return i18next.t(
      'userDetails.roleLabels.player',
      'PRATIQUANT / JOUEUR',
    );
  }
  return String(roleName).toUpperCase();
};

const formatSectionLabel = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  if (['homme', 'male', 'masculin', 'masculine'].includes(normalized)) {
    return i18next.t(
      'userDetails.sectionLabels.male',
      'Masculin',
    );
  }
  if (['female', 'feminin', 'feminine', 'femme'].includes(normalized)) {
    return i18next.t(
      'userDetails.sectionLabels.female',
      'Feminin',
    );
  }
  if (['mixed', 'mixte'].includes(normalized)) {
    return i18next.t(
      'userDetails.sectionLabels.mixed',
      'Mixte',
    );
  }
  return String(value);
};

const parseAddressLabel = (address) => {
  if (!address) return '';

  let rawAddress = address;
  if (typeof rawAddress === 'string') {
    rawAddress = safeJsonParse(rawAddress, rawAddress);
    if (typeof rawAddress === 'string') {
      return rawAddress;
    }
  }

  if (typeof rawAddress !== 'object' || Array.isArray(rawAddress)) {
    return '';
  }

  const line = rawAddress.address || rawAddress.label || rawAddress.street || '';
  const postcode = rawAddress.postcode || rawAddress.zipCode || '';
  const city = rawAddress.city || rawAddress.town || '';
  const region = rawAddress.region || '';
  return [line, [postcode, city].filter(Boolean).join(' '), region]
    .filter(Boolean)
    .join(', ');
};

const formatNullableValue = (value, fallback) => {
  if (value === 0) return '0';
  if (value === false) return i18next.t('userDetails.values.no', 'Non');
  if (value === true) return i18next.t('userDetails.values.yes', 'Oui');
  if (value === undefined || value === null) return fallback;
  const asString = String(value).trim();
  return asString || fallback;
};

// FINITIONS8 (point 4) : la taille enregistree est en cm (« 182 ») ou en m (« 1,80 ») ; la fiche
// l'ecrit toujours en metres. Illisible : « Non renseigne », jamais « 182 m » ni « grand m ».
const normalizeHeight = (value, fallback) => formatHeight(value) || fallback;

const normalizeWeight = (value, fallback) => {
  const normalized = formatNullableValue(value, fallback);
  if (normalized === fallback) return fallback;
  return String(normalized).includes('kg') ? normalized : `${normalized} kg`;
};

const toTextLabel = (value) => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object' && !Array.isArray(value)) {
    const nested = value?.name || value?.label || value?.title;
    return typeof nested === 'string' ? nested.trim() : '';
  }
  return String(value).trim();
};

/**
 * Render a themed section card for profile blocks.
 * @param {object} props
 * @param {import('@/theme/types').ApplicationStyle} props.ApplicationStyle
 * @param {import('react').ReactNode} props.children
 * @param {import('@/theme/types').Colors} props.Colors
 * @param {import('@/theme/types').Fonts} props.Fonts
 * @param {import('@/theme/types').Spaces} props.Spaces
 * @param {string} props.title
 * @returns {import('react').ReactElement}
 */
function SectionCard({
  ApplicationStyle,
  children,
  Colors,
  Fonts,
  Spaces,
  title,
}) {
  return (
    <View
      style={[
        ApplicationStyle.card,
        Spaces.padding[16],
        Spaces.gap[12],
        {
          backgroundColor: `${Colors.primary700}73`,
          borderColor: `${Colors.primary500}80`,
        },
      ]}
    >
      <View style={[Spaces.gap[8]]}>
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{title}</Text>
        <View
          style={[
            ApplicationStyle.separator,
            { backgroundColor: `${Colors.primary500}3D` },
          ]}
        />
      </View>
      {children}
    </View>
  );
}

/**
 * Render one profile information row with icon, label and value.
 * @param {object} props
 * @param {import('@/theme/types').Alignments} props.Alignments
 * @param {import('@/theme/types').Colors} props.Colors
 * @param {import('@/theme/types').Fonts} props.Fonts
 * @param {boolean} [props.fullWidth]
 * @param {any} props.icon
 * @param {string} props.label
 * @param {import('@/theme/types').Spaces} props.Spaces
 * @param {string} props.value
 * @param {boolean} [props.compact]
 * @returns {import('react').ReactElement}
 */
function InfoItem({
  Alignments,
  Colors,
  compact = false,
  Fonts,
  fullWidth = false,
  icon,
  label,
  Spaces,
  value,
}) {
  const normalizedValue = String(value || '').trim().toLowerCase();
  const isPlaceholder = (
    !normalizedValue
    || normalizedValue === '-'
    || normalizedValue === 'non renseigne'
    || normalizedValue === 'non renseigné'
    // I18N-1 : le repli affiche se reconnait aussi dans la langue de l'app.
    || normalizedValue === String(i18next.t('userDetails.notSet', 'Non renseigné'))
      .trim()
      .toLowerCase()
  );
  const valueLines = fullWidth || compact ? 2 : 1;

  return (
    <View
      style={[
        Alignments.row,
        Alignments.alignStart,
        Spaces.gap[12],
        {
          marginBottom: compact ? 16 : 20,
          minHeight: compact ? 54 : 60,
          paddingRight: 6,
          width: fullWidth ? '100%' : '48%',
        },
      ]}
    >
      <View
        style={[
          Alignments.justifyCenter,
          Alignments.alignCenter,
          {
            backgroundColor: `${Colors.primary700}BF`,
            borderColor: `${Colors.primary500}80`,
            borderRadius: compact ? 18 : 20,
            borderWidth: 1,
            height: compact ? 36 : 40,
            width: compact ? 36 : 40,
          },
        ]}
      >
        <Image
          source={icon}
          style={{
            height: compact ? 16 : 18,
            tintColor: Colors.primary500,
            width: compact ? 16 : 18,
          }}
        />
      </View>
      <View style={[Spaces.gap[4], { flex: 1 }]}>
        <Text style={[Fonts.p2, Fonts.neutral200]}>{label}</Text>
        <Text
          numberOfLines={valueLines}
          style={[
            isPlaceholder ? Fonts.p2 : Fonts.p1Bold,
            isPlaceholder ? Fonts.neutral300 : Fonts.neutral00,
          ]}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

/**
 * User profile view component for displaying profile details.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} User profile screen
 */
function UserDetails({ navigation, route }) {
  const routeUserId = route?.params?.userId;
  // D39 — « Voir mon profil comme les autres ». L'apercu emprunte CE rendu, le
  // meme que voient les autres : c'est la seule facon de ne pas mentir. Les
  // donnees viennent toujours du profil courant (aucune requete de plus), mais
  // l'AFFICHAGE bascule en mode public — d'ou `isOwnerView` plus bas.
  const isPreview = route?.params?.preview === true;
  const { width: screenWidth } = useWindowDimensions();
  const { t } = useTranslation();
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Images,
    Spaces,
  } = useTheme();
  const {
    isParentMode,
    refetchUserData,
    USER_ROLES,
    userData: currentUser,
  } = useAuth();
  const { startGroupChat, startWhisperChat } = useMessaging();
  const insets = useSafeAreaInsets();

  const currentUserId = toComparableId(currentUser?.documentId || currentUser?.id);
  const requestedUserId = toComparableId(routeUserId);
  const isSelfProfile = !requestedUserId || requestedUserId === currentUserId;
  // `isSelfProfile` decide de la SOURCE des donnees ; `isOwnerView` decide de
  // ce qu'on MONTRE. Les deux etaient confondus : en mode apercu, l'un reste
  // vrai (on lit son propre profil, sans requete) pendant que l'autre devient
  // faux (on ne montre rien de prive).
  const isOwnerView = isSelfProfile && !isPreview;
  // A18 — l'APERCU de son propre profil : un bandeau le dit, et aucune action
  // d'edition n'y survit (l'historique suivait encore `isSelfProfile`).
  const isSelfPreview = isSelfProfile && isPreview;
  const targetUserId = requestedUserId || currentUserId;

  const {
    data: fetchedUser,
    error: fetchedUserError,
    isLoading: fetchedUserLoading,
    refetch: refetchFetchedUser,
  } = useGetUserById(targetUserId, {
    enabled: Boolean(targetUserId) && !isSelfProfile,
  });

  const user = isSelfProfile ? currentUser : fetchedUser;

  // PARENT-RETOURS (Adel, 30/09, « parent B ») — le parent DECLARE d'un MINEUR.
  // Lu sur le profil public que rend le serveur (`parentAccount`, `age`) : ce
  // n'est qu'une facon de ne pas proposer ce qui serait refuse — le vrai juge est
  // le serveur (`getPersonalStats` relit le lien et l'age en base). Age inconnu :
  // la minorite ne se prouve pas, rien ne s'ouvre.
  const profileAge = readProfileAge(user);
  const isParentOfMinorViewer = !isSelfProfile
    && Boolean(currentUserId)
    && toComparableId(user?.parentAccount?.documentId) === currentUserId
    && typeof profileAge === 'number'
    && profileAge < PARENTAL_POWER_ENDS_AGE;
  // A19 — « Suivi › Retours du coach » ouvre cette vue-ci, sur la route du
  // profil (le site la sert deja : aucune route neuve a declarer). Proprietaire,
  // ou parent declare d'un mineur (PARENT-RETOURS) : ni un tiers ni l'apercu ne
  // l'obtiennent — et le serveur leur refuse ces donnees (`getPersonalStats` : 403).
  const isCoachFeedbackView = (isOwnerView || isParentOfMinorViewer)
    && route?.params?.view === 'coachFeedback';
  // ST-VUES (planche 16, etats 4 et 5) — « Suivi › Mes stats » et « Tout voir » de
  // « Ma saison » ouvrent la page « Mes stats », sur la route du profil, comme les
  // retours du coach : aucune route neuve. Le proprietaire seulement.
  const isMyStatsView = isOwnerView && route?.params?.view === 'myStats';

  const { refetch: refetchOwnHistories } = useGetMyHistories({
    enabled: isSelfProfile,
  });

  const { refetch: refetchTargetHistories } = useGetUserHistories(targetUserId, {
    enabled: Boolean(targetUserId) && !isSelfProfile,
  });

  const profileError = isSelfProfile ? undefined : fetchedUserError?.message;
  const isProfileLoading = isSelfProfile ? !currentUser : fetchedUserLoading;
  const {
    data: personalStats,
    error: personalStatsError,
    isLoading: isPersonalStatsLoading,
    refetch: refetchPersonalStats,
  } = useGetPersonalStats(targetUserId, {
    enabled: Boolean(targetUserId),
  });
  const {
    data: currentLicenseAssignment,
    refetch: refetchCurrentLicense,
  } = useUserCurrentLicense(targetUserId, {
    enabled: Boolean(targetUserId) && !isSelfProfile,
    retry: false,
  });

  const displayName = useMemo(() => {
    const first = String(user?.firstname || '').trim();
    const last = String(user?.lastname || '').trim();
    if (first || last) return `${first} ${last}`.trim();
    if (user?.username) return String(user.username);
    if (user?.phoneNumber) return String(user.phoneNumber);
    return t('common.user', 'Utilisateur');
  }, [t, user?.firstname, user?.lastname, user?.phoneNumber, user?.username]);

  const canContactByRole = useMemo(() => {
    if (!currentUser || !user || isSelfProfile) return false;
    const roleName = String(currentUser?.role?.name || '').toLowerCase();
    const coachRole = String(USER_ROLES.coach || '').toLowerCase();
    const presidentRole = String(USER_ROLES.president || '').toLowerCase();
    return roleName === coachRole || roleName === presidentRole;
  }, [USER_ROLES.coach, USER_ROLES.president, currentUser, isSelfProfile, user]);

  // 🚫 BLOQUER (K3) — LE GESTE N'EST PAS RESERVE AUX ENCADRANTS.
  // « Contacter » l'est (seuls un entraîneur ou un dirigeant écrivent en
  // premier) ; bloquer ne peut pas l'être — un joueur qui reçoit des messages
  // déplacés doit pouvoir se protéger. Apple 1.2 et Google Play l'exigent pour
  // TOUT utilisateur.
  // STATS-FIX2 · 8-22 (T10, ecran 22) — sauf sur la fiche de SON enfant mineur : le parent ne
  // « bloque » pas son enfant (le lien parent se retire depuis « Mes enfants »).
  const canBlock = Boolean(
    currentUser && user && !isSelfProfile && targetUserId && !isParentOfMinorViewer,
  );
  const { data: myBlockedRows } = useGetMyBlockedUsers({ enabled: canBlock });
  const isTargetBlocked = useMemo(
    () => toBlockedUserIdSet(myBlockedRows).has(String(targetUserId || '').trim()),
    [myBlockedRows, targetUserId],
  );
  const { isPending: isBlocking, mutate: blockTargetUser } = useBlockUser();
  const { isPending: isUnblocking, mutate: unblockTargetUser } = useUnblockUser();

  // Une personne bloquée ne se contacte plus : le serveur refuserait de toute
  // façon, autant ne pas montrer un bouton qui mène à une erreur.
  const canContact = canContactByRole && !isTargetBlocked;

  const handleBlockUser = useCallback(() => {
    if (!targetUserId) return;
    Alert.alert(
      t('userBlock.confirm.title', 'Bloquer cette personne ?'),
      t('userBlock.confirm.message', {
        defaultValue: '{{name}} ne pourra plus t’écrire ni ouvrir de discussion avec toi, et tu ne verras plus ses messages.',
        name: displayName,
        ...SANS_ECHAPPEMENT,
      }),
      [
        { style: 'cancel', text: t('userBlock.confirm.cancel', 'Annuler') },
        {
          onPress: () => blockTargetUser(targetUserId),
          style: 'destructive',
          text: t('userBlock.confirm.block', 'Bloquer'),
        },
      ],
    );
  }, [blockTargetUser, displayName, t, targetUserId]);

  const handleUnblockUser = useCallback(() => {
    if (!targetUserId) return;
    unblockTargetUser(targetUserId);
  }, [targetUserId, unblockTargetUser]);

  const isCompactScreen = screenWidth <= 375;
  // FINITIONS8 (tournee 9, point 3) — le pied « Contacter / Bloquer » recouvrait « Historique
  // sportif » : la place reservee sous le defilement etait un nombre fixe (128), plus court que
  // le pied a deux boutons. Elle suit desormais la hauteur MESUREE du pied (`onLayout`) ; le
  // nombre fixe ne sert plus qu'au premier affichage, avant la mesure.
  // Test : __tests__/UserDetails.FINITIONS8.pied.test.js.
  const [footerHeight, setFooterHeight] = useState(0);
  const handleFooterLayout = useCallback((/** @type {any} */ event) => {
    setFooterHeight(Math.ceil(Number(event?.nativeEvent?.layout?.height) || 0));
  }, []);
  const scrollBottomPadding = canContact || canBlock
    ? Math.max(footerHeight + 16, insets.bottom + 128)
    : insets.bottom + 24;

  const birthdate = parseDate(user?.birthdate);
  const age = readProfileAge(user);
  const roleLabel = formatRoleLabel(user?.role?.name);
  // D54 — le pack fait de la separation des roles un CONTRAT de recette : les
  // blocs joueur (stats de match, poste, section, categorie, taille, poids)
  // sont un « heritage joueur » qui ne doit JAMAIS etre atteignable sur un
  // profil d'entraineur — un coach n'a ni poste ni taille de jeu, et les
  // afficher publie des donnees qui ne le concernent pas.
  // On coupe par le ROLE DU COMPTE REGARDE, jamais en supprimant les
  // composants : ils servent toujours aux joueurs.
  const showsPlayerBlocks = getUserRoleKey(user?.role?.type || user?.role?.name) === 'player';
  const sectionLabel = formatSectionLabel(user?.section?.name);
  const fallbackValue = t('userDetails.notSet', 'Non renseigné');
  const preferredSportValue = toTextLabel(user?.preferredSport);
  const bestLevelValue = toTextLabel(user?.bestLevel);

  const addressLabel = useMemo(() => parseAddressLabel(user?.address), [user?.address]);
  // A19 — la liste ENTIERE (le serveur en rend 10 au plus) : c'est ce nombre
  // que la ligne « Suivi › Retours du coach » annonce, sa vue doit le tenir.
  // Le bloc proprietaire plus bas en garde toujours les 5 premiers.
  const coachFeedback = useMemo(() => {
    if (Array.isArray(personalStats?.recentCoachFeedback)) {
      return personalStats.recentCoachFeedback;
    }
    if (Array.isArray(personalStats?.coachComments)) {
      return personalStats.coachComments;
    }
    return [];
  }, [personalStats?.coachComments, personalStats?.recentCoachFeedback]);
  const recentCoachFeedback = useMemo(() => coachFeedback.slice(0, 5), [coachFeedback]);

  // ST-RETOURS (02/10, planche 19) — « NOUVEAU » : ce que le LECTEUR a deja lu, range sur
  // SON compte (moi, ou le parent pour son enfant).
  // STATS-FIX2 · point 7 (T10) — « LU » = CE QUI A ETE AFFICHE, ECRIT EN QUITTANT L ECRAN.
  // Avant : `PUT …/coach-feedback-follow` partait SEUL a l ouverture (une lecture qui ecrit), et
  // « Retours du coach » marquait lus meme les retours jamais montres (sous le pli). Maintenant :
  //   · « Nouveau » se fige a la PREMIERE lecture, pour toute la visite — la fiche de l enfant
  //     PUIS « Tous ses retours », c est le meme ecran : le dernier retour y garde sa pastille ;
  //   · on retient chaque retour REELLEMENT affiche : la carte « Dernier retour » de la fiche,
  //     et dans la vue, chaque carte dont le milieu est passe a l ecran ;
  //   · on ecrit UNE fois, en quittant (l ecran perd le premier plan, ou se demonte).
  // La planche n a pas de geste « marquer lu ».
  const {
    data: coachFeedbackFollow,
    isSuccess: isCoachFeedbackFollowLoaded,
  } = useGetCoachFeedbackFollow({
    enabled: Boolean(targetUserId) && (isCoachFeedbackView || isParentOfMinorViewer),
  });
  const { mutate: saveCoachFeedbackFollow } = useUpdateCoachFeedbackFollow();
  const [feedbackNewKeysAtOpen, setFeedbackNewKeysAtOpen] = useState(
    /** @type {{ keys: Set<string>, target: string } | null} */ (null),
  );
  const openedFeedbackNewKeys = feedbackNewKeysAtOpen?.target === targetUserId
    ? feedbackNewKeysAtOpen.keys
    : null;
  useEffect(() => {
    if (!(isCoachFeedbackView || isParentOfMinorViewer) || openedFeedbackNewKeys) return;
    if (!isCoachFeedbackFollowLoaded || !personalStats || !targetUserId) return;
    setFeedbackNewKeysAtOpen({
      keys: newFeedbackKeys(coachFeedback, seenFeedbackKeys(coachFeedbackFollow, targetUserId)),
      target: targetUserId,
    });
  }, [
    coachFeedback,
    coachFeedbackFollow,
    isCoachFeedbackFollowLoaded,
    isCoachFeedbackView,
    isParentOfMinorViewer,
    openedFeedbackNewKeys,
    personalStats,
    targetUserId,
  ]);
  // Les retours nouveaux REELLEMENT affiches, par joueur, en attente d etre ecrits.
  const displayedFeedbackRef = useRef(/** @type {Map<string, Set<string>>} */ (new Map()));
  const markFeedbackDisplayed = useCallback((/** @type {string[]} */ keys) => {
    if (!openedFeedbackNewKeys || !targetUserId) return;
    const pending = displayedFeedbackRef.current.get(targetUserId) || new Set();
    keys.forEach((key) => {
      if (openedFeedbackNewKeys.has(String(key))) pending.add(String(key));
    });
    if (pending.size) displayedFeedbackRef.current.set(targetUserId, pending);
  }, [openedFeedbackNewKeys, targetUserId]);
  useEffect(() => {
    const ecrireCeQuiAEteVu = () => {
      displayedFeedbackRef.current.forEach((keys, playerDocumentId) => {
        if (keys.size) saveCoachFeedbackFollow({ playerDocumentId, seenKeys: Array.from(keys) });
      });
      displayedFeedbackRef.current = new Map();
    };
    const unsubscribe = navigation?.addListener?.('blur', ecrireCeQuiAEteVu);
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
      ecrireCeQuiAEteVu();
    };
  }, [navigation, saveCoachFeedbackFollow]);

  // ST-RETOURS (02/10, planche 22 etat 2) — LA FICHE DE L ENFANT, VUE PAR SON PARENT : le
  // DERNIER retour de l entraineur, directement. « Nouveau » s il ne l a pas encore vu ; CE
  // retour-la (et lui seul : c est le seul affiche) sera marque lu en quittant la fiche.
  const latestFeedback = coachFeedback[0] || null;
  const latestFeedbackWasNew = Boolean(
    openedFeedbackNewKeys?.has(String(latestFeedback?.feedbackKey || '')),
  );
  const showsParentLatestFeedback = isParentOfMinorViewer && !isCoachFeedbackView;
  useEffect(() => {
    if (showsParentLatestFeedback && latestFeedback?.feedbackKey) {
      markFeedbackDisplayed([latestFeedback.feedbackKey]);
    }
  }, [latestFeedback?.feedbackKey, markFeedbackDisplayed, showsParentLatestFeedback]);

  // Dans la vue « Retours du coach » : une carte est affichee quand son milieu passe a l ecran
  // (ce que la liste mesure : la hauteur de l ecran, le defilement, la place de chaque carte).
  const feedbackViewportRef = useRef({ height: 0, y: 0 });
  const feedbackCardBoxesRef = useRef(/** @type {Map<string, { height: number, y: number }>} */ (
    new Map()
  ));
  const recordVisibleFeedback = useCallback(() => {
    const { height, y } = feedbackViewportRef.current;
    if (!height) return;
    const visibles = [];
    feedbackCardBoxesRef.current.forEach((box, key) => {
      const milieu = box.y + (box.height / 2);
      if (milieu >= y && milieu <= y + height) visibles.push(key);
    });
    markFeedbackDisplayed(visibles);
  }, [markFeedbackDisplayed]);
  const handleFeedbackCardLayout = useCallback((item, layout) => {
    const key = String(item?.feedbackKey || '');
    if (!key) return;
    feedbackCardBoxesRef.current.set(key, { height: layout?.height || 0, y: layout?.y || 0 });
    recordVisibleFeedback();
  }, [recordVisibleFeedback]);
  useEffect(() => {
    recordVisibleFeedback();
  }, [recordVisibleFeedback]);
  // L alerte du parent : allumee par defaut, coupee d un geste. Le choix s affiche tout de
  // suite ; un refus du serveur le remet comme avant.
  const [childAlertOverride, setChildAlertOverride] = useState(
    /** @type {boolean | null} */ (null),
  );
  const childAlertOn = childAlertOverride
    ?? wantsChildFeedbackAlert(coachFeedbackFollow, targetUserId);
  const handleChildAlertChange = useCallback((/** @type {boolean} */ notify) => {
    setChildAlertOverride(notify);
    saveCoachFeedbackFollow(
      { notify, playerDocumentId: targetUserId },
      { onError: () => setChildAlertOverride(null) },
    );
  }, [saveCoachFeedbackFollow, targetUserId]);

  const coachedTeams = useMemo(() => {
    const teams = Array.isArray(user?.trainedTeams) ? user.trainedTeams : [];
    const seen = new Set();
    return teams.filter((team) => {
      const key = toComparableId(team?.documentId || team?.id || team?.name);
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [user?.trainedTeams]);

  const coachedTeamIds = useMemo(
    () => new Set(
      coachedTeams
        .map((team) => toComparableId(team?.documentId || team?.id || team?.name))
        .filter(Boolean),
    ),
    [coachedTeams],
  );

  const playerTeams = useMemo(() => {
    const teams = Array.isArray(user?.myTeams) ? user.myTeams : [];
    const seen = new Set();
    return teams.filter((team) => {
      const key = toComparableId(team?.documentId || team?.id || team?.name);
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);

      // Avoid showing the same team as both player and coach on profile.
      return !coachedTeamIds.has(key);
    });
  }, [coachedTeamIds, user?.myTeams]);
  const shouldShowTeamsSection = isOwnerView || playerTeams.length > 0 || coachedTeams.length > 0;

  // ST-VUES (planche 17, etat 4) — le squelette de la carte d equipe ne se montre qu a
  // celui qui POURRAIT etre son entraineur : un autre ne verrait qu une forme disparaitre.
  const mayCoachThisPlayer = useMemo(() => {
    if (isSelfProfile) return false;
    const coached = new Set((Array.isArray(currentUser?.trainedTeams) ? currentUser.trainedTeams : [])
      .map((team) => toComparableId(team?.documentId)).filter(Boolean));
    return playerTeams.some((team) => coached.has(toComparableId(team?.documentId)));
  }, [currentUser?.trainedTeams, isSelfProfile, playerTeams]);

  // ST-VUES2 (planche 17) — « Ses retours de match dans la feuille » : la feuille du dernier
  // match du joueur, pour l equipe que le lecteur entraine (elle vit dans la pile des evenements).
  const openMatchSheet = useCallback((/** @type {any} */ target) => {
    navigation.navigate(RouteNames.EventStack, {
      params: {
        eventId: target.eventId,
        sourceType: 'event',
        sport: target.sport || undefined,
        teamId: target.teamId,
        teamName: target.teamName,
      },
      screen: RouteNames.MatchStatsEditor,
    });
  }, [navigation]);

  const handleRefresh = useCallback(() => {
    if (isSelfProfile) {
      refetchUserData?.();
      refetchOwnHistories?.();
      refetchPersonalStats?.();
      return;
    }
    refetchFetchedUser();
    refetchTargetHistories?.();
    refetchPersonalStats?.();
    refetchCurrentLicense?.();
  }, [
    refetchCurrentLicense,
    isSelfProfile,
    refetchFetchedUser,
    refetchOwnHistories,
    refetchPersonalStats,
    refetchTargetHistories,
    refetchUserData,
  ]);

  // 🚧 BLOQUER — un 403 du serveur ne doit pas partir en promesse non
  // rattrapee. Le cas neuf : la personne EN FACE m a bloque (je ne le sais pas,
  // et c est voulu). Le cas qui existait deja et qui n etait pas rattrape non
  // plus : la porte de l abonnement. Un seul filet pour les deux.
  const notifyContactFailure = useCallback((error) => {
    const code = String(
      error?.details?.code
      || error?.response?.data?.error?.details?.code
      || error?.code
      || '',
    ).trim();

    // 🧒 CONVAVERT — LE REFUS D UN MINEUR DIT POURQUOI, ET DANS LE BON SENS.
    //
    // Le serveur sait QUI demande : il envoie « Tu ne peux écrire qu'aux
    // encadrants de ton club. » à l'ado, et une phrase différente à l'adulte
    // qui voulait le joindre (`admin/src/api/chat/services/minor-chat-guard.ts`).
    // On la préfère donc au repli, qui ne sait pas de quel côté du refus on est.
    //
    // ⚠️ SANS CETTE BRANCHE, LE REFUS EST MUET : `getErrorMessage` ne recopie le
    // message du serveur que sous `__DEV__`, et retombe sinon sur le statut 403,
    // c'est-à-dire « Accès refusé. » — le refus perdait sa raison en chemin.
    const minorRefusalMessage = String(
      error?.response?.data?.error?.message
      || error?.details?.message
      || '',
    ).trim();

    let contactFailureBody;
    if (code === 'CHAT_BLOCKED_BETWEEN_USERS') {
      contactFailureBody = t(
        'userBlock.errors.blocked',
        'Tu as bloqué cette personne. Débloque-la pour lui réécrire.',
      );
    } else if (code === 'MINOR_DIRECT_CHAT_FORBIDDEN') {
      contactFailureBody = minorRefusalMessage || t(
        'APIerrors.MINOR_DIRECT_CHAT_FORBIDDEN',
        "Discussion privée impossible : un mineur ne peut échanger en privé qu'avec son parent "
        + 'ou les encadrants de son club.',
      );
    } else {
      contactFailureBody = getErrorMessage(error);
    }

    Alert.alert(t('common.errors.error', 'Erreur'), contactFailureBody);
  }, [t]);

  const handleContactUser = async () => {
    if (!user || !currentUser) return;

    // ⚠️ Le repli reste 18 : un age inconnu ne doit PAS ouvrir la voie du
    // contact direct par erreur, il doit se comporter comme un adulte
    // (comportement d avant SECU-2, conserve tel quel). `profileAge` = celui du composant
    // (meme `readProfileAge(user)`, pose par PARENT-RETOURS), plus de seconde lecture.
    const computedAge = typeof profileAge === 'number' ? profileAge : 18;

    if (computedAge < 13) {
      if (user.parentAccount?.documentId) {
        const participants = [user.documentId, user.parentAccount.documentId];
        try {
          const newChat = isGroupChatEnabled
            ? await startGroupChat({
              groupName: 'Contact mineur',
              participants,
            })
            : await startWhisperChat(participants);
          if (newChat?.documentId) {
            navigation.navigate(RouteNames.Conversation, { chatId: newChat.documentId });
          }
        } catch (error) {
          notifyContactFailure(error);
        }
        return;
      }

      Alert.alert(
        t('common.errors.error', 'Erreur'),
        t(
          'userDetails.errors.minorNoParent',
          "Impossible de contacter ce joueur mineur car aucun compte parent n'est lie.",
        ),
      );
      return;
    }

    // B6 — LE SERVEUR PEUT REFUSER, ET UN REFUS DOIT SE VOIR.
    //
    // Depuis le lot ENFANTS, la creation d un fil seul a seul est arbitree par
    // le serveur (`admin/src/api/chat/services/minor-chat-guard.ts`) : moins de
    // 13 ans sans le compte du parent, ou age inconnu, et il repond 403 avec sa
    // raison en francais. Sans ce filet, le rejet remontait dans le vide : le
    // bouton << Contacter >> ne faisait RIEN, sans un mot -- exactement le
    // cul-de-sac que la methode interdit.
    try {
      const newChat = await startWhisperChat([user.documentId]);
      if (newChat?.documentId) {
        navigation.navigate(RouteNames.Conversation, { chatId: newChat.documentId });
      }
    } catch (error) {
      notifyContactFailure(error);
    }
  };

  const handleOpenLicense = useCallback(() => {
    const assignmentId = currentLicenseAssignment?.documentId || currentLicenseAssignment?.id;
    if (!assignmentId) return;
    navigation.navigate(RouteNames.ClubLicenseMemberDetail, {
      assignmentId,
      routeScope: 'coach',
    });
  }, [currentLicenseAssignment?.documentId, currentLicenseAssignment?.id, navigation]);

  // ST-RETOURS (planche 19) — « Ouvrir le match » mene a la fiche, sur le retour du coach
  // (meme destination que la notification « Retour du coach disponible »).
  // STATS-FIX2 · point 1 — le PARENT y entre aussi (« parents encart B ») : la fiche du match
  // seule, sans viser « Mon retour coach », qui est le bloc du joueur ; jamais un match de League.
  const handleOpenFeedbackMatch = useCallback((item) => {
    const sourceId = item?.sourceDocumentId;
    if (!sourceId) return;
    if (isParentOfMinorViewer) {
      if (!parentCanOpenMatch(item)) return;
      navigation.navigate(RouteNames.EventStack, {
        params: { eventId: sourceId },
        screen: RouteNames.EventDetails,
      });
      return;
    }
    if (item?.sourceType === 'league_match') {
      navigation.navigate(RouteNames.LeagueMatchDetails, {
        focusSection: 'coachFeedback',
        matchId: sourceId,
      });
      return;
    }
    navigation.navigate(RouteNames.EventStack, {
      params: { eventId: sourceId, focusSection: 'coachFeedback' },
      screen: RouteNames.EventDetails,
    });
  }, [isParentOfMinorViewer, navigation]);

  const handleOpenClub = () => {
    if (!user?.club?.documentId) return;
    navigation.navigate(RouteNames.ClubStack, {
      params: { clubId: user.club.documentId },
      screen: RouteNames.Club,
    });
  };

  const handleTeamPress = (team) => {
    const teamId = team?.documentId || team?.id;
    if (!teamId) return;
    navigation.navigate(RouteNames.TeamStack, {
      params: { teamId },
      screen: RouteNames.TeamDetails,
    });
  };

  // A19 — LA VUE « RETOURS DU COACH ». Avant, la ligne ouvrait l'APERCU, la
  // seule page d'ou les retours sont retires (ils sont prives), et le bloc
  // proprietaire plus bas n'etait plus atteint par un joueur depuis D39.
  // Placee APRES tous les hooks, comme l'aiguillage qui suit.
  // ST-VUES — LA PAGE « MES STATS ». Placee apres tous les hooks, comme la vue
  // des retours du coach qui la suit.
  if (isMyStatsView) {
    return (
      <ScreenContainer
        bgImage="bg2"
        contentContainerStyle={[Spaces.gap[16], Spaces.paddingBottom[0], Alignments.column, Alignments.fill]}
      >
        <Text style={[Fonts.h3Bold, Fonts.neutral00, { alignSelf: 'stretch', textAlign: 'center' }]}>
          {t('myStats.pageTitle', 'Mes stats').toUpperCase()}
        </Text>
        <ScrollView
          contentContainerStyle={[{ paddingBottom: insets.bottom + 24 }]}
          refreshControl={(
            <RefreshControl
              onRefresh={() => refetchPersonalStats?.()}
              refreshing={isPersonalStatsLoading}
            />
          )}
          showsVerticalScrollIndicator={false}
          style={[Alignments.fill]}
        >
          <WithDataWrapper
            error={personalStatsError ? getErrorMessage(personalStatsError) : undefined}
            isLoading={isPersonalStatsLoading}
            onRetry={() => refetchPersonalStats?.()}
          >
            <MyStatsPage onOpenTeam={handleTeamPress} stats={personalStats} teams={playerTeams} />
          </WithDataWrapper>
        </ScrollView>
      </ScreenContainer>
    );
  }

  if (isCoachFeedbackView) {
    return (
      <ScreenContainer
        bgImage="bg2"
        contentContainerStyle={[
          Spaces.gap[24],
          Spaces.paddingBottom[0],
          Alignments.column,
          Alignments.fill,
        ]}
      >
        <View
          style={[
            Alignments.justifyCenter,
            Alignments.alignCenter,
            Spaces.gap[8],
            Spaces.marginTop[8],
          ]}
        >
          {/* Etire et centre : un titre gras de plusieurs mots dans une boite a
              sa largeur mesuree perd son dernier mot sur Android 16. */}
          <Text
            style={[
              Fonts.h3Bold,
              Fonts.neutral00,
              { alignSelf: 'stretch', textAlign: 'center' },
            ]}
          >
            {t('userDetails.sections.coachFeedback', 'Retours du coach').toUpperCase()}
          </Text>
          <View
            style={[
              ApplicationStyle.separator,
              ApplicationStyle.backgroundColor.neutral00,
              { width: 88 },
            ]}
          />
          {/* PARENT-RETOURS — les retours de QUI : un parent de deux enfants
              doit le lire sans deviner. ST-RETOURS (planche 22, etat 3) :
              « pour Hugo Lemaire ». */}
          {!isSelfProfile ? (
            <Text style={[Fonts.p2, Fonts.neutral200, Fonts.textCenter]}>
              {t('stRetours.parent.forChild')}
              {' '}
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{displayName}</Text>
            </Text>
          ) : null}
        </View>

        <ScrollView
          contentContainerStyle={[{ paddingBottom: insets.bottom + 24 }]}
          onLayout={(event) => {
            feedbackViewportRef.current.height = event?.nativeEvent?.layout?.height || 0;
            recordVisibleFeedback();
          }}
          onScroll={(event) => {
            feedbackViewportRef.current.y = event?.nativeEvent?.contentOffset?.y || 0;
            recordVisibleFeedback();
          }}
          refreshControl={(
            <RefreshControl
              onRefresh={() => refetchPersonalStats?.()}
              refreshing={isPersonalStatsLoading}
            />
          )}
          scrollEventThrottle={100}
          showsVerticalScrollIndicator={false}
          style={[Alignments.fill]}
        >
          {/* ST-RETOURS (planche 19) — les etats dessines : chargement en squelette, panne
              dite avec « Reessayer », vide qui dit d ou viennent les retours, puis la liste et
              qui peut la lire. */}
          <CoachFeedbackViewBody
            childFirstname={user?.firstname || displayName}
            hasError={Boolean(personalStatsError)}
            hasParentLink={Boolean(currentUser?.parentAccount?.documentId)}
            isLoading={isPersonalStatsLoading}
            items={coachFeedback}
            newKeys={openedFeedbackNewKeys || undefined}
            onCardLayout={handleFeedbackCardLayout}
            onOpenMatch={handleOpenFeedbackMatch}
            onRetry={() => refetchPersonalStats?.()}
            viewer={isSelfProfile ? 'self' : 'parent'}
          />
        </ScrollView>
      </ScreenContainer>
    );
  }

  // MON profil est rendu par un ecran « voir = modifier », choisi par le ROLE.
  // Le branchement est place APRES tous les hooks : leur ordre reste stable.
  //
  //   - DIRIGEANT  -> `SelfProfileUnified` (lot D06), INCHANGE. C'est le second
  //     temoin d'arret de D39 : elargir ne devait casser personne.
  //   - JOUEUR / ENTRAINEUR -> `SelfProfilePlayerCoach` (lot D39). D06 les avait
  //     volontairement laisses sur le rendu ci-dessous, parce que la soustraction
  //     du pack d'alors leur aurait retire leurs stats, leurs retours du coach et
  //     leurs equipes. Le pack de D39 leur donne une DESTINATION a chacun (stats
  //     en rangee compacte, « Suivi ») : la raison de les exclure a disparu.
  //
  // Restent rendus ci-dessous, inchanges : le profil de QUELQU'UN D'AUTRE avec
  // son masquage « Prive » et ses douze points d'entree — et ce meme rendu en
  // mode APERCU, quand on regarde son propre profil comme le voient les autres.
  // PAR-L12 (13/10, décision D6 A d'Adel du 12/10) — en MODE PARENT (choix d'affichage d'un
  // compte sportif qui a des enfants), « Mon profil » est celui d'un parent : l'écran sportif
  // (« voir = modifier ») revient d'un geste, depuis le bandeau de l'accueil.
  const enModeParent = isOwnerView && isParentMode === true;
  if (isOwnerView && !enModeParent) {
    const selfRoleKey = getUserRoleKey(user?.role?.type || user?.role?.name);
    if (selfRoleKey === 'president') {
      return <SelfProfileUnified navigation={navigation} />;
    }
    if (selfRoleKey === 'player' || selfRoleKey === 'coach') {
      return <SelfProfilePlayerCoach navigation={navigation} />;
    }
  }

  // PAR-L7 (13/10, design parent E03, décision D1 A d'Adel du 12/10) — « MON PROFIL » D'UN
  // PARENT : son identité, SES ENFANTS (`BlocMesEnfants`), ses infos personnelles. Rien de
  // sportif : ni retours du coach (toujours vides pour lui), ni historique, ni profil sportif,
  // ni équipes. Seulement en PROPRIÉTAIRE (`isOwnerView`) : le profil d'un parent vu par
  // quelqu'un d'autre, et son aperçu, ne changent pas.
  const estMonProfilDeParent = enModeParent || (isOwnerView
    && getUserRoleKey(user?.role?.type || user?.role?.name) === 'parent');

  const renderTeamCard = (team, index, prefix = 'team') => (
    <TouchableOpacity
      key={`${prefix}-${String(team?.documentId || team?.id || team?.name || index)}`}
      onPress={() => handleTeamPress(team)}
      style={[
        ApplicationStyle.borderRadius24,
        ApplicationStyle.backgroundColor.primary700,
        Alignments.row,
        Alignments.alignCenter,
        Alignments.justifySpaceBetween,
        Spaces.padding[12],
        Spaces.gap[12],
      ]}
    >
      <View style={[Alignments.row, Spaces.gap[12], Alignments.alignCenter, { flex: 1 }]}>
        {/* D65 — le meme blason que partout ailleurs dans l'app : le VRAI logo
            du club si l'equipe en a un, sinon les initiales sur l'ecusson.
            `TeamShield` seul ne sait pas afficher d'image ; `ClubLogoMark`
            arbitre entre les deux, et cet ecran l'utilisait DEJA cent lignes
            plus bas pour le club de l'utilisateur (l. 797). Le nom sert au
            repli : celui du CLUB d'abord, comme `TeamListContent.js:540`. */}
        <ClubLogoMark
          club={team?.club}
          isNeutral
          name={team?.club?.name || team?.name}
          size={60}
        />
        {/* MARQUEE — le nom de l equipe se lit en entier */}
        <MarqueeText
          containerStyle={{ flex: 1 }}
          style={[Fonts.p1Bold, Fonts.neutral00]}
          text={team?.name || fallbackValue}
        />
      </View>
      <Image
        source={Images.arrowRight}
        style={{
          height: 16, marginRight: 8, tintColor: Colors.neutral00, width: 16,
        }}
      />
    </TouchableOpacity>
  );

  // ST-RETOURS2 · point 3 (planche 22, etat 2) — sous le nom de SON enfant, la ligne
  // « 14 ans · U15 · AS Montrivage » : son age, ses equipes (FINITIONS13-STATS 3 : toutes,
  // « U13 · U15 »), son club.
  const ligneDeLEnfant = ligneDIdentite(t, {
    age,
    clubName: user?.club?.name,
    // FINITIONS15 point 9d : chaque equipe sous SON club.
    teams: playerTeams,
  });
  const badgeRechercheDeClub = user?.isLookingForClub ? (
    <View
      style={[
        // Dans la carte centree du parent, le badge se centre avec elle.
        isParentOfMinorViewer ? null : Alignments.selfStart,
        Spaces.paddingHorizontal[12],
        Spaces.paddingVertical[6],
        ApplicationStyle.borderRadius16,
        { backgroundColor: Colors.primary500 },
      ]}
    >
      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
        {t('userDetails.badges.lookingForClub', 'En recherche de club')}
      </Text>
    </View>
  ) : null;

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.gap[24],
        Spaces.paddingBottom[0],
        Alignments.column,
        Alignments.fill,
      ]}
    >
      {/* A18 — l'apercu le DIT : sans ce bandeau, rien ne distinguait la
          vitrine de sa propre page. « Quitter » rend la main au profil.
          Couleurs de la CHARTE seulement (Adel, 30/09 : pas le jaune de la
          maquette de l'audit) : le cyan `primary500`, teinte par `withAlpha`. */}
      {isSelfPreview ? (
        <View
          style={[
            Alignments.row,
            Alignments.alignCenter,
            Spaces.gap[12],
            Spaces.paddingHorizontal[16],
            Spaces.marginTop[8],
            ApplicationStyle.borderRadius16,
            {
              backgroundColor: withAlpha(Colors.primary500, 0.12),
              borderColor: withAlpha(Colors.primary500, 0.4),
              borderWidth: 1,
            },
          ]}
          testID="apercu-bandeau"
        >
          <Text style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>
            {t('userDetails.preview.banner', "Aperçu : c'est ce que voient les autres.")}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => navigation.goBack()}
            style={[Alignments.justifyCenter, { minHeight: 44 }]}
          >
            <Text style={[Fonts.p2Bold, Fonts.primary500]}>
              {t('userDetails.preview.exit', 'Quitter')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <View
        style={[
          Alignments.justifyCenter,
          Alignments.alignCenter,
          Spaces.gap[8],
          Spaces.marginTop[8],
        ]}
      >
        {/* STATS-FIX2 · 8-22 (T10, ecran 22) — la fiche de SON enfant porte son prenom (planche
            22 : « Hugo », et « Mon enfant » sur la carte), pas « INFOS PROFIL · JOUEUR ». */}
        <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
          {isParentOfMinorViewer && user?.firstname
            ? String(user.firstname).toUpperCase()
            : (estMonProfilDeParent
              ? t('profile.titles.unified', 'Mon profil')
              : t('userDetails.title', 'Infos profil')).toUpperCase()}
        </Text>
        <View
          style={[
            ApplicationStyle.separator,
            ApplicationStyle.backgroundColor.neutral00,
            { width: 88 },
          ]}
        />
        {isParentOfMinorViewer ? null : (
          <Text style={[Fonts.p2Bold, Fonts.primary500]}>
            {/* PAR-L12 — en mode parent, le rôle LU est celui de la vue (comme l'accueil). */}
            {enModeParent ? formatRoleLabel('Parent') : roleLabel}
          </Text>
        )}
      </View>

      <ScrollView
        contentContainerStyle={[
          Spaces.gap[24],
          { paddingBottom: scrollBottomPadding },
        ]}
        refreshControl={(
          <RefreshControl
            onRefresh={handleRefresh}
            refreshing={isProfileLoading}
          />
        )}
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        <WithDataWrapper
          error={profileError}
          isLoading={isProfileLoading}
          wrapperStyle={[Spaces.gap[24]]}
        >
          {/* ST-RETOURS2 · point 3 (planche 22, etat 2) — la fiche de SON enfant : la carte
              CENTREE de la planche (l avatar, le nom, « 14 ans · U15 · AS Montrivage », « Mon
              enfant »). Tout autre lecteur garde la carte de tout profil. */}
          {/* CARTECODE Q2 B — la carte d'un AUTRE joueur majeur, au compte non privé. */}
          {!isSelfProfile ? (
            <ProfileCardThumb
              profile={{ ...user, age: profileAge }}
              viewer={currentUserId ? { documentId: currentUserId } : null}
              width={Math.min(screenWidth * 0.62, 260)}
            />
          ) : null}
          {isParentOfMinorViewer ? (
            <ChildIdentityCard
              avatarUrl={user?.avatar?.url}
              enablePreview
              line={ligneDeLEnfant}
              name={displayName}
              testID="parent-child-identity"
            >
              {badgeRechercheDeClub}
            </ChildIdentityCard>
          ) : (
            <View
              style={[
                ApplicationStyle.card,
                Spaces.padding[16],
                Spaces.gap[16],
                {
                  backgroundColor: `${Colors.primary700}73`,
                  borderColor: `${Colors.primary500}80`,
                },
              ]}
            >
              <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[16]]}>
                <ProfileAvatar
                  enablePreview
                  imageStyle={{ borderRadius: 72 }}
                  imageUrl={user?.avatar?.url}
                  name={displayName}
                  size={72}
                  style={[
                    ApplicationStyle.borderColor.primary500,
                    ApplicationStyle.borderWidth1,
                    { borderRadius: 72 },
                  ]}
                />
                <View style={[Spaces.gap[8], { flex: 1, paddingLeft: 2 }]}>
                  <Text numberOfLines={2} style={[Fonts.h4Black, Fonts.neutral00]}>
                    {displayName}
                  </Text>
                  {user?.club?.name ? (
                    <TouchableOpacity
                      onPress={handleOpenClub}
                      style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}
                    >
                      <ClubLogoMark club={user.club} size={60} />
                      {/* MARQUEE — le nom du club se lit en entier */}
                      <MarqueeText
                        containerStyle={{ flex: 1 }}
                        style={[Fonts.p2, Fonts.neutral200]}
                        text={user.club.name}
                      />
                    </TouchableOpacity>
                  ) : (
                    <Text style={[Fonts.p2, Fonts.neutral300]}>
                      {t('userDetails.empty.club', 'Aucun club renseigne')}
                    </Text>
                  )}
                </View>
              </View>

              {badgeRechercheDeClub}
            </View>
          )}

          {estMonProfilDeParent ? <BlocMesEnfants navigation={navigation} toujours /> : null}

          {/* D54 — les stats de match sont un bloc JOUEUR : le pack les
              range en « heritage joueur » et les interdit sur un profil d'entraineur.
              ST-VUES (planche 17, decisions d Adel du 02/10 « profil A » et « b oui ») :
              PRIVEES, sauf pour l entraineur de son equipe, pour CETTE equipe ; mon apercu
              ne montre plus mes chiffres et dit qui les voit. Le serveur decide (scope). */}
          {showsPlayerBlocks ? (
            <ProfileStatsForViewer
              isLoading={isPersonalStatsLoading}
              isSelfPreview={isSelfPreview}
              mayBeCoach={mayCoachThisPlayer}
              onOpenMatchSheet={openMatchSheet}
              stats={personalStats}
            />
          ) : null}

          {/* Les retours du coach sont PRIVES : jamais sur une vue publique,
              donc jamais dans l'apercu non plus (pack, regle « vie privee »). */}
          {isOwnerView && !estMonProfilDeParent ? (
            <SectionCard
              ApplicationStyle={ApplicationStyle}
              Colors={Colors}
              Fonts={Fonts}
              Spaces={Spaces}
              title={t('userDetails.sections.coachFeedback', 'Retours du coach')}
            >
              <CoachFeedbackList items={recentCoachFeedback} />
            </SectionCard>
          ) : null}

          {/* PARENT-RETOURS — le parent declare d'un mineur lit les retours du coach de son
              enfant. ST-RETOURS (planche 22, etats 2 et 4) : le DERNIER retour directement sur
              la fiche (le lien seul cachait ce que le parent vient chercher), « Tous ses
              retours · n » vers la vue (meme ecran, meme `CoachFeedbackList`), l alerte, et ce
              qu il lit — jamais les messages ni les propres notes de l enfant. */}
          {isParentOfMinorViewer ? (
            <View style={[Spaces.gap[16]]} testID="parent-child-feedback">
              {latestFeedback ? (
                <View style={feedbackCardStyle(Colors, Boolean(latestFeedbackWasNew))}>
                  <View style={[Alignments.row, Alignments.alignCenter, { gap: 12 }]}>
                    <Text
                      style={[
                        Fonts.p3Bold,
                        Fonts.primary200,
                        { flex: 1, letterSpacing: 0.4, textTransform: 'uppercase' },
                      ]}
                    >
                      {t('stRetours.parent.latestTitle')}
                    </Text>
                    {latestFeedbackWasNew ? <NewPill label={t('stRetours.feedback.new')} /> : null}
                  </View>
                  <Text style={[Fonts.p3, Fonts.neutral300]}>
                    {feedbackMetaLine(t, latestFeedback, 'latest')}
                  </Text>
                  {typeof latestFeedback?.rating === 'number' ? (
                    <Text style={[Fonts.h1Black, Fonts.neutral00]}>
                      {`${latestFeedback.rating}/10`}
                    </Text>
                  ) : null}
                  {latestFeedback?.comment ? <CoachWords text={latestFeedback.comment} /> : null}
                  {/* STATS-FIX2 · point 1 (T10, P4) — la porte du match : le parent y lit
                      l encart du score (« parents encart B »), et rien de plus. */}
                  {parentCanOpenMatch(latestFeedback) ? (
                    <TouchableOpacity
                      accessibilityRole="link"
                      onPress={() => handleOpenFeedbackMatch(latestFeedback)}
                      style={[
                        Alignments.row,
                        Alignments.alignCenter,
                        Alignments.justifySpaceBetween,
                        { minHeight: 44 },
                      ]}
                      testID="parent-child-feedback-open-match"
                    >
                      <Text style={[Fonts.p2Bold, Fonts.primary500]}>
                        {t('stRetours.feedback.openMatch')}
                      </Text>
                      <Image
                        source={Images.arrowRight}
                        style={{ height: 12, tintColor: Colors.primary500, width: 12 }}
                      />
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    accessibilityLabel={t('stRetours.parent.allFeedback', {
                      count: coachFeedback.length,
                    })}
                    accessibilityRole="link"
                    onPress={() => ouvrirUneVueDuProfil(navigation, {
                      userId: targetUserId,
                      view: 'coachFeedback',
                    })}
                    style={[
                      Alignments.row,
                      Alignments.alignCenter,
                      Alignments.justifySpaceBetween,
                      { minHeight: 44 },
                    ]}
                  >
                    <Text style={[Fonts.p2Bold, Fonts.primary500]}>
                      {t('stRetours.parent.allFeedback', { count: coachFeedback.length })}
                    </Text>
                    <Image
                      source={Images.arrowRight}
                      style={{ height: 12, tintColor: Colors.primary500, width: 12 }}
                    />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={feedbackCardStyle(Colors, false)}>
                  <Text
                    style={[
                      Fonts.p3Bold,
                      Fonts.primary200,
                      { letterSpacing: 0.4, textTransform: 'uppercase' },
                    ]}
                  >
                    {t('stRetours.parent.emptyTitle')}
                  </Text>
                  <Text style={[Fonts.p2, Fonts.neutral200]}>
                    {t('stRetours.parent.emptyHint')}
                  </Text>
                </View>
              )}

              <View
                style={[
                  Alignments.row,
                  Alignments.alignCenter,
                  {
                    backgroundColor: withAlpha(Colors.neutral00, 0.04),
                    borderColor: withAlpha(Colors.neutral00, 0.09),
                    borderRadius: 16,
                    borderWidth: 1,
                    gap: 12,
                    minHeight: 52,
                    paddingHorizontal: 14,
                  },
                ]}
              >
                <Text style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>
                  {t('stRetours.parent.alertLabel')}
                </Text>
                <Switch
                  accessibilityLabel={t('stRetours.parent.alertLabel')}
                  accessibilityRole="switch"
                  onValueChange={handleChildAlertChange}
                  thumbColor={Colors.neutral00}
                  trackColor={{ false: Colors.neutral600, true: Colors.primary500 }}
                  value={childAlertOn}
                />
              </View>

              <WhoCanReadLine text={t('stRetours.parent.privacy')} />
            </View>
          ) : null}

          {/* A18 — `isOwnerView`, pas `isSelfProfile` : en APERCU on lit son
              propre compte (d'ou `userId` ci-dessous, inchange), mais on
              montre ce que voient les autres. Corbeilles, « + Ajouter » et
              appui pour modifier y restaient actifs — et marchaient. */}
          {estMonProfilDeParent ? null : (
            <UserHistorySection
              bestLevel={bestLevelValue || undefined}
              isOwnProfile={isOwnerView}
              // D40 marche 3 — ces deux boutons vivent DANS la liste : ils
              // doivent y ramener. Ils annoncaient `Profile`, donc on ajoutait
              // depuis sa liste et on atterrissait ailleurs — il fallait
              // retraverser pour en ajouter une seconde.
              onAddPress={
                isOwnerView
                  ? () => navigation.navigate(RouteNames.HistoryWizardCategory, {
                    resetContext: true,
                    returnRoute: RouteNames.UserDetails,
                  })
                  : undefined
              }
              onEditPress={
                isOwnerView
                  ? (entry) => navigation.navigate(RouteNames.HistoryWizardCategory, {
                    editingEntry: entry,
                    returnRoute: RouteNames.UserDetails,
                  })
                  : undefined
              }
              preferredSport={preferredSportValue || undefined}
              userId={isSelfProfile ? undefined : targetUserId}
            />
          )}

          {estMonProfilDeParent ? null : (
            <SectionCard
              ApplicationStyle={ApplicationStyle}
              Colors={Colors}
              Fonts={Fonts}
              Spaces={Spaces}
              title={t('userDetails.sections.sport', 'Profil sportif')}
            >
              <View style={[Alignments.row, Alignments.wrap, Alignments.justifySpaceBetween]}>
                <InfoItem
                  Alignments={Alignments}
                  Colors={Colors}
                  compact={isCompactScreen}
                  Fonts={Fonts}
                  icon={Images.running}
                  label={t('userDetails.fields.sport', 'Sport')}
                  Spaces={Spaces}
                  value={formatNullableValue(preferredSportValue, fallbackValue)}
                />
                <InfoItem
                  Alignments={Alignments}
                  Colors={Colors}
                  compact={isCompactScreen}
                  Fonts={Fonts}
                  icon={Images.shield}
                  label={t('userDetails.fields.bestLevel', 'Niveau')}
                  Spaces={Spaces}
                  value={formatNullableValue(bestLevelValue, fallbackValue)}
                />
                {/* D54 — la grille du coach n'est pas vidée, elle est RESTREINTE :
                    le pack lui laisse « Âge, Ville, Sport, Meilleur niveau » et
                    lui retire poste / section / catégorie, qui n'ont pas de sens
                    pour quelqu'un qui ne joue pas. */}
                {showsPlayerBlocks ? (
                  <InfoItem
                    Alignments={Alignments}
                    Colors={Colors}
                    compact={isCompactScreen}
                    Fonts={Fonts}
                    icon={Images.pin}
                    label={t('userDetails.fields.position', 'Poste')}
                    Spaces={Spaces}
                    value={formatNullableValue(user?.position, fallbackValue)}
                  />
                ) : null}
                {showsPlayerBlocks ? (
                  <InfoItem
                    Alignments={Alignments}
                    Colors={Colors}
                    compact={isCompactScreen}
                    Fonts={Fonts}
                    icon={Images.users}
                    label={t('userDetails.fields.section', 'Section')}
                    Spaces={Spaces}
                    value={formatNullableValue(sectionLabel, fallbackValue)}
                  />
                ) : null}
                {showsPlayerBlocks ? (
                  <InfoItem
                    Alignments={Alignments}
                    Colors={Colors}
                    compact={isCompactScreen}
                    Fonts={Fonts}
                    fullWidth
                    icon={Images.edit}
                    label={t('userDetails.fields.category', 'Catégorie')}
                    Spaces={Spaces}
                    value={formatNullableValue(user?.category, fallbackValue)}
                  />
                ) : null}
              </View>
            </SectionCard>
          )}

          <SectionCard
            ApplicationStyle={ApplicationStyle}
            Colors={Colors}
            Fonts={Fonts}
            Spaces={Spaces}
            title={t('userDetails.sections.personal', 'Infos personnelles')}
          >
            <View style={[Alignments.row, Alignments.wrap, Alignments.justifySpaceBetween]}>
              <InfoItem
                Alignments={Alignments}
                Colors={Colors}
                compact={isCompactScreen}
                Fonts={Fonts}
                icon={Images.calendar}
                label={t('userDetails.fields.age', 'Age')}
                Spaces={Spaces}
                value={age === null ? fallbackValue : t('userDetails.fields.ageValue', {
                  count: age,
                  defaultValue_one: '{{count}} ans',
                  defaultValue_other: '{{count}} ans',
                })}
              />
              {/* D54 — LA DATE EXACTE NE SORT JAMAIS D'ICI. Cette page est la
                  vue publique du profil (`PJPublic` / `PEPublic` du pack), et
                  elle est aussi servie sur le WEB a `/users/:userId` : la date
                  de naissance d'un MINEUR y serait lisible par n'importe qui.
                  Le pack donne le remplacant et il est deja rendu juste
                  au-dessus : « date de naissance exacte -> age seul ».
                  Le garde-fou est `isOwnerView`, pas `isSelfProfile` : le
                  premier retombe a faux en mode APERCU, le second non. */}
              {isOwnerView ? (
                <InfoItem
                  Alignments={Alignments}
                  Colors={Colors}
                  compact={isCompactScreen}
                  Fonts={Fonts}
                  icon={Images.calendar}
                  label={t('userDetails.fields.birthdate', 'Date de naissance')}
                  Spaces={Spaces}
                  value={birthdate ? format(birthdate, 'dd/MM/yyyy') : fallbackValue}
                />
              ) : null}
              {showsPlayerBlocks ? (
                <InfoItem
                  Alignments={Alignments}
                  Colors={Colors}
                  compact={isCompactScreen}
                  Fonts={Fonts}
                  icon={Images.check}
                  label={t('userDetails.fields.height', 'Taille')}
                  Spaces={Spaces}
                  value={normalizeHeight(user?.height, fallbackValue)}
                />
              ) : null}
              {showsPlayerBlocks ? (
                <InfoItem
                  Alignments={Alignments}
                  Colors={Colors}
                  compact={isCompactScreen}
                  Fonts={Fonts}
                  icon={Images.check}
                  label={t('userDetails.fields.weight', 'Poids')}
                  Spaces={Spaces}
                  value={normalizeWeight(user?.weight, fallbackValue)}
                />
              ) : null}
              <View
                style={[
                  ApplicationStyle.separator,
                  ApplicationStyle.backgroundColor.primary700,
                  Spaces.marginBottom[12],
                  { opacity: 0.6 },
                ]}
              />
              <InfoItem
                Alignments={Alignments}
                Colors={Colors}
                compact={isCompactScreen}
                Fonts={Fonts}
                fullWidth
                icon={Images.phone}
                label={t('userDetails.fields.phone', 'Téléphone')}
                Spaces={Spaces}
                value={
                  /* D54 — `isOwnerView`, pas `isSelfProfile` : en APERCU on
                     regarde SON PROPRE profil, donc `isSelfProfile` est vrai
                     et le numero reapparaissait. Le bouton s'appelle « Voir
                     mon profil comme les autres » — s'il montre plus que ce
                     que voient les autres, il ment sur la vie privee. */
                  isOwnerView
                    ? formatNullableValue(user?.phoneNumber, fallbackValue)
                    : t('userDetails.private', 'Privé')
                }
              />
              <InfoItem
                Alignments={Alignments}
                Colors={Colors}
                compact={isCompactScreen}
                Fonts={Fonts}
                fullWidth
                icon={Images.envelope}
                label={t('userDetails.fields.email', 'Email')}
                Spaces={Spaces}
                value={
                  isOwnerView
                    ? formatNullableValue(user?.email, fallbackValue)
                    : t('userDetails.private', 'Privé')
                }
              />
              <InfoItem
                Alignments={Alignments}
                Colors={Colors}
                compact={isCompactScreen}
                Fonts={Fonts}
                fullWidth
                icon={Images.pin}
                label={t('userDetails.fields.address', 'Adresse')}
                Spaces={Spaces}
                value={
                  isOwnerView
                    ? formatNullableValue(addressLabel, fallbackValue)
                    : t('userDetails.private', 'Privé')
                }
              />
            </View>
          </SectionCard>

          {shouldShowTeamsSection && !estMonProfilDeParent ? (
            <SectionCard
              ApplicationStyle={ApplicationStyle}
              Colors={Colors}
              Fonts={Fonts}
              Spaces={Spaces}
              title={t('userDetails.titles.teams', 'Équipes')}
            >
              <View style={[Spaces.gap[12]]}>
                <Text style={[Fonts.p2Bold, Fonts.neutral200]}>
                  {t('userDetails.teamGroups.player', 'Équipes joueur')}
                </Text>
                {playerTeams.length
                  ? playerTeams.map((team, index) => renderTeamCard(team, index, 'player'))
                  : (
                    <Text style={[Fonts.p2, Fonts.neutral300]}>
                      {t('userDetails.empty.playerTeams', 'Aucune équipe joueur')}
                    </Text>
                  )}
              </View>
              <View style={[Spaces.gap[12], Spaces.marginTop[12]]}>
                <Text style={[Fonts.p2Bold, Fonts.neutral200]}>
                  {t('userDetails.teamGroups.coach', 'Équipes entraînées')}
                </Text>
                {coachedTeams.length
                  ? coachedTeams.map((team, index) => renderTeamCard(team, index, 'coach'))
                  : (
                    <Text style={[Fonts.p2, Fonts.neutral300]}>
                      {t('userDetails.empty.coachTeams', 'Aucune équipe entraînée')}
                    </Text>
                  )}
              </View>
            </SectionCard>
          ) : null}

          {!isSelfProfile && currentLicenseAssignment ? (
            <SectionCard
              ApplicationStyle={ApplicationStyle}
              Colors={Colors}
              Fonts={Fonts}
              Spaces={Spaces}
              title={t('userDetails.license.title', 'Licence')}
            >
              <View style={[Spaces.gap[12]]}>
                {currentLicenseAssignment?.officialLicenseDocument?.file?.url ? (
                  <>
                    <Text style={[Fonts.p2, Fonts.neutral200]}>
                      {t(
                        'userDetails.license.available',
                        'Une licence officielle est disponible pour ce joueur.',
                      )}
                    </Text>
                    <Button
                      onPress={handleOpenLicense}
                      title={t('userDetails.license.view', 'Voir la licence')}
                      variant="Secondary"
                    />
                  </>
                ) : (
                  <Text style={[Fonts.p2, Fonts.neutral200]}>
                    {t(
                      'userDetails.license.unavailable',
                      'La licence officielle n est pas encore disponible pour ce joueur.',
                    )}
                  </Text>
                )}
              </View>
            </SectionCard>
          ) : null}
        </WithDataWrapper>
      </ScrollView>

      {/* FINITIONS8 (point 3) : le pied flottait SANS FOND, la carte se lisait a travers
          « Bloquer ». Meme fond que le pied de la fiche club (FINITIONS5 / F6-5) : `primary900`,
          OPAQUE, du haut des boutons au bas de l'ecran. Les boutons ne bougent pas : leur
          retrait bas devient une marge interieure. */}
      {canContact || canBlock ? (
        <View
          onLayout={handleFooterLayout}
          style={[
            Alignments.absolute,
            Spaces.paddingHorizontal[16],
            Spaces.gap[12],
            {
              backgroundColor: Colors.primary900,
              bottom: 0,
              left: 0,
              paddingBottom: insets.bottom + 24,
              paddingTop: 12,
              right: 0,
            },
          ]}
        >
          {canContact ? (
            <Button
              icon="envelope"
              iconPosition="before"
              onPress={handleContactUser}
              title={t('userDetails.actions.contact', 'Contacter')}
              variant="Primary"
            />
          ) : null}

          {/* 🚫 BLOQUER (K3) — l'un des DEUX endroits qu'Apple regarde. L'autre
              est le menu de la conversation. */}
          {canBlock ? (
            <Button
              disabled={isBlocking || isUnblocking}
              isLoading={isBlocking || isUnblocking}
              onPress={isTargetBlocked ? handleUnblockUser : handleBlockUser}
              title={isTargetBlocked
                ? t('userBlock.actions.unblock', 'Débloquer cette personne')
                : t('userBlock.actions.block', 'Bloquer cette personne')}
              variant="SecondaryLight"
            />
          ) : null}
        </View>
      ) : null}
    </ScreenContainer>
  );
}

export default UserDetails;
