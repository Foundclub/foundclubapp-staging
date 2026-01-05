
import React, { useState } from 'react';
import { View, Text, Switch, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';

import useTheme from '@/theme/themeContext';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { useEventWizard } from './EventWizardContext';
import { RouteNames } from '@/navigation/routeNames';
import DateTimeSelector from '@/components/molecules/dateTimeSelector/DateTimeSelector';

const EventWizardLogistics = ({ navigation }) => {
  const { Colors, Fonts, Spaces, Alignments, ApplicationStyle } = useTheme();
  const { t } = useTranslation();
  const { state, dispatch } = useEventWizard();

  // Check if this is a reservation
  const isReservation = state.type?.name?.toLowerCase().includes('réservation') || 
                        state.type?.name?.toLowerCase().includes('reservation');

  // Initialization logic
  const now = new Date();
  
  // Default Times logic: Start next hour, End +1.5h
  const defaultStart = new Date(now);
  defaultStart.setHours(now.getHours() + 1, 0, 0, 0); 
  
  const defaultEnd = new Date(defaultStart);
  defaultEnd.setHours(defaultEnd.getHours() + 1, 30);

  // State
  const [date, setDate] = useState(state.date ? new Date(state.date) : now);
  const [startTime, setStartTime] = useState(state.startTime ? new Date(state.startTime) : defaultStart);
  const [endTime, setEndTime] = useState(state.endTime ? new Date(state.endTime) : defaultEnd);
  const [isRecurrent, setIsRecurrent] = useState(state.isRecurrent || false);
  
  // Reservation-specific state
  const [pricePerPerson, setPricePerPerson] = useState(state.pricePerPerson?.toString() || '');
  const [totalPlayers, setTotalPlayers] = useState(state.totalPlayers?.toString() || '');

  const handleNext = () => {
    // Combine date + time for robust storage
    const fullStartDate = new Date(date);
    fullStartDate.setHours(startTime.getHours(), startTime.getMinutes());

    const fullEndDate = new Date(date);
    fullEndDate.setHours(endTime.getHours(), endTime.getMinutes());

    // Basic Validation: End after Start?
    if (fullEndDate <= fullStartDate) {
       // Ideally show error toast here, or auto-adjust end time
       // For now, we proceed, or we could clamp it.
    }

    const payload = { 
      date: fullStartDate.toISOString(), // Store combined entry
      startTime: fullStartDate.toISOString(), 
      endTime: fullEndDate.toISOString(), 
      isRecurrent 
    };

    // Add reservation fields if applicable
    if (isReservation) {
      payload.pricePerPerson = pricePerPerson ? parseFloat(pricePerPerson) : null;
      payload.totalPlayers = totalPlayers ? parseInt(totalPlayers, 10) : null;
    }

    dispatch({ 
      type: 'SET_LOGISTICS', 
      payload 
    });
    navigation.navigate(RouteNames.EventWizardLocation);
  };

  return (
    <WizardStepLayout
      title={t('eventWizard.steps.logistics.title', "C'est pour quand ?")}
      subtitle={t('eventWizard.steps.logistics.subtitle', 'Définissez la date et l\'heure.')}
      onBack={() => navigation.goBack()}
      onNext={handleNext}
    >
      <View style={[Spaces.gap[24]]}>
        
        {/* Date Selection */}
        <DateTimeSelector 
          label="Date"
          mode="date"
          value={date}
          onChange={setDate}
        />

        {/* Time Selection Row */}
        <View style={[Alignments.row, Spaces.gap[16]]}>
           <View style={{flex: 1}}>
             <DateTimeSelector 
               label="Heure de début"
               mode="time"
               value={startTime}
               onChange={setStartTime}
             />
           </View>
           <View style={{flex: 1}}>
             <DateTimeSelector 
               label="Heure de fin"
               mode="time"
               value={endTime}
               onChange={setEndTime}
             />
           </View>
        </View>

        {/* Reservation-specific fields */}
        {isReservation && (
          <View style={[Spaces.gap[16]]}>
            <View>
              <Text style={[Fonts.p2, Fonts.neutral200, Spaces.marginBottom[8]]}>Prix par personne (€)</Text>
              <TextInput
                style={[
                  ApplicationStyle.card,
                  Spaces.padding[16],
                  Fonts.p1,
                  { backgroundColor: Colors.neutral800, color: Colors.neutral00, borderRadius: 8 }
                ]}
                placeholder="Ex: 10"
                placeholderTextColor={Colors.neutral500}
                keyboardType="numeric"
                value={pricePerPerson}
                onChangeText={setPricePerPerson}
              />
            </View>
            <View>
              <Text style={[Fonts.p2, Fonts.neutral200, Spaces.marginBottom[8]]}>Nombre de joueurs</Text>
              <TextInput
                style={[
                  ApplicationStyle.card,
                  Spaces.padding[16],
                  Fonts.p1,
                  { backgroundColor: Colors.neutral800, color: Colors.neutral00, borderRadius: 8 }
                ]}
                placeholder="Ex: 10"
                placeholderTextColor={Colors.neutral500}
                keyboardType="numeric"
                value={totalPlayers}
                onChangeText={setTotalPlayers}
              />
            </View>
          </View>
        )}

        {/* Recurrence Switch */}
        <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, ApplicationStyle.card, Spaces.padding[16], {backgroundColor: Colors.neutral800}]}>
          <Text style={[Fonts.p1Bold, Fonts.neutral00]}>Répéter chaque semaine</Text>
          <Switch
            value={isRecurrent}
            onValueChange={setIsRecurrent}
            trackColor={{ false: Colors.neutral500, true: Colors.primary500 }}
            thumbColor={Colors.neutral00}
          />
        </View>

      </View>
    </WizardStepLayout>
  );
};

export default EventWizardLogistics;

