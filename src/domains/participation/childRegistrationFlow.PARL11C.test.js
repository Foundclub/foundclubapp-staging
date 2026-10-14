import {
  canCancelRegistration,
  cancelSituation,
} from './childRegistrationFlow';

// 👪 PAR-L11c (14/10) — LES RESTES DE « INSCRIRE MES ENFANTS » (PAR-012), cote regles pures.
// ⏳ Dates relatives a aujourd hui (garde-fou `temoins:horloge`).
const MAINTENANT = Date.now();
const JOUR = 24 * 3600 * 1000;
const DANS_UNE_SEMAINE = new Date(MAINTENANT + 7 * JOUR).toISOString();
const HIER = new Date(MAINTENANT - JOUR).toISOString();

const inscription = (status, date = DANS_UNE_SEMAINE) => ({
  child: { documentId: 'anissa', firstname: 'Anissa' },
  documentId: 'r-1',
  event: { date, documentId: 'evt-1', name: 'Detection U11' },
  status,
});

describe('PAR-L11c point 1 — quelle inscription peut-on annuler ?', () => {
  test('en attente ou confirmee, a venir : oui', () => {
    expect(canCancelRegistration(inscription('pending'), MAINTENANT)).toBe(true);
    expect(canCancelRegistration(inscription('accepted'), MAINTENANT)).toBe(true);
  });

  test('refusee : non (rien a annuler) ; evenement passe : non', () => {
    expect(canCancelRegistration(inscription('declined'), MAINTENANT)).toBe(false);
    expect(canCancelRegistration(inscription('pending', HIER), MAINTENANT)).toBe(false);
  });

  test('sans date lue : le serveur reste juge, le lien est montre', () => {
    expect(canCancelRegistration(inscription('pending', null), MAINTENANT)).toBe(true);
  });
});

describe('PAR-L11c point 1 — ce que veut dire le refus d une annulation', () => {
  test('404 du tiroir (« Registration not found ») : l inscription n existe plus', () => {
    expect(cancelSituation({
      message: 'Registration not found', name: 'NotFoundError', status: 404,
    })).toBe('gone');
  });

  test('serveur d avant : 404 sans ce motif (route absente) ou 403 (droit absent)', () => {
    expect(cancelSituation({ message: 'Not Found', name: 'NotFoundError', status: 404 }))
      .toBe('unavailable');
    expect(cancelSituation({ message: 'Forbidden', name: 'ForbiddenError', status: 403 }))
      .toBe('unavailable');
  });

  test('le reste (pas de reseau, abandon, panne) : un echec qu on peut relancer', () => {
    expect(cancelSituation('Network Error')).toBe('failed');
    expect(cancelSituation({ code: 'REQUEST_TIMEOUT_ABANDONED', status: 0 })).toBe('failed');
    expect(cancelSituation({ message: 'Internal Server Error', status: 500 })).toBe('failed');
  });
});
