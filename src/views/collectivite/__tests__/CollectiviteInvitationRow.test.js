import { readFileSync } from 'fs';
import { join } from 'path';

import { Platform, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import CollectiviteInvitationRow from '../components/CollectiviteInvitationRow';

// 🏛️ CORR-INVITATION-VILLE (31/10/2026) — FIN DU POINT 10 de la recette du site (décision A, et
// l'ajout d'Adel : « Mais le B doit etre possible aussi »). Un dirigeant sans compte touche
// « Inscrire mon club » sur l'invitation de la Ville, crée son compte et arrive sur l'accueil
// sans club. B : une carte sur l'accueil, « La Ville t'a invité : inscris ton club », qui rouvre
// l'invitation. Et sur le SITE, le retour au lien après la connexion (useLiensEnAttente ne vit que
// dans la navigation du téléphone) : l'accueil rouvre la page du lien, une fois.
// ROUGE avant le lot : le composant n'existait pas.

const mockRangement = new Map();
jest.mock('@/platform/storage', () => ({
  getItem: (/** @type {string} */ cle) => mockRangement.get(cle),
  removeItem: (/** @type {string} */ cle) => { mockRangement.delete(cle); },
  setItem: (/** @type {string} */ cle, /** @type {string} */ valeur) => {
    mockRangement.set(cle, valeur);
  },
}));

/** @type {any} */
let mockUserData;
const mockNavigate = jest.fn();

jest.mock('react-i18next', () => {
  const catalogue = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
        const valeur = String(cle || '')
          .split('.')
          .reduce((noeud, segment) => (noeud == null ? undefined : noeud[segment]), catalogue);
        if (typeof valeur === 'string') return valeur;
        return typeof repli === 'string' ? repli : cle;
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
  default: () => ({ userData: mockUserData }),
}));

const lien = jest.requireActual('@/domains/collectivite/lienDeLaVille');

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
    arbre = renderer.create(<CollectiviteInvitationRow navigation={{ navigate: mockNavigate }} />);
  });
  return arbre;
};

const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ n) => aplatirTexte(n.props.children).trim());

/**
 * Lance une épreuve sous une plateforme donnée, puis la remet.
 * @param {string} os - La plateforme.
 * @param {() => Promise<void>} epreuve - L'épreuve.
 * @returns {Promise<void>}
 */
const sous = async (os, epreuve) => {
  const avant = Platform.OS;
  Platform.OS = /** @type {any} */ (os);
  try {
    await epreuve();
  } finally {
    Platform.OS = avant;
  }
};

beforeEach(() => {
  mockRangement.clear();
  mockNavigate.mockClear();
  mockUserData = { documentId: 'u-1', club: null };
});

describe('CORR-INVITATION-VILLE B — la carte de l’accueil', () => {
  it('lien de la Ville retenu, pas de club : la carte dit « La Ville t’a invité : inscris ton club »', async () => {
    lien.retenirLienDeLaVille('jeton-ville');
    const arbre = await monter();
    expect(textes(arbre)).toContain('La Ville t’a invité : inscris ton club');
    expect(arbre.root.findAllByProps({ testID: 'collectivite-invitation' }).length).toBeGreaterThan(0);
  });

  it('la carte rouvre la page de l’invitation, avec son lien', async () => {
    lien.retenirLienDeLaVille('jeton-ville');
    const arbre = await monter();
    const carte = arbre.root.findAllByProps({ testID: 'collectivite-invitation' })
      .find((/** @type {any} */ n) => typeof n.props.onPress === 'function');
    await act(async () => { carte.props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith('CollectiviteJoin', { token: 'jeton-ville' });
  });

  it('sans lien retenu : rien', async () => {
    const arbre = await monter();
    expect(arbre.toJSON()).toBeNull();
  });

  it('lien de plus de 48 h : rien', async () => {
    lien.retenirLienDeLaVille('jeton-ville', Date.now() - lien.DUREE_DU_LIEN_RETENU_MS - 1000);
    const arbre = await monter();
    expect(arbre.toJSON()).toBeNull();
  });

  it('le compte a déjà son club : rien (la création du club a envoyé le lien)', async () => {
    lien.retenirLienDeLaVille('jeton-ville');
    mockUserData = { documentId: 'u-1', club: { documentId: 'club-as', name: 'AS Montrivage' } };
    const arbre = await monter();
    expect(arbre.toJSON()).toBeNull();
  });
});

describe('CORR-INVITATION-VILLE — le retour au lien sur le site', () => {
  it('site, repère de retour posé avant la connexion : l’accueil rouvre la page du lien', async () => {
    await sous('web', async () => {
      lien.retenirLeRetourAuLien('jeton-retour');
      await monter();
      expect(mockNavigate).toHaveBeenCalledWith('CollectiviteJoin', { token: 'jeton-retour' });
    });
  });

  it('site, compte qui a déjà son club : le retour a lieu quand même (comme au téléphone)', async () => {
    await sous('web', async () => {
      mockUserData = { documentId: 'u-1', club: { documentId: 'club-as', name: 'AS Montrivage' } };
      lien.retenirLeRetourAuLien('jeton-retour');
      await monter();
      expect(mockNavigate).toHaveBeenCalledWith('CollectiviteJoin', { token: 'jeton-retour' });
    });
  });

  it('site, sans repère : aucune navigation', async () => {
    await sous('web', async () => {
      lien.retenirLienDeLaVille('jeton-ville');
      await monter();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  it('téléphone : le retour reste à useLiensEnAttente (pas de double navigation)', async () => {
    await sous('android', async () => {
      lien.retenirLeRetourAuLien('jeton-retour');
      await monter();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});

describe('CORR-INVITATION-VILLE — la place sur l’accueil', () => {
  it('la carte est dans le défilement, juste sous la porte de la Ville', () => {
    const source = readFileSync(join(__dirname, '..', '..', 'home', 'HomeHub.js'), 'utf8');
    const porte = source.indexOf('<CollectivitePorteRow />');
    const carte = source.indexOf('<CollectiviteInvitationRow navigation={navigation} />');
    const banniere = source.indexOf('<PlayerModeBanner');
    expect(porte).toBeGreaterThan(-1);
    expect(carte).toBeGreaterThan(porte);
    expect(carte).toBeLessThan(banniere);
  });
});
