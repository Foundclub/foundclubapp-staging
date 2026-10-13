import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ChildIdentityCard, { ligneDIdentite } from '../ChildIdentityCard';

/**
 * PAR-L5L6 (13/10) — TÉMOIN CARACTÉRISANT, écrit AVANT toute modification (E6).
 *
 * `ChildIdentityCard.js` n'avait aucun test à lui. Il sert TROIS écrans : « Mes enfants »,
 * la fiche d'un enfant déclaré (`DeclaredChildPage`) et le profil d'un compte relié
 * (`UserDetails`). Ce témoin fige ce qu'il fait AUJOURD'HUI, pour que le lot qui le touche
 * sache s'il change le comportement des deux autres.
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
  const alignements = jest.requireActual('@/theme/alignements').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({ Alignments: alignements, Colors: couleurs, Fonts: genererPolices(couleurs) }),
  };
});

jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { name }) => <TexteRN>{`AVATAR:${name}`}</TexteRN>,
  };
});

/** La traduction du témoin : la même que l'écran, lue dans fr.js. */
const { t } = jest.requireMock('react-i18next').useTranslation();

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

describe('ligneDIdentite — la ligne sous le nom d un enfant (comportement au 13/10)', () => {
  test('l age, l equipe, le club, dans cet ordre, separes par « · »', () => {
    expect(ligneDIdentite(t, { age: 9, clubName: 'FoundClub', teamName: 'Senior' }))
      .toBe('9 ans · Senior · FoundClub');
  });

  test('ce qui manque est saute, sans trou', () => {
    expect(ligneDIdentite(t, { age: 9 })).toBe('9 ans');
    expect(ligneDIdentite(t, { clubName: 'FoundClub' })).toBe('FoundClub');
    expect(ligneDIdentite(t, {})).toBe('');
  });

  test('un an : le singulier', () => {
    expect(ligneDIdentite(t, { age: 1 })).toBe('1 an');
  });

  test('plusieurs equipes nommees : toutes, une fois chacune', () => {
    expect(ligneDIdentite(t, {
      age: 14, clubName: 'AS Montrivage', teamNames: ['U13', 'U15', 'U13', ' '],
    })).toBe('14 ans · U13 · U15 · AS Montrivage');
  });

  test('des equipes avec leur club : chacune sous SON club, le club de l enfant d abord', () => {
    expect(ligneDIdentite(t, {
      age: 14,
      clubName: 'AS Montrivage',
      teams: [
        { club: { name: 'AS Montrivage' }, name: 'U13' },
        { club: { name: 'Recette Stripe FC' }, name: 'Seniors A' },
        { name: 'U15' },
      ],
    })).toBe('14 ans · U13 · U15 · AS Montrivage · Seniors A · Recette Stripe FC');
  });

  test('des equipes vides : on retombe sur la regle simple', () => {
    expect(ligneDIdentite(t, {
      age: 9, clubName: 'FoundClub', teamName: 'Senior', teams: [{ name: '' }],
    })).toBe('9 ans · Senior · FoundClub');
  });
});

describe('ChildIdentityCard — la carte (comportement au 13/10)', () => {
  /**
   * Monte la carte et rend son texte, nœud par nœud.
   * @param {any} props - Les propriétés.
   * @returns {Promise<string>} Le texte, « | » entre deux nœuds.
   */
  const texteDe = async (props) => {
    /** @type {any} */
    let arbre;
    await act(async () => {
      // eslint-disable-next-line react/jsx-props-no-spreading
      arbre = renderer.create(<ChildIdentityCard {...props} />);
    });
    return arbre.root.findAllByType(Text)
      .map((/** @type {any} */ n) => aplatir(n.props.children)).join(' | ');
  };

  test('l avatar, le nom, la ligne, puis « Mon enfant »', async () => {
    expect(await texteDe({ line: '9 ans · Senior · FoundClub', name: 'Anissa Test' }))
      .toBe('AVATAR:Anissa Test | Anissa Test | 9 ans · Senior · FoundClub | Mon enfant');
  });

  test('sans ligne : pas de texte vide', async () => {
    expect(await texteDe({ name: 'Anissa Test' }))
      .toBe('AVATAR:Anissa Test | Anissa Test | Mon enfant');
  });

  test('un badge de plus se pose sous « Mon enfant »', async () => {
    expect(await texteDe({ children: <Text>BADGE</Text>, name: 'Anissa Test' }))
      .toBe('AVATAR:Anissa Test | Anissa Test | Mon enfant | BADGE');
  });
});
