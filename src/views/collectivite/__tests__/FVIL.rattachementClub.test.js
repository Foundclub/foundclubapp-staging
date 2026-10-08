/* eslint-disable max-len -- les phrases de l'écran sont citées en entier */
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import RattachementDuClub from '../components/RattachementDuClub';

// 🏛️ FINITIONS-VILLE (08/10/2026, tournée T20 lot 5) — le rattachement VU DU CLUB.
// Ce que ce témoin fige (ROUGE avant le lot) :
//   R1 — refuser la demande de la Ville ne dit plus « Elle ne pourra pas te la renvoyer » : la
//        Ville renvoie (« refus B », 07/10).

jest.setTimeout(30000);

/** @type {any} */
let mockDemandes;
/** @type {any} */
let mockMa;
const mockRepondre = {
  error: null, isPending: false, mutate: jest.fn(), variables: null,
};
const mockDemander = {
  error: null, isPending: false, mutate: jest.fn(), variables: null,
};
const mockPrevenir = {
  error: null, isPending: false, mutate: jest.fn(), variables: null,
};

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

jest.mock('@/services/collectivite/collectiviteRattachementQueries', () => ({
  useAnswerCollectiviteProposal: () => mockRepondre,
  useClubCollectiviteRequests: () => mockDemandes,
  useCollectivitesForClubSearch: () => ({ data: [], error: null, isLoading: false }),
  useMaCollectivite: () => mockMa,
  useNotifyMairie: () => mockPrevenir,
  useRequestClubAttach: () => mockDemander,
}));

/**
 * Aplati les enfants React en une chaine.
 * @param {any} enfants
 * @returns {string}
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

const monter = async (/** @type {any} */ element) => {
  /** @type {any} */
  let arbre;
  await act(async () => { arbre = renderer.create(element); });
  return arbre;
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ n) => aplatirTexte(n.props.children).trim());
const boutons = (/** @type {any} */ arbre, /** @type {string} */ titre) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.title === titre && typeof n.props?.onPress === 'function',
);

const MONTRIVAGE = { name: 'Ville de Montrivage', type: 'commune' };

beforeEach(() => {
  jest.clearAllMocks();
  mockDemandes = {
    data: [
      {
        canAnswer: true, collectivite: MONTRIVAGE, createdAt: '2026-10-08T12:00:00.000Z', documentId: 'p1', kind: 'proposal', offerIncluded: false, state: 'pending',
      },
    ],
    error: null,
    isLoading: false,
  };
  mockMa = { data: { attached: null, commune: null, lead: null }, error: null, isLoading: false };
});

describe('FVIL lot 5 · le rattachement vu du club', () => {
  it('R1 refuser la demande de la Ville : la phrase dit qu’elle pourra la renvoyer (« refus B »)', async () => {
    const arbre = await monter(<RattachementDuClub clubId="club-k" enabled />);
    await act(async () => { boutons(arbre, 'Refuser')[0].props.onPress(); });
    const lus = textes(arbre);
    expect(lus).toContain('Refuser la demande de la Ville de Montrivage ? Ton club ne sera pas rattaché ; elle pourra te la renvoyer plus tard.');
    expect(lus.some((texte) => texte.includes('ne pourra pas'))).toBe(false);
  });
});
