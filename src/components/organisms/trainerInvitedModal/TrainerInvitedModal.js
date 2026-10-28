import { useTranslation } from 'react-i18next';

import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

import FeuilleDeSucces from '@/components/organisms/feuilleDeSucces/FeuilleDeSucces';

/**
 * Modal to invite a trainer after creation
 * @param {object} props
 * @param {boolean} props.isVisible - Whether the modal is visible
 * @param {Function} props.onClose - Function to call when closing the modal (e.g. navigation.goBack)
 * @param {Function} props.onInvite - Function to call when clicking on "Invite"
 * @param {string} props.trainerName - Name of the trainer
 */
function TrainerInvitedModal({
  isVisible,
  onClose,
  onInvite,
  trainerName,
}) {
  const { t } = useTranslation();

  // FEUILLES-COUPEES (15/09) : les boutons vivent DANS le contenu, pas dans un
  // `footerComponent` (FeuilleDeSucces les y range) : un pied n'est pas compté
  // dans la hauteur de la feuille et sortait par le bas de l'écran.
  return (
    <FeuilleDeSucces
      actionPrincipale={{ onPress: () => onInvite(), title: t('addCoach.actions.invite') }}
      actionSecondaire={{ onPress: () => onClose(), title: t('common.actions.askLater') }}
      close={onClose}
      isVisible={isVisible}
      texte={t('addCoach.alerts.success.description', { trainerName, ...SANS_ECHAPPEMENT })}
      titre={t('addCoach.alerts.success.title')}
    />
  );
}

export default TrainerInvitedModal;
