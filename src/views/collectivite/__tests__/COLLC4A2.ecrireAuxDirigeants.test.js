import { readFileSync } from 'fs';
import { join } from 'path';

import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import EcrireAuxDirigeants from '../components/EcrireAuxDirigeants';

// 🏛️ COLL-C4A2 (02/10) — PLANCHE 3 : « Écrire aux dirigeants » (D73, « écrire A ») — la
// conversation PRIVÉE de la Ville avec les dirigeants de CE club (design HY521H1 page 3,
// P3c-canal-tel écran 8).
//
// Ce que ce témoin fige (ROUGE avant le lot : aucun bouton, la conversation n'existait pas) :
//   - l'appui ouvre (ou retrouve) la conversation côté serveur, puis l'ouvre au nom de la Ville ;
//   - « Demander au club de compléter sa fiche » ouvre la MÊME conversation, une phrase prête ;
//   - un refus du serveur (club non rattaché) se dit, sans ouvrir de conversation ;
//   - le bouton est posé là où les lots précédents l'avaient promis : fiche du club, liste des
//     clubs, fiche d'un bloc du planning.
//
// 🧯 COLL-FIX-DEMANDES (02/10) — ELLE NAÎT AU PREMIER MESSAGE. L'appui la créait côté serveur
// avant tout message (tournée de recette : POST …/conversation 200 à la simple ouverture). L'appui
// la RETROUVE désormais (GET) : elle s'ouvre si elle existe ; sinon le bouton devient la saisie
// du premier message, et c'est l'envoi qui la crée.

const mockNavigate = jest.fn();
const mockOuvrir = jest.fn();
const mockTrouver = jest.fn();
const mockPremier = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
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
jest.mock('@/services/collectivite/collectiviteCanauxService', () => ({
  ecrireLePremierMessageAuClub: (/** @type {any} */ args) => mockPremier(args),
  ouvrirConversationAvecLeClub: (/** @type {any} */ args) => mockOuvrir(args),
  trouverConversationAvecLeClub: (/** @type {any} */ args) => mockTrouver(args),
}));
jest.mock('@/components/molecules/input/Input', () => {
  const reactActuel = jest.requireActual('react');
  const { TextInput: SaisieRN } = jest.requireActual('react-native');
  return function InputMock(/** @type {any} */ props) {
    return reactActuel.createElement(SaisieRN, {
      multiline: props.multiline,
      onChangeText: props.onChangeText,
      testID: props.testID,
      value: props.value,
    });
  };
});

const CLUB = { documentId: 'club-as', name: 'AS Montrivage' };
const REFUS = {
  response: {
    data: {
      error: {
        details: { code: 'COLLECTIVITE_CLUB_NOT_FOUND' },
        message: 'Ce club n’est pas rattaché à votre collectivité.',
      },
    },
  },
};

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
const appuyer = async (/** @type {any} */ arbre, /** @type {string} */ testID) => {
  const noeud = arbre.root.findAll(
    (/** @type {any} */ n) => n.props?.testID === testID && typeof n.props?.onPress === 'function',
  )[0];
  await act(async () => {
    await noeud.props.onPress();
  });
};
const lire = (/** @type {string} */ chemin) => (
  readFileSync(join(__dirname, '..', '..', chemin), 'utf8')
);

const champDe = (/** @type {any} */ arbre, /** @type {string} */ testID) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.testID === testID
    && typeof n.props?.onChangeText === 'function',
)[0];
const saisir = async (
  /** @type {any} */ arbre,
  /** @type {string} */ testID,
  /** @type {string} */ texte,
) => {
  await act(async () => { champDe(arbre, testID).props.onChangeText(texte); });
};
const valeurDe = (/** @type {any} */ arbre, /** @type {string} */ testID) => (
  champDe(arbre, testID)?.props.value
);
const VILLE = { documentId: 'ville-1' };
const OUVERTE = { data: { club: CLUB, collectivite: VILLE, documentId: 'privee-1' } };
const AUCUNE = { data: { club: CLUB, collectivite: VILLE, documentId: null } };

beforeEach(() => {
  mockNavigate.mockReset();
  mockOuvrir.mockReset();
  mockTrouver.mockReset();
  mockPremier.mockReset();
  mockOuvrir.mockResolvedValue(OUVERTE);
  // Par défaut, la conversation EXISTE déjà : l'appui l'ouvre.
  mockTrouver.mockResolvedValue(OUVERTE);
  mockPremier.mockResolvedValue(OUVERTE);
});

describe('COLL-C4A2 — planche 3 : « Écrire aux dirigeants »', () => {
  it('ouvre la conversation privée de la Ville avec CE club, au nom de la Ville', async () => {
    const arbre = await monter(<EcrireAuxDirigeants club={CLUB} collectiviteId="ville-1" />);
    expect(textes(arbre)).toContain('Écrire aux dirigeants');
    await appuyer(arbre, 'ecrire-aux-dirigeants');
    // COLL-FIX-DEMANDES : l'appui RETROUVE (lecture), il ne crée rien.
    expect(mockTrouver).toHaveBeenCalledWith({ clubId: 'club-as', collectiviteId: 'ville-1' });
    expect(mockOuvrir).not.toHaveBeenCalled();
    expect(mockPremier).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('Conversation', {
      chatId: 'privee-1',
      chatType: 'collectivite_club',
      espace: 'ville',
      title: 'AS Montrivage',
    });
  });

  it('« Demander au club de compléter sa fiche » : même conversation, phrase prête', async () => {
    const arbre = await monter(
      <EcrireAuxDirigeants
        club={CLUB}
        collectiviteId="ville-1"
        compact
        demanderFiche
        testID="fiche"
      />,
    );
    expect(textes(arbre)).toContain('Demander au club de compléter sa fiche');
    await appuyer(arbre, 'fiche');
    expect(mockNavigate).toHaveBeenCalledWith('Conversation', expect.objectContaining({
      brouillon: expect.stringContaining('compléter les coordonnées de votre club'),
      chatId: 'privee-1',
    }));
  });

  it('un refus du serveur se dit, et aucune conversation ne s’ouvre', async () => {
    mockTrouver.mockRejectedValue(REFUS);
    const arbre = await monter(<EcrireAuxDirigeants club={CLUB} collectiviteId="ville-1" />);
    await appuyer(arbre, 'ecrire-aux-dirigeants');
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(arbre.root.findAllByProps({ testID: 'ecrire-aux-dirigeants-erreur' }).length)
      .toBeGreaterThan(0);
  });

  it('sans club ni Ville : rien', async () => {
    const arbre = await monter(<EcrireAuxDirigeants club={null} collectiviteId="ville-1" />);
    expect(arbre.toJSON()).toBeNull();
  });

  it('il est posé là où les lots précédents l’avaient promis', () => {
    const fiche = lire('collectivite/CollectiviteClubDetails.js');
    expect(fiche).toMatch(/<EcrireAuxDirigeants[\s\S]*?testID="fiche-club-ecrire"/);
    expect(fiche).toMatch(/demanderFiche[\s\S]*?testID="fiche-club-demander-fiche"/);
    const liste = lire('collectivite/CollectiviteClubs.js');
    expect(liste).toMatch(/-ecrire`/);
    expect(liste).toMatch(/-demander-fiche`/);
    const planning = lire('planning/PersonalPlanningWeekFullscreen.js');
    expect(planning).toMatch(/testID="planning-ecrire-aux-dirigeants"/);
    expect(planning).not.toMatch(/POINT D ACCROCHE, aucun bouton tant que la conversation/);
  });
});

describe('COLL-FIX-DEMANDES — la conversation privée naît au premier message', () => {
  it('pas encore de conversation : l’appui ne crée rien, le bouton devient la saisie', async () => {
    mockTrouver.mockResolvedValue(AUCUNE);
    const arbre = await monter(<EcrireAuxDirigeants club={CLUB} collectiviteId="ville-1" />);
    await appuyer(arbre, 'ecrire-aux-dirigeants');
    expect(mockOuvrir).not.toHaveBeenCalled();
    expect(mockPremier).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Premier message aux dirigeants de AS Montrivage',
      'La conversation s’ouvre quand tu envoies ce message.',
      'Envoyer',
      'Annuler',
    ]));
    expect(valeurDe(arbre, 'ecrire-aux-dirigeants-premier-message')).toBe('');
  });

  it('l’envoi la crée, y pose le message, puis l’ouvre au nom de la Ville', async () => {
    mockTrouver.mockResolvedValue(AUCUNE);
    const arbre = await monter(<EcrireAuxDirigeants club={CLUB} collectiviteId="ville-1" />);
    await appuyer(arbre, 'ecrire-aux-dirigeants');
    const texte = 'Bonjour, une question sur vos créneaux';
    await saisir(arbre, 'ecrire-aux-dirigeants-premier-message', `  ${texte}  `);
    await appuyer(arbre, 'ecrire-aux-dirigeants-envoyer');
    expect(mockPremier).toHaveBeenCalledWith({
      clubId: 'club-as', collectiviteId: 'ville-1', message: texte,
    });
    expect(mockNavigate).toHaveBeenCalledWith('Conversation', {
      chatId: 'privee-1',
      chatType: 'collectivite_club',
      espace: 'ville',
      title: 'AS Montrivage',
    });
  });

  it('un message vide ne part pas', async () => {
    mockTrouver.mockResolvedValue(AUCUNE);
    const arbre = await monter(<EcrireAuxDirigeants club={CLUB} collectiviteId="ville-1" />);
    await appuyer(arbre, 'ecrire-aux-dirigeants');
    await saisir(arbre, 'ecrire-aux-dirigeants-premier-message', '   ');
    await appuyer(arbre, 'ecrire-aux-dirigeants-envoyer');
    expect(mockPremier).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('« compléter sa fiche » sans conversation : la phrase prête est dans la saisie', async () => {
    mockTrouver.mockResolvedValue(AUCUNE);
    const arbre = await monter(
      <EcrireAuxDirigeants
        club={CLUB}
        collectiviteId="ville-1"
        compact
        demanderFiche
        testID="fiche"
      />,
    );
    await appuyer(arbre, 'fiche');
    expect(valeurDe(arbre, 'fiche-premier-message'))
      .toEqual(expect.stringContaining('compléter les coordonnées'));
    await appuyer(arbre, 'fiche-envoyer');
    expect(mockPremier).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('compléter les coordonnées'),
    }));
    // Le message est parti : la conversation s'ouvre sans le reproposer en brouillon.
    expect(mockNavigate.mock.calls[0][1].brouillon).toBeUndefined();
  });

  it('Annuler : retour au bouton, rien n’est créé', async () => {
    mockTrouver.mockResolvedValue(AUCUNE);
    const arbre = await monter(<EcrireAuxDirigeants club={CLUB} collectiviteId="ville-1" />);
    await appuyer(arbre, 'ecrire-aux-dirigeants');
    await appuyer(arbre, 'ecrire-aux-dirigeants-annuler');
    expect(textes(arbre)).toContain('Écrire aux dirigeants');
    expect(textes(arbre)).not.toContain('Envoyer');
    expect(mockPremier).not.toHaveBeenCalled();
  });

  it('un échec de l’envoi se dit, la saisie reste, aucune conversation ne s’ouvre', async () => {
    mockTrouver.mockResolvedValue(AUCUNE);
    mockPremier.mockRejectedValue(REFUS);
    const arbre = await monter(<EcrireAuxDirigeants club={CLUB} collectiviteId="ville-1" />);
    await appuyer(arbre, 'ecrire-aux-dirigeants');
    await saisir(arbre, 'ecrire-aux-dirigeants-premier-message', 'Bonjour');
    await appuyer(arbre, 'ecrire-aux-dirigeants-envoyer');
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(arbre.root.findAllByProps({ testID: 'ecrire-aux-dirigeants-erreur' }).length)
      .toBeGreaterThan(0);
    expect(valeurDe(arbre, 'ecrire-aux-dirigeants-premier-message')).toBe('Bonjour');
  });
});
