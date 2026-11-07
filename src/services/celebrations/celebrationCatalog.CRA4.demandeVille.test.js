/* eslint-disable max-len -- des phrases entieres, comparees telles quelles */
// 🏛️ COLL-R-APP-CREATION (13/10/2026, COL-003, décision d'Adel « D2- A ») — APRÈS « CRÉER », UNE
// SÉANCE QUI ATTEND LA MAIRIE N'ANNONCE PLUS « Événement créé » : le bandeau dit « Demande envoyée à
// la Ville de … », la suite (texte de l'accusé de « Demander un créneau », P8v2) et propose « Voir mes
// demandes ». Le VRAI i18next en français (fr.js) ; la navigation est doublée. ROUGE avant le lot.
require('@/theme/strings');

jest.mock('@/navigation/navigationService', () => ({ navigate: jest.fn(() => true) }));

const { navigate } = require('@/navigation/navigationService');
const { RouteNames } = require('@/navigation/routeNames');

const { buildCelebrationPayload } = require('./celebrationCatalog');
const { celebrate, subscribeToCelebrations } = require('./celebrationRuntime');

const CONTEXTE = {
  clubId: 'club-A',
  eventCount: 1,
  eventId: 'ev-1',
  eventName: 'Entraînement U13',
  teamId: 'u13',
  ville: 'Ville de Montrivage',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('COLL-R-APP-CREATION — le bandeau « Demande envoyée à la Ville »', () => {
  test('il nomme la Ville, dit la suite, et propose « Voir mes demandes »', () => {
    const payload = buildCelebrationPayload('event_city_request_sent', CONTEXTE);
    expect(payload).toEqual(expect.objectContaining({
      actionLabel: 'Voir mes demandes',
      body: 'La mairie l’accepte ou la refuse. Tu reçois sa réponse en notification, avec son mot.',
      title: 'Demande envoyée à la Ville de Montrivage',
      variant: 'banner',
    }));
    // Pas d'or : l'or est réservé à la League (décision de design du 01/10).
    expect(payload.tone).toBe('info');
  });

  test('« Voir mes demandes » ouvre « Tes demandes à la Ville » du club', () => {
    const payload = buildCelebrationPayload('event_city_request_sent', CONTEXTE);
    expect(typeof payload.onAction).toBe('function');
    payload.onAction();
    expect(navigate).toHaveBeenCalledWith(RouteNames.ClubSlotRequests, { clubId: 'club-A' });
  });

  test('sans le nom de la Ville : « Demande envoyée à la Ville »', () => {
    const payload = buildCelebrationPayload('event_city_request_sent', { ...CONTEXTE, ville: null });
    expect(payload.title).toBe('Demande envoyée à la Ville');
  });

  // RETOURS-TESTEUR-2 (06/11/2026, M0232 « B ») : plus de bandeau, une fenêtre à fermer soi-même ;
  // le geste « Voir mes demandes » y est un bouton.
  test('la fenêtre émise garde son geste « Voir mes demandes »', () => {
    // eslint-disable-next-line global-require -- l Alert reelle, espionnee
    const alerte = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});
    const recus = [];
    const desabonner = subscribeToCelebrations((charge) => { recus.push(charge); });
    celebrate('event_city_request_sent', CONTEXTE);
    desabonner();
    expect(recus).toHaveLength(0);
    const boutons = alerte.mock.calls[0][2];
    expect(typeof boutons[1].onPress).toBe('function');
    alerte.mockRestore();
  });

  test('« Événement créé » ne change pas : aucun geste', () => {
    const payload = buildCelebrationPayload('event_created', CONTEXTE);
    expect(payload.title).toBe('Événement créé');
    expect('onAction' in payload).toBe(false);
  });
});
