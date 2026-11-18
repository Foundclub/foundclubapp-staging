/**
 * T-PAGES-6b (18/11/2026, points 5 et 6 de T-PAGES-6, chef « nuit du 18/11 ») — LE TOURNOI RETENU
 * PENDANT LA CRÉATION DU COMPTE. La fiche (bouton du visiteur) et l'aperçu d'une invitation le
 * posent ; l'écran du numéro et celui du rôle le LISENT sans l'effacer ; le retour au tournoi
 * l'efface. Une heure, comme le retour au tournoi.
 * ROUGE avant le lot : le module n'existait pas.
 */
const mockRangement = new Map();
jest.mock('@/platform/storage', () => ({
  getItem: (/** @type {string} */ cle) => mockRangement.get(cle),
  removeItem: (/** @type {string} */ cle) => { mockRangement.delete(cle); },
  setItem: (/** @type {string} */ cle, /** @type {string} */ valeur) => {
    mockRangement.set(cle, valeur);
  },
}));

const {
  decrireLInscriptionAuTournoi,
  DUREE_DE_L_INSCRIPTION_AU_TOURNOI_MS,
  lireLInscriptionAuTournoi,
  oublierLInscriptionAuTournoi,
  retenirLInscriptionAuTournoi,
} = require('../inscriptionEnCours');

const T0 = Date.parse('2026-11-18T00:00:00.000Z');
const TOURNOI = {
  date: '2026-12-19T18:00:00.000Z',
  documentId: 'evt-3442',
  name: 'Tournoi FoundClub x AR Soccer',
};

beforeEach(() => mockRangement.clear());

test('🔴 retenu puis lu deux fois : la lecture n efface pas', () => {
  retenirLInscriptionAuTournoi({ event: TOURNOI }, T0);
  const attendu = {
    date: TOURNOI.date, equipe: null, eventId: 'evt-3442', nom: 'Tournoi FoundClub x AR Soccer',
  };
  expect(lireLInscriptionAuTournoi(T0 + 1000)).toEqual(attendu);
  expect(lireLInscriptionAuTournoi(T0 + 2000)).toEqual(attendu);
});

test('🔴 l équipe facultative est gardée, et le bandeau la nomme', () => {
  retenirLInscriptionAuTournoi({ equipe: 'Les Kaïras', event: TOURNOI }, T0);
  const retenu = lireLInscriptionAuTournoi(T0);
  expect(retenu?.equipe).toBe('Les Kaïras');
  expect(decrireLInscriptionAuTournoi(retenu)).toEqual({
    equipe: 'Les Kaïras', jour: 'Sam. 19 déc.', tournoi: 'Tournoi FoundClub x AR Soccer',
  });
});

test('🔴 effacé par le retour au tournoi ; périmé après une heure', () => {
  retenirLInscriptionAuTournoi({ event: TOURNOI }, T0);
  oublierLInscriptionAuTournoi();
  expect(lireLInscriptionAuTournoi(T0)).toBeNull();
  retenirLInscriptionAuTournoi({ event: TOURNOI }, T0);
  expect(lireLInscriptionAuTournoi(T0 + DUREE_DE_L_INSCRIPTION_AU_TOURNOI_MS)).toBeNull();
  expect(DUREE_DE_L_INSCRIPTION_AU_TOURNOI_MS).toBe(60 * 60 * 1000);
});

test('caractérisant : sans tournoi, sans nom ou rangement illisible, rien ne répond', () => {
  expect(lireLInscriptionAuTournoi(T0)).toBeNull();
  retenirLInscriptionAuTournoi({ event: { documentId: 'evt-1', name: '' } }, T0);
  expect(lireLInscriptionAuTournoi(T0)).toBeNull();
  retenirLInscriptionAuTournoi({ event: null }, T0);
  expect(lireLInscriptionAuTournoi(T0)).toBeNull();
  mockRangement.set('inscription-au-tournoi', '{pas du json');
  expect(lireLInscriptionAuTournoi(T0)).toBeNull();
  expect(decrireLInscriptionAuTournoi(null)).toBeNull();
});

test('caractérisant : seul le tournoi est rangé, jamais une personne', () => {
  retenirLInscriptionAuTournoi({
    equipe: 'Les Kaïras',
    event: { ...TOURNOI, organizer: { firstname: 'Dorian', phone: '+33600000000' } },
  }, T0);
  const brut = String(mockRangement.get('inscription-au-tournoi'));
  expect(brut).not.toMatch(/Dorian|\+336|organizer/);
});
