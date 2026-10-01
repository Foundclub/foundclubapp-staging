import { readFileSync } from 'fs';
import { join } from 'path';

import { StyleSheet, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import CollectiviteHome from '../CollectiviteHome';

// 🏛️ COLLECTIVITES 1c — ECRAN 2 : l accueil « Ma collectivite » (SPEC §2 A).
//
// Ce que ce temoin fige (ROUGE avant l ecran 2 : l accueil n avait que son en-tete) :
//   - trois cartes : demandes EN ATTENTE, installations, clubs rattaches, chacune avec son
//     NOMBRE, lu dans la meme lecture que son ecran ;
//   - une pastille sur les demandes quand il y en a en attente, aucune sinon ;
//   - une lecture en echec affiche « — », jamais un 0 invente (un 0 dirait « rien a faire »).
// Pilote par le TEXTE VISIBLE ; `t` resout dans le VRAI fr.js, interpolation comprise.

/** @type {any} */
let mockRequetes;
/** @type {any} */
let mockInstallations;
/** @type {any} */
let mockClubs;
const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => {},
  useNavigation: () => ({ navigate: mockNavigate }),
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

jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteClubs: () => mockClubs,
  useCollectiviteInstallations: () => mockInstallations,
  useCollectiviteRequests: () => mockRequetes,
  useMyCollectivites: () => ({
    data: [{ documentId: 'ville-de-recette', name: 'Ville de Recette', type: 'commune' }],
    isLoading: false,
  }),
}));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });

const lu = (/** @type {any[]} */ data) => ({
  data, error: null, isLoading: false, refetch: jest.fn(),
});

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

const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<CollectiviteHome />);
  });
  return arbre;
};

/**
 * Les textes d une carte (repere par son testID).
 * @param {any} arbre
 * @param {string} cle
 * @returns {string[]}
 */
const textesDeLaCarte = (arbre, cle) => arbre.root
  .findAll((/** @type {any} */ n) => n.props?.testID === `collectivite-home-${cle}`)[0]
  .findAllByType(Text)
  .map((/** @type {any} */ n) => aplatirTexte(n.props.children).trim());

// Les vues NATIVES seulement : findAll rend aussi le composant qui les enveloppe.
const pastille = (/** @type {any} */ arbre) => arbre.root
  .findAll((/** @type {any} */ n) => typeof n.type === 'string'
    && n.props?.testID === 'collectivite-home-requests-badge');

beforeEach(() => {
  mockNavigate.mockClear();
  mockRequetes = lu([{ documentId: 'd1' }, { documentId: 'd2' }]);
  mockInstallations = lu([{ documentId: 'gymnase' }]);
  mockClubs = lu([{ documentId: 'aiki' }, { documentId: 'testfc' }]);
});

// TEXTES-COLLECTIVITES (point 8 du chef, 01/10) : la pastille des demandes etait en
// `error500` avec un texte blanc — contraste 3,7:1, sous le seuil d accessibilite. Celle de la
// cloche est en `error700` (5,2:1). Le jeton est RELU dans la source de la cloche : si elle
// change, la pastille de la mairie suit, ou ce temoin le dit.
// eslint-disable-next-line max-len
describe('TEXTES-COLLECTIVITES — la pastille des demandes a la couleur de celle de la cloche', () => {
  it('même jeton que la pastille de la cloche (error700)', async () => {
    const cloche = readFileSync(
      // eslint-disable-next-line max-len
      join(__dirname, '..', '..', '..', 'components', 'molecules', 'notificationBadge', 'NotificationBadge.js'),
      'utf8',
    );
    const jeton = (cloche.match(/styles\.badge,\s*\{\s*backgroundColor: Colors\.(\w+)/) || [])[1];
    expect(jeton).toBe('error700');
    const couleurs = jest.requireActual('@/theme/colors').default();
    const arbre = await monter();
    const [vue] = pastille(arbre);
    expect(StyleSheet.flatten(vue.props.style).backgroundColor).toBe(couleurs[jeton]);
  });
});

describe('COLLECTIVITES 1c — écran 2 : l accueil « Ma collectivité »', () => {
  it('montre le nom de la collectivité', async () => {
    const arbre = await monter();
    const textes = arbre.root.findAllByType(Text)
      .map((/** @type {any} */ n) => aplatirTexte(n.props.children));
    expect(textes).toContain('Ville de Recette');
  });

  it('trois cartes, chacune avec son NOMBRE', async () => {
    const arbre = await monter();
    expect(textesDeLaCarte(arbre, 'requests'))
      .toEqual(expect.arrayContaining(['Demandes en attente', '2']));
    expect(textesDeLaCarte(arbre, 'installations'))
      .toEqual(expect.arrayContaining(['Installations', '1']));
    expect(textesDeLaCarte(arbre, 'clubs'))
      .toEqual(expect.arrayContaining(['Clubs rattachés', '2']));
  });

  it('une PASTILLE sur les demandes quand il y en a en attente', async () => {
    const arbre = await monter();
    expect(pastille(arbre)).toHaveLength(1);
  });

  it('aucune pastille quand rien n attend', async () => {
    mockRequetes = lu([]);
    const arbre = await monter();
    expect(pastille(arbre)).toHaveLength(0);
    expect(textesDeLaCarte(arbre, 'requests')).toContain('0');
  });

  it('la carte des demandes ouvre « Demandes de la Ville » de CETTE collectivité', async () => {
    const arbre = await monter();
    const carte = arbre.root.findAll((/** @type {any} */ n) => n.props?.testID
      === 'collectivite-home-requests'
      && typeof n.props?.onPress === 'function')[0];
    await act(async () => { carte.props.onPress(); });
    expect(mockNavigate)
      .toHaveBeenCalledWith('CollectiviteRequests', { collectiviteId: 'ville-de-recette' });
  });

  it('la carte des installations ouvre « Installations de la Ville »', async () => {
    const arbre = await monter();
    const carte = arbre.root.findAll((/** @type {any} */ n) => n.props?.testID
      === 'collectivite-home-installations' && typeof n.props?.onPress === 'function')[0];
    await act(async () => { carte.props.onPress(); });
    expect(mockNavigate)
      .toHaveBeenCalledWith('CollectiviteInstallations', { collectiviteId: 'ville-de-recette' });
  });

  it('la carte des clubs ouvre « Clubs rattachés »', async () => {
    const arbre = await monter();
    const carte = arbre.root.findAll((/** @type {any} */ n) => n.props?.testID
      === 'collectivite-home-clubs' && typeof n.props?.onPress === 'function')[0];
    await act(async () => { carte.props.onPress(); });
    expect(mockNavigate)
      .toHaveBeenCalledWith('CollectiviteClubs', { collectiviteId: 'ville-de-recette' });
  });

  it('une lecture en ÉCHEC affiche « — », jamais un 0 inventé', async () => {
    mockClubs = {
      data: undefined, error: new Error('403'), isLoading: false, refetch: jest.fn(),
    };
    const arbre = await monter();
    expect(textesDeLaCarte(arbre, 'clubs')).toContain('—');
    expect(textesDeLaCarte(arbre, 'clubs')).not.toContain('0');
  });
});
