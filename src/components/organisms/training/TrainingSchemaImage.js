import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';

/**
 * UN SCHÉMA COTÉ, SA HAUTEUR, ET SON GARDE-FOU — la brique qui rend 27 dessins
 * lisibles sans jamais laisser l'un d'eux tuer l'application.
 *
 * 🚨 DÉFAUT 1, VU À L'ÉCRAN LE 2026-09-08 ET JAMAIS PAR UNE PORTE. Les 27 schémas du
 * programme déclarent `viewBox="0 0 600 300"` et `width="100%"` — mais AUCUNE hauteur.
 * `react-native-svg` ne la devine pas : il rend une bande de quelques pixels. Les
 * dessins existaient, ils partaient du serveur, ils arrivaient dans l'app… et personne
 * ne les voyait. Aucun témoin ne pouvait le dire : `react-test-renderer` ne calcule
 * aucune mise en page, et un SVG de hauteur nulle est un SVG parfaitement rendu pour lui.
 * ✅ La réparation tient en une ligne de style : `aspectRatio` sur le conteneur.
 *
 * 🔴 DÉFAUT 2, ET IL FERMAIT L'APPLICATION. Mesuré le 2026-09-08 en ouvrant le parcours
 * guidé de T0 : l'app disparaissait, écran d'accueil Android. Le journal disait
 * `java.lang.NumberFormatException: For input string: "auto-start-reverse"` dans
 * `com.horcrux.svg.MarkerView.renderMarker`. La bibliothèque lit `orient` ainsi :
 *
 *     double markerAngle = "auto".equals(mOrient) ? -1 : Double.parseDouble(mOrient);
 *
 * Elle ne connaît QUE le mot `auto` et les nombres. `auto-start-reverse` — pourtant
 * du SVG parfaitement valide — la fait lever une exception NATIVE, pendant le dessin,
 * sur le fil principal. ⛔ Aucune barrière React ne rattrape ça : ce n'est pas une
 * erreur JavaScript, c'est le processus qui meurt. 10 des 27 dessins la portaient,
 * dont le tout premier du programme.
 *
 * ✅ CE FICHIER EST LA FRONTIÈRE DE CONFIANCE. Les dessins viennent du serveur ; un
 * programme publié demain peut porter n'importe quoi. On neutralise donc ici toute
 * valeur d'`orient` que la bibliothèque ne sait pas lire, AVANT de la lui donner. La
 * donnée est corrigée séparément côté `admin` (marqueur retourné à 180°, pour que la
 * flèche de départ garde son sens) — mais ce garde-fou vaut pour tous les autres.
 */

/** Sans `viewBox` lisible, on suppose un dessin deux fois plus large que haut. */
const RATIO_PAR_DEFAUT = 2;

/**
 * Le rapport largeur / hauteur d'un dessin, lu dans son `viewBox`.
 * @param {string} xml le dessin
 * @returns {number} le rapport, toujours strictement positif
 */
export const ratioDuSchema = (xml) => {
  const boite = /viewBox=["']([^"']+)["']/.exec(String(xml || ''));
  if (!boite) return RATIO_PAR_DEFAUT;
  const [, , largeur, hauteur] = boite[1].trim().split(/[\s,]+/).map(Number);
  if (!Number.isFinite(largeur) || !Number.isFinite(hauteur) || !hauteur || !largeur) {
    return RATIO_PAR_DEFAUT;
  }
  return largeur / hauteur;
};

/**
 * Rend un dessin inoffensif pour `react-native-svg`.
 *
 * 🎯 Une seule chose aujourd'hui, et elle est vitale : `orient`. La bibliothèque
 * n'accepte que le mot `auto` ou un nombre ; tout le reste la fait planter au dessin.
 * On rabat donc sur `auto`, qui est le comportement le plus proche et qui ne coûte
 * qu'une flèche de départ orientée dans l'autre sens.
 * @param {string} xml le dessin tel qu'il arrive du serveur
 * @returns {string} le même dessin, sans valeur que la bibliothèque ne sait pas lire
 */
export const desamorcerLeSchema = (xml) => String(xml).replace(
  /orient\s*=\s*(["'])([^"']*)\1/g,
  (entier, guillemet, valeur) => {
    const propre = valeur.trim();
    // 🪤 `Number('')` vaut 0, et `Number.isFinite(0)` vaut vrai : sans le test de
    // longueur, un `orient=""` traversait le garde-fou intact — et la bibliotheque
    // plante AUSSI sur la chaine vide. C'est le temoin qui l'a attrape.
    if (propre === 'auto' || (propre !== '' && Number.isFinite(Number(propre)))) return entier;
    return `orient=${guillemet}auto${guillemet}`;
  },
);

/**
 * Le dessin, à la bonne hauteur et sans piège.
 * @param {object} props Les propriétés du schéma.
 * @param {number} [props.scale] Un grossissement, pour l'écran en grand.
 * @param {string} [props.rotate] Une rotation, pour lire un plan accroupi.
 * @param {string} props.xml Le dessin, en SVG.
 * @returns {React.ReactElement|null} le dessin cadré, ou rien s'il est illisible
 */
function TrainingSchemaImage({ rotate, scale, xml }) {
  const brut = typeof xml === 'string' && xml.includes('<svg') ? xml : null;
  if (!brut) return null;
  const propre = desamorcerLeSchema(brut);

  return (
    <View
      style={{
        // 🎯 C'EST CETTE LIGNE QUI REND LES 27 DESSINS VISIBLES.
        aspectRatio: ratioDuSchema(propre),
        transform: [
          { rotate: rotate || '0deg' },
          { scale: Number.isFinite(scale) ? scale : 1 },
        ],
        width: '100%',
      }}
    >
      <SvgXml height="100%" width="100%" xml={propre} />
    </View>
  );
}

export default TrainingSchemaImage;
