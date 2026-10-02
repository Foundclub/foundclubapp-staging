import { readFileSync } from 'fs';
import { join } from 'path';

import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { bandeauMairie } from '@/domains/collectivite/collectiviteActualites';

import {
  BandeauActualiteMairie,
  BandeauActualiteMembre,
} from '../components/BandeauActualiteVille';

// 📰 COLL-C4A (02/10) — PLANCHE 3 : le bandeau « Actualité de la Ville » sur l'accueil des cinq
// rôles (design HY521H1 page 3, « P3b-bandeau-tel » ; relecture d'Adel du 01/10).
//
// Ce que ce témoin fige (ROUGE avant le lot : aucun bandeau) :
//   - membre (dirigeant, entraîneur, joueur, parent) : le bandeau que le SERVEUR choisit, « et
//     1 autre », une fermeture en couleur d'attention avec « Fermeture · Ville de … » ; tout le
//     bandeau est un lien (libellé complet) qui ouvre le canal de la Ville ET le fait partir ; la
//     croix (libellé, 44 px) le fait partir ; sans actualité en attente : rien ;
//   - mairie : « Votre actualité · en ligne », pour les n clubs ; il mène à « Actualités de la
//     Ville » ; la croix le masque jusqu'à la suivante ; au-delà de 7 jours : rien ;
//   - il est posé EN TÊTE de l'accueil des clubs (HomeHub) et sous le titre de l'accueil de la
//     Ville (CollectiviteHome).

/** @type {any} */
let mockMine;
/** @type {any} */
let mockListe;
const mockMarquer = jest.fn();
/** @type {Map<string, string>} */
const mockStockage = new Map();

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
  useCollectiviteActualites: () => mockListe,
  useMarquerActualitesVues: () => ({ mutate: mockMarquer }),
  useMesActualitesDeLaVille: () => mockMine,
}));
jest.mock('@/platform/storage', () => ({
  getItem: (/** @type {string} */ cle) => mockStockage.get(cle) || null,
  setItem: (/** @type {string} */ cle, /** @type {string} */ valeur) => {
    mockStockage.set(cle, valeur);
  },
}));

const VILLE = { documentId: 'ville-de-recette', name: 'Ville de Montrivage' };
const ilYA = (/** @type {number} */ jours) => new Date(Date.now() - jours * 86400000).toISOString();
const SUBVENTIONS = {
  audience: 'membres',
  category: 'subventions',
  collectivite: VILLE,
  documentId: 'actu-subventions',
  publishedAt: ilYA(0),
  recipients: { clubsCount: 3 },
  title: 'Subventions aux associations sportives 2027',
};
const FERMETURE = {
  ...SUBVENTIONS,
  category: 'fermeture',
  documentId: 'actu-fermeture',
  title: 'Dojo municipal fermé pendant les vacances',
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
const appuyer = async (/** @type {any} */ arbre, /** @type {string} */ testID) => {
  await act(async () => {
    parTestID(arbre, testID).props.onPress();
  });
};

beforeEach(() => {
  mockMine = {
    data: { actualites: [SUBVENTIONS], bandeau: { actualite: SUBVENTIONS, autres: 0 } },
  };
  mockListe = { data: [SUBVENTIONS] };
  mockMarquer.mockReset();
  mockStockage.clear();
});

describe('COLL-C4A — planche 3 : le bandeau du membre', () => {
  it('« Actualité de la Ville », titre, Ville, jour ; un lien au libellé complet', async () => {
    const ouvrir = jest.fn();
    const arbre = await monter(<BandeauActualiteMembre onOuvrir={ouvrir} />);
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'ACTUALITÉ DE LA VILLE',
      'Subventions aux associations sportives 2027',
      'Ville de Montrivage · aujourd’hui',
    ]));
    expect(parTestID(arbre, 'bandeau-actualite-ville-ouvrir').props.accessibilityLabel).toBe(
      'Actualité de la Ville de Montrivage : Subventions aux associations sportives 2027. Ouvrir',
    );
    await appuyer(arbre, 'bandeau-actualite-ville-ouvrir');
    expect(ouvrir).toHaveBeenCalledWith('ville-de-recette');
    expect(mockMarquer).toHaveBeenCalledWith(['ville-de-recette']);
  });

  it('un seul bandeau : « et 1 autre » ; la croix le fait partir', async () => {
    mockMine = { data: { bandeau: { actualite: SUBVENTIONS, autres: 1 } } };
    const arbre = await monter(<BandeauActualiteMembre onOuvrir={jest.fn()} />);
    expect(textes(arbre)).toContain('aujourd’hui · et 1 autre');
    const croix = parTestID(arbre, 'bandeau-actualite-ville-masquer');
    expect(croix.props.accessibilityLabel).toBe('Masquer ces actualités');
    await appuyer(arbre, 'bandeau-actualite-ville-masquer');
    expect(mockMarquer).toHaveBeenCalledWith(['ville-de-recette']);
  });

  it('une fermeture : « Fermeture · Ville de … »', async () => {
    mockMine = { data: { bandeau: { actualite: FERMETURE, autres: 0 } } };
    const arbre = await monter(<BandeauActualiteMembre onOuvrir={jest.fn()} />);
    expect(textes(arbre)).toContain('FERMETURE · VILLE DE MONTRIVAGE');
  });

  it('rien en attente : aucun bandeau', async () => {
    mockMine = { data: { actualites: [SUBVENTIONS], bandeau: null } };
    expect((await monter(<BandeauActualiteMembre onOuvrir={jest.fn()} />)).toJSON()).toBeNull();
    mockMine = { data: undefined, isLoading: true };
    expect((await monter(<BandeauActualiteMembre onOuvrir={jest.fn()} />)).toJSON()).toBeNull();
  });
});

describe('COLL-C4A — planche 3 : le bandeau de la mairie', () => {
  const mairie = (/** @type {any} */ ouvrir) => (
    <BandeauActualiteMairie
      collectiviteId="ville-de-recette"
      nomVille="Ville de Montrivage"
      onOuvrir={ouvrir}
      userId="agent"
    />
  );

  it('« Votre actualité · en ligne », pour les 3 clubs ; vers ses actualités', async () => {
    const ouvrir = jest.fn();
    const arbre = await monter(mairie(ouvrir));
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'VOTRE ACTUALITÉ · EN LIGNE',
      'Subventions aux associations sportives 2027',
      'Depuis aujourd’hui, pour les 3 clubs',
    ]));
    await appuyer(arbre, 'bandeau-actualite-mairie-ouvrir');
    expect(ouvrir).toHaveBeenCalled();
  });

  it('la croix le masque, et il ne revient qu avec une NOUVELLE actualité', async () => {
    const arbre = await monter(mairie(jest.fn()));
    await appuyer(arbre, 'bandeau-actualite-mairie-masquer');
    expect(arbre.toJSON()).toBeNull();
    expect((await monter(mairie(jest.fn()))).toJSON()).toBeNull();
    mockListe = { data: [{ ...FERMETURE, documentId: 'actu-nouvelle' }, SUBVENTIONS] };
    expect((await monter(mairie(jest.fn()))).toJSON()).not.toBeNull();
  });

  it('au-delà de 7 jours, il s efface seul', () => {
    expect(bandeauMairie([{ ...SUBVENTIONS, publishedAt: ilYA(8) }], null)).toBeNull();
    expect(bandeauMairie([{ ...SUBVENTIONS, publishedAt: ilYA(6) }], null)?.documentId)
      .toBe('actu-subventions');
    expect(bandeauMairie([], null)).toBeNull();
  });
});

describe('COLL-C4A — planche 3 : où il est posé', () => {
  it('en TÊTE de l accueil des clubs (les 4 rôles du club passent par HomeHub)', () => {
    const source = readFileSync(join(__dirname, '..', '..', 'home', 'HomeHub.js'), 'utf8');
    const debutDuDefilement = source.indexOf('ref={scrollRef}');
    const bandeau = source.indexOf('<BandeauActualiteMembre', debutDuDefilement);
    const porte = source.indexOf('<CollectivitePorteRow', debutDuDefilement);
    expect(bandeau).toBeGreaterThan(debutDuDefilement);
    expect(bandeau).toBeLessThan(porte);
  });

  it('sous le titre de l accueil de la Ville', () => {
    const source = readFileSync(join(__dirname, '..', 'CollectiviteHome.js'), 'utf8');
    expect(source).toMatch(/\{hautDePage\}\s*\{bandeauActualite\}/);
  });
});
