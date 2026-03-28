import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useWindowDimensions } from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { BREAKPOINTS } from '@/responsive';
import ScreenContainer from '@/components/templates/ScreenContainer';
import { RouteNames } from '@/navigation/routeNames';
import { useGetEvent, useGetEventTypes } from '@/services/event/eventQueries';
import { createEvent, updateEvent } from '@/services/event/eventService';
import { useGetFacilities } from '@/services/facility/facilityQueries';
import useTheme from '@/theme/themeContext';
import { getEntityDocumentId } from '@/utils/entityId';
import { createEventPayload } from '@/domains/event/eventUseCases';

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
  const { data: event } = useGetEvent(eventId || '', { enabled: Boolean(eventId) });
  const { data: eventTypes } = useGetEventTypes();

  const trainedTeams = Array.isArray(userData?.trainedTeams) ? userData.trainedTeams : [];
  const selectedTeam = trainedTeams.find((team) => getEntityDocumentId(team) === String(route?.params?.teamId || '').trim())
    || trainedTeams.find((team) => getEntityDocumentId(team) === getEntityDocumentId(event?.team))
    || null;
  const facilityClubId = getEntityDocumentId(selectedTeam?.club) || getEntityDocumentId(userData?.club);
  const { data: facilitiesResponse } = useGetFacilities(facilityClubId, {
    enabled: Boolean(facilityClubId),
  });

  const facilities = Array.isArray(facilitiesResponse?.data)
    ? facilitiesResponse.data
    : Array.isArray(facilitiesResponse)
      ? facilitiesResponse
      : [];

  const [formState, setFormState] = useState({
    capacity: '',
    date: toDateInputValue(route?.params?.date),
    description: '',
    endTime: '',
    facility: '',
    invitedTeams: [],
    locationLabel: '',
    pricePerPerson: '',
    sessionStatus: 'open',
    startTime: '',
    team: String(route?.params?.teamId || '').trim(),
    totalPlayers: '',
    type: '',
    validationMode: 'auto',
  });
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!event) return;
    setFormState({
      capacity: event?.capacity != null ? String(event.capacity) : '',
      date: toDateInputValue(event?.date),
      description: String(event?.description || ''),
      endTime: toTimeInputValue(event?.endTime),
      facility: getEntityDocumentId(event?.facility),
      invitedTeams: Array.isArray(event?.invitedTeams)
        ? event.invitedTeams.map((team) => getEntityDocumentId(team)).filter(Boolean)
        : [],
      locationLabel: String(
        event?.locationDetails
          ? (() => {
            try {
              const parsed = JSON.parse(event.locationDetails);
              return parsed?.address?.description || parsed?.address?.label || parsed?.address?.address || '';
            } catch (_error) {
              return '';
            }
          })()
          : event?.location?.label || ''
      ),
      pricePerPerson: event?.pricePerPerson != null ? String(event.pricePerPerson) : '',
      sessionStatus: String(event?.sessionStatus || 'open'),
      startTime: toTimeInputValue(event?.startTime),
      team: getEntityDocumentId(event?.team),
      totalPlayers: event?.totalPlayers != null ? String(event.totalPlayers) : '',
      type: getEntityDocumentId(event?.type),
      validationMode: String(event?.validationMode || 'auto'),
    });
  }, [event]);

  const typeOptions = Array.isArray(eventTypes)
    ? eventTypes
    : Array.isArray(eventTypes?.data)
      ? eventTypes.data
      : [];

  const availableInvitedTeams = useMemo(
    () => trainedTeams.filter((team) => getEntityDocumentId(team) !== formState.team),
    [formState.team, trainedTeams],
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

  const updateField = (field, value) => {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleInvitedTeamsChange = (selectedOptions) => {
    const values = Array.from(selectedOptions || []).map((option) => option.value).filter(Boolean);
    updateField('invitedTeams', values);
  };

  const handleSubmit = async (eventObject) => {
    eventObject.preventDefault();
    setSubmitError('');

    if (!formState.type || !formState.team || !formState.date || !formState.startTime) {
      setSubmitError('Type, equipe, date et heure de debut sont obligatoires.');
      return;
    }

    const payload = createEventPayload({
      capacity: formState.capacity ? Number(formState.capacity) : null,
      date: toDisplayDateValue(formState.date),
      description: formState.description,
      facility: formState.facility || null,
      invitedTeams: formState.invitedTeams,
      location: formState.locationLabel
        ? { label: formState.locationLabel, value: '' }
        : undefined,
      pricePerPerson: formState.pricePerPerson ? Number(formState.pricePerPerson) : null,
      sessionStatus: formState.sessionStatus,
      startTime: formState.startTime,
      team: formState.team,
      totalPlayers: formState.totalPlayers ? Number(formState.totalPlayers) : null,
      type: formState.type,
      validationMode: formState.validationMode,
      endTime: formState.endTime,
    });

    try {
      if (eventId) {
        await updateEventMutation.mutateAsync({
          documentId: eventId,
          eventData: payload,
        });
      } else {
        await createEventMutation.mutateAsync(payload);
      }
    } catch (error) {
      setSubmitError(error?.message || 'Impossible d enregistrer cet evenement.');
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
        <section style={{ background: panelBackground, border: `1px solid ${borderColor}`, borderRadius: 28, padding: isTablet ? 32 : 22 }}>
          <div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <span style={{ color: accentColor, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Planning
              </span>
              <h1 style={{ fontFamily: 'Montserrat-Black, sans-serif', fontSize: isTablet ? 34 : 28, margin: 0 }}>
                {eventId ? 'Modifier un evenement' : 'Creer un evenement'}
              </h1>
            </div>
            <button
              onClick={() => navigation.goBack()}
              style={{ background: 'transparent', border: `1px solid ${borderColor}`, borderRadius: 999, color: textColor, cursor: 'pointer', padding: '10px 14px' }}
              type="button"
            >
              Retour
            </button>
          </div>

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
                <span style={{ color: mutedTextColor, fontSize: 13 }}>Equipe</span>
                <select onChange={(eventObject) => updateField('team', eventObject.target.value)} style={fieldStyle} value={formState.team}>
                  <option value="">Choisir une equipe</option>
                  {trainedTeams.map((team) => (
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
                  <span style={{ color: mutedTextColor, fontSize: 13 }}>Debut</span>
                  <input onChange={(eventObject) => updateField('startTime', eventObject.target.value)} style={fieldStyle} type="time" value={formState.startTime} />
                </label>
                <label style={{ display: 'grid', gap: 8 }}>
                  <span style={{ color: mutedTextColor, fontSize: 13 }}>Fin</span>
                  <input onChange={(eventObject) => updateField('endTime', eventObject.target.value)} style={fieldStyle} type="time" value={formState.endTime} />
                </label>
              </div>

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

              <label style={{ display: 'grid', gap: 8 }}>
                <span style={{ color: mutedTextColor, fontSize: 13 }}>Capacite</span>
                <input min="0" onChange={(eventObject) => updateField('capacity', eventObject.target.value)} style={fieldStyle} type="number" value={formState.capacity} />
              </label>

              <label style={{ display: 'grid', gap: 8 }}>
                <span style={{ color: mutedTextColor, fontSize: 13 }}>Joueurs attendus</span>
                <input min="0" onChange={(eventObject) => updateField('totalPlayers', eventObject.target.value)} style={fieldStyle} type="number" value={formState.totalPlayers} />
              </label>

              <label style={{ display: 'grid', gap: 8 }}>
                <span style={{ color: mutedTextColor, fontSize: 13 }}>Prix par personne</span>
                <input min="0" onChange={(eventObject) => updateField('pricePerPerson', eventObject.target.value)} style={fieldStyle} step="0.01" type="number" value={formState.pricePerPerson} />
              </label>

              <label style={{ display: 'grid', gap: 8 }}>
                <span style={{ color: mutedTextColor, fontSize: 13 }}>Validation</span>
                <select onChange={(eventObject) => updateField('validationMode', eventObject.target.value)} style={fieldStyle} value={formState.validationMode}>
                  <option value="auto">Automatique</option>
                  <option value="manual">Manuelle</option>
                </select>
              </label>

              <label style={{ display: 'grid', gap: 8 }}>
                <span style={{ color: mutedTextColor, fontSize: 13 }}>Etat de session</span>
                <select onChange={(eventObject) => updateField('sessionStatus', eventObject.target.value)} style={fieldStyle} value={formState.sessionStatus}>
                  <option value="open">Ouverte</option>
                  <option value="closed">Fermee</option>
                </select>
              </label>

              <label style={{ display: 'grid', gap: 8 }}>
                <span style={{ color: mutedTextColor, fontSize: 13 }}>Equipes invitees</span>
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
              </label>
            </div>

            <label style={{ display: 'grid', gap: 8 }}>
              <span style={{ color: mutedTextColor, fontSize: 13 }}>Description</span>
              <textarea
                onChange={(eventObject) => updateField('description', eventObject.target.value)}
                placeholder="Decris l evenement, le rendez-vous, les consignes..."
                style={{ ...fieldStyle, minHeight: 140, resize: 'vertical' }}
                value={formState.description}
              />
            </label>

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
                Mise a la une
              </strong>
              <span>
                La demande de mise a la une se fait depuis la fiche de l evenement apres creation.
              </span>
            </div>

            {submitError ? (
              <div style={{ color: '#ff6b81', fontSize: 14 }}>
                {submitError}
              </div>
            ) : null}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' }}>
              <div style={{ color: mutedTextColor, fontSize: 13, lineHeight: 1.5, maxWidth: 680 }}>
                Cette version web couvre le formulaire principal d edition/creation. Les flows wizard tres avances restent encore mappes dans leurs ecrans partages existants.
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => navigation.goBack()}
                  style={{ background: 'transparent', border: `1px solid ${borderColor}`, borderRadius: 999, color: textColor, cursor: 'pointer', padding: '12px 16px' }}
                  type="button"
                >
                  Annuler
                </button>
                <button
                  disabled={isSubmitting}
                  style={{
                    background: accentColor,
                    border: 0,
                    borderRadius: 999,
                    color: '#001218',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    fontFamily: 'Montserrat-Bold, sans-serif',
                    opacity: isSubmitting ? 0.7 : 1,
                    padding: '12px 18px',
                  }}
                  type="submit"
                >
                  {isSubmitting ? 'Enregistrement...' : eventId ? 'Mettre a jour' : 'Creer'}
                </button>
              </div>
            </div>
          </form>
        </section>
      </div>
    </ScreenContainer>
  );
}

export default EventEdit;
