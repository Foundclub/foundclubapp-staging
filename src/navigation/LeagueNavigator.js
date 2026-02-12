
import { createStackNavigator } from '@react-navigation/stack';
import { Text, View, SafeAreaView } from 'react-native';
import useTheme from '@/theme/themeContext';

import ModeSwitch from '@/components/atoms/ModeSwitch/ModeSwitch';

import { TouchableOpacity } from 'react-native';
import MatchCenterScreen from '@/views/league/match/MatchCenterScreen';

import LeagueDashboard from '@/views/league/dashboard/LeagueDashboard';
import RankingScreen from '@/views/league/ranking/RankingScreen';
import MatchHistoryScreen from '@/views/league/match/MatchHistoryScreen';
import LeagueMatchDetails from '@/views/league/match/LeagueMatchDetails';
import PastMatchDetails from '@/views/league/match/PastMatchDetails';
import { RouteNames } from '@/navigation/routeNames';

const Stack = createStackNavigator();

export default function LeagueNavigator() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="LeagueHome" component={LeagueDashboard} />
            <Stack.Screen name="MatchCenter" component={MatchCenterScreen} />
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
      />
      <Stack.Screen 
        component={require('@/views/league/search/SquadSearchScreen').default} 
        name={RouteNames.SquadSearch} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        component={require('@/views/league/search/SquadFiltersScreen').default} 
        name="SquadFilters" 
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
