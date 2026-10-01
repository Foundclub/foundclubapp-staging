import renderer, { act } from 'react-test-renderer';

import RecruitmentFiltersSheet from '../RecruitmentFiltersSheet';

// ALERTES-ANNONCES (30/09) — L'ÉTOILE ★ DANS LA FEUILLE DE FILTRES DU RECRUTEMENT.
//
// Décision d'Adel : « je veux que les joueurs soient prévenus [des annonces], même
// les entraîneurs ». La feuille « Filtrer » de Rechercher › Recrutement porte
// désormais la même étoile que celle des événements (A20.4) : elle confie le
// BROUILLON (ce qui est réglé, même non appliqué) ET le profil choisi à
// `onCreateAlert`, et dit ce qu'on lui répond. L'appel réel (`POST
// /search-alerts`, type `recruitment`) est prouvé par
// `RecrutementListContent.ALERTES-ANNONCES.test.js`.
//
// Harnais repris de `RecruitmentFiltersSheet.test.js` (D57), plus les images du
// thème : la confirmation « Alerte créée » porte une coche.

jest.setTimeout(30000);

jest.mock('react-native-linear-gradient', () => 'LinearGradient');

jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({
      children, footerComponent, headerComponent, isVisible,
    }) => (isVisible ? (
      <View>
        {headerComponent}
        {children}
        {footerComponent}
      </View>
    ) : null),
  };
});

jest.mock('@/components/molecules/input/Input', () => {
  // eslint-disable-next-line global-require
  const { TextInput } = require('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { onChangeText, placeholder, value }) => (
      <TextInput onChangeText={onChangeText} placeholder={placeholder} value={value} />
    ),
  };
});

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();

  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements,
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: espaces,
    }),
  };
});

jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => ({ data: [{ documentId: 'a-1', name: 'Football' }] }),
}));
jest.mock('@/services/category/categoryQueries', () => ({
  useGetCategories: () => ({ data: [{ documentId: 'c-1', name: 'U17' }] }),
}));
jest.mock('@/services/level/levelQueries', () => ({
  useGetLevels: () => ({ data: [{ documentId: 'n-1', name: 'Régional' }] }),
}));

const ETOILE = 'Créer une alerte avec ces filtres';
const NOTE_VILLE = "Choisis une ville, puis touche « Créer l'alerte ».";
const CORPS_ANNONCES = 'Tu seras prévenu·e dès qu\'une nouvelle annonce '
  + 'comme celles-ci est publiée.';

/**
 * Les chaînes d'un arbre rendu.
 * @param {any} node Le noeud.
 * @returns {string[]} Ses chaînes.
 */
const collectText = (node) => {
  if (node === null || node === undefined) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(collectText);
  return collectText(node.children);
};
const texteVisible = (/** @type {any} */ tree) => collectText(tree.toJSON()).join(' | ');

/**
 * Le texte recollé d'un noeud et de ses descendants.
 * @param {any} node Le noeud.
 * @returns {string} Son texte recollé.
 */
const texteDuNoeud = (node) => {
  if (typeof node === 'string') return node;
  if (!node || !Array.isArray(node.children)) return '';
  return node.children.map(texteDuNoeud).join('');
};

/**
 * Les éléments pressables qui répondent à un critère.
 * @param {any} tree L'arbre.
 * @param {(n: any) => boolean} critere Le critère.
 * @returns {any[]} Les éléments.
 */
const pressables = (tree, critere) => tree.root.findAll(
  (/** @type {any} */ n) => typeof n.props?.onPress === 'function' && critere(n),
  { deep: true },
);

/**
 * L'étoile de l'entête, lue sur son étiquette d'accessibilité.
 * @param {any} tree L'arbre.
 * @returns {any} L'étoile, ou undefined.
 */
const etoile = (tree) => pressables(tree, (n) => n.props?.accessibilityLabel === ETOILE)[0];

const toucherLEtoile = async (/** @type {any} */ tree) => {
  await act(async () => { await etoile(tree).props.onPress(); });
};

/**
 * Appuie sur le premier élément pressable qui porte exactement ce libellé.
 * @param {any} tree L'arbre.
 * @param {string} libelle Le texte.
 */
const appuyerSur = async (tree, libelle) => {
  const cible = pressables(tree, (n) => texteDuNoeud(n).trim() === libelle)[0];
  if (!cible) throw new Error(`Aucun bouton « ${libelle} »`);
  await act(async () => { cible.props.onPress(); });
};

/**
 * Déplie une rangée, visée par le début de son étiquette (« Sport : … »).
 * @param {any} tree L'arbre.
 * @param {string} intitule L'intitulé de la rangée.
 */
const ouvrirRangee = async (tree, intitule) => {
  const rangee = pressables(
    tree,
    (n) => String(n.props?.accessibilityLabel || '').startsWith(`${intitule} : `),
  )[0];
  await act(async () => { rangee.props.onPress(); });
};

/**
 * Monte la feuille, visible, avec ce décor.
 * @param {{
 *   filters?: any, onCreateAlert?: any, pourUneAlerte?: boolean,
 * }} [options] Le décor.
 * @returns {Promise<{ tree: any, onApply: jest.Mock, onClose: jest.Mock }>} Le rendu.
 */
const rendre = async ({
  filters = {}, onCreateAlert = undefined, pourUneAlerte = false,
} = {}) => {
  const onApply = jest.fn();
  const onClose = jest.fn();
  /** @type {any} */
  let tree;
  await act(async () => {
    tree = renderer.create(
      <RecruitmentFiltersSheet
        audienceFilter="all"
        filters={filters}
        isVisible
        onApply={onApply}
        onClose={onClose}
        onCreateAlert={onCreateAlert}
        pourUneAlerte={pourUneAlerte}
      />,
    );
  });
  return { onApply, onClose, tree };
};

const repondre = (/** @type {string} */ statut) => jest.fn(() => Promise.resolve(statut));

describe('ALERTES-ANNONCES — l étoile de la feuille de filtres du recrutement', () => {
  it('LE TEMOIN : sans `onCreateAlert`, pas d étoile — la feuille est celle d avant', async () => {
    const { tree } = await rendre();
    expect(etoile(tree)).toBeUndefined();
    expect(texteVisible(tree)).toContain('Filtrer');
  });

  it('avec `onCreateAlert`, la cloche d alerte est sur la ligne du titre, après lui', async () => {
    const { tree } = await rendre({ onCreateAlert: repondre('creee') });
    const bouton = etoile(tree);
    expect(bouton).toBeDefined();
    expect(bouton.findAll((n) => n.props && n.props.name === 'bell').length).toBeGreaterThan(0);
    let rangee = bouton.parent;
    while (rangee && !texteDuNoeud(rangee).includes('Filtrer')) rangee = rangee.parent;
    expect(texteDuNoeud(rangee).indexOf('Filtrer')).toBe(0);
    expect(texteDuNoeud(rangee).replace(/\s/g, ' ').indexOf('Créer alerte')).toBeGreaterThan(0);
  });

  it('l étoile confie le BROUILLON et le PROFIL choisis, sans appliquer ni fermer', async () => {
    const onCreateAlert = repondre('creee');
    const { onApply, onClose, tree } = await rendre({
      filters: { city: 'Lyon', section: 's-1' },
      onCreateAlert,
    });

    // Réglé DANS la feuille, sans « Voir les résultats » : sport et profil.
    await ouvrirRangee(tree, 'Sport');
    await appuyerSur(tree, 'Football');
    await ouvrirRangee(tree, 'Profil');
    await appuyerSur(tree, 'Coachs');

    await toucherLEtoile(tree);

    expect(onCreateAlert).toHaveBeenCalledTimes(1);
    expect(onCreateAlert.mock.calls[0]).toEqual([
      expect.objectContaining({ city: 'Lyon', section: 's-1', sport: 'Football' }),
      'coach',
    ]);
    expect(onApply).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('créée : la feuille le dit, avec les mots des ANNONCES', async () => {
    const { tree } = await rendre({ filters: { city: 'Lyon' }, onCreateAlert: repondre('creee') });
    await toucherLEtoile(tree);
    expect(texteVisible(tree)).toContain('Alerte créée');
    expect(texteVisible(tree)).toContain(CORPS_ANNONCES);
  });

  it('ville manquante, ou échec : la feuille dit quoi faire, sans se fermer', async () => {
    const sansVille = await rendre({ onCreateAlert: repondre('ville-manquante') });
    await toucherLEtoile(sansVille.tree);
    expect(texteVisible(sansVille.tree)).toContain(NOTE_VILLE);

    const echec = await rendre({ filters: { city: 'Lyon' }, onCreateAlert: repondre('erreur') });
    await toucherLEtoile(echec.tree);
    expect(texteVisible(echec.tree)).toContain('L\'alerte n\'a pas pu être créée');
    expect(echec.onClose).not.toHaveBeenCalled();
  });

  it('ouverte POUR une alerte : la rangée Ville est dépliée et la note est là', async () => {
    const { tree } = await rendre({ onCreateAlert: repondre('creee'), pourUneAlerte: true });
    const champVille = tree.root.findAll(
      (/** @type {any} */ n) => n.props?.placeholder === 'Ville'
        && typeof n.props?.onChangeText === 'function',
    );
    expect(champVille.length).toBeGreaterThan(0);
    expect(texteVisible(tree)).toContain(NOTE_VILLE);
  });
});
