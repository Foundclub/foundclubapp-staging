/* eslint-disable max-len -- doublures reprises de FacilitySelector.CRA4.mairieDecide.test.js */
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import FacilitySelector from '../FacilitySelector';

// Q2-10 (BUGHUNT P2, 25/10) — modifier une séance prévue à une adresse extérieure : le sélecteur
// démarrait en « Club » (adresse masquée), et toucher le mode déjà actif vidait le lieu.

/** @type {Record<string, any>} */
const mockDonnees = {};
const mockOccupation = { data: {} };

jest.mock('@react-navigation/native', () => ({ useIsFocused: () => false }));
jest.mock('@tanstack/react-query', () => ({
  useQuery: (/** @type {any} */ options) => {
    const [cle] = options.queryKey;
    return {
      data: options.enabled ? mockDonnees[cle] : undefined, isFetching: false, isLoading: false, refetch: jest.fn(),
    };
  },
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args),
  }),
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
      Images: { check: 1 },
      Spaces: espaces,
    }),
  };
});
jest.mock('@/services/facility/facilityQueries', () => ({
  useGetFacilityOccupancy: (/** @type {string} */ _facilityId, /** @type {any} */ _fenetre, /** @type {any} */ options) => ({
    data: options?.enabled ? { data: mockOccupation.data } : undefined,
    isFetching: false,
  }),
}));
jest.mock('@/services/facility/facilityService', () => ({
  getClubVilleFacilitiesWithSlots: jest.fn(),
  getCMFacilities: jest.fn(),
  getFacilities: jest.fn(),
}));
jest.mock('@/components/atoms/marqueeText/MarqueeText', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN } = jest.requireActual('react-native');
  return function MarqueeTextMock(/** @type {any} */ props) {
    return reactActuel.createElement(TexteRN, null, props.text);
  };
});
jest.mock('@/components/organisms/autocompleteAddressInput/autocompleteAddressInput', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN } = jest.requireActual('react-native');
  return function AdresseMock(/** @type {any} */ props) {
    return reactActuel.createElement(TexteRN, null, `ADRESSE:${props.address?.label || ''}`);
  };
});
jest.mock('@/components/atoms/button/Button', () => function ButtonMock() { return null; });

const ADRESSE = { label: '5 rue du Port, Marseille', value: '5.37|43.29' };

/** @type {any} */
let arbre = null;
afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});

const monter = (/** @type {any} */ props) => {
  act(() => {
    arbre = renderer.create(
      <FacilitySelector
        clubId="club-1"
        facilityId={props.facilityId}
        location={props.location}
        onChange={props.onChange || jest.fn()}
      />,
    );
  });
};
const textes = () => arbre.root.findAllByType(Text).map((/** @type {any} */ n) => [].concat(n.props.children).join(''));
const boutonMode = (/** @type {string} */ debut) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.accessibilityRole === 'button' && typeof n.props?.onPress === 'function'
    && String(n.props?.accessibilityLabel || '').startsWith(debut),
)[0];

test('une séance à une adresse extérieure s ouvre sur « Extérieur », avec son adresse', () => {
  monter({ facilityId: null, location: ADRESSE });
  expect(textes()).toContain(`ADRESSE:${ADRESSE.label}`);
});

test('l adresse arrivée APRÈS le montage (fiche chargée) bascule aussi sur « Extérieur »', () => {
  monter({ facilityId: null, location: null });
  act(() => {
    arbre.update(<FacilitySelector clubId="club-1" facilityId={null} location={ADRESSE} onChange={jest.fn()} />);
  });
  expect(textes()).toContain(`ADRESSE:${ADRESSE.label}`);
});

test('toucher le mode déjà actif n efface rien', () => {
  const onChange = jest.fn();
  monter({ facilityId: null, location: ADRESSE, onChange });
  act(() => { boutonMode('Extérieur').props.onPress(); });
  expect(onChange).not.toHaveBeenCalled();
});

test('« Club » déjà actif : le toucher garde l installation choisie', () => {
  const onChange = jest.fn();
  monter({ facilityId: 'salle-1', location: { label: '3 rue du Stade', value: '' }, onChange });
  act(() => { boutonMode('Club').props.onPress(); });
  expect(onChange).not.toHaveBeenCalled();
});

test('changer de mode vide toujours le lieu (comportement gardé)', () => {
  const onChange = jest.fn();
  monter({ facilityId: null, location: ADRESSE, onChange });
  act(() => { boutonMode('Club').props.onPress(); });
  expect(onChange).toHaveBeenCalledWith({ facilityId: null, location: null });
});
