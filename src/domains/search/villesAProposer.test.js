import villesAProposer from '@/domains/search/villesAProposer';

const noms = (/** @type {{ label: string }[]} */ villes) => villes.map(({ label }) => label);

/**
 * FIN-MESSAGERIE p67 (02/11, revue) — le champ Ville d'une alerte restait une liste vide tant
 * qu'on n'avait rien tapé.
 */
describe('FIN-MESSAGERIE p67 — les villes proposées avant la frappe', () => {
  const MARSEILLE_6 = {
    label: 'Marseille 6e Arrondissement (13006)', lat: 43.28, lng: 5.38, value: '5.38|43.28',
  };

  test('avec une ville au profil : elle d abord, puis les grandes villes les plus proches', () => {
    expect(noms(villesAProposer(MARSEILLE_6))).toEqual([
      'Marseille 6e Arrondissement (13006)',
      'Marseille (13001)',
      'Aix-en-Provence (13100)',
      'Toulon (83000)',
      'Avignon (84000)',
    ]);
  });

  test('sans ville au profil : les plus grandes villes', () => {
    expect(noms(villesAProposer(undefined))).toEqual([
      'Paris (75001)',
      'Marseille (13001)',
      'Lyon (69001)',
      'Toulouse (31000)',
      'Nice (06000)',
    ]);
  });

  test('un profil sans coordonnées compte comme un profil sans ville', () => {
    expect(noms(villesAProposer({ label: 'Marseille', value: '' }))[0]).toBe('Paris (75001)');
  });

  test('chaque ville a la forme d une adresse choisie : « lng|lat », lue par le geohash', () => {
    const [paris] = villesAProposer(undefined);

    expect(paris.value).toBe(`${paris.lng}|${paris.lat}`);
    expect(paris.city).toBe('Paris');
  });
});
