
import React, { useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';

import useTheme from '@/theme/themeContext';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { useEventWizard } from './EventWizardContext';
import { RouteNames } from '@/navigation/routeNames';
import { createEvent } from '@/services/event/eventService';
import useEvent from '@/domains/event/useEvent';

const EventWizardRecap = ({ navigation }) => {
  const { Colors, Fonts, Spaces, Alignments, ApplicationStyle } = useTheme();
  const { t } = useTranslation();
  const { state, dispatch } = useEventWizard();
  const { createReccurrentEventPayload } = useEvent();
  const queryClient = useQueryClient();

  // Mutation
  const createEventMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      // Reset state
      dispatch({ type: 'RESET' });
      // Navigate Home/Back
      navigation.navigate(RouteNames.HomeTab); // Or Calendar
    },
    onError: (error) => {
      console.error('Wizard Creation Error', error);
      Alert.alert('Erreur', 'Impossible de créer l\'événement.');
    }
  });

  const handleSubmit = async () => {
    // Construct Payload
    // This needs to match what EventEdit.js produces.
    // We can reuse createReccurrentEventPayload from useEvent/eventService helper if possible
    // But currently `useEvent` hook logic might need the form data structure.
    
    // Let's reconstruct the data object expected by createReccurrentEventPayload or logic manually.
    // State has: date (Date obj), startTime (ISO string), endTime (ISO string)...
    
    // We need to format times to "HH:mm"
    const st = new Date(state.startTime);
    const et = new Date(state.endTime);
    const formattedStartTime = `${String(st.getHours()).padStart(2, '0')}:${String(st.getMinutes()).padStart(2, '0')}`;
    const formattedEndTime = `${String(et.getHours()).padStart(2, '0')}:${String(et.getMinutes()).padStart(2, '0')}`;
    const formattedDate = format(new Date(state.date), 'dd/MM/yyyy'); // Assuming utility expects this or we construct payload directly

    // Recurrence
    // If recurrent, we need specific fields.
    
    const formData = {
        type: state.type.documentId,
        team: state.team.documentId,
        invitedTeams: state.invitedTeams || [],
        
        date: formattedDate,
        startTime: formattedStartTime,
        endTime: formattedEndTime,
        
        location: state.location,
        facility: state.facility,
        
        isRecurrent: state.isRecurrent,
        recurrenceFrequency: state.recurrenceFrequency || 'week',
        // Optional: Recurrence end date defaults to +3 months if not set?? Or simple infinite?
        // Let's assume 10 occurences or calculate end date if we had the field.
        // For MVP, if recurrent, maybe iterate 10 times or reuse helper.
        // If helper methods are available in `useEvent`, let's try to use them.
        
        validationMode: 'auto',
        sessionStatus: 'open',
    };

    // Use helper effectively
    const eventsPayload = createReccurrentEventPayload(formData);

    // If multiple events (recurrence)
    const promises = eventsPayload.map(e => createEventMutation.mutateAsync(e));
    
    try {
        await Promise.all(promises);
    } catch(e) {
        // Handled by mutation onError usually, but Promise.all fails fast
    }
  };

  const { type, team, date, startTime, location } = state;

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
                <View>
                    <Text style={[Fonts.p2, Fonts.neutral200]}>Type</Text>
                    <Text style={[Fonts.h4, Fonts.neutral00]}>{type?.name}</Text>
                </View>
                <View>
                    <Text style={[Fonts.p2, Fonts.neutral200]}>Équipe Organisatrice</Text>
                    <Text style={[Fonts.h4, Fonts.neutral00]}>{team?.name}</Text>
                </View>
                 <View>
                    <Text style={[Fonts.p2, Fonts.neutral200]}>Date & Heure</Text>
                    <Text style={[Fonts.h4, Fonts.neutral00]}>
                        {format(new Date(date), 'dd MMMM yyyy')}
                    </Text>
                    <Text style={[Fonts.p1, Fonts.primary500]}>
                         {format(new Date(startTime), 'HH:mm')} to {format(new Date(state.endTime), 'HH:mm')}
                    </Text>
                </View>
                 <View>
                    <Text style={[Fonts.p2, Fonts.neutral200]}>Lieu</Text>
                    <Text style={[Fonts.h4, Fonts.neutral00]}>
                        {location?.label || 'Terrain inconnu'}
                    </Text>
                </View>
            </View>
         </View>
      </View>
    </WizardStepLayout>
  );
};

export default EventWizardRecap;
