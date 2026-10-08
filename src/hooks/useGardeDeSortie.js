import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';

/**
 * 🚪 SAIS (08/10, tournée T20 lot 2) — LA GARDE « QUITTER SANS ENREGISTRER ? », sortie telle
 * quelle de « Demander un créneau » (VILLE-T18C, ClubSlotRequest) pour servir aussi « Fermer une
 * installation » et « Bloquer un créneau » : un Retour sur une saisie modifiée demande avant de la
 * perdre ; « Quitter » rejoue la sortie sans redemander.
 * ponytail: sur le site, le « retour » du NAVIGATEUR ne passe pas par `beforeRemove` (même
 * limite qu'AdminCollectiviteForm) ; la flèche de l'écran, si.
 * @param {any} navigation - La navigation de l'écran ; `null` : aucune garde (panneau
 *   d'ordinateur).
 * @param {{
 *   actif: boolean,
 *   retenir?: () => ({ message: string, titre: string } | null),
 *   textes: { message: string, quitter: string, rester: string, titre: string },
 * }} options - `actif` : la saisie est modifiée ; `retenir`, lu au moment du Retour : une
 *   sortie IMPOSSIBLE (un envoi en cours), dite sans proposer de quitter.
 * @returns {import('react').MutableRefObject<boolean>} `sortieLibre` : à passer à `true` juste
 *   avant une sortie voulue (envoi réussi), qui ne redemande alors pas.
 */
export default function useGardeDeSortie(navigation, { actif, retenir, textes }) {
  const sortieLibre = useRef(false);
  const {
    message, quitter, rester, titre,
  } = textes;
  useEffect(() => navigation?.addListener?.('beforeRemove', (/** @type {any} */ evenement) => {
    const impossible = retenir?.();
    if (impossible) {
      evenement.preventDefault();
      Alert.alert(impossible.titre, impossible.message);
      return;
    }
    if (!actif || sortieLibre.current) return;
    evenement.preventDefault();
    Alert.alert(titre, message, [
      { style: 'cancel', text: rester },
      {
        onPress: () => {
          sortieLibre.current = true;
          navigation.dispatch?.(evenement.data.action);
        },
        style: 'destructive',
        text: quitter,
      },
    ]);
  }), [actif, message, navigation, quitter, rester, retenir, titre]);
  return sortieLibre;
}
