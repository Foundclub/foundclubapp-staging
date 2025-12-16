import React from 'react';
import { View, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';

import { TacticalBoard } from '@/components/tactical';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateEvent } from '@/services/event/eventService';

/**
 * TacticalBoardScreen - Screen wrapper for TacticalBoard component
 * Receives serializable params via route and handles save
 */
const TacticalBoardScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  
  const { eventId, sport = 'generic', players = [], existingComposition } = route.params || {};

  // Mutation for saving composition
  const saveCompositionMutation = useMutation({
    mutationFn: async (composition) => {
      return updateEvent({
        documentId: eventId,
        eventData: {
          composition: JSON.stringify(composition),
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      Alert.alert('Succès', 'La composition a été enregistrée.', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    },
    onError: (error) => {
      console.error('Save composition error:', error);
      Alert.alert('Erreur', 'Impossible d\'enregistrer la composition.');
    },
  });

  const handleSave = (composition) => {
    saveCompositionMutation.mutate(composition);
  };

  const handleBack = () => {
    navigation.goBack();
  };

  // Parse existing composition if any
  const initialComposition = React.useMemo(() => {
    if (existingComposition) {
      try {
        return typeof existingComposition === 'string' 
          ? JSON.parse(existingComposition) 
          : existingComposition;
      } catch (e) {
        return null;
      }
    }
    return null;
  }, [existingComposition]);

  return (
    <View style={{ flex: 1 }}>
      <TacticalBoard
        sport={sport}
        players={players}
        initialComposition={initialComposition}
        onSave={handleSave}
        onBack={handleBack}
      />
    </View>
  );
};

export default TacticalBoardScreen;
