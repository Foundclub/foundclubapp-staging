import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
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
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import EmptyState from '@/components/atoms/emptyState/EmptyState';
import Loader from '@/components/atoms/loader/Loader';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';
import { navigateOrExplainOnWeb } from '@/navigation/webNavigationGuard';

import {
  getMyFriendlyMatchAds,
  getMyFriendlyMatchApplications,
} from '@/services/friendlyMatch/friendlyMatchService';
import { getMyApplications, getMyRecruitmentAds } from '@/services/recruitment/recruitmentService';

// Les memes mots que les quatre listes de Recrutement (lot L42) : une panne
// serveur n est PAS une liste vide, et elle doit se lire pareil partout.
const UNREACHABLE_TITLE = 'On n’arrive pas à joindre le serveur.';
const UNREACHABLE_DESCRIPTION = 'Vérifie ta connexion, puis réessaie.';
const UNREACHABLE_ACTION = 'Réessayer';

const TAB_PUBLICATIONS = 'publications';
const TAB_RESPONSES = 'responses';

const documentKey = (/** @type {any} */ item) => String(item?.documentId || item?.id || '').trim();

/**
 * Les equipes que je gere, sans doublon : une meme equipe peut arriver par
 * `myTeams` (dirigeant) ET par `trainedTeams` (entraineur).
 * @param {any} userData Le profil connecte.
 * @returns {string[]} Les identifiants d equipe, dedoublonnes.
 */
const getManagedTeamIds = (userData) => Array.from(new Set([
  ...(userData?.myTeams || []),
  ...(userData?.trainedTeams || []),
].map(documentKey).filter(Boolean)));

/**
 * « Mes activites » — captures 06 et 07 du pack Rechercher.
 *
 * On PUBLIE depuis Rechercher, on GERE ici. L ecran ne calcule rien lui-meme :
 * la lecture des donnees vit dans domains/search/myActivitiesFeed.js, testee a
 * part. Ici il ne reste que « aller chercher » et « dessiner ».
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props Props de navigation.
 * @returns {import('react').ReactElement} L ecran.
 */
function MyActivitiesScreen({ navigation }) {
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
      setUnreachable([offres, matchs, mesCandidatures, mesPropositions]
        .every((resultat) => resultat.status === 'rejected'));
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
    if (activeTab === TAB_PUBLICATIONS) {
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

  const responsesLabel = isStaff ? 'Réponses reçues' : 'Mes réponses';

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
    nav.navigate(RouteNames.RecruitmentAdDetails, { ad: item.ad, isOwner: isStaff });
  }, [isStaff, navigation]);

  const cardSurface = withAlpha(Colors.primary900, 0.6);
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
      <View style={{ flex: 1 }}>
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{item.title}</Text>
        {item.meta ? (
          <Text style={[Fonts.p3, Fonts.neutral300, Spaces.marginTop[4]]}>{item.meta}</Text>
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
              {item.isOnline ? 'En ligne' : 'Hors ligne'}
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
          <Text style={[Fonts.p4Bold, { color: Colors.success500 }]}>Nouveau</Text>
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

    return (
      <EmptyState
        description={activeTab === TAB_PUBLICATIONS
          ? 'Publie une offre ou un match amical depuis Rechercher : tu les géreras ici.'
          : 'Dès qu’on répondra à ce que tu as publié, tu le verras ici.'}
        title={activeTab === TAB_PUBLICATIONS
          ? 'Tu n’as encore rien publié.'
          : 'Aucune réponse pour le moment.'}
      />
    );
  };

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[Alignments.fill, Spaces.paddingHorizontal[16]]}
    >
      <View style={[Spaces.paddingTop[24], Spaces.marginBottom[24]]}>
        <Text style={[Fonts.h1, Fonts.neutral00]}>Mes activités</Text>
      </View>

      <SegmentedControl
        centerContent
        onChange={setActiveTab}
        options={[
          { label: 'Publications', value: TAB_PUBLICATIONS },
          { label: responsesLabel, value: TAB_RESPONSES },
        ]}
        value={activeTab}
      />

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
