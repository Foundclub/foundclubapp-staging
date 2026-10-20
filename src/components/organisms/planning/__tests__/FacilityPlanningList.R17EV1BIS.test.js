import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { blocsDesEvenements } from '@/domains/collectivite/evenementDeLaVille';

import { normalizePlanningItems } from '@/utils/planning/planningSlots';

import FacilityPlanningList from '../FacilityPlanningList';

// 🏛️ R17-EVT-1-BIS (b) (20/10/2026, tri du chef) — LA VUE LISTE du planning d'une installation
// montre l'événement de la Ville : sa carte CLAIRE (« Ville · toute l'installation », son nom, ses
// heures), qui s'ouvre ; s'il prend toute l'installation, ses heures sortent du « Libre » (son
// blocage lié n'est plus dessiné : c'est lui qui les prend). ROUGE avant : l'événement manquait,
// le jour se disait « Libre toute la journée ».

// Le poste peut être chargé (portes d autres sessions) : un délai large.
jest.setTimeout(30000);

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

// La semaine du lundi 19 octobre 2026 ; la Fête du sport le samedi 24, 14:00 - 15:30.
const LUNDI = new Date(2026, 9, 19);
const FETE = {
  documentId: 'evt-1',
  endDate: '2026-10-24',
  endTime: '15:30',
  facility: { documentId: 'stade', name: 'Stade municipal' },
  name: 'Fête du sport',
  startDate: '2026-10-24',
  startTime: '14:00',
  takesPlace: true,
};

/** @type {any[]} */
const arbresMontes = [];
afterEach(async () => {
  await act(async () => {
    arbresMontes.splice(0).forEach((arbre) => arbre.unmount());
  });
});
const monter = async (/** @type {any} */ evenement, /** @type {any} */ onBlockPress) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <FacilityPlanningList
        capacite={2}
        debutDeSemaine={LUNDI}
        evenements={normalizePlanningItems(
          blocsDesEvenements([evenement], { from: '2026-10-19', to: '2026-10-25' }),
        )}
        fermeture="22:00"
        fermetures={[]}
        onBlockPress={onBlockPress}
        onFreePress={jest.fn()}
        ouverture="08:00"
      />,
    );
  });
  arbresMontes.push(arbre);
  return arbre;
};
const lus = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ n) => String(n.props.children));
// Le libre du SAMEDI 24 (les autres jours de la semaine sont libres toute la journée).
const libreDu24 = (/** @type {any} */ arbre) => arbre.root
  .findAll((/** @type {any} */ n) => typeof n.type === 'string'
    && n.props.testID === 'libre-2026-10-24')[0]
  ?.findAllByType(Text).map((/** @type {any} */ n) => String(n.props.children))[0];

describe('R17-EVT-1-BIS — la vue Liste et l’événement de la Ville', () => {
  it('🔴 sa carte claire, qui s’ouvre ; ses heures sortent du libre', async () => {
    const onBlockPress = jest.fn();
    const arbre = await monter(FETE, onBlockPress);
    const carte = arbre.root.findAll((/** @type {any} */ n) => typeof n.type === 'string'
      && n.props.testID === 'liste-evenement-ville-evt-1');
    expect(carte).toHaveLength(1);
    expect(carte[0].findAllByType(Text).map((/** @type {any} */ n) => String(n.props.children)))
      .toEqual(['Ville · toute l’installation', 'Fête du sport', '14:00 – 15:30']);
    expect(libreDu24(arbre)).toBe('Libre 08:00 – 14:00 · 15:30 – 22:00');
    await act(async () => {
      arbre.root.findAllByType(TouchableOpacity)
        .find((/** @type {any} */ n) => n.props.testID === 'liste-evenement-ville-evt-1')
        .props.onPress();
    });
    expect(onBlockPress).toHaveBeenCalledWith(expect.objectContaining({
      raw: expect.objectContaining({ evenementDeLaVille: FETE }),
    }));
  });

  it('🔴 « à côté » : sa carte, mais le jour reste libre', async () => {
    const arbre = await monter({ ...FETE, takesPlace: false }, jest.fn());
    expect(lus(arbre)).toContain('Ville · à côté');
    expect(libreDu24(arbre)).toBe('Libre toute la journée');
  });
});
