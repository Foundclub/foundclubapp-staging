import { useEffect } from 'react';

import { retourAuLienEnAttente } from '@/domains/collectivite/lienDeLaVille';
import { oublierLInscriptionAuTournoi } from '@/domains/tournoi/inscriptionEnCours';

import { imbriquerDepuisLaRacine } from '@/navigation/hotesDepuisLaRacine';
import { envoyerLeLienEnAttente } from '@/navigation/lienDeLancement';
import { navigate, navigationRef } from '@/navigation/navigationService';
import { prendreLeRetourAuTournoi } from '@/navigation/retourAuTournoi';
import { RouteNames } from '@/navigation/routeNames';

const ESSAIS = 6;
const PAUSE_MS = 250;

/**
 * 🔗 LIENS-APP (07/10/2026) — LES LIENS QUI ATTENDENT QUE LE COMPTE SOIT PRÊT. Appelé par
 * PrivateNavigator, une fois le compte chargé ET l'accueil fait (un compte neuf passe d'abord le
 * contrôle d'âge). Deux liens peuvent attendre :
 * 1. le lien qui a LANCÉ l'app, compte déjà connecté (lienDeLancement.js) : il part à l'écoute
 *    ordinaire des liens de React Navigation, qui empile son écran — le Retour existe ;
 * 2. sinon, le lien de la Ville ouvert SANS compte (lienDeLaVille.js, repère posé par sa page
 *    avant la connexion) : la page du lien se rouvre ; ouverte avec un compte, elle efface le
 *    repère (on n'y revient qu'une fois).
 * 3. T-PARCOURS-2 (17/11, R12) : le tournoi dont le visiteur a touché « Se connecter pour
 *    s'inscrire » (retourAuTournoi.js) : sa fiche se rouvre, une seule fois. Le lien qui a lancé
 *    l'app passe devant, et le repère est alors jeté (jamais rejoué plus tard).
 * Même attente que l'invitation League en attente (PrivateNavigator) : la pile peut ne pas être
 * prête au premier essai.
 * Témoins : src/navigation/__tests__/LIENSAPP.lienDeLancementUneFois.test.js,
 * src/navigation/__tests__/LIENSAPP.retourApresConnexion.test.js.
 * @param {boolean} pret - Le compte est chargé et aucune étape d'accueil n'attend.
 * @returns {void}
 */
const useLiensEnAttente = (pret) => {
  useEffect(() => {
    if (!pret) return undefined;

    let essais = 0;
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let minuterie;
    const reprendre = () => {
      essais += 1;
      if (!navigationRef.isReady()) {
        if (essais < ESSAIS) minuterie = setTimeout(reprendre, PAUSE_MS);
        return;
      }
      const tournoi = prendreLeRetourAuTournoi();
      // T-PAGES-6b (18/11) : le tunnel est fini, son rappel du tournoi n'a plus d'objet.
      oublierLInscriptionAuTournoi();
      if (envoyerLeLienEnAttente()) return;
      const fiche = tournoi ? imbriquerDepuisLaRacine({
        params: { eventId: tournoi }, route: RouteNames.EventDetails,
      }) : null;
      if (fiche?.route) {
        navigate(fiche.route, fiche.params);
        return;
      }

      const token = retourAuLienEnAttente();
      if (!token || navigationRef.getCurrentRoute()?.name === RouteNames.CollectiviteJoin) return;
      navigate(RouteNames.CollectiviteJoin, { token });
    };

    minuterie = setTimeout(reprendre, PAUSE_MS);
    return () => {
      if (minuterie) clearTimeout(minuterie);
    };
  }, [pret]);
};

export default useLiensEnAttente;
