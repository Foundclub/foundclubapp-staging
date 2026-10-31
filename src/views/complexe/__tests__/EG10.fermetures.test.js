import renderer, { act } from 'react-test-renderer';

import ComplexeFermetures from '@/views/complexe/ComplexeFermetures';

import {
  lisibles,
  parRepere,
  pressable,
  terrainDeTemoin,
} from '@/testSupport/temoinComplexe';

// RESA-L5A2 (14/10/2026) — E-G10 « Les fermetures exceptionnelles » (planche EG10) : la liste à
// venir (une ligne par geste, « Rouvrir »), le formulaire (terrains, du / au, motif, mot aux
// joueurs), le bloc d'impact (« 4 réservations sont touchées. », « Voir lesquelles »), « Fermer et
// prévenir » ou « Fermer ». Doublures : les routes des fermetures élargies par RESA-L2A
// (`meta.reservations` de l'aperçu, `reservations.annulees` de la fermeture) ; UNE fermeture PAR
// terrain (règle d'app du contrat).

let mockParams = /** @type {any} */ ({});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
  useRoute: () => ({ params: mockParams }),
}));

let mockFermetures = /** @type {any} */ ({});
let mockApercu = /** @type {any} */ ({});
/** @type {any[]} */
const mockApercusLus = [];
const mockFermer = jest.fn();
const mockRouvrir = jest.fn();
const mockModifier = jest.fn();
jest.mock('@/services/complexe/complexeQueries', () => ({
  useApercuFermeture: (/** @type {any[]} */ ...args) => {
    mockApercusLus.push(args);
    return mockApercu;
  },
  useComplexeChoisi: () => ({
    complexe: jest.requireActual('@/testSupport/temoinComplexe').COMPLEXE_FIVE,
    complexeId: 'cx-five',
    mes: { isLoading: false },
  }),
  useFermerTerrains: () => ({ isPending: false, mutateAsync: mockFermer }),
  useFermetures: () => mockFermetures,
  useModifierFermetures: () => ({ isPending: false, mutateAsync: mockModifier }),
  useRouvrirFermetures: () => ({ isPending: false, mutateAsync: mockRouvrir }),
  useTerrains: () => ({
    data: [
      jest.requireActual('@/testSupport/temoinComplexe').terrainDeTemoin(),
      jest.requireActual('@/testSupport/temoinComplexe').terrainDeTemoin({
        documentId: 't-2', name: 'Terrain 2',
      }),
      jest.requireActual('@/testSupport/temoinComplexe').terrainDeTemoin({
        documentId: 't-3', name: 'Padel A',
      }),
    ],
    isLoading: false,
  }),
}));

jest.mock('@/responsive', () => ({ useIsDesktop: () => false }));
jest.mock('@/components/molecules/bottomModal/BottomModal', () => (
  function FausseFeuille(/** @type {any} */ { children, isVisible }) {
    return isVisible ? children : null;
  }
));
jest.mock('@/components/molecules/input/Input', () => {
  const { TextInput: Saisie } = jest.requireActual('react-native');
  return function FausseSaisie(/** @type {any} */ { label, onChangeText, value }) {
    return <Saisie accessibilityLabel={label} onChangeText={onChangeText} value={value} />;
  };
});
jest.mock('@/components/molecules/datePickerInput/DatePickerInput', () => {
  const { TextInput: Saisie } = jest.requireActual('react-native');
  return function FausseDate(/** @type {any} */ { label, onChange, value }) {
    return <Saisie accessibilityLabel={label} onChangeText={onChange} value={value} />;
  };
});
jest.mock('@/components/templates/ScreenContainer', () => (
  function FauxConteneur(/** @type {any} */ { children }) {
    return children;
  }
));
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));

/**
 * Une fermeture telle que la liste du serveur la rend (`toClosureView`), avec son terrain.
 * @param {Record<string, any>} autres - Ce qui change.
 * @returns {Record<string, any>} La fermeture.
 */
const fermeture = (autres) => ({
  endDate: '2026-10-26',
  kind: 'closure',
  label: null,
  message: null,
  reason: 'travaux',
  startDate: '2026-10-25',
  status: 'active',
  ...autres,
});

/**
 * Monte l'écran.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ComplexeFermetures />);
  });
  return arbre;
};

/**
 * Appuie sur le premier élément pressable du repère (ou sur le repère lui-même).
 * @param {any} arbre - L'arbre.
 * @param {string} testID - Le repère.
 * @returns {Promise<void>} Fini.
 */
const toucher = async (arbre, testID) => {
  const noeud = parRepere(arbre, testID);
  const cible = typeof noeud.props?.onPress === 'function'
    ? noeud
    : noeud.findAll((/** @type {any} */ n) => typeof n.props?.onPress === 'function')[0];
  await act(async () => {
    cible.props.onPress();
  });
};

/**
 * Écrit dans le champ de ce libellé.
 * @param {any} arbre - L'arbre.
 * @param {string} libelle - Le libellé.
 * @param {string} texte - Le texte.
 * @returns {Promise<void>} Fini.
 */
const ecrire = async (arbre, libelle, texte) => {
  const champ = arbre.root.findAll((/** @type {any} */ n) => (
    n.props?.accessibilityLabel === libelle && typeof n.props?.onChangeText === 'function'
  ))[0];
  await act(async () => {
    champ.props.onChangeText(texte);
  });
};

/**
 * Remplit le formulaire : tous les terrains, du 25 au 26/10, travaux, un mot.
 * @param {any} arbre - L'arbre.
 * @returns {Promise<void>} Fini.
 */
const remplir = async (arbre) => {
  await toucher(arbre, 'fermeture-terrain-tous');
  await ecrire(arbre, 'Du', '25/10/2026');
  await ecrire(arbre, 'Au', '26/10/2026');
  await toucher(arbre, 'fermeture-motif-travaux');
  await ecrire(arbre, 'Mot aux joueurs (facultatif)', 'Réfection du gazon');
};

beforeAll(() => {
  jest.useFakeTimers({
    doNotFake: [
      'nextTick', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval',
      'setTimeout', 'clearTimeout', 'queueMicrotask', 'requestAnimationFrame',
      'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'performance',
      'hrtime',
    ],
    now: new Date('2026-10-14T08:00:00.000Z'),
  });
});

afterAll(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  jest.clearAllMocks();
  mockApercusLus.length = 0;
  mockParams = { complexeId: 'cx-five' };
  mockFermetures = {
    data: [
      fermeture({ documentId: 'f-1', terrainId: 't-1' }),
      fermeture({ documentId: 'f-2', terrainId: 't-2' }),
      fermeture({
        documentId: 'f-4',
        endDate: '2026-10-15',
        label: 'Météo',
        reason: 'autre',
        startDate: '2026-10-13',
        terrainId: 't-3',
      }),
    ],
    isLoading: false,
    refetch: jest.fn(),
  };
  mockApercu = { data: undefined, isLoading: false };
  mockFermer.mockResolvedValue({ annulees: 4, echecs: [], faits: 3 });
  mockRouvrir.mockResolvedValue({ echecs: [], faits: 2 });
  mockModifier.mockResolvedValue({ annulees: 0, echecs: [], faits: 2 });
});

describe('RESA-L5A2 E-G10 — la liste à venir (états 1, 4, 7)', () => {
  it('une ligne par geste, la plus proche d’abord, en cours ou à venir', async () => {
    const arbre = await monter();
    const lus = lisibles(arbre);
    const ordre = [
      'FERMETURES',
      '13/10 – 15/10 · Météo',
      'Padel A',
      'En cours',
      '25/10 – 26/10 · Travaux',
      'Terrain 1, Terrain 2',
      'À venir',
      'Nouvelle fermeture',
    ].map((texte) => lus.indexOf(texte));
    expect(ordre.every((index) => index > -1)).toBe(true);
    expect([...ordre].sort((a, b) => a - b)).toEqual(ordre);
  });

  it('« Rouvrir » : la confirmation, puis chaque fermeture du geste rouverte', async () => {
    const arbre = await monter();
    await toucher(arbre, 'fermeture-rouvrir-2026-10-25|2026-10-26|travaux|');
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Rouvrir Terrain 1, Terrain 2 : 25/10 – 26/10 ?',
      'Les créneaux redeviennent libres. Les réservations annulées ne reviennent pas.',
    ]));
    await toucher(arbre, 'fermeture-confirmer-rouvrir');
    expect(mockRouvrir).toHaveBeenCalledWith(['f-1', 'f-2']);
    expect(lisibles(arbre)).toContain('Rouvert : les créneaux sont libres.');
  });

  it('aucune fermeture : « Aucune fermeture prévue. » (état 6)', async () => {
    mockFermetures = { ...mockFermetures, data: [] };
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Aucune fermeture prévue.');
  });

  it('erreur : « Impossible de charger les fermetures. » et « Réessayer » (état 8)', async () => {
    const refetch = jest.fn();
    mockFermetures = {
      data: undefined, error: new Error('boum'), isLoading: false, refetch,
    };
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Impossible de charger les fermetures.');
    await act(async () => {
      pressable(arbre, 'Réessayer').props.onPress();
    });
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe('RESA-L5A2 E-G10 — fermer (états 1, 2, 3, 5)', () => {
  it('l’aperçu suit la saisie ; « 4 réservations sont touchées. »', async () => {
    mockApercu = {
      data: {
        count: 4,
        items: [{
          date: '2026-10-25',
          documentId: 'r-1',
          from: '19:00',
          label: 'Julien M.',
          terrainId: 't-1',
          to: '20:00',
        }],
      },
      isLoading: false,
    };
    const arbre = await monter();
    await remplir(arbre);
    expect(mockApercusLus[mockApercusLus.length - 1]).toEqual([
      'cx-five', ['t-1', 't-2', 't-3'], { endDate: '2026-10-26', startDate: '2026-10-25' },
    ]);
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      '4 réservations sont touchées.',
      'Elles seront annulées et les joueurs prévenus.',
    ]));
    await toucher(arbre, 'fermeture-voir-lesquelles');
    expect(lisibles(arbre)).toContain('dimanche 25/10 · 19 h · Terrain 1 · Julien M.');
    await toucher(arbre, 'fermeture-fermer');
    expect(mockFermer).toHaveBeenCalledWith({
      fermeture: {
        endDate: '2026-10-26',
        message: 'Réfection du gazon',
        reason: 'travaux',
        startDate: '2026-10-25',
      },
      terrainIds: ['t-1', 't-2', 't-3'],
    });
    expect(lisibles(arbre)).toContain('Fermé : 25/10 – 26/10. 4 joueurs prévenus.');
  });

  it('impact nul : « Fermer », « Personne à prévenir. » ; Jour férié = son nom', async () => {
    mockApercu = { data: { count: 0, items: [] }, isLoading: false };
    mockFermer.mockResolvedValue({ annulees: 0, echecs: [], faits: 1 });
    mockParams = { complexeId: 'cx-five', terrainId: 't-3' };
    const arbre = await monter();
    await ecrire(arbre, 'Du', '01/11/2026');
    await ecrire(arbre, 'Au', '01/11/2026');
    await toucher(arbre, 'fermeture-motif-ferie');
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Aucune réservation touchée.', 'Personne à prévenir.', 'Fermer',
    ]));
    await toucher(arbre, 'fermeture-fermer');
    expect(mockFermer).toHaveBeenCalledWith({
      fermeture: {
        endDate: '2026-11-01', label: 'Jour férié', reason: 'autre', startDate: '2026-11-01',
      },
      terrainIds: ['t-3'],
    });
    expect(lisibles(arbre)).toContain('Fermé : 01/11.');
  });

  it('rien ne part tant qu’un terrain, les jours ou le motif manquent', async () => {
    const arbre = await monter();
    const bouton = () => parRepere(arbre, 'fermeture-fermer')
      .findAll((/** @type {any} */ n) => (
        typeof n.props?.onPress === 'function' && 'disabled' in n.props
      ))[0];
    expect(bouton().props.disabled).toBe(true);
    await toucher(arbre, 'fermeture-terrain-t-1');
    await ecrire(arbre, 'Du', '25/10/2026');
    await ecrire(arbre, 'Au', '26/10/2026');
    expect(bouton().props.disabled).toBe(true);
    await toucher(arbre, 'fermeture-motif-meteo');
    expect(bouton().props.disabled).toBe(false);
  });
});

describe('RESA-L5B-1 B2 E-G10 — « Voir lesquelles » : la source (serveur RESA-L2C)', () => {
  /**
   * Un nœud de l'arbre, lu comme un arbre par les outils du banc.
   * @param {any} noeud - Le nœud.
   * @returns {{ root: any }} L'arbre.
   */
  const dans = (noeud) => ({ root: noeud });
  const touchee = (/** @type {Record<string, any>} */ autres) => ({
    date: '2026-10-25',
    documentId: 'r-1',
    from: '19:00',
    label: 'Julien M.',
    source: 'app',
    terrainId: 't-1',
    to: '20:00',
    ...autres,
  });

  it('« App » ou « Extérieur » sur chaque ligne ; une extérieure : appeler le client', async () => {
    mockApercu = {
      data: {
        count: 2,
        items: [
          touchee({}),
          touchee({
            documentId: 'r-2', from: '20:00', label: 'M. Dupont', source: 'exterieur', to: '21:00',
          }),
        ],
      },
      isLoading: false,
    };
    const arbre = await monter();
    await remplir(arbre);
    await toucher(arbre, 'fermeture-voir-lesquelles');
    expect(parRepere(dans(parRepere(arbre, 'fermeture-touchee-r-1')), 'pastille-source-app'))
      .not.toBeNull();
    expect(parRepere(dans(parRepere(arbre, 'fermeture-touchee-r-2')), 'pastille-source-exterieur'))
      .not.toBeNull();
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'dimanche 25/10 · 19 h · Terrain 1 · Julien M.',
      'dimanche 25/10 · 20 h · Terrain 1 · M. Dupont',
      'Une réservation « extérieur » n’a personne à prévenir dans l’app : appelle le client.',
    ]));
  });

  it('aucune extérieure : pas de phrase « appelle le client »', async () => {
    mockApercu = { data: { count: 1, items: [touchee({})] }, isLoading: false };
    const arbre = await monter();
    await remplir(arbre);
    await toucher(arbre, 'fermeture-voir-lesquelles');
    expect(lisibles(arbre)).not.toContain(
      'Une réservation « extérieur » n’a personne à prévenir dans l’app : appelle le client.',
    );
  });
});

describe('RESA-L5A2 E-G10 — un terrain d’E-G07', () => {
  it('le terrain de l’adresse est déjà coché', async () => {
    mockParams = { complexeId: 'cx-five', terrainId: 't-2' };
    const arbre = await monter();
    const etat = (/** @type {string} */ id) => parRepere(arbre, `fermeture-terrain-${id}`)
      .props.accessibilityState;
    expect(etat('t-2')).toEqual({ checked: true });
    expect(etat('t-1')).toEqual({ checked: false });
    expect(terrainDeTemoin().name).toBe('Terrain 1');
  });
});

// RESA-FIN-APP (20/10/2026) — tournée 1 : « 1 réservation est touchée. Elles seront annulées… »
// (la 2e phrase restait au pluriel). Elle suit le nombre, comme la 1re.
describe('RESA-FIN-APP (3) E-G10 — la phrase de l’aperçu suit le nombre', () => {
  it('une seule réservation touchée : « Elle sera annulée… »', async () => {
    mockApercu = {
      data: {
        count: 1,
        items: [{
          date: '2026-10-25', documentId: 'r-1', from: '19:00', label: 'Julien M.', terrainId: 't-1', to: '20:00',
        }],
      },
      isLoading: false,
    };
    const arbre = await monter();
    await remplir(arbre);
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      '1 réservation est touchée.',
      'Elle sera annulée et les joueurs prévenus.',
    ]));
    expect(lisibles(arbre)).not.toContain('Elles seront annulées et les joueurs prévenus.');
  });
});

// RESA-FIN-APP-2 (22/10/2026) — E-G10, tournée 2 : une fermeture rouverte DISPARAISSAIT de la
// liste, et aucune fermeture ne se modifiait. Plan E-G10 §4-5 : « modifier une fermeture ⇒ même
// formulaire » ; états « à venir / en cours / passée / rouverte ».
describe('RESA-FIN-APP-2 E-G10 — rouverte visible, « Modifier »', () => {
  const TRAVAUX = '2026-10-25|2026-10-26|travaux|';

  // CORR-RESA (74 A) : la rouverte quitte « À venir » pour le repli « Rouverte (1) ».
  it('une rouverte reste dans le repli « Rouverte », sans Rouvrir ni Modifier', async () => {
    mockFermetures = {
      ...mockFermetures,
      data: [fermeture({
        documentId: 'f-9',
        endDate: '2026-10-30',
        startDate: '2026-10-29',
        status: 'reopened',
        terrainId: 't-1',
      })],
    };
    const arbre = await monter();
    expect(lisibles(arbre)).not.toContain('29/10 – 30/10 · Travaux');
    expect(lisibles(arbre)).toContain('Rouverte (1)');
    await toucher(arbre, 'fermetures-rouvertes');
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      '29/10 – 30/10 · Travaux', 'Rouverte',
    ]));
    const cle = '2026-10-29|2026-10-30|travaux||rouverte';
    expect(parRepere(arbre, `fermeture-rouvrir-${cle}`)).toBeNull();
    expect(parRepere(arbre, `fermeture-modifier-${cle}`)).toBeNull();
  });

  it('« Modifier » remplit le formulaire ; « Enregistrer » modifie tout le geste', async () => {
    const arbre = await monter();
    await toucher(arbre, `fermeture-modifier-${TRAVAUX}`);
    expect(lisibles(arbre)).toContain('Modifier la fermeture');
    const valeur = (/** @type {string} */ libelle) => arbre.root.findAll(
      (/** @type {any} */ n) => n.props?.accessibilityLabel === libelle
        && typeof n.props?.onChangeText === 'function',
    )[0].props.value;
    expect([valeur('Du'), valeur('Au')]).toEqual(['25/10/2026', '26/10/2026']);
    await ecrire(arbre, 'Au', '27/10/2026');
    await toucher(arbre, 'fermeture-fermer');
    expect(mockFermer).not.toHaveBeenCalled();
    expect(mockModifier).toHaveBeenCalledWith({
      fermeture: {
        endDate: '2026-10-27', label: null, reason: 'travaux', startDate: '2026-10-25',
      },
      fermetureIds: ['f-1', 'f-2'],
    });
    expect(lisibles(arbre)).toContain('Modifié : 25/10 – 27/10.');
  });
});

describe('BH16 P13-15 — échec partiel ou total d’une fermeture', () => {
  const champDu = (/** @type {any} */ arbre) => arbre.root.findAll((/** @type {any} */ n) => (
    typeof n.props?.onChangeText === 'function' && n.props.accessibilityLabel === 'Du'))[0];

  it('échec total : pas de « Fermé », le formulaire reste rempli', async () => {
    mockFermer.mockResolvedValue({
      annulees: 0, echecs: [{ id: 't-1' }, { id: 't-2' }, { id: 't-3' }], faits: 0,
    });
    const arbre = await monter();
    await remplir(arbre);
    await toucher(arbre, 'fermeture-fermer');
    expect(lisibles(arbre).some((texte) => texte.startsWith('Fermé'))).toBe(false);
    expect(champDu(arbre).props.value).toBe('25/10/2026');
  });

  it('échec partiel : « Fermé » pour les autres, le formulaire garde les terrains à refaire', async () => {
    mockFermer.mockResolvedValue({ annulees: 0, echecs: [{ id: 't-2' }], faits: 2 });
    const arbre = await monter();
    await remplir(arbre);
    await toucher(arbre, 'fermeture-fermer');
    expect(champDu(arbre).props.value).toBe('25/10/2026');
    mockFermer.mockClear();
    await toucher(arbre, 'fermeture-fermer');
    expect(mockFermer.mock.calls[0][0].terrainIds).toEqual(['t-2']);
  });
});

// BUGHUNT C02 (25/10/2026) — Q4-03 : « Modifier » envoyait les fermetures d'origine et ignorait
// les terrains cochés ou décochés (l'écran disait « Modifié ») ; le motif changé gardait l'ancien
// nom (« Jour férié » ⇒ « Travaux » restait « Jour férié »). Les terrains sont verrouillés pendant
// une modification, et le nom du motif est effacé quand le nouveau motif n'en a pas.
// Q4-04 : « Rouvrir » annonçait « Rouvert » alors qu'un terrain restait fermé.
describe('BUGHUNT C02 — modifier et rouvrir une fermeture', () => {
  const TRAVAUX = '2026-10-25|2026-10-26|travaux|';

  it('Q4-03 (a) : en modification, les terrains ne se cochent plus', async () => {
    const arbre = await monter();
    await toucher(arbre, `fermeture-modifier-${TRAVAUX}`);
    const cases = ['fermeture-terrain-tous', 'fermeture-terrain-t-1', 'fermeture-terrain-t-3'];
    cases.forEach((cle) => {
      expect(parRepere(arbre, cle).props.disabled).toBe(true);
    });
    await act(async () => {
      pressable(arbre, 'Annuler la modification').props.onPress();
    });
    expect(parRepere(arbre, 'fermeture-terrain-t-3').props.disabled).toBe(false);
  });

  it('Q4-03 (b) : de « Jour férié » à « Travaux », le nom « Jour férié » s’efface', async () => {
    mockFermetures = {
      ...mockFermetures,
      data: [fermeture({
        documentId: 'f-7', label: 'Jour férié', reason: 'autre', terrainId: 't-1',
      })],
    };
    const arbre = await monter();
    await toucher(arbre, 'fermeture-modifier-2026-10-25|2026-10-26|autre|Jour férié');
    await toucher(arbre, 'fermeture-motif-travaux');
    await toucher(arbre, 'fermeture-fermer');
    expect(mockModifier.mock.calls[0][0].fermeture).toEqual(expect.objectContaining({
      label: null, reason: 'travaux',
    }));
  });

  it('Q4-04 : un terrain pas rouvert ⇒ pas de « Rouvert », une erreur', async () => {
    mockRouvrir.mockResolvedValue({ echecs: [{ id: 'f-2' }], faits: 1 });
    const arbre = await monter();
    await toucher(arbre, `fermeture-rouvrir-${TRAVAUX}`);
    await toucher(arbre, 'fermeture-confirmer-rouvrir');
    expect(lisibles(arbre)).not.toContain('Rouvert : les créneaux sont libres.');
    expect(lisibles(arbre)).toContain('La fermeture n’a pas pu être rouverte.');
  });
});
