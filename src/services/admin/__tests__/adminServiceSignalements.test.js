import { getAdminReports, markAdminReportTreated } from '@/services/admin/adminService';

// I18N-3 : les textes passent par i18next.t, qui rend undefined sans initialisation.
// Le double lit le vrai fr.js, puis le repli, et remplit les {{jetons}} : le temoin
// affirme toujours le texte francais affiche.
jest.mock('i18next', () => {
  const catalogue = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    __esModule: true,
    default: {
      language: 'fr',
      t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ options) => {
        const valeur = String(cle).split('.').reduce(
          (/** @type {any} */ noeud, segment) => (noeud == null ? undefined : noeud[segment]),
          catalogue,
        );
        const gabarit = typeof valeur === 'string' ? valeur : String(repli);
        return gabarit.replace(/\{\{(\w+)\}\}/g, (_tout, nom) => String((options || {})[nom] ?? ''));
      },
    },
  };
});

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
const mockPut = jest.fn();

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
    put: (...args) => mockPut(...args),
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

// ---------------------------------------------------------------------------
// SIGNALTRAITE (25/10) — « À traiter / Traités », « Marquer traité »
// ---------------------------------------------------------------------------

test('SIGNALTRAITE/1 — « À traiter » : les lignes sans statut ou en attente', async () => {
  await getAdminReports({ treated: false });
  const attendu = { $or: [{ status: { $null: true } }, { status: { $eq: 'pending' } }] };
  expect(parametresDe('/event-reports').filters).toEqual(attendu);
  expect(parametresDe('/chat-message-reports').filters).toEqual(attendu);
});

test('SIGNALTRAITE/2 — « Traités » : les signalements traités, et qui les a traités', async () => {
  await getAdminReports({ treated: true });
  expect(parametresDe('/event-reports').filters).toEqual({ status: { $eq: 'resolved' } });
  expect(parametresDe('/chat-message-reports').filters).toEqual({ status: { $eq: 'resolved' } });
  ['/event-reports', '/chat-message-reports'].forEach((adresse) => {
    expect(parametresDe(adresse).populate).toEqual(expect.arrayContaining(['treatedBy']));
  });
});

test('SIGNALTRAITE/3 — un signalement traité dit quand, et par qui', async () => {
  mockGet.mockImplementation((adresse) => Promise.resolve({
    data: {
      data: adresse === '/event-reports' ? [{
        documentId: 'rep-1',
        reason: 'horaire faux',
        status: 'resolved',
        treatedAt: '2026-10-24T09:30:00.000Z',
        treatedBy: { firstname: 'Adel', lastname: 'F.' },
      }] : [],
    },
  }));
  const { data } = await getAdminReports({ treated: true });
  expect(data[0]).toEqual(expect.objectContaining({
    status: 'resolved',
    treatedAt: '2026-10-24T09:30:00.000Z',
    treatedByLabel: 'Adel F.',
  }));
});

test('SIGNALTRAITE/4 — « Marquer traité » appelle la route SuperAdmin de SA source', async () => {
  mockPut.mockResolvedValue({ data: { data: { status: 'resolved' } } });
  await markAdminReportTreated({ documentId: 'rep-msg', source: 'message' });
  await markAdminReportTreated({ documentId: 'rep-evt', source: 'event' });
  expect(mockPut.mock.calls.map(([adresse]) => adresse)).toEqual([
    '/chat-message-reports/rep-msg/treat',
    '/event-reports/rep-evt/treat',
  ]);
});
