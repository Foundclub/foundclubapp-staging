import renderer, { act } from 'react-test-renderer';

import {
  chercherUnSport,
  choisirLeSport,
  lignesDeSport,
  POPULAIRES_EN_TETE,
  SPORTS_A09,
} from '../../../../testSupport/temoinChoixDuSport';
import ChoixDuSport, { basculerSport, compacterNomDeSport } from '../ChoixDuSport';

// A09 (audit V1, décision d'Adel du 30/09) — LE choix du sport de toute la recherche. Chaque
// filtre de sport a son propre témoin A09 (clubs, événements, annonces, profils, réservations,
// pastille de l'annuaire) ; celui-ci garde ce que le composant fait seul.

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
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({ Colors: couleurs, Fonts: genererPolices(couleurs), Spaces: espaces }),
  };
});

/** @type {any} */
let arbre = null;

/**
 * Rend le choix du sport.
 * @param {{ cle?: 'documentId' | 'name', multiple?: boolean, onChoisir: any, valeurs?: string[] }}
 *   props Les props.
 * @returns {Promise<any>} L'arbre.
 */
const rendre = async ({
  cle = 'documentId', multiple = false, onChoisir, valeurs = [],
}) => {
  await act(async () => {
    arbre = renderer.create(
      <ChoixDuSport
        cle={cle}
        multiple={multiple}
        onChoisir={onChoisir}
        sports={SPORTS_A09}
        valeurs={valeurs}
      />,
    );
  });
  return arbre;
};

/**
 * La ligne d'un sport (le nœud qui porte `onPress`, `aria-checked` et le rôle).
 * @param {any} tree L'arbre.
 * @param {string} nom Le sport.
 * @returns {any} Le nœud.
 */
const ligneHote = (tree, nom) => tree.root.findAll(
  (/** @type {any} */ n) => typeof n.props?.onPress === 'function'
    && n.props?.accessibilityLabel === nom,
)[0];

afterEach(() => {
  if (arbre) act(() => { arbre.unmount(); });
  arbre = null;
});

/**
 * Ce que dit l'intertitre et les lignes, dans l'ordre (texte des nœuds hôtes).
 * @param {any} tree L'arbre.
 * @returns {string} Le texte.
 */
const texte = (tree) => JSON.stringify(tree.toJSON());

describe('ChoixDuSport — le composant seul', () => {
  it('sans choix : « Tous les sports » coché, puis les populaires d Adel, rien d autre', async () => {
    const tree = await rendre({ onChoisir: jest.fn() });
    expect(lignesDeSport(tree)).toEqual(POPULAIRES_EN_TETE);
    expect(texte(tree)).toContain('Sports populaires');
  });

  it('le sport actuel passe en tête, coché, et sort des populaires', async () => {
    const tree = await rendre({ onChoisir: jest.fn(), valeurs: ['a-rugby'] });
    expect(lignesDeSport(tree)).toEqual([
      'Rugby', 'Football', 'Basketball', 'Handball', 'Volleyball',
    ]);
    expect(ligneHote(tree, 'Rugby').props['aria-checked']).toBe(true);
  });

  it('plusieurs sports : cases à cocher, « Sports choisis »', async () => {
    const tree = await rendre({
      multiple: true, onChoisir: jest.fn(), valeurs: ['a-1', 'a-tennis'],
    });
    expect(texte(tree)).toContain('Sports choisis');
    expect(lignesDeSport(tree).slice(0, 2)).toEqual(['Football', 'Tennis']);
    expect(ligneHote(tree, 'Tennis').props.accessibilityRole).toBe('checkbox');
  });

  it('« Tous les sports, de A à Z » déplie la liste entière, avec « Tous les sports »', async () => {
    const onChoisir = jest.fn();
    const tree = await rendre({ onChoisir, valeurs: ['a-1'] });
    const deplier = tree.root.findAll(
      (/** @type {any} */ n) => n.props?.accessibilityRole === 'button'
        && typeof n.props?.onPress === 'function',
    )[0];
    await act(async () => { deplier.props.onPress(); });

    expect(lignesDeSport(tree)).toContain('Tennis');
    expect(lignesDeSport(tree)).toContain('Athlétisme');
    await choisirLeSport(tree, 'Tous les sports');
    expect(onChoisir).toHaveBeenCalledWith('');
  });

  it('la recherche ignore accents, casse et tirets ; « Aucun sport » sinon', async () => {
    const tree = await rendre({ onChoisir: jest.fn() });
    await chercherUnSport(tree, 'RUGBY');
    expect(lignesDeSport(tree)).toEqual(['Rugby', 'Rugby à XIII']);
    await chercherUnSport(tree, 'echec');
    expect(lignesDeSport(tree)).toEqual(['Échecs']);
    await chercherUnSport(tree, 'curling');
    expect(lignesDeSport(tree)).toEqual([]);
    expect(texte(tree)).toContain('Aucun sport ne correspond.');
  });

  it('les annonces filtrent par NOM : la ligne rend le nom', async () => {
    const onChoisir = jest.fn();
    const tree = await rendre({ cle: 'name', onChoisir });
    await choisirLeSport(tree, 'Handball');
    expect(onChoisir).toHaveBeenCalledWith('Handball');
  });
});

describe('basculerSport / compacterNomDeSport', () => {
  it('coche, décoche, et la clef vide vide tout', () => {
    expect(basculerSport([], 'a-1')).toEqual(['a-1']);
    expect(basculerSport(['a-1', 'a-2'], 'a-1')).toEqual(['a-2']);
    expect(basculerSport(['a-1', 'a-2'], '')).toEqual([]);
  });

  it('« Volley-ball », « volleyball » et « VOLLEYBALL » se valent', () => {
    expect(compacterNomDeSport('Volley-ball')).toBe('volleyball');
    expect(compacterNomDeSport('VOLLEYBALL')).toBe('volleyball');
    expect(compacterNomDeSport('Équitation')).toBe('equitation');
  });
});
