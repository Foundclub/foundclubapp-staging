import { Text, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import AdminManagerRequests from '../AdminManagerRequests';
import ManagerRequestsLink from '../components/ManagerRequestsLink';

// 🏛️ COLL-ACCUEIL (01/10/2026) — PLANCHE 6 : la file « Demandes de gestionnaire » de la console
// (décision d'Adel « console oui » ; `P2-gestion-tel` / `-ordi`). ROUGE avant le lot : l'écran
// n'existait pas. Ce que le témoin fige :
//   - la file en attente : la personne, sa fonction, son e-mail pro, la Ville et « Existe » /
//     « Pas encore sur FoundClub » ;
//   - une demande ouverte : la personne, la Ville et ce qu'elle a déjà, le conseil de
//     vérification, « Valider » et « Refuser » ;
//   - valider (Ville existante) ; valider en CRÉANT la Ville : nom officiel et code exigés ;
//   - refuser : le motif est OBLIGATOIRE, trois motifs en un appui ;
//   - « Traitées » : l'issue, la date, qui a tranché, le motif d'un refus ; la file vide ;
//   - « Ouvrir dans la file » depuis la fiche d'une collectivité.

/** @type {any} */
let mockEnAttente;
/** @type {any} */
let mockTraitees;
/** @type {any} */
let mockParams;
const mockTrancher = jest.fn();
const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ canGoBack: () => true, navigate: mockNavigate }),
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

jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useAdminManagerRequests: (/** @type {string} */ statut) => (
    statut === 'decided' ? mockTraitees : mockEnAttente
  ),
  useDecideManagerRequest: () => ({ isPending: false, mutateAsync: mockTrancher }),
}));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) {
    return children;
  },
);
jest.mock(
  '@/components/atoms/loader/Loader',
  () => function LoaderMock() {
    return null;
  },
);
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { disabled: props.disabled, onPress: props.onPress, testID: `bouton-${props.title}` },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => {
  const reactActuel = jest.requireActual('react');
  const {
    Text: TexteRN,
    TouchableOpacity: PressableRN,
    View: Vue,
  } = jest.requireActual('react-native');
  return function SegmentedControlMock(/** @type {any} */ { onChange, options }) {
    return reactActuel.createElement(
      Vue,
      null,
      options.map((option) => reactActuel.createElement(
        PressableRN,
        {
          key: option.value,
          onPress: () => onChange(option.value),
          testID: `onglet-${option.value}`,
        },
        reactActuel.createElement(TexteRN, null, option.label),
      )),
    );
  };
});

const lu = (/** @type {any[]} */ data) => ({
  data,
  error: null,
  isLoading: false,
  refetch: jest.fn(),
});

const MONTRIVAGE = {
  collectivite: {
    clubsCount: 3,
    codeInsee: '13998',
    documentId: 'ville-montrivage',
    exists: true,
    gestionnaires: ['Karim Benali'],
    isActive: true,
    name: 'Ville de Montrivage',
    type: 'commune',
  },
  createdAt: '2026-10-01T09:00:00.000Z',
  decidedAt: null,
  decidedBy: null,
  documentId: 'dm-1',
  jobTitle: 'Service des sports',
  professionalEmail: 'sports@montrivage.fr',
  refusalReason: null,
  requester: {
    documentId: 'agent',
    firstname: 'Agnès',
    lastname: 'Mairie',
    phone: '+33600000010',
  },
  status: 'pending',
};
const VALFLEURI = {
  ...MONTRIVAGE,
  collectivite: {
    clubsCount: 0,
    codeInsee: null,
    documentId: null,
    exists: false,
    gestionnaires: [],
    isActive: false,
    name: 'Valfleuri',
    type: 'commune',
  },
  documentId: 'dm-2',
  requester: {
    documentId: 'paul',
    firstname: 'Paul',
    lastname: 'Valfleuri',
    phone: null,
  },
};

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
const textes = (/** @type {any} */ arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ n) => aplatirTexte(n.props.children).trim());
const monter = async (/** @type {any} */ element) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(element);
  });
  return arbre;
};
const appuyer = async (/** @type {any} */ arbre, /** @type {string} */ testID) => {
  const [cible] = arbre.root.findAll(
    (/** @type {any} */ n) => n.props?.testID === testID && typeof n.props?.onPress === 'function',
  );
  expect(cible).toBeDefined();
  await act(async () => {
    await cible.props.onPress();
  });
};
const saisir = async (
  /** @type {any} */ arbre,
  /** @type {string} */ testID,
  /** @type {string} */ valeur,
) => {
  const [champ] = arbre.root.findAll(
    (/** @type {any} */ n) => n.type === TextInput && n.props.testID === testID,
  );
  await act(async () => {
    champ.props.onChangeText(valeur);
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockEnAttente = lu([MONTRIVAGE, VALFLEURI]);
  mockTraitees = lu([]);
  mockTrancher.mockResolvedValue({ data: {} });
});

describe('COLL-ACCUEIL — planche 6 : la file des demandes de gestionnaire', () => {
  it('la file : la personne, sa fonction, son e-mail, la Ville et son état', async () => {
    const lus = textes(await monter(<AdminManagerRequests />));
    expect(lus).toEqual(
      expect.arrayContaining([
        'Demandes de gestionnaire',
        'En attente (2)',
        'Agnès Mairie',
        'Service des sports · sports@montrivage.fr',
        'Ville de Montrivage',
        'Existe',
        'Valfleuri',
        'Pas encore sur FoundClub',
      ]),
    );
  });

  it('une demande ouverte : la personne, la Ville, le conseil, les deux gestes', async () => {
    const arbre = await monter(<AdminManagerRequests />);
    await appuyer(arbre, 'gestionnaire-demande-dm-1');
    expect(textes(arbre)).toEqual(
      expect.arrayContaining([
        'Fonction : Service des sports',
        'sports@montrivage.fr',
        'Téléphone du compte : +33600000010',
        'Active · 3 clubs · gestionnaires : Karim Benali',
        'Refuser',
        'Valider : nommer gestionnaire',
      ]),
    );
    expect(
      textes(arbre).some((texte) => texte.startsWith('Avant de valider : appelle le standard')),
    ).toBe(true);
  });

  it('valider une Ville EXISTANTE : la personne devient gestionnaire', async () => {
    const arbre = await monter(<AdminManagerRequests />);
    await appuyer(arbre, 'gestionnaire-demande-dm-1');
    await appuyer(arbre, 'bouton-Valider : nommer gestionnaire');
    expect(textes(arbre)).toContain('Agnès Mairie devient gestionnaire de Ville de Montrivage.');
    await appuyer(arbre, 'bouton-Valider');
    expect(mockTrancher).toHaveBeenCalledWith({ data: {}, decision: 'accept', requestId: 'dm-1' });
  });

  it('valider en CRÉANT la Ville : nom officiel et code INSEE ou SIREN exigés', async () => {
    const arbre = await monter(<AdminManagerRequests />);
    await appuyer(arbre, 'gestionnaire-demande-dm-2');
    await appuyer(arbre, 'bouton-Valider et créer la Ville');
    expect(textes(arbre)).toContain('Valfleuri n’existe pas encore.');
    const confirmer = () => arbre.root.findAll(
      (/** @type {any} */ n) => n.props?.testID === 'bouton-Valider et créer la Ville'
          && typeof n.props?.onPress === 'function',
    )[0];
    // La fenêtre est rendue AVANT la fiche : son bouton est le premier des deux.
    await act(async () => {
      await confirmer().props.onPress();
    });
    expect(mockTrancher).not.toHaveBeenCalled();
    expect(textes(arbre).some((texte) => texte.startsWith('Écris le nom officiel'))).toBe(true);
    await saisir(arbre, 'gestionnaire-nomOfficiel', 'Ville de Valfleuri');
    await act(async () => {
      await confirmer().props.onPress();
    });
    expect(textes(arbre).some((texte) => texte.startsWith('Un code INSEE (5 caractères)'))).toBe(
      true,
    );
    await saisir(arbre, 'gestionnaire-codeInsee', '13999');
    await act(async () => {
      await confirmer().props.onPress();
    });
    expect(mockTrancher).toHaveBeenCalledWith({
      data: { codeInsee: '13999', name: 'Ville de Valfleuri' },
      decision: 'accept',
      requestId: 'dm-2',
    });
  });

  it('refuser : le motif est OBLIGATOIRE ; un motif fréquent se pose en un appui', async () => {
    const arbre = await monter(<AdminManagerRequests />);
    await appuyer(arbre, 'gestionnaire-demande-dm-1');
    await appuyer(arbre, 'bouton-Refuser');
    await appuyer(arbre, 'bouton-Refuser la demande');
    expect(mockTrancher).not.toHaveBeenCalled();
    expect(textes(arbre)).toContain('Le motif est obligatoire : la personne le lira.');
    await appuyer(arbre, 'gestionnaire-motif-lien');
    await appuyer(arbre, 'bouton-Refuser la demande');
    expect(mockTrancher).toHaveBeenCalledWith({
      data: {
        reason:
          // eslint-disable-next-line max-len
          'Nous n’avons pas pu vérifier votre lien avec la mairie. Écrivez-nous depuis l’adresse officielle du service.',
      },
      decision: 'refuse',
      requestId: 'dm-1',
    });
  });

  it('« Traitées » : l issue, la date, qui a tranché, et le motif d un refus', async () => {
    mockTraitees = lu([
      {
        ...MONTRIVAGE,
        decidedAt: '2026-10-02T09:00:00.000Z',
        decidedBy: 'Adel F',
        status: 'accepted',
      },
      {
        ...VALFLEURI,
        decidedAt: '2026-10-02T09:00:00.000Z',
        refusalReason: 'Lien non vérifié.',
        status: 'refused',
      },
    ]);
    const arbre = await monter(<AdminManagerRequests />);
    await appuyer(arbre, 'onglet-decided');
    const lus = textes(arbre);
    expect(lus).toEqual(expect.arrayContaining(['Validée', 'Refusée', '« Lien non vérifié. »']));
    expect(lus.some((texte) => /^Ville de Montrivage · le .+ par Adel F$/.test(texte))).toBe(true);
  });

  it('la file vide le dit', async () => {
    mockEnAttente = lu([]);
    const lus = textes(await monter(<AdminManagerRequests />));
    expect(lus).toEqual(
      expect.arrayContaining([
        'Aucune demande en attente.',
        'Les inscriptions « Je représente une collectivité » arrivent ici.',
      ]),
    );
  });

  it('« Ouvrir dans la file » depuis une fiche ouvre la demande de CETTE Ville', async () => {
    mockParams = { collectiviteId: 'ville-montrivage' };
    const lus = textes(await monter(<AdminManagerRequests />));
    expect(lus).toContain('Fonction : Service des sports');
  });
});

// FINITIONS14 · point 5 (T13-bis, planche 17 « Demandes de gestionnaire », téléphone) — la
// planche empile « Valider : nommer gestionnaire » AU-DESSUS de « Refuser » (état 2) ; l'écran
// faisait l'inverse. Sur le site (planche ordi, état A), « Refuser » reste à gauche du geste
// principal. Et les dates s'écrivent comme la planche : « jeu. 1 oct. », plus « jeu 01/10/2026 ».
describe('FINITIONS14 · planche 17 — l ordre des gestes et la date', () => {
  /**
   * L'ordre d'apparition des deux gestes dans l'arbre (= de haut en bas sur téléphone).
   * @param {any} arbre - L'arbre monté.
   * @returns {string[]} Les libellés des deux gestes, dans l'ordre.
   */
  const ordreDesGestes = (arbre) => textes(arbre)
    .filter((texte) => texte === 'Refuser' || texte === 'Valider : nommer gestionnaire');

  it('🚨 téléphone : « Valider » au-dessus de « Refuser »', async () => {
    const arbre = await monter(<AdminManagerRequests />);
    await appuyer(arbre, 'gestionnaire-demande-dm-1');
    expect(ordreDesGestes(arbre)).toEqual(['Valider : nommer gestionnaire', 'Refuser']);
  });

  it('🚨 la date de la demande : « jeu. 1 oct. », plus « jeu 01/10/2026 »', async () => {
    const lus = textes(await monter(<AdminManagerRequests />));
    expect(lus).toContain('jeu. 1 oct.');
    expect(lus.some((texte) => texte.includes('01/10/2026'))).toBe(false);
  });
});

describe('COLL-ACCUEIL — planche 6 : les portes de la file dans la console', () => {
  it('la liste des collectivités : l entrée de la file, avec le nombre en attente', async () => {
    const arbre = await monter(<ManagerRequestsLink />);
    expect(textes(arbre)).toEqual(expect.arrayContaining(['Demandes de gestionnaire', '2']));
    await appuyer(arbre, 'gestionnaire-entree-file');
    expect(mockNavigate).toHaveBeenCalledWith('AdminManagerRequests', undefined);
  });

  it('la fiche : SEULEMENT « Ouvrir dans la file », si une demande l attend', async () => {
    const arbre = await monter(<ManagerRequestsLink collectiviteId="ville-montrivage" />);
    expect(textes(arbre)).toContain('Ouvrir dans la file');
    await appuyer(arbre, 'gestionnaire-ouvrir-file');
    expect(mockNavigate).toHaveBeenCalledWith('AdminManagerRequests', {
      collectiviteId: 'ville-montrivage',
    });
    const autre = await monter(<ManagerRequestsLink collectiviteId="ville-sans-demande" />);
    expect(autre.toJSON()).toBeNull();
  });
});

// VT18E (07/10/2026), ajout T18 (a) — tournée T18 (SITE_S14) : « Recette Mairie » gérait déjà la
// Ville de Montrivage et demandait Rouvres ; rien ne le disait. Le serveur porte désormais
// `requester.managedCollectivites` (admin, COLL-ACCUEIL G12) : la ligne de la file ET la demande
// ouverte le disent. Rien quand la personne ne gère rien. ROUGE avant le lot.
describe('VT18E — la personne gère déjà une autre collectivité', () => {
  it('la ligne de la file et la demande ouverte disent « Gère déjà : … »', async () => {
    mockEnAttente = lu([
      {
        ...MONTRIVAGE,
        collectivite: {
          ...MONTRIVAGE.collectivite, documentId: 'ville-rouvres', name: 'Ville de Rouvres',
        },
        requester: {
          ...MONTRIVAGE.requester,
          managedCollectivites: [
            { documentId: 'ville-montrivage', name: 'Ville de Montrivage' },
            { documentId: 'ville-autre', name: 'Autre Ville' },
          ],
        },
      },
      VALFLEURI,
    ]);
    const arbre = await monter(<AdminManagerRequests />);
    const deja = 'Gère déjà : Ville de Montrivage, Autre Ville';
    const lire = (/** @type {string} */ testID) => arbre.root
      .findAll((n) => n.props?.testID === testID && n.type === Text)
      .map((n) => aplatirTexte(n.props.children).trim());
    expect(lire('gestionnaire-gere-deja-dm-1')).toEqual([deja]);
    // La personne de Valfleuri ne gère rien : sa ligne ne dit rien.
    expect(textes(arbre).filter((texte) => texte.startsWith('Gère déjà'))).toEqual([deja]);

    await appuyer(arbre, 'gestionnaire-demande-dm-1');
    expect(lire('gestionnaire-gere-deja-fiche')).toEqual([deja]);
  });
});
