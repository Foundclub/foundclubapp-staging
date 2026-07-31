import { useMemo } from 'react';
import { Text, View } from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import EventWizardTeamCard from '@/views/event/wizard/components/EventWizardTeamCard';

import { RouteNames } from '@/navigation/routeNames';

import { useFriendlyMatchWizard } from './FriendlyMatchWizardContext';
import {
  getFriendlyMatchWizardStepCount,
  getFriendlyMatchWizardStepIndex,
} from './friendlyMatchWizardSteps';

/**
 * La cle d une equipe.
 * @param {any} team
 * @returns {string}
 */
const getTeamKey = (team) => String(team?.documentId || team?.id || '').trim();

/**
 * Etape 1/7 — « Mon equipe » (§4.1).
 *
 * La liste est celle des equipes que le lecteur encadre : `myTeams` (dirigeant)
 * + `trainedTeams` (entraineur), la meme paire que la liste des annonces. Le
 * serveur revalide de toute facon avec `canManageTeam` (team/services/auth.ts) :
 * ce filtre est un confort, jamais la securite.
 * @param {{ navigation: any }} props
 * @returns {import('react').ReactElement}
 */
function FriendlyMatchWizardTeam({ navigation }) {
  const { Colors, Fonts, Spaces } = /** @type {any} */ (useTheme());
  const { dispatch, state } = useFriendlyMatchWizard();
  const { userData } = /** @type {any} */ (useAuth());

  const managedTeams = useMemo(() => {
    const seen = new Set();
    return [
      ...(userData?.myTeams || []),
      ...(userData?.trainedTeams || []),
    ].filter((team) => {
      const key = getTeamKey(team);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [userData?.myTeams, userData?.trainedTeams]);

  /**
   * Retient l equipe choisie et enchaine sur l etape suivante.
   * @param {any} team
   * @returns {void}
   */
  const handleSelectTeam = (team) => {
    dispatch({ payload: team, type: 'SET_TEAM' });
    navigation.navigate(RouteNames.FriendlyMatchWizardHosting);
  };

  if (managedTeams.length === 0) {
    return (
      <WizardStepLayout
        onBack={() => navigation.goBack()}
        stepCount={getFriendlyMatchWizardStepCount()}
        stepIndex={getFriendlyMatchWizardStepIndex('team')}
        subtitle="Tu n’encadres encore aucune équipe"
        title="Publier une annonce"
      >
        <View style={[Spaces.padding[24], {
          backgroundColor: withAlpha(Colors.primary900, 0.94),
          borderColor: withAlpha(Colors.primary500, 0.15),
          borderRadius: 16,
          borderWidth: 1,
        }]}
        >
          <Text style={[Fonts.p1, { color: Colors.neutral200, textAlign: 'center' }]}>
            Il faut encadrer une équipe pour proposer un match amical. Demande à
            ton club de te rattacher à une équipe, puis reviens ici.
          </Text>
        </View>
      </WizardStepLayout>
    );
  }

  return (
    <WizardStepLayout
      onBack={() => navigation.goBack()}
      stepCount={getFriendlyMatchWizardStepCount()}
      stepIndex={getFriendlyMatchWizardStepIndex('team')}
      subtitle="Qui cherche un adversaire ?"
      title="Publier une annonce"
    >
      <View style={[Spaces.gap[16], Spaces.paddingBottom[8]]}>
        {managedTeams.map((team) => (
          <EventWizardTeamCard
            isSelected={getTeamKey(state.team) === getTeamKey(team)}
            key={getTeamKey(team)}
            onPress={() => handleSelectTeam(team)}
            showSelectionIndicator
            team={team}
          />
        ))}
      </View>
    </WizardStepLayout>
  );
}

export default FriendlyMatchWizardTeam;
