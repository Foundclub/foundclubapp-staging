/* eslint-disable max-len -- les témoins se lisent en entier. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import TournamentSettingsEdit from '../TournamentSettingsEdit';

// ==========================================================================
// T-ORGA-REGLAGES (18/11, nuit D231) — « Modifier les paramètres » montre et renvoie le prix,
// l'âge minimum, le seuil de joueurs payés et le maillot. Avant : aucun champ, et les quatre
// clés manquaient au corps envoyé (le serveur les effaçait ; corrigé aussi côté serveur).
// ==========================================================================

const mockUpdateEvent = jest.fn(() => Promise.resolve({}));
/** @type {any} */
let mockEvent = null;

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (typeof repli === 'string' ? repli : cle),
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(Colors),
      Colors,
      Fonts: generateFonts(Colors),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});

jest.mock('@/domains/auth/useAuth', () => ({ __esModule: true, default: () => ({ canManageEvent: () => true }) }));
jest.mock('@/components/atoms/button/Button', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ButtonDouble(/** @type {any} */ props) {
    return react.createElement(rn.TouchableOpacity, { accessibilityLabel: props.title, onPress: props.onPress }, react.createElement(rn.Text, null, props.title || ''));
  };
});
jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => () => null);
jest.mock('@/components/molecules/withDataWrapper/WithDataWrapper', () => (/** @type {any} */ { children }) => children);
jest.mock('@/components/templates/ScreenContainer', () => (/** @type {any} */ { children }) => children);
jest.mock('@/services/event/eventQueries', () => ({
  useGetEvent: () => ({
    data: mockEvent, error: null, isLoading: false, refetch: jest.fn(),
  }),
}));
jest.mock('@/services/event/eventService', () => ({
  updateEvent: (/** @type {any} */ ...args) => mockUpdateEvent(...args),
}));

/** @type {any[]} */
const montes = [];

afterEach(async () => {
  const arbres = montes.splice(0);
  await act(async () => { arbres.forEach((arbre) => arbre?.unmount?.()); });
});

const PAYANT = {
  club: { documentId: 'club-rauze', name: 'Rauze FC' },
  documentId: 'evt-1',
  tournamentConfig: {
    entryFeeCents: 2000,
    formatMode: 'groups_only',
    jerseySizeRequired: true,
    maxRosterSize: 8,
    minAge: 16,
    minRosterSize: 5,
    paidMembersToValidate: 5,
  },
};

const monter = async (/** @type {any} */ evenement) => {
  mockEvent = evenement;
  mockUpdateEvent.mockClear();
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  /** @type {any} */
  let arbre = null;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <TournamentSettingsEdit navigation={{ goBack: jest.fn() }} route={{ params: { eventId: 'evt-1' } }} />
      </QueryClientProvider>,
    );
  });
  montes.push(arbre);
  return arbre;
};
const parId = (/** @type {any} */ arbre, /** @type {string} */ id) => arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === id && (n.props?.onChangeText || n.props?.onValueChange))[0];
const saisir = async (/** @type {any} */ arbre, /** @type {string} */ id, /** @type {string} */ valeur) => {
  await act(async () => { parId(arbre, id).props.onChangeText(valeur); });
};
const enregistrer = async (/** @type {any} */ arbre) => {
  const bouton = arbre.root.findAll((/** @type {any} */ n) => n.props?.accessibilityLabel === 'Enregistrer' && typeof n.props?.onPress === 'function')[0];
  await act(async () => { bouton.props.onPress(); });
};
const envoye = () => mockUpdateEvent.mock.calls[0][0].eventData.tournamentConfig;

describe('T-ORGA-REGLAGES — les règles payantes dans « Modifier les paramètres »', () => {
  test('🔴 les champs montrent 20 €, 16 ans, 5 payés et le maillot obligatoire', async () => {
    const arbre = await monter(PAYANT);
    expect(parId(arbre, 'tournoi-regles-prix')?.props.value).toBe('20');
    expect(parId(arbre, 'tournoi-regles-age')?.props.value).toBe('16');
    expect(parId(arbre, 'tournoi-regles-seuil')?.props.value).toBe('5');
    expect(parId(arbre, 'tournoi-regles-maillot')?.props.value).toBe(true);
  });

  test('🔴 enregistrer sans rien toucher renvoie les quatre réglages tels quels', async () => {
    const arbre = await monter(PAYANT);
    await enregistrer(arbre);
    expect(mockUpdateEvent).toHaveBeenCalledTimes(1);
    expect(envoye()).toEqual(expect.objectContaining({
      entryFeeCents: 2000, jerseySizeRequired: true, minAge: 16, paidMembersToValidate: 5,
    }));
  });

  test('🔴 19,99 € part en 1999 centimes ; vider le prix et l âge = gratuit et tous âges', async () => {
    let arbre = await monter(PAYANT);
    await saisir(arbre, 'tournoi-regles-prix', '19,99');
    await enregistrer(arbre);
    expect(envoye().entryFeeCents).toBe(1999);

    arbre = await monter(PAYANT);
    await saisir(arbre, 'tournoi-regles-prix', '');
    await saisir(arbre, 'tournoi-regles-age', '');
    await enregistrer(arbre);
    expect(envoye()).toEqual(expect.objectContaining({ entryFeeCents: 0, minAge: null }));
  });

  test('🔴 un prix illisible ou un seuil au-dessus de l effectif max bloquent l enregistrement', async () => {
    let arbre = await monter(PAYANT);
    await saisir(arbre, 'tournoi-regles-prix', '-3');
    expect(JSON.stringify(arbre.toJSON())).toContain('Saisis un prix en euros, par exemple 20 ou 19,50.');
    await enregistrer(arbre);
    expect(mockUpdateEvent).not.toHaveBeenCalled();

    arbre = await monter(PAYANT);
    await saisir(arbre, 'tournoi-regles-seuil', '9');
    expect(JSON.stringify(arbre.toJSON())).toContain('Ce nombre ne peut pas dépasser l’effectif maximum');
    await enregistrer(arbre);
    expect(mockUpdateEvent).not.toHaveBeenCalled();
  });

  test('un tournoi sans réglage payant part gratuit, sans âge, au seuil de 5', async () => {
    const arbre = await monter({ documentId: 'evt-1', tournamentConfig: { formatMode: 'groups_only' } });
    await enregistrer(arbre);
    expect(envoye()).toEqual(expect.objectContaining({
      entryFeeCents: 0, jerseySizeRequired: false, minAge: null, paidMembersToValidate: 5,
    }));
  });

  test('🔴 un tournoi payant sans club porteur : le message s affiche et rien ne part', async () => {
    const arbre = await monter({ ...PAYANT, club: null });
    expect(JSON.stringify(arbre.toJSON())).toContain('Un tournoi payant doit être porté par un club.');
    await enregistrer(arbre);
    expect(mockUpdateEvent).not.toHaveBeenCalled();
    await saisir(arbre, 'tournoi-regles-prix', '');
    await enregistrer(arbre);
    expect(envoye().entryFeeCents).toBe(0);
  });

  test('🔴 un tournoi GRATUIT de 4 joueurs max s’enregistre : le seuil par défaut ne bloque rien', async () => {
    const arbre = await monter({ club: PAYANT.club, documentId: 'evt-1', tournamentConfig: { formatMode: 'groups_only', maxRosterSize: 4 } });
    expect(JSON.stringify(arbre.toJSON())).not.toContain('Ce nombre ne peut pas dépasser');
    await enregistrer(arbre);
    expect(mockUpdateEvent).toHaveBeenCalledTimes(1);
  });
});
