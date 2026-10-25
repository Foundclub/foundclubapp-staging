import { libelleUnique } from '../alerteEvenement';

// 🐞 BUGHUNT P3-14 (BH06) — la numérotation COMPTAIT les doublons au lieu de chercher un
// numéro libre : avec « Lyon » et « Lyon (3) », la nouvelle alerte s'appelait encore « Lyon (3) ».

describe('BH06 P3-14 — un nom d alerte toujours libre', () => {
  test('« Lyon » et « Lyon (3) » pris ⇒ « Lyon (2) »', () => {
    expect(libelleUnique('Lyon', [{ label: 'Lyon' }, { label: 'Lyon (3)' }])).toBe('Lyon (2)');
  });

  test('« Lyon », « Lyon (2) » pris ⇒ « Lyon (3) »', () => {
    expect(libelleUnique('Lyon', [{ label: 'Lyon' }, { label: 'Lyon (2)' }])).toBe('Lyon (3)');
  });

  test('« Lyon (2) » seul pris : « Lyon » est libre', () => {
    expect(libelleUnique('Lyon', [{ label: 'Lyon (2)' }])).toBe('Lyon');
  });
});
