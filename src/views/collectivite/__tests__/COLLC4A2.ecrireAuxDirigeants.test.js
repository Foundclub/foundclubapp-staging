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

const mockNavigate = jest.fn();
const mockOuvrir = jest.fn();

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
  ouvrirConversationAvecLeClub: (/** @type {any} */ args) => mockOuvrir(args),
}));

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

beforeEach(() => {
  mockNavigate.mockReset();
  mockOuvrir.mockReset();
  mockOuvrir.mockResolvedValue({
    data: { club: CLUB, collectivite: { documentId: 'ville-1' }, documentId: 'privee-1' },
  });
});

describe('COLL-C4A2 — planche 3 : « Écrire aux dirigeants »', () => {
  it('ouvre la conversation privée de la Ville avec CE club, au nom de la Ville', async () => {
    const arbre = await monter(<EcrireAuxDirigeants club={CLUB} collectiviteId="ville-1" />);
    expect(textes(arbre)).toContain('Écrire aux dirigeants');
    await appuyer(arbre, 'ecrire-aux-dirigeants');
    expect(mockOuvrir).toHaveBeenCalledWith({ clubId: 'club-as', collectiviteId: 'ville-1' });
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
    mockOuvrir.mockRejectedValue(REFUS);
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
