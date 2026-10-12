import { StyleSheet, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { normalizePlanningItems } from '@/utils/planning/planningSlots';

import PlanningWeekTimelineView from '../PlanningWeekTimelineViewV2';

// PLANNING-PORTRAIT (01/10, decision d Adel « D6 A ») — la grille partagee du planning :
//   1. un mode « jour » (une seule colonne) pour le plein ecran tenu droit, a cote des
//      modes « semaine » et « 3 jours » qui existent deja ; un balayage y change de JOUR ;
//   3. le bloc d un autre club peut s ouvrir en LECTURE quand l ecran le demande
//      (`onReadOnlyEventPress`, la mairie) — sinon il reste inerte (FINITIONS2) ;
//   4. constat T7 (capture D1, 01/10) sur le planning d une installation :
//      - les blocs d 1 h 30 perdaient le nom du club : la ligne « club · equipe » etait
//        la SEULE a pouvoir retrecir (`flexShrink: 1`) dans un bloc qui deborde, elle
//        tombait a zero de hauteur, et l on lisait « Senior B » puis le gymnase ;
//      - un bloc haut ecrivait l equipe deux fois (« Montrivage FC · Senior B », puis
//        « Senior B ») et repetait le gymnase, qu on connait deja.
//      Profil `clubFocused` : le club en premiere ligne, l equipe en seconde, sans le
//      gymnase ; et la premiere ligne ne retrecit plus jamais.
// ROUGE avant le lot : « day » donnait 3 jours, aucune fiche possible, equipe en double.

/** @type {any[]} */
const mockFlings = [];

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

// Le balayage est garde : `direction` puis `onEnd`, rejouable a la main.
jest.mock('react-native-gesture-handler', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  const fling = () => {
    /** @type {any} */
    const geste = {};
    geste.direction = (/** @type {any} */ sens) => { geste.sens = sens; return geste; };
    geste.onEnd = (/** @type {any} */ rappel) => {
      geste.rappel = rappel;
      mockFlings.push(geste);
      return geste;
    };
    geste.onStart = () => geste;
    return geste;
  };
  return {
    Directions: { LEFT: 'gauche', RIGHT: 'droite' },
    Gesture: { Fling: fling, Simultaneous: () => ({}) },
    GestureDetector: function GestureDetectorMock(/** @type {any} */ { children }) {
      return reactActuel.createElement(VueRN, null, children);
    },
  };
});

// Mercredi 7 octobre 2026.
const MERCREDI = new Date(2026, 9, 7, 12, 0, 0);

// Ce que rend `GET /facilities/:id/planning` (lot COLL1B) : lundi et mercredi.
const BLOC_DU_LUNDI = {
  club: { documentId: 'club-A', name: 'AS Ville A' },
  documentId: 'evt-A',
  endAt: '2026-10-05T17:30:00.000Z',
  endTime: '19:30:00.000',
  facility: { documentId: 'gym-ville', name: 'Gymnase de la Ville', planningColor: null },
  hasExplicitTime: true,
  isOwnClub: true,
  kind: 'event',
  startAt: '2026-10-05T16:00:00.000Z',
  startTime: '18:00:00.000',
  team: { name: 'Seniors A' },
  title: 'AS Ville A · Seniors A',
};
const BLOC_DU_MERCREDI_AUTRE_CLUB = {
  ...BLOC_DU_LUNDI,
  club: { documentId: 'club-B', name: 'Montrivage FC' },
  documentId: null,
  endAt: '2026-10-07T17:30:00.000Z',
  isOwnClub: false,
  startAt: '2026-10-07T16:00:00.000Z',
  team: { name: 'Senior B' },
  title: 'Montrivage FC · Senior B',
};

/** @type {any[]} */
const arbresMontes = [];

afterEach(async () => {
  mockFlings.length = 0;
  await act(async () => {
    arbresMontes.splice(0).forEach((arbre) => arbre.unmount());
  });
});

const monter = async ({
  cardDisplayProfile = 'default',
  mode = 'week',
  onDateChange = undefined,
  onEventPress = undefined,
  onReadOnlyEventPress = undefined,
} = /** @type {any} */ ({})) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <PlanningWeekTimelineView
        cardDisplayProfile={cardDisplayProfile}
        compactFullscreen
        currentDate={MERCREDI}
        events={normalizePlanningItems([BLOC_DU_LUNDI, BLOC_DU_MERCREDI_AUTRE_CLUB])}
        mode={mode}
        onDateChange={onDateChange}
        onEventPress={onEventPress}
        onReadOnlyEventPress={onReadOnlyEventPress}
        showHeader={false}
        showUntimedSection={false}
      />,
    );
  });
  arbresMontes.push(arbre);
  return arbre;
};

const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ noeud) => [noeud.props.children].flat(Infinity).join(''));

const lignee = (/** @type {any} */ arbre, /** @type {string} */ libelle) => {
  const texte = arbre.root.findAllByType(Text).find((/** @type {any} */ noeud) => (
    [noeud.props.children].flat(Infinity).join('').includes(libelle)
  ));
  if (!texte) throw new Error(`Aucun texte « ${libelle} »`);
  /** @type {any[]} */
  const chaine = [];
  for (let noeud = texte; noeud; noeud = noeud.parent) chaine.push(noeud);
  return chaine;
};

describe('PLANNING-PORTRAIT 1 — le mode « jour » : une seule colonne', () => {
  test('mode « day » : seul le jour courant est montre (le lundi n y est pas)', async () => {
    const arbre = await monter({ mode: 'day' });
    const lus = textes(arbre);

    expect(lus.some((ligne) => ligne.includes('Montrivage FC'))).toBe(true);
    expect(lus.some((ligne) => ligne.includes('AS Ville A'))).toBe(false);
    // L en-tete des jours n a qu une colonne : « mer. 7 ».
    expect(lus.filter((ligne) => /^(lun|mar|mer|jeu|ven|sam|dim)$/.test(ligne))).toEqual(['mer']);
  });

  test('mode « week » : inchange, les deux jours sont la', async () => {
    const lus = textes(await monter({ mode: 'week' }));

    expect(lus.some((ligne) => ligne.includes('Montrivage FC'))).toBe(true);
    expect(lus.some((ligne) => ligne.includes('AS Ville A'))).toBe(true);
  });

  test('mode « day » : un balayage change d UN jour, dans les deux sens', async () => {
    const changer = jest.fn();
    await monter({ mode: 'day', onDateChange: changer });
    const versLaGauche = mockFlings.find((geste) => geste.sens === 'gauche');
    const versLaDroite = mockFlings.find((geste) => geste.sens === 'droite');

    act(() => { versLaGauche.rappel(); });
    act(() => { versLaDroite.rappel(); });

    expect(changer.mock.calls.map(([jour]) => jour.getDate())).toEqual([8, 6]);
  });
});

describe('PLANNING-PORTRAIT 3 — le bloc d un autre club peut s ouvrir EN LECTURE', () => {
  test('avec `onReadOnlyEventPress`, le bloc sans identifiant devient un bouton', async () => {
    const lire = jest.fn();
    const ouvrir = jest.fn();
    const arbre = await monter({ onEventPress: ouvrir, onReadOnlyEventPress: lire });
    const bouton = lignee(arbre, 'Montrivage FC')
      .find((/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function');

    expect(bouton).toBeTruthy();
    expect(bouton.props.accessibilityRole).toBe('button');
    await act(async () => { bouton.props.onPress(); });
    expect(lire).toHaveBeenCalledTimes(1);
    expect(lire.mock.calls[0][0])
      .toEqual(expect.objectContaining({ title: 'Montrivage FC · Senior B' }));
    expect(ouvrir).not.toHaveBeenCalled();
  });

  test('sans `onReadOnlyEventPress` : le bloc reste inerte (FINITIONS2 intacte)', async () => {
    const arbre = await monter({ onEventPress: jest.fn() });

    expect(lignee(arbre, 'Montrivage FC')
      .filter((/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function'))
      .toEqual([]);
  });
});

describe('PLANNING-PORTRAIT 4 — chaque bloc dit le club et l equipe, une fois', () => {
  test('`clubFocused` : « Montrivage FC » puis « Senior B », sans gymnase', async () => {
    const arbre = await monter({ cardDisplayProfile: 'clubFocused', mode: 'day' });
    const lus = textes(arbre);

    expect(lus).toContain('Montrivage FC');
    expect(lus.filter((ligne) => ligne.includes('Senior B'))).toEqual(['Senior B']);
    expect(lus.some((ligne) => ligne.includes('Gymnase de la Ville'))).toBe(false);
  });

  test('bloc d 1 h 30 : la ligne du club ne retrecit plus (elle n est plus ecrasee)', async () => {
    const arbre = await monter({ cardDisplayProfile: 'clubFocused', mode: 'week' });
    const ligneDuClub = arbre.root.findAllByType(Text).find((/** @type {any} */ noeud) => (
      [noeud.props.children].flat(Infinity).join('') === 'Montrivage FC'
    ));

    expect(ligneDuClub).toBeTruthy();
    expect(StyleSheet.flatten(ligneDuClub.props.style).flexShrink).toBe(0);
  });

  test('lecteur d ecran : « Montrivage FC · Senior B, 18:00 – 19:30 »', async () => {
    const arbre = await monter({ cardDisplayProfile: 'clubFocused', mode: 'day' });
    const bloc = lignee(arbre, 'Montrivage FC')
      .find((/** @type {any} */ noeud) => noeud.props?.accessible);

    expect(bloc.props.accessibilityLabel).toBe('Montrivage FC · Senior B, 18:00 – 19:30');
  });
});

// Greffe « planning ton A » (chef, 01/10) : la grille, partagee par la mairie et les clubs,
// ne dit plus « Change de periode » (tutoiement) quand un jour ou une periode est vide.
describe('PLANNING-PORTRAIT ton A — l etat vide de la grille est impersonnel', () => {
  test('un jour sans seance (jeudi) : « Les fleches menent aux autres dates. »', async () => {
    const arbre = await monter({ mode: 'day' });
    await act(async () => {
      arbre.update(
        <PlanningWeekTimelineView
          compactFullscreen
          currentDate={new Date(2026, 9, 8, 12, 0, 0)}
          events={normalizePlanningItems([BLOC_DU_LUNDI, BLOC_DU_MERCREDI_AUTRE_CLUB])}
          mode="day"
          showHeader={false}
          showUntimedSection={false}
        />,
      );
    });
    const lus = textes(arbre);

    expect(lus).toContain('Aucun événement sur cette période');
    expect(lus).toContain('Les flèches mènent aux autres dates.');
    expect(lus.join(' | ')).not.toMatch(/Change de période/);
  });
});
