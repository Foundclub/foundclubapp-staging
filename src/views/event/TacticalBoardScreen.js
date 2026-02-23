import { useNavigation, useRoute } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { Alert, View } from 'react-native';

import { TacticalBoard } from '@/components/tactical';

import { updateEvent } from '@/services/event/eventService';

/**
 * @typedef {object} TacticalBoardRouteParams
 * @property {string} [eventId]
 * @property {string} [sport]
 * @property {Array<{id?: string, documentId?: string, firstname?: string, lastname?: string, avatar?: string|null}>} [players]
 * @property {string|null} [existingComposition]
 */

/**
 * @typedef {object} Composition
 * @property {string} [sportContext]
 * @property {Array<{playerId: string, positionX: number, positionY: number}>} [placements]
 */

/**
 * TacticalBoardScreen - Screen wrapper for TacticalBoard component
 * Receives serializable params via route and handles save
 */
function TacticalBoardScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const queryClient = useQueryClient();

  /** @type {TacticalBoardRouteParams} */
  const params = route.params || {};
  const {
    eventId, existingComposition, players = [], sport = 'generic',
  } = params;

  // Mutation for saving composition
  const saveCompositionMutation = useMutation({
    /**
     * @param {Composition} composition
     */
    mutationFn: async (composition) => updateEvent({
      documentId: eventId || '',
      eventData: {
        composition: JSON.stringify(composition),
      },
    }),
    onError: (/** @type {any} */ error) => {
      console.error('Save composition error:', error);
      Alert.alert('Erreur', 'Impossible d\'enregistrer la composition.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      Alert.alert('Succès', 'La composition a été enregistrée.', [
        { onPress: () => navigation.goBack(), text: 'OK' },
      ]);
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
        initialComposition={initialComposition}
        onBack={handleBack}
        onSave={handleSave}
        players={players}
        sport={sport}
      />
    </View>
  );
}

export default TacticalBoardScreen;
