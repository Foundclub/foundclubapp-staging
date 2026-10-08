/* eslint-disable max-len -- les phrases de l'écran sont citées en entier */
import { createElement } from 'react';
import { Alert, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ClubWizardRecap from '../ClubWizardRecap';

// 🏟️ FINITIONS-VILLE — décision d'Adel `créateur C` (08/10 ~17h15, relayée par le chef). Un
// ENTRAÎNEUR qui crée un club voyait une case « Je suis aussi dirigeant de ce club » DÉCOCHÉE ;
// sans la cocher, le club n'avait AUCUN dirigeant (club-self-onboard.ts:51) : une Ville ne peut
// pas l'inviter, personne n'a « Gérer mon club ». Désormais, au récapitulatif, une vraie question
// OBLIGATOIRE : « Qui dirige ce club ? » — « Moi » (alsoDirector), « Quelqu'un d'autre, je
// l'inviterai », « Je ne sais pas encore ». Un dirigeant qui crée : rien ne change.
// ROUGE avant le lot : aucune question, « Créer mon club » actif sans réponse.

const mockEtape = [];
/** @type {any} */
let mockRole = { type: 'entraineur' };
const mockCreerClub = jest.fn(async () => ({ club: { documentId: 'club-neuf' }, duplicate: false }));
const mockPartager = jest.fn(async () => {});
const mockClientRequete = { invalidateQueries: jest.fn(async () => {}), setQueriesData: jest.fn() };
const mockEtatTunnel = Object.freeze({
  activityDocumentIds: [],
  addressOption: { label: '1 Chemin du Château 14400 Agy', lat: 49.23, lng: -0.77 },
  alsoDirector: false,
  email: '',
  name: 'T20 Club Karim',
  phoneNumber: '',
});

jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => mockClientRequete }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (/** @type {string} */ cle, /** @type {string} */ repli) => repli || cle }),
}));
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    getNextOnboardingRoute: () => null,
    getPostOnboardingHomeRoute: () => 'HomeTab',
    refetchUserData: jest.fn(async () => {}),
    userData: { documentId: 'karim', role: mockRole },
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
jest.mock('@/platform/storage', () => ({ getItem: () => null, removeItem: () => {}, setItem: () => {} }));
jest.mock('@/platform/share', () => ({ __esModule: true, default: { share: (...args) => mockPartager(...args) } }));
jest.mock('@/services/club/clubService', () => ({
  createSelfOnboardClub: (/** @type {any} */ ...args) => mockCreerClub(...args),
}));
jest.mock('@/services/activity/activityQueries', () => ({ useGetActivities: () => ({ data: [] }) }));
jest.mock('../ClubWizardContext', () => ({
  useClubWizard: () => ({ dispatch: jest.fn(), state: mockEtatTunnel }),
}));
jest.mock(
  '@/components/molecules/wizardStepLayout/WizardStepLayout',
  () => function EtapeMock(/** @type {any} */ props) {
    mockEtape.push(props);
    return props.children;
  },
);

/**
 * Aplati les enfants React en une chaine.
 * @param {any} enfants
 * @returns {string}
 */
const aplatir = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};

const monter = async () => {
  mockEtape.length = 0;
  const navigation = {
    getParent: () => null, goBack: jest.fn(), navigate: jest.fn(), reset: jest.fn(),
  };
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(createElement(ClubWizardRecap, { navigation, route: { params: { entry: 'search' } } }));
  });
  return { arbre, navigation };
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ n) => aplatir(n.props.children).trim());
const choisir = async (/** @type {any} */ arbre, /** @type {string} */ libelle) => {
  const ligne = arbre.root.findAllByType(TouchableOpacity)
    .find((/** @type {any} */ n) => n.props.accessibilityLabel === libelle);
  if (!ligne) throw new Error(`Aucune réponse « ${libelle} »`);
  await act(async () => { ligne.props.onPress(); });
};
const creer = async () => { await act(async () => { await mockEtape.at(-1).onNext(); }); };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockRole = { type: 'entraineur' };
});

describe('FVIL `créateur C` — « Qui dirige ce club ? », obligatoire pour un entraîneur', () => {
  it('la question et ses 3 réponses ; « Créer mon club » bloqué sans réponse', async () => {
    const { arbre } = await monter();
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Qui dirige ce club ?', 'Moi', 'Quelqu’un d’autre, je l’inviterai', 'Je ne sais pas encore',
    ]));
    expect(mockEtape.at(-1).isNextDisabled).toBe(true);
    await creer();
    expect(mockCreerClub).not.toHaveBeenCalled();
    await choisir(arbre, 'Je ne sais pas encore');
    expect(mockEtape.at(-1).isNextDisabled).toBe(false);
  });

  it('« Moi » envoie alsoDirector ; « Je ne sais pas encore » ne l’envoie pas', async () => {
    const premier = await monter();
    await choisir(premier.arbre, 'Moi');
    await creer();
    expect(mockCreerClub).toHaveBeenLastCalledWith(expect.objectContaining({ alsoDirector: true }));

    const second = await monter();
    await choisir(second.arbre, 'Je ne sais pas encore');
    await creer();
    expect(mockCreerClub).toHaveBeenLastCalledWith(expect.objectContaining({ alsoDirector: false }));
  });

  it('« Quelqu’un d’autre » propose le partage après création, sans nommer le destinataire dirigeant', async () => {
    const { arbre, navigation } = await monter();
    await choisir(arbre, 'Quelqu’un d’autre, je l’inviterai');
    await creer();
    expect(mockCreerClub).toHaveBeenLastCalledWith(expect.objectContaining({ alsoDirector: false }));
    const [titre, phrase, boutons] = /** @type {any} */ (Alert.alert).mock.calls.at(-1);
    expect(titre).toBe('Club créé !');
    expect(phrase).toContain('« Je dirige ce club »');
    expect(mockPartager).not.toHaveBeenCalled();
    expect(navigation.reset).toHaveBeenCalled();
    const inviter = boutons.find((bouton) => bouton.text === 'Inviter le dirigeant');
    expect(inviter).toBeDefined();
    await act(async () => { await inviter.onPress(); });
    expect(mockPartager).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('« Je dirige ce club »'),
      url: expect.stringMatching(/\/annuaire\/clubs\/club-neuf\/t20-club-karim\/$/),
    }));
  });

  it('« Plus tard » ne partage rien et ne retient pas le créateur dans le tunnel', async () => {
    const { arbre, navigation } = await monter();
    await choisir(arbre, 'Quelqu’un d’autre, je l’inviterai');
    await creer();
    const boutons = /** @type {any} */ (Alert.alert).mock.calls.at(-1)[2];
    expect(boutons).toEqual(expect.arrayContaining([expect.objectContaining({
      style: 'cancel', text: 'Plus tard',
    })]));
    expect(mockPartager).not.toHaveBeenCalled();
    expect(navigation.reset).toHaveBeenCalledWith({
      index: 0, routes: [{ name: 'Club', params: { clubId: 'club-neuf' } }],
    });
  });

  it('un partage refusé affiche une erreur, sans recréer le club', async () => {
    const { arbre } = await monter();
    await choisir(arbre, 'Quelqu’un d’autre, je l’inviterai');
    await creer();
    const boutons = /** @type {any} */ (Alert.alert).mock.calls.at(-1)[2];
    mockPartager.mockRejectedValueOnce(new Error('Partage indisponible'));
    await act(async () => {
      await boutons.find((bouton) => bouton.text === 'Inviter le dirigeant').onPress();
    });
    expect(Alert.alert).toHaveBeenLastCalledWith('Erreur', expect.any(String));
    expect(mockCreerClub).toHaveBeenCalledTimes(1);
    expect(mockEtape.at(-1).isNextDisabled).toBe(true);
  });

  it('un dirigeant qui crée : aucune question, rien ne change', async () => {
    mockRole = { type: 'dirigeant' };
    const { arbre } = await monter();
    expect(textes(arbre)).not.toContain('Qui dirige ce club ?');
    expect(mockEtape.at(-1).isNextDisabled).toBe(false);
  });
});
