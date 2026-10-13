/* eslint-disable max-len -- des libelles entiers de la grille, compares tels quels */
import { StyleSheet, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { normalizePlanningItems } from '@/utils/planning/planningSlots';

import PlanningWeekTimelineView from '../PlanningWeekTimelineViewV2';

// 🏛️ COLL-R-APP-CREATION (13/10/2026, COL-003, décision d'Adel « D3- B », 12/10) — LES JOUEURS
// VOIENT LA SÉANCE QUI ATTEND LA MAIRIE, MARQUÉE « En attente de la mairie » (maquette validée
// P8v2-demande-tel, l. 78 et 86-87 : le bloc du planning, en pointillés orange, dit qui décide).
// Le serveur pose `pendingDecider` sur la ligne (admin fix/CRA4-admin, temoin
// CRA4-planning-seance-en-attente) ; la grille le dit avec les mots de la fiche (EventDetails).
// Un serveur d'avant n'envoie rien : aucune marque, rien ne casse. ROUGE avant le lot.
// Harnais repris de PlanningWeekTimelineView.COLL-C4B.test.js.

jest.setTimeout(30000);

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
      Images: new Proxy({}, {
        get: (/** @type {any} */ _c, /** @type {any} */ k) => `image-${String(k)}`,
      }),
      Spaces: new Proxy({}, { get: () => rampe() }),
    }),
  };
});
jest.mock('@/theme/images', () => ({
  __esModule: true,
  images: new Proxy({}, {
    get: (/** @type {any} */ _c, /** @type {any} */ k) => ({ testUri: `image-${String(k)}` }),
  }),
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

const COULEURS = jest.requireActual('@/theme/colors').colors;
// Samedi 10 octobre 2026.
const SAMEDI = new Date(2026, 9, 10, 12, 0, 0);
// Une séance du planning d'un JOUEUR (ligne de /users/me/planning), 15:00 – 16:30.
const seance = (/** @type {any} */ champs) => ({
  club: { documentId: 'club-A', name: 'AS Montrivage' },
  endAt: '2026-10-10T14:30:00.000Z',
  endTime: '16:30:00.000',
  facility: { documentId: 'gym-ville', name: 'Gymnase des Tilleuls', planningColor: null },
  hasExplicitTime: true,
  kind: 'event',
  participationStatus: 'accepted',
  startAt: '2026-10-10T13:00:00.000Z',
  startTime: '15:00:00.000',
  team: { documentId: 'u13', name: 'U13' },
  title: 'Entraînement U13',
  typeLabel: 'Entraînement',
  ...champs,
});

/** @type {any[]} */
const arbresMontes = [];
afterEach(async () => {
  await act(async () => {
    arbresMontes.splice(0).forEach((arbre) => arbre.unmount());
  });
});
const monter = async (/** @type {any[]} */ blocs, /** @type {string} */ profil = 'default') => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <PlanningWeekTimelineView
        cardDisplayProfile={profil}
        compactFullscreen
        currentDate={SAMEDI}
        events={normalizePlanningItems(blocs)}
        mode="day"
        onEventPress={jest.fn()}
        showHeader={false}
        showUntimedSection={false}
      />,
    );
  });
  arbresMontes.push(arbre);
  return arbre;
};
const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text).map((/** @type {any} */ n) => aplatir(n.props.children));
// Le bloc : le nœud natif qui porte le pointillé ou la couleur de la séance (bord gauche).
const styleDuBloc = (/** @type {any} */ arbre) => {
  const noeud = arbre.root.findAll((/** @type {any} */ n) => (
    typeof n.type === 'string' && StyleSheet.flatten(n.props.style || {})?.borderLeftWidth > 0
    && n.findAllByType(Text).some((/** @type {any} */ t) => aplatir(t.props.children).includes('Entraînement'))
  ))[0];
  return StyleSheet.flatten(noeud.props.style);
};

describe('COLL-R-APP-CREATION — le planning du joueur marque la séance qui attend la mairie', () => {
  it('« En attente de la mairie », en pointillés orange (le bloc reste à sa place)', async () => {
    const arbre = await monter([seance({ documentId: 'attend', pendingDecider: 'mairie' })]);
    expect(textes(arbre).join(' | ')).toMatch(/En attente de la mairie/);
    const style = styleDuBloc(arbre);
    expect(style.borderStyle).toBe('dashed');
    expect(style.borderColor).toBe(COULEURS.warning500);
  });

  it('les autres attentes disent qui décide, avec les mots de la fiche', async () => {
    const arbre = await monter([seance({ documentId: 'attend', pendingDecider: 'dirigeant' })]);
    expect(textes(arbre).join(' | ')).toMatch(/En attente de ton dirigeant/);
  });

  it('sur le planning d une installation (blocs « club ») aussi, et le lecteur d écran l entend', async () => {
    const arbre = await monter([seance({ documentId: 'attend', pendingDecider: 'mairie', title: 'AS Montrivage · U13' })], 'clubFocused');
    expect(textes(arbre).join(' | ')).toMatch(/En attente de la mairie/);
    const libelles = arbre.root.findAll((/** @type {any} */ n) => typeof n.type === 'string' && n.props.accessibilityLabel)
      .map((/** @type {any} */ n) => n.props.accessibilityLabel);
    expect(libelles.join(' | ')).toMatch(/En attente de la mairie/);
  });

  it('une séance confirmée, ou un serveur d avant (aucune marque) : rien ne change', async () => {
    const arbre = await monter([seance({ documentId: 'confirmee' })]);
    expect(textes(arbre).join(' | ')).not.toMatch(/En attente de/);
    expect(styleDuBloc(arbre).borderStyle).not.toBe('dashed');
  });
});
