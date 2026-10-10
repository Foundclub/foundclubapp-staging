import { readFileSync } from 'fs';
import { join } from 'path';

import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import CanauxDeLaVille from '../components/CanauxDeLaVille';

// 📰 COLL-C4A (02/10) — PLANCHE 4 : l'onglet « Messages » de la Ville et le canal épinglé du
// membre (design HY521H1 page 3, « P3v2-messages-tel » écran 1 ; « P3c-canal-tel » écrans 3 et 7).
//
// Ce que ce témoin fige (ROUGE avant le lot : aucun canal de la Ville dans la messagerie) :
//   - dans l'espace de la Ville : « Actualités de la Ville de … », lu par les membres de n clubs
//     (« eux ne répondent pas »), qui mène à « Actualités de la Ville » ; « Publier une
//     actualité » ; puis « Conversations » ;
//   - dans la messagerie d'un membre (dirigeant, entraîneur, joueur, parent) : épinglé en tête,
//     pour chaque Ville de ses clubs, « Actualités de la Ville » et la dernière, vers le canal ;
//   - sans Ville : rien ; l'onglet « Messages » de la Ville dit qu'il vient de son espace.
// IPH09 — Ville et conversations dans le contenu defilant sont couvertes comportementalement
// par MessagingIPH09.liste.test.js ; aucun voisinage JSX fixe sous la recherche n est impose.

/** @type {any} */
let mockMine;
/** @type {any} */
let mockMesCollectivites;
const mockNavigate = jest.fn();

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

jest.mock('@/services/collectivite/collectiviteActualiteQueries', () => ({
  useMesActualitesDeLaVille: () => mockMine,
}));
// COLL-C4A2 (02/10) : la section porte aussi le canal des dirigeants (son propre témoin :
// COLLC4A2.canal.test.js). Ici, aucun canal : ce témoin reste celui des actualités.
jest.mock('@/services/collectivite/collectiviteCanauxQueries', () => ({
  useMesCanauxDeLaVille: () => ({ data: [] }),
}));
jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteClubs: () => ({
    data: [{ documentId: 'a' }, { documentId: 'b' }, { documentId: 'c' }],
  }),
  useMyCollectivites: () => mockMesCollectivites,
}));

const VILLE = { documentId: 'ville-de-recette', name: 'Ville de Montrivage' };
const SUBVENTIONS = {
  category: 'subventions',
  collectivite: VILLE,
  documentId: 'actu-subventions',
  publishedAt: '2026-09-21T08:00:00.000Z',
  title: 'Subventions 2027',
};

const aplatirTexte = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};
const monter = async (/** @type {any} */ element) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(element);
  });
  return arbre;
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ n) => aplatirTexte(n.props.children).trim());
const appuyer = async (/** @type {any} */ arbre, /** @type {string} */ testID) => {
  const noeud = arbre.root.findAll(
    (/** @type {any} */ n) => n.props?.testID === testID && typeof n.type !== 'string',
  )[0];
  await act(async () => {
    noeud.props.onPress();
  });
};
const navigation = { navigate: mockNavigate };

beforeEach(() => {
  mockMine = { data: { actualites: [SUBVENTIONS], collectivites: [VILLE] } };
  mockMesCollectivites = { data: [VILLE] };
  mockNavigate.mockReset();
});

describe('COLL-C4A — planche 4 : l onglet « Messages » de la Ville', () => {
  it('« Actualités de la Ville de … », lu par 3 clubs, vers ses actualités', async () => {
    const arbre = await monter(
      <CanauxDeLaVille collectiviteId="ville-de-recette" espaceVille navigation={navigation} />,
    );
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Actualités de la Ville de Montrivage',
      'Lu par les membres de 3 clubs · eux ne répondent pas',
      'Publier une actualité',
      'Conversations',
    ]));
    await appuyer(arbre, 'canal-actualites-mairie');
    expect(mockNavigate)
      .toHaveBeenCalledWith('CollectiviteActualites', { collectiviteId: 'ville-de-recette' });
    await appuyer(arbre, 'canaux-publier');
    expect(mockNavigate)
      .toHaveBeenCalledWith('CollectiviteActualiteForm', { collectiviteId: 'ville-de-recette' });
  });

  it('un compte qui ne gère plus cette Ville : rien', async () => {
    mockMesCollectivites = { data: [] };
    const arbre = await monter(
      <CanauxDeLaVille collectiviteId="ville-de-recette" espaceVille navigation={navigation} />,
    );
    expect(arbre.toJSON()).toBeNull();
  });
});

describe('COLL-C4A — planche 4 : le canal épinglé dans la messagerie du membre', () => {
  it('pour chaque Ville de ses clubs : « Actualités de la Ville » et la dernière', async () => {
    const arbre = await monter(<CanauxDeLaVille navigation={navigation} />);
    const lus = textes(arbre);
    expect(lus).toEqual(expect.arrayContaining(['Ville de Montrivage', 'Actualités de la Ville']));
    expect(lus.some((texte) => texte.endsWith('· Subventions 2027'))).toBe(true);
    await appuyer(arbre, 'canal-actualites-ville-de-recette');
    expect(mockNavigate)
      .toHaveBeenCalledWith('CollectiviteActualitesCanal', { collectiviteId: 'ville-de-recette' });
  });

  it('un club rattaché à aucune Ville : rien', async () => {
    mockMine = { data: { actualites: [], collectivites: [] } };
    expect((await monter(<CanauxDeLaVille navigation={navigation} />)).toJSON()).toBeNull();
  });

  it('l onglet Messages de la Ville conserve sa portee et son espace', () => {
    const dossierNavigation = join(__dirname, '..', '..', '..', 'navigation', 'private');
    const cheminOnglets = join(dossierNavigation, 'CollectiviteTabNavigator.js');
    const onglets = readFileSync(cheminOnglets, 'utf8');
    expect(onglets)
      .toContain("initialParams={{ chatScope: 'classic', collectiviteId, espace: 'ville' }}");
  });
});
