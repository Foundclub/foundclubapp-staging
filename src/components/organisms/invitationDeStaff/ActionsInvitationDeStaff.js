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
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';
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
 * Les boutons « Refuser » / « Voir et accepter » sous une invitation de staff de la cloche.
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
  const { Alignments, Fonts, Spaces } = useTheme();
  const [phase, setPhase] = useState(
    /** @type {'' | 'question' | 'bienvenue' | 'refusee' | 'bloquee'} */ (''),
  );
  const [enCours, setEnCours] = useState(false);
  const [refusServeur, setRefusServeur] = useState({ texte: '', titre: '' });
  const [echeance, setEcheance] = useState('');
  // INVITE-STAFF-DESIGN : l'écusson (F), lu avec l'invitation ; l'équipe rejointe (G).
  const [logoUrl, setLogoUrl] = useState('');
  const [equipe, setEquipe] = useState(
    /** @type {{ documentId?: string, name?: string } | null} */ (null),
  );

  const documentId = String(data?.invitationId || '').trim();
  if (!documentId) return null;

  const invitation = {
    clubName: data?.clubName,
    documentId,
    inviterName: data?.inviterName,
    role: data?.role,
    teamName: data?.teamName,
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
      setLogoUrl(String(encore.club?.logoUrl || ''));
    } catch (error) {
      // Lecture impossible : la feuille reste ouverte, l'acceptation tranchera.
    }
  };

  const repondre = async (/** @type {'accept' | 'refuse'} */ geste) => {
    if (enCours) return;
    setEnCours(true);
    try {
      if (geste === 'accept') {
        const reponse = /** @type {any} */ (await acceptStaffInvitation(documentId));
        setEquipe(reponse?.team?.documentId ? reponse.team : null);
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

  const effets = effetsDeLAcceptation(t, invitation)
    .map((ligne) => `· ${ligne}`)
    .join('\n');
  const texteQuestion = [
    invitation.inviterName
      ? t('staffInvitation.received.by', {
        interpolation: { escapeValue: false },
        name: invitation.inviterName,
      })
      : '',
    t('staffInvitation.sheet.ifAccept'),
    effets,
    '',
    echeance
      ? t('staffInvitation.sheet.ifRefuseUntil', {
        date: echeance,
        interpolation: { escapeValue: false },
      })
      : t('staffInvitation.sheet.ifRefuse'),
  ]
    .filter((ligne, index) => index > 0 || ligne)
    .join('\n');

  // F (maquette validée) : l'écusson du club, « Invitation » et son nom, à la place de la coche.
  const ecusson = (
    <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12]]}>
      <ClubLogoMark logoUrl={logoUrl || undefined} name={invitation.clubName || ''} size={56} />
      <View style={[Alignments.fill]}>
        <Text style={[Fonts.p3Bold, Fonts.neutral300]}>{t('staffInvitation.sheet.eyebrow')}</Text>
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{invitation.clubName || ''}</Text>
      </View>
    </View>
  );

  // G : une invitation avec équipe ouvre l'équipe ; sans équipe, le club, comme avant.
  const valeursEquipe = { interpolation: { escapeValue: false }, team: equipe?.name || '' };
  let texteBienvenue = t('staffInvitation.welcome.coach');
  if (invitation.role === 'dirigeant') texteBienvenue = t('staffInvitation.welcome.dirigeant');
  else if (equipe) texteBienvenue = t('staffInvitation.welcome.coachOf', valeursEquipe);
  const ouvrirApresAccord = () => {
    fermer();
    if (!navigation?.navigate) return;
    if (equipe?.documentId) {
      navigation.navigate(RouteNames.TeamDetails, { teamId: equipe.documentId });
    } else if (data?.clubId) {
      navigation.navigate(RouteNames.Club, { clubId: data.clubId });
    }
  };

  return (
    <View
      style={[Alignments.row, Spaces.gap[8], Spaces.marginTop[12]]}
      testID={testID || undefined}
    >
      <Button
        onPress={() => repondre('refuse')}
        style={{ flex: 1 }}
        title={t('staffInvitation.received.refuse')}
        variant="Secondary"
      />
      <Button
        onPress={ouvrir}
        style={{ flex: 1 }}
        title={t('staffInvitation.received.open')}
        variant="Primary"
      />

      <FeuilleDeSucces
        actionPrincipale={{
          onPress: () => repondre('accept'),
          title: t('staffInvitation.sheet.accept'),
        }}
        actionSecondaire={{
          onPress: () => repondre('refuse'),
          title: t('staffInvitation.sheet.refuse'),
        }}
        close={fermer}
        isVisible={phase === 'question'}
        pastille={ecusson}
        texte={texteQuestion}
        titre={phraseDInvitation(t, invitation)}
      />

      <FeuilleDeSucces
        actionPrincipale={{
          onPress: ouvrirApresAccord,
          title: equipe
            ? t('staffInvitation.welcome.openTeam', valeursEquipe)
            : t('staffInvitation.welcome.openClub'),
        }}
        actionSecondaire={{ onPress: fermer, title: t('staffInvitation.welcome.later') }}
        close={fermer}
        isVisible={phase === 'bienvenue'}
        texte={texteBienvenue}
        titre={t('staffInvitation.welcome.title', {
          club: invitation.clubName || '',
          interpolation: { escapeValue: false },
        })}
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
