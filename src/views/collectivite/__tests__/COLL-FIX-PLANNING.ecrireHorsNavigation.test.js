import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import EcrireAuxDirigeants from '../components/EcrireAuxDirigeants';

// 🐞 COLL-FIX-PLANNING (02/10/2026), defaut G4 de la tournee T9 (capture T9_C29_6) — le composant
// SEUL, avec la VRAIE bibliotheque de navigation (aucune doublure de @react-navigation/native).
// Monte hors de tout NavigationContainer, comme dans la fenetre du bas de l app (un portail pose
// au-dessus de la navigation, src/app/AppProviders.native.js) :
//   - il ne plante plus (ROUGE avant : « Couldn't find a navigation object ») ;
//   - avec la navigation que l ecran lui passe, l appui ouvre la conversation ;
//   - sans navigation du tout, il ne pose pas un bouton qui ne mene nulle part.

const mockOuvrir = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
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
      Images: {},
      Spaces: espaces,
    }),
  };
});
jest.mock('@/services/collectivite/collectiviteCanauxService', () => ({
  ouvrirConversationAvecLeClub: (/** @type {any} */ args) => mockOuvrir(args),
}));

const CLUB = { documentId: 'club-as', name: 'AS Montrivage' };

const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
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
  .map((/** @type {any} */ n) => aplatir(n.props.children).trim());

beforeEach(() => {
  mockOuvrir.mockReset();
  mockOuvrir.mockResolvedValue({ data: { club: CLUB, documentId: 'privee-1' } });
});

describe('COLL-FIX-PLANNING G4 — « Écrire aux dirigeants » hors de la navigation', () => {
  it('avec la navigation de l ecran : il s affiche et ouvre la conversation', async () => {
    const navigation = { navigate: jest.fn() };
    const arbre = await monter(
      <EcrireAuxDirigeants
        club={CLUB}
        collectiviteId="ville-1"
        navigation={navigation}
        testID="ecrire"
      />,
    );
    expect(textes(arbre)).toContain('Écrire aux dirigeants');
    const bouton = arbre.root.findAll(
      (/** @type {any} */ n) => n.props?.testID === 'ecrire'
        && typeof n.props?.onPress === 'function',
    )[0];
    await act(async () => { await bouton.props.onPress(); });
    expect(mockOuvrir).toHaveBeenCalledWith({ clubId: 'club-as', collectiviteId: 'ville-1' });
    expect(navigation.navigate).toHaveBeenCalledWith('Conversation', expect.objectContaining({
      chatId: 'privee-1', espace: 'ville', title: 'AS Montrivage',
    }));
  });

  it('sans navigation : pas de plantage, et pas de bouton qui ne mene nulle part', async () => {
    const arbre = await monter(<EcrireAuxDirigeants club={CLUB} collectiviteId="ville-1" />);
    expect(arbre.toJSON()).toBeNull();
  });
});
