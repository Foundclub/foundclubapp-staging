import { isDeletedAccount } from '@/domains/user/deletedAccount';

/** @typedef {{ documentId?: string }} PersonRef */

/**
 * ROLES2 (recette émulateur du 2026-09-28) — combien de personnes ENTRAÎNENT dans
 * ce club ?
 *
 * Le compteur « Staff » de la fiche club ne comptait que les comptes dont le rôle
 * GLOBAL est Entraîneur : un dirigeant qui entraîne les deux équipes du club
 * affichait « 0 entraîneur ». On compte désormais, sans doublon :
 *   · les comptes Entraîneur du club (ce que le compteur montrait déjà) ;
 *   · toute personne rangée dans `trainers` d'une équipe du club — la fiche club
 *     les reçoit déjà (`teams[].trainers`, borné par le serveur) ;
 * et jamais un compte supprimé.
 * @param {{ coachs?: PersonRef[], teams?: Array<{ trainers?: any[] }> }} input - Les
 *   comptes Entraîneur du club et ses équipes.
 * @returns {number} Le nombre de personnes qui entraînent.
 */
export const countClubTrainers = ({ coachs, teams }) => {
  const ids = new Set();
  (Array.isArray(coachs) ? coachs : []).forEach((coach) => {
    if (coach?.documentId) ids.add(coach.documentId);
  });
  (Array.isArray(teams) ? teams : []).forEach((team) => {
    (Array.isArray(team?.trainers) ? team.trainers : []).forEach((trainer) => {
      if (trainer?.documentId && !isDeletedAccount(trainer)) ids.add(trainer.documentId);
    });
  });
  return ids.size;
};

export default countClubTrainers;
