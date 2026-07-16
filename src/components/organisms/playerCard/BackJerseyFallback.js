// @ts-nocheck
/**
 * BackJerseyFallback — illustration RN-SVG "silhouette de dos + maillot FoundClub"
 * avec flocage NOM + numero. Destination repo :
 * app/src/components/organisms/playerCard/BackJerseyFallback.js
 *
 * Utilise comme :
 *  - fallback quand le joueur n'a pas de photo,
 *  - defaut impose pour un mineur non publiable (jamais de visage),
 *  - brique de base de la carte equipe (grille de dos).
 *
 * Rendu 100% vectoriel (react-native-svg, deja installe) : net apres upscale 1080px.
 * Le rendu FINAL (coupe du maillot, texture, logo) est arbitre dans Claude design
 * (cf. 01-DESIGN Sec.6.1). Ceci est un gabarit fidele aux tokens.
 */
import { StyleSheet, View } from 'react-native';
import Svg, {
  Defs, LinearGradient, Path, Rect, Stop, Text as SvgText,
} from 'react-native-svg';

const FC_BLUE = '#01b3f4';
const FC_DARK = '#0c2733';

/**
 * @param {object} props
 * @param {string} [props.name] nom floque (uppercase conseille)
 * @param {number|string} [props.number] numero floque
 * @param {string} [props.accent] couleur d'accent (rarete)
 * @param {number} [props.size] cote logique du carre (px)
 * @param {boolean} [props.compact] variante dense (carte equipe) : moins de details
 */
function BackJerseyFallback({
  accent = FC_BLUE,
  compact = false,
  name = 'FOUNDCLUB',
  number = '',
  size = null,
}) {
  // size numerique = carre fixe (grille equipe) ; sans size, remplit le parent
  // (zone photo flexible de PlayerCard) en letterbox centre ("meet").
  const dims = size ? { height: size, width: size } : { height: '100%', width: '100%' };
  // Coordonnees relatives a un viewBox 100x100 pour rester responsive a l'upscale.
  const displayName = String(name || '').slice(0, 12).toUpperCase();
  const displayNumber = number === '' || number === null || number === undefined
    ? ''
    : String(number);

  return (
    <View style={[styles.wrap, dims]}>
      <Svg height="100%" preserveAspectRatio="xMidYMid meet" viewBox="0 0 100 100" width="100%">
        <Defs>
          <LinearGradient id="jerseyGrad" x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0" stopColor={FC_BLUE} stopOpacity="0.95" />
            <Stop offset="1" stopColor="#0184b6" stopOpacity="0.95" />
          </LinearGradient>
          <LinearGradient id="bgGrad" x1="0" x2="1" y1="0" y2="1">
            <Stop offset="0" stopColor={FC_DARK} stopOpacity="1" />
            <Stop offset="1" stopColor="#08202b" stopOpacity="1" />
          </LinearGradient>
        </Defs>

        {/* Fond : transparent en mode fill (la zone parent assure le fond) ;
            le carre sombre n'est garde qu'en variante compacte (grille equipe). */}
        {compact ? <Rect fill="url(#bgGrad)" height="100" rx="4" width="100" x="0" y="0" /> : null}

        {/* Tete (silhouette de dos, nuque) */}
        <Path
          d="M50 18 C43 18 38 23 38 30 C38 36 42 40 50 40 C58 40 62 36 62 30 C62 23 57 18 50 18 Z"
          fill="#12303d"
        />
        {/* Col */}
        <Path d="M42 40 C45 46 55 46 58 40 L60 44 C55 50 45 50 40 44 Z" fill="#0d2531" />

        {/* Maillot (dos) : epaules + tronc */}
        <Path
          d="M30 46 C36 42 40 44 42 45 L58 45 C60 44 64 42 70 46 L78 58 L70 64 L68 60 L68 92 C68 95 66 96 62 96 L38 96 C34 96 32 95 32 92 L32 60 L30 64 L22 58 Z"
          fill="url(#jerseyGrad)"
        />
        {/* Liseré col accent (rarete) */}
        <Path d="M42 45 L58 45 L57 49 L43 49 Z" fill={accent} opacity="0.9" />

        {!compact && (
          <>
            {/* Bandeau NOM floque (haut du dos) */}
            <SvgText
              fill="#eaf7ff"
              fontSize="7"
              fontWeight="bold"
              letterSpacing="1"
              textAnchor="middle"
              x="50"
              y="60"
            >
              {displayName}
            </SvgText>
          </>
        )}

        {/* Numero floque (centre du dos) */}
        {displayNumber ? (
          <SvgText
            fill="#ffffff"
            fontSize={compact ? '20' : '26'}
            fontWeight="900"
            textAnchor="middle"
            x="50"
            y={compact ? '80' : '84'}
          >
            {displayNumber}
          </SvgText>
        ) : null}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});

export default BackJerseyFallback;
