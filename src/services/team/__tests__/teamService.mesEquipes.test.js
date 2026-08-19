/**
 * U03 — filet E6 sur `getTeams`, qui n'avait AUCUN test.
 *
 * 🔴 LE DEFAUT MESURE : `buildClubFilter` (teamService.js:7-20) rend `undefined`
 * quand `clubId` est absent, et `buildRequestParams` pose alors un `filters`
 * SANS AUCUNE contrainte. Combine a une pagination de 10 lignes par page et a
 * l'absence de tri, `GET /teams` renvoie donc la table ENTIERE, dix lignes a la
 * fois, dans un ordre quelconque. C'est ce que fait l'onglet « Equipe » d'un
 * JOUEUR (`MyTeamList.js:88-91` monte `TeamListContent` sans `clubId`).
 *
 * 🎯 CE QUE CE FICHIER FIGE :
 *  1. l'invariant du DIRIGEANT : `clubId` pose toujours son filtre de club, et
 *     le repli « identifiant numerique » se declenche toujours sur page vide ;
 *  2. le neuf : une selection nommee d'equipes (`teamIds`) part en
 *     `filters[documentId][$in]` — la seule forme que le serveur accepte sans
 *     modification (verifie dans le Strapi installe :
 *     `admin/node_modules/@strapi/utils/dist/sanitize/sanitizers.js:44-49`
 *     garde explicitement `documentId` dans les filtres) ;
 *  3. le garde-fou : une selection VIDE ne part PAS sur le reseau. Un tableau
 *     vide veut dire « aucune equipe », jamais « toutes les equipes ».
 */

const mockGet = jest.fn();

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(),
    get: mockGet,
    post: jest.fn(),
    put: jest.fn(),
  },
}));

jest.mock('@/services/celebrations/celebrationRuntime', () => ({
  celebrate: jest.fn(),
}));

const { getTeams } = require('../teamService');

const EQUIPE = {
  activities: [],
  documentId: 't-1',
  name: 'U15 Masculins',
};

/**
 * Une reponse de liste conforme au schema Joi du service.
 * @param {any[]} data - Les equipes renvoyees.
 * @param {number} [total] - Le total annonce par la pagination.
 * @returns {any} - La reponse axios simulee.
 */
const reponse = (data, total = data.length) => ({
  data: {
    data,
    meta: {
      pagination: {
        page: 1,
        pageCount: Math.max(1, Math.ceil(total / 10)),
        pageSize: 10,
        total,
      },
    },
  },
});

/**
 * Les `filters` du dernier appel HTTP.
 * @param {number} [rang] - Le rang de l'appel (0 = le premier).
 * @returns {any} - L'objet `filters` envoye.
 */
const filtresEnvoyes = (rang = 0) => mockGet.mock.calls[rang][1].params.filters;

/**
 * La `pagination` du dernier appel HTTP.
 * @param {number} [rang] - Le rang de l'appel (0 = le premier).
 * @returns {any} - L'objet `pagination` envoye.
 */
const paginationEnvoyee = (rang = 0) => mockGet.mock.calls[rang][1].params.pagination;

describe('getTeams — le filtre de la requete (filet E6, lot U03)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('invariants — ce que le lot ne doit pas casser', () => {
    it('pose le filtre de club quand un clubId est fourni', async () => {
      mockGet.mockResolvedValue(reponse([EQUIPE]));

      await getTeams({ clubId: 'club-1' });

      expect(mockGet).toHaveBeenCalledTimes(1);
      expect(filtresEnvoyes().club).toEqual({ documentId: 'club-1' });
      expect(paginationEnvoyee()).toEqual({ page: 1, pageSize: 10 });
    });

    // 🪤 CONSTAT DU FILET, contraire a ce que le code laisse croire : le repli
    // « identifiant numerique » (teamService.js:251-258) est INATTEIGNABLE. Le
    // schema Joi porte `data: ....empty(Joi.array().length(0))`, qui transforme
    // un tableau VIDE en `undefined` — donc `Array.isArray(validationResult.data)`
    // est FAUX au moment ou la condition du repli le teste, et le second appel
    // n'a jamais lieu. Mesure : 1 appel, pas 2. Ce filet fige le comportement
    // REEL ; reparer le repli sortirait du perimetre U03 (§1 bis : ce chemin
    // sert le DIRIGEANT, qu'on a interdiction de toucher).
    it('ne retente PAS avec l identifiant numerique — le repli est du code mort', async () => {
      mockGet
        .mockResolvedValueOnce(reponse([]))
        .mockResolvedValueOnce(reponse([EQUIPE]));

      const resultat = await getTeams({ clubId: '42' });

      expect(mockGet).toHaveBeenCalledTimes(1);
      expect(resultat.data).toBeUndefined();
    });

    it('garde les filtres de recherche existants (nom, categorie, niveau)', async () => {
      mockGet.mockResolvedValue(reponse([EQUIPE]));

      await getTeams({
        category: ['cat-1'],
        clubId: 'club-1',
        level: ['niv-1'],
        name: 'seniors',
      });

      const filtres = filtresEnvoyes();
      expect(filtres.name).toEqual({ $containsi: 'seniors' });
      expect(filtres.category).toEqual({ documentId: { $in: ['cat-1'] } });
      expect(filtres.level).toEqual({ documentId: { $in: ['niv-1'] } });
    });
  });

  describe('U03 — demander SES equipes, nommement', () => {
    it('envoie la selection en filtre sur documentId', async () => {
      mockGet.mockResolvedValue(reponse([EQUIPE]));

      await getTeams({ pageSize: 2, teamIds: ['t-1', 't-2'] });

      expect(mockGet).toHaveBeenCalledTimes(1);
      expect(filtresEnvoyes().documentId).toEqual({ $in: ['t-1', 't-2'] });
      expect(paginationEnvoyee()).toEqual({ page: 1, pageSize: 2 });
    });

    it('nettoie les identifiants vides sans perdre les autres', async () => {
      mockGet.mockResolvedValue(reponse([EQUIPE]));

      await getTeams({ teamIds: ['  t-1  ', '', null, 't-2'] });

      expect(filtresEnvoyes().documentId).toEqual({ $in: ['t-1', 't-2'] });
    });

    it('ne demande RIEN au serveur quand la selection est vide', async () => {
      const resultat = await getTeams({ teamIds: [] });

      expect(mockGet).not.toHaveBeenCalled();
      expect(resultat.data).toEqual([]);
      expect(resultat.meta.pagination.total).toBe(0);
    });

    it('ne demande RIEN non plus quand la selection ne contient que du vide', async () => {
      const resultat = await getTeams({ teamIds: ['', '   ', null] });

      expect(mockGet).not.toHaveBeenCalled();
      expect(resultat.data).toEqual([]);
    });
  });

  describe('🚨 le defaut d origine — une liste sans aucun filtre', () => {
    it('sans clubId NI teamIds, la requete ne porte aucune contrainte', async () => {
      mockGet.mockResolvedValue(reponse([EQUIPE], 45000));

      await getTeams({});

      const filtres = filtresEnvoyes();
      const contraintes = Object.entries(filtres)
        .filter(([, valeur]) => valeur !== undefined)
        .map(([clef]) => clef);

      // Ce temoin DECRIT le defaut : il reste vert apres le correctif, parce que
      // le correctif ne vit pas ici mais chez l'APPELANT (`TeamListContent`),
      // qui ne doit plus jamais appeler `getTeams` sans dire QUOI il demande.
      expect(contraintes).toEqual([]);
      expect(paginationEnvoyee().pageSize).toBe(10);
    });
  });
});
