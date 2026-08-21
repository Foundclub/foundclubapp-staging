/**
 * Filet AD05 (E6) — LA FEUILLE QUI DIT CE QUI SORT.
 *
 * Ce que ce fichier remplace, mesure le 2026-08-20 : « Exporter la liste
 * (Excel/CSV) » etait un texte souligne de 21 px de haut, sans zone de clic,
 * juste sous une icone de partage de 48 x 48. Un doigt le ratait. Et quand il
 * ne le ratait pas, un fichier partait avec les e-mails et les telephones de
 * tout le monde — y compris ceux qui n'ont jamais repondu, et ceux dont la
 * demande a ete refusee. Aucun avertissement, aucune option, aucune
 * confirmation.
 *
 * Les quatre choses que ces temoins verrouillent, et pourquoi :
 *
 *  1. LA FEUILLE NOMME LES 8 COLONNES. Un avertissement vague (« ce fichier
 *     contient des donnees ») ne permet a personne de decider. La liste nommee,
 *     si.
 *  2. LA CIBLE FAIT AU MOINS 44 px. C'est le defaut d'origine ; un bouton de 21
 *     px le reproduirait sous un autre nom.
 *  3. LA BASCULE VOYAGE. `onConfirm` recoit `{ withoutContacts }`, et c'est
 *     exactement ce que le tuyau (`exportEventParticipants`, temoin T6) sait
 *     transformer en `?withoutContacts=1`.
 *  4. LA FEUILLE N'APPELLE AUCUN SERVICE. Elle est pilotee de l'exterieur —
 *     c'est ce qui permet a AD01 ou AD06 de la brancher en trois lignes.
 */

// ⚠️ Ce dictionnaire reproduit MOT POUR MOT le bloc `eventDetails.export.*`
// livre en diff dans le compte rendu AD05. Le fichier `fr.js` est tenu par le
// lot AD06 : tant qu'il n'y a pas insere ce bloc, l'ecran affichera les CLEFS
// en clair. C'est nomme dans « CE QU'IL RESTE A BRANCHER ».
const mockLibelles = {
  'eventDetails.export.cancel': 'Annuler',
  'eventDetails.export.columns.email': 'E-mail',
  'eventDetails.export.columns.firstname': 'Prénom',
  'eventDetails.export.columns.lastname': 'Nom',
  'eventDetails.export.columns.phone': 'Téléphone',
  'eventDetails.export.columns.position': 'Poste',
  'eventDetails.export.columns.scope': 'Portée',
  'eventDetails.export.columns.status': 'Statut',
  'eventDetails.export.columns.team': 'Équipe',
  'eventDetails.export.columnsTitle': 'Ce que le fichier contient',
  'eventDetails.export.confirm': 'Télécharger le fichier',
  'eventDetails.export.count': 'Le fichier contiendra {{count}} personnes.',
  'eventDetails.export.personalDataWarning': 'Ce fichier contient des données personnelles',
  'eventDetails.export.removeContacts': 'Retirer e-mails et téléphones',
  'eventDetails.export.title': 'Exporter la liste',
};

jest.mock('react-i18next', () => ({
  initReactI18next: { init: jest.fn(), type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {string} */ key, /** @type {any} */ options) => {
      const libelle = mockLibelles[key];
      if (!libelle) return key;
      return options && typeof options.count === 'number'
        ? libelle.replace('{{count}}', String(options.count))
        : libelle;
    },
  }),
}));

// La feuille du projet monte @gorhom/bottom-sheet, un flou natif et le contexte
// de demarrage. Rien de tout cela n'est le sujet ici : on la remplace par une
// vue qui rend ses enfants (motif maison, cf. SelectAvatar.camera.test.js).
jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => reactActuel.createElement(
      VueRN,
      { testID: 'feuille-export' },
      props.children,
    ),
  };
});

// Le theme est monte avec les VRAIS modules : un Proxy rend les echecs Jest
// illisibles (piege paye au lot paywall). Seul Images est stube.
jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const generateApplicationStyle = jest.requireActual('@/theme/applicationStyle').default;
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments,
      ApplicationStyle: generateApplicationStyle(Colors),
      Colors,
      Fonts: generateFonts(Colors),
      Images: new Proxy({}, { get: () => 1 }),
      scheme: 'dark',
      Spaces,
    }),
  };
});

// `require` et non `import` : les `import` sont hisses AU-DESSUS de
// `mockLibelles`, et la fabrique du mock i18n le lirait alors avant sa
// declaration.
const { createElement } = require('react');
const renderer = require('react-test-renderer');
const { act } = require('react-test-renderer');

const EventExportSheet = require('../EventExportSheet').default;

/**
 * Monte la feuille et rend de quoi l'interroger.
 * @param {object} [surcharges] - Les proprietes a remplacer.
 * @returns {{ arbre: any, onClose: any, onConfirm: any }} - Le banc.
 */
const monterLaFeuille = (surcharges = {}) => {
  const onClose = jest.fn();
  const onConfirm = jest.fn();
  let arbre;

  act(() => {
    arbre = renderer.create(createElement(EventExportSheet, {
      isVisible: true,
      onClose,
      onConfirm,
      participantCount: 12,
      ...surcharges,
    }));
  });

  return { arbre, onClose, onConfirm };
};

/**
 * Tous les textes rendus par la feuille, a plat.
 * @param {any} arbre - L'arbre monte.
 * @returns {string[]} - Les chaines affichees.
 */
const textesAffiches = (arbre) => arbre.root
  .findAll((noeud) => typeof noeud.type === 'string' && noeud.type === 'Text')
  .flatMap((noeud) => (Array.isArray(noeud.props.children)
    ? noeud.props.children
    : [noeud.props.children]))
  .filter((enfant) => typeof enfant === 'string');

/**
 * Aplatit un style React Native, tableau ou non.
 * @param {any} style - Le style a aplatir.
 * @returns {object} - Le style resultant.
 */
const aplatirStyle = (style) => (Array.isArray(style)
  ? style.filter(Boolean).reduce((acc, part) => ({ ...acc, ...aplatirStyle(part) }), {})
  : (style || {}));

/**
 * Le bouton qui lance vraiment le telechargement.
 * @param {any} arbre - L'arbre monte.
 * @returns {any} - Le bouton de sortie.
 */
const boutonDeSortie = (arbre) => arbre.root.findAll(
  (noeud) => noeud.props?.accessibilityRole === 'button'
    && noeud.props?.accessibilityLabel === mockLibelles['eventDetails.export.confirm'],
)[0];

/**
 * La case a cocher qui retire les coordonnees du fichier.
 * @param {any} arbre - L'arbre monte.
 * @returns {any} - La bascule.
 */
const bascule = (arbre) => arbre.root.findAll(
  (noeud) => noeud.props?.accessibilityRole === 'checkbox',
)[0];

describe('AD05/T7 — la feuille qui dit ce qui sort', () => {
  // -------------------------------------------------------------------------
  // 1. ELLE NOMME CE QUI PART
  // -------------------------------------------------------------------------

  it('affiche les 8 noms de colonnes du classeur, dans l ordre du serveur', () => {
    const { arbre } = monterLaFeuille();

    const textes = textesAffiches(arbre);
    const colonnes = [
      'Nom', 'Prénom', 'E-mail', 'Téléphone', 'Équipe', 'Statut', 'Portée', 'Poste',
    ];

    colonnes.forEach((colonne) => {
      expect(textes).toContain(colonne);
    });

    const positions = colonnes.map((colonne) => textes.indexOf(colonne));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('affiche l avertissement sur les donnees personnelles', () => {
    const { arbre } = monterLaFeuille();

    expect(textesAffiches(arbre)).toContain('Ce fichier contient des données personnelles');
  });

  it('dit combien de personnes partiront dans le fichier', () => {
    const { arbre } = monterLaFeuille();

    expect(textesAffiches(arbre)).toContain('Le fichier contiendra 12 personnes.');
  });

  // -------------------------------------------------------------------------
  // 2. LA CIBLE FAIT AU MOINS 44 px — c est le defaut d origine
  // -------------------------------------------------------------------------

  it('le bouton de sortie fait au moins 44 px de haut', () => {
    const { arbre } = monterLaFeuille();

    const style = aplatirStyle(boutonDeSortie(arbre).props.style);

    expect(style.minHeight).toBeGreaterThanOrEqual(44);
  });

  // -------------------------------------------------------------------------
  // 3. LA BASCULE VOYAGE JUSQU AU TUYAU
  // -------------------------------------------------------------------------

  it('sans cocher, onConfirm recoit { withoutContacts: false }', () => {
    const { arbre, onConfirm } = monterLaFeuille();

    act(() => {
      boutonDeSortie(arbre).props.onPress();
    });

    expect(onConfirm).toHaveBeenCalledWith({ withoutContacts: false });
  });

  it('en cochant la bascule, onConfirm recoit { withoutContacts: true }', () => {
    const { arbre, onConfirm } = monterLaFeuille();

    act(() => {
      bascule(arbre).props.onPress();
    });
    act(() => {
      boutonDeSortie(arbre).props.onPress();
    });

    expect(onConfirm).toHaveBeenCalledWith({ withoutContacts: true });
  });

  it('cochee, les deux lignes de coordonnees sont barrees a l ecran', () => {
    const { arbre } = monterLaFeuille();

    act(() => {
      bascule(arbre).props.onPress();
    });

    const lignesBarrees = arbre.root
      .findAll((noeud) => typeof noeud.type === 'string' && noeud.type === 'Text')
      .filter((noeud) => aplatirStyle(noeud.props.style).textDecorationLine === 'line-through')
      .map((noeud) => noeud.props.children);

    expect(lignesBarrees).toEqual(['E-mail', 'Téléphone']);
  });

  // -------------------------------------------------------------------------
  // 4. ELLE N APPELLE AUCUN SERVICE, ET ELLE SE FERME
  // -------------------------------------------------------------------------

  it('le bouton Annuler appelle onClose et n exporte rien', () => {
    const { arbre, onClose, onConfirm } = monterLaFeuille();

    const annuler = arbre.root.findAll(
      (noeud) => noeud.props?.accessibilityRole === 'button'
        && noeud.props?.accessibilityLabel === mockLibelles['eventDetails.export.cancel'],
    )[0];

    act(() => {
      annuler.props.onPress();
    });

    expect(onClose).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('fermee, la feuille ne rend rien', () => {
    const { arbre } = monterLaFeuille({ isVisible: false });

    expect(arbre.toJSON()).toBeNull();
  });
});
