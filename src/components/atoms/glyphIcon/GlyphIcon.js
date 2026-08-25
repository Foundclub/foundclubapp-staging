import {
  Circle,
  Line,
  Path,
  Polyline,
  Rect,
  Svg,
} from 'react-native-svg';

// AD07 — POURQUOI CES SIX GLYPHES NE SONT PAS DES PNG.
// Les six dessins (menu trois points, cadenas, exporter, avertissement, wifi
// barre, histogramme) n'existaient dans AUCUN dossier d'assets, et personne
// ici ne sait dessiner un PNG : fabriquer un carre gris pour « avoir le
// fichier » aurait rendu une image muette pendant des mois. La route du texte
// marche des deux cotes : `react-native-svg` sur le telephone, et sur le site
// le pont maison `web/src/shims/react-native-svg.tsx:58` rend `Path` en balise
// navigateur. C'est deja le choix de `ChatAttachmentActionIcon.js` (7 glyphes).

/**
 * @typedef {'arrowDownToBracket' | 'chartColumn' | 'dotsVertical' | 'lock'
 *   | 'triangleExclamation' | 'wifiSlash'} GlyphIconName
 */

/**
 * Jeu de glyphes vectoriels reclames par les maquettes et absents des assets.
 * Un nom inconnu rend `null` sans jeter — meme contrat que `SvgIcon.js:26-29`.
 * @param {object} props
 * @param {string} props.color - Couleur du trait. Toujours un jeton `Colors.*`.
 * @param {GlyphIconName | string} props.name
 * @param {number} [props.size]
 * @returns {import('react').ReactElement | null}
 */
function GlyphIcon({
  color,
  name,
  size = 20,
}) {
  const strokeColor = color;
  const strokeWidth = 2;

  switch (name) {
    case 'arrowDownToBracket':
      return (
        <Svg height={size} viewBox="0 0 24 24" width={size}>
          <Line
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
            x1="12"
            x2="12"
            y1="3.2"
            y2="14.4"
          />
          <Polyline
            fill="none"
            points="7.6,10.2 12,14.6 16.4,10.2"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
          <Path
            d="M4.5 16.4v2.1a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2.1"
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
        </Svg>
      );
    case 'chartColumn':
      return (
        <Svg height={size} viewBox="0 0 24 24" width={size}>
          <Path
            d="M4.5 3.5v16h15.5"
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
          <Line
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
            x1="9"
            x2="9"
            y1="18.5"
            y2="12.5"
          />
          <Line
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
            x1="13.5"
            x2="13.5"
            y1="18.5"
            y2="7.5"
          />
          <Line
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
            x1="18"
            x2="18"
            y1="18.5"
            y2="14.5"
          />
        </Svg>
      );
    case 'dotsVertical':
      return (
        <Svg height={size} viewBox="0 0 24 24" width={size}>
          <Circle cx="12" cy="5.2" fill={strokeColor} r="1.7" />
          <Circle cx="12" cy="12" fill={strokeColor} r="1.7" />
          <Circle cx="12" cy="18.8" fill={strokeColor} r="1.7" />
        </Svg>
      );
    case 'lock':
      return (
        <Svg height={size} viewBox="0 0 24 24" width={size}>
          <Rect
            fill="none"
            height="10.5"
            rx="2.4"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
            width="15"
            x="4.5"
            y="10.2"
          />
          <Path
            d="M8 10.2V7.4a4 4 0 0 1 8 0v2.8"
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
          <Line
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
            x1="12"
            x2="12"
            y1="14"
            y2="16.8"
          />
        </Svg>
      );
    case 'triangleExclamation':
      return (
        <Svg height={size} viewBox="0 0 24 24" width={size}>
          <Path
            d="M12 3.4 2.6 20.2h18.8L12 3.4Z"
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
          <Line
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
            x1="12"
            x2="12"
            y1="9.6"
            y2="14.2"
          />
          <Circle cx="12" cy="17.4" fill={strokeColor} r="1.05" />
        </Svg>
      );
    case 'wifiSlash':
      return (
        <Svg height={size} viewBox="0 0 24 24" width={size}>
          <Path
            d="M2.6 9.1a14.6 14.6 0 0 1 18.8 0"
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
          <Path
            d="M6 12.6a9.6 9.6 0 0 1 12 0"
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
          <Path
            d="M9.3 16.1a4.7 4.7 0 0 1 5.4 0"
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
          <Circle cx="12" cy="19.4" fill={strokeColor} r="1.05" />
          <Line
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
            x1="3.4"
            x2="20.6"
            y1="3.4"
            y2="20.6"
          />
        </Svg>
      );
    default:
      return null;
  }
}

export default GlyphIcon;
