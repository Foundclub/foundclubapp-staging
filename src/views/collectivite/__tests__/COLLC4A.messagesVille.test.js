import { readFileSync } from 'fs';
import { join } from 'path';

import renderer, { act } from 'react-test-renderer';

import CanauxDeLaVille from '../components/CanauxDeLaVille';

// 📰 COLL-C4A (02/10) — PLANCHE 4 : l'onglet « Messages » de la Ville et le canal épinglé du
// membre (design HY521H1 page 3, « P3v2-messages-tel » écran 1 ; « P3c-canal-tel » écrans 3 et 7).
//
// Ce que ce témoin fige (ROUGE avant le lot : aucun canal de la Ville dans la messagerie) :
//   - dans l'espace de la Ville : RIEN au-dessus des conversations depuis R17-CANAUX (19/10) —
//     les cartes « Actualités de la Ville de … », « Dirigeants des clubs » et le bouton « Publier
//     une actualité » ont quitté « Messages » ;
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
// R17-CANAUX (19/10) : l'appel est COMPTÉ — c'est lui qui crée les canaux de la Ville au serveur.
const mockMesCanaux = jest.fn(() => ({ data: [] }));
jest.mock('@/services/collectivite/collectiviteCanauxQueries', () => ({
  useMesCanauxDeLaVille: () => mockMesCanaux(),
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

const monter = async (/** @type {any} */ element) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(element);
  });
  return arbre;
};
const navigation = { navigate: mockNavigate };

beforeEach(() => {
  mockMine = { data: { actualites: [SUBVENTIONS], collectivites: [VILLE] } };
  mockMesCollectivites = { data: [VILLE] };
  mockNavigate.mockReset();
  mockMesCanaux.mockClear();
});

describe('COLL-C4A — planche 4 : l onglet « Messages » de la Ville', () => {
  // 🏛️ R17-CANAUX (19/10, REC17-004) — RÉÉCRIT. Adel : « la messagerie ne doit être que sous
  // forme de message ». Avant : deux cartes (« Actualités de la Ville de … », « Dirigeants des
  // clubs ») et un gros bouton « Publier une actualité » AU-DESSUS des conversations. Après : rien
  // au-dessus — « Dirigeants des clubs » et « Toute la ville » sont des lignes de la liste, et
  // « Publier une actualité » reste à ses 4 autres places (R17CANAUX.publierAilleurs.test.js).
  it('R17-CANAUX : ni carte ni « Publier » au-dessus des conversations', async () => {
    const arbre = await monter(
      <CanauxDeLaVille collectiviteId="ville-de-recette" espaceVille navigation={navigation} />,
    );
    expect(arbre.toJSON()).toBeNull();
    // Les canaux de la Ville se créent au serveur à la première demande : elle part toujours.
    expect(mockMesCanaux).toHaveBeenCalled();
  });

  it('un compte qui ne gère plus cette Ville : rien', async () => {
    mockMesCollectivites = { data: [] };
    const arbre = await monter(
      <CanauxDeLaVille collectiviteId="ville-de-recette" espaceVille navigation={navigation} />,
    );
    expect(arbre.toJSON()).toBeNull();
  });
});

describe('COLL-C4A — planche 4 : la messagerie du membre', () => {
  // 🏛️ R17-CANAUX (19/10, REC17-004, correction 2 du chef, §1 ter) — RÉÉCRIT. Côté membre, le
  // bloc épinglé (« Dirigeants des clubs », « Actualités de la Ville », « Ton club ») doublait la
  // ligne « Toute la ville » : il est parti. Les canaux sont des LIGNES de la liste
  // (MessagingIPH09.liste.test.js) ; la demande « mes canaux » part toujours (création au serveur).
  it('R17-CANAUX : plus de bloc épinglé « Actualités de la Ville » au-dessus', async () => {
    const arbre = await monter(<CanauxDeLaVille navigation={navigation} />);
    expect(arbre.toJSON()).toBeNull();
    expect(mockMesCanaux).toHaveBeenCalled();
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
