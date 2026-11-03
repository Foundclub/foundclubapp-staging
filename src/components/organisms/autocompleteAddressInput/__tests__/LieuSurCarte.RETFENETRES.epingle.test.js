import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Image } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import LieuSurCarte from '../LieuSurCarte';

// RET-FENETRES (02/11/2026, fiche 12, Adel « A ») — l'épingle passait sur le texte « Chargement de
// la carte » : elle reste cachée tant que la carte n'est pas là, et en cas d'erreur.

const mockCarte = { proprietes: /** @type {any} */ (null) };

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/services/places/placesService', () => ({
  creerLieu: jest.fn(),
}));
jest.mock('@/platform/maps', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: {
      readCurrentLocationIfGranted: () => Promise.resolve(null),
      renderPinMap: (/** @type {any} */ proprietes) => {
        mockCarte.proprietes = proprietes;
        return <VueRN />;
      },
    },
  };
});

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

/**
 * Monte la fenêtre.
 * @returns {any} L'arbre.
 */
const monter = () => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <QueryClientProvider client={new QueryClient()}>
        <LieuSurCarte
          onFermer={jest.fn()}
          onLieuPose={jest.fn()}
          premierResultat={{ lat: 43.2321, lng: 5.4352 }}
          visible
        />
      </QueryClientProvider>,
    );
  });
  return arbre;
};

describe('RET-FENETRES — fiche 12, l’épingle attend la carte', () => {
  it('cachée au chargement, là une fois la carte prête, repartie sur une erreur', () => {
    const arbre = monter();
    const images = () => arbre.root.findAllByType(Image).length;
    const auChargement = images();
    act(() => mockCarte.proprietes.onEtat('ready'));
    expect(images()).toBe(auChargement + 1);
    act(() => mockCarte.proprietes.onEtat('error'));
    expect(images()).toBe(auChargement);
    act(() => arbre.unmount());
  });
});
