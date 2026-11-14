import { useEffect, useState } from 'react';

import { communautesActives } from '@/domains/messaging/communautes';

import { getMesCommunautes } from '@/services/chat/communauteService';

/**
 * COMMUNAUTES-L4 (14/11/2026) — « ma communauté » (`GET /communautes/mine`), relue à chaque retour
 * sur l'écran. Un serveur d'avant le socle (404), une erreur : null, et la messagerie reste celle
 * d'aujourd'hui. Sorti de `BoutonCommunautes` (L2) pour servir aussi la ligne de la communauté.
 * @param {any} navigation - Pour relire au retour (`focus`).
 * @param {boolean} [actif] - Faux : aucun appel (l'écran a déjà lu `mine`).
 * K8 : interrupteur FC_COMMUNAUTES_V1 éteint ⇒ aucun appel, null (la messagerie du train 10).
 * @returns {any[] | null} Mes communautés, ou null.
 */
export default function useMesCommunautes(navigation, actif = true) {
  const [communautes, setCommunautes] = useState(/** @type {any[] | null} */ (null));
  const allume = actif && communautesActives();

  useEffect(() => {
    if (!allume) return undefined;
    let vivant = true;
    const charger = () => getMesCommunautes()
      .then((liste) => {
        if (vivant) setCommunautes(liste);
      })
      .catch(() => {
        if (vivant) setCommunautes(null);
      });
    charger();
    const desabonner = navigation?.addListener?.('focus', charger);
    return () => {
      vivant = false;
      if (typeof desabonner === 'function') desabonner();
    };
  }, [allume, navigation]);

  return communautes;
}
