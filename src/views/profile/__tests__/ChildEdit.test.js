import { Text, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ChildEdit from '../ChildEdit';

/**
 * PARENT P2 — ÉCRAN 8 : « AJOUTER OU MODIFIER UN ENFANT ».
 *
 * Trois champs obligatoires, et pas un de plus que ce que le plan autorise
 * (C10) : prénom, nom, date de naissance. ⛔ Ni téléphone, ni e-mail, ni
 * adresse (on contacte SON PARENT), ni taille, ni poids (ce sont ces deux-là
 * qui obligent les magasins à une déclaration « données de santé »), ni
 * nationalité. La liste blanche du serveur les jette de toute façon — ce témoin
 * garantit que l'écran ne les DEMANDE même pas.
 *
 * 🔒 LA MODIFICATION NE PEUT PAS PRÉ-REMPLIR LA DATE DE NAISSANCE, et ce n'est
 * pas un oubli : le serveur ne la rend JAMAIS (il rend un âge calculé). L'écran
 * doit donc le dire, au lieu d'afficher trois cases vides sans explication.
 *
 * 🧒 LE PALIER 13 SE DIT AVANT D'ENVOYER. `isBirthdateUnderParentAccountAge`
 * existait dans l'app depuis des mois sans être appelé nulle part (§4.5 du
 * plan) : le palier ne tenait que sur le refus serveur. Il est branché ici.
 */

/** @type {any} */
let mockEnfants;
const mockCreer = jest.fn();
const mockModifier = jest.fn();
const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockReplace = jest.fn();
/** @type {any} */
let mockParams;
/** @type {any} */
let mockRouteName;
/** @type {any} */
let mockProchaineEtape;

jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    initReactI18next: { init: () => {}, type: '3rdParty' },
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ options) => {
        const brut = String(cle || '');
        const source = (repli && typeof repli === 'object' ? repli : options) || {};
        const valeur = brut.split('.').reduce(
          (/** @type {any} */ noeud, /** @type {string} */ segment) => (
            noeud && typeof noeud === 'object' ? noeud[segment] : undefined
          ),
          traductions,
        );
        if (typeof valeur === 'string') {
          return valeur.replace(
            /\{\{(\w+)\}\}/g,
            (/** @type {string} */ _tout, /** @type {string} */ clef) => String(source[clef] ?? ''),
          );
        }
        return typeof repli === 'string' ? repli : cle;
      },
    }),
  };
});

jest.mock('@/services/declaredChild/declaredChildQueries', () => ({
  useCreateDeclaredChild: () => ({ isPending: false, mutate: mockCreer }),
  useGetMyDeclaredChildren: () => ({ data: mockEnfants, error: undefined, isLoading: false }),
  useUpdateDeclaredChild: () => ({ isPending: false, mutate: mockModifier }),
}));

// PAR-L5L6 (E08) — une fiche CRÉÉE est annoncée à la liste (« La fiche d'Anissa est créée. »).
const mockAnnoncer = jest.fn();
jest.mock('@/views/profile/parent/annonceDeLaFiche', () => ({
  annoncer: (/** @type {any} */ annonce) => mockAnnoncer(annonce),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate, replace: mockReplace }),
  useRoute: () => ({ name: mockRouteName, params: mockParams }),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    getNextOnboardingRoute: () => mockProchaineEtape,
    getPostOnboardingHomeRoute: () => 'HomeTab',
    userData: { documentId: 'parent-1' },
  }),
}));

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

/**
 * 🎨 LE CONTENEUR EST RENDU AVEC SES VRAIES PROPS.
 *
 * On ne l'aplatit pas en `<View>` : le témoin ⑦ a besoin de LIRE
 * `keyboardAvoiding` et `keyboardScroll`. Sans les deux, le bouton du bas
 * devient inatteignable clavier ouvert — et AUCUNE porte ne mesure ça.
 */
jest.mock('@/components/templates/ScreenContainer', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => (
      <View
        keyboardAvoiding={props.keyboardAvoiding}
        keyboardScroll={props.keyboardScroll}
      >
        {props.children}
      </View>
    ),
  };
});

/**
 * Aplati les enfants React en une chaîne.
 * @param {any} enfants - Les enfants React.
 * @returns {string} Le texte.
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

/**
 * Tout le texte visible de l'écran.
 * @param {any} arbre - L'arbre rendu.
 * @returns {string} Le texte.
 */
const texteVisible = (arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children))
  .join(' | ');

/**
 * Monte l'écran.
 * @returns {Promise<any>} L'arbre rendu.
 */
const rendre = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ChildEdit />);
  });
  return arbre;
};

/**
 * Saisit une valeur dans le champ portant ce repère.
 * @param {any} arbre - L'arbre rendu.
 * @param {string} repere - Le `testID` du champ.
 * @param {string} valeur - Ce qu'on tape.
 * @returns {Promise<void>} Rien.
 */
const saisir = async (arbre, repere, valeur) => {
  const champ = arbre.root.findAll((/** @type {any} */ noeud) => (
    noeud.type === TextInput && noeud.props?.testID === repere
  ))[0];
  if (!champ) throw new Error(`champ introuvable : ${repere}`);
  await act(async () => { champ.props.onChangeText(valeur); });
};

/**
 * Appuie sur le bouton d'enregistrement.
 * @param {any} arbre - L'arbre rendu.
 * @returns {Promise<void>} Rien.
 */
const enregistrer = async (arbre) => {
  const bouton = arbre.root.findAll((/** @type {any} */ noeud) => (
    noeud.props?.testID === 'child-edit-submit' && typeof noeud.props?.onPress === 'function'
  ))[0];
  if (!bouton) throw new Error('bouton d’enregistrement introuvable');
  await act(async () => { bouton.props.onPress(); });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockEnfants = [];
  mockParams = undefined;
  mockRouteName = 'ChildEdit';
  mockProchaineEtape = null;
});

test("P2/8 ① l'écran ne demande QUE les champs autorisés", async () => {
  const arbre = await rendre();

  // 🔒 ON COMPTE LES CHAMPS, PAS LES MOTS. Chercher « téléphone » dans le texte
  // visible attraperait la phrase qui RASSURE le parent (« on ne demande ni
  // téléphone, ni adresse ») — un témoin qui interdit de DIRE ce qu'on ne
  // collecte pas mesure l'inverse de ce qu'il croit. Ce qui compte, c'est la
  // liste EXACTE des cases à remplir : ni téléphone, ni e-mail, ni adresse, ni
  // taille, ni poids, ni nationalité n'en fait partie (C10 du plan).
  const champs = arbre.root
    .findAllByType(TextInput)
    .map((/** @type {any} */ noeud) => noeud.props?.testID)
    .filter(Boolean)
    .sort();

  // PAR-L5L6 (E08, D2 « C » d'Adel du 12/10) — la CRÉATION garde trois champs (la date en
  // trois cases) : maillot et poste se demanderont sur la carte de l'enfant (lot L13). Ils
  // restent en MODIFICATION (témoin E09).
  expect(champs).toEqual([
    'child-day',
    'child-firstname',
    'child-lastname',
    'child-month',
    'child-year',
  ]);

  const texte = texteVisible(arbre).toLowerCase();
  expect(texte).toContain('prénom');
  expect(texte).toContain('nom');
  expect(texte).toContain('date de naissance');
});

test('P2/8 ② un enfant complet part avec ses trois champs obligatoires', async () => {
  const arbre = await rendre();

  await saisir(arbre, 'child-firstname', 'Léa');
  await saisir(arbre, 'child-lastname', 'Martin');
  await saisir(arbre, 'child-day', '04');
  await saisir(arbre, 'child-month', '05');
  await saisir(arbre, 'child-year', '2017');
  await enregistrer(arbre);

  expect(mockCreer).toHaveBeenCalledTimes(1);
  expect(mockCreer.mock.calls[0][0]).toEqual({
    birthdate: '2017-05-04',
    firstname: 'Léa',
    lastname: 'Martin',
  });
});

// PAR-L5L6 (E08) — le maillot ne se saisit plus à la création : la règle « un champ vide
// n'est pas un zéro » se vérifie là où il vit, en MODIFICATION (une fiche SANS numéro).
test('P2/8 ③ 🔢 un numéro de maillot laissé VIDE ne part pas en zéro', async () => {
  mockParams = { childDocumentId: 'enfant-1' };
  mockEnfants = [{
    age: 9, documentId: 'enfant-1', firstname: 'Léa', lastname: 'Martin', number: null,
  }];
  const arbre = await rendre();

  await saisir(arbre, 'child-number', '');
  await enregistrer(arbre);

  const { payload } = mockModifier.mock.calls[0][0];
  expect(Object.prototype.hasOwnProperty.call(payload, 'number')).toBe(false);
});

test("P2/8 ④ 🧒 LE PALIER 13 EST DIT AVANT D'ENVOYER : 25 ans n'atteint pas le serveur", async () => {
  const arbre = await rendre();

  await saisir(arbre, 'child-firstname', 'Paul');
  await saisir(arbre, 'child-lastname', 'Martin');
  await saisir(arbre, 'child-day', '04');
  await saisir(arbre, 'child-month', '05');
  await saisir(arbre, 'child-year', '2000');
  await enregistrer(arbre);

  expect(mockCreer).not.toHaveBeenCalled();
  expect(texteVisible(arbre)).toContain('13 ans');
});

test('P2/8 ⑤ MODIFIER : l\'écran DIT pourquoi la date de naissance est vide', async () => {
  mockParams = { childDocumentId: 'enfant-1' };
  mockEnfants = [{
    age: 9,
    documentId: 'enfant-1',
    firstname: 'Léa',
    lastname: 'Martin',
    number: 10,
    position: 'Gardienne',
  }];

  const arbre = await rendre();
  const texte = texteVisible(arbre);

  // Ce qui EST connu est pré-rempli...
  const prenom = arbre.root.findAll((/** @type {any} */ n) => (
    n.type === TextInput && n.props?.testID === 'child-firstname'
  ))[0];
  expect(prenom.props.value).toBe('Léa');
  // ...et ce qui ne peut pas l'être est EXPLIQUÉ, au lieu de trois cases muettes.
  expect(texte).toContain('Laisse vide pour ne pas la changer');
});

test('P2/8 ⑥ MODIFIER sans retoucher la date : la date n\'est PAS envoyée', async () => {
  mockParams = { childDocumentId: 'enfant-1' };
  mockEnfants = [{
    age: 9,
    documentId: 'enfant-1',
    firstname: 'Léa',
    lastname: 'Martin',
    number: null,
    position: null,
  }];

  const arbre = await rendre();
  await saisir(arbre, 'child-number', '7');
  await enregistrer(arbre);

  expect(mockModifier).toHaveBeenCalledTimes(1);
  const { documentId, payload } = mockModifier.mock.calls[0][0];
  expect(documentId).toBe('enfant-1');
  expect(Object.prototype.hasOwnProperty.call(payload, 'birthdate')).toBe(false);
  expect(payload.number).toBe(7);
});

test('P2/8 ⑦ 🎨 le bouton du bas reste ATTEIGNABLE clavier ouvert', async () => {
  const arbre = await rendre();

  // `ScreenContainer` ne monte un défilement QUE si on lui passe les DEUX
  // props : `keyboardScroll` seul ne fait rien sans `keyboardAvoiding`
  // (ScreenContainer.js — le défilement est à l'intérieur de l'évitement).
  // Cet écran porte 5 champs plus un bouton : clavier ouvert, la zone restante
  // ne les contient plus. Aucune porte ne mesure ça.
  const conteneur = arbre.root.findAll((/** @type {any} */ noeud) => (
    noeud.props?.keyboardScroll === true
  ));
  expect(conteneur.length).toBeGreaterThan(0);
  expect(conteneur[0].props.keyboardAvoiding).toBe(true);
});

// ─────────────────────────────────────────────────────────────────────────────
// PARENT P2 — LE MEME ECRAN, EN ETAPE D INSCRIPTION (decision d Adel du 10/09).
//
// ⚖️ « PLUS TARD » N EST PAS DU CONFORT. Un parent peut s inscrire juste pour
// CHERCHER un club avant de decider. Lui arracher le prenom, le nom et la date
// de naissance de son enfant avant qu il y ait un besoin reel, c est ce que la
// minimisation interdit (C8 du plan). L etape se VOIT ; elle ne s impose pas.
//
// 🔁 Et c est le MEME ecran que celui du profil, pas une copie : un formulaire
// qui manipule des donnees de mineur ne s ecrit pas deux fois — deux copies,
// c est deux endroits ou se tromper sur le palier des 13 ans.
// ─────────────────────────────────────────────────────────────────────────────
describe('PARENT P2 — « declare ton enfant » pendant l inscription', () => {
  test("P2/inscription ① l'etape offre une sortie « plus tard »", async () => {
    mockRouteName = 'UserChild';

    const texte = texteVisible(await rendre());

    expect(texte).toContain('Plus tard');
  });

  test('P2/inscription ② hors inscription, aucun « plus tard »', async () => {
    const texte = texteVisible(await rendre());

    expect(texte).not.toContain('Plus tard');
  });

  test('P2/inscription ③ « plus tard » AVANCE le tunnel, il ne recule pas', async () => {
    mockRouteName = 'UserChild';
    mockProchaineEtape = 'Welcome';
    const arbre = await rendre();

    const lien = arbre.root.findAll((/** @type {any} */ noeud) => (
      typeof noeud.props?.onPress === 'function'
      && aplatirTexte(noeud.props?.children).includes('Plus tard')
    ))[0];
    expect(lien).toBeTruthy();

    await act(async () => { lien.props.onPress(); });

    expect(mockNavigate).toHaveBeenCalledWith('Welcome');
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  test('P2/inscription ④ enfant declare : on AVANCE, on ne renvoie pas au profil', async () => {
    mockRouteName = 'UserChild';
    mockProchaineEtape = 'Welcome';
    const arbre = await rendre();

    await saisir(arbre, 'child-firstname', 'Lea');
    await saisir(arbre, 'child-lastname', 'Martin');
    await saisir(arbre, 'child-day', '04');
    await saisir(arbre, 'child-month', '05');
    await saisir(arbre, 'child-year', '2019');
    await enregistrer(arbre);

    expect(mockCreer).toHaveBeenCalledTimes(1);
    // Le succes de la mutation est simule par le mock : on declenche son
    // `onSuccess` a la main pour lire OU l ecran envoie ensuite.
    const options = mockCreer.mock.calls[0][1];
    await act(async () => { options.onSuccess(); });

    expect(mockNavigate).toHaveBeenCalledWith('Welcome');
    expect(mockGoBack).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DATENAISS (22/09) — Sentry SERVEUR-STRAPI-T : un vrai parent déclare un enfant
// né « dans le futur ». L'app laissait partir, le serveur refusait (400), et
// l'écran disait « pour le moment » : le parent croyait à une panne passagère et
// réessayait avec la même date.
// ─────────────────────────────────────────────────────────────────────────────
describe('DATENAISS — une date de naissance dans le futur', () => {
  /**
   * La date LOCALE du téléphone, décalée de `jours`, découpée en trois cases.
   * @param {number} jours - Le décalage depuis aujourd'hui.
   * @returns {{ day: string, month: string, year: string }} Les trois cases.
   */
  const casesDate = (jours) => {
    const date = new Date();
    date.setDate(date.getDate() + jours);
    return {
      day: String(date.getDate()).padStart(2, '0'),
      month: String(date.getMonth() + 1).padStart(2, '0'),
      year: String(date.getFullYear()),
    };
  };

  /**
   * Remplit le prénom, le nom et la date.
   * @param {any} arbre - L'arbre rendu.
   * @param {{ day: string, month: string, year: string }} date - Les trois cases.
   * @returns {Promise<void>} Rien.
   */
  const remplir = async (arbre, { day, month, year }) => {
    await saisir(arbre, 'child-firstname', 'Léa');
    await saisir(arbre, 'child-lastname', 'Martin');
    await saisir(arbre, 'child-day', day);
    await saisir(arbre, 'child-month', month);
    await saisir(arbre, 'child-year', year);
  };

  test("DATENAISS ① demain est refusé AVANT l'envoi, et l'écran dit pourquoi", async () => {
    const arbre = await rendre();

    await remplir(arbre, casesDate(1));
    await enregistrer(arbre);

    expect(mockCreer).not.toHaveBeenCalled();
    expect(texteVisible(arbre)).toContain('ne peut pas être dans le futur');
  });

  test('DATENAISS ② en modification, une date future ne part pas non plus', async () => {
    mockParams = { childDocumentId: 'enfant-1' };
    mockEnfants = [{
      age: 9,
      documentId: 'enfant-1',
      firstname: 'Léa',
      lastname: 'Martin',
    }];
    const arbre = await rendre();

    await remplir(arbre, casesDate(400));
    await enregistrer(arbre);

    expect(mockModifier).not.toHaveBeenCalled();
    expect(texteVisible(arbre)).toContain('ne peut pas être dans le futur');
  });

  test("DATENAISS ③ aujourd'hui reste accepté : un nouveau-né se déclare", async () => {
    const arbre = await rendre();

    await remplir(arbre, casesDate(0));
    await enregistrer(arbre);

    expect(mockCreer).toHaveBeenCalledTimes(1);
  });

  test('DATENAISS ④ un refus de VALIDATION du serveur fait vérifier la date', async () => {
    const arbre = await rendre();
    await remplir(arbre, { day: '04', month: '05', year: '2019' });
    await enregistrer(arbre);

    // La forme EXACTE que l'intercepteur rejette (client.native.js) : la charge
    // Strapi déballée, pas l'erreur axios.
    const options = mockCreer.mock.calls[0][1];
    await act(async () => {
      options.onError({
        details: {},
        message: 'birthdate: date de naissance dans le futur',
        name: 'ValidationError',
        status: 400,
      });
    });

    const texte = texteVisible(arbre);
    expect(texte).toContain('vérifie la date de naissance');
    expect(texte).not.toContain('pour le moment');
  });

  test.each([
    ['un 500', { message: 'Internal Server Error', name: 'InternalServerError', status: 500 }],
    ['un délai dépassé', {
      code: 'REQUEST_TIMEOUT_ABANDONED',
      message: 'Request timeout - please retry.',
      status: 0,
    }],
    ['pas de réseau', 'Network Error'],
  ])('DATENAISS ⑤ une VRAIE panne (%s) garde « pour le moment »', async (_nom, panne) => {
    const arbre = await rendre();
    await remplir(arbre, { day: '04', month: '05', year: '2019' });
    await enregistrer(arbre);

    const options = mockCreer.mock.calls[0][1];
    await act(async () => { options.onError(panne); });

    expect(texteVisible(arbre)).toContain('pour le moment');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PAR-L1-DATE-ENFANT (PAR-001, recette iPhone d'Adel du 11/10) — la date de
// naissance se tapait case par case : après « 03 », il fallait toucher la case
// du mois à la main, puis celle de l'année. Et une date impossible ne se disait
// qu'en bas de l'écran, après « Déclarer mon enfant ». Le motif du passage
// automatique existe déjà dans l'inscription (UserName.js, JJ ⇒ MM ⇒ AAAA) :
// cet écran le reprend.
// ─────────────────────────────────────────────────────────────────────────────
describe('PAR-L1 — la date de naissance passe seule de case en case', () => {
  const CASES_DATE = ['child-day', 'child-month', 'child-year'];

  /**
   * Le champ portant ce repère.
   * @param {any} arbre - L'arbre rendu.
   * @param {string} repere - Le `testID` du champ.
   * @returns {any} Le nœud du champ.
   */
  const champ = (arbre, repere) => arbre.root.findAll((/** @type {any} */ noeud) => (
    noeud.type === TextInput && noeud.props?.testID === repere
  ))[0];

  /**
   * 🎯 UN ESPION DE CURSEUR PAR CASE. Le `TextInput` du préréglage jest partage
   * UN SEUL `focus` sur son prototype : sans espion propre à chaque case, on ne
   * saurait pas QUELLE case a reçu le curseur.
   * @param {any} arbre - L'arbre rendu.
   * @returns {Record<string, jest.Mock>} Un espion par repère.
   */
  const espionnerCurseur = (arbre) => Object.fromEntries(CASES_DATE.map((repere) => {
    const { instance } = champ(arbre, repere);
    instance.focus = jest.fn();
    return [repere, instance.focus];
  }));

  /**
   * Appuie sur la touche « effacer » du clavier dans une case.
   * @param {any} arbre - L'arbre rendu.
   * @param {string} repere - Le `testID` de la case.
   * @returns {Promise<void>} Rien.
   */
  const effacer = async (arbre, repere) => {
    const noeud = champ(arbre, repere);
    await act(async () => { noeud.props.onKeyPress?.({ nativeEvent: { key: 'Backspace' } }); });
  };

  /**
   * Le message d'erreur affiché SOUS la date, ou rien.
   * @param {any} arbre - L'arbre rendu.
   * @returns {string} Son texte, ou une chaîne vide.
   */
  const erreurSousLaDate = (arbre) => {
    const blocDate = arbre.root.findAll((/** @type {any} */ noeud) => (
      noeud.props?.testID === 'child-birthdate'
    ))[0];
    if (!blocDate) return '';
    const erreur = blocDate.findAll((/** @type {any} */ noeud) => (
      noeud.type === Text && noeud.props?.testID === 'child-birthdate-error'
    ))[0];
    return erreur ? aplatirTexte(erreur.props.children) : '';
  };

  /**
   * Combien de fois ce texte apparaît à l'écran.
   * @param {any} arbre - L'arbre rendu.
   * @param {string} texte - Le texte cherché.
   * @returns {number} Le nombre d'apparitions.
   */
  const occurrences = (arbre, texte) => texteVisible(arbre).split(texte).length - 1;

  test('PAR-L1 ① 2 chiffres dans le jour ⇒ le curseur passe au mois (pas 1)', async () => {
    const arbre = await rendre();
    const curseur = espionnerCurseur(arbre);

    await saisir(arbre, 'child-day', '0');
    expect(curseur['child-month']).not.toHaveBeenCalled();

    await saisir(arbre, 'child-day', '03');
    expect(curseur['child-month']).toHaveBeenCalledTimes(1);
    expect(curseur['child-year']).not.toHaveBeenCalled();
  });

  test('PAR-L1 ② 2 chiffres dans le mois ⇒ le curseur passe à l’année', async () => {
    const arbre = await rendre();
    const curseur = espionnerCurseur(arbre);

    await saisir(arbre, 'child-month', '0');
    expect(curseur['child-year']).not.toHaveBeenCalled();

    await saisir(arbre, 'child-month', '05');
    expect(curseur['child-year']).toHaveBeenCalledTimes(1);
  });

  test('PAR-L1 ③ la touche « suivant » du clavier fait le même chemin', async () => {
    const arbre = await rendre();
    const curseur = espionnerCurseur(arbre);

    expect(champ(arbre, 'child-day').props.enterKeyHint).toBe('next');
    expect(champ(arbre, 'child-month').props.enterKeyHint).toBe('next');
    expect(champ(arbre, 'child-year').props.enterKeyHint).toBe('done');

    await act(async () => { champ(arbre, 'child-day').props.onSubmitEditing(); });
    expect(curseur['child-month']).toHaveBeenCalledTimes(1);
    await act(async () => { champ(arbre, 'child-month').props.onSubmitEditing(); });
    expect(curseur['child-year']).toHaveBeenCalledTimes(1);
  });

  test('PAR-L1 ④ effacer dans une case VIDE revient à la case d’avant', async () => {
    const arbre = await rendre();
    const curseur = espionnerCurseur(arbre);

    // Le mois est vide : « effacer » ramène au jour.
    await effacer(arbre, 'child-month');
    expect(curseur['child-day']).toHaveBeenCalledTimes(1);

    // L'année est vide : « effacer » ramène au mois.
    await effacer(arbre, 'child-year');
    expect(curseur['child-month']).toHaveBeenCalledTimes(1);

    // Une case qui a encore un chiffre : « effacer » efface ce chiffre, le
    // curseur ne bouge pas.
    await saisir(arbre, 'child-year', '2');
    await effacer(arbre, 'child-year');
    expect(curseur['child-month']).toHaveBeenCalledTimes(1);

    // Le jour n'a pas de case d'avant : rien ne bouge.
    await effacer(arbre, 'child-day');
    expect(curseur['child-day']).toHaveBeenCalledTimes(1);
  });

  test('PAR-L1 ⑤ on peut toujours corriger une case : 03/05/2016 devient 03/06/2016', async () => {
    const arbre = await rendre();
    const curseur = espionnerCurseur(arbre);

    await saisir(arbre, 'child-firstname', 'Léa');
    await saisir(arbre, 'child-lastname', 'Martin');
    await saisir(arbre, 'child-day', '03');
    await saisir(arbre, 'child-month', '05');
    await saisir(arbre, 'child-year', '2016');

    // Le parent retouche le mois : il l'efface, tape « 06 », et le curseur
    // repart vers l'année comme au premier passage.
    await saisir(arbre, 'child-month', '0');
    await saisir(arbre, 'child-month', '06');
    expect(curseur['child-year']).toHaveBeenCalledTimes(2);

    await enregistrer(arbre);
    expect(mockCreer).toHaveBeenCalledTimes(1);
    expect(mockCreer.mock.calls[0][0].birthdate).toBe('2016-06-03');
  });

  test('PAR-L1 ⑥ chaque case a un nom pour le lecteur d’écran : Jour de naissance, Mois de naissance, Année de naissance (noms B)', async () => {
    const arbre = await rendre();

    expect(CASES_DATE.map((repere) => champ(arbre, repere).props.accessibilityLabel))
      .toEqual(['Jour de naissance', 'Mois de naissance', 'Année de naissance']);
  });

  test('PAR-L1 ⑦ 31/02/2016 ⇒ « Cette date n’existe pas. » SOUS la date, sans envoi', async () => {
    const arbre = await rendre();

    await saisir(arbre, 'child-firstname', 'Léa');
    await saisir(arbre, 'child-lastname', 'Martin');
    await saisir(arbre, 'child-day', '31');
    await saisir(arbre, 'child-month', '02');
    await saisir(arbre, 'child-year', '2016');

    expect(erreurSousLaDate(arbre)).toBe('Cette date n’existe pas.');

    // À l'envoi, la fiche ne part pas, et la phrase n'est pas dite deux fois.
    await enregistrer(arbre);
    expect(mockCreer).not.toHaveBeenCalled();
    expect(occurrences(arbre, 'Cette date n’existe pas.')).toBe(1);
  });

  test('PAR-L1 ⑧ tant que l’année n’est pas finie, aucune erreur ne s’affiche', async () => {
    const arbre = await rendre();

    await saisir(arbre, 'child-day', '31');
    await saisir(arbre, 'child-month', '02');
    await saisir(arbre, 'child-year', '201');

    expect(erreurSousLaDate(arbre)).toBe('');
  });

  test('PAR-L1 ⑨ corriger le jour efface l’erreur', async () => {
    const arbre = await rendre();

    await saisir(arbre, 'child-day', '31');
    await saisir(arbre, 'child-month', '02');
    await saisir(arbre, 'child-year', '2016');
    expect(erreurSousLaDate(arbre)).toBe('Cette date n’existe pas.');

    await saisir(arbre, 'child-day', '2');
    await saisir(arbre, 'child-day', '28');
    expect(erreurSousLaDate(arbre)).toBe('');
  });

  test('PAR-L1 ⑩ une date future se dit SOUS la date, avant même d’enregistrer', async () => {
    const arbre = await rendre();
    const demain = new Date();
    demain.setDate(demain.getDate() + 1);

    await saisir(arbre, 'child-day', String(demain.getDate()).padStart(2, '0'));
    await saisir(arbre, 'child-month', String(demain.getMonth() + 1).padStart(2, '0'));
    await saisir(arbre, 'child-year', String(demain.getFullYear()));

    expect(erreurSousLaDate(arbre)).toBe('La date de naissance ne peut pas être dans le futur.');
  });

  test('PAR-L1 ⑪ 14 ans ⇒ le palier des 13 ans se dit sous la date (règle inchangée)', async () => {
    const arbre = await rendre();

    await saisir(arbre, 'child-day', '01');
    await saisir(arbre, 'child-month', '01');
    await saisir(arbre, 'child-year', String(new Date().getFullYear() - 14));

    expect(erreurSousLaDate(arbre)).toContain('13 ans');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PAR-L5L6 (13/10) — E08 : AJOUTER UN ENFANT EN TROIS CHAMPS (design parent, planche 4).
// Le texte « Trois informations suffisent » devient vrai ; après « Déclarer mon enfant », la
// liste dit « La fiche d'Anissa est créée. » ; le palier des 13 ans ouvre une issue.
// ─────────────────────────────────────────────────────────────────────────────
describe('PAR-L5L6 E08 — ajouter un enfant', () => {
  /**
   * Remplit les trois champs de la création.
   * @param {any} arbre - L'arbre rendu.
   * @param {string} annee - L'année de naissance.
   * @returns {Promise<void>} Rien.
   */
  const remplir = async (arbre, annee = '2015') => {
    await saisir(arbre, 'child-firstname', 'Anissa');
    await saisir(arbre, 'child-lastname', 'Test');
    await saisir(arbre, 'child-day', '03');
    await saisir(arbre, 'child-month', '05');
    await saisir(arbre, 'child-year', annee);
  };

  test('🔴 « Trois informations suffisent » : et il n y en a QUE trois', async () => {
    const arbre = await rendre();

    expect(texteVisible(arbre)).toContain('Trois informations suffisent.');
    expect(texteVisible(arbre)).not.toContain('Numéro de maillot');
    expect(texteVisible(arbre)).not.toContain('Poste');
  });

  // PAR-L13 (13/10, design parent E28) — ce témoin évolue : après « Déclarer mon enfant », on
  // ne revient plus tout de suite à la liste, on ouvre SA CARTE (une vue de « Mes enfants »,
  // qui REMPLACE le formulaire : « Plus tard » ramène ensuite à la liste, où l annonce attend).
  test('🔴 fiche créée : la liste l annonce, et sa CARTE remplace le formulaire', async () => {
    const arbre = await rendre();
    await remplir(arbre);
    await enregistrer(arbre);

    expect(mockCreer.mock.calls[0][0]).toEqual({
      birthdate: '2015-05-03', firstname: 'Anissa', lastname: 'Test',
    });
    await act(async () => {
      mockCreer.mock.calls[0][1].onSuccess({ documentId: 'anissa', firstname: 'Anissa' });
    });

    expect(mockAnnoncer).toHaveBeenCalledWith({
      documentId: 'anissa', firstname: 'Anissa', type: 'creee',
    });
    expect(mockReplace).toHaveBeenCalledWith('MyChildren', {
      carte: 'nouvelle', childDocumentId: 'anissa',
    });
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  test('PAR-L13 — réponse sans identifiant : pas de carte, retour à la liste', async () => {
    const arbre = await rendre();
    await remplir(arbre);
    await enregistrer(arbre);
    await act(async () => { mockCreer.mock.calls[0][1].onSuccess(null); });

    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  test('un échec ne s annonce pas comme un succès', async () => {
    const arbre = await rendre();
    await remplir(arbre);
    await enregistrer(arbre);
    await act(async () => { mockCreer.mock.calls[0][1].onError(new Error('réseau')); });

    expect(mockAnnoncer).not.toHaveBeenCalled();
    expect(mockGoBack).not.toHaveBeenCalled();
    expect(texteVisible(arbre)).toContain('Impossible d’enregistrer cette fiche pour le moment.');
  });

  test('une MODIFICATION réussie revient sans annonce de création', async () => {
    mockParams = { childDocumentId: 'enfant-1' };
    mockEnfants = [{
      age: 9, documentId: 'enfant-1', firstname: 'Léa', lastname: 'Martin',
    }];
    const arbre = await rendre();
    await enregistrer(arbre);
    await act(async () => { mockModifier.mock.calls[0][1].onSuccess({ documentId: 'enfant-1' }); });

    expect(mockAnnoncer).not.toHaveBeenCalled();
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  test('pendant l inscription, on AVANCE sans annonce (pas de passage par la liste)', async () => {
    mockRouteName = 'UserChild';
    mockProchaineEtape = 'Welcome';
    const arbre = await rendre();
    await remplir(arbre);
    await enregistrer(arbre);
    await act(async () => { mockCreer.mock.calls[0][1].onSuccess({ documentId: 'anissa' }); });

    expect(mockAnnoncer).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('Welcome');
  });

  test('🔴 14 ans : sous le palier, « Relier son compte » ouvre l écran du lien', async () => {
    const annee = String(new Date().getFullYear() - 14);
    const arbre = await rendre();
    await remplir(arbre, annee);

    expect(texteVisible(arbre)).toContain('Une fiche enfant est réservée aux moins de 13 ans.');
    const lien = arbre.root.findAll((/** @type {any} */ n) => (
      typeof n.props?.onPress === 'function' && n.props.testID === 'child-birthdate-link-account'
    ))[0];
    expect(aplatirTexte(lien.props.children)).toBe('Relier son compte');
    await act(async () => { lien.props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith('ParentLinkInvite', undefined);
  });

  test('pendant l inscription, le palier n offre pas ce lien (l écran n y vit pas)', async () => {
    mockRouteName = 'UserChild';
    const arbre = await rendre();
    await remplir(arbre, String(new Date().getFullYear() - 14));

    expect(texteVisible(arbre)).not.toContain('Relier son compte');
  });

  test('« Annuler » revient en arrière ; pendant l inscription, c est « Plus tard »', async () => {
    const arbre = await rendre();
    const annuler = arbre.root.findAll((/** @type {any} */ n) => (
      typeof n.props?.onPress === 'function' && n.props.testID === 'child-edit-cancel'
    ))[0];
    await act(async () => { annuler.props.onPress(); });
    expect(mockGoBack).toHaveBeenCalledTimes(1);

    mockRouteName = 'UserChild';
    expect(texteVisible(await rendre())).not.toContain('Annuler');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PAR-L5L6 (13/10) — E09 : « INFOS SPORTIVES », EN MODIFICATION (design parent, planche 3).
// Vider le maillot ou le poste l'EFFACE (le serveur reçoit `null` : vérifié en lecture dans
// admin `declared-child-rules.js`, `pickWritableFields`). Ce qui n'a pas été vu n'est pas effacé.
// ─────────────────────────────────────────────────────────────────────────────
describe('PAR-L5L6 E09 — vider un champ l efface', () => {
  const LEA = {
    age: 9,
    documentId: 'enfant-1',
    firstname: 'Léa',
    lastname: 'Martin',
    number: 10,
    position: 'Gardienne',
  };

  beforeEach(() => {
    mockParams = { childDocumentId: 'enfant-1' };
    mockEnfants = [LEA];
  });

  test('🔴 l intertitre « Infos sportives » et la phrase « Vider un champ l’efface. »', async () => {
    const texte = texteVisible(await rendre());

    expect(texte).toContain('Infos sportives | Numéro de maillot (facultatif)');
    expect(texte).toContain('Poste (facultatif)');
    expect(texte).toContain('Vider un champ l’efface.');
  });

  test('🔴 maillot et poste vidés : la modification les envoie à null', async () => {
    const arbre = await rendre();
    await saisir(arbre, 'child-number', '');
    await saisir(arbre, 'child-position', '');
    await enregistrer(arbre);

    const { payload } = mockModifier.mock.calls[0][0];
    expect(payload).toEqual({
      firstname: 'Léa', lastname: 'Martin', number: null, position: null,
    });
  });

  test('valeurs gardées : elles repartent telles quelles, rien n est effacé', async () => {
    const arbre = await rendre();
    await enregistrer(arbre);

    expect(mockModifier.mock.calls[0][0].payload).toEqual({
      firstname: 'Léa', lastname: 'Martin', number: 10, position: 'Gardienne',
    });
  });

  test('🔒 fiche ouverte AVANT d être lue : un champ vide n efface rien', async () => {
    mockEnfants = [];
    const arbre = await rendre();
    await saisir(arbre, 'child-firstname', 'Léa');
    await saisir(arbre, 'child-lastname', 'Martin');
    await enregistrer(arbre);

    const { payload } = mockModifier.mock.calls[0][0];
    expect(Object.prototype.hasOwnProperty.call(payload, 'number')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(payload, 'position')).toBe(false);
  });

  test('la création n a ni l intertitre ni la phrase', async () => {
    mockParams = undefined;
    const texte = texteVisible(await rendre());

    expect(texte).not.toContain('Infos sportives');
    expect(texte).not.toContain('Vider un champ');
  });
});

// BH02 (BUGHUNT 24/10) — P11-15 : une date à moitié saisie ne part pas en silence.
test('BH02 P11-15 MODIFIER avec jour et mois sans année : rien ne part, et l\'écran le dit', async () => {
  mockParams = { childDocumentId: 'enfant-1' };
  mockEnfants = [{
    age: 9, documentId: 'enfant-1', firstname: 'Léa', lastname: 'Martin', number: null, position: null,
  }];

  const arbre = await rendre();
  await saisir(arbre, 'child-day', '12');
  await saisir(arbre, 'child-month', '05');
  await enregistrer(arbre);

  expect(mockModifier).not.toHaveBeenCalled();
  expect(texteVisible(arbre)).toContain('Cette date n’existe pas.');
});
