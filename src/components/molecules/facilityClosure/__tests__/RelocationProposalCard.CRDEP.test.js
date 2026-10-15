/* eslint-disable max-len -- des phrases entieres de l ecran, comparees telles quelles */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { decideRelocation } from '@/services/event/eventService';

import RelocationProposalCard from '../RelocationProposalCard';

// 🤝 COLL-R-DEPLACER A8 (14/10/2026, COL-013, « D9 = b ») — chez le club, LA PROPOSITION DE LA VILLE
// (planche P5v4-deplacer-ville-tel, écran 5 b) : la place, la fermeture, « Accepter » et « Choisir une
// autre place ». ROUGE avant le lot : la carte n'existait pas.

jest.setTimeout(30000);

const i18nextTemoin = require('i18next');

const frTemoin = require('@/theme/strings/translations/fr');

(i18nextTemoin.default || i18nextTemoin).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'fr',
  lng: 'fr',
  resources: { fr: { translation: frTemoin.default } },
});

jest.mock('react-i18next', () => ({
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
      Images: {},
      Spaces: espaces,
    }),
  };
});
jest.mock('@/services/event/eventService', () => ({ decideRelocation: jest.fn() }));
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { disabled: props.disabled || props.isLoading, onPress: props.onPress },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});

const PROPOSITION = {
  closure: {
    documentId: 'fermeture-1', endDate: '2031-01-12', endTime: null, kind: 'closure', label: null, reason: 'vacances', startDate: '2031-01-10', startTime: null,
  },
  collectivite: { name: 'Ville de Demo' },
  date: '2031-01-10',
  documentId: 'prop-1',
  endTime: '19:30',
  event: { documentId: 'seance-1' },
  facility: { documentId: 'stade-ville', name: 'Stade municipal' },
  fromFacility: { documentId: 'gym-ville', name: 'Gymnase des Tilleuls' },
  startTime: '18:00',
  status: 'pending',
};

const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};

const monter = async (/** @type {any} */ props) => {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <RelocationProposalCard onChooseOther={props.onChooseOther} proposal={props.proposal} />
      </QueryClientProvider>,
    );
  });
  return arbre;
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text).map((noeud) => aplatir(noeud.props.children));
const bouton = (/** @type {any} */ arbre, /** @type {string} */ titre) => arbre.root.findAll((noeud) => noeud.type === TouchableOpacity && aplatir(noeud.props.children) === titre)[0];
const attendre = async () => {
  for (let tour = 0; tour < 6; tour += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((resoudre) => { setTimeout(resoudre, 0); }); });
  }
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

test('la carte dit la place proposée, la fermeture, et ses deux gestes', async () => {
  const arbre = await monter({ onChooseOther: jest.fn(), proposal: PROPOSITION });
  expect(textes(arbre)).toEqual([
    'Proposition de la Ville de Demo',
    'Stade municipal · ven. 10 janv. · 18:00 – 19:30',
    'Le Gymnase des Tilleuls est fermé ce jour-là (vacances).',
    'Accepter',
    'Choisir une autre place',
    'Accepter déplace la séance et prévient tes joueurs.',
  ]);
});

test('« Accepter » : la réponse part au serveur ; la séance est déplacée, les joueurs prévenus', async () => {
  decideRelocation.mockResolvedValue({ documentId: 'prop-1', status: 'accepted' });
  const arbre = await monter({ onChooseOther: jest.fn(), proposal: PROPOSITION });
  await act(async () => { bouton(arbre, 'Accepter').props.onPress(); });
  await attendre();
  expect(decideRelocation).toHaveBeenCalledWith('prop-1', 'accept');
  expect(Alert.alert).toHaveBeenCalledWith('Séance déplacée au Stade municipal', 'Tes joueurs sont prévenus.');
});

test('une place prise entre-temps : on le dit, rien n’a bougé', async () => {
  decideRelocation.mockRejectedValue({ details: { code: 'RELOCATION_PLACE_UNAVAILABLE', state: 'complet' }, status: 409 });
  const arbre = await monter({ onChooseOther: jest.fn(), proposal: PROPOSITION });
  await act(async () => { bouton(arbre, 'Accepter').props.onPress(); });
  await attendre();
  expect(Alert.alert).toHaveBeenCalledWith('La séance n’a pas bougé', 'Cette place n’est plus libre. Choisis-en une autre.');
});

test('« Choisir une autre place » ouvre le tunnel ; rien n’est envoyé', async () => {
  const autre = jest.fn();
  const arbre = await monter({ onChooseOther: autre, proposal: PROPOSITION });
  await act(async () => { bouton(arbre, 'Choisir une autre place').props.onPress(); });
  expect(autre).toHaveBeenCalledTimes(1);
  expect(decideRelocation).not.toHaveBeenCalled();
});

test('sans proposition, ou une proposition tombée : rien', async () => {
  expect((await monter({ proposal: null })).toJSON()).toBeNull();
  expect((await monter({ proposal: { ...PROPOSITION, status: 'lapsed' } })).toJSON()).toBeNull();
});
