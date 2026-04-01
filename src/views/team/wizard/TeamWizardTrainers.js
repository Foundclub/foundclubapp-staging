import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Text,
  View,
} from 'react-native';

import { USER_ROLES } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';

import Button from '@/components/atoms/button/Button';
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

  const clubQuery = useGetClub(state.clubId, {
    enabled: Boolean(state.clubId),
  });
  const { data: clubData, refetch: refetchClubData } = clubQuery;
  const isLoading = Boolean(state.clubId) && clubQuery.isLoading;
  const hasError = Boolean(clubQuery.error);
  const isClubMissing = !state.clubId;

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
        isNextDisabled={!hasSelectedTrainer || isLoading || hasError || isClubMissing}
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
          {isLoading ? (
            <View style={{ alignItems: 'center', flexDirection: 'row', gap: 12, marginBottom: 16 }}>
              <ActivityIndicator size="small" />
              <Text>Chargement des entraineurs du club...</Text>
            </View>
          ) : null}

          {isClubMissing ? (
            <View style={{ marginBottom: 16 }}>
              <Text>Club introuvable pour initialiser la creation de l'equipe. Reviens a la liste des equipes puis relance le wizard.</Text>
            </View>
          ) : null}

          {hasError ? (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ marginBottom: 12 }}>
                Impossible de charger les membres du club. Reessayez pour continuer.
              </Text>
              <Button onPress={() => refetchClubData()} title="R\u00E9essayer" variant="Secondary" />
            </View>
          ) : null}

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

          {!isLoading && !hasError && !isClubMissing && trainerOptions.length === 0 ? (
            <View style={{ marginTop: 12 }}>
              <Text>Aucun entraineur n'est encore disponible pour ce club. Ajoute-en un pour continuer.</Text>
            </View>
          ) : null}
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
