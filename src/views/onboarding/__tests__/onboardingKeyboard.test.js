import fs from 'fs';
import path from 'path';

// D23 — defaut ① : « le clavier masque le bouton Continuer », capture d'Adel
// sur l'ecran 7/13. Adel n'en a teste qu'UN ; le parcours joueur en compte 13.
//
// Ce filet est un balayage de fichiers, et c'est delibere : le defaut ne vit
// dans AUCUN ecran en particulier, il vit dans le CUMUL. `FormScreenContainer`
// monte deja un evitement de clavier (`keyboardAvoiding` vrai par defaut) ;
// tout ecran qui en ajoute un second se retrouve avec deux compensations qui se
// mangent l'une l'autre, et un bouton sous le clavier. Trois ecrans le
// faisaient, chacun avec son propre nombre ecrit a la main : 110, 110, 100.
//
// Un test de rendu ecran par ecran aurait couvert 1 ecran sur 16. Celui-ci les
// couvre tous, y compris ceux qui seront ajoutes demain.

const ONBOARDING_DIR = path.join(__dirname, '..');
const AUTH_SCREENS = [
  path.join(__dirname, '..', '..', 'Login.js'),
  path.join(__dirname, '..', '..', 'Register.js'),
];

const listOnboardingScreens = () => fs
  .readdirSync(ONBOARDING_DIR)
  .filter((name) => name.endsWith('.js'))
  .map((name) => path.join(ONBOARDING_DIR, name));

const readScreens = () => [...listOnboardingScreens(), ...AUTH_SCREENS].map((file) => ({
  name: path.basename(file),
  source: fs.readFileSync(file, 'utf8'),
}));

describe('Tunnel d`inscription — un seul evitement de clavier par ecran (D23 ①)', () => {
  const screens = readScreens();

  it('le balayage voit bien les 16 ecrans du tunnel plus Login et Register', () => {
    // Temoin anti-faux-vert : un test de balayage qui ne lit rien passe au vert.
    expect(screens.length).toBeGreaterThanOrEqual(18);
    expect(screens.map((screen) => screen.name)).toEqual(
      expect.arrayContaining(['UserPhysique.js', 'UserName.js', 'UserAddress.js', 'Login.js']),
    );
  });

  it.each(readScreens())(
    '$name ne monte pas son propre KeyboardAvoidingView',
    ({ source }) => {
      expect(source).not.toContain('<KeyboardAvoidingView');
    },
  );

  it.each(readScreens())(
    '$name ne fige aucun decalage de clavier a la main',
    ({ source }) => {
      // `keyboardVerticalOffset={110}` etait le calcul du conteneur, fige sur UN
      // telephone : il se trompe des que l'en-tete ou l'encoche changent.
      expect(source).not.toMatch(/keyboardVerticalOffset=\{\s*\d/);
    },
  );

  it('tous les ecrans du tunnel passent par le conteneur qui fournit l`evitement', () => {
    const withoutContainer = screens
      .filter(({ source }) => !source.includes('FormScreenContainer'))
      .map(({ name }) => name);

    expect(withoutContainer).toEqual([]);
  });
});
