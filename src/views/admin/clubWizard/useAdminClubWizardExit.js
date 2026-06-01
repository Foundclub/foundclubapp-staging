// @ts-nocheck
/* eslint-disable jsdoc/require-description, jsdoc/require-param-type, jsdoc/require-returns, max-len */
import { useCallback } from 'react';
import { Alert } from 'react-native';

import { RouteNames } from '@/navigation/routeNames';

import {
  isAdminClubWizardPristine,
  useAdminClubWizard,
} from './AdminClubWizardContext';

/**
 *
 * @param navigation
 */
function useAdminClubWizardExit(navigation) {
  const { reset, state } = useAdminClubWizard();

  return useCallback(() => {
    const leaveWizard = () => {
      reset();
      if (navigation?.canGoBack?.()) {
        navigation.goBack();
        return;
      }
      navigation.navigate(RouteNames.AdminClubList);
    };

    if (isAdminClubWizardPristine(state)) {
      leaveWizard();
      return;
    }

    Alert.alert(
      'Quitter la creation ?',
      'Le tunnel de creation du club sera ferme et les informations non sauvegardees seront perdues.',
      [
        { style: 'cancel', text: 'Continuer' },
        {
          onPress: leaveWizard,
          style: 'destructive',
          text: 'Quitter',
        },
      ],
    );
  }, [navigation, reset, state]);
}

export default useAdminClubWizardExit;
