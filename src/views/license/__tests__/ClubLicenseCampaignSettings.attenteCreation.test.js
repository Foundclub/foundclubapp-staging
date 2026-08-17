import renderer, { act } from 'react-test-renderer';

import ClubLicenseCampaignSettings from '../ClubLicenseCampaignSettings';

// T03 (E6) — LA MESURE QUI DECIDE DU LOT : COMBIEN D ALLERS-RETOURS EN FILE ?
//
// Adel en recette du 2026-08-17 (point 7) : « ouais c'est ok, mais qu'est-ce que
// c'est LONG pour se creer ». Le lot S06 avait deja rendu le bouton inerte
// (commit 8c19cff) : le doublon est empeche, l attente est restee muette.
//
// ⛔ On ne pose PAS une animation par-dessus une lenteur qu on pouvait
// supprimer. Ce temoin mesure donc d abord la seule chose qui compte : la
// PROFONDEUR de la chaine — le nombre de vagues reseau qui s attendent l une
// l autre. Chaque vague coute un aller-retour complet.
//
// 📏 Aller-retour mesure sur `api-staging.foundclubpro.com` le 2026-08-17,
// connexion chaude (`curl -w`, 12 tirs) : **305 ms** de mediane (min 300,
// max 329) — dont ~0-25 ms de serveur sur une route legere. C est le RESEAU qui
// domine, pas le calcul. Une vague de moins = ~305 ms de moins, partout.
//
// 🔬 COMMENT LA PROFONDEUR SE MESURE ICI, sans horloge et sans faux minuteur :
// chaque appel reseau note, AU MOMENT OU IL PART, la profondeur maximale deja
// TERMINEE, et s attribue `celle-la + 1`. Deux appels lances ensemble lisent la
// meme valeur et portent donc la meme profondeur ; un appel qui attend le
// precedent en porte une de plus. Le maximum du journal EST le nombre
// d allers-retours en file.
//
// AVANT ce lot, la mesure rend **5** :
//   1 creation de la campagne
//   2 suppression des documents retires   ← attend 1
//   3 remontee des documents actifs       ← attend 2
//   4 suppression des regles retirees     ← attend 3
//   5 remontee des regles actives         ← attend 4
// alors que 2, 3, 4 et 5 ne se lisent JAMAIS entre elles : ce sont des entites
// distinctes, sur deux collections distinctes. La file etait gratuite.

// Prefixe `mock` : seule facon pour une usine `jest.mock()` d atteindre une
// variable de module (jest autorise nommement ce prefixe).
const mockReact = require('react');

/** @type {any} */
let propsDuTunnel = null;
/** @type {{ nom: string, profondeur: number }[]} */
const mockJournalReseau = [];
let mockProfondeurTerminee = 0;

/**
 * Simule UN aller-retour reseau et l inscrit au journal des profondeurs.
 * @param {string} nom - Le nom de l appel, tel qu il apparaitra au rapport.
 * @param {any} [reponse] - Ce que le serveur rendrait.
 * @returns {Promise<any>} La reponse, un micro-tour plus tard.
 */
const mockAppelReseau = (nom, reponse = true) => {
  const profondeur = mockProfondeurTerminee + 1;
  mockJournalReseau.push({ nom, profondeur });
  return Promise.resolve().then(() => {
    mockProfondeurTerminee = Math.max(mockProfondeurTerminee, profondeur);
    return reponse;
  });
};

// Valeurs FIGEES au niveau module : un objet neuf a chaque appel relance les
// `useMemo`/`useEffect` qui en dependent et fait tourner Jest en boucle infinie
// SANS message (piege paye le 2026-08-05 sur le lot L35).
const mockRequeteVide = { data: null, isError: false, isLoading: false };
const mockRequeteListeVide = { data: [], isError: false, isLoading: false };
const mockInsetsFiges = {
  bottom: 0, left: 0, right: 0, top: 0,
};
const mockClientRequeteFige = { invalidateQueries: jest.fn(), setQueryData: jest.fn() };

const navigationFigee = {
  addListener: () => () => {},
  canGoBack: () => true,
  goBack: jest.fn(),
  navigate: jest.fn(),
  replace: jest.fn(),
  setOptions: jest.fn(),
  setParams: jest.fn(),
};

// Une campagne de PRE-REMPLISSAGE, sans `campaignId` : l ecran enregistre donc
// une campagne NEUVE (R01, l. 1374) tout en portant deja des documents et des
// regles — c est la forme reelle d une creation faite depuis le tunnel complet.
const campagneDeDepart = {
  currency: 'EUR',
  defaultAmountCents: 12000,
  documentRequests: [
    { id: 'doc-1', name: 'Certificat medical', sortOrder: 1 },
    { id: 'doc-2', name: 'Photo d identite', sortOrder: 2 },
  ],
  name: 'Cotisation T03',
  pricingRules: [
    {
      amountCents: 9000, id: 'rule-1', priority: 2, roleName: 'joueur', ruleType: 'role',
    },
    {
      amountCents: 5000, id: 'rule-2', priority: 1, roleName: 'entraineur', ruleType: 'role',
    },
  ],
  seasonLabel: '2026-2027',
};

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => mockClientRequeteFige,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsetsFiges,
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
jest.mock('@/services/license/licenseQueries', () => ({
  createLicenseCampaign: jest.fn(() => mockAppelReseau('creation campagne', { documentId: 'camp-T03' })),
  deleteLicenseDocumentRequest: jest.fn(() => mockAppelReseau('suppression document')),
  deleteLicensePricingRule: jest.fn(() => mockAppelReseau('suppression regle')),
  updateLicenseCampaign: jest.fn(() => mockAppelReseau('mise a jour campagne', { documentId: 'camp-T03' })),
  uploadLicenseDocumentRequestTemplate: jest.fn(() => mockAppelReseau('envoi modele')),
  upsertLicenseDocumentRequest: jest.fn(() => mockAppelReseau('remontee document')),
  upsertLicensePricingRule: jest.fn(() => mockAppelReseau('remontee regle')),
  useCurrentLicenseCampaign: () => mockRequeteVide,
  useLicenseCampaign: () => mockRequeteVide,
  /**
   * Reproduit l ORDRE MESURE de `@tanstack/query-core` 5.85.9 : `isPending`
   * retombe a `false` AVANT que le `onSuccess` passe a `mutate(...)` ne soit
   * joue (mutationObserver.js:43-46 puis 81).
   * @param {any} fonction - La fonction de mutation confiee par l ecran.
   * @returns {any} Une mutation qui suit l ordre reel.
   */
  useLicenseMutation: (fonction) => {
    const [isPending, setIsPending] = mockReact.useState(false);
    const mutate = mockReact.useCallback((variables, options) => {
      setIsPending(true);
      Promise.resolve()
        .then(() => fonction(variables))
        .then(async (donnees) => {
          setIsPending(false);
          await options?.onSuccess?.(donnees);
        })
        .catch(async (erreur) => {
          setIsPending(false);
          await options?.onError?.(erreur);
        });
    }, [fonction]);
    // `providerMutation` ne parle a personne (`async () => true`, l. 1919) :
    // il ne compte donc pas comme un aller-retour, et il est resolu tout de
    // suite pour que la chaine aille jusqu au bout.
    const mutateAsync = mockReact.useCallback(() => Promise.resolve(true), []);
    return { isPending, mutate, mutateAsync };
  },
}));

jest.mock('@/platform/media', () => ({ __esModule: true, default: { pickDocument: jest.fn() } }));

jest.mock('@/services/license/licenseService', () => ({
  connectLicenseHelloAsso: jest.fn(),
}));

jest.mock('@/services/club/clubQueries', () => ({
  useGetClub: () => mockRequeteVide,
}));

jest.mock('@/services/section/sectionQueries', () => ({
  useGetSections: () => mockRequeteListeVide,
}));

jest.mock('@/services/category/categoryQueries', () => ({
  useGetCategories: () => mockRequeteListeVide,
}));

jest.mock('@/services/category/categoryService', () => ({
  compareCategories: () => 0,
}));

jest.mock('@/services/level/levelQueries', () => ({
  useGetLevels: () => mockRequeteListeVide,
}));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) {
    return children;
  },
);

jest.mock(
  '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet',
  () => function PaywallMock() {
    return null;
  },
);

jest.mock('@/components/molecules/bottomModal/BottomModal', () => function BottomModalMock() {
  return null;
});

jest.mock('@/components/molecules/inputStepper/InputStepper', () => function InputStepperMock() {
  return null;
});

jest.mock(
  '@/components/molecules/dateTimeSelector/DateTimeSelector',
  () => function DateTimeSelectorMock() {
    return null;
  },
);

// Le gabarit du tunnel n est pas rendu : on garde ses PROPS, c est la ou vivent
// le bouton final (`onNext`) et son etat inerte (`isNextLoading`).
jest.mock(
  '@/components/molecules/wizardStepLayout/WizardStepLayout',
  () => function WizardStepLayoutMock(props) {
    propsDuTunnel = props;
    return props.children;
  },
);

/**
 * Monte le tunnel sur sa DERNIERE etape, pret a enregistrer.
 * @returns {Promise<any>} L arbre monte, a demonter par l appelant.
 */
const monterSurLaDerniereEtape = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <ClubLicenseCampaignSettings
        navigation={navigationFigee}
        route={{ params: { campaign: campagneDeDepart, clubId: 'club-T03' } }}
      />,
    );
  });

  let garde = 0;
  while (propsDuTunnel.stepIndex < propsDuTunnel.stepCount && garde < 20) {
    garde += 1;
    const avancer = propsDuTunnel.onSkip;
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      avancer();
    });
  }
  return arbre;
};

// Les doublures du service, prises UNE fois au niveau module : un require()
// dans un test declenche `global-require`, et le cliquet de lint compte chaque
// alerte.
const {
  uploadLicenseDocumentRequestTemplate,
  upsertLicenseDocumentRequest,
} = require('@/services/license/licenseQueries');

/**
 * Cherche l annonce d etape, en ne gardant que les noeuds HOTES : un `<Text>`
 * de React Native rend un composite ET un hote qui portent le meme `testID`,
 * et `findAll` les compte tous les deux.
 * @param {any} arbre - L arbre monte.
 * @returns {any[]} Les noeuds hotes portant l annonce.
 */
const trouverAnnonce = (arbre) => arbre.root.findAll((noeud) => (
  typeof noeud.type === 'string' && noeud.props?.testID === 'license-campagne-etape-envoi'
));

/**
 * Rend la profondeur maximale du journal, et le detail lisible.
 * @returns {{ detail: string, profondeur: number }} La mesure.
 */
const mesurerLaChaine = () => ({
  detail: mockJournalReseau.map((appel) => `vague ${appel.profondeur} · ${appel.nom}`).join('\n'),
  profondeur: mockJournalReseau.reduce((max, appel) => Math.max(max, appel.profondeur), 0),
});

describe('T03 — l attente de la creation, mesuree en allers-retours', () => {
  beforeEach(() => {
    propsDuTunnel = null;
    mockJournalReseau.length = 0;
    mockProfondeurTerminee = 0;
  });

  it('temoin 1 — enregistrer ne coute JAMAIS plus de 2 allers-retours en file', async () => {
    const arbre = await monterSurLaDerniereEtape();

    await act(async () => {
      propsDuTunnel.onSkip();
    });

    const mesure = mesurerLaChaine();
    // La campagne d abord (elle donne l identifiant), puis TOUT le reste
    // ensemble. Au-dela de 2, c est de la file gratuite.
    expect(`${mesure.profondeur} vagues\n${mesure.detail}`).toBe([
      '2 vagues',
      'vague 1 · creation campagne',
      'vague 2 · remontee document',
      'vague 2 · remontee document',
      'vague 2 · remontee regle',
      'vague 2 · remontee regle',
    ].join('\n'));

    arbre.unmount();
    // Le tunnel monte ses 6 etapes avant de pouvoir enregistrer : 5 s ne
    // suffisent pas sur cette machine, et un depassement dirait « rouge » sans
    // rien mesurer.
  }, 30000);

  it('temoin 2 — pendant toute la chaine, l ecran DIT ce qu il fait', async () => {
    const arbre = await monterSurLaDerniereEtape();

    // Avant l appui : rien a annoncer.
    expect(trouverAnnonce(arbre)).toHaveLength(0);

    // On retient la chaine au premier aller-retour pour observer la fenetre qui
    // etait muette : la campagne a repondu, le reste part encore.
    let libererLaSuite = () => {};
    const attente = new Promise((resolve) => { libererLaSuite = () => resolve(true); });
    upsertLicenseDocumentRequest.mockImplementationOnce(() => attente);

    await act(async () => {
      propsDuTunnel.onSkip();
    });

    const annonce = trouverAnnonce(arbre);
    expect(annonce).toHaveLength(1);
    expect(annonce[0].props.children).toBe('Documents et tarifs en cours d envoi...');
    expect(propsDuTunnel.isNextLoading).toBe(true);

    await act(async () => {
      libererLaSuite();
    });
    arbre.unmount();
  }, 30000);
});

// T03 — LE MODELE PARTAGE : IL NE COUTE RIEN A QUI N EN DEPOSE PAS.
//
// L envoi du modele est une vague de plus, et elle est INCOMPRESSIBLE : une
// demande neuve n a pas d identifiant tant qu elle n est pas remontee, on ne
// peut donc rien y accrocher avant. Ce qu on verifie ici, c est qu elle ne part
// QUE si un modele a ete choisi — une campagne ordinaire garde sa profondeur 2.
describe('T03 — le modele a telecharger ne rallonge que ceux qui en posent un', () => {
  beforeEach(() => {
    propsDuTunnel = null;
    mockJournalReseau.length = 0;
    mockProfondeurTerminee = 0;
  });

  it('temoin 3 — sans modele, aucun appel de televersement ne part', async () => {
    const arbre = await monterSurLaDerniereEtape();
    uploadLicenseDocumentRequestTemplate.mockClear();

    await act(async () => {
      propsDuTunnel.onSkip();
    });

    expect(uploadLicenseDocumentRequestTemplate).not.toHaveBeenCalled();
    expect(mesurerLaChaine().profondeur).toBe(2);

    arbre.unmount();
  }, 30000);
});
