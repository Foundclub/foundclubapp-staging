/**
 * Filet AD05 (E6) — LE TUYAU DE L'EXPORT SAIT DEMANDER LA VERSION SANS
 * COORDONNEES.
 *
 * `exportEventParticipants` n'avait AUCUN test propre : les 6 fichiers qui la
 * citaient la remplaçaient par un `jest.fn()` vide. L'audit du 2026-08-20 le
 * dit ligne 468 : « Export et relance : 0 assertion ».
 *
 * Ce que ce fichier verrouille, et pourquoi les deux moitiés comptent autant :
 *
 *  1. LA MOITIE QUI NE DOIT PAS BOUGER. `EventDetails.js` (lot AD01) appelle la
 *     fonction avec DEUX arguments. Le troisième est optionnel et son absence
 *     doit laisser l'URL d'aujourd'hui, à l'octet près. Un défaut qui basculerait
 *     par accident sur « sans coordonnées » ferait perdre des colonnes à un
 *     entraîneur qui n'a rien demandé.
 *
 *  2. LA MOITIE NEUVE. Avec `{ withoutContacts: true }`, l'URL gagne son
 *     paramètre — et le NOM DU FICHIER téléchargé le dit aussi. Un fichier qui
 *     ment sur son contenu est pire que pas de fichier : « participants_U15.xlsx »
 *     posé dans le dossier Téléchargements ne dit pas s'il porte le carnet
 *     d'adresses de l'équipe.
 *
 * Point d'observation : l'URL et le chemin réellement passés à
 * `ReactNativeBlobUtil`, pas ce que le code croit envoyer.
 */

const mockFetch = jest.fn(async () => ({ path: () => '/telechargements/participants.xlsx' }));
const mockConfig = jest.fn(() => ({ fetch: mockFetch }));
const mockScanFile = jest.fn(async () => {});

jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: {
    config: mockConfig,
    fs: {
      dirs: { DocumentDir: '/documents', DownloadDir: '/telechargements' },
      scanFile: mockScanFile,
    },
  },
}));

jest.mock('@/domains/auth/authUseCases', () => ({
  getAuthTokens: () => ({ token: 'jeton-de-test' }),
}));

jest.mock('@/config/runtimeUrls', () => ({
  getApiBaseUrl: () => 'https://api.test',
}));

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  },
}));

jest.mock('@/services/celebrations/celebrationRuntime', () => ({
  celebrate: jest.fn(),
}));

jest.mock('@/domains/guidance/guidanceRuntime', () => ({
  emitGuidanceAction: jest.fn(),
}));

const { exportEventParticipants } = require('../eventService');

const EVENEMENT_ID = 'evt-ad05';
const NOM_EVENEMENT = 'U15 A';

/**
 * L'URL réellement partie sur le réseau.
 * @returns {string} - L'URL demandée.
 */
const urlDemandee = () => mockFetch.mock.calls[0][1];

/**
 * Le chemin où le fichier a été déposé sur le téléphone.
 * @returns {string} - Le chemin du fichier.
 */
const cheminDepose = () => mockConfig.mock.calls[0][0].path;

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// 🛟 LA MOITIE QUI NE DOIT PAS BOUGER — AD01 appelle avec 2 arguments
// ---------------------------------------------------------------------------

describe('AD05/T6 — le tuyau de l export', () => {
  it('appelée avec 2 arguments, ne demande RIEN de neuf dans l URL', async () => {
    await exportEventParticipants(EVENEMENT_ID, NOM_EVENEMENT);

    expect(urlDemandee()).toBe('https://api.test/events/evt-ad05/export-participants');
    expect(urlDemandee()).not.toContain('withoutContacts');
  });

  it('appelée avec 2 arguments, garde le nom de fichier d aujourd hui', async () => {
    await exportEventParticipants(EVENEMENT_ID, NOM_EVENEMENT);

    expect(cheminDepose()).toContain('participants_U15_A.xlsx');
    expect(cheminDepose()).not.toContain('sans_coordonnees');
  });

  // -------------------------------------------------------------------------
  // 🎯 LA MOITIE NEUVE — la bascule voyage jusqu au serveur
  // -------------------------------------------------------------------------

  it('avec { withoutContacts: true }, l URL finit par ?withoutContacts=1', async () => {
    await exportEventParticipants(EVENEMENT_ID, NOM_EVENEMENT, { withoutContacts: true });

    expect(urlDemandee()).toBe(
      'https://api.test/events/evt-ad05/export-participants?withoutContacts=1',
    );
  });

  it('avec { withoutContacts: true }, le NOM du fichier le dit aussi', async () => {
    await exportEventParticipants(EVENEMENT_ID, NOM_EVENEMENT, { withoutContacts: true });

    expect(cheminDepose()).toContain('participants_U15_A_sans_coordonnees.xlsx');
  });

  it('un objet d options vide se comporte exactement comme l appel à 2 arguments', async () => {
    await exportEventParticipants(EVENEMENT_ID, NOM_EVENEMENT, {});

    expect(urlDemandee()).not.toContain('withoutContacts');
    expect(cheminDepose()).not.toContain('sans_coordonnees');
  });
});
