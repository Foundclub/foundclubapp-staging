import { useEffect } from 'react';

import { retourAuLienEnAttente } from '@/domains/collectivite/lienDeLaVille';

import { navigate, navigationRef } from '@/navigation/navigationService';
import { RouteNames } from '@/navigation/routeNames';

const ESSAIS = 6;
const PAUSE_MS = 250;

/**
 * 🏛️ LIENS-APP (07/10/2026) — REVENIR AU LIEN DE LA VILLE APRÈS LA CONNEXION. Le lien de la Ville
 * s'ouvre dans l'app ; sans compte, sa page mène à la connexion et pose un repère de retour
 * (lienDeLaVille.js). La connexion remonte toute la navigation (appNavigator.js) : une fois le
 * compte prêt, ce crochet rouvre la page du lien. Même attente que l'invitation League en
 * attente (PrivateNavigator) : la pile peut ne pas être prête au premier essai.
 * La page, ouverte avec un compte, efface le repère : on n'y revient qu'une fois.
 * Témoin : src/navigation/__tests__/LIENSAPP.retourApresConnexion.test.js.
 * @param {boolean} pret - Le compte est chargé et aucune étape d'accueil n'attend (un compte neuf
 * passe d'abord le contrôle d'âge).
 * @returns {void}
 */
const useRetourAuLienDeLaVille = (pret) => {
  useEffect(() => {
    if (!pret) return undefined;

    let essais = 0;
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let minuterie;
    const revenir = () => {
      essais += 1;
      const token = retourAuLienEnAttente();
      // Déjà sur la page (le lien de lancement, rejoué par React Navigation au remontage).
      if (!token || navigationRef.getCurrentRoute()?.name === RouteNames.CollectiviteJoin) return;
      if (!navigate(RouteNames.CollectiviteJoin, { token }) && essais < ESSAIS) {
        minuterie = setTimeout(revenir, PAUSE_MS);
      }
    };

    minuterie = setTimeout(revenir, PAUSE_MS);
    return () => {
      if (minuterie) clearTimeout(minuterie);
    };
  }, [pret]);
};

export default useRetourAuLienDeLaVille;
