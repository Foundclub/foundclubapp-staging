/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
// 🚩 R17-SIGNALER-1 (19/10/2026, REC17-011) — l onglet « Sécurité et suivi » de la Ville (planches
// P10-securite-ordi A, D, E, F et P10-securite-tel 1, validees le 19/10). Le vrai fr.js, le crochet
// reseau double. Ce que le temoin fixe : l ETAT deduit par le serveur (Q5 A) dit en clair ; les
// signalements ouverts, la securite d abord, sans nom de joueur ; l historique ; le vide ; l erreur.
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import FacilitySecurityTab from '../FacilitySecurityTab';

jest.setTimeout(30000);

const i18nextTemoin = require('i18next');

const frTemoin = require('@/theme/strings/translations/fr');

(i18nextTemoin.default || i18nextTemoin).init({
  compatibilityJSON: 'v4', fallbackLng: 'fr', lng: 'fr', resources: { fr: { translation: frTemoin.default } },
});

/** @type {any} */
let mockSuivi;
/** @type {any} */
let mockNavigation;

jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNavigation }));
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
jest.mock('@/services/facilityReport/facilityReportQueries', () => ({ useFacilityReports: () => mockSuivi }));
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });

const OUVERTS = [
  {
    author: { name: null, role: 'joueur' }, category: 'eclairage', club: { name: 'Montrivage FC' }, createdAt: '2026-10-16T10:00:00Z', description: 'Deux néons sur trois éteints.', documentId: 'sig-2', status: 'pris_en_charge', title: 'Lumière du vestiaire B',
  },
  {
    author: { name: 'Lucas Morel', role: 'entraineur' }, category: 'securite', club: { name: 'AS Montrivage' }, createdAt: '2026-10-18T10:00:00Z', description: 'Le panier bouge quand on s y accroche.', documentId: 'sig-1', status: 'envoye', title: 'Panier côté nord descellé',
  },
];
const TRAITE = {
  author: { name: null, role: 'parent' }, category: 'proprete', cityNote: 'Joint changé.', closedAt: '2026-10-14T10:00:00Z', club: { name: 'AS Montrivage' }, createdAt: '2026-10-06T10:00:00Z', description: 'Fuite de la douche.', documentId: 'sig-0', status: 'resolu', title: 'Fuite de la douche',
};

const monter = (/** @type {{ onOpenReport?: any, selectedReportId?: string }} */ { onOpenReport, selectedReportId } = {}) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <FacilitySecurityTab facilityId="gym-tilleuls" onOpenClosures={jest.fn()} onOpenReport={onOpenReport} selectedReportId={selectedReportId} />,
    );
  });
  return arbre;
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text).map((/** @type {any} */ n) => [].concat(n.props.children).join(''));
const parId = (/** @type {any} */ arbre, /** @type {string} */ id) => arbre.root.findAll((/** @type {any} */ n) => n.props.testID === id && typeof n.type !== 'string');

beforeEach(() => {
  mockNavigation = { navigate: jest.fn() };
});

describe('R17SS1 — l onglet « Sécurité et suivi »', () => {
  it('Q5 A : « À surveiller », les ouverts la securite d abord, l historique', async () => {
    mockSuivi = {
      data: {
        data: [...OUVERTS, TRAITE],
        meta: {
          closures: [{
            documentId: 'f-1', endDate: '2026-10-09', kind: 'closure', reason: 'travaux', startDate: '2026-10-05', status: 'active',
          }],
          state: {
            closure: null, code: 'a_surveiller', securityOpenCount: 1, securitySince: '2026-10-18T10:00:00Z',
          },
        },
      },
      isError: false,
      isLoading: false,
    };
    const arbre = monter();
    const tout = textes(arbre).join(' | ');
    expect(parId(arbre, 'securite-etat-a_surveiller').length).toBeGreaterThan(0);
    expect(tout).toContain('À surveiller');
    expect(tout).toContain('1 signalement « sécurité » est ouvert depuis le dim. 18 oct. ; l’installation reste ouverte.');
    expect(tout).toContain('Signalements ouverts : 2');
    const lignes = textes(arbre).filter((texte) => ['Lumière du vestiaire B', 'Panier côté nord descellé'].includes(texte));
    expect(lignes).toEqual(['Panier côté nord descellé', 'Lumière du vestiaire B']);
    expect(tout).toContain('dim. 18 oct. · Lucas Morel, entraîneur · AS Montrivage');
    expect(tout).toContain('ven. 16 oct. · un joueur · Montrivage FC');
    expect(tout).toContain('Fuite de la douche · résolu');
    expect(tout).toContain('Signalé le mar. 6 oct. · clos le mer. 14 oct. : « Joint changé. »');
    expect(tout).toContain('Fermé du lun. 5 oct. au ven. 9 oct.');
    const [ligne] = parId(arbre, 'securite-signalement-sig-1');
    await act(async () => { ligne.props.onPress(); });
    expect(mockNavigation.navigate).toHaveBeenCalledWith('FacilityReportDetails', { espace: 'ville', reportId: 'sig-1' });
  });

  it('P10-securite-ordi B : sur ordinateur, l ecran donne onOpenReport — le signalement s ouvre dans le PANNEAU, pas en page', async () => {
    mockSuivi = {
      data: {
        data: [...OUVERTS, TRAITE],
        meta: {
          closures: [],
          state: {
            closure: null, code: 'a_surveiller', securityOpenCount: 1, securitySince: '2026-10-18T10:00:00Z',
          },
        },
      },
      isError: false,
      isLoading: false,
    };
    const onOpenReport = jest.fn();
    const arbre = monter({ onOpenReport, selectedReportId: 'sig-2' });
    await act(async () => { parId(arbre, 'securite-signalement-sig-1')[0].props.onPress(); });
    expect(onOpenReport).toHaveBeenCalledWith('sig-1');
    await act(async () => { parId(arbre, 'securite-jalon-report-sig-0')[0].props.onPress(); });
    expect(onOpenReport).toHaveBeenLastCalledWith('sig-0');
    expect(mockNavigation.navigate).not.toHaveBeenCalled();
    // Le signalement ouvert dans le panneau se lit dans la liste.
    expect(parId(arbre, 'securite-signalement-sig-2')[0].props.accessibilityState).toEqual({ selected: true });
    expect(parId(arbre, 'securite-signalement-sig-1')[0].props.accessibilityState).toEqual({ selected: false });
  });

  it('Q5 A : « Fermée » pendant une fermeture, et le bouton « Fermetures »', () => {
    mockSuivi = {
      data: { data: [], meta: { closures: [], state: { closure: { endDate: '2026-10-21', reason: 'travaux', startDate: '2026-10-19' }, code: 'fermee', securityOpenCount: 0 } } },
      isError: false,
      isLoading: false,
    };
    const arbre = monter();
    const tout = textes(arbre).join(' | ');
    expect(tout).toContain('Fermée');
    expect(tout).toContain('Du lun. 19 oct. au mer. 21 oct. · Travaux');
    expect(tout).toContain('Fermetures');
  });

  it('aucun signalement : « En service », et qui peut signaler', () => {
    mockSuivi = { data: { data: [], meta: { closures: [], state: { closure: null, code: 'en_service', securityOpenCount: 0 } } }, isError: false, isLoading: false };
    const tout = textes(monter()).join(' | ');
    expect(tout).toContain('En service');
    expect(tout).toContain('Aucun signalement ouvert, aucune fermeture en cours.');
  });

  it('erreur : « Le suivi n’a pas pu être chargé. » et « Réessayer »', () => {
    mockSuivi = {
      data: undefined, isError: true, isLoading: false, refetch: jest.fn(),
    };
    const arbre = monter();
    expect(parId(arbre, 'securite-erreur').length).toBeGreaterThan(0);
    expect(textes(arbre).join(' | ')).toContain('Le suivi n’a pas pu être chargé.');
  });
});
