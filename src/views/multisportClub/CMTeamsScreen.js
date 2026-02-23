import { useQuery } from '@tanstack/react-query';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList, RefreshControl, ScrollView, Text, TouchableOpacity, View,
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

/**
 * Screen to display list of teams in a CM
 * @param {object} props
 * @param {object} props.navigation
 * @param {object} props.route
 */
function CMTeamsScreen({ navigation, route }) {
  const { cmId } = route.params || {};
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const { getClubInitials } = useClub();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSection, setSelectedSection] = useState(null);

  const {
    data: teamsData,
    error,
    isLoading,
    refetch,
  } = useQuery({
    enabled: !!cmId,
    queryFn: () => getCMTeams(cmId),
    queryKey: ['cm-teams', cmId],
  });

  const allTeams = teamsData?.data || [];
  const sections = teamsData?.meta?.filters?.sections || [];

  const displayedTeams = useMemo(() => allTeams.filter((team) => {
    const matchesSearch = team.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSection = selectedSection ? team.sectionName === selectedSection : true;
    return matchesSearch && matchesSection;
  }), [allTeams, searchQuery, selectedSection]);

  React.useEffect(() => {
    navigation.setOptions({ headerTitle: `Équipes (${displayedTeams.length})` });
  }, [navigation, displayedTeams.length]);

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
          <Text style={[Fonts.p2, Fonts.primary100]}>{item.sectionName}</Text>
        </View>
        {item.sport && <Tag text={item.sport} />}
      </View>

      <View style={[Alignments.row, Spaces.marginTop[12], Spaces.gap[12]]}>
        {item.category && <Text style={[Fonts.p3, Fonts.neutral100]}>{item.category}</Text>}
        {item.level && (
        <Text style={[Fonts.p3, Fonts.neutral100]}>
          •
          {item.level}
        </Text>
        )}
      </View>
    </TouchableOpacity>
  );

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
          placeholder="Rechercher une équipe..."
          value={searchQuery}
          withCalendar={false}
          withFilter={false}
        />
      </View>

      {/* Sections Filter */}
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
        error={error?.message}
        isLoading={isLoading}
        wrapperStyle={[Alignments.fill]}
      >
        <FlatList
          contentContainerStyle={[Spaces.paddingHorizontal[16], Spaces.paddingBottom[40]]}
          data={displayedTeams}
          keyExtractor={(item) => item.documentId || item.id}
          ListEmptyComponent={(
            <View style={[Alignments.alignCenter, Spaces.marginTop[40]]}>
              <Text style={[Fonts.p1, Fonts.neutral100]}>Aucune équipe trouvée.</Text>
            </View>
          )}
          refreshControl={
            <RefreshControl onRefresh={refetch} refreshing={isLoading} />
          }
          renderItem={renderItem}
        />
      </WithDataWrapper>
    </ScreenContainer>
  );
}

export default CMTeamsScreen;
