import { useMemo } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { getPositionValuesForSport } from '@/constants/positions';

/* eslint-disable import/order, perfectionist/sort-imports */
import { useAdWizard } from './AdWizardContext';
import { getAdWizardStepCount } from './adWizardStepUtils';
/* eslint-enable import/order, perfectionist/sort-imports */

/**
 * Wizard step for selecting positions and quantities.
 * @param {{ navigation: any }} props
 * @returns {import('react').ReactElement}
 */
function AdWizardPositions({ navigation }) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { dispatch, state } = useAdWizard();

  const sportName = state.team?.sport?.name || state.team?.activities?.[0]?.name || 'Football';
  const positions = useMemo(() => getPositionValuesForSport(sportName), [sportName]);
  const totalPlayers = useMemo(
    () => state.positions.reduce((sum, position) => sum + position.quantity, 0),
    [state.positions],
  );
  const selectedCount = state.positions.length;
  const cardSurfaceStyle = {
    backgroundColor: 'rgba(4, 31, 44, 0.82)',
    borderColor: 'rgba(1, 179, 244, 0.24)',
  };

  const isPositionSelected = (positionName) => state.positions.some((position) => position.name === positionName);

  const getPositionQuantity = (positionName) => {
    const position = state.positions.find((entry) => entry.name === positionName);
    return position ? position.quantity : 0;
  };

  const handleTogglePosition = (positionName) => {
    dispatch({ payload: positionName, type: 'TOGGLE_POSITION' });
  };

  const handleQuantityChange = (positionName, delta) => {
    const currentQuantity = getPositionQuantity(positionName);
    dispatch({
      payload: { name: positionName, quantity: currentQuantity + delta },
      type: 'SET_POSITION_QUANTITY',
    });
  };

  const handleNext = () => {
    if (state.event) {
      navigation.navigate(RouteNames.AdWizardValidation);
      return;
    }

    navigation.navigate(RouteNames.AdWizardDescription);
  };

  return (
    <WizardStepLayout
      isNextDisabled={state.positions.length === 0}
      nextLabel="Suivant"
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      stepCount={getAdWizardStepCount(state)}
      stepIndex={3}
      subtitle={'D\u00E9finissez les postes \u00E0 ouvrir et le volume de recrutement associ\u00E9.'}
      title={'Postes recherch\u00E9s'}
    >
      <View style={[Spaces.gap[16]]}>
        <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[12], cardSurfaceStyle]}>
          <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
            <View style={[Spaces.gap[4], { flex: 1 }]}>
              <Text style={[Fonts.h4, Fonts.neutral00]}>Besoins de recrutement</Text>
              <Text style={[Fonts.p2, Fonts.neutral100]}>
                {'Choisissez les postes \u00E0 ouvrir, puis ajustez le nombre de joueurs recherch\u00E9s.'}
              </Text>
            </View>

            <View
              style={[
                Spaces.paddingHorizontal[12],
                Spaces.paddingVertical[8],
                {
                  backgroundColor: 'rgba(1, 179, 244, 0.14)',
                  borderColor: 'rgba(1, 179, 244, 0.32)',
                  borderRadius: 999,
                  borderWidth: 1,
                },
              ]}
            >
              <Text style={[Fonts.p4Bold, Fonts.primary500]}>{sportName}</Text>
            </View>
          </View>

          <View style={[Alignments.row, Alignments.wrap, Spaces.gap[8]]}>
            <View
              style={[
                ApplicationStyle.card,
                Spaces.paddingHorizontal[12],
                Spaces.paddingVertical[10],
                {
                  backgroundColor: 'rgba(1, 179, 244, 0.08)',
                  borderColor: 'rgba(1, 179, 244, 0.20)',
                  flexBasis: '48%',
                },
              ]}
            >
              <Text style={[Fonts.p4Bold, Fonts.neutral300]}>{'Postes s\u00E9lectionn\u00E9s'}</Text>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{selectedCount || 0}</Text>
            </View>

            <View
              style={[
                ApplicationStyle.card,
                Spaces.paddingHorizontal[12],
                Spaces.paddingVertical[10],
                {
                  backgroundColor: 'rgba(1, 179, 244, 0.08)',
                  borderColor: 'rgba(1, 179, 244, 0.20)',
                  flexBasis: '48%',
                },
              ]}
            >
              <Text style={[Fonts.p4Bold, Fonts.neutral300]}>{'Joueurs recherch\u00E9s'}</Text>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{totalPlayers || 0}</Text>
            </View>
          </View>
        </View>

        {positions.map((positionName) => {
          const isSelected = isPositionSelected(positionName);
          const quantity = getPositionQuantity(positionName);

          return (
            <TouchableOpacity
              activeOpacity={0.92}
              key={positionName}
              onPress={() => handleTogglePosition(positionName)}
              style={[
                ApplicationStyle.card,
                Spaces.padding[18],
                Spaces.gap[12],
                {
                  backgroundColor: isSelected ? 'rgba(1, 179, 244, 0.16)' : 'rgba(4, 31, 44, 0.82)',
                  borderColor: isSelected ? Colors.primary500 : 'rgba(1, 179, 244, 0.24)',
                  borderWidth: isSelected ? 1.5 : 1,
                },
              ]}
            >
              <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
                <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12], { flex: 1 }]}>
                  <View
                    style={[
                      styles.selectionIndicator,
                      {
                        backgroundColor: isSelected ? Colors.primary500 : 'transparent',
                        borderColor: isSelected ? Colors.primary500 : 'rgba(1, 179, 244, 0.32)',
                      },
                    ]}
                  >
                    {isSelected ? (
                      <Text style={[Fonts.p3Bold, { color: Colors.neutral900 }]}>OK</Text>
                    ) : null}
                  </View>

                  <View style={[Spaces.gap[4], { flex: 1 }]}>
                    <Text style={[Fonts.h4, Fonts.neutral00]}>{positionName}</Text>
                    <Text style={[Fonts.p3, Fonts.neutral300]}>
                      {isSelected
                        ? `Volume recherch\u00E9 : ${quantity} joueur${quantity > 1 ? 's' : ''}`
                        : "Touchez pour ajouter ce poste \u00E0 l'annonce."}
                    </Text>
                  </View>
                </View>

                {!isSelected ? (
                  <View
                    style={[
                      Spaces.paddingHorizontal[10],
                      Spaces.paddingVertical[6],
                      {
                        backgroundColor: 'rgba(1, 179, 244, 0.10)',
                        borderColor: 'rgba(1, 179, 244, 0.24)',
                        borderRadius: 999,
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <Text style={[Fonts.p4Bold, Fonts.primary500]}>Ajouter</Text>
                  </View>
                ) : null}
              </View>

              {isSelected ? (
                <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}>
                  <Text style={[Fonts.p3, Fonts.neutral300]}>
                    {'Ajustez le nombre de profils \u00E0 recruter sur ce poste.'}
                  </Text>

                  <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[10]]}>
                    <TouchableOpacity
                      disabled={quantity <= 1}
                      onPress={(event) => {
                        event.stopPropagation();
                        handleQuantityChange(positionName, -1);
                      }}
                      style={[
                        styles.quantityButton,
                        {
                          backgroundColor: quantity <= 1 ? 'rgba(255, 255, 255, 0.05)' : Colors.neutral700,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          Fonts.h4,
                          { color: quantity <= 1 ? Colors.neutral500 : Colors.neutral00 },
                        ]}
                      >
                        -
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.quantityValue}>
                      <Text style={[Fonts.h3Bold, Fonts.primary500]}>{quantity}</Text>
                    </View>

                    <TouchableOpacity
                      disabled={quantity >= 10}
                      onPress={(event) => {
                        event.stopPropagation();
                        handleQuantityChange(positionName, 1);
                      }}
                      style={[
                        styles.quantityButton,
                        {
                          backgroundColor: quantity >= 10 ? 'rgba(255, 255, 255, 0.05)' : Colors.primary500,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          Fonts.h4,
                          { color: quantity >= 10 ? Colors.neutral500 : Colors.neutral00 },
                        ]}
                      >
                        +
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}

        {positions.length === 0 ? (
          <View style={[ApplicationStyle.card, Spaces.padding[20], cardSurfaceStyle]}>
            <Text style={[Fonts.p1, Fonts.neutral100, { textAlign: 'center' }]}>
              {"Aucun poste n'est actuellement d\u00E9fini pour ce sport."}
            </Text>
          </View>
        ) : null}
      </View>
    </WizardStepLayout>
  );
}

const styles = StyleSheet.create({
  quantityButton: {
    alignItems: 'center',
    borderRadius: 14,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  quantityValue: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 34,
  },
  selectionIndicator: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
});

export default AdWizardPositions;
