// @ts-nocheck
/**
 * PlayerCard — carte joueur collectible FoundClub (design final Claude design).
 *
 * Reproduction exacte de la maquette 992×1262 : toutes les valeurs px sont a la
 * base 992 et multipliees par scale = width / 992. Tout le contenu vient des
 * props ; seuls le wordmark FOUNDCLUB et les labels de lignes sont en dur.
 *
 * Contraintes techniques respectees :
 *  - degrades/eclats/terrain : react-native-svg + react-native-linear-gradient
 *    (deja lies, AUCUNE dependance native nouvelle) ;
 *  - pas de backdrop-filter en RN -> panneaux opaques #041c26 (PAR-L14) ;
 *  - italique : l'APK n'embarque que Montserrat Regular/Bold/Black -> faux
 *    italique via skewX(-8deg) (ajouter Montserrat-BlackItalic.ttf + rebuild
 *    pour la vraie italique) ; weight 800 rendu en Montserrat-Black ;
 *  - composant pur, memoise, sans etat (hors mesure du badge hexagonal) ;
 *  - capture export : react-native-view-shot a 992×1262 (cf. CARD_FORMATS).
 *
 * Extensions hors maquette (exigences produit existantes, sans impact visuel
 * sur les rendus normaux) : prop `locked` (garde-fou mineurs : voile + QR
 * masque) et fallback dos floque si `photo` absent (jamais de carte vide).
 */
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, StyleSheet, Text, View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import Svg, {
  Circle, Defs, Ellipse, G, Line, Polygon,
  RadialGradient, Rect, Stop, LinearGradient as SvgLinearGradient, Text as SvgText,
} from 'react-native-svg';

import BackJerseyFallback from './BackJerseyFallback';

// Fond dynamique de l'app (meme asset que theme/images.js bg2).
// eslint-disable-next-line global-require
const BG_IMAGE = require('../../../assets/pictures/bg-2.png');
// Logo officiel FoundClub (wordmark horizontal 1103×121, fond transparent).
// eslint-disable-next-line global-require
const LOGO_IMAGE = require('../../../assets/pictures/logo.png');

const LOGO_RATIO = 1103 / 121;

/** Dimensions natives de la maquette (et de l'export view-shot). */
export const CARD_EXPORT_WIDTH = 992;
export const CARD_EXPORT_HEIGHT = 1262;

/** Preset de capture (consomme par useShareCard). */
export const CARD_FORMATS = Object.freeze({
  square: { height: CARD_EXPORT_HEIGHT, key: 'square', width: CARD_EXPORT_WIDTH },
});

/** LEGACY — encore consomme par TeamCard (v1.1, non cable). */
export const RARITY_THEME = {
  common: { accent: '#7f8c99', glow: 'rgba(127,140,153,0.25)', label: 'COMMUNE' },
  epic: { accent: '#a855f7', glow: 'rgba(168,85,247,0.40)', label: 'ÉPIQUE' },
  legendary: { accent: '#f5b301', glow: 'rgba(245,179,1,0.45)', label: 'LÉGENDAIRE' },
  rare: { accent: '#01b3f4', glow: 'rgba(1,179,244,0.35)', label: 'RARE' },
};

const CYAN = '#01b3f4';
const INK = '#001218';

/**
 * PAR-L14 — la mise en page, en unites de dessin (base 992 x 1262).
 * Aucune police sous 32 unites : la carte est reduite a la largeur de l'ecran, et
 * 32 unites font 10,5 pt sur un iPhone SE (carte de 327 pt, x0,33) et 10,1 dp sur
 * un Android de 360 dp (312, x0,31). Elle en avait de 15 a 21 (5 a 7 pt).
 * Hauteurs de ligne explicites : la place de l'historique se CALCULE
 * (planHistorique), la carte a hauteur fixe ne rogne jamais rien.
 */
const LAYOUT = Object.freeze({
  clubLine: 40,
  entryPadV: 5,
  footerGap: 14,
  footerH: 118,
  hairline: 4, // un trait de 1 pt d'ecran vaut au plus 4 unites (echelle >= 0,25)
  headerH: 56,
  histGap: 14,
  histListGap: 4,
  histPadV: 14,
  histTitleH: 38,
  identityGap: 12,
  identityH: 360,
  infoGap: 16,
  infoPadV: 4,
  metaLine: 38,
  padBottom: 28,
  padH: 44,
  padTop: 28,
  rowH: 52,
});
const INTERIOR_H = CARD_EXPORT_HEIGHT - 6;

/**
 * Combien de lignes d'historique tiennent sous un tableau de `rangees` rangees,
 * et sur combien de lignes s'ecrit le nom du club (2 si la place le permet).
 * On montre d'abord le plus de clubs possible (3 au plus), puis on leur donne
 * 2 lignes. Le compteur de l'en-tete compte TOUS les clubs.
 * @param {number} rangees rangees du tableau
 * @param {number} disponibles lignes d'historique a montrer
 * @returns {{ lignes: number, lignesClub: 1|2 }}
 */
export const planHistorique = (rangees, disponibles) => {
  const L = LAYOUT;
  const fixe = L.padTop + L.padBottom + L.headerH + L.identityGap + L.identityH
    + L.infoGap + 2 * L.infoPadV + L.histGap + 2 * L.histPadV + L.histTitleH + L.histListGap
    + L.footerGap + L.footerH + L.hairline * (rangees + 3);
  const place = INTERIOR_H - fixe - rangees * L.rowH;
  const hauteur = (lignesClub) => 2 * L.entryPadV + lignesClub * L.clubLine + L.metaLine;
  for (let n = Math.min(3, disponibles); n > 0; n -= 1) {
    if (n * hauteur(2) <= place) return { lignes: n, lignesClub: 2 };
    if (n * hauteur(1) <= place) return { lignes: n, lignesClub: 1 };
  }
  return { lignes: 0, lignesClub: 1 };
};

/**
 * Style d'un texte de la carte : taille et hauteur de ligne a l'echelle.
 * @param {number} s echelle (largeur / 992)
 * @param {number} size taille en unites de dessin
 * @param {number} line hauteur de ligne en unites de dessin
 * @returns {{ fontSize: number, includeFontPadding: boolean, lineHeight: number }}
 */
const font = (s, size, line) => ({
  fontSize: size * s, includeFontPadding: false, lineHeight: line * s,
});

// Extremites de degrades pour les angles CSS utilises (155/165/115 deg).
const ANGLES = {
  115: {
    x1: '4.7%', x2: '95.3%', y1: '28.9%', y2: '71.1%',
  },
  155: {
    x1: '28.9%', x2: '71.1%', y1: '4.7%', y2: '95.3%',
  },
  165: {
    x1: '37.1%', x2: '62.9%', y1: '1.7%', y2: '98.3%',
  },
};

// NB react-native-svg : l'alpha d'un rgba() dans stopColor est ignore ->
// toujours stopColor hex + stopOpacity ([offset, hex, opacity]).
const RARITY_STYLES = {
  COMMON: {
    borderAngle: 155,
    borderStops: [[0, '#01b3f4', 0.32], [1, '#01b3f4', 0.32]],
    crystal: false,
    few: false,
    glowCyan: 0,
    glowViolet: 0,
    many: false,
  },
  EPIC: {
    borderAngle: 165,
    borderStops: [[0, '#66d2f9', 1], [0.45, '#01b3f4', 1], [1, '#0a5a7d', 1]],
    crystal: false,
    few: true,
    glowCyan: 0.26,
    glowViolet: 0,
    many: false,
  },
  MOST_RARE: {
    borderAngle: 155,
    borderStops: [
      [0, '#d8f4ff', 1], [0.14, '#66d2f9', 1], [0.32, '#01b3f4', 1],
      [0.52, '#12608a', 1], [0.72, '#8567ff', 1], [1, '#99e1fb', 1],
    ],
    crystal: true,
    few: true,
    glowCyan: 0.45,
    glowViolet: 0.22,
    many: true,
  },
  RARE: {
    borderAngle: 155,
    borderStops: [[0, '#01b3f4', 0.75], [1, '#01b3f4', 0.75]],
    crystal: false,
    few: false,
    glowCyan: 0.15,
    glowViolet: 0,
    many: false,
  },
  ULTRA_RARE: {
    borderAngle: 155,
    borderStops: [
      [0, '#b3ecff', 1], [0.22, '#66d2f9', 1], [0.48, '#01b3f4', 1],
      [0.72, '#0096d1', 1], [1, '#66d2f9', 1],
    ],
    crystal: false,
    few: true,
    glowCyan: 0.38,
    glowViolet: 0,
    many: true,
  },
};

const up = (value) => String(value ?? '').toUpperCase();

/**
 * Wordmark FOUNDCLUB — logo officiel de l'app (demande Adel : pas de texte).
 * @param root0
 * @param root0.size hauteur logique du logo (base 992)
 * @param root0.s
 */
function Wordmark({ s, size }) {
  const h = size * s;
  return (
    <Image
      resizeMode="contain"
      source={LOGO_IMAGE}
      style={{ height: h, width: h * LOGO_RATIO }}
    />
  );
}

/**
 * Badge hexagonal de rarete (contour degrade + gemme + libelle).
 * @param root0
 * @param root0.label
 * @param root0.s
 */
function RarityBadge({ label, s }) {
  const [size, setSize] = useState(null);
  const cut = 0.09;
  return (
    <View
      onLayout={(e) => setSize({
        h: e.nativeEvent.layout.height, w: e.nativeEvent.layout.width,
      })}
      style={[styles.row, { paddingHorizontal: 28 * s, paddingVertical: 9 * s }]}
    >
      {size ? (
        <Svg height={size.h} pointerEvents="none" style={StyleSheet.absoluteFill} width={size.w}>
          <Defs>
            <SvgLinearGradient id="badgeStroke" x1="0%" x2="100%" y1="0%" y2="100%">
              <Stop offset="0" stopColor="#99e1fb" />
              <Stop offset="0.45" stopColor="#01b3f4" />
              <Stop offset="1" stopColor="#8567ff" />
            </SvgLinearGradient>
            <SvgLinearGradient id="badgeFill" x1="0%" x2="0%" y1="0%" y2="100%">
              <Stop offset="0" stopColor="#062836" />
              <Stop offset="1" stopColor="#021620" />
            </SvgLinearGradient>
          </Defs>
          {/* Halo cyan (drop-shadow de la maquette) : hexagones concentriques */}
          <Polygon
            fill="none"
            points={`${cut * size.w},1 ${(1 - cut) * size.w},1 ${size.w - 1},${size.h / 2} ${(1 - cut) * size.w},${size.h - 1} ${cut * size.w},${size.h - 1} 1,${size.h / 2}`}
            stroke={CYAN}
            strokeOpacity={0.14}
            strokeWidth={9 * s}
          />
          <Polygon
            fill="none"
            points={`${cut * size.w},1 ${(1 - cut) * size.w},1 ${size.w - 1},${size.h / 2} ${(1 - cut) * size.w},${size.h - 1} ${cut * size.w},${size.h - 1} 1,${size.h / 2}`}
            stroke={CYAN}
            strokeOpacity={0.3}
            strokeWidth={5 * s}
          />
          <Polygon
            fill="url(#badgeFill)"
            points={`${cut * size.w},1 ${(1 - cut) * size.w},1 ${size.w - 1},${size.h / 2} ${(1 - cut) * size.w},${size.h - 1} ${cut * size.w},${size.h - 1} 1,${size.h / 2}`}
            stroke="url(#badgeStroke)"
            strokeWidth={2.5 * s}
          />
        </Svg>
      ) : null}
      <Svg height={24 * s} viewBox="0 0 17 17" width={24 * s}>
        <Defs>
          <SvgLinearGradient id="gem" x1="0%" x2="100%" y1="0%" y2="100%">
            <Stop offset="0" stopColor="#d8f4ff" />
            <Stop offset="0.35" stopColor="#66d2f9" />
            <Stop offset="0.7" stopColor="#01b3f4" />
            <Stop offset="1" stopColor="#8567ff" />
          </SvgLinearGradient>
        </Defs>
        <Polygon fill="url(#gem)" points="8.5,0 17,8.5 8.5,17 0,8.5" />
        <Polygon fill="rgba(255,255,255,0.55)" points="8.5,2.4 12,5.9 8.5,7.6 5,5.9" />
      </Svg>
      <Text
        allowFontScaling={false}
        style={{
          color: '#eaf7fd',
          fontFamily: 'Montserrat-Black',
          ...font(s, 32, 38),
          letterSpacing: 2 * s,
          marginLeft: 12 * s,
        }}
      >
        {up(label)}
      </Text>
    </View>
  );
}

/**
 * Eclats decoratifs (few / many / voile cristal) — SVG plein cadre.
 * @param root0
 * @param root0.crystal
 * @param root0.few
 * @param root0.h
 * @param root0.many
 * @param root0.s
 * @param root0.w
 */
function Shards({
  crystal, few, h, many, s, w,
}) {
  if (!few && !many && !crystal) return null;
  return (
    <Svg height={h} pointerEvents="none" style={StyleSheet.absoluteFill} width={w}>
      <Defs>
        <SvgLinearGradient id="shardA" x1="0%" x2="100%" y1="0%" y2="100%">
          <Stop offset="0" stopColor="#66d2f9" stopOpacity={0.2} />
          <Stop offset="1" stopColor="#66d2f9" stopOpacity={0} />
        </SvgLinearGradient>
        <SvgLinearGradient id="shardB" x1="100%" x2="0%" y1="0%" y2="100%">
          <Stop offset="0" stopColor="#01b3f4" stopOpacity={0.14} />
          <Stop offset="1" stopColor="#01b3f4" stopOpacity={0} />
        </SvgLinearGradient>
        <SvgLinearGradient id="liseret" x1="0%" x2="100%" y1="0%" y2="0%">
          <Stop offset="0" stopColor="#ffffff" stopOpacity={0} />
          <Stop offset="0.5" stopColor="#ffffff" stopOpacity={0.55} />
          <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
        </SvgLinearGradient>
        <SvgLinearGradient id="veil" x1={ANGLES[115].x1} x2={ANGLES[115].x2} y1={ANGLES[115].y1} y2={ANGLES[115].y2}>
          <Stop offset="0" stopColor="#ffffff" stopOpacity={0} />
          <Stop offset="0.45" stopColor="#ffffff" stopOpacity={0.11} />
          <Stop offset="0.55" stopColor="#8567ff" stopOpacity={0.07} />
          <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
        </SvgLinearGradient>
      </Defs>

      {few ? (
        <>
          {/* Polygones diagonaux translucides, coins haut-droit et gauche */}
          <Polygon fill="url(#shardA)" points={`${w - 300 * s},0 ${w},0 ${w},${260 * s}`} />
          <Polygon fill="url(#shardB)" points={`0,${120 * s} 0,${420 * s} ${260 * s},${170 * s}`} />
          {/* Trait lumineux incline 24° */}
          <Rect
            fill="rgba(216,244,255,0.35)"
            height={430 * s}
            transform={`rotate(24 ${w * 0.62} ${60 * s})`}
            width={2 * s}
            x={w * 0.62}
            y={-40 * s}
          />
        </>
      ) : null}

      {many ? (
        <>
          <Rect
            fill="rgba(216,244,255,0.30)"
            height={380 * s}
            transform={`rotate(-18 ${w * 0.88} ${140 * s})`}
            width={2 * s}
            x={w * 0.88}
            y={80 * s}
          />
          <Polygon fill="url(#shardB)" points={`0,${h} 0,${h - 300 * s} ${240 * s},${h}`} />
          {/* Petits losanges brillants */}
          <Polygon
            fill="rgba(216,244,255,0.5)"
            points={`${w * 0.18},${190 * s} ${w * 0.18 + 9 * s},${199 * s} ${w * 0.18},${208 * s} ${w * 0.18 - 9 * s},${199 * s}`}
          />
          <Polygon
            fill="rgba(216,244,255,0.4)"
            points={`${w * 0.82},${h - 260 * s} ${w * 0.82 + 7 * s},${h - 253 * s} ${w * 0.82},${h - 246 * s} ${w * 0.82 - 7 * s},${h - 253 * s}`}
          />
          {/* Lisere blanc haut de carte */}
          <Rect fill="url(#liseret)" height={2 * s} width={w * 0.7} x={w * 0.15} y={0} />
        </>
      ) : null}

      {crystal ? (
        <>
          <Rect fill="url(#veil)" height={h} width={w} x={0} y={0} />
          <Polygon fill="rgba(133,103,255,0.18)" points={`0,0 ${300 * s},0 0,${260 * s}`} />
          <Polygon
            fill="rgba(196,181,255,0.5)"
            points={`${w * 0.3},${h - 200 * s} ${w * 0.3 + 8 * s},${h - 192 * s} ${w * 0.3},${h - 184 * s} ${w * 0.3 - 8 * s},${h - 192 * s}`}
          />
        </>
      ) : null}
    </Svg>
  );
}

/**
 * Mini-terrain SVG horizontal 4-2-3-1 (panneau bas variante tactique).
 * @param root0
 * @param root0.numero
 * @param root0.pitchWidth
 * @param root0.posteIndex
 */
function TacticalPitch({ numero, pitchWidth, posteIndex }) {
  // 10 joueurs (sans gardien), de la defense vers l'attaque.
  const players = [
    { x: 120, y: 22 }, { x: 120, y: 66 }, { x: 120, y: 110 }, { x: 120, y: 154 },
    { x: 330, y: 58 }, { x: 330, y: 118 },
    { x: 550, y: 30 }, { x: 550, y: 88 }, { x: 550, y: 146 },
    { x: 740, y: 88 },
  ];
  const line = 'rgba(153,225,251,0.38)';
  return (
    <Svg
      height={pitchWidth * (176 / 840)}
      style={{ alignSelf: 'center', marginTop: pitchWidth * 0.017 }}
      viewBox="0 0 840 176"
      width={pitchWidth}
    >
      <Rect fill="rgba(2,36,48,0.45)" height="173" rx="8" stroke={line} strokeWidth="1.5" width="837" x="1.5" y="1.5" />
      <Line stroke={line} strokeWidth="1.5" x1="420" x2="420" y1="1.5" y2="174.5" />
      <Circle cx="420" cy="88" fill="none" r="26" stroke={line} strokeWidth="1.5" />
      {/* Surfaces + 6m */}
      <Rect fill="none" height="104" stroke={line} strokeWidth="1.5" width="92" x="1.5" y="36" />
      <Rect fill="none" height="56" stroke={line} strokeWidth="1.5" width="40" x="1.5" y="60" />
      <Rect fill="none" height="104" stroke={line} strokeWidth="1.5" width="92" x="746.5" y="36" />
      <Rect fill="none" height="56" stroke={line} strokeWidth="1.5" width="40" x="798.5" y="60" />
      {players.map((p, i) => (i === posteIndex ? (
        <G key={`p-${p.x}-${p.y}`}>
          <Circle cx={p.x} cy={p.y} fill="none" r="28" stroke="rgba(1,179,244,0.3)" strokeWidth="1.5" />
          <Circle cx={p.x} cy={p.y} fill="none" r="22" stroke="rgba(1,179,244,0.5)" strokeWidth="1.5" />
          <Circle cx={p.x} cy={p.y} fill={CYAN} r="16" stroke="#ffffff" strokeWidth="2" />
          <SvgText
            fill={INK}
            fontFamily="Montserrat-Black"
            fontSize="15"
            fontWeight="900"
            textAnchor="middle"
            x={p.x}
            y={p.y + 5.5}
          >
            {up(numero)}
          </SvgText>
        </G>
      ) : (
        <Circle cx={p.x} cy={p.y} fill="#0d2f3d" key={`p-${p.x}-${p.y}`} r="11" stroke="rgba(102,210,249,0.75)" strokeWidth="1.5" />
      )))}
    </Svg>
  );
}

/**
 * Ligne label/valeur du panneau infos.
 * @param root0
 * @param root0.isLast
 * @param root0.label
 * @param root0.s
 * @param root0.value
 */
function InfoRow({
  isLast, label, s, value,
}) {
  return (
    <View
      style={[styles.row, {
        borderBottomColor: 'rgba(255,255,255,0.07)',
        borderBottomWidth: isLast ? 0 : 1,
        height: LAYOUT.rowH * s,
        justifyContent: 'space-between',
      }]}
    >
      <Text
        allowFontScaling={false}
        style={{
          color: '#adb1b2', fontFamily: 'Montserrat-Bold', ...font(s, 32, 38), letterSpacing: 2 * s,
        }}
      >
        {label}
      </Text>
      {typeof value === 'string' ? (
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={{
            color: '#ffffff', fontFamily: 'Montserrat-Black', ...font(s, 36, 44), maxWidth: '62%',
          }}
        >
          {value}
        </Text>
      ) : value}
    </View>
  );
}

/**
 * Carte joueur collectible (voir en-tete du fichier pour l'API complete).
 * @param {object} props
 * @param {number} props.width largeur rendue ; scale = width / 992
 * @param props.age
 * @param props.backgroundVisible
 * @param props.bottomPanel
 * @param props.club
 * @param props.disposition
 * @param props.historique
 * @param props.locked
 * @param props.nationalite
 * @param props.nom
 * @param props.numero
 * @param props.photo
 * @param props.poste
 * @param props.posteIndex
 * @param props.prenom
 * @param props.qrValue
 * @param props.rarity
 * @param props.rarityLabel
 * @param props.sport
 * @param props.statut
 * @param props.ville
 */
function PlayerCardBase({
  age,
  backgroundVisible = true,
  bottomPanel = 'historique',
  club,
  disposition,
  historique = [],
  historiqueEmptyLabel = undefined,
  locked = false,
  nationalite,
  nom,
  numero,
  photo,
  poste,
  posteIndex = 0,
  prenom,
  qrValue,
  rarity = 'COMMON',
  rarityLabel,
  sport,
  statut = 'DISPONIBLE',
  ville,
  width,
}) {
  const { t } = useTranslation();
  /** Libelles par defaut du badge (surchargables via prop rarityLabel). */
  const RARITY_LABELS = {
    COMMON: t('playerCard.rarity.common', 'COMMUNE'),
    EPIC: t('playerCard.rarity.epic', 'ÉPIQUE'),
    MOST_RARE: t('playerCard.rarity.mostRare', 'MOST RARE'),
    RARE: t('playerCard.rarity.rare', 'RARE'),
    ULTRA_RARE: t('playerCard.rarity.ultraRare', 'ULTRA RARE'),
  };
  const s = width / CARD_EXPORT_WIDTH;
  const h = width * (CARD_EXPORT_HEIGHT / CARD_EXPORT_WIDTH);
  const theme = RARITY_STYLES[rarity] || RARITY_STYLES.COMMON;
  const angle = ANGLES[theme.borderAngle] || ANGLES[155];
  const isAvailable = up(statut) === 'DISPONIBLE';
  const statusColor = isAvailable ? '#27d6a3' : '#ff284f';
  const plan = planHistorique(6, historique.length);

  return (
    <View collapsable={false} style={{ height: h, width }}>
      {/* 1. Lueur externe (déborde volontairement de la carte) */}
      {theme.glowCyan > 0 || theme.glowViolet > 0 ? (
        <Svg
          height={h + 320 * s}
          pointerEvents="none"
          style={{
            left: -160 * s, position: 'absolute', top: -160 * s,
          }}
          width={width + 320 * s}
        >
          <Defs>
            <RadialGradient cx="50%" cy="50%" id="glowCyan" r="50%">
              <Stop offset="0.55" stopColor="#01b3f4" stopOpacity={theme.glowCyan} />
              <Stop offset="1" stopColor="#01b3f4" stopOpacity={0} />
            </RadialGradient>
            <RadialGradient cx="50%" cy="50%" id="glowViolet" r="50%">
              <Stop offset="0.4" stopColor="#8567ff" stopOpacity={theme.glowViolet} />
              <Stop offset="1" stopColor="#8567ff" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          {theme.glowViolet > 0 ? (
            <Ellipse cx="50%" cy="50%" fill="url(#glowViolet)" rx="50%" ry="50%" />
          ) : null}
          <Ellipse cx="50%" cy="50%" fill="url(#glowCyan)" rx="46%" ry="46%" />
        </Svg>
      ) : null}

      {/* 2. Bordure cristal */}
      <Svg height={h} style={StyleSheet.absoluteFill} width={width}>
        <Defs>
          <SvgLinearGradient id="border" x1={angle.x1} x2={angle.x2} y1={angle.y1} y2={angle.y2}>
            {theme.borderStops.map(([offset, color, opacity]) => (
              <Stop key={`${offset}-${color}`} offset={String(offset)} stopColor={color} stopOpacity={opacity} />
            ))}
          </SvgLinearGradient>
        </Defs>
        <Rect fill="url(#border)" height={h} rx={36 * s} width={width} x="0" y="0" />
      </Svg>

      {/* 3. Intérieur */}
      <View
        style={{
          backgroundColor: '#032430',
          borderRadius: 33 * s,
          bottom: 3 * s,
          left: 3 * s,
          overflow: 'hidden',
          position: 'absolute',
          right: 3 * s,
          top: 3 * s,
        }}
      >
        {/* 4. Fond dynamique */}
        {backgroundVisible ? (
          <>
            <Image
              resizeMode="cover"
              source={BG_IMAGE}
              style={[StyleSheet.absoluteFill, { height: '100%', opacity: 0.5, width: '100%' }]}
            />
            <LinearGradient
              colors={['rgba(0,18,24,0.5)', 'rgba(0,18,24,0.14)', 'rgba(1,22,30,0.72)']}
              locations={[0, 0.4, 1]}
              style={StyleSheet.absoluteFill}
            />
          </>
        ) : null}

        {/* 5. Éclats décoratifs */}
        <Shards
          crystal={theme.crystal}
          few={theme.few}
          h={h - 6 * s}
          many={theme.many}
          s={s}
          w={width - 6 * s}
        />

        {/* 6. Contenu */}
        <View
          style={{
            flex: 1,
            paddingBottom: LAYOUT.padBottom * s,
            paddingHorizontal: LAYOUT.padH * s,
            paddingTop: LAYOUT.padTop * s,
          }}
        >
          {/* En-tête */}
          <View style={[styles.row, { height: LAYOUT.headerH * s, justifyContent: 'space-between' }]}>
            <Wordmark s={s} size={30} />
            <RarityBadge label={rarityLabel || RARITY_LABELS[rarity] || rarity} s={s} />
          </View>

          {/* Bloc identité */}
          <View style={{ height: LAYOUT.identityH * s, marginTop: LAYOUT.identityGap * s }}>
            {/* Halo derrière le portrait */}
            <Svg
              height={640 * s}
              pointerEvents="none"
              style={{ position: 'absolute', right: -160 * s, top: -120 * s }}
              width={640 * s}
            >
              <Defs>
                <RadialGradient cx="50%" cy="50%" id="portraitHalo" r="50%">
                  <Stop offset="0" stopColor="#01b3f4" stopOpacity={0.2} />
                  <Stop offset="1" stopColor="#01b3f4" stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Ellipse cx="50%" cy="50%" fill="url(#portraitHalo)" rx="50%" ry="50%" />
            </Svg>

            {/* Colonne gauche */}
            <View style={{ width: 470 * s }}>
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={{
                  color: CYAN,
                  fontFamily: 'Montserrat-Black',
                  ...font(s, 184, 166),
                  letterSpacing: -8 * s,
                  textShadowColor: 'rgba(1,179,244,0.55)',
                  textShadowRadius: 54 * s,
                  transform: [{ skewX: '-8deg' }],
                }}
              >
                {up(numero)}
              </Text>
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={{
                  color: '#eaf7fd',
                  fontFamily: 'Montserrat-Bold',
                  ...font(s, 32, 38),
                  letterSpacing: 8 * s,
                  marginTop: 16 * s,
                }}
              >
                {up(prenom)}
              </Text>
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={{
                  color: '#ffffff',
                  fontFamily: 'Montserrat-Black',
                  ...font(s, 64, 64),
                  marginTop: 4 * s,
                }}
              >
                {up(nom)}
              </Text>
              {/* Pill sport : masquee si le sport n'est pas renseigne (un
                  moignon « — » chevauchait le panneau infos). */}
              {sport && up(sport) !== '—' ? (
                <View
                  style={{
                    alignSelf: 'flex-start',
                    backgroundColor: 'rgba(1,179,244,0.12)',
                    borderColor: 'rgba(1,179,244,0.55)',
                    borderRadius: 999,
                    borderWidth: 1.5 * s,
                    marginTop: 12 * s,
                    paddingHorizontal: 22 * s,
                    paddingVertical: 8 * s,
                  }}
                >
                  <Text
                    allowFontScaling={false}
                    numberOfLines={1}
                    style={{
                      color: CYAN,
                      fontFamily: 'Montserrat-Black',
                      ...font(s, 32, 38),
                      letterSpacing: 3 * s,
                      textShadowColor: 'rgba(1,179,244,0.4)',
                      textShadowRadius: 8 * s,
                    }}
                  >
                    {up(sport)}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Portrait — PAR-L14 : contenu dans le bloc identite. Il etait pose en
                debord (442 de haut dans un bloc de 372, 12 au-dessus) pour un portrait
                detoure ; une vraie photo, opaque, descendait sur la rangee POSTE. */}
            <View
              style={{
                backgroundColor: 'rgba(3,26,35,0.45)',
                borderColor: 'rgba(1,179,244,0.25)',
                borderRadius: 26 * s,
                borderWidth: 1,
                height: LAYOUT.identityH * s,
                padding: 6 * s,
                position: 'absolute',
                right: 0,
                top: 0,
                width: 328 * s,
              }}
            >
              {photo ? (
                <Image
                  resizeMode="cover"
                  source={photo}
                  style={{ borderRadius: 20 * s, height: '100%', width: '100%' }}
                />
              ) : (
                <View style={{ borderRadius: 20 * s, flex: 1, overflow: 'hidden' }}>
                  <BackJerseyFallback accent={CYAN} name={nom} number={numero} />
                </View>
              )}
            </View>
          </View>

          {/* Panneau infos */}
          <View style={[styles.glass, {
            borderRadius: 20 * s,
            marginTop: LAYOUT.infoGap * s,
            paddingHorizontal: 30 * s,
            paddingVertical: LAYOUT.infoPadV * s,
          }]}
          >
            <InfoRow label={t('playerCard.info.position', 'POSTE')} s={s} value={up(poste)} />
            <InfoRow label={t('playerCard.info.age', 'ÂGE')} s={s} value={up(age)} />
            <InfoRow
              label={t('playerCard.info.nationality', 'NATIONALITÉ')}
              s={s}
              value={up(nationalite)}
            />
            <InfoRow label={t('playerCard.info.club', 'CLUB')} s={s} value={up(club)} />
            <InfoRow label={t('playerCard.info.city', 'VILLE')} s={s} value={up(ville)} />
            <InfoRow
              isLast
              label="STATUT"
              s={s}
              value={(
                <View style={styles.row}>
                  <View
                    style={{
                      backgroundColor: statusColor,
                      borderRadius: 7 * s,
                      height: 14 * s,
                      marginRight: 12 * s,
                      width: 14 * s,
                    }}
                  />
                  <Text
                    allowFontScaling={false}
                    style={{
                      color: statusColor,
                      fontFamily: 'Montserrat-Black',
                      ...font(s, 36, 44),
                      textShadowColor: statusColor,
                      textShadowRadius: 9 * s,
                    }}
                  >
                    {isAvailable ? 'DISPONIBLE' : 'INDISPONIBLE'}
                  </Text>
                </View>
              )}
            />
          </View>

          {/* Panneau bas */}
          <View style={[styles.glass, {
            borderRadius: 20 * s,
            flexGrow: 1,
            marginTop: LAYOUT.histGap * s,
            paddingHorizontal: 30 * s,
            paddingVertical: LAYOUT.histPadV * s,
          }]}
          >
            {bottomPanel === 'tactique' ? (
              <>
                <View style={[styles.row, { justifyContent: 'space-between' }]}>
                  <Text
                    allowFontScaling={false}
                    style={{
                      color: '#eaf7fd',
                      fontFamily: 'Montserrat-Black',
                      ...font(s, 32, 38),
                      letterSpacing: 2 * s,
                    }}
                  >
                    {t('playerCard.preferredFormation', 'DISPOSITION PRÉFÉRÉE')}
                  </Text>
                  <Text
                    allowFontScaling={false}
                    style={{ color: CYAN, fontFamily: 'Montserrat-Black', ...font(s, 36, 44) }}
                  >
                    {up(disposition)}
                  </Text>
                </View>
                <View style={[styles.center, { flexGrow: 1 }]}>
                  <TacticalPitch
                    numero={numero}
                    pitchWidth={width - (44 * 2 + 30 * 2 + 6) * s}
                    posteIndex={posteIndex}
                  />
                </View>
              </>
            ) : (
              <>
                <View
                  style={[styles.row, { height: LAYOUT.histTitleH * s, justifyContent: 'space-between' }]}
                >
                  <Text
                    allowFontScaling={false}
                    style={{
                      color: '#eaf7fd',
                      fontFamily: 'Montserrat-Black',
                      ...font(s, 32, 38),
                      letterSpacing: 2 * s,
                    }}
                  >
                    {t('playerCard.history.title', 'HISTORIQUE SPORTIF')}
                  </Text>
                  {historique.length ? (
                    <Text
                      allowFontScaling={false}
                      style={{ color: CYAN, fontFamily: 'Montserrat-Black', ...font(s, 32, 38) }}
                    >
                      {t(
                        'playerCard.history.clubCount',
                        '{{total}} CLUBS',
                        { total: historique.length },
                      )}
                    </Text>
                  ) : null}
                </View>
                {/* PAR-L14 : un club par ligne, nom sur 2 lignes si la place le
                    permet, saison et niveau DESSOUS (la colonne niveau ecrasait le
                    nom). Les lignes se centrent dans le panneau : plus de grand
                    vide sous l'historique. */}
                {!historique.length ? (
                  <View style={[styles.center, { flexGrow: 1 }]}>
                    <Text
                      allowFontScaling={false}
                      style={{
                        color: '#5f7c89',
                        fontFamily: 'Montserrat-Bold',
                        ...font(s, 32, 38),
                        letterSpacing: 2 * s,
                      }}
                    >
                      {up(historiqueEmptyLabel ?? t(
                        'playerCard.history.empty',
                        'PARCOURS À COMPLÉTER',
                      ))}
                    </Text>
                  </View>
                ) : (
                  <View
                    style={{ flexGrow: 1, justifyContent: 'center', marginTop: LAYOUT.histListGap * s }}
                  >
                    {historique.slice(0, plan.lignes).map((entry, index) => (
                      <View
                        key={`${entry.periode}-${entry.club}`}
                        style={[styles.row, {
                          alignItems: 'flex-start', paddingVertical: LAYOUT.entryPadV * s,
                        }]}
                      >
                        <View
                          style={{
                            backgroundColor: CYAN,
                            borderRadius: 6 * s,
                            height: 12 * s,
                            marginRight: 18 * s,
                            marginTop: ((LAYOUT.clubLine - 12) / 2) * s,
                            opacity: [1, 0.55, 0.35][index] || 0.35,
                            width: 12 * s,
                          }}
                        />
                        <View style={{ flex: 1 }}>
                          <Text
                            allowFontScaling={false}
                            numberOfLines={plan.lignesClub}
                            style={{
                              color: '#ffffff',
                              fontFamily: 'Montserrat-Black',
                              ...font(s, 34, LAYOUT.clubLine),
                            }}
                          >
                            {up(entry.club)}
                          </Text>
                          <Text
                            allowFontScaling={false}
                            numberOfLines={1}
                            style={{
                              color: CYAN,
                              fontFamily: 'Montserrat-Bold',
                              ...font(s, 32, LAYOUT.metaLine),
                            }}
                          >
                            {[entry.periode, entry.categorie].filter(Boolean).join(' · ')}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>

          {/* Pied */}
          <View
            style={[styles.row, {
              height: LAYOUT.footerH * s,
              justifyContent: 'space-between',
              marginTop: LAYOUT.footerGap * s,
            }]}
          >
            <Wordmark s={s} size={28} />
            <View
              style={{
                alignItems: 'center',
                backgroundColor: '#03222e',
                borderColor: 'rgba(1,179,244,0.55)',
                borderRadius: 16 * s,
                borderWidth: 1.5 * s,
                height: LAYOUT.footerH * s,
                justifyContent: 'center',
                width: LAYOUT.footerH * s,
              }}
            >
              {/* PAR-L14 : le « FC » ne se pose plus SUR le code (a 32 unites il
                  en cacherait le tiers et le code ne se lirait plus) ; il reste
                  dans la case vide de la carte verrouillee. */}
              {qrValue && !locked ? (
                <QRCode
                  backgroundColor="transparent"
                  color="#eaf7fd"
                  ecl="H"
                  size={92 * s}
                  value={qrValue}
                />
              ) : (
                <Text
                  allowFontScaling={false}
                  style={{ color: CYAN, fontFamily: 'Montserrat-Black', ...font(s, 32, 38) }}
                >
                  FC
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Garde-fou mineurs : aperçu verrouillé (extension produit, hors maquette) */}
        {locked ? (
          <View
            style={[StyleSheet.absoluteFill, {
              alignItems: 'center',
              backgroundColor: 'rgba(2,24,32,0.55)',
              justifyContent: 'flex-end',
              paddingBottom: 210 * s,
              paddingHorizontal: 30 * s,
            }]}
          >
            <View
              style={{
                backgroundColor: 'rgba(2,24,32,0.9)',
                borderColor: 'rgba(1,179,244,0.45)',
                borderRadius: 14 * s,
                borderWidth: 1,
                paddingHorizontal: 24 * s,
                paddingVertical: 12 * s,
              }}
            >
              <Text
                allowFontScaling={false}
                style={{
                  color: '#eaf7fd',
                  fontFamily: 'Montserrat-Black',
                  ...font(s, 32, 38),
                  letterSpacing: 1.5 * s,
                  textAlign: 'center',
                }}
              >
                {t('playerCard.parentalConsentPreview', 'APERÇU — ACCORD PARENTAL REQUIS')}
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const PlayerCard = memo(PlayerCardBase);
PlayerCard.displayName = 'PlayerCard';

export default PlayerCard;

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  // PAR-L14 : opaque (il etait transparent a 15 % : le fond et la photo passaient dessous).
  glass: {
    backgroundColor: '#041c26',
    borderColor: 'rgba(1,179,244,0.35)',
    borderWidth: 1,
  },
  row: { alignItems: 'center', flexDirection: 'row' },
});
