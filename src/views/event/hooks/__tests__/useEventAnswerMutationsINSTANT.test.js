import { QueryClient } from '@tanstack/react-query';

import { invalidateEventAnswerQueries } from '../useEventAnswerMutations';

// ==========================================================================
// LOT INSTANT / R3c — L'APP QUI SE CONTREDIT ELLE-MEME.
//
// 🧨 LE DEFAUT N°6 DE L'AUDIT DU 27/08 : je reponds « present » depuis une
// LISTE (recherche, accueil, planning) ; j'ouvre la fiche de l'evenement pour
// verifier, et elle affiche « sans reponse ». Je la ferme, je la rouvre : elle
// affiche toujours « sans reponse ».
//
// 🔎 LE MAILLON : la liste n'invalidait que TROIS racines — `['events']`,
// `['planning','personal']` et `['eventAttendance', id]`. Ni `['event', id]`
// (la fiche) ni `['eventParticipations', id]` (la liste du coach) n'en
// faisaient partie. Et rouvrir la fiche n'y changeait rien : elle porte
// `staleTime: 30 000` ET `refetchOnMount: false` (eventQueries.js:17,47-48),
// donc un remontage ne relit RIEN.
//
// 🎯 LA REPARATION : passer par le registre `afterAction` (`answerEvent`), qui
// declare deja les six racines — la fiche comprise. Ce n'est pas une nouvelle
// mecanique, c'est le meme motif que la fiche applique deja de son cote
// (`useEventMutations.js:45-66`, l'implementation de reference).
//
// ⚠️ CE QUE CE FILET NE PROUVE PAS : que l'ecran se repeint. Il prouve que les
// caches sont marques perimes. Une query EN VEILLE ne se relit pas pour autant
// (react-query n'invalide que les queries ACTIVES) — la fiche, elle, est bien
// montee au moment ou on la regarde.
// ==========================================================================

// ⛔ SANS CETTE DOUBLURE, LA SUITE ENTIERE MEURT : `eventService` importe
// `react-native-blob-util`, qui est publie en modules ES et que Jest ne
// transforme pas. Ce n'est pas un test qui echoue, c'est ZERO test execute.
jest.mock('@/services/event/eventService', () => ({
  missingEvent: jest.fn(),
  respondToEventRsvp: jest.fn(),
}));

jest.mock('@/domains/participation/participationFlow', () => ({
  getParticipationErrorMessage: () => 'erreur',
}));

/**
 * Dit si une query posee dans le cache a bien ete marquee perimee.
 * @param {QueryClient} queryClient - Le client de test.
 * @param {any[]} queryKey - La cle a controler.
 * @returns {boolean} true si la query a ete marquee perimee.
 */
const estPerimee = (queryClient, queryKey) => Boolean(
  queryClient.getQueryCache().find({ exact: true, queryKey })?.state?.isInvalidated,
);

describe('INSTANT / R3c — repondre depuis une liste rafraichit AUSSI la fiche', () => {
  /** @type {QueryClient} */
  let queryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('R3c — 🥇 la FICHE et la liste du COACH sont relues, pas seulement la liste', () => {
    queryClient.setQueryData(['event', 'evt-1'], { valeur: 'lue' });
    queryClient.setQueryData(['eventParticipations', 'evt-1'], { valeur: 'lue' });
    queryClient.setQueryData(['home-summary'], { valeur: 'lue' });

    invalidateEventAnswerQueries(queryClient);

    // 🔴 AVANT CE LOT : ces trois-la restaient fraiches. La fiche affichait
    // l'ANCIENNE reponse, meme apres l'avoir fermee et rouverte.
    [['event', 'evt-1'], ['eventParticipations', 'evt-1'], ['home-summary']].forEach((queryKey) => {
      expect({ perimee: estPerimee(queryClient, queryKey), queryKey })
        .toEqual({ perimee: true, queryKey });
    });
  });

  it('R3c — 🔒 ACQUIS : elle invalide toujours tout ce qu\'elle invalidait', () => {
    // Les trois racines d'avant le lot, dans leur forme d'origine. Brancher un
    // appelant sur le registre ne doit RIEN lui retirer — c'est le piege paye au
    // lot U05 sur `RequestsHub`, qui perdait deux rubriques en se branchant.
    queryClient.setQueryData(['events'], { valeur: 'lue' });
    queryClient.setQueryData(['planning', 'personal'], { valeur: 'lue' });
    queryClient.setQueryData(['eventAttendance', 'evt-1'], { valeur: 'lue' });

    invalidateEventAnswerQueries(queryClient);

    [['events'], ['planning', 'personal'], ['eventAttendance', 'evt-1']].forEach((queryKey) => {
      expect({ perimee: estPerimee(queryClient, queryKey), queryKey })
        .toEqual({ perimee: true, queryKey });
    });
  });

  it('R3c — 🎁 EN PLUS : le planning PLEIN ECRAN suit, parce que le prefixe est court', () => {
    // 18 sites de l'app invalident `['planning','personal']` ; le plein ecran,
    // lui, pose `['planning','fullscreen',…]`. Le prefixe ne matchait pas, donc
    // il restait faux apres n'importe quelle reponse. Le registre pose
    // `['planning']` tout court, qui couvre les quatre familles.
    queryClient.setQueryData(['planning', 'fullscreen', 'personal', 's-1'], { valeur: 'lue' });

    invalidateEventAnswerQueries(queryClient);

    expect(estPerimee(queryClient, ['planning', 'fullscreen', 'personal', 's-1'])).toBe(true);
  });

  it('R3c — 🛡️ elle ne recharge PAS toute l\'app', () => {
    queryClient.setQueryData(['temoin-etranger'], { valeur: 'lue' });
    queryClient.setQueryData(['clubs'], { valeur: 'lue' });

    invalidateEventAnswerQueries(queryClient);

    [['temoin-etranger'], ['clubs']].forEach((queryKey) => {
      expect({ perimee: estPerimee(queryClient, queryKey), queryKey })
        .toEqual({ perimee: false, queryKey });
    });
  });
});
