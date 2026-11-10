import { arriveeSansRoleSportif, identiteComplete, suiteApresIdentite } from './arriveeSansRole';

// GERANT-INSCRIPTION (10/11/2026) — témoins de la règle d'arrivée d'un compte sans rôle sportif,
// partagée par le téléphone (PrivateNavigator) et le site (SharedHomeRoute).
const IDENTITE = { birthdate: '1990-05-12', firstname: 'Gérant', lastname: 'Recette' };

describe('arriveeSansRoleSportif', () => {
  it('un compte qui gère un complexe, identité complète, arrive sur son complexe', () => {
    expect(arriveeSansRoleSportif({ compte: IDENTITE, complexesGeres: 1 })).toBe('complexe');
  });

  it('un compte qui gère un complexe SANS identité (compte 982) la complète d’abord', () => {
    expect(arriveeSansRoleSportif({ compte: {}, complexesGeres: 1 })).toBe('identite');
    expect(arriveeSansRoleSportif({
      compte: { ...IDENTITE, birthdate: null },
      complexesGeres: 1,
    })).toBe('identite');
    expect(arriveeSansRoleSportif({
      compte: { ...IDENTITE, lastname: '  ' },
      complexesGeres: 1,
    })).toBe('identite');
  });

  it('la Ville garde la priorité sur le complexe (ordre d’avant)', () => {
    expect(arriveeSansRoleSportif({ compte: {}, complexesGeres: 1, villesGerees: 1 })).toBe('ville');
    expect(arriveeSansRoleSportif({ compte: {}, complexesGeres: 1, demandeVille: true }))
      .toBe('demande-ville');
  });

  it('un compte neuf, sans rien, choisit son statut', () => {
    expect(arriveeSansRoleSportif({ compte: IDENTITE })).toBe('statut');
    expect(arriveeSansRoleSportif({})).toBe('statut');
  });
});

describe('identiteComplete', () => {
  it('veut prénom, nom ET date de naissance', () => {
    expect(identiteComplete(IDENTITE)).toBe(true);
    expect(identiteComplete({ ...IDENTITE, firstname: '' })).toBe(false);
    expect(identiteComplete(null)).toBe(false);
  });
});

describe('suiteApresIdentite', () => {
  it('« Qui es-tu ? » d’un gérant mène à son complexe, ou à la fiche s’il n’en a pas encore', () => {
    expect(suiteApresIdentite({ complexesGeres: 1, intentionComplexe: false })).toBe('complexe');
    expect(suiteApresIdentite({ complexesGeres: 0, intentionComplexe: true })).toBe('fiche-complexe');
  });

  it('un autre compte suit son parcours habituel', () => {
    expect(suiteApresIdentite({ complexesGeres: 0, intentionComplexe: false })).toBeNull();
    expect(suiteApresIdentite({})).toBeNull();
  });
});
