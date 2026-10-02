import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { saveEventMyMatchResponse } from '@/services/matchStats/matchStatsService';

import PlayerMatchResponseScreen from '../PlayerMatchResponseScreen';

// ST-REPONSE (02/10) — « MON RETOUR DE MATCH », LES 9 ÉTATS DU DESIGN VALIDÉ.
//
// Design : https://claude.ai/artifact/9S18FWsXHaN9PBSZ3koNSF, page 4, planche « P4-reponse-tel »
// (validé par Adel le 02/10 vers 02h45). Relevé « avant » : écran 11 de
// https://claude.ai/artifact/5PYnK9DAhwsoPXAQxS8Vsn.
//
// 🔬 LA COUTURE EST LE TEXTE VISIBLE ET CE QUI PART AU SERVEUR, jamais la forme de l'arbre
// (mémoire « recette-test-caracterisation-ecran-rn ») : ces témoins survivent à une
// refonte de mise en page. L'écran n'avait AUCUN test (E6) : ce fichier décrit aussi ce qui
// doit RESTER (les bornes H6, la forme de l'envoi), pas seulement ce qui change.
//
// Les données sont celles de la tournée du 01/10 : Hugo, U15 d'AS Montrivage, match
// « AS Montrivage — Test-COMPO » du 05/09, 2 - 1, score saisi par Karim.

/** @type {any} */
let mockEnveloppe = null;
/** @type {any} */
let mockUtilisateur = { documentId: 'hugo', position: 'Milieu central' };
const mockRefetch = jest.fn();

jest.mock('@/services/matchStats/matchStatsQueries', () => ({
  // L'enveloppe est construite UNE fois par témoin et rendue telle quelle : une enveloppe
  // neuve à chaque appel fait re-tirer l'effet d'hydratation en boucle (mémoire R03).
  useGetEventMyMatchResponse: () => mockEnveloppe,
  useGetLeagueMyMatchResponse: () => ({
    data: null, error: null, isLoading: false, refetch: jest.fn(),
  }),
}));

// ⛔ Jamais `requireActual` sur un service : le client HTTP refuse de se charger sans `API_URL`.
jest.mock('@/services/matchStats/matchStatsService', () => ({
  saveEventMyMatchResponse: jest.fn(() => Promise.resolve({})),
  saveLeagueMyMatchResponse: jest.fn(() => Promise.resolve({})),
}));

jest.mock('@/domains/refresh/afterAction', () => ({
  invalidateAfterAction: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: mockUtilisateur }),
}));

jest.mock('@/navigation/useBottomDockLayout', () => ({
  __esModule: true,
  default: () => ({ sceneBottomInset: 0 }),
}));

jest.mock('@/components/templates/ScreenContainer', () => {
  const { View: Vue } = jest.requireActual('react-native');
  return function ScreenContainerMock({ children }) { return <Vue>{children}</Vue>; };
});

// La doublure de `Button` rend un vrai pressable qui porte son titre (mémoire E6).
jest.mock('@/components/atoms/button/Button', () => {
  const { Pressable: Appui, Text: Texte } = jest.requireActual('react-native');
  return function ButtonMock({ disabled, onPress, title }) {
    return (
      <Appui
        accessibilityRole="button"
        accessibilityState={{ disabled: Boolean(disabled) }}
        disabled={disabled}
        onPress={onPress}
      >
        <Texte>{title}</Texte>
      </Appui>
    );
  };
});

jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => {
  const { Pressable: Appui } = jest.requireActual('react-native');
  return function HeaderBackButtonMock({ onPress }) {
    return <Appui accessibilityLabel="Retour" onPress={onPress} />;
  };
});

// Le sélecteur segmenté tire `gesture-handler` : sa doublure garde ses libellés et son
// `onChange`
// (motif de `AdminManagerRequests.test.js`).
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => {
  const { Pressable: Appui, Text: Texte, View: Vue } = jest.requireActual('react-native');
  return function SegmentedControlMock({ onChange, options }) {
    return (
      <Vue>
        {options.map((option) => (
          <Appui key={option.value} onPress={() => onChange(option.value)}>
            <Texte>{option.label}</Texte>
          </Appui>
        ))}
      </Vue>
    );
  };
});

// Le squelette passe par `masked-view`, que jest ne transforme pas : on garde ses blocs,
// sans l'effet.
jest.mock('@/components/atoms/skeletonLoader/SkeletonLoader', () => {
  const { View: Vue } = jest.requireActual('react-native');
  return function SkeletonLoaderMock({ children }) {
    return <Vue testID="squelette">{children}</Vue>;
  };
});
jest.mock('@/components/atoms/glyphIcon/GlyphIcon', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/atoms/SvgIcon/SvgIcon', () => ({
  __esModule: true,
  default: () => null,
  SvgIcon: () => null,
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
      Images: {},
      Spaces: espaces,
    }),
  };
});

/**
 * La doublure de `t` : le repli est rendu, ses {{jetons}} remplacés ; une clef sans repli
 * reste la clef (mémoire D34). Partagée par `react-i18next` et `i18next`. Les replis au
 * pluriel (`defaultValue_one` / `_other`) suivent la règle française : 0 et 1 au singulier.
 * @param {string} cle - La clef.
 * @param {any} repli - Le libellé de repli, ou des options.
 * @param {any} options - Les jetons.
 * @returns {string} - Le texte.
 */
const mockT = (cle, repli, options) => {
  const pluriel = repli?.count > 1 ? repli?.defaultValue_other : repli?.defaultValue_one;
  const texte = typeof repli === 'string' ? repli : (pluriel || repli?.defaultValue || cle);
  const jetons = typeof repli === 'object' && repli ? repli : (options || {});
  return texte.replace(/\{\{(\w+)\}\}/g, (jeton, nom) => (
    jetons[nom] !== undefined ? String(jetons[nom]) : jeton
  ));
};

jest.mock('react-i18next', () => ({
  initReactI18next: { init: jest.fn(), type: '3rdParty' },
  useTranslation: () => ({ t: mockT }),
}));

// Le module est chargé AVANT que `mockT` existe (les `jest.mock` sont hissés) : on passe
// par une flèche.
jest.mock('i18next', () => ({
  __esModule: true,
  default: { language: 'fr', t: (...args) => mockT(...args) },
}));

const MATCH = {
  event: {
    date: '2026-09-05T17:00:00.000Z', documentId: 'evt-u15', name: 'AS Montrivage — Test-COMPO',
  },
  permissions: { canRespond: true },
  score: {
    available: true,
    recordedBy: { documentId: 'karim', firstname: 'Karim' },
    scoreAgainst: 1,
    scoreFor: 2,
    source: 'manual',
  },
  sourceType: 'event',
  sport: 'football',
  team: { documentId: 'team-u15', name: 'U15' },
};

const REPONSE_ENVOYEE = {
  documentId: 'rep-1',
  minutesPlayed: 90,
  participation: 'played',
  quantitativeState: 'completed',
  selfComment: "Bon match, j'ai marqué sur corner.",
  selfRating: 8,
  sportPayload: { assists: 0, goals: 1 },
  status: 'submitted',
  submittedAt: '2026-10-01T20:28:33.000Z',
  teamRating: 7,
  updatedAt: '2026-10-01T20:28:33.000Z',
};

/** @type {any[]} */
const arbres = [];

afterEach(async () => {
  // 🧹 Un arbre orphelin fait sortir jest en 1, tous les tests verts (défaut payé au lot D68).
  await act(async () => { arbres.splice(0).forEach((arbre) => arbre.unmount()); });
  jest.clearAllMocks();
});

/**
 * Monte l'écran sur l'enveloppe donnée.
 * @param {{ data?: any, error?: any, isLoading?: boolean }} enveloppe - Ce que rend la requête.
 * @returns {Promise<{ arbre: any, navigation: any }>} - L'écran monté et sa navigation.
 */
const monter = async (enveloppe) => {
  mockEnveloppe = {
    data: enveloppe.data ?? null,
    error: enveloppe.error ?? null,
    isLoading: Boolean(enveloppe.isLoading),
    refetch: mockRefetch,
  };
  const navigation = {
    canGoBack: jest.fn(() => true), goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(),
  };
  const route = { params: { eventId: 'evt-u15', sourceType: 'event', teamId: 'team-u15' } };
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <PlayerMatchResponseScreen navigation={navigation} route={route} />
      </QueryClientProvider>,
    );
  });
  arbres.push(arbre);
  return { arbre, navigation };
};

/**
 * Tous les textes affichés, dans l'ordre.
 * @param {any} arbre - L'arbre monté.
 * @returns {string[]} - Les textes.
 */
const textes = (arbre) => {
  // Un texte imbriqué (« … · <gras>Victoire 2 - 1</gras> · … ») se lit d'un seul tenant.
  const aplatir = (enfants) => [].concat(enfants).map((morceau) => {
    if (typeof morceau === 'string' || typeof morceau === 'number') return String(morceau);
    return morceau?.props ? aplatir(morceau.props.children) : '';
  }).join('');
  return arbre.root.findAllByType(Text)
    .map((noeud) => aplatir(noeud.props.children))
    .filter(Boolean);
};

/**
 * Le pressable qui porte ce libellé (texte affiché ou étiquette d'accessibilité).
 * @param {any} arbre - L'arbre monté.
 * @param {string} libelle - Le libellé exact.
 * @returns {any} - Le nœud pressable.
 */
const appui = (arbre, libelle) => {
  // Tout ce qui se presse : `Pressable` comme `TouchableOpacity` (le sélecteur segmenté).
  const candidats = arbre.root.findAll((noeud) => (
    typeof noeud.type !== 'string' && typeof noeud.props?.onPress === 'function'
  )).filter((noeud) => (
    noeud.props.accessibilityLabel === libelle
    || noeud.findAllByType(Text)
      .some((texte) => [].concat(texte.props.children).join('') === libelle)
  ));
  if (!candidats.length) {
    throw new Error(`Aucun appui « ${libelle} ». Textes : ${textes(arbre).join(' | ')}`);
  }
  return candidats[candidats.length - 1];
};

/**
 * Appuie sur ce qui porte ce libellé.
 * @param {any} arbre - L'arbre monté.
 * @param {string} libelle - Le libellé exact.
 * @returns {Promise<void>} - Quand le rendu est retombé.
 */
const presser = async (arbre, libelle) => {
  await act(async () => { appui(arbre, libelle).props.onPress(); });
};

/**
 * Le champ de saisie qui porte cette étiquette d'accessibilité.
 * @param {any} arbre - L'arbre monté.
 * @param {string} etiquette - L'étiquette.
 * @returns {any} - Le champ.
 */
const champ = (arbre, etiquette) => arbre.root.findAll((noeud) => (
  noeud.props
  && noeud.props.accessibilityLabel === etiquette
  && typeof noeud.props.onChangeText === 'function'
))[0];

/**
 * Laisse la mutation et ses alertes redescendre.
 * @returns {Promise<void>} - Quand la file est vidée.
 */
const vidanger = async () => {
  for (let tour = 0; tour < 6; tour += 1) {
    // eslint-disable-next-line no-await-in-loop -- l'attente est justement le sujet
    await act(async () => { await new Promise((resoudre) => { setTimeout(resoudre, 0); }); });
  }
};

describe('ST-REPONSE — « Mon retour de match », les 9 états de la planche', () => {
  test('1 · la question d\'abord : le match, la question, et les boutons attendent', async () => {
    const { arbre } = await monter({ data: { ...MATCH, response: null } });
    const tout = textes(arbre);
    expect(tout).toContain('Mon retour de match');
    expect(tout).toContain('AS Montrivage — Test-COMPO');
    expect(tout.some((texte) => (
      texte.includes('U15') && texte.includes('Victoire 2 - 1') && texte.includes('saisi par Karim')
    ))).toBe(true);
    expect(tout).toContain('As-tu joué ce match ?');
    expect(tout).toEqual(expect.arrayContaining([
      "J'ai joué", "J'étais là sans jouer", "Je n'étais pas concerné·e",
    ]));
    expect(tout).not.toContain('Ma performance');
    expect(appui(arbre, 'Brouillon').props.disabled).toBe(true);
    expect(appui(arbre, 'Envoyer').props.disabled).toBe(true);
  });

  test('2 · j\'ai joué : un sélecteur, un seul temps de jeu rempli par les pastilles', async () => {
    const { arbre } = await monter({ data: { ...MATCH, response: null } });
    await presser(arbre, "J'ai joué");
    const tout = textes(arbre);
    expect(tout).toEqual(expect.arrayContaining([
      'Je connais mes chiffres', 'Je ne sais pas', 'Temps de jeu', 'Buts', 'Passes décisives',
    ]));
    // Retirés : le lien gris, le second compteur, les titres de section.
    expect(tout).not.toContain('Je ne connais pas mes stats');
    expect(tout).not.toContain('Temps de jeu (min)');
    expect(tout).not.toContain('Mes stats quantitatives');
    expect(tout).not.toContain('Actions');
    // Non gardien : ni buts encaissés, ni clean sheet.
    expect(tout).not.toContain('Buts encaissés');
    expect(tout).not.toContain('Clean sheet');
    await presser(arbre, 'Tout le match');
    expect(champ(arbre, 'Temps de jeu, en minutes').props.value).toBe('90');
    expect(appui(arbre, 'Envoyer').props.disabled).toBe(false);
  });

  test('3 · je ne sais pas : rien à inventer, l\'entraîneur saisira, l\'envoi le dit', async () => {
    const { arbre } = await monter({ data: { ...MATCH, response: null } });
    await presser(arbre, "J'ai joué");
    await presser(arbre, 'Je ne sais pas');
    const tout = textes(arbre);
    expect(tout.some((texte) => texte.includes('Karim saisira tes chiffres sur la feuille')))
      .toBe(true);
    expect(tout).not.toContain('Buts');
    await presser(arbre, 'Envoyer');
    await vidanger();
    expect(saveEventMyMatchResponse).toHaveBeenCalledTimes(1);
    const [, envoi] = /** @type {any} */ (saveEventMyMatchResponse).mock.calls[0];
    expect(envoi).toMatchObject({
      participation: 'played', quantitativeState: 'unknown', status: 'submitted',
    });
    expect(envoi.minutesPlayed).toBeUndefined();
  });

  test('4 · mes deux notes, séparées, et une ligne qui dit qui lira la réponse', async () => {
    const { arbre } = await monter({ data: { ...MATCH, response: null } });
    await presser(arbre, "J'ai joué");
    const tout = textes(arbre);
    expect(tout).toEqual(expect.arrayContaining([
      'Ma performance', "Le match de l'équipe", 'Un mot sur le match',
    ]));
    expect(tout)
      .toContain('Karim lit tes chiffres, tes notes et ton mot. Tes coéquipiers, jamais.');
  });

  test('5 · j\'étais là sans jouer : « Ma note », pas de chiffres', async () => {
    const { arbre } = await monter({ data: { ...MATCH, response: null } });
    await presser(arbre, "J'étais là sans jouer");
    const tout = textes(arbre);
    expect(tout).toContain('Ma note');
    expect(tout).not.toContain('Ma performance');
    expect(tout).not.toContain('Buts');
    expect(tout).toContain('Karim lit tes notes et ton mot. Tes coéquipiers, jamais.');
  });

  test('6 · pas concerné·e : rien à remplir, un seul bouton « Envoyer »', async () => {
    const { arbre } = await monter({ data: { ...MATCH, response: null } });
    await presser(arbre, "Je n'étais pas concerné·e");
    const tout = textes(arbre);
    expect(tout).not.toContain('Brouillon');
    expect(tout).not.toContain('Ma performance');
    expect(tout).toContain('Tu ne seras plus relancé·e pour ce match');
    await presser(arbre, 'Envoyer');
    await vidanger();
    const [, envoi] = /** @type {any} */ (saveEventMyMatchResponse).mock.calls[0];
    expect(envoi).toMatchObject({
      participation: 'not_involved', selfRating: null, status: 'submitted', teamRating: null,
    });
  });

  test('7 · une incohérence : dite près du chiffre, rassurante, l\'envoi attend', async () => {
    const { arbre } = await monter({ data: { ...MATCH, response: null } });
    await presser(arbre, "J'ai joué");
    await act(async () => { champ(arbre, 'Buts').props.onChangeText('3'); });
    const tout = textes(arbre);
    expect(tout).toContain('3 buts, pour un score de 2');
    expect(tout).toContain('Tes buts ne peuvent pas dépasser le score de ton équipe.');
    expect(tout).toContain("Le score du match ne change pas : corrige tes chiffres avant l'envoi.");
    expect(appui(arbre, 'Envoyer').props.disabled).toBe(true);
    // Le « + » bute sur le score : on ne marque pas plus de buts que son équipe.
    expect(appui(arbre, 'Un but de plus').props.disabled).toBe(true);
  });

  test('8 · déjà envoyée : on le sait, quand, et elle reste corrigible', async () => {
    const { arbre } = await monter({ data: { ...MATCH, response: REPONSE_ENVOYEE } });
    const tout = textes(arbre);
    expect(tout.some((texte) => texte.startsWith('Envoyée le ') && texte.includes(' à ')))
      .toBe(true);
    expect(tout).toContain('Tu peux encore la corriger ; Karim verra la nouvelle version.');
    expect(tout).not.toContain('Brouillon');
    await presser(arbre, 'Enregistrer la correction');
    await vidanger();
    const [, envoi] = /** @type {any} */ (saveEventMyMatchResponse).mock.calls[0];
    expect(envoi).toMatchObject({
      assists: 0,
      goals: 1,
      minutesPlayed: 90,
      participation: 'played',
      quantitativeState: 'completed',
      status: 'submitted',
    });
  });

  test('9 · erreur : l\'en-tête et le retour restent, le message dit quoi faire', async () => {
    const { arbre } = await monter({ error: new Error('Network Error') });
    const tout = textes(arbre);
    expect(tout).toContain('Mon retour de match');
    expect(appui(arbre, 'Retour')).toBeTruthy();
    expect(tout).toContain("Ton questionnaire n'a pas pu être chargé.");
    expect(tout)
      .toContain('Vérifie ta connexion, puis réessaie. Ce que tu as déjà rempli est gardé.');
    await presser(arbre, 'Réessayer');
    expect(mockRefetch).toHaveBeenCalled();
  });
});

describe('ST-REPONSE — ce qui part au serveur, et ce qui reste', () => {
  test('envoi complet : la forme du serveur, puis retour SANS empiler une 2e fiche', async () => {
    const alerte = jest.spyOn(Alert, 'alert');
    const { arbre, navigation } = await monter({ data: { ...MATCH, response: null } });
    await presser(arbre, "J'ai joué");
    await presser(arbre, 'Tout le match');
    await presser(arbre, 'Un but de plus');
    await presser(arbre, 'Ma performance : 8');
    await presser(arbre, "Le match de l'équipe : 7");
    await act(async () => {
      champ(arbre, 'Un mot sur le match').props.onChangeText('  Bon match.  ');
    });
    await presser(arbre, 'Envoyer');
    await vidanger();
    expect(saveEventMyMatchResponse).toHaveBeenCalledWith('evt-u15', {
      assists: 0,
      cleanSheet: false,
      goals: 1,
      minutesPlayed: 90,
      participation: 'played',
      quantitativeState: 'completed',
      selfComment: 'Bon match.',
      selfRating: 8,
      status: 'submitted',
      teamId: 'team-u15',
      teamRating: 7,
    });
    // Défaut 22 du relevé : `replace` empilait une 2e fiche du match sous la première.
    const merci = alerte.mock.calls.find(([titre]) => titre === 'Merci');
    expect(merci).toBeTruthy();
    await act(async () => { merci[2][0].onPress(); });
    expect(navigation.goBack).toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();
    alerte.mockRestore();
  });

  test('gardien : « Buts encaissés » et « Clean sheet » apparaissent', async () => {
    mockUtilisateur = { documentId: 'hugo', position: 'Gardien' };
    const { arbre } = await monter({ data: { ...MATCH, response: null } });
    await presser(arbre, "J'ai joué");
    expect(textes(arbre)).toEqual(expect.arrayContaining(['Buts encaissés', 'Clean sheet']));
    mockUtilisateur = { documentId: 'hugo', position: 'Milieu central' };
  });

  test('bornes H6 gardées : 999 minutes tapées deviennent 240, comme au serveur', async () => {
    const { arbre } = await monter({ data: { ...MATCH, response: null } });
    await presser(arbre, "J'ai joué");
    await act(async () => { champ(arbre, 'Temps de jeu, en minutes').props.onChangeText('999'); });
    expect(champ(arbre, 'Temps de jeu, en minutes').props.value).toBe('240');
  });

  test('chargement : l\'en-tête et le retour restent pendant que tout arrive', async () => {
    const { arbre } = await monter({ isLoading: true });
    expect(textes(arbre)).toContain('Mon retour de match');
    expect(appui(arbre, 'Retour')).toBeTruthy();
    expect(arbre.root.findAllByProps({ testID: 'squelette' }).length).toBeGreaterThan(0);
  });
});
