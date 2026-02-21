import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import CreateTrainerModal from '@/components/organisms/createTrainerModal/CreateTrainerModal';
import { USER_ROLES } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import { RouteNames } from '@/navigation/routeNames';
import { useGetClub } from '@/services/club/clubQueries';
import { useTeamWizard } from '@/views/team/wizard/TeamWizardContext';

/** @typedef {{ label: string; value: string }} Option */

/**
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement}
 */
function TeamWizardTrainers({ navigation }) {
  const { t } = useTranslation();
  const { userData } = useAuth();
  const { state, dispatch } = useTeamWizard();
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

  const handleTrainerCreated = useCallback((/** @type {{ documentId?: string }} */ createdTrainer) => {
    if (!createdTrainer?.documentId) return;

    const next = Array.isArray(state.trainers) ? [...state.trainers] : [];
    if (!next.includes(createdTrainer.documentId)) {
      next.push(createdTrainer.documentId);
      dispatch({ type: 'SET_TRAINERS', payload: next });
    }

    refetchClubData();
  }, [dispatch, refetchClubData, state.trainers]);

  return (
    <>
      <WizardStepLayout
        title={t('teamWizard.steps.trainers.title', 'Entraineurs (optionnel)')}
        subtitle={t('teamWizard.steps.trainers.subtitle', 'Ajoute un ou plusieurs entraineurs pour encadrer cette equipe.')}
        stepIndex={7}
        stepCount={8}
        onBack={() => navigation.navigate(RouteNames.TeamWizardLevel)}
        onNext={() => navigation.navigate(RouteNames.TeamWizardRecap)}
        onSkip={() => {}}
        nextLabel={t('common.next', 'Suivant')}
      >
        <View>
          <AutocompleteSelect
            isMulti
            actionLabel={t('teamEdit.fields.trainers.actions.add', 'Ajouter un entraineur')}
            onActionPress={() => setIsCreateTrainerModalVisible(true)}
            label={t('teamEdit.fields.trainers.label')}
            options={trainerOptions}
            placeholder={t('teamEdit.fields.trainers.placeholder')}
            setValue={(/** @type {Option[] | null} */ options) => {
              dispatch({
                type: 'SET_TRAINERS',
                payload: options?.map((option) => option.value) || [],
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
