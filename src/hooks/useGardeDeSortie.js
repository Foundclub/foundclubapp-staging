import { useCallback, useEffect, useRef } from 'react';
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
 *   enregistrer?: () => Promise<boolean>,
 *   retenir?: () => ({ message: string, titre: string } | null),
 *   textes: {
 *     enregistrer?: string, message: string, quitter: string, rester: string, titre: string,
 *   },
 * }} options - `actif` : la saisie est modifiée ; `retenir`, lu au moment du Retour : une
 *   sortie IMPOSSIBLE (un envoi en cours), dite sans proposer de quitter.
 *   `enregistrer` (PETITSCHOIX/16, détection) : la question devient « Non / Oui » — `quitter`
 *   (Non) sort sans enregistrer, `textes.enregistrer` (Oui) enregistre puis sort, et reste si
 *   l'enregistrement rend `false`. Changer d'onglet pose alors la même question.
 * @returns {import('react').MutableRefObject<boolean>} `sortieLibre` : à passer à `true` juste
 *   avant une sortie voulue (envoi réussi), qui ne redemande alors pas.
 */
export default function useGardeDeSortie(navigation, {
  actif, enregistrer, retenir, textes,
}) {
  const sortieLibre = useRef(false);
  const {
    enregistrer: oui, message, quitter, rester, titre,
  } = textes;

  // La question, puis la sortie (`sortir`) si la réponse la permet.
  const demander = useCallback((/** @type {() => void} */ sortir) => {
    const partir = () => {
      sortieLibre.current = true;
      sortir();
    };
    if (enregistrer) {
      // Sur le site, `confirm` : OK = le bouton préféré (Oui), Annuler = `cancel` (Non).
      Alert.alert(titre, message, [
        { onPress: partir, style: 'cancel', text: quitter },
        {
          isPreferred: true,
          onPress: async () => {
            if (await enregistrer()) partir();
          },
          text: oui,
        },
      ]);
      return;
    }
    Alert.alert(titre, message, [
      { style: 'cancel', text: rester },
      { onPress: partir, style: 'destructive', text: quitter },
    ]);
  }, [enregistrer, message, oui, quitter, rester, titre]);

  useEffect(() => navigation?.addListener?.('beforeRemove', (/** @type {any} */ evenement) => {
    const impossible = retenir?.();
    if (impossible) {
      evenement.preventDefault();
      Alert.alert(impossible.titre, impossible.message);
      return;
    }
    if (!actif || sortieLibre.current) return;
    evenement.preventDefault();
    demander(() => navigation.dispatch?.(evenement.data.action));
  }), [actif, demander, navigation, retenir]);

  // PETITSCHOIX/16 — un autre onglet ne retire pas l'écran de sa pile, mais le coach le quitte :
  // même question. Seulement en mode « enregistrer », et seulement pour l'écran au premier plan.
  useEffect(() => {
    if (!enregistrer) return undefined;
    let onglets = navigation?.getParent?.();
    while (onglets && onglets.getState?.()?.type !== 'tab') onglets = onglets.getParent?.();
    return onglets?.addListener?.('tabPress', (/** @type {any} */ evenement) => {
      if (!actif || sortieLibre.current || !navigation.isFocused?.()) return;
      const cible = onglets.getState().routes
        .find((/** @type {any} */ r) => r.key === evenement.target);
      if (!cible) return;
      evenement.preventDefault();
      demander(() => {
        onglets.navigate(cible.name);
        // L'écran reste dans sa pile : la prochaine sortie redemande.
        sortieLibre.current = false;
      });
    });
  }, [actif, demander, enregistrer, navigation]);

  return sortieLibre;
}
