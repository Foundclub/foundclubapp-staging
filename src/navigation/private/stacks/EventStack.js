import { createStackNavigator } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';

import EventDetails from '@/views/event/EventDetails';
import EventEdit from '@/views/event/EventEdit';
import EventFilters from '@/views/event/EventFilters';
import EventPublishedShowcase from '@/views/event/EventPublishedShowcase';
import TournamentManagement from '@/views/event/TournamentManagement';
import TournamentMatchDetails from '@/views/event/TournamentMatchDetails';
import TournamentSettingsEdit from '@/views/event/TournamentSettingsEdit';
import TournamentTeamDetails from '@/views/event/TournamentTeamDetails';
import EventWizardAccess from '@/views/event/wizard/EventWizardAccess';
import { EventWizardProvider } from '@/views/event/wizard/EventWizardContext';
import EventWizardDescription from '@/views/event/wizard/EventWizardDescription';
import EventWizardInvites from '@/views/event/wizard/EventWizardInvites';
import EventWizardLocation from '@/views/event/wizard/EventWizardLocation';
import EventWizardLogistics from '@/views/event/wizard/EventWizardLogistics';
import EventWizardParticipants from '@/views/event/wizard/EventWizardParticipants';
import EventWizardRecap from '@/views/event/wizard/EventWizardRecap';
import EventWizardStageProgram from '@/views/event/wizard/EventWizardStageProgram';
import EventWizardTeam from '@/views/event/wizard/EventWizardTeam';
import EventWizardTournamentSettings from '@/views/event/wizard/EventWizardTournamentSettings';
import EventWizardTournamentStructure from '@/views/event/wizard/EventWizardTournamentStructure';
import EventWizardType from '@/views/event/wizard/EventWizardType';
import MatchCallUpManualPlayer from '@/views/matchCallUp/MatchCallUpManualPlayer';
import MatchCallUpSelection from '@/views/matchCallUp/MatchCallUpSelection';
import MatchCompositionBoard from '@/views/matchCallUp/MatchCompositionBoard';
import MatchCompositionAmend from '@/views/matchCallUp/MatchCompositionAmend';
import MatchCompositionStart from '@/views/matchCallUp/MatchCompositionStart';
import MatchConvocationPublished from '@/views/matchCallUp/MatchConvocationPublished';
import MatchStatsEditor from '@/views/matchStats/MatchStatsEditor';
import PendingMatchStatsScreen from '@/views/matchStats/PendingMatchStatsScreen';
import PlayerMatchResponseScreen from '@/views/matchStats/PlayerMatchResponseScreen';
import TacticalBoardV2 from '@/views/tactical_v2/TacticalBoardEntry';
import TacticalSelectionV2 from '@/views/tactical_v2/TacticalSelection';

import { commonOptions } from '@/navigation/commonOptions';
import { RouteNames } from '@/navigation/routeNames';

const Stack = createStackNavigator();

/**
 *
 */
function EventStack() {
  const { t } = useTranslation();

  return (
    <EventWizardProvider>
      <Stack.Navigator
        id={undefined}
        initialRouteName={RouteNames.EventDetails}
        screenOptions={commonOptions}
      >
        <Stack.Screen
          component={EventDetails}
          name={RouteNames.EventDetails}
          options={{
            ...commonOptions,
            headerTitle: '',
          }}
        />
        <Stack.Screen
          component={EventEdit}
          name={RouteNames.EventEdit}
          options={{
            ...commonOptions,
            headerTitle: t('eventEdit.title'),
          }}
        />
        <Stack.Screen
          component={EventFilters}
          name={RouteNames.EventFilters}
          options={{
            ...commonOptions,
            headerTitle: '',
          }}
        />
        <Stack.Screen
          component={EventPublishedShowcase}
          name={RouteNames.EventPublishedShowcase}
          options={{
            ...commonOptions,
            headerShown: false,
          }}
        />
        <Stack.Screen
          component={TournamentManagement}
          name={RouteNames.TournamentManagement}
          options={{
            ...commonOptions,
            headerTitle: '',
          }}
        />
        <Stack.Screen
          component={TournamentMatchDetails}
          name={RouteNames.TournamentMatchDetails}
          options={{
            ...commonOptions,
            headerTitle: '',
          }}
        />
        <Stack.Screen
          component={TournamentSettingsEdit}
          name={RouteNames.TournamentSettingsEdit}
          options={{
            ...commonOptions,
            headerTitle: '',
          }}
        />
        <Stack.Screen
          component={TournamentTeamDetails}
          name={RouteNames.TournamentTeamDetails}
          options={{
            ...commonOptions,
            headerTitle: '',
          }}
        />
        {/* Match — convocation (D77) : ecrans 1 a 3 du pack composition. */}
        <Stack.Screen
          component={MatchCallUpSelection}
          name={RouteNames.MatchCallUpSelection}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          component={MatchCallUpManualPlayer}
          name={RouteNames.MatchCallUpManualPlayer}
          options={{ headerShown: false }}
        />
        {/* Match — placer puis publier (D79) : ecrans 4 a 6 du pack. */}
        <Stack.Screen
          component={MatchCompositionStart}
          name={RouteNames.MatchCompositionStart}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          component={MatchCompositionBoard}
          name={RouteNames.MatchCompositionBoard}
          options={{ headerShown: false }}
        />
        {/* Match — apres la publication (C-B) : ecran 7 du pack. */}
        <Stack.Screen
          component={MatchConvocationPublished}
          name={RouteNames.MatchConvocationPublished}
          options={{ headerShown: false }}
        />
        {/* Match — apres la publication (C-B) : ecran 8, le desistement. */}
        <Stack.Screen
          component={MatchCompositionAmend}
          name={RouteNames.MatchCompositionAmend}
          options={{ headerShown: false }}
        />
        {/* Tactical V2 Screens */}
        <Stack.Screen
          component={TacticalSelectionV2}
          name={RouteNames.TacticalSelectionV2}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          component={TacticalBoardV2}
          name={RouteNames.TacticalBoardV2}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          component={MatchStatsEditor}
          name={RouteNames.MatchStatsEditor}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          component={PlayerMatchResponseScreen}
          name={RouteNames.PlayerMatchResponse}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          component={PendingMatchStatsScreen}
          name={RouteNames.PendingMatchStats}
          options={{ headerShown: false }}
        />

        {/* Wizard Screens */}
        <Stack.Screen
          component={EventWizardType}
          name={RouteNames.EventWizardType}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          component={EventWizardTeam}
          name={RouteNames.EventWizardTeam}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          component={EventWizardInvites}
          name={RouteNames.EventWizardInvites}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          component={EventWizardLogistics}
          name={RouteNames.EventWizardLogistics}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          component={EventWizardStageProgram}
          name={RouteNames.EventWizardStageProgram}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          component={EventWizardTournamentSettings}
          name={RouteNames.EventWizardTournamentSettings}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          component={EventWizardTournamentStructure}
          name={RouteNames.EventWizardTournamentStructure}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          component={EventWizardLocation}
          name={RouteNames.EventWizardLocation}
          options={{ headerShown: false }}
        />
        {/* D08 : `EventWizardAccess` remplace les ecrans « Visibilite » et
            « Mode de validation », fusionnes en un seul. */}
        <Stack.Screen
          component={EventWizardAccess}
          name={RouteNames.EventWizardAccess}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          component={EventWizardParticipants}
          name={RouteNames.EventWizardParticipants}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          component={EventWizardDescription}
          name={RouteNames.EventWizardDescription}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          component={EventWizardRecap}
          name={RouteNames.EventWizardRecap}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </EventWizardProvider>
  );
}

export default EventStack;
