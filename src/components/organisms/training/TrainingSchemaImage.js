import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';

/**
 * UN SCHÉMA COTÉ, ET SA HAUTEUR — la brique qui répare 27 dessins invisibles.
 *
 * 🚨 LE DÉFAUT, VU À L'ÉCRAN LE 2026-09-08 ET JAMAIS PAR UNE PORTE. Les 27 schémas du
 * programme déclarent `viewBox="0 0 600 300"` et `width="100%"` — mais AUCUNE hauteur.
 * `react-native-svg` ne la devine pas : il rend une bande de quelques pixels. Les
 * dessins existaient, ils partaient du serveur, ils arrivaient dans l'app… et personne
 * ne les voyait. Aucun témoin ne pouvait le dire : `react-test-renderer` ne calcule
 * aucune mise en page, et un SVG de hauteur nulle est un SVG parfaitement rendu pour lui.
 *
 * ✅ LA RÉPARATION TIENT EN UNE LIGNE DE STYLE : `aspectRatio` sur le conteneur. React
 * Native en déduit la hauteur depuis la largeur, sans mesure ni état — et le dessin
 * garde ses proportions, ce qui est vital sur un plan coté au centimètre.
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
 * Le dessin, à la bonne hauteur.
 * @param {object} props Les propriétés du schéma.
 * @param {number} [props.scale] Un grossissement, pour l'écran en grand.
 * @param {string} [props.rotate] Une rotation, pour lire un plan accroupi.
 * @param {string} props.xml Le dessin, en SVG.
 * @returns {React.ReactElement|null} le dessin cadré, ou rien s'il est illisible
 */
function TrainingSchemaImage({ rotate, scale, xml }) {
  const propre = typeof xml === 'string' && xml.includes('<svg') ? xml : null;
  if (!propre) return null;

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
