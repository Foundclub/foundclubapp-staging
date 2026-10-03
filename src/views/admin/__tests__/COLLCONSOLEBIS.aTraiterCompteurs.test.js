import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import CollectivitesATraiter from '../components/CollectivitesATraiter';

// 🏛️ COLL-CONSOLE-BIS (03/10/2026), point 7 — LE COMPTEUR DE CHAQUE LIGNE « À TRAITER » (planche
// 13, défaut de la tournée T10 : « les 3 lignes n'ont aucun compteur »). COLL-FIX2 (9) a posé
// le « 0 » discret ; ce témoin fige la règle entière, ligne par ligne :
//   - un nombre quand quelque chose attend, « 0 » quand la file est lue et vide ;
//   - « — » quand la lecture a ÉCHOUÉ, jamais un faux 0 — ROUGE avant le lot pour la ligne
//     « Demandes de gestionnaire » : sa lecture en échec n'affichait RIEN.

/** @type {any} */
let mockInvitations;
/** @type {any} */
let mockGestionnaires;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
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
  useAdminCollectiviteInvitations: () => mockInvitations,
  useAdminManagerRequests: () => mockGestionnaires,
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
const monter = async (/** @type {number} */ aActiver) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <CollectivitesATraiter onShowToActivate={() => {}} toActivate={aActiver} />,
    );
  });
  return arbre;
};
const ligne = (/** @type {any} */ arbre, /** @type {string} */ testID) => arbre.root
  .findAll((/** @type {any} */ n) => n.props?.testID === testID)[0]
  .findAllByType(Text)
  .map((/** @type {any} */ n) => aplatirTexte(n.props.children).trim());

const LU = (/** @type {any[]} */ data) => ({
  data, error: null, isLoading: false, isSuccess: true,
});
const EN_ECHEC = {
  data: undefined, error: new Error('panne'), isLoading: false, isSuccess: false,
};

describe('COLL-CONSOLE-BIS — « À traiter » : chaque ligne dit son compteur', () => {
  it('rien n attend : « 0 » sur chaque ligne', async () => {
    mockInvitations = LU([]);
    mockGestionnaires = LU([]);
    const arbre = await monter(0);
    expect(ligne(arbre, 'gestionnaire-entree-file')).toEqual(['Demandes de gestionnaire', '0']);
    expect(ligne(arbre, 'a-traiter-rattachements')).toEqual(['Demandes de rattachement', '0']);
    expect(ligne(arbre, 'a-traiter-foundclub')).toEqual(['Clubs à inviter, par FoundClub', '0']);
  });

  it('des choses attendent : leur nombre', async () => {
    mockInvitations = LU([
      { kind: 'attach_request', status: 'pending' },
      { kind: 'foundclub', status: 'sent' },
      { kind: 'foundclub', status: 'registered' },
    ]);
    mockGestionnaires = LU([{ documentId: 'dm-1' }]);
    const arbre = await monter(2);
    expect(ligne(arbre, 'a-traiter-mairies')).toEqual(['Mairies à activer', '2']);
    expect(ligne(arbre, 'gestionnaire-entree-file')).toEqual(['Demandes de gestionnaire', '1']);
    expect(ligne(arbre, 'a-traiter-rattachements')).toEqual(['Demandes de rattachement', '1']);
    expect(ligne(arbre, 'a-traiter-foundclub')).toEqual(['Clubs à inviter, par FoundClub', '2']);
  });

  it('une lecture en échec : « — », jamais un faux 0, sur CHAQUE ligne', async () => {
    mockInvitations = EN_ECHEC;
    mockGestionnaires = EN_ECHEC;
    const arbre = await monter(0);
    expect(ligne(arbre, 'a-traiter-rattachements')).toEqual(['Demandes de rattachement', '—']);
    expect(ligne(arbre, 'a-traiter-foundclub')).toEqual(['Clubs à inviter, par FoundClub', '—']);
    expect(ligne(arbre, 'gestionnaire-entree-file')).toEqual(['Demandes de gestionnaire', '—']);
  });
});
