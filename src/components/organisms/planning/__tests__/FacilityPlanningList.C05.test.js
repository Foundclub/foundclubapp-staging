/* eslint-disable max-len -- des phrases entieres de la liste, comparees telles quelles */
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import FacilityPlanningList from '../FacilityPlanningList';

// C05 (BUGHUNT P2, Q2-02, 25/10/2026) — toutes les fermetures du jour comptent, avec leurs heures.

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args),
  }),
}));
jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({ Colors: couleurs, Fonts: genererPolices(couleurs), Spaces: espaces }),
  };
});

const i18nextTemoin = require('i18next');

const frTemoin = require('@/theme/strings/translations/fr');

(i18nextTemoin.default || i18nextTemoin).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'fr',
  lng: 'fr',
  resources: { fr: { translation: frTemoin.default } },
});

// La semaine du lundi 5 octobre 2026.
const LUNDI = new Date(2026, 9, 5);
/** @type {any[]} */
const arbresMontes = [];
afterEach(async () => {
  await act(async () => {
    arbresMontes.splice(0).forEach((arbre) => arbre.unmount());
  });
});
const monter = async (/** @type {any} */ props) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <FacilityPlanningList
        capacite={2}
        debutDeSemaine={LUNDI}
        evenements={props.evenements}
        fermeture="22:00"
        fermetures={props.fermetures}
        onFreePress={props.onFreePress}
        ouverture="08:00"
      />,
    );
  });
  arbresMontes.push(arbre);
  return arbre;
};
const libreDu = (/** @type {any} */ arbre, /** @type {string} */ jour) => {
  const noeuds = arbre.root.findAll((/** @type {any} */ n) => typeof n.type === 'string' && n.props.testID === `libre-${jour}`);
  return noeuds.length ? noeuds[0].findAllByType(Text).map((/** @type {any} */ n) => String(n.props.children)).join(' | ') : null;
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text).map((/** @type {any} */ n) => String(n.props.children));

describe('Q2-02 — la Liste lit toutes les fermetures du jour, avec leurs heures', () => {
  it('(a) une fermeture du jeudi 14:00 au samedi 12:00 laisse le jeudi matin et le samedi apres-midi libres', async () => {
    const arbre = await monter({
      evenements: [],
      fermetures: [{
        documentId: 'f1', endDate: '2026-10-10', endTime: '12:00', kind: 'closure', reason: 'travaux', startDate: '2026-10-08', startTime: '14:00',
      }],
      onFreePress: jest.fn(),
    });
    expect(textes(arbre)).toContain('Libre 08:00 – 14:00');
    expect(textes(arbre)).toContain('Libre 12:00 – 22:00');
    expect(libreDu(arbre, '2026-10-09')).toBeNull();
    expect(libreDu(arbre, '2026-10-08')).not.toBeNull();
    expect(libreDu(arbre, '2026-10-10')).not.toBeNull();
  });

  it('(b) deux blocages le meme jour retirent tous les deux leurs heures', async () => {
    const arbre = await monter({
      evenements: [],
      fermetures: [
        {
          documentId: 'b1', endDate: '2026-10-07', endTime: '11:00', kind: 'block', startDate: '2026-10-07', startTime: '09:00',
        },
        {
          documentId: 'b2', endDate: '2026-10-07', endTime: '20:00', kind: 'block', startDate: '2026-10-07', startTime: '18:00',
        },
      ],
      onFreePress: jest.fn(),
    });
    expect(textes(arbre)).toContain('Libre 08:00 – 09:00 · 11:00 – 18:00 · 20:00 – 22:00');
  });
});
