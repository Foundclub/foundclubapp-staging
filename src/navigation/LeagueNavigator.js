import { createStackNavigator } from '@react-navigation/stack';
import {
  SafeAreaView, Text, TouchableOpacity, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import ModeSwitch from '@/components/atoms/ModeSwitch/ModeSwitch';
import LeagueDashboard from '@/views/league/dashboard/LeagueDashboard';
import LeagueMatchDetails from '@/views/league/match/LeagueMatchDetails';
import MatchCenterScreen from '@/views/league/match/MatchCenterScreen';
import MatchHistoryScreen from '@/views/league/match/MatchHistoryScreen';
import PastMatchDetails from '@/views/league/match/PastMatchDetails';
import RankingScreen from '@/views/league/ranking/RankingScreen';

import { RouteNames } from '@/navigation/routeNames';

const Stack = createStackNavigator();

/**
 *
 */
export default function LeagueNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen component={LeagueDashboard} name="LeagueHome" />
      <Stack.Screen component={MatchCenterScreen} name="MatchCenter" />
      <Stack.Screen
        component={require('@/views/league/match/EndMatchScreen').default}
        name="EndMatchScreen"
        options={{ headerShown: false }}
      />

      <Stack.Screen
        component={RankingScreen}
        name={RouteNames.LeagueRanking}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        component={MatchHistoryScreen}
        name="MatchHistoryScreen"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        component={LeagueMatchDetails}
        name="LeagueMatchDetails"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        component={PastMatchDetails}
        name={RouteNames.PastMatchDetails}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        component={require('@/views/league/details/SquadDetailsScreen').default}
        name={RouteNames.SquadDetails}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        component={require('@/views/league/search/SquadSearchScreen').default}
        name={RouteNames.SquadSearch}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        component={require('@/views/league/search/SquadFiltersScreen').default}
        name={RouteNames.SquadFilters}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        component={require('@/views/league/details/SquadRequestsScreen').default}
        name={RouteNames.SquadRequests}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
