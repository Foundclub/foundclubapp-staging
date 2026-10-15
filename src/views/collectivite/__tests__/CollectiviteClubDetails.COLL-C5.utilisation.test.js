import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import CollectiviteClubDetails from '../CollectiviteClubDetails';

// 📐 COLL-C5 (03/10/2026), point 4 — PLANCHE 37 : « Utilisation » sur la fiche d'un club, côté
// mairie (design HY521H1 page 7, « P7v2-fiche-tel » et « P7v2-fiche-ordi »). Contrat des
// nombres : admin/docs/CONTRAT_CHIFFRES_VILLE.md §6.
//
// Ce que ce témoin fige (ROUGE avant : le bloc disait « plus tard » et ne lisait rien) :
//   1. la lecture des chiffres de la Ville sur la SAISON, la ligne de CE club ;
//   2. « 8 h réservées cette saison », « 80 % séances tenues », « 0 annulées », et la phrase
//      de la planche ; plus d'étiquette « plus tard » ;
//   3. une séance touchée par une fermeture se dit à part : ce n'est pas le club qui l'a annulée ;
//   4. un club sans séance : « 0 h », « — » (aucune séance passée : pas de pourcentage), « 0 » ;
//   5. la lecture en cours : « … » ; en panne : « — » et une phrase, la fiche reste lisible.

const i18nextTemoin = require('i18next');

const frTemoin = require('@/theme/strings/translations/fr');

(i18nextTemoin.default || i18nextTemoin).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'fr',
  lng: 'fr',
  resources: { fr: { translation: frTemoin.default } },
});

/** @type {any} */
let mockChiffres;
const mockLectures = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
  useRoute: () => ({ params: { clubId: 'as-montrivage', collectiviteId: 'ville-de-recette' } }),
}));

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

jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteClubs: () => ({ data: [], isLoading: false, isError: false }),
  useSetClubPlanningColor: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useCollectiviteChiffres: (/** @type {any} */ collectiviteId, /** @type {any} */ periode) => {
    mockLectures(collectiviteId, periode);
    return mockChiffres;
  },
  useCollectiviteClub: () => ({
    data: {
      documentId: 'as-montrivage',
      leaders: [],
      name: 'AS Montrivage',
      offer: { kind: 'collectivite', since: null },
      requests: {
        accepted: 0, pending: [], pendingCount: 0, refused: 0,
      },
      seasonSlots: [],
      sponsors: [],
      teams: [],
      teamsCount: 0,
    },
    error: null,
    isLoading: false,
    refetch: jest.fn(),
  }),
  useCollectiviteInstallations: () => ({ data: [] }),
  useMyCollectivites: () => ({
    data: [{ documentId: 'ville-de-recette', name: 'Ville de Montrivage' }],
    isLoading: false,
  }),
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
jest.mock(
  '@/components/atoms/sponsorLogoTile/SponsorLogoTile',
  () => function SponsorLogoTileMock() { return null; },
);
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function BottomModalMock() {
  return null;
});
jest.mock(
  '@/components/organisms/seasonSlot/SeasonSlotForm',
  () => function SeasonSlotFormMock() { return null; },
);
jest.mock(
  '@/views/collectivite/components/EcrireAuxDirigeants',
  () => function EcrireAuxDirigeantsMock() { return null; },
);

// La saison du banc serveur (admin tests/authz/_coll-c5-banc.js, temoin D7) : AS Montrivage a
// 480 min, 4 tenues, 0 annulee, 1 touchee par une fermeture, 1 a venir.
const SAISON = {
  clubs: [
    {
      annulees: 0,
      aVenir: 1,
      documentId: 'as-montrivage',
      enAttente: 1,
      fermeture: 1,
      minutes: 480,
      name: 'AS Montrivage',
      rattache: true,
      seances: 5,
      tenues: 4,
    },
  ],
  periode: 'saison',
};

/**
 * Aplati les enfants React en une chaîne.
 * @param {any} enfants
 * @returns {string}
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

const textesDuBloc = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<CollectiviteClubDetails />);
  });
  const bloc = arbre.root.findAll(
    (/** @type {any} */ n) => n.props?.testID === 'fiche-club-utilisation',
  )[0];
  return bloc.findAllByType(Text)
    .map((/** @type {any} */ n) => aplatirTexte(n.props.children).trim());
};

beforeEach(() => {
  mockLectures.mockClear();
  mockChiffres = { data: SAISON, error: null, isLoading: false };
});

describe('COLL-C5 — planche 37 : « Utilisation » sur la fiche d’un club', () => {
  it('la saison de CE club : heures réservées, % de séances tenues, annulées', async () => {
    const lus = await textesDuBloc();
    expect(mockLectures).toHaveBeenCalledWith('ville-de-recette', 'saison');
    expect(lus).toEqual([
      'Utilisation',
      '8 h',
      'réservées cette saison',
      '80 %',
      'séances tenues',
      '0',
      'annulée',
      '1 séance touchée par une fermeture de la Ville : elle n’est pas comptée comme annulée.',
      'De quoi répondre au conseil municipal : qui utilise vraiment quoi.',
    ]);
  });

  it('un club sans séance : 0 h, pas de pourcentage, 0 annulée', async () => {
    mockChiffres = { data: { clubs: [], periode: 'saison' }, error: null, isLoading: false };
    const lus = await textesDuBloc();
    expect(lus.slice(1, 7)).toEqual([
      '0 h', 'réservées cette saison', '—', 'séances tenues', '0', 'annulée',
    ]);
    expect(lus.join(' | ')).not.toMatch(/fermeture/);
  });

  it('en lecture : « … » ; en panne : « — » et une phrase, la fiche reste lisible', async () => {
    mockChiffres = { data: undefined, error: null, isLoading: true };
    expect((await textesDuBloc()).slice(1, 7)).toEqual([
      '…', 'réservées cette saison', '…', 'séances tenues', '…', 'annulées',
    ]);
    mockChiffres = { data: undefined, error: { message: 'Panne' }, isLoading: false };
    const lus = await textesDuBloc();
    expect(lus.slice(1, 7)).toEqual([
      '—', 'réservées cette saison', '—', 'séances tenues', '—', 'annulées',
    ]);
    expect(lus).toContain('Les chiffres de la saison n’ont pas pu être lus.');
  });
});
