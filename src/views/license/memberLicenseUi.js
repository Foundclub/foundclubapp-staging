// S9, vague S — LES BRIQUES VISUELLES DU PARCOURS MEMBRE.
//
// 🧱 UN SEUL GABARIT DE LIGNE DANS TOUTE LA PAGE (regle du pack) : rayon 12,
// padding 12/14, glyphe 20 px, titre 13/700, sous-titre 11/400, montant
// 14/700. Echeances, pieces et paiements le PARTAGENT — c est `MemberRow`.
// Ecrire trois lignes qui se ressemblent a 90 % est exactement ce que la
// refonte supprime.
//
// 🎨 AUCUN HEX, AUCUN rgba() : les teintes passent par `withAlpha` (le seul
// moyen legitime de teinter un jeton, cf. `scripts/verify-theme-contract.js`).
//
// 📏 LA RAMPE `Spaces` A DES TROUS ASSUMES (6, 10, 14, 20, 28, 36, 48 sont
// ABSENTS — `theme/spaces.js:15`). `Spaces.gap[10]` rendrait `undefined` et
// React Native l ignorerait EN SILENCE. Les mesures du pack qui tombent dans
// un trou sont donc ecrites en nombre, jamais en jeton fantome.

import { Pressable, Text, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';

import {
  getMemberStatusLabel,
  getMemberStatusTone,
  isDrawnMemberStatus,
} from './memberLicenseModel';

export const memberRadius = {
  card: 16,
  hero: 20,
  pill: 999,
  row: 12,
  sheet: 24,
  tile: 10,
};

export const memberSpacing = {
  cardGap: 10,
  cardPadding: 14,
  page: 16,
  rowGap: 8,
  rowPaddingH: 14,
  rowPaddingV: 12,
  section: 24,
  target: 44,
};

// ── Typographie : toujours DERIVEE d un style du theme ──────────────────────
// Le pack demande des tailles que la rampe n a pas (40, 22, 15, 13, 11 en
// Black). On garde la FAMILLE du theme et on ne change que la taille : ecrire
// `fontFamily: 'Montserrat-Black'` en dur ferait diverger l app du theme le
// jour ou la police change.
/**
 * Les styles de texte du pack, derives du theme.
 * @param {any} Fonts la table de polices du theme
 * @returns {any} les styles nommes par le pack
 */
export const memberType = (Fonts) => ({
  amount: { ...Fonts.p2Bold },
  amountStrong: { ...Fonts.p2Black },
  clubName: { ...Fonts.p3Black, fontSize: 13, lineHeight: 18 },
  headline: {
    ...Fonts.h1Black, fontSize: 40, letterSpacing: -1, lineHeight: 46,
  },
  keyLabel: { ...Fonts.p3 },
  keyValue: { ...Fonts.p3Bold },
  listAmount: { ...Fonts.h2Black, fontSize: 22, lineHeight: 26 },
  meta: { ...Fonts.small },
  metaBold: { ...Fonts.label },
  overline: {
    ...Fonts.p3Black, fontSize: 11, letterSpacing: 2, lineHeight: 16,
  },
  rowState: { ...Fonts.small },
  rowTitle: { ...Fonts.p3Bold, fontSize: 13, lineHeight: 18 },
  screenTitle: { ...Fonts.p2Bold, fontSize: 15, lineHeight: 20 },
  statusWord: {
    ...Fonts.p3Black, fontSize: 11, letterSpacing: 1, lineHeight: 14,
  },
  subtitle: { ...Fonts.p3, fontSize: 13, lineHeight: 18 },
  title: { ...Fonts.p2Bold },
  totalAmount: { ...Fonts.h2Black },
});

/**
 * LA BARRE DU HAUT — ce qui manquait entierement (defaut 12 du pack).
 *
 * Un retour, un titre, un menu. Le carre de droite est TOUJOURS reserve, meme
 * sans menu : sans lui le titre centre se decale de 22 px.
 * @param {object} props
 * @param {() => void} props.onBack
 * @param {string} props.title
 * @param {() => void} [props.onMenu]
 * @returns {import('react').ReactElement}
 */
export function MemberTopBar({ onBack, onMenu, title }) {
  const { Colors, Fonts } = useTheme();
  const type = memberType(Fonts);

  return (
    <View style={{
      alignItems: 'center',
      flexDirection: 'row',
      height: 52,
      marginBottom: 8,
    }}
    >
      <Pressable
        accessibilityLabel="Retour"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onBack}
        style={{
          alignItems: 'center',
          borderColor: Colors.primary500,
          borderRadius: memberRadius.row,
          borderWidth: 1.5,
          height: memberSpacing.target,
          justifyContent: 'center',
          width: memberSpacing.target,
        }}
      >
        <GlyphIcon color={Colors.primary500} name="chevronLeft" size={20} />
      </Pressable>
      <Text
        numberOfLines={1}
        style={[type.screenTitle, Fonts.neutral00, { flex: 1, textAlign: 'center' }]}
      >
        {title}
      </Text>
      {onMenu ? (
        <Pressable
          accessibilityLabel="Plus d options"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onMenu}
          style={{
            alignItems: 'center',
            height: memberSpacing.target,
            justifyContent: 'center',
            width: memberSpacing.target,
          }}
        >
          <GlyphIcon color={Colors.neutral200} name="dotsVertical" size={20} />
        </Pressable>
      ) : (
        // Le carre d equilibre : il ne se voit pas, mais sans lui le titre
        // centre ne l est plus.
        <View style={{ height: memberSpacing.target, width: memberSpacing.target }} />
      )}
    </View>
  );
}

/**
 * LE MOT DU STATUT — jamais une couleur seule (D6 du pack).
 *
 * ⛔ Rend `null` sur un statut que le pack ne dessine pas (`not_due`,
 * `refunded`, `disputed`) : inventer un mot pour eux serait inventer une
 * information.
 * @param {object} props
 * @param {string} props.status
 * @returns {import('react').ReactElement | null}
 */
export function MemberStatusPill({ status }) {
  const { Colors, Fonts } = useTheme();
  if (!isDrawnMemberStatus(status)) return null;
  const tone = getMemberStatusTone(Colors, status);
  const type = memberType(Fonts);
  // 🔴 « EN RETARD » s ecrit en `error100` sur fond `error500` a 18 % — 8,9:1.
  // Ecrit en `error500` plein il tombait a 3,2:1 : meme correctif que la
  // pastille « Absent » du pack evenement.
  const ink = status === 'overdue' ? Colors.error100 : tone;

  return (
    <View style={{
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: withAlpha(tone, status === 'overdue' ? 0.18 : 0.16),
      borderRadius: memberRadius.pill,
      flexDirection: 'row',
      gap: 6,
      minHeight: 26,
      paddingHorizontal: 12,
      paddingVertical: 5,
    }}
    >
      <View style={{
        backgroundColor: ink,
        borderRadius: memberRadius.pill,
        height: 6,
        width: 6,
      }}
      />
      <Text style={[type.statusWord, { color: ink }]}>
        {getMemberStatusLabel(status).toUpperCase()}
      </Text>
    </View>
  );
}

/**
 * LA BARRE DE PROGRESSION.
 *
 * ⛔ Absente quand il n y a rien a progresser (cotisation exemptee) — l appelant
 * ne la monte alors pas du tout. Vide n est pas absent : sur `pending` la barre
 * reste, a zero.
 * @param {object} props
 * @param {number} props.ratio part payee, entre 0 et 1
 * @param {number} [props.height]
 * @returns {import('react').ReactElement}
 */
export function MemberProgressBar({ height = 8, ratio }) {
  const { Colors } = useTheme();
  const safeRatio = Math.min(1, Math.max(0, Number(ratio) || 0));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ max: 100, min: 0, now: Math.round(safeRatio * 100) }}
      style={{
        backgroundColor: Colors.primary800,
        borderRadius: memberRadius.pill,
        height,
        overflow: 'hidden',
        width: '100%',
      }}
    >
      <View style={{
        backgroundColor: Colors.success500,
        borderRadius: memberRadius.pill,
        height: '100%',
        width: `${safeRatio * 100}%`,
      }}
      />
    </View>
  );
}

/**
 * LE SURTITRE D UNE SECTION — 11/900 majuscules, letter-spacing 2.
 * @param {object} props
 * @param {string} props.title
 * @param {string} [props.hint] compteur discret a droite (« 3 échéances · 200,00 € »)
 * @returns {import('react').ReactElement}
 */
export function MemberOverline({ hint, title }) {
  const { Colors, Fonts } = useTheme();
  const type = memberType(Fonts);

  return (
    <View style={{
      alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'space-between',
    }}
    >
      <Text style={[type.overline, { color: Colors.neutral500 }]}>{title.toUpperCase()}</Text>
      {hint ? <Text style={[type.meta, Fonts.neutral300]}>{hint}</Text> : null}
    </View>
  );
}

/**
 * LA TUILE DE GLYPHE — 32 px, rayon 10, fond a 16 % de la couleur d etat.
 * @param {object} props
 * @param {string} props.glyph
 * @param {string} props.tone
 * @param {number} [props.size]
 * @returns {import('react').ReactElement}
 */
export function MemberTile({ glyph, size = 32, tone }) {
  return (
    <View style={{
      alignItems: 'center',
      backgroundColor: withAlpha(tone, 0.16),
      borderRadius: memberRadius.tile,
      height: size,
      justifyContent: 'center',
      width: size,
    }}
    >
      <GlyphIcon color={tone} name={glyph} size={Math.round(size * 0.56)} />
    </View>
  );
}

/**
 * L ECUSSON DU CLUB — 26 px, rayon 8, fond blanc a 6 %.
 *
 * 🔎 MESURE DU 25/08 : `/licenses/me` peuple `club` SANS son logo (admin
 * `license.ts:3381`, populate a un niveau). On n affiche donc pas une image
 * qui n arriverait jamais : les initiales sont la vraie donnee disponible.
 * @param {object} props
 * @param {string} props.name
 * @param {number} [props.size]
 * @returns {import('react').ReactElement}
 */
export function MemberClubCrest({ name, size = 26 }) {
  const { Colors, Fonts } = useTheme();
  const initials = String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase() || '?';

  return (
    <View style={{
      alignItems: 'center',
      backgroundColor: withAlpha(Colors.neutral00, 0.06),
      borderRadius: 8,
      height: size,
      justifyContent: 'center',
      width: size,
    }}
    >
      <Text style={[Fonts.p4Bold, Fonts.neutral200]}>{initials}</Text>
    </View>
  );
}

/**
 * LE GABARIT DE LIGNE UNIQUE — echeances, pieces et paiements le partagent.
 *
 * Rayon 12, padding 12/14, glyphe 20 px, titre 13/700, etat 11/400, montant
 * 14/700 (900 sur la ligne active).
 * @param {object} props
 * @param {string} [props.glyph]
 * @param {string} [props.glyphColor]
 * @param {string} props.title
 * @param {string} [props.state] la ligne d etat, sous le titre
 * @param {string} [props.stateColor]
 * @param {string} [props.amount] deja mis en forme par l appelant
 * @param {boolean} [props.emphasis] montant en 900 et bordure cyan (ligne active)
 * @param {boolean} [props.dashed] bordure tiretee : declare, pas confirme
 * @param {string} [props.background]
 * @param {string} [props.borderColor]
 * @param {boolean} [props.muted] tout en gris : une ligne a venir n appelle aucun geste
 * @param {() => void} [props.onPress]
 * @param {import('react').ReactNode} [props.trailing] la cible de 44 px a droite
 * @returns {import('react').ReactElement}
 */
export function MemberRow({
  amount,
  background,
  borderColor,
  dashed,
  emphasis,
  glyph,
  glyphColor,
  muted,
  onPress,
  state,
  stateColor,
  title,
  trailing,
}) {
  const { Colors, Fonts } = useTheme();
  const type = memberType(Fonts);
  const Wrapper = onPress ? Pressable : View;
  const resolvedBorder = borderColor
    || (emphasis ? withAlpha(Colors.primary500, 0.32) : withAlpha(Colors.neutral00, 0.08));

  return (
    <Wrapper
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      style={{
        alignItems: 'center',
        backgroundColor: background || Colors.primary800,
        borderColor: resolvedBorder,
        borderRadius: memberRadius.row,
        borderStyle: dashed ? 'dashed' : 'solid',
        borderWidth: 1,
        flexDirection: 'row',
        gap: 12,
        minHeight: 62,
        paddingHorizontal: memberSpacing.rowPaddingH,
        paddingVertical: memberSpacing.rowPaddingV,
      }}
    >
      {glyph ? (
        <GlyphIcon color={glyphColor || Colors.neutral300} name={glyph} size={20} />
      ) : null}
      <View style={{ flex: 1, gap: 4 }}>
        <Text
          numberOfLines={2}
          style={[type.rowTitle, muted ? Fonts.neutral400 : Fonts.neutral00]}
        >
          {title}
        </Text>
        {state ? (
          <Text style={[type.rowState, stateColor ? { color: stateColor } : Fonts.neutral300]}>
            {state}
          </Text>
        ) : null}
      </View>
      {amount ? (
        <Text style={[
          emphasis ? type.amountStrong : type.amount,
          muted ? Fonts.neutral400 : Fonts.neutral00,
        ]}
        >
          {amount}
        </Text>
      ) : null}
      {trailing || null}
    </Wrapper>
  );
}

/**
 * LA CIBLE DE 44 PX A DROITE D UNE LIGNE — telecharger un recu, ouvrir une
 * piece. C est un geste, pas une navigation : il ne quitte pas l ecran.
 * @param {object} props
 * @param {string} props.glyph
 * @param {string} props.label
 * @param {() => void} props.onPress
 * @returns {import('react').ReactElement}
 */
export function MemberRowAction({ glyph, label, onPress }) {
  const { Colors } = useTheme();

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={{
        alignItems: 'center',
        backgroundColor: withAlpha(Colors.primary500, 0.14),
        borderRadius: memberRadius.row,
        height: memberSpacing.target,
        justifyContent: 'center',
        width: memberSpacing.target,
      }}
    >
      <GlyphIcon color={Colors.primary500} name={glyph} size={20} />
    </Pressable>
  );
}

/**
 * LE TABLEAU CLE/VALEUR de la campagne — rangees de 40 px, filet blanc a 6 %.
 *
 * ⛔ Une rangee sans valeur NE SE DESSINE PAS. « Date limite : — » est la meme
 * non-information que « Non definie » : l appelant passe `null` et la ligne
 * disparait.
 * @param {object} props
 * @param {{label: string, value: string}[]} props.rows
 * @returns {import('react').ReactElement | null}
 */
export function MemberKeyValueTable({ rows }) {
  const { Colors, Fonts } = useTheme();
  const type = memberType(Fonts);
  const visible = (rows || []).filter((row) => row && row.value);
  if (!visible.length) return null;

  return (
    <View style={{
      backgroundColor: Colors.primary700,
      borderRadius: memberRadius.card,
      paddingHorizontal: memberSpacing.cardPadding,
    }}
    >
      {visible.map((row, index) => (
        <View
          key={row.label}
          style={{
            alignItems: 'center',
            borderTopColor: withAlpha(Colors.neutral00, 0.06),
            borderTopWidth: index === 0 ? 0 : 1,
            flexDirection: 'row',
            gap: 12,
            justifyContent: 'space-between',
            minHeight: 40,
            paddingVertical: 11,
          }}
        >
          <Text style={[type.keyLabel, Fonts.neutral300]}>{row.label}</Text>
          <Text
            numberOfLines={2}
            style={[type.keyValue, Fonts.neutral00, { flex: 1, textAlign: 'right' }]}
          >
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
}
