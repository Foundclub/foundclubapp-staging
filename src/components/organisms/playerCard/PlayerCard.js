// @ts-nocheck
/**
 * PlayerCard — « Ma carte joueur », direction C « Terrain » (CARTECODE, planche v2 validée par
 * Adel le 26/10/2026, Q9 C) : un billet à encoches, la photo posée sur les lignes du terrain de
 * SON sport, le grand numéro en contour derrière le joueur, le liseré et le reflet de la rareté.
 *
 * Toutes les mesures sont à la base 992 x 1262 (l'image partagée) et multipliées par
 * s = width / 992. react-native-svg et react-native-linear-gradient seulement : aucune
 * dépendance neuve. Aucun or (#f5b301 est réservé à la League) : le légendaire est nacré.
 *
 * Deux usages (`mode`) :
 *  - « ecran » : ce qui manque se voit (« + à compléter », « + N° », « + PHOTO ») ;
 *  - « image » (défaut, l'image partagée) : ce qui manque disparaît, rien n'est inventé.
 * Une case n'existe que si sa prop est fournie : la carte d'un enfant ne reçoit ni taille ni
 * poids (Q7 B), elle n'a donc pas ces cases.
 * `locked` (mineur de moins de 15 ans sans accord) : dos de maillot à la place de la photo,
 * aucun code QR.
 */
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, StyleSheet, Text, View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import Svg, {
  ClipPath,
  Defs,
  G,
  Line,
  Path,
  RadialGradient,
  Rect,
  Stop,
  LinearGradient as SvgLinearGradient,
  Svg as SvgNested,
  Text as SvgText,
} from 'react-native-svg';

import BackJerseyFallback from './BackJerseyFallback';
import { CourtLines } from './courts';

// Logo officiel FoundClub (wordmark horizontal 1103 x 121) et shield de l'app (TeamShield).
const SHIELD_IMAGE = require('../../../assets/icons/shield.png');
const LOGO_IMAGE = require('../../../assets/pictures/logo.png');

const LOGO_RATIO = 1103 / 121;

/** Dimensions natives de la carte (et de l'image partagée). */
export const CARD_EXPORT_WIDTH = 992;
export const CARD_EXPORT_HEIGHT = 1262;

/** Preset de capture (consommé par useShareCard). */
export const CARD_FORMATS = Object.freeze({
  square: { height: CARD_EXPORT_HEIGHT, key: 'square', width: CARD_EXPORT_WIDTH },
});

/** LEGACY — encore consommé par TeamCard (non branchée). Plus d'or : le légendaire est nacré. */
export const RARITY_THEME = {
  common: { accent: '#9aa6b1', glow: 'rgba(127,140,153,0.28)', label: 'COMMUNE' },
  epic: { accent: '#8567ff', glow: 'rgba(133,103,255,0.48)', label: 'ÉPIQUE' },
  legendary: { accent: '#b3ecff', glow: 'rgba(179,236,255,0.55)', label: 'LÉGENDAIRE' },
  rare: { accent: '#01b3f4', glow: 'rgba(1,179,244,0.42)', label: 'RARE' },
};

const W = CARD_EXPORT_WIDTH;
const H = CARD_EXPORT_HEIGHT;
const LISERE = 11;
const NOTCH_Y = Math.round(H * 0.82);
const STAGE_H = 555;
const PAD = 43;
const CYAN = '#01b3f4';
const CYAN_HI = '#66d2f9';
const DIM = '#9fb3ba';
const TXT = '#eaf7fd';
const PANEL = 'rgba(4,28,38,0.85)';

/**
 * Liseré (stops du dégradé du contour), couleur d'accent et reflet, par rareté.
 * Métal brossé, verre cyan, holographique, nacre irisée (planche v2, partie 3).
 */
export const RARITY_LOOKS = {
  COMMON: {
    accent: '#9aa6b1',
    lisere: [
      [0, '#e2e7eb'],
      [0.22, '#8a96a1'],
      [0.45, '#4b5560'],
      [0.62, '#cfd6dc'],
      [0.82, '#6b7682'],
      [1, '#b9c2ca'],
    ],
    reflet: [
      [0.4, '#ffffff', 0],
      [0.5, '#ffffff', 0.1],
      [0.6, '#ffffff', 0],
    ],
  },
  EPIC: {
    accent: '#8567ff',
    lisere: [
      [0, '#efe9ff'],
      [0.28, '#8567ff'],
      [0.52, '#3b2a99'],
      [0.72, '#a991ff'],
      [1, '#66d2f9'],
    ],
    reflet: [
      [0.24, '#66d2f9', 0],
      [0.36, '#66d2f9', 0.16],
      [0.46, '#8567ff', 0.24],
      [0.51, '#ffffff', 0.2],
      [0.58, '#66d2f9', 0.16],
      [0.72, '#66d2f9', 0],
    ],
  },
  LEGENDARY: {
    accent: '#b3ecff',
    lisere: [
      [0, '#ffffff'],
      [0.17, '#b3ecff'],
      [0.33, '#66d2f9'],
      [0.5, '#8567ff'],
      [0.67, '#f0e9ff'],
      [0.83, '#99e1fb'],
      [1, '#ffffff'],
    ],
    reflet: [
      [0.18, '#b3ecff', 0],
      [0.32, '#b3ecff', 0.22],
      [0.44, '#8567ff', 0.28],
      [0.5, '#ffffff', 0.3],
      [0.58, '#99e1fb', 0.24],
      [0.66, '#8567ff', 0.2],
      [0.8, '#8567ff', 0],
    ],
  },
  RARE: {
    accent: '#01b3f4',
    lisere: [
      [0, '#d8f4ff'],
      [0.22, '#66d2f9'],
      [0.45, '#01b3f4'],
      [0.7, '#0a5a7d'],
      [1, '#66d2f9'],
    ],
    reflet: [
      [0.36, '#ffffff', 0],
      [0.45, '#ffffff', 0.16],
      [0.5, '#66d2f9', 0.14],
      [0.58, '#66d2f9', 0],
    ],
  },
};

/**
 * Les raretés d'avant (5 niveaux) retombent sur les 4 de la planche.
 * @param {string} rarity
 * @returns {string} COMMON, RARE, EPIC ou LEGENDARY
 */
export const normalizeRarity = (rarity) => {
  const r = String(rarity || '').toUpperCase();
  if (r === 'MOST_RARE' || r === 'ULTRA_RARE' || r === 'LEGENDARY') return 'LEGENDARY';
  return RARITY_LOOKS[r] ? r : 'COMMON';
};

/**
 * Le contour d'un billet à encoches : rectangle arrondi, deux demi-cercles creusés à 82 %.
 * @param {number} inset retrait depuis le bord de la carte
 * @param {number} radius rayon des coins
 * @param {number} notch rayon des encoches (centrées SUR le bord extérieur de la carte)
 * @returns {string} le chemin SVG
 */
export const ticketPath = (inset, radius, notch) => {
  const x0 = inset;
  const y0 = inset;
  const x1 = W - inset;
  const y1 = H - inset;
  const dy = Math.sqrt(Math.max(notch * notch - inset * inset, 0));
  return [
    `M${x0 + radius},${y0}`,
    `H${x1 - radius}`,
    `A${radius},${radius} 0 0 1 ${x1},${y0 + radius}`,
    `V${NOTCH_Y - dy}`,
    `A${notch},${notch} 0 0 0 ${x1},${NOTCH_Y + dy}`,
    `V${y1 - radius}`,
    `A${radius},${radius} 0 0 1 ${x1 - radius},${y1}`,
    `H${x0 + radius}`,
    `A${radius},${radius} 0 0 1 ${x0},${y1 - radius}`,
    `V${NOTCH_Y + dy}`,
    `A${notch},${notch} 0 0 0 ${x0},${NOTCH_Y - dy}`,
    `V${y0 + radius}`,
    `A${radius},${radius} 0 0 1 ${x0 + radius},${y0}`,
    'Z',
  ].join(' ');
};

const OUTER = ticketPath(0, 44, 34);
const INNER = ticketPath(LISERE, 33, 45);

const up = (value) => String(value ?? '').toUpperCase();
const estVide = (value) => ['', '-', '—', 'null', 'undefined'].includes(String(value ?? '').trim());
const font = (s, size, line = size * 1.2) => ({
  fontSize: size * s,
  includeFontPadding: false,
  lineHeight: line * s,
});
const initiales = (nom) => String(nom || '')
  .split(/[\s-]+/)
  .filter(Boolean)
  .slice(0, 3)
  .map((mot) => mot[0])
  .join('')
  .toUpperCase();

/**
 * Logo : l'image du club sur une plaque blanche, sinon le shield FoundClub aux initiales
 * (règle de ClubLogoMark / TeamShield, Q3 A).
 * @param {{ accent: string, name: string, s: number, size: number, uri?: string|null }} props
 * @returns {import('react').ReactElement}
 */
export function CardLogo({
  accent, name, s, size, uri,
}) {
  const cote = size * s;
  if (uri) {
    return (
      <View
        style={[
          styles.plaque,
          {
            borderColor: accent,
            borderRadius: 16 * s,
            borderWidth: 3.5 * s,
            height: cote,
            width: cote,
          },
        ]}
      >
        <Image
          resizeMode="contain"
          source={{ uri }}
          style={{ height: cote * 0.72, width: cote * 0.72 }}
        />
      </View>
    );
  }
  return (
    <View
      style={{
        alignItems: 'center',
        height: cote,
        justifyContent: 'center',
        width: cote,
      }}
    >
      <Image
        resizeMode="contain"
        source={SHIELD_IMAGE}
        style={[StyleSheet.absoluteFill, { tintColor: '#99e1fb' }]}
      />
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={{
          color: '#173844',
          fontFamily: 'Montserrat-Black',
          ...font(s, size * 0.29),
          marginTop: -4 * s,
        }}
      >
        {initiales(name)}
      </Text>
    </View>
  );
}

/**
 * Une case de la carte : son libellé et sa valeur, ou « + à compléter ».
 * @param {{ label: string, s: number, value?: string, manquant: string }} props
 * @returns {import('react').ReactElement}
 */
function Case({
  label, manquant, s, value,
}) {
  const vide = estVide(value);
  return (
    <View
      style={[
        styles.case,
        {
          borderRadius: 18 * s,
          paddingHorizontal: 19 * s,
          paddingVertical: 13 * s,
          ...(vide
            ? { borderColor: 'rgba(102,210,249,0.55)', borderStyle: 'dashed', borderWidth: 3.5 * s }
            : { backgroundColor: PANEL }),
        },
      ]}
    >
      <Text
        allowFontScaling={false}
        style={[styles.label, font(s, 22), { letterSpacing: 2.2 * s }]}
      >
        {label}
      </Text>
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={
          vide
            ? { color: CYAN_HI, fontFamily: 'Montserrat-Bold', ...font(s, 27, 40) }
            : { color: TXT, fontFamily: 'Montserrat-Black', ...font(s, 34, 40) }
        }
      >
        {vide ? manquant : up(value)}
      </Text>
    </View>
  );
}

/**
 * La carte, dessinée à la largeur demandée.
 * @param {object} props
 * @param {any} props.age
 * @param {any} props.categorie
 * @param {any} props.club
 * @param {any} props.clubLogoUrl
 * @param {any} props.equipe
 * @param {any} props.historique
 * @param {any} props.locked
 * @param {any} props.mode
 * @param {any} props.nationalite
 * @param {any} props.niveau
 * @param {any} props.nom
 * @param {any} props.numero
 * @param {any} props.photo
 * @param {any} props.poids
 * @param {any} props.poste
 * @param {any} props.prenom
 * @param {any} props.qrLabel
 * @param {any} props.qrValue
 * @param {any} props.rarity
 * @param {any} props.section
 * @param {any} props.sport
 * @param {any} props.statut
 * @param {any} props.taille
 * @param {any} props.ville
 * @param {any} props.width
 * @returns {import('react').ReactElement}
 */
function PlayerCardBase({
  age,
  categorie,
  club,
  clubLogoUrl = null,
  equipe,
  historique = [],
  locked = false,
  mode = 'image',
  nationalite,
  niveau,
  nom,
  numero,
  photo,
  poids,
  poste,
  prenom,
  qrLabel,
  qrValue,
  rarity = 'COMMON',
  section,
  sport,
  statut = 'DISPONIBLE',
  taille,
  ville,
  width,
}) {
  const { t } = useTranslation();
  const s = width / W;
  const h = width * (H / W);
  const ecran = mode === 'ecran';
  const rarete = normalizeRarity(rarity);
  const look = RARITY_LOOKS[rarete];
  const manquant = t('playerCard.missing', '+ à compléter');
  const rarityLabel = {
    COMMON: t('playerCard.rarity.common', 'COMMUNE'),
    EPIC: t('playerCard.rarity.epic', 'ÉPIQUE'),
    LEGENDARY: t('playerCard.rarity.legendary', 'LÉGENDAIRE'),
    RARE: t('playerCard.rarity.rare', 'RARE'),
  }[rarete];

  const cases = [
    [t('playerCard.info.age', 'ÂGE'), age],
    [t('playerCard.info.height', 'TAILLE'), taille],
    [t('playerCard.info.weight', 'POIDS'), poids],
    [t('playerCard.info.level', 'NIVEAU'), niveau],
    [t('playerCard.info.category', 'CATÉGORIE'), categorie],
    [t('playerCard.info.nationalityShort', 'NATION.'), nationalite],
  ].filter(([, v]) => v !== undefined && (ecran || !estVide(v)));
  const numeroVide = estVide(numero);
  const sportPoste = [sport, poste].filter((v) => !estVide(v)).join(' · ');
  const montrerVille = ville !== undefined && (ecran || !estVide(ville));
  const disponible = up(statut) === 'DISPONIBLE';
  const parcours = historique.slice(0, 3);

  return (
    <View collapsable={false} style={{ height: h, width }}>
      <Svg height={h} style={StyleSheet.absoluteFill} viewBox={`0 0 ${W} ${H}`} width={width}>
        <Defs>
          <SvgLinearGradient id="lisere" x1="0" x2="1" y1="0" y2="1">
            {look.lisere.map(([o, c]) => (
              <Stop key={o} offset={o} stopColor={c} />
            ))}
          </SvgLinearGradient>
          <SvgLinearGradient id="fond" x1="0.3" x2="0.7" y1="0" y2="1">
            <Stop offset={0} stopColor="#062836" />
            <Stop offset={0.7} stopColor="#021620" />
          </SvgLinearGradient>
          <SvgLinearGradient id="scene" x1="0" x2="0" y1="0" y2="1">
            <Stop offset={0} stopColor="#0e4258" />
            <Stop offset={1} stopColor="#052231" />
          </SvgLinearGradient>
          <RadialGradient cx="62%" cy="42%" id="halo" r="55%">
            <Stop offset={0} stopColor={look.accent} stopOpacity={0.45} />
            <Stop offset={1} stopColor={look.accent} stopOpacity={0} />
          </RadialGradient>
          <SvgLinearGradient id="reflet" x1="0" x2="1" y1="0.15" y2="0.85">
            {look.reflet.map(([o, c, a]) => (
              <Stop key={o} offset={o} stopColor={c} stopOpacity={a} />
            ))}
          </SvgLinearGradient>
          <ClipPath id="interieur">
            <Path d={INNER} />
          </ClipPath>
        </Defs>
        <Path d={OUTER} fill="url(#lisere)" />
        <G clipPath="url(#interieur)">
          <Rect fill="url(#fond)" height={H} width={W} x={0} y={0} />
          <Rect fill="url(#scene)" height={STAGE_H} width={W} x={0} y={LISERE} />
          <Rect fill="url(#halo)" height={STAGE_H} width={W} x={0} y={LISERE} />
          <SvgNested
            height={STAGE_H}
            preserveAspectRatio="none"
            viewBox="0 0 200 200"
            width={W - 2 * LISERE}
            x={LISERE}
            y={LISERE}
          >
            <CourtLines sport={sport} strokeWidth={1.6} />
          </SvgNested>
          {!numeroVide ? (
            <SvgText
              fill="none"
              fontFamily="Montserrat-Black"
              fontSize={400}
              opacity={0.75}
              stroke={look.accent}
              strokeWidth={4.5}
              transform="skewX(-8)"
              x={LISERE + 80}
              y={LISERE + 360}
            >
              {String(numero)}
            </SvgText>
          ) : null}
          <Rect fill="url(#lisere)" height={5} width={W} x={0} y={LISERE + STAGE_H - 5} />
          <Rect fill="url(#reflet)" height={H} width={W} x={0} y={0} />
        </G>
        <Line
          stroke={DIM}
          strokeDasharray="14 12"
          strokeOpacity={0.45}
          strokeWidth={4}
          x1={60}
          x2={W - 60}
          y1={NOTCH_Y}
          y2={NOTCH_Y}
        />
      </Svg>

      {/* La photo, à droite de la scène, fondue en bas */}
      <View
        style={{
          height: 516 * s,
          left: 396 * s,
          overflow: 'hidden',
          position: 'absolute',
          top: (LISERE + STAGE_H - 516) * s,
          width: 555 * s,
        }}
      >
        {photo && !locked ? (
          <Image resizeMode="cover" source={photo} style={StyleSheet.absoluteFill} />
        ) : null}
        {!photo && ecran && !locked ? (
          <View
            style={[
              styles.ajoutPhoto,
              {
                borderRadius: 24 * s,
                borderWidth: 4 * s,
                bottom: 40 * s,
                left: 100 * s,
                right: 60 * s,
                top: 100 * s,
              },
            ]}
          >
            <Text
              allowFontScaling={false}
              style={{
                color: CYAN_HI,
                fontFamily: 'Montserrat-Black',
                ...font(s, 28),
                letterSpacing: 2.8 * s,
              }}
            >
              {t('playerCard.addPhoto', '+ PHOTO')}
            </Text>
          </View>
        ) : null}
        {(!photo && !ecran) || locked ? (
          <View
            style={{
              bottom: 0,
              left: 120 * s,
              position: 'absolute',
              right: 40 * s,
              top: 90 * s,
            }}
          >
            <BackJerseyFallback accent={CYAN} name={nom} number={numeroVide ? '' : numero} />
          </View>
        ) : null}
        <LinearGradient
          colors={['rgba(5,34,49,0)', 'rgba(5,34,49,1)']}
          style={[styles.fondu, { height: 200 * s }]}
        />
      </View>

      {/* En haut : le logo FoundClub et la rareté */}
      <View
        style={[
          styles.rangee,
          {
            left: PAD * s,
            position: 'absolute',
            right: PAD * s,
            top: 40 * s,
          },
        ]}
      >
        <Image
          resizeMode="contain"
          source={LOGO_IMAGE}
          style={{ height: 44 * s, width: 44 * s * LOGO_RATIO }}
        />
        <View
          style={[
            styles.rangee,
            {
              backgroundColor: 'rgba(0,18,24,0.55)',
              borderColor: look.accent,
              borderRadius: 100 * s,
              borderWidth: 3.5 * s,
              gap: 11 * s,
              paddingHorizontal: 24 * s,
              paddingVertical: 9 * s,
            },
          ]}
        >
          <View
            style={{
              backgroundColor: look.accent,
              height: 17 * s,
              transform: [{ rotate: '45deg' }],
              width: 17 * s,
            }}
          />
          <Text
            allowFontScaling={false}
            style={{
              color: TXT,
              fontFamily: 'Montserrat-Black',
              ...font(s, 27),
              letterSpacing: 3.2 * s,
            }}
          >
            {rarityLabel}
          </Text>
        </View>
      </View>

      {/* Le nom, sur un fondu, en bas de la scène */}
      <LinearGradient
        colors={['rgba(2,22,32,0)', 'rgba(2,22,32,0.92)']}
        locations={[0, 0.55]}
        style={{
          left: PAD * s,
          paddingBottom: 24 * s,
          paddingTop: 80 * s,
          position: 'absolute',
          right: PAD * s,
          top: (LISERE + STAGE_H) * s - 300 * s,
        }}
      >
        {numeroVide && ecran ? (
          <Text
            allowFontScaling={false}
            style={{ color: CYAN, fontFamily: 'Montserrat-Black', ...font(s, 56, 62) }}
          >
            {t('playerCard.addNumber', '+ N°')}
          </Text>
        ) : null}
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={{
            color: TXT,
            fontFamily: 'Montserrat-Bold',
            ...font(s, 33, 40),
            letterSpacing: 10 * s,
          }}
        >
          {up(prenom)}
        </Text>
        <Text
          adjustsFontSizeToFit
          allowFontScaling={false}
          numberOfLines={1}
          style={{ color: TXT, fontFamily: 'Montserrat-Black', ...font(s, 68, 72) }}
        >
          {up(nom)}
        </Text>
        {sportPoste ? (
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={{
              color: CYAN_HI,
              fontFamily: 'Montserrat-Black',
              ...font(s, 30, 38),
              letterSpacing: 1.8 * s,
            }}
          >
            {up(sportPoste)}
          </Text>
        ) : null}
        {!estVide(section) ? (
          <Text
            allowFontScaling={false}
            style={{
              color: DIM,
              fontFamily: 'Montserrat-Bold',
              ...font(s, 25, 30),
              letterSpacing: s,
            }}
          >
            {section}
          </Text>
        ) : null}
      </LinearGradient>

      {/* Le corps : club, cases, parcours */}
      <View
        style={{
          gap: 15 * s,
          left: PAD * s,
          position: 'absolute',
          right: PAD * s,
          top: (LISERE + STAGE_H + 16) * s,
        }}
      >
        {!estVide(club) ? (
          <View
            style={[
              styles.rangee,
              {
                backgroundColor: PANEL,
                borderRadius: 24 * s,
                gap: 24 * s,
                justifyContent: 'flex-start',
                paddingHorizontal: 24 * s,
                paddingVertical: 14 * s,
              },
            ]}
          >
            <CardLogo accent={look.accent} name={club} s={s} size={80} uri={clubLogoUrl} />
            <View style={{ flex: 1 }}>
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={{ color: TXT, fontFamily: 'Montserrat-Black', ...font(s, 33, 40) }}
              >
                {up(club)}
              </Text>
              {!estVide(equipe) ? (
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={{ color: DIM, fontFamily: 'Montserrat-Bold', ...font(s, 26, 32) }}
                >
                  {equipe}
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}
        {cases.length ? (
          <View style={[styles.grille, { gap: 13 * s }]}>
            {cases.map(([label, valeur]) => (
              <View key={label} style={{ width: ((W - 2 * PAD - 26) / 3) * s }}>
                <Case label={label} manquant={manquant} s={s} value={valeur} />
              </View>
            ))}
          </View>
        ) : null}
        {parcours.length ? (
          <View style={[styles.rangee, { gap: 22 * s, justifyContent: 'flex-start' }]}>
            <Text
              allowFontScaling={false}
              style={[styles.label, font(s, 22), { letterSpacing: 2.6 * s }]}
            >
              {t('playerCard.historyTitle', 'PARCOURS')}
            </Text>
            {parcours.map((etape, rang) => (
              // eslint-disable-next-line react/no-array-index-key
              <View key={`${etape.club}-${rang}`} style={[styles.rangee, { gap: 11 * s }]}>
                <CardLogo
                  accent={look.accent}
                  name={etape.club}
                  s={s}
                  size={64}
                  uri={etape.logoUrl}
                />
                <Text
                  allowFontScaling={false}
                  style={{ color: TXT, fontFamily: 'Montserrat-Bold', ...font(s, 23, 26) }}
                >
                  {etape.periode}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {/* Le pied, sous la ligne de découpe : ville, statut, code QR */}
      <View
        style={[
          styles.rangee,
          {
            alignItems: 'flex-end',
            bottom: 40 * s,
            left: PAD * s,
            position: 'absolute',
            right: PAD * s,
          },
        ]}
      >
        <View style={{ flex: 1, gap: 12 * s }}>
          {montrerVille ? (
            <View>
              <Text
                allowFontScaling={false}
                style={[styles.label, font(s, 22), { letterSpacing: 2.6 * s }]}
              >
                {t('playerCard.info.city', 'VILLE')}
              </Text>
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={
                  estVide(ville)
                    ? { color: CYAN_HI, fontFamily: 'Montserrat-Bold', ...font(s, 27, 40) }
                    : { color: TXT, fontFamily: 'Montserrat-Black', ...font(s, 33, 40) }
                }
              >
                {estVide(ville) ? manquant : ville}
              </Text>
            </View>
          ) : null}
          {statut !== null && statut !== undefined ? (
            <View style={[styles.rangee, { gap: 12 * s, justifyContent: 'flex-start' }]}>
              <View
                style={{
                  backgroundColor: disponible ? '#27d6a3' : '#ff284f',
                  borderRadius: 10 * s,
                  height: 19 * s,
                  width: 19 * s,
                }}
              />
              <Text
                allowFontScaling={false}
                style={{
                  color: disponible ? '#27d6a3' : '#ff284f',
                  fontFamily: 'Montserrat-Black',
                  ...font(s, 29),
                  letterSpacing: 2.3 * s,
                }}
              >
                {disponible
                  ? t('playerCard.tagAvailable', 'DISPONIBLE')
                  : t('playerCard.tagUnavailable', 'INDISPONIBLE')}
              </Text>
            </View>
          ) : null}
        </View>
        {qrValue && !locked ? (
          <View style={{ alignItems: 'center', gap: 7 * s }}>
            <View style={{ backgroundColor: '#ffffff', borderRadius: 13 * s, padding: 9 * s }}>
              <QRCode
                backgroundColor="#ffffff"
                color="#001218"
                ecl="M"
                size={107 * s}
                value={qrValue}
              />
            </View>
            {qrLabel ? (
              <Text
                allowFontScaling={false}
                style={{ color: DIM, fontFamily: 'Montserrat-Bold', ...font(s, 19) }}
              >
                {qrLabel}
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={[styles.fc, { borderRadius: 13 * s, height: 125 * s, width: 125 * s }]}>
            <Text
              allowFontScaling={false}
              style={{ color: '#001218', fontFamily: 'Montserrat-Black', ...font(s, 44) }}
            >
              FC
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const PlayerCard = memo(PlayerCardBase);

export default PlayerCard;

const styles = StyleSheet.create({
  ajoutPhoto: {
    alignItems: 'center',
    borderColor: 'rgba(102,210,249,0.6)',
    borderStyle: 'dashed',
    justifyContent: 'center',
    position: 'absolute',
  },
  case: { minWidth: 0 },
  fc: { alignItems: 'center', backgroundColor: CYAN, justifyContent: 'center' },
  fondu: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  grille: { flexDirection: 'row', flexWrap: 'wrap' },
  label: { color: DIM, fontFamily: 'Montserrat-Bold' },
  plaque: { alignItems: 'center', backgroundColor: '#ffffff', justifyContent: 'center' },
  rangee: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
});
