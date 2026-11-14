import {
  afficherEntreeCommunautes,
  basculerMembre,
  corpsDeCreation,
  creationEnAttente,
  etapeUnPrete,
  filtrerCandidats,
  peutCreerDans,
  toutSelectionner,
} from '../communautes';

// COMMUNAUTES-L2 (13/11/2026, D76) — les règles des premiers écrans, sans React.

describe('COMMUNAUTES-L2 — règles des écrans', () => {
  test('D1 — l entrée n existe qu avec au moins une communauté (null, erreur, [] : rien)', () => {
    expect(afficherEntreeCommunautes(null)).toBe(false);
    expect(afficherEntreeCommunautes(undefined)).toBe(false);
    expect(afficherEntreeCommunautes({ data: [] })).toBe(false);
    expect(afficherEntreeCommunautes([])).toBe(false);
    expect(afficherEntreeCommunautes([{ genre: 'club' }])).toBe(true);
  });

  test('D2 — « Nouveau groupe » : serveur d accord ET genre ouvert (la Ville attend L7)', () => {
    expect(peutCreerDans({ genre: 'club', peutCreer: true })).toBe(true);
    expect(peutCreerDans({ genre: 'omnisport', peutCreer: true })).toBe(true);
    expect(peutCreerDans({ genre: 'complexe', peutCreer: true })).toBe(true);
    expect(peutCreerDans({ genre: 'ville', peutCreer: true })).toBe(false);
    expect(peutCreerDans({ genre: 'club', peutCreer: false })).toBe(false);
    expect(peutCreerDans({ genre: 'club' })).toBe(false);
    expect(creationEnAttente({ genre: 'ville', peutCreer: true })).toBe(true);
    expect(creationEnAttente({ genre: 'ville', peutCreer: false })).toBe(false);
  });

  test('D3 — étape 1 : un nom non vide et un thème connu', () => {
    expect(etapeUnPrete({ nom: '  ', theme: 'libre' })).toBe(false);
    expect(etapeUnPrete({ nom: 'Covoiturage U13', theme: 'inconnu' })).toBe(false);
    expect(etapeUnPrete({ nom: 'Covoiturage U13', theme: 'covoiturage' })).toBe(true);
  });

  test('D4 — « Tout sélectionner » coche tous les candidats du serveur, puis décoche tout', () => {
    const candidats = [{ documentId: 'a' }, { documentId: 'b' }, { documentId: 'c' }];
    expect(toutSelectionner([], candidats)).toEqual(['a', 'b', 'c']);
    expect(toutSelectionner(['b'], candidats)).toEqual(['a', 'b', 'c']);
    expect(toutSelectionner(['a', 'b', 'c'], candidats)).toEqual([]);
    expect(toutSelectionner([], [])).toEqual([]);
    expect(basculerMembre(['a'], 'b')).toEqual(['a', 'b']);
    expect(basculerMembre(['a', 'b'], 'a')).toEqual(['b']);
  });

  test('D5 — « Chercher un membre » ignore accents et majuscules', () => {
    const candidats = [
      { firstname: 'Hélène', lastname: 'Durand' },
      { firstname: 'Marc', lastname: 'Petit' },
    ];
    expect(filtrerCandidats(candidats, 'helene')).toEqual([candidats[0]]);
    expect(filtrerCandidats(candidats, '  ')).toEqual(candidats);
  });

  test('D6 — le corps envoyé : nom nettoyé, membres sans doublon, icône si choisie', () => {
    expect(
      corpsDeCreation({
        icone: null,
        membres: ['a', 'b', 'a'],
        nom: '  Parents U13 ',
        quiEcrit: 'tous',
        theme: 'parents',
      }),
    ).toEqual({
      data: {
        membres: ['a', 'b'],
        nom: 'Parents U13',
        quiEcrit: 'tous',
        theme: 'parents',
      },
    });
    expect(
      corpsDeCreation({
        icone: 'flag',
        membres: ['a', 'b'],
        nom: 'Staff',
        quiEcrit: 'admins',
        theme: 'staff',
      }).data,
    ).toEqual({
      icone: 'flag',
      membres: ['a', 'b'],
      nom: 'Staff',
      quiEcrit: 'admins',
      theme: 'staff',
    });
  });
});
