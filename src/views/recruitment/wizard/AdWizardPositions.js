import { useMemo } from 'react';
import {
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import PositionSelectionList from '@/components/organisms/positionSelectionList/PositionSelectionList';

import { RouteNames } from '@/navigation/routeNames';

import { getPositionValuesForSport } from '@/constants/positions';

/* eslint-disable perfectionist/sort-imports */
import { useAdWizard } from './AdWizardContext';
import {
  getAdWizardNeedsStepIndex,
  getAdWizardStepCount,
  isAdWizardNeedsComplete,
} from './adWizardStepUtils';
/* eslint-enable perfectionist/sort-imports */

const MAX_POSITION_QUANTITY = 10;

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
  const bulkQuantity = useMemo(() => {
    if (state.positions.length === 0 || state.positions.length !== positions.length) {
      return 0;
    }

    const firstQuantity = Number(state.positions[0]?.quantity || 0);
    const sameQuantity = state.positions.every(
      (position) => Number(position?.quantity || 0) === firstQuantity,
    );

    return sameQuantity ? firstQuantity : 0;
  }, [positions.length, state.positions]);
  const cardSurfaceStyle = {
    backgroundColor: 'rgba(4, 31, 44, 0.82)',
    borderColor: 'rgba(1, 179, 244, 0.24)',
    borderWidth: 1,
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

  const handleBulkQuantityChange = (delta) => {
    const nextQuantity = Math.max(0, Math.min(MAX_POSITION_QUANTITY, bulkQuantity + delta));

    if (nextQuantity === 0) {
      dispatch({ payload: [], type: 'SET_POSITIONS' });
      return;
    }

    dispatch({
      payload: positions.map((position) => ({
        name: position,
        quantity: nextQuantity,
      })),
      type: 'SET_POSITIONS',
    });
  };

  const handleNext = () => {
    if (!isAdWizardNeedsComplete(state)) return;
    navigation.navigate(RouteNames.AdWizardInfo);
  };

  // C28 — sport sans postes : au lieu d'une liste vide bloquante, un écran clair
  // qui laisse continuer directement vers la suite de l'annonce.
  if (!positions.length) {
    return (
      <WizardStepLayout
        isNextDisabled={false}
        nextLabel="Suivant"
        onBack={() => navigation.goBack()}
        onNext={() => navigation.navigate(RouteNames.AdWizardInfo)}
        stepCount={getAdWizardStepCount(state)}
        stepIndex={getAdWizardNeedsStepIndex(state)}
        subtitle="Ce sport ne se joue pas par postes."
        title="Postes recherchés"
      >
        <View style={[Spaces.padding[24], Alignments.alignCenter, Spaces.gap[12]]}>
          <Text style={[Fonts.p1, Fonts.neutral00, { textAlign: 'center' }]}>
            {sportName} ne nécessite pas de préciser des postes.
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral200, { lineHeight: 22, textAlign: 'center' }]}>
            Tu peux passer directement à la suite de ton annonce.
          </Text>
        </View>
      </WizardStepLayout>
    );
  }

  return (
    <WizardStepLayout
      isNextDisabled={!isAdWizardNeedsComplete(state)}
      nextLabel="Suivant"
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      stepCount={getAdWizardStepCount(state)}
      stepIndex={getAdWizardNeedsStepIndex(state)}
      subtitle="Définis les postes à ouvrir et le volume de recrutement associé."
      title="Postes recherchés"
    >
      <View style={[Spaces.gap[24], Spaces.paddingBottom[48]]}>
        <View
          style={[
            ApplicationStyle.card,
            Spaces.padding[24],
            Spaces.gap[24],
            cardSurfaceStyle,
            {
              backgroundColor: 'rgba(1, 179, 244, 0.08)',
            },
          ]}
        >
          <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[16]]}>
            <View style={[Spaces.gap[12], { flex: 1, minWidth: 180 }]}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {selectedCount > 0
                  ? `${selectedCount} poste${selectedCount > 1 ? 's' : ''} configuré${selectedCount > 1 ? 's' : ''}`
                  : 'Aucun poste sélectionné'}
              </Text>
              <Text style={[Fonts.p4, Fonts.neutral100, { lineHeight: 22 }]}>
                {selectedCount > 0
                  ? `${totalPlayers} joueur${totalPlayers > 1 ? 's' : ''} recherché${totalPlayers > 1 ? 's' : ''} sur cette annonce.`
                  : 'Active des postes ci-dessous ou applique un volume à tous les postes.'}
              </Text>
            </View>

            <View
              style={[
                Spaces.paddingHorizontal[12],
                Spaces.paddingVertical[8],
                {
                  backgroundColor: 'rgba(1, 179, 244, 0.18)',
                  borderColor: 'rgba(1, 179, 244, 0.40)',
                  borderRadius: 999,
                  borderWidth: 1,
                },
              ]}
            >
              <Text style={[Fonts.p3Bold, Fonts.primary500]}>{sportName}</Text>
            </View>
          </View>

          <View style={[Alignments.row, Alignments.wrap, Spaces.gap[16]]}>
            <View
              style={[
                Spaces.paddingHorizontal[12],
                Spaces.paddingVertical[8],
                {
                  backgroundColor: 'rgba(1, 179, 244, 0.18)',
                  borderColor: 'rgba(1, 179, 244, 0.55)',
                  borderRadius: 999,
                  borderWidth: 1,
                },
              ]}
            >
              <Text style={[Fonts.p3Bold, Fonts.primary500]}>
                {`${selectedCount} poste${selectedCount > 1 ? 's' : ''}`}
              </Text>
            </View>

            <View
              style={[
                Spaces.paddingHorizontal[12],
                Spaces.paddingVertical[8],
                {
                  backgroundColor: 'rgba(1, 179, 244, 0.12)',
                  borderColor: 'rgba(1, 179, 244, 0.40)',
                  borderRadius: 999,
                  borderWidth: 1,
                },
              ]}
            >
              <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
                {`${totalPlayers} joueur${totalPlayers > 1 ? 's' : ''}`}
              </Text>
            </View>
          </View>
        </View>

        {positions.length > 0 ? (
          <View
            style={[
              ApplicationStyle.card,
              Spaces.padding[24],
              Spaces.gap[24],
              cardSurfaceStyle,
            ]}
          >
            <View style={[Spaces.gap[8]]}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                Appliquer à tous les postes
              </Text>
              <Text style={[Fonts.p4, Fonts.neutral100, { lineHeight: 22 }]}>
                Le compteur met à jour toute la liste instantanément. 0 réinitialise la sélection globale.
              </Text>
            </View>

            <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifyCenter, { columnGap: 12, flexWrap: 'wrap', rowGap: 12 }]}>
              <View
                style={[
                  Alignments.row,
                  Alignments.alignCenter,
                  Alignments.justifyCenter,
                  Spaces.paddingHorizontal[12],
                  Spaces.paddingVertical[12],
                  {
                    backgroundColor: 'rgba(1, 179, 244, 0.08)',
                    borderColor: 'rgba(1, 179, 244, 0.18)',
                    borderRadius: 16,
                    borderWidth: 1,
                    columnGap: 12,
                    minWidth: 244,
                  },
                ]}
              >
                <TouchableOpacity
                  activeOpacity={0.8}
                  disabled={bulkQuantity <= 0}
                  onPress={() => handleBulkQuantityChange(-1)}
                  style={[
                    Alignments.alignCenter,
                    Alignments.justifyCenter,
                    {
                      backgroundColor: bulkQuantity <= 0 ? 'rgba(1, 179, 244, 0.08)' : 'rgba(1, 179, 244, 0.14)',
                      borderColor: `${Colors.primary500}40`,
                      borderRadius: 12,
                      borderWidth: 1,
                      height: 40,
                      opacity: bulkQuantity <= 0 ? 0.5 : 1,
                      width: 40,
                    },
                  ]}
                >
                  <Text style={[Fonts.h4, Fonts.primary500]}>-</Text>
                </TouchableOpacity>

                <View
                  style={[
                    Alignments.alignCenter,
                    Alignments.justifyCenter,
                    {
                      minWidth: 96,
                    },
                  ]}
                >
                  <Text style={[Fonts.h2, Fonts.primary500, { textAlign: 'center' }]}>
                    {bulkQuantity}
                  </Text>
                  <Text style={[Fonts.p4, Fonts.neutral100, { lineHeight: 18, textAlign: 'center' }]}>
                    joueurs par poste
                  </Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.8}
                  disabled={bulkQuantity >= MAX_POSITION_QUANTITY}
                  onPress={() => handleBulkQuantityChange(1)}
                  style={[
                    Alignments.alignCenter,
                    Alignments.justifyCenter,
                    {
                      backgroundColor: bulkQuantity >= MAX_POSITION_QUANTITY ? 'rgba(1, 179, 244, 0.08)' : Colors.primary500,
                      borderColor: Colors.primary500,
                      borderRadius: 12,
                      borderWidth: 1,
                      height: 40,
                      opacity: bulkQuantity >= MAX_POSITION_QUANTITY ? 0.5 : 1,
                      width: 40,
                    },
                  ]}
                >
                  <Text style={[Fonts.h4, bulkQuantity >= MAX_POSITION_QUANTITY ? Fonts.neutral500 : Fonts.neutral00]}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}

        <PositionSelectionList
          getQuantity={getPositionQuantity}
          isSelected={isPositionSelected}
          onQuantityChange={handleQuantityChange}
          onToggle={handleTogglePosition}
          positions={positions}
          selectedQuantityLabel={(quantity) => `${quantity} joueur${quantity > 1 ? 's' : ''} recherché${quantity > 1 ? 's' : ''}`}
          selectedSectionTitle="Postes actifs"
          sportName={sportName}
          unselectedActionLabel="Activer"
        />

        {positions.length === 0 ? (
          <View style={[ApplicationStyle.card, Spaces.padding[24], cardSurfaceStyle]}>
            <Text style={[Fonts.p1, Fonts.neutral100, { textAlign: 'center' }]}>
              Aucun poste n&apos;est actuellement défini pour ce sport.
            </Text>
          </View>
        ) : null}
      </View>
    </WizardStepLayout>
  );
}

export default AdWizardPositions;
