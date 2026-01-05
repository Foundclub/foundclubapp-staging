import React from 'react';
import { View, Text, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import useTheme from '@/theme/themeContext';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { useEventWizard } from './EventWizardContext';
import { RouteNames } from '@/navigation/routeNames';
import { createEvent } from '@/services/event/eventService';
import useEvent from '@/domains/event/useEvent';

const EventWizardRecap = ({ navigation }) => {
  const { Colors, Fonts, Spaces, ApplicationStyle } = useTheme();
  const { t } = useTranslation();
  const { state, dispatch } = useEventWizard();

  // Check if this is a reservation
  const isReservation = state.type?.name?.toLowerCase().includes('réservation') || 
                        state.type?.name?.toLowerCase().includes('reservation');
  const { createReccurrentEventPayload } = useEvent();
  const queryClient = useQueryClient();

  // Mutation
  const createEventMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      dispatch({ type: 'RESET' });
      navigation.navigate(RouteNames.HomeTab);
    },
    onError: (error) => {
      console.error('Wizard Creation Error', error);
      Alert.alert('Erreur', 'Impossible de créer l\'événement.');
    }
  });

  const handleSubmit = async () => {
    const st = new Date(state.startTime);
    const et = new Date(state.endTime);
    const formattedStartTime = `${String(st.getHours()).padStart(2, '0')}:${String(st.getMinutes()).padStart(2, '0')}`;
    const formattedEndTime = `${String(et.getHours()).padStart(2, '0')}:${String(et.getMinutes()).padStart(2, '0')}`;
    const formattedDate = format(new Date(state.date), 'dd/MM/yyyy');

    const formData = {
      type: state.type?.documentId,
      team: state.team?.documentId,
      invitedTeams: state.invitedTeams || [],
      date: formattedDate,
      startTime: formattedStartTime,
      endTime: formattedEndTime,
      location: state.location,
      facility: state.facility,
      isRecurrent: state.isRecurrent,
      recurrenceFrequency: state.recurrenceFrequency || 'week',
      validationMode: 'auto',
      sessionStatus: 'open',
      // Reservation-specific fields
      ...(isReservation && {
        pricePerPerson: state.pricePerPerson,
        totalPlayers: state.totalPlayers,
      }),
    };

    const eventsPayload = createReccurrentEventPayload(formData);
    const promises = eventsPayload.map(e => createEventMutation.mutateAsync(e));

    try {
      await Promise.all(promises);
    } catch (e) {
      // Handled by mutation onError
    }
  };

  // Helper function to safely get location display text
  const getLocationDisplayText = () => {
    const loc = state.location;
    
    // Debug log to see what we're dealing with
    console.log('[EventWizardRecap] Location data:', JSON.stringify(loc, null, 2));
    
    if (!loc) return 'Terrain inconnu';
    if (typeof loc === 'string') return loc;
    
    if (typeof loc === 'object') {
      // Try common label properties
      const labelValue = loc.label || loc.description || loc.name || loc.address;
      
      if (labelValue) {
        // labelValue might also be an object, handle that
        if (typeof labelValue === 'string') return labelValue;
        if (typeof labelValue === 'object' && labelValue.label) return labelValue.label;
        if (typeof labelValue === 'object' && labelValue.description) return labelValue.description;
      }
      
      // Check for nested properties structure (from Google Places API)
      if (loc.properties && loc.properties.label) {
        return String(loc.properties.label);
      }
    }
    
    return 'Terrain inconnu';
  };

  // Safe date formatting
  const getFormattedDate = () => {
    try {
      return format(new Date(state.date), 'EEEE d MMMM yyyy', { locale: fr });
    } catch {
      return 'Date non définie';
    }
  };

  const getFormattedTime = () => {
    try {
      const start = format(new Date(state.startTime), 'HH:mm');
      const end = format(new Date(state.endTime), 'HH:mm');
      return `${start} - ${end}`;
    } catch {
      return 'Horaire non défini';
    }
  };

  return (
    <WizardStepLayout
      title={t('eventWizard.steps.recap.title', 'Tout est bon ?')}
      subtitle={t('eventWizard.steps.recap.subtitle', 'Vérifiez les détails avant de valider.')}
      onBack={() => navigation.goBack()}
      onNext={handleSubmit}
      nextLabel={t('common.create', 'Créer l\'événement')}
      isNextLoading={createEventMutation.isPending}
    >
      <View style={[Spaces.gap[16]]}>
        <View style={[ApplicationStyle.card, Spaces.padding[24], { backgroundColor: Colors.neutral800 }]}>
          <View style={[Spaces.gap[16]]}>
            {/* Type */}
            <View>
              <Text style={[Fonts.p2, Fonts.neutral200]}>Type</Text>
              <Text style={[Fonts.h4, Fonts.neutral00]}>{state.type?.name || 'Non défini'}</Text>
            </View>
            
            {/* Team */}
            <View>
              <Text style={[Fonts.p2, Fonts.neutral200]}>Équipe Organisatrice</Text>
              <Text style={[Fonts.h4, Fonts.neutral00]}>{state.team?.name || 'Non définie'}</Text>
            </View>
            
            {/* Date & Time */}
            <View>
              <Text style={[Fonts.p2, Fonts.neutral200]}>Date & Heure</Text>
              <Text style={[Fonts.h4, Fonts.neutral00]}>{getFormattedDate()}</Text>
              <Text style={[Fonts.p1, Fonts.primary500]}>{getFormattedTime()}</Text>
            </View>
            
            {/* Location */}
            <View>
              <Text style={[Fonts.p2, Fonts.neutral200]}>Lieu</Text>
              <Text style={[Fonts.h4, Fonts.neutral00]}>{getLocationDisplayText()}</Text>
            </View>

            {/* Reservation Details */}
            {isReservation && (
              <>
                <View>
                  <Text style={[Fonts.p2, Fonts.neutral200]}>Prix par personne</Text>
                  <Text style={[Fonts.h4, Fonts.neutral00]}>{state.pricePerPerson ? `${state.pricePerPerson}€` : 'Non défini'}</Text>
                </View>
                <View>
                  <Text style={[Fonts.p2, Fonts.neutral200]}>Nombre de joueurs</Text>
                  <Text style={[Fonts.h4, Fonts.neutral00]}>{state.totalPlayers || 'Non défini'}</Text>
                </View>
              </>
            )}

            {/* Recurrence */}
            {state.isRecurrent && (
              <View>
                <Text style={[Fonts.p2, Fonts.neutral200]}>Récurrence</Text>
                <Text style={[Fonts.h4, Fonts.primary500]}>Chaque semaine</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </WizardStepLayout>
  );
};

export default EventWizardRecap;
