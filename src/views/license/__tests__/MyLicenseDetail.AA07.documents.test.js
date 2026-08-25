import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import MyLicenseDetail from '../MyLicenseDetail';

/**
 * AA07 / K2 — LES PIECES ET LA LICENCE, DANS LE NOUVEAU DETAIL.
 * Reecrit pour S9, vague S, sous l architecture A.
 *
 * 🗣️ Adel, recette du 2026-08-20 (son point D-21) : « le depot marche. Mais les
 * boutons voir / valider / remplacer ne sont ni clairs ni comprehensibles, et
 * ils rendent une erreur quand on appuie dessus — sauf "ouvrir" ». Et : « on
 * doit pouvoir TELECHARGER le document ».
 *
 * 🔁 CE QUI A CHANGE : la section « Documents a fournir » et la section « Ma
 * licence » fusionnent en UN bloc « Mon dossier », et les gestes passent de
 * boutons pleine largeur a des cibles de 44 px sur la ligne. Le pack le
 * demande — mais LES TROIS GARANTIES, ELLES, NE BOUGENT PAS :
 *
 *   1. 🧨 LE BOUTON QUI SE CONTREDIT — « ma licence » s affichait sur
 *      `officialLicenseDocument.file.url` mais AGISSAIT sur
 *      `officialLicenseDocument.SUBMISSION.file.url`. Deux chemins pour un seul
 *      bouton : des que le serveur remplit l un sans l autre, le bouton
 *      apparait et repond « Document indisponible ».
 *   2. 🚫 LE TELECHARGEMENT — il POSE le fichier dans le telephone, la ou
 *      « ouvrir » se contente de l AFFICHER. Deux gestes, deux libelles.
 *   3. 🔒 AUCUN BOUTON SANS FICHIER — reparer la contradiction ne doit pas
 *      faire apparaitre un geste la ou il n y a rien a ouvrir.
 */

/** @type {any} */
let mockMesCotisations;
const mockOuvrirUrl = jest.fn();
const mockTelecharger = jest.fn(() => Promise.resolve({ opened: true, outcome: 'downloads' }));
const mockMutationFigee = { isPending: false, mutate: jest.fn(), mutateAsync: jest.fn() };

jest.mock('@/services/license/licenseQueries', () => ({
  createLicenseCheckout: jest.fn(),
  declareExternalLicensePayment: jest.fn(),
  generateLicenseReceipt: jest.fn(),
  submitLicenseDocument: jest.fn(),
  useLicenseMutation: () => mockMutationFigee,
  useMyLicenseAssignment: () => ({
    data: null, isError: false, isLoading: false, refetch: jest.fn(),
  }),
  useMyLicenses: () => mockMesCotisations,
}));

jest.mock('@/theme/themeContext', () => {
  const couleurs = jest.requireActual('@/theme/colors').default();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(couleurs),
      Colors: couleurs,
      Fonts: jest.requireActual('@/theme/fonts').default(couleurs),
      Images: {},
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});

jest.mock('@/components/templates/ScreenContainer', () => function ScreenMock(
  /** @type {any} */ { children },
) {
  return children;
});

jest.mock('@/components/molecules/bottomModal/BottomModal', () => function ModalMock(
  /** @type {any} */ { children },
) {
  return children;
});

// AA07 / K2 — le telechargement natif charge `react-native-blob-util`, absent
// des `transformIgnorePatterns` du projet : chaque suite qui l atteint le mocke
// elle-meme, comme les 9 qui le faisaient deja.
jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: { config: jest.fn(), fs: { dirs: { CacheDir: '/cache' }, stat: jest.fn() } },
}));

jest.mock('@/platform/links', () => ({
  __esModule: true,
  default: { openUrl: (/** @type {any} */ ...args) => mockOuvrirUrl(...args) },
}));
jest.mock('@/platform/media', () => ({ __esModule: true, default: { pickDocument: jest.fn() } }));
jest.mock('@/platform/media/downloadRemoteFile', () => ({
  __esModule: true,
  downloadRemoteFile: (/** @type {any} */ ...args) => mockTelecharger(...args),
}));
jest.mock('@/platform/share', () => ({ __esModule: true, default: { share: jest.fn() } }));

jest.mock('@/utils/mediaUrl', () => ({
  resolveMediaUrl: (/** @type {any} */ url) => (url ? `https://api.test${url}` : ''),
}));

const DEMANDE = {
  documentId: 'req-1',
  name: 'Certificat medical',
  required: true,
  templateFile: { url: '/uploads/modele-certificat.pdf' },
};

const DEPOT = {
  documentId: 'sub-1',
  documentRequest: { documentId: 'req-1' },
  file: { url: '/uploads/mon-certificat.pdf' },
  status: 'submitted',
  submittedAt: '2026-08-01',
};

/**
 * Construit une cotisation, en laissant le test choisir la forme exacte de la
 * licence officielle — c est cette forme qui revele le defaut n°1.
 * @param {any} officialLicenseDocument la licence telle que le serveur la rend
 * @returns {any} une affectation de cotisation complete
 */
const cotisation = (officialLicenseDocument = null) => ({
  amountDueCents: 18000,
  amountPaidCents: 0,
  amountRemainingCents: 18000,
  campaign: {
    club: { name: 'FC Nord' },
    documentId: 'camp-1',
    documentRequests: [DEMANDE],
    name: 'Cotisation 2026',
    paymentModes: {},
    seasonLabel: '2026-2027',
    status: 'active',
  },
  club: { name: 'FC Nord' },
  currency: 'EUR',
  documentId: 'assign-1',
  documentSubmissions: [DEPOT],
  installments: [],
  officialLicenseDocument,
  payments: [],
  receipts: [],
  status: 'pending',
});

/** @type {any} */
let arbre = null;

afterEach(() => {
  if (arbre) {
    act(() => arbre.unmount());
    arbre = null;
  }
  jest.clearAllMocks();
});

/**
 * Monte le detail sur une cotisation donnee.
 * @param {any} affectation la cotisation a afficher
 * @returns {void}
 */
const monter = (affectation) => {
  mockMesCotisations = {
    data: [affectation], isError: false, isLoading: false, refetch: jest.fn(),
  };

  act(() => {
    arbre = renderer.create(
      <MyLicenseDetail
        navigation={{ canGoBack: () => true, goBack: jest.fn(), navigate: jest.fn() }}
        route={{ params: { assignmentId: 'assign-1' } }}
      />,
    );
  });
};

/**
 * Retrouve un geste par un morceau de son libelle — qu il soit porte par un
 * bouton (`title`) ou par une cible de 44 px (`accessibilityLabel`).
 * @param {string} morceau texte cherche
 * @returns {any} le geste, ou undefined
 */
const geste = (morceau) => arbre.root.findAll((/** @type {any} */ noeud) => {
  if (typeof noeud.props?.onPress !== 'function') return false;
  const etiquette = `${noeud.props?.title || ''} ${noeud.props?.accessibilityLabel || ''}`;
  return etiquette.toLowerCase().includes(morceau.toLowerCase());
})[0];

describe('AA07 / K2 — telecharger la piece deposee', () => {
  it('un depot offre le TELECHARGEMENT en plus de l ouverture', async () => {
    monter(cotisation());

    expect(geste('Ouvrir le document')).toBeTruthy();
    // 🎯 LA DEMANDE D ADEL : « on doit pouvoir telecharger le document ».
    const telechargement = geste('Télécharger le document');
    expect(telechargement).toBeTruthy();

    await act(async () => { await telechargement.props.onPress(); });
    expect(mockTelecharger).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://api.test/uploads/mon-certificat.pdf' }),
    );
  });

  it('« Telecharger le modele » telecharge VRAIMENT le modele', async () => {
    monter(cotisation());

    const modele = geste('modèle');
    expect(modele).toBeTruthy();

    await act(async () => { await modele.props.onPress(); });
    // 📛 AVANT : ce bouton appelait `openUrl` — il OUVRAIT, il ne
    // telechargeait pas. Le libelle promettait ce que le geste ne faisait pas.
    expect(mockTelecharger).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://api.test/uploads/modele-certificat.pdf' }),
    );
  });
});

describe('AA07 / K2 — le bouton qui se contredisait', () => {
  it('« ma licence » s ouvre meme quand le serveur ne remplit que `file`', async () => {
    // 🧨 LE CAS EXACT DU DEFAUT : la condition d affichage lit `file.url`, et
    // l ancien geste lisait `submission.file.url`. Ici `submission` n a pas de
    // fichier — le bouton s affichait donc, et repondait « indisponible ».
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    monter(cotisation({
      file: { url: '/uploads/licence-officielle.pdf' },
      request: { name: 'Licence officielle' },
      submission: { documentId: 'sub-lic', status: 'validated' },
    }));

    const voir = geste('Ouvrir ma licence');
    expect(voir).toBeTruthy();

    await act(async () => { await voir.props.onPress(); });

    expect(alerte).not.toHaveBeenCalled();
    expect(mockOuvrirUrl).toHaveBeenCalledWith('https://api.test/uploads/licence-officielle.pdf');
    alerte.mockRestore();
  });

  it('sans AUCUN fichier, aucun geste de licence n est propose', () => {
    // 🔒 GARDE-FOU : reparer la contradiction ne doit pas faire apparaitre un
    // geste la ou il n y a rien a ouvrir — ce serait le meme defaut, inverse.
    monter(cotisation({ request: { name: 'Licence officielle' }, submission: null }));

    expect(geste('Ouvrir ma licence')).toBeFalsy();
    expect(geste('Télécharger ma licence')).toBeFalsy();
  });
});

describe('S9 — les cartes d absence que le pack supprime (D3)', () => {
  it('aucune section vide ne se dessine', () => {
    // 🧹 Defaut 4 : sept sections occupaient deux ecrans et demi de scroll pour
    // n afficher que des phrases d absence. Cette cotisation n a ni paiement,
    // ni relance, ni echeancier : les trois sections doivent DISPARAITRE.
    monter(cotisation());
    const rendu = JSON.stringify(arbre.toJSON());

    expect(rendu).not.toContain('Pas d historique');
    expect(rendu).not.toContain('Aucun document');
    expect(rendu).not.toContain('Pas encore de reçu');
    expect(rendu).not.toContain('relance(s)');
    expect(rendu).not.toContain('Échéancier');
    expect(rendu).not.toContain('Non définie');
  });

  it('sans date fixee, on dit ce que ca change — jamais « Non definie »', () => {
    monter(cotisation());
    const rendu = JSON.stringify(arbre.toJSON());

    expect(rendu).toContain('Le club n a pas encore fixé de date');
  });
});
