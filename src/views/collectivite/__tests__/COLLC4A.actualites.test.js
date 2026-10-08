import { Alert, Text, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import CollectiviteActualiteForm from '../CollectiviteActualiteForm';
import CollectiviteActualites from '../CollectiviteActualites';
import ActualiteCarte from '../components/ActualiteCarte';
import ActualitesDeLaVille from '../components/ActualitesDeLaVille';

// 📰 COLL-C4A (02/10) — PLANCHE 1 : publier une actualité de la Ville (design HY521H1 page 3,
// « P3b-actu-tel » écrans 1 à 3 et « P3b-actu-ordi » ; SPEC §2 F).
//
// Ce que ce témoin fige (ROUGE avant le lot : les trois écrans n'existaient pas) :
//   - « Actualités de la Ville » (mairie) : « Publier une actualité » en tête, chaque actualité
//     avec son type, son titre, son texte, à qui elle est partie EN NOMBRES, Modifier et Retirer ;
//     Retirer demande confirmation ; AUCUN compteur « lue par n » ;
//   - le formulaire : 5 types, titre, texte, « Pour qui » (3 choix), l'installation quand on la
//     vise ; la phrase des destinataires vient du serveur ; un titre vide n'envoie rien ; le corps
//     envoyé est la liste blanche ; sur ordinateur, l'aperçu de la carte à droite ;
//   - la feuille « Ajouter » de la messagerie, réduite à Photos, Caméra, Document ;
//   - le bloc de l'accueil : les deux dernières, « Toutes les actualités », ou « Publier la
//     première ».

/** @type {any} */
let mockActualites;
/** @type {any} */
let mockParams;
/** @type {boolean} */
let mockOrdinateur = false;
const mockNavigate = jest.fn();
const mockReplace = jest.fn();
const mockGoBack = jest.fn();
const mockPublier = jest.fn();
const mockModifier = jest.fn();
const mockRetirer = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate, replace: mockReplace }),
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
  useActualiteMutations: () => ({
    modifier: { isPending: false, mutateAsync: mockModifier },
    publier: { isPending: false, mutateAsync: mockPublier },
    retirer: { isPending: false, mutateAsync: mockRetirer },
  }),
  useActualiteRecipients: (/** @type {any} */ _id, /** @type {any} */ cible) => ({
    data: { audience: cible.audience, clubsCount: cible.audience === 'installation' ? 1 : 3 },
  }),
  useCollectiviteActualites: () => mockActualites,
}));
jest.mock('@/services/collectivite/collectiviteActualiteService', () => ({
  uploadActualiteFile: jest.fn(),
}));
jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteClubs: () => ({
    data: [{ documentId: 'a' }, { documentId: 'b' }, { documentId: 'c' }],
  }),
  useCollectiviteInstallations: () => ({
    data: [
      { documentId: 'dojo', name: 'Dojo municipal' },
      { documentId: 'gymnase', name: 'Gymnase des Tilleuls' },
    ],
  }),
  useMyCollectivites: () => ({
    data: [{ documentId: 'ville-de-recette', name: 'Ville de Montrivage' }],
  }),
}));
jest.mock('@/platform/media', () => ({
  __esModule: true,
  default: { capturePhoto: jest.fn(), pickDocument: jest.fn(), pickImage: jest.fn() },
}));
jest.mock('@/responsive', () => ({ useIsDesktop: () => mockOrdinateur }));

jest.mock('@/components/molecules/input/Input', () => {
  const { TextInput: Champ } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ {
      error, label, onChangeText, testID, value,
    }) => (
      <Champ
        accessibilityHint={error}
        accessibilityLabel={label}
        onChangeText={onChangeText}
        testID={testID}
        value={value}
      />
    ),
  };
});
jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });
jest.mock(
  '@/components/molecules/bottomModal/BottomModal',
  () => function BottomModalMock({ children, isVisible }) { return isVisible ? children : null; },
);
jest.mock(
  '@/components/organisms/chatAttachmentSheet/ChatAttachmentSheet',
  () => function FeuilleMock({ actions }) {
    const { Text: Libelle } = jest.requireActual('react-native');
    return actions.map((/** @type {any} */ action) => (
      <Libelle key={action.key} testID={`feuille-${action.key}`}>{action.label}</Libelle>
    ));
  },
);

const SUBVENTIONS = {
  attachments: [{
    id: 12, mime: 'application/pdf', name: 'dossier-subvention.pdf', url: '/uploads/d.pdf',
  }],
  audience: 'membres',
  body: 'Dossiers à déposer avant le 15 novembre au service des sports.',
  category: 'subventions',
  documentId: 'actu-subventions',
  editedAt: null,
  facility: null,
  publishedAt: '2026-09-21T08:00:00.000Z',
  recipients: { clubsCount: 3 },
  title: 'Subventions aux associations sportives 2027',
};
const FERMETURE = {
  ...SUBVENTIONS,
  attachments: [],
  audience: 'installation',
  body: 'Du samedi 17 au dimanche 25 octobre.',
  category: 'fermeture',
  documentId: 'actu-fermeture',
  facility: { documentId: 'dojo', name: 'Dojo municipal' },
  publishedAt: '2026-09-29T08:00:00.000Z',
  recipients: { clubsCount: 1 },
  title: 'Dojo municipal fermé pendant les vacances',
};
const FORUM = {
  ...SUBVENTIONS,
  attachments: [],
  category: 'forum',
  documentId: 'actu-forum',
  title: 'Forum des associations',
};
const VILLE = { collectiviteId: 'ville-de-recette' };

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
const champ = (/** @type {any} */ arbre, /** @type {string} */ testID) => arbre.root
  .findAllByType(TextInput)
  .find((/** @type {any} */ n) => n.props.testID === testID);
const appuyer = async (/** @type {any} */ noeud) => {
  await act(async () => {
    await noeud.props.onPress();
  });
};
const saisir = async (
  /** @type {any} */ arbre,
  /** @type {string} */ testID,
  /** @type {string} */ valeur,
) => {
  await act(async () => {
    champ(arbre, testID).props.onChangeText(valeur);
  });
};
const phraseDestinataires = (/** @type {any} */ arbre) => aplatirTexte(
  parTestID(arbre, 'actualite-form-destinataires').props.children,
);

beforeEach(() => {
  mockParams = { ...VILLE };
  mockOrdinateur = false;
  mockActualites = {
    data: [SUBVENTIONS, FERMETURE], error: null, isLoading: false, refetch: jest.fn(),
  };
  [mockNavigate, mockReplace, mockGoBack, mockPublier, mockModifier, mockRetirer]
    .forEach((fn) => fn.mockReset());
  mockPublier.mockResolvedValue({ data: {} });
  mockRetirer.mockResolvedValue({ data: { retired: true } });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('COLL-C4A — planche 1 : « Actualités de la Ville », côté mairie', () => {
  it('« Publier » en tête, puis chaque actualité et à qui elle est partie (NOMBRES)', async () => {
    const arbre = await monter(<CollectiviteActualites />);
    const lus = textes(arbre);
    expect(lus).toEqual(expect.arrayContaining([
      'Subventions',
      'Subventions aux associations sportives 2027',
      'dossier-subvention.pdf',
      'Envoyée aux membres des 3 clubs',
      'Fermeture',
      'Dojo municipal fermé pendant les vacances',
      'Envoyée aux membres d’1 club de l’installation',
    ]));
    expect(lus.some((texte) => /lue par/i.test(texte))).toBe(false);
    await appuyer(parTestID(arbre, 'collectivite-actualites-publier'));
    expect(mockNavigate)
      .toHaveBeenCalledWith('CollectiviteActualiteForm', { ...VILLE, retour: 'liste' });
  });

  it('Modifier ouvre CETTE actualité ; Retirer demande confirmation, puis retire', async () => {
    const arbre = await monter(<CollectiviteActualites />);
    await appuyer(parTestID(arbre, 'collectivite-actualite-actu-subventions-modifier'));
    expect(mockNavigate).toHaveBeenCalledWith(
      'CollectiviteActualiteForm',
      { actualiteId: 'actu-subventions', ...VILLE },
    );
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await appuyer(parTestID(arbre, 'collectivite-actualite-actu-subventions-retirer'));
    expect(mockRetirer).not.toHaveBeenCalled();
    const [titre, , boutons] = alerte.mock.calls[0];
    expect(titre).toBe('Retirer cette actualité ?');
    await act(async () => {
      await boutons.find((/** @type {any} */ b) => b.style === 'destructive').onPress();
    });
    expect(mockRetirer).toHaveBeenCalledWith('actu-subventions');
  });

  it('vide : une phrase calme ; en panne : le dire, avec « Réessayer »', async () => {
    mockActualites = { data: [], error: null, isLoading: false };
    expect(textes(await monter(<CollectiviteActualites />))).toContain(
      'Aucune actualité publiée. Les membres de vos clubs la liront dans leurs messages.',
    );
    mockActualites = {
      data: [], error: new Error('panne'), isLoading: false, refetch: jest.fn(),
    };
    expect(textes(await monter(<CollectiviteActualites />)))
      .toContain('Les actualités n’ont pas pu être lues.');
  });
});

describe('COLL-C4A — planche 1 : publier une actualité', () => {
  it('5 types, titre, texte, « Pour qui » ; les destinataires comptés par le serveur', async () => {
    const arbre = await monter(<CollectiviteActualiteForm />);
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Fermeture', 'Forum, manifestation', 'Subventions', 'Travaux', 'Autre',
      'Tous les membres', 'Les dirigeants', 'Les clubs d’une installation',
      'Ajouter une photo ou un document',
    ]));
    expect(phraseDestinataires(arbre)).toBe([
      // COLL-C4A3 (planche 18) : « rattachés », comme la maquette validée.
      'Reçue par les membres des 3 clubs rattachés.',
      'Une notification part aux dirigeants, aux entraîneurs et aux membres qui l’ont activée.',
      'Personne n’y répond.',
    ].join(' '));
  });

  it('« Les clubs d une installation » : on choisit l installation, la phrase suit', async () => {
    const arbre = await monter(<CollectiviteActualiteForm />);
    await appuyer(parTestID(arbre, 'actualite-form-pour-installation'));
    expect(textes(arbre))
      .toEqual(expect.arrayContaining(['Dojo municipal', 'Gymnase des Tilleuls']));
    await appuyer(parTestID(arbre, 'actualite-form-installation-dojo'));
    expect(phraseDestinataires(arbre)).toMatch(/^Reçue par les membres d’1 club rattaché\./);
  });

  it('un titre vide n’envoie rien ; un formulaire juste envoie la liste blanche', async () => {
    const arbre = await monter(<CollectiviteActualiteForm />);
    await appuyer(parTestID(arbre, 'actualite-form-publier'));
    expect(mockPublier).not.toHaveBeenCalled();

    await appuyer(parTestID(arbre, 'actualite-form-type-subventions'));
    await saisir(arbre, 'actualite-form-titre', 'Subventions aux associations sportives 2027');
    await saisir(arbre, 'actualite-form-texte', 'Dossiers avant le 15 novembre.');
    await appuyer(parTestID(arbre, 'actualite-form-pour-dirigeants'));
    await appuyer(parTestID(arbre, 'actualite-form-publier'));
    expect(mockPublier).toHaveBeenCalledWith({
      attachments: [],
      audience: 'dirigeants',
      body: 'Dossiers avant le 15 novembre.',
      category: 'subventions',
      title: 'Subventions aux associations sportives 2027',
    });
    expect(mockReplace).toHaveBeenCalledWith('CollectiviteActualites', VILLE);
  });

  it('« Modifier » : le formulaire reprend l’actualité, et enregistre SANS republier', async () => {
    mockParams = { actualiteId: 'actu-subventions', ...VILLE };
    mockModifier.mockResolvedValue({ data: {} });
    const arbre = await monter(<CollectiviteActualiteForm />);
    expect(champ(arbre, 'actualite-form-titre').props.value)
      .toBe('Subventions aux associations sportives 2027');
    expect(textes(arbre)).toContain('dossier-subvention.pdf');
    await appuyer(parTestID(arbre, 'actualite-form-publier'));
    expect(mockPublier).not.toHaveBeenCalled();
    expect(mockModifier).toHaveBeenCalledWith({
      actualiteId: 'actu-subventions',
      data: expect.objectContaining({ attachments: [12], category: 'subventions' }),
    });
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('la feuille « Ajouter » : Photos, Caméra, Document — rien d’autre', async () => {
    const arbre = await monter(<CollectiviteActualiteForm />);
    await appuyer(parTestID(arbre, 'actualite-form-ajouter'));
    const cles = arbre.root
      .findAll((/** @type {any} */ n) => n.type === Text
        && String(n.props?.testID || '').startsWith('feuille-'))
      .map((/** @type {any} */ n) => n.props.testID);
    expect(cles).toEqual(['feuille-photos', 'feuille-camera', 'feuille-document']);
  });

  it('sur ordinateur : l’aperçu exact de la carte, signé de la Ville', async () => {
    mockOrdinateur = true;
    const arbre = await monter(<CollectiviteActualiteForm />);
    await saisir(arbre, 'actualite-form-titre', 'Forum des associations');
    expect(parTestID(arbre, 'actualite-form-apercu')).toBeTruthy();
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Ce que liront les membres', 'Ville de Montrivage', 'Forum des associations',
    ]));
  });
});

describe('COLL-C4A — planche 1 : le bloc « Actualités de la Ville » de l’accueil', () => {
  it('les deux dernières, et « Toutes les actualités »', async () => {
    mockActualites = { data: [FERMETURE, SUBVENTIONS, FORUM], error: null, isLoading: false };
    const arbre = await monter(<ActualitesDeLaVille collectiviteId="ville-de-recette" />);
    expect(arbre.root.findAllByType(ActualiteCarte)).toHaveLength(2);
    expect(textes(arbre)).not.toContain('Forum des associations');
    await appuyer(parTestID(arbre, 'collectivite-home-actualites-toutes'));
    expect(mockNavigate).toHaveBeenCalledWith('CollectiviteActualites', VILLE);
  });

  it('aucune : « Publier la première », avec le nombre de clubs', async () => {
    mockActualites = { data: [], error: null, isLoading: false };
    const arbre = await monter(<ActualitesDeLaVille collectiviteId="ville-de-recette" />);
    expect(textes(arbre)).toContain(
      'Aucune actualité publiée. Les membres de vos 3 clubs la liront dans leurs messages.',
    );
    await appuyer(parTestID(arbre, 'collectivite-home-actualites-premiere'));
    expect(mockNavigate).toHaveBeenCalledWith('CollectiviteActualiteForm', VILLE);
  });
});

// FINITIONS16 · POINT 21 (tournee T15, photo SITE_C18 ; planche 18, P3b-actu-ordi) — SUR LE SITE,
// le formulaire d'une actualite n'avait ni titre ni moyen d'en sortir : le telephone les met dans
// son en-tete natif (titre « Nouvelle actualité », croix « Annuler »), que le site n'a pas. La
// planche : « Actualités de la Ville » en surtitre, « Nouvelle actualité » en titre. ROUGE avant.
describe('FINITIONS16 21 — planche 18 sur le site : le titre et la croix', () => {
  const { Platform } = jest.requireActual('react-native');
  const osAvant = Platform.OS;
  afterEach(() => {
    Platform.OS = osAvant;
  });
  const croixDe = (/** @type {any} */ arbre) => arbre.root.findAll(
    (/** @type {any} */ n) => n.props?.accessibilityLabel === 'Annuler'
      && typeof n.props?.onPress === 'function',
  )[0];

  it('🔴 « Actualités de la Ville », « Nouvelle actualité », et la croix qui ferme', async () => {
    Platform.OS = 'web';
    mockOrdinateur = true;
    const arbre = await monter(<CollectiviteActualiteForm />);
    const lus = textes(arbre);
    const titre = lus.indexOf('Nouvelle actualité');
    expect(titre).toBeGreaterThan(0);
    expect(lus[titre - 1]).toBe('Actualités de la Ville');
    expect(croixDe(arbre)).toBeTruthy();
    await appuyer(croixDe(arbre));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('🔴 « Modifier l’actualité » quand on modifie', async () => {
    Platform.OS = 'web';
    mockParams = { ...VILLE, actualiteId: SUBVENTIONS.documentId };
    const arbre = await monter(<CollectiviteActualiteForm />);
    expect(textes(arbre)).toContain('Modifier l’actualité');
  });

  it('🔒 au téléphone, c’est l’en-tête natif qui le dit, pas le corps', async () => {
    const arbre = await monter(<CollectiviteActualiteForm />);
    expect(textes(arbre)).not.toContain('Nouvelle actualité');
    expect(croixDe(arbre)).toBeUndefined();
  });
});

// 🎨 FINITIONS-VILLE (08/10/2026, tournée T20 V26) — DEUX styles de pastille choisie dans l'espace
// de la Ville : « Nouvelle actualité » (fond sombre + liseré) et « Fermer » (cyan plein). Une seule
// pastille : celle de Fermer (PuceDeChoix, cyan plein). ROUGE avant le lot.
describe('FINITIONS-VILLE — une seule pastille choisie dans l’espace Ville', () => {
  it('le type et « Pour qui » choisis : cyan plein, comme le motif de « Fermer »', async () => {
    const couleurs = jest.requireActual('@/theme/colors').default();
    const fond = (/** @type {any} */ noeud) => [noeud.props.style].flat(Infinity)
      .reduce((tout, part) => ({ ...tout, ...part }), {}).backgroundColor;
    const arbre = await monter(<CollectiviteActualiteForm />);
    await appuyer(parTestID(arbre, 'actualite-form-type-travaux'));
    await appuyer(parTestID(arbre, 'actualite-form-pour-installation'));
    expect(fond(parTestID(arbre, 'actualite-form-type-travaux'))).toBe(couleurs.primary500);
    expect(fond(parTestID(arbre, 'actualite-form-pour-installation'))).toBe(couleurs.primary500);
    const autre = parTestID(arbre, 'actualite-form-type-subventions');
    expect(fond(autre)).not.toBe(couleurs.primary500);
  });
});
