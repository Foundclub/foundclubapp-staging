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
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useClub from '@/domains/club/useClub';
import useTheme from '@/theme/themeContext';

import Tag from '@/components/atoms/tag/Tag';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import SearchBar from '@/components/molecules/searchBar/SearchBar';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { getCMTeams } from '@/services/multisportClub/multisportClubService';

import MultisportStateView from './components/MultisportStateView';
import useResolvedMultisportClub from './useResolvedMultisportClub';

/**
 * Screen to display list of teams in a CM
 * @param {object} props
 * @param {object} props.navigation
 * @param {object} props.route
 */
function CMTeamsScreen({ navigation, route }) {
  const { cmId } = route?.params || {};
  const { t } = useTranslation();
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { getClubInitials } = useClub();
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

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSection, setSelectedSection] = useState(null);

  const {
    data: teamsData,
    error,
    isFetching,
    isLoading,
    refetch: refetchTeams,
  } = useQuery({
    enabled: !!resolvedCmId,
    queryFn: () => getCMTeams(resolvedCmId),
    queryKey: ['cm-teams', resolvedCmId],
  });

  const allTeams = useMemo(() => teamsData?.data || [], [teamsData?.data]);
  const sections = teamsData?.meta?.filters?.sections || [];

  const displayedTeams = useMemo(() => allTeams.filter((team) => {
    const teamName = String(team?.name || '').toLowerCase();
    const matchesSearch = teamName.includes(searchQuery.toLowerCase());
    const matchesSection = selectedSection ? team.sectionName === selectedSection : true;
    return matchesSearch && matchesSection;
  }), [allTeams, searchQuery, selectedSection]);

  useEffect(() => {
    navigation.setOptions({ headerTitle: `Equipes (${displayedTeams.length})` });
  }, [displayedTeams.length, navigation]);

  const handleRefresh = useCallback(() => {
    refetchTeams();
    refetchCm();
    if (!resolvedCmId) {
      refetchUserData();
    }
  }, [refetchCm, refetchTeams, refetchUserData, resolvedCmId]);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate(RouteNames.TeamStack, {
        params: { teamId: item.documentId },
        screen: RouteNames.TeamDetails,
      })}
      style={[
        Spaces.padding[16],
        Spaces.marginBottom[12],
        ApplicationStyle.backgroundColor.primary700,
        ApplicationStyle.borderRadius12,
      ]}
    >
      <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12]]}>
        {item.logoUrl ? (
          <ProfileAvatar
            imageStyle={{ borderRadius: 25 }}
            imageUrl={item.logoUrl}
            size={50}
            variant="logo"
            style={{ borderRadius: 25 }}
          />
        ) : (
          <TeamShield
            initials={getClubInitials(item.name)}
            isSmall
          />
        )}
        <View style={{ flex: 1 }}>
          <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{item.name}</Text>
          <Text style={[Fonts.p2, Fonts.primary100]}>
            {item.sectionName || t('multisport.teams.noSection', 'Section non renseignee')}
          </Text>
        </View>
        {item.sport ? <Tag text={item.sport} /> : null}
      </View>

      <View style={[Alignments.row, Spaces.marginTop[12], Spaces.gap[12]]}>
        {item.category ? <Text style={[Fonts.p3, Fonts.neutral100]}>{item.category}</Text> : null}
        {item.level ? (
          <Text style={[Fonts.p3, Fonts.neutral100]}>
            -
            {item.level}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  if (isLoadingUserData && !resolvedCmId) {
    return (
      <MultisportStateView
        description={t('multisport.teams.loadingUser', 'Nous preparons les equipes de votre structure multisport.')}
        isLoading
        title={t('multisport.teams.loadingUserTitle', 'Chargement du club')}
      />
    );
  }

  if (userDataError && !resolvedCmId) {
    return (
      <MultisportStateView
        actionLabel={t('common.retry', 'R\u00E9essayer')}
        description={t('multisport.teams.userError', "Impossible de retrouver votre structure multisport pour le moment.")}
        onAction={() => refetchUserData()}
        title={t('multisport.teams.userErrorTitle', 'Club indisponible')}
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
        description={t('multisport.teams.loading', 'Nous chargeons les informations de votre structure multisport.')}
        isLoading
        title={t('multisport.teams.loadingTitle', 'Chargement des equipes')}
      />
    );
  }

  if (cmError && !cmData) {
    return (
      <MultisportStateView
        actionLabel={t('common.retry', 'R\u00E9essayer')}
        description={t('multisport.teams.error', "Impossible de charger cette structure multisport pour le moment.")}
        onAction={() => refetchCm()}
        title={t('multisport.teams.errorTitle', 'Equipes indisponibles')}
      />
    );
  }

  if (!isLoadingCmData && !cmError && !cmData) {
    return (
      <MultisportStateView
        actionLabel={t('common.retry', 'Actualiser')}
        description={t('multisport.teams.notFound', "Cette structure multisport est introuvable ou n'est plus accessible.")}
        onAction={() => refetchCm()}
        title={t('multisport.teams.notFoundTitle', 'Club introuvable')}
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
        <SearchBar
          onChangeText={setSearchQuery}
          placeholder="Rechercher une equipe..."
          value={searchQuery}
          withCalendar={false}
          withFilter={false}
        />
      </View>

      {sections.length > 0 && (
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
                Toutes
              </Text>
            </TouchableOpacity>
            {sections.map((section) => (
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
          data={displayedTeams}
          keyExtractor={(item, index) => item.documentId || item.id || String(index)}
          ListEmptyComponent={(
            <View style={[Alignments.alignCenter, Spaces.marginTop[40]]}>
              <Text style={[Fonts.p1, Fonts.neutral100]}>
                {selectedSection || searchQuery.trim().length > 0
                  ? t('multisport.teams.emptyFiltered', 'Aucune equipe ne correspond a ces filtres.')
                  : t('multisport.teams.empty', 'Aucune equipe trouvee pour le moment.')}
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

export default CMTeamsScreen;
