
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList, Image, RefreshControl, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';

import useTheme from '@/theme/themeContext';
import { RouteNames } from '@/navigation/routeNames';

import ScreenContainer from '@/components/templates/ScreenContainer';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import Button from '@/components/atoms/button/Button';

import { getCMMembers } from '@/services/multisportClub/multisportClubService';
import { getImageUrl } from '@/utils/imageUrl';

/**
 * Screen to display list of members in a CM
 * @param {object} props
 * @param {object} props.navigation
 * @param {object} props.route
 */
const CMMembersScreen = ({ navigation, route }) => {
  const { cmId } = route.params || {};
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Fonts, Images, Spaces, Colors,
  } = useTheme();

  const [selectedTab, setSelectedTab] = useState('all');

  const {
    data: membersData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['cm-members', cmId],
    queryFn: () => getCMMembers(cmId),
    enabled: !!cmId,
  });

  const { presidents, coaches, players } = membersData?.data || { presidents: [], coaches: [], players: [] };
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
      case 'presidents':
        list = presidents;
        break;
      case 'coaches':
        list = coaches;
        break;
      case 'players':
        list = players;
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
      screen: RouteNames.UserDetails,
      params: { userId: user.documentId || user.id },
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
        imageUrl={item.avatarUrl}
        size={50}
        style={{ borderRadius: 25 }}
        imageStyle={{ borderRadius: 25 }}
      />
      <View style={{ flex: 1 }}>
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
          {item.firstname} {item.lastname}
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
          options={tabs}
          value={selectedTab}
          onChange={setSelectedTab}
        />
      </View>

      {/* Section Filter */}
      {allSections.length > 0 && (
        <View style={[Spaces.marginBottom[16]]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[Spaces.paddingHorizontal[16], Spaces.gap[8]]}
          >
            <TouchableOpacity
              onPress={() => setSelectedSection(null)}
              style={[
                ApplicationStyle.borderRadius16,
                Spaces.paddingHorizontal[12],
                Spaces.paddingVertical[8],
                {
                  backgroundColor: selectedSection === null ? Colors.primary500 : Colors.neutral700,
                  borderWidth: 1,
                  borderColor: selectedSection === null ? Colors.primary500 : Colors.neutral500,
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
                    borderWidth: 1,
                    borderColor: selectedSection === section ? Colors.primary500 : Colors.neutral500,
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
        isLoading={isLoading}
        error={error?.message}
        wrapperStyle={[Alignments.fill]}
      >
        <FlatList
          data={displayedMembers}
          renderItem={renderItem}
          keyExtractor={(item, index) => item.documentId || item.id || index.toString()}
          contentContainerStyle={[Spaces.paddingHorizontal[16], Spaces.paddingBottom[40]]}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refetch} />
          }
          ListEmptyComponent={
            <View style={[Alignments.alignCenter, Spaces.marginTop[40]]}>
              <Text style={[Fonts.p1, Fonts.neutral100]}>Aucun membre trouvé.</Text>
            </View>
          }
        />
      </WithDataWrapper>
    </ScreenContainer>
  );
};

export default CMMembersScreen;
