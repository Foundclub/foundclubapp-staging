import { Alert } from 'react-native';

/**
 * T3-RETOURS-0411 (M0251, « 1- A ») — la fenêtre avant le refus d'une demande reçue.
 * @param {any} t - La traduction (TFunction d'i18next).
 * @param {() => void} refuser - Le refus, seulement après la confirmation.
 * @returns {void}
 */
export const confirmerLeRefus = (t, refuser) => {
  Alert.alert(
    t('requests.rejectConfirmTitle'),
    t('requests.rejectConfirmMessage'),
    [
      { style: 'cancel', text: t('common.actions.cancel', 'Annuler') },
      {
        onPress: refuser,
        style: 'destructive',
        text: t('requestsHub.rejectMembershipConfirm', 'Refuser'),
      },
    ],
  );
};
