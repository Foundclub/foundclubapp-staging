import { readFileSync } from 'fs';
import { join } from 'path';

import { Platform, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import CollectivitePorteRow from '../components/CollectivitePorteRow';

// 🏛️ COLL-ACCUEIL (01/10/2026) — PLANCHE 3 : le COMPTE MIXTE (`P1-mixte-tel`).
// Un dirigeant qui gère aussi la Ville garde son accueil de club ; une seule rangée-porte,
// discrète, EN TÊTE, avec le nombre de demandes ; elle ouvre l'espace de la Ville avec
// « ‹ son club » pour revenir. Rien pour un compte qui ne gère aucune Ville.
// ROUGE avant le lot : la rangée n'existait pas.

/** @type {any} */
let mockMine;
/** @type {any} */
let mockRequetes;
const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
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

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { club: { documentId: 'club-as', name: 'AS Montrivage' } } }),
}));

jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteRequests: () => mockRequetes,
  useMyCollectivites: () => mockMine,
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

const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<CollectivitePorteRow />);
  });
  return arbre;
};

const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ n) => aplatirTexte(n.props.children).trim());

beforeEach(() => {
  mockNavigate.mockClear();
  mockMine = { data: [{ documentId: 'ville-montrivage', name: 'Ville de Montrivage' }] };
  mockRequetes = { data: [{ documentId: 'rq-1' }, { documentId: 'rq-2' }] };
});

describe('COLL-ACCUEIL — planche 3 : le compte mixte et sa rangée-porte', () => {
  it('la rangée dit la Ville et le nombre de demandes, avec la pastille', async () => {
    const arbre = await monter();
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Ville de Montrivage',
      'Ma collectivité · 2 demandes',
      '2',
    ]));
  });

  it('elle ouvre l espace de la Ville, avec « ‹ AS Montrivage » pour revenir', async () => {
    const arbre = await monter();
    const [porte] = arbre.root.findAll((/** @type {any} */ n) => n.props?.testID
      === 'collectivite-porte' && typeof n.props?.onPress === 'function');
    await act(async () => { porte.props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith('CollectiviteSpace', {
      collectiviteId: 'ville-montrivage',
      returnLabel: 'AS Montrivage',
    });
  });

  it('aucune demande : la rangée reste, sans pastille', async () => {
    mockRequetes = { data: [] };
    const arbre = await monter();
    expect(textes(arbre)).toContain('Ma collectivité');
    expect(arbre.root.findAll((/** @type {any} */ n) => typeof n.type === 'string'
      && n.props?.testID === 'collectivite-porte-compteur')).toHaveLength(0);
  });

  it('un compte qui ne gère aucune Ville ne voit RIEN', async () => {
    mockMine = { data: [] };
    const arbre = await monter();
    expect(arbre.toJSON()).toBeNull();
  });

  it('sur le site, la porte ouvre l accueil de la Ville (menu latéral = espace)', async () => {
    const avant = Platform.OS;
    Platform.OS = 'web';
    try {
      const arbre = await monter();
      const [porte] = arbre.root.findAll((/** @type {any} */ n) => n.props?.testID
        === 'collectivite-porte' && typeof n.props?.onPress === 'function');
      await act(async () => { porte.props.onPress(); });
      expect(mockNavigate)
        .toHaveBeenCalledWith('CollectiviteHome', { collectiviteId: 'ville-montrivage' });
    } finally {
      Platform.OS = avant;
    }
  });

  it('l accueil du club la porte EN TÊTE, avant tout le reste', () => {
    const source = readFileSync(join(__dirname, '..', '..', 'home', 'HomeHub.js'), 'utf8');
    const defilement = source.indexOf('<ScrollView\n        bounces={false}');
    const porte = source.indexOf('<CollectivitePorteRow />');
    const banniere = source.indexOf('<PlayerModeBanner');
    expect(defilement).toBeGreaterThan(-1);
    expect(porte).toBeGreaterThan(defilement);
    expect(porte).toBeLessThan(banniere);
  });
});
