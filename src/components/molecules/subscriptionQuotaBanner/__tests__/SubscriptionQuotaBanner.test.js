import { TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import SubscriptionQuotaBanner from '../SubscriptionQuotaBanner';

// Regle E6 : ce composant n'avait AUCUN test alors qu'il alimente 3 assistants
// (creer un evenement, creer une equipe, publier une annonce). Le filet est
// pose ici AVANT la correction R09, et il decrit ce qui doit rester vrai :
//
//   * un compte GRATUIT voit son compteur — c'est le TEMOIN POSITIF, sans lui
//     un composant qui ne rendrait plus jamais rien passerait pour corrige ;
//   * un compte qui a PAYE ne voit rien, qu'il s'agisse de l'offre Equipe ou
//     de l'offre Club, CLUB_UNVERIFIED COMPRIS.
//
// Ce dernier point est la correction R09 : depuis la decision produit du
// 2026-07-17 (admin/src/api/subscription/services/subscription-permission.ts
// :751-756), un entitlement CLUB actif ouvre tout, club certifie ou pas.
// Afficher « il te reste 1 publication gratuite » a ce client, c'est lui
// revendre ce qu'il paye deja.

jest.setTimeout(30000);

const mockUseAuth = jest.fn();
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockUseAuth(),
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('@/theme/themeContext', () => {
  /**
   * Echelle de style tolerante : n'importe quelle cle rend un objet vide.
   * @returns {any}
   */
  const anyScale = () => new Proxy({}, {
    get: (/** @type {any} */ _target, /** @type {any} */ key) => (
      typeof key === 'symbol' ? undefined : anyScale()
    ),
  });

  return {
    __esModule: true,
    default: () => ({
      Alignments: anyScale(),
      ApplicationStyle: anyScale(),
      // Colors reste un objet PLAT : le composant interpole ses valeurs dans des
      // chaines (`${Colors.warning500}1F`), ce qu'un Proxy ne supporte pas.
      Colors: {
        neutral100: 'neutre-100',
        primary500: 'couleur-primaire',
        success500: 'couleur-succes',
        warning500: 'couleur-alerte',
      },
      Fonts: anyScale(),
      // Objet PLAT lui aussi : le bandeau « deja couvert » lit `Images.shield`.
      Images: { shield: 'icone-bouclier' },
      Spaces: anyScale(),
    }),
  };
});

const PRESIDENT = { documentId: 'u-1', role: { name: 'Dirigeant' } };
const JOUEUR = { documentId: 'u-2', role: { name: 'Joueur' } };

/**
 * Compteur gratuit d'evenements tel que le bootstrap le renvoie.
 * @param {{ limit: number; used: number }} quota
 * @returns {any[]}
 */
const eventUsage = ({ limit, used }) => [{
  limit, quotaType: 'EVENT_PUBLISH', remaining: Math.max(0, limit - used), used,
}];

/** @type {any} */
let mountedTree = null;

/**
 * Tous les textes d'un arbre rendu, aplatis.
 * @param {any} node
 * @returns {string[]}
 */
const collectText = (node) => {
  if (node === null || node === undefined) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(collectText);
  return collectText(node.children);
};

/**
 * Monte le bandeau pour un etat d'abonnement donne et rend son texte visible.
 * On ne rend JAMAIS l'arbre lui-meme : les styles moques sont des Proxy, que
 * le formateur d'echec de jest n'arrive pas a serialiser — un rouge legitime
 * devenait alors illisible. Une chaine vide dit la meme chose et s'affiche.
 * @param {any} auth
 * @param {{ resumeRouteName?: string; resumeRouteParams?: Record<string, any> }} [origine]
 *   - L40 : ou le bandeau doit dire de ramener la personne apres l'achat.
 * @returns {Promise<string>}
 */
const renderTextFor = async (auth, origine = {}) => {
  mockUseAuth.mockReturnValue({
    freeUsageSummary: eventUsage({ limit: 1, used: 0 }),
    subscriptionAccessLevel: 'FREE',
    userData: PRESIDENT,
    ...auth,
  });
  await act(async () => {
    mountedTree = renderer.create(
      <SubscriptionQuotaBanner
        label="Événements"
        quotaType="EVENT_PUBLISH"
        resumeRouteName={origine.resumeRouteName}
        resumeRouteParams={origine.resumeRouteParams}
      />,
    );
  });

  return collectText(mountedTree.toJSON()).join(' | ');
};

afterEach(async () => {
  if (mountedTree) {
    const tree = mountedTree;
    await act(async () => {
      tree.unmount();
    });
    mountedTree = null;
  }
  jest.clearAllMocks();
});

describe('SubscriptionQuotaBanner — on ne revend jamais du gratuit a un client', () => {
  test('TEMOIN POSITIF : un compte gratuit voit bien son compteur', async () => {
    const visibleText = await renderTextFor({ subscriptionAccessLevel: 'FREE' });

    expect(visibleText).toContain('il te reste 1 publication gratuite');
  });

  test('TEMOIN POSITIF : un compte gratuit a court de quota voit le bandeau d alerte', async () => {
    const visibleText = await renderTextFor({
      freeUsageSummary: eventUsage({ limit: 1, used: 1 }),
      subscriptionAccessLevel: 'FREE',
    });

    expect(visibleText).toContain('quota gratuit épuisé');
    expect(visibleText).toContain("Débloquer l'offre Équipe");
  });

  test('R09 : un abonne Club dont le club n est pas certifie ne voit RIEN', async () => {
    const visibleText = await renderTextFor({ subscriptionAccessLevel: 'CLUB_UNVERIFIED' });

    expect(visibleText).toBe('');
  });

  test('R09 : le meme abonne, quota epuise, ne voit pas non plus d argument de vente', async () => {
    const visibleText = await renderTextFor({
      freeUsageSummary: eventUsage({ limit: 1, used: 1 }),
      subscriptionAccessLevel: 'CLUB_UNVERIFIED',
    });

    expect(visibleText).toBe('');
  });

  test.each(['CLUB', 'TEAM'])('un abonne %s ne voit rien non plus', async (accessLevel) => {
    expect(await renderTextFor({ subscriptionAccessLevel: accessLevel })).toBe('');
  });

  test('un joueur ne voit jamais ce bandeau, meme en offre gratuite', async () => {
    expect(await renderTextFor({ subscriptionAccessLevel: 'FREE', userData: JOUEUR })).toBe('');
  });

  test('tant que le niveau d abonnement est inconnu, aucun argument de vente', async () => {
    expect(await renderTextFor({ subscriptionAccessLevel: undefined })).toBe('');
  });

  // L33 — le bandeau parle d'un COMPTEUR : son bouton doit ouvrir le carrousel
  // d'offres, jamais le hub. Depuis la refonte en trois ecrans, le hub ne porte
  // plus aucun catalogue : y renvoyer quelqu'un a court de quota, c'est lui
  // fermer le seul chemin pour payer.
  test('L33 : « Débloquer » mene au CARROUSEL, la seule surface qui vend', async () => {
    await renderTextFor({
      freeUsageSummary: eventUsage({ limit: 1, used: 1 }),
      subscriptionAccessLevel: 'FREE',
    });

    const bouton = mountedTree.root.findAllByType(TouchableOpacity)[0];
    await act(async () => {
      bouton.props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('ProfileStack', { screen: 'SubscriptionOffers' });
  });

  // L40 — le bandeau est affiche EN ENTREE d'assistant. Qui part de la, achete,
  // puis atterrit sur l'accueil doit retrouver tout seul ou il en etait. Le
  // bandeau est la seule piece qui sache d'ou part la personne : il le dit au
  // catalogue, qui le transportera jusqu'a l'ecran de succes.
  test('L40 : le bandeau dit au catalogue OU ramener la personne', async () => {
    await renderTextFor(
      { freeUsageSummary: eventUsage({ limit: 1, used: 1 }), subscriptionAccessLevel: 'FREE' },
      { resumeRouteName: 'EventStack', resumeRouteParams: { screen: 'EventWizardType' } },
    );

    await act(async () => {
      mountedTree.root.findAllByType(TouchableOpacity)[0].props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('ProfileStack', {
      params: {
        resumeRouteName: 'EventStack',
        resumeRouteParams: { screen: 'EventWizardType' },
      },
      screen: 'SubscriptionOffers',
    });
  });

  test('TEMOIN L40 : sans origine, le bandeau n invente aucun retour', async () => {
    await renderTextFor({
      freeUsageSummary: eventUsage({ limit: 1, used: 1 }),
      subscriptionAccessLevel: 'FREE',
    });

    await act(async () => {
      mountedTree.root.findAllByType(TouchableOpacity)[0].props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('ProfileStack', { screen: 'SubscriptionOffers' });
  });
});

// D59 ⑤ — LE BANDEAU « DEJA COUVERT » (pack `pw-screens.jsx`, variante
// `covered`). C'est un message qui parle d'ARGENT : mal declenche, il annonce
// la gratuite a quelqu'un qui devra payer. Les temoins negatifs ci-dessous
// comptent donc autant que les positifs — ils bornent exactement les cas ou il
// a le droit d'apparaitre.

/**
 * Un entitlement paye par quelqu'un d'autre que moi.
 * @param {{ firstname?: string; lastname?: string; scopeType?: string }} [payeur]
 * @returns {any[]}
 */
const couvertPar = ({ firstname = 'Karim', lastname = 'Diallo', scopeType = 'TEAM' } = {}) => [{
  paidBy: { documentId: 'u-payeur', firstname, lastname },
  scopeType,
}];

describe('SubscriptionQuotaBanner — « deja couvert » (D59 ⑤)', () => {
  test('quand un tiers NOMME paie, le bandeau le dit et le nomme', async () => {
    const texte = await renderTextFor({
      entitlementsSummary: couvertPar(),
      // Quelqu'un paie pour moi : le juge unique m'a deja passe en TEAM, donc
      // aucun compteur gratuit ne s'affichait plus — le composant se taisait.
      freeUsageSummary: eventUsage({ limit: 1, used: 0 }),
      subscriptionAccessLevel: 'TEAM',
      subscriptionSummary: { activePlanCodes: [] },
    });

    expect(texte).toContain("Déjà couvert — tu n'as rien à payer");
    expect(texte).toContain('Karim D. paie l\'offre Équipe pour cette équipe.');
  });

  test('une couverture CLUB parle du club, pas de l equipe', async () => {
    const texte = await renderTextFor({
      entitlementsSummary: couvertPar({
        firstname: 'Nadia', lastname: 'Benali', scopeType: 'CLUB',
      }),
      subscriptionAccessLevel: 'CLUB',
      subscriptionSummary: { activePlanCodes: [] },
    });

    expect(texte).toContain('Nadia B. paie l\'offre Club pour tout le club.');
  });

  test('⛔ LE PAYEUR lui-meme ne voit PAS ce bandeau — il paie, justement', async () => {
    const texte = await renderTextFor({
      entitlementsSummary: [{
        paidBy: { documentId: 'u-1', firstname: 'Moi', lastname: 'Meme' },
        scopeType: 'TEAM',
      }],
      subscriptionAccessLevel: 'TEAM',
      subscriptionSummary: { activePlanCodes: ['fc_team_2_monthly'] },
      userData: PRESIDENT,
    });

    expect(texte).not.toContain('Déjà couvert');
  });

  test('⛔ un compte GRATUIT ne le voit JAMAIS, meme si un entitlement traine', async () => {
    const texte = await renderTextFor({
      entitlementsSummary: couvertPar(),
      freeUsageSummary: eventUsage({ limit: 1, used: 0 }),
      // Le juge unique dit « gratuit » : c'est lui qui tranche, pas la presence
      // d'un entitlement. Annoncer la gratuite ici serait un mensonge d'argent.
      subscriptionAccessLevel: 'FREE',
      subscriptionSummary: { activePlanCodes: [] },
    });

    expect(texte).not.toContain('Déjà couvert');
    expect(texte).toContain('il te reste 1 publication gratuite');
  });

  test('⛔ sans NOM de payeur, aucun bandeau : on ne sait pas expliquer', async () => {
    const texte = await renderTextFor({
      entitlementsSummary: [{ paidBy: { documentId: 'u-payeur' }, scopeType: 'TEAM' }],
      subscriptionAccessLevel: 'TEAM',
      subscriptionSummary: { activePlanCodes: [] },
    });

    expect(texte).not.toContain('Déjà couvert');
  });

  test('⛔ tant que le niveau d abonnement est inconnu, il se tait', async () => {
    const texte = await renderTextFor({
      entitlementsSummary: couvertPar(),
      subscriptionAccessLevel: null,
      subscriptionSummary: { activePlanCodes: [] },
    });

    expect(texte).not.toContain('Déjà couvert');
  });

  test('⛔ un joueur ne le voit pas non plus', async () => {
    const texte = await renderTextFor({
      entitlementsSummary: couvertPar(),
      subscriptionAccessLevel: 'TEAM',
      subscriptionSummary: { activePlanCodes: [] },
      userData: JOUEUR,
    });

    expect(texte).not.toContain('Déjà couvert');
  });
});
