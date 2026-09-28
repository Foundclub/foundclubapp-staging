import texteInsecable from '../texteInsecable';

// FINITIONS (recette émulateur du 2026-09-28, Android 16) — « Version » au lieu de
// « Version 2 » sur la pastille de « Tu es convoqué ». Une PASTILLE épouse forcément la
// largeur de son texte ; sous Android 16, un texte gras de plusieurs mots y perd son
// dernier mot, alors qu'un mot seul (« Titulaire », « Remplaçant ») reste entier.
// ⇒ Le texte d'une pastille n'offre plus aucun point de coupure : ses espaces
// deviennent insécables. Écrit ROUGE (le module n'existait pas).

const INSECABLE = String.fromCharCode(160);

describe('FINITIONS — texteInsecable', () => {
  it('remplace chaque espace par une espace insécable', () => {
    expect(texteInsecable('Version 2')).toBe(`Version${INSECABLE}2`);
    expect(texteInsecable('Pas encore partagé')).toBe(`Pas${INSECABLE}encore${INSECABLE}partagé`);
  });

  it('ne laisse aucun point de coupure', () => {
    expect(texteInsecable('Sans réponse')).not.toMatch(/ /);
  });

  it('un mot seul ressort identique', () => {
    expect(texteInsecable('Titulaire')).toBe('Titulaire');
  });

  it('rien ou autre chose qu un texte : une chaîne, jamais « undefined »', () => {
    expect(texteInsecable(undefined)).toBe('');
    expect(texteInsecable(null)).toBe('');
    expect(texteInsecable(2)).toBe('2');
  });
});
