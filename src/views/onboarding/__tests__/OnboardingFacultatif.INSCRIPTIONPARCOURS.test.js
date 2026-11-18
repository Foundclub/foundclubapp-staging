import fs from 'fs';
import path from 'path';

import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import OnboardingFacultatif from '../components/OnboardingFacultatif';

// INSCRIPTION-PARCOURS A3 (D245, 18/11) — « rien ne dit qu'une étape est facultative ». Chaque
// étape facultative de l'inscription porte EN HAUT, au-dessus de son titre, « Facultatif : tu
// peux passer cette étape » et « Passer », branché sur le MÊME saut que le lien du bas. Les
// étapes obligatoires n'en ont pas. La liste est celle du code : une étape est facultative quand
// elle monte `OnboardingSkipLink` (ou, pour le club, le « Passer » de l'en-tête).

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
      const valeur = String(cle).split('.').reduce(
        (/** @type {any} */ n, /** @type {string} */ s) => (n && typeof n === 'object' ? n[s] : undefined),
        jest.requireActual('@/theme/strings/translations/fr').default,
      );
      return typeof valeur === 'string' ? valeur : repli;
    },
  }),
}));

// Le vrai thème, sans fournisseur (même doublure que PlayerCardScreen.etats.caracterisation).
jest.mock('@/theme/themeContext', () => {
  const couleurs = jest.requireActual('@/theme/colors').default();
  return {
    __esModule: true,
    default: () => ({
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(couleurs),
      Colors: couleurs,
      Fonts: jest.requireActual('@/theme/fonts').default(couleurs),
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});

const DOSSIER = path.join(__dirname, '..');
const lire = (/** @type {string} */ ecran) => fs.readFileSync(path.join(DOSSIER, `${ecran}.js`), 'utf8');

/** Étape facultative → le saut qu'elle donne déjà au lien du bas. */
const FACULTATIVES = {
  UserAddress: 'handleSkip',
  UserAffiliationGuide: 'handleContinueLater',
  UserAvatar: 'handleSkip',
  UserCategory: 'handleSkip',
  UserClubSearch: 'handleSkip',
  UserLevel: 'handleSkip',
  UserPhysique: 'handleSkip',
  UserPosition: 'handleSkip',
  UserSection: 'handleSkip',
  UserSport: 'handleSkip',
  UserSportHistory: 'handleSkip',
  UserTrainedTeams: 'goToNextStep',
};
const OBLIGATOIRES = ['UserName', 'UserParentalDeclaration', 'UserParentAccountRequired', 'UserRole', 'Welcome'];

describe('INSCRIPTION-PARCOURS A3 — les étapes facultatives le disent, en haut', () => {
  it('la liste est complète : toute étape qui monte le lien du bas est dans FACULTATIVES', () => {
    const avecLien = fs.readdirSync(DOSSIER)
      .filter((f) => /^(User|Welcome).*\.js$/.test(f))
      .map((f) => f.replace(/\.js$/, ''))
      .filter((ecran) => lire(ecran).includes('<OnboardingSkipLink'));
    expect(avecLien.filter((ecran) => !FACULTATIVES[ecran])).toEqual([]);
  });

  it.each(Object.entries(FACULTATIVES))('%s : le bandeau, au-dessus du titre, même saut (%s)', (ecran, saut) => {
    const source = lire(ecran);
    const bandeau = source.indexOf(`<OnboardingFacultatif onPress={${saut}} />`);
    const titre = source.indexOf('Fonts.h2Black');
    expect(bandeau).toBeGreaterThan(-1);
    expect(bandeau).toBeLessThan(titre);
  });

  it.each(OBLIGATOIRES)('%s (obligatoire) : pas de bandeau', (ecran) => {
    expect(lire(ecran)).not.toContain('OnboardingFacultatif');
  });

  it('le bandeau dit la phrase et « Passer » déclenche le saut', () => {
    const saut = jest.fn();
    let arbre;
    act(() => { arbre = renderer.create(<OnboardingFacultatif onPress={saut} />); });
    const textes = /** @type {any} */ (arbre).root.findAllByType(Text).map((n) => n.props.children);
    expect(textes).toEqual(['Facultatif : tu peux passer cette étape', 'Passer']);
    act(() => { /** @type {any} */ (arbre).root.findByType(TouchableOpacity).props.onPress(); });
    expect(saut).toHaveBeenCalledTimes(1);
  });
});
