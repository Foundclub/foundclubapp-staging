import { Image, StyleSheet, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { colors as COULEURS } from '@/theme/colors';

import ClubLogoMark from '../ClubLogoMark';

// LOT LOGO-CADRE (15/09, capture d'Adel) — onglet Équipes, carte « Ta demande
// pour rejoindre ce club » : le logo carré foncé de Test Fc est entouré d'un
// CADRE BLANC. Ce n'est pas le fichier, c'est l'app.
//
// LA CAUSE, mesurée : `ClubLogoMark` peint un cadre BLANC (voulu : un écusson
// transparent disparaîtrait sur le fond sombre) et le confie à `ProfileAvatar`
// en mode logo, qui (1) retire 4 % de chaque côté (marge intérieure) et (2)
// range l'image en « contain » dans un carré : un logo non carré laisse deux
// bandes blanches. Test Fc (JPEG 134 × 141) dans 50 dp : 2 dp de marge + 1,2 dp
// de bande à gauche et à droite.
//
// Le lot AFFICHAGE a corrigé la fiche d'équipe seule (cadre à la forme du logo).
// Ici on corrige le composant PARTAGÉ, une fois, pour les 33 fichiers appelants.
//
// On monte le VRAI `ClubLogoMark` et le VRAI `ProfileAvatar` : c'est leur
// géométrie réunie qui dessine le blanc visible.

jest.mock('@/utils/imageUrl', () => ({
  getImageUrl: (/** @type {string} */ url) => url || undefined,
}));

jest.mock(
  '@/components/molecules/profilePicturePreviewOverlay/ProfilePicturePreviewOverlay',
  () => () => null,
);

jest.mock('@/theme/themeContext', () => {
  const feuille = {};
  const rampe = () => new Proxy({}, { get: () => feuille });
  return {
    __esModule: true,
    default: () => ({
      Alignments: rampe(),
      ApplicationStyle: new Proxy({}, { get: () => rampe() }),
      Colors: new Proxy({}, { get: (_cible, cle) => `couleur-${String(cle)}` }),
      Fonts: rampe(),
      Images: { roundAvatar: 'repli-avatar' },
      Spaces: new Proxy({}, { get: () => rampe() }),
    }),
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => repli || cle,
  }),
}));

/** @type {any} */
let arbre;

/**
 * Monte le logo avec une image aux dimensions données et mesure le blanc visible.
 * @param {object} params
 * @param {{ largeur: number, hauteur: number } | null} params.image Dimensions du fichier
 *   (null = mesure en échec).
 * @param {object} [params.props] Props passées à ClubLogoMark.
 * @returns {{
 *   cadre: any, emprise: any, image: any, blancGaucheDroite: number, blancHautBas: number
 * }} Cadre, emprise, image et blanc visible de chaque côté.
 */
const mesurer = ({ image, props = {} }) => {
  jest.spyOn(Image, 'getSize').mockImplementation((_uri, succes, echec) => {
    if (image) succes(image.largeur, image.hauteur);
    else if (echec) echec(new Error('mesure impossible'));
  });

  act(() => {
    arbre = renderer.create(
      // eslint-disable-next-line react/jsx-props-no-spreading -- fabrique de test
      <ClubLogoMark logoUrl={`/uploads/logo-${Math.random()}.jpg`} size={50} {...props} />,
    );
  });

  const cadre = StyleSheet.flatten(arbre.root.findByType(TouchableOpacity).props.style);
  const imageRendue = StyleSheet.flatten(arbre.root.findByType(Image).props.style);
  const json = arbre.toJSON();
  const emprise = StyleSheet.flatten((Array.isArray(json) ? json[0] : json).props.style);

  // Rectangle réellement dessiné par « contain » dans la boîte de l'image.
  const ratio = image ? image.largeur / image.hauteur : 1;
  const dessineLargeur = Math.min(imageRendue.width, imageRendue.height * ratio);
  const dessineHauteur = Math.min(imageRendue.height, imageRendue.width / ratio);

  return {
    blancGaucheDroite: (cadre.width - dessineLargeur) / 2,
    blancHautBas: (cadre.height - dessineHauteur) / 2,
    cadre,
    emprise,
    image: imageRendue,
  };
};

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
  jest.restoreAllMocks();
});

describe('LOGO-CADRE — un logo de club opaque n\'a plus de cadre blanc', () => {
  test('sans consigne de l\'écran : aucune marge intérieure, l\'image touche son cadre', () => {
    const { cadre, image } = mesurer({ image: { hauteur: 512, largeur: 512 } });

    expect(image.width).toBeCloseTo(cadre.width, 5);
    expect(image.height).toBeCloseTo(cadre.height, 5);
  });

  test.each([
    ['Test Fc (134 × 141) — la capture d\'Adel', 134, 141, 50],
    ['Aix-Perd (894 × 1000)', 894, 1000, 50],
    ['Aix-Perd (894 × 1000) en grand, page club', 894, 1000, 80],
    ['logo large 3:1', 300, 100, 50],
  ])('%s : aucune bande blanche de plus de 1 dp', (_nom, largeur, hauteur, taille) => {
    const { blancGaucheDroite, blancHautBas } = mesurer({
      image: { hauteur, largeur },
      props: { size: taille },
    });

    expect(blancGaucheDroite).toBeLessThanOrEqual(1);
    expect(blancHautBas).toBeLessThanOrEqual(1);
  });

  test('un trait de la couleur du fond (blanc sur blanc) est retiré', () => {
    // Motif de la page club, de l'en-tête d'événement et du profil.
    const { cadre } = mesurer({
      image: { hauteur: 141, largeur: 134 },
      props: {
        logoStyle: [{ borderColor: COULEURS.neutral00, borderWidth: 1 }, { borderRadius: 20 }],
      },
    });

    expect(cadre.borderWidth || 0).toBe(0);
  });

  test('un style qui répète size × size (annonce de recrutement) suit la forme du logo', () => {
    const { blancGaucheDroite, cadre } = mesurer({
      image: { hauteur: 1000, largeur: 894 },
      props: {
        logoStyle: {
          borderColor: COULEURS.neutral00,
          borderRadius: 50,
          borderWidth: 2,
          height: 100,
          width: 100,
        },
        size: 100,
      },
    });

    expect(blancGaucheDroite).toBeLessThanOrEqual(1);
    expect(cadre.borderWidth || 0).toBe(0);
  });
});

describe('LOGO-CADRE — ce qui NE doit PAS bouger', () => {
  test('la place prise dans la mise en page reste exactement size × size', () => {
    const { emprise } = mesurer({ image: { hauteur: 1000, largeur: 894 }, props: { size: 50 } });

    expect(emprise).toMatchObject({ height: 50, width: 50 });
  });

  test('un logo TRANSPARENT reste lisible : le cadre garde un fond opaque', () => {
    const { cadre } = mesurer({ image: { hauteur: 512, largeur: 512 } });

    expect(cadre.backgroundColor).toBeTruthy();
    expect(cadre.backgroundColor).not.toBe('transparent');
  });

  test('un trait de COULEUR (sélection de la recherche) est gardé', () => {
    const { cadre } = mesurer({
      image: { hauteur: 141, largeur: 134 },
      props: { logoStyle: { borderColor: 'couleur-primary500', borderRadius: 14, borderWidth: 1 } },
    });

    expect(cadre).toMatchObject({ borderColor: 'couleur-primary500', borderWidth: 1 });
  });

  test('une marge demandée par l\'écran (pastille des assistants, 10 %) est respectée', () => {
    const { cadre, image } = mesurer({
      image: { hauteur: 141, largeur: 134 },
      props: { logoStyle: { borderRadius: 28 }, safeInsetRatio: 0.1, size: 56 },
    });

    expect(cadre).toMatchObject({ height: 56, width: 56 });
    expect(image.width).toBeCloseTo(56 * 0.8, 5);
  });

  test('un cadre dont l\'écran fixe la taille (fiche d\'équipe) garde cette taille', () => {
    const { cadre } = mesurer({
      image: { hauteur: 100, largeur: 300 },
      props: { logoStyle: { height: 78, width: 122 }, safeInsetRatio: 0, size: 90 },
    });

    expect(cadre).toMatchObject({ height: 78, width: 122 });
  });

  test('mesure du fichier en échec : cadre carré size × size, sans marge', () => {
    const { cadre, image } = mesurer({ image: null });

    expect(cadre).toMatchObject({ height: 50, width: 50 });
    expect(image.width).toBeCloseTo(50, 5);
  });
});
