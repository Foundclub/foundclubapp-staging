import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { USER_ROLES } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';

import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import CreateTrainerModal from '@/components/organisms/createTrainerModal/CreateTrainerModal';
import { useTeamWizard } from '@/views/team/wizard/TeamWizardContext';
import useTeamWizardExit from '@/views/team/wizard/useTeamWizardExit';

import { RouteNames } from '@/navigation/routeNames';

import { useGetClub } from '@/services/club/clubQueries';

/** @typedef {{ label: string; value: string }} Option */

/**
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement}
 */
function TeamWizardTrainers({ navigation }) {
  const { t } = useTranslation();
  const { userData } = useAuth();
  const { dispatch, state } = useTeamWizard();
  const handleExitWizard = useTeamWizardExit(navigation);
  const [isCreateTrainerModalVisible, setIsCreateTrainerModalVisible] = useState(false);

  const { data: clubData, refetch: refetchClubData } = useGetClub(state.clubId, {
    enabled: Boolean(state.clubId),
  });

  const trainerOptions = useMemo(() => {
    const members = clubData?.members
      ?.filter((member) => member.role?.name === USER_ROLES.coach
        || member.role?.name === USER_ROLES.president)
      .map((trainer) => ({
        label: `${trainer.firstname} ${trainer.lastname}`,
        value: trainer.documentId || '',
      })) || [];

    if (userData && (userData.role?.name === USER_ROLES.president || userData.role?.name === USER_ROLES.coach)) {
      const userAlreadyInList = members.some((member) => member.value === userData.documentId);
      if (!userAlreadyInList) {
        members.unshift({
          label: `${userData.firstname} ${userData.lastname} (Vous)`,
          value: userData.documentId || '',
        });
      }
    }

    return members;
  }, [clubData?.members, userData]);

  const selectedValue = useMemo(
    () => state.trainers?.filter(Boolean) || [],
    [state.trainers],
  );
  const hasSelectedTrainer = selectedValue.length > 0;

  const handleTrainerCreated = useCallback((/** @type {{ documentId?: string }} */ createdTrainer) => {
    if (!createdTrainer?.documentId) return;

    const next = Array.isArray(state.trainers) ? [...state.trainers] : [];
    if (!next.includes(createdTrainer.documentId)) {
      next.push(createdTrainer.documentId);
      dispatch({ payload: next, type: 'SET_TRAINERS' });
    }

    refetchClubData();
  }, [dispatch, refetchClubData, state.trainers]);

  return (
    <>
      <WizardStepLayout
        isNextDisabled={!hasSelectedTrainer}
        nextLabel={t('common.next', 'Suivant')}
        onBack={() => navigation.navigate(RouteNames.TeamWizardLevel)}
        onClose={handleExitWizard}
        onNext={() => navigation.navigate(RouteNames.TeamWizardRecap)}
        onSkip={() => {}}
        stepCount={8}
        stepIndex={7}
        subtitle={t('teamWizard.steps.trainers.subtitle', 'Selectionne au moins un entraineur pour encadrer cette equipe.')}
        title={t('teamWizard.steps.trainers.title', 'Entraineurs')}
      >
        <View>
          <AutocompleteSelect
            actionLabel={t('teamEdit.fields.trainers.actions.add', 'Ajouter un entraineur')}
            isMulti
            label={t('teamEdit.fields.trainers.label')}
            onActionPress={() => setIsCreateTrainerModalVisible(true)}
            options={trainerOptions}
            placeholder={t('teamEdit.fields.trainers.placeholder')}
            setValue={(/** @type {Option[] | null} */ options) => {
              dispatch({
                payload: options?.map((option) => option.value) || [],
                type: 'SET_TRAINERS',
              });
            }}
            value={selectedValue}
          />
        </View>
      </WizardStepLayout>

      <CreateTrainerModal
        isVisible={isCreateTrainerModalVisible}
        onClose={() => setIsCreateTrainerModalVisible(false)}
        onTrainerCreated={handleTrainerCreated}
      />
    </>
  );
}

export default TeamWizardTrainers;
