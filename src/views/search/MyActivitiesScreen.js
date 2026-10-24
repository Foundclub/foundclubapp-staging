import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import {
  buildMyActivitiesPublications,
  buildMyActivitiesReceivedResponses,
  buildMyActivitiesSentResponses,
} from '@/domains/search/myActivitiesFeed';
import { getRecruitmentRoleMode } from '@/domains/search/recruitmentFlow';
import { getManagedTeams } from '@/domains/team/teamMembership';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import EmptyState from '@/components/atoms/emptyState/EmptyState';
import Loader from '@/components/atoms/loader/Loader';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';
import { navigateOrExplainOnWeb } from '@/navigation/webNavigationGuard';

import {
  getMyFriendlyMatchAds,
  getMyFriendlyMatchApplications,
} from '@/services/friendlyMatch/friendlyMatchService';
import { markApplicationResponsesAsRead } from '@/services/notification/notificationService';
import { getMyApplications, getMyRecruitmentAds } from '@/services/recruitment/recruitmentService';

import texteInsecable from '@/utils/texteInsecable';

const TAB_PUBLICATIONS = 'publications';
const TAB_RESPONSES = 'responses';

const documentKey = (/** @type {any} */ item) => String(item?.documentId || item?.id || '').trim();

/**
 * Les equipes que je GERE, sans doublon. GERER-ANNONCE (A15/A16) : `myTeams`
 * n'est PAS « dirigeant », c'est la liste des equipes ou l'on JOUE ; la regle
 * partagee n'en garde que celles dont on dirige le club.
 * @param {any} userData Le profil connecte.
 * @returns {string[]} Les identifiants d equipe, dedoublonnes.
 */
const getManagedTeamIds = (userData) => getManagedTeams(userData).map(documentKey).filter(Boolean);

/**
 * « Mes activites » — captures 06 et 07 du pack Rechercher.
 *
 * On PUBLIE depuis Rechercher, on GERE ici. L ecran ne calcule rien lui-meme :
 * la lecture des donnees vit dans domains/search/myActivitiesFeed.js, testee a
 * part. Ici il ne reste que « aller chercher » et « dessiner ».
 *
 * MES-CANDIDATURES (audit V1, A12, decision d'Adel du 30/09) : pour un JOUEUR (et
 * tout compte qui ne publie pas), la page s'appelle « Mes candidatures » — une seule
 * liste, sans onglet : l'onglet « Publications » lui restait vide pour toujours.
 * ⚠️ Le STAFF (entraineur, dirigeant, super admin) garde « Mes activites » et ses
 * deux onglets : il a des PUBLICATIONS. La regle est `getRecruitmentRoleMode`, la
 * meme que la case de l'accueil qui ouvre cette page (HomeHub.js).
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props Props de navigation.
 * @returns {import('react').ReactElement} L ecran.
 */
function MyActivitiesScreen({ navigation }) {
  const { t } = useTranslation();
  // Les memes mots que les quatre listes de Recrutement (lot L42) : une panne
  // serveur n est PAS une liste vide, et elle doit se lire pareil partout.
  const UNREACHABLE_TITLE = t(
    'myActivitiesScreen.unreachable.title',
    'On n’arrive pas à joindre le serveur.',
  );
  const UNREACHABLE_DESCRIPTION = t(
    'myActivitiesScreen.unreachable.description',
    'Vérifie ta connexion, puis réessaie.',
  );
  const UNREACHABLE_ACTION = t('myActivitiesScreen.unreachable.retry', 'Réessayer');
  const {
    Alignments, Colors, Fonts, Spaces,
  } = /** @type {any} */ (useTheme());
  const { userData } = /** @type {any} */ (useAuth());
  const isStaff = getRecruitmentRoleMode(userData) === 'staff';
  const managedTeamIds = useMemo(() => getManagedTeamIds(userData), [userData]);

  // D57 — un joueur ne publie NI offre NI match : les deux appels qui
  // alimentent « Publications » lui rendent `[]` sans meme partir (voir
  // `fetchActivities` plus bas). L'ouvrir sur cet onglet, c'est l'accueillir par
  // un placard vide qui le restera. Il entre donc par « Mes reponses », le seul
  // onglet qui le concerne — et c'est aussi la porte que lui ouvre l'Accueil.
  const [activeTab, setActiveTab] = useState(isStaff ? TAB_PUBLICATIONS : TAB_RESPONSES);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recruitmentAds, setRecruitmentAds] = useState(/** @type {any[]} */ ([]));
  const [friendlyAds, setFriendlyAds] = useState(/** @type {any[]} */ ([]));
  const [sentApplications, setSentApplications] = useState(/** @type {any[]} */ ([]));
  const [sentFriendlyApplications, setSentFriendlyApplications] = useState(
    /** @type {any[]} */ ([]),
  );
  // Un seul drapeau, mais leve UNIQUEMENT sur un rejet : sans lui, un serveur
  // muet renverrait « tu n as encore rien publie » a quelqu un qui a publie.
  const [unreachable, setUnreachable] = useState(false);

  const ownerFilters = useMemo(() => (
    managedTeamIds.length > 0
      ? { teamIds: managedTeamIds }
      : { authorDocumentId: documentKey(userData) }
  ), [managedTeamIds, userData]);

  const fetchActivities = useCallback(async (isRefresh = false) => {
    if (!documentKey(userData)) {
      setLoading(false);
      return;
    }
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // `allSettled` et pas `all` : le staff lit deux marches independants, et
      // une offre de recrutement injoignable ne doit pas effacer les matchs
      // amicaux deja chargeables.
      const [
        offres,
        matchs,
        mesCandidatures,
        mesPropositions,
      ] = await Promise.allSettled([
        isStaff ? getMyRecruitmentAds(ownerFilters) : Promise.resolve([]),
        isStaff ? getMyFriendlyMatchAds(ownerFilters) : Promise.resolve([]),
        isStaff ? Promise.resolve([]) : getMyApplications(userData),
        isStaff ? Promise.resolve([]) : getMyFriendlyMatchApplications(managedTeamIds),
      ]);

      const valeur = (/** @type {any} */ resultat) => (
        resultat.status === 'fulfilled' && Array.isArray(resultat.value) ? resultat.value : []
      );

      setRecruitmentAds(valeur(offres));
      setFriendlyAds(valeur(matchs));
      setSentApplications(valeur(mesCandidatures));
      setSentFriendlyApplications(valeur(mesPropositions));
      // BH15 P14-11 : seules les requetes du role comptent ; les autres repondent [] d'office.
      setUnreachable((isStaff ? [offres, matchs] : [mesCandidatures, mesPropositions])
        .every((resultat) => resultat.status === 'rejected'));

      // MES-CANDIDATURES (A13) — la liste est a l'ecran : ses reponses sont VUES, et
      // la pastille rouge de l'accueil s'eteint (le serveur compte les notifications
      // de reponse non lues). Seulement si les DEUX sources ont ete lues : marquer vu
      // ce qui n'a pas pu s'afficher serait mentir. Un echec ne coute que la pastille.
      if (!isStaff && [mesCandidatures, mesPropositions]
        .every((resultat) => resultat.status === 'fulfilled')) {
        Promise.resolve()
          .then(() => markApplicationResponsesAsRead())
          .catch((error) => {
            console.warn('[MyActivitiesScreen] mark responses seen failed:', error);
          });
      }
    } catch (error) {
      console.error('[MyActivitiesScreen] Error fetching activities:', error);
      setUnreachable(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isStaff, managedTeamIds, ownerFilters, userData]);

  useFocusEffect(useCallback(() => {
    fetchActivities();
    return undefined;
  }, [fetchActivities]));

  const items = useMemo(() => {
    if (isStaff && activeTab === TAB_PUBLICATIONS) {
      return buildMyActivitiesPublications({ friendlyAds, recruitmentAds });
    }
    return isStaff
      ? buildMyActivitiesReceivedResponses({ friendlyAds, recruitmentAds })
      : buildMyActivitiesSentResponses({ sentApplications, sentFriendlyApplications });
  }, [
    activeTab,
    friendlyAds,
    isStaff,
    recruitmentAds,
    sentApplications,
    sentFriendlyApplications,
  ]);

  // Les onglets ne sont plus montres qu'au staff (A12) : le second dit ce qu'il RECOIT.
  const responsesLabel = t('myActivitiesScreen.tabs.receivedResponses', 'Réponses reçues');

  const openItem = useCallback((/** @type {any} */ item) => {
    const nav = /** @type {any} */ (navigation);
    if (item.market === 'amicaux') {
      // Le meme garde-fou que la liste des matchs amicaux : cet ecran n a pas
      // de route web, y naviguer depuis le site atterrirait sur du blanc.
      navigateOrExplainOnWeb(nav, RouteNames.FriendlyMatchAdDetails, {
        adId: documentKey(item.ad),
      });
      return;
    }
    // FINITIONS18 · POINT 5 (T16) — `adId` : sur le site, l'adresse de la fiche le porte (`:adId`).
    nav.navigate(RouteNames.RecruitmentAdDetails, {
      ad: item.ad, adId: documentKey(item.ad), isOwner: isStaff,
    });
  }, [isStaff, navigation]);

  const cardSurface = withAlpha(Colors.primary900, 0.6);
  // Gris pour ce qui attend le club (A13 : attendre n'est pas une alerte), vert pour
  // un oui, rouge d'erreur de la charte pour un non, gris fonce pour ce qui est clos.
  const statusColor = (/** @type {string} */ tone) => ({
    accepted: Colors.success500,
    declined: Colors.error500,
    pending: Colors.neutral300,
  })[tone] || Colors.neutral500;
  const cardBorder = withAlpha(Colors.neutral00, 0.13);

  const renderSection = (/** @type {any} */ item) => (
    <Text
      style={[
        Fonts.p4Bold,
        Spaces.marginTop[16],
        { color: Colors.neutral300, letterSpacing: 1, textTransform: 'uppercase' },
      ]}
    >
      {item.title}
    </Text>
  );

  /**
   * L'etat d'une publication : en ligne, expiree (ANNONCE-RENOUVELER 6), ou hors ligne.
   * @param {any} item La publication.
   * @returns {string} Le libelle.
   */
  const publicationStateLabel = (item) => {
    if (item.isOnline) return t('myActivitiesScreen.item.online', 'En ligne');
    if (item.isExpired) return t('myActivitiesScreen.item.expired', 'Expirée');
    return t('myActivitiesScreen.item.offline', 'Hors ligne');
  };

  const renderCard = (/** @type {any} */ item) => (
    <TouchableOpacity
      accessibilityLabel={item.title}
      accessibilityRole="button"
      activeOpacity={0.8}
      onPress={() => openItem(item)}
      style={[
        Alignments.row,
        Alignments.alignCenter,
        Spaces.gap[12],
        Spaces.padding[16],
        {
          backgroundColor: cardSurface,
          borderColor: cardBorder,
          borderRadius: 16,
          borderWidth: 1,
          minHeight: 52,
        },
      ]}
    >
      {/* MES-CANDIDATURES (A12) : le club, d'un coup d'oeil — son logo, sinon ses initiales. */}
      {item.club ? <ClubLogoMark club={item.club} size={40} /> : null}

      <View style={{ flex: 1 }}>
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{item.title}</Text>
        {item.meta ? (
          <Text style={[Fonts.p3, Fonts.neutral300, Spaces.marginTop[4]]}>{item.meta}</Text>
        ) : null}

        {/* MES-CANDIDATURES (A12, A14) : l'etat de MA candidature, sous sa date.
            Espaces insecables : pastille grasse de plusieurs mots (Android 16). */}
        {item.statusLabel ? (
          <View style={[
            Spaces.marginTop[8],
            Spaces.paddingHorizontal[8],
            {
              alignSelf: 'flex-start',
              borderColor: statusColor(item.statusTone),
              borderRadius: 999,
              borderWidth: 1,
              paddingVertical: 2,
            },
          ]}
          >
            <Text style={[
              Fonts.p4Bold,
              {
                color: statusColor(item.statusTone),
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              },
            ]}
            >
              {texteInsecable(item.statusLabel)}
            </Text>
          </View>
        ) : null}

        {item.type === 'publication' ? (
          <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8], Spaces.marginTop[8]]}>
            <View style={{
              backgroundColor: item.isOnline ? Colors.success500 : Colors.neutral500,
              borderRadius: 999,
              height: 8,
              width: 8,
            }}
            />
            <Text style={[Fonts.p3, Fonts.neutral300]}>
              {publicationStateLabel(item)}
            </Text>
            <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
              {`· ${item.countLabel}`}
            </Text>
          </View>
        ) : null}
      </View>

      {item.isNew ? (
        <View style={[
          Spaces.paddingHorizontal[12],
          {
            borderColor: Colors.success500,
            borderRadius: 999,
            borderWidth: 1,
            paddingVertical: 4,
          },
        ]}
        >
          <Text style={[Fonts.p4Bold, { color: Colors.success500 }]}>
            {t('myActivitiesScreen.item.new', 'Nouveau')}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );

  const renderEmpty = () => {
    if (unreachable) {
      return (
        <EmptyState
          actionLabel={UNREACHABLE_ACTION}
          description={UNREACHABLE_DESCRIPTION}
          onAction={() => fetchActivities()}
          title={UNREACHABLE_TITLE}
        />
      );
    }

    if (!isStaff) {
      return (
        <EmptyState
          description={t(
            'myActivitiesScreen.empty.applicationsBody',
            'Postule à une offre depuis Rechercher › Recrutement : tu suivras sa réponse ici.',
          )}
          title={t(
            'myActivitiesScreen.empty.applicationsTitle',
            'Aucune candidature pour le moment.',
          )}
        />
      );
    }

    return (
      <EmptyState
        description={activeTab === TAB_PUBLICATIONS
          ? t(
            'myActivitiesScreen.empty.publicationsBody',
            'Publie une offre ou un match amical depuis Rechercher : tu les géreras ici.',
          )
          : t(
            'myActivitiesScreen.empty.responsesBody',
            'Dès qu’on répondra à ce que tu as publié, tu le verras ici.',
          )}
        title={activeTab === TAB_PUBLICATIONS
          ? t('myActivitiesScreen.empty.publicationsTitle', 'Tu n’as encore rien publié.')
          : t('myActivitiesScreen.empty.responsesTitle', 'Aucune réponse pour le moment.')}
      />
    );
  };

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[Alignments.fill, Spaces.paddingHorizontal[16]]}
    >
      <View style={[Spaces.paddingTop[24], Spaces.marginBottom[24]]}>
        <Text style={[Fonts.h1, Fonts.neutral00]}>
          {isStaff
            ? t('myActivitiesScreen.title', 'Mes activités')
            : t('myActivitiesScreen.titleApplications', 'Mes candidatures')}
        </Text>
      </View>

      {isStaff ? (
        <SegmentedControl
          centerContent
          onChange={setActiveTab}
          options={[
            {
              label: t('myActivitiesScreen.tabs.publications', 'Publications'),
              value: TAB_PUBLICATIONS,
            },
            { label: responsesLabel, value: TAB_RESPONSES },
          ]}
          value={activeTab}
        />
      ) : null}

      {loading ? <Loader /> : (
        <FlatList
          contentContainerStyle={[Spaces.gap[8], Spaces.paddingBottom[160], { flexGrow: 1 }]}
          data={items}
          keyExtractor={(item) => item.key}
          ListEmptyComponent={renderEmpty()}
          onRefresh={() => fetchActivities(true)}
          refreshing={refreshing}
          renderItem={({ item }) => (
            item.type === 'section' ? renderSection(item) : renderCard(item)
          )}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
        />
      )}
    </ScreenContainer>
  );
}

export default MyActivitiesScreen;
