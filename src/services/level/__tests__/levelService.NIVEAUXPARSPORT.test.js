import { compareCategories } from '@/domains/category/categorySort';

import client from '@/services/client';

import { compareLevels, getLevels, niveauxPourLeSport } from '../levelService';

// NIVEAUX-PAR-SPORT (17/11/2026) — un niveau d'equipe peut etre propre a un sport (speleo :
// « 1 - Débutant » a « 4 - Expert »). Le serveur renvoie, pour chaque niveau, ses sports relies
// (`activities`) et son rang (`rank`). Un niveau sans sport relie vaut pour tous les sports.
// INSCRIPTION-PARCOURS-2 (18/11/2026, D257, Q1 d'Adel) : les 4 niveaux valent pour TOUS les sports
// (aucun sport relie) ; la competition est reliee aux sports a competition. Un sport voit les
// niveaux sans sport + ceux de son sport, reconnu par son documentId OU par son nom
// (« Volley » = « Volleyball »).

jest.mock('@/services/client', () => ({ __esModule: true, default: { get: jest.fn() } }));

const SPELEO = 'sport-speleo';
const FOOT = 'sport-foot';
const COMPETITION_RELIEE = [
  { documentId: FOOT, name: 'Football' },
  { documentId: 'sport-vb', name: 'Volleyball' },
];

// L'ordre du serveur (name:asc), volontairement : le rang doit l'emporter sur l'alphabet.
const NIVEAUX_SERVEUR = [
  {
    activities: [], documentId: 'n-am', name: 'Amateur', rank: 2,
  },
  {
    activities: [], documentId: 'n-co', name: 'Confirmé', rank: 3,
  },
  {
    activities: COMPETITION_RELIEE, documentId: 'n-dep', name: 'Départemental', rank: null,
  },
  {
    activities: [], documentId: 'n-de', name: 'Débutant', rank: 1,
  },
  {
    activities: [], documentId: 'n-ex', name: 'Expert', rank: 4,
  },
  {
    activities: COMPETITION_RELIEE, documentId: 'n-nat', name: 'National', rank: null,
  },
  {
    activities: COMPETITION_RELIEE, documentId: 'n-reg', name: 'Régional', rank: null,
  },
];

const noms = (/** @type {any[]} */ liste) => liste.map((niveau) => niveau.name);
const SPELEO_4 = ['Débutant', 'Amateur', 'Confirmé', 'Expert'];
const COMPETITION = ['Départemental', 'Régional', 'National'];

describe('NIVEAUX-PAR-SPORT · levelService', () => {
  it('compareLevels : un niveau qui a un rang passe d abord, par rang croissant', () => {
    expect(noms([...NIVEAUX_SERVEUR].sort(compareLevels))).toEqual([
      'Débutant', 'Amateur', 'Confirmé', 'Expert', 'Départemental', 'Régional', 'National',
    ]);
  });

  it('compareLevels : sans rang, l ordre de competition d avant ne bouge pas', () => {
    const sansRang = NIVEAUX_SERVEUR.filter((niveau) => !niveau.rank);
    expect(noms([...sansRang].sort(compareLevels))).toEqual(COMPETITION);
  });

  it('Speleologie (sans competition) : les 4 seulement, dans l ordre', () => {
    const ranges = [...NIVEAUX_SERVEUR].sort(compareLevels);
    expect(noms(niveauxPourLeSport(ranges, SPELEO))).toEqual(SPELEO_4);
  });

  it('Football (par son documentId) : les 4 d abord, puis la competition', () => {
    const ranges = [...NIVEAUX_SERVEUR].sort(compareLevels);
    expect(noms(niveauxPourLeSport(ranges, FOOT))).toEqual([...SPELEO_4, ...COMPETITION]);
  });

  it('par le NOM du sport (l inscription ne garde que le nom) : « Volley » = Volleyball', () => {
    const ranges = [...NIVEAUX_SERVEUR].sort(compareLevels);
    expect(noms(niveauxPourLeSport(ranges, 'Volley'))).toEqual([...SPELEO_4, ...COMPETITION]);
    expect(noms(niveauxPourLeSport(ranges, 'football'))).toEqual([...SPELEO_4, ...COMPETITION]);
    expect(noms(niveauxPourLeSport(ranges, 'Spéléologie'))).toEqual(SPELEO_4);
  });

  it('aucun sport choisi : les niveaux « tous sports » (les 4)', () => {
    expect(noms(niveauxPourLeSport(NIVEAUX_SERVEUR, '')))
      .toEqual(['Amateur', 'Confirmé', 'Débutant', 'Expert']);
  });

  it('serveur ancien (aucun champ activities) : tous les niveaux, rien ne disparait', () => {
    const anciens = [{ documentId: 'a', name: 'Régional' }, { documentId: 'b', name: 'National' }];
    expect(noms(niveauxPourLeSport(anciens, SPELEO))).toEqual(['Régional', 'National']);
  });

  it('getLevels : l app ne demande pas de populate (le serveur le pose lui-meme)', async () => {
    /** @type {any} */ (client.get).mockResolvedValueOnce({ data: { data: NIVEAUX_SERVEUR } });
    const niveaux = await getLevels();
    expect(/** @type {any} */ (client.get).mock.calls[0][1].params.populate).toBeUndefined();
    expect(noms(niveaux).slice(0, 4)).toEqual(SPELEO_4);
  });

  it('categorie « Tous âges » rangee apres « Sénior » (temoin caracterisant)', () => {
    const categories = [
      { name: 'Tous âges' }, { name: 'Sénior (+18 ans)' }, { name: 'U12 (12 ans)' },
    ];
    expect(noms([...categories].sort(compareCategories)))
      .toEqual(['U12 (12 ans)', 'Sénior (+18 ans)', 'Tous âges']);
  });
});
