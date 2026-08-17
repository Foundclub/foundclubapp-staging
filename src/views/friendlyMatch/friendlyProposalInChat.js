import { respondToFriendlyMatchApplication } from '@/services/friendlyMatch/friendlyMatchService';

/**
 * S03 — la proposition de match amical, VUE DEPUIS LE FIL DE DISCUSSION.
 *
 * Constat d'Adel (16/08) : le message posté dans le tchat ne disait presque
 * rien, et on ne pouvait pas l'accepter. Un message qui oblige à aller chercher
 * l'information ailleurs, puis à ressortir du fil pour agir, n'est pas un
 * message : c'est une notification déguisée.
 *
 * Ce fichier ne contient QUE la reconnaissance et l'action. Le dessin, c'est
 * `ProposalMessageBubble` — la bulle de proposition qui existait déjà pour son
 * jumeau LEAGUE. On n'a pas inventé un troisième format de bulle.
 *
 * 🔒 ET SURTOUT : ce fichier NE DÉCIDE PAS qui a le droit d'accepter. Il lit la
 * liste que le SERVEUR a posée dans la bulle (`canAcceptUserIds`, calculée par
 * `friendly-match-workflow.ts` à partir de l'auteur de l'annonce et des
 * entraîneurs de son équipe). Deviner côté app afficherait un bouton auquel le
 * serveur répondrait « Accès refusé », et personne ne saurait pourquoi.
 */

/** Ce qui distingue une proposition d'amical de son jumeau LEAGUE. */
export const FRIENDLY_PROPOSAL_KIND = 'friendly_match';

/**
 * Ce que l'acceptation va produire, dit AVANT le geste. Accepter est lourd et
 * irréversible côté serveur : le match est créé et posé dans le planning des
 * deux équipes. La même phrase que l'écran de l'annonce, parce que c'est le
 * même geste — deux formulations laisseraient croire à deux gestes différents.
 */
export const FRIENDLY_ACCEPT_CONSEQUENCE = 'Le match sera créé et apparaîtra dans le planning des deux équipes.'; // eslint-disable-line max-len

/**
 * Une bulle de proposition de match AMICAL ? (par opposition à LEAGUE)
 * @param {any} composition - La charge du message.
 * @returns {boolean}
 */
export const isFriendlyProposal = (composition) => (
  composition?.type === 'proposal' && composition?.kind === FRIENDLY_PROPOSAL_KIND
);

/**
 * Cet utilisateur peut-il accepter cette proposition ?
 *
 * ⚠️ La réponse vient du serveur, pas d'un raisonnement local. Une liste
 * absente vaut NON : mieux vaut un bouton manquant qu'un bouton menteur.
 * @param {any} composition - La charge du message.
 * @param {any} userDocumentId - L'identifiant de celui qui regarde.
 * @returns {boolean}
 */
export const canAcceptFriendlyProposal = (composition, userDocumentId) => {
  const moi = String(userDocumentId || '').trim();
  if (!moi || !isFriendlyProposal(composition)) return false;
  const autorises = composition?.canAcceptUserIds;
  if (!Array.isArray(autorises)) return false;
  return autorises.some((entree) => String(entree || '').trim() === moi);
};

/**
 * Le texte de la confirmation d'acceptation, prêt pour une alerte.
 * @returns {{ body: string, title: string }}
 */
export const buildFriendlyProposalConfirmation = () => ({
  body: FRIENDLY_ACCEPT_CONSEQUENCE,
  title: 'Accepter cette proposition ?',
});

/**
 * Accepter ou refuser DEPUIS LE FIL.
 *
 * ⛔ Aucune seconde règle d'acceptation : c'est exactement l'appel que fait déjà
 * le bouton « Accepter ce match » de l'écran de l'annonce
 * (`FriendlyMatchApplicationCard`). Deux règles qui divergent sont le défaut le
 * plus cher à retrouver — ici il ne peut pas exister, il n'y a qu'un chemin.
 * @param {any} composition - La charge du message.
 * @param {'accept' | 'decline'} action - Ce qu'on répond.
 * @returns {Promise<any>}
 */
export const respondToFriendlyProposal = async (composition, action) => {
  const applicationId = String(composition?.applicationId || '').trim();
  if (!applicationId) {
    throw new Error('Impossible de retrouver la proposition de match.');
  }
  return respondToFriendlyMatchApplication(applicationId, { action });
};
