import '@/theme/strings';

import renderer, { act } from 'react-test-renderer';

import MyLicensesArchive from '../MyLicensesArchive';

// BH11 (BUGHUNT 24/10) — « Saisons passées » :
//   P5-15 : une cotisation archivee avec un reste du ne s affiche pas « soldée » ;
//   P5-23 : une erreur de chargement ne se deguise pas en « Aucune saison archivee ».

/** @type {any} */
let mockRequete;

jest.mock('@/services/license/licenseQueries', () => ({ useMyLicenses: () => mockRequete }));
jest.mock('@/platform/media/downloadRemoteFile', () => ({ downloadRemoteFile: jest.fn() }));
jest.mock('@/utils/mediaUrl', () => ({ resolveMediaUrl: (/** @type {string} */ url) => url }));
jest.mock('@react-navigation/native', () => ({ ...jest.requireActual('@react-navigation/native'), useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn() }) }));
jest.mock('@/components/atoms/skeletonLoader/SkeletonLoader', () => function SkeletonLoaderMock() { return null; });
jest.mock('@/components/templates/ScreenContainer', () => function ScreenMock({ children }) { return children; });
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

/** @type {any} */
let arbre = null;
const monter = () => {
  act(() => {
    arbre = renderer.create(
      <MyLicensesArchive navigation={{ canGoBack: () => true, goBack: jest.fn(), navigate: jest.fn() }} />,
    );
  });
  return JSON.stringify(arbre.toJSON());
};

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});

describe('BH11 — Saisons passées', () => {
  test('P5-15 — un reste dû ne s affiche pas « soldée »', () => {
    mockRequete = {
      data: [{
        amountDueCents: 12000,
        amountRemainingCents: 3000,
        campaign: { name: 'Seniors', seasonLabel: '2024-2025', status: 'closed' },
        currency: 'EUR',
        documentId: 'a1',
        payments: [],
        receipts: [],
        status: 'partial',
      }],
      isError: false,
      isLoading: false,
    };
    const rendu = monter();
    expect(rendu).not.toContain('soldée');
    expect(rendu).toContain('à payer');
  });

  test('P5-23 — une erreur de chargement propose « Réessayer »', () => {
    mockRequete = {
      data: undefined, isError: true, isLoading: false, refetch: jest.fn(),
    };
    const rendu = monter();
    expect(rendu).not.toContain('Aucune saison archivée');
    expect(rendu).toContain('Réessayer');
  });
});
