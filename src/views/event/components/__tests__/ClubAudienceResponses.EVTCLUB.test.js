import { format } from 'date-fns';
import renderer, { act } from 'react-test-renderer';

import ClubAudienceResponses from '../ClubAudienceResponses';

// EVT-CLUB-ECRANS (14/11/2026, D121) — ecrans 4a / 4b / 4c (telephone) et 5b (site,
// `layout="table"`) de la maquette v2 : la fiche du dirigeant pour un evenement « tout le club ».
// UNE liste, 4 compteurs qui filtrent, les filtres Age / Section / Equipe (+ Sport en omnisports),
// la relance des sans reponse AFFICHES avec confirmation chiffree, grisee 24 h. Contrat : GET
// /events/:id/club-audience, POST /events/:id/remind { keys }.

const mockVue = {
  data: null,
  error: null,
  isLoading: false,
  refetch: jest.fn(),
};
const mockRelance = jest.fn();
const mockInvalider = jest.fn(() => Promise.resolve());

jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
      if (typeof repli === 'string') return repli;
      const texte = typeof repli?.defaultValue === 'string' ? repli.defaultValue : cle;
      return texte.replace(/\{\{(\w+)\}\}/g, (_tout, nom) => String(repli?.[nom] ?? ''));
    },
  }),
}));
jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: {},
      Spaces: espaces,
    }),
  };
});
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalider }),
}));
jest.mock('@/services/event/eventQueries', () => ({
  useGetEventClubAudience: () => mockVue,
}));
jest.mock('@/services/event/eventService', () => ({
  remindClubAudience: (/** @type {any} */ entree) => mockRelance(entree),
}));
jest.mock(
  '@/components/molecules/bottomModal/BottomModal',
  () => function FeuilleMock(/** @type {any} */ props) {
    return props.isVisible ? props.children : null;
  },
);
jest.mock(
  '@/components/molecules/input/Input',
  () => function ChampMock(/** @type {any} */ props) {
    const reactActuel = jest.requireActual('react');
    const { TextInput } = jest.requireActual('react-native');
    return reactActuel.createElement(TextInput, {
      onChangeText: props.onChangeText,
      testID: 'recherche-nom',
      value: props.value,
    });
  },
);
jest.mock(
  '@/components/atoms/button/Button',
  () => function BoutonMock(/** @type {any} */ props) {
    const reactActuel = jest.requireActual('react');
    const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
    return reactActuel.createElement(
      PressableRN,
      {
        disabled: Boolean(props.disabled),
        onPress: props.onPress,
        testID: `bouton:${props.title}`,
      },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  },
);

const ligne = (prenom, champs = {}) => ({
  ageBracket: 'adult',
  answer: null,
  answeredByParent: false,
  firstname: prenom,
  isCoach: false,
  key: `cle-${prenom}`,
  kind: 'player',
  lastInitial: 'A',
  remindedAt: null,
  section: 'masculine',
  sport: null,
  team: { documentId: 'seniors', name: 'Seniors B' },
  ...champs,
});
const LIGNES = [
  ligne('Yanis', { answer: 'present' }),
  ligne('Ines', {
    ageBracket: 'under13',
    answer: 'absent',
    answeredByParent: true,
    kind: 'child',
    section: 'feminine',
    team: { documentId: 'u9', name: 'U9' },
  }),
  ligne('Noe', { ageBracket: 'under13', kind: 'child', team: { documentId: 'u11', name: 'U11' } }),
  ligne('Marc', { kind: 'member', section: null, team: null }),
  ligne('Mehdi', {
    answer: 'present',
    isCoach: true,
    kind: 'coach',
    lastInitial: 'E',
    team: { documentId: 'u13', name: 'U13' },
  }),
];
const vue = (relance = {}, champs = {}) => ({
  counts: {
    absent: 1,
    present: 2,
    rows: 5,
    unanswered: 2,
  },
  multisport: false,
  relance: {
    available: true,
    lastRemindedAt: null,
    nextReminderAt: null,
    ...relance,
  },
  rows: LIGNES,
  ...champs,
});

const EVENEMENT = { audienceScope: 'club', documentId: 'ev-club', name: 'Fete de fin d annee' };

let arbre;
const monter = (props = {}) => {
  act(() => {
    // eslint-disable-next-line react/jsx-props-no-spreading -- fabrique de test
    arbre = renderer.create(<ClubAudienceResponses event={EVENEMENT} {...props} />);
  });
};
const textes = () => {
  const sortie = [];
  const parcourir = (noeud) => {
    if (typeof noeud === 'string' || typeof noeud === 'number') {
      sortie.push(String(noeud));
      return;
    }
    if (Array.isArray(noeud)) {
      noeud.forEach(parcourir);
      return;
    }
    if (noeud?.children) noeud.children.forEach(parcourir);
  };
  parcourir(arbre.root.children);
  return sortie;
};
const appuyer = async (testID) => {
  await act(async () => {
    await arbre.root.findByProps({ testID }).props.onPress();
  });
};
const prenomsAffiches = () => arbre.root
  .findAll(
    (noeud) => typeof noeud.props?.testID === 'string'
        && noeud.props.testID.startsWith('club-audience-row:'),
  )
  .filter((noeud) => typeof noeud.type === 'string' || noeud.type?.displayName === 'View' || true)
  .map((noeud) => noeud.props.testID.replace('club-audience-row:', ''))
  .filter((cle, index, toutes) => toutes.indexOf(cle) === index);

beforeEach(() => {
  mockVue.data = vue();
  mockVue.error = null;
  mockVue.isLoading = false;
  mockRelance.mockReset();
  mockRelance.mockResolvedValue({
    blockedCount: 0,
    lastRemindedAt: '2026-12-01T14:32:00.000Z',
    nextReminderAt: '2026-12-02T14:32:00.000Z',
    reason: null,
    remindedCount: 2,
    unansweredCount: 2,
  });
});
afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});

describe('EVT-CLUB — ecran 4a : la liste entiere', () => {
  test('titre, 4 compteurs, filtres, liste alphabetique, relance', () => {
    monter();
    const liste = textes();
    expect(liste).toContain('LES RÉPONSES DU CLUB');
    ['tous', 'présents', 'absents', 'sans réponse'].forEach((libelle) => {
      expect(liste).toContain(libelle);
    });
    expect(liste).toContain('Âge');
    expect(liste).toContain('Section');
    expect(liste).toContain('Équipe');
    expect(liste).not.toContain('Sport');
    expect(liste).toContain('5 personnes · ordre alphabétique');
    expect(prenomsAffiches()).toEqual([
      'cle-Ines',
      'cle-Marc',
      'cle-Mehdi',
      'cle-Noe',
      'cle-Yanis',
    ]);
    expect(liste).toContain('U9 · Féminine · réponse de son parent');
    expect(liste).toContain('Sans équipe');
    expect(liste).toContain('U13 · entraîneur');
    expect(liste).toContain('Relancer les 2 sans réponse');
  });

  test('omnisports : la pastille « Sport » en plus (R5 C)', () => {
    mockVue.data = vue({}, { multisport: true });
    monter();
    expect(textes()).toContain('Sport');
  });
});

describe('EVT-CLUB — ecran 4b : filtree', () => {
  test('un compteur filtre par reponse', async () => {
    monter();
    await appuyer('club-audience-count:unanswered');
    expect(prenomsAffiches()).toEqual(['cle-Marc', 'cle-Noe']);
  });

  test('Age « -13 ans » : liste, « N sur M · Tout effacer », relance des affiches', async () => {
    monter();
    await appuyer('club-audience-filter:age');
    await appuyer('club-audience-option:age:under13');
    expect(prenomsAffiches()).toEqual(['cle-Ines', 'cle-Noe']);
    const liste = textes();
    expect(liste).toContain('2 sur 5');
    expect(liste).toContain('Tout effacer');
    expect(liste).toContain('Relancer les 1 sans réponse affichés');
    expect(liste).toContain('Ce sont leurs parents qui sont relancés.');
    await appuyer('club-audience-clear');
    expect(prenomsAffiches()).toHaveLength(5);
  });

  test('Equipe « Sans équipe »', async () => {
    monter();
    await appuyer('club-audience-filter:team');
    await appuyer('club-audience-option:team:none');
    expect(prenomsAffiches()).toEqual(['cle-Marc']);
  });
});

describe('EVT-CLUB — la relance (Q13, R3 A) et l ecran 4c', () => {
  test('confirmation chiffree, puis relance des cles AFFICHEES', async () => {
    monter();
    await appuyer('club-audience-filter:age');
    await appuyer('club-audience-option:age:under13');
    await appuyer('bouton:Relancer les 1 sans réponse affichés');
    expect(textes()).toContain('Relancer 1 personnes ?');
    expect(mockRelance).not.toHaveBeenCalled();
    await appuyer('bouton:Relancer');
    expect(mockRelance).toHaveBeenCalledWith({ eventId: 'ev-club', keys: ['cle-Noe'] });
    expect(mockInvalider).toHaveBeenCalled();
    expect(textes()).toContain('2 personnes relancées.');
  });

  test('« Annuler » ne relance personne', async () => {
    monter();
    await appuyer('bouton:Relancer les 2 sans réponse');
    await appuyer('bouton:Annuler');
    expect(mockRelance).not.toHaveBeenCalled();
  });

  test('grise 24 h apres une relance, avec l heure', () => {
    const derniere = new Date(Date.now() - 60 * 60 * 1000);
    const prochaine = new Date(derniere.getTime() + 24 * 60 * 60 * 1000);
    mockVue.data = vue({
      lastRemindedAt: derniere.toISOString(),
      nextReminderAt: prochaine.toISOString(),
    });
    monter();
    const bouton = arbre.root.findByProps({
      testID: `bouton:Relancé à ${format(derniere, 'HH:mm')}`,
    });
    expect(bouton.props.disabled).toBe(true);
    expect(textes().some((texte) => texte.startsWith('Nouvelle relance possible le '))).toBe(true);
  });

  test('absent quand l evenement a commence (available faux)', () => {
    mockVue.data = vue({ available: false });
    monter();
    expect(textes().some((texte) => texte.startsWith('Relancer'))).toBe(false);
  });
});

describe('EVT-CLUB — ecran 5b : le tableau du site', () => {
  test('colonnes Nom / Equipe / Age / Section / Reponse, recherche par nom', async () => {
    monter({ layout: 'table' });
    const liste = textes();
    ['NOM', 'ÉQUIPE', 'ÂGE', 'SECTION', 'RÉPONSE'].forEach((colonne) => {
      expect(liste).toContain(colonne);
    });
    expect(liste).toContain('Moins de 13 ans');
    expect(liste).toContain('Adulte');
    await act(async () => {
      arbre.root.findByProps({ testID: 'recherche-nom' }).props.onChangeText('mar');
    });
    expect(prenomsAffiches()).toEqual(['cle-Marc']);
  });

  test('chargement puis erreur : un texte, pas de plantage', () => {
    mockVue.data = null;
    mockVue.isLoading = true;
    monter();
    expect(textes()).toContain('Chargement des réponses du club…');
    act(() => arbre.unmount());
    mockVue.isLoading = false;
    mockVue.error = new Error('403');
    monter();
    expect(textes()).toContain('Impossible de charger les réponses du club.');
  });
});
