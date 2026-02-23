import { useQuery } from '@tanstack/react-query';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList, Image, RefreshControl, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { getCMMembers } from '@/services/multisportClub/multisportClubService';

import { getImageUrl } from '@/utils/imageUrl';

/**
 * Screen to display list of members in a CM
 * @param {object} props
 * @param {object} props.navigation
 * @param {object} props.route
 */
function CMMembersScreen({ navigation, route }) {
  const { cmId } = route.params || {};
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();

  const [selectedTab, setSelectedTab] = useState('all');

  const {
    data: membersData,
    error,
    isLoading,
    refetch,
  } = useQuery({
    enabled: !!cmId,
    queryFn: () => getCMMembers(cmId),
    queryKey: ['cm-members', cmId],
  });

  const { coaches, players, presidents } = membersData?.data || { coaches: [], players: [], presidents: [] };
  const total = membersData?.data?.total || 0;

  React.useEffect(() => {
    navigation.setOptions({ headerTitle: `Membres (${total})` });
  }, [navigation, total]);

  const tabs = [

    { label: 'Tous', value: 'all' },
    { label: 'Dirigeants', value: 'presidents' },
    { label: 'Entraîneurs', value: 'coaches' },
    { label: 'Joueurs', value: 'players' },
  ];

  const [selectedSection, setSelectedSection] = useState(null);

  const allSections = membersData?.data?.sections || [];

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
        // Filter out duplicates if a user is in multiple roles logic ?
        // Backend returns separated lists. For "All", we just verify uniqueness by ID if needed.
        // But here we just concat. If a user is both coach and player, they appear twice?
        // Let's deduce uniqueness by ID if we want single entry per person.
        // For now, simple concat as per previous logic.
        list = [...presidents, ...coaches, ...players];
        break;
    }

    if (selectedSection) {
      list = list.filter((m) => m.sections?.includes(selectedSection));
    }

    return list;
  }, [selectedTab, selectedSection, presidents, coaches, players]);

  const handleUserPress = (user) => {
    navigation.navigate(RouteNames.ProfileStack, {
      params: { userId: user.documentId || user.id },
      screen: RouteNames.UserDetails,
    });
  };

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
          {/* Section display if available */}
          {item.sections?.join(', ')}
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

      {/* Section Filter */}
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
        error={error?.message}
        isLoading={isLoading}
        wrapperStyle={[Alignments.fill]}
      >
        <FlatList
          contentContainerStyle={[Spaces.paddingHorizontal[16], Spaces.paddingBottom[40]]}
          data={displayedMembers}
          keyExtractor={(item, index) => item.documentId || item.id || index.toString()}
          ListEmptyComponent={(
            <View style={[Alignments.alignCenter, Spaces.marginTop[40]]}>
              <Text style={[Fonts.p1, Fonts.neutral100]}>Aucun membre trouvé.</Text>
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

export default CMMembersScreen;
