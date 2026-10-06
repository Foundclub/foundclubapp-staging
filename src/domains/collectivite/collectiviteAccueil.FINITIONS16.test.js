import { doitChoisirSonStatut } from './collectiviteAccueil';

// FINITIONS16 · POINT 11 (tournee T15, SUR LE SITE) — un compte NEUF (role Authenticated, tunnel
// pas fait), choisi par « Changer de compte », arrivait sur l'accueil « Joueur » au lieu du tunnel,
// meme apres rechargement. Le telephone, lui, remonte sa pile sur le compte choisi et ouvre le
// tunnel (PrivateNavigator : « Ville seule » d'abord, sinon la premiere etape due).
// L'accueil du site ne renvoyait qu'aux etapes d'AGE (AGE-OBLIGATOIRE-2, « web A ») : il ne savait
// pas reconnaitre un compte « Ville seule », qu'on ne doit PAS envoyer choisir un role sportif.
// Une seule regle, a cote d'`isVilleOnlyAccount` : sans role sportif ET sans Ville, le compte
// choisit son statut. ROUGE avant (la fonction n'existait pas).

describe('FINITIONS16 11 — doitChoisirSonStatut', () => {
  test('🔴 un compte neuf, sans Ville ni demande : il choisit son statut', () => {
    expect(doitChoisirSonStatut({ hasManagerRequest: false, managedCount: 0, roleKey: 'new' }))
      .toBe(true);
  });

  test('🔒 un compte « Ville seule » (Ville geree ou demandee) : jamais le tunnel sportif', () => {
    expect(doitChoisirSonStatut({ hasManagerRequest: false, managedCount: 1, roleKey: 'new' }))
      .toBe(false);
    expect(doitChoisirSonStatut({ hasManagerRequest: true, managedCount: 0, roleKey: 'new' }))
      .toBe(false);
  });

  test('🔒 un compte qui a deja un role (joueur, dirigeant, parent…) : rien ne change', () => {
    ['player', 'president', 'coach', 'parent', 'superAdmin'].forEach((roleKey) => {
      expect(doitChoisirSonStatut({ hasManagerRequest: false, managedCount: 0, roleKey }))
        .toBe(false);
    });
  });
});
