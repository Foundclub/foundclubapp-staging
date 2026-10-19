/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
// 🗓️ R17-CONTROLES (20/10/2026, REC17-011 lot 2, decision d Adel Q6 B) — le CARNET DES CONTROLES dans
// l onglet « Sécurité et suivi » (planches validees P10-securite-ordi A : colonne de droite ; P10-securite-tel
// 1 : bloc sous l historique ; P11-q6-exemple-tel ecran 2), et le jalon d une fermeture « n séances
// touchées, n déplacées » (reste de R17-SIGNALER-1). Le vrai fr.js, les crochets reseau doubles.
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
let mockCarnet;
let mockOrdinateur = true;

jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));
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
jest.mock('@/responsive', () => ({ useIsDesktop: () => mockOrdinateur }));
jest.mock('@/services/facilityReport/facilityReportQueries', () => ({ useFacilityReports: () => mockSuivi }));
jest.mock('@/services/facilityCheck/facilityCheckQueries', () => ({ useFacilityChecks: () => mockCarnet }));
jest.mock('@/components/atoms/skeletonLoader/SkeletonLoader', () => function SkeletonMock({ children }) { return children; });
jest.mock('@/utils/imageUrl', () => ({ getImageUrl: (/** @type {string} */ url) => `https://cdn.test${url}` }));

const AUJOURD_HUI = '2026-10-20';
const CONTROLES = [
  {
    current: true, documentId: 'c-buts-2', doneBy: 'Société Exemple', doneOn: '2026-03-12', label: 'Buts et paniers', nextDue: '2027-03-12', series: 's-buts', state: 'a_jour',
  },
  {
    current: false, documentId: 'c-buts-1', doneBy: 'Société Exemple', doneOn: '2025-03-10', label: 'Buts et paniers', nextDue: '2026-03-12', series: 's-buts', state: 'en_retard',
  },
  {
    current: true, documentId: 'c-ext', doneBy: null, doneOn: '2026-01-15', label: 'Extincteurs', nextDue: '2027-01-15', series: 's-ext', state: 'bientot',
  },
  {
    current: true, documentId: 'c-ecl', doneBy: 'Bureau Véritas', doneOn: '2025-09-02', label: 'Éclairage de secours', nextDue: '2026-09-02', series: 's-ecl', state: 'en_retard',
  },
];
const suivi = (/** @type {any[]} */ closures = []) => ({
  data: { data: [], meta: { closures, state: { closure: null, code: 'en_service', securityOpenCount: 0 }, today: AUJOURD_HUI } },
  isError: false,
  isLoading: false,
});
const carnet = (/** @type {any[]} */ lignes) => ({
  data: { data: lignes, meta: { today: AUJOURD_HUI } }, isError: false, isLoading: false, refetch: jest.fn(),
});

const monter = (/** @type {{ largeur?: number }} */ { largeur } = {}) => {
  const onAddCheck = jest.fn();
  const onOpenCheck = jest.fn();
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<FacilitySecurityTab facilityId="gym-tilleuls" onAddCheck={onAddCheck} onOpenCheck={onOpenCheck} />);
  });
  if (largeur) {
    const [racine] = arbre.root.findAll((/** @type {any} */ n) => n.props.testID === 'onglet-securite' && typeof n.type !== 'string');
    act(() => { racine.props.onLayout({ nativeEvent: { layout: { height: 800, width: largeur } } }); });
  }
  return { arbre, onAddCheck, onOpenCheck };
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text).map((/** @type {any} */ n) => [].concat(n.props.children).join(''));
const parId = (/** @type {any} */ arbre, /** @type {string} */ id) => arbre.root.findAll((/** @type {any} */ n) => n.props.testID === id && typeof n.type !== 'string');
const presser = async (/** @type {any} */ noeud) => { await act(async () => { noeud.props.onPress(); }); };

beforeEach(() => {
  mockOrdinateur = true;
  mockSuivi = suivi();
  mockCarnet = carnet(CONTROLES);
});

describe('R17CTRL — le carnet des contrôles dans « Sécurité et suivi »', () => {
  it('les contrôles en cours, le plus urgent d abord, avec leur prochaine date et leur pastille', () => {
    const { arbre } = monter();
    const [bloc] = parId(arbre, 'securite-controles');
    const lus = bloc.findAllByType(Text).map((/** @type {any} */ n) => [].concat(n.props.children).join(''));
    expect(lus).toEqual([
      'Contrôles obligatoires',
      'Éclairage de secours', 'Prochain : 2 sept. 2026', 'En retard',
      'Extincteurs', 'Prochain : 15 janv. 2027', 'Dans 3 mois',
      'Buts et paniers', 'Prochain : 12 mars 2027', 'À jour',
      'Ajouter un contrôle',
      'Un rappel arrive 30 jours avant chaque échéance.',
    ]);
  });

  it('un appui sur une ligne ouvre CE contrôle ; « Ajouter un contrôle » ouvre le formulaire', async () => {
    const { arbre, onAddCheck, onOpenCheck } = monter();
    await presser(parId(arbre, 'controle-s-ext')[0]);
    expect(onOpenCheck).toHaveBeenCalledWith('s-ext');
    const [ajouter] = arbre.root.findAll((/** @type {any} */ n) => n.props.title === 'Ajouter un contrôle' && typeof n.type !== 'string');
    await presser(ajouter);
    expect(onAddCheck).toHaveBeenCalledTimes(1);
  });

  it('aucun contrôle : le dire, et la porte pour en noter un', () => {
    mockCarnet = carnet([]);
    const tout = textes(monter().arbre);
    expect(tout).toContain('Aucun contrôle noté');
    expect(tout).toContain('Notez ici vos contrôles obligatoires : FoundClub vous prévient 30 jours avant chaque échéance.');
  });

  it('le carnet illisible : le dire, et « Réessayer »', async () => {
    mockCarnet = {
      data: undefined, isError: true, isLoading: false, refetch: jest.fn(),
    };
    const { arbre } = monter();
    expect(textes(arbre)).toContain('Les contrôles n’ont pas pu être chargés.');
    const [reessayer] = arbre.root.findAll((/** @type {any} */ n) => n.props.title === 'Réessayer' && typeof n.type !== 'string');
    await presser(reessayer);
    expect(mockCarnet.refetch).toHaveBeenCalled();
  });

  it('ordinateur large : le carnet est une COLONNE à droite ; étroit (panneau ouvert) : il passe dessous', () => {
    const large = monter({ largeur: 1000 }).arbre;
    const [colonnes] = parId(large, 'securite-colonnes');
    expect([].concat(colonnes.props.style).reduce((tout, part) => ({ ...tout, ...part }), {}).flexDirection).toBe('row');
    const etroit = monter({ largeur: 560 }).arbre;
    const [empile] = parId(etroit, 'securite-colonnes');
    expect([].concat(empile.props.style).reduce((tout, part) => ({ ...tout, ...part }), {}).flexDirection).not.toBe('row');
  });
});

describe('R17CTRL — l historique : les contrôles faits, et les séances d une fermeture', () => {
  it('ordinateur : chaque contrôle fait est un jalon « Contrôle : … », avec qui et le prochain', async () => {
    const { arbre, onOpenCheck } = monter();
    // 4 jalons : 3 visibles (planche A), « Voir tout l historique » montre le 4e.
    await presser(parId(arbre, 'securite-historique-tout')[0]);
    const tout = textes(arbre);
    expect(tout).toContain('Contrôle : Buts et paniers');
    expect(tout).toContain('jeu. 12 mars · Société Exemple · prochain : 12 mars 2027');
    expect(tout).toContain('lun. 10 mars · Société Exemple · prochain : 12 mars 2026');
    expect(tout).toContain('jeu. 15 janv. · prochain : 15 janv. 2027');
    await presser(parId(arbre, 'securite-jalon-check-c-buts-1')[0]);
    expect(onOpenCheck).toHaveBeenCalledWith('s-buts');
  });

  it('téléphone : le jalon abrégé « 12 mars · Société Exemple »', () => {
    mockOrdinateur = false;
    const tout = textes(monter().arbre);
    expect(tout).toContain('Contrôle : Buts et paniers');
    expect(tout).toContain('12 mars · Société Exemple');
    expect(tout).toContain('15 janv.');
  });

  it('ordinateur : « Fermé du … · travaux » / « Fermeture · 6 séances touchées, 4 déplacées »', () => {
    mockCarnet = carnet([]);
    mockSuivi = suivi([
      {
        documentId: 'f-1', endDate: '2026-10-09', kind: 'closure', movedSessionsCount: 4, reason: 'travaux', startDate: '2026-10-05', status: 'active', touchedSessionsCount: 6,
      },
      {
        documentId: 'f-2', endDate: '2026-09-02', kind: 'closure', movedSessionsCount: 0, reason: 'manifestation', startDate: '2026-09-01', status: 'active', touchedSessionsCount: 1,
      },
      {
        documentId: 'f-3', endDate: '2026-08-02', kind: 'closure', movedSessionsCount: 0, reason: 'vacances', startDate: '2026-08-01', status: 'active', touchedSessionsCount: 0,
      },
    ]);
    const tout = textes(monter().arbre);
    expect(tout).toContain('Fermé du lun. 5 oct. au ven. 9 oct. · travaux');
    expect(tout).toContain('Fermeture · 6 séances touchées, 4 déplacées');
    expect(tout).toContain('Fermeture · 1 séance touchée');
    expect(tout).toContain('Fermeture · aucune séance touchée');
  });

  it('téléphone : « Fermé du 5 au 9 oct. » / « Travaux · 6 séances touchées »', () => {
    mockOrdinateur = false;
    mockCarnet = carnet([]);
    mockSuivi = suivi([{
      documentId: 'f-1', endDate: '2026-10-09', kind: 'closure', movedSessionsCount: 4, reason: 'travaux', startDate: '2026-10-05', status: 'active', touchedSessionsCount: 6,
    }]);
    const tout = textes(monter().arbre);
    expect(tout).toContain('Fermé du 5 au 9 oct.');
    expect(tout).toContain('Travaux · 6 séances touchées');
  });

  it('une fermeture d avant (aucun nombre) : le jalon d avant, sans chiffre inventé', () => {
    mockCarnet = carnet([]);
    mockSuivi = suivi([{
      documentId: 'f-0', endDate: '2026-10-09', kind: 'closure', movedSessionsCount: 0, reason: 'travaux', startDate: '2026-10-05', status: 'active', touchedSessionsCount: null,
    }]);
    const tout = textes(monter().arbre);
    expect(tout).toContain('Fermé du lun. 5 oct. au ven. 9 oct.');
    expect(tout).toContain('Fermeture · Travaux');
    expect(tout.some((texte) => /séances? touchées?|déplacées?/.test(texte))).toBe(false);
  });
});
