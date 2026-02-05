import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import useTheme from '@/theme/themeContext';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { useAdWizard } from './AdWizardContext';
import { RouteNames } from '@/navigation/routeNames';
import { getPositionValuesForSport } from '@/constants/positions';

const AdWizardPositions = ({ navigation }) => {
  const { Colors, Fonts, Spaces, Alignments } = useTheme();
  const { t } = useTranslation();
  const { state, dispatch } = useAdWizard();

  // Get sport from team's activities
  const sportName = state.team?.sport?.name || state.team?.activities?.[0]?.name || 'Football';
  
  // Get positions for this sport from centralized constants
  const positions = useMemo(() => {
    return getPositionValuesForSport(sportName);
  }, [sportName]);

  // Check if a position is selected
  const isPositionSelected = (posName) => {
    return state.positions.some(p => p.name === posName);
  };

  // Get quantity for a position
  const getPositionQuantity = (posName) => {
    const pos = state.positions.find(p => p.name === posName);
    return pos ? pos.quantity : 0;
  };

  // Toggle position selection
  const handleTogglePosition = (posName) => {
    dispatch({ type: 'TOGGLE_POSITION', payload: posName });
  };

  // Update quantity
  const handleQuantityChange = (posName, delta) => {
    const currentQty = getPositionQuantity(posName);
    dispatch({ 
      type: 'SET_POSITION_QUANTITY', 
      payload: { name: posName, quantity: currentQty + delta } 
    });
  };

  // Calculate total players
  const totalPlayers = useMemo(() => {
    return state.positions.reduce((sum, p) => sum + p.quantity, 0);
  }, [state.positions]);

  // Navigate to next step
  const handleNext = () => {
    if (state.event) {
      navigation.navigate(RouteNames.AdWizardValidation);
    } else {
      navigation.navigate(RouteNames.AdWizardDescription);
    }
  };

  const canProceed = state.positions.length > 0;

  return (
    <WizardStepLayout
      title="Postes recherchés"
      subtitle="Sélectionnez les postes et le nombre de joueurs"
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      isNextDisabled={!canProceed}
      nextLabel="Suivant"
    >
      {/* Summary Header - Always visible when there are selections */}
      {totalPlayers > 0 && (
        <View style={[
          Spaces.marginBottom[16],
          Spaces.padding[16],
          {
            backgroundColor: Colors.primary500,
            borderRadius: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          }
        ]}>
          <Text style={[Fonts.h3Bold, { color: Colors.neutral00 }]}>
            {totalPlayers}
          </Text>
          <Text style={[Fonts.p1, { color: Colors.neutral00, marginLeft: 8 }]}>
            joueur{totalPlayers > 1 ? 's' : ''} recherché{totalPlayers > 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {/* Sport indicator */}
      <View style={[Spaces.marginBottom[16]]}>
        <Text style={[Fonts.p2, { color: Colors.neutral200 }]}>
          Sport : <Text style={{ color: Colors.primary500 }}>{sportName}</Text>
        </Text>
      </View>

      {/* Positions Grid */}
      <View style={[Spaces.gap[8]]}>
        {positions.map((posName) => {
          const isSelected = isPositionSelected(posName);
          const quantity = getPositionQuantity(posName);

          return (
            <TouchableOpacity
              key={posName}
              onPress={() => handleTogglePosition(posName)}
              activeOpacity={0.7}
              style={[
                styles.positionCard,
                {
                  backgroundColor: isSelected ? Colors.primary500 + '15' : Colors.neutral800,
                  borderColor: isSelected ? Colors.primary500 : Colors.neutral700,
                  borderWidth: isSelected ? 2 : 1,
                }
              ]}
            >
              {/* Left side - Checkbox + Name */}
              <View style={[Alignments.row, Alignments.alignCenter, { flex: 1 }]}>
                {/* Custom Checkbox */}
                <View style={[
                  styles.checkbox,
                  {
                    backgroundColor: isSelected ? Colors.primary500 : 'transparent',
                    borderColor: isSelected ? Colors.primary500 : Colors.neutral500,
                  }
                ]}>
                  {isSelected && (
                    <Text style={{ color: Colors.neutral00, fontSize: 14, fontWeight: '700' }}>✓</Text>
                  )}
                </View>
                
                {/* Position Name */}
                <Text style={[
                  Fonts.p1Bold,
                  { 
                    color: isSelected ? Colors.neutral00 : Colors.neutral200,
                    marginLeft: 12,
                  }
                ]}>
                  {posName}
                </Text>
              </View>

              {/* Right side - Quantity controls (only when selected) */}
              {isSelected && (
                <View style={[Alignments.row, Alignments.alignCenter]}>
                  {/* Minus button */}
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      handleQuantityChange(posName, -1);
                    }}
                    disabled={quantity <= 1}
                    style={[
                      styles.quantityBtn,
                      {
                        backgroundColor: quantity <= 1 ? Colors.neutral700 + '50' : Colors.neutral700,
                      }
                    ]}
                  >
                    <Text style={[
                      Fonts.h4,
                      { color: quantity <= 1 ? Colors.neutral500 : Colors.neutral00 }
                    ]}>−</Text>
                  </TouchableOpacity>

                  {/* Quantity display */}
                  <View style={styles.quantityDisplay}>
                    <Text style={[Fonts.h3Bold, { color: Colors.primary500 }]}>
                      {quantity}
                    </Text>
                  </View>

                  {/* Plus button */}
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      handleQuantityChange(posName, 1);
                    }}
                    disabled={quantity >= 10}
                    style={[
                      styles.quantityBtn,
                      {
                        backgroundColor: quantity >= 10 ? Colors.neutral700 + '50' : Colors.primary500,
                      }
                    ]}
                  >
                    <Text style={[
                      Fonts.h4,
                      { color: quantity >= 10 ? Colors.neutral500 : Colors.neutral00 }
                    ]}>+</Text>
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Empty state hint */}
      {positions.length === 0 && (
        <View style={[Spaces.padding[24], Alignments.alignCenter]}>
          <Text style={[Fonts.p1, { color: Colors.neutral300, textAlign: 'center' }]}>
            Aucun poste défini pour ce sport
          </Text>
        </View>
      )}
    </WizardStepLayout>
  );
};

const styles = StyleSheet.create({
  positionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityDisplay: {
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AdWizardPositions;
