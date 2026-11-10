/**
 * INVITE-STAFF (10/11/2026, maquette validée, écrans E à H) — dans la cloche, sous une
 * notification `staffInvitation` : « Refuser » et « Voir et accepter ».
 *
 *   E · la carte : deux boutons ;
 *   F · « Voir et accepter » ouvre la feuille qui dit ce qui change si on accepte ;
 *   G · après « Accepter » : bienvenue, et un bouton vers le club ;
 *   H · refus (rien ne change, le club n'est pas prévenu), ou refus du serveur (mineur,
 *       invitation périmée, club complet, compte protégé).
 * Rien ne change sans le geste de la personne : aucune écriture à l'affichage.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import FeuilleDeSucces from '@/components/organisms/feuilleDeSucces/FeuilleDeSucces';

import { RouteNames } from '@/navigation/routeNames';

import {
  acceptStaffInvitation,
  getMyStaffInvitations,
  refuseStaffInvitation,
} from '@/services/staffInvitation/staffInvitationService';

import {
  dateCourte,
  effetsDeLAcceptation,
  messageDeRefusServeur,
  phraseDInvitation,
} from './textesInvitationDeStaff';

/**
 * @param {object} props
 * @param {Record<string, any>} props.data - `notification.data` (invitationId, clubName, role…).
 * @param {any} [props.navigation] - pour « Ouvrir le club ».
 * @param {() => void} [props.relire] - relit la cloche après une réponse.
 * @param {string} [props.testID] - préfixe des testID.
 * @returns {import('react').ReactElement | null} les boutons et leurs feuilles.
 */
function ActionsInvitationDeStaff({
  data, navigation, relire, testID = '',
}) {
  const { t } = useTranslation();
  const { Alignments, Spaces } = useTheme();
  const [phase, setPhase] = useState(/** @type {'' | 'question' | 'bienvenue' | 'refusee' | 'bloquee'} */ (''));
  const [enCours, setEnCours] = useState(false);
  const [refusServeur, setRefusServeur] = useState({ texte: '', titre: '' });
  const [echeance, setEcheance] = useState('');

  const documentId = String(data?.invitationId || '').trim();
  if (!documentId) return null;

  const invitation = {
    clubName: data?.clubName, documentId, inviterName: data?.inviterName, role: data?.role, teamName: data?.teamName,
  };

  const fermer = () => setPhase('');

  const ouvrir = async () => {
    setPhase('question');
    // L'invitation est-elle encore ouverte ? (annulée, périmée, déjà répondue ailleurs)
    try {
      const mine = await getMyStaffInvitations();
      const encore = mine.find((item) => item?.documentId === documentId);
      if (!encore) {
        setRefusServeur(messageDeRefusServeur(t, 'STAFF_INVITE_NOT_FOUND'));
        setPhase('bloquee');
        return;
      }
      setEcheance(dateCourte(encore.expiresAt));
    } catch (error) {
      // Lecture impossible : la feuille reste ouverte, l'acceptation tranchera.
    }
  };

  const repondre = async (/** @type {'accept' | 'refuse'} */ geste) => {
    if (enCours) return;
    setEnCours(true);
    try {
      if (geste === 'accept') {
        await acceptStaffInvitation(documentId);
        setPhase('bienvenue');
      } else {
        await refuseStaffInvitation(documentId);
        setPhase('refusee');
      }
      relire?.();
    } catch (/** @type {any} */ error) {
      setRefusServeur(messageDeRefusServeur(t, String(error?.code || '')));
      setPhase('bloquee');
    } finally {
      setEnCours(false);
    }
  };

  const effets = effetsDeLAcceptation(t, invitation).map((ligne) => `· ${ligne}`).join('\n');
  const texteQuestion = [
    invitation.inviterName ? t('staffInvitation.received.by', { name: invitation.inviterName }) : '',
    t('staffInvitation.sheet.ifAccept'),
    effets,
    '',
    echeance
      ? t('staffInvitation.sheet.ifRefuseUntil', { date: echeance })
      : t('staffInvitation.sheet.ifRefuse'),
  ].filter((ligne, index) => index > 0 || ligne).join('\n');

  return (
    <View style={[Alignments.row, Spaces.gap[8], Spaces.marginTop[12]]}>
      <Button
        onPress={() => repondre('refuse')}
        style={{ flex: 1 }}
        testID={`${testID}-staff-invite-refuse`}
        title={t('staffInvitation.received.refuse')}
        variant="Secondary"
      />
      <Button
        onPress={ouvrir}
        style={{ flex: 1 }}
        testID={`${testID}-staff-invite-open`}
        title={t('staffInvitation.received.open')}
        variant="Primary"
      />

      <FeuilleDeSucces
        actionPrincipale={{ onPress: () => repondre('accept'), title: t('staffInvitation.sheet.accept') }}
        actionSecondaire={{ onPress: () => repondre('refuse'), title: t('staffInvitation.sheet.refuse') }}
        close={fermer}
        isVisible={phase === 'question'}
        texte={texteQuestion}
        titre={phraseDInvitation(t, invitation)}
      />

      <FeuilleDeSucces
        actionPrincipale={{
          onPress: () => {
            fermer();
            if (data?.clubId && navigation?.navigate) navigation.navigate(RouteNames.Club, { clubId: data.clubId });
          },
          title: t('staffInvitation.welcome.openClub'),
        }}
        actionSecondaire={{ onPress: fermer, title: t('staffInvitation.welcome.later') }}
        close={fermer}
        isVisible={phase === 'bienvenue'}
        texte={invitation.role === 'dirigeant'
          ? t('staffInvitation.welcome.dirigeant')
          : t('staffInvitation.welcome.coach')}
        titre={t('staffInvitation.welcome.title', { club: invitation.clubName || '' })}
      />

      <FeuilleDeSucces
        actionPrincipale={{ onPress: fermer, title: t('staffInvitation.ok') }}
        actionSecondaire={{ onPress: fermer, title: t('staffInvitation.close') }}
        close={fermer}
        isVisible={phase === 'refusee' || phase === 'bloquee'}
        texte={phase === 'refusee' ? t('staffInvitation.refused.text') : refusServeur.texte}
        titre={phase === 'refusee' ? t('staffInvitation.refused.title') : refusServeur.titre}
      />
    </View>
  );
}

export default ActionsInvitationDeStaff;
