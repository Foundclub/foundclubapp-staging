import { situationDeLAnnulation } from '../annulationDeLaDemande';

/**
 * PAR-L8 (13/10, design parent E19, planche 8) — CE QUE LA RÉPONSE DU SERVEUR VEUT DIRE.
 *
 * « Annuler la demande » a quatre issues, et chacune a SA phrase sur la fiche de l'enfant :
 *   · effacée                               → « Demande annulée. » (pas d'erreur) ;
 *   · le club l'a acceptée entre-temps      → « Le club a déjà répondu. Lea est dans U11. » ;
 *   · le club l'a refusée (ou elle a disparu) → « Le club a déjà répondu à cette demande. » ;
 *   · pas de réseau, panne                  → « La demande n'a pas pu être annulée. » + Réessayer.
 * Et une cinquième, qui n'est pas une panne : un SERVEUR D'AVANT, sans la route (404 nu) ou sans
 * le droit (403) → « L'annulation n'est pas encore disponible. » — jamais un plantage.
 *
 * L'erreur arrive telle que l'intercepteur la rejette (`client.native.js`, `resetAuth`) : le
 * `error` de Strapi (`{ status, name, message, details }`), une chaîne (« Network Error »), ou
 * l'objet d'abandon (`status: 0`).
 */

const close = (accepted) => ({
  details: { accepted, code: 'CLUB_INTEREST_REQUEST_ALREADY_RESPONDED' },
  message: 'Club interest request already responded',
  name: 'ValidationError',
  status: 400,
});

test('🔴 acceptée entre-temps : « acceptee » (l enfant est dans l équipe)', () => {
  expect(situationDeLAnnulation(close(true))).toBe('acceptee');
});

test('🔴 close sans acceptation : « repondue »', () => {
  expect(situationDeLAnnulation(close(false))).toBe('repondue');
});

test('🔴 effacée (refusée, déjà annulée) : 404 AVEC le code du serveur ⇒ « repondue »', () => {
  expect(situationDeLAnnulation({
    details: { code: 'CLUB_INTEREST_REQUEST_GONE' },
    message: 'Club interest request not found',
    name: 'NotFoundError',
    status: 404,
  })).toBe('repondue');
});

test('🔴 serveur d AVANT : la route n existe pas (404 nu de Strapi) ⇒ « indisponible »', () => {
  expect(situationDeLAnnulation({
    details: {}, message: 'Not Found', name: 'NotFoundError', status: 404,
  })).toBe('indisponible');
});

test('🔴 serveur d AVANT : le rôle n a pas encore le droit (403) ⇒ « indisponible »', () => {
  expect(situationDeLAnnulation({
    details: {}, message: 'Forbidden', name: 'ForbiddenError', status: 403,
  })).toBe('indisponible');
});

test('🔴 pas de réseau, abandon, panne du serveur ⇒ « echec » (on peut réessayer)', () => {
  expect(situationDeLAnnulation('Network Error')).toBe('echec');
  expect(situationDeLAnnulation({ code: 'ECONNABORTED', status: 0 })).toBe('echec');
  expect(situationDeLAnnulation({ message: 'Internal Server Error', status: 500 })).toBe('echec');
  expect(situationDeLAnnulation(undefined)).toBe('echec');
});

test('la forme axios brute (avant l intercepteur) se lit aussi', () => {
  expect(situationDeLAnnulation({
    response: { data: { error: close(true) }, status: 400 },
  })).toBe('acceptee');
});
