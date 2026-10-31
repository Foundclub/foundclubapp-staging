/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
// 🚩 R17-SIGNALER-1 (19/10/2026, REC17-011) — « SIGNALER UN PROBLÈME » cote membre (planches
// P10-signaler-tel 2 a 4 et 6, P11-mineur-photo-tel, validees par Adel le 19/10 « ok go »).
// Le vrai fr.js, les crochets reseau doubles. Ce que le temoin fixe :
//   - Q7 B : le bouton photo a partir de 15 ans ; en dessous (ou age inconnu), pas de bouton, et
//     la phrase « Ton entraîneur pourra ajouter une photo » ;
//   - Q2 A : « Déjà signalé » AVANT d envoyer, sans auteur ; « Signaler autre chose » ouvre le
//     formulaire ;
//   - le corps envoye : la categorie, le texte, la seance, l installation ; « Merci, c'est envoyé » ;
//   - les refus : rien de choisi, le texte gardé ; pas membre d un club qui utilise l installation.
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import FacilityReportNew from '../FacilityReportNew';

jest.setTimeout(30000);

const i18nextTemoin = require('i18next');

const frTemoin = require('@/theme/strings/translations/fr');

(i18nextTemoin.default || i18nextTemoin).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'fr',
  lng: 'fr',
  resources: { fr: { translation: frTemoin.default } },
});

/** @type {any} */
let mockNavigation;
/** @type {any} */
let mockUser;
/** @type {any} */
let mockOuverts;
/** @type {any} */
let mockEnvoi;
const mockParams = {
  collectiviteName: 'Ville de Montrivage', eventId: 'evt-1', facilityId: 'gym-tilleuls', facilityName: 'Gymnase des Tilleuls',
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: mockParams }),
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
jest.mock('@/domains/auth/useAuth', () => ({ __esModule: true, default: () => ({ userData: mockUser }) }));
jest.mock('@/services/facilityReport/facilityReportQueries', () => ({
  useOpenFacilityReports: () => mockOuverts,
  useSubmitFacilityReport: () => mockEnvoi,
}));
jest.mock('@/platform/media', () => ({ __esModule: true, default: { pickImage: jest.fn() } }));
jest.mock('@/components/templates/ScreenContainer', () => function ScreenContainerMock({ children }) { return children; });
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });
jest.mock('@/components/molecules/input/Input', () => {
  const reactActuel = jest.requireActual('react');
  const { TextInput } = jest.requireActual('react-native');
  return function InputMock(/** @type {any} */ props) {
    return reactActuel.createElement(TextInput, { onChangeText: props.onChangeText, testID: props.testID, value: props.value });
  };
});

const ilYa = (/** @type {number} */ ans) => {
  const date = new Date();
  date.setFullYear(date.getFullYear() - ans);
  date.setDate(date.getDate() - 10);
  return date.toISOString().slice(0, 10);
};

/** Button ne porte pas d identifiant de test : ses titres, par identifiant du temoin. */
const TITRES = /** @type {Record<string, string>} */ ({
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
  act(() => { arbre = renderer.create(<FacilityReportNew />); });
  return arbre;
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ noeud) => [].concat(noeud.props.children).join(''));
const parId = (/** @type {any} */ arbre, /** @type {string} */ id) => arbre.root.findAll((/** @type {any} */ n) => (n.props.testID === id || (TITRES[id] && n.props.title === TITRES[id])) && typeof n.type !== 'string');
const presser = async (/** @type {any} */ arbre, /** @type {string} */ id) => {
  const [cible] = parId(arbre, id);
  if (!cible) throw new Error(`introuvable : ${id}`);
  await act(async () => { await cible.props.onPress(); });
};

beforeEach(() => {
  mockNavigation = { goBack: jest.fn(), navigate: jest.fn() };
  mockUser = { birthdate: ilYa(16), documentId: 'u-joueur' };
  mockOuverts = { data: { data: [] }, isError: false, isLoading: false };
  mockEnvoi = { isPending: false, mutateAsync: jest.fn(() => Promise.resolve({ data: {} })) };
});

describe('R17SS1 — signaler un problème (membre)', () => {
  it('Q7 B : à 16 ans, le bouton photo et la consigne ; la phrase dit ce que voit la Ville', () => {
    const arbre = monter();
    expect(parId(arbre, 'signaler-photo').length).toBeGreaterThan(0);
    const tout = textes(arbre).join(' | ');
    expect(tout).toContain('Photographie le problème, jamais une personne. Pas de photo dans les vestiaires.');
    // CORR-COLLECTIVITES 95 (31/10, Adel C) : le texte unique, juste aussi pour un encadrant.
    expect(tout).toContain('La Ville voit ton rôle et ton club ; ton nom si tu encadres. La photo n’est vue que par la Ville.');
    expect(tout).toContain('Envoyé à Ville de Montrivage');
  });

  it('Q7 B : à 12 ans ou sans date de naissance, AUCUN bouton photo ; l entraîneur pourra l ajouter', () => {
    [ilYa(12), null].forEach((birthdate) => {
      mockUser = { birthdate, documentId: 'u-jeune' };
      const arbre = monter();
      expect(parId(arbre, 'signaler-photo')).toHaveLength(0);
      const tout = textes(arbre).join(' | ');
      expect(tout).toContain('Décris bien le problème. Ton entraîneur pourra ajouter une photo s’il le faut.');
      expect(tout).not.toContain('La photo n’est vue que par la Ville.');
    });
  });

  it('Q2 A : « Déjà signalé » avant d envoyer, sans auteur ; « Signaler autre chose » ouvre le formulaire', async () => {
    mockOuverts = {
      data: {
        data: [{
          category: 'securite', createdAt: '2026-10-18T10:00:00Z', description: 'Panier côté nord descellé.', documentId: 'sig-1', status: 'pris_en_charge', title: 'Panier côté nord descellé',
        }],
      },
      isError: false,
      isLoading: false,
    };
    const arbre = monter();
    expect(parId(arbre, 'signaler-deja').length).toBeGreaterThan(0);
    const tout = textes(arbre).join(' | ');
    expect(tout).toContain('Déjà signalé à la Ville');
    expect(tout).toContain('« Panier côté nord descellé » · Sécurité · Pris en charge');
    expect(parId(arbre, 'signaler-formulaire')).toHaveLength(0);
    await presser(arbre, 'signaler-autre-chose');
    expect(parId(arbre, 'signaler-formulaire').length).toBeGreaterThan(0);
  });

  it('rien de choisi : « Choisis le type de problème. », rien ne part', async () => {
    const arbre = monter();
    await presser(arbre, 'signaler-envoyer');
    const tout = textes(arbre).join(' | ');
    expect(tout).toContain('Choisis le type de problème.');
    expect(tout).toContain('Décris le problème.');
    expect(mockEnvoi.mutateAsync).not.toHaveBeenCalled();
  });

  it('envoyer : la categorie, le texte, la seance, l installation ; puis « Merci, c’est envoyé »', async () => {
    const arbre = monter();
    await presser(arbre, 'signaler-categorie-securite');
    const [champ] = parId(arbre, 'signaler-texte');
    await act(async () => { champ.props.onChangeText('  Le panier bouge quand on s y accroche.  '); });
    await presser(arbre, 'signaler-envoyer');
    expect(mockEnvoi.mutateAsync).toHaveBeenCalledWith({
      category: 'securite', description: 'Le panier bouge quand on s y accroche.', event: 'evt-1', facilityId: 'gym-tilleuls', photo: null,
    });
    expect(parId(arbre, 'signaler-merci').length).toBeGreaterThan(0);
    expect(textes(arbre).join(' | ')).toContain('Merci, c’est envoyé');
    await presser(arbre, 'signaler-voir-mes');
    expect(mockNavigation.navigate).toHaveBeenCalledWith('MyFacilityReports');
  });

  it('envoi impossible : le texte est gardé, le refus le dit', async () => {
    mockEnvoi.mutateAsync = jest.fn(() => Promise.reject(new Error('Network Error')));
    const arbre = monter();
    await presser(arbre, 'signaler-categorie-equipement');
    const [champ] = parId(arbre, 'signaler-texte');
    await act(async () => { champ.props.onChangeText('Filet arraché.'); });
    await presser(arbre, 'signaler-envoyer');
    const tout = textes(arbre).join(' | ');
    expect(tout).toContain('Le signalement n’est pas parti.');
    expect(tout).toContain('Ton texte est gardé. Vérifie la connexion.');
    expect(parId(arbre, 'signaler-texte')[0].props.value).toBe('Filet arraché.');
  });

  it('pas membre d un club qui utilise l installation : la phrase du refus, pas de formulaire', () => {
    mockOuverts = {
      data: undefined, error: { response: { status: 403 } }, isError: true, isLoading: false,
    };
    const arbre = monter();
    expect(parId(arbre, 'signaler-refus-membre').length).toBeGreaterThan(0);
    expect(textes(arbre).join(' | ')).toContain('Seuls les membres des clubs qui utilisent cette installation peuvent la signaler.');
    expect(parId(arbre, 'signaler-formulaire')).toHaveLength(0);
  });
});
