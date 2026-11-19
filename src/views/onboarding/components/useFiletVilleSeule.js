import { useEffect } from 'react';
import { Platform } from 'react-native';

import { aUneDemandeDeGestion } from '@/domains/collectivite/collectiviteAccueil';

import { RouteNames } from '@/navigation/routeNames';

import {
  useMyCollectivites,
  useMyManagerRequests,
} from '@/services/collectivite/collectiviteQueries';

/**
 * 🏛️ COLL-ACCUEIL (01/10) — SUR LE SITE, un compte « Ville seule » (aucun rôle sportif) qui gère
 * une Ville, ou qui a déjà demandé à en gérer une, ne refait pas l'inscription : l'accueil de sa
 * Ville, ou l'écran de sa demande. Sur téléphone, la pile racine (PrivateNavigator) l'y emmène
 * déjà au démarrage ; ici, c'est le filet du site, dont le parcours vient de getOnboardingViews.
 * INSCRIPTION-CODE-3 (19/11) : sorti de UserRole pour servir aussi au premier écran (UserSport),
 * par lequel l'inscription commence désormais. Les deux écrans le gardent.
 * @param {any} navigation La navigation de l'écran.
 * @param {any} userData Le compte.
 * @returns {void}
 */
export default function useFiletVilleSeule(navigation, userData) {
  const sansRoleSportif = Platform.OS === 'web' && userData?.role?.type === 'authenticated';
  const villes = useMyCollectivites({ enabled: sansRoleSportif });
  const demandesDeGestion = useMyManagerRequests({ enabled: sansRoleSportif });
  const villeGeree = Array.isArray(villes.data) ? villes.data[0] : null;
  // REPRISE-102BIS (02/11) : une demande annulée ne compte plus, comme sur l'accueil du site et
  // au téléphone ; sinon « Choisir mon statut », après l'annulation, ramenait à la demande.
  const aDemande = aUneDemandeDeGestion(demandesDeGestion.data);
  useEffect(() => {
    if (!sansRoleSportif) return;
    if (villeGeree?.documentId) {
      navigation.reset({
        index: 0,
        routes: [{
          name: RouteNames.CollectiviteHome,
          params: { collectiviteId: villeGeree.documentId },
        }],
      });
    } else if (aDemande) {
      navigation.reset({ index: 0, routes: [{ name: RouteNames.CollectiviteSignupStatus }] });
    }
  }, [aDemande, navigation, sansRoleSportif, villeGeree?.documentId]);
}
