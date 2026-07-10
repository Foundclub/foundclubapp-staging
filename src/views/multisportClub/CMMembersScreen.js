import { useQuery } from '@tanstack/react-query';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { getCMMembers } from '@/services/multisportClub/multisportClubService';

import MultisportStateView from './components/MultisportStateView';
import useResolvedMultisportClub from './useResolvedMultisportClub';

const EMPTY_MEMBER_GROUP = { coaches: [], players: [], presidents: [] };

/**
 * @param {any[]} members
 * @returns {any[]}
 */
const deduplicateMembers = (members) => {
  const byId = new Map();

  members.forEach((member) => {
    const key = String(
      member?.documentId
      || member?.id
      || `${member?.firstname || ''}-${member?.lastname || ''}`,
    ).trim();

    if (!key) return;

    const memberSections = Array.isArray(member?.sections)
      ? member.sections.filter(Boolean)
      : [];
    const existing = byId.get(key);

    if (!existing) {
      byId.set(key, {
        ...member,
        sections: [...new Set(memberSections)],
      });
      return;
    }

    byId.set(key, {
      ...existing,
      ...member,
      sections: [...new Set([...(existing.sections || []), ...memberSections])],
    });
  });

  return Array.from(byId.values());
};

/**
 * Screen to display list of members in a CM
 * @param {object} props
 * @param {object} props.navigation
 * @param {object} props.route
 */
function CMMembersScreen({ navigation, route }) {
  const { cmId } = route?.params || {};
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
    cmData,
    cmError,
    isFetchingCmData,
    isLoadingCmData,
    isLoadingUserData,
    refetchCm,
    refetchUserData,
    resolvedCmId,
    userDataError,
  } = useResolvedMultisportClub(cmId);

  const [selectedTab, setSelectedTab] = useState('all');
  const [selectedSection, setSelectedSection] = useState(null);

  const {
    data: membersData,
    error,
    isFetching,
    isLoading,
    refetch: refetchMembers,
  } = useQuery({
    enabled: !!resolvedCmId,
    queryFn: () => getCMMembers(resolvedCmId),
    queryKey: ['cm-members', resolvedCmId],
  });

  const { coaches, players, presidents } = membersData?.data || EMPTY_MEMBER_GROUP;
  const total = membersData?.data?.total || 0;

  useEffect(() => {
    navigation.setOptions({ headerTitle: `Membres (${total})` });
  }, [navigation, total]);

  const tabs = [
    { label: 'Tous', value: 'all' },
    { label: 'Dirigeants', value: 'presidents' },
    { label: 'Entraîneur·e·s', value: 'coaches' },
    { label: 'Joueurs', value: 'players' },
  ];

  const allSections = membersData?.data?.sections || [];
  const allMembers = useMemo(
    () => deduplicateMembers([...presidents, ...coaches, ...players]),
    [coaches, players, presidents],
  );

  const displayedMembers = useMemo(() => {
    let list = [];

    switch (selectedTab) {
      case 'coaches':
        list = coaches;
        break;
      case 'players':
        list = players;
        break;
      case 'presidents':
        list = presidents;
        break;
      case 'all':
      default:
        list = allMembers;
        break;
    }

    if (selectedSection) {
      list = list.filter((member) => member.sections?.includes(selectedSection));
    }

    return list;
  }, [allMembers, coaches, players, presidents, selectedSection, selectedTab]);

  const handleUserPress = useCallback((user) => {
    navigation.navigate(RouteNames.ProfileStack, {
      params: { userId: user.documentId || user.id },
      screen: RouteNames.UserDetails,
    });
  }, [navigation]);

  const handleRefresh = useCallback(() => {
    refetchMembers();
    refetchCm();
    if (!resolvedCmId) {
      refetchUserData();
    }
  }, [refetchCm, refetchMembers, refetchUserData, resolvedCmId]);

  /**
   * Render member item
   * @param {object} param0
   * @param {object} param0.item
   */
  const renderItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => handleUserPress(item)}
      style={[
        ApplicationStyle.borderRadius12,
        ApplicationStyle.backgroundColor.primary700,
        Alignments.row,
        Alignments.alignCenter,
        Spaces.padding[12],
        Spaces.gap[12],
        Spaces.marginBottom[8],
      ]}
    >
      <ProfileAvatar
        imageStyle={{ borderRadius: 25 }}
        imageUrl={item.avatarUrl}
        size={50}
        style={{ borderRadius: 25 }}
      />
      <View style={{ flex: 1 }}>
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
          {item.firstname}
          {' '}
          {item.lastname}
        </Text>
        <Text style={[Fonts.p2, Fonts.primary500]}>
          {item.sections?.length
            ? item.sections.join(', ')
            : t('multisport.members.noSection', 'Section non renseignee')}
        </Text>
      </View>
      <Image
        source={Images.arrowRight}
        style={[
          ApplicationStyle.icon16,
          ApplicationStyle.tintColor.neutral00,
        ]}
      />
    </TouchableOpacity>
  );

  if (isLoadingUserData && !resolvedCmId) {
    return (
      <MultisportStateView
        description={t('multisport.members.loadingUser', 'Nous preparons les membres de votre structure multisport.')}
        isLoading
        title={t('multisport.members.loadingUserTitle', 'Chargement du club')}
      />
    );
  }

  if (userDataError && !resolvedCmId) {
    return (
      <MultisportStateView
        actionLabel={t('common.retry', 'R\u00E9essayer')}
        description={t('multisport.members.userError', "Impossible de retrouver votre structure multisport pour le moment.")}
        onAction={() => refetchUserData()}
        title={t('multisport.members.userErrorTitle', 'Club indisponible')}
      />
    );
  }

  if (!resolvedCmId) {
    return (
      <MultisportStateView
        description={t('multisport.fallback.noClub', 'Aucun club multisport associe a ce compte.')}
        title={t('multisport.fallback.noClubTitle', 'Aucun club multisport')}
      />
    );
  }

  if (isLoadingCmData && !cmData) {
    return (
      <MultisportStateView
        description={t('multisport.members.loading', 'Nous chargeons les informations de votre structure multisport.')}
        isLoading
        title={t('multisport.members.loadingTitle', 'Chargement des membres')}
      />
    );
  }

  if (cmError && !cmData) {
    return (
      <MultisportStateView
        actionLabel={t('common.retry', 'R\u00E9essayer')}
        description={t('multisport.members.error', "Impossible de charger cette structure multisport pour le moment.")}
        onAction={() => refetchCm()}
        title={t('multisport.members.errorTitle', 'Membres indisponibles')}
      />
    );
  }

  if (!isLoadingCmData && !cmError && !cmData) {
    return (
      <MultisportStateView
        actionLabel={t('common.retry', 'Actualiser')}
        description={t('multisport.members.notFound', "Cette structure multisport est introuvable ou n'est plus accessible.")}
        onAction={() => refetchCm()}
        title={t('multisport.members.notFoundTitle', 'Club introuvable')}
      />
    );
  }

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingVertical[24],
        Alignments.column,
        Alignments.fill,
      ]}
    >
      <View style={[Spaces.paddingHorizontal[16], Spaces.marginBottom[16]]}>
        <SegmentedControl
          onChange={setSelectedTab}
          options={tabs}
          value={selectedTab}
        />
      </View>

      {allSections.length > 0 && (
        <View style={[Spaces.marginBottom[16]]}>
          <ScrollView
            contentContainerStyle={[Spaces.paddingHorizontal[16], Spaces.gap[8]]}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            <TouchableOpacity
              onPress={() => setSelectedSection(null)}
              style={[
                ApplicationStyle.borderRadius16,
                Spaces.paddingHorizontal[12],
                Spaces.paddingVertical[8],
                {
                  backgroundColor: selectedSection === null ? Colors.primary500 : Colors.neutral700,
                  borderColor: selectedSection === null ? Colors.primary500 : Colors.neutral500,
                  borderWidth: 1,
                },
              ]}
            >
              <Text style={[Fonts.p3, selectedSection === null ? Fonts.neutral900 : Fonts.neutral100]}>
                Toutes les sections
              </Text>
            </TouchableOpacity>
            {allSections.map((section) => (
              <TouchableOpacity
                key={section}
                onPress={() => setSelectedSection(section)}
                style={[
                  ApplicationStyle.borderRadius16,
                  Spaces.paddingHorizontal[12],
                  Spaces.paddingVertical[8],
                  {
                    backgroundColor: selectedSection === section ? Colors.primary500 : Colors.neutral700,
                    borderColor: selectedSection === section ? Colors.primary500 : Colors.neutral500,
                    borderWidth: 1,
                  },
                ]}
              >
                <Text style={[Fonts.p3, selectedSection === section ? Fonts.neutral900 : Fonts.neutral100]}>
                  {section}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <WithDataWrapper
        error={error}
        isLoading={isLoading}
        wrapperStyle={[Alignments.fill]}
      >
        <FlatList
          contentContainerStyle={[Spaces.paddingHorizontal[16], Spaces.paddingBottom[40]]}
          data={displayedMembers}
          keyExtractor={(item, index) => item.documentId || item.id || index.toString()}
          ListEmptyComponent={(
            <View style={[Alignments.alignCenter, Spaces.marginTop[40]]}>
              <Text style={[Fonts.p1, Fonts.neutral100]}>
                {selectedSection || selectedTab !== 'all'
                  ? t('multisport.members.emptyFiltered', 'Aucun membre ne correspond a ces filtres.')
                  : t('multisport.members.empty', 'Aucun membre trouve pour le moment.')}
              </Text>
            </View>
          )}
          refreshControl={(
            <RefreshControl
              onRefresh={handleRefresh}
              refreshing={isLoading || isFetching || isFetchingCmData}
            />
          )}
          renderItem={renderItem}
        />
      </WithDataWrapper>
    </ScreenContainer>
  );
}

export default CMMembersScreen;
