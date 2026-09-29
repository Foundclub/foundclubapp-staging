import { useMemo } from 'react';

import { useGetEventTeamComposition } from '@/services/event/eventQueries';

import { buildFieldFromServerComposition, pickCompositionToEdit } from './matchCompositionUtils';

/**
 * COMPO-WEB (29/09) — SUR LE SITE, UN ECRAN DU PARCOURS ARRIVE SANS SES OBJETS
 * RELIT LA COMPOSITION SUR LE SERVEUR.
 *
 * 🔍 La cause (lot URL-BOOLEENS) : le site transporte les parametres d'un ecran
 * PAR L'ADRESSE, qui ne porte que du texte. Entre deux ecrans du parcours,
 * l'adaptateur de navigation garde desormais les objets en memoire
 * (`webNavigationAdapter.js`) ; mais arrive par un LIEN, un RECHARGEMENT ou un
 * NOUVEL ONGLET, un ecran n'a plus que `eventId` / `teamId`. Il relit alors
 * `GET /events/:id/composition`, qui rend deja `draft`, `published`,
 * `eligiblePlayers` et `bootstrap` — la SEULE source : rien n'est stocke dans
 * le navigateur.
 *
 * 🧮 AUCUNE REGLE N'EST RECOPIEE ICI : quel pack ouvrir, qui est convoque, ou
 * sont les titulaires — tout vient de `matchCompositionUtils` (les memes
 * fonctions que la selection et le terrain du telephone).
 *
 * 🔒 « Publier » est BLOQUE (`publicationBlocked`) tant que le terrain n'a pas
 * de joueur — relecture en cours, en echec, pack vide, ou convoque introuvable :
 * une compo vide ne remplace JAMAIS la vraie par accident.
 *
 * 👀 Un terrain en LECTURE SEULE ne relit pas `/composition` (le serveur la
 * reserve a qui gere l'equipe : un joueur recevrait un 403) : il demande au
 * plateau sa relecture existante de la convocation publiee
 * (`refreshFromServer`, lot COMPOMSG).
 */

/** @type {Readonly<{ missingCount: number, publicationBlocked: boolean, status: string }>} */
const IDLE = Object.freeze({ missingCount: 0, publicationBlocked: false, status: 'idle' });

/** @type {Readonly<Record<string, any>>} */
const EMPTY_PARAMS = Object.freeze({});

const isObject = (/** @type {any} */ value) => value !== null && typeof value === 'object';

/**
 * L'ecran de selection a-t-il deja ce qu'il lui faut ?
 * @param {any} params
 * @returns {boolean}
 */
const hasSelectionObjects = (params) => Array.isArray(params?.players)
  || Array.isArray(params?.selectedPlayers)
  || isObject(params?.existingComposition);

/**
 * Le terrain (et « Partir de… ») a-t-il deja ses convoques ?
 * @param {any} params
 * @returns {boolean}
 */
const hasFieldObjects = (params) => Array.isArray(params?.selectedPlayers);

/**
 * Les parametres de l'ecran, completes par la relecture du serveur si besoin.
 * @param {any} routeParams Les parametres de la route (adresse + objets gardes en memoire).
 * @param {'field' | 'selection'} need Ce dont l'ecran a besoin.
 * @returns {{ params: any, recovery: typeof IDLE }} `recovery` dit si la publication est fermee.
 */
const useSiteCompositionRecovery = (routeParams, need) => {
  const params = routeParams || EMPTY_PARAMS;
  const isField = need === 'field';
  const isReadOnly = params.readOnly === true;
  const hasObjects = isField ? hasFieldObjects(params) : hasSelectionObjects(params);
  const canRead = Boolean(params.eventId && params.teamId);
  const mustRead = !hasObjects && !isReadOnly && canRead;

  const { data, isError } = useGetEventTeamComposition(params.eventId || '', params.teamId, {
    enabled: mustRead,
  });
  const payload = mustRead ? data : undefined;

  // Memorise sur la CHARGE : le terrain compare l'identite de sa rangee de depart
  // (`startPlacements`), une rangee neuve a chaque rendu le ferait boucler.
  /** @type {any} */
  const recovered = useMemo(() => {
    if (!payload) return null;
    return isField
      ? { ...buildFieldFromServerComposition(payload), teamComposition: payload }
      : { ...pickCompositionToEdit(payload), teamComposition: payload };
  }, [isField, payload]);

  return useMemo(() => {
    if (hasObjects) {
      // Des objets sont la (navigation dans l'onglet) : on n'y touche pas. Le
      // terrain reste tout de meme bloque s'il n'a AUCUN joueur.
      const empty = isField && !isReadOnly && params.selectedPlayers.length === 0;
      return {
        params,
        recovery: empty ? { ...IDLE, publicationBlocked: true, status: 'empty' } : IDLE,
      };
    }
    if (isReadOnly) {
      return {
        params: isField ? { ...params, refreshFromServer: true } : params,
        recovery: IDLE,
      };
    }
    if (!canRead || isError) {
      return { params, recovery: { ...IDLE, publicationBlocked: isField, status: 'failed' } };
    }
    if (!recovered) {
      return { params, recovery: { ...IDLE, publicationBlocked: isField, status: 'loading' } };
    }

    const { missingPlayerIds = [], ...objects } = recovered;
    const nextParams = { ...params, ...objects };
    if (!isField) return { params: nextParams, recovery: { ...IDLE, status: 'recovered' } };

    const missingCount = missingPlayerIds.length;
    const noPlayer = nextParams.selectedPlayers.length === 0;
    let status = 'recovered';
    if (missingCount > 0) status = 'missing';
    else if (noPlayer) status = 'empty';
    return {
      params: nextParams,
      recovery: {
        missingCount,
        publicationBlocked: noPlayer || missingCount > 0,
        status,
      },
    };
  }, [canRead, hasObjects, isError, isField, isReadOnly, params, recovered]);
};

export default useSiteCompositionRecovery;
