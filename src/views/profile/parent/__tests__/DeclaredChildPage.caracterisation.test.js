import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import DeclaredChildPage from '../DeclaredChildPage';

/**
 * PAR-L5L6 (13/10) — TÉMOIN CARACTÉRISANT, écrit AVANT toute modification (E6).
 *
 * `DeclaredChildPage.js` (la page d'un enfant déclaré, ST-RETOURS2, planche 22 état 6) n'avait
 * aucun test à lui : seuls deux témoins de `MyChildren.test.js` la montaient au passage. Ce
 * témoin fige ce qu'elle fait AUJOURD'HUI, avant le lot qui la réécrit (E07 du design parent).
 */

jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  const lire = (/** @type {string} */ chemin) => chemin.split('.').reduce(
    (/** @type {any} */ noeud, /** @type {string} */ segment) => (
      noeud && typeof noeud === 'object' ? noeud[segment] : undefined
    ),
    traductions,
  );
  const t = (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ options) => {
    const source = (repli && typeof repli === 'object' ? repli : options) || {};
    const compte = source.count;
    const pluriel = typeof compte === 'number' ? `${cle}_${compte === 1 ? 'one' : 'other'}` : cle;
    const valeur = lire(pluriel) ?? lire(cle);
    if (typeof valeur !== 'string') return typeof repli === 'string' ? repli : cle;
    return valeur.replace(
      /\{\{(\w+)\}\}/g,
      (/** @type {string} */ _tout, /** @type {string} */ clef) => String(source[clef] ?? ''),
    );
  };
  return { useTranslation: () => ({ t }) };
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
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: espaces,
    }),
  };
});

jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { name }) => <TexteRN>{`AVATAR:${name}`}</TexteRN>,
  };
});

/**
 * Aplati les enfants React en une chaîne.
 * @param {any} enfants - Les enfants React.
 * @returns {string} Le texte.
 */
const aplatir = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};

/**
 * Monte la page.
 * @param {any} enfant - La fiche.
 * @param {(enfant: any) => void} [onSearchClub] - « Chercher un club ».
 * @returns {Promise<any>} L arbre rendu.
 */
const rendre = async (enfant, onSearchClub = jest.fn()) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<DeclaredChildPage enfant={enfant} onSearchClub={onSearchClub} />);
  });
  return arbre;
};

/**
 * Le texte visible, nœud par nœud.
 * @param {any} arbre - L arbre rendu.
 * @returns {string} Le texte, « | » entre deux nœuds.
 */
const texteVisible = (arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ n) => aplatir(n.props.children)).join(' | ');

const LEA = {
  age: 7,
  club: null,
  documentId: 'lea',
  firstname: 'Lea',
  lastname: 'Test',
  number: null,
  photo: null,
  position: null,
  team: null,
};

test('moins de 13 ans, sans equipe : titre, carte, ce qui viendra a 13 ans, le club', async () => {
  expect(texteVisible(await rendre(LEA))).toBe([
    'LEA',
    'AVATAR:Lea Test',
    'Lea Test',
    '7 ans · Pas encore d’équipe',
    'Mon enfant',
    'Stats et retours de match',
    'Ils arrivent quand Lea a 13 ans et son propre compte, relié au tien.',
    'Chercher un club pour Lea',
  ].join(' | '));
});

test('moins de 13 ans, AVEC une equipe : la ligne dit « 7 ans · Senior · FoundClub »', async () => {
  const texte = texteVisible(await rendre({
    ...LEA,
    club: { documentId: 'club-1', name: 'FoundClub' },
    team: { documentId: 'eq-1', name: 'Senior' },
  }));

  expect(texte).toContain('7 ans · Senior · FoundClub');
  // Aujourd hui, le bouton reste le meme avec une equipe.
  expect(texte).toContain('Chercher un club pour Lea');
});

test('« Chercher un club pour Lea » rend la fiche a l ecran qui la monte', async () => {
  const onSearchClub = jest.fn();
  const arbre = await rendre(LEA, onSearchClub);
  const bouton = arbre.root.findAll((/** @type {any} */ n) => (
    typeof n.props?.onPress === 'function'
    && aplatir(n.props?.children).includes('Chercher un club pour Lea')
  ))[0];

  await act(async () => { bouton.props.onPress(); });
  expect(onSearchClub).toHaveBeenCalledWith(LEA);
});

test('13 ans et plus : ni la carte des stats, ni le bouton', async () => {
  const texte = texteVisible(await rendre({ ...LEA, age: 15 }));

  expect(texte)
    .toBe('LEA | AVATAR:Lea Test | Lea Test | 15 ans · Pas encore d’équipe | Mon enfant');
});
