import renderer, { act } from 'react-test-renderer';

import { clePremierPas } from '@/domains/collectivite/collectiviteAccueil';

import CollectiviteClubs from '../CollectiviteClubs';

// FINITIONS18 · POINT 10 (tournee T16) — « Vos premiers pas » : 3 sur 4 sur le SITE, 4 sur 4 au
// TELEPHONE, meme Ville, meme compte. La regle est la meme (`premiersPas`) ; ce qui differe est
// l'ENTREE de l'etape 2 « Verifiez vos clubs » : retenue sur l'appareil, et cochee SEULEMENT par
// le bouton de l'accueil. Le telephone avait ouvert la liste par ce bouton ; le site par son
// menu « Clubs » (ou jamais par l'accueil). Ouvrir la liste des clubs, par N'IMPORTE quelle
// entree, coche l'etape — avec la meme cle que l'accueil. ROUGE avant.

const mockSetItem = jest.fn();
jest.mock('@/platform/storage', () => ({
  getItem: () => null,
  setItem: (...args) => mockSetItem(...args),
}));
jest.mock('@/store/appContext', () => ({
  storage: { getBoolean: () => false, getString: () => undefined, set: jest.fn() },
  useAppContext: () => [{ auth: { user: { documentId: 'agent-ville' } } }, jest.fn()],
}));

/** @type {any} */
let mockClubs;

jest.mock('@react-navigation/native', () => ({
  // COLL-CLUBS (01/10) : toute la carte ouvre la fiche du club (temoin COLLCLUBS.liste).
  useNavigation: () => ({ navigate: jest.fn() }),
  useRoute: () => ({ params: { collectiviteId: 'ville-de-recette' } }),
}));

jest.mock('react-i18next', () => {
  const catalogue = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ options) => {
        const valeur = String(cle || '')
          .split('.')
          .reduce((noeud, segment) => (noeud == null ? undefined : noeud[segment]), catalogue);
        let texte = cle;
        if (typeof valeur === 'string') texte = valeur;
        else if (typeof repli === 'string') texte = repli;
        return texte.replace(/\{\{(\w+)\}\}/g, (_tout, nom) => String(options?.[nom] ?? ''));
      },
    }),
  };
});

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

// VILLE-INVITER-CLUB (07/10) : les demandes de rattachement vivent dans un module a part ;
// `data` absent = un serveur d'avant le lot : l'ecran garde « Invitations » comme avant.
// FINITIONS-VILLE (08/10) : « Refuser » une demande de rattachement ouvre la fenêtre des créneaux
// (DecisionCreneauModal), qui lit ces deux crochets ; sans doublure, le client réseau se charge.
jest.mock('@/services/facility/facilityQueries', () => ({
  useApproveFacilityOverrideRequest: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useRefuseFacilityOverrideRequest: () => ({ isPending: false, mutateAsync: jest.fn() }),
}));

jest.mock('@/services/collectivite/collectiviteRattachementQueries', () => ({
  useAnswerCollectiviteAttachRequest: () => ({ isPending: false, mutate: jest.fn() }),
  useCancelCollectiviteProposal: () => ({ isPending: false, mutate: jest.fn() }),
  useCollectiviteClubRequests: () => ({ data: undefined, error: null, isLoading: false }),
  useCollectiviteClubSearch: () => ({ data: [], error: null, isLoading: false }),
  useProposeCollectiviteClub: () => ({ isPending: false, mutate: jest.fn() }),
  useRemindCollectiviteProposal: () => ({ isPending: false, mutate: jest.fn() }),
}));

jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteClubs: () => mockClubs,
  // COLL-CLUBS (01/10) : les invitations en cours, sous la liste (temoin COLLCLUBS.inviter).
  useCollectiviteInvitations: () => ({ data: [] }),
  useMyCollectivites: () => ({
    data: [{ documentId: 'ville-de-recette', name: 'Ville de Recette' }],
    isLoading: false,
  }),
  useRemindCollectiviteInvitation: () => ({ mutate: jest.fn() }),
}));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });
jest.mock(
  '@/components/molecules/clubLogoMark/ClubLogoMark',
  () => function ClubLogoMarkMock() { return null; },
);

beforeEach(() => {
  mockClubs = {
    data: [], error: null, isLoading: false, refetch: jest.fn(),
  };
  mockSetItem.mockClear();
});

// eslint-disable-next-line max-len -- une phrase entiere
test('FIN18-10 ouvrir la liste des clubs (menu du site compris) coche « Verifiez vos clubs », cle de l accueil', async () => {
  let arbre;
  await act(async () => {
    arbre = renderer.create(<CollectiviteClubs />);
  });
  const cle = clePremierPas('clubs-vus', 'agent-ville', 'ville-de-recette');
  expect(mockSetItem).toHaveBeenCalledWith(cle, '1');
  expect(cle).toBe('coll-accueil:clubs-vus:agent-ville:ville-de-recette');
  act(() => { arbre.unmount(); });
});
