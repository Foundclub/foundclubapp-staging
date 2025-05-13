import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Tag from '@/components/atoms/tag/Tag';
import ProfileButton from '@/components/molecules/profileButton/ProfileButton';
import EventListContent from '@/components/organisms/eventListContent/EventListContent';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetEventTypes } from '@/services/event/eventQueries';

/**
 * My events list screen component that shows events where the user is a participant
 * or events from their team
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} My events list screen component
 */
function MyEventList({ navigation }) {
  const { ApplicationStyle, Fonts, Images } = useTheme();
  const { t } = useTranslation();
  const { canManageEvents, userData } = useAuth();
  const [selectedType, setSelectedType] = useState('');

  // hooks
  const {
    Alignments,
    Spaces,
  } = useTheme();

  const { data: eventTypes } = useGetEventTypes();

  // Get team IDs from user's teams
  const teamIds = (userData?.myTeams || []).concat((userData?.trainedTeams || [])).map(
    (team) => team.documentId || '',
  );

  const handleAddEvent = () => {
    navigation.navigate(RouteNames.EventEdit);
  };

  /**
   * Handle type selection
   * @param {string} typeId - The ID of the selected type
   */
  const handleTypeSelect = (typeId) => {
    setSelectedType(selectedType === typeId ? '' : typeId);
  };

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingBottom[24],
        Spaces.gap[24],
        Alignments.justifySpaceBetween,
        Alignments.column,
        Alignments.fill,
      ]}
    >
      {/* header */}
      <View style={[
        Spaces.marginTop[16],
        Alignments.row,
        Alignments.alignCenter,
        Alignments.justifySpaceBetween]}
      >
        <Image source={Images.logo} style={{ height: 23, resizeMode: 'cover', width: 222 }} />
        <ProfileButton />
      </View>
      <Text style={[Fonts.p1Black, Fonts.neutral00, Spaces.marginTop[16]]}>
        {t('myEventList.title')}
      </Text>
      <ScrollView
        contentContainerStyle={[Spaces.gap[8]]}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[Alignments.fill, { maxHeight: 30 }]}
      >
        <TouchableOpacity
          onPress={() => handleTypeSelect('')}
          style={[
            selectedType === '' && ApplicationStyle.backgroundColor.primary500,
            ApplicationStyle.borderRadius8,
          ]}
        >
          <Tag
            text={t('myEventList.fields.type.all')}
            textColor={selectedType === '' ? 'neutral00' : 'primary500'}
          />
        </TouchableOpacity>
        {eventTypes?.map((type) => (
          <TouchableOpacity
            key={type.documentId}
            onPress={() => handleTypeSelect(type.documentId)}
            style={[
              selectedType === type.documentId && ApplicationStyle.backgroundColor.primary500,
              ApplicationStyle.borderRadius8,
            ]}
          >
            <Tag
              text={type.name}
              textColor={selectedType === type.documentId ? 'neutral00' : 'primary500'}
            />
          </TouchableOpacity>
        ))}
      </ScrollView>
      <EventListContent
        additionalFilters={{
          participantId: userData?.documentId,
          teamIds: teamIds.length > 0 ? teamIds : undefined,
          type: selectedType || undefined,
          useOrFilter: true,
        }}
      />
      {
        canManageEvents ? (
          <Button
            onPress={handleAddEvent}
            title={t('eventList.actions.add')}
            variant="Primary"
          />
        ) : null
      }
    </ScreenContainer>
  );
}

export default MyEventList;
