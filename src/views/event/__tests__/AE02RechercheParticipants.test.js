import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query';
import { Text, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { REMIND_EVENT_MUTATION_KEY } from '@/domains/event/remindReport';

import EventParticipants from '../components/EventParticipants';

// AE02 (E6) — LE FILET DE « CHERCHER UN NOM », DU « 41 % » ET DU MOTIF ANTI-SPAM.
//
// 🪢 POURQUOI CE FICHIER EXISTE, EN PLUS D AD06 : AD06 tient l ecran AU REPOS
// (les 3 compteurs, les 5 groupes, les etats vides). Il ne tape jamais dans une
// barre de recherche — il ne peut donc rien dire de ce que ce lot ajoute. Les
// deux filets sont complementaires et se lisent ensemble :
//   · AD06 prouve que l ecran PAR DEFAUT n a pas bouge  (temoin 5 le rejoue ici)
//   · AE02 prouve ce qui se passe QUAND ON TAPE
//
// 🔬 LE HARNAIS EST CELUI D AD06, RECOPIE MOT POUR MOT : vrai `fr.js` lu par
// `t`, vrai theme monte avec les VRAIS modules. ⛔ JAMAIS un Proxy de theme :
// il rend les echecs jest illisibles (piege paye au lot paywall).
//
// 🧨 CE QUE LE HARNAIS APPREND DU LOT : les 3 clefs neuves n existent PAS encore
// dans `fr.js` (c est le lot L4 qui tient ce fichier, cf. le diff a coller du
// compte rendu). `t(clef, repli)` rend donc le REPLI francais — et c est
// exactement ce que les temoins lisent. Le jour ou les clefs entrent dans
// `fr.js` avec la meme valeur, ce fichier reste vert sans une ligne de diff.

// 🧨 D5-b — CE MOCK EST UNE CONDITION DE DEMARRAGE, PAS UN CONFORT.
// Depuis P2, `EventParticipants` importe `licenseQueries`. Le VRAI module
// descend jusqu a `client.native.js`, qui jette AU CHARGEMENT quand `.env` est
// absent — et `.env` est gitignore, donc absent de toute copie de travail.
// Sans ce mock, la suite entiere ne demarre pas : « failed to run », 0 test
// execute. Un compteur de tests VERT ne le verrait meme pas.
jest.mock('@/services/license/licenseQueries', () => ({
  useLicenseAssignments: () => ({ data: undefined, isLoading: false }),
}));

// 🧨 R7-d — CONDITION DE DEMARRAGE, PAS UN CONFORT (meme motif que le mock
// `licenseQueries` ci-dessus). Depuis R7-d, `EventParticipants` monte
// `useAttendanceCallMutations` pour ecrire le pointage « A l heure ». Le vrai
// `eventService` descend jusqu a `client.native.js`, qui jette AU CHARGEMENT
// quand `.env` est absent — et `.env` est gitignore, donc absent de toute
// copie de travail. Sans ce mock : « failed to run », 0 test execute.
jest.mock('@/services/event/eventService', () => ({
  markCoachArrival: jest.fn(),
  markCoachArrivalBulk: jest.fn(),
  resetCoachAttendance: jest.fn(),
  updateCoachLateMinutes: jest.fn(),
}));

// 🗺️ S3-bis — CONDITION DE DEMARRAGE (meme motif que les mocks ci-dessus).
// Depuis S3-bis, `EventParticipants` porte le bouton « Faire l'appel » et monte
// donc `useNavigation()`. Sans conteneur de navigation dans le harnais, le vrai
// module jette « useNavigation is not a function » et toute la suite tombe.
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  /**
   * Lit une clef pointee dans le VRAI dictionnaire francais.
   * @param {string} chemin - La clef, par exemple `eventDetails.fields.participations`.
   * @returns {any} - La valeur trouvee, ou `undefined`.
   */
  const lire = (chemin) => String(chemin)
    .split('.')
    .reduce(
      (noeud, clef) => (noeud === null || noeud === undefined ? undefined : noeud[clef]),
      traductions,
    );
  return {
    initReactI18next: { init: jest.fn(), type: '3rdParty' },
    useTranslation: () => ({
      t: (/** @type {string} */ clef, /** @type {any} */ valeurParDefaut) => {
        const valeur = lire(clef);
        if (typeof valeur === 'string') return valeur;
        return typeof valeurParDefaut === 'string' ? valeurParDefaut : clef;
      },
    }),
  };
});

// Le theme est monte avec les VRAIS modules (cf. AD06). Seul `Images` est stube.
jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const generateApplicationStyle = jest.requireActual('@/theme/applicationStyle').default;
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments,
      ApplicationStyle: generateApplicationStyle(Colors),
      Colors,
      Fonts: generateFonts(Colors),
      Images: new Proxy({}, { get: () => 1 }),
      scheme: 'dark',
      Spaces,
    }),
  };
});

const NOW_MS = Date.parse('2026-08-20T18:00:00.000Z');

// 🕐 La prochaine relance est fabriquee en heure LOCALE puis relue en heure
// locale : le temoin ne depend d AUCUN fuseau, exactement comme l heure
// d arrivee d AD06. `22/08/2026 a 09h00` reste le meme partout.
const PROCHAINE_RELANCE = new Date(2026, 7, 22, 9, 0, 0);

/**
 * Fabrique un joueur minimal.
 * @param {string} id - Son `documentId`.
 * @param {string} prenom - Son prenom.
 * @param {string} nom - Son nom de famille.
 * @returns {object} - Le joueur.
 */
const joueur = (id, prenom, nom) => ({
  documentId: id, firstname: prenom, id, lastname: nom,
});

// 🔤 LES NOMS SONT CHOISIS POUR PIEGER LA COMPARAISON, pas au hasard :
//   · `Éloïse Dupont`  → accent en TETE de mot et casse haute
//   · `Zoé Dupont`     → meme nom de famille, autre groupe
//   · `Chloé Durand`   → prefixe commun `Du`, mais PAS `Dupont`
//   · `Bob Martin`     → ne matche jamais
const P_ELOISE = joueur('p-eloise', 'Éloïse', 'Dupont');
const P_BOB = joueur('p-bob', 'Bob', 'Martin');
const P_CHLOE = joueur('p-chloe', 'Chloé', 'Durand');
const P_ZOE = joueur('p-zoe', 'Zoé', 'Dupont');

const PROPS_BASE = {
  attendanceByUserId: {},
  canApprovePendingRequests: true,
  canEdit: true,
  event: { documentId: 'evt-1' },
  eventStartAt: null,
  externalParticipationSection: null,
  handleExportParticipants: jest.fn(),
  handleRemindPlayers: jest.fn(),
  handleShare: jest.fn(),
  handleUpdateParticipation: jest.fn(),
  handleUserPress: jest.fn(),
  nowMs: NOW_MS,
  onCoachEditLate: jest.fn(),
  onCoachMarkArrival: jest.fn(),
  participantsSummary: undefined,
  participationsByStatus: undefined,
  pendingParticipations: [],
  teamParticipationSections: [],
};

/**
 * Rend une section d equipe complete, prete a etre surchargee.
 * @param {object} [surcharges] - Les champs a remplacer.
 * @returns {object} - La section.
 */
const section = (surcharges = {}) => ({
  key: 'eq-1',
  missing: [],
  notAnswered: [],
  participating: [],
  teamName: 'U15 Feminines',
  ...surcharges,
});

/**
 * Une relance DEJA PARTIE, dont le compte rendu dort dans le cache de mutation.
 *
 * 🧨 C est tout le sujet du cadre 1I : `nextReminderAt` n existe NULLE PART
 * avant le premier appui — il ne vit que dans la REPONSE du serveur. La sonde
 * recopie le motif d AC07 (`AC07BoutonRelanceGrise.test.js:95-106`) : meme
 * `mutationKey`, meme client. Elle est declenchee par la poignee plutot que par
 * un `useEffect`, pour que le temoin garde la main sur l instant.
 * @param {{ compteRendu: object, poignee: object }} props - Le compte rendu et la poignee.
 * @returns {null} - Rien a rendre.
 */
function RelanceDejaFaite({ compteRendu, poignee }) {
  const mutation = useMutation({
    mutationFn: () => Promise.resolve(compteRendu),
    mutationKey: REMIND_EVENT_MUTATION_KEY,
  });
  // eslint-disable-next-line no-param-reassign -- la poignee est justement le sujet
  poignee.demarrer = () => mutation.mutate('evt-1');
  return null;
}

/**
 * Monte le VRAI composant, avec le fournisseur qu exige `useIsMutating`.
 * @param {object} [surcharges] - Les props a remplacer.
 * @param {object | null} [sonde] - `{ compteRendu, poignee }` pour peupler le cache.
 * @returns {any} - L arbre rendu.
 */
const monter = (surcharges = {}, sonde = null) => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <QueryClientProvider client={queryClient}>
        {sonde ? (
          <RelanceDejaFaite compteRendu={sonde.compteRendu} poignee={sonde.poignee} />
        ) : null}
        {/* eslint-disable-next-line react/jsx-props-no-spreading -- l ecran a 19 props */}
        <EventParticipants {...PROPS_BASE} {...surcharges} />
      </QueryClientProvider>,
    );
  });
  return arbre;
};

/**
 * Aplatit un style RN, qu il soit un objet ou un tableau imbrique.
 * @param {any} style - Le style a plat ou en tableau.
 * @returns {any[]} - Les objets de style, sans les trous.
 */
const aplatir = (style) => (Array.isArray(style) ? style.flat(Infinity) : [style]).filter(Boolean);

/**
 * Ramasse le texte porte par un noeud et ses enfants.
 * @param {any} noeud - Le noeud de depart.
 * @returns {string} - Le texte, espaces normalises.
 */
const texteDe = (noeud) => {
  /** @type {string[]} */
  const morceaux = [];
  /**
   * Descend un noeud et empile ce qu il porte.
   * @param {any} enfant - Le noeud courant.
   * @returns {void} - Rien.
   */
  const descendre = (enfant) => {
    if (enfant === null || enfant === undefined || enfant === false) return;
    if (typeof enfant === 'string' || typeof enfant === 'number') {
      morceaux.push(String(enfant));
      return;
    }
    const enfants = enfant?.props?.children;
    if (Array.isArray(enfants)) enfants.forEach(descendre);
    else descendre(enfants);
  };
  descendre(noeud);
  return morceaux.join(' ').replace(/\s+/g, ' ').trim();
};

/**
 * Tous les textes rendus, dans l ordre de l arbre.
 * @param {any} arbre - L arbre rendu.
 * @returns {string[]} - Les textes non vides.
 */
const textesVisibles = (arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => texteDe(noeud))
  .filter(Boolean);

/**
 * Les textes de la LISTE, c est-a-dire tout ce qui suit le bloc de compteurs.
 *
 * 🪤 LA COUPE EST OBLIGATOIRE, et AD06 la fait deja pour la meme raison : les
 * libelles des 3 tuiles reprennent MOT POUR MOT les titres de groupe
 * (« Présent·e·s »…). Sans elle, un temoin qui verifie qu un groupe a disparu
 * serait vert alors que le titre est encore la — ou rouge alors qu il n y est
 * plus. La coupe se fait sur la legende de la barre, dernier texte du bloc.
 * @param {any} arbre - L arbre rendu.
 * @returns {string[]} - Les textes de la liste des participants.
 */
const textesDeLaListe = (arbre) => {
  const textes = textesVisibles(arbre);
  const rangLegende = textes.findIndex((/** @type {string} */ texte) => /réponses sur/.test(texte));
  return rangLegende >= 0 ? textes.slice(rangLegende + 1) : textes;
};

/**
 * Lit le texte d un noeud repere par son `testID`.
 * @param {any} arbre - L arbre rendu.
 * @param {string} identifiant - Le `testID` cherche.
 * @returns {string} - Le texte porte par ce noeud, vide s il n existe pas.
 */
const parIdentifiant = (arbre, identifiant) => {
  const trouves = arbre.root.findAllByProps({ testID: identifiant });
  return trouves.length > 0 ? texteDe(trouves[0]) : '';
};

/**
 * Le selecteur de pastilles d AD06, RECOPIE TEL QUEL.
 *
 * 🪤 Il attrape tout `Text` dont UN objet de style porte a la fois
 * `textAlign: 'center'` ET `color`, puis le compare en `toEqual` STRICT. Un
 * texte neuf qui porterait ce couple ferait tomber AD06 sans que ce lot ait
 * touche une pastille. Le temoin 3 s en sert comme d un garde-fou.
 * @param {any} arbre - L arbre rendu.
 * @returns {string[]} - Le texte de chaque pastille trouvee.
 */
const pastilles = (arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => ({
    centre: aplatir(noeud.props.style)
      .find((/** @type {any} */ s) => s && s.textAlign === 'center'),
    noeud,
  }))
  .filter((/** @type {any} */ entree) => Boolean(entree.centre && entree.centre.color))
  .map((/** @type {any} */ entree) => texteDe(entree.noeud));

/**
 * Tape un texte dans la barre de recherche.
 * @param {any} arbre - L arbre rendu.
 * @param {string} saisie - Ce qu on tape.
 * @returns {void} - Rien.
 */
const taper = (arbre, saisie) => {
  act(() => {
    arbre.root.findByType(TextInput).props.onChangeText(saisie);
  });
};

/**
 * Attend qu un motif apparaisse dans les textes rendus.
 * La sonde de relance atterrit en plusieurs tours de boucle selon la charge de
 * la machine : parier sur un seul tick rend le temoin instable (lecon d AC07).
 * @param {any} arbre - L arbre rendu.
 * @param {RegExp} motif - Le motif attendu.
 * @returns {Promise<void>} - Rend la main des que le motif est la.
 */
const attendreLeTexte = async (arbre, motif) => {
  for (let tour = 0; tour < 30; tour += 1) {
    if (textesVisibles(arbre).some((/** @type {string} */ texte) => motif.test(texte))) return;
    // eslint-disable-next-line no-await-in-loop -- on laisse le rendu se poser, tour par tour
    await act(async () => {
      await new Promise((resoudre) => { setTimeout(resoudre, 0); });
    });
  }
};

describe('AE02 · temoin 1 — chercher un nom filtre les groupes', () => {
  test('un nom de famille ne laisse que ses porteurs, les groupes vides disparaissent', () => {
    const arbre = monter({
      teamParticipationSections: [section({
        missing: [P_CHLOE],
        notAnswered: [P_ZOE],
        participating: [P_ELOISE, P_BOB],
      })],
    });

    taper(arbre, 'Dupont');
    const textes = textesDeLaListe(arbre);

    // 1. Les deux Dupont restent, chacun dans SON groupe.
    expect(textes).toContain('Éloïse Dupont');
    expect(textes).toContain('Zoé Dupont');
    expect(textes).toContain('Présent·e·s');
    expect(textes).toContain('Sans réponse');

    // 2. Les autres noms sont partis.
    expect(textes).not.toContain('Bob Martin');
    expect(textes).not.toContain('Chloé Durand');

    // 3. Le groupe « Absent·e·s » n a plus AUCUN resultat : il disparait, titre
    //    compris. Il ne dit surtout pas « Aucune absence signalée. » — ce serait
    //    un mensonge : il y a bien une absence, elle ne matche juste pas.
    expect(textes).not.toContain('Absent·e·s');
    expect(textes).not.toContain('Aucune absence signalée.');
  });

  test('la comparaison ignore les accents et la casse', () => {
    const arbre = monter({
      teamParticipationSections: [section({ participating: [P_ELOISE, P_BOB] })],
    });

    taper(arbre, 'eloise');
    expect(textesVisibles(arbre)).toContain('Éloïse Dupont');
    expect(textesVisibles(arbre)).not.toContain('Bob Martin');

    taper(arbre, 'DUPONT');
    expect(textesVisibles(arbre)).toContain('Éloïse Dupont');
    expect(textesVisibles(arbre)).not.toContain('Bob Martin');
  });

  test('effacer la saisie rend l ecran INTEGRAL, au caractere pres', () => {
    const arbre = monter({
      teamParticipationSections: [section({
        missing: [P_CHLOE],
        notAnswered: [P_ZOE],
        participating: [P_ELOISE, P_BOB],
      })],
    });

    const avant = textesVisibles(arbre);
    taper(arbre, 'Dupont');
    expect(textesVisibles(arbre)).not.toEqual(avant);

    taper(arbre, '');
    expect(textesVisibles(arbre)).toEqual(avant);
  });

  test('le second chemin, celui sans equipes, filtre lui aussi', () => {
    const arbre = monter({
      participationsByStatus: {
        missing: [P_CHLOE],
        notAnswered: [P_ZOE],
        participating: [P_ELOISE, P_BOB],
      },
      teamParticipationSections: [],
    });

    taper(arbre, 'Dupont');
    const textes = textesVisibles(arbre);

    expect(textes).toContain('Éloïse Dupont');
    expect(textes).toContain('Zoé Dupont');
    expect(textes).not.toContain('Bob Martin');
    expect(textes).not.toContain('Chloé Durand');
  });

  test('les compteurs decrivent l evenement, pas la recherche : ils ne bougent pas', () => {
    const arbre = monter({
      teamParticipationSections: [section({
        missing: [P_CHLOE],
        notAnswered: [P_ZOE],
        participating: [P_ELOISE, P_BOB],
      })],
    });

    /**
     * Releve les 3 tuiles et la legende de la barre.
     * @returns {string[]} - Les 4 textes, dans l ordre.
     */
    const releve = () => [
      parIdentifiant(arbre, 'AD06-tuile-participating'),
      parIdentifiant(arbre, 'AD06-tuile-missing'),
      parIdentifiant(arbre, 'AD06-tuile-notAnswered'),
      parIdentifiant(arbre, 'AD06-barre-legende'),
    ];

    const avant = releve();
    taper(arbre, 'Dupont');
    expect(releve()).toEqual(avant);
  });
});

describe('AE02 · temoin 2 — aucun nom ne correspond', () => {
  test('une saisie sans resultat dit pourquoi, jamais un ecran nu', () => {
    const arbre = monter({
      teamParticipationSections: [section({
        missing: [P_CHLOE],
        notAnswered: [P_ZOE],
        participating: [P_ELOISE, P_BOB],
      })],
    });

    taper(arbre, 'zzzz');
    const textes = textesDeLaListe(arbre);

    expect(parIdentifiant(arbre, 'AE02-aucun-resultat')).toBe('Aucun nom ne correspond');
    // Aucun nom, aucun titre de groupe, aucun nom d equipe : la liste est vide
    // POUR DE BON, et c est la phrase qui le dit.
    expect(textes).not.toContain('Éloïse Dupont');
    expect(textes).not.toContain('U15 Feminines');
    expect(textes).not.toContain('Présent·e·s');
    expect(textes).not.toContain('Absent·e·s');
  });

  test('la phrase disparait des qu un nom correspond a nouveau', () => {
    const arbre = monter({
      teamParticipationSections: [section({ participating: [P_ELOISE] })],
    });

    taper(arbre, 'zzzz');
    expect(parIdentifiant(arbre, 'AE02-aucun-resultat')).toBe('Aucun nom ne correspond');

    taper(arbre, 'Dupont');
    expect(parIdentifiant(arbre, 'AE02-aucun-resultat')).toBe('');
    expect(textesVisibles(arbre)).toContain('Éloïse Dupont');
  });
});

describe('AE02 · temoin 3 — le pourcentage en chiffre', () => {
  /**
   * Fabrique N joueurs distincts.
   * @param {string} prefixe - Le prefixe d identifiant.
   * @param {number} combien - Combien en fabriquer.
   * @returns {object[]} - Les joueurs.
   */
  const joueurs = (prefixe, combien) => Array.from(
    { length: combien },
    (_, rang) => joueur(`${prefixe}-${rang}`, `Prenom${rang}`, `Nom${prefixe}`),
  );

  test('9 reponses sur 22 affichent « 41 % », dans un noeud A PART', () => {
    const arbre = monter({
      teamParticipationSections: [section({
        missing: joueurs('m', 4),
        notAnswered: joueurs('n', 13),
        participating: joueurs('p', 5),
      })],
    });

    // 5 presents + 4 absents = 9 reponses recues, sur 22 attendues.
    // Math.round(9 / 22 * 100) = 41.
    expect(parIdentifiant(arbre, 'AD06-barre-legende')).toContain('9');
    expect(parIdentifiant(arbre, 'AD06-barre-legende')).toContain('22');
    expect(parIdentifiant(arbre, 'AE02-pourcentage')).toBe('41 %');

    // 🪤 Le chiffre vit dans SON noeud : la legende d AD06 ne le porte pas.
    expect(parIdentifiant(arbre, 'AD06-barre-legende')).not.toMatch(/41\s*%/);
  });

  test('zero reponse affiche « 0 % », jamais un vide ni un NaN', () => {
    const arbre = monter({
      teamParticipationSections: [section({ notAnswered: joueurs('n', 3) })],
    });

    expect(parIdentifiant(arbre, 'AE02-pourcentage')).toBe('0 %');
    expect(textesVisibles(arbre).join(' | ')).not.toMatch(/NaN|Infinity/);
  });

  test('le chiffre ne porte PAS le couple de styles des pastilles', () => {
    // 🪤 LE GARDE-FOU D AD06 : son selecteur `pastilles()` attrape tout `Text`
    // portant `textAlign: 'center'` + `color` dans le MEME objet, et compare en
    // `toEqual` STRICT. Si le « 41 % » portait ce couple, AD06 tomberait sans
    // qu une seule pastille ait bouge.
    const arbre = monter({
      teamParticipationSections: [section({
        missing: joueurs('m', 4),
        notAnswered: joueurs('n', 13),
        participating: joueurs('p', 5),
      })],
    });

    expect(pastilles(arbre).filter((/** @type {string} */ texte) => /%/.test(texte))).toEqual([]);
  });
});

describe('AE02 · temoin 4 — le motif anti-spam AVANT l appui', () => {
  test('un compte rendu en cache affiche la date de prochaine relance', async () => {
    /** @type {{ demarrer: null | (() => void) }} */
    const poignee = { demarrer: null };
    const arbre = monter(
      { teamParticipationSections: [section({ notAnswered: [P_ZOE] })] },
      {
        compteRendu: {
          blockedCount: 1,
          lastRemindedAt: null,
          nextReminderAt: PROCHAINE_RELANCE.toISOString(),
          recipients: [],
          remindedCount: 0,
          unansweredCount: 1,
        },
        poignee,
      },
    );

    // 1. AVANT toute relance : rien a montrer, et c est assume.
    expect(parIdentifiant(arbre, 'AE02-prochaine-relance')).toBe('');

    // 2. Une relance atterrit : son compte rendu dort dans le cache de mutation.
    await act(async () => { poignee.demarrer(); });
    await attendreLeTexte(arbre, /Prochaine relance possible/);

    const ligne = parIdentifiant(arbre, 'AE02-prochaine-relance');
    expect(ligne).toContain('Prochaine relance possible le');
    // La date est fabriquee en heure LOCALE : ces deux morceaux sont vrais
    // dans tous les fuseaux.
    expect(ligne).toContain('22/08/2026');
    expect(ligne).toContain('09h00');

    await act(async () => { arbre.unmount(); });
  });

  test('une date DEPASSEE ne s affiche pas : on peut relancer, il n y a rien a dire', async () => {
    /** @type {{ demarrer: null | (() => void) }} */
    const poignee = { demarrer: null };
    const arbre = monter(
      { teamParticipationSections: [section({ notAnswered: [P_ZOE] })] },
      {
        compteRendu: {
          blockedCount: 0,
          nextReminderAt: new Date(NOW_MS - (3 * 3600 * 1000)).toISOString(),
          remindedCount: 2,
        },
        poignee,
      },
    );

    await act(async () => { poignee.demarrer(); });
    await act(async () => {
      await new Promise((resoudre) => { setTimeout(resoudre, 0); });
    });

    expect(parIdentifiant(arbre, 'AE02-prochaine-relance')).toBe('');
    expect(textesVisibles(arbre).join(' | ')).not.toMatch(/Prochaine relance/);

    await act(async () => { arbre.unmount(); });
  });

  test('sans droit d edition, la ligne ne s affiche jamais', async () => {
    /** @type {{ demarrer: null | (() => void) }} */
    const poignee = { demarrer: null };
    const arbre = monter(
      {
        canEdit: false,
        teamParticipationSections: [section({ notAnswered: [P_ZOE] })],
      },
      {
        compteRendu: { blockedCount: 1, nextReminderAt: PROCHAINE_RELANCE.toISOString() },
        poignee,
      },
    );

    await act(async () => { poignee.demarrer(); });
    await act(async () => {
      await new Promise((resoudre) => { setTimeout(resoudre, 0); });
    });

    expect(parIdentifiant(arbre, 'AE02-prochaine-relance')).toBe('');

    await act(async () => { arbre.unmount(); });
  });
});

describe('AE02 · temoin 5 — l ecran par defaut n a pas bouge', () => {
  test('sans saisie : memes groupes, meme ordre, memes noms qu AD06', () => {
    const arbre = monter({
      teamParticipationSections: [section({
        missing: [P_CHLOE],
        notAnswered: [P_ZOE],
        participating: [P_ELOISE],
      })],
    });

    const textes = textesDeLaListe(arbre);
    const rang = (/** @type {string} */ libelle) => textes.indexOf(libelle);

    expect(rang('Présent·e·s')).toBeGreaterThanOrEqual(0);
    expect(rang('Présent·e·s')).toBeLessThan(rang('Absent·e·s'));
    expect(rang('Absent·e·s')).toBeLessThan(rang('Sans réponse'));
    expect(textes).toContain('U15 Feminines');
    expect(textes).toContain('Éloïse Dupont');
    expect(textes).toContain('Chloé Durand');
    expect(textes).toContain('Zoé Dupont');
  });

  test('un groupe vide garde son titre et dit POURQUOI — la recherche n y touche pas', () => {
    const arbre = monter({
      teamParticipationSections: [section({ participating: [P_ELOISE] })],
    });

    const textes = textesVisibles(arbre);
    expect(textes).toContain('Aucune absence signalée.');
    expect(textes).toContain('Tout le monde a répondu.');
  });

  test('la barre de recherche ne s affiche pas quand il n y a aucun nom a chercher', () => {
    const arbre = monter({ teamParticipationSections: [] });

    expect(arbre.root.findAllByType(TextInput)).toEqual([]);
  });

  test('elle ne s affiche pas non plus quand les identites sont masquees', () => {
    const arbre = monter({
      event: { documentId: 'evt-1', participantIdentitiesHidden: true },
      participantsSummary: { capacity: 0, participatingCount: 3 },
      teamParticipationSections: [section({ participating: [P_ELOISE] })],
    });

    expect(arbre.root.findAllByType(TextInput)).toEqual([]);
  });
});
