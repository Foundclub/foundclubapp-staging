import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, Platform, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import { USER_ROLES } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Tag from '@/components/atoms/tag/Tag';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
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
  const [isTimeFilterModalVisible, setIsTimeFilterModalVisible] = useState(false);
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(/** @type {Date | undefined} */ (undefined));
  const [timeFilter, setTimeFilter] = useState(/** @type {'next' | 'past' | 'date'} */ ('next'));

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

  // Compute date filters based on selected time filter and date
  const dateFilter = useMemo(() => {
    const now = new Date();

    if (timeFilter === 'past') {
      return { sort: 'date:desc', startDateBefore: now };
    }
    if (timeFilter === 'next') {
      return { startDateAfter: now };
    }
    if (timeFilter === 'date' && selectedDate) {
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      return {
        startDateAfter: startOfDay,
        startDateBefore: endOfDay,
      };
    }

    return {};
  }, [timeFilter, selectedDate]);

  // Compute filters based on user role and context
  const eventFilters = useMemo(() => {
    // If user is a player, show events they participate in and closed events from their teams
    if (userData?.role?.name === USER_ROLES.player) {
      return {
        participantId: userData?.documentId,
        playerEventsFilter: true,
        teamIds: teamIds.length > 0 ? teamIds : undefined,
        type: selectedType || undefined,
        ...dateFilter,
      };
    }

    // For other roles, just show their team events
    return {
      participantId: userData?.documentId,
      teamIds: teamIds.length > 0 ? teamIds : undefined,
      trainerEventsFilter: true,
      type: selectedType || undefined,
      ...dateFilter,
    };
  }, [userData?.documentId,
    userData?.role,
    teamIds,
    selectedType,
    dateFilter]);

  const handleOpenTimeFilterModal = () => {
    setIsTimeFilterModalVisible(true);
  };

  /**
   * Handle time filter selection
   * @param {'next' | 'past' | 'date'} filter - Selected time filter
   */
  const handleTimeFilterSelect = (filter) => {
    setTimeFilter(filter);
    if (filter === 'date') {
      setIsDatePickerVisible(true);
      setSelectedDate(new Date());
    } else {
      setIsTimeFilterModalVisible(false);
    }
  };

  /**
   * Handle date selection from the date picker
   * @param {Date} [date] - Selected date
   */
  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setIsDatePickerVisible(false);
    setIsTimeFilterModalVisible(false);
  };

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
        <Image source={Images.logo} style={{ height: 30, resizeMode: 'contain', width: 222 }} />
        <ProfileButton />
      </View>
      <TouchableOpacity
        onPress={handleOpenTimeFilterModal}
        style={[Alignments.row, Alignments.alignEnd, Spaces.gap[8]]}
      >
        <Text style={[Fonts.p1Black, Fonts.neutral00, Spaces.marginTop[16]]}>
          {timeFilter === 'next' && t('myEventList.fields.timeFilter.next')}
          {timeFilter === 'past' && t('myEventList.fields.timeFilter.past')}
          {timeFilter === 'date' && selectedDate && format(selectedDate, 'd MMMM yyyy', { locale: fr })}
        </Text>
        <Image
          source={Images.chevronDown}
          style={[ApplicationStyle.icon20, ApplicationStyle.tintColor.neutral00]}
        />
      </TouchableOpacity>
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
      {Object.keys(eventFilters)?.length > 3 ? (
        <EventListContent
          additionalFilters={eventFilters}
        />
      ) : null}
      {
        canManageEvents ? (
          <Button
            onPress={handleAddEvent}
            title={t('eventList.actions.add')}
            variant="Primary"
          />
        ) : null
      }

      <BottomModal
        close={() => setIsTimeFilterModalVisible(false)}
        isVisible={isTimeFilterModalVisible}
        style={{ minHeight: '80%' }}
      >
        {isDatePickerVisible ? (
          <>
            <DateTimePicker
              display="spinner"
              mode="date"
              onChange={(event, date) => {
                if (event.type === 'set' && date) {
                  if (Platform.OS === 'android') {
                    handleDateSelect(date);
                  } else {
                    setSelectedDate(date);
                  }
                } else {
                  setIsDatePickerVisible(false);
                }
              }}
              value={selectedDate || new Date()}
            />
            {Platform.OS === 'ios'
              ? (
                <Button
                  isOption
                  onPress={() => handleDateSelect(selectedDate)}
                  title={t('myEventList.actions.closeTimeFilter')}
                  variant="Primary"
                />
              ) : null}
          </>
        )
          : (
            <View
              style={[
                Spaces.gap[16],
                Spaces.marginTop[24],
              ]}
            >
              <Button
                isOption
                onPress={() => handleTimeFilterSelect('next')}
                title={t('myEventList.fields.timeFilter.next')}
                variant="Secondary"
              />
              <Button
                isOption
                onPress={() => handleTimeFilterSelect('past')}
                title={t('myEventList.fields.timeFilter.past')}
                variant="Secondary"
              />
              <Button
                isOption
                onPress={() => handleTimeFilterSelect('date')}
                title={t('myEventList.fields.timeFilter.selectDate')}
                variant="Secondary"
              />
            </View>
          )}
      </BottomModal>

    </ScreenContainer>
  );
}

export default MyEventList;
