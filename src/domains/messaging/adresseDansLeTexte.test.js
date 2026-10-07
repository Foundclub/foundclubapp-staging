import { adressesDansLeTexte } from './adresseDansLeTexte';

// MSG1A (§3.18) — « adresse detectee dans un texte (numero + type de voie) » : ce qui
// devient un lien, et surtout ce qui n'en devient pas un.

describe('adressesDansLeTexte', () => {
  test('A1 — l adresse s arrete avant la suite de la phrase', () => {
    expect(adressesDansLeTexte('RDV au 12 rue de la Paix demain à 18h')).toEqual([
      '12 rue de la Paix',
    ]);
  });

  test('A2 — le code postal et la ville suivent l adresse', () => {
    expect(adressesDansLeTexte('Stade : 3 avenue Jean Jaurès, 83000 Toulon.')).toEqual([
      '3 avenue Jean Jaurès, 83000 Toulon',
    ]);
  });

  test('A3 — bis, apostrophe, majuscule en tete de phrase', () => {
    expect(adressesDansLeTexte('45 bis boulevard Gambetta')).toEqual(['45 bis boulevard Gambetta']);
    expect(adressesDansLeTexte('On se retrouve 5 place d’Armes')).toEqual(['5 place d’Armes']);
    expect(adressesDansLeTexte('8 Rue Victor Hugo, 75011 Paris')).toEqual([
      '8 Rue Victor Hugo, 75011 Paris',
    ]);
  });

  test('A4 — un nombre sans type de voie n est pas une adresse', () => {
    expect(adressesDansLeTexte('on sera 12 joueurs, il fait 20 degrés')).toEqual([]);
    expect(adressesDansLeTexte('le match du 12 à 18h')).toEqual([]);
    expect(adressesDansLeTexte('')).toEqual([]);
  });

  test('A5 — deux adresses dans le meme message', () => {
    expect(adressesDansLeTexte('Aller : 2 rue Pasteur. Retour : 10 chemin des Oliviers')).toEqual([
      '2 rue Pasteur',
      '10 chemin des Oliviers',
    ]);
  });
});
