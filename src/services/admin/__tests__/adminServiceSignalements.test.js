import { getAdminReports } from '@/services/admin/adminService';

/**
 * ADMIN-SIGNALEMENTS — L ECRAN « A TRAITER » DEMANDAIT DES CHAMPS QUI N EXISTENT PAS.
 *
 * 🧨 CONSTATE EN PRODUCTION le 2026-09-09 a 13h45, sur le telephone d Adel, build
 * 2.6.37 (Sentry REACT-NATIVE-2 / SERVEUR-STRAPI-8) :
 *
 *   GET http://api.foundclubpro.com/api/event-reports  ->  400
 *   ValidationError: Invalid key author   { param: "populate", source: "query" }
 *   GET .../api/chat-message-reports      ->  400
 *   ValidationError: Invalid key chat     { param: "populate", source: "query" }
 *   view_names: ["AdminReports"]
 *
 * Strapi 5 REFUSE la requete entiere des qu une cle de `populate` ne correspond a
 * aucun attribut du modele — il ne l ignore pas. Les deux appels de l ecran
 * partaient donc en erreur, et l ecran « A traiter » du super-admin restait mort.
 *
 * LES SCHEMAS REELS DU SERVEUR, verifies un par un :
 *   · `event-report`        : user · reason · event        (PAS d `author`, PAS de `createdBy`)
 *   · `chat-message-report` : message · user               (PAS de `chat`, PAS d `author`)
 *   · `chat-message`        : message · sender · chat      (l auteur s appelle `sender`)
 *
 * ⚠️ CE TEMOIN NE RECOPIE PAS UN SCHEMA — il interdit nommement les quatre cles que
 * le serveur a REFUSEES en vrai. Deux tableaux ecrits a la main qui se comparent
 * l un a l autre restent verts en decrivant un ecran faux (piege du 08/09).
 */

const mockGet = jest.fn();

// `react-native-device-info` reclame un module natif des l import : sans ce double,
// la SUITE ENTIERE meurt avant le premier temoin (« new NativeEventEmitter() »).
jest.mock('@/platform/device', () => ({
  __esModule: true,
  default: {
    getAppVersion: () => '0.0.0',
    getDeviceId: () => 'appareil-de-test',
    getDeviceInfo: () => ({}),
    isDesktop: () => false,
  },
}));

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    get: (...args) => mockGet(...args),
    post: jest.fn(),
    put: jest.fn(),
  },
}));

/** Les cles que la production a refusees, pour chaque appel. */
const CLES_REFUSEES_PAR_LE_SERVEUR = {
  '/chat-message-reports': ['chat', 'author', 'message.author', 'createdBy'],
  '/event-reports': ['author', 'createdBy'],
};

/**
 * Les parametres envoyes a une adresse.
 * @param {string} adresse - L adresse appelee.
 * @returns {any} Les parametres de l appel.
 */
const parametresDe = (adresse) => mockGet.mock.calls
  .find(([url]) => url === adresse)?.[1]?.params;

beforeEach(() => {
  mockGet.mockReset();
  mockGet.mockResolvedValue({ data: { data: [] } });
});

test('SIGNALEMENTS/1 — aucune des cles refusees par le serveur n est encore envoyee', async () => {
  await getAdminReports();

  Object.entries(CLES_REFUSEES_PAR_LE_SERVEUR).forEach(([adresse, clesInterdites]) => {
    const populate = parametresDe(adresse)?.populate || [];
    clesInterdites.forEach((cle) => {
      expect({ adresse, populate }).toEqual({
        adresse,
        populate: expect.not.arrayContaining([cle]),
      });
    });
  });
});

test('SIGNALEMENTS/2 — les vraies relations, elles, sont toujours demandees', async () => {
  // Sans elles l ecran perd l evenement signale, le salon et l auteur du message.
  await getAdminReports();

  expect(parametresDe('/event-reports').populate).toEqual(
    expect.arrayContaining(['event', 'event.team', 'user']),
  );
  expect(parametresDe('/chat-message-reports').populate).toEqual(
    expect.arrayContaining(['message', 'message.chat', 'message.sender', 'user']),
  );
});

test('SIGNALEMENTS/3 — un message signale montre son texte et le nom de son auteur', async () => {
  // Le champ texte d un message s appelle `message`, et son auteur `sender`.
  // La fiche lisait `content` / `text` / `body` et `author` : quatre noms qui
  // n existent pas ⇒ elle affichait « Signalement de message » et « Conversation ».
  mockGet.mockImplementation((adresse) => {
    if (adresse !== '/chat-message-reports') return Promise.resolve({ data: { data: [] } });
    return Promise.resolve({
      data: {
        data: [{
          createdAt: '2026-09-09T13:45:00.000Z',
          documentId: 'signalement-1',
          message: {
            chat: { documentId: 'salon-1' },
            documentId: 'message-1',
            message: 'texte signale par un joueur',
            sender: { firstname: 'Bob', lastname: 'Martin' },
          },
          user: { firstname: 'Ada', lastname: 'Lovelace' },
        }],
      },
    });
  });

  const { data } = await getAdminReports();

  expect(data).toHaveLength(1);
  expect(data[0].message).toBe('texte signale par un joueur');
  expect(data[0].authorLabel).toBe('Ada Lovelace');
  expect(data[0].targetLabel).toBe('Conversation avec Bob Martin');
});
