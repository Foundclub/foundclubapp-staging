import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { getFacilityPlanning } from '@/services/facility/facilityService';

import { FACILITY_PLANNING_PALETTE } from '@/utils/facilityPlanningColor';

import PlanningDesInstallations from '../PlanningDesInstallations';

// 🏟️ R17-PLANNING (20/10/2026, REC17-005 lot 1) — « Planning de toutes les installations », sous
// les cartes de la Ville (planches P10-planning-ordi et P10-planning-tel, validées le 19/10).
// Ordinateur : semaine en grille (une rangée par installation), jour en colonnes (une par
// installation), mois. Téléphone : jour rangé par installation, semaine en liste jour par jour,
// mois. États vide, chargement, erreur. Toucher un bloc ouvre le planning de son installation à ce
// jour ; toucher le nom d'une installation ouvre sa fiche. API simulée, vrais libellés de fr.js.

const i18nextTemoin = require('i18next');

const frTemoin = require('@/theme/strings/translations/fr');

(i18nextTemoin.default || i18nextTemoin).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'fr',
  lng: 'fr',
  resources: { fr: { translation: frTemoin.default } },
});

// Les couleurs d installation de la palette du projet (contrat de thème : aucun hexa en clair).
const [, , VERT, ORANGE, , VIOLET] = FACILITY_PLANNING_PALETTE;

/** @type {any} */
let mockNavigation;
/** @type {boolean} */
let mockOrdinateur = false;
/** @type {any[]} */
const mockCalendriers = [];
/** @type {any[]} */
const mockGrilles = [];

jest.setTimeout(30000);
// Mercredi 21 octobre 2026, midi (semaine du 19 au 25).
jest.mock('@/utils/planning/planningSlots', () => ({
  ...jest.requireActual('@/utils/planning/planningSlots'),
  getPlanningDefaultDate: () => new Date(2026, 9, 21, 12, 0, 0),
}));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNavigation }));
jest.mock('@/responsive', () => ({ useIsDesktop: () => mockOrdinateur }));
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
    default: () => ({
      Colors: couleurs, Fonts: genererPolices(couleurs), Images: { filter: 1 }, Spaces: espaces,
    }),
  };
});
jest.mock('@/services/facility/facilityService', () => ({ getFacilityPlanning: jest.fn() }));
/** @type {any[]} */
let mockFermetures = [];
const mockLectureDesFermetures = jest.fn();
jest.mock('@/services/facilityClosure/facilityClosureService', () => ({
  listCollectiviteClosures: (/** @type {any[]} */ ...args) => {
    mockLectureDesFermetures(...args);
    return Promise.resolve({ data: mockFermetures });
  },
}));
jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteClubs: () => ({ data: [] }),
}));
jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonMock({ children }) { return children; },
);
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { onPress: props.onPress },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});
jest.mock('@/components/organisms/planningCalendarView', () => function CalendrierDouble(
  /** @type {any} */ props,
) {
  mockCalendriers.push(props);
  return null;
});
jest.mock('@/components/organisms/planningWeekTimelineView', () => function GrilleDouble(
  /** @type {any} */ props,
) {
  mockGrilles.push(props);
  return null;
});

const INSTALLATIONS = [
  {
    documentId: 'gym', maxSlots: 2, name: 'Gymnase des Tilleuls', planningColor: VERT,
  },
  {
    documentId: 'dojo', maxSlots: 1, name: 'Dojo municipal', planningColor: VIOLET,
  },
  {
    documentId: 'stade', maxSlots: 2, name: 'Stade municipal', planningColor: ORANGE,
  },
];
const AS = { documentId: 'club-as', name: 'AS Montrivage' };
const FC = { documentId: 'club-fc', name: 'Montrivage FC' };

/**
 * Un créneau d'un club (octobre : Paris = UTC+2).
 * @param {any} club - Le club.
 * @param {string} jour - AAAA-MM-JJ.
 * @param {number} heure - L'heure de début, à Paris.
 * @param {string} equipe - L'équipe.
 * @returns {any} Le bloc, tel que le serveur le rend.
 */
const bloc = (club, jour, heure, equipe) => ({
  club,
  documentId: null,
  endAt: `${jour}T${String(heure - 1).padStart(2, '0')}:30:00.000Z`,
  endTime: `${heure + 1}:30:00.000`,
  hasExplicitTime: true,
  kind: 'slot',
  origin: 'slot',
  pending: false,
  startAt: `${jour}T${String(heure - 2).padStart(2, '0')}:00:00.000Z`,
  startTime: `${heure}:00:00.000`,
  team: { name: equipe },
  title: `${club.name} · ${equipe}`,
});

const SEMAINE = {
  dojo: [],
  gym: [bloc(FC, '2026-10-19', 18, 'Senior B'), bloc(AS, '2026-10-20', 17, 'U15')],
  stade: [bloc(AS, '2026-10-21', 14, 'U11'), bloc(FC, '2026-10-20', 18, 'U17')],
};

/**
 * Le serveur simulé : ce que rend chaque installation, selon le début de la période demandée.
 * @param {Record<string, Record<string, any[]>>} parPlage - Par jour de début, puis installation.
 */
const servir = (parPlage) => {
  /** @type {any} */ (getFacilityPlanning).mockImplementation(async (
    /** @type {string} */ id,
    /** @type {any} */ plage,
  ) => ({ data: parPlage[plage.from]?.[id] || [], meta: {} }));
};

/** @type {Array<{ arbre: any, client: QueryClient }>} */
const montes = [];
const attendre = async () => {
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 20); }); });
};
const ouvrirFiche = jest.fn();
const rendre = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <PlanningDesInstallations
          collectiviteId="ville-montrivage"
          installations={INSTALLATIONS}
          onOuvrirInstallation={ouvrirFiche}
        />
      </QueryClientProvider>,
    );
  });
  await attendre();
  await attendre();
  await attendre();
  montes.push({ arbre, client });
  return arbre;
};
const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants).replace(/\u00a0/g, ' ');
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatir(noeud.props.children).trim());
const parTestID = (/** @type {any} */ arbre, /** @type {string} */ id) => arbre.root
  .findAll((/** @type {any} */ noeud) => noeud.props?.testID === id
    && typeof noeud.props?.onPress === 'function');
const choisir = async (/** @type {any} */ arbre, /** @type {string} */ vue) => {
  await act(async () => { parTestID(arbre, `toutes-vue-${vue}`)[0].props.onPress(); });
  await attendre();
  await attendre();
};
const parTexte = (/** @type {any} */ arbre, /** @type {string} */ libelle) => arbre.root
  .findAllByType(TouchableOpacity)
  .find((/** @type {any} */ noeud) => noeud.findAllByType(Text)
    .some((/** @type {any} */ texte) => aplatir(texte.props.children).trim() === libelle));

beforeEach(() => {
  jest.clearAllMocks();
  mockCalendriers.length = 0;
  mockGrilles.length = 0;
  mockOrdinateur = false;
  mockNavigation = { navigate: jest.fn() };
  mockFermetures = [];
  servir({ '2026-10-01': SEMAINE, '2026-10-19': SEMAINE });
});

afterEach(() => {
  act(() => {
    montes.splice(0).forEach(({ arbre, client }) => {
      arbre.unmount();
      client.clear();
    });
  });
});

describe('R17-PLANNING — téléphone', () => {
  test('1 — Jour (arrivée, aujourd hui plein) : par installation, toutes, même vides', async () => {
    const arbre = await rendre();
    const lus = textes(arbre);
    expect(lus).toContain('Planning de toutes les installations');
    expect(lus).toContain('Mercredi 21 octobre');
    const ordre = ['Gymnase des Tilleuls', 'Dojo municipal', 'Stade municipal']
      .map((nom) => lus.indexOf(nom));
    expect(ordre.every((rang) => rang >= 0)).toBe(true);
    expect([...ordre].sort((a, b) => a - b)).toEqual(ordre);
    expect(lus).toContain('AS Montrivage · U11');
    expect(lus.filter((texte) => texte === 'Rien ce jour')).toHaveLength(2);
    expect(lus.filter((texte) => texte === 'Ouvrir')).toHaveLength(3);
  });

  test('2 — Semaine : la liste jour par jour, chaque ligne dit son installation', async () => {
    const arbre = await rendre();
    await choisir(arbre, 'week');
    const lus = textes(arbre);
    expect(lus).toContain('Lundi 19');
    expect(lus).toContain('Mardi 20');
    expect(lus).toContain('Mercredi 21 · aujourd’hui');
    expect(lus.indexOf('Lundi 19')).toBeLessThan(lus.indexOf('Mardi 20'));
    const mardi = lus.slice(lus.indexOf('Mardi 20'), lus.indexOf('Mercredi 21 · aujourd’hui'));
    expect(mardi).toEqual(expect.arrayContaining([
      'AS Montrivage · U15', 'Gymnase des Tilleuls', 'Montrivage FC · U17', 'Stade municipal',
    ]));
    expect(lus).toContain('19 – 25 octobre'); // R17-PLANNING-2 : le mois en entier (planche, barre)
  });

  test('3 — Mois : couleur de l INSTALLATION ; toucher un jour garde le mois', async () => {
    const arbre = await rendre();
    await choisir(arbre, 'month');
    const calendrier = mockCalendriers.at(-1);
    expect(calendrier.events.filter((/** @type {any} */ b) => b.installation.documentId === 'stade')
      .every((/** @type {any} */ b) => b.displayColor === ORANGE)).toBe(true);
    await act(async () => { calendrier.onDateSelect(new Date(2026, 9, 20, 12)); });
    await attendre();
    // Au téléphone, toucher un jour garde le mois (sa liste s'affiche sous le calendrier).
    expect(mockCalendriers.at(-1).currentDate.getMonth()).toBe(9);
    expect(mockCalendriers.at(-1).currentDate.getDate()).toBe(20);
  });

  test('4 — toucher un bloc ouvre le planning de SON installation, à CE jour', async () => {
    const arbre = await rendre();
    const ligne = arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === 'toutes-ligne'
      && typeof n.props?.onPress === 'function')[0];
    await act(async () => { ligne.props.onPress(); });
    expect(mockNavigation.navigate).toHaveBeenCalledWith(
      'PlanningWeekFullscreen',
      expect.objectContaining({
        contextDetailLabel: 'Stade municipal',
        espace: 'ville',
        facilityId: 'stade',
        sourceType: 'facility',
      }),
    );
    const { date } = mockNavigation.navigate.mock.calls[0][1];
    expect(new Date(date).getDate()).toBe(21);
  });

  test('5 — « Ouvrir » ouvre la fiche de l installation', async () => {
    const arbre = await rendre();
    await act(async () => { parTexte(arbre, 'Ouvrir').props.onPress(); });
    expect(ouvrirFiche).toHaveBeenCalledWith(INSTALLATIONS[0]);
  });
});

describe('R17-PLANNING — ordinateur', () => {
  beforeEach(() => { mockOrdinateur = true; });

  test('6 — Semaine : une rangée par installation, une colonne par jour, sa capacité', async () => {
    const arbre = await rendre();
    await choisir(arbre, 'week');
    const lus = textes(arbre);
    expect(arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === 'toutes-grille'))
      .not.toHaveLength(0);
    ['gym', 'dojo', 'stade'].forEach((id) => {
      expect(arbre.root.findAll((/** @type {any} */ n) => (
        n.props?.testID === `toutes-rangee-${id}`)))
        .not.toHaveLength(0);
    });
    expect(lus).toContain('2 équipes à la fois');
    expect(lus).toContain('1 équipe à la fois');
    expect(lus).toContain('Séances des clubs, semaine du 19 octobre.');
    // La légende : une couleur par club.
    expect(lus).toEqual(expect.arrayContaining(['AS Montrivage', 'Montrivage FC']));
  });

  test('7 — Jour : une colonne par installation (les `lanes`)', async () => {
    await rendre();
    const grille = mockGrilles.at(-1);
    expect(grille.mode).toBe('day');
    expect(grille.lanes.map((/** @type {any} */ l) => l.label))
      .toEqual(['Gymnase des Tilleuls', 'Dojo municipal', 'Stade municipal']);
    const auStade = grille.events.find((/** @type {any} */ b) => b.title === 'AS Montrivage · U11');
    expect(grille.laneOf(auStade)).toBe(2);
  });

  test('8 bis ROUGE-AVANT — Mois : un autre MOIS reste au mois, sans double en-tête', async () => {
    const arbre = await rendre();
    await choisir(arbre, 'month');
    // Le calendrier a son en-tête (mois, flèches, « Aujourd’hui ») : la section ne le double pas.
    expect(arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === 'toutes-periode'))
      .toHaveLength(0);
    await act(async () => { mockCalendriers.at(-1).onDateSelect(new Date(2026, 10, 1, 12)); });
    await attendre();
    expect(mockCalendriers.at(-1).currentDate.getMonth()).toBe(10);
    expect(textes(arbre)).not.toContain('Dimanche 1 novembre');
  });

  test('8 — Mois : un clic sur un jour ouvre la vue Jour à cette date', async () => {
    const arbre = await rendre();
    await choisir(arbre, 'month');
    await act(async () => { mockCalendriers.at(-1).onDateSelect(new Date(2026, 9, 20, 12)); });
    await attendre();
    expect(textes(arbre)).toContain('Mardi 20 octobre');
    expect(mockGrilles.at(-1).mode).toBe('day');
  });
});

describe('R17-PLANNING — états', () => {
  test('9 — chargement : le squelette, puis le planning', async () => {
    /**
     * Livre la lecture en attente.
     * @type {(valeur: any) => void}
     */
    let livrer = () => {};
    /** @type {any} */ (getFacilityPlanning).mockImplementation(() => new Promise((resolve) => {
      livrer = resolve;
    }));
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } });
    /** @type {any} */
    let arbre;
    await act(async () => {
      arbre = renderer.create(
        <QueryClientProvider client={client}>
          <PlanningDesInstallations
            collectiviteId="ville-montrivage"
            installations={INSTALLATIONS}
            onOuvrirInstallation={ouvrirFiche}
          />
        </QueryClientProvider>,
      );
    });
    montes.push({ arbre, client });
    expect(arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === 'toutes-chargement'))
      .not.toHaveLength(0);
    livrer({ data: [] });
  });

  test('10 — erreur : on le dit, on propose de réessayer ; la relance relit', async () => {
    /** @type {any} */ (getFacilityPlanning).mockImplementation(async () => {
      throw new Error('500');
    });
    const arbre = await rendre();
    const lus = textes(arbre);
    expect(lus).toContain('Le planning n’a pas pu être chargé.');
    expect(lus).toContain(
      'Vérifiez la connexion. Les installations restent accessibles au-dessus.',
    );
    const appels = /** @type {any} */ (getFacilityPlanning).mock.calls.length;
    await act(async () => { parTexte(arbre, 'Réessayer').props.onPress(); });
    await attendre();
    expect(/** @type {any} */ (getFacilityPlanning).mock.calls.length).toBeGreaterThan(appels);
  });

  test('11 — semaine vide, rien après : la phrase et « Voir la semaine suivante »', async () => {
    servir({});
    const arbre = await rendre();
    expect(textes(arbre)).toContain('Rien ce mercredi');
    await choisir(arbre, 'week');
    expect(textes(arbre)).toContain('Aucune séance du 19 oct. au 25 oct.');
    await act(async () => { parTexte(arbre, 'Voir la semaine suivante').props.onPress(); });
    await attendre();
    expect(textes(arbre)).toContain('26 oct. – 1 nov.');
  });

  test('12 — R17-VUE à l arrivée : aujourd hui vide, samedi plein ⇒ la SEMAINE', async () => {
    servir({ '2026-10-19': { dojo: [bloc(AS, '2026-10-24', 10, 'U9')], gym: [], stade: [] } });
    const arbre = await rendre();
    const lus = textes(arbre);
    expect(lus).toContain('19 – 25 octobre');
    expect(lus).toContain('Samedi 24');
    expect(lus).toContain('Dojo municipal');
  });
});

describe('R17-PLANNING-2 — fermetures et « complet » dans les cases (P10-planning-ordi 1)', () => {
  beforeEach(() => {
    mockOrdinateur = true;
    mockFermetures = [{
      documentId: 'f-dojo',
      endDate: '2026-10-22',
      facility: { documentId: 'dojo', name: 'Dojo municipal' },
      kind: 'closure',
      label: 'désinfection',
      reason: 'other',
      startDate: '2026-10-22',
    }];
    servir({
      '2026-10-19': {
        ...SEMAINE,
        gym: [bloc(AS, '2026-10-22', 18, 'U15'), bloc(FC, '2026-10-22', 18, 'Senior B')],
      },
    });
  });

  test('13 ROUGE-AVANT — la fermeture dans SA case, « complet », la légende', async () => {
    const arbre = await rendre();
    await choisir(arbre, 'week');
    // UNE lecture des fermetures de la Ville, à partir du début de la semaine affichée.
    expect(mockLectureDesFermetures)
      .toHaveBeenCalledWith('ville-montrivage', { from: '2026-10-19' });
    const dojo = arbre.root.findAll((/** @type {any} */ n) => (
      n.props?.testID === 'toutes-rangee-dojo'))[0];
    const lusDojo = dojo.findAllByType(Text)
      .map((/** @type {any} */ n) => aplatir(n.props.children));
    expect(lusDojo).toContain('Fermé · désinfection');
    const gym = arbre.root.findAll((/** @type {any} */ n) => (
      n.props?.testID === 'toutes-rangee-gym'))[0];
    const lusGym = gym.findAllByType(Text)
      .map((/** @type {any} */ n) => aplatir(n.props.children));
    expect(lusGym.filter((texte) => texte === '18:00 – 19:30 · complet')).toHaveLength(2);
    expect(textes(arbre)).toContain('Fermeture');
  });

  test('14 ROUGE-AVANT — au téléphone, Jour : la fermeture sous son installation', async () => {
    mockOrdinateur = false;
    const arbre = await rendre();
    await act(async () => {
      parTestID(arbre, 'toutes-vue-day')[0].props.onPress();
    });
    await attendre();
    // Aller au jeudi 22 (flèche « Jour suivant »).
    const suivant = arbre.root.findAll((/** @type {any} */ n) => (
      n.props?.accessibilityLabel === 'Jour suivant' && typeof n.props?.onPress === 'function'))[0];
    await act(async () => { suivant.props.onPress(); });
    await attendre();
    const lus = textes(arbre);
    expect(lus).toContain('Jeudi 22 octobre');
    expect(lus.indexOf('Fermé · désinfection')).toBeGreaterThan(lus.indexOf('Dojo municipal'));
  });
});

describe('R17-PLANNING-2 — un jour sans rien, au-delà de la semaine (P10-planning-tel 4)', () => {
  test('15 ROUGE-AVANT — dimanche vide : la séance de la semaine SUIVANTE, y aller', async () => {
    servir({
      '2026-10-19': SEMAINE,
      '2026-10-26': { dojo: [], gym: [bloc(FC, '2026-10-26', 18, 'Senior B')], stade: [] },
    });
    const arbre = await rendre();
    const suivant = () => arbre.root.findAll((/** @type {any} */ n) => (
      n.props?.accessibilityLabel === 'Jour suivant' && typeof n.props?.onPress === 'function'))[0];
    // Du mercredi 21 au dimanche 25 : quatre fois « Jour suivant ».
    await [22, 23, 24, 25].reduce(async (avant) => {
      await avant;
      await act(async () => { suivant().props.onPress(); });
      await attendre();
    }, Promise.resolve());
    await attendre();
    const lus = textes(arbre);
    expect(lus).toContain('Rien ce dimanche');
    expect(lus).toContain('Prochaine séance : lundi 26, 18:00, Gymnase des Tilleuls.');
    // La suite n'est lue que pour ce jour vide : du lundi 26, 31 jours.
    const lectures = /** @type {any} */ (getFacilityPlanning).mock.calls
      .map((/** @type {any[]} */ appel) => `${appel[1].from}>${appel[1].to}`);
    expect(lectures).toContain('2026-10-26>2026-11-25');
    await act(async () => { parTexte(arbre, 'Aller au lundi 26').props.onPress(); });
    await attendre();
    await attendre();
    expect(textes(arbre)).toContain('Lundi 26 octobre');
  });
});

describe('R17-PLANNING-2 — la prochaine séance dans un AUTRE mois dit son mois', () => {
  test('15 bis ROUGE-AVANT — dimanche 25 octobre vide : « mardi 3 novembre »', async () => {
    servir({
      '2026-10-19': SEMAINE,
      '2026-10-26': { dojo: [], gym: [bloc(FC, '2026-11-03', 18, 'Senior B')], stade: [] },
    });
    const arbre = await rendre();
    const suivant = () => arbre.root.findAll((/** @type {any} */ n) => (
      n.props?.accessibilityLabel === 'Jour suivant' && typeof n.props?.onPress === 'function'))[0];
    await [22, 23, 24, 25].reduce(async (avant) => {
      await avant;
      await act(async () => { suivant().props.onPress(); });
      await attendre();
    }, Promise.resolve());
    await attendre();
    const lus = textes(arbre);
    expect(lus).toContain('Rien ce dimanche');
    expect(lus.find((texte) => texte.startsWith('Prochaine séance')))
      .toMatch(/^Prochaine séance : mardi 3 novembre, /);
    expect(parTexte(arbre, 'Aller au mardi 3 novembre')).toBeDefined();
  });
});

describe('R17-PLANNING-2 — la ligne « 3 installations » (P10-planning-tel 1)', () => {
  test('16 ROUGE-AVANT — téléphone, Jour : « 3 installations » au-dessus de la date', async () => {
    const arbre = await rendre();
    const lus = textes(arbre);
    expect(lus).toContain('3 installations');
    expect(lus.indexOf('3 installations')).toBe(lus.indexOf('Mercredi 21 octobre') - 1);
  });

  test('17 PROTEGE — sur ordinateur, pas de ligne en plus', async () => {
    mockOrdinateur = true;
    await choisir(await rendre(), 'day');
    expect(textes(montes.at(-1).arbre)).not.toContain('3 installations');
  });
});

describe('R17-PLANNING-2 — le filtre au téléphone (P10-planning-tel 2)', () => {
  test('18 ROUGE-AVANT — Semaine : « Toutes les installations », une, puis toutes', async () => {
    const arbre = await rendre();
    await choisir(arbre, 'week');
    expect(textes(arbre)).toContain('Toutes les installations');
    const lignes = () => arbre.root.findAllByType(TouchableOpacity)
      .filter((/** @type {any} */ n) => n.props.testID === 'toutes-ligne');
    expect(lignes()).toHaveLength(4);
    const filtrer = arbre.root.findAll((/** @type {any} */ n) => (
      n.props?.accessibilityLabel === 'Filtrer par installation'
      && typeof n.props?.onPress === 'function'))[0];
    await act(async () => { filtrer.props.onPress(); });
    const choix = (/** @type {string} */ nom) => arbre.root.findAll((/** @type {any} */ n) => (
      n.props?.accessibilityRole === 'radio' && n.props?.accessibilityLabel === nom
      && typeof n.props?.onPress === 'function'))[0];
    expect(choix('Toutes les installations').props.accessibilityState).toEqual({ checked: true });
    await act(async () => { choix('Stade municipal').props.onPress(); });
    await attendre();
    expect(lignes()).toHaveLength(2);
    expect(lignes().every((/** @type {any} */ n) => n.props.accessibilityLabel
      .endsWith('Stade municipal'))).toBe(true);
    expect(textes(arbre)).toContain('Stade municipal');
    expect(textes(arbre)).not.toContain('Toutes les installations');
    await act(async () => { filtrer.props.onPress(); });
    await act(async () => { choix('Toutes les installations').props.onPress(); });
    await attendre();
    expect(lignes()).toHaveLength(4);
  });
});

describe('R17-PLANNING-2 — la pastille avec son nombre, au mois (P10-planning-ordi 3)', () => {
  test('19 ROUGE-AVANT — ordinateur : le mois compte les séances, pas le téléphone', async () => {
    mockOrdinateur = true;
    const arbre = await rendre();
    await choisir(arbre, 'month');
    const { compterLesSeances } = mockCalendriers.at(-1);
    expect(typeof compterLesSeances).toBe('function');
    expect(compterLesSeances(1)).toBe('1 séance');
    expect(compterLesSeances(3)).toBe('3 séances');
    mockOrdinateur = false;
    const auTelephone = await rendre();
    await choisir(auTelephone, 'month');
    expect(mockCalendriers.at(-1).compterLesSeances).toBeFalsy();
  });
});

describe('R17-PLANNING-2 — semaine vide : combien la suivante en a (P10-planning-ordi 4)', () => {
  /**
   * Rien la semaine du 19 ; 3 séances la semaine du 26 (gymnase 2, stade 1), lues seulement pour
   * CETTE semaine (la lecture de 31 jours de R17-VUE n'en rend rien : l'arrivée reste au Jour).
   */
  const servirLaSuivante = () => {
    /** @type {any} */ (getFacilityPlanning).mockImplementation(async (
      /** @type {string} */ id,
      /** @type {any} */ plage,
    ) => {
      const suivante = {
        dojo: [],
        gym: [bloc(AS, '2026-10-27', 18, 'U15'), bloc(FC, '2026-10-28', 18, 'Senior B')],
        stade: [bloc(AS, '2026-10-29', 14, 'U11')],
      };
      const laSuivante = plage.from === '2026-10-26' && plage.to === '2026-11-01';
      return { data: laSuivante ? suivante[/** @type {'dojo'} */ (id)] : [], meta: {} };
    });
  };
  const lecturesDeLaSuivante = () => /** @type {any} */ (getFacilityPlanning).mock.calls
    .filter((/** @type {any[]} */ appel) => (
      appel[1].from === '2026-10-26' && appel[1].to === '2026-11-01'));

  test('20 ROUGE-AVANT — téléphone : « …en a 3. », puis elle s affiche sans relire', async () => {
    servirLaSuivante();
    const arbre = await rendre();
    await choisir(arbre, 'week');
    expect(textes(arbre)).toContain('Aucune séance du 19 oct. au 25 oct.');
    expect(textes(arbre)).toContain('La semaine suivante en a 3.');
    expect(lecturesDeLaSuivante()).toHaveLength(3);
    await act(async () => { parTexte(arbre, 'Voir la semaine suivante').props.onPress(); });
    await attendre();
    expect(textes(arbre)).toContain('26 oct. – 1 nov.');
    expect(arbre.root.findAllByType(TouchableOpacity)
      .filter((/** @type {any} */ n) => n.props.testID === 'toutes-ligne')).toHaveLength(3);
    // Les mêmes lectures : aller à la semaine suivante ne relit rien.
    expect(lecturesDeLaSuivante()).toHaveLength(3);
  });

  test('21 ROUGE-AVANT — ordinateur : la phrase, la grille ; filtre au dojo : rien', async () => {
    servirLaSuivante();
    mockOrdinateur = true;
    const arbre = await rendre();
    await choisir(arbre, 'week');
    expect(textes(arbre)).toContain('La semaine suivante en a 3.');
    expect(arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === 'toutes-grille'))
      .not.toHaveLength(0);
    mockOrdinateur = false;
    const auTelephone = await rendre();
    await choisir(auTelephone, 'week');
    const filtrer = auTelephone.root.findAll((/** @type {any} */ n) => (
      n.props?.accessibilityLabel === 'Filtrer par installation'
      && typeof n.props?.onPress === 'function'))[0];
    await act(async () => { filtrer.props.onPress(); });
    const dojo = auTelephone.root.findAll((/** @type {any} */ n) => (
      n.props?.accessibilityRole === 'radio' && n.props?.accessibilityLabel === 'Dojo municipal'
      && typeof n.props?.onPress === 'function'))[0];
    await act(async () => { dojo.props.onPress(); });
    await attendre();
    expect(textes(auTelephone)).toContain('Aucune séance du 19 oct. au 25 oct.');
    expect(textes(auTelephone).join('|')).not.toMatch(/semaine suivante en a/);
  });

  test('22 PROTEGE — une semaine pleine ne lit pas la suivante', async () => {
    const arbre = await rendre();
    await choisir(arbre, 'week');
    expect(textes(arbre)).toContain('Mardi 20');
    expect(lecturesDeLaSuivante()).toHaveLength(0);
  });
});

// 🏛️ R17-EVT-1-BIS (a) (20/10/2026, tri du chef) — L'ÉVÉNEMENT DE LA VILLE dans « Planning de
// toutes les installations » : le planning de chaque installation le porte déjà
// (`meta.evenementsDeLaVille`). Il s'y lit comme dans le planning d'UNE installation : un bloc
// CLAIR « Ville · toute l'installation », à part des séances ; son blocage lié (« Bloqué par la
// Ville ») ne se dessine pas en plus ; le toucher ouvre SA fiche. Semaine et jour (ordinateur et
// téléphone), mois. ROUGE avant.
describe('R17-EVT-1-BIS — l’événement de la Ville, toutes les installations', () => {
  const FETE_VILLE = {
    closureDocumentId: 'bloc-fete',
    collectivite: { documentId: 'ville-montrivage', name: 'Ville de Montrivage' },
    documentId: 'evt-fete',
    endDate: '2026-10-22',
    endTime: '15:30',
    facility: { documentId: 'stade', name: 'Stade municipal' },
    name: 'Fête du sport',
    startDate: '2026-10-22',
    startTime: '14:00',
    takesPlace: true,
  };
  beforeEach(() => {
    mockFermetures = [{
      documentId: 'bloc-fete',
      endDate: '2026-10-22',
      endTime: '15:30',
      facility: { documentId: 'stade', name: 'Stade municipal' },
      kind: 'block',
      label: 'Fête du sport',
      startDate: '2026-10-22',
      startTime: '14:00',
    }];
    /** @type {any} */ (getFacilityPlanning).mockImplementation(async (
      /** @type {string} */ id,
      /** @type {any} */ plage,
    ) => ({
      data: plage.from <= '2026-10-21' && plage.to >= '2026-10-21' ? (SEMAINE[id] || []) : [],
      meta: id === 'stade' && plage.from <= '2026-10-22' && plage.to >= '2026-10-22'
        ? { evenementsDeLaVille: [FETE_VILLE] }
        : {},
    }));
  });
  const allerAuJeudi = async (/** @type {any} */ arbre) => {
    await act(async () => { parTestID(arbre, 'toutes-vue-day')[0].props.onPress(); });
    await attendre();
    const suivant = arbre.root.findAll((/** @type {any} */ n) => (
      n.props?.accessibilityLabel === 'Jour suivant' && typeof n.props?.onPress === 'function'))[0];
    await act(async () => { suivant.props.onPress(); });
    await attendre();
    await attendre();
  };

  test('16 ROUGE-AVANT — ordinateur, Semaine : le bloc clair au stade, sans le blocage', async () => {
    mockOrdinateur = true;
    const arbre = await rendre();
    await choisir(arbre, 'week');
    const stade = arbre.root.findAll((/** @type {any} */ n) => (
      n.props?.testID === 'toutes-rangee-stade'))[0];
    const lusStade = stade.findAllByType(Text)
      .map((/** @type {any} */ n) => aplatir(n.props.children));
    expect(lusStade)
      .toEqual(expect.arrayContaining(['Ville · toute l’installation', 'Fête du sport']));
    expect(lusStade.join(' ')).not.toMatch(/Bloqué par la Ville/);
    // Une seule case (le bouton, pas ses nœuds natifs).
    const case22 = arbre.root.findAllByType(TouchableOpacity).filter((/** @type {any} */ n) => (
      n.props.testID === 'toutes-evenement-ville-evt-fete-2026-10-22'));
    expect(case22).toHaveLength(1);
    await act(async () => { case22[0].props.onPress(); });
    expect(mockNavigation.navigate)
      .toHaveBeenCalledWith('EvenementDeLaVille', { evenementId: 'evt-fete' });
  });

  test('17 ROUGE-AVANT — ordinateur, Jour : dans la colonne du stade, et il s’ouvre', async () => {
    mockOrdinateur = true;
    const arbre = await rendre();
    await allerAuJeudi(arbre);
    const grille = mockGrilles[mockGrilles.length - 1];
    const evenement = grille.events.find((/** @type {any} */ e) => e?.raw?.evenementDeLaVille);
    expect(evenement).toBeDefined();
    expect(grille.laneOf(evenement)).toBe(2);
    grille.onEvenementVillePress(evenement.raw.evenementDeLaVille);
    expect(mockNavigation.navigate)
      .toHaveBeenCalledWith('EvenementDeLaVille', { evenementId: 'evt-fete' });
  });

  test('18 ROUGE-AVANT — téléphone, Jour : sous le stade, le bloc clair', async () => {
    const arbre = await rendre();
    await allerAuJeudi(arbre);
    const lus = textes(arbre);
    expect(lus.indexOf('Fête du sport')).toBeGreaterThan(lus.indexOf('Stade municipal'));
    expect(lus.join(' ')).not.toMatch(/Bloqué par la Ville/);
  });

  test('19 ROUGE-AVANT — téléphone, Semaine : le jeudi 22 le dit, et son installation', async () => {
    const arbre = await rendre();
    await choisir(arbre, 'week');
    const lus = textes(arbre);
    expect(lus.indexOf('Fête du sport')).toBeGreaterThan(lus.indexOf('Jeudi 22'));
    expect(lus).toContain('Stade municipal · 14:00 – 15:30');
  });

  test('20 ROUGE-AVANT — Mois : le calendrier reçoit l’événement (son repère clair)', async () => {
    mockOrdinateur = true;
    const arbre = await rendre();
    await choisir(arbre, 'month');
    const calendrier = mockCalendriers[mockCalendriers.length - 1];
    const evenement = calendrier.events
      .find((/** @type {any} */ e) => e?.raw?.evenementDeLaVille?.documentId === 'evt-fete');
    expect(evenement).toBeDefined();
    calendrier.onEventPress(evenement);
    expect(mockNavigation.navigate)
      .toHaveBeenCalledWith('EvenementDeLaVille', { evenementId: 'evt-fete' });
  });
});
