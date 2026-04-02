import { useMemo } from 'react';
import {
  Text,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import PositionSelectionList from '@/components/organisms/positionSelectionList/PositionSelectionList';

import { RouteNames } from '@/navigation/routeNames';

import { getPositionValuesForSport } from '@/constants/positions';

/* eslint-disable perfectionist/sort-imports */
import { useAdWizard } from './AdWizardContext';
import { getAdWizardStepCount } from './adWizardStepUtils';
/* eslint-enable perfectionist/sort-imports */

/**
 * Wizard step for selecting positions and quantities.
 * @param {{ navigation: any }} props
 * @returns {import('react').ReactElement}
 */
function AdWizardPositions({ navigation }) {
  const {
    Alignments,
    ApplicationStyle,
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
      <View style={[Spaces.gap[20]]}>
        <View style={[ApplicationStyle.card, Spaces.padding[20], Spaces.gap[16], cardSurfaceStyle]}>
          <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
            <View style={[Spaces.gap[8], { flex: 1 }]}>
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

          <View style={[Alignments.row, Alignments.wrap, Spaces.gap[12]]}>
            <View
              style={[
                Spaces.paddingHorizontal[12],
                Spaces.paddingVertical[8],
                {
                  backgroundColor: 'rgba(1, 179, 244, 0.18)',
                  borderColor: 'rgba(1, 179, 244, 0.34)',
                  borderRadius: 999,
                  borderWidth: 1,
                },
              ]}
            >
              <Text style={[Fonts.p4Bold, Fonts.primary500]}>
                {`${selectedCount} poste${selectedCount > 1 ? 's' : ''}`}
              </Text>
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

        <PositionSelectionList
          getQuantity={getPositionQuantity}
          isSelected={isPositionSelected}
          onQuantityChange={handleQuantityChange}
          onToggle={handleTogglePosition}
          positions={positions}
          selectedQuantityLabel={(quantity) => `${quantity} joueur${quantity > 1 ? 's' : ''} recherch\u00E9${quantity > 1 ? 's' : ''}`}
          selectedSectionTitle="Selection actuelle"
          sportName={sportName}
          unselectedActionLabel="Selectionner"
        />

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

export default AdWizardPositions;
