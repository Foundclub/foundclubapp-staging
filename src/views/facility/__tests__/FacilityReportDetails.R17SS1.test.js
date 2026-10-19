/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
// 🚩 R17-SIGNALER-1 (19/10/2026, REC17-011) — UN SIGNALEMENT, ouvert par la Ville ou par son auteur
// (planches P10-securite-tel 2 et 3, P10-securite-ordi B, P11-q4-exemple-tel 2, validees le 19/10).
// Le vrai fr.js, les crochets reseau doubles. Ce que le temoin fixe :
//   - la Ville : qui l a envoye (le role et le club ; le nom seulement s il est rendu, Q2 A), et ses
//     gestes : Prendre en charge, Fermer l installation… (le formulaire pre-rempli, Q4 A), Résolu…
//     (un mot possible), Sans suite… (un mot EXIGE : le bouton reste eteint sans lui) ;
//   - la fermeture liee finie : « ce signalement est-il résolu ? » ;
//   - l auteur : son signalement, le mot de la Ville, AUCUN geste.
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import FacilityReportDetails from '../FacilityReportDetails';

jest.setTimeout(30000);

const i18nextTemoin = require('i18next');

const frTemoin = require('@/theme/strings/translations/fr');

(i18nextTemoin.default || i18nextTemoin).init({
  compatibilityJSON: 'v4', fallbackLng: 'fr', lng: 'fr', resources: { fr: { translation: frTemoin.default } },
});

/** @type {any} */
let mockNavigation;
/** @type {any} */
let mockFiche;
/** @type {any} */
let mockStatut;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: { reportId: 'sig-1' } }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args) }),
}));
jest.mock('@/theme/themeContext', () => {
  const couleurs = jest.requireActual('@/theme/colors').default();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(couleurs),
      Colors: couleurs,
      Fonts: jest.requireActual('@/theme/fonts').default(couleurs),
      Images: {},
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});
jest.mock('@/services/facilityReport/facilityReportQueries', () => ({
  useFacilityReport: () => mockFiche,
  useSetFacilityReportStatus: () => mockStatut,
}));
jest.mock('@/utils/imageUrl', () => ({ getImageUrl: (/** @type {string} */ url) => `https://cdn.test${url}` }));
jest.mock('@/components/templates/ScreenContainer', () => function ScreenContainerMock({ children }) { return children; });
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });
jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const reactActuel = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return function BottomModalMock(/** @type {any} */ props) {
    return props.isVisible ? reactActuel.createElement(View, { testID: 'feuille' }, props.children, props.footerComponent) : null;
  };
});
jest.mock('@/components/molecules/input/Input', () => {
  const reactActuel = jest.requireActual('react');
  const { TextInput } = jest.requireActual('react-native');
  return function InputMock(/** @type {any} */ props) {
    return reactActuel.createElement(TextInput, { onChangeText: props.onChangeText, testID: props.testID, value: props.value });
  };
});

const SIGNALEMENT = {
  author: { name: null, role: 'joueur' },
  category: 'securite',
  cityNote: null,
  closedAt: null,
  closure: null,
  club: { documentId: 'club-as', name: 'AS Montrivage' },
  collectivite: { documentId: 'ville-montrivage', name: 'Ville de Montrivage' },
  createdAt: '2026-10-18T08:42:00.000Z',
  description: 'Panier côté nord descellé : il bouge quand on s y accroche.',
  documentId: 'sig-1',
  facility: { documentId: 'gym-tilleuls', name: 'Gymnase des Tilleuls' },
  photo: { url: '/uploads/panier.jpg' },
  status: 'envoye',
  takenAt: null,
  title: 'Panier côté nord descellé',
};
const PREFILL = {
  message: 'Panier côté nord descellé : il bouge quand on s y accroche : installation fermée le temps de la réparation.', reason: 'travaux', startDate: '2026-10-19',
};

/** Button ne porte pas d identifiant de test : ses titres, par identifiant du temoin. */
const TITRES = /** @type {Record<string, string>} */ ({
  'feuille-resolu': 'Marquer résolu',
  'feuille-sans-suite': 'Classer sans suite',
  'signalement-fermer': 'Fermer l’installation…',
  'signalement-prendre': 'Prendre en charge',
  'signalement-resolu': 'Résolu…',
  'signalement-sans-suite': 'Sans suite…',
  'signaler-autre-chose': 'Signaler autre chose',
  'signaler-envoyer': 'Envoyer à la Ville',
  'signaler-photo': 'Ajouter une photo (facultatif)',
  'signaler-voir-mes': 'Voir mes signalements',
});
const monter = () => {
  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(<FacilityReportDetails />); });
  return arbre;
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text).map((/** @type {any} */ n) => [].concat(n.props.children).join(''));
const parId = (/** @type {any} */ arbre, /** @type {string} */ id) => arbre.root.findAll((/** @type {any} */ n) => (n.props.testID === id || (TITRES[id] && n.props.title === TITRES[id])) && typeof n.type !== 'string');
const presser = async (/** @type {any} */ arbre, /** @type {string} */ id) => {
  const [cible] = parId(arbre, id);
  if (!cible) throw new Error(`introuvable : ${id}`);
  await act(async () => { await cible.props.onPress(); });
};

beforeEach(() => {
  mockNavigation = { navigate: jest.fn() };
  mockFiche = { data: { data: SIGNALEMENT, meta: { canManage: true, closurePrefill: PREFILL } }, isError: false, isLoading: false };
  mockStatut = { isPending: false, mutateAsync: jest.fn(() => Promise.resolve({})) };
});

describe('R17SS1 — la fiche d un signalement', () => {
  it('Q2 A : la Ville lit « un joueur · AS Montrivage », la photo, et ses 4 gestes', () => {
    const arbre = monter();
    const tout = textes(arbre).join(' | ');
    expect(tout).toContain('Sécurité, danger · un joueur · AS Montrivage');
    expect(tout).toContain('Photo vue par la Ville et l’auteur seulement.');
    expect(tout).toContain('Nouveau');
    ['signalement-photo', 'signalement-prendre', 'signalement-fermer', 'signalement-resolu', 'signalement-sans-suite'].forEach((id) => {
      expect(parId(arbre, id).length).toBeGreaterThan(0);
    });
  });

  it('Q2 A : un encadrant est nommé', () => {
    mockFiche.data.data = { ...SIGNALEMENT, author: { name: 'Lucas Morel', role: 'entraineur' } };
    expect(textes(monter()).join(' | ')).toContain('Sécurité, danger · Lucas Morel, entraîneur · AS Montrivage');
  });

  it('« Prendre en charge » : le geste part, sans mot', async () => {
    const arbre = monter();
    await presser(arbre, 'signalement-prendre');
    expect(mockStatut.mutateAsync).toHaveBeenCalledWith({ reportId: 'sig-1', status: 'pris_en_charge' });
  });

  it('Q4 A : « Fermer l’installation… » ouvre le formulaire de fermeture PRÉ-REMPLI, lié au signalement', async () => {
    const arbre = monter();
    await presser(arbre, 'signalement-fermer');
    expect(mockNavigation.navigate).toHaveBeenCalledWith('CollectiviteFermeture', {
      collectiviteId: 'ville-montrivage',
      date: '2026-10-19',
      facilityId: 'gym-tilleuls',
      facilityName: 'Gymnase des Tilleuls',
      message: PREFILL.message,
      mode: 'fermer',
      motif: 'travaux',
      reportId: 'sig-1',
    });
  });

  it('Q3 A : « Sans suite » exige un mot ; « Résolu » part avec le sien', async () => {
    const arbre = monter();
    await presser(arbre, 'signalement-sans-suite');
    const [valider] = parId(arbre, 'feuille-sans-suite');
    expect(valider.props.disabled).toBe(true);
    const [champ] = parId(arbre, 'signalement-feuille-mot');
    await act(async () => { champ.props.onChangeText('La clé est à l’accueil du gymnase.'); });
    expect(parId(arbre, 'feuille-sans-suite')[0].props.disabled).toBe(false);
    await presser(arbre, 'feuille-sans-suite');
    expect(mockStatut.mutateAsync).toHaveBeenCalledWith({ note: 'La clé est à l’accueil du gymnase.', reportId: 'sig-1', status: 'sans_suite' });

    mockStatut.mutateAsync.mockClear();
    const autre = monter();
    await presser(autre, 'signalement-resolu');
    expect(parId(autre, 'feuille-resolu')[0].props.disabled).toBe(false);
    await presser(autre, 'feuille-resolu');
    expect(mockStatut.mutateAsync).toHaveBeenCalledWith({ reportId: 'sig-1', status: 'resolu' });
  });

  it('Q4 A, étape 4 : la fermeture liée est finie, l écran propose « Résolu »', () => {
    mockFiche.data.data = {
      ...SIGNALEMENT,
      closure: {
        documentId: 'f-1', endDate: '2026-10-18', startDate: '2026-10-16', status: 'active',
      },
      status: 'pris_en_charge',
    };
    const arbre = monter();
    expect(parId(arbre, 'signalement-proposer-resolu').length).toBeGreaterThan(0);
    expect(textes(arbre).join(' | ')).toContain('Lié à la fermeture du ven. 16 oct. au dim. 18 oct.');
    expect(parId(arbre, 'signalement-prendre')).toHaveLength(0);
  });

  it('l auteur : son signalement, le mot de la Ville, AUCUN geste', () => {
    mockFiche = {
      data: {
        data: {
          ...SIGNALEMENT, author: undefined, cityNote: 'Le panier a été refixé mardi matin.', status: 'resolu',
        },
        meta: { canManage: false },
      },
      isError: false,
      isLoading: false,
    };
    const arbre = monter();
    const tout = textes(arbre).join(' | ');
    expect(tout).toContain('« Le panier a été refixé mardi matin. » — Ville de Montrivage');
    expect(tout).toContain('Résolu');
    ['signalement-prendre', 'signalement-fermer', 'signalement-resolu', 'signalement-sans-suite'].forEach((id) => {
      expect(parId(arbre, id)).toHaveLength(0);
    });
  });

  it('un compte qui n y a pas droit : « Ce signalement est introuvable. »', () => {
    mockFiche = {
      data: undefined, error: { response: { status: 404 } }, isError: true, isLoading: false,
    };
    expect(textes(monter()).join(' | ')).toContain('Ce signalement est introuvable.');
  });
});
