import { readFileSync } from 'fs';
import path from 'path';

import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import CollectiviteClubs from '../CollectiviteClubs';

// 🏛️ COLL-R-A6 (13/10/2026) — COL-001, « Clubs rattachés » allégé : planche P7v4-clubs (tel et
// ordi), décision d'Adel D1 = A′ (« Ok je valide tout », 13/10 vers 02 h 22, fenêtre
// COLL-R-DESIGN).
//
// Ce que ce témoin fige (ROUGE avant le lot) :
//   - la carte d'un club tient en 3 LIGNES : logo et nom avec « Écrire » en bouton rond (icône
//     seule, nommé pour le lecteur d'écran) ; « 2 équipes · 2 membres · 2 séances cette semaine » ;
//     « Dirigeant : … ». Plus d'e-mail, de téléphone ni de site sur la carte (sur la fiche) ;
//   - sur ordinateur, le tableau perd la colonne « Contact général » ;
//   - UN seul bouton « Ajouter un club » (ni « … déjà sur FoundClub », ni « Inviter un club
//     absent ») ;
//   - « Demandes de rattachement » passe AU-DESSUS des clubs et ne montre plus une demande déjà
//     rattachée (le doublon « Rattaché · Il apparaît dans vos clubs. ») ; plusieurs demandes : la
//     première, puis « Voir les N demandes » ;
//   - la barre du haut n'écrit plus « Clubs rattachés » (le titre de la page suffit).

/** @type {any} */
let mockClubs;
/** @type {any} */
let mockDemandes;
const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
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

let mockBureau = false;
jest.mock('@/responsive', () => ({
  ...jest.requireActual('@/responsive'),
  useIsDesktop: () => mockBureau,
}));

jest.mock('@/services/facility/facilityQueries', () => ({
  useApproveFacilityOverrideRequest: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useRefuseFacilityOverrideRequest: () => ({ isPending: false, mutateAsync: jest.fn() }),
}));

jest.mock('@/services/collectivite/collectiviteRattachementQueries', () => ({
  useAnswerCollectiviteAttachRequest: () => ({ isPending: false, mutate: jest.fn() }),
  useCancelCollectiviteProposal: () => ({ isPending: false, mutate: jest.fn() }),
  useCollectiviteClubRequests: () => mockDemandes,
  useCollectiviteClubSearch: () => ({ data: [], error: null, isLoading: false }),
  useProposeCollectiviteClub: () => ({ isPending: false, mutate: jest.fn() }),
  useRemindCollectiviteProposal: () => ({ isPending: false, mutate: jest.fn() }),
}));

jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteClubs: () => mockClubs,
  useCollectiviteInvitations: () => ({ data: [] }),
  useMyCollectivites: () => ({
    data: [{ documentId: 'ville-de-recette', name: 'Ville de Recette' }],
    isLoading: false,
  }),
  useRemindCollectiviteInvitation: () => ({ isPending: false, mutate: jest.fn(), variables: null }),
}));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });
jest.mock(
  '@/components/molecules/clubLogoMark/ClubLogoMark',
  () => function ClubLogoMarkMock() { return null; },
);

// Les coordonnees du club sont fictives (.invalid) : elles ne doivent plus s'afficher sur la carte.
const AS_MONTRIVAGE = {
  documentId: 'as-montrivage',
  email: 'contact@as-montrivage.example.invalid',
  leaders: [{ name: 'Karim Benali' }],
  logo: null,
  membersCount: 2,
  name: 'AS Montrivage',
  phoneNumber: '0102030405',
  sessionsThisWeek: { count: 2, facilities: ['Dojo municipal', 'Gymnase des Tilleuls'] },
  teamsCount: 2,
  websiteUrl: 'https://as-montrivage.example.invalid',
};
const MONTRIVAGE_FC = {
  documentId: 'montrivage-fc',
  email: null,
  leaders: [{ name: 'Lea Martin' }, { name: 'Paul Morel' }],
  logo: null,
  membersCount: null,
  name: 'Montrivage FC',
  phoneNumber: null,
  sessionsThisWeek: null,
  teamsCount: 3,
  websiteUrl: null,
};
const MONTRIVAGE_BASKET = {
  documentId: 'montrivage-basket',
  email: null,
  leaders: null,
  logo: null,
  membersCount: 0,
  name: 'Montrivage Basket',
  phoneNumber: null,
  sessionsThisWeek: { count: 0, facilities: [] },
  teamsCount: 1,
  websiteUrl: null,
};

const RATTACHEE = {
  canAnswer: false,
  club: { documentId: 'as-montrivage', name: 'AS Montrivage' },
  createdAt: '2026-10-07T10:00:00.000Z',
  documentId: 'demande-rattachee',
  kind: 'attach_request',
  state: 'attached',
};
const EN_ATTENTE = {
  canAnswer: true,
  club: { documentId: 'us-valbrune', name: 'US Valbrune' },
  createdAt: '2026-10-07T10:00:00.000Z',
  documentId: 'demande-valbrune',
  kind: 'attach_request',
  state: 'pending',
};
const EN_ATTENTE_2 = {
  ...EN_ATTENTE,
  club: { documentId: 'rivelac-fc', name: 'Rivelac FC' },
  documentId: 'demande-rivelac',
};

/**
 * Aplati les enfants React en une chaine.
 * @param {any} enfants - Les enfants.
 * @returns {string} Le texte.
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
    arbre = renderer.create(<CollectiviteClubs />);
  });
  return arbre;
};

const textesDe = (/** @type {any} */ noeud) => noeud.findAllByType(Text)
  .map((/** @type {any} */ n) => aplatirTexte(n.props.children).trim())
  .filter(Boolean);

const pressable = (/** @type {any} */ arbre, /** @type {string} */ testID) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.testID === testID && typeof n.props?.onPress === 'function',
)[0];

const boutons = (/** @type {any} */ arbre, /** @type {string} */ titre) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.title === titre && typeof n.props?.onPress === 'function',
);

/**
 * Le rang, dans l'ordre de l'arbre, du premier noeud qui porte ce testID.
 * @param {any} arbre - L'arbre rendu.
 * @param {string} testID - Le testID.
 * @returns {number} Le rang, ou -1.
 */
const rang = (arbre, testID) => arbre.root.findAll(() => true)
  .findIndex((/** @type {any} */ n) => n.props?.testID === testID);

beforeEach(() => {
  mockNavigate.mockClear();
  mockBureau = false;
  mockClubs = {
    data: [AS_MONTRIVAGE, MONTRIVAGE_BASKET, MONTRIVAGE_FC],
    error: null,
    isLoading: false,
    refetch: jest.fn(),
  };
  mockDemandes = { data: [], error: null, isLoading: false };
});

describe('COL-001 — la carte d’un club en 3 lignes (téléphone, planche P7v4-clubs-tel, A′)', () => {
  it('nom, puis les nombres, puis les dirigeants : rien d’autre sur la carte', async () => {
    const arbre = await monter();
    expect(textesDe(pressable(arbre, 'collectivite-club-as-montrivage'))).toEqual([
      'AS Montrivage',
      '2 équipes · 2 membres · 2 séances cette semaine',
      'Dirigeant : Karim Benali',
    ]);
    // Singulier, zéro, illisible : « 0 membre », « aucune séance », « — », jamais un 0 inventé.
    expect(textesDe(pressable(arbre, 'collectivite-club-montrivage-basket'))).toEqual([
      'Montrivage Basket',
      '1 équipe · 0 membre · aucune séance cette semaine',
    ]);
    expect(textesDe(pressable(arbre, 'collectivite-club-montrivage-fc'))).toEqual([
      'Montrivage FC',
      '3 équipes · — membres · — séances cette semaine',
      'Dirigeants : Lea Martin, Paul Morel',
    ]);
  });

  it('ni e-mail, ni téléphone, ni site sur la carte : ils sont sur la fiche du club', async () => {
    const tout = textesDe((await monter()).root);
    ['contact@as-montrivage.example.invalid', '0102030405', 'https://as-montrivage.example.invalid',
      'Pas de contact renseigné par le club.', 'Demander au club de compléter sa fiche']
      .forEach((texte) => expect(tout).not.toContain(texte));
  });

  it('« Écrire » : un bouton rond (icône seule) sur la ligne du nom, nommé', async () => {
    const arbre = await monter();
    const ecrire = pressable(arbre, 'collectivite-club-as-montrivage-ecrire');
    expect(ecrire).toBeDefined();
    expect(ecrire.props.accessibilityLabel).toBe('Écrire aux dirigeants d’AS Montrivage');
    expect(textesDe(ecrire)).toEqual([]);
    expect(pressable(arbre, 'collectivite-club-montrivage-fc-ecrire').props.accessibilityLabel)
      .toBe('Écrire aux dirigeants de Montrivage FC');
    // La zone de toucher fait 44 px au moins (décision de design du 01/10).
    const style = [ecrire.props.style].flat(Infinity)
      .reduce((a, b) => ({ ...a, ...(b || {}) }), {});
    expect(style.width).toBeGreaterThanOrEqual(44);
    expect(style.height).toBeGreaterThanOrEqual(44);
  });

  it('un seul « Ajouter un club », qui ouvre le choix (« Déjà sur FoundClub »)', async () => {
    const arbre = await monter();
    const ajouter = boutons(arbre, 'Ajouter un club');
    expect(ajouter).toHaveLength(1);
    // « + Ajouter un club » : l'icône AVANT le texte, comme la planche (i-plus puis le libellé).
    expect(ajouter[0].props.icon).toBe('plus');
    expect(ajouter[0].props.iconPosition).toBe('before');
    expect(boutons(arbre, 'Ajouter un club déjà sur FoundClub')).toHaveLength(0);
    expect(pressable(arbre, 'collectivite-clubs-inviter')).toBeUndefined();
    expect(textesDe(arbre.root)).not.toContain('Inviter un club absent de FoundClub');
    act(() => { ajouter[0].props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith('CollectiviteInviteClub', {
      collectiviteId: 'ville-de-recette',
      onglet: 'recherche',
    });
    // Il passe AVANT les clubs (planche : sous le titre).
    expect(rang(arbre, 'collectivite-clubs-ajouter'))
      .toBeLessThan(rang(arbre, 'collectivite-club-as-montrivage'));
  });
});

describe('COL-001 — les demandes de rattachement', () => {
  it('une demande déjà rattachée ne s’affiche plus (le doublon « Rattaché »)', async () => {
    mockDemandes = { data: [RATTACHEE], error: null, isLoading: false };
    const arbre = await monter();
    expect(textesDe(arbre.root)).not.toContain('Rattaché');
    expect(textesDe(arbre.root)).not.toContain('Il apparaît dans vos clubs.');
    expect(pressable(arbre, 'demande-rattachement-demande-rattachee')).toBeUndefined();
    expect(arbre.root.findAll((/** @type {any} */ n) => n.props?.testID
      === 'collectivite-demandes-rattachement')).toHaveLength(0);
  });

  it('une demande en attente monte AU-DESSUS des clubs, avec Accepter et Refuser', async () => {
    mockDemandes = { data: [RATTACHEE, EN_ATTENTE], error: null, isLoading: false };
    const arbre = await monter();
    expect(textesDe(arbre.root)).toContain('US Valbrune');
    expect(boutons(arbre, 'Accepter')).toHaveLength(1);
    expect(boutons(arbre, 'Refuser')).toHaveLength(1);
    expect(rang(arbre, 'collectivite-demandes-rattachement'))
      .toBeLessThan(rang(arbre, 'collectivite-club-as-montrivage'));
  });

  it('plusieurs demandes : la première, puis « Voir les 2 demandes »', async () => {
    mockDemandes = { data: [EN_ATTENTE, EN_ATTENTE_2], error: null, isLoading: false };
    const arbre = await monter();
    expect(textesDe(arbre.root)).toContain('US Valbrune');
    expect(textesDe(arbre.root)).not.toContain('Rivelac FC');
    const voir = boutons(arbre, 'Voir les 2 demandes');
    expect(voir).toHaveLength(1);
    act(() => { voir[0].props.onPress(); });
    expect(textesDe(arbre.root)).toContain('Rivelac FC');
  });
});

describe('COL-001 — sur ordinateur (planche P7v4-clubs-ordi, A′)', () => {
  it('sans « Contact général » ; « Écrire » en bouton rond ; un seul « Ajouter »', async () => {
    mockBureau = true;
    const arbre = await monter();
    const tout = textesDe(arbre.root);
    expect(tout).toEqual(expect.arrayContaining(['Club', 'Équipes', 'Membres', 'Cette semaine']));
    expect(tout).not.toContain('Contact général');
    expect(tout).not.toContain('contact@as-montrivage.example.invalid');
    expect(tout).not.toContain('Inviter un club absent');
    expect(boutons(arbre, 'Ajouter un club')).toHaveLength(1);
    const ligne = textesDe(pressable(arbre, 'collectivite-club-as-montrivage'));
    expect(ligne).toEqual(['AS Montrivage', 'Dirigeant : Karim Benali', '2', '2', '2 séances']);
    expect(textesDe(pressable(arbre, 'collectivite-club-montrivage-basket')))
      .toEqual(['Montrivage Basket', '1', '0', 'aucune']);
    const ecrire = pressable(arbre, 'collectivite-club-as-montrivage-ecrire');
    expect(ecrire.props.accessibilityLabel).toBe('Écrire aux dirigeants d’AS Montrivage');
    expect(textesDe(ecrire)).toEqual([]);
  });
});

describe('COL-001 — le titre n’est écrit qu’une fois', () => {
  it('la barre du haut de « Clubs rattachés » n’a plus de titre (la page l’écrit déjà)', () => {
    const source = readFileSync(
      path.join(__dirname, '../../../navigation/private/PrivateNavigator.js'),
      'utf8',
    );
    const debut = source.indexOf('name={RouteNames.CollectiviteClubs}');
    expect(debut).toBeGreaterThan(-1);
    const options = source.slice(debut, source.indexOf('/>', debut));
    expect(options).toMatch(/headerTitle: ''/);
    expect(options).not.toMatch(/collectivite\.clubs\.header/);
  });
});
