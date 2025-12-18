import React from 'react';
import { View, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';

import { TacticalBoard } from '@/components/tactical';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateEvent } from '@/services/event/eventService';

/**
 * @typedef {Object} TacticalBoardRouteParams
 * @property {string} [eventId]
 * @property {string} [sport]
 * @property {Array<{id?: string, documentId?: string, firstname?: string, lastname?: string, avatar?: string|null}>} [players]
 * @property {string|null} [existingComposition]
 */

/**
 * @typedef {Object} Composition
 * @property {string} [sportContext]
 * @property {Array<{playerId: string, positionX: number, positionY: number}>} [placements]
 */

/**
 * TacticalBoardScreen - Screen wrapper for TacticalBoard component
 * Receives serializable params via route and handles save
 */
const TacticalBoardScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  
  /** @type {TacticalBoardRouteParams} */
  const params = route.params || {};
  const { eventId, sport = 'generic', players = [], existingComposition } = params;

  // Mutation for saving composition
  const saveCompositionMutation = useMutation({
    /**
     * @param {Composition} composition
     */
    mutationFn: async (composition) => {
      return updateEvent({
        documentId: eventId || '',
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
    onError: (/** @type {any} */ error) => {
      console.error('Save composition error:', error);
      Alert.alert('Erreur', 'Impossible d\'enregistrer la composition.');
    },
  });

  /**
   * @param {Composition} composition
   */
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
