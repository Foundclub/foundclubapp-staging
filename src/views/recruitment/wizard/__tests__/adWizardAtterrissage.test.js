import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import AdWizardRecap from '../AdWizardRecap';

// Filet R07 point 4 (E6 — ce fichier n'avait AUCUN test) — OU L'ON ATTERRIT
// APRES AVOIR PUBLIE SON ANNONCE, et ce qui reste sous les pieds.
//
// Constat d'Adel du 2026-08-13 : « ce n'est pas intuitif d'appuyer sur la
// fleche retour en haut a gauche pour fermer la page. Il faudrait qu'une fois
// le recap valide, cela amene a l'endroit de mon annonce publiee ».
//
// AVANT : `resetToHome()` refaisait la pile avec le seul `HomeTab`. L'annonce
// qu'on venait d'ecrire n'etait montree NULLE PART — il fallait aller la
// rechercher.
//
// 🧨 POURQUOI PAS LE BANC A VRAI ROUTEUR DE D24/D81, ET C'EST UN PIEGE DE
// MESURE A CONSIGNER : ces filets-la montent une pile minimale sur
// `useNavigationBuilder`, et cette pile NE SAIT PAS EXPRIMER
// `navigation.getParent().reset(...)`. Mesure du 2026-08-14 : appele depuis un
// ecran du tunnel, ce reset ne change RIEN, alors que `conteneur.reset(...)`
// avec la MEME charge utile refait la pile. Un tel banc serait donc ROUGE quoi
// qu'on ecrive — il mesurerait sa propre limite, pas le code. D81 ne l'avait
// pas rencontre parce que sa cible (`Club`) vivait dans LA MEME pile que son
// tunnel ; ici `RecruitmentAdDetails` et `AdWizardStack` sont FRERES a la
// racine (`PrivateNavigator.js`, l. 594 et 311), il faut refaire la pile du
// PARENT.
//
// ⚠️ ET POURQUOI UN ESPION EST HONNETE ICI, alors que D81 l'interdisait : sa
// mise en garde visait `navigate`, dont l'effet est ambigu (vers un ecran deja
// empile il DEPILE, vers un ecran absent il empile) — un
// `toHaveBeenCalledWith('Club')` y etait vert des DEUX cotes du correctif. Un
// `reset({ index, routes })` n'a pas cette ambiguite : la LISTE DES ROUTES est
// l'etat de la pile, litteralement. L'espionner, c'est lire la pile.

/** @type {any[]} */
const mockProprietesEtape = [];
/** @type {any[]} */
const mockAnnoncesCreees = [];
/** @type {any} */
let mockReponseCreation = null;
const mockCreerAnnonce = jest.fn(async () => {
  const creee = mockReponseCreation === null
    ? { documentId: `annonce-${mockAnnoncesCreees.length + 1}` }
    : mockReponseCreation;
  mockAnnoncesCreees.push(creee);
  return creee;
});
const mockClientRequete = { invalidateQueries: jest.fn() };
const mockBanniere = jest.fn();

// Objet FIGE : un contexte neuf a chaque rendu relance les effets qui en
// dependent et fait tourner Jest en boucle infinie, sans message (piege D81).
const ETAT_UN_POSTE = Object.freeze({
  address: { label: '12 rue du Stade, Lyon' },
  audienceType: 'player',
  category: { documentId: 'cat-1', name: 'Senior' },
  description: 'On cherche un gardien pour la saison.',
  minLevel: { documentId: 'niv-1', name: 'Departemental' },
  positions: Object.freeze([Object.freeze({ name: 'Gardien', quantity: 1 })]),
  section: { documentId: 'sec-1', name: 'Football' },
  team: Object.freeze({ club: { documentId: 'club-1' }, documentId: 'equipe-1', name: 'U17' }),
  validationMode: 'auto',
});

const ETAT_DEUX_POSTES = Object.freeze({
  ...ETAT_UN_POSTE,
  positions: Object.freeze([
    Object.freeze({ name: 'Gardien', quantity: 1 }),
    Object.freeze({ name: 'Attaquant', quantity: 2 }),
  ]),
});

/** @type {any} */
let mockEtatCourant = ETAT_UN_POSTE;

jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    mutateAsync: (/** @type {any} */ variables) => options.mutationFn(variables),
    reset: jest.fn(),
  }),
  useQueryClient: () => mockClientRequete,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {string} */ repli) => repli || cle,
  }),
}));

// Le VRAI theme, sans le contexte React qui le porte. Un mock en Proxy rend les
// echecs Jest illisibles (constat du lot paywall, 2026-08-02).
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

// ⛔ Jamais `requireActual` sur un service : le client HTTP refuse de se charger
// sans `API_URL` et fait tomber la suite AVANT le premier rendu.
jest.mock('@/services/recruitment/recruitmentService', () => ({
  createRecruitmentAd: (/** @type {any} */ ...arguments_) => mockCreerAnnonce(...arguments_),
}));

jest.mock('@/domains/subscription/subscriptionDecision', () => ({
  extractSubscriptionDecisionFromError: () => null,
}));

jest.mock('@/context/AppFeedbackContext', () => ({
  useAppFeedback: () => ({ showBanner: mockBanniere }),
}));

jest.mock('../AdWizardContext', () => ({
  useAdWizard: () => ({ dispatch: jest.fn(), state: mockEtatCourant }),
}));

jest.mock(
  '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet',
  () => function PaywallMock() {
    return null;
  },
);

jest.mock(
  '@/views/event/wizard/components/EventWizardTeamCard',
  () => function CarteEquipeMock() {
    return null;
  },
);

// La doublure capture les props et rend `null` : on pilote l'etape par ses
// boutons (`onNext`), pas par la forme de son arbre.
jest.mock(
  '@/components/molecules/wizardStepLayout/WizardStepLayout',
  () => function EtapeMock(/** @type {any} */ props) {
    mockProprietesEtape.push(props);
    return null;
  },
);

/** @type {any} */
let arbre = null;
/** @type {any} */
let resetRacine;
/** @type {any} */
let dernierRecours;

/**
 * Monte l'etape de recapitulatif avec une navigation doublee. Le double rend un
 * PARENT, comme le vrai routeur : c'est lui qui porte la pile ou vivent
 * l'accueil et la fiche d'annonce.
 * @param {{ avecParent?: boolean }} [options] - Reglages du double.
 * @returns {void}
 */
const monterLeRecap = ({ avecParent = true } = {}) => {
  mockProprietesEtape.length = 0;
  mockAnnoncesCreees.length = 0;
  resetRacine = jest.fn();
  dernierRecours = jest.fn();

  const navigation = {
    dispatch: dernierRecours,
    getParent: () => (avecParent ? { reset: resetRacine } : undefined),
    navigate: jest.fn(),
  };

  act(() => {
    arbre = renderer.create(createElement(AdWizardRecap, { navigation }));
  });
};

/**
 * Publie l'annonce en appuyant sur le bouton de l'etape, comme Adel.
 * @returns {Promise<void>} Rien.
 */
const publier = async () => {
  const etape = mockProprietesEtape[mockProprietesEtape.length - 1];
  await act(async () => {
    await etape.onNext();
  });
};

/**
 * La pile telle que le correctif la reconstruit.
 * @returns {any[]} Les routes demandees a la racine.
 */
const pileDemandee = () => resetRacine.mock.calls[0][0].routes;

/**
 * Les noms de la pile reconstruite, dans l'ordre.
 * @returns {string[]} Les noms de route.
 */
const nomsDeLaPile = () => pileDemandee().map((/** @type {any} */ route) => route.name);

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
  mockEtatCourant = ETAT_UN_POSTE;
  mockReponseCreation = null;
  jest.clearAllMocks();
});

describe('R07 point 4 — apres publication, on atterrit SUR son annonce', () => {
  it('L ETAT DE DEPART : rien n est refait tant qu on n a pas publie', () => {
    monterLeRecap();

    expect(mockProprietesEtape.length).toBeGreaterThan(0);
    expect(resetRacine).not.toHaveBeenCalled();
  });

  it('LE TEMOIN : une fois publiee, c est l annonce qui est au premier plan', async () => {
    monterLeRecap();
    await publier();

    const routes = pileDemandee();
    const dessus = routes[routes.length - 1];

    expect(dessus.name).toBe('RecruitmentAdDetails');
    expect(dessus.params.adId).toBe('annonce-1');
    // L'index SUIT la pile : fige, il viserait un ecran absent le jour ou la
    // pile n'en compte qu'un (garde repris de `EventWizardRecap`).
    expect(resetRacine.mock.calls[0][0].index).toBe(routes.length - 1);
  });

  it('🔒 LE VERROU : le tunnel a QUITTE la pile, le retour n y ramene pas', async () => {
    monterLeRecap();
    await publier();

    // C'est l'acquis D81. Sans ca, un seul « Retour » reposait le doigt sur
    // « Publier l'annonce » d'une annonce DEJA publiee — et on la publiait
    // deux fois.
    expect(nomsDeLaPile()).not.toContain('AdWizardRecap');
    expect(nomsDeLaPile()).not.toContain('AdWizardStack');
  });

  it('et ce retour mene a l accueil, jamais dans le vide', async () => {
    monterLeRecap();
    await publier();

    // L'accueil reste SOUS l'annonce : la fleche retour a donc une
    // destination. Une pile reduite a la seule annonce laisserait un ecran
    // dont on ne peut plus sortir par le haut.
    expect(nomsDeLaPile()).toEqual(['HomeTab', 'RecruitmentAdDetails']);
  });

  it('plusieurs postes : on atterrit sur la premiere annonce, jamais sur l accueil', async () => {
    mockEtatCourant = ETAT_DEUX_POSTES;
    monterLeRecap();
    await publier();

    // Un brief a plusieurs postes cree UNE annonce PAR poste. Il n'existe pas
    // d'ecran « mes annonces » dans `routeNames.js` : on montre la premiere,
    // ce qui vaut toujours mieux que de renvoyer a l'accueil sans rien montrer.
    expect(mockAnnoncesCreees).toHaveLength(2);
    expect(nomsDeLaPile()).toEqual(['HomeTab', 'RecruitmentAdDetails']);
  });

  it('⛔ AUCUN ECRAN BLANC : sans identifiant rendu, on retombe sur l accueil', async () => {
    // Le serveur pourrait ne rien renvoyer d'exploitable. `RecruitmentAdDetails`
    // sans identifiant n'afficherait rien du tout : on prefere l'ancien
    // comportement a un ecran vide.
    mockReponseCreation = { pasDIdentifiant: true };
    monterLeRecap();
    await publier();

    expect(nomsDeLaPile()).toEqual(['HomeTab']);
  });

  it('sans parent, on retombe sur l ANCIEN comportement plutot que sur rien', async () => {
    monterLeRecap({ avecParent: false });
    await publier();

    // Dernier recours : mieux vaut l'accueil qu'un ecran fige.
    expect(dernierRecours).toHaveBeenCalled();
  });
});
