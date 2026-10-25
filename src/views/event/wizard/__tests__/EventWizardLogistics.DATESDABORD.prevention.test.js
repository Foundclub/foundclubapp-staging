/* eslint-disable max-len -- des phrases entières, comparées telles quelles */
import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { EventWizardProvider, useEventWizard } from '../EventWizardContext';
import EventWizardLogistics from '../EventWizardLogistics';

// 🗓️ DATESDABORD (25/10/2026, décision d'Adel « 6- B ») — LE LIEU D'ABORD, LE MESSAGE À LA DATE :
// l'installation est choisie à l'étape « Lieu » ; à l'étape « Date & horaire », CHAQUE horaire
// touché relit la place de cette installation et dit « Ce créneau est libre. » ou « Attention, ce
// créneau est déjà pris : tu vas devoir envoyer une demande à <gestionnaire> pour faire <le type>.
// … ». Une fermeture de la Ville bloque « Suivant ». Le vrai i18next (fr.js).
// ROUGE avant : l'étape « Date & horaire » ne lisait aucune place.

/** @type {any[]} */
const mockFenetres = [];
/** @type {any[]} */
const mockGabarits = [];
/** @type {any[]} */
const mockHeures = [];
let mockPlace = (/** @type {any} */ fenetre) => ({ data: { blocked: false, saturated: false }, fenetre });
let mockDecision = {
  complet: false, deLaVille: false, mairie: false, tuAcceptes: false, ville: null,
};

jest.mock('@/services/facility/facilityQueries', () => ({
  useGetFacilityOccupancy: (/** @type {any} */ installation, /** @type {any} */ fenetre) => {
    if (installation) mockFenetres.push({ installation, ...fenetre });
    return {
      data: installation && fenetre?.start ? { data: mockPlace(fenetre).data } : undefined,
      isError: false,
      isFetching: false,
      isLoading: false,
      refetch: () => {},
    };
  },
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
  mockGabarits.push(props);
  return props.children;
});
jest.mock('@/components/molecules/datePickerInput/DatePickerInput', () => function DateMock() {
  return null;
});
jest.mock('@/components/molecules/timePickerInput/TimePickerInput', () => function HeureMock(
  /** @type {any} */ props,
) {
  mockHeures.push(props);
  return null;
});
jest.mock('@/components/molecules/dayPicker/DayPicker', () => function JoursMock() { return null; });
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function FeuilleMock() { return null; });
jest.mock('@/components/atoms/button/Button', () => function BoutonMock() { return null; });

const i18nextTemoin = require('i18next');

const frTemoin = require('@/theme/strings/translations/fr');

(i18nextTemoin.default || i18nextTemoin).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'fr',
  lng: 'fr',
  resources: { fr: { translation: frTemoin.default } },
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
const LIBRE = 'Ce créneau est libre.';
const PRIS = 'Attention, ce créneau est déjà pris : tu vas devoir envoyer une demande à AS Montrivage pour faire ton entraînement. Elle partira quand tu créeras l’événement.';
/** @type {any} */
let arbre;
let semer = (/** @type {any} */ action) => action;
/**
 * Sonde : le `dispatch` du tunnel, pour semer l'équipe, le type et le lieu.
 * @returns {null} Rien.
 */
function PriseDeCourant() {
  semer = useEventWizard().dispatch;
  return null;
}
const afficherLEcran = (/** @type {any} */ lieu = { facility: 'gym', location: null }) => {
  mockFenetres.length = 0;
  mockGabarits.length = 0;
  mockHeures.length = 0;
  const navigation = { goBack: () => {}, navigate: () => {}, setParams: () => {} };
  const rendre = (/** @type {any} */ contenu) => createElement(EventWizardProvider, null, createElement(PriseDeCourant), contenu);
  act(() => { arbre = renderer.create(rendre(null)); });
  act(() => semer({ payload: { team: EQUIPE, type: { name: 'Entraînement' } }, type: 'SET_META' }));
  act(() => semer({ payload: lieu, type: 'SET_LOCATION' }));
  act(() => {
    arbre.update(rendre(createElement(EventWizardLogistics, { navigation, route: { params: {} } })));
  });
};
const dernierGabarit = () => mockGabarits[mockGabarits.length - 1];
const debut = () => mockHeures.filter((p) => /début/i.test(String(p.label))).at(-1);

afterEach(() => {
  mockPlace = () => ({ data: { blocked: false, saturated: false } });
  mockDecision = {
    complet: false, deLaVille: false, mairie: false, tuAcceptes: false, ville: null,
  };
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});

describe('DATESDABORD 6- B — « Date & horaire » prévient à chaque horaire, pour l installation choisie', () => {
  test('l installation du club, libre : « Ce créneau est libre. » sous les heures', () => {
    afficherLEcran();
    expect(textesSous(arbre.root)).toContain(LIBRE);
    expect(mockFenetres.at(-1).installation).toBe('gym');
  });

  test('chaque horaire touché relit la place : 18:00 est pris, la phrase le dit et nomme le club et le type', () => {
    mockPlace = (fenetre) => ({
      data: new Date(fenetre.start).getHours() === 18
        ? { blocked: false, requiresApproval: true, saturated: true }
        : { blocked: false, saturated: false },
    });
    afficherLEcran();
    act(() => debut().onChange('18:00'));
    expect(new Date(mockFenetres.at(-1).start).getHours()).toBe(18);
    expect(textesSous(arbre.root)).toContain(PRIS);
    expect(textesSous(arbre.root)).not.toContain(LIBRE);
    act(() => debut().onChange('10:00'));
    expect(textesSous(arbre.root)).toContain(LIBRE);
  });

  test('une installation partagée du club multisport : la demande va au club multisport', () => {
    mockPlace = () => ({ data: { blocked: false, requiresApproval: true, saturated: true } });
    afficherLEcran({ facility: 'gym-cm', facilityShared: true, location: null });
    expect(textesSous(arbre.root).join(' ')).toContain('envoyer une demande à Montrivage Omnisports pour faire ton entraînement');
  });

  test('une fermeture de la Ville : la phrase de la fermeture, et « Suivant » attend', () => {
    mockPlace = () => ({ data: { blocked: true, closure: null, facility: { name: 'Gymnase des Tilleuls' } } });
    afficherLEcran();
    expect(dernierGabarit().isNextDisabled).toBe(true);
    expect(textesSous(arbre.root)).not.toContain(LIBRE);
  });

  test('la mairie décidera : sa phrase, ni « libre » ni « pris »', () => {
    mockDecision = {
      complet: false, deLaVille: true, mairie: true, tuAcceptes: false, ville: 'Ville de Montrivage',
    };
    afficherLEcran({ facility: 'gym-ville', location: null });
    const textes = textesSous(arbre.root).join(' ');
    expect(textes).toContain('la mairie décidera');
    expect(textes).not.toContain(LIBRE);
    expect(textes).not.toContain('déjà pris');
  });

  test('une adresse extérieure : rien à juger, aucune lecture', () => {
    afficherLEcran({ facility: null, location: { label: '12 rue des Lilas', value: 'x' } });
    expect(mockFenetres).toHaveLength(0);
    expect(textesSous(arbre.root)).not.toContain(LIBRE);
    expect(dernierGabarit().isNextDisabled).not.toBe(true);
  });
});
