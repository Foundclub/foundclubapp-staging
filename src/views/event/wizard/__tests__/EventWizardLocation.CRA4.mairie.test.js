/* eslint-disable max-len -- des phrases et des appels entiers, compares tels quels */
import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { EventWizardProvider, useEventWizard } from '../EventWizardContext';
import EventWizardLocation from '../EventWizardLocation';

// 🏛️ COLL-R-APP-CREATION (13/10/2026, COL-003, décision d'Adel « D2- A ») — L'ÉTAPE 4 POSE LA
// QUESTION AU SERVEUR (crochet `useMairieDecideALaCreation`, son propre témoin) ET PASSE LA RÉPONSE
// AU SÉLECTEUR, qui écrit la carte orange (FacilitySelector.CRA4.mairieDecide.test.js). Ici, l'étape :
//   - demande pour la séance du tunnel et l'installation COCHÉE (avant même « Suivant ») ;
//   - quand la mairie décide, elle ne dit plus « demande de validation au club » ni « le club
//     l'autorise quand même » : c'est faux sur un gymnase de la Ville (le serveur l'envoie à la
//     mairie, place libre ou non).
// ROUGE avant le lot.

// DATESDABORD (25/10, décision d'Adel « 6- B ») : le lieu passe AVANT « Date & horaire » ; l'étape
// « Lieu » ne juge le créneau (place, fermeture, mairie) que quand le jour est connu : au retour
// du récapitulatif (ici), ou pour un stage. À l'aller, c'est « Date & horaire » qui juge
// (EventWizardLogistics.DATESDABORD.prevention.test.js).
const mockSelecteurs = [];
const mockGabarits = [];
/** @type {any[][]} */
const mockQuestions = [];
let mockDecision = {
  complet: false, deLaVille: false, mairie: false, tuAcceptes: false, ville: null,
};

jest.mock('@/services/facility/facilityQueries', () => ({
  useGetFacilityOccupancy: () => ({ data: { data: { blocked: false } }, isError: false, isLoading: false }),
}));
jest.mock('../useMairieDecideALaCreation', () => ({
  __esModule: true,
  default: (/** @type {any[]} */ ...question) => {
    mockQuestions.push(question);
    return mockDecision;
  },
}));
jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
      if (typeof repli === 'string') return repli;
      if (repli && typeof repli.defaultValue === 'string') return repli.defaultValue;
      return cle;
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
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { documentId: 'moi', role: { name: 'Dirigeant', type: 'president' } } }),
}));
jest.mock(
  '@/components/organisms/facilitySelector/FacilitySelector',
  () => function SelecteurMock(/** @type {any} */ props) {
    mockSelecteurs.push(props);
    return null;
  },
);

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

const EQUIPE = { club: { documentId: 'club-A' }, documentId: 'u13', name: 'U13' };
/** @type {any} */
let arbre;
let semer = (/** @type {any} */ action) => action;
/**
 * Sonde : le `dispatch` du tunnel, pour semer l'équipe.
 * @returns {null} Rien.
 */
function PriseDeCourant() {
  semer = useEventWizard().dispatch;
  return null;
}
const afficherLEcran = () => {
  mockSelecteurs.length = 0;
  mockGabarits.length = 0;
  mockQuestions.length = 0;
  const navigation = { goBack: () => {}, navigate: () => {}, setParams: () => {} };
  const rendre = (/** @type {any} */ contenu) => createElement(EventWizardProvider, null, createElement(PriseDeCourant), contenu);
  act(() => { arbre = renderer.create(rendre(null)); });
  act(() => semer({ payload: { team: EQUIPE }, type: 'SET_META' }));
  act(() => {
    arbre.update(rendre(createElement(EventWizardLocation, { navigation, route: { params: { returnTo: 'EventWizardRecap' } } })));
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

describe('COLL-R-APP-CREATION — l étape « Lieu » demande au serveur si la mairie décidera', () => {
  test('elle pose la question pour la séance du tunnel et l installation cochée, et passe la réponse au sélecteur', () => {
    mockDecision = {
      complet: false, deLaVille: true, mairie: true, tuAcceptes: false, ville: 'Ville de Montrivage',
    };
    afficherLEcran();
    act(() => dernierSelecteur().onChange({ facilityId: 'gym', location: null }));

    const [etat, installation] = mockQuestions[mockQuestions.length - 1];
    expect(installation).toBe('gym');
    expect(etat.team).toEqual(EQUIPE);
    expect(dernierSelecteur().decisionDeLaVille).toEqual(mockDecision);
  });

  test('la mairie décide : plus de « demande de validation au club » ni de « le club l autorise »', () => {
    mockDecision = {
      complet: true, deLaVille: true, mairie: true, tuAcceptes: false, ville: 'Ville de Montrivage',
    };
    afficherLEcran();
    act(() => dernierSelecteur().onChange({ facilityId: 'gym', location: null }));
    act(() => dernierSelecteur().onOccupancyResolved({ requiresApproval: true, saturated: true }));
    expect(textesSous(arbre.root).join(' | ')).not.toMatch(/demande de validation au club/);
    act(() => dernierSelecteur().onOccupancyResolved({ allowsImmediateConfirmation: true, saturated: true }));
    expect(textesSous(arbre.root).join(' | ')).not.toMatch(/le club l'autorise quand même/);
    // DATESDABORD (23/10) : ni la phrase « déjà pris » qui l a remplacée.
    expect(textesSous(arbre.root).join(' | ')).not.toMatch(/déjà pris/);
  });

  // INVERSÉ PAR DATESDABORD (23/10, point 4 d'Adel) : la phrase nomme maintenant le gestionnaire et
  // le type (témoin : EventWizardLocation.DATESDABORD.prevention.test.js) ; elle reste là.
  test('une installation du club : la phrase « déjà pris » reste', () => {
    afficherLEcran();
    act(() => dernierSelecteur().onChange({ facilityId: 'salle', location: null }));
    act(() => dernierSelecteur().onOccupancyResolved({ requiresApproval: true, saturated: true }));
    expect(textesSous(arbre.root).join(' | ')).toMatch(
      /Attention, ce créneau est déjà pris : tu vas devoir envoyer une demande/,
    );
  });
});
