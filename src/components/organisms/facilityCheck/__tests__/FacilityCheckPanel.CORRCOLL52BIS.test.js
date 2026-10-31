/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
// 🗓️ R17-CONTROLES (20/10/2026, REC17-011 lot 2, decision d Adel Q6 B) — UN CONTROLE (planche validee
// P11-q6-exemple-tel ecran 4) : « À refaire avant le 12 mars 2027 » / « Dernier : 12/03/2026, Société [X]. »,
// « Noter le contrôle fait », et l historique de la serie (« 12/03/2026 » / « Société [X] · rapport joint »).
// En PANNEAU a droite sur ordinateur, en FENETRE plein ecran au telephone (le gabarit des tunnels).
import { Linking, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import FacilityCheckPanel from '../FacilityCheckPanel';

jest.setTimeout(30000);

const i18nextTemoin = require('i18next');

const frTemoin = require('@/theme/strings/translations/fr');

(i18nextTemoin.default || i18nextTemoin).init({
  compatibilityJSON: 'v4', fallbackLng: 'fr', lng: 'fr', resources: { fr: { translation: frTemoin.default } },
});

/** @type {any} */
let mockCarnet;
/** @type {any[]} */
const mockGabarits = [];

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
const mockRetirer = jest.fn(async () => ({}));
jest.mock('@/services/facilityCheck/facilityCheckQueries', () => ({
  useFacilityChecks: () => mockCarnet,
  useRemoveFacilityCheck: () => ({ isPending: false, mutateAsync: mockRetirer }),
}));
jest.mock('@/utils/imageUrl', () => ({ getImageUrl: (/** @type {string} */ url) => `https://cdn.test${url}` }));
jest.mock('@/components/atoms/skeletonLoader/SkeletonLoader', () => function SkeletonMock({ children }) { return children; });
jest.mock('@/components/organisms/seasonSlot/SeasonSlotForm', () => ({
  FenetrePleinEcran: function FenetreMock({ children }) { return children; },
}));
jest.mock('@/components/molecules/wizardStepLayout/WizardStepLayout', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity, View } = jest.requireActual('react-native');
  return function GabaritMock(/** @type {any} */ props) {
    mockGabarits.push(props);
    return reactActuel.createElement(
      View,
      null,
      reactActuel.createElement(TexteRN, null, props.title),
      props.children,
      reactActuel.createElement(TouchableOpacity, { onPress: props.onNext, testID: 'gabarit-suivant' }),
      reactActuel.createElement(TouchableOpacity, { onPress: props.onClose, testID: 'gabarit-fermer' }),
    );
  };
});

const SERIE = [
  {
    current: true, document: { mime: 'application/pdf', name: 'rapport.pdf', url: '/uploads/rapport.pdf' }, documentId: 'c-buts-2', doneBy: 'Société Exemple', doneOn: '2026-03-12', label: 'Buts et paniers', nextDue: '2027-03-12', series: 's-buts', state: 'a_jour',
  },
  {
    current: false, document: null, documentId: 'c-buts-1', doneBy: 'Société Exemple', doneOn: '2025-03-10', label: 'Buts et paniers', nextDue: '2026-03-12', series: 's-buts', state: 'en_retard',
  },
];
const carnet = (/** @type {any[]} */ lignes) => ({
  data: { data: lignes, meta: { facility: { documentId: 'gym-tilleuls', name: 'Gymnase des Tilleuls' }, today: '2026-10-20' } }, isError: false, isLoading: false,
});

const monter = (/** @type {{ pleinEcran?: boolean, series?: string }} */ { pleinEcran = false, series = 's-buts' } = {}) => {
  const onClose = jest.fn();
  const onRenew = jest.fn();
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<FacilityCheckPanel facilityId="gym-tilleuls" onClose={onClose} onRenew={onRenew} pleinEcran={pleinEcran} series={series} />);
  });
  return { arbre, onClose, onRenew };
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text).map((/** @type {any} */ n) => [].concat(n.props.children).join(''));
const parTitre = (/** @type {any} */ arbre, /** @type {string} */ titre) => arbre.root.findAll((/** @type {any} */ n) => n.props.title === titre && typeof n.type !== 'string');

beforeEach(() => {
  mockCarnet = carnet(SERIE);
  mockGabarits.length = 0;
});

// CORR-COLLECTIVITES 52-bis (31/10/2026, décision d'Adel 52, relayée par le chef) — un double appui
// notait DEUX contrôles identiques, sans moyen d'en retirer un. « Retirer ce contrôle », avec une
// confirmation : la ligne en cours part (DELETE /facility-checks/:id).
describe('CORR-COLLECTIVITES 52-bis — « Retirer ce contrôle »', () => {
  it('le bouton, puis la confirmation, puis le retrait de la ligne en cours', async () => {
    mockRetirer.mockClear();
    const { arbre } = monter();
    const [retirer] = parTitre(arbre, 'Retirer ce contrôle');
    expect(retirer).toBeDefined();
    await act(async () => { retirer.props.onPress(); });
    expect(textes(arbre)).toContain('Retirer ce contrôle ? Il disparaît du carnet ; le contrôle d’avant redevient celui en cours.');
    expect(mockRetirer).not.toHaveBeenCalled();
    const [oui] = parTitre(arbre, 'Oui, retirer');
    await act(async () => { await oui.props.onPress(); });
    expect(mockRetirer).toHaveBeenCalledWith({ checkId: 'c-buts-2' });
  });

  it('la confirmation s’annule : rien n’est retiré', async () => {
    mockRetirer.mockClear();
    const { arbre } = monter();
    await act(async () => { parTitre(arbre, 'Retirer ce contrôle')[0].props.onPress(); });
    await act(async () => { parTitre(arbre, 'Annuler')[0].props.onPress(); });
    expect(mockRetirer).not.toHaveBeenCalled();
    expect(parTitre(arbre, 'Retirer ce contrôle')).toHaveLength(1);
  });
});
