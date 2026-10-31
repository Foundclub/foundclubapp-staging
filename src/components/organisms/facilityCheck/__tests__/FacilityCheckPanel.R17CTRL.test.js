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
jest.mock('@/services/facilityCheck/facilityCheckQueries', () => ({
  useFacilityChecks: () => mockCarnet,
  // CORR-COLLECTIVITES 52-bis : « Retirer ce contrôle ».
  useRemoveFacilityCheck: () => ({ isPending: false, mutateAsync: jest.fn() }),
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
const parId = (/** @type {any} */ arbre, /** @type {string} */ id) => arbre.root.findAll((/** @type {any} */ n) => n.props.testID === id && typeof n.type !== 'string');
const parTitre = (/** @type {any} */ arbre, /** @type {string} */ titre) => arbre.root.findAll((/** @type {any} */ n) => n.props.title === titre && typeof n.type !== 'string');

beforeEach(() => {
  mockCarnet = carnet(SERIE);
  mockGabarits.length = 0;
});

describe('R17CTRL — un contrôle (planche Q6 écran 4)', () => {
  it('en panneau : l intitulé, l échéance, le dernier, « Noter le contrôle fait », l historique de la série', async () => {
    const { arbre, onClose, onRenew } = monter();
    const tout = textes(arbre);
    expect(tout).toEqual(expect.arrayContaining([
      'Buts et paniers',
      'À refaire avant le 12 mars 2027',
      'Dernier : 12/03/2026, Société Exemple.',
      'Historique',
      '12/03/2026', 'Société Exemple · rapport joint',
      '10/03/2025', 'Société Exemple',
    ]));
    await act(async () => { parTitre(arbre, 'Noter le contrôle fait')[0].props.onPress(); });
    expect(onRenew).toHaveBeenCalledWith('s-buts');
    await act(async () => { parId(arbre, 'controle-panneau-fermer')[0].props.onPress(); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('le rapport joint s ouvre', async () => {
    const ouvrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const { arbre } = monter();
    await act(async () => { parId(arbre, 'controle-rapport-c-buts-2')[0].props.onPress(); });
    expect(ouvrir).toHaveBeenCalledWith('https://cdn.test/uploads/rapport.pdf');
  });

  it('en retard : « En retard depuis le 12 mars 2026 »', () => {
    mockCarnet = carnet([{ ...SERIE[0], nextDue: '2026-03-12', state: 'en_retard' }]);
    expect(textes(monter().arbre)).toContain('En retard depuis le 12 mars 2026');
  });

  it('au téléphone : la fenêtre plein écran, le geste « Noter le contrôle fait » en bas', async () => {
    const { arbre, onRenew } = monter({ pleinEcran: true });
    const gabarit = mockGabarits.at(-1);
    expect(gabarit.title).toBe('Buts et paniers');
    expect(gabarit.nextLabel).toBe('Noter le contrôle fait');
    expect(gabarit.headerVariant).toBe('focus');
    await act(async () => { parId(arbre, 'gabarit-suivant')[0].props.onPress(); });
    expect(onRenew).toHaveBeenCalledWith('s-buts');
  });

  it('une série inconnue : « Ce contrôle est introuvable. »', () => {
    expect(textes(monter({ series: 'nulle-part' }).arbre)).toContain('Ce contrôle est introuvable.');
  });
});

// R17CTRL-1 (22/10/2026) — l historique d un controle dit son resultat (planche Q6 ecran 4 : « 12/03/2026 · conforme ») ;
// un controle note avant le lot (sans resultat) garde sa seule date.
describe('R17CTRL-1 — le résultat dans l historique du contrôle', () => {
  it('« 12/03/2026 · conforme », « 10/03/2025 · non conforme » ; sans résultat : la date seule', () => {
    mockCarnet = carnet([{ ...SERIE[0], result: 'conforme' }, { ...SERIE[1], result: 'non_conforme' }]);
    expect(textes(monter().arbre)).toEqual(expect.arrayContaining(['12/03/2026 · conforme', '10/03/2025 · non conforme']));
    mockCarnet = carnet(SERIE);
    expect(textes(monter().arbre)).toEqual(expect.arrayContaining(['12/03/2026', '10/03/2025']));
  });
});
