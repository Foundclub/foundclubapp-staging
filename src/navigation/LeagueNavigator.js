
import { createStackNavigator } from '@react-navigation/stack';
import { Text, View, SafeAreaView } from 'react-native';
import useTheme from '@/theme/themeContext';

import ModeSwitch from '@/components/atoms/ModeSwitch/ModeSwitch';

import { TouchableOpacity } from 'react-native';
import SquadNameScreen from '@/views/league/creation/SquadNameScreen';
import SquadHomeBaseScreen from '@/views/league/creation/SquadHomeBaseScreen';
import SquadSummaryScreen from '@/views/league/creation/SquadSummaryScreen';
import MatchCenterScreen from '@/views/league/match/MatchCenterScreen';

import MatchDetailsScreen from '@/views/league/match/MatchDetailsScreen';
import LeagueDashboard from '@/views/league/dashboard/LeagueDashboard';
import RankingScreen from '@/views/league/ranking/RankingScreen';
import MatchHistoryScreen from '@/views/league/match/MatchHistoryScreen';
import LeagueMatchDetails from '@/views/league/match/LeagueMatchDetails';
import { RouteNames } from '@/navigation/routeNames';

const Stack = createStackNavigator();

export default function LeagueNavigator() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="LeagueHome" component={LeagueDashboard} />
            <Stack.Screen name="MatchCenter" component={MatchCenterScreen} />
            <Stack.Screen name="SquadName" component={SquadNameScreen} />
            <Stack.Screen name="SquadHomeBase" component={SquadHomeBaseScreen} />
            <Stack.Screen name="SquadSummary" component={SquadSummaryScreen} />

      <Stack.Screen
        component={MatchDetailsScreen}
        name="MatchDetails"
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
        name={RouteNames.LeagueMatchDetails}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
    );
}
