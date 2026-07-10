import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Text,
  View,
} from 'react-native';

import { USER_ROLES } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import WizardOptionCard from '@/components/molecules/wizardOptionCard/WizardOptionCard';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import CreateTrainerModal from '@/components/organisms/createTrainerModal/CreateTrainerModal';
import { useTeamWizard } from '@/views/team/wizard/TeamWizardContext';
import useTeamWizardExit from '@/views/team/wizard/useTeamWizardExit';

import { RouteNames } from '@/navigation/routeNames';

import { useGetClub } from '@/services/club/clubQueries';

/**
 * Etape 7/8 du tunnel equipe — encadrement en cartes membres (avatar
 * photo-sinon-initiales, tag « Toi », cases multi) + carte pointillee
 * « Créer un·e entraîneur·e » (handoff decision 2).
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement}
 */
function TeamWizardTrainers({ navigation }) {
  const { t } = useTranslation();
  const { userData } = useAuth();
  const { Fonts, Spaces } = useTheme();
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

  const trainerRows = useMemo(() => {
    const members = clubData?.members
      ?.filter((member) => member.role?.name === USER_ROLES.coach
        || member.role?.name === USER_ROLES.president)
      .map((member) => ({
        avatarUrl: member?.avatar?.url || null,
        documentId: member.documentId || '',
        firstname: member.firstname || '',
        lastname: member.lastname || '',
        roleLabel: member.role?.name === USER_ROLES.president ? 'Dirigeant·e' : 'Coach',
      })) || [];

    if (userData
      && (userData.role?.name === USER_ROLES.president || userData.role?.name === USER_ROLES.coach)) {
      const userAlreadyInList = members.some(
        (member) => member.documentId === userData.documentId,
      );
      if (!userAlreadyInList) {
        members.unshift({
          avatarUrl: userData?.avatar?.url || null,
          documentId: userData.documentId || '',
          firstname: userData.firstname || '',
          lastname: userData.lastname || '',
          roleLabel: userData.role?.name === USER_ROLES.president ? 'Dirigeant·e' : 'Coach',
        });
      }
    }

    return members;
  }, [clubData?.members, userData]);

  const selectedTrainerIds = useMemo(
    () => state.trainers?.filter(Boolean) || [],
    [state.trainers],
  );
  const hasSelectedTrainer = selectedTrainerIds.length > 0;

  const handleToggleTrainer = (/** @type {string} */ trainerDocumentId) => {
    const next = selectedTrainerIds.includes(trainerDocumentId)
      ? selectedTrainerIds.filter((documentId) => documentId !== trainerDocumentId)
      : [...selectedTrainerIds, trainerDocumentId];
    dispatch({ payload: next, type: 'SET_TRAINERS' });
  };

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
        stepCount={8}
        stepIndex={7}
        subtitle={t('teamWizard.steps.trainers.subtitle', 'Sélectionne au moins un·e entraîneur·e pour encadrer cette équipe.')}
        title={t('teamWizard.steps.trainers.title', 'Entraîneur·e·s')}
      >
        <View>
          {isLoading ? (
            <View style={[{ alignItems: 'center', flexDirection: 'row' }, Spaces.gap[12], Spaces.marginBottom[16]]}>
              <ActivityIndicator size="small" />
              <Text style={[Fonts.p2, Fonts.neutral200]}>
                Chargement des entraîneur·e·s du club…
              </Text>
            </View>
          ) : null}

          {isClubMissing ? (
            <View style={Spaces.marginBottom[16]}>
              <Text style={[Fonts.p2, Fonts.neutral100]}>
                Club introuvable pour initialiser la création de l&apos;équipe. Reviens à la
                liste des équipes puis relance le wizard.
              </Text>
            </View>
          ) : null}

          {hasError ? (
            <View style={[Spaces.gap[12], Spaces.marginBottom[16]]}>
              <Text style={[Fonts.p2, Fonts.neutral100]}>
                Impossible de charger les membres du club. Réessaie pour continuer.
              </Text>
              <Button onPress={() => refetchClubData()} title="Réessayer" variant="Secondary" />
            </View>
          ) : null}

          {trainerRows.map((trainer) => {
            const isSelf = trainer.documentId === userData?.documentId;
            return (
              <WizardOptionCard
                avatar={trainer}
                key={trainer.documentId}
                multi
                onPress={() => handleToggleTrainer(trainer.documentId)}
                selected={selectedTrainerIds.includes(trainer.documentId)}
                subtitle={trainer.roleLabel}
                tag={isSelf ? t('teamWizard.steps.trainers.selfTag', 'Toi') : undefined}
                title={`${trainer.firstname} ${trainer.lastname}`.trim()}
              />
            );
          })}

          {!isLoading && !hasError && !isClubMissing ? (
            <WizardOptionCard
              dashed
              onPress={() => setIsCreateTrainerModalVisible(true)}
              subtitle={t('teamWizard.steps.trainers.createHint', 'Invitation envoyée par e-mail')}
              title={t('teamWizard.steps.trainers.createCta', '+  Créer un·e entraîneur·e')}
            />
          ) : null}

          {!isLoading && !hasError && !isClubMissing && trainerRows.length === 0 ? (
            <Text style={[Fonts.p2, Fonts.neutral300, Spaces.marginTop[8]]}>
              Aucun·e entraîneur·e n&apos;est encore disponible pour ce club. Ajoutes-en
              un·e pour continuer.
            </Text>
          ) : null}

          {hasSelectedTrainer && selectedTrainerIds.includes(String(userData?.documentId || '')) ? (
            <Text style={[Fonts.p4, Fonts.neutral300, Spaces.marginTop[8]]}>
              {t(
                'teamWizard.steps.trainers.selfHint',
                "Tu es déjà sélectionné·e — tu pourras en ajouter d'autres plus tard.",
              )}
            </Text>
          ) : null}
        </View>
      </WizardStepLayout>

      <CreateTrainerModal
        clubId={state.clubId}
        isVisible={isCreateTrainerModalVisible}
        onClose={() => setIsCreateTrainerModalVisible(false)}
        onTrainerCreated={handleTrainerCreated}
      />
    </>
  );
}

export default TeamWizardTrainers;
