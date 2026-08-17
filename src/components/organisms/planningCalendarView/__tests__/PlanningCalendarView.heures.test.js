import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { normalizePlanningItems } from '@/utils/planning/planningSlots';

import PlanningCalendarView from '../PlanningCalendarView';

// T06 — LA VUE QUI ETAIT DEJA JUSTE, ET QUI DOIT LE RESTER.
//
// La vue « Mois » ne dessine pas de bloc : elle liste les evenements du jour
// choisi avec leur horloge. Elle lisait deja `startTime` / `endTime` — c'est
// elle qui affichait « 18:00 - 19:00 » pendant que la vue semaine tracait un
// bloc de 13h a 19h sur le MEME evenement.
//
// Ce filet existe pour que la correction de la vue semaine ne la retourne pas :
// il est VERT avant la correction comme apres. Preuve du « avant » :
// `git show HEAD:src/utils/planning/planningSlots.js` remis en place, suite
// relancee, 3 tests verts.

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

/**
 * L'instant tel que le serveur l'envoie : `date` est un timestamp UTC.
 * @param {number} heureParis
 * @param {number} [minute]
 * @returns {string}
 */
const instantParis = (heureParis, minute = 0) => (
  new Date(Date.UTC(2026, 2, 11, heureParis - 1, minute)).toISOString()
);

/**
 * Monte la vue mois sur un jour fige.
 * @param {Record<string, any>[]} evenements
 * @returns {Promise<any>}
 */
const monter = async (evenements) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <PlanningCalendarView
        currentDate={MERCREDI}
        events={normalizePlanningItems(evenements)}
      />,
    );
  });
  return arbre;
};

/**
 * Tous les libelles lisibles a l'ecran.
 * @param {any} arbre
 * @returns {string[]}
 */
const textes = (arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ noeud) => noeud.props.children)
  .flat()
  .filter((/** @type {any} */ valeur) => typeof valeur === 'string');

/** @type {any[]} */
const arbresMontes = [];

afterEach(async () => {
  await act(async () => {
    while (arbresMontes.length) arbresMontes.pop().unmount();
  });
});

describe('T06 — la vue mois annonce l horloge de l evenement', () => {
  it('un evenement de 18h a 19h est annonce « 18:00 - 19:00 »', async () => {
    // La ligne divergente mesuree en base : instant a 13h, horloge a 18h.
    const arbre = await monter([{
      documentId: 'entrainement',
      endAt: null,
      endTime: '19:00:00.000',
      hasExplicitTime: true,
      startAt: instantParis(13),
      startTime: '18:00:00.000',
      title: 'Entrainement',
    }]);
    arbresMontes.push(arbre);

    expect(textes(arbre)).toContain('18:00 - 19:00');
  });

  it('l horloge donne l HEURE, l instant garde le JOUR', async () => {
    // Meme evenement divergent : il doit rester range au 11 mars (le jour de
    // l'instant), et non glisser d'un jour parce qu'on lui pose une autre heure.
    const arbre = await monter([{
      documentId: 'entrainement',
      endAt: null,
      endTime: '19:00:00.000',
      hasExplicitTime: true,
      startAt: instantParis(13),
      startTime: '18:00:00.000',
      title: 'Entrainement',
    }]);
    arbresMontes.push(arbre);

    const lus = textes(arbre);
    expect(lus).toContain('mercredi 11 mars 2026');
    expect(lus).not.toContain('Aucun événement ce jour-là');
  });

  it('un jour sans evenement le dit', async () => {
    const arbre = await monter([]);
    arbresMontes.push(arbre);

    expect(textes(arbre)).toContain('Aucun événement ce jour-là');
  });
});
