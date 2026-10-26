/* eslint-disable max-len -- des phrases entieres de l ecran, comparees telles quelles */
import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { EventWizardProvider } from '../EventWizardContext';
import EventWizardLocation from '../EventWizardLocation';

// 🚧 CRFERM (13/10/2026) — COL-011 (recette du 11/10, capture S14) : à l étape « Lieu », le Gymnase
// Cosec fermé disait « La mairie a rendu cette installation indisponible sur ce créneau. Choisissez
// un autre horaire ou une autre installation. » en ROUGE : ni pourquoi (vacances), ni jusqu à quand,
// au « vous » quand le reste de l étape tutoie. Le serveur dit désormais la fermeture (admin CRFERM
// S2-2 : `closure` de l occupation, jamais le mot de la Ville).
// Ce que ce fichier exige (ROUGE avant le lot) : la phrase au « tu », avec le lieu, les jours (et
// les heures d un blocage), le motif ; en orange ; un bouton « Changer la date » (le geste de la
// flèche Retour, nommé) ; un serveur d AVANT (sans `closure`) garde une phrase au « tu ».

/** Proprietes recues par le gabarit d'etape, dans l'ordre du rendu. */
// DATESDABORD (25/10, décision d'Adel « 6- B ») : le lieu passe AVANT « Date & horaire » ; l'étape
// « Lieu » ne juge le créneau (place, fermeture, mairie) que quand le jour est connu : au retour
// du récapitulatif (ici), ou pour un stage. À l'aller, c'est « Date & horaire » qui juge
// (EventWizardLogistics.DATESDABORD.prevention.test.js).
const mockGabarits = [];
/** Proprietes recues par le selecteur d'installation. */
const mockSelecteurs = [];
let mockDisponibilite = { data: { data: { blocked: false } }, isError: false, isLoading: false };
// COLL-R-APP-CREATION (13/10) — « la mairie décidera ? » a son propre témoin
// (useMairieDecideALaCreation.CRA4.test.js) : ici, la mairie ne décide pas.
jest.mock('../useMairieDecideALaCreation', () => ({
  __esModule: true,
  default: () => ({
    complet: false, deLaVille: false, mairie: false, tuAcceptes: false, ville: null,
  }),
}));
jest.mock('@/services/facility/facilityQueries', () => ({
  useGetFacilityOccupancy: () => mockDisponibilite,
}));

jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  // CRFERM : la phrase est faite de morceaux interpolés (« {{lieu}} est fermé {{quand}} ») ; ce
  // double remplit les « {{…}} » comme i18next.
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ options) => {
      let texte = cle;
      if (typeof repli === 'string') texte = repli;
      else if (repli && typeof repli.defaultValue === 'string') texte = repli.defaultValue;
      const valeurs = typeof repli === 'object' && repli ? repli : (options || {});
      return texte.replace(/\{\{(\w+)\}\}/g, (_tout, nom) => String(valeurs?.[nom] ?? ''));
    },
  }),
}));

// Le VRAI theme, sans le contexte React qui le porte. ⛔ Jamais un Proxy.
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
  default: () => ({
    userData: { documentId: 'moi', role: { name: 'Dirigeant', type: 'president' } },
  }),
}));

jest.mock(
  '@/components/organisms/facilitySelector/FacilitySelector',
  () => function SelecteurMock(/** @type {any} */ props) {
    mockSelecteurs.push(props);
    return null;
  },
);

/**
 * Tous les textes rendus sous un noeud de l'arbre de test.
 * @param {any} noeud Noeud de depart.
 * @returns {string[]} Les textes, dans l'ordre du rendu.
 */
const textesSous = (noeud) => {
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

/** @type {any} */
let arbre;
/** @type {string[]} */
let destinations = [];

/**
 * Monte l'ecran.
 * @returns {{ gabarit: any, textes: string[] }} L'ecran monte.
 */
const afficherLEcran = () => {
  mockGabarits.length = 0;
  mockSelecteurs.length = 0;
  destinations = [];
  const navigation = {
    goBack: () => { destinations.push('RETOUR'); },
    navigate: (/** @type {string} */ nom) => destinations.push(nom),
    setParams: () => {},
  };

  act(() => {
    arbre = renderer.create(createElement(
      EventWizardProvider,
      null,
      createElement(EventWizardLocation, { navigation, route: { params: { returnTo: 'EventWizardRecap' } } }),
    ));
  });

  return { gabarit: mockGabarits[mockGabarits.length - 1], textes: textesSous(arbre.root) };
};

/**
 * Le dernier jeu de proprietes rendu par le gabarit.
 * @returns {any} Les proprietes.
 */
const dernierGabarit = () => mockGabarits[mockGabarits.length - 1];

afterEach(() => {
  mockDisponibilite = { data: { data: { blocked: false } }, isError: false, isLoading: false };
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});

const ferme = (/** @type {any} */ closure) => {
  mockDisponibilite = {
    data: { data: { blocked: true, closure, facility: { documentId: 'gym-cosec', name: 'Gymnase Cosec' } } },
    isError: false,
    isLoading: false,
  };
  afficherLEcran();
  act(() => mockSelecteurs[0].onChange({ facilityId: 'gym-cosec', location: null }));
  return textesSous(arbre.root).join(' ');
};

describe('CRFERM — la phrase dit la fermeture, au « tu »', () => {
  test('CRFERM-6/1 fermeture : le lieu, les jours, le motif ; « Choisis » ; pas de « mairie … indisponible »', () => {
    const lu = ferme({
      documentId: 'f1', endDate: '2026-10-15', endTime: null, kind: 'closure', label: null, reason: 'vacances', startDate: '2026-10-11', startTime: null,
    });
    expect(lu).toContain('Le Gymnase Cosec est fermé du dimanche 11 octobre au jeudi 15 octobre (vacances). Choisis un autre jour ou une autre installation.');
    expect(lu).not.toMatch(/indisponible|Choisissez|sur ce créneau/);
    expect(dernierGabarit().isNextDisabled).toBe(true);
  });

  test('CRFERM-6/2 un nom de fermeture passe avant le motif ; un blocage dit l heure', () => {
    expect(ferme({
      endDate: '2027-05-13', kind: 'closure', label: 'Ascension', reason: 'vacances', startDate: '2027-05-13',
    })).toContain('Le Gymnase Cosec est fermé le jeudi 13 mai (Ascension).');
    act(() => arbre.unmount());
    expect(ferme({
      endDate: '2026-10-13', endTime: '20:00', kind: 'block', label: 'Forum des associations', startDate: '2026-10-13', startTime: '18:00',
    })).toContain('Le Gymnase Cosec est réservé par la Ville le mardi 13 octobre de 18:00 à 20:00 (Forum des associations). Choisis une autre heure ou une autre installation.');
  });

  test('CRFERM-6/3 la phrase est ORANGE ; « Changer la date » ramène à l étape « Date & horaire »', () => {
    ferme({
      endDate: '2026-10-15', kind: 'closure', reason: 'vacances', startDate: '2026-10-11',
    });
    const couleurs = jest.requireActual('@/theme/colors').default();
    const phrase = arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === 'lieu-fermeture')[0];
    const style = [phrase.props.style].flat(Infinity).reduce((tout, part) => ({ ...tout, ...part }), {});
    expect(style.color).toBe(couleurs.warning500);
    const bouton = arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === 'lieu-changer-la-date' && typeof n.props.onPress === 'function')[0];
    expect(textesSous(bouton).join(' ')).toContain('Changer la date');
    act(() => bouton.props.onPress());
    expect(destinations).toEqual(['RETOUR']);
  });

  test('CRFERM-6/4 un serveur d AVANT (sans la fermeture) : une phrase au « tu », sans « mairie … indisponible »', () => {
    const lu = ferme(undefined);
    expect(lu).toContain('La Ville a fermé cette installation à ce moment-là. Choisis un autre jour ou une autre installation.');
    expect(lu).not.toMatch(/indisponible|Choisissez/);
  });
});
