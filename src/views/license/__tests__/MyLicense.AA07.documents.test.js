import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import MyLicense from '../MyLicense';

/**
 * AA07 / K2 — LES BOUTONS DU DOCUMENT DEPOSE.
 *
 * 🗣️ Adel, recette du 2026-08-20 (son point D-21) : « le depot marche. Mais les
 * boutons voir / valider / remplacer ne sont ni clairs ni comprehensibles, et
 * ils rendent une erreur quand on appuie dessus — sauf "ouvrir" ». Et : « on
 * doit pouvoir TELECHARGER le document ».
 *
 * 🔬 CE QUE LA LECTURE A MONTRE, DEFAUT PAR DEFAUT :
 *
 * 1. 🧨 LE BOUTON QUI SE CONTREDIT — « Voir ma licence » s affiche quand
 *    `officialLicenseDocument.file.url` existe, mais agit sur
 *    `officialLicenseDocument.SUBMISSION.file.url`. Deux chemins differents pour
 *    un seul bouton : des que le serveur remplit l un sans l autre, le bouton
 *    apparait et repond « Document indisponible ». C est exactement la forme du
 *    defaut decrit — un bouton visible qui rend une erreur.
 *
 * 2. 📛 LE LIBELLE QUI MENT — « Telecharger le modele » n a jamais rien
 *    telecharge : il appelait `LinksPlatform.openUrl`, c est-a-dire OUVRIR.
 *
 * 3. 🚫 LE TELECHARGEMENT ABSENT — aucun geste ne posait le fichier dans le
 *    telephone. C est la demande explicite d Adel.
 *
 * ⛔ CE QUE CE TEMOIN NE PROUVE PAS, ET NE PRETEND PAS PROUVER : l erreur
 * SERVEUR eventuelle derriere « Valider » (ecran du club) ne se reproduit pas
 * ici — elle demande un vrai appel. Elle est nommee dans le compte rendu.
 */

/** @type {any} */
let mockMesCotisations;
/** @type {any[]} */
const mockBoutons = [];
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

jest.mock('@/components/atoms/button/Button', () => function ButtonMock(/** @type {any} */ props) {
  mockBoutons.push(props);
  return null;
});

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
 * @param {any} officialLicenseDocument la licence officielle telle que le serveur la rend
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
 * Monte l ecran sur une cotisation donnee.
 * @param {any} affectation la cotisation a afficher
 * @returns {void}
 */
const monter = (affectation) => {
  mockBoutons.length = 0;
  mockMesCotisations = {
    data: [affectation], isError: false, isLoading: false, refetch: jest.fn(),
  };

  act(() => {
    arbre = renderer.create(
      <MyLicense
        navigation={{ navigate: jest.fn(), setOptions: jest.fn() }}
        route={{ params: {} }}
      />,
    );
  });
};

/**
 * Retrouve un bouton par un morceau de son libelle.
 * @param {string} morceau texte cherche dans le titre
 * @returns {any} le bouton, ou undefined
 */
const bouton = (morceau) => mockBoutons.find(
  (item) => String(item?.title || '').toLowerCase().includes(morceau.toLowerCase()),
);

describe('AA07 / K2 — telecharger le document', () => {
  it('un depot offre le TELECHARGEMENT en plus de l ouverture', async () => {
    monter(cotisation());

    expect(bouton('Ouvrir')).toBeTruthy();
    // 🎯 LA DEMANDE D ADEL : « on doit pouvoir telecharger le document ».
    const telechargement = bouton('Télécharger le document');
    expect(telechargement).toBeTruthy();

    await act(async () => { await telechargement.onPress(); });
    expect(mockTelecharger).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://api.test/uploads/mon-certificat.pdf' }),
    );
  });

  it('« Telecharger le modele » telecharge VRAIMENT le modele', async () => {
    monter(cotisation());

    const modele = bouton('modèle');
    expect(modele).toBeTruthy();

    await act(async () => { await modele.onPress(); });
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

    const voir = bouton('ma licence');
    expect(voir).toBeTruthy();

    await act(async () => { await voir.onPress(); });

    expect(alerte).not.toHaveBeenCalled();
    expect(mockOuvrirUrl).toHaveBeenCalledWith('https://api.test/uploads/licence-officielle.pdf');
    alerte.mockRestore();
  });

  it('sans AUCUN fichier, aucun bouton de licence n est propose', () => {
    // 🔒 GARDE-FOU : reparer la contradiction ne doit pas faire apparaitre un
    // bouton la ou il n y a rien a ouvrir — ce serait le meme defaut, inverse.
    monter(cotisation({ request: { name: 'Licence officielle' }, submission: null }));

    expect(bouton('ma licence')).toBeFalsy();
  });
});
