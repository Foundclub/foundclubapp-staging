// @ts-nocheck
/**
 * CARTECODE (direction C « Terrain », Q9 C) — les lignes du terrain de SON sport, derrière la
 * photo de la carte. Un dessin par famille de sport, plus un générique. Coordonnées dans une
 * boîte 200 x 200 étirée sur la scène (comme la planche validée le 26/10).
 */
import {
  Circle, Line, Path, Rect,
} from 'react-native-svg';

/** @type {Record<string, (w: number) => import('react').ReactElement>} */
const COURTS = {
  basket: (w) => (
    <>
      <Rect
        fill="none"
        height={280}
        stroke="white"
        strokeOpacity={0.3}
        strokeWidth={w}
        width={180}
        x={10}
        y={-40}
      />
      <Rect
        fill="none"
        height={110}
        stroke="white"
        strokeOpacity={0.3}
        strokeWidth={w}
        width={60}
        x={70}
        y={-40}
      />
      <Circle
        cx={100}
        cy={70}
        fill="none"
        r={30}
        stroke="white"
        strokeOpacity={0.3}
        strokeWidth={w}
      />
      <Path
        d="M22 -40 V40 a80 80 0 0 0 156 0 V-40"
        fill="none"
        stroke="white"
        strokeOpacity={0.3}
        strokeWidth={w}
      />
      <Line
        fill="none"
        stroke="white"
        strokeOpacity={0.3}
        strokeWidth={w}
        x1={10}
        x2={190}
        y1={200}
        y2={200}
      />
    </>
  ),
  football: (w) => (
    <>
      <Rect
        fill="none"
        height={280}
        stroke="white"
        strokeOpacity={0.3}
        strokeWidth={w}
        width={180}
        x={10}
        y={-40}
      />
      <Line
        fill="none"
        stroke="white"
        strokeOpacity={0.3}
        strokeWidth={w}
        x1={10}
        x2={190}
        y1={100}
        y2={100}
      />
      <Circle
        cx={100}
        cy={100}
        fill="none"
        r={32}
        stroke="white"
        strokeOpacity={0.3}
        strokeWidth={w}
      />
      <Rect
        fill="none"
        height={70}
        stroke="white"
        strokeOpacity={0.3}
        strokeWidth={w}
        width={90}
        x={55}
        y={-40}
      />
      <Path
        d="M75 30 a28 28 0 0 0 50 0"
        fill="none"
        stroke="white"
        strokeOpacity={0.3}
        strokeWidth={w}
      />
      <Rect
        fill="none"
        height={70}
        stroke="white"
        strokeOpacity={0.3}
        strokeWidth={w}
        width={90}
        x={55}
        y={170}
      />
    </>
  ),
  generique: (w) => (
    <>
      <Rect
        fill="none"
        height={260}
        stroke="white"
        strokeOpacity={0.3}
        strokeWidth={w}
        width={170}
        x={15}
        y={-30}
      />
      <Line
        fill="none"
        stroke="white"
        strokeOpacity={0.3}
        strokeWidth={w}
        x1={15}
        x2={185}
        y1={100}
        y2={100}
      />
      <Circle
        cx={100}
        cy={100}
        fill="none"
        r={24}
        stroke="white"
        strokeOpacity={0.3}
        strokeWidth={w}
      />
    </>
  ),
  handball: (w) => (
    <>
      <Rect
        fill="none"
        height={280}
        stroke="white"
        strokeOpacity={0.3}
        strokeWidth={w}
        width={180}
        x={10}
        y={-40}
      />
      <Line
        fill="none"
        stroke="white"
        strokeOpacity={0.3}
        strokeWidth={w}
        x1={10}
        x2={190}
        y1={100}
        y2={100}
      />
      <Path
        d="M30 -40 V0 a70 70 0 0 0 140 0 V-40"
        fill="none"
        stroke="white"
        strokeOpacity={0.3}
        strokeWidth={w}
      />
      <Path
        d="M45 200 a55 55 0 0 1 110 0"
        fill="none"
        stroke="white"
        strokeDasharray="6 6"
        strokeOpacity={0.3}
        strokeWidth={w}
      />
    </>
  ),
  raquette: (w) => (
    <>
      <Rect
        fill="none"
        height={260}
        stroke="white"
        strokeOpacity={0.3}
        strokeWidth={w}
        width={160}
        x={20}
        y={-30}
      />
      <Line
        fill="none"
        stroke="white"
        strokeOpacity={0.3}
        strokeWidth={w}
        x1={40}
        x2={40}
        y1={-30}
        y2={230}
      />
      <Line
        fill="none"
        stroke="white"
        strokeOpacity={0.3}
        strokeWidth={w}
        x1={160}
        x2={160}
        y1={-30}
        y2={230}
      />
      <Line
        fill="none"
        stroke="white"
        strokeOpacity={0.3}
        strokeWidth={w}
        x1={40}
        x2={160}
        y1={60}
        y2={60}
      />
      <Line
        fill="none"
        stroke="white"
        strokeOpacity={0.3}
        strokeWidth={w}
        x1={100}
        x2={100}
        y1={60}
        y2={160}
      />
      <Line
        fill="none"
        stroke="white"
        strokeOpacity={0.3}
        strokeWidth={w}
        x1={40}
        x2={160}
        y1={160}
        y2={160}
      />
      <Line
        fill="none"
        stroke="white"
        strokeOpacity={0.3}
        strokeWidth={w * 1.5}
        x1={10}
        x2={190}
        y1={110}
        y2={110}
      />
    </>
  ),
  rugby: (w) => (
    <>
      <Rect
        fill="none"
        height={280}
        stroke="white"
        strokeOpacity={0.3}
        strokeWidth={w}
        width={180}
        x={10}
        y={-40}
      />
      <Line
        fill="none"
        stroke="white"
        strokeOpacity={0.3}
        strokeWidth={w}
        x1={10}
        x2={190}
        y1={100}
        y2={100}
      />
      <Line
        fill="none"
        stroke="white"
        strokeDasharray="8 6"
        strokeOpacity={0.3}
        strokeWidth={w}
        x1={10}
        x2={190}
        y1={55}
        y2={55}
      />
      <Line
        fill="none"
        stroke="white"
        strokeDasharray="8 6"
        strokeOpacity={0.3}
        strokeWidth={w}
        x1={10}
        x2={190}
        y1={145}
        y2={145}
      />
      <Line
        fill="none"
        stroke="white"
        strokeOpacity={0.3}
        strokeWidth={w}
        x1={10}
        x2={190}
        y1={10}
        y2={10}
      />
      <Line
        fill="none"
        stroke="white"
        strokeOpacity={0.3}
        strokeWidth={w}
        x1={10}
        x2={190}
        y1={190}
        y2={190}
      />
    </>
  ),
  volley: (w) => (
    <>
      <Rect
        fill="none"
        height={240}
        stroke="white"
        strokeOpacity={0.3}
        strokeWidth={w}
        width={150}
        x={25}
        y={-20}
      />
      <Line
        fill="none"
        stroke="white"
        strokeOpacity={0.3}
        strokeWidth={w * 1.5}
        x1={10}
        x2={190}
        y1={100}
        y2={100}
      />
      <Line
        fill="none"
        stroke="white"
        strokeOpacity={0.3}
        strokeWidth={w}
        x1={25}
        x2={175}
        y1={60}
        y2={60}
      />
      <Line
        fill="none"
        stroke="white"
        strokeOpacity={0.3}
        strokeWidth={w}
        x1={25}
        x2={175}
        y1={140}
        y2={140}
      />
    </>
  ),
};

/**
 * La famille de terrain d'un sport (libellé libre, ex. « Football », « Basket-ball »).
 * @param {string} sport
 * @returns {keyof typeof COURTS}
 */
export const courtFamily = (sport) => {
  const s = String(sport || '').toLowerCase();
  if (s.includes('foot') || s.includes('futsal')) return 'football';
  if (s.includes('basket')) return 'basket';
  if (s.includes('hand')) return 'handball';
  if (s.includes('rugby')) return 'rugby';
  if (s.includes('volley')) return 'volley';
  const raquettes = ['tennis', 'padel', 'badminton', 'squash', 'ping'];
  if (raquettes.some((r) => s.includes(r))) return 'raquette';
  return 'generique';
};

/**
 * Les lignes du terrain du sport, dans la boîte 200 x 200.
 * @param {{ sport?: string, strokeWidth?: number }} props
 * @returns {import('react').ReactElement}
 */
export function CourtLines({ sport, strokeWidth = 1.6 }) {
  return COURTS[courtFamily(sport)](strokeWidth);
}

export default CourtLines;
