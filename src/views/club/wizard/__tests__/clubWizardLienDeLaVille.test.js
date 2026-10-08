/* eslint-disable max-len -- les réponses du serveur et les routes sont citées en entier */
import { createElement } from 'react';
import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ClubWizardRecap from '../ClubWizardRecap';

// 🏛️ COLL-ACCUEIL-BIS (03/10/2026) — PLANCHE 38 (P7v3-inviter, écran 5), LE RETOUR AUTOMATIQUE, à
// la fin de la création du club. Ce que ce fichier exige (ROUGE avant le lot) :
//   1. un lien de la Ville retenu (moins de 48 h) part AVEC la création du club
//      (`collectiviteInvitationToken`) : c'est le serveur qui pose la demande de rattachement ;
//   2. la réponse le dit (`collectiviteInvitation`) : après « OK », « Demande envoyée » s'ouvre
//      (CollectiviteJoinRequest avec son `resultat`), et le tunnel laisse la fiche du club dessous ;
//   3. le lien est OUBLIÉ après la création (un second club ne repart pas vers la même Ville) ;
//   4. un lien de plus de 48 h, ou aucun : rien n'est envoyé, l'atterrissage est celui d'avant ;
//   5. pendant la PREMIÈRE inscription (`entry: 'onboarding'`), le tunnel d'accueil continue : le
//      lien part quand même, mais l'écran suivant reste celui de l'onboarding.

const mockProprietesEtape = [];
/** @type {any} */
let mockReponse;
const mockCreerClub = jest.fn(async () => mockReponse);
const mockClientRequete = { invalidateQueries: jest.fn(), setQueriesData: jest.fn() };
const mockEtatTunnel = Object.freeze({
  activityDocumentIds: [],
  addressOption: { label: '12 rue du Stade, Montrivage', lat: 45.75, lng: 4.85 },
  email: 'contact@club.test',
  name: 'Club de Montrivage',
  phoneNumber: '0400000000',
});
const mockAuthentification = Object.freeze({
  getNextOnboardingRoute: () => 'UserAffiliationGuideSuite',
  getPostOnboardingHomeRoute: () => 'HomeTab',
  refetchUserData: jest.fn(),
  userData: { documentId: 'user-1' },
});
const mockRangement = new Map();

jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => mockClientRequete }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (/** @type {string} */ cle, /** @type {string} */ repli) => repli || cle }),
}));
jest.mock('@/domains/auth/useAuth', () => ({ __esModule: true, default: () => mockAuthentification }));
jest.mock('@/domains/auth/authUseCases', () => ({
  attachCreatedClubToProfile: jest.requireActual('@/domains/auth/authUseCases').attachCreatedClubToProfile,
  markOnboardingComplete: jest.fn(),
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
jest.mock('@/platform/storage', () => ({
  getItem: (/** @type {string} */ cle) => mockRangement.get(cle),
  removeItem: (/** @type {string} */ cle) => { mockRangement.delete(cle); },
  setItem: (/** @type {string} */ cle, /** @type {string} */ valeur) => {
    mockRangement.set(cle, valeur);
  },
}));
// ⛔ Jamais `requireActual` sur un service : le client HTTP refuse de se charger sans `API_URL`.
jest.mock('@/services/club/clubService', () => ({
  createSelfOnboardClub: (/** @type {any} */ ...arguments_) => mockCreerClub(...arguments_),
}));
jest.mock('@/services/activity/activityQueries', () => ({ useGetActivities: () => ({ data: [] }) }));
jest.mock('../ClubWizardContext', () => ({
  useClubWizard: () => ({ dispatch: jest.fn(), state: mockEtatTunnel }),
}));
jest.mock('@/components/molecules/wizardOptionCard/WizardOptionCard', () => function CarteMock() {
  return null;
});
jest.mock(
  '@/components/molecules/wizardStepLayout/WizardStepLayout',
  () => function EtapeMock(/** @type {any} */ props) {
    mockProprietesEtape.push(props);
    return null;
  },
);

const LIEN = 'CodeDeLaVille0123456789ab';
const HEURE = 60 * 60 * 1000;

const navigationDuTunnel = () => {
  const parent = { navigate: jest.fn() };
  return {
    getParent: () => parent, goBack: jest.fn(), navigate: jest.fn(), parent, reset: jest.fn(),
  };
};

const creerLeClub = async (/** @type {any} */ navigation, entry = 'search') => {
  mockProprietesEtape.length = 0;
  await act(async () => {
    renderer.create(createElement(ClubWizardRecap, { navigation, route: { params: { entry } } }));
  });
  await act(async () => { mockProprietesEtape[mockProprietesEtape.length - 1].onNext(); });
  // FINITIONS-VILLE (08/10) : « OK » ne commande plus la suite (elle part seule) ; l'alerte informe.
  expect(/** @type {any} */ (Alert.alert).mock.calls.at(-1)?.[0]).toBe('Club créé !');
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockRangement.clear();
  mockReponse = { club: { documentId: 'club-neuf' }, collectiviteInvitation: null, duplicate: false };
});

describe('COLL-ACCUEIL-BIS — planche 38 : la création du club emporte le lien de la Ville', () => {
  it('un lien retenu part AVEC la création ; « Demande envoyée » s ouvre ; le lien est oublié', async () => {
    mockRangement.set('coll-invitation-ville', JSON.stringify({ at: Date.now() - HEURE, token: LIEN }));
    mockReponse = {
      club: { documentId: 'club-neuf' },
      collectiviteInvitation: { collectiviteName: 'Ville de Montrivage', outsideCommune: false, status: 'registered' },
      duplicate: false,
    };
    const navigation = navigationDuTunnel();
    await creerLeClub(navigation);

    expect(mockCreerClub).toHaveBeenCalledWith(expect.objectContaining({ collectiviteInvitationToken: LIEN }));
    expect(navigation.parent.navigate).toHaveBeenCalledWith('CollectiviteJoinRequest', {
      resultat: {
        clubId: 'club-neuf', collectiviteName: 'Ville de Montrivage', outsideCommune: false, status: 'registered',
      },
      token: LIEN,
    });
    // Le tunnel quitte sa pile : la fiche du club reste dessous (« Retour » y mène).
    expect(navigation.reset).toHaveBeenCalledWith({
      index: 0, routes: [{ name: 'Club', params: { clubId: 'club-neuf' } }],
    });
    expect(mockRangement.has('coll-invitation-ville')).toBe(false);
  });

  it('un lien de plus de 48 h : rien n est envoyé, l atterrissage est celui d avant (la fiche du club)', async () => {
    mockRangement.set('coll-invitation-ville', JSON.stringify({ at: Date.now() - 49 * HEURE, token: LIEN }));
    const navigation = navigationDuTunnel();
    await creerLeClub(navigation);
    expect(mockCreerClub.mock.calls[0][0].collectiviteInvitationToken).toBeUndefined();
    expect(navigation.parent.navigate).not.toHaveBeenCalled();
    expect(navigation.reset).toHaveBeenCalledWith({
      index: 0, routes: [{ name: 'Club', params: { clubId: 'club-neuf' } }],
    });
  });

  it('aucun lien : rien n est envoyé', async () => {
    const navigation = navigationDuTunnel();
    await creerLeClub(navigation);
    expect(mockCreerClub.mock.calls[0][0].collectiviteInvitationToken).toBeUndefined();
    expect(navigation.parent.navigate).not.toHaveBeenCalled();
  });

  it('première inscription : le lien part, mais le tunnel d accueil continue (écran suivant de l onboarding)', async () => {
    mockRangement.set('coll-invitation-ville', JSON.stringify({ at: Date.now(), token: LIEN }));
    mockReponse = {
      club: { documentId: 'club-neuf' },
      collectiviteInvitation: { collectiviteName: 'Ville de Montrivage', outsideCommune: false, status: 'registered' },
      duplicate: false,
    };
    const navigation = navigationDuTunnel();
    await creerLeClub(navigation, 'onboarding');
    expect(mockCreerClub).toHaveBeenCalledWith(expect.objectContaining({ collectiviteInvitationToken: LIEN }));
    expect(navigation.parent.navigate).toHaveBeenCalledWith('UserAffiliationGuideSuite', { clubId: 'club-neuf' });
    expect(navigation.parent.navigate).not.toHaveBeenCalledWith('CollectiviteJoinRequest', expect.anything());
    expect(mockRangement.has('coll-invitation-ville')).toBe(false);
  });
});

// 🏟️ FINITIONS-VILLE (08/10/2026, tournées T19-bis et T20 P09) — après le 201, le récapitulatif
// restait affiché 12 à 20 s, « Créer mon club » RALLUMÉ : la suite n'était lancée qu'au « OK » de
// l'alerte (sur le site, un `window.confirm`), et le bouton se rallumait dès la réponse — un
// second appui créait un second club. Désormais : l'écran part sans attendre « OK », et le bouton
// reste éteint dès l'envoi. ROUGE avant le lot.
describe('FINITIONS-VILLE — le club créé, l’assistant part tout seul et ne recrée rien', () => {
  it('le bouton reste éteint après le 201 ; l’écran suivant s’ouvre sans « OK »', async () => {
    let finDuProfil = () => {};
    mockAuthentification.refetchUserData.mockImplementation(() => new Promise((resoudre) => {
      finDuProfil = () => resoudre(undefined);
    }));
    const navigation = navigationDuTunnel();
    mockProprietesEtape.length = 0;
    await act(async () => {
      renderer.create(createElement(ClubWizardRecap, { navigation, route: { params: { entry: 'search' } } }));
    });
    await act(async () => { mockProprietesEtape.at(-1).onNext(); });
    expect(mockCreerClub).toHaveBeenCalledTimes(1);
    // Le profil se relit encore : l'écran est là, mais « Créer mon club » ne se rallume pas.
    expect(mockProprietesEtape.at(-1).isNextDisabled).toBe(true);
    expect(navigation.reset).not.toHaveBeenCalled();
    await act(async () => { finDuProfil(); });
    // Sans toucher « OK » : la fiche du club s'ouvre.
    expect(navigation.reset).toHaveBeenCalledWith({
      index: 0, routes: [{ name: 'Club', params: { clubId: 'club-neuf' } }],
    });
    mockAuthentification.refetchUserData.mockReset();
  });
});
