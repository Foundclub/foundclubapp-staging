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
 * @typedef {'arrowDownToBracket' | 'ban' | 'calendar' | 'calendarDays'
 *   | 'chartColumn' | 'chevronLeft' | 'chevronRight' | 'circleCheck'
 *   | 'circleInformation' | 'clock' | 'creditCard' | 'dotsVertical'
 *   | 'envelope' | 'euroCircle' | 'fileArrowUp' | 'fileCheck' | 'gift'
 *   | 'hourglass' | 'idCard' | 'landmark' | 'lock' | 'receiptAlt'
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
    // ── S9, vague S — LES GLYPHES DU PACK « MES COTISATIONS » ────────────────
    //
    // 🧭 POURQUOI ICI ET PAS DANS `theme/images.js` : le pack reclame 18 traits
    // de 20 px qui n existent dans AUCUN dossier d assets. Huit ont un cousin
    // PNG (`calendar`, `clock`, `euro-circle`, `envelope`...), mais ce sont des
    // bitmaps teintes : melanger 8 bitmaps et 10 traits vectoriels dans la MEME
    // ligne de 20 px se voit a l oeil. Le pack demande une famille, pas une
    // collection. ⇒ Meme raison qui a cree ce fichier au lot AD07.
    //
    // ⚠️ Le pack cite `assets/icons/icon-data.js` et des cles `AppIcon` : ni
    // l un ni l autre n existe dans ce depot (mesure du 25/08). Seule la
    // convention de la maison compte, et c est celle-ci.
    case 'ban':
      return (
        <Svg height={size} viewBox="0 0 24 24" width={size}>
          <Circle
            cx="12"
            cy="12"
            fill="none"
            r="8.6"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
          <Line
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeWidth={strokeWidth}
            x1="6"
            x2="18"
            y1="18"
            y2="6"
          />
        </Svg>
      );
    case 'calendar':
      return (
        <Svg height={size} viewBox="0 0 24 24" width={size}>
          <Rect
            fill="none"
            height="15"
            rx="2.4"
            stroke={strokeColor}
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
            width="17"
            x="3.5"
            y="5"
          />
          <Line
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeWidth={strokeWidth}
            x1="3.5"
            x2="20.5"
            y1="9.6"
            y2="9.6"
          />
          <Line
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeWidth={strokeWidth}
            x1="8.2"
            x2="8.2"
            y1="2.9"
            y2="6.4"
          />
          <Line
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeWidth={strokeWidth}
            x1="15.8"
            x2="15.8"
            y1="2.9"
            y2="6.4"
          />
        </Svg>
      );
    case 'calendarDays':
      return (
        <Svg height={size} viewBox="0 0 24 24" width={size}>
          <Rect
            fill="none"
            height="15"
            rx="2.4"
            stroke={strokeColor}
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
            width="17"
            x="3.5"
            y="5"
          />
          <Line
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeWidth={strokeWidth}
            x1="3.5"
            x2="20.5"
            y1="9.6"
            y2="9.6"
          />
          <Line
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeWidth={strokeWidth}
            x1="8.2"
            x2="8.2"
            y1="2.9"
            y2="6.4"
          />
          <Line
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeWidth={strokeWidth}
            x1="15.8"
            x2="15.8"
            y1="2.9"
            y2="6.4"
          />
          <Circle cx="8.3" cy="13.4" fill={strokeColor} r="1.05" />
          <Circle cx="12" cy="13.4" fill={strokeColor} r="1.05" />
          <Circle cx="15.7" cy="13.4" fill={strokeColor} r="1.05" />
          <Circle cx="8.3" cy="17" fill={strokeColor} r="1.05" />
          <Circle cx="12" cy="17" fill={strokeColor} r="1.05" />
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
    case 'chevronLeft':
      return (
        <Svg height={size} viewBox="0 0 24 24" width={size}>
          <Polyline
            fill="none"
            points="15,4.5 7.5,12 15,19.5"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
        </Svg>
      );
    case 'chevronRight':
      return (
        <Svg height={size} viewBox="0 0 24 24" width={size}>
          <Polyline
            fill="none"
            points="9,4.5 16.5,12 9,19.5"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
        </Svg>
      );
    case 'circleCheck':
      return (
        <Svg height={size} viewBox="0 0 24 24" width={size}>
          <Circle
            cx="12"
            cy="12"
            fill="none"
            r="8.6"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
          <Polyline
            fill="none"
            points="8,12.2 10.9,15.1 16.2,9.2"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
        </Svg>
      );
    case 'circleInformation':
      return (
        <Svg height={size} viewBox="0 0 24 24" width={size}>
          <Circle
            cx="12"
            cy="12"
            fill="none"
            r="8.6"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
          <Circle cx="12" cy="8.1" fill={strokeColor} r="1.05" />
          <Line
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeWidth={strokeWidth}
            x1="12"
            x2="12"
            y1="11.2"
            y2="16.4"
          />
        </Svg>
      );
    case 'clock':
      return (
        <Svg height={size} viewBox="0 0 24 24" width={size}>
          <Circle
            cx="12"
            cy="12"
            fill="none"
            r="8.6"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
          <Polyline
            fill="none"
            points="12,6.9 12,12 15.8,14.1"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
        </Svg>
      );
    case 'creditCard':
      return (
        <Svg height={size} viewBox="0 0 24 24" width={size}>
          <Rect
            fill="none"
            height="13"
            rx="2.4"
            stroke={strokeColor}
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
            width="18"
            x="3"
            y="5.5"
          />
          <Line
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            x1="3"
            x2="21"
            y1="10"
            y2="10"
          />
          <Line
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeWidth={strokeWidth}
            x1="6.6"
            x2="10.2"
            y1="14.6"
            y2="14.6"
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
    case 'envelope':
      return (
        <Svg height={size} viewBox="0 0 24 24" width={size}>
          <Rect
            fill="none"
            height="14"
            rx="2.4"
            stroke={strokeColor}
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
            width="18"
            x="3"
            y="5"
          />
          <Polyline
            fill="none"
            points="3.6,6.4 12,12.8 20.4,6.4"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
        </Svg>
      );
    case 'euroCircle':
      return (
        <Svg height={size} viewBox="0 0 24 24" width={size}>
          <Circle
            cx="12"
            cy="12"
            fill="none"
            r="8.6"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
          <Path
            d="M15.4 8.6a4.2 4.2 0 0 0-6 1.4 5.6 5.6 0 0 0 0 4 4.2 4.2 0 0 0 6 1.4"
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
            strokeWidth={strokeWidth}
            x1="7.6"
            x2="13"
            y1="10.8"
            y2="10.8"
          />
          <Line
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeWidth={strokeWidth}
            x1="7.6"
            x2="13"
            y1="13.4"
            y2="13.4"
          />
        </Svg>
      );
    case 'fileArrowUp':
      return (
        <Svg height={size} viewBox="0 0 24 24" width={size}>
          <Path
            d="M13.6 3.2H7.4a2 2 0 0 0-2 2v13.6a2 2 0 0 0 2 2h9.2a2 2 0 0 0 2-2V8.2Z"
            fill="none"
            stroke={strokeColor}
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
          <Polyline
            fill="none"
            points="13.4,3.4 13.4,8.4 18.4,8.4"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
          <Line
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeWidth={strokeWidth}
            x1="12"
            x2="12"
            y1="17.6"
            y2="11.6"
          />
          <Polyline
            fill="none"
            points="9.6,14 12,11.6 14.4,14"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
        </Svg>
      );
    case 'fileCheck':
      return (
        <Svg height={size} viewBox="0 0 24 24" width={size}>
          <Path
            d="M13.6 3.2H7.4a2 2 0 0 0-2 2v13.6a2 2 0 0 0 2 2h9.2a2 2 0 0 0 2-2V8.2Z"
            fill="none"
            stroke={strokeColor}
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
          <Polyline
            fill="none"
            points="13.4,3.4 13.4,8.4 18.4,8.4"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
          <Polyline
            fill="none"
            points="8.8,14.6 11,16.8 15.2,12.6"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
        </Svg>
      );
    case 'gift':
      return (
        <Svg height={size} viewBox="0 0 24 24" width={size}>
          <Rect
            fill="none"
            height="10.4"
            rx="1.6"
            stroke={strokeColor}
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
            width="16"
            x="4"
            y="10.2"
          />
          <Rect
            fill="none"
            height="3.4"
            rx="1"
            stroke={strokeColor}
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
            width="18"
            x="3"
            y="6.8"
          />
          <Line
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            x1="12"
            x2="12"
            y1="6.8"
            y2="20.6"
          />
          <Path
            d="M12 6.8C11.4 4.6 10.3 3.4 9 3.4a1.7 1.7 0 0 0 0 3.4Z"
            fill="none"
            stroke={strokeColor}
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
          <Path
            d="M12 6.8c0.6-2.2 1.7-3.4 3-3.4a1.7 1.7 0 0 1 0 3.4Z"
            fill="none"
            stroke={strokeColor}
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
        </Svg>
      );
    case 'hourglass':
      return (
        <Svg height={size} viewBox="0 0 24 24" width={size}>
          <Line
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeWidth={strokeWidth}
            x1="6.4"
            x2="17.6"
            y1="3.4"
            y2="3.4"
          />
          <Line
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeWidth={strokeWidth}
            x1="6.4"
            x2="17.6"
            y1="20.6"
            y2="20.6"
          />
          <Path
            d="M7.6 3.4v3a4.4 4.4 0 0 0 4.4 4.4 4.4 4.4 0 0 0 4.4-4.4v-3"
            fill="none"
            stroke={strokeColor}
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
          <Path
            d="M7.6 20.6v-3a4.4 4.4 0 0 1 4.4-4.4 4.4 4.4 0 0 1 4.4 4.4v3"
            fill="none"
            stroke={strokeColor}
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
        </Svg>
      );
    case 'idCard':
      return (
        <Svg height={size} viewBox="0 0 24 24" width={size}>
          <Rect
            fill="none"
            height="14"
            rx="2.4"
            stroke={strokeColor}
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
            width="18"
            x="3"
            y="5"
          />
          <Circle
            cx="8.6"
            cy="11"
            fill="none"
            r="2.1"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
          <Path
            d="M5.4 16.6a3.4 3.4 0 0 1 6.4 0"
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeWidth={strokeWidth}
          />
          <Line
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeWidth={strokeWidth}
            x1="14.6"
            x2="18.4"
            y1="10.4"
            y2="10.4"
          />
          <Line
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeWidth={strokeWidth}
            x1="14.6"
            x2="18.4"
            y1="14"
            y2="14"
          />
        </Svg>
      );
    case 'landmark':
      return (
        <Svg height={size} viewBox="0 0 24 24" width={size}>
          <Polyline
            fill="none"
            points="2.8,9 12,3.6 21.2,9"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
          <Line
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeWidth={strokeWidth}
            x1="6"
            x2="6"
            y1="11.4"
            y2="17"
          />
          <Line
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeWidth={strokeWidth}
            x1="12"
            x2="12"
            y1="11.4"
            y2="17"
          />
          <Line
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeWidth={strokeWidth}
            x1="18"
            x2="18"
            y1="11.4"
            y2="17"
          />
          <Line
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeWidth={strokeWidth}
            x1="3.4"
            x2="20.6"
            y1="20.2"
            y2="20.2"
          />
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
    case 'receiptAlt':
      return (
        <Svg height={size} viewBox="0 0 24 24" width={size}>
          <Path
            d="M5.4 3.4h13.2v17.2l-2.2-1.6-2.2 1.6-2.2-1.6-2.2 1.6-2.2-1.6-2.2 1.6Z"
            fill="none"
            stroke={strokeColor}
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
          <Line
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeWidth={strokeWidth}
            x1="8.6"
            x2="15.4"
            y1="8.4"
            y2="8.4"
          />
          <Line
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeWidth={strokeWidth}
            x1="8.6"
            x2="15.4"
            y1="12.4"
            y2="12.4"
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
