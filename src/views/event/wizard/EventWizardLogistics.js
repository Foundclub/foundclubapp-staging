
import React, { useState } from 'react';
import { View, Text, Switch, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import DateTimePicker from '@react-native-community/datetimepicker';

import useTheme from '@/theme/themeContext';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { useEventWizard } from './EventWizardContext';
import { RouteNames } from '@/navigation/routeNames';
import Button from '@/components/atoms/button/Button';

const EventWizardLogistics = ({ navigation }) => {
  const { Colors, Fonts, Spaces, Alignments, ApplicationStyle } = useTheme();
  const { t } = useTranslation();
  const { state, dispatch } = useEventWizard();

  const [date, setDate] = useState(state.date || new Date());
  
  // Default times if not set: Start now (rounded), End +1.5h
  const defaultStart = new Date();
  defaultStart.setMinutes(0, 0, 0); // Round to hour
  const defaultEnd = new Date(defaultStart);
  defaultEnd.setHours(defaultEnd.getHours() + 1, 30);

  const [startTime, setStartTime] = useState(state.startTime ? new Date(state.startTime) : defaultStart);
  const [endTime, setEndTime] = useState(state.endTime ? new Date(state.endTime) : defaultEnd);
  
  const [isRecurrent, setIsRecurrent] = useState(state.isRecurrent || false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const handleNext = () => {
    dispatch({ 
      type: 'SET_LOGISTICS', 
      payload: { 
        date, 
        startTime: startTime.toISOString(), 
        endTime: endTime.toISOString(), 
        isRecurrent 
        // Recurrence details would be expanded here if UI allows
      } 
    });
    navigation.navigate(RouteNames.EventWizardLocation);
  };

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) setDate(selectedDate);
  };

  const onStartTimeChange = (event, selectedDate) => {
     setShowStartTimePicker(Platform.OS === 'ios');
     if (selectedDate) setStartTime(selectedDate);
  };

  const onEndTimeChange = (event, selectedDate) => {
    setShowEndTimePicker(Platform.OS === 'ios');
    if (selectedDate) setEndTime(selectedDate);
  };

  return (
    <WizardStepLayout
      title={t('eventWizard.steps.logistics.title', 'C\'est pour quand ?')}
      subtitle={t('eventWizard.steps.logistics.subtitle', 'Définissez la date et l\'heure.')}
      onBack={() => navigation.goBack()}
      onNext={handleNext}
    >
      <View style={[Spaces.gap[24]]}>
        
        {/* Date Picker Trigger */}
        <View>
          <Text style={[Fonts.p1Bold, Fonts.neutral00, Spaces.marginBottom[8]]}>Date</Text>
          {Platform.OS === 'android' ? (
             <Button 
               variant="Secondary" 
               title={date.toLocaleDateString()} 
               onPress={() => setShowDatePicker(true)} 
             />
          ) : (
             <DateTimePicker
               value={date}
               mode="date"
               display="spinner"
               onChange={onDateChange}
               textColor="white"
             />
          )}
          {Platform.OS === 'android' && showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display="default"
              onChange={onDateChange}
            />
          )}
        </View>

        {/* Time Pickers */}
        <View style={[Alignments.row, Spaces.gap[16]]}>
           <View style={{flex: 1}}>
              <Text style={[Fonts.p1Bold, Fonts.neutral00, Spaces.marginBottom[8]]}>Début</Text>
               {Platform.OS === 'android' ? (
                <Button 
                  variant="Secondary" 
                  title={startTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} 
                  onPress={() => setShowStartTimePicker(true)} 
                />
               ) : (
                <DateTimePicker
                  value={startTime}
                  mode="time"
                  display="spinner"
                  onChange={onStartTimeChange}
                   textColor="white"
                />
               )}
               {Platform.OS === 'android' && showStartTimePicker && (
                <DateTimePicker
                  value={startTime}
                  mode="time"
                  display="default"
                  onChange={onStartTimeChange}
                  is24Hour={true}
                />
              )}
           </View>

           <View style={{flex: 1}}>
              <Text style={[Fonts.p1Bold, Fonts.neutral00, Spaces.marginBottom[8]]}>Fin</Text>
               {Platform.OS === 'android' ? (
                <Button 
                  variant="Secondary" 
                  title={endTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} 
                  onPress={() => setShowEndTimePicker(true)} 
                />
               ) : (
                <DateTimePicker
                  value={endTime}
                  mode="time"
                  display="spinner"
                  onChange={onEndTimeChange}
                   textColor="white"
                />
               )}
               {Platform.OS === 'android' && showEndTimePicker && (
                <DateTimePicker
                  value={endTime}
                  mode="time"
                  display="default"
                  onChange={onEndTimeChange}
                  is24Hour={true}
                />
              )}
           </View>
        </View>

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
