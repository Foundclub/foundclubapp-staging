import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Text, TouchableOpacity, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Input from '@/components/molecules/input/Input';
import SubscriptionQuotaBanner from '@/components/molecules/subscriptionQuotaBanner/SubscriptionQuotaBanner';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { useTeamWizard } from '@/views/team/wizard/TeamWizardContext';
import useTeamWizardExit from '@/views/team/wizard/useTeamWizardExit';

import { RouteNames } from '@/navigation/routeNames';

import { useGetClub } from '@/services/club/clubQueries';

// Suggestions de noms du handoff (chips « choisir = toucher », tunnel 1/8).
const NAME_SUGGESTIONS = ['Seniors A', 'U15 Filles', 'Loisir mixte'];

const sanitizeRouteParam = (value) => {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue || normalizedValue.startsWith(':')) {
    return '';
  }

  return normalizedValue;
};

/**
 * Etape 1/8 du tunnel equipe — nom + chip club + suggestions (handoff decision 2).
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement}
 */
function TeamWizardName({ navigation, route }) {
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const { userData } = useAuth();
  const { dispatch, state } = useTeamWizard();
  const handleExitWizard = useTeamWizardExit(navigation);
  const routeClubId = sanitizeRouteParam(route?.params?.clubId);
  const routePreselectedTrainerId = sanitizeRouteParam(route?.params?.preselectedTrainerId);
  const accountClubId = sanitizeRouteParam(userData?.club?.documentId || userData?.club?.id);
  const hasClubContext = Boolean(state.clubId || routeClubId || accountClubId);
  const clubQuery = useGetClub(state.clubId, { enabled: Boolean(state.clubId) });
  const clubName = clubQuery.data?.name || userData?.club?.name || '';
  const clubInitials = String(clubName || '')
    .split(/\s+/)
    .map((word) => word.charAt(0))
    .join('')
    .slice(0, 3)
    .toUpperCase();

  useEffect(() => {
    const nextClubId = routeClubId || accountClubId;
    const nextPreselectedTrainerId = routePreselectedTrainerId;
    const shouldInitClubId = Boolean(nextClubId) && !state.clubId;
    const shouldInitTrainerId = Boolean(nextPreselectedTrainerId)
      && !state.preselectedTrainerId
      && !state.trainers?.includes(nextPreselectedTrainerId);

    if (!shouldInitClubId && !shouldInitTrainerId) {
      return;
    }

    dispatch({
      payload: {
        clubId: nextClubId,
        preselectedTrainerId: nextPreselectedTrainerId,
      },
      type: 'INIT_FROM_PARAMS',
    });
  }, [
    accountClubId,
    dispatch,
    routeClubId,
    routePreselectedTrainerId,
    state.clubId,
    state.preselectedTrainerId,
    state.trainers,
  ]);

  const handleNext = () => {
    if (!hasClubContext) {
      return;
    }
    dispatch({ payload: state.name.trim(), type: 'SET_NAME' });
    navigation.navigate(RouteNames.TeamWizardDescription);
  };

  return (
    <WizardStepLayout
      isNextDisabled={!state.name?.trim() || !hasClubContext}
      nextLabel={t('common.next', 'Suivant')}
      onClose={handleExitWizard}
      onNext={handleNext}
      stepCount={8}
      stepIndex={1}
      subtitle={t('teamWizard.steps.name.subtitle', 'Donne un nom clair à ton équipe pour la retrouver facilement.')}
      title={t('teamWizard.steps.name.title', "Nom de l'équipe")}
    >
      <View>
        {clubName ? (
          <View
            style={[
              Alignments.row,
              Alignments.alignCenter,
              Spaces.marginBottom[16],
              {
                alignSelf: 'flex-start',
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderColor: 'rgba(255,255,255,0.10)',
                borderRadius: 999,
                borderWidth: 1,
                columnGap: 8,
                paddingLeft: 8,
                paddingRight: 14,
                paddingVertical: 7,
              },
            ]}
          >
            <View
              style={{
                alignItems: 'center',
                backgroundColor: 'rgba(1,179,244,0.16)',
                borderRadius: 999,
                height: 26,
                justifyContent: 'center',
                width: 26,
              }}
            >
              <Text style={[Fonts.p4Bold, Fonts.primary500]}>{clubInitials}</Text>
            </View>
            <Text style={[Fonts.p3Bold, Fonts.neutral100]}>{clubName}</Text>
          </View>
        ) : null}
        <SubscriptionQuotaBanner label="Équipes" quotaType="FREE_TEAM" />
        {!hasClubContext ? (
          <View style={[Spaces.gap[12], Spaces.marginBottom[16]]}>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              Impossible de démarrer la création de l&apos;équipe sans club. Reviens à la
              liste des équipes ou à la fiche club puis relance le wizard.
            </Text>
            <Button
              onPress={handleExitWizard}
              title="Retour à mes équipes"
              variant="Secondary"
            />
          </View>
        ) : null}
        <Input
          autoFocus
          label={t('teamEdit.fields.name.label')}
          onChangeText={(value) => dispatch({ payload: value, type: 'SET_NAME' })}
          placeholder={t('teamWizard.steps.name.placeholder', 'Ex. : U15 Filles')}
          value={state.name}
        />
        <Text style={[Fonts.p4, Fonts.neutral400, Spaces.marginTop[8]]}>
          {t('teamWizard.steps.name.hint', 'Visible par tout le club — modifiable plus tard.')}
        </Text>
        <Text
          style={[
            Fonts.p3Bold,
            Fonts.neutral300,
            Spaces.marginTop[16],
            Spaces.marginBottom[8],
          ]}
        >
          {t('teamWizard.steps.name.suggestions', 'Suggestions')}
        </Text>
        <View style={[Alignments.row, { columnGap: 9, flexWrap: 'wrap', rowGap: 9 }]}>
          {NAME_SUGGESTIONS.map((suggestion) => {
            const isSelected = state.name === suggestion;
            return (
              <TouchableOpacity
                accessibilityRole="button"
                key={suggestion}
                onPress={() => dispatch({ payload: suggestion, type: 'SET_NAME' })}
                style={{
                  backgroundColor: isSelected ? Colors.primary500 : 'transparent',
                  borderColor: isSelected ? Colors.primary500 : 'rgba(1,179,244,0.3)',
                  borderRadius: 999,
                  borderWidth: 1.5,
                  paddingHorizontal: 15,
                  paddingVertical: 9,
                }}
              >
                <Text
                  style={[
                    Fonts.p3Bold,
                    { color: isSelected ? Colors.primary900 : Colors.neutral100 },
                  ]}
                >
                  {suggestion}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </WizardStepLayout>
  );
}

export default TeamWizardName;
