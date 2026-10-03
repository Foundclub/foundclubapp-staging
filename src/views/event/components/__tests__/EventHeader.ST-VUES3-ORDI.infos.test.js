import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import EventHeader from '../EventHeader';

// ST-VUES3-ORDI (03/10) — ÉCRAN 1, LE BLOC D'INFOS DU MATCH (relevé par STATS-FIX2, point 5 ;
// planche « L'encart du score », P1-encart-tel).
//
// AVANT : « sam 05/09/2026 » et l'heure sur deux lignes, l'adresse longue et « Ouvrir dans le
// GPS », la catégorie en capitales, et le nom de la section aligné à droite.
// LA PLANCHE : trois lignes, dans cet ordre, avec leurs icônes — calendrier « Sam. 5 sept. ·
// 19:00 – 20:00 », épingle « Lyon (69001) », personnes « U15 · AS Montrivage ».

jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => () => null);

const mockOpenExternalMap = jest.fn();
jest.mock('@/platform/maps/externalMap', () => ({
  openExternalMap: (/** @type {any} */ options) => mockOpenExternalMap(options),
}));

jest.mock('@/theme/themeContext', () => {
  const styleLeaf = {};
  const makeRamp = () => new Proxy({}, { get: () => styleLeaf });
  return {
    __esModule: true,
    default: () => ({
      Alignments: makeRamp(),
      ApplicationStyle: new Proxy({}, { get: () => makeRamp() }),
      Colors: new Proxy({}, { get: (_cible, cle) => `couleur-${String(cle)}` }),
      Fonts: new Proxy({}, { get: () => styleLeaf }),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: new Proxy({}, { get: () => makeRamp() }),
    }),
  };
});

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));

jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));

const ADRESSE_LONGUE = '12 rue de la République, 69001 Lyon';
const MATCH = {
  date: '2026-09-05T12:00:00.000Z',
  documentId: 'evt-1',
  endTime: '20:00:00.000',
  locationDetails: JSON.stringify({
    address: { city: 'Lyon', label: ADRESSE_LONGUE, postcode: '69001' },
  }),
  name: 'Match',
  startTime: '19:00:00.000',
  team: {
    category: { name: 'U15 (moins de 15 ans)' },
    club: { documentId: 'club-1', name: 'AS Montrivage' },
    documentId: 'team-1',
    name: 'U15',
    section: { name: 'Football' },
  },
  type: { documentId: 'type-1', name: 'Match' },
};
const ENCART = {
  centerLabel: '19:00',
  isScoreShown: false,
  opponentName: 'Test-COMPO',
  value: 'VS',
};

/** @type {any[]} */
const montes = [];
const monter = (/** @type {any} */ props) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <EventHeader event={props.event} matchScoreSummary={props.matchScoreSummary} />,
    );
  });
  montes.push(arbre);
  return arbre;
};
afterEach(() => {
  act(() => montes.splice(0).forEach((arbre) => arbre.unmount()));
  jest.clearAllMocks();
});

// Le jour s'écrit insécable (FINITIONS7, piège Android 16) : on compare à espaces normales.
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ n) => [].concat(n.props.children).join('').replace(/\u00a0/g, ' '));

describe('ST-VUES3-ORDI · écran 1 — le bloc d infos d un match, comme la planche', () => {
  test('🔴 trois lignes, dans l ordre de la planche : le jour, la ville, l équipe', () => {
    const lus = textes(monter({ event: MATCH, matchScoreSummary: ENCART }));

    const jour = lus.indexOf('Sam. 5 sept. · 19:00 – 20:00');
    const lieu = lus.indexOf('Lyon (69001)');
    const equipe = lus.indexOf('U15 · AS Montrivage');
    expect([jour, lieu, equipe].every((index) => index >= 0)).toBe(true);
    expect(jour).toBeLessThan(lieu);
    expect(lieu).toBeLessThan(equipe);
  });

  test('🔴 ni adresse longue, ni « Ouvrir dans le GPS », ni catégorie, ni section', () => {
    const lus = textes(monter({ event: MATCH, matchScoreSummary: ENCART }));

    expect(lus).not.toContain(ADRESSE_LONGUE);
    expect(lus).not.toContain('Ouvrir dans le GPS');
    expect(lus).not.toContain('U15 (moins de 15 ans)');
    expect(lus).not.toContain('Football');
  });

  test('🔴 la ville se touche toujours : elle ouvre le GPS sur le lieu', () => {
    const arbre = monter({ event: MATCH, matchScoreSummary: ENCART });
    const [lieu] = arbre.root.findAll((/** @type {any} */ n) => (
      n.props?.accessibilityHint === 'Ouvrir dans le GPS' && typeof n.props?.onPress === 'function'
    ));

    act(() => lieu.props.onPress());
    expect(mockOpenExternalMap).toHaveBeenCalledWith(expect.objectContaining({
      label: ADRESSE_LONGUE,
    }));
  });

  test('protégé : un autre type d événement garde son bloc d avant', () => {
    const lus = textes(monter({
      event: { ...MATCH, type: { documentId: 'type-2', name: 'Entraînement' } },
    }));

    expect(lus).toContain('Ouvrir dans le GPS');
    expect(lus).toContain(ADRESSE_LONGUE);
  });
});
