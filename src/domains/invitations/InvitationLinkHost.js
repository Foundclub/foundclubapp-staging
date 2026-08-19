/**
 * InvitationLinkHost.js — LA fenetre d'invitation, et le seul endroit qui la montre.
 *
 * Un seul hote pour TOUS les sujets (equipe, evenement, squad, club) : c'est ce
 * qui empeche deux systemes d'invitation de diverger (PROMPT_Y03, etape 2).
 *
 * 🔒 Regle non negociable : lire un lien ne fait RIEN. L'hote pose la question,
 * range l'invitation pour plus tard, et n'emmene sur l'ecran concerne que si la
 * personne a appuye. L'envoi reel de la demande reste sur l'ecran de destination,
 * qui nomme l'equipe et redemande confirmation.
 *
 * Monte une seule fois, au-dessus des navigateurs (voir src/App.js), pour que le
 * lien soit lu qu'on soit connecte ou non.
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking } from 'react-native';

import { readInviteLink } from '@/domains/invitations/inviteLink';
import {
  clearPendingInvite,
  readPendingInvite,
  savePendingInvite,
} from '@/domains/invitations/pendingInvite';

import GlobalPromptModal from '@/components/organisms/popup/GlobalPromptModal';

import { navigate } from '@/navigation/navigationService';
import { RouteNames } from '@/navigation/routeNames';

/**
 * Les raisons qui meritent une explication a l'ecran. Les autres (« ce n'est pas
 * une invitation », domaine etranger, adresse illisible) doivent rester
 * SILENCIEUSES : ce sont des liens de navigation ordinaires.
 */
const EXPLAINED_PROBLEMS = ['missing-id', 'unknown-subject'];

/**
 * @typedef {{ invite: { id: string, subject: string }, kind: 'ask' }
 *   | { kind: 'explain', reason: string }
 *   | { kind: 'ignore', reason: string }} InviteLinkOutcome
 */

/**
 * Decision PURE : que faut-il faire de cette adresse ?
 * @param {unknown} rawUrl
 * @returns {InviteLinkOutcome}
 */
export const resolveInviteLinkOutcome = (rawUrl) => {
  const result = readInviteLink(rawUrl);
  if (result.ok) return { invite: result.invite, kind: 'ask' };
  if (EXPLAINED_PROBLEMS.includes(result.reason)) {
    return { kind: 'explain', reason: result.reason };
  }
  return { kind: 'ignore', reason: result.reason };
};

/**
 * Decision PURE : ou mene une invitation ? `invite: true` reste porte par
 * l'ecran de destination, qui redemande confirmation avant d'envoyer.
 * @param {{ id?: string, subject?: string } | null} [invite]
 * @returns {{ params: Record<string, unknown>, route: string } | null}
 */
export const resolveInviteDestination = (invite) => {
  const id = String(invite?.id || '').trim();
  if (!id) return null;

  switch (invite?.subject) {
    case 'club':
      return { params: { clubId: id }, route: RouteNames.Club };
    case 'event':
      return { params: { eventId: id }, route: RouteNames.EventDetails };
    case 'squad':
      return { params: { invite: true, teamId: id }, route: RouteNames.SquadDetails };
    case 'team':
      return { params: { invite: true, teamId: id }, route: RouteNames.TeamDetails };
    default:
      return null;
  }
};

/**
 * Les mots de la fenetre, choisis par sujet.
 * @param {string} subject
 * @param {(key: string, fallback: string) => string} t
 * @returns {{ body: string, primaryLabel: string, title: string }}
 */
const describeInvite = (subject, t) => {
  if (subject === 'event') {
    return {
      body: t(
        'invitationLink.event.body',
        'Tu as reçu un lien d\'invitation pour un événement. Veux-tu l\'ouvrir ?',
      ),
      primaryLabel: t('invitationLink.event.primary', 'Voir l\'événement'),
      title: t('invitationLink.event.title', 'Invitation à un événement'),
    };
  }

  if (subject === 'club') {
    return {
      body: t(
        'invitationLink.club.body',
        'Tu as reçu une invitation à rejoindre ce club. Envoyer ta demande ?',
      ),
      primaryLabel: t('invitationLink.club.primary', 'Voir le club'),
      title: t('invitationLink.club.title', 'Invitation à rejoindre un club'),
    };
  }

  return {
    body: t(
      'invitationLink.team.body',
      'Tu as reçu une invitation à rejoindre cette équipe. Envoyer ta demande ?',
    ),
    primaryLabel: t('invitationLink.team.primary', 'Envoyer ma demande'),
    title: t('invitationLink.team.title', 'Invitation à rejoindre une équipe'),
  };
};

/**
 * L'hote unique qui lit les liens entrants et pose la question.
 * @returns {import('react').ReactElement}
 */
function InvitationLinkHost() {
  const { t } = useTranslation();
  const [pendingInvite, setPendingInvite] = useState(/** @type {any} */ (null));
  const [problem, setProblem] = useState(/** @type {string | null} */ (null));

  const handleIncomingUrl = useCallback((rawUrl) => {
    const outcome = resolveInviteLinkOutcome(rawUrl);

    if (outcome.kind === 'ask') {
      savePendingInvite(outcome.invite);
      setProblem(null);
      setPendingInvite(outcome.invite);
      return true;
    }

    if (outcome.kind === 'explain') {
      setPendingInvite(null);
      setProblem(outcome.reason);
      return true;
    }

    return false;
  }, []);

  useEffect(() => {
    let isMounted = true;

    const subscription = Linking.addEventListener('url', (event) => {
      if (!isMounted) return;
      handleIncomingUrl(event?.url);
    });

    Promise.resolve(Linking.getInitialURL())
      .then((initialUrl) => {
        if (!isMounted) return;
        if (handleIncomingUrl(initialUrl)) return;

        // Rien dans le lien d'ouverture : une invitation d'une session
        // precedente attend peut-etre encore (app fermee, compte cree entre-temps).
        const storedInvite = readPendingInvite();
        if (storedInvite) setPendingInvite(storedInvite);
      })
      .catch(() => undefined);

    return () => {
      isMounted = false;
      subscription?.remove?.();
    };
  }, [handleIncomingUrl]);

  const handleDismiss = useCallback(() => {
    // « Plus tard » : on GARDE l'invitation rangee, elle sera reproposee.
    setPendingInvite(null);
    setProblem(null);
  }, []);

  const handleAccept = useCallback(() => {
    const destination = resolveInviteDestination(pendingInvite);
    setPendingInvite(null);
    setProblem(null);
    if (!destination) return;

    clearPendingInvite();
    navigate(destination.route, destination.params);
  }, [pendingInvite]);

  if (problem) {
    return (
      <GlobalPromptModal
        body={t(
          'invitationLink.invalid.body',
          'Ce lien d\'invitation est incomplet ou périmé. Demande-en un nouveau.',
        )}
        onRequestClose={handleDismiss}
        primaryAction={{
          label: t('invitationLink.invalid.primary', 'J\'ai compris'),
          onPress: handleDismiss,
        }}
        title={t('invitationLink.invalid.title', 'Lien d\'invitation invalide')}
        visible
      />
    );
  }

  const copy = describeInvite(String(pendingInvite?.subject || 'team'), t);

  return (
    <GlobalPromptModal
      body={copy.body}
      eyebrow={t('invitationLink.eyebrow', 'Invitation')}
      onRequestClose={handleDismiss}
      primaryAction={{
        label: copy.primaryLabel,
        onPress: handleAccept,
      }}
      secondaryAction={{
        label: t('invitationLink.later', 'Plus tard'),
        onPress: handleDismiss,
      }}
      title={copy.title}
      visible={Boolean(pendingInvite)}
    />
  );
}

export default InvitationLinkHost;
