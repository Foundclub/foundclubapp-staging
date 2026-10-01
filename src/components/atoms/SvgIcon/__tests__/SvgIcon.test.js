import { Image } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { colors as COULEURS } from '@/theme/colors';

import { SvgIcon } from '../SvgIcon';

// SANS-EMOJI — témoin caractérisant posé AVANT d'élargir la table des icônes.
// `SvgIcon` affiche un PNG de `src/assets/icons` choisi par son nom, teinté par
// `tintColor` : c'est ce composant qui remplace les coches, croix, cloches et
// loupes jusqu'ici écrites en emoji dans les textes.

const rendre = ({
  color, height, name, style, width,
}) => {
  let arbre;
  act(() => {
    arbre = renderer.create(
      <SvgIcon color={color} height={height} name={name} style={style} width={width} />,
    );
  });
  return arbre;
};

const styleAplati = (image) => Object.assign({}, ...[image.props.style].flat(2).filter(Boolean));

describe('SvgIcon — une icône PNG choisie par son nom', () => {
  it('rend une image teintée, 18 points par défaut', () => {
    const image = rendre({ name: 'users' }).root.findByType(Image);
    expect(styleAplati(image)).toEqual(expect.objectContaining({ height: 18, width: 18 }));
    expect(styleAplati(image).tintColor).toEqual(expect.any(String));
    expect(image.props.resizeMode).toBe('contain');
  });

  it('applique la couleur et la taille demandées, et le style en plus', () => {
    const image = rendre({
      color: COULEURS.primary500,
      height: 10,
      name: 'calendar-days',
      style: { marginRight: 4 },
      width: 12,
    }).root.findByType(Image);
    expect(styleAplati(image)).toEqual(expect.objectContaining({
      height: 10, marginRight: 4, tintColor: COULEURS.primary500, width: 12,
    }));
  });

  it('ne rend rien pour un nom inconnu, sans jeter', () => {
    const avertir = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(rendre({ name: 'inconnue' }).toJSON()).toBeNull();
    expect(avertir).toHaveBeenCalled();
    avertir.mockRestore();
  });

  it.each([
    'arrow-left', 'bell', 'calendar', 'check', 'chevron-down', 'close', 'edit',
    'envelope', 'euro-circle', 'search', 'shield', 'stadium', 'trash',
  ])('connaît l icône « %s » qui remplace un emoji', (nom) => {
    const image = rendre({ name: nom }).root.findByType(Image);
    expect(image.props.source).toBeTruthy();
  });

  // ICÔNES (01/10/2026, « icône go » d'Adel) — les icônes dessinées pour remplacer
  // les provisoires de SANS-EMOJI : cinq reprises de l'ancien système d'Adel
  // (même bibliothèque que la loupe, la cloche et les silhouettes), trois dessins.
  it.each([
    'delete-left', 'message-circle', 'radar', 'reply', 'shield-question', 'soccer-ball',
    'swords', 'trophy',
  ])('connaît l icône neuve « %s »', (nom) => {
    const image = rendre({ name: nom }).root.findByType(Image);
    expect(image.props.source).toBeTruthy();
  });
});
