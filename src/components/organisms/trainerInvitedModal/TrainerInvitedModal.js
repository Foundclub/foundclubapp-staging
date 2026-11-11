import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform } from 'react-native';

import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

import FeuilleDeSucces from '@/components/organisms/feuilleDeSucces/FeuilleDeSucces';

// Jumeaux `.native.js` / `.web.js` : le contrôle de types ne voit aucun fichier à ce chemin.
// @ts-ignore -- cf. ci-dessus (même note que `ApercuDImage.js`)
import { copier } from '@/platform/share';
import { useIsDesktop } from '@/responsive/useIsDesktop';

/**
 * Modal to invite a trainer after creation
 * @param {object} props
 * @param {boolean} props.isVisible - Whether the modal is visible
 * @param {() => void} props.onClose - Function to call when closing the modal (e.g. navigation.goBack)
 * @param {() => void} props.onInvite - Function to call when clicking on "Invite"
 * @param {string} props.trainerName - Name of the trainer
 * @param {boolean} [props.isManager] - INVITESMS (29/10) : un dirigeant (son texte).
 * @param {boolean} [props.dejaInscrit] - INVITE-COACH-EXISTANT (10/11) : le numéro a déjà un
 *   compte ; personne n'est ajouté, la feuille dit pourquoi et comment il rejoindra le club.
 * @param {string} [props.messageDInvitation] - RETOURS-TESTEUR-2 (M0077) : le texte du SMS, lien
 *   compris. Sur le site, sur ordinateur, il se copie ou part par e-mail au lieu du SMS.
 * @param {string} [props.titre] - INVITE-STAFF (10/11) : titre fourni par l'appelant.
 * @param {string} [props.texte] - INVITE-STAFF : texte fourni par l'appelant.
 * @param {string} [props.libelleInviter] - INVITE-STAFF : libellé du bouton SMS.
 * @returns {import('react').ReactElement} La feuille.
 */
function TrainerInvitedModal({
  dejaInscrit = false,
  isManager = false,
  isVisible,
  libelleInviter = '',
  messageDInvitation = '',
  onClose,
  onInvite,
  texte: texteFourni = '',
  titre: titreFourni = '',
  trainerName,
}) {
  const { t } = useTranslation();
  const estOrdinateur = useIsDesktop();
  const [copie, setCopie] = useState(/** @type {'' | 'copie' | 'echec'} */ (''));

  useEffect(() => {
    if (!isVisible) setCopie('');
  }, [isVisible]);

  // INVITE-COACH-EXISTANT : « Ajout réussi ! » serait faux, rien n'a été créé.
  let titre = dejaInscrit
    ? t('addCoach.alerts.invitation.title')
    : t('addCoach.alerts.success.title');
  if (titreFourni) titre = titreFourni;
  let texteDuSucces = isManager
    ? t('addClubManager.alerts.success.description', {
      managerName: trainerName, ...SANS_ECHAPPEMENT,
    })
    : t('addCoach.alerts.success.description', { trainerName, ...SANS_ECHAPPEMENT });
  if (dejaInscrit) texteDuSucces = t('addCoach.alerts.invitation.description');
  if (texteFourni) texteDuSucces = texteFourni;

  // RETOURS-TESTEUR-2 (06/11/2026, M0077, décision du chef « A ») — un ordinateur n'envoie pas
  // de SMS : sur le site, sur ordinateur, on copie l'invitation ou on l'envoie par e-mail. Le site
  // ouvert sur un téléphone garde le SMS, comme l'application.
  const sansSms = Platform.OS === 'web' && estOrdinateur && Boolean(messageDInvitation);
  if (sansSms) {
    let texte = texteDuSucces;
    if (copie === 'copie') {
      texte = t(
        'addCoach.alerts.inviteCopied',
        'Invitation copiée : colle-la dans un e-mail, WhatsApp ou un SMS.',
      );
    } else if (copie === 'echec') {
      texte = t(
        'smsRepliCopie.echec',
        'La copie n’a pas marché sur ce navigateur : '
          + 'envoie l’invitation depuis ton téléphone.',
      );
    }
    const objet = t('clubDetails.alerts.inviteTrainer.title');
    return (
      <FeuilleDeSucces
        actionPrincipale={{
          onPress: async () => {
            setCopie((await copier(messageDInvitation)) ? 'copie' : 'echec');
          },
          title: t('addCoach.actions.copyInvite', 'Copier le lien d’invitation'),
        }}
        actionSecondaire={{
          onPress: () => {
            const corps = encodeURIComponent(messageDInvitation);
            return Linking.openURL(`mailto:?subject=${encodeURIComponent(objet)}&body=${corps}`)
              .catch(() => undefined);
          },
          title: t('addCoach.actions.emailInvite', 'Envoyer par e-mail'),
        }}
        close={onClose}
        isVisible={isVisible}
        texte={texte}
        titre={titre}
        tourTargetId="ok-sheet"
      />
    );
  }

  // FEUILLES-COUPEES (15/09) : les boutons vivent DANS le contenu, pas dans un
  // `footerComponent` (FeuilleDeSucces les y range) : un pied n'est pas compté
  // dans la hauteur de la feuille et sortait par le bas de l'écran.
  return (
    <FeuilleDeSucces
      actionPrincipale={{
        onPress: () => onInvite(),
        title: libelleInviter || t('addCoach.actions.invite'),
      }}
      actionSecondaire={{ onPress: () => onClose(), title: t('common.actions.askLater') }}
      close={onClose}
      isVisible={isVisible}
      texte={texteDuSucces}
      titre={titre}
      tourTargetId="ok-sheet"
    />
  );
}

export default TrainerInvitedModal;
