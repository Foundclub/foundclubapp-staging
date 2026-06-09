// @ts-nocheck
import { joiResolver } from '@hookform/resolvers/joi';
import { useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import Joi from 'joi';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Switch,
  Text,
  View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { USER_ROLES } from '@/domains/auth/authUseCases';
import useEvent from '@/domains/event/useEvent';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import DateTimeSelector from '@/components/molecules/dateTimeSelector/DateTimeSelector';
import DayPicker from '@/components/molecules/dayPicker/DayPicker';
import Input from '@/components/molecules/input/Input';
import FacilitySelector from '@/components/organisms/facilitySelector/FacilitySelector';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetMe } from '@/services/auth/authQueries';
import {
  useGetEventForEdit,
  useGetEventTypes,
} from '@/services/event/eventQueries';
import { createEvent, updateEvent } from '@/services/event/eventService';
import { getTeams } from '@/services/team/teamService';

import { getFieldError } from '@/utils/form/formUtils';
import safeJsonParse from '@/utils/safeJsonParse';

import EventTasksEditor from './components/EventTasksEditor';
import EventTeamAudiencesEditor from './components/EventTeamAudiencesEditor';

/** @typedef {import('@/domains/event/types').FCEventForm} FCEventForm */
/** @typedef {import('@/domains/team/types').Team} Team */

const defaultValues = {
  capacity: null,
  date: '',
  description: '',
  endTime: '',
  eventTasks: [],
  facility: null,
  invitedTeams: /** @type {string[]} */ ([]),
  isRecurrent: false,
  location: undefined,
  participantIdentityVisibility: 'VISIBLE',
  pricePerPerson: null,
  recurrenceDay: '',
  recurrenceDays: /** @type {number[]} */ ([]),
  recurrenceEndDate: '',
  recurrenceFrequency: 'week',
  recurrenceInterval: 1,
  recurrenceStartDate: '',
  reservationMode: 'FULL_GROUP',
  sessionStatus: 'open',
  startTime: '',
  team: undefined,
  teamAudiences: [],
  totalPlayers: null,
  type: undefined,
  validationMode: 'auto',
};

const buildOccupancyWindow = (dateValue, startTime, endTime, getDateFromDateInput) => {
  if (!dateValue || !startTime || !endTime || typeof getDateFromDateInput !== 'function') {
    return null;
  }

  const baseDate = getDateFromDateInput(dateValue);
  if (!baseDate || Number.isNaN(baseDate.getTime())) {
    return null;
  }

  const toIso = (timeValue) => {
    const [hours, minutes] = String(timeValue || '').split(':').map((part) => Number(part));
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    const combined = new Date(baseDate);
    combined.setHours(hours, minutes, 0, 0);
    return combined.toISOString();
  };

  const start = toIso(startTime);
  const end = toIso(endTime);
  if (!start || !end) return null;

  return { end, start };
};

const getEventLocationLabel = (locationDetails) => {
  const parsed = safeJsonParse(locationDetails, null);
  const address = parsed?.address;
  if (typeof address === 'object') {
    return String(address?.description || address?.label || '').trim();
  }
  return String(address || '').trim();
};

const getDatePickerValue = (value, getDateFromDateInput) => {
  const parsedDate = typeof getDateFromDateInput === 'function' ? getDateFromDateInput(value) : null;
  if (parsedDate instanceof Date && !Number.isNaN(parsedDate.getTime())) {
    return parsedDate;
  }
  return new Date();
};

const getTimePickerValue = (value) => {
  const baseDate = new Date();
  baseDate.setSeconds(0, 0);
  const [hours, minutes] = String(value || '').split(':').map((part) => Number(part));
  baseDate.setHours(Number.isFinite(hours) ? hours : 0);
  baseDate.setMinutes(Number.isFinite(minutes) ? minutes : 0);
  return baseDate;
};

const clampDateToToday = (value) => {
  const normalizedDate = value instanceof Date && !Number.isNaN(value.getTime()) ? new Date(value) : new Date();
  normalizedDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return normalizedDate < today ? today : normalizedDate;
};

const eventSchema = Joi.object({
  capacity: Joi.number().allow(null, '').optional(),
  date: Joi.string()
    .pattern(/^(\d{2}\/\d{2}\/\d{4})?$/)
    .allow('')
    .optional()
    .custom((value, helpers) => {
      if (!value) return value;
      const parts = value.split('/');
      if (parts.length !== 3) return value;
      const year = parseInt(parts[2], 10);
      // Vérifier que l'année est raisonnable (entre 2020 et 2100)
      if (year < 2020 || year > 2100) {
        return helpers.error('date.invalidYear');
      }
      return value;
    })
    .messages({
      'date.invalidYear': 'L\'année doit être entre 2020 et 2100',
    }),
  description: Joi.string().allow('').optional(),
  documentId: Joi.string().allow(null, '').optional(),
  endTime: Joi.string().pattern(/^(\d{2}:\d{2})?$/).allow('').optional(),
  eventTasks: Joi.array().items(Joi.object().unknown(true)).optional(),
  facility: Joi.string().allow(null, '').optional(),
  invitedTeams: Joi.array().items(Joi.string()).optional(),
  isRecurrent: Joi.boolean().required(),
  location: Joi.object().allow(null, '').optional(),
  participantIdentityVisibility: Joi.string().valid('VISIBLE', 'ANONYMIZED').required(),
  pricePerPerson: Joi.number().allow(null, '').optional(),
  recurrenceDay: Joi.when('isRecurrent', {
    is: true,
    otherwise: Joi.string().allow('').optional(),
    then: Joi.string().allow('').optional(),
  }),
  recurrenceDays: Joi.array().items(Joi.number()).optional(),
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
  recurrenceInterval: Joi.number().min(1).optional(),
  recurrenceStartDate: Joi.when('isRecurrent', {
    is: true,
    otherwise: Joi.string().allow('').optional(),
    then: Joi.string().pattern(/^(\d{2}\/\d{2}\/\d{4})?$/).required(),
  }),
  reservationMode: Joi.string().valid('FULL_GROUP', 'RECRUITING').optional(),
  sessionStatus: Joi.string().valid('open', 'closed').required(),
  startTime: Joi.string().pattern(/^(\d{2}:\d{2})?$/).required(),
  team: Joi.string().required(),
  teamAudiences: Joi.array().items(Joi.object().unknown(true)).optional(),
  totalPlayers: Joi.number().allow(null, '').optional(),
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
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { data: userData } = useGetMe();
  const { data: event } = useGetEventForEdit(eventId);
  const { data: eventTypes } = useGetEventTypes();
  const {
    createEventUpdatePayload,
    createReccurrentEventPayload,
    formatDateInput,
    formatTimeInput,
    getDateFromDateInput,
    getEventEditSupport,
    getReccurrenceDayOptions,
    recurrenceFrequencyOptions,
    sessionStatusOptions,
    validationModeOptions,
  } = useEvent();

  const isClubManager = userData?.role?.name === USER_ROLES.president;

  const eventTypeOptions = eventTypes?.map((type) => ({
    label: type.name,
    value: type.documentId,
  })) || [];
  const participantIdentityVisibilityOptions = [
    {
      label: t('eventEdit.fields.participantIdentityVisibility.options.visible', 'Identites visibles'),
      value: 'VISIBLE',
    },
    {
      label: t('eventEdit.fields.participantIdentityVisibility.options.anonymized', 'Participants anonymises'),
      value: 'ANONYMIZED',
    },
  ];
  const [selectedOccupancy, setSelectedOccupancy] = useState(null);

  const createEventMutation = useMutation({
    mutationFn: createEvent,
    onError: (error) => {
      console.error('Error creating event:', error);
    },
    onSuccess: () => {
      console.log('Event created successfully');
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: updateEvent,
    onError: (error) => {
      console.error('Error updating event:', error);
    },
    onSuccess: () => {
      console.log('Event updated successfully');
    },
  });

  let initialDateValue = '';
  if (event?.date) {
    initialDateValue = format(new Date(event.date), 'dd/MM/yyyy');
  } else if (route.params?.date) {
    initialDateValue = format(new Date(route.params.date), 'dd/MM/yyyy');
  }

  const {
    control,
    formState: { errors: formErrors },
    handleSubmit,
    reset,
    setFocus,
    setValue,
    watch,
  } = useForm({
    defaultValues: {
      ...defaultValues,
      capacity: event?.capacity,
      date: initialDateValue,
      description: event?.description || '',
      endTime: event?.endTime ? event.endTime.substring(0, 5) : '',
      eventTasks: Array.isArray(event?.eventTasks) ? event.eventTasks : [],
      facility: event?.facility?.documentId || null,
      invitedTeams: event?.invitedTeams?.map(
        (/** @type {Team} */ invitedTeam) => invitedTeam.documentId || '',
      ) || [],
      location: {
        label: getEventLocationLabel(event?.locationDetails),
        value: `${event?.location?.lat}|${event?.location?.lng}`,
      },
      participantIdentityVisibility: event?.participantIdentityVisibility || 'VISIBLE',
      pricePerPerson: event?.pricePerPerson,
      reservationMode: event?.reservationMode || 'FULL_GROUP',
      sessionStatus: event?.sessionStatus || 'open',
      startTime: event?.startTime ? event.startTime.substring(0, 5) : '',
      team: event?.team?.documentId || '',
      teamAudiences: Array.isArray(event?.teamAudiences) ? event.teamAudiences : [],
      totalPlayers: event?.totalPlayers,
      type: event?.type?.documentId || '',
      validationMode: event?.validationMode || 'auto',
    },
    mode: 'onBlur',
    resolver: joiResolver(eventSchema),
    shouldFocusError: false,
  });

  const recurrenceFrequency = watch('recurrenceFrequency');
  const selectedType = watch('type');
  const selectedTeamId = watch('team');
  const selectedDate = watch('date');
  const selectedStartTime = watch('startTime');
  const selectedEndTime = watch('endTime');
  const selectedFacilityId = watch('facility');
  const isRecurrent = watch('isRecurrent');
  const occupancyWindow = useMemo(
    () => buildOccupancyWindow(selectedDate, selectedStartTime, selectedEndTime, getDateFromDateInput),
    [getDateFromDateInput, selectedDate, selectedEndTime, selectedStartTime],
  );
  const selectedTypeData = useMemo(
    () => eventTypes?.find((eventType) => eventType.documentId === selectedType) || event?.type || null,
    [event?.type, eventTypes, selectedType],
  );
  const editSupport = useMemo(
    () => getEventEditSupport(event, selectedTypeData?.name),
    [event, getEventEditSupport, selectedTypeData?.name],
  );

  useEffect(() => {
    if (isRecurrent && selectedDate) {
      const parsedDate = getDateFromDateInput(selectedDate);
      if (parsedDate) {
        if (recurrenceFrequency === 'week') {
          // Auto-select day of week (0=Sun, 1=Mon, ...)
          const dayIndex = parsedDate.getDay();
          setValue('recurrenceDays', [dayIndex]);
        } else if (recurrenceFrequency === 'month') {
          const dayOfMonth = parsedDate.getDate();
          setValue('recurrenceDay', dayOfMonth.toString());
        }
      }
    }
  }, [selectedDate, isRecurrent, recurrenceFrequency, setValue, getDateFromDateInput]);

  const trainedTeams = useMemo(
    () => (Array.isArray(userData?.trainedTeams) ? userData.trainedTeams : []),
    [userData?.trainedTeams],
  );

  // Derive clubId from selected team or user's club (for Dirigeant)
  const initialSelectedTeam = trainedTeams.find((/** @type {Team} */ teamItem) => teamItem.documentId === selectedTeamId)
    || event?.team
    || null;
  const clubId = initialSelectedTeam?.club?.documentId || userData?.club?.documentId;
  const cmId = initialSelectedTeam?.club?.parentMultisport?.documentId || userData?.club?.parentMultisport?.documentId;

  // Fetch club teams for invited teams selection
  const [clubTeams, setClubTeams] = useState(/** @type {Team[]} */ ([]));

  useEffect(() => {
    const fetchClubTeams = async () => {
      if (clubId) {
        try {
          console.log('Fetching teams for club:', clubId);
          const response = await getTeams({ clubId, pageSize: 100 });
          console.log('Fetched club teams:', response.data?.length);
          setClubTeams(response.data || []);
        } catch (error) {
          console.error('Failed to fetch club teams', error);
        }
      } else {
        setClubTeams([]);
      }
    };

    fetchClubTeams();
  }, [clubId]);

  const manageableTeams = useMemo(() => {
    if (isClubManager && clubTeams.length > 0) {
      return clubTeams;
    }

    return trainedTeams;
  }, [clubTeams, isClubManager, trainedTeams]);

  const teamOptions = manageableTeams.map((team) => ({
    label: team.name,
    value: team.documentId || '',
  }));

  // Construct invited team options with headers
  const invitedTeamOptions = useMemo(() => {
    const myTeamsOptions = teamOptions.filter((teamOption) => teamOption.value !== selectedTeamId);

    // Filter other teams (exclude my teams and selected team)
    const myTeamIds = trainedTeams.map((teamItem) => teamItem.documentId);
    const otherTeamsOptions = clubTeams
      .filter((teamItem) => !myTeamIds.includes(teamItem.documentId) && teamItem.documentId !== selectedTeamId)
      .map((teamItem) => ({ label: teamItem.name, value: teamItem.documentId }));

    const finalOptions = [];

    if (myTeamsOptions.length > 0) {
      finalOptions.push({ isHeader: true, label: t('eventEdit.fields.invitedTeams.myTeams') || 'MES ÉQUIPES', value: 'header_my_teams' });
      finalOptions.push(...myTeamsOptions);
    }

    if (otherTeamsOptions.length > 0) {
      finalOptions.push({ isHeader: true, label: t('eventEdit.fields.invitedTeams.otherTeams') || 'AUTRES ÉQUIPES', value: 'header_other_teams' });
      finalOptions.push(...otherTeamsOptions);
    }

    return finalOptions;
  }, [teamOptions, selectedTeamId, clubTeams, trainedTeams, t]);

  const requiresFacilityApproval = Boolean(
    selectedFacilityId
    && selectedOccupancy?.saturated
    && selectedOccupancy?.requiresApproval,
  );
  const allowsImmediateFacilityConflict = Boolean(
    selectedFacilityId
    && selectedOccupancy?.saturated
    && selectedOccupancy?.allowsImmediateConfirmation,
  );

  // Déterminer si le type sélectionné est "Réservation"
  const isReservationType = useMemo(
    () => selectedTypeData?.name === 'Réservation',
    [selectedTypeData?.name],
  );

  // Reset form when event data is loaded
  useEffect(() => {
    if (event) {
      console.log('Event data loaded:', event);
      console.log('Recurrence Group ID:', event.recurrenceGroupId);
      reset({
        ...defaultValues,
        capacity: event?.capacity,
        date: event?.date ? format(new Date(event?.date), 'dd/MM/yyyy') : '',
        description: event?.description || '',
        endTime: event?.endTime ? event.endTime.substring(0, 5) : '',
        eventTasks: Array.isArray(event?.eventTasks) ? event.eventTasks : [],
        facility: event?.facility?.documentId || null,
        invitedTeams: event?.invitedTeams?.map(
          (/** @type {Team} */ invitedTeam) => invitedTeam.documentId || '',
        ) || [],
        location: {
          label: getEventLocationLabel(event?.locationDetails),
          value: `${event?.location?.lat}|${event?.location?.lng}`,
        },
        participantIdentityVisibility: event?.participantIdentityVisibility || 'VISIBLE',
        pricePerPerson: event?.pricePerPerson,
        reservationMode: event?.reservationMode || 'FULL_GROUP',
        sessionStatus: event?.sessionStatus || 'open',
        startTime: event?.startTime ? event.startTime.substring(0, 5) : '',
        team: event?.team?.documentId || '',
        teamAudiences: Array.isArray(event?.teamAudiences) ? event.teamAudiences : [],
        totalPlayers: event?.totalPlayers,
        type: event?.type?.documentId || '',
        validationMode: event?.validationMode || 'auto',
      });
    }
  }, [event, reset]);

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
  /**
   * Handle form submit
   * @param {FCEventForm} data
   * @returns {Promise<void>}
   */
  const handleFormSubmit = async (data) => {
    try {
      if (eventId && !editSupport?.isSupported) {
        Alert.alert(
          t('eventEdit.modals.unsupportedEdit.title', 'Modification limitee'),
          editSupport?.reason || "Cette fiche ne permet pas encore d'editer ce type d'evenement.",
        );
        return;
      }

      console.log('Form submitted with data:', data);
      const normalizedEvents = eventId
        ? [createEventUpdatePayload(data)]
        : createReccurrentEventPayload(data);
      console.log('Formatted events:', normalizedEvents);

      if (eventId) {
        // Mise à jour d'un événement existant
        const updateEventWithMode = async (/** @type {'future' | 'all'} */ recurrenceMode) => {
          await updateEventMutation.mutateAsync({
            documentId: eventId,
            eventData: normalizedEvents[0],
            recurrenceMode,
          });
          navigation.replace(RouteNames.EventDetails, { eventId });
        };

        if (event?.recurrenceGroupId) {
          const originalDate = event?.date ? format(new Date(event.date), 'dd/MM/yyyy') : '';
          const recurrenceScopeHint = originalDate && data?.date && data.date !== originalDate
            ? "\n\nSi vous choisissez les futurs ou toute la serie, la nouvelle date reste specifique a cet evenement. Les autres occurrences recuperent surtout les parametres communs comme l'horaire, le lieu et les invitations."
            : '';
          Alert.alert(
            t('eventEdit.modals.recurrenceUpdate.title', 'Modification récurrente'),
            `${t('eventEdit.modals.recurrenceUpdate.description', 'Cet événement fait partie d\'une série. Que voulez-vous modifier ?')}${recurrenceScopeHint}`,
            [
              {
                style: 'cancel',
                text: t('eventEdit.modals.recurrenceUpdate.options.cancel', 'Annuler'),
              },
              {
                onPress: () => updateEventWithMode(),
                text: t('eventEdit.modals.recurrenceUpdate.options.this', 'Cet événement'),
              },
              {
                onPress: () => updateEventWithMode('future'),
                text: t('eventEdit.modals.recurrenceUpdate.options.future', 'Cet événement et les suivants'),
              },
              {
                onPress: () => updateEventWithMode('all'),
                text: t('eventEdit.modals.recurrenceUpdate.options.all', 'Tous les événements'),
              },
            ],
          );
        } else {
          await updateEventWithMode();
        }
      } else {
        // Création d'un ou plusieurs nouveaux événements
        console.log('Creating new event(s)...', normalizedEvents);
        const promises = normalizedEvents.map(
          (eventData) => {
            console.log('Sending event data:', eventData);
            return createEventMutation.mutateAsync(eventData);
          },
        );

        const results = await Promise.all(promises);
        console.log('Events created:', results);

        // Navigation après succès
        if (navigation.canGoBack()) {
          navigation.goBack();
        }
      }
    } catch (error) {
      console.error('Error in handleFormSubmit:', error);
      // L'erreur de création/mise à jour de l'événement est gérée par les mutations
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
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="always"
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
                    // Reset invited teams if main team changes (optional, but safer to avoid duplicates)
                    // setValue('invitedTeams', []);
                  }}
                  value={teamOptions.find((option) => option.value === value)?.label || ''}
                />
              )}
            />

            {/* Invited Teams */}
            <Controller
              control={control}
              name="invitedTeams"
              render={({
                field: {
                  name, onBlur, onChange, value,
                },
              }) => (
                <AutocompleteSelect
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  isMulti
                  label={t('eventEdit.fields.invitedTeams.label') || 'Inviter des équipes'}
                  onBlur={onBlur}
                  options={invitedTeamOptions}
                  placeholder={t('eventEdit.fields.invitedTeams.placeholder') || 'Sélectionner des équipes'}
                  setValue={(/** @type {Option[]} */options) => {
                    // Filter out headers from selection just in case
                    const validOptions = options?.filter((o) => !o.isHeader);
                    onChange(validOptions?.map((o) => o.value) || []);
                  }}
                  value={value || []}
                />
              )}
            />

            {/* Facility Selector */}
            <Controller
              control={control}
              name="location"
              render={({
                field: {
                  name, onChange, value,
                },
              }) => (
                <FacilitySelector
                  clubId={clubId || ''}
                  cmId={cmId || ''}
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  facilityId={watch('facility')}
                  location={value}
                  occupancyWindow={occupancyWindow
                    ? {
                      ...occupancyWindow,
                      excludeEventId: eventId || undefined,
                    }
                    : null}
                  onChange={(/** @type {{ location: string; facilityId?: string }} */ { facilityId: newFacilityId, location: newLocation }) => {
                    onChange(newLocation);
                    setValue('facility', newFacilityId || '');
                  }}
                  onOccupancyResolved={setSelectedOccupancy}
                />
              )}
            />

            {eventId && !editSupport?.isSupported ? (
              <View style={[
                Spaces.padding[16],
                ApplicationStyle.backgroundColor.warning100,
                { borderColor: Colors.warning500, borderRadius: 8, borderWidth: 1 },
              ]}
              >
                <Text style={[Fonts.p2, Fonts.warning900]}>
                  {editSupport?.reason || "Cette fiche ne permet pas encore d'editer ce type d'evenement."}
                </Text>
              </View>
            ) : null}

            {requiresFacilityApproval ? (
              <View style={[
                Spaces.padding[16],
                ApplicationStyle.backgroundColor.warning100,
                { borderColor: Colors.warning500, borderRadius: 8, borderWidth: 1 },
              ]}
              >
                <Text style={[Fonts.p2, Fonts.warning900]}>
                  Ce creneau depasse la capacite de l installation. L evenement restera en demande en attente jusqu au traitement d un dirigeant.
                </Text>
              </View>
            ) : null}

            {allowsImmediateFacilityConflict ? (
              <View style={[
                Spaces.padding[16],
                ApplicationStyle.backgroundColor.primary700,
                { borderColor: Colors.primary500, borderRadius: 8, borderWidth: 1 },
              ]}
              >
                <Text style={[Fonts.p2, Fonts.primary200]}>
                  Ce creneau depasse la capacite de l installation, mais ce club est configure en Autorise et notifier. L evenement restera confirme et les dirigeants seront prevenus.
                </Text>
              </View>
            ) : null}

            {/* Conflict Warning */}
            {false && eventId && !editSupport?.isSupported && (
              <View style={[
                Spaces.padding[16],
                ApplicationStyle.backgroundColor.warning100,
                { borderColor: Colors.warning500, borderRadius: 8, borderWidth: 1 },
              ]}
              >
                <Text style={[Fonts.p2, Fonts.warning900]}>
                  ⚠️ Un conflit a été détecté sur ce créneau. Votre demande sera soumise à validation.
                </Text>
              </View>
            )}

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
              name="participantIdentityVisibility"
              render={({
                field: {
                  name, onBlur, onChange, value,
                },
              }) => (
                <AutocompleteSelect
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  label={t('eventEdit.fields.participantIdentityVisibility.label', 'Confidentialite des participants')}
                  onBlur={onBlur}
                  options={participantIdentityVisibilityOptions}
                  setValue={(option) => {
                    onChange(option?.value || 'VISIBLE');
                  }}
                  value={participantIdentityVisibilityOptions.find((option) => option.value === value)?.label || ''}
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
              name="eventTasks"
              render={({ field: { onChange, value } }) => (
                <EventTasksEditor
                  editable
                  onChange={onChange}
                  value={Array.isArray(value) ? value : []}
                />
              )}
            />

            <Controller
              control={control}
              name="teamAudiences"
              render={({ field: { onChange, value } }) => (
                <EventTeamAudiencesEditor
                  availableTeams={clubTeams}
                  clubId={clubId || ''}
                  currentTeamId={selectedTeamId || ''}
                  editable
                  onChange={onChange}
                  value={Array.isArray(value) ? value : []}
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

            {isReservationType && (
              <>
                <Controller
                  control={control}
                  name="pricePerPerson"
                  render={({
                    field: {
                      name, onBlur, onChange, ref, value,
                    },
                  }) => (
                    <Input
                      enterKeyHint="next"
                      error={getFieldError({ errors: formErrors, fieldName: name })}
                      inputMode="decimal"
                      keyboardType="decimal-pad"
                      label={t('eventEdit.fields.pricePerPerson.label')}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      placeholder={t('eventEdit.fields.pricePerPerson.placeholder')}
                      ref={ref}
                      value={value?.toString() || ''}
                    />
                  )}
                />

                <Controller
                  control={control}
                  name="totalPlayers"
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
                      label={t('eventEdit.fields.totalPlayers.label')}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      placeholder={t('eventEdit.fields.totalPlayers.placeholder')}
                      ref={ref}
                      value={value?.toString() || ''}
                    />
                  )}
                />

                <Controller
                  control={control}
                  name="startTime"
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
                      label={t('eventEdit.fields.startTime.label')}
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
                  name="endTime"
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
                      label={t('eventEdit.fields.endTime.label')}
                      maxLength={5}
                      onBlur={onBlur}
                      onChangeText={(val) => onChange(formatTimeInput(val))}
                      placeholder="HH:mm"
                      ref={ref}
                      value={value}
                    />
                  )}
                />

              </>
            )}

            <Controller
              control={control}
              name="date"
              render={({
                field: {
                  name, onChange, value,
                },
              }) => (
                <View style={Spaces.gap[4]}>
                  <DateTimeSelector
                    buttonStyle={{
                      alignItems: 'flex-start',
                      justifyContent: 'center',
                    }}
                    buttonTextStyle={{
                      textTransform: 'none',
                    }}
                    display="modal"
                    label={t('eventEdit.fields.date.label')}
                    mode="date"
                    onChange={(nextDate) => {
                      onChange(format(clampDateToToday(nextDate), 'dd/MM/yyyy'));
                    }}
                    value={getDatePickerValue(value, getDateFromDateInput)}
                  />
                  {getFieldError({ errors: formErrors, fieldName: name }) ? (
                    <Text style={[Fonts.p3, { color: Colors.error500 }]}>
                      {getFieldError({ errors: formErrors, fieldName: name })}
                    </Text>
                  ) : null}
                </View>
              )}
            />

            <Controller
              control={control}
              name="startTime"
              render={({
                field: {
                  name, onChange, value,
                },
              }) => (
                <View style={Spaces.gap[4]}>
                  <DateTimeSelector
                    buttonStyle={{
                      alignItems: 'flex-start',
                      justifyContent: 'center',
                    }}
                    buttonTextStyle={{
                      textTransform: 'none',
                    }}
                    display="modal"
                    label={t('eventEdit.fields.startTime.label')}
                    mode="time"
                    onChange={(nextDate) => {
                      onChange(format(nextDate, 'HH:mm'));
                    }}
                    value={getTimePickerValue(value)}
                  />
                  {getFieldError({ errors: formErrors, fieldName: name }) ? (
                    <Text style={[Fonts.p3, { color: Colors.error500 }]}>
                      {getFieldError({ errors: formErrors, fieldName: name })}
                    </Text>
                  ) : null}
                </View>
              )}
            />

            <Controller
              control={control}
              name="endTime"
              render={({
                field: {
                  name, onChange, value,
                },
              }) => (
                <View style={Spaces.gap[4]}>
                  <DateTimeSelector
                    buttonStyle={{
                      alignItems: 'flex-start',
                      justifyContent: 'center',
                    }}
                    buttonTextStyle={{
                      textTransform: 'none',
                    }}
                    display="modal"
                    label={t('eventEdit.fields.endTime.label')}
                    mode="time"
                    onChange={(nextDate) => {
                      onChange(format(nextDate, 'HH:mm'));
                    }}
                    value={getTimePickerValue(value)}
                  />
                  {getFieldError({ errors: formErrors, fieldName: name }) ? (
                    <Text style={[Fonts.p3, { color: Colors.error500 }]}>
                      {getFieldError({ errors: formErrors, fieldName: name })}
                    </Text>
                  ) : null}
                </View>
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

                        {recurrenceFrequency === 'week' ? (
                          <View style={[Spaces.gap[8]]}>
                            <Text style={[Fonts.p2, Fonts.neutral00]}>
                              {t('eventEdit.fields.recurrenceDays.label', 'Jours de récurrence')}
                            </Text>
                            <Controller
                              control={control}
                              name="recurrenceDays"
                              render={({ field: { onChange: onDaysChange, value: selectedDays } }) => (
                                <DayPicker
                                  onChange={onDaysChange}
                                  selectedDays={selectedDays || []}
                                />
                              )}
                            />
                          </View>
                        ) : (
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
                                options={getReccurrenceDayOptions(recurrenceFrequency)}
                                setValue={(/** @type {Option} */ option) => onFieldChange(option?.value || '')}
                                value={getReccurrenceDayOptions(recurrenceFrequency).find((option) => option.value === fieldValue)?.label || ''}
                              />
                            )}
                          />
                        )}
                      </View>
                    )}
                  </View>
                )}
              />
            )}
            <View
              style={[
                ApplicationStyle.backgroundColor.primary900,
                ApplicationStyle.borderRadius16,
                Spaces.padding[16],
                Spaces.gap[8],
                Spaces.marginTop[16],
              ]}
            >
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                Mise a la une
              </Text>
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                La demande de mise a la une se fait depuis la fiche de l&apos;evenement une fois enregistre.
              </Text>
            </View>
          </View>
        </ScrollView>
        <View style={[Spaces.gap[8]]}>
          <Button
            disabled={Boolean(eventId && !editSupport?.isSupported)}
            isLoading={
              createEventMutation.isPending
              || updateEventMutation.isPending
            }
            onPress={handleSubmit(handleFormSubmit, (errors) => {
              console.log('Form errors:', errors);
              Alert.alert('Erreur de validation', JSON.stringify(errors, null, 2));
            })}
            title={t('eventEdit.actions.save')}
            variant="Primary"
          />
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

export default EventEdit;
