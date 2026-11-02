import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

import Button from '@/components/atoms/button/Button';

import {
  useCancelTeamMembershipRequest,
} from '@/services/teamMembershipRequest/teamMembershipRequestQueries';

/**
 * FIN-INSCRIPTION p3 (02/11, Adel « 3a oui ») — retirer sa demande pour rejoindre une équipe.
 * Le serveur vérifie que la demande est bien la sienne.
 * @param {object} props
 * @param {string} props.requestId - La demande à retirer.
 * @param {string} [props.teamName] - L'équipe demandée.
 * @returns {import('react').ReactElement} Le bouton.
 */
function AnnulerMaDemande({ requestId, teamName }) {
  const { t } = useTranslation();
  const annulation = useCancelTeamMembershipRequest();

  const annuler = () => annulation.mutate(requestId, {
    onError: () => {
      Alert.alert(
        t('teamList.cancelRequest.errorTitle', 'Demande non annulée'),
        t(
          'teamList.cancelRequest.errorMessage',
          'Impossible d\'annuler ta demande pour le moment. Réessaie dans un instant.',
        ),
      );
    },
  });

  const demanderConfirmation = () => {
    Alert.alert(
      t('teamList.cancelRequest.confirmTitle', 'Annuler ta demande ?'),
      t(
        'teamList.cancelRequest.confirmMessage',
        'Ta demande pour rejoindre {{team}} sera retirée. Tu pourras en refaire une plus tard.',
        { team: teamName, ...SANS_ECHAPPEMENT },
      ),
      [
        { style: 'cancel', text: t('teamList.cancelRequest.keep', 'Garder ma demande') },
        {
          onPress: annuler,
          style: 'destructive',
          text: t('teamList.cancelRequest.confirm', 'Oui, annuler'),
        },
      ],
    );
  };

  return (
    <Button
      accessibilityLabel={t(
        'teamList.cancelRequest.actionLabel',
        'Annuler ma demande pour rejoindre {{team}}',
        { team: teamName, ...SANS_ECHAPPEMENT },
      )}
      isLoading={annulation.isPending}
      onPress={demanderConfirmation}
      title={t('teamList.cancelRequest.action', 'Annuler ma demande')}
      variant="Ghost"
    />
  );
}

export default AnnulerMaDemande;
