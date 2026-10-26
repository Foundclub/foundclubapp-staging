import { Alert, Text, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ChildCardPage from '../ChildCardPage';

/**
 * PAR-L13 (13/10, design parent planche 13) — LA CARTE DE COLLECTION D UN ENFANT DECLARE.
 *
 * E28 — juste après « Déclarer mon enfant » : sa carte, et LÀ on demande maillot, poste, ville et
 *       nationalité (« C'est pour sa carte qu'on te demande ça »), ou « Plus tard ».
 * E29 — depuis sa fiche : la carte complète, « Ajouter sa photo », « Ni code ni lien », partager,
 *       enregistrer l'image.
 * E30 — AVANT tout partage, la feuille « ce qui part » (décision d'Adel du 12/10, registre des
 *       mineurs ligne 23) : elle nomme photo, ville et nationalité, et dit qu'aucun code ni lien
 *       ne part.
 * 🔒 Jamais de code QR : aucune carte rendue par cet écran ne porte de `qrValue`.
 */

/** @type {any[]} */
let mockCartes = [];
const mockModifier = jest.fn();
const mockPhoto = jest.fn();
const mockChoisir = jest.fn();
const mockPartager = jest.fn();
const mockEnregistrerImage = jest.fn();

jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  const lire = (/** @type {string} */ chemin) => chemin.split('.').reduce(
    (/** @type {any} */ noeud, /** @type {string} */ segment) => (
      noeud && typeof noeud === 'object' ? noeud[segment] : undefined
    ),
    traductions,
  );
  const t = (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ options) => {
    const source = (repli && typeof repli === 'object' ? repli : options) || {};
    const valeur = lire(cle);
    if (typeof valeur !== 'string') return typeof repli === 'string' ? repli : cle;
    return valeur.replace(
      /\{\{(\w+)\}\}/g,
      (/** @type {string} */ _tout, /** @type {string} */ clef) => String(source[clef] ?? ''),
    );
  };
  return { useTranslation: () => ({ t }) };
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
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: espaces,
    }),
  };
});

jest.mock('@/components/organisms/playerCard/PlayerCard', () => ({
  __esModule: true,
  CARD_EXPORT_WIDTH: 992,
  default: (/** @type {any} */ props) => {
    mockCartes.push(props);
    return null;
  },
}));

jest.mock('@/domains/playerCard/useShareCard', () => ({
  __esModule: true,
  default: () => ({
    cardRef: { current: null },
    isBusy: false,
    saveCardToGallery: mockEnregistrerImage,
    shareCard: mockPartager,
  }),
}));

jest.mock('@/services/declaredChild/declaredChildQueries', () => ({
  useSetDeclaredChildPhoto: () => ({ isPending: false, mutate: mockPhoto }),
  useUpdateDeclaredChild: () => ({ isPending: false, mutate: mockModifier }),
}));

jest.mock('@/domains/messaging/photoDuGroupe', () => ({
  choisirLaPhotoDuGroupe: (/** @type {any[]} */ ...args) => mockChoisir(...args),
}));

jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children, isVisible }) => (
      isVisible ? <View testID="feuille-ce-qui-part">{children}</View> : null
    ),
  };
});

jest.mock('@/components/templates/ScreenContainer', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => (
      <View keyboardAvoiding={props.keyboardAvoiding} keyboardScroll={props.keyboardScroll}>
        {props.children}
      </View>
    ),
  };
});

jest.mock('@/utils/imageUrl', () => ({
  getImageUrl: (/** @type {string} */ url) => `https://cdn.test${url}`,
}));

/**
 * Aplati les enfants React en une chaîne.
 * @param {any} enfants - Les enfants React.
 * @returns {string} Le texte.
 */
const aplatir = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};

/**
 * Tout le texte visible.
 * @param {any} arbre - L arbre rendu.
 * @returns {string} Le texte, morceaux séparés par « | ».
 */
const texteVisible = (arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ n) => aplatir(n.props.children))
  .join(' | ');

/**
 * L élément appuyable dont le texte contient ce libellé.
 * @param {any} arbre - L arbre rendu.
 * @param {string} libelle - Le libellé.
 * @returns {any} L élément.
 */
const bouton = (arbre, libelle) => {
  const trouve = arbre.root.findAll((/** @type {any} */ n) => (
    typeof n.props?.onPress === 'function'
    && n.findAllByType(Text)
      .some((/** @type {any} */ txt) => aplatir(txt.props.children) === libelle)
  ));
  if (!trouve.length) throw new Error(`bouton introuvable : ${libelle}`);
  return trouve[trouve.length - 1];
};

/**
 * Appuie sur un bouton.
 * @param {any} arbre - L arbre rendu.
 * @param {string} libelle - Son libellé.
 * @returns {Promise<void>} Rien.
 */
const appuyer = async (arbre, libelle) => {
  await act(async () => { await bouton(arbre, libelle).props.onPress(); });
};

/**
 * Saisit dans le champ portant ce repère.
 * @param {any} arbre - L arbre rendu.
 * @param {string} repere - Le `testID`.
 * @param {string} valeur - Ce qu on tape.
 * @returns {Promise<void>} Rien.
 */
const saisir = async (arbre, repere, valeur) => {
  const champ = arbre.root.findAll((/** @type {any} */ n) => (
    n.type === TextInput && n.props?.testID === repere
  ))[0];
  if (!champ) throw new Error(`champ introuvable : ${repere}`);
  await act(async () => { champ.props.onChangeText(valeur); });
};

const ANISSA_NEUVE = {
  age: 11,
  documentId: 'anissa',
  firstname: 'Anissa',
  lastname: 'Dubelloy',
  number: null,
  photo: null,
  position: null,
  team: null,
};

const ANISSA = {
  ...ANISSA_NEUVE,
  city: 'Marseille',
  club: { documentId: 'club-fc', name: 'FoundClub' },
  nationality: 'Française',
  number: 7,
  position: 'Meneuse',
  team: { documentId: 'u11', name: 'U11 Filles' },
};

/**
 * Monte la page.
 * @param {any} props - Les propriétés.
 * @returns {Promise<any>} L arbre rendu.
 */
const rendre = async (props) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    // eslint-disable-next-line react/jsx-props-no-spreading
    arbre = renderer.create(<ChildCardPage onFini={jest.fn()} {...props} />);
  });
  return arbre;
};

const derniereCarte = () => mockCartes[mockCartes.length - 1];

beforeEach(() => {
  jest.clearAllMocks();
  mockCartes = [];
});

describe('PAR-L13 E28 — sa carte, juste après sa déclaration', () => {
  test('🔴 « Nouveau », son titre, la phrase, les 4 champs et les 2 boutons', async () => {
    const texte = texteVisible(await rendre({ enfant: ANISSA_NEUVE, nouvelle: true }));

    ['Nouveau', 'La carte d’Anissa',
      'C’est pour sa carte qu’on te demande ça. Tu peux le faire plus tard.',
      'Numéro de maillot', 'Poste', 'Ville (facultatif)', 'Nationalité (facultatif)',
      'Enregistrer sa carte', 'Plus tard'].forEach((attendu) => expect(texte).toContain(attendu));
  });

  test('🔴 la carte : numéro « ? », pas d équipe, aucun statut, JAMAIS de code QR', async () => {
    await rendre({ enfant: ANISSA_NEUVE, nouvelle: true });

    expect(derniereCarte()).toMatchObject({
      equipe: 'Pas encore d’équipe', nom: 'DUBELLOY', numero: '?', prenom: 'Anissa', statut: null,
    });
    expect(mockCartes.every((carte) => carte.qrValue === undefined)).toBe(true);
  });

  test('🔴 la carte se remplit à mesure qu on tape', async () => {
    const arbre = await rendre({ enfant: ANISSA_NEUVE, nouvelle: true });
    await saisir(arbre, 'child-card-number', '7');
    await saisir(arbre, 'child-card-city', 'Marseille');

    expect(derniereCarte()).toMatchObject({ numero: '7', ville: 'Marseille' });
  });

  test('🔴 « Enregistrer sa carte » envoie les 4 champs, puis revient à la liste', async () => {
    const onFini = jest.fn();
    const arbre = await rendre({ enfant: ANISSA_NEUVE, nouvelle: true, onFini });
    await saisir(arbre, 'child-card-number', '7');
    await saisir(arbre, 'child-card-position', 'Meneuse');
    await saisir(arbre, 'child-card-city', 'Marseille');
    await saisir(arbre, 'child-card-nationality', 'Française');
    await appuyer(arbre, 'Enregistrer sa carte');

    expect(mockModifier.mock.calls[0][0]).toEqual({
      documentId: 'anissa',
      payload: {
        city: 'Marseille', nationality: 'Française', number: 7, position: 'Meneuse',
      },
    });
    expect(onFini).not.toHaveBeenCalled();
    await act(async () => { mockModifier.mock.calls[0][1].onSuccess(); });
    expect(onFini).toHaveBeenCalledTimes(1);
  });

  test('🔴 un échec le DIT, et la saisie est gardée', async () => {
    const onFini = jest.fn();
    const arbre = await rendre({ enfant: ANISSA_NEUVE, nouvelle: true, onFini });
    await saisir(arbre, 'child-card-number', '7');
    await appuyer(arbre, 'Enregistrer sa carte');
    await act(async () => { mockModifier.mock.calls[0][1].onError(new Error('réseau')); });

    expect(texteVisible(arbre)).toContain('La carte n’a pas pu être enregistrée. Réessaie.');
    expect(onFini).not.toHaveBeenCalled();
    expect(derniereCarte().numero).toBe('7');
  });

  test('🔴 « Plus tard » revient à la liste sans rien envoyer', async () => {
    const onFini = jest.fn();
    const arbre = await rendre({ enfant: ANISSA_NEUVE, nouvelle: true, onFini });
    await appuyer(arbre, 'Plus tard');

    expect(onFini).toHaveBeenCalledTimes(1);
    expect(mockModifier).not.toHaveBeenCalled();
  });

  test('les champs restent au-dessus du clavier (conteneur qui évite le clavier)', async () => {
    const arbre = await rendre({ enfant: ANISSA_NEUVE, nouvelle: true });
    const conteneur = arbre.root.findAll((/** @type {any} */ n) => n.props?.keyboardAvoiding)[0];

    expect(conteneur?.props?.keyboardAvoiding).toBe(true);
  });
});

describe('PAR-L13 E29 — la carte complète, depuis sa fiche', () => {
  test('🔴 la carte, « Ajouter sa photo », « Ni code ni lien », partager, enregistrer', async () => {
    const arbre = await rendre({ enfant: ANISSA });
    const texte = texteVisible(arbre);

    ['La carte d’Anissa', 'Ajouter sa photo',
      'Ni code ni lien : la carte ne mène à aucune page.', 'Partager la carte d’Anissa',
      'Enregistrer l\'image'].forEach((attendu) => expect(texte).toContain(attendu));
    expect(texte).not.toContain('Nouveau');
    expect(arbre.root.findAllByType(TextInput)).toHaveLength(0);
    expect(derniereCarte()).toMatchObject({
      club: 'FoundClub',
      equipe: 'U11 Filles',
      nationalite: 'Française',
      numero: '7',
      ville: 'Marseille',
    });
    expect(mockCartes.every((carte) => carte.qrValue === undefined)).toBe(true);
  });

  test('🔴 « Ajouter sa photo » : la photo choisie part comme FICHIER sur SA fiche', async () => {
    const fichier = { name: 'a.jpg', type: 'image/jpeg', uri: 'file:///a.jpg' };
    mockChoisir.mockResolvedValue({ apercu: 'file:///a.jpg', fichier });
    const arbre = await rendre({ enfant: ANISSA });
    await appuyer(arbre, 'Ajouter sa photo');

    expect(mockChoisir.mock.calls[0][0]).toBe('galerie');
    expect(mockPhoto.mock.calls[0][0]).toEqual({ documentId: 'anissa', photo: fichier });
  });

  test('choisir puis annuler : rien ne part', async () => {
    mockChoisir.mockResolvedValue(null);
    const arbre = await rendre({ enfant: ANISSA });
    await appuyer(arbre, 'Ajouter sa photo');

    expect(mockPhoto).not.toHaveBeenCalled();
  });

  test('🔴 avec une photo : la carte la montre ; « Retirer sa photo » l efface', async () => {
    const arbre = await rendre({ enfant: { ...ANISSA, photo: { url: '/uploads/anissa.jpg' } } });

    expect(derniereCarte().photo).toEqual({ uri: 'https://cdn.test/uploads/anissa.jpg' });
    expect(texteVisible(arbre)).toContain('Changer sa photo');
    await appuyer(arbre, 'Retirer sa photo');
    expect(mockModifier.mock.calls[0][0])
      .toEqual({ documentId: 'anissa', payload: { photo: null } });
  });

  test('« Modifier sa carte » rouvre les champs, remplis, avec « Annuler »', async () => {
    const arbre = await rendre({ enfant: ANISSA });
    await appuyer(arbre, 'Modifier sa carte');

    const champ = arbre.root.findAll((/** @type {any} */ n) => (
      n.type === TextInput && n.props?.testID === 'child-card-city'
    ))[0];
    expect(champ.props.value).toBe('Marseille');
    expect(texteVisible(arbre)).toContain('Annuler');
    expect(texteVisible(arbre)).not.toContain('Plus tard');
  });

  test('« Enregistrer l\'image » enregistre la carte dans le téléphone', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockEnregistrerImage.mockResolvedValue('file:///carte.png');
    const arbre = await rendre({ enfant: ANISSA });
    await appuyer(arbre, 'Enregistrer l\'image');

    expect(mockEnregistrerImage).toHaveBeenCalledTimes(1);
  });
});

describe('PAR-L13 E30 — avant de partager, ce qui part', () => {
  test('🔴 « Partager » ouvre la feuille qui NOMME ce qui part, sans rien partager', async () => {
    const arbre = await rendre({ enfant: ANISSA });
    await appuyer(arbre, 'Partager la carte d’Anissa');
    const texte = texteVisible(arbre);

    ['Partager la carte d’Anissa ?', 'Tu envoies une image, sans lien vers elle.',
      'Ce qui apparaît',
      'Sa photo si tu en as mis une, son prénom et son nom, son âge, son équipe,'
        + ' son numéro, son poste, sa ville et sa nationalité.',
      'Ce qui n’apparaît jamais', 'Un code ou un lien vers sa fiche.', 'Partager l’image',
      'Annuler'].forEach((attendu) => expect(texte).toContain(attendu));
    expect(mockPartager).not.toHaveBeenCalled();
  });

  test('🔴 « Partager l’image » partage l IMAGE, sans aucun lien dans le message', async () => {
    mockPartager.mockResolvedValue({ outcome: 'shared' });
    const arbre = await rendre({ enfant: ANISSA });
    await appuyer(arbre, 'Partager la carte d’Anissa');
    await appuyer(arbre, 'Partager l’image');

    expect(mockPartager).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(mockPartager.mock.calls[0][0] || {})).not.toMatch(/https?:|foundclub\.app/);
  });

  test('« Annuler » ferme la feuille : rien ne part', async () => {
    const arbre = await rendre({ enfant: ANISSA });
    await appuyer(arbre, 'Partager la carte d’Anissa');
    await appuyer(arbre, 'Annuler');

    expect(mockPartager).not.toHaveBeenCalled();
    expect(arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === 'feuille-ce-qui-part'))
      .toHaveLength(0);
  });
});

test('un prénom qui ne s élide pas : « La carte de Léa »', async () => {
  const texte = texteVisible(await rendre({ enfant: { ...ANISSA, firstname: 'Léa' } }));

  expect(texte).toContain('La carte de Léa');
  expect(texte).toContain('Partager la carte de Léa');
});
