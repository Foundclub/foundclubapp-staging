import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { mesEnfantsEnBref } from '@/views/profile/parent/mesEnfantsEnBref';

import {
  useGetMyClubInterestRequests,
} from '@/services/clubInterestRequest/clubInterestRequestQueries';
import { useGetMyDeclaredChildren } from '@/services/declaredChild/declaredChildQueries';
import { useParentLinksAsParent } from '@/services/parentLink/parentLinkQueries';

/**
 * PAR-L7 (13/10) — MES ENFANTS EN BREF, pour l'accueil, « Mon compte » et « Mon profil ».
 *
 * Trois lectures, celles de « Mes enfants » et avec SES clés (l'écran s'ouvre donc déjà rempli) :
 * les fiches, les comptes reliés, et — seulement s'il y a une fiche — les demandes de place.
 * Aucune ne bloque : tant qu'elles n'ont pas répondu, ou si elles échouent, il n'y a « aucun
 * enfant » à dire, et l'écran garde ses mots d'avant (design E01 : « la carte ne doit jamais
 * bloquer l'accueil »).
 * @param {{ actif: boolean }} options - `actif` : le compte peut avoir des enfants
 *   (`peutAvoirDesEnfants`) et l'écran en a besoin. Éteint, rien ne part.
 * @returns {ReturnType<typeof mesEnfantsEnBref> & { connu: boolean }} - Les lignes, le reste,
 *   le total, le résumé ; `connu` (REC17-001-B) : les lectures ont toutes répondu — avant, la
 *   carte d'accueil ne dit ni nombre ni pastille (jamais « Ajoute ton enfant » à tort).
 */
export default function useMesEnfantsEnBref({ actif }) {
  const { t } = useTranslation();
  // Ces deux crochets se déclarent `@returns {object}` : leur `data` se lit comme ailleurs.
  const { data: fiches } = /** @type {any} */ (useGetMyDeclaredChildren({ enabled: actif }));
  const { data: liens } = /** @type {any} */ (useParentLinksAsParent({ enabled: actif }));
  const aDesFiches = Array.isArray(fiches) && fiches.length > 0;
  const { data: demandes } = useGetMyClubInterestRequests(
    { includeChildRequests: true, includeHistory: true },
    { enabled: actif && aDesFiches },
  );
  const connu = actif && fiches !== undefined && liens !== undefined
    && (!aDesFiches || demandes !== undefined);

  return useMemo(() => (actif
    ? {
      ...mesEnfantsEnBref({
        comptesRelies: liens?.children,
        demandes: demandes?.data,
        fiches,
        t,
      }),
      connu,
    }
    : {
      connu: false,
      lignes: [],
      reste: 0,
      resume: {
        comptes: 0, demandesEnAttente: 0, enEquipe: 0, sansEquipe: 0,
      },
      total: 0,
    }), [actif, connu, demandes?.data, fiches, liens?.children, t]);
}
