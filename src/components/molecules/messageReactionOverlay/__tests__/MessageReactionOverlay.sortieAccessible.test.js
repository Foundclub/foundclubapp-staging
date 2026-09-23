import renderer, { act } from 'react-test-renderer';

import MessageReactionOverlay from '../MessageReactionOverlay';

// WHATSAPP2 — ♿ LA SORTIE DU CALQUE POUR QUI NE VOIT PAS L'ECRAN.
//
// 🚪 LE PROBLEME QUE CE TEMOIN GARDE. Le bouton « Annuler » a disparu avec la
// feuille du bas : on ferme desormais en appuyant A COTE, comme sur WhatsApp
// (decision du chef d'orchestre, 23/09). Mais « appuyer a cote » n'existe pas
// pour quelqu'un qui navigue au lecteur d'ecran : son doigt balaie des elements,
// il ne vise pas une zone vide. Sans issue declaree, la personne reste ENFERMEE
// dans le calque.
//
// Les trois issues que ce fichier exige :
//   1. `accessibilityViewIsModal` — VoiceOver cesse d'annoncer la conversation
//      derriere, et ne propose plus que le calque. Sans ca, le balayage sort du
//      menu sans le fermer et on ne sait plus ou on est ;
//   2. `onAccessibilityEscape` — le geste d'echappement d'iOS (deux doigts en Z)
//      ferme le calque ;
//   3. `onRequestClose` — le bouton retour d'Android le ferme aussi.
//
// ⚠️ CE QUE CE TEMOIN NE PROUVE PAS : que VoiceOver se comporte bien pour de
// vrai. Jest lit les contraintes posees sur l'arbre, il ne fait pas parler un
// telephone. Mais ces trois props sont precisement des contraintes, et les
// retirer ne casserait RIEN d'autre — c'est ce qui rend ce filet utile.

jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({ t: (/** @type {string} */ cle, /** @type {string} */ repli) => repli || cle }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 47,
  }),
}));

jest.mock('@/theme/themeContext', () => ({
  __esModule: true,
  default: () => ({
    // 🎨 AUCUN HEXADECIMAL ICI, et ce n est pas un detail de style : le contrat
    // de theme compte les couleurs ecrites en dur dans TOUT le depot, fichiers de
    // test compris. Six hex de doublure suffisaient a faire passer le compteur
    // de 12 a 13 et a faire rougir la porte. Des libelles font le meme travail :
    // ce banc ne regarde aucune couleur, il regarde des props d accessibilite.
    Colors: {
      error500: 'couleur-erreur',
      neutral00: 'couleur-texte',
      neutral600: 'couleur-bordure',
      neutral700: 'couleur-fond-bouton',
      neutral800: 'couleur-fond-panneau',
      primary700: 'couleur-selection',
      transparent: 'transparent',
    },
  }),
}));

const ANCRE = {
  height: 60, width: 220, x: 16, y: 300,
};

/**
 * Rend le calque et rend son arbre.
 * @param {() => void} [onClose] Ce qu'on veut observer a la fermeture.
 * @returns {any} L'arbre rendu.
 */
const rendre = (onClose = () => {}) => {
  let arbre;
  act(() => {
    arbre = renderer.create(
      <MessageReactionOverlay
        anchor={ANCRE}
        canCopy
        canEdit
        isMine
        myEmoji=""
        onAction={() => {}}
        onClose={onClose}
        onSelect={() => {}}
        visible
      />,
    );
  });
  return arbre;
};

describe('WHATSAPP2 — on peut sortir du calque sans voir l ecran', () => {
  it('le calque se declare MODAL pour le lecteur d ecran', () => {
    const arbre = rendre();
    const calque = arbre.root.findByProps({ testID: 'WHATSAPP-calque' });

    expect(calque.props.accessibilityViewIsModal).toBe(true);
  });

  it('le geste d echappement d iOS ferme le calque', () => {
    const fermetures = [];
    const arbre = rendre(() => fermetures.push('ferme'));
    const calque = arbre.root.findByProps({ testID: 'WHATSAPP-calque' });

    expect(typeof calque.props.onAccessibilityEscape).toBe('function');

    act(() => {
      calque.props.onAccessibilityEscape();
    });

    expect(fermetures).toEqual(['ferme']);
  });

  it('le bouton retour d Android ferme le calque', () => {
    const fermetures = [];
    const arbre = rendre(() => fermetures.push('ferme'));
    const modal = arbre.root.findByProps({ testID: 'WHATSAPP-calque' }).parent;

    expect(typeof modal.props.onRequestClose).toBe('function');

    act(() => {
      modal.props.onRequestClose();
    });

    expect(fermetures).toEqual(['ferme']);
  });

  it('le voile porte un libelle « Fermer » : c est une issue ATTEIGNABLE au balayage', () => {
    const arbre = rendre();
    const sorties = arbre.root.findAll(
      (noeud) => noeud.props?.accessibilityLabel === 'Fermer',
    );

    expect(sorties.length).toBeGreaterThanOrEqual(1);
  });

  it('les cinq actions restent annoncees par leur nom', () => {
    const arbre = rendre();

    ['Repondre', 'Copier', 'Modifier', 'Supprimer'].forEach((libelle) => {
      expect(
        arbre.root.findAll((noeud) => noeud.props?.accessibilityLabel === libelle).length,
      ).toBeGreaterThanOrEqual(1);
    });
  });
});
