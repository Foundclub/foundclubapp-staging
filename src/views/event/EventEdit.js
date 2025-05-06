import { joiResolver } from '@hookform/resolvers/joi';
import { format } from 'date-fns';
import Joi from 'joi';
import { useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView, Platform, View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import useEvent from '@/domains/event/useEvent';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import Input from '@/components/molecules/input/Input';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { useGetMe } from '@/services/auth/authQueries';
import {
  useCreateEvent, useGetEvent, useGetEventTypes, useUpdateEvent,
} from '@/services/event/eventQueries';

import { getFieldError } from '@/utils/form/formUtils';

const defaultValues = {
  capacity: 1,
  date: '',
  description: '',
  location: undefined,
  sessionStatus: 'open',
  team: undefined,
  time: '',
  type: undefined,
  validationMode: 'auto',
};

const eventSchema = Joi.object({
  capacity: Joi.number().min(1).required(),
  date: Joi.string().pattern(/^(\d{2}\/\d{2}\/\d{4})?$/).allow('').optional(),
  description: Joi.string().allow('').optional(),
  documentId: Joi.string().allow(null, '').optional(),
  location: Joi.object().allow(null, '').optional(),
  sessionStatus: Joi.string().valid('open', 'closed').required(),
  team: Joi.string().required(),
  time: Joi.string().pattern(/^(\d{2}:\d{2})?$/).allow('').optional(),
  type: Joi.string().required(),
  validationMode: Joi.string().valid('auto', 'manual').required(),
}).unknown(true);

/**
 * Event edit/create screen component
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Event edit screen component
 */
function EventEdit({ navigation, route }) {
  // hooks
  const { eventId } = route?.params || {};
  const {
    Alignments, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { data: userData } = useGetMe();
  const { data: event } = useGetEvent(eventId);
  const { data: eventTypes } = useGetEventTypes();
  const {
    formatDateInput,
    formatDateTimeToSend,
    formatTimeInput,
    sessionStatusOptions,
    validationModeOptions,
  } = useEvent();

  const createEventMutation = useCreateEvent({
    onSuccess: () => {
      navigation.goBack();
    },
  });

  const updateEventMutation = useUpdateEvent({
    onSuccess: () => {
      navigation.goBack();
    },
  });

  const {
    control,
    formState: { errors: formErrors },
    handleSubmit,
    setFocus,
  } = useForm({
    defaultValues: {
      ...defaultValues,
      capacity: event?.capacity || 1,
      date: event?.date ? format(new Date(event?.date), 'dd/MM/yyyy') : '',
      description: event?.description || '',
      location: {
        label: event?.locationDetails ? JSON.parse(event?.locationDetails)?.address : '',
        value: `${event?.location?.lat}|${event?.location?.lng}`,
      },
      sessionStatus: event?.sessionStatus || 'open',
      team: event?.team?.documentId || '',
      time: event?.date ? format(new Date(event?.date), 'HH:mm') : '',
      type: event?.type?.documentId || '',
      validationMode: event?.validationMode || 'auto',
    },
    mode: 'onBlur',
    resolver: joiResolver(eventSchema),
    shouldFocusError: false,
  });

  /**
   * Handle form submit
   * @param {any} data
   * @returns {void}
   */
  const handleFormSubmit = (data) => {
    // Safely handle location data
    const splittedLocation = data.location?.value?.split('|');
    const formattedData = {
      ...data,
      date: formatDateTimeToSend(data.date, data.time),
      location: splittedLocation?.length === 2 ? {
        lat: parseFloat(splittedLocation[1]) || 0,
        lng: parseFloat(splittedLocation[0]) || 0,
      } : data.location,
    };

    delete formattedData.time;

    if (eventId) {
      updateEventMutation.mutate({
        documentId: eventId,
        ...formattedData,
      });
    } else {
      createEventMutation.mutate(formattedData);
    }
  };

  const eventTypeOptions = eventTypes?.map((type) => ({
    label: type.name,
    value: type.documentId,
  })) || [];

  const teamOptions = userData?.trainedTeams?.map((team) => ({
    label: team.name,
    value: team.documentId || '',
  })) || [];

  // Set navigation options to change the header title based on whether editing or creating
  useMemo(() => {
    navigation.setOptions({
      headerTitle: eventId
        ? t('eventEdit.titleEdit')
        : t('eventEdit.title'),
    });
  }, [navigation, eventId, t]);

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[Spaces.paddingVertical[24]]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
        style={[Alignments.justifySpaceBetween, Alignments.fill]}
      >
        <ScrollView
          contentContainerStyle={[
            Spaces.gap[24],
            Spaces.paddingBottom[40],
          ]}
          style={[Alignments.fill]}
        >
          <View style={[Alignments.fill, Spaces.gap[24]]}>

            <Controller
              control={control}
              name="type"
              render={({
                field: {
                  name, onBlur, onChange, value,
                },
              }) => (
                <AutocompleteSelect
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  label={t('eventEdit.fields.type.label')}
                  onBlur={onBlur}
                  options={eventTypeOptions}
                  placeholder={t('eventEdit.fields.type.placeholder')}
                  setValue={(/** @type {Option} */option) => {
                    onChange(option?.value);
                  }}
                  value={eventTypeOptions.find((option) => option.value === value)?.label || ''}
                />
              )}
            />

            <Controller
              control={control}
              name="team"
              render={({
                field: {
                  name, onBlur, onChange, value,
                },
              }) => (
                <AutocompleteSelect
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  label={t('eventEdit.fields.team.label')}
                  onBlur={onBlur}
                  options={teamOptions}
                  placeholder={t('eventEdit.fields.team.placeholder')}
                  setValue={(/** @type {Option} */option) => {
                    onChange(option?.value);
                  }}
                  value={teamOptions.find((option) => option.value === value)?.label || ''}
                />
              )}
            />

            <Controller
              control={control}
              name="location"
              render={({
                field: {
                  name, onChange, value,
                },
              }) => (
                <AutocompleteAddressInput
                  address={value}
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  label={t('eventEdit.fields.location.label')}
                  placeholder={t('eventEdit.fields.location.placeholder')}
                  setAddress={onChange}
                  type="housenumber"
                />
              )}
            />

            <Controller
              control={control}
              name="date"
              render={({
                field: {
                  name, onBlur, onChange, ref, value,
                },
              }) => (
                <Input
                  enterKeyHint="done"
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  inputMode="numeric"
                  keyboardType="numeric"
                  label={t('eventEdit.fields.date.label')}
                  maxLength={10}
                  onBlur={onBlur}
                  onChangeText={(val) => onChange(formatDateInput(val))}
                  onSubmitEditing={() => setFocus('time')}
                  placeholder="DD/MM/YYYY"
                  ref={ref}
                  value={value}
                />
              )}
            />

            <Controller
              control={control}
              name="time"
              render={({
                field: {
                  name, onBlur, onChange, ref, value,
                },
              }) => (
                <Input
                  enterKeyHint="done"
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  inputMode="numeric"
                  keyboardType="numeric"
                  label={t('eventEdit.fields.time.label')}
                  maxLength={5}
                  onBlur={onBlur}
                  onChangeText={(val) => onChange(formatTimeInput(val))}
                  placeholder="HH:mm"
                  ref={ref}
                  value={value}
                />
              )}
            />

            <Controller
              control={control}
              name="description"
              render={({
                field: {
                  name, onBlur, onChange, ref, value,
                },
              }) => (
                <Input
                  enterKeyHint="enter"
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  label={t('eventEdit.fields.description.label')}
                  multiline
                  onBlur={onBlur}
                  onChangeText={onChange}
                  placeholder={t('eventEdit.fields.description.placeholder')}
                  ref={ref}
                  value={value || ''}
                />
              )}
            />

            <Controller
              control={control}
              name="sessionStatus"
              render={({
                field: {
                  name, onBlur, onChange, value,
                },
              }) => (
                <AutocompleteSelect
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  label={t('eventEdit.fields.sessionStatus.label')}
                  onBlur={onBlur}
                  options={sessionStatusOptions}
                  setValue={(/** @type {Option} */option) => {
                    onChange(option?.value || '');
                  }}
                  value={sessionStatusOptions.find((option) => option.value === value)?.label || ''}
                />
              )}
            />

            <Controller
              control={control}
              name="validationMode"
              render={({
                field: {
                  name, onBlur, onChange, value,
                },
              }) => (
                <AutocompleteSelect
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  label={t('eventEdit.fields.validationMode.label')}
                  onBlur={onBlur}
                  options={validationModeOptions}
                  setValue={(/** @type {Option} */option) => {
                    onChange(option?.value || '');
                  }}
                  value={validationModeOptions.find((option) => option.value === value)?.label || ''}
                />
              )}
            />

            <Controller
              control={control}
              name="capacity"
              render={({
                field: {
                  name, onBlur, onChange, ref, value,
                },
              }) => (
                <Input
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  inputMode="numeric"
                  keyboardType="number-pad"
                  label={t('eventEdit.fields.capacity.label')}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  onSubmitEditing={() => setFocus('type')}
                  placeholder={t('eventEdit.fields.capacity.placeholder')}
                  ref={ref}
                  value={value?.toString() || ''}
                />
              )}
            />
          </View>
        </ScrollView>
        <Button
          isLoading={createEventMutation.isPending || updateEventMutation.isPending}
          onPress={handleSubmit(handleFormSubmit)}
          title={t('eventEdit.actions.save')}
          variant="Primary"
        />
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

export default EventEdit;
