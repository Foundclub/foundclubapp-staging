import {
  buildFormatServerFilters,
  OTHER_FORMATS_FILTER,
} from './friendlyMatchFormats';

// T9-RETOURS-A (12/11/2026, M1193, recette du train 9) — Adel : « Quand on met un filtre
// format, on a les "à convenir" qui sortent également ». Règle du 12/11 (consigne du chef) :
// une annonce SANS format (« À convenir ») ne sort PAS quand un format est choisi ; elle
// sort quand aucun format n'est choisi. Remplace « 5 A » du 10/11.

const garderSansFormat = (clauses) => JSON.stringify(clauses).includes('"$null":true')
  || JSON.stringify(clauses).includes('{"$eq":""}');

describe('T9-RETOURS-A — un filtre de format écarte les annonces « À convenir »', () => {
  it('un format précis : seulement ce format', () => {
    expect(buildFormatServerFilters({ format: '7v7', sport: 'Football' })).toEqual([
      { activity: { name: { $eqi: 'Football' } } },
      { format: { $eq: '7v7' } },
    ]);
  });

  it('« Autres formats » : hors catalogue, et jamais une annonce sans format', () => {
    const clauses = buildFormatServerFilters({ format: OTHER_FORMATS_FILTER, sport: 'Basketball' });
    expect(garderSansFormat(clauses)).toBe(false);
    expect(clauses[1]).toEqual({
      format: { $ne: '', $notIn: ['5v5', '3x3'], $notNull: true },
    });
  });

  it('aucun format choisi : aucune clause de format, les « À convenir » restent', () => {
    expect(buildFormatServerFilters({ sport: 'Football' })).toEqual([
      { activity: { name: { $eqi: 'Football' } } },
    ]);
  });
});
