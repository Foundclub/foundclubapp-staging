import { useEffect, useMemo, useState } from 'react';
import { addDays, addMinutes, format, parse, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useWindowDimensions } from 'react-native';

import { BREAKPOINTS } from '@/responsive';
import ScreenContainer from '@/components/templates/ScreenContainer';
import { RouteNames } from '@/navigation/routeNames';
import {
  useCreateBooking,
  useGetBookableFacilities,
  useGetFacility,
  useGetFacilityAvailability,
} from '@/services/facility/facilityQueries';
import useTheme from '@/theme/themeContext';
import { getEntityDocumentId } from '@/utils/entityId';

const normalizeFacilities = (response) => {
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response)) return response;
  return [];
};

const resolveFacility = (response) => response?.data || response || null;

const getDurationOptions = (facility, selectedSlot) => {
  if (!facility || !selectedSlot) return [];

  const slotDuration = Number(facility?.slotDuration || 30);
  const maxDuration = Number(selectedSlot?.maxDuration || slotDuration);
  const pricePerSlot = Number(facility?.pricePerSlot || selectedSlot?.price || 0);
  const options = [];

  for (let duration = slotDuration; duration <= maxDuration && duration <= 180; duration += slotDuration) {
    const slots = duration / slotDuration;
    options.push({
      duration,
      label: duration >= 60
        ? `${Math.floor(duration / 60)}h${duration % 60 ? String(duration % 60).padStart(2, '0') : ''}`
        : `${duration} min`,
      price: slots * pricePerSlot,
      slots,
    });
  }

  return options;
};

const formatFullDate = (value) => format(value, 'EEEE d MMMM', { locale: fr });

const getFacilityMeta = (facility) => {
  const chunks = [];
  if (facility?.activity?.name) chunks.push(facility.activity.name);
  if (facility?.pricePerSlot != null && facility?.slotDuration) {
    chunks.push(`${facility.pricePerSlot} EUR / ${facility.slotDuration} min`);
  }
  return chunks.join(' • ');
};

function BookingCalendar({ navigation, route }) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= BREAKPOINTS.desktop;
  const isTablet = width >= BREAKPOINTS.tablet;
  const { Colors } = useTheme();
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(route?.params?.date ? new Date(route.params.date) : new Date()));
  const [selectedFacilityId, setSelectedFacilityId] = useState(() => String(route?.params?.facilityId || '').trim());
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedDuration, setSelectedDuration] = useState(null);
  const [mode, setMode] = useState('private');
  const [currentPlayers, setCurrentPlayers] = useState(1);
  const [targetPlayers, setTargetPlayers] = useState(10);
  const [bookingName, setBookingName] = useState('');
  const [submitError, setSubmitError] = useState('');

  const dateString = format(selectedDate, 'yyyy-MM-dd');
  const {
    data: facilitiesResponse,
    error: facilitiesError,
    isLoading: facilitiesLoading,
  } = useGetBookableFacilities();
  const facilities = useMemo(() => normalizeFacilities(facilitiesResponse), [facilitiesResponse]);

  useEffect(() => {
    if (selectedFacilityId || facilities.length === 0) return;
    setSelectedFacilityId(getEntityDocumentId(facilities[0]));
  }, [facilities, selectedFacilityId]);

  const {
    data: facilityResponse,
    isLoading: facilityLoading,
  } = useGetFacility(selectedFacilityId, {
    enabled: Boolean(selectedFacilityId),
  });

  const facility = resolveFacility(facilityResponse)
    || facilities.find((item) => getEntityDocumentId(item) === selectedFacilityId)
    || null;

  const {
    data: availability,
    error: availabilityError,
    isLoading: availabilityLoading,
    refetch,
  } = useGetFacilityAvailability(selectedFacilityId, dateString, {
    enabled: Boolean(selectedFacilityId && dateString),
  });

  const createBookingMutation = useCreateBooking({
    onSuccess: (response) => {
      const reservationId = getEntityDocumentId(response?.data || response);
      setSubmitError('');
      if (reservationId) {
        navigation.replace(RouteNames.ReservationDetails, { reservationId });
      } else {
        navigation.goBack();
      }
    },
  });

  const dateOptions = useMemo(() => {
    const now = startOfDay(new Date());
    return Array.from({ length: 14 }, (_, index) => addDays(now, index));
  }, []);

  const durationOptions = useMemo(
    () => getDurationOptions(facility, selectedSlot),
    [facility, selectedSlot],
  );

  useEffect(() => {
    setSelectedSlot(null);
    setSelectedDuration(null);
  }, [selectedFacilityId, dateString]);

  useEffect(() => {
    if (!selectedSlot || durationOptions.length === 0) {
      setSelectedDuration(null);
      return;
    }

    setSelectedDuration((current) => (
      current && durationOptions.some((option) => option.duration === current.duration)
        ? current
        : durationOptions[0]
    ));
  }, [durationOptions, selectedSlot]);

  useEffect(() => {
    if (mode === 'private') {
      setCurrentPlayers(1);
      return;
    }

    setCurrentPlayers((value) => Math.max(1, Math.min(value, targetPlayers - 1)));
  }, [mode, targetPlayers]);

  const endTime = useMemo(() => {
    if (!selectedSlot || !selectedDuration) return '';
    const startDate = parse(selectedSlot.time, 'HH:mm', new Date());
    return format(addMinutes(startDate, selectedDuration.duration), 'HH:mm');
  }, [selectedDuration, selectedSlot]);

  const handleSlotSelect = (slot) => {
    if (Number(slot?.remaining || 0) <= 0) return;
    setSelectedSlot(slot);
  };

  const handleSubmit = async () => {
    if (!selectedFacilityId || !selectedSlot || !selectedDuration || !endTime) {
      setSubmitError('Choisis une installation, un créneau et une durée.');
      return;
    }

    try {
      await createBookingMutation.mutateAsync({
        currentPlayers: mode === 'shared' ? Number(currentPlayers) : undefined,
        date: dateString,
        endTime,
        facilityId: selectedFacilityId,
        mode,
        name: bookingName.trim() || undefined,
        startTime: selectedSlot.time,
        targetPlayers: mode === 'shared' ? Number(targetPlayers) : undefined,
      });
    } catch (error) {
      setSubmitError(error?.message || 'Impossible de créer cette réservation.');
    }
  };

  const borderColor = 'rgba(255,255,255,0.08)';
  const sectionBackground = 'rgba(6, 19, 29, 0.78)';
  const panelBackground = 'rgba(8, 26, 39, 0.9)';
  const textColor = Colors?.neutral00 || '#ffffff';
  const mutedTextColor = Colors?.neutral300 || '#adb1b2';
  const accentColor = Colors?.primary500 || '#01b3f4';
  const fieldsDisabled = createBookingMutation.isPending || facilitiesLoading || facilityLoading;

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
        <section style={{ background: sectionBackground, border: `1px solid ${borderColor}`, borderRadius: 28, padding: isTablet ? 28 : 20 }}>
          <div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <span style={{ color: accentColor, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Réservations
              </span>
              <h1 style={{ fontFamily: 'Montserrat-Black, sans-serif', fontSize: isTablet ? 34 : 28, margin: 0 }}>
                Réserver une installation
              </h1>
              <p style={{ color: mutedTextColor, margin: 0, maxWidth: 640 }}>
                Sélectionne une installation, un créneau disponible et configure ta réservation directement depuis le web.
              </p>
            </div>
            <button
              onClick={() => navigation.goBack()}
              style={{ background: 'transparent', border: `1px solid ${borderColor}`, borderRadius: 999, color: textColor, cursor: 'pointer', padding: '10px 14px' }}
              type="button"
            >
              Retour
            </button>
          </div>

          <div style={{ display: 'grid', gap: 18, gridTemplateColumns: isDesktop ? 'minmax(0, 1.35fr) 360px' : '1fr' }}>
            <div style={{ display: 'grid', gap: 18 }}>
              <div style={{ display: 'grid', gap: 16, gridTemplateColumns: isTablet ? '1.15fr 1fr' : '1fr' }}>
                <label style={{ display: 'grid', gap: 8 }}>
                  <span style={{ color: mutedTextColor, fontSize: 13 }}>Installation</span>
                  <select
                    disabled={fieldsDisabled || facilities.length === 0}
                    onChange={(event) => setSelectedFacilityId(event.target.value)}
                    style={fieldStyle}
                    value={selectedFacilityId}
                  >
                    <option value="">Choisir une installation</option>
                    {facilities.map((item) => {
                      const itemId = getEntityDocumentId(item);
                      return (
                        <option key={itemId} value={itemId}>
                          {item?.name || 'Installation'}
                        </option>
                      );
                    })}
                  </select>
                </label>

                <label style={{ display: 'grid', gap: 8 }}>
                  <span style={{ color: mutedTextColor, fontSize: 13 }}>Nom de la réservation</span>
                  <input
                    onChange={(event) => setBookingName(event.target.value)}
                    placeholder="Ex: Five entre amis"
                    style={fieldStyle}
                    type="text"
                    value={bookingName}
                  />
                </label>
              </div>

              {facility ? (
                <div style={{ background: panelBackground, border: `1px solid ${borderColor}`, borderRadius: 22, display: 'grid', gap: 8, padding: isTablet ? 22 : 18 }}>
                  <h2 style={{ fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 22, margin: 0 }}>
                    {facility?.name}
                  </h2>
                  {getFacilityMeta(facility) ? (
                    <p style={{ color: accentColor, margin: 0 }}>
                      {getFacilityMeta(facility)}
                    </p>
                  ) : null}
                  {facility?.address ? (
                    <p style={{ color: mutedTextColor, margin: 0 }}>
                      {String(facility.address)}
                    </p>
                  ) : null}
                </div>
              ) : (
                <div style={{ background: 'rgba(255,255,255,0.04)', border: `1px dashed ${borderColor}`, borderRadius: 22, color: mutedTextColor, padding: 20 }}>
                  {facilitiesError
                    ? (facilitiesError?.message || 'Impossible de charger les installations.')
                    : facilities.length === 0
                      ? 'Aucune installation reservable n est disponible pour le moment.'
                      : 'Choisis une installation pour voir ses creneaux disponibles.'}
                </div>
              )}

              <div style={{ display: 'grid', gap: 12 }}>
                <span style={{ color: mutedTextColor, fontSize: 13 }}>Date</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {dateOptions.map((option) => {
                    const isSelected = format(option, 'yyyy-MM-dd') === dateString;
                    const isToday = format(option, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                    return (
                      <button
                        key={option.toISOString()}
                        onClick={() => setSelectedDate(option)}
                        style={{
                          alignItems: 'center',
                          background: isSelected ? 'rgba(1,179,244,0.14)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${isSelected ? accentColor : borderColor}`,
                          borderRadius: 18,
                          color: textColor,
                          cursor: 'pointer',
                          display: 'grid',
                          gap: 4,
                          minWidth: 88,
                          padding: '12px 14px',
                        }}
                        type="button"
                      >
                        <span style={{ fontSize: 12, opacity: 0.78 }}>{format(option, 'EEE', { locale: fr })}</span>
                        <strong style={{ fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 18 }}>{format(option, 'd')}</strong>
                        <span style={{ color: isToday ? accentColor : mutedTextColor, fontSize: 11 }}>
                          {isToday ? 'Aujourd’hui' : format(option, 'MMM', { locale: fr })}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ alignItems: 'baseline', display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' }}>
                  <h2 style={{ fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 22, margin: 0 }}>
                    Créneaux du
                    {' '}
                    {formatFullDate(selectedDate)}
                  </h2>
                  {availabilityLoading ? (
                    <span style={{ color: mutedTextColor, fontSize: 13 }}>Chargement des disponibilités…</span>
                  ) : null}
                </div>

                {availabilityError ? (
                  <div style={{ background: 'rgba(220, 64, 64, 0.12)', border: '1px solid rgba(220, 64, 64, 0.28)', borderRadius: 22, color: '#ffd6d6', padding: 20 }}>
                    {availabilityError?.message || 'Impossible de charger les disponibilites.'}
                  </div>
                ) : availability?.slots?.length > 0 ? (
                  <div style={{ display: 'grid', gap: 12, gridTemplateColumns: isTablet ? 'repeat(3, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))' }}>
                    {availability.slots.map((slot) => {
                      const isAvailable = Number(slot?.remaining || 0) > 0;
                      const isSelected = selectedSlot?.time === slot?.time;
                      return (
                        <button
                          disabled={!isAvailable}
                          key={slot.time}
                          onClick={() => handleSlotSelect(slot)}
                          style={{
                            background: isSelected ? 'rgba(1,179,244,0.12)' : 'rgba(255,255,255,0.04)',
                            border: `1px solid ${isSelected ? accentColor : borderColor}`,
                            borderRadius: 20,
                            color: isAvailable ? textColor : mutedTextColor,
                            cursor: isAvailable ? 'pointer' : 'not-allowed',
                            display: 'grid',
                            gap: 6,
                            opacity: isAvailable ? 1 : 0.55,
                            padding: '16px 18px',
                            textAlign: 'left',
                          }}
                          type="button"
                        >
                          <strong style={{ fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 20 }}>{slot.time}</strong>
                          <span style={{ color: isAvailable ? accentColor : mutedTextColor, fontSize: 13 }}>
                            {isAvailable ? `${slot.remaining} place${Number(slot.remaining) > 1 ? 's' : ''} dispo` : 'Complet'}
                          </span>
                          <span style={{ color: mutedTextColor, fontSize: 12 }}>
                            Durée max {Math.floor(Number(slot?.maxDuration || 0) / 60) > 0 ? `${Math.floor(Number(slot.maxDuration) / 60)}h` : ''}{Number(slot?.maxDuration || 0) % 60 ? ` ${Number(slot.maxDuration) % 60} min` : Number(slot?.maxDuration || 0) >= 60 ? '' : `${slot.maxDuration} min`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : selectedFacilityId ? (
                  <div style={{ background: 'rgba(255,255,255,0.04)', border: `1px dashed ${borderColor}`, borderRadius: 22, color: mutedTextColor, padding: 20 }}>
                    Aucun créneau disponible pour cette date.
                  </div>
                ) : (
                  <div style={{ background: 'rgba(255,255,255,0.04)', border: `1px dashed ${borderColor}`, borderRadius: 22, color: mutedTextColor, padding: 20 }}>
                    Sélectionne d’abord une installation.
                  </div>
                )}
              </div>
            </div>

            <aside style={{ alignSelf: 'start', background: panelBackground, border: `1px solid ${borderColor}`, borderRadius: 24, display: 'grid', gap: 18, padding: isTablet ? 24 : 18, position: isDesktop ? 'sticky' : 'relative', top: isDesktop ? 24 : 'auto' }}>
              <div style={{ display: 'grid', gap: 6 }}>
                <span style={{ color: accentColor, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Configuration
                </span>
                <h2 style={{ fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 24, margin: 0 }}>
                  {selectedSlot ? `${selectedSlot.time}${endTime ? ` - ${endTime}` : ''}` : 'Choisis un créneau'}
                </h2>
                <p style={{ color: mutedTextColor, margin: 0 }}>
                  {selectedSlot
                    ? `Finalise ta réservation du ${formatFullDate(selectedDate)}.`
                    : 'Sélectionne un créneau disponible pour configurer la réservation.'}
                </p>
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                <span style={{ color: mutedTextColor, fontSize: 13 }}>Durée</span>
                <div style={{ display: 'grid', gap: 10 }}>
                  {durationOptions.length > 0 ? durationOptions.map((option) => {
                    const isSelected = selectedDuration?.duration === option.duration;
                    return (
                      <button
                        key={option.duration}
                        onClick={() => setSelectedDuration(option)}
                        style={{
                          alignItems: 'center',
                          background: isSelected ? 'rgba(1,179,244,0.12)' : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${isSelected ? accentColor : borderColor}`,
                          borderRadius: 18,
                          color: textColor,
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '14px 16px',
                          textAlign: 'left',
                        }}
                        type="button"
                      >
                        <span>{option.label}</span>
                        <strong style={{ fontFamily: 'Montserrat-Bold, sans-serif' }}>{option.price} EUR</strong>
                      </button>
                    );
                  }) : (
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px dashed ${borderColor}`, borderRadius: 18, color: mutedTextColor, padding: 16 }}>
                      La durée sera disponible dès qu’un créneau sera choisi.
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gap: 12 }}>
                <span style={{ color: mutedTextColor, fontSize: 13 }}>Mode</span>
                <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
                  {[
                    { description: 'Tu privatises tout le terrain pour ton groupe.', label: 'Privé', value: 'private' },
                    { description: 'Tu ouvres la réservation à d’autres joueurs.', label: 'Partagé', value: 'shared' },
                  ].map((option) => {
                    const isSelected = mode === option.value;
                    return (
                      <button
                        key={option.value}
                        onClick={() => setMode(option.value)}
                        style={{
                          background: isSelected ? 'rgba(1,179,244,0.12)' : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${isSelected ? accentColor : borderColor}`,
                          borderRadius: 18,
                          color: textColor,
                          cursor: 'pointer',
                          display: 'grid',
                          gap: 6,
                          padding: '14px 14px',
                          textAlign: 'left',
                        }}
                        type="button"
                      >
                        <strong style={{ fontFamily: 'Montserrat-Bold, sans-serif' }}>{option.label}</strong>
                        <span style={{ color: mutedTextColor, fontSize: 12 }}>{option.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {mode === 'shared' ? (
                <div style={{ display: 'grid', gap: 14 }}>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <span style={{ color: mutedTextColor, fontSize: 13 }}>Joueurs déjà confirmés</span>
                    <input
                      max={Math.max(1, targetPlayers - 1)}
                      min={1}
                      onChange={(event) => setCurrentPlayers(Math.max(1, Number(event.target.value || 1)))}
                      style={fieldStyle}
                      type="number"
                      value={currentPlayers}
                    />
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <span style={{ color: mutedTextColor, fontSize: 13 }}>Objectif total de joueurs</span>
                    <input
                      max={22}
                      min={Math.max(2, currentPlayers + 1)}
                      onChange={(event) => setTargetPlayers(Math.max(currentPlayers + 1, Number(event.target.value || currentPlayers + 1)))}
                      style={fieldStyle}
                      type="number"
                      value={targetPlayers}
                    />
                  </div>
                </div>
              ) : null}

              <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${borderColor}`, borderRadius: 18, display: 'grid', gap: 8, padding: 16 }}>
                <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: mutedTextColor }}>Date</span>
                  <strong style={{ fontFamily: 'Montserrat-Bold, sans-serif' }}>{format(selectedDate, 'dd/MM/yyyy')}</strong>
                </div>
                <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: mutedTextColor }}>Créneau</span>
                  <strong style={{ fontFamily: 'Montserrat-Bold, sans-serif' }}>{selectedSlot ? selectedSlot.time : '—'}</strong>
                </div>
                <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: mutedTextColor }}>Fin</span>
                  <strong style={{ fontFamily: 'Montserrat-Bold, sans-serif' }}>{endTime || '—'}</strong>
                </div>
                <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: mutedTextColor }}>Prix estimé</span>
                  <strong style={{ color: accentColor, fontFamily: 'Montserrat-Bold, sans-serif' }}>
                    {selectedDuration ? `${selectedDuration.price} EUR` : '—'}
                  </strong>
                </div>
              </div>

              {submitError ? (
                <div style={{ background: 'rgba(220, 64, 64, 0.12)', border: '1px solid rgba(220, 64, 64, 0.28)', borderRadius: 16, color: '#ffd6d6', padding: 14 }}>
                  {submitError}
                </div>
              ) : null}

              <button
                disabled={!selectedSlot || !selectedDuration || createBookingMutation.isPending || Boolean(availabilityError)}
                onClick={handleSubmit}
                style={{
                  background: !selectedSlot || !selectedDuration || createBookingMutation.isPending || availabilityError ? 'rgba(255,255,255,0.14)' : accentColor,
                  border: 0,
                  borderRadius: 999,
                  color: '#04131d',
                  cursor: !selectedSlot || !selectedDuration || createBookingMutation.isPending || availabilityError ? 'not-allowed' : 'pointer',
                  fontFamily: 'Montserrat-Bold, sans-serif',
                  fontSize: 15,
                  padding: '14px 18px',
                }}
                type="button"
              >
                {createBookingMutation.isPending ? 'Création…' : 'Confirmer la réservation'}
              </button>

              <button
                onClick={() => refetch()}
                style={{ background: 'transparent', border: `1px solid ${borderColor}`, borderRadius: 999, color: textColor, cursor: 'pointer', padding: '12px 16px' }}
                type="button"
              >
                Rafraîchir les disponibilités
              </button>
            </aside>
          </div>
        </section>
      </div>
    </ScreenContainer>
  );
}

export default BookingCalendar;
