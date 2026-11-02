import { useCallback, useEffect, useRef } from 'react';
import { Alert, Platform } from 'react-native';

/**
 * 🚪 SAIS (08/10, tournée T20 lot 2) — LA GARDE « QUITTER SANS ENREGISTRER ? », sortie telle
 * quelle de « Demander un créneau » (VILLE-T18C, ClubSlotRequest) pour servir aussi « Fermer une
 * installation » et « Bloquer un créneau » : un Retour sur une saisie modifiée demande avant de la
 * perdre ; « Quitter » rejoue la sortie sans redemander.
 * REPRISE-RESA (01/11/2026, point 81) : sur le site, quitter l'écran par un lien de la page (le
 * menu) ou fermer / recharger l'onglet ne passe pas par `beforeRemove` : la garde écoute aussi la
 * page tant que la saisie est modifiée.
 * ponytail: sur le site, la flèche « retour » du NAVIGATEUR ne demande toujours pas (BrowserRouter
 * n'offre pas de blocage ; sortie : passer le site à un routeur de données et `useBlocker`).
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

  // REPRISE-RESA (81) — le site : un clic sur un lien interne de la page est retenu (capturé avant
  // le routeur), la question posée, et « Quitter » rejoue le clic ; fermer ou recharger l'onglet
  // fait demander le navigateur. Rien sans navigation (panneau d'ordinateur) ni saisie modifiée.
  useEffect(() => {
    if (Platform.OS !== 'web' || !navigation || !actif || typeof document === 'undefined') {
      return undefined;
    }
    const surClic = (/** @type {any} */ evenement) => {
      if (sortieLibre.current || evenement.defaultPrevented || evenement.button !== 0
        || evenement.metaKey || evenement.ctrlKey || evenement.shiftKey || evenement.altKey) return;
      const lien = evenement.target?.closest?.('a[href]');
      if (!lien || (lien.target && lien.target !== '_self')) return;
      const cible = new URL(lien.href, window.location.href);
      const ici = new URL(window.location.href);
      if (cible.origin !== ici.origin) return;
      if (`${cible.pathname}${cible.search}` === `${ici.pathname}${ici.search}`) return;
      evenement.preventDefault();
      evenement.stopPropagation();
      const impossible = retenir?.();
      if (impossible) {
        Alert.alert(impossible.titre, impossible.message);
        return;
      }
      demander(() => lien.click());
    };
    const surDepart = (/** @type {any} */ evenement) => {
      if (sortieLibre.current) return;
      // Chrome (depuis la 119), Firefox et Safari demandent sur `preventDefault`.
      evenement.preventDefault();
    };
    document.addEventListener('click', surClic, true);
    window.addEventListener('beforeunload', surDepart);
    return () => {
      document.removeEventListener('click', surClic, true);
      window.removeEventListener('beforeunload', surDepart);
    };
  }, [actif, demander, navigation, retenir]);

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
