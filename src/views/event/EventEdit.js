import { joiResolver } from '@hookform/resolvers/joi';
import { useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import Joi from 'joi';
import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  Switch,
  Text,
  View,
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
  useGetEvent,
  useGetEventTypes,
} from '@/services/event/eventQueries';
import { createEvent, updateEvent } from '@/services/event/eventService';

import { getFieldError } from '@/utils/form/formUtils';

const defaultValues = {
  capacity: null,
  date: '',
  description: '',
  isRecurrent: false,
  location: undefined,
  recurrenceDay: '',
  recurrenceEndDate: '',
  recurrenceFrequency: 'week',
  recurrenceStartDate: '',
  sessionStatus: 'open',
  team: undefined,
  time: '',
  type: undefined,
  validationMode: 'auto',
};

const eventSchema = Joi.object({
  capacity: Joi.number().allow(null, '').optional(),
  date: Joi.string().pattern(/^(\d{2}\/\d{2}\/\d{4})?$/).allow('').optional(),
  description: Joi.string().allow('').optional(),
  documentId: Joi.string().allow(null, '').optional(),
  isRecurrent: Joi.boolean().required(),
  location: Joi.object().allow(null, '').optional(),
  recurrenceDay: Joi.when('isRecurrent', {
    is: true,
    otherwise: Joi.string().allow('').optional(),
    then: Joi.string().required(),
  }),
  recurrenceEndDate: Joi.when('isRecurrent', {
    is: true,
    otherwise: Joi.string().allow('').optional(),
    then: Joi.string().pattern(/^(\d{2}\/\d{2}\/\d{4})?$/).required(),
  }),
  recurrenceFrequency: Joi.when('isRecurrent', {
    is: true,
    otherwise: Joi.string().allow('').optional(),
    then: Joi.string().valid('week', 'month').required(),
  }),
  recurrenceStartDate: Joi.when('isRecurrent', {
    is: true,
    otherwise: Joi.string().allow('').optional(),
    then: Joi.string().pattern(/^(\d{2}\/\d{2}\/\d{4})?$/).required(),
  }),
  sessionStatus: Joi.string().valid('open', 'closed').required(),
  team: Joi.string().required(),
  time: Joi.string().pattern(/^(\d{2}:\d{2})?$/).allow('').optional(),
  type: Joi.string().required(),
  validationMode: Joi.string().valid('auto', 'manual').required(),
}).unknown(true);

/**
 * EventEdit component for creating and editing events
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} EventEdit component
 */
function EventEdit({ navigation, route }) {
  const { eventId } = route?.params || {};
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { data: userData } = useGetMe();
  const { data: event } = useGetEvent(eventId);
  const { data: eventTypes } = useGetEventTypes();
  const {
    createReccurrentEventPayload,
    formatDateInput,
    formatTimeInput,
    getReccurrenceDayOptions,
    recurrenceFrequencyOptions,
    sessionStatusOptions,
    validationModeOptions,
  } = useEvent();

  const createEventMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      navigation.goBack();
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: updateEvent,
    onSuccess: () => {
      navigation.goBack();
    },
  });

  const {
    control,
    formState: { errors: formErrors },
    handleSubmit,
    setFocus,
    setValue,
    watch,
  } = useForm({
    defaultValues: {
      ...defaultValues,
      capacity: event?.capacity,
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

  const recurrenceFrequency = watch('recurrenceFrequency');

  const recurrenceDayOptions = useMemo(
    () => getReccurrenceDayOptions(recurrenceFrequency),
    [recurrenceFrequency, getReccurrenceDayOptions],
  );

  const eventTypeOptions = eventTypes?.map((type) => ({
    label: type.name,
    value: type.documentId,
  })) || [];

  const teamOptions = userData?.trainedTeams?.map((team) => ({
    label: team.name,
    value: team.documentId || '',
  })) || [];

  // Set navigation options to change the header title based on whether editing or creating
  useEffect(() => {
    navigation.setOptions({
      headerTitle: eventId
        ? t('eventEdit.titleEdit')
        : t('eventEdit.title'),
    });
  }, [navigation, eventId, t]);

  /**
   * Handle form submit
   * @param {FCEventForm} data
   * @returns {Promise<void>}
   */
  const handleFormSubmit = async (data) => {
    const formattedEvents = createReccurrentEventPayload(data);

    if (eventId) {
      updateEventMutation.mutate({
        documentId: eventId,
        eventData: formattedEvents[0],
      });
    } else {
      const promises = formattedEvents.map(
        (eventData) => createEventMutation.mutateAsync(eventData),
      );

      await Promise.all(promises);
      navigation.goBack();
    }
  };

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
                  type=""
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
                  enterKeyHint="next"
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
            <Controller
              control={control}
              name="date"
              render={({
                field: {
                  name, onBlur, onChange, ref, value,
                },
              }) => (
                <Input
                  enterKeyHint="next"
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

            {eventId ? null : (
              <Controller
                control={control}
                name="isRecurrent"
                render={({
                  field: {
                    name, onChange, value,
                  },
                }) => (
                  <View style={[Spaces.gap[24]]}>
                    <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[16]]}>
                      <Switch
                        key={name}
                        onValueChange={(newValue) => {
                          onChange(newValue);
                          if (newValue) {
                            const dateValue = watch('date');
                            if (dateValue) {
                              setValue('recurrenceStartDate', dateValue);
                            }
                          }
                        }}
                        trackColor={{ false: Colors.neutral700, true: Colors.primary500 }}
                        value={value}
                      />
                      <Text style={[Fonts.p1, Fonts.neutral00]}>
                        {t('eventEdit.fields.isRecurrent.label')}
                      </Text>
                    </View>
                    {value && (
                    <View style={[Spaces.gap[16]]}>
                      <Controller
                        control={control}
                        name="recurrenceStartDate"
                        render={({
                          field: {
                            name: fieldName, onBlur,
                            onChange: onFieldChange, ref, value: fieldValue,
                          },
                        }) => (
                          <Input
                            enterKeyHint="done"
                            error={getFieldError({ errors: formErrors, fieldName })}
                            inputMode="numeric"
                            keyboardType="numeric"
                            label={t('eventEdit.fields.recurrenceStartDate.label')}
                            maxLength={10}
                            onBlur={onBlur}
                            onChangeText={(val) => onFieldChange(formatDateInput(val))}
                            placeholder="DD/MM/YYYY"
                            ref={ref}
                            value={fieldValue}
                          />
                        )}
                      />

                      <Controller
                        control={control}
                        name="recurrenceEndDate"
                        render={({
                          field: {
                            name: fieldName, onBlur,
                            onChange: onFieldChange, ref, value: fieldValue,
                          },
                        }) => (
                          <Input
                            enterKeyHint="done"
                            error={getFieldError({ errors: formErrors, fieldName })}
                            inputMode="numeric"
                            keyboardType="numeric"
                            label={t('eventEdit.fields.recurrenceEndDate.label')}
                            maxLength={10}
                            onBlur={onBlur}
                            onChangeText={(val) => onFieldChange(formatDateInput(val))}
                            placeholder="DD/MM/YYYY"
                            ref={ref}
                            value={fieldValue}
                          />
                        )}
                      />

                      <Controller
                        control={control}
                        name="recurrenceFrequency"
                        render={({
                          field: {
                            name: fieldName, onBlur, onChange: onFieldChange, value: fieldValue,
                          },
                        }) => (
                          <AutocompleteSelect
                            error={getFieldError({ errors: formErrors, fieldName })}
                            label={t('eventEdit.fields.recurrenceFrequency.label')}
                            onBlur={onBlur}
                            options={recurrenceFrequencyOptions}
                            setValue={(/** @type {Option} */option) => onFieldChange(option?.value || '')}
                            value={recurrenceFrequencyOptions.find((option) => option.value === fieldValue)?.label || ''}
                          />
                        )}
                      />

                      <Controller
                        control={control}
                        name="recurrenceDay"
                        render={({
                          field: {
                            name: fieldName, onBlur, onChange: onFieldChange, value: fieldValue,
                          },
                        }) => (
                          <AutocompleteSelect
                            error={getFieldError({ errors: formErrors, fieldName })}
                            label={t('eventEdit.fields.recurrenceDay.label')}
                            onBlur={onBlur}
                            options={recurrenceDayOptions}
                            setValue={(/** @type {Option} */ option) => onFieldChange(option?.value || '')}
                            value={recurrenceDayOptions.find((option) => option.value === fieldValue)?.label || ''}
                          />
                        )}
                      />
                    </View>
                    )}
                  </View>
                )}
              />
            )}
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
