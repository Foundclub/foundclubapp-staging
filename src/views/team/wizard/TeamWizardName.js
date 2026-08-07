import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useEffect, useMemo, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, Text, TouchableOpacity, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { emitGuidanceAction } from '@/domains/guidance/guidanceRuntime';
import { extractSubscriptionDecisionFromError } from '@/domains/subscription/subscriptionDecision';
import { isMyTeam } from '@/domains/team/teamMembership';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import Input from '@/components/molecules/input/Input';
import SubscriptionPaywallSheet from '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet';
import SubscriptionQuotaBanner from '@/components/molecules/subscriptionQuotaBanner/SubscriptionQuotaBanner';
import WizardOptionCard from '@/components/molecules/wizardOptionCard/WizardOptionCard';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { navigateToSearchHub } from '@/views/search/searchRouteHelpers';
import { useTeamWizard } from '@/views/team/wizard/TeamWizardContext';
import useTeamWizardExit from '@/views/team/wizard/useTeamWizardExit';

import { RouteNames } from '@/navigation/routeNames';

import { useGetClub } from '@/services/club/clubQueries';
import { claimTeamAsCoach } from '@/services/team/teamService';

// Suggestions de noms du handoff (chips « choisir = toucher », tunnel 1/8).
const NAME_SUGGESTIONS = ['Seniors A', 'U15 Filles', 'Loisir mixte'];

/**
 * Un compte entraineur supprime (RGPD) est anonymise et bloque : il ne compte
 * pas comme entraineur actif (aligne sur le backend claimCoach).
 * @param {any} trainer
 * @returns {boolean}
 */
const isDeletedTrainer = (trainer) => {
  if (!trainer?.blocked) {
    return false;
  }
  const username = String(trainer?.username || '');
  const email = String(trainer?.email || '').toLowerCase();
  return username.startsWith('deleted_user_') || email.endsWith('@deleted.com');
};

const sanitizeRouteParam = (/** @type {any} */ value) => {
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
  const queryClient = useQueryClient();
  const handleExitWizard = useTeamWizardExit(/** @type {any} */ (navigation));
  const [isChooserDismissed, setIsChooserDismissed] = useState(false);
  const [claimPaywallDecision, setClaimPaywallDecision] = useState(/** @type {any} */ (null));
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

  // Equipes deja presentes dans le club (chooser rejoindre/reprendre/creer).
  const clubTeams = useMemo(
    () => {
      const clubData = /** @type {any} */ (clubQuery.data);
      return Array.isArray(clubData?.teams) ? clubData.teams : [];
    },
    [clubQuery.data],
  );
  const shouldOfferChooser = clubTeams.length > 0 && !isChooserDismissed;

  // D25 ② — « ca ouvre le clavier en meme temps que le pop-up ».
  //
  // `autoFocus` etait pose en dur sur le champ. C'est un choix de MONTAGE, pris
  // a un instant ou l'ecran ne sait PAS encore si le club a des equipes : la
  // reponse arrive avec `useGetClub`, une fraction de seconde plus tard. Le
  // clavier montait donc toujours, et le pop-up se posait par-dessus, masquant
  // la moitie basse de la question (capture d'Adel du 2026-08-07).
  //
  // On garde l'intention — un ecran a un seul champ ne merite pas un tap de plus,
  // c'est ce que font aussi `SquadNameStep` et `AdminClubWizardIdentity` — mais
  // on la reporte au moment ou la question est TRANCHEE : tout de suite s'il n'y
  // a pas de pop-up, apres la reponse s'il y en a un.
  const nameInputRef = useRef(/** @type {any} */ (null));
  const isChooserSettled = !(routeClubId || accountClubId || state.clubId) || clubQuery.isFetched;
  const shouldFocusName = hasClubContext && isChooserSettled && !shouldOfferChooser;

  useEffect(() => {
    if (!shouldFocusName) {
      return;
    }
    nameInputRef.current?.focus();
  }, [shouldFocusName]);

  // Equipes que je coache / dont je suis membre. D25 ① — le profil du compte
  // (source unique jusqu'ici) est servi depuis un cache serveur de 60 s a 4 min :
  // en revenant ici juste apres une creation, sa propre equipe apparaissait
  // comme celle d'un autre. Le juge partage ecoute AUSSI les encadrants rendus
  // avec le club — voir domains/team/teamMembership.js.

  const goToTeamDetails = (/** @type {string} */ teamDocumentId) => {
    setIsChooserDismissed(true);
    /** @type {any} */ (navigation).navigate(RouteNames.TeamStack, {
      params: { teamId: teamDocumentId },
      screen: RouteNames.TeamDetails,
    });
  };

  const claimTeamMutation = useMutation({
    mutationFn: (/** @type {string} */ teamDocumentId) => claimTeamAsCoach(teamDocumentId),
    onError: (/** @type {any} */ error) => {
      // Quota depasse -> meme paywall que la creation d'equipe.
      const subscriptionDecision = extractSubscriptionDecisionFromError(error);
      if (subscriptionDecision) {
        setIsChooserDismissed(true);
        setClaimPaywallDecision(subscriptionDecision);
        return;
      }
      const message = error?.response?.data?.error?.message
        || 'Impossible de reprendre cette équipe pour le moment.';
      Alert.alert(t('common.error', 'Erreur'), message);
    },
    onSuccess: async (/** @type {any} */ _result, /** @type {string} */ teamDocumentId) => {
      // Valide l'etape « Cree ton equipe » du tour guide (equipe reprise = equipe active).
      emitGuidanceAction('team.created');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['teams'] }),
        queryClient.invalidateQueries({ queryKey: ['get-me'] }),
        queryClient.invalidateQueries({ queryKey: ['app-bootstrap'] }),
      ]);
      const claimedTeam = clubTeams.find(
        (/** @type {any} */ team) => team?.documentId === teamDocumentId,
      );
      Alert.alert(
        t('common.success', 'C\'est fait !'),
        `Tu es maintenant l'entraîneur·e de ${claimedTeam?.name || 'cette équipe'}.`,
      );
      goToTeamDetails(teamDocumentId);
    },
  });

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

  // Aiguillage « pas de club » : rechercher son club (pour le rejoindre/revendiquer)
  // ou ouvrir le tunnel de création de club (« je ne trouve pas mon club »).
  const handleSearchClub = () => {
    // R06 : cet ecran est pousse sur le navigateur RACINE (TeamStack y est monte,
    // d'ou l'absence de barre d'onglets). L'ancien appel visait `Search`, qui
    // n'existe qu'un cran plus bas, dans `HomeTab` : il echouait en silence.
    navigateToSearchHub(navigation, 'clubs');
  };
  const handleCreateClub = () => {
    /** @type {any} */ (navigation).navigate(RouteNames.ClubStack, {
      params: { entry: 'search' },
      screen: RouteNames.ClubWizardName,
    });
  };

  // Un entraineur sans club ne peut pas creer d'equipe : etape d'aiguillage dediee.
  if (!hasClubContext) {
    return (
      <WizardStepLayout
        onClose={handleExitWizard}
        subtitle={t(
          'teamWizard.clubRequired.subtitle',
          'Une équipe appartient toujours à un club. Rejoins ton club ou crée-le, puis reviens créer ton équipe.',
        )}
        title={t('teamWizard.clubRequired.title', "Il te faut d'abord un club")}
      >
        <View style={[Spaces.gap[12], Spaces.marginTop[8]]}>
          <Button
            onPress={handleSearchClub}
            title={t('teamWizard.clubRequired.searchCta', 'Rechercher mon club')}
            variant="Primary"
          />
          <Button
            onPress={handleCreateClub}
            title={t('teamWizard.clubRequired.createCta', 'Je ne trouve pas mon club')}
            variant="Secondary"
          />
        </View>
      </WizardStepLayout>
    );
  }

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
        {/* L40 — si la personne part d'ici acheter, elle revient ICI. */}
        <SubscriptionQuotaBanner
          label="Équipes"
          quotaType="FREE_TEAM"
          resumeRouteName={RouteNames.TeamStack}
          resumeRouteParams={{ screen: RouteNames.TeamWizardName }}
        />
        <Input
          label={t('teamEdit.fields.name.label')}
          onChangeText={(value) => dispatch({ payload: value, type: 'SET_NAME' })}
          placeholder={t('teamWizard.steps.name.placeholder', 'Ex. : U15 Filles')}
          ref={nameInputRef}
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

      <BottomModal
        close={() => setIsChooserDismissed(true)}
        isVisible={shouldOfferChooser}
      >
        <View style={[Spaces.gap[16], Spaces.paddingBottom[16]]}>
          <View style={[Spaces.gap[4]]}>
            <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
              Ton club a déjà des équipes
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral300]}>
              Rejoins une équipe existante, reprends-en une sans entraîneur·e, ou crée
              la tienne.
            </Text>
          </View>

          <View style={[Spaces.gap[8]]}>
            {clubTeams.map((/** @type {any} */ team) => {
              const isMine = isMyTeam(team, userData);
              const activeTrainers = (Array.isArray(team?.trainers) ? team.trainers : [])
                .filter((/** @type {any} */ trainer) => !isDeletedTrainer(trainer));
              // Orpheline seulement si ce n'est pas mon equipe et qu'aucun
              // entraineur actif n'est presente par l'API.
              const isOrphan = !isMine && activeTrainers.length === 0;
              const isClaimingThis = claimTeamMutation.isPending
                && claimTeamMutation.variables === team?.documentId;
              let subtitle;
              let tag;
              if (isMine) {
                subtitle = 'Tu y es déjà — ouvrir';
              } else if (isOrphan) {
                subtitle = 'Sans entraîneur·e — reprends-la';
                tag = 'Reprendre';
              } else {
                subtitle = `${activeTrainers.length} entraîneur·e${activeTrainers.length > 1 ? 's' : ''}`;
              }
              return (
                <WizardOptionCard
                  compact
                  key={team?.documentId || team?.name}
                  onPress={() => {
                    if (claimTeamMutation.isPending) {
                      return;
                    }
                    if (isOrphan) {
                      claimTeamMutation.mutate(team?.documentId);
                    } else {
                      goToTeamDetails(team?.documentId);
                    }
                  }}
                  subtitle={isClaimingThis ? 'Reprise en cours…' : subtitle}
                  tag={tag}
                  title={team?.name || 'Équipe'}
                />
              );
            })}
          </View>

          <Button
            onPress={() => setIsChooserDismissed(true)}
            title="Créer une nouvelle équipe"
            variant="Primary"
          />
        </View>
      </BottomModal>

      <SubscriptionPaywallSheet
        close={() => setClaimPaywallDecision(null)}
        clubDocumentId={state.clubId || null}
        decision={claimPaywallDecision}
        isVisible={Boolean(claimPaywallDecision)}
        navigation={navigation}
        resumeRouteName={RouteNames.TeamStack}
        resumeRouteParams={{ screen: RouteNames.TeamWizardName }}
      />
    </WizardStepLayout>
  );
}

export default TeamWizardName;
