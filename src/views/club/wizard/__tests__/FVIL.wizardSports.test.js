import renderer, { act } from 'react-test-renderer';

import { choisirLeSport, lignesDeSport } from '../../../../testSupport/temoinChoixDuSport';
import ClubWizardActivities from '../ClubWizardActivities';
import { ClubWizardProvider, useClubWizard } from '../ClubWizardContext';

// 🏟️ FINITIONS-VILLE (08/10/2026, tournée T20 P09, lot 7) — l'assistant de création de club
// listait ~145 sports en cases alphabétiques, avec les doublons de la base (« Volley » /
// « Volleyball »). Le choix du sport de l'app EST `ChoixDuSport` (décision d'Adel A09, déjà dans 9
// écrans) : les populaires d'abord, la recherche, puis de A à Z ; en choix MULTIPLE, sans
// « Tous les sports » (un club pratique des sports, il n'en filtre pas).
// ROUGE avant le lot : la liste était alphabétique, sans « Sports populaires ».

jest.mock('@/components/molecules/input/Input', () => {
  const { TextInput } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { onChangeText, placeholder, value }) => (
      <TextInput onChangeText={onChangeText} placeholder={placeholder} value={value} />
    ),
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {string} */ repli) => repli || cle,
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
      Spaces: espaces,
    }),
  };
});

jest.mock('@/components/molecules/wizardStepLayout/WizardStepLayout', () => ({
  __esModule: true,
  default: (/** @type {any} */ { children }) => children,
}));

jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => ({
    data: jest.requireActual('../../../../testSupport/temoinChoixDuSport').SPORTS_A09,
    isLoading: false,
  }),
}));

/** @type {string[]} */
let mockChoisis = [];
/**
 * Lit l'état de l'assistant à chaque rendu.
 * @returns {null} Rien.
 */
function Espion() {
  const { state } = useClubWizard();
  mockChoisis = state.activityDocumentIds;
  return null;
}

const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <ClubWizardProvider>
        <ClubWizardActivities navigation={{ goBack: jest.fn(), navigate: jest.fn() }} route={{}} />
        <Espion />
      </ClubWizardProvider>,
    );
  });
  return arbre;
};

describe('FVIL lot 7 · les sports de l’assistant de club : le choix du sport de l’app', () => {
  it('les populaires d’abord, sans « Tous les sports » ; cocher, décocher', async () => {
    const arbre = await monter();
    expect(lignesDeSport(arbre))
      .toEqual(['Football', 'Basketball', 'Handball', 'Rugby', 'Volleyball']);
    await choisirLeSport(arbre, 'Rugby');
    expect(mockChoisis).toEqual(['a-rugby']);
    await choisirLeSport(arbre, 'Football');
    expect(mockChoisis).toEqual(['a-rugby', 'a-1']);
    // Les sports choisis passent en tête, de A à Z (comme partout).
    expect(lignesDeSport(arbre).slice(0, 2)).toEqual(['Football', 'Rugby']);
    await choisirLeSport(arbre, 'Rugby');
    expect(mockChoisis).toEqual(['a-1']);
    expect(lignesDeSport(arbre)).not.toContain('Tous les sports');
  });
});
