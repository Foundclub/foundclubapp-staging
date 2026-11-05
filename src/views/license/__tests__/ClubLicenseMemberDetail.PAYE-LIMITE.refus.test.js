/* eslint-disable max-len, no-underscore-dangle -- __DEV__ est le nom impose par React Native. */
import { QueryClientProvider } from '@tanstack/react-query';
import { Alert, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { displayErrorAlert } from '@/utils/errors/displayError';

import { createFoundClubQueryClient } from '@/app/queryClient';
import ClubLicenseMemberDetail from '../ClubLicenseMemberDetail';

// PAYE-LIMITE (05/11, contre-recette du chef) — fiche perimee : le serveur refuse le montant.
// Le telephone a un filet global (`App.js:onMutationError`), le site n en a pas
// (`web/src/main.tsx` : `createFoundClubQueryClient()` sans argument). Retirer l alerte de
// l ecran pour eviter le doublon du telephone avait rendu le refus MUET sur le site.
// Ce banc garde les vrais `useLicenseMutation` et client de requetes des deux plateformes.

/** @type {any[]} */
const mockBoutons = [];
const mockRequeteVide = { data: null, isError: false, isLoading: false };
const mockInsetsFiges = {
  bottom: 0, left: 0, right: 0, top: 0,
};
/** @type {any} */
let mockCotisationRequete;
const mockAjouterPaiement = jest.fn();
const mockRembourser = jest.fn();
const mockChangerMontant = jest.fn();

jest.mock('i18next', () => {
  const { APIerrors } = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    __esModule: true,
    default: {
      exists: (/** @type {string} */ cle) => APIerrors[cle.replace('APIerrors.', '')] !== undefined,
      t: (/** @type {string} */ cle, /** @type {string} */ defaut) => (
        APIerrors[cle.replace('APIerrors.', '')] ?? defaut
      ),
    },
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsetsFiges,
}));

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();

  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: {},
      Spaces: espaces,
    }),
  };
});

// licenseQueries lit l adresse du serveur en se chargeant : ce banc ne parle a aucun serveur.
jest.mock('@/services/client', () => ({ __esModule: true, default: {} }));

jest.mock('@/services/license/licenseQueries', () => ({
  ...jest.requireActual('@/services/license/licenseQueries'),
  addManualLicensePayment: (...args) => mockAjouterPaiement(...args),
  refundLicensePayment: (...args) => mockRembourser(...args),
  updateLicenseAssignmentAmount: (...args) => mockChangerMontant(...args),
  useLicenseAssignment: () => mockCotisationRequete,
  useLicenseDashboard: () => mockRequeteVide,
}));

jest.mock('@/platform/links', () => ({ __esModule: true, default: { openUrl: jest.fn() } }));
jest.mock('@/platform/media', () => ({ __esModule: true, default: { pickDocument: jest.fn() } }));
jest.mock('@/utils/mediaUrl', () => ({ resolveMediaUrl: (/** @type {string} */ url) => url }));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) {
    return children;
  },
);

jest.mock(
  '@/components/molecules/bottomModal/BottomModal',
  () => function BottomModalMock({ children }) {
    return children;
  },
);

jest.mock('@/components/atoms/button/Button', () => function ButtonMock(/** @type {any} */ props) {
  mockBoutons.push(props);
  return null;
});

const COTISATION = {
  amountDueCents: 12000,
  amountPaidCents: 5000,
  amountRemainingCents: 7000,
  campaign: {
    documentId: 'camp-1', documentRequests: [], name: 'Cotisation seniors', paymentModes: { cash: true },
  },
  currency: 'EUR',
  documentId: 'assign-1',
  documentSubmissions: [],
  installments: [],
  payments: [{
    amountCents: 5000, documentId: 'pay-1', method: 'cash', refundedAmountCents: 0, status: 'confirmed',
  }],
  receipts: [],
  status: 'partial',
  user: { firstname: 'Ana', lastname: 'Diaz' },
};

// Forme reelle de ce que l intercepteur HTTP rejette : `response.data.error`.
const refus = (/** @type {string} */ code) => ({
  details: { code }, message: 'server message', name: 'ValidationError', status: 400,
});

// Les deux clients, ecrits comme `src/App.js:168` et `web/src/main.tsx:52`.
const PLATEFORMES = [
  ['le telephone', () => createFoundClubQueryClient({
    onMutationError: (error, repli) => { displayErrorAlert(error, repli); },
  })],
  ['le site', () => createFoundClubQueryClient()],
];

/** @type {any} */
let arbre = null;

const monter = (/** @type {any} */ client) => {
  mockCotisationRequete = {
    data: COTISATION, isError: false, isLoading: false, refetch: jest.fn(),
  };
  act(() => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <ClubLicenseMemberDetail
          navigation={{ goBack: jest.fn(), navigate: jest.fn(), setOptions: jest.fn() }}
          route={{
            params: {
              assignmentId: 'assign-1', campaignId: 'camp-1', canManageLicenses: true, scope: 'manager',
            },
          }}
        />
      </QueryClientProvider>,
    );
  });
};

const appuyer = (/** @type {string} */ titre) => act(() => {
  [...mockBoutons].reverse().find((props) => props.title === titre).onPress();
});
const champMontant = () => arbre.root.findAll(
  (/** @type {any} */ n) => n.type === TextInput && n.props.keyboardType === 'decimal-pad',
)[0];
const saisirMontant = (/** @type {string} */ valeur) => act(() => {
  champMontant().props.onChangeText(valeur);
});
const saisirMotif = (/** @type {string} */ valeur) => act(() => {
  arbre.root.findAll(
    (/** @type {any} */ n) => n.type === TextInput && n.props.keyboardType !== 'decimal-pad',
  )[0].props.onChangeText(valeur);
});
// La mutation notifie par `notifyManager`, sur un minuteur a 0.
const laisserRepondre = () => act(async () => {
  await new Promise((resolve) => { setTimeout(resolve, 20); });
});

describe.each(PLATEFORMES)('PAYE-LIMITE — un refus de montant sur %s', (_, creerClient) => {
  const dev = global.__DEV__;
  /** @type {any} */
  let alerte;

  beforeEach(() => {
    global.__DEV__ = false;
    mockBoutons.length = 0;
    mockAjouterPaiement.mockReset();
    mockRembourser.mockReset();
    alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    global.__DEV__ = dev;
    if (arbre) act(() => arbre.unmount());
    arbre = null;
    jest.restoreAllMocks();
  });

  test('« A payé » refuse : une seule alerte, le motif en francais, la fenetre reste ouverte', async () => {
    mockAjouterPaiement.mockRejectedValue(refus('LICENSE_AMOUNT_EXCEEDS_REMAINING'));
    monter(creerClient());
    appuyer('A payé');
    saisirMontant('70');
    appuyer('Valider');
    await laisserRepondre();

    expect(mockAjouterPaiement).toHaveBeenCalledTimes(1);
    expect(alerte).toHaveBeenCalledTimes(1);
    expect(alerte.mock.calls[0][1]).toBe("Ce montant dépasse ce qu'il reste à payer sur cette cotisation.");
    expect(champMontant()).toBeDefined();
  });

  test('« Rembourser » refuse : une seule alerte, le motif en francais', async () => {
    mockRembourser.mockRejectedValue(refus('LICENSE_REFUND_EXCEEDS_REFUNDABLE'));
    monter(creerClient());
    appuyer('Rembourser');
    saisirMontant('10');
    saisirMotif('erreur de caisse');
    appuyer('Valider');
    await laisserRepondre();

    expect(mockRembourser).toHaveBeenCalledTimes(1);
    expect(alerte).toHaveBeenCalledTimes(1);
    expect(alerte.mock.calls[0][1]).toBe("Ce montant dépasse ce qu'il reste à rembourser sur ce paiement.");
  });

  test('« A payé » accepté : aucune alerte, la fenetre se ferme', async () => {
    mockAjouterPaiement.mockResolvedValue({ data: {} });
    monter(creerClient());
    appuyer('A payé');
    saisirMontant('70');
    appuyer('Valider');
    await laisserRepondre();

    expect(alerte).not.toHaveBeenCalled();
    expect(champMontant()).toBeUndefined();
  });
});

describe('PAYE-LIMITE — le filet du telephone reste en place pour les autres gestes', () => {
  afterEach(() => {
    if (arbre) act(() => arbre.unmount());
    arbre = null;
    jest.restoreAllMocks();
  });

  test('« Modifier le montant » refuse : le filet parle toujours, une fois', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockChangerMontant.mockRejectedValue(refus('LICENSE_AMOUNT_EXCEEDS_REMAINING'));
    mockBoutons.length = 0;
    monter(PLATEFORMES[0][1]());
    appuyer('Modifier le montant');
    saisirMontant('70');
    appuyer('Valider');
    await laisserRepondre();

    expect(mockChangerMontant).toHaveBeenCalledTimes(1);
    expect(alerte).toHaveBeenCalledTimes(1);
  });
});
