/* eslint-disable max-len -- des phrases entieres, comparees telles quelles */
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { normalizePlanningItems } from '@/utils/planning/planningSlots';

import PlanningCalendarView from '../PlanningCalendarView';

// 🕒 MARQUE-MAIRIE (14/10/2026) — COL-003, « D3- B » puis « 3- ok go » d'Adel : la séance qui attend
// la mairie est marquée PARTOUT. COLL-R-A4 l'a posée sur le bloc de la grille (semaine, 3 jours) ;
// la vue « Mois » — la même pour le planning perso, celui du parent, du club et de l'omnisport —
// liste les séances du jour choisi en cartes, sans rien en dire. ROUGE avant le lot.

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

// Le calendrier natif et la liste virtualisee ne sont pas le sujet : on garde
// leur contrat (rendre chaque element) et rien d'autre.
jest.mock('react-native-calendars', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    Calendar: function CalendarMock() {
      return jest.requireActual('react').createElement(VueRN, null);
    },
    LocaleConfig: { defaultLocale: 'fr', locales: {} },
  };
});

jest.mock('@shopify/flash-list', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    FlashList: function FlashListMock(/** @type {any} */ { data, ListEmptyComponent, renderItem }) {
      if (!data?.length && ListEmptyComponent) {
        const vide = reactActuel.createElement(ListEmptyComponent);
        return reactActuel.createElement(VueRN, null, vide);
      }
      return reactActuel.createElement(
        VueRN,
        null,
        (data || []).map((/** @type {any} */ item, /** @type {number} */ i) => (
          reactActuel.createElement(
            VueRN,
            { key: String(item?.documentId || i) },
            renderItem({ item }),
          )
        )),
      );
    },
  };
});

const MERCREDI = new Date(2026, 2, 11, 12, 0, 0);

/** @type {any[]} */
const montes = [];
const monter = async (/** @type {Record<string, any>[]} */ evenements) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <PlanningCalendarView currentDate={MERCREDI} events={normalizePlanningItems(evenements)} />,
    );
  });
  montes.push(arbre);
  return arbre;
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ noeud) => noeud.props.children)
  .flat()
  .filter((/** @type {any} */ valeur) => typeof valeur === 'string');
const SEANCE = {
  documentId: 'seance',
  endTime: '19:00:00.000',
  hasExplicitTime: true,
  startAt: new Date(Date.UTC(2026, 2, 11, 17, 0)).toISOString(),
  startTime: '18:00:00.000',
  title: 'Entrainement U13',
};

afterEach(async () => {
  await act(async () => {
    while (montes.length) montes.pop().unmount();
  });
});

describe('MARQUE-MAIRIE — la vue mois dit que la séance attend', () => {
  it('la carte du jour dit « En attente de la mairie »', async () => {
    const arbre = await monter([{ ...SEANCE, pendingDecider: 'mairie' }]);
    expect(textes(arbre)).toContain('En attente de la mairie');
    expect(arbre.root.findAll((/** @type {any} */ n) => n.type === Text && n.props.testID === 'seance-en-attente')).toHaveLength(1);
  });

  it('le dirigeant, le gestionnaire de l installation : leurs mots', async () => {
    const arbre = await monter([
      { ...SEANCE, documentId: 'a', pendingDecider: 'dirigeant' },
      { ...SEANCE, documentId: 'b', pendingDecider: 'proprietaire' },
    ]);
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'En attente de ton dirigeant', 'En attente du gestionnaire de l’installation',
    ]));
  });

  it('un serveur d AVANT (pas de marque) : la carte ne change pas', async () => {
    const arbre = await monter([SEANCE]);
    expect(textes(arbre).join('|')).not.toMatch(/En attente de|En attente du/);
  });
});
