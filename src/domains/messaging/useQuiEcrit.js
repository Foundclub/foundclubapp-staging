import { useEffect, useState } from 'react';

import { EVENTS } from '@/hooks/useSocket';

/** Sans nouvelle d une personne pendant ce delai, son « … écrit » s eteint (regle du telephone). */
export const DELAI_D_EXTINCTION_MS = 6000;

/**
 * MSG1W (07/10) — QUI ECRIT EN CE MOMENT DANS CE FIL (« Bruno écrit… »).
 *
 * Le site ENVOYAIT deja ses signaux de frappe (`sendTypingStart` / `sendTypingStop`) mais n en
 * affichait aucun : chez lui, personne n ecrivait jamais. Ce crochet porte la regle du telephone
 * (`Conversation.js`, MSGLIVE, « LA MINUTERIE D EXTINCTION »), telle quelle :
 *   · un signal de l autre allume son nom et (re)arme une minuterie de 6 s ;
 *   · « typing-stop » l eteint ; sans nouvelle de lui pendant 6 s, il s eteint aussi (il a pu
 *     poser son telephone, perdre le reseau ou tuer l app : aucun « stop » ne partira jamais) ;
 *   · mes propres signaux et ceux d un autre fil sont ignores.
 * ponytail: la regle existe encore EN LIGNE dans `Conversation.js` (lot MESSAGERIE-1A) ; sortie :
 * que le telephone se branche ici, une regle pour deux ecrans.
 * @param {{ chatId: string, moi?: string, socket?: any, actif?: boolean }} options - Le fil,
 *   mon identifiant, la socket de la messagerie, et l interrupteur.
 * @returns {string[]} Les identifiants des personnes qui ecrivent, dans l ordre d arrivee.
 */
const useQuiEcrit = ({
  actif = true, chatId, moi = '', socket,
}) => {
  const [quiEcrit, setQuiEcrit] = useState(/** @type {string[]} */ ([]));

  useEffect(() => {
    if (!actif || !socket || typeof socket.on !== 'function' || !chatId) return undefined;

    /** Une minuterie par personne en train d ecrire. @type {Map<string, any>} */
    const minuteries = new Map();
    const desarmer = (/** @type {string} */ personne) => {
      const minuterie = minuteries.get(personne);
      if (minuterie) clearTimeout(minuterie);
      minuteries.delete(personne);
    };
    const retirer = (/** @type {string} */ personne) => setQuiEcrit((avant) => (
      avant.includes(personne) ? avant.filter((id) => id !== personne) : avant
    ));

    const surDebut = (/** @type {{ chatDocumentId?: string, userDocumentId?: string }} */ {
      chatDocumentId, userDocumentId,
    } = {}) => {
      if (chatDocumentId !== chatId) return;
      if (!userDocumentId || userDocumentId === moi) return;
      desarmer(userDocumentId);
      minuteries.set(userDocumentId, setTimeout(() => {
        minuteries.delete(userDocumentId);
        retirer(userDocumentId);
      }, DELAI_D_EXTINCTION_MS));
      // L autre re-signale sa frappe chaque seconde : sans ce garde, chaque signal
      // redessinerait tout l ecran pour afficher la meme chose.
      setQuiEcrit((avant) => (avant.includes(userDocumentId) ? avant : [...avant, userDocumentId]));
    };

    const surFin = (/** @type {{ chatDocumentId?: string, userDocumentId?: string }} */ {
      chatDocumentId, userDocumentId,
    } = {}) => {
      if (chatDocumentId !== chatId) return;
      if (userDocumentId) {
        desarmer(userDocumentId);
        retirer(userDocumentId);
        return;
      }
      minuteries.forEach((minuterie) => clearTimeout(minuterie));
      minuteries.clear();
      setQuiEcrit((avant) => (avant.length ? [] : avant));
    };

    socket.on(EVENTS.TYPING_STARTED, surDebut);
    socket.on(EVENTS.TYPING_STOPPED, surFin);
    return () => {
      socket.off?.(EVENTS.TYPING_STARTED, surDebut);
      socket.off?.(EVENTS.TYPING_STOPPED, surFin);
      // Une minuterie qui survit a l ecran rallumerait un etat demonte.
      minuteries.forEach((minuterie) => clearTimeout(minuterie));
      minuteries.clear();
      setQuiEcrit([]);
    };
  }, [actif, chatId, moi, socket]);

  return quiEcrit;
};

export default useQuiEcrit;
