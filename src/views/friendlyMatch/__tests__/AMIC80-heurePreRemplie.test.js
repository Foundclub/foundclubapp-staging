import renderer, { act } from 'react-test-renderer';

import FriendlyMatchTermsSheet from '../components/FriendlyMatchTermsSheet';

// AMICAUX-CORRECTIFS 80 (13/10) — « CE QUI EST CONVENU » PRE-REMPLISSAIT LE COUP D ENVOI A 02:00.
//
// Constat des captures (registre APRES_PUBLICATION, point 80) : une proposition d avant
// AMICAUX-PROPOSITIONS porte un JOUR seul, que le serveur range a minuit UTC
// (« 2026-10-24T00:00:00.000Z »). La feuille le lisait comme une heure : 02:00 en ete, 01:00 en
// hiver, heure de Paris. AMICAUX-PROPOSITIONS (`origin/fix/AMP-app` 820c4432, `knownTime`) le
// corrige ; ce temoin le PROUVE, et voyage avec AMP : ROUGE sur staging, VERT sur AMP.

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: {},
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));
jest.mock('@/components/atoms/SvgIcon/SvgIcon', () => ({ SvgIcon: () => null }));
// Le selecteur d heure natif, reduit a ce qui se verifie : son libelle et sa valeur.
jest.mock('@/components/molecules/timePickerInput/TimePickerInput', () => () => null);
// ⛔ Jamais `requireActual` sur ce service : son client HTTP exige `API_URL` au chargement.
jest.mock('@/services/friendlyMatch/friendlyMatchService', () => ({
  respondToFriendlyMatchApplication: jest.fn(),
}));

const JOUR = '2026-10-24';

/**
 * L heure que la feuille pre-remplit, a l ouverture.
 * @param {any} ad
 * @param {any} application
 * @returns {string}
 */
const heurePreRemplie = (ad, application) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <FriendlyMatchTermsSheet
        ad={ad}
        application={application}
        onClose={jest.fn()}
        onSaved={jest.fn()}
        visible
      />,
    );
  });
  const [heure] = arbre.root.findAll(
    (/** @type {any} */ noeud) => noeud.props.label === 'Heure du coup d’envoi',
  );
  return heure.props.value;
};

describe('AMIC-80 — l heure du coup d envoi pre-remplie', () => {
  test('80 — un JOUR seul (minuit UTC) prend l horaire de l annonce, pas 02:00', () => {
    const ad = { candidateDates: [{ date: JOUR, end: '17:00', start: '15:00' }] };
    expect(heurePreRemplie(ad, { chosenDate: `${JOUR}T00:00:00.000Z` })).toBe('15:00');
  });

  test('80 — un JOUR seul, sans horaire dans l annonce : rien, pas une heure inventee', () => {
    const ad = { candidateDates: [{ date: JOUR }] };
    expect(heurePreRemplie(ad, { chosenDate: `${JOUR}T00:00:00.000Z` })).toBe('');
  });

  test('PROTEGE — une heure deja convenue reste celle qui s affiche', () => {
    const convenue = `${JOUR}T13:30:00.000Z`;
    const ad = { candidateDates: [{ date: JOUR, start: '15:00' }] };
    const application = { agreedTerms: { date: convenue }, chosenDate: `${JOUR}T00:00:00.000Z` };
    expect(heurePreRemplie(ad, application))
      .toBe(new Date(convenue).toTimeString().slice(0, 5));
  });
});
