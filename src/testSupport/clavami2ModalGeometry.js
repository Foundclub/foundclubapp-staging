/* eslint-env jest */
import {
  DeviceEventEmitter, Platform, ScrollView, StyleSheet,
} from 'react-native';
import { act } from 'react-test-renderer';

// Banc de contraintes, pas un moteur Yoga ni une capture de téléphone. Les hauteurs
// ci-dessous sont des MINIMUMS (une seule ligne de texte). Un retour à la ligne peut
// aggraver le débordement ; il ne peut pas faire disparaître le rouge.
export const IPHONES = [
  {
    barre: 34,
    clavier: 336,
    ecran: 852,
    nom: 'iPhone 15',
  },
  {
    barre: 0,
    clavier: 260,
    ecran: 667,
    nom: 'iPhone SE',
  },
];

const osAvant = Platform.OS;
const versionAvant = /** @type {PropertyDescriptor} */ (
  Object.getOwnPropertyDescriptor(Platform, 'Version')
);

export const telephone = (
  /** @type {'ios' | 'android'} */ systeme,
  /** @type {number | string} */ version,
  /** @type {number} */ barre,
  /** @type {any} */ insets,
) => {
  Platform.OS = systeme;
  Object.defineProperty(Platform, 'Version', { configurable: true, get: () => version });
  Object.assign(insets, { bottom: barre });
};

export const restaurerTelephone = () => {
  Platform.OS = osAvant;
  Object.defineProperty(Platform, 'Version', versionAvant);
};

const chargeIOS = (/** @type {any} */ iphone, /** @type {boolean} */ ouvert) => ({
  duration: 250,
  easing: 'keyboard',
  endCoordinates: {
    height: iphone.clavier,
    screenX: 0,
    screenY: ouvert ? iphone.ecran - iphone.clavier : iphone.ecran,
    width: 393,
  },
});

export const clavierIOS = async (
  /** @type {any} */ iphone,
  /** @type {boolean} */ ouvert,
) => act(async () => {
  const etat = ouvert ? 'Show' : 'Hide';
  DeviceEventEmitter.emit(`keyboardWill${etat}`, chargeIOS(iphone, ouvert));
  DeviceEventEmitter.emit(`keyboardDid${etat}`, chargeIOS(iphone, ouvert));
});

export const clavierAndroid = async () => act(async () => {
  DeviceEventEmitter.emit('keyboardDidShow', {
    endCoordinates: { height: (2424 - 1657) / 2.625 - 48, screenY: 1657 / 2.625 },
  });
});

// Traverse seulement les racines natives : un composant React et sa vue native
// portent souvent le même style, qui ne doit jamais être compté deux fois.
/**
 * Les premiers hôtes, sans compter leur composant React deux fois.
 * @param {any} noeud
 * @returns {any[]}
 */
export const racinesNatives = (noeud) => {
  if (typeof noeud === 'string' || !noeud) return [];
  if (typeof noeud.type === 'string') return [noeud];
  return noeud.children.flatMap(racinesNatives);
};

export const style = (/** @type {any} */ noeud) => StyleSheet.flatten(noeud.props.style) || {};
const valeur = (
  /** @type {any} */ s,
  /** @type {string} */ nom,
  /** @type {string} */ axe,
) => s[nom] ?? s[axe] ?? s[nom.startsWith('padding') ? 'padding' : 'margin'] ?? 0;
const marge = (/** @type {any} */ s) => (
  valeur(s, 'marginTop', 'marginVertical') + valeur(s, 'marginBottom', 'marginVertical')
);

/**
 * Hauteur de contenu minimale, textes sur une ligne ; aucun moteur natif simulé.
 * @param {any} noeud
 * @returns {number}
 */
export const hauteurMinimum = (noeud) => {
  const s = style(noeud);
  if (typeof s.height === 'number') return s.height;
  const bord = s.borderWidth || 0;
  const padding = valeur(s, 'paddingTop', 'paddingVertical')
    + valeur(s, 'paddingBottom', 'paddingVertical')
    + 2 * bord;
  if (/TextInput|Text$/.test(noeud.type)) {
    return Math.max(s.minHeight || 0, (s.lineHeight || s.fontSize || 14) + padding);
  }
  const enfants = /** @type {any[]} */ (noeud.children.flatMap(racinesNatives));
  const tailles = enfants.map((n) => hauteurMinimum(n) + marge(style(n)));
  const hauteur = s.flexDirection === 'row'
    ? Math.max(0, ...tailles)
    : tailles.reduce((somme, n) => somme + n, 0)
        + Math.max(0, enfants.length - 1) * (s.rowGap ?? s.gap ?? 0);
  return Math.max(s.minHeight || 0, hauteur + padding);
};

export const cadre = (/** @type {any} */ fenetre) => {
  // Modal ajoute ses propres vues natives : ne jamais prendre leur style pour
  // celui du voile applicatif. La fenêtre du produit centre sa carte ici.
  const [voile] = fenetre.findAll(
    (/** @type {any} */ n) => typeof n.type === 'string'
      && style(n).flex === 1 && style(n).justifyContent === 'center',
  );
  expect(voile).toBeDefined();
  const [carte] = voile.children.flatMap(racinesNatives);
  return { carte, voile };
};

export const retraitBas = (/** @type {any} */ voile) => (
  valeur(style(voile), 'paddingBottom', 'paddingVertical')
);

export const verifierDefilement = (
  /** @type {any} */ fenetre,
  /** @type {any} */ iphone,
  /** @type {number} */ margeVoile,
) => {
  const [defilement] = fenetre.findAllByType(ScrollView);
  expect(defilement).toBeDefined();
  // Borner la zone visible ET conserver la hauteur naturelle quand le contenu tient.
  expect(style(defilement)).toMatchObject({ flexGrow: 0, flexShrink: 1, maxHeight: '100%' });
  expect(defilement.props.keyboardShouldPersistTaps).toBe('handled');
  const { carte, voile } = cadre(fenetre);
  expect(retraitBas(voile)).toBe(iphone.clavier + margeVoile);
  const zone = iphone.ecran - retraitBas(voile) - margeVoile;
  const contenu = hauteurMinimum(carte);
  const hauteurVisible = Math.min(contenu, zone);
  const hautCarte = margeVoile + (zone - hauteurVisible) / 2;
  // Au bout du défilement, le dernier bouton reste dans le panneau, au-dessus du clavier.
  const finDuContenu = hautCarte + contenu - Math.max(0, contenu - hauteurVisible);
  expect(finDuContenu).toBeLessThanOrEqual(iphone.ecran - iphone.clavier - margeVoile);
};

export const appuyer = async (
  /** @type {any} */ racine,
  /** @type {(noeud: any) => boolean} */ predicat,
) => {
  const [bouton] = racine.findAll(
    (/** @type {any} */ n) => typeof n.props.onPress === 'function' && predicat(n),
  );
  expect(bouton).toBeDefined();
  await act(async () => {
    await bouton.props.onPress();
  });
};
