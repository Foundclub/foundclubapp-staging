import {
  cleDeSport,
  compacterNomDeSport,
  nomOfficielDeSport,
  NOMS_OFFICIELS,
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

  it('le nom officiel des doublons ; les autres gardent le leur', () => {
    expect(['Canoë-Kayak', 'Echecs', 'Equitation', 'Volley'].map(nomOfficielDeSport))
      .toEqual(['Canoë-kayak', 'Échecs', 'Équitation', 'Volleyball']);
    expect(nomOfficielDeSport(' Football ')).toBe('Football');
    expect(Object.keys(NOMS_OFFICIELS)).toHaveLength(4);
  });

  it('compacterNomDeSport ne connaît pas les alias (la recherche à la main en a besoin)', () => {
    expect(compacterNomDeSport('Volley')).toBe('volley');
    expect(compacterNomDeSport('Équitation')).toBe('equitation');
  });
});

describe('regrouperLesSports — un groupe par clé, représenté par la ligne au nom officiel', () => {
  it('« Volley » et « Volleyball » : un groupe, la ligne « Volleyball » en tête', () => {
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

  it('sans ligne au nom officiel : ce nom quand même, la première ligne en représentant', () => {
    const [groupe] = regrouperLesSports([{ documentId: 'a-equit', name: 'Equitation' }]);
    expect(groupe.nom).toBe('Équitation');
    expect(groupe.representant.documentId).toBe('a-equit');
  });

  it('une liste absente ou un nom vide ne cassent rien', () => {
    expect(regrouperLesSports(undefined)).toEqual([]);
    expect(regrouperLesSports([{ documentId: 'x', name: '' }, null])).toEqual([]);
  });
});
