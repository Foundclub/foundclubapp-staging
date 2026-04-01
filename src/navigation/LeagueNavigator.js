import { createStackNavigator } from '@react-navigation/stack';

import LeagueDashboard from '@/views/league/dashboard/LeagueDashboard';
import SquadDetailsScreen from '@/views/league/details/SquadDetailsScreen';
import SquadRequestsScreen from '@/views/league/details/SquadRequestsScreen';
import EndMatchScreen from '@/views/league/match/EndMatchScreen';
import LeagueMatchDetails from '@/views/league/match/LeagueMatchDetails';
import MatchCenterScreen from '@/views/league/match/MatchCenterScreen';
import MatchHistoryScreen from '@/views/league/match/MatchHistoryScreen';
import PastMatchDetails from '@/views/league/match/PastMatchDetails';
import RankingScreen from '@/views/league/ranking/RankingScreen';
import SquadFiltersScreen from '@/views/league/search/SquadFiltersScreen';
import SquadSearchScreen from '@/views/league/search/SquadSearchScreen';
import MatchStatsEditor from '@/views/matchStats/MatchStatsEditor';
import PlayerMatchResponseScreen from '@/views/matchStats/PlayerMatchResponseScreen';

import { RouteNames } from '@/navigation/routeNames';

const Stack = createStackNavigator();

/**
 *
 */
export default function LeagueNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen component={LeagueDashboard} name={RouteNames.LeagueHome} />
      <Stack.Screen component={MatchCenterScreen} name={RouteNames.MatchCenter} />
      <Stack.Screen
        component={EndMatchScreen}
        name={RouteNames.EndMatchScreen}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        component={RankingScreen}
        name={RouteNames.LeagueRanking}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        component={MatchHistoryScreen}
        name={RouteNames.MatchHistoryScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        component={LeagueMatchDetails}
        name={RouteNames.LeagueMatchDetails}
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
        component={PastMatchDetails}
        name={RouteNames.PastMatchDetails}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        component={SquadDetailsScreen}
        name={RouteNames.SquadDetails}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        component={SquadSearchScreen}
        name={RouteNames.SquadSearch}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        component={SquadFiltersScreen}
        name={RouteNames.SquadFilters}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        component={SquadRequestsScreen}
        name={RouteNames.SquadRequests}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
