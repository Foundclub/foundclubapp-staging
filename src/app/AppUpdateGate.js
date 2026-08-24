import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import AppUpdateRecommendedSheet from '@/views/appUpdate/AppUpdateRecommendedSheet';
import AppUpdateRequiredScreen from '@/views/appUpdate/AppUpdateRequiredScreen';

import { useAppUpdateGate } from '@/services/appUpdate/appUpdateGateQueries';
import {
  isBlockedByUpdateGate,
  isRecommendedByUpdateGate,
  resolveUpdateContactUrl,
  resolveUpdateRecommendedVersion,
  resolveUpdateReleaseNotes,
  resolveUpdateStoreUrl,
} from '@/services/appUpdate/appUpdateGateRules';

import { isReturnToForeground } from '@/app/queryRefreshOnReturn';
import device from '@/platform/device';

/**
 * S09 — la porte « mise a jour obligatoire ». R3 lui ajoute l'etage doux.
 *
 * 🔓 SON COMPORTEMENT PAR DEFAUT EST DE LAISSER PASSER, ET C'EST LE POINT LE
 * PLUS IMPORTANT DU LOT. Pendant le chargement, en cas d'erreur reseau, sur une
 * reponse illisible, sur un verdict absent ou incompris : elle rend ses enfants.
 * Le blocage ne se declenche que sur `blocked === true`, un booleen, envoye
 * explicitement par le serveur.
 *
 * 🚪 QUAND ELLE BLOQUE, elle ne rend PAS ses enfants du tout — l'arbre de
 * navigation n'est jamais monte. Il n'y a donc rien a depiler : ni le bouton
 * retour du telephone, ni un geste de retour arriere ne peuvent reveler l'app.
 *
 * 🟠 QUAND ELLE RECOMMANDE (R3), elle rend ses enfants NORMALEMENT et pose une
 * feuille par-dessus. L'app reste entierement utilisable ; « Plus tard » la
 * referme.
 * @param {object} props
 * @param {import('react').ReactNode} props.children
 * @returns {import('react').ReactElement}
 */
function AppUpdateGate({ children }) {
  const { data, refetch } = useAppUpdateGate();
  const verdict = /** @type {Record<string, unknown>} */ (data || {});

  // ⏱️ « UNE SEULE FOIS PAR DEMARRAGE A FROID » N'A PAS BESOIN DE MEMOIRE
  // GLOBALE NI DE DISQUE : ce composant est monte par `BootGate`, a la racine,
  // et il n'est jamais demonte tant que l'app vit. Son etat DURE donc
  // exactement une session, ce qui est la definition demandee — et il
  // disparait tout seul au prochain lancement.
  //
  // 🧊 C'est aussi ce qui fait tenir la regle du pack face au rafraichissement
  // ci-dessous : revenir au premier plan relit le levier, mais ne ressuscite
  // PAS une feuille deja refusee. Un refus vaut pour toute la session.
  const [recommendationRefused, setRecommendationRefused] = useState(false);

  const refuseRecommendation = useCallback(() => setRecommendationRefused(true), []);

  // 🔄 D3 — LE LEVIER SE RELIT AU RETOUR DANS L'APP.
  //
  // Sans ceci, quelqu'un qui laisse FoundClub ouvert en arriere-plan pendant
  // des jours ne verrait JAMAIS la bascule : la requete est posee en
  // `refetchOnWindowFocus: false` et sa clef n'est pas dans la liste blanche de
  // `queryRefreshOnReturn` (volontairement — cette liste sert les familles
  // metier, pas les portes de demarrage). Un levier d'urgence qui exige un
  // redemarrage a froid pour s'appliquer n'est pas un levier d'urgence.
  //
  // ♻️ `isReturnToForeground` est REPRIS de `queryRefreshOnReturn` plutot que
  // reecrit : il porte deja le piege iOS (`inactive` arrive aussi quand on
  // deroule le centre de controle — ce n'est PAS un retour).
  // ⚡ Et c'est `refetch()`, imperatif : `invalidateQueries` ne relance que les
  // requetes actives et respecte le cache, ce qui a deja fige d'autres ecrans.
  useEffect(() => {
    let previousState = AppState.currentState;

    const subscription = AppState.addEventListener('change', (nextState) => {
      const returning = isReturnToForeground(previousState, nextState);
      previousState = nextState;
      if (returning) {
        refetch();
      }
    });

    return () => subscription?.remove?.();
  }, [refetch]);

  if (isBlockedByUpdateGate(data)) {
    return (
      <AppUpdateRequiredScreen
        contactUrl={resolveUpdateContactUrl(data)}
        currentVersion={device.getAppVersion()}
        minimumVersion={String(verdict.minimumVersion || '') || null}
        releaseNotes={resolveUpdateReleaseNotes(data)}
        storeUrl={resolveUpdateStoreUrl(data)}
      />
    );
  }

  return (
    <>
      {children}
      <AppUpdateRecommendedSheet
        isVisible={isRecommendedByUpdateGate(data) && !recommendationRefused}
        onLater={refuseRecommendation}
        recommendedVersion={resolveUpdateRecommendedVersion(data)}
        storeUrl={resolveUpdateStoreUrl(data)}
      />
    </>
  );
}

export default AppUpdateGate;
