/* eslint-disable jsx-a11y/label-has-associated-control */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useWindowDimensions } from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import {
  createEventPayload,
  createEventUpdatePayload,
  getEventEditSupport,
  hasExternalAudience,
  isTrainingEventType,
  resolveTrainingOpenConfig,
} from '@/domains/event/eventUseCases';
import i18n from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import ScreenContainer from '@/components/templates/ScreenContainer';
import EventTasksEditor from '@/views/event/components/EventTasksEditor';
import EventTeamAudiencesEditor from '@/views/event/components/EventTeamAudiencesEditor';

import { RouteNames } from '@/navigation/routeNames';

import { useGetEventForEdit, useGetEventTypes } from '@/services/event/eventQueries';
import { createEvent, updateEvent } from '@/services/event/eventService';
import { useGetFacilities } from '@/services/facility/facilityQueries';
import { getTeams } from '@/services/team/teamService';

import { getEntityDocumentId } from '@/utils/entityId';
import safeJsonParse from '@/utils/safeJsonParse';

import { BREAKPOINTS } from '@/responsive';

const toDateInputValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const toDisplayDateValue = (value) => {
  if (!value) return '';
  const [year, month, day] = String(value).split('-');
  if (!year || !month || !day) return '';
  return `${day}/${month}/${year}`;
};

const toTimeInputValue = (value) => String(value || '').trim().slice(0, 5);
const normalizeFacilities = (response) => {
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response)) return response;
  return [];
};

const dedupeTeams = (teams = []) => {
  const seen = new Set();
  return teams.filter((team) => {
    const documentId = getEntityDocumentId(team);
    if (!documentId || seen.has(documentId)) return false;
    seen.add(documentId);
    return true;
  });
};

/**
 *
 * @param root0
 * @param root0.navigation
 * @param root0.route
 */
function EventEdit({ navigation, route }) {
  const { eventId } = route?.params || {};
  const { width } = useWindowDimensions();
  const isDesktop = width >= BREAKPOINTS.desktop;
  const isTablet = width >= BREAKPOINTS.tablet;
  const queryClient = useQueryClient();
  const {
    Colors,
  } = useTheme();
  const { userData } = useAuth();
  const {
    data: event,
    error: eventError,
    isLoading: eventLoading,
  } = useGetEventForEdit(eventId || '', { enabled: Boolean(eventId) });
  const {
    data: eventTypes,
    error: eventTypesError,
    isLoading: eventTypesLoading,
  } = useGetEventTypes();

  const trainedTeams = useMemo(
    () => (Array.isArray(userData?.trainedTeams) ? userData.trainedTeams : []),
    [userData?.trainedTeams],
  );
  const [clubTeams, setClubTeams] = useState([]);
  const initialTeamId = String(route?.params?.teamId || '').trim() || getEntityDocumentId(event?.team);

  const [formState, setFormState] = useState({
    capacity: '',
    date: toDateInputValue(route?.params?.date),
    description: '',
    endTime: '',
    eventTasks: [],
    externalParticipantLimit: '',
    externalParticipantValidationMode: 'manual',
    facility: '',
    invitedTeams: [],
    locationLabel: '',
    pricePerPerson: '',
    sessionStatus: 'open',
    startTime: '',
    team: String(route?.params?.teamId || '').trim(),
    teamAudiences: [],
    totalPlayers: '',
    type: '',
    validationMode: 'auto',
  });
  const [recurrenceScope, setRecurrenceScope] = useState('this');
  const [submitError, setSubmitError] = useState('');
  const selectedTeam = useMemo(() => {
    const selectedTeamId = String(formState.team || initialTeamId || '').trim();
    const teamPool = dedupeTeams([
      ...trainedTeams,
      ...clubTeams,
      event?.team,
    ].filter(Boolean));
    return teamPool.find((team) => getEntityDocumentId(team) === selectedTeamId) || null;
  }, [clubTeams, event?.team, formState.team, initialTeamId, trainedTeams]);
  const facilityClubId = getEntityDocumentId(selectedTeam?.club) || getEntityDocumentId(userData?.club);
  const {
    data: facilitiesResponse,
    error: facilitiesError,
    isLoading: facilitiesLoading,
  } = useGetFacilities(facilityClubId, {
    enabled: Boolean(facilityClubId),
  });
  const facilities = normalizeFacilities(facilitiesResponse);

  useEffect(() => {
    if (!event) return;
    const trainingOpenConfig = resolveTrainingOpenConfig(event);
    setFormState({
      capacity: event?.capacity != null ? String(event.capacity) : '',
      date: toDateInputValue(event?.date),
      description: String(event?.description || ''),
      endTime: toTimeInputValue(event?.endTime),
      eventTasks: Array.isArray(event?.eventTasks) ? event.eventTasks : [],
      externalParticipantLimit: trainingOpenConfig.externalParticipantLimit != null
        ? String(trainingOpenConfig.externalParticipantLimit)
        : '',
      externalParticipantValidationMode: trainingOpenConfig.externalParticipantValidationMode || 'manual',
      facility: getEntityDocumentId(event?.facility),
      invitedTeams: Array.isArray(event?.invitedTeams)
        ? event.invitedTeams.map((team) => getEntityDocumentId(team)).filter(Boolean)
        : [],
      locationLabel: String(
        event?.locationDetails
          ? (() => {
            const parsed = safeJsonParse(event.locationDetails, null);
            return parsed?.address?.description || parsed?.address?.label || parsed?.address?.address || '';
          })()
          : event?.location?.label || '',
      ),
      pricePerPerson: event?.pricePerPerson != null ? String(event.pricePerPerson) : '',
      sessionStatus: String(event?.sessionStatus || 'open'),
      startTime: toTimeInputValue(event?.startTime),
      team: getEntityDocumentId(event?.team),
      teamAudiences: Array.isArray(event?.teamAudiences) ? event.teamAudiences : [],
      totalPlayers: event?.totalPlayers != null ? String(event.totalPlayers) : '',
      type: getEntityDocumentId(event?.type),
      validationMode: String(event?.validationMode || 'auto'),
    });
  }, [event]);

  useEffect(() => {
    let cancelled = false;

    const fetchClubTeams = async () => {
      if (!facilityClubId) {
        setClubTeams([]);
        return;
      }

      try {
        const response = await getTeams({ clubId: facilityClubId, pageSize: 100 });
        const nextTeams = Array.isArray(response?.data) ? response.data : [];
        if (!cancelled) {
          setClubTeams(nextTeams);
        }
      } catch (_error) {
        if (!cancelled) {
          setClubTeams([]);
        }
      }
    };

    fetchClubTeams();

    return () => {
      cancelled = true;
    };
  }, [facilityClubId]);

  const typeOptions = useMemo(() => {
    if (Array.isArray(eventTypes)) return eventTypes;
    if (Array.isArray(eventTypes?.data)) return eventTypes.data;
    return [];
  }, [eventTypes]);
  const selectedTypeData = useMemo(
    () => typeOptions.find((eventType) => getEntityDocumentId(eventType) === formState.type) || event?.type || null,
    [event?.type, formState.type, typeOptions],
  );
  const isReservationType = useMemo(
    () => selectedTypeData?.name === 'Réservation',
    [selectedTypeData?.name],
  );
  const isTrainingType = useMemo(
    () => isTrainingEventType(selectedTypeData?.name),
    [selectedTypeData?.name],
  );
  const isOpenTrainingType = isTrainingType && formState.sessionStatus !== 'closed';
  // R8 (D1) — meme regle que sur mobile : sur un evenement prive, tout le monde
  // est convie, `validationMode` ne filtre personne (AA01) et le reglage
  // disparait plutot que de faire croire qu'il commande quelque chose.
  const showValidationField = hasExternalAudience({ sessionStatus: formState.sessionStatus });
  const editSupport = useMemo(
    () => getEventEditSupport(event, selectedTypeData?.name),
    [event, selectedTypeData?.name],
  );
  const originalEventDate = useMemo(
    () => toDateInputValue(event?.date),
    [event?.date],
  );
  const hasRecurringDateShift = Boolean(
    event?.recurrenceGroupId
    && originalEventDate
    && formState.date
    && formState.date !== originalEventDate,
  );
  const isBootstrapping = Boolean(eventId) && eventLoading;
  const missingEvent = Boolean(eventId) && !eventLoading && !eventError && !event;
  const setupLoading = Boolean(!isBootstrapping && (eventTypesLoading || (facilityClubId && facilitiesLoading)));
  const setupError = eventError || eventTypesError || facilitiesError;
  const hasTypes = typeOptions.length > 0;
  const manageableTeams = useMemo(() => {
    const baseTeams = clubTeams.length > 0 ? clubTeams : trainedTeams;
    return dedupeTeams(baseTeams);
  }, [clubTeams, trainedTeams]);
  const hasTeams = manageableTeams.length > 0;

  const availableInvitedTeams = useMemo(
    () => manageableTeams.filter((team) => getEntityDocumentId(team) !== formState.team),
    [formState.team, manageableTeams],
  );

  const createEventMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: async (response) => {
      const nextEventId = getEntityDocumentId(response?.data || response);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['events'] }),
        queryClient.invalidateQueries({ queryKey: ['planning', 'personal'] }),
      ]);
      if (nextEventId) {
        navigation.replace(RouteNames.EventDetails, { eventId: nextEventId });
      } else {
        navigation.goBack();
      }
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: ({ documentId, eventData }) => updateEvent({ documentId, eventData }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['event', eventId] }),
        queryClient.invalidateQueries({ queryKey: ['event', eventId, 'edit'] }),
        queryClient.invalidateQueries({ queryKey: ['events'] }),
        queryClient.invalidateQueries({ queryKey: ['planning', 'personal'] }),
      ]);
      navigation.replace(RouteNames.EventDetails, { eventId });
    },
  });

  const borderColor = 'rgba(255,255,255,0.08)';
  const panelBackground = 'rgba(6, 19, 29, 0.76)';
  const textColor = Colors?.neutral00 || '#ffffff';
  const mutedTextColor = Colors?.neutral300 || '#adb1b2';
  const accentColor = Colors?.primary500 || '#01b3f4';
  const isSubmitting = createEventMutation.isPending || updateEventMutation.isPending;
  const isSetupPending = eventTypesLoading || facilitiesLoading;
  const canSubmit = Boolean(
    !isBootstrapping
    && !setupError
    && !(eventId && !editSupport?.isSupported)
    && hasTypes
    && hasTeams
    && formState.type
    && formState.team
    && formState.date
    && formState.startTime,
  );
  const isSubmitDisabled = !canSubmit || isSubmitting || isSetupPending;
  let submitButtonLabel = 'Creer';
  if (isSubmitting) {
    submitButtonLabel = 'Enregistrement...';
  } else if (isSetupPending) {
    submitButtonLabel = 'Preparation...';
  } else if (eventId) {
    submitButtonLabel = 'Mettre à jour';
  }

  const updateField = (field, value) => {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleTeamChange = (teamId) => {
    setFormState((current) => ({
      ...current,
      invitedTeams: current.invitedTeams.filter((value) => value !== teamId),
      team: teamId,
      teamAudiences: Array.isArray(current.teamAudiences)
        ? current.teamAudiences.filter((audience) => getEntityDocumentId(audience?.team) !== teamId)
        : [],
    }));
  };

  const handleInvitedTeamsChange = (selectedOptions) => {
    const values = Array.from(selectedOptions || []).map((option) => option.value).filter(Boolean);
    updateField('invitedTeams', values);
  };

  const toggleInvitedTeam = (teamId) => {
    setFormState((current) => {
      const alreadySelected = current.invitedTeams.includes(teamId);
      return {
        ...current,
        invitedTeams: alreadySelected
          ? current.invitedTeams.filter((value) => value !== teamId)
          : [...current.invitedTeams, teamId],
      };
    });
  };

  const handleSubmit = async (eventObject) => {
    eventObject.preventDefault();
    setSubmitError('');

    if (!formState.type || !formState.team || !formState.date || !formState.startTime) {
      setSubmitError('Type, équipe, date et heure de début sont obligatoires.');
      return;
    }

    if (eventId && !editSupport?.isSupported) {
      setSubmitError(editSupport?.reason || "Cette fiche ne permet pas encore d'éditer ce type d'événement.");
      return;
    }

    if (isTrainingType && formState.sessionStatus !== 'closed') {
      const externalParticipantLimit = Number(formState.externalParticipantLimit || 0);
      if (!Number.isFinite(externalParticipantLimit) || externalParticipantLimit < 1) {
        setSubmitError('Indique combien de places externes tu ouvres pour cet entraînement.');
        return;
      }
    }

    let normalizedTotalPlayers = null;
    if (!(isTrainingType && formState.sessionStatus !== 'closed')) {
      normalizedTotalPlayers = formState.totalPlayers ? Number(formState.totalPlayers) : null;
    }
    const baseFormPayload = {
      capacity: formState.capacity ? Number(formState.capacity) : null,
      date: toDisplayDateValue(formState.date),
      description: formState.description,
      endTime: formState.endTime,
      eventTasks: Array.isArray(formState.eventTasks) ? formState.eventTasks : [],
      externalParticipantLimit: formState.externalParticipantLimit
        ? Number(formState.externalParticipantLimit)
        : null,
      externalParticipantValidationMode: formState.externalParticipantValidationMode || null,
      facility: formState.facility || null,
      invitedTeams: formState.invitedTeams,
      location: formState.locationLabel
        ? { label: formState.locationLabel, value: '' }
        : undefined,
      pricePerPerson: formState.pricePerPerson ? Number(formState.pricePerPerson) : null,
      sessionStatus: formState.sessionStatus,
      startTime: formState.startTime,
      team: formState.team,
      teamAudiences: Array.isArray(formState.teamAudiences) ? formState.teamAudiences : [],
      totalPlayers: normalizedTotalPlayers,
      type: formState.type,
      typeName: selectedTypeData?.name || event?.type?.name || '',
      validationMode: formState.validationMode,
    };
    const payload = eventId
      ? createEventUpdatePayload(baseFormPayload)
      : createEventPayload(baseFormPayload);

    try {
      if (eventId) {
        await updateEventMutation.mutateAsync({
          documentId: eventId,
          eventData: payload,
          recurrenceMode: event?.recurrenceGroupId && recurrenceScope !== 'this'
            ? recurrenceScope
            : undefined,
        });
      } else {
        await createEventMutation.mutateAsync(payload);
      }
    } catch (error) {
      setSubmitError(error?.message || 'Impossible d enregistrer cet événement.');
    }
  };

  const fieldStyle = {
    background: 'rgba(255,255,255,0.03)',
    border: `1px solid ${borderColor}`,
    borderRadius: 16,
    color: textColor,
    fontFamily: 'Montserrat-Regular, sans-serif',
    fontSize: 14,
    outline: 'none',
    padding: '13px 14px',
    width: '100%',
  };

  return (
    <ScreenContainer
      bgImage="bg2"
      contentWidth="wide"
      responsivePadding
      style={{ paddingBottom: 32 }}
    >
      <div style={{ color: textColor, display: 'grid', gap: 24 }}>
        <section style={{
          background: panelBackground, border: `1px solid ${borderColor}`, borderRadius: 28, padding: isTablet ? 32 : 22,
        }}
        >
          <div style={{
            alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', marginBottom: 18,
          }}
          >
            <div style={{ display: 'grid', gap: 8 }}>
              <span style={{
                color: accentColor, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase',
              }}
              >
                Planning
              </span>
              <h1 style={{ fontFamily: 'Montserrat-Black, sans-serif', fontSize: isTablet ? 34 : 28, margin: 0 }}>
                {eventId ? 'Modifier un événement' : 'Créer un événement'}
              </h1>
            </div>
            <button
              onClick={() => navigation.goBack()}
              style={{
                background: 'transparent', border: `1px solid ${borderColor}`, borderRadius: 999, color: textColor, cursor: 'pointer', padding: '10px 14px',
              }}
              type="button"
            >
              Retour
            </button>
          </div>

          {eventId && !editSupport?.isSupported ? (
            <div style={{
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.5)',
              borderRadius: 18,
              color: textColor,
              display: 'grid',
              gap: 8,
              marginBottom: 18,
              padding: 16,
            }}
            >
              <strong style={{ color: '#f59e0b', fontFamily: 'Montserrat-Bold, sans-serif' }}>
                Modification limitée
              </strong>
              <span style={{ color: mutedTextColor }}>
                {editSupport?.reason || "Cette fiche ne permet pas encore d'éditer ce type d'événement."}
              </span>
            </div>
          ) : null}

          {event?.recurrenceGroupId ? (
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${borderColor}`,
              borderRadius: 18,
              color: mutedTextColor,
              display: 'grid',
              gap: 8,
              marginBottom: 18,
              padding: 16,
            }}
            >
              <strong style={{ color: textColor, fontFamily: 'Montserrat-Bold, sans-serif' }}>
                Série recurrente
              </strong>
              <span>
                La portee ci-dessous determine si la mise à jour s applique à cet événement seulement, aux suivants, ou à toute la série.
              </span>
              {hasRecurringDateShift ? (
                <span style={{ color: '#f59e0b' }}>
                  Si tu modifies la date du calendrier, elle reste spécifique à cet événement. Les mises à jour pour les suivants ou toute la série propagent surtout les paramètres communs comme l horaire, le lieu et les invitations.
                </span>
              ) : null}
            </div>
          ) : null}

          {isBootstrapping ? (
            <div style={{ color: mutedTextColor }}>Chargement de l événement...</div>
          ) : null}

          {!isBootstrapping && setupLoading ? (
            <div style={{ color: mutedTextColor }}>Préparation du formulaire...</div>
          ) : null}

          {!isBootstrapping && !setupLoading && setupError ? (
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ color: '#ff6b81', fontFamily: 'Montserrat-Bold, sans-serif' }}>Configuration indisponible</div>
              <div style={{ color: mutedTextColor }}>
                {setupError?.message || 'Impossible de charger les données du formulaire.'}
              </div>
            </div>
          ) : null}

          {!isBootstrapping && !setupLoading && !setupError && missingEvent ? (
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ color: textColor, fontFamily: 'Montserrat-Bold, sans-serif' }}>Événement introuvable</div>
              <div style={{ color: mutedTextColor }}>
                Cet événement n existe plus ou ne peut pas être modifie depuis ce lien.
              </div>
            </div>
          ) : null}

          {!isBootstrapping && !setupLoading && !setupError && !missingEvent && !hasTeams ? (
            <div style={{ color: mutedTextColor }}>
              Aucune équipe disponible pour créer ou modifier cet événement.
            </div>
          ) : null}

          {!isBootstrapping && !setupLoading && !setupError && !missingEvent && hasTeams && !hasTypes ? (
            <div style={{ color: mutedTextColor }}>
              Aucun type d événement n est disponible pour le moment.
            </div>
          ) : null}

          {!isBootstrapping && !setupLoading && !setupError && !missingEvent && hasTeams && hasTypes ? (
            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 20 }}>
              <div style={{ display: 'grid', gap: 16, gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr' }}>
                <label style={{ display: 'grid', gap: 8 }}>
                  <span style={{ color: mutedTextColor, fontSize: 13 }}>Type</span>
                  <select onChange={(eventObject) => updateField('type', eventObject.target.value)} style={fieldStyle} value={formState.type}>
                    <option value="">Choisir un type</option>
                    {typeOptions.map((type) => (
                      <option key={getEntityDocumentId(type)} value={getEntityDocumentId(type)}>
                        {type?.name || 'Type'}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ display: 'grid', gap: 8 }}>
                  <span style={{ color: mutedTextColor, fontSize: 13 }}>Équipe</span>
                  <select onChange={(eventObject) => handleTeamChange(eventObject.target.value)} style={fieldStyle} value={formState.team}>
                    <option value="">Choisir une équipe</option>
                    {manageableTeams.map((team) => (
                      <option key={getEntityDocumentId(team)} value={getEntityDocumentId(team)}>
                        {team?.name || 'Equipe'}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ display: 'grid', gap: 8 }}>
                  <span style={{ color: mutedTextColor, fontSize: 13 }}>Date</span>
                  <input onChange={(eventObject) => updateField('date', eventObject.target.value)} style={fieldStyle} type="date" value={formState.date} />
                </label>

                <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr' }}>
                  <label style={{ display: 'grid', gap: 8 }}>
                    <span style={{ color: mutedTextColor, fontSize: 13 }}>Début</span>
                    <input onChange={(eventObject) => updateField('startTime', eventObject.target.value)} style={fieldStyle} type="time" value={formState.startTime} />
                  </label>
                  <label style={{ display: 'grid', gap: 8 }}>
                    <span style={{ color: mutedTextColor, fontSize: 13 }}>Fin</span>
                    <input onChange={(eventObject) => updateField('endTime', eventObject.target.value)} style={fieldStyle} type="time" value={formState.endTime} />
                  </label>
                </div>

                {event?.recurrenceGroupId ? (
                  <label style={{ display: 'grid', gap: 8 }}>
                    <span style={{ color: mutedTextColor, fontSize: 13 }}>Portee de la mise à jour</span>
                    <select onChange={(eventObject) => setRecurrenceScope(eventObject.target.value)} style={fieldStyle} value={recurrenceScope}>
                      <option value="this">Cet événement</option>
                      <option value="future">Cet événement et les suivants</option>
                      <option value="all">Toute la série</option>
                    </select>
                  </label>
                ) : null}

                <label style={{ display: 'grid', gap: 8 }}>
                  <span style={{ color: mutedTextColor, fontSize: 13 }}>Installation</span>
                  <select onChange={(eventObject) => updateField('facility', eventObject.target.value)} style={fieldStyle} value={formState.facility}>
                    <option value="">Aucune installation</option>
                    {facilities.map((facility) => (
                      <option key={getEntityDocumentId(facility)} value={getEntityDocumentId(facility)}>
                        {facility?.name || 'Installation'}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ display: 'grid', gap: 8 }}>
                  <span style={{ color: mutedTextColor, fontSize: 13 }}>Lieu libre / adresse</span>
                  <input onChange={(eventObject) => updateField('locationLabel', eventObject.target.value)} placeholder="Adresse ou lieu" style={fieldStyle} value={formState.locationLabel} />
                </label>

                {!isTrainingType ? (
                  <label style={{ display: 'grid', gap: 8 }}>
                    <span style={{ color: mutedTextColor, fontSize: 13 }}>Capacité</span>
                    <input min="0" onChange={(eventObject) => updateField('capacity', eventObject.target.value)} style={fieldStyle} type="number" value={formState.capacity} />
                  </label>
                ) : null}

                {(!isTrainingType || !isOpenTrainingType) ? (
                  <label style={{ display: 'grid', gap: 8 }}>
                    <span style={{ color: mutedTextColor, fontSize: 13 }}>
                      {isTrainingType ? 'Joueurs attendus (interne)' : 'Joueurs attendus'}
                    </span>
                    <input min="0" onChange={(eventObject) => updateField('totalPlayers', eventObject.target.value)} style={fieldStyle} type="number" value={formState.totalPlayers} />
                  </label>
                ) : null}

                {isReservationType ? (
                  <label style={{ display: 'grid', gap: 8 }}>
                    <span style={{ color: mutedTextColor, fontSize: 13 }}>Prix par personne</span>
                    <input min="0" onChange={(eventObject) => updateField('pricePerPerson', eventObject.target.value)} step="0.01" style={fieldStyle} type="number" value={formState.pricePerPerson} />
                  </label>
                ) : null}

                {showValidationField ? (
                  <label style={{ display: 'grid', gap: 8 }}>
                    <span style={{ color: mutedTextColor, fontSize: 13 }}>
                      {isTrainingType
                        ? 'Validation des membres internes'
                        : 'Validation des membres'}
                    </span>
                    <select onChange={(eventObject) => updateField('validationMode', eventObject.target.value)} style={fieldStyle} value={formState.validationMode}>
                      <option value="auto">Automatique</option>
                      <option value="manual">Manuelle</option>
                    </select>
                  </label>
                ) : null}

                {/* S11 — plus un choix, une information : le serveur met toute
                    demande venue du dehors en attente, quoi qu'on lui envoie. */}
                {showValidationField ? (
                  <div style={{ display: 'grid', gap: 4 }}>
                    <span style={{ color: mutedTextColor, fontSize: 13 }}>
                      Demandes extérieures
                    </span>
                    <span style={{ color: mutedTextColor, fontSize: 13 }}>
                      Les demandes extérieures sont validées par toi.
                    </span>
                  </div>
                ) : null}

                {isOpenTrainingType ? (
                  <label style={{ display: 'grid', gap: 8 }}>
                    <span style={{ color: mutedTextColor, fontSize: 13 }}>Places externes</span>
                    <input min="0" onChange={(eventObject) => updateField('externalParticipantLimit', eventObject.target.value)} style={fieldStyle} type="number" value={formState.externalParticipantLimit} />
                  </label>
                ) : null}

                <label style={{ display: 'grid', gap: 8 }}>
                  <span style={{ color: mutedTextColor, fontSize: 13 }}>
                    {i18n.t('eventEdit.fields.sessionStatus.label')}
                  </span>
                  <select
                    onChange={(eventObject) => (
                      updateField('sessionStatus', eventObject.target.value)
                    )}
                    style={fieldStyle}
                    value={formState.sessionStatus}
                  >
                    <option value="open">
                      {i18n.t('eventEdit.fields.sessionStatus.options.open')}
                    </option>
                    <option value="closed">
                      {i18n.t('eventEdit.fields.sessionStatus.options.closed')}
                    </option>
                  </select>
                </label>

                <label style={{ display: 'grid', gap: 8 }}>
                  <span style={{ color: mutedTextColor, fontSize: 13 }}>Équipes invitées</span>
                  <div style={{ display: 'grid', gap: 10 }}>
                    <div style={{ color: mutedTextColor, fontSize: 12, lineHeight: 1.5 }}>
                      Clique sur une équipe pour l ajouter ou la retirer, sans combinaison clavier.
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                      {availableInvitedTeams.length ? availableInvitedTeams.map((team) => {
                        const teamId = getEntityDocumentId(team);
                        const isSelected = formState.invitedTeams.includes(teamId);
                        return (
                          <button
                            key={teamId}
                            onClick={() => toggleInvitedTeam(teamId)}
                            style={{
                              background: isSelected ? `${accentColor}26` : 'rgba(255,255,255,0.03)',
                              border: `1px solid ${isSelected ? accentColor : borderColor}`,
                              borderRadius: 999,
                              color: isSelected ? accentColor : textColor,
                              cursor: 'pointer',
                              fontFamily: 'Montserrat-Bold, sans-serif',
                              fontSize: 13,
                              padding: '10px 14px',
                            }}
                            type="button"
                          >
                            {team?.name || 'Equipe'}
                          </button>
                        );
                      }) : (
                        <div style={{ color: mutedTextColor }}>
                          Aucune autre équipe du club n est disponible pour le moment.
                        </div>
                      )}
                    </div>
                    <select
                      multiple
                      onChange={(eventObject) => handleInvitedTeamsChange(eventObject.target.selectedOptions)}
                      style={{ ...fieldStyle, minHeight: 140 }}
                      value={formState.invitedTeams}
                    >
                      {availableInvitedTeams.map((team) => (
                        <option key={getEntityDocumentId(team)} value={getEntityDocumentId(team)}>
                          {team?.name || 'Equipe'}
                        </option>
                      ))}
                    </select>
                  </div>
                </label>
              </div>

              <label style={{ display: 'grid', gap: 8 }}>
                <span style={{ color: mutedTextColor, fontSize: 13 }}>Description</span>
                <textarea
                  onChange={(eventObject) => updateField('description', eventObject.target.value)}
                  placeholder="Décris l'événement, le rendez-vous, les consignes..."
                  style={{ ...fieldStyle, minHeight: 140, resize: 'vertical' }}
                  value={formState.description}
                />
              </label>

              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ color: mutedTextColor, fontSize: 13 }}>
                  Invitations d équipes avancées
                </div>
                <EventTeamAudiencesEditor
                  availableTeams={clubTeams}
                  clubId={facilityClubId || ''}
                  currentTeamId={formState.team || ''}
                  editable
                  onChange={(nextValue) => updateField('teamAudiences', nextValue)}
                  value={Array.isArray(formState.teamAudiences) ? formState.teamAudiences : []}
                />
              </div>

              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ color: mutedTextColor, fontSize: 13 }}>
                  Tâches annexes
                </div>
                <EventTasksEditor
                  editable
                  onChange={(nextValue) => updateField('eventTasks', nextValue)}
                  value={Array.isArray(formState.eventTasks) ? formState.eventTasks : []}
                />
              </div>

              <div
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${borderColor}`,
                  borderRadius: 20,
                  color: mutedTextColor,
                  display: 'grid',
                  gap: 8,
                  padding: 16,
                }}
              >
                <strong style={{ color: textColor, fontFamily: 'Montserrat-Bold, sans-serif' }}>
                  Mise à la une
                </strong>
                <span>
                  La demande de mise à la une se fait depuis la fiche de l événement après création.
                </span>
              </div>

              {submitError ? (
                <div style={{ color: '#ff6b81', fontSize: 14 }}>
                  {submitError}
                </div>
              ) : null}

              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between',
              }}
              >
                <div style={{
                  color: mutedTextColor, fontSize: 13, lineHeight: 1.5, maxWidth: 680,
                }}
                >
                  La version web couvre maintenant aussi les invitations d équipes et les tâches annexes, au plus proche du flow mobile.
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    onClick={() => navigation.goBack()}
                    style={{
                      background: 'transparent', border: `1px solid ${borderColor}`, borderRadius: 999, color: textColor, cursor: 'pointer', padding: '12px 16px',
                    }}
                    type="button"
                  >
                    Annuler
                  </button>
                  <button
                    disabled={isSubmitDisabled}
                    style={{
                      background: isSubmitDisabled ? 'rgba(255,255,255,0.14)' : accentColor,
                      border: 0,
                      borderRadius: 999,
                      color: '#001218',
                      cursor: isSubmitDisabled ? 'not-allowed' : 'pointer',
                      fontFamily: 'Montserrat-Bold, sans-serif',
                      opacity: isSubmitDisabled ? 0.7 : 1,
                      padding: '12px 18px',
                    }}
                    type="submit"
                  >
                    {submitButtonLabel}
                  </button>
                </div>
              </div>
            </form>
          ) : null}
        </section>
      </div>
    </ScreenContainer>
  );
}

export default EventEdit;
