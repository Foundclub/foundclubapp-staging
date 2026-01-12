import { joiResolver } from '@hookform/resolvers/joi';
// import DateTimePicker from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';
import { format } from 'date-fns';
import React, { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  ScrollView, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import usePlaces from '@/domains/places/usePlaces';
import { useAppContext } from '@/store/appContext';
import { Joi } from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import { formatDateWithDayPrefix } from '@/utils/date';

import Button from '@/components/atoms/button/Button';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import Input from '@/components/molecules/input/Input';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { useGetActivities } from '@/services/activity/activityQueries';
import { useGetCategories } from '@/services/category/categoryQueries';
import { useGetClubs } from '@/services/club/clubQueries';
import { useGetEventTypes } from '@/services/event/eventQueries';
import { useGetLevels } from '@/services/level/levelQueries';
import { useGetTeams } from '@/services/team/teamQueries';

import { getFieldError } from '@/utils/form/formUtils';

import { createSearchAlert } from '@/services/searchAlert/searchAlertService';
import { RouteNames } from '@/navigation/routeNames';

/** @typedef {{ label: string; value: string }} Option */

const filtersSchema = Joi.object({
  activity: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).allow(''),
  category: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).allow(''),
  city: Joi.object().allow(''),
  club: Joi.object({
    label: Joi.string(),
    value: Joi.string(),
  }).allow(null).optional(),
  date: Joi.date().allow(null).optional(),
  level: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).allow(''),
  radius: Joi.number().allow(''),
  team: Joi.object({
    label: Joi.string(),
    value: Joi.string(),
  }).allow(null).optional(),
  type: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).allow(''),
});

/**
 * EventFilters component for filtering events
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} EventFilters component
 */
function EventFilters({ navigation }) {
  // local states
  const [activitySearchValue, setActivitySearchValue] = useState('');
  const [categorySearchValue, setCategorySearchValue] = useState('');
  const [clubSearchValue, setClubSearchValue] = useState('');
  const [levelSearchValue, setLevelSearchValue] = useState('');
  const [typeSearchValue, setTypeSearchValue] = useState('');
  const [teamSearchValue, setTeamSearchValue] = useState('');
  const [selectedClub, setSelectedClub] = useState('');
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [infoModalContent, setInfoModalContent] = useState({ title: '', content: '' });

  // Alert State
  const [isSaveModalVisible, setIsSaveModalVisible] = useState(false);
  const [alertLabel, setAlertLabel] = useState('');
  const [isCreatingAlert, setIsCreatingAlert] = useState(false);

  // hooks
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const [{ eventFilters }, appDispatch] = useAppContext();
  const { getGeohashForPointAndRadius } = usePlaces();
  const insets = useSafeAreaInsets();

  const {
    control,
    formState: { errors: formErrors },
    handleSubmit,
    setValue,
    watch,
    getValues,
  } = useForm({
    defaultValues: {
      activity: eventFilters?.activities || [],
      category: eventFilters?.category || [],
      city: eventFilters?.city || { label: '', value: '' },
      club: eventFilters?.club || null,
      date: eventFilters?.date || null,
      level: eventFilters?.level || [],
      radius: eventFilters?.radius || 20,
      team: eventFilters?.team || null,
      type: eventFilters?.type || [],
    },
    mode: 'onBlur',
    resolver: joiResolver(filtersSchema),
  });

  // Header Star Button
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ marginRight: 16 }}>
          <TouchableOpacity
            onPress={() => setIsSaveModalVisible(true)}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: Colors.primary500, fontSize: 24 }}>★</Text>
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, Colors]);

  const handleCreateAlert = async () => {
    if (!alertLabel.trim()) return;
    setIsCreatingAlert(true);
    try {
      // Get current form values to save as filters
      const currentFilters = getValues();
      await createSearchAlert({
        label: alertLabel,
        filters: currentFilters,
      });
      setIsSaveModalVisible(false);
      setAlertLabel('');
      // Show success feedback (Toast or Alert)
      // For now, navigate to Alerts list as feedback
      navigation.navigate(RouteNames.SearchAlerts);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreatingAlert(false);
    }
  };

  const { data: allActivities } = useGetActivities();
  const { data: allCategories } = useGetCategories();
  const { data: clubPages } = useGetClubs(
    { name: clubSearchValue || undefined },
    { enabled: true },
  );
  const { data: allLevels } = useGetLevels();
  const { data: allTypes } = useGetEventTypes();
  const { data: teamPages } = useGetTeams(
    { clubId: selectedClub || eventFilters?.club?.value || undefined },
    { enabled: !!selectedClub },
  );

  const activities = useMemo(() => {
    const formattedActivities = allActivities?.map(({ documentId, name }) => ({
      label: name,
      value: documentId || '',
    })) || [];

    if (activitySearchValue) {
      return formattedActivities.filter(
        (activity) => activity.label.toLowerCase().includes(
          activitySearchValue.trim().toLowerCase(),
        ),
      );
    }
    return formattedActivities;
  }, [allActivities, activitySearchValue]);

  const categories = useMemo(() => {
    const formattedCategories = allCategories?.map(({ documentId, name }) => ({
      label: name,
      value: documentId || '',
    })) || [];

    if (categorySearchValue) {
      return formattedCategories.filter(
        (category) => category.label.toLowerCase().includes(
          categorySearchValue.trim().toLowerCase(),
        ),
      );
    }
    return formattedCategories;
  }, [allCategories, categorySearchValue]);

  const clubs = useMemo(() => {
    const formattedClubs = clubPages?.pages?.[0]?.data?.map(({ documentId, name }) => ({
      label: name,
      value: documentId || '',
    })) || [];
    return formattedClubs;
  }, [clubPages]);

  const levels = useMemo(() => {
    const formattedLevels = allLevels?.map(({ documentId, name }) => ({
      label: name,
      value: documentId || '',
    })) || [];

    if (levelSearchValue) {
      return formattedLevels.filter(
        (level) => level.label.toLowerCase().includes(
          levelSearchValue.trim().toLowerCase(),
        ),
      );
    }
    return formattedLevels;
  }, [allLevels, levelSearchValue]);

  const types = useMemo(() => {
    const formattedTypes = allTypes?.map(({ documentId, name }) => ({
      label: name,
      value: documentId || '',
    })) || [];

    if (typeSearchValue) {
      return formattedTypes.filter(
        (type) => type.label.toLowerCase().includes(
          typeSearchValue.trim().toLowerCase(),
        ),
      );
    }
    return formattedTypes;
  }, [allTypes, typeSearchValue]);

  const teams = useMemo(() => {
    const formattedTeams = teamPages?.pages?.[0]?.data?.map(({ documentId, name }) => ({
      label: name,
      value: documentId || '',
    })) || [];

    if (teamSearchValue) {
      return formattedTeams.filter(
        (team) => team.label.toLowerCase().includes(
          teamSearchValue.trim().toLowerCase(),
        ),
      );
    }
    return formattedTeams;
  }, [teamPages, teamSearchValue]);

  /**
   * Gets the label of an option based on its value
   * @param {Option[]} options The array of options
   * @param {string} value The value to find
   * @returns {string} The label of the option
   */
  const getOptionLabel = (options, value) => options.find((option) => option.value === value)?.label || '';

  /**
   * Handles applying the selected filters
   * @param {{
   *   activity: string | string[];
   *   category: string | string[];
   *   club: {label: string; value: string} | null;
   *   level: string | string[];
   *   team: {label: string; value: string} | null;
   *   type: string | string[];
   *   city: { label: string; value: string };
   *   radius: number;
   *   date: string | null;
   * }} data - The filter data
   */
  const handleApplyFilters = (data) => {
    // format date params
    let startDateAfter = null;
    let startDateBefore = null;

    if (data.date) {
      const startOfDay = new Date(data.date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(data.date);
      endOfDay.setHours(23, 59, 59, 999);
      startDateAfter = startOfDay;
      startDateBefore = endOfDay;
    }

    // fomat place params
    const coordinates = data.city?.value?.split('|');
    const geohash = (coordinates && data.city?.value) ? getGeohashForPointAndRadius(
      parseFloat(coordinates[1]),
      parseFloat(coordinates[0]),
      data.radius,
    ) : undefined;

    // Extract lat/lon for Haversine filtering
    const lat = coordinates ? parseFloat(coordinates[1]) : undefined;
    const lon = coordinates ? parseFloat(coordinates[0]) : undefined;

    const payload = {
      ...data,
      startDateAfter,
      startDateBefore,
      teamIds: data?.team?.value ? [data.team.value] : null,
      ...(geohash && { geohash }),
      ...(lat && lon && { lat, lon, radius: data.radius }),
    };

    appDispatch({
      payload,
      type: 'SET_EVENT_FILTERS',
    });
    navigation.goBack();
  };

  const handleEmptyFilters = () => {
    appDispatch({ payload: {}, type: 'SET_EVENT_FILTERS' });
    navigation.goBack();
  };

  const openInfoModal = (title, content) => {
    setInfoModalContent({ title, content });
    setInfoModalVisible(true);
  };

  const renderLabel = (label, infoKey) => (
    <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12], Spaces.marginBottom[8]]}>
      <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{label}</Text>
      <TouchableOpacity
        onPress={() => openInfoModal(label, t(`eventFilters.infos.${infoKey}`))}
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: Colors.primary500 + '20',
          borderWidth: 1.5,
          borderColor: Colors.primary500,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={{ color: Colors.primary500, fontSize: 13, fontWeight: '700' }}>i</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingVertical[24],
        Spaces.gap[24],
        Alignments.justifySpaceBetween,
        Alignments.column,
        Alignments.fill,
        { paddingBottom: insets.bottom },
      ]}
    >
      <BottomModal
        close={() => setInfoModalVisible(false)}
        isVisible={infoModalVisible}
      >
        <View style={[Spaces.gap[16], Spaces.paddingTop[16]]}>
          <Text style={[Fonts.h3Bold, Fonts.neutral00]}>{infoModalContent.title}</Text>
          <Text style={[Fonts.p1, Fonts.neutral00]}>{infoModalContent.content}</Text>
        </View>
      </BottomModal>

      <BottomModal
        close={() => setIsSaveModalVisible(false)}
        isVisible={isSaveModalVisible}
      >
        <View style={[Spaces.gap[16]]}>
          <Text style={[Fonts.h3Bold, Fonts.neutral00]}>{t('searchAlerts.create.title', 'Créer une alerte')}</Text>
          <Text style={[Fonts.p1, Fonts.neutral00]}>
            {t('searchAlerts.create.desc', 'Donnez un nom à votre recherche pour recevoir des notifications.')}
          </Text>
          <Input
            onChangeText={setAlertLabel}
            placeholder={t('searchAlerts.create.placeholder', 'Ex: Matchs U13 Marseille')}
            value={alertLabel}
          />
          <Button
            isLoading={isCreatingAlert}
            onPress={handleCreateAlert}
            title={t('common.save', 'Sauvegarder')}
            variant="Primary"
          />
        </View>
      </BottomModal>
      <ScrollView
        contentContainerStyle={[Spaces.gap[40]]}
        style={[Spaces.marginVertical[16]]}
      >
        <Controller
          control={control}
          name="city"
          render={({
            field: {
              onChange, value,
            },
          }) => (
            <AutocompleteAddressInput
              address={value}
              error={getFieldError({ errors: formErrors, fieldName: 'address' })}
              label={t('clubFilters.fields.city.label')}
              placeholder={t('clubFilters.fields.city.placeholder')}
              setAddress={onChange}
            />
          )}
        />

        <Controller
          control={control}
          name="radius"
          render={({
            field: { onChange, value },
          }) => (
            <View style={[Spaces.gap[8]]}>
              <Text style={[
                Fonts.p1Bold,
                Fonts.neutral00]}
              >
                {`${t('clubFilters.fields.radius.label')}${value}km`}
              </Text>
              <Slider
                disabled={!watch('city')?.value}
                maximumTrackTintColor={Colors.primary700}
                maximumValue={50}
                minimumTrackTintColor={Colors.primary500}
                minimumValue={5}
                onValueChange={onChange}
                step={2}
                style={[Alignments.fullWidth, { height: 50 }]}
                tapToSeek
                thumbTintColor={Colors.primary500}
                value={value}
              />
            </View>
          )}
        />
        <Controller
          control={control}
          name="category"
          render={({
            field: { onChange, value },
          }) => (
            <AutocompleteSelect
              error={getFieldError({ errors: formErrors, fieldName: 'category' })}
              isMulti
              label={t('eventFilters.fields.category.label')}
              isSearchable
              options={categories}
              placeholder={t('eventFilters.fields.category.placeholder')}
              searchValue={categorySearchValue}
              setSearchValue={setCategorySearchValue}
              setValue={(/** @type {Option | undefined} */option) => {
                const val = Array.isArray(option) ? option.map((o) => o.value) : option?.value || '';
                onChange(val);
              }}
              value={value}
            />
          )}
        />

        <Controller
          control={control}
          name="club"
          render={({
            field: { onChange, value },
          }) => (
            <AutocompleteSelect
              error={getFieldError({ errors: formErrors, fieldName: 'club' })}
              isSearchable
              label={t('eventFilters.fields.club.label')}
              options={clubs}
              placeholder={t('eventFilters.fields.club.placeholder')}
              searchValue={clubSearchValue}
              setSearchValue={setClubSearchValue}
              setValue={(/** @type {Option | undefined} */option) => {
                const clubValue = option?.value || '';
                onChange(option || null);
                setSelectedClub(clubValue);
                setValue('team', null);
              }}
              value={value?.label || ''}
            />
          )}
        />

        <Controller
          control={control}
          name="team"
          render={({
            field: { onChange, value },
          }) => (
            <AutocompleteSelect
              disabled={!selectedClub && !eventFilters?.club}
              error={getFieldError({ errors: formErrors, fieldName: 'team' })}
              isSearchable
              label={t('eventFilters.fields.team.label')}
              options={teams}
              placeholder={selectedClub
                ? t('eventFilters.fields.team.placeholder')
                : t('eventFilters.fields.team.selectClubFirst')}
              searchValue={teamSearchValue}
              setSearchValue={setTeamSearchValue}
              setValue={(/** @type {Option | undefined} */option) => onChange(option || { label: '', value: '' })}
              value={value?.label || ''}
            />
          )}
        />

        <Controller
          control={control}
          name="level"
          render={({
            field: { onChange, value },
          }) => (
            <AutocompleteSelect
              error={getFieldError({ errors: formErrors, fieldName: 'level' })}
              isMulti
              label={t('eventFilters.fields.level.label')}
              isSearchable
              options={levels}
              placeholder={t('eventFilters.fields.level.placeholder')}
              searchValue={levelSearchValue}
              setSearchValue={setLevelSearchValue}
              setValue={(/** @type {Option | undefined} */option) => {
                const val = Array.isArray(option) ? option.map((o) => o.value) : option?.value || '';
                onChange(val);
              }}
              value={value}
            />
          )}
        />

        <Controller
          control={control}
          name="activity"
          render={({
            field: { onChange, value },
          }) => (
            <AutocompleteSelect
              error={getFieldError({ errors: formErrors, fieldName: 'activity' })}
              isMulti
              isSearchable
              label={t('eventFilters.fields.activity.label')}
              options={activities}
              placeholder={t('eventFilters.fields.activity.placeholder')}
              searchValue={activitySearchValue}
              setSearchValue={setActivitySearchValue}
              setValue={(/** @type {Option | undefined} */option) => {
                const val = Array.isArray(option) ? option.map((o) => o.value) : option?.value || '';
                onChange(val);
              }}
              value={value}
            />
          )}
        />

        <Controller
          control={control}
          name="type"
          render={({
            field: { onChange, value },
          }) => (
            <AutocompleteSelect
              error={getFieldError({ errors: formErrors, fieldName: 'type' })}
              isMulti
              label={t('eventFilters.fields.type.label')}
              isSearchable
              options={types}
              placeholder={t('eventFilters.fields.type.placeholder')}
              searchValue={typeSearchValue}
              setSearchValue={setTypeSearchValue}
              setValue={(/** @type {Option | undefined} */option) => {
                const val = Array.isArray(option) ? option.map((o) => o.value) : option?.value || '';
                onChange(val);
              }}
              value={value}
            />
          )}
        />

        <Controller
          control={control}
          name="date"
          render={({
            field: { onChange, value },
          }) => (
            <>
              <Input
                error={getFieldError({ errors: formErrors, fieldName: 'date' })}
                inputMode="none"
                label={t('eventFilters.fields.date.label')}
                onPressIn={() => setIsDatePickerVisible(true)}
                placeholder={t('eventFilters.fields.date.placeholder')}
                readOnly
                style={[Fonts.neutral00]}
                value={value ? formatDateWithDayPrefix(value) : ''}
              />
              <BottomModal
                close={() => setIsDatePickerVisible(false)}
                isVisible={isDatePickerVisible}
              >
                {/* <DateTimePicker
                  display="spinner"
                  minimumDate={new Date()}
                  mode="date"
                  onChange={(event, selectedDate) => {
                    setIsDatePickerVisible(false);
                    if (event.type === 'set' && selectedDate) {
                      onChange(selectedDate);
                    }
                  }}
                  value={value ? new Date(value) : new Date()}
                /> */}
                <Text style={{ color: 'white', padding: 20, textAlign: 'center' }}>Date Picker temporarily disabled</Text>
              </BottomModal>
            </>
          )}
        />
      </ScrollView>

      <View style={[Spaces.gap[24]]}>
        <Button
          onPress={handleEmptyFilters}
          title={t('eventFilters.actions.clear')}
          variant="Secondary"
        />
        <Button
          onPress={handleSubmit(handleApplyFilters)}
          title={t('eventFilters.actions.apply')}
          variant="Primary"
        />
      </View>
    </ScreenContainer>
  );
}

export default EventFilters;
