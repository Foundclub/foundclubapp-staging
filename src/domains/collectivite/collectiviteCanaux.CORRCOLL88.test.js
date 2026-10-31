/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
import { auteurDeLApercu } from './collectiviteCanaux';

// CORR-COLLECTIVITES 88 (31/10/2026, décision d'Adel A) — la bulle d'un message de la Ville est
// signée « Ville de Montrivage », mais l'aperçu de la liste des conversations disait « Karim : … ».
// Signé par la Ville, l'aperçu dit le nom de la Ville ; sinon, le prénom calculé d'avant.
describe('CORR-COLLECTIVITES 88 — l’aperçu d’un message de la Ville', () => {
  it('signé par la Ville : « Ville de Montrivage »', () => {
    expect(auteurDeLApercu({ senderSignature: { nom: 'Ville de Montrivage', voix: 'ville' } }, 'Karim'))
      .toBe('Ville de Montrivage');
  });

  it('signé par un club, ou sans signature : le prénom d’avant', () => {
    expect(auteurDeLApercu({ senderSignature: { nom: 'AS Montrivage', voix: 'club' } }, 'Karim')).toBe('Karim');
    expect(auteurDeLApercu({}, 'Karim')).toBe('Karim');
    expect(auteurDeLApercu(null, '')).toBe('');
  });
});
