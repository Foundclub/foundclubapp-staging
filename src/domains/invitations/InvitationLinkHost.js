/**
 * InvitationLinkHost.js — LA fenetre d'invitation, et le seul endroit qui la montre.
 *
 * Un seul hote pour TOUS les sujets (equipe, evenement, squad, club) : c'est ce
 * qui empeche deux systemes d'invitation de diverger (PROMPT_Y03, etape 2).
 *
 * 🔒 Regle non negociable : lire un lien ne fait RIEN. L'hote pose la question,
 * range l'invitation pour plus tard, et n'agit que si la personne a appuye.
 *
 * INVIT2 (15/09) — quand le lien d'equipe porte un CODE (`?c=`) :
 *   - la fenetre dit QUI invite et QUELLE equipe (apercu serveur, public) ;
 *   - connecte, la personne visee repond EN UN GESTE (Accepter / Refuser) ; un
 *     lien transfere propose de DEMANDER (decision Q1 = C d'Adel) ;
 *   - deconnecte, l'invitation n'est PLUS effacee avant la connexion : elle est
 *     reproposee des que le compte est la (lot I7 de l'audit du 26/08).
 * Sans code (liens deja envoyes), le comportement d'avant est garde tel quel.
 *
 * Monte une seule fois, au-dessus des navigateurs (voir src/App.js), pour que le
 * lien soit lu qu'on soit connecte ou non.
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Linking } from 'react-native';

import { readInviteLink } from '@/domains/invitations/inviteLink';
import {
  clearPendingInvite,
  readPendingInvite,
  savePendingInvite,
} from '@/domains/invitations/pendingInvite';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

import GlobalPromptModal from '@/components/organisms/popup/GlobalPromptModal';

import { imbriquerDepuisLaRacine } from '@/navigation/hotesDepuisLaRacine';
import { navigate, navigationRef } from '@/navigation/navigationService';
import { RouteNames } from '@/navigation/routeNames';

import { claimTeamInvite, getTeamInvitePreview } from '@/services/teamInvite/teamInviteService';
import {
  acceptTeamInvitation,
  createTeamMembershipRequest,
  refuseTeamInvitation,
} from '@/services/teamMembershipRequest/teamMembershipRequestService';

/**
 * Les raisons qui meritent une explication a l'ecran. Les autres (« ce n'est pas
 * une invitation », domaine etranger, adresse illisible) doivent rester
 * SILENCIEUSES : ce sont des liens de navigation ordinaires.
 */
const EXPLAINED_PROBLEMS = ['missing-id', 'unknown-subject'];

/**
 * @typedef {{ invite: { code?: string, id: string, subject: string }, kind: 'ask' }
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
 * INVIT2 — Decision PURE : ce que dit la fenetre d'un lien d'equipe AVEC code.
 * @param {object} params - ce qu'on sait.
 * @param {any} [params.decision] - la reponse de `claim` (connecte).
 * @param {boolean} params.isSignedIn - la personne est-elle connectee ?
 * @param {any} [params.preview] - l'apercu public (equipe, club, invitant).
 * @param {(key: string, fallback: string, values?: object) => string} params.t - la traduction.
 * @returns {{ body: string, primary: string, secondary: string, title: string }} la fenetre.
 */
export const describeCodedTeamInvite = ({
  decision, isSignedIn, preview, t,
}) => {
  const teamName = String(preview?.team?.name || '').trim();
  const clubName = String(preview?.club?.name || '').trim();
  const inviterName = String(preview?.inviterName || '').trim();
  const team = clubName
    ? t('invitationLink.coded.teamWithClub', '{{team}} ({{club}})', {
      ...SANS_ECHAPPEMENT, club: clubName, team: teamName,
    })
    : teamName;

  let intro;
  if (!teamName) {
    intro = t(
      'invitationLink.team.body',
      'Tu as reçu une invitation à rejoindre cette équipe. Envoyer ta demande ?',
    );
  } else if (inviterName) {
    intro = t(
      'invitationLink.coded.introFrom',
      '{{inviter}} t\'invite à rejoindre l\'équipe {{team}}.',
      { ...SANS_ECHAPPEMENT, inviter: inviterName, team },
    );
  } else {
    intro = t(
      'invitationLink.coded.intro',
      'Tu es invité·e à rejoindre l\'équipe {{team}}.',
      { ...SANS_ECHAPPEMENT, team },
    );
  }
  const title = teamName
    ? t('invitationLink.coded.title', 'Rejoindre {{team}}', { ...SANS_ECHAPPEMENT, team: teamName })
    : t('invitationLink.team.title', 'Invitation à rejoindre une équipe');
  const expired = preview?.status === 'expired'
    || preview?.status === 'closed'
    || decision?.expired === true;

  if (!isSignedIn) {
    return {
      body: `${intro} ${t(
        'invitationLink.coded.signIn',
        'Connecte-toi ou crée ton compte : l\'invitation t\'attendra.',
      )}`,
      primary: t('invitationLink.coded.continue', 'Continuer'),
      secondary: t('invitationLink.later', 'Plus tard'),
      title,
    };
  }

  switch (decision?.mode) {
    case 'answer':
      return {
        body: intro,
        primary: t('invitationLink.coded.accept', 'Accepter'),
        secondary: t('invitationLink.coded.refuse', 'Refuser'),
        title,
      };
    case 'member':
      return {
        body: t('invitationLink.coded.member', 'Tu fais déjà partie de cette équipe.'),
        primary: t('invitationLink.coded.seeTeam', 'Voir l\'équipe'),
        secondary: t('invitationLink.later', 'Plus tard'),
        title,
      };
    case 'request':
      return {
        body: `${expired
          ? t('invitationLink.coded.expired', 'Cette invitation a expiré.')
          : intro} ${t(
          'invitationLink.coded.requestHint',
          'Tu peux demander à rejoindre l\'équipe : son staff validera.',
        )}`,
        primary: t('invitationLink.coded.request', 'Demander à rejoindre'),
        secondary: t('invitationLink.later', 'Plus tard'),
        title,
      };
    case 'requested':
      return {
        body: t(
          'invitationLink.coded.requested',
          'Ta demande pour rejoindre cette équipe est déjà envoyée.',
        ),
        primary: t('invitationLink.coded.seeTeam', 'Voir l\'équipe'),
        secondary: t('invitationLink.later', 'Plus tard'),
        title,
      };
    default:
      // La decision n'est pas (encore) la : on garde le chemin d'avant.
      return {
        body: intro,
        primary: t('invitationLink.coded.seeTeam', 'Voir l\'équipe'),
        secondary: t('invitationLink.later', 'Plus tard'),
        title,
      };
  }
};

/**
 * L'hote unique qui lit les liens entrants et pose la question.
 * @param {object} [props] - les proprietes.
 * @param {string} [props.userId] - le compte connecte, s'il y en a un (INVIT2).
 * @returns {import('react').ReactElement}
 */
function InvitationLinkHost({ userId } = {}) {
  const { t } = useTranslation();
  const [pendingInvite, setPendingInvite] = useState(/** @type {any} */ (null));
  const [problem, setProblem] = useState(/** @type {string | null} */ (null));
  const [teamPreview, setTeamPreview] = useState(/** @type {any} */ (null));
  const [claimDecision, setClaimDecision] = useState(/** @type {any} */ (null));
  const isSignedIn = Boolean(String(userId || '').trim());
  const codedTeamInvite = pendingInvite?.subject === 'team' && pendingInvite?.code
    ? pendingInvite
    : null;

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

  // INVIT2 / I7 — LE COMPTE VIENT D'ARRIVER : l'invitation rangee avant la
  // connexion revient. Avant, elle etait effacee au premier appui et l'hote,
  // monte hors de la navigation, ne relisait jamais le magasin.
  useEffect(() => {
    if (!isSignedIn) return;
    setPendingInvite((current) => current || readPendingInvite());
  }, [isSignedIn]);

  // INVIT2 — un lien d'equipe AVEC code : l'apercu (public) nomme l'invitant et
  // l'equipe ; connecte, `claim` dit ce que la personne peut faire.
  useEffect(() => {
    const code = String(codedTeamInvite?.code || '');
    setTeamPreview(null);
    setClaimDecision(null);
    if (!code) return undefined;

    let isCurrent = true;
    getTeamInvitePreview(code)
      .then((preview) => { if (isCurrent) setTeamPreview(preview); })
      .catch(() => undefined);
    if (isSignedIn) {
      claimTeamInvite(code)
        .then((decision) => { if (isCurrent) setClaimDecision(decision); })
        .catch(() => undefined);
    }
    return () => {
      isCurrent = false;
    };
  }, [codedTeamInvite?.code, isSignedIn]);

  const closeWindow = useCallback(() => {
    setPendingInvite(null);
    setProblem(null);
  }, []);

  const handleDismiss = useCallback(() => {
    // « Plus tard » est une REPONSE : on efface l'invitation rangee, sinon la
    // fenetre revient a chaque demarrage pendant 7 jours. Rien n'est perdu :
    // le lien reste dans le message recu, il suffit de le rouvrir.
    clearPendingInvite();
    closeWindow();
  }, [closeWindow]);

  const goTo = useCallback((/** @type {{ params: any, route: string }} */ destination) => {
    // NAVMORTE2 -- on navigue depuis la RACINE. Connecte, Club, EventDetails et TeamDetails
    // n y sont pas (ils vivent dans leur pile) : le nom nu n etait pris par personne et
    // « Voir » ne faisait rien. La racine montee dit la forme a prendre ; pas prete, on
    // garde le nom nu (navigate refuse de toute facon). Le web a sa propre reference
    // (web/src/shims/react-navigation/native.tsx:52), sans getRootState : nom nu aussi.
    const racine = navigationRef?.isReady?.() ? navigationRef.getRootState?.() : null;
    const cible = imbriquerDepuisLaRacine(destination, racine?.routeNames || []) || destination;
    navigate(cible.route || destination.route, cible.params);
  }, []);

  const handleAccept = useCallback(() => {
    const destination = resolveInviteDestination(pendingInvite);
    closeWindow();
    if (!destination) return;

    clearPendingInvite();
    goTo(destination);
  }, [closeWindow, goTo, pendingInvite]);

  const showAnswerError = useCallback(() => {
    Alert.alert(
      t('invitationLink.coded.errorTitle', 'Invitation'),
      t(
        'invitationLink.coded.errorBody',
        'Impossible de répondre à cette invitation pour le moment. Réessaie dans un instant.',
      ),
    );
  }, [t]);

  // INVIT2 — le geste principal d'un lien d'equipe AVEC code.
  const handleCodedPrimary = useCallback(async () => {
    const teamId = String(claimDecision?.teamId || codedTeamInvite?.id || '').trim();
    const teamDestination = { params: { teamId }, route: RouteNames.TeamDetails };

    if (!isSignedIn) {
      // 🔒 On NE L'EFFACE PAS : la personne va se connecter, et l'invitation doit
      // l'attendre de l'autre cote (I7).
      closeWindow();
      return;
    }

    try {
      switch (claimDecision?.mode) {
        case 'answer':
          await acceptTeamInvitation(claimDecision.requestId);
          break;
        case 'member':
        case 'requested':
          break;
        case 'request':
          await createTeamMembershipRequest({ team: teamId });
          break;
        default:
          // INVIT2R (2026-09-16) — LA DECISION N EST PAS (ENCORE) LA.
          //
          // Mesure en production : le POST claim a mis 17,6 SECONDES. Pendant
          // ce temps, ce repli appelait `handleAccept()`, qui navigue avec
          // `invite: true` — et TeamDetails ouvre alors l alerte « Demander a
          // rejoindre » PAR-DESSUS une invitation nominative encore en attente.
          // Resultat chez Adel : deux demandes creees a 92 ms d ecart, et son
          // invitation (team_invites id 2) toujours pas acceptee.
          //
          // Un lien QUI PORTE UN CODE annonce justement qu une invitation
          // nominative existe peut-etre : seul `claim` peut le dire. Tant qu il
          // n a pas parle, on ouvre la fiche et on n envoie RIEN. L invitation
          // rangee n est PAS effacee : la personne pourra y repondre au prochain
          // essai (« Plus tard » reste le geste qui l efface pour de bon).
          closeWindow();
          goTo(teamDestination);
          return;
      }
    } catch (_error) {
      showAnswerError();
      return;
    }
    clearPendingInvite();
    closeWindow();
    goTo(teamDestination);
  }, [
    claimDecision,
    closeWindow,
    codedTeamInvite?.id,
    goTo,
    isSignedIn,
    showAnswerError,
  ]);

  const handleCodedSecondary = useCallback(async () => {
    if (isSignedIn && claimDecision?.mode === 'answer') {
      try {
        await refuseTeamInvitation(claimDecision.requestId);
      } catch (_error) {
        showAnswerError();
        return;
      }
    }
    handleDismiss();
  }, [claimDecision, handleDismiss, isSignedIn, showAnswerError]);

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

  if (codedTeamInvite) {
    const coded = describeCodedTeamInvite({
      decision: claimDecision, isSignedIn, preview: teamPreview, t,
    });
    return (
      <GlobalPromptModal
        body={coded.body}
        eyebrow={t('invitationLink.eyebrow', 'Invitation')}
        onRequestClose={closeWindow}
        primaryAction={{ label: coded.primary, onPress: handleCodedPrimary }}
        secondaryAction={{ label: coded.secondary, onPress: handleCodedSecondary }}
        title={coded.title}
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
