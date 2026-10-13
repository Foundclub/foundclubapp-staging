import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import DeclaredChildPage from '../DeclaredChildPage';

/**
 * PAR-L5L6 (13/10) — TÉMOIN CARACTÉRISANT, écrit AVANT toute modification (E6, commit
 * `2d7e2e60`), puis mis à jour par E07 (la fiche de l'enfant, design parent planche 3).
 *
 * `DeclaredChildPage.js` (la page d'un enfant déclaré, ST-RETOURS2, planche 22 état 6) n'avait
 * aucun test à lui : seuls deux témoins de `MyChildren.test.js` la montaient au passage.
 * Chaque attente qui a changé avec E07 le dit en commentaire (« E07 : … ») ; les autres sont
 * restées telles quelles.
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
  .map((/** @type {any} */ n) => aplatir(n.props.children)).join(' | ')
  // Les pastilles portent des espaces insécables (Android 16) : à l oeil, un espace.
  .replace(/\u00a0/g, ' ');

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

// E07 : la ligne sous le nom dit l'âge seul ; l'équipe a SON bloc (« Son équipe »), les infos
// sportives le leur, et « Chercher un club » vit dans « Son équipe ».
test('moins de 13 ans, sans equipe : titre, carte, ce qui viendra a 13 ans, le club', async () => {
  expect(texteVisible(await rendre(LEA))).toBe([
    'LEA',
    'AVATAR:Lea Test',
    'Lea Test',
    '7 ans',
    'Mon enfant',
    'Son équipe',
    'Pas encore d’équipe',
    'Chercher un club pour Lea',
    'Infos sportives',
    'Numéro de maillot',
    'Non renseigné',
    'Poste',
    'Non renseigné',
    'Stats et retours de match',
    'Ils arrivent quand Lea a 13 ans et son propre compte, relié au tien.',
  ].join(' | '));
});

// E07 + remarque d'Adel (13/10) : « 7 ans · Senior · FoundClub » ne laissait pas voir le club.
// Le club a SA ligne (« Club » / « FoundClub »), l'équipe la sienne — et un enfant QUI A une
// équipe ne voit plus « Chercher un club pour Lea ».
test('🔴 avec une equipe : « Club FoundClub », « Équipe Senior », sans « Chercher »', async () => {
  const texte = texteVisible(await rendre({
    ...LEA,
    club: { documentId: 'club-1', name: 'FoundClub' },
    team: { documentId: 'eq-1', name: 'Senior' },
  }));

  expect(texte).toContain('Son équipe | Club | FoundClub | Équipe | Senior');
  expect(texte).not.toContain('7 ans · Senior · FoundClub');
  expect(texte).not.toContain('Chercher un club pour Lea');
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

// E07 : la fiche d'un 13 ans et plus dit pourquoi le parent n'y cherche plus de club (E17).
test('13 ans et plus : ni la carte des stats, ni le bouton', async () => {
  const texte = texteVisible(await rendre({ ...LEA, age: 15 }));

  expect(texte).toBe([
    'LEA',
    'AVATAR:Lea Test',
    'Lea Test',
    '15 ans',
    'Mon enfant',
    'Son équipe',
    'Pas encore d’équipe',
    'À partir de 13 ans, Lea fait ses demandes lui-même depuis son propre compte.',
    'Infos sportives',
    'Numéro de maillot',
    'Non renseigné',
    'Poste',
    'Non renseigné',
  ].join(' | '));
  expect(texte).not.toContain('Stats et retours de match');
  expect(texte).not.toContain('Chercher un club');
});

// ===========================================================================
// PAR-L5L6 (13/10) — E07 : LA FICHE DE L'ENFANT (design parent, planche 3).
// Blocs dans l'ordre : identité, Son équipe, Ses demandes, Infos sportives, Stats et retours,
// puis Modifier / Supprimer. « Annuler la demande » est ABSENT : la route serveur n'existe pas
// encore (lot L8).
// ===========================================================================

describe('PAR-L5L6 E07 — la fiche de l enfant', () => {
  const FOUNDCLUB = { documentId: 'club-fc', name: 'FoundClub' };
  const ANISSA = {
    ...LEA,
    age: 11,
    club: FOUNDCLUB,
    documentId: 'anissa',
    firstname: 'Anissa',
    number: 7,
    position: 'Meneuse',
    team: { documentId: 'senior', name: 'Senior' },
  };
  const demande = (extra = {}) => ({
    club: FOUNDCLUB,
    createdAt: '2026-10-11T09:00:00.000Z',
    declaredChild: { documentId: 'lea', firstname: 'Lea' },
    documentId: 'dem-1',
    status: 'pending',
    team: { club: FOUNDCLUB, documentId: 'u11', name: 'U11 Garçons' },
    ...extra,
  });

  /**
   * Monte la fiche avec toutes ses propriétés.
   * @param {any} props - Les propriétés (\`enfant\` compris).
   * @returns {Promise<any>} L arbre rendu.
   */
  const rendreLaFiche = async (props) => {
    /** @type {any} */
    let arbre;
    await act(async () => {
      // eslint-disable-next-line react/jsx-props-no-spreading
      arbre = renderer.create(<DeclaredChildPage onSearchClub={jest.fn()} {...props} />);
    });
    return arbre;
  };

  /**
   * L élément appuyable qui porte ce \`testID\`.
   * @param {any} arbre - L arbre rendu.
   * @param {string} testID - L étiquette.
   * @returns {any} L élément, ou undefined.
   */
  const porte = (arbre, testID) => arbre.root.findAll((/** @type {any} */ n) => (
    typeof n.props?.onPress === 'function' && n.props.testID === testID
  ))[0];

  test('🔴 « Acceptée le 11/10 » : la demande acceptée pour SON équipe', async () => {
    const acceptee = demande({
      declaredChild: { documentId: 'anissa' },
      presetKey: 'child_accepted',
      respondedAt: '2026-10-11T16:00:00.000Z',
      status: 'responded',
      team: { club: FOUNDCLUB, documentId: 'senior', name: 'Senior' },
    });
    const texte = texteVisible(await rendreLaFiche({ demandes: [acceptee], enfant: ANISSA }));

    expect(texte).toContain('Club | FoundClub | Équipe | Senior | Acceptée le 11/10');
  });

  test('équipe sans demande acceptée lue : ni date inventée, ni erreur', async () => {
    const texte = texteVisible(await rendreLaFiche({ demandes: [], enfant: ANISSA }));

    expect(texte).toContain('Club | FoundClub | Équipe | Senior');
    expect(texte).not.toContain('Acceptée le');
  });

  test('🔴 « Ses demandes » : une ligne par demande EN ATTENTE, club et équipe', async () => {
    const texte = texteVisible(await rendreLaFiche({
      demandes: [demande(), demande({ documentId: 'vieille', status: 'responded' })],
      enfant: LEA,
    }));

    expect(texte).toContain('Ses demandes | En attente | Club  FoundClub');
    expect(texte).toContain('Équipe demandée  U11 Garçons');
    expect(texte).toContain('Envoyée le 11/10');
    expect(texte.split('En attente').length - 1).toBe(1);
    // Lot L8 pas encore fait : aucun « Annuler la demande » inerte.
    expect(texte).not.toContain('Annuler la demande');
  });

  test('aucune demande en attente : le bloc « Ses demandes » n existe pas', async () => {
    const arbre = await rendreLaFiche({ demandes: [], enfant: LEA });

    expect(texteVisible(arbre)).not.toContain('Ses demandes');
  });

  test('🔴 demandes en échec : le bloc le DIT, « Réessayer » relit, le reste reste', async () => {
    const onRetryDemandes = jest.fn();
    const arbre = await rendreLaFiche({ demandesEnErreur: true, enfant: LEA, onRetryDemandes });
    const texte = texteVisible(arbre);

    expect(texte).toContain('Ses demandes | Impossible de charger ses demandes. | Réessayer');
    expect(texte).toContain('Son équipe');
    expect(texte).toContain('Infos sportives');
    await act(async () => { porte(arbre, 'declared-child-requests-retry').props.onPress(); });
    expect(onRetryDemandes).toHaveBeenCalledTimes(1);
  });

  test('🔴 « Infos sportives » : les valeurs, « Modifier » ouvre le formulaire', async () => {
    const onEdit = jest.fn();
    const arbre = await rendreLaFiche({ enfant: ANISSA, onEdit });

    expect(texteVisible(arbre))
      .toContain('Infos sportives | Modifier | Numéro de maillot | 7 | Poste | Meneuse');
    await act(async () => { porte(arbre, 'declared-child-sport-edit').props.onPress(); });
    expect(onEdit).toHaveBeenCalledWith(ANISSA);
  });

  test('« Infos sportives » vides : « Non renseigné » et « Compléter »', async () => {
    const texte = texteVisible(await rendreLaFiche({ enfant: LEA, onEdit: jest.fn() }));

    expect(texte).toContain(
      'Infos sportives | Compléter | Numéro de maillot | Non renseigné | Poste | Non renseigné',
    );
  });

  test('un maillot n° 0 est un maillot (pas « Non renseigné »)', async () => {
    const texte = texteVisible(await rendreLaFiche({ enfant: { ...LEA, number: 0 } }));

    expect(texte).toContain('Numéro de maillot | 0');
  });

  test('🔴 le pied : « Modifier sa fiche », « Supprimer la fiche »', async () => {
    const onEdit = jest.fn();
    const onDelete = jest.fn();
    const arbre = await rendreLaFiche({ enfant: LEA, onDelete, onEdit });

    const modifier = arbre.root.findAll((/** @type {any} */ n) => (
      typeof n.props?.onPress === 'function'
      && aplatir(n.props?.children).includes('Modifier sa fiche')
    ))[0];
    await act(async () => { modifier.props.onPress(); });
    expect(onEdit).toHaveBeenCalledWith(LEA);
    await act(async () => { porte(arbre, 'declared-child-delete').props.onPress(); });
    expect(onDelete).toHaveBeenCalledWith(LEA);
  });

  test('🔴 l ordre du design : équipe, demandes, infos sportives, stats, puis le pied', async () => {
    const texte = texteVisible(await rendreLaFiche({
      demandes: [demande()], enfant: LEA, onDelete: jest.fn(), onEdit: jest.fn(),
    }));
    const ordre = ['Son équipe', 'Ses demandes', 'Infos sportives', 'Stats et retours de match',
      'Modifier sa fiche', 'Supprimer la fiche'].map((bloc) => texte.indexOf(bloc));

    expect(ordre.every((place) => place > -1)).toBe(true);
    expect([...ordre].sort((a, b) => a - b)).toEqual(ordre);
  });

  test('13 ans et plus, sans compte : « Donner un compte à Lina »', async () => {
    const onGiveAccount = jest.fn();
    const lina = { ...LEA, age: 13, firstname: 'Lina' };
    const arbre = await rendreLaFiche({ enfant: lina, onGiveAccount });

    await act(async () => { porte(arbre, 'declared-child-give-account').props.onPress(); });
    expect(onGiveAccount).toHaveBeenCalledWith(lina);
  });
});
