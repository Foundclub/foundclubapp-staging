import { useCallback } from 'react';

import { useTeamWizard } from '@/views/team/wizard/TeamWizardContext';

import { RouteNames } from '@/navigation/routeNames';

import { useAppMode } from '@/context/AppModeContext';

/**
 * Returns a stable handler to exit team wizard and go back to the teams tab root.
 * @param {import('@react-navigation/native').NavigationProp<any>} navigation
 * @returns {() => void}
 */
function useTeamWizardExit(navigation) {
  const { isGold } = useAppMode();
  const { dispatch, state } = useTeamWizard();

  return useCallback(() => {
    dispatch({ type: 'RESET' });

    const rootRoute = isGold ? RouteNames.LeagueHomeTab : RouteNames.HomeTab;
    const targetScreen = isGold ? RouteNames.LeagueSquadTab : RouteNames.MyTeamList;
    const targetClubId = state?.clubId || '';
    const rootNavigation = navigation.getParent?.();

    if (rootNavigation) {
      rootNavigation.reset({
        index: 0,
        routes: [{
          name: rootRoute,
          params: {
            params: !isGold && targetClubId ? { clubId: targetClubId } : undefined,
            screen: targetScreen,
          },
        }],
      });
      return;
    }

    navigation.reset({
      index: 0,
      routes: [{
        name: rootRoute,
        params: { screen: targetScreen },
      }],
    });
  }, [dispatch, isGold, navigation, state?.clubId]);
}

export default useTeamWizardExit;
