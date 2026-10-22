import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { blocsDesEvenements } from '@/domains/collectivite/evenementDeLaVille';

import { normalizePlanningItems } from '@/utils/planning/planningSlots';

import PlanningWeekTimelineView from '../PlanningWeekTimelineViewV2';

// 🏛️ R17-EVT-1 (20/10/2026, REC17-005), point 3 — L'ÉVÉNEMENT DE LA VILLE SUR LE PLANNING
// D'UNE INSTALLATION (planches P10-planning-ordi, P10-evenement-ordi état 11). Ce témoin fige :
//   - le SEUL bloc clair du planning (`primary100`) : PLEIN s'il prend toute l'installation,
//     en CONTOUR s'il est à côté ; « Ville · toute l'installation » / « Ville · à côté », ses
//     heures, son nom ; le lecteur d'écran dit tout ;
//   - le toucher ouvre sa fiche (`onEvenementVillePress`) ; sans elle, il ne se touche pas ;
//   - ce n'est pas une séance : le compte des séances du jour ne le compte pas.

jest.setTimeout(30000);

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args),
  }),
}));
jest.mock('@/theme/themeContext', () => {
  const { colors: vraiesCouleurs } = jest.requireActual('@/theme/colors');
  const feuille = {};
  const rampe = () => new Proxy({}, { get: () => feuille });
  return {
    __esModule: true,
    default: () => ({
      Alignments: rampe(),
      ApplicationStyle: new Proxy({}, { get: () => rampe() }),
      Colors: vraiesCouleurs,
      Fonts: rampe(),
      Images: new Proxy(
        {},
        {
          get: (/** @type {any} */ _c, /** @type {any} */ k) => `image-${String(k)}`,
        },
      ),
      Spaces: new Proxy({}, { get: () => rampe() }),
    }),
  };
});
jest.mock('@/theme/images', () => ({
  __esModule: true,
  images: new Proxy(
    {},
    {
      get: (/** @type {any} */ _c, /** @type {any} */ k) => ({ testUri: `image-${String(k)}` }),
    },
  ),
}));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  runOnJS: (/** @type {any} */ fonction) => fonction,
}));
jest.mock('react-native-gesture-handler', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  const geste = () => {
    /** @type {any} */
    const g = {};
    g.direction = () => g;
    g.onEnd = () => g;
    g.onStart = () => g;
    return g;
  };
  return {
    Directions: { LEFT: 'gauche', RIGHT: 'droite' },
    Gesture: { Fling: geste, Simultaneous: () => ({}) },
    GestureDetector: function GestureDetectorMock(/** @type {any} */ { children }) {
      return reactActuel.createElement(VueRN, null, children);
    },
  };
});

const SAMEDI = new Date(2026, 9, 24, 12, 0, 0);
const COULEURS = jest.requireActual('@/theme/colors').colors;
const FETE = {
  documentId: 'evt-1',
  endTime: '17:00',
  name: 'Fête du sport',
  startDate: '2026-10-24',
  startTime: '10:00',
  takesPlace: true,
};
const CROSS = {
  documentId: 'evt-2',
  endTime: '16:00',
  name: 'Cross des écoles',
  startDate: '2026-10-24',
  startTime: '13:30',
  takesPlace: false,
};
const SEANCE = {
  club: { documentId: 'club-A', name: 'AS Montrivage' },
  documentId: 'seance-1',
  endAt: new Date(2026, 9, 24, 19, 0).toISOString(),
  hasExplicitTime: true,
  startAt: new Date(2026, 9, 24, 18, 0).toISOString(),
  team: { name: 'U13' },
  title: 'AS Montrivage · U13',
};

/** @type {any[]} */
const arbresMontes = [];
afterEach(async () => {
  await act(async () => {
    arbresMontes.splice(0).forEach((arbre) => arbre.unmount());
  });
});
const monter = async (/** @type {any[]} */ evenements, /** @type {any} */ props = {}) => {
  const blocs = blocsDesEvenements(evenements, { from: '2026-10-19', to: '2026-10-25' });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <PlanningWeekTimelineView
        cardDisplayProfile="clubFocused"
        compactFullscreen
        currentDate={SAMEDI}
        events={normalizePlanningItems([...blocs, ...(props.seances || [])])}
        firstHour={8}
        mode="day"
        onEvenementVillePress={props.onEvenementVillePress}
        showHeader={false}
        showUntimedSection={false}
      />,
    );
  });
  arbresMontes.push(arbre);
  return arbre;
};
const blocDe = (/** @type {any} */ arbre, /** @type {string} */ nom) => arbre.root.findAll(
  (/** @type {any} */ n) => typeof n.type === 'string'
      && String(n.props.accessibilityLabel || '').startsWith(`Événement de la Ville : ${nom}`),
)[0];
const textesDe = (/** @type {any} */ noeud) => {
  const textes = noeud.findAllByType(Text);
  return textes.map((/** @type {any} */ n) => n.props.children);
};

describe('R17-EVT-1 — l’événement de la Ville sur le planning d’une installation', () => {
  it('toute l’installation : un bloc PLEIN, clair, la Ville, les heures, le nom', async () => {
    const arbre = await monter([FETE]);
    const bloc = blocDe(arbre, 'Fête du sport');
    expect(bloc.props.accessibilityLabel).toBe(
      'Événement de la Ville : Fête du sport, 10:00 – 17:00, Ville · toute l’installation',
    );
    const style = StyleSheet.flatten(bloc.props.style);
    expect(style.backgroundColor).toBe(COULEURS.primary100);
    expect(style.borderWidth).toBe(0);
    expect(textesDe(bloc)).toEqual([
      'Ville · toute l’installation',
      '10:00 – 17:00',
      'Fête du sport',
    ]);
  });

  it('à côté : un bloc en CONTOUR clair', async () => {
    const arbre = await monter([CROSS]);
    const bloc = blocDe(arbre, 'Cross des écoles');
    const style = StyleSheet.flatten(bloc.props.style);
    expect(style.borderColor).toBe(COULEURS.primary100);
    expect(style.borderWidth).toBe(1.5);
    expect(style.backgroundColor).not.toBe(COULEURS.primary100);
    expect(textesDe(bloc)[0]).toBe('Ville · à côté');
  });

  it('le toucher ouvre sa fiche ; sans la porte, il ne se touche pas', async () => {
    const ouvrir = jest.fn();
    const arbre = await monter([FETE], { onEvenementVillePress: ouvrir });
    const bouton = arbre.root
      .findAllByType(TouchableOpacity)
      .find((n) => String(n.props.accessibilityLabel || '').startsWith('Événement de la Ville'));
    await act(async () => {
      bouton.props.onPress();
    });
    expect(ouvrir).toHaveBeenCalledWith(expect.objectContaining({ documentId: 'evt-1' }));
    const inerte = await monter([FETE]);
    expect(
      inerte.root
        .findAllByType(TouchableOpacity)
        .filter((n) => {
          const libelle = String(n.props.accessibilityLabel || '');
          return libelle.startsWith('Événement de la Ville');
        }),
    ).toHaveLength(0);
  });

  it('ce n’est pas une séance : le jour compte UNE séance, pas deux', async () => {
    const arbre = await monter([FETE], { seances: [SEANCE] });
    const lus = arbre.root
      .findAllByType(Text)
      .map((n) => n.props.children)
      .flat()
      .join(' ');
    expect(lus).not.toMatch(/2 séances/);
    expect(blocDe(arbre, 'Fête du sport')).toBeTruthy();
  });
});
