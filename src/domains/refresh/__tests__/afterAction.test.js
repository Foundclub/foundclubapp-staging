import fs from 'fs';
import path from 'path';

import { MutationObserver, QueryClient } from '@tanstack/react-query';

import {
  AFTER_ACTION_CACHES,
  invalidateAfterAction,
} from '../afterAction';

/**
 * T08 — LES CINQ TEMOINS DU RAFRAICHISSEMENT APRES ACTION.
 *
 * Ce que chacun protege, et pourquoi il existe :
 *  1. rejoindre une equipe rafraichit l'onglet equipe, le planning et l'accueil
 *     — le defaut d'origine : « je rejoins, je ne vois rien, je rejoins deux fois » ;
 *  2. repondre a un evenement rafraichit sa fiche ET le planning ;
 *  3. une action qui ECHOUE n'invalide RIEN — rafraichir apres un echec fait
 *     clignoter l'ecran et laisse croire que quelque chose a change ;
 *  4. aucune action ne recharge TOUTE l'app — `invalidateQueries()` sans filtre
 *     perime le cache entier, c'est la correction facile et elle coute cher ;
 *  5. chaque cle declaree existe reellement dans le code — une cle mal
 *     orthographiee n'invalide rien, EN SILENCE, et aucune porte ne le voit.
 */

const RACINE_SOURCES = path.resolve(__dirname, '../../..');

/**
 * Toutes les racines de cle reellement posees par une query de l'app.
 *
 * Les QUATRE formes comptent, et aucune n'est theorique :
 *  · `queryKey: ['racine'` — le cas courant ;
 *  · `export const HOME_SUMMARY_QUERY_KEY = ['home-summary']` — `home-summary`
 *    n'existe QUE sous cette forme ;
 *  · `buildNormalizedQueryKey(['racine', id], params)` — la forme de
 *    `clubMembershipRequests` et `teamMembershipRequests` ;
 *  · `export const getXQueryKey = (…) => ['racine', …]` — celle de
 *    `clubInterestRequests` et de `requestsHub`.
 *
 * 🧨 U05 — POURQUOI LES DEUX DERNIERES ONT ETE AJOUTEES, et c'est un vrai piege
 * de mesure : ce temoin passait au vert en lisant les `queryKey:` ecrits dans
 * les APPELS A `invalidateQueries`, pas dans les queries elles-memes. Brancher
 * un ecran sur le module retire ces litteraux — et le temoin s'est mis a
 * declarer introuvables des racines parfaitement reelles. Il mesurait
 * « quelqu'un invalide cette cle », pas « cette cle existe ».
 * @returns {Set<string>} Les racines trouvees sur le disque.
 */
const lireRacinesDeClesReelles = () => {
  /** @type {Set<string>} */
  const racines = new Set();
  const litteral = /queryKey:\s*\[\s*'([^']+)'/g;
  const constante = /^export const [A-Z0-9_]+\s*=\s*\[+\s*'([^']+)'/gm;
  const normalisee = /buildNormalizedQueryKey\(\s*\[\s*'([^']+)'/g;
  const fabrique = /^export const get[A-Za-z]*QueryKey\s*=\s*\([^)]*\)\s*=>\s*\[\s*'([^']+)'/gm;

  /** @param {string} repertoire */
  const parcourir = (repertoire) => {
    fs.readdirSync(repertoire, { withFileTypes: true }).forEach((entree) => {
      const chemin = path.join(repertoire, entree.name);
      if (entree.isDirectory()) {
        if (entree.name !== 'node_modules') parcourir(chemin);
        return;
      }
      if (!entree.name.endsWith('.js') && !entree.name.endsWith('.ts')) return;

      const contenu = fs.readFileSync(chemin, 'utf8');
      [litteral, constante, normalisee, fabrique].forEach((motif) => {
        Array.from(contenu.matchAll(motif)).forEach((r) => racines.add(r[1]));
      });
    });
  };

  parcourir(RACINE_SOURCES);
  return racines;
};

/**
 * Pose une query DEJA LUE dans le cache : `invalidateQueries` ne marque que ce
 * qui existe, un cache vide rendrait tous ces temoins verts pour rien.
 * @param {QueryClient} queryClient - Le client de test.
 * @param {string[]} queryKey - La cle a poser.
 * @returns {void}
 */
const poserQueryFraiche = (queryClient, queryKey) => {
  queryClient.setQueryData(queryKey, { valeur: 'lue' });
};

/**
 * @param {QueryClient} queryClient - Le client de test.
 * @param {string[]} queryKey - La cle a controler.
 * @returns {boolean} true si la query a ete marquee perimee.
 */
const estInvalidee = (queryClient, queryKey) => Boolean(
  queryClient.getQueryCache().find({ exact: true, queryKey })?.state?.isInvalidated,
);

describe('T08 — ce qui devient faux apres une action', () => {
  /** @type {QueryClient} */
  let queryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('temoin 1 — rejoindre une equipe invalide l\'onglet equipe ET le planning ET l\'accueil', async () => {
    poserQueryFraiche(queryClient, ['teams']);
    poserQueryFraiche(queryClient, ['planning', 'personal', '2026-08-17', '2026-08-24']);
    poserQueryFraiche(queryClient, ['home-summary']);

    await invalidateAfterAction(queryClient, 'joinTeam');

    expect(estInvalidee(queryClient, ['teams'])).toBe(true);
    expect(estInvalidee(queryClient, ['planning', 'personal', '2026-08-17', '2026-08-24'])).toBe(true);
    expect(estInvalidee(queryClient, ['home-summary'])).toBe(true);
  });

  it('temoin 2 — repondre a un evenement invalide sa fiche ET le planning', async () => {
    poserQueryFraiche(queryClient, ['event', 'evt-1']);
    poserQueryFraiche(queryClient, ['planning', 'personal', '2026-08-17', '2026-08-24']);

    await invalidateAfterAction(queryClient, 'answerEvent');

    expect(estInvalidee(queryClient, ['event', 'evt-1'])).toBe(true);
    expect(estInvalidee(queryClient, ['planning', 'personal', '2026-08-17', '2026-08-24'])).toBe(true);
  });

  it('temoin 3 — une action qui ECHOUE n\'invalide RIEN', async () => {
    poserQueryFraiche(queryClient, ['teams']);
    poserQueryFraiche(queryClient, ['planning', 'personal']);
    poserQueryFraiche(queryClient, ['home-summary']);

    // Le cablage REEL attendu des ecrans : l'invalidation vit dans `onSuccess`,
    // jamais dans `onSettled`. On monte donc une vraie mutation qui rejette.
    const observer = new MutationObserver(queryClient, {
      mutationFn: async () => {
        throw new Error('le serveur a refuse');
      },
      onSuccess: () => invalidateAfterAction(queryClient, 'joinTeam'),
      retry: false,
    });

    await expect(observer.mutate()).rejects.toThrow('le serveur a refuse');

    expect(estInvalidee(queryClient, ['teams'])).toBe(false);
    expect(estInvalidee(queryClient, ['planning', 'personal'])).toBe(false);
    expect(estInvalidee(queryClient, ['home-summary'])).toBe(false);
  });

  it('temoin 4 — aucune action ne recharge TOUTE l\'app', async () => {
    const actions = Object.keys(AFTER_ACTION_CACHES);
    expect(actions.length).toBeGreaterThan(0);

    // Une liste vide, ou une cle vide, ferait tomber `invalidateQueries` sur un
    // filtre qui matche TOUT le cache. C'est le piege inverse du lot.
    actions.forEach((action) => {
      const cles = AFTER_ACTION_CACHES[action];
      expect(Array.isArray(cles)).toBe(true);
      expect(cles.length).toBeGreaterThan(0);
      cles.forEach((cle) => {
        expect(Array.isArray(cle)).toBe(true);
        expect(cle.length).toBeGreaterThan(0);
        cle.forEach((segment) => {
          expect(typeof segment).toBe('string');
          expect(segment.trim()).not.toBe('');
        });
      });
    });

    // Et la preuve par le cache : une query etrangere a l'action reste fraiche.
    await Promise.all(actions.map(async (action) => {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      poserQueryFraiche(client, ['temoin-etranger']);
      await invalidateAfterAction(client, action);
      expect({ action, invalidee: estInvalidee(client, ['temoin-etranger']) })
        .toEqual({ action, invalidee: false });
      client.clear();
    }));
  });

  it('temoin 5 — chaque cle d\'invalidation existe reellement dans le code', () => {
    const racinesReelles = lireRacinesDeClesReelles();
    expect(racinesReelles.size).toBeGreaterThan(50);

    const introuvables = [];
    Object.entries(AFTER_ACTION_CACHES).forEach(([action, cles]) => {
      cles.forEach((cle) => {
        if (!racinesReelles.has(cle[0])) {
          introuvables.push(`${action} -> '${cle[0]}'`);
        }
      });
    });

    expect(introuvables).toEqual([]);
  });

  it('les actions demandees sont couvertes', () => {
    // U05 — `membershipChanged` s'ajoute aux dix de T08. Ce n'est pas une action
    // de l'utilisateur mais une notification RECUE (« ta demande est acceptee ») :
    // sur cet appareil-la, rien n'a ete presse, et pourtant l'appartenance a
    // change. C'est le cas qu'Adel decrit comme « hyper long ».
    expect(Object.keys(AFTER_ACTION_CACHES).sort()).toEqual([
      'acceptRequest',
      'answerEvent',
      'createClub',
      'createEvent',
      'joinClub',
      'joinEvent',
      'joinTeam',
      'leaveTeam',
      'membershipChanged',
      'publishComposition',
      // SCORE1/H9 — `submitMatchStats` : envoyer un score, un bilan d'equipe ou
      // sa reponse perso. Elle ne s'ajoute pas a la liste, elle en REMPLACE deux
      // qui vivaient hors de ce fichier : `MatchStatsEditor` et
      // `PlayerMatchResponseScreen` recopiaient chacun ses cles, et les deux
      // copies avaient deja derive (l'un oubliait `eventMyMatchResponse`, l'autre
      // `eventMatchResult`). C'est ce fichier-ci qui les tient desormais.
      'submitMatchStats',
      'subscribe',
    ]);
  });
});
