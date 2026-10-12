import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { getPollVoters } from '@/domains/messaging/pollUseCases';

import { getPollVoterProfiles } from '@/services/chat/chatService';

/**
 * SONDAGE-NOMS (07/10) — LES NOMS DES VOTANTS D'UN SONDAGE, LUS AU SERVEUR.
 *
 * Un vote ne garde que l'IDENTIFIANT du votant. Les écrans retrouvaient les noms dans
 * `participants` et dans les auteurs des messages chargés — or un fil de club, d'équipe ou
 * multisport a `participants: []`. Un membre qui votait sans écrire s'affichait « Membre ».
 *
 * 🧱 C'est la COUCHE DONNÉES : les trois endroits qui nomment des votants (détail mobile,
 * détail du site, bulle du fil) l'appellent tels quels. Un redessin de la messagerie garde ce
 * crochet et n'a qu'à rappeler `usePollVoterProfiles(messageId, poll)`.
 *
 * 🔑 La clef porte la LISTE des votants : un vote de plus relit les noms. Les noms déjà lus
 * restent affichés pendant la relecture (`keepPreviousData`) : pas de retour à « Membre ».
 *
 * 🪦 Un votant dont le compte est SUPPRIMÉ arrive signalé (`deleted: true`, aucun nom) : il
 * est rendu ici sous le nom « Compte supprimé » (décision d'Adel, 07/10), pour que les trois
 * endroits le disent sans rien changer à leur dessin. Un votant que le serveur ne cite pas
 * (parti du fil) n'est pas dans la table : chaque écran garde son repli « Membre ».
 */

const POLL_VOTERS_STALE_MS = 60 * 1000;

/**
 * Les votants à nommer : tous, sans doublon, dans un ordre stable ; aucun si le sondage est
 * anonyme (le serveur n'en nommerait pas non plus).
 * @param {any} poll La composition du sondage.
 * @returns {string[]} Les identifiants.
 */
export const listPollVoterIdsToName = (poll) => {
  if (!poll || poll.type !== 'poll' || poll.isAnonymous) return [];
  const ids = new Set();
  (Array.isArray(poll.options) ? poll.options : []).forEach((/** @type {any} */ option) => {
    getPollVoters(option).forEach((voterId) => ids.add(voterId));
  });
  return [...ids].sort();
};

/**
 * Le nom affichable d'un votant lu au serveur : « Prénom Nom », ou '' s'il n'en a pas (compte
 * effacé). Le repli (« Membre ») reste à l'appelant.
 * @param {any} profile Le votant.
 * @returns {string} Le nom.
 */
export const nameOfPollVoter = (profile) => (
  `${String(profile?.firstname || '').trim()} ${String(profile?.lastname || '').trim()}`.trim()
);

/**
 * Les votants d'un sondage nommés par le serveur, par identifiant (vide pour un sondage
 * anonyme, un message pas encore enregistré, ou tant que la lecture n'a pas abouti).
 * @param {string | number | null | undefined} messageId Le message du sondage.
 * @param {any} poll La composition du sondage.
 * @returns {Map<string, { avatar: { url: string } | null; deleted?: boolean; documentId: string;
 *   firstname: string; lastname: string }>} Les votants nommés, par identifiant.
 */
export default function usePollVoterProfiles(messageId, poll) {
  const { t } = useTranslation();
  const safeMessageId = String(messageId || '').trim();
  const voterIds = listPollVoterIdsToName(poll);

  const { data } = useQuery({
    // Un message pas encore enregistré (`temp-…`) n'existe pas au serveur.
    enabled: Boolean(safeMessageId) && !safeMessageId.startsWith('temp-') && voterIds.length > 0,
    placeholderData: keepPreviousData,
    queryFn: () => getPollVoterProfiles(safeMessageId),
    queryKey: ['chat-poll-voters', safeMessageId, voterIds.join(',')],
    staleTime: POLL_VOTERS_STALE_MS,
  });

  return useMemo(() => {
    const profiles = new Map();
    const voters = data?.data;
    (Array.isArray(voters) ? voters : []).forEach((profile) => {
      const voterId = String(profile?.documentId || '').trim();
      if (!voterId) return;
      profiles.set(voterId, profile?.deleted
        ? {
          ...profile,
          firstname: t('conversation.poll.common.deletedAccount', 'Compte supprimé'),
          lastname: '',
        }
        : profile);
    });
    return profiles;
  }, [data, t]);
}
