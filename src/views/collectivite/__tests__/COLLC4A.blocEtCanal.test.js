import { readFileSync } from 'fs';
import { join } from 'path';

import { Switch, Text, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import CollectiviteActualitesCanal from '../CollectiviteActualitesCanal';
import ActualiteCarte from '../components/ActualiteCarte';
import BlocDeLaVille from '../components/BlocDeLaVille';

// 📰 COLL-C4A (02/10) — PLANCHE 2 : le bloc « De la Ville de … » de la fiche du club, avec
// l'interrupteur D68, et le canal de la Ville côté membre (design HY521H1 page 3,
// « P3b-actu-tel » écrans 4 et 5 ; « P3v2-messages-tel » écran 3).
//
// Ce que ce témoin fige (ROUGE avant le lot : ni le bloc, ni le canal n'existaient) :
//   - le bloc : « De la Ville de Montrivage », la DERNIÈRE actualité, « Toutes les actualités
//     de la Ville » (le canal), et « Me prévenir des actualités de la Ville », DÉSACTIVÉ par
//     défaut ; l'activer envoie VRAI au serveur ; un dirigeant ou un entraîneur lit qu'il est
//     prévenu d'office, sans interrupteur ; un club rattaché à personne : aucun bloc ;
//   - le canal : les actualités de la plus RÉCENTE à la plus ancienne, l'écran ouvert EN HAUT
//     (COLL-R-A6, COL-006, décision d'Adel D5 = A du 12/10 17 h 53 : avant, l'ordre d'une
//     conversation, la plus récente en bas), « Lecture seule », AUCUNE zone de saisie ; une seule
//     Ville quand la notification la désigne ;
//   - la fiche du club pose le bloc pour SES membres.

/** @type {any} */
let mockBloc;
/** @type {any} */
let mockCanal;
/** @type {any} */
let mockParams;
const mockNavigate = jest.fn();
const mockSetOptions = jest.fn();
const mockActiver = jest.fn();
const mockMarquer = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, setOptions: mockSetOptions }),
  useRoute: () => ({ params: mockParams }),
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

jest.mock('@/services/collectivite/collectiviteActualiteQueries', () => ({
  useClubActualitesNotify: () => ({ isPending: false, mutate: mockActiver }),
  useClubCollectiviteActualites: () => mockBloc,
  useMarquerActualitesVues: () => ({ mutate: mockMarquer }),
  useMesActualitesDeLaVille: () => mockCanal,
}));
jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });

const VILLE = { documentId: 'ville-de-recette', name: 'Ville de Montrivage' };
const AUTRE_VILLE = { documentId: 'autre-ville', name: 'Ville de Valfleuri' };
const SUBVENTIONS = {
  attachments: [],
  audience: 'membres',
  body: 'Dossiers à déposer avant le 15 novembre.',
  category: 'subventions',
  collectivite: VILLE,
  documentId: 'actu-subventions',
  publishedAt: '2026-09-21T08:00:00.000Z',
  title: 'Subventions aux associations sportives 2027',
};
const FERMETURE = {
  ...SUBVENTIONS,
  body: 'Du samedi 17 au dimanche 25 octobre.',
  category: 'fermeture',
  documentId: 'actu-fermeture',
  publishedAt: '2026-09-29T08:00:00.000Z',
  title: 'Dojo municipal fermé pendant les vacances',
};
const AILLEURS = {
  ...SUBVENTIONS,
  collectivite: AUTRE_VILLE,
  documentId: 'actu-ailleurs',
  publishedAt: '2026-09-30T08:00:00.000Z',
  title: 'Forum de Valfleuri',
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
const parTestID = (/** @type {any} */ arbre, /** @type {string} */ testID) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.testID === testID && typeof n.type !== 'string',
)[0];

beforeEach(() => {
  mockParams = {};
  mockBloc = {
    data: { actualites: [FERMETURE, SUBVENTIONS], collectivite: VILLE, notify: false },
    isLoading: false,
  };
  mockCanal = {
    data: { actualites: [AILLEURS, FERMETURE, SUBVENTIONS], collectivites: [VILLE, AUTRE_VILLE] },
    error: null,
    isLoading: false,
    refetch: jest.fn(),
  };
  [mockNavigate, mockSetOptions, mockActiver, mockMarquer].forEach((fn) => fn.mockReset());
});

describe('COLL-C4A — planche 2 : le bloc « De la Ville » de la fiche du club', () => {
  it('« De la Ville de … », la DERNIÈRE actualité, et le chemin vers le canal', async () => {
    const ouvrir = jest.fn();
    const arbre = await monter(<BlocDeLaVille clubId="as-montrivage" onOuvrirCanal={ouvrir} />);
    const lus = textes(arbre);
    expect(lus).toEqual(expect.arrayContaining([
      'De la Ville de Montrivage',
      'Fermeture',
      'Dojo municipal fermé pendant les vacances',
      'Toutes les actualités de la Ville',
    ]));
    expect(lus).not.toContain('Subventions aux associations sportives 2027');
    await act(async () => {
      parTestID(arbre, 'bloc-de-la-ville-toutes').props.onPress();
    });
    expect(ouvrir).toHaveBeenCalledWith('ville-de-recette');
  });

  it('D68 : « Me prévenir » est DÉSACTIVÉ par défaut ; l activer envoie VRAI', async () => {
    const arbre = await monter(<BlocDeLaVille clubId="as-montrivage" />);
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Me prévenir des actualités de la Ville',
      'Désactivé par défaut. Tu peux l’activer quand tu veux.',
    ]));
    const interrupteur = arbre.root.findByType(Switch);
    expect(interrupteur.props.value).toBe(false);
    expect(interrupteur.props.accessibilityLabel).toBe('Me prévenir des actualités de la Ville');
    await act(async () => {
      interrupteur.props.onValueChange(true);
    });
    expect(mockActiver).toHaveBeenCalledWith(true);
  });

  it('activé côté serveur : l interrupteur le montre', async () => {
    mockBloc = { data: { ...mockBloc.data, notify: true }, isLoading: false };
    const arbre = await monter(<BlocDeLaVille clubId="as-montrivage" />);
    expect(arbre.root.findByType(Switch).props.value).toBe(true);
  });

  it('dirigeant ou entraîneur : prévenu d office, sans interrupteur', async () => {
    const arbre = await monter(<BlocDeLaVille clubId="as-montrivage" encadrant />);
    expect(arbre.root.findAllByType(Switch)).toHaveLength(0);
    expect(textes(arbre)).toContain(
      'Tu es prévenu de chaque actualité : dirigeants et entraîneurs le sont toujours.',
    );
  });

  it('un club rattaché à personne, ou pas encore lu : aucun bloc', async () => {
    mockBloc = { data: { actualites: [], collectivite: null, notify: false }, isLoading: false };
    expect((await monter(<BlocDeLaVille clubId="club-d" />)).toJSON()).toBeNull();
    mockBloc = { data: undefined, isLoading: true };
    expect((await monter(<BlocDeLaVille clubId="club-d" />)).toJSON()).toBeNull();
  });

  it('aucune actualité encore : une phrase, et l interrupteur reste là', async () => {
    mockBloc = { data: { actualites: [], collectivite: VILLE, notify: false }, isLoading: false };
    const arbre = await monter(<BlocDeLaVille clubId="as-montrivage" />);
    expect(textes(arbre)).toContain('Aucune actualité de la Ville pour l’instant.');
    expect(arbre.root.findAllByType(Switch)).toHaveLength(1);
  });

  it('la fiche du club pose le bloc pour SES membres', () => {
    const source = readFileSync(join(__dirname, '..', '..', 'club', 'ClubDetails.js'), 'utf8');
    expect(source)
      .toContain("import BlocDeLaVille from '@/views/collectivite/components/BlocDeLaVille';");
    // VILLE-T18D 6 (« parent prévenu B ») : la porte passe par un juge, membre OU parent d'un
    // joueur mineur du club (src/views/club/__tests__/VILLE-T18D.blocDeLaVilleDuParent.test.js).
    expect(source).toMatch(/\{afficheLeBlocDeLaVille \? \(\s*<BlocDeLaVille/);
    expect(source).toMatch(/navigation\.navigate\(\s*RouteNames\.CollectiviteActualitesCanal/);
  });
});

describe('COLL-C4A — planche 2 : le canal de la Ville, côté membre', () => {
  // COLL-R-A6 (13/10, COL-006, D5 = A d'Adel le 12/10 17 h 53) : la plus récente EN HAUT, comme la
  // liste de la mairie et le bloc « De la Ville » (avant : de la plus ancienne à la plus récente).
  it('de la plus récente à la plus ancienne, « Lecture seule », sans zone de saisie', async () => {
    const arbre = await monter(<CollectiviteActualitesCanal />);
    const titres = arbre.root.findAllByType(ActualiteCarte)
      .map((/** @type {any} */ n) => n.props.actualite.title);
    expect(titres).toEqual([
      'Forum de Valfleuri',
      'Dojo municipal fermé pendant les vacances',
      'Subventions aux associations sportives 2027',
    ]);
    expect(textes(arbre)).toContain('Lecture seule');
    expect(arbre.root.findAllByType(TextInput)).toHaveLength(0);
  });

  it('l’écran s’ouvre EN HAUT : rien ne le fait descendre tout seul (COL-006)', async () => {
    const arbre = await monter(<CollectiviteActualitesCanal />);
    const [defilement] = arbre.root.findAll(
      (/** @type {any} */ n) => typeof n.type !== 'string' && Boolean(n.props?.refreshControl),
    );
    expect(defilement).toBeDefined();
    // Avant : chaque changement de taille (une image qui finit de charger) l'envoyait en bas.
    expect(defilement.props.onContentSizeChange).toBeUndefined();
  });

  it('la notification désigne UNE Ville : ses actualités seules, et son nom en titre', async () => {
    mockParams = { collectiviteId: 'ville-de-recette' };
    const arbre = await monter(<CollectiviteActualitesCanal />);
    const lus = textes(arbre);
    expect(lus).not.toContain('Forum de Valfleuri');
    expect(lus).toContain(
      'Les actualités de la Ville de Montrivage, pour les clubs rattachés. Seule la Ville y écrit.',
    );
    expect(mockSetOptions).toHaveBeenCalledWith({ headerTitle: 'Ville de Montrivage' });
  });

  // COLL-C4A planche 3 : ouvrir le canal, c'est ouvrir l'actualité — le bandeau de l'accueil part.
  it('ouvrir le canal fait partir le bandeau de l accueil (s il y en a un)', async () => {
    mockParams = { collectiviteId: 'ville-de-recette' };
    mockCanal = { data: { ...mockCanal.data, bandeau: { actualite: FERMETURE, autres: 0 } } };
    await monter(<CollectiviteActualitesCanal />);
    expect(mockMarquer).toHaveBeenCalledWith(['ville-de-recette']);
    mockMarquer.mockReset();
    mockCanal = { data: { ...mockCanal.data, bandeau: null } };
    await monter(<CollectiviteActualitesCanal />);
    expect(mockMarquer).not.toHaveBeenCalled();
  });

  it('aucune actualité : une phrase calme', async () => {
    mockCanal = { data: { actualites: [], collectivites: [VILLE] }, isLoading: false };
    expect(textes(await monter(<CollectiviteActualitesCanal />)))
      .toContain('Aucune actualité de la Ville pour l’instant.');
  });
});

// CORR-COLLECTIVITES 99 (31/10/2026, décision d'Adel A) — le lien vers une actualité RETIRÉE (d'une
// notification, d'une ligne du fil) ouvrait le canal sans rien dire. Si l'actualité visée n'y est plus,
// le canal le dit en tête : « Cette actualité a été retirée par la Ville. »
describe('CORR-COLLECTIVITES 99 — une actualité retirée se dit', () => {
  it('l’actualité visée n’est plus là : « Cette actualité a été retirée par la Ville. »', async () => {
    mockParams = { actualiteId: 'actu-retiree' };
    expect(textes(await monter(<CollectiviteActualitesCanal />))).toContain('Cette actualité a été retirée par la Ville.');
  });

  it('l’actualité visée est là, ou aucun lien : rien de plus', async () => {
    const [premiere] = mockCanal.data.actualites;
    mockParams = { actualiteId: premiere.documentId };
    expect(textes(await monter(<CollectiviteActualitesCanal />))).not.toContain('Cette actualité a été retirée par la Ville.');
    mockParams = {};
    expect(textes(await monter(<CollectiviteActualitesCanal />))).not.toContain('Cette actualité a été retirée par la Ville.');
  });
});
