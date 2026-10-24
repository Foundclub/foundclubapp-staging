/* eslint-disable max-len -- les libellés et les témoins se lisent en entier. */
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// ==========================================================================
// N4 (D6) — LA CARTE « APRÈS LE MATCH », TESTEE SEULE.
//
// 🧨 CE QU ELLE REMPLACE : sept libelles pour un seul bouton, decides par un
// `useMemo` de sept branches. Le coach lisait un mot different a chaque visite
// sans jamais voir OU il en etait.
//
// CE QUI SE VERIFIE ICI — les trois etats du parcours, et ce que chacun dit :
//   · l etape COURANTE se deduit des faits, elle ne se stocke pas ;
//   · 🔒 une verification requise RENVOIE a l etape 2, meme rapport publie —
//     se dire « complet » quand le score officiel a change serait le mensonge
//     que la carte doit empecher ;
//   · le motif d une porte fermee ne disparait pas ;
//   · un seul bouton, sur l etape courante, et il ouvre CETTE etape.
// ==========================================================================

// ST-MATCH (écran 7) — la doublure INTERPOLE les {{…}} et sait les pluriels de i18next
// (règle française : 0 et 1 au singulier), comme la vraie.
jest.mock('react-i18next', () => {
  const remplir = (/** @type {string} */ modele, /** @type {any} */ valeurs) => modele.replace(
    /\{\{(\w+)\}\}/g,
    (/** @type {string} */ tout, /** @type {string} */ nom) => (
      valeurs && nom in valeurs ? String(valeurs[nom]) : tout
    ),
  );
  return {
    useTranslation: () => ({
      t: (/** @type {string} */ key, /** @type {any} */ fallback, /** @type {any} */ options) => {
        if (typeof fallback === 'string') return remplir(fallback, options);
        if (fallback && fallback.defaultValue_one) {
          const modele = Number(fallback.count) <= 1 ? fallback.defaultValue_one : fallback.defaultValue_other;
          return remplir(String(modele), fallback);
        }
        return key;
      },
    }),
  };
});

jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(Colors),
      Colors,
      Fonts: generateFonts(Colors),
      Images: new Proxy({}, { get: () => 1 }),
      scheme: 'dark',
      Spaces,
    }),
  };
});

jest.mock('@/components/atoms/button/Button', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ButtonDouble(/** @type {any} */ props) {
    return react.createElement(
      rn.TouchableOpacity,
      {
        accessibilityRole: 'button',
        disabled: Boolean(props.disabled),
        onPress: props.onPress,
        testID: props.testID,
      },
      react.createElement(rn.Text, null, props.title || ''),
    );
  };
});

// eslint-disable-next-line import/first
import PostMatchJourneyCard, { resoudreLeParcours } from '../PostMatchJourneyCard';

/** @type {any[]} */
const montes = [];

const monter = (/** @type {any} */ options = {}) => {
  /** @type {any} */
  let arbre = null;
  act(() => {
    arbre = renderer.create(
      <PostMatchJourneyCard
        boutonDesactive={options.boutonDesactive ?? false}
        monDocumentId={options.monDocumentId ?? ''}
        motif={options.motif ?? ''}
        onPressEtape={options.onPressEtape ?? jest.fn()}
        reponsesAttendues={options.reponsesAttendues ?? 0}
        reponsesRecues={options.reponsesRecues ?? 0}
        scoreAuteur={options.scoreAuteur ?? null}
        scoreDisponible={options.scoreDisponible ?? false}
        scoreLibelle={options.scoreLibelle ?? 'Score à compléter'}
        scoreOrigine={options.scoreOrigine ?? ''}
        scoreSaisiA={options.scoreSaisiA ?? ''}
        statsFinalisees={options.statsFinalisees ?? false}
        verificationRequise={options.verificationRequise ?? false}
      />,
    );
  });
  montes.push(arbre);

  return arbre.root;
};

const textOf = (/** @type {any} */ node) => {
  if (node === null || node === undefined || node === false) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(' ');
  if (node.props?.children !== undefined) return textOf(node.props.children);

  return '';
};

const textes = (/** @type {any} */ root) => root
  .findAllByType(Text)
  .map((/** @type {any} */ node) => textOf(node.props.children).trim())
  .filter(Boolean);

const parTestID = (/** @type {any} */ root, /** @type {string} */ id) => root
  .findAll((/** @type {any} */ node) => node.props?.testID === id, { deep: false })[0];

// 🪤 LE BOUTON EST SOUS LE `testID`, PAS DESSUS. L'atome `Button` ne
// declare ni ne transmet `testID` : il vit donc sur le `View` qui l'enveloppe,
// et c'est la seule facon d'avoir le meme repere dans la vraie app et ici.
const boutonSous = (/** @type {any} */ root, /** @type {string} */ id) => {
  const conteneur = parTestID(root, id);
  if (!conteneur) return null;

  return conteneur.findAll(
    (/** @type {any} */ node) => typeof node.props?.onPress === 'function'
      && typeof node.props?.title === 'string',
    { deep: false },
  )[0];
};

const libelleDuBouton = (/** @type {any} */ root) => String(
  boutonSous(root, 'post-match-action')?.props?.title || '',
);

// Le score enregistre, tel que l ecran le fabrique deja.
const AVEC_SCORE = { scoreDisponible: true, scoreLibelle: '3 - 1', scoreOrigine: 'manual' };

afterEach(() => {
  montes.splice(0).forEach((arbre) => act(() => arbre.unmount()));
});

// ---------------------------------------------------------------------------
// LE PARCOURS — la fonction pure, sans rendu
// ---------------------------------------------------------------------------

describe('N4/D6 — ou en est-on du parcours', () => {
  test('sans score, on est a l etape 1 et rien n est fait', () => {
    expect(resoudreLeParcours({
      scoreDisponible: false,
      statsFinalisees: false,
      toutesLesReponses: false,
      verificationRequise: false,
    })).toEqual({ courante: 'score', faites: [] });
  });

  test('score enregistre, stats a faire : etape 2, le score est derriere', () => {
    expect(resoudreLeParcours({
      scoreDisponible: true,
      statsFinalisees: false,
      toutesLesReponses: false,
      verificationRequise: false,
    })).toEqual({ courante: 'stats', faites: ['score'] });
  });

  test('stats publiees, reponses incompletes : etape 3', () => {
    expect(resoudreLeParcours({
      scoreDisponible: true,
      statsFinalisees: true,
      toutesLesReponses: false,
      verificationRequise: false,
    })).toEqual({ courante: 'responses', faites: ['score', 'stats'] });
  });

  test('tout est fait : plus d etape courante', () => {
    expect(resoudreLeParcours({
      scoreDisponible: true,
      statsFinalisees: true,
      toutesLesReponses: true,
      verificationRequise: false,
    })).toEqual({ courante: '', faites: ['score', 'stats', 'responses'] });
  });

  test('🔒 une verification requise RENVOIE a l etape 2, meme rapport publie', () => {
    expect(resoudreLeParcours({
      scoreDisponible: true,
      statsFinalisees: true,
      toutesLesReponses: true,
      verificationRequise: true,
    })).toEqual({ courante: 'stats', faites: ['score'] });
  });
});

// ---------------------------------------------------------------------------
// CE QUE LA CARTE AFFICHE — 3 etats × contenu
// ---------------------------------------------------------------------------

describe('N4/D6 — etape 1 : le score', () => {
  test('l en-tete dit ou on en est, en toutes lettres', () => {
    const root = monter();

    // 🎯 ST-MATCH (écran 7) — ADAPTÉ : l'étape monte dans le surtitre, en une ligne.
    expect(textes(root)).toEqual(expect.arrayContaining(['Après le match · étape 1 sur 3']));
  });

  test('les trois etapes sont TOUJOURS visibles, meme celles a venir', () => {
    const root = monter();

    expect(parTestID(root, 'post-match-step-score')).toBeTruthy();
    expect(parTestID(root, 'post-match-step-stats')).toBeTruthy();
    expect(parTestID(root, 'post-match-step-responses')).toBeTruthy();
    // 🎯 ST-MATCH (écran 7) — ADAPTÉ : l'étape 2 s'appelle « Feuille de match » ; avant le
    // score, elle dit « Après le score ».
    expect(textes(root)).toEqual(expect.arrayContaining([
      'Score',
      'Feuille de match',
      'Après le score',
      'Retours des joueurs',
    ]));
  });

  // 🎯 ST-MATCH (écran 7) — ADAPTÉ : « Enregistrer » devient « Saisir » (le mot du design).
  test('sans score, l etape 1 dit qu il reste a le saisir', () => {
    const root = monter();

    expect(textes(root)).toEqual(expect.arrayContaining(['À saisir']));
    expect(libelleDuBouton(root)).toBe('Saisir le score');
  });

  test('🎯 le bouton ouvre l etape COURANTE, nommee', () => {
    const onPressEtape = jest.fn();
    const root = monter({ onPressEtape });

    act(() => { boutonSous(root, 'post-match-action').props.onPress(); });

    expect(onPressEtape).toHaveBeenCalledWith('score');
  });
});

describe('N4/D6 — etape 2 : les statistiques', () => {
  // 🎯 ST-MATCH (écran 7) — ADAPTÉ : « saisi à la main » est RETIRÉ (design : « saisi par toi le
  // 1 oct. à 22:35 » le remplace) ; sans auteur connu, le score seul.
  test('🔢 le score enregistre s affiche, sans « saisi à la main »', () => {
    const root = monter(AVEC_SCORE);

    expect(textes(root)).toEqual(expect.arrayContaining(['3 - 1']));
    expect(textes(root).some((texte) => texte.includes('saisi à la main'))).toBe(false);
    expect(textes(root)).toEqual(expect.arrayContaining(['Après le match · étape 2 sur 3']));
  });

  test('un score officiel le dit autrement', () => {
    const root = monter({ ...AVEC_SCORE, scoreOrigine: 'external_sync' });

    expect(textes(root)).toEqual(expect.arrayContaining(['3 - 1 · score officiel']));
  });

  test('une origine inconnue n invente rien : le score, tout seul', () => {
    const root = monter({ ...AVEC_SCORE, scoreOrigine: '' });

    expect(textes(root)).toEqual(expect.arrayContaining(['3 - 1']));
  });

  test('le bouton propose de saisir les stats, et ouvre CETTE etape', () => {
    const onPressEtape = jest.fn();
    const root = monter({ ...AVEC_SCORE, onPressEtape });

    // 🎯 ST-MATCH (écran 7) — ADAPTÉ : « Saisir les stats » devient « Saisir la feuille ».
    expect(libelleDuBouton(root)).toBe('Saisir la feuille');
    act(() => { boutonSous(root, 'post-match-action').props.onPress(); });

    expect(onPressEtape).toHaveBeenCalledWith('stats');
  });

  // -------------------------------------------------------------------------
  // P5 (D5) — « SAISI PAR TOI À 20:12 »
  // -------------------------------------------------------------------------
  //
  // ⚠️ Les trois props sont OPTIONNELLES et par defaut vides : la carte est
  // rendue AUSSI par le site (`EventDetails.web.js`), qui ne les passe pas. Les
  // temoins d origine ci-dessus le prouvent — ils ne les passent pas non plus et
  // restent verts sur l affichage d avant.

  // 20:12 heure LOCALE du banc : la carte raconte un moment au lecteur, dans son
  // heure a lui. Ecrire cet instant en UTC ferait dependre le temoin du fuseau de
  // la machine, et il rougirait ailleurs qu ici.
  const SAISI_A_2012 = new Date(2026, 7, 20, 20, 12).toISOString();
  const CAMILLE = { documentId: 'coach-doc', firstname: 'Camille' };
  // ST-MATCH (écran 7) — le jour s'ajoute à l'heure : « le 20 août à 20:12 ».
  const JOUR = new Date(SAISI_A_2012).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  test('👤 quand c est MOI qui ai saisi, la carte dit « par toi »', () => {
    const root = monter({
      ...AVEC_SCORE,
      monDocumentId: 'coach-doc',
      scoreAuteur: CAMILLE,
      scoreSaisiA: SAISI_A_2012,
    });

    // 🎯 ST-MATCH (écran 7) — ADAPTÉ : « saisi par toi le <jour> à 20:12 ».
    expect(textes(root)).toEqual(expect.arrayContaining([`3 - 1 · saisi par toi le ${JOUR} à 20:12`]));
  });

  test('👤 quand c est QUELQU UN D AUTRE, elle le nomme par son prenom', () => {
    const root = monter({
      ...AVEC_SCORE,
      monDocumentId: 'un-autre-doc',
      scoreAuteur: CAMILLE,
      scoreSaisiA: SAISI_A_2012,
    });

    // 🎯 ST-MATCH (écran 7) — ADAPTÉ : « saisi par Camille le <jour> à 20:12 ».
    expect(textes(root)).toEqual(expect.arrayContaining([`3 - 1 · saisi par Camille le ${JOUR} à 20:12`]));
  });

  test('🪤 sans auteur, elle retombe sur l origine — elle n invente personne', () => {
    const root = monter({ ...AVEC_SCORE, scoreAuteur: null, scoreSaisiA: '' });

    // 🎯 ST-MATCH (écran 7) — ADAPTÉ : le score seul — « saisi à la main » est retiré.
    expect(textes(root)).toEqual(expect.arrayContaining(['3 - 1']));
  });

  test('🪤 un auteur SANS horodatage ne rend pas une phrase a moitie', () => {
    const root = monter({ ...AVEC_SCORE, scoreAuteur: CAMILLE, scoreSaisiA: '' });

    // 🎯 ST-MATCH (écran 7) — ADAPTÉ : le score seul — « saisi à la main » est retiré.
    expect(textes(root)).toEqual(expect.arrayContaining(['3 - 1']));
  });

  test('🪤 un horodatage illisible ne casse pas la carte', () => {
    const root = monter({ ...AVEC_SCORE, scoreAuteur: CAMILLE, scoreSaisiA: 'pas-une-date' });

    // 🎯 ST-MATCH (écran 7) — ADAPTÉ : le score seul — « saisi à la main » est retiré.
    expect(textes(root)).toEqual(expect.arrayContaining(['3 - 1']));
  });

  test('🪤 un auteur sans documentId ni prenom ne dit rien de plus', () => {
    const root = monter({ ...AVEC_SCORE, scoreAuteur: {}, scoreSaisiA: SAISI_A_2012 });

    // 🎯 ST-MATCH (écran 7) — ADAPTÉ : le score seul — « saisi à la main » est retiré.
    expect(textes(root)).toEqual(expect.arrayContaining(['3 - 1']));
  });

  // 🎯 ST-MATCH (écran 7) — ADAPTÉ : « Mettre à jour » devient « Vérifier la feuille », et le
  // surtitre dit « à vérifier ».
  test('🔒 verification requise : le bouton dit « Vérifier la feuille »', () => {
    const root = monter({ ...AVEC_SCORE, statsFinalisees: true, verificationRequise: true });

    expect(libelleDuBouton(root)).toBe('Vérifier la feuille');
    expect(textes(root)).toEqual(expect.arrayContaining(['Après le match · à vérifier']));
  });
});

describe('N4/D6 — etape 3 : les retours des joueurs', () => {
  test('🔢 le compteur porte SES DEUX nombres', () => {
    const root = monter({
      ...AVEC_SCORE,
      reponsesAttendues: 12,
      reponsesRecues: 4,
      statsFinalisees: true,
    });

    expect(textes(root)).toEqual(expect.arrayContaining(['4 sur 12 ont répondu']));
    // 🎯 ST-MATCH (écran 7) — ADAPTÉ : le surtitre, et un seul mot pour la feuille publiée.
    expect(textes(root)).toEqual(expect.arrayContaining(['Après le match · étape 3 sur 3']));
    expect(libelleDuBouton(root)).toBe('Voir la feuille');
  });

  test('personne d attendu : la carte le dit plutot que d afficher « 0 sur 0 »', () => {
    const root = monter({ ...AVEC_SCORE, statsFinalisees: true });

    expect(textes(root)).toEqual(expect.arrayContaining(['Personne n’a encore répondu']));
  });

  test('tout le monde a repondu : le parcours est complet, et le bouton donne acces', () => {
    const root = monter({
      ...AVEC_SCORE,
      reponsesAttendues: 12,
      reponsesRecues: 12,
      statsFinalisees: true,
    });

    // 🎯 ST-MATCH (écran 7) — ADAPTÉ : « c'est complet » dans le surtitre ; le bouton ouvre la feuille.
    expect(textes(root)).toEqual(expect.arrayContaining(['Après le match · c’est complet']));
    expect(libelleDuBouton(root)).toBe('Voir la feuille');
  });
});

describe('N4/D6 — une porte fermee dit POURQUOI', () => {
  test('⛔ le motif s affiche, et le bouton est ferme', () => {
    const root = monter({
      boutonDesactive: true,
      motif: 'Les stats seront disponibles à la fin du match.',
    });

    expect(boutonSous(root, 'post-match-action').props.disabled).toBe(true);
    expect(textes(root)).toEqual(expect.arrayContaining([
      'Les stats seront disponibles à la fin du match.',
    ]));
  });

  test('porte ouverte : aucun motif ne traine', () => {
    const root = monter({ motif: 'Les stats seront disponibles à la fin du match.' });

    expect(parTestID(root, 'post-match-motif')).toBeUndefined();
    expect(boutonSous(root, 'post-match-action').props.disabled).toBe(false);
  });
});

// BUGHUNT BH08 (24/10) — P8-24 : personne n'etait attendu, le parcours ne reste pas bloque.
describe('BH08 · P8-24 — aucune reponse attendue', () => {
  test('score + stats faits, 0 attendu : le parcours est complet', () => {
    const root = monter({ reponsesAttendues: 0, reponsesRecues: 0, scoreDisponible: true, statsFinalisees: true });
    expect(textes(root).join(' ')).toContain('c’est complet');
  });
});
