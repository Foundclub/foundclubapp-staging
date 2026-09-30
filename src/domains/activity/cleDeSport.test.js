import {
  cleDeSport,
  compacterNomDeSport,
  regrouperLesSports,
} from './cleDeSport';

// SPORTS-DOUBLONS (01/10/2026) — la règle « un sport = une clé » côté app. Sa parité avec le
// serveur est prouvée côté admin (`tests/authz/SPORTS-DOUBLONS-2-parite-app.test.js`, qui lit
// ce module).

describe('cleDeSport — un sport, une clé', () => {
  it('les 4 doublons de la base ont une seule clé', () => {
    expect(cleDeSport('Canoë-Kayak')).toBe(cleDeSport('Canoë-kayak'));
    expect(cleDeSport('Echecs')).toBe(cleDeSport('Échecs'));
    expect(cleDeSport('Equitation')).toBe(cleDeSport('Équitation'));
    expect(cleDeSport('Volley')).toBe(cleDeSport('Volleyball'));
    expect(cleDeSport('Volley-ball')).toBe('volleyball');
  });

  it('les voisins par contenu restent des sports différents', () => {
    const voisins = ['Football', 'Football américain', 'Football américain / Flag', 'Football à 5'];
    expect(new Set(voisins.map(cleDeSport)).size).toBe(4);
    expect(cleDeSport('Rugby')).not.toBe(cleDeSport('Rugby à XIII'));
    expect(cleDeSport('Beach volley')).not.toBe(cleDeSport('Volleyball'));
  });

  it('compacterNomDeSport ne connaît pas les alias (la recherche à la main en a besoin)', () => {
    expect(compacterNomDeSport('Volley')).toBe('volley');
    expect(compacterNomDeSport('Équitation')).toBe('equitation');
  });
});

describe('regrouperLesSports — un groupe par clé, représenté par sa forme la mieux écrite', () => {
  it('« Volley » et « Volleyball » : un groupe, la ligne « Volleyball » en représentant', () => {
    const groupes = regrouperLesSports([
      { documentId: 'a-volley', name: 'Volley' },
      { documentId: 'a-foot', name: 'Football' },
      { documentId: 'a-volleyball', name: 'Volleyball' },
    ]);
    expect(groupes.map(({ nom }) => nom)).toEqual(['Volleyball', 'Football']);
    expect(groupes[0].representant.documentId).toBe('a-volleyball');
    expect(groupes[0].membres.map((sport) => sport.documentId))
      .toEqual(['a-volley', 'a-volleyball']);
  });

  it('les 4 doublons de la base, dans les deux ordres : toujours la forme officielle', () => {
    const paires = [
      ['Canoë-Kayak', 'Canoë-kayak'],
      ['Echecs', 'Échecs'],
      ['Equitation', 'Équitation'],
      ['Volley', 'Volleyball'],
    ];
    const noms = (lignes) => regrouperLesSports(lignes.map((name) => ({ name })))
      .map(({ nom }) => nom);
    const officiels = ['Canoë-kayak', 'Échecs', 'Équitation', 'Volleyball'];
    expect(noms(paires.flat())).toEqual(officiels);
    expect(noms(paires.flat().reverse())).toEqual([...officiels].reverse());
  });

  it('un sport écrit une seule fois garde son nom', () => {
    const [groupe] = regrouperLesSports([{ documentId: 'a-equit', name: 'Equitation' }]);
    expect(groupe.nom).toBe('Equitation');
    expect(groupe.representant.documentId).toBe('a-equit');
  });

  it('une liste absente ou un nom vide ne cassent rien', () => {
    expect(regrouperLesSports(undefined)).toEqual([]);
    expect(regrouperLesSports([{ documentId: 'x', name: '' }, null])).toEqual([]);
  });
});
