import fs from 'fs';
import path from 'path';

import { HeaderHeightContext } from '@react-navigation/elements';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import renderer, { act } from 'react-test-renderer';

import useEnteteFlottant from '../useEnteteFlottant';
import useEnteteFlottantDuSite from '../useEnteteFlottant.web';

// T3-BANDEAU-HAUT (03/11, essai demandé par Adel, « 1- C ») — plus de place en haut : tout défile
// sauf la flèche, et, dans les onglets, la cloche et le profil. Rouge avant : le titre et le logo
// étaient posés au-dessus de la liste, donc jamais dans ce qui défile.

jest.mock('@/theme/themeContext', () => ({
  __esModule: true,
  default: () => ({ Colors: { primary800: 'fond-du-rond' } }),
}));
jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => 'HeaderBackButton');

const lire = (/** @type {string} */ relatif) => fs.readFileSync(
  path.resolve(__dirname, '..', '..', relatif),
  'utf8',
);

/**
 * La tranche du fichier qui va du rendu principal à la fin de sa liste.
 * @param {string} source
 * @param {string} debutDuRendu
 * @returns {{ avant: string, liste: string, apres: string }}
 */
const decouper = (source, debutDuRendu) => {
  const rendu = source.slice(source.lastIndexOf(debutDuRendu));
  const debut = rendu.indexOf('<ScrollView');
  const fin = rendu.indexOf('</ScrollView>');
  return {
    apres: rendu.slice(fin),
    avant: rendu.slice(0, debut),
    liste: rendu.slice(debut, fin),
  };
};

const lancer = (/** @type {any} */ hook, /** @type {any} */ navigation, hauteur = 110) => {
  /** @type {any} */
  let valeur = null;
  function Sonde() {
    valeur = hook(navigation);
    return null;
  }
  act(() => {
    renderer.create(
      <SafeAreaInsetsContext.Provider
        value={{
          bottom: 0, left: 0, right: 0, top: 50,
        }}
      >
        <HeaderHeightContext.Provider value={hauteur}>
          <Sonde />
        </HeaderHeightContext.Provider>
      </SafeAreaInsetsContext.Provider>,
    );
  });
  return valeur;
};

describe('la brique', () => {
  test('la barre système reste réservée, le reste de l en-tête passe dans ce qui défile', () => {
    const { conteneur, retraitDuDefilement } = lancer(useEnteteFlottant, { setOptions: jest.fn() });
    expect(conteneur.withHeaderPadding).toBe(false);
    expect(conteneur.style).toEqual([{ paddingTop: 50 }]);
    expect(retraitDuDefilement).toBe(60);
  });

  test('sans en-tête : aucun retrait négatif', () => {
    const { retraitDuDefilement } = lancer(useEnteteFlottant, { setOptions: jest.fn() }, 0);
    expect(retraitDuDefilement).toBe(0);
  });

  test('la flèche porte son propre fond, puisque du texte passe dessous', () => {
    const setOptions = jest.fn();
    lancer(useEnteteFlottant, { setOptions });
    const fleche = setOptions.mock.calls[0][0].headerBackImage();
    expect(fleche.props.decorative).toBe(true);
    expect(fleche.props.style).toEqual({ backgroundColor: 'fond-du-rond' });
  });

  test('le site ne change pas : sa barre fine reste, rien à réserver', () => {
    const setOptions = jest.fn();
    const { conteneur, retraitDuDefilement } = lancer(useEnteteFlottantDuSite, { setOptions });
    expect(conteneur).toEqual({});
    expect(retraitDuDefilement).toBe(0);
    expect(setOptions).not.toHaveBeenCalled();
  });
});

describe('les 3 écrans de l essai', () => {
  test('Mon compte : le titre défile', () => {
    const { avant, liste } = decouper(lire('views/profile/Profile.js'), '<ScreenContainer');
    expect(avant).toContain('{...enTeteFlottant.conteneur}');
    expect(avant).not.toContain("t('profile.titles.profile')");
    expect(liste).toContain("t('profile.titles.profile')");
    expect(liste).toContain('enTeteFlottant.retraitDuDefilement');
  });

  test('Infos profil : le titre, le rôle et le bandeau d aperçu défilent', () => {
    const { avant, liste } = decouper(lire('views/profile/UserDetails.js'), '<ScreenContainer');
    expect(avant).toContain('{...enTeteFlottant.conteneur}');
    expect(avant).not.toContain('titreDeLaFiche.toUpperCase()');
    expect(avant).not.toContain('apercu-bandeau');
    expect(liste).toContain('titreDeLaFiche.toUpperCase()');
    expect(liste).toContain('apercu-bandeau');
    expect(liste).toContain('enTeteFlottant.retraitDuDefilement');
  });

  test('Accueil : au téléphone, le logo défile ; la cloche et le profil restent hors de la liste', () => {
    const { avant, liste, apres } = decouper(lire('views/home/HomeHub.js'), '<ScreenContainerView');
    expect(liste).toContain('<LeagueHeaderSwitch onPress={scrollToTop} />');
    expect(liste).not.toContain('<NotificationBadge');
    expect(liste).not.toContain('<ProfileButton');
    expect(`${avant}${apres}`).toContain('<NotificationBadge');
    expect(`${avant}${apres}`).toContain('<ProfileButton');
  });
});
