/* eslint-disable max-len -- des phrases entières, comparées telles quelles */
import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import i18n from '@/theme/strings';

import { EventWizardProvider, useEventWizard } from '../EventWizardContext';
import EventWizardLocation from '../EventWizardLocation';
import preventionDuCreneau from '../preventionDuCreneau';

// 🗓️ DATESDABORD (23/10/2026, recette iPhone d'Adel, point 4) — QUAND ON CHOISIT L'INSTALLATION,
// LE JOUR ET L'HEURE SONT DÉJÀ CHOISIS (étape « Date & horaire » avant « Lieu ») : l'étape dit
// tout de suite « Ce créneau est libre », ou « Attention, ce créneau est déjà pris : tu vas devoir
// envoyer une demande à <gestionnaire> pour faire <ton type d'événement> ». Le vrai i18next (fr.js).
// ROUGE avant le lot : la ligne « libre » n'existait pas, la ligne « pris » ne nommait ni le
// gestionnaire ni le type.

const mockSelecteurs = [];
let mockDecision = {
  complet: false, deLaVille: false, mairie: false, tuAcceptes: false, ville: null,
};

jest.mock('@/services/facility/facilityQueries', () => ({
  useGetFacilityOccupancy: () => ({ data: { data: { blocked: false } }, isError: false, isLoading: false }),
}));
jest.mock('../useMairieDecideALaCreation', () => ({
  __esModule: true,
  default: () => mockDecision,
}));
jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({
    t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args),
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
      Images: { chevronDown: 1 },
      Spaces: espaces,
    }),
  };
});
jest.mock('@/components/molecules/wizardStepLayout/WizardStepLayout', () => function GabaritMock(
  /** @type {any} */ props,
) {
  return props.children;
});
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { documentId: 'moi', role: { name: 'Entraîneur', type: 'coach' } } }),
}));
jest.mock(
  '@/components/organisms/facilitySelector/FacilitySelector',
  () => function SelecteurMock(/** @type {any} */ props) {
    mockSelecteurs.push(props);
    return null;
  },
);

const t = i18n.t.bind(i18n);
const LIBRE = 'Ce créneau est libre.';

describe('DATESDABORD — la phrase de prévention (règle pure)', () => {
  test('libre', () => {
    expect(preventionDuCreneau(t, { gestionnaire: 'AS Montrivage', occupation: { saturated: false }, typeName: 'Entraînement' }))
      .toEqual({ pris: false, texte: LIBRE });
  });
  test.each([
    ['Entraînement', 'ton entraînement'],
    ['Match', 'ton match'],
    ['Match amical', 'ton match'],
    ['Tournoi', 'ton tournoi'],
    ['Détection', 'ta détection'],
    ['Stage', 'ton stage'],
    ['Réunion', 'ton événement'],
    [undefined, 'ton événement'],
  ])('pris, à valider : le gestionnaire et le type (%s)', (typeName, pour) => {
    expect(preventionDuCreneau(t, {
      gestionnaire: 'AS Montrivage', occupation: { requiresApproval: true, saturated: true }, typeName,
    })).toEqual({
      pris: true,
      texte: `Attention, ce créneau est déjà pris : tu vas devoir envoyer une demande à AS Montrivage pour faire ${pour}. Elle partira quand tu créeras l’événement.`,
    });
  });
  test('pris, mais le gestionnaire laisse passer', () => {
    expect(preventionDuCreneau(t, {
      gestionnaire: 'AS Montrivage', occupation: { allowsImmediateConfirmation: true, saturated: true }, typeName: 'Match',
    })).toEqual({
      pris: true,
      texte: 'Attention, ce créneau est déjà pris : AS Montrivage l’autorise quand même, sans demande.',
    });
  });
  test('rien sans réponse du serveur, ni quand la mairie décide (sa carte le dit)', () => {
    expect(preventionDuCreneau(t, { gestionnaire: 'X', occupation: null, typeName: 'Match' })).toBeNull();
    expect(preventionDuCreneau(t, {
      gestionnaire: 'X', mairie: true, occupation: { requiresApproval: true, saturated: true }, typeName: 'Match',
    })).toBeNull();
  });
  test('l anglais a ses phrases', () => {
    const en = i18n.getFixedT('en');
    expect(preventionDuCreneau(en, { gestionnaire: 'X', occupation: { saturated: false }, typeName: 'Match' }).texte)
      .toBe('This slot is free.');
    expect(preventionDuCreneau(en, {
      gestionnaire: 'X', occupation: { requiresApproval: true, saturated: true }, typeName: 'Match',
    }).texte).toBe('Careful, this slot is already taken: you will have to send a request to X to hold your match. It will be sent when you create the event.');
  });
});

const textesSous = (/** @type {any} */ noeud) => {
  /** @type {string[]} */
  const sortie = [];
  const parcourir = (/** @type {any} */ enfant) => {
    if (typeof enfant === 'string' || typeof enfant === 'number') {
      sortie.push(String(enfant));
      return;
    }
    if (Array.isArray(enfant)) {
      enfant.forEach(parcourir);
      return;
    }
    if (enfant?.children) enfant.children.forEach(parcourir);
  };
  parcourir(noeud.children);
  return sortie;
};

const EQUIPE = {
  club: { documentId: 'club-A', name: 'AS Montrivage', parentMultisport: { documentId: 'cm-1', name: 'Montrivage Omnisports' } },
  documentId: 'u13',
  name: 'U13',
};
/** @type {any} */
let arbre;
let semer = (/** @type {any} */ action) => action;
/**
 * Sonde : le `dispatch` du tunnel, pour semer l'équipe et le type.
 * @returns {null} Rien.
 */
function PriseDeCourant() {
  semer = useEventWizard().dispatch;
  return null;
}
const afficherLEcran = (/** @type {string} */ typeName = 'Entraînement') => {
  mockSelecteurs.length = 0;
  const navigation = { goBack: () => {}, navigate: () => {}, setParams: () => {} };
  const rendre = (/** @type {any} */ contenu) => createElement(EventWizardProvider, null, createElement(PriseDeCourant), contenu);
  act(() => { arbre = renderer.create(rendre(null)); });
  act(() => semer({ payload: { team: EQUIPE, type: { name: typeName } }, type: 'SET_META' }));
  act(() => {
    arbre.update(rendre(createElement(EventWizardLocation, { navigation, route: { params: {} } })));
  });
};
const dernierSelecteur = () => mockSelecteurs[mockSelecteurs.length - 1];

afterEach(() => {
  mockDecision = {
    complet: false, deLaVille: false, mairie: false, tuAcceptes: false, ville: null,
  };
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});

describe('DATESDABORD — l étape « Lieu » prévient dès qu on choisit l installation', () => {
  test('une installation libre : « Ce créneau est libre. »', () => {
    afficherLEcran();
    act(() => dernierSelecteur().onChange({ facilityId: 'gym', location: null }));
    act(() => dernierSelecteur().onOccupancyResolved({ saturated: false }));
    expect(textesSous(arbre.root)).toContain(LIBRE);
  });
  test('une installation du club, prise : la demande va au club, pour un entraînement', () => {
    afficherLEcran('Entraînement');
    act(() => dernierSelecteur().onChange({ facilityId: 'gym', location: null }));
    act(() => dernierSelecteur().onOccupancyResolved({ requiresApproval: true, saturated: true }));
    expect(textesSous(arbre.root)).toContain(
      'Attention, ce créneau est déjà pris : tu vas devoir envoyer une demande à AS Montrivage pour faire ton entraînement. Elle partira quand tu créeras l’événement.',
    );
  });
  test('une installation partagée du club multisport : la demande va au club multisport', () => {
    afficherLEcran('Match');
    act(() => dernierSelecteur().onChange({ facilityId: 'gym-cm', location: null }));
    act(() => dernierSelecteur().onOccupancyResolved({ isShared: true, requiresApproval: true, saturated: true }));
    expect(textesSous(arbre.root)).toContain(
      'Attention, ce créneau est déjà pris : tu vas devoir envoyer une demande à Montrivage Omnisports pour faire ton match. Elle partira quand tu créeras l’événement.',
    );
  });
  test('une installation de la Ville : ni « libre » ni « pris » (le sélecteur dit le créneau du club ou la mairie)', () => {
    mockDecision = {
      complet: false, deLaVille: true, mairie: false, tuAcceptes: false, ville: 'Ville de Montrivage',
    };
    afficherLEcran();
    act(() => dernierSelecteur().onChange({ facilityId: 'gym-ville', location: null }));
    act(() => dernierSelecteur().onOccupancyResolved({ saturated: false }));
    expect(textesSous(arbre.root).join(' ')).not.toContain(LIBRE);
  });
  test('quand la mairie décide, l étape ne dit ni « libre » ni « pris » (la carte orange du sélecteur le dit)', () => {
    mockDecision = {
      complet: false, deLaVille: true, mairie: true, tuAcceptes: false, ville: 'Ville de Montrivage',
    };
    afficherLEcran();
    act(() => dernierSelecteur().onChange({ facilityId: 'gym-ville', location: null }));
    act(() => dernierSelecteur().onOccupancyResolved({ requiresApproval: true, saturated: true }));
    const textes = textesSous(arbre.root).join(' ');
    expect(textes).not.toContain(LIBRE);
    expect(textes).not.toContain('déjà pris');
  });
});
