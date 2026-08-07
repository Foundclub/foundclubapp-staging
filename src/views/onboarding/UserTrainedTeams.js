import { useMutation } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import FormScreenContainer from '@/components/templates/FormScreenContainer';
import OnboardingSkipLink from '@/views/onboarding/components/OnboardingSkipLink';
import OnboardingStateView from '@/views/onboarding/components/OnboardingStateView';
import OnboardingStickyFooter from '@/views/onboarding/components/OnboardingStickyFooter';

import { RouteNames } from '@/navigation/routeNames';

import { useGetTeams } from '@/services/team/teamQueries';
import {
  createTeamMembershipRequest,
} from '@/services/teamMembershipRequest/teamMembershipRequestService';

/**
 * D16 - « Quelles equipes entraines-tu ? », derniere etape du parcours
 * entraineur. C'est ICI que la branche staff se dedouble : le dirigeant
 * s'arrete au club (il le couvre en entier), l'entraineur declare les equipes
 * qu'il entraine.
 * L'ecran ne cree AUCUNE plomberie : il rebranche
 * `createTeamMembershipRequest`, deja utilisee par `TeamDetails` et
 * `ClubDetails` contre `POST /team-membership-requests`.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement} L'etape « equipes entrainees ».
 */
function UserTrainedTeams({ navigation }) {
  const [selectedTeamIds, setSelectedTeamIds] = useState(/** @type {string[]} */([]));

  const {
    getNextOnboardingRoute,
    getPostOnboardingHomeRoute,
    refetchUserData,
    userData,
    userDataError,
    userDataLoading,
  } = useAuth();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  // Le club de l'entraineur n'est PAS encore une adhesion a ce stade : il vient
  // d'envoyer une demande au club (`createClubMembershipRequest`), qui reste
  // `pending` jusqu'a validation. On lit donc les trois sources, de la plus
  // sure a la plus recente.
  const clubId = useMemo(() => (
    userData?.club?.documentId
    || userData?.clubs?.[0]?.documentId
    || (userData?.clubMembershipRequests || [])
      .find((request) => request?.state === 'pending')?.club?.documentId
    || undefined
  ), [userData?.club, userData?.clubs, userData?.clubMembershipRequests]);

  const teamsQuery = useGetTeams({ clubId, pageSize: 50 }, { enabled: !!clubId });
  const teams = useMemo(() => (
    (teamsQuery.data?.pages || []).flatMap((page) => page?.data || [])
  ), [teamsQuery.data]);

  // DECISION 5 - `had-pending-membership-request` refuse une seconde demande
  // sur la MEME equipe, mais son `catch` englobant ecrase la cause : « tu as
  // deja demande » et « la base est tombee » remontent avec le MEME code.
  // L'ecran ne peut donc pas lire l'erreur pour se decider - il regarde le
  // profil AVANT d'afficher, comme le fait deja `ClubDetails`.
  const pendingTeamIds = useMemo(() => new Set(
    (userData?.teamMembershipRequests || [])
      .filter((request) => request?.state === 'pending')
      .map((request) => request?.team?.documentId)
      .filter(Boolean),
  ), [userData?.teamMembershipRequests]);

  const goToNextStep = () => {
    navigation.navigate(
      getNextOnboardingRoute(RouteNames.UserTrainedTeams) || getPostOnboardingHomeRoute(),
    );
  };

  const sendRequestsMutation = useMutation({
    // Une seule action pour l'entraineur, N appels cote reseau : il n'existe
    // pas de route groupee, et en creer une demanderait un lot `admin` que la
    // mesure du 2026-08-05 a justement montre inutile.
    mutationFn: (/** @type {string[]} */ teamIds) => Promise.all(
      teamIds.map((teamId) => createTeamMembershipRequest({
        team: teamId,
        user: userData?.documentId,
      })),
    ),
    onError: (error) => {
      Alert.alert(
        t('onboarding.trainedTeams.errorTitle', 'Demande non envoyée'),
        error?.message
          || t(
            'onboarding.trainedTeams.errorMessage',
            'Impossible d\'envoyer ta demande pour le moment. Réessaie dans un instant.',
          ),
      );
    },
    onSuccess: () => {
      refetchUserData?.();
      goToNextStep();
    },
  });

  if (userDataLoading) {
    return (
      <OnboardingStateView
        description="Nous récupérons ton profil avant de lister tes équipes."
        isLoading
        title="Chargement du profil"
      />
    );
  }

  if (userDataError) {
    return (
      <OnboardingStateView
        actionLabel="Réessayer"
        description={userDataError?.message || 'Impossible de charger ton profil.'}
        onAction={refetchUserData}
        title="Chargement impossible"
      />
    );
  }

  if (teamsQuery.isLoading && !teams.length) {
    return (
      <OnboardingStateView
        description="Nous chargeons les équipes de ton club."
        isLoading
        title="Chargement des équipes"
      />
    );
  }

  if (teamsQuery.error && !teams.length) {
    return (
      <OnboardingStateView
        actionLabel="Réessayer"
        description={teamsQuery.error?.message || 'Impossible de charger les équipes.'}
        onAction={teamsQuery.refetch}
        title="Chargement impossible"
      />
    );
  }

  const toggleTeam = (/** @type {string} */ teamId) => {
    // Le garde-fou vit ICI, pas seulement sur `disabled` de la rangee : D17 va
    // redessiner cet ecran, et une case cochable par accident enverrait une
    // demande en double - que la policy refuserait avec un code indistinguable
    // d'une panne (decision n5). Une seule ligne, au bon endroit.
    if (pendingTeamIds.has(teamId)) return;
    setSelectedTeamIds((previous) => (
      previous.includes(teamId)
        ? previous.filter((id) => id !== teamId)
        : previous.concat(teamId)
    ));
  };

  const handleSend = () => {
    if (!selectedTeamIds.length) return;
    sendRequestsMutation.mutate(selectedTeamIds);
  };

  return (
    <FormScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingVertical[24],
        { marginBottom: insets.bottom },
        Alignments.justifySpaceBetween,
        Alignments.column,
        Alignments.fill,
      ]}
    >
      <View style={[Alignments.fill, Spaces.gap[24]]}>
        <View style={[Spaces.gap[16]]}>
          <Text style={[Fonts.h2Black, Fonts.neutral00]}>
            {t('onboarding.trainedTeams.title', 'Quelles équipes entraînes-tu ?')}
          </Text>
          <Text style={[Fonts.p1, Fonts.neutral00]}>
            {t(
              'onboarding.trainedTeams.subtitle',
              'Sélectionne-les toutes : une demande part au club pour chacune.',
            )}
          </Text>
        </View>

        {teams.length === 0 ? (
          <Text style={[Fonts.p1, Fonts.neutral300]}>
            {t(
              'onboarding.trainedTeams.empty',
              'Aucune équipe n\'est encore déclarée dans ton club. '
                + 'Tu pourras les créer une fois ton accès validé.',
            )}
          </Text>
        ) : (
          <ScrollView
            contentContainerStyle={[Spaces.gap[12], Spaces.paddingBottom[24]]}
            showsVerticalScrollIndicator={false}
            style={[Alignments.fill]}
          >
            {teams.map((team) => {
              const teamId = team.documentId || team.id;
              const isAlreadyRequested = pendingTeamIds.has(teamId);
              const isSelected = !isAlreadyRequested && selectedTeamIds.includes(teamId);
              const meta = [team?.section?.name, team?.category?.name, team?.level?.name]
                .filter(Boolean)
                .join(' - ');

              return (
                <TouchableOpacity
                  accessibilityRole="checkbox"
                  accessibilityState={{
                    checked: isSelected || isAlreadyRequested,
                    disabled: isAlreadyRequested,
                  }}
                  disabled={isAlreadyRequested}
                  key={teamId}
                  onPress={() => toggleTeam(teamId)}
                  style={[
                    Spaces.padding[16],
                    Alignments.row,
                    Alignments.alignCenter,
                    Spaces.gap[12],
                    {
                      backgroundColor: isSelected ? `${Colors.primary500}20` : Colors.neutral800,
                      borderColor: isSelected ? Colors.primary500 : Colors.neutral700,
                      borderRadius: 12,
                      borderWidth: 2,
                      opacity: isAlreadyRequested ? 0.5 : 1,
                    },
                  ]}
                >
                  {/* Case CARREE : la selection est multiple, une pastille
                      ronde annoncerait un choix unique. */}
                  <View
                    importantForAccessibility="no"
                    style={[
                      Alignments.alignCenter,
                      Alignments.justifyCenter,
                      {
                        backgroundColor: isSelected ? Colors.primary500 : 'transparent',
                        borderColor: isSelected ? Colors.primary500 : Colors.neutral700,
                        borderRadius: 4,
                        borderWidth: 2,
                        height: 24,
                        width: 24,
                      },
                    ]}
                  >
                    {isSelected ? (
                      <Text style={[Fonts.p2Bold, Fonts.neutral900]}>✓</Text>
                    ) : null}
                  </View>

                  <View style={[Alignments.fill, Spaces.gap[8]]}>
                    <Text
                      style={[
                        Fonts.p1Bold,
                        { color: isSelected ? Colors.primary500 : Colors.neutral00 },
                      ]}
                    >
                      {team?.name || '-'}
                    </Text>
                    {meta ? (
                      <Text style={[Fonts.p2, Fonts.neutral300]}>{meta}</Text>
                    ) : null}
                    {isAlreadyRequested ? (
                      <Text style={[Fonts.p2, Fonts.neutral300]}>
                        {t('onboarding.trainedTeams.alreadyRequested', 'Demande déjà envoyée')}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      <OnboardingStickyFooter>
        <Button
          disabled={selectedTeamIds.length === 0}
          isLoading={sendRequestsMutation.isPending}
          onPress={handleSend}
          title={t(
            'onboarding.trainedTeams.submit',
            'Envoyer ma demande ({{count}})',
          ).replace('{{count}}', String(selectedTeamIds.length))}
          variant="Primary"
        />
        <OnboardingSkipLink onPress={goToNextStep} />
      </OnboardingStickyFooter>
    </FormScreenContainer>
  );
}

export default UserTrainedTeams;
