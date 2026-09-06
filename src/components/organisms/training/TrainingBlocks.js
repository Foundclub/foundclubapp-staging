import { memo, useMemo } from 'react';
import {
  Linking, ScrollView, Text, View,
} from 'react-native';
import { SvgXml } from 'react-native-svg';

import useTheme from '@/theme/themeContext';

/**
 * LE RENDU DU CONTENU D'UNE FICHE — blocs typés, sans aucune dépendance de rendu.
 *
 * 🔎 POURQUOI DES BLOCS ET PAS DU MARKDOWN : le contenu vient du guide de terrain
 * (des tableaux de distances, des listes de critères, des schémas cotés). Un
 * rendu markdown obligerait à embarquer un analyseur et rendrait mal les tableaux.
 * Ici, chaque bloc porte son type et se rend nativement : `p`, `ul`, `ol`, `table`,
 * `svg`, `note`. Ajouter un type, c'est ajouter une branche, pas une bibliothèque.
 *
 * Le gras est écrit `**comme ceci**` dans les textes et rendu par `RichText`.
 */

/**
 * Découpe un texte en segments gras / normaux, sans expression régulière gourmande.
 * @param {string} text texte brut où le gras est écrit `**comme ceci**`
 * @returns {Array<{bold: boolean, key: string, value: string}>} segments à rendre
 */
export const splitBold = (text) => {
  const parts = String(text || '').split('**');
  return parts.map((value, index) => ({
    bold: index % 2 === 1,
    key: `${index}-${value.slice(0, 8)}`,
    value,
  }));
};

/**
 * Un texte ou le gras est ecrit `**comme ceci**`, rendu en segments imbriques.
 * @param {object} props
 * @param {string} props.color couleur du segment en gras
 * @param {any} props.style style applique au texte entier
 * @param {string} props.text texte brut, marqueurs de gras compris
 * @returns {React.ReactElement} le texte rendu
 */
function RichTextBase({ color, style, text }) {
  const segments = useMemo(() => splitBold(text), [text]);
  return (
    <Text style={style}>
      {segments.map(({ bold, key, value }) => (
        <Text key={key} style={bold ? { color, fontWeight: '700' } : undefined}>{value}</Text>
      ))}
    </Text>
  );
}

/**
 * Le rendu de gras, exporte pour les textes qui ne sont PAS des blocs.
 *
 * 🪤 DEFAUT VU A L ECRAN LE 2026-09-06 : le chapeau d une journee, son
 * accroche et ses reperes sortaient du serveur avec leurs `**` VISIBLES
 * (« **≈ 160 min** » s affichait tel quel). Ces trois champs ne passent pas
 * par `TrainingBlocks` — ils avaient donc besoin du meme rendu, sans ses
 * espacements. C est exactement ce que fait `RichText`.
 */
const RichText = memo(RichTextBase);

export { RichText };

/**
 * Une entrée de liste : son marqueur (numéro ou point) puis son texte, alignés en colonnes.
 * @param {object} props
 * @param {Record<string, any>} props.Colors palette de couleurs du thème
 * @param {Record<string, any>} props.Fonts styles typographiques du thème
 * @param {number} props.index rang de l'entrée dans la liste, à partir de 0
 * @param {boolean} props.ordered vrai pour une liste numérotée, faux pour des points
 * @param {Record<string, any>} props.Spaces échelle d'espacement du thème
 * @param {string} props.text contenu de l'entrée, gras compris
 * @returns {React.ReactElement} la ligne de liste rendue
 */
function Bullet({
  Colors, Fonts, index, ordered, Spaces, text,
}) {
  return (
    <View style={[{ flexDirection: 'row' }, Spaces.gap[8]]}>
      <Text style={[Fonts.p2, { color: Colors.primary500, minWidth: 18 }]}>
        {ordered ? `${index + 1}.` : '•'}
      </Text>
      <RichText
        color={Colors.neutral00}
        style={[Fonts.p2, { color: Colors.neutral200, flex: 1 }]}
        text={text}
      />
    </View>
  );
}

/**
 * Un tableau défile horizontalement : une chronologie a 4 colonnes, l'écran en tient 2.
 * @param {object} props
 * @param {Record<string, any>} props.block bloc de type `table`, portant `head` et `rows`
 * @param {Record<string, any>} props.Colors palette de couleurs du thème
 * @param {Record<string, any>} props.Fonts styles typographiques du thème
 * @returns {React.ReactElement} le tableau, dans son défilement horizontal
 */
function BlockTable({ block, Colors, Fonts }) {
  const head = Array.isArray(block.head) ? block.head : [];
  const rows = Array.isArray(block.rows) ? block.rows : [];
  const columns = Math.max(head.length, ...rows.map((r) => r.length), 1);
  const cellWidth = columns <= 2 ? 160 : 132;
  const columnIndexes = Array.from({ length: columns }, (_, i) => i);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{
        borderColor: Colors.neutral600, borderRadius: 8, borderWidth: 1, overflow: 'hidden',
      }}
      >
        {head.length > 0 && (
          <View style={{ backgroundColor: Colors.neutral700, flexDirection: 'row' }}>
            {head.map((cell) => (
              <View key={`h-${cell}`} style={{ padding: 8, width: cellWidth }}>
                <RichText
                  color={Colors.neutral00}
                  style={[Fonts.captionBold, { color: Colors.neutral100 }]}
                  text={cell}
                />
              </View>
            ))}
          </View>
        )}
        {rows.map((row, rowIndex) => (
          <View
            key={`r-${row.join('|').slice(0, 40)}`}
            style={{
              backgroundColor: rowIndex % 2 ? Colors.neutral800 : 'transparent',
              borderTopColor: Colors.neutral600,
              borderTopWidth: 1,
              flexDirection: 'row',
            }}
          >
            {columnIndexes.map((cellIndex) => (
              <View key={`c-${cellIndex}`} style={{ padding: 8, width: cellWidth }}>
                <RichText
                  color={Colors.neutral00}
                  style={[Fonts.caption, { color: Colors.neutral200 }]}
                  text={row[cellIndex] || ''}
                />
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

/**
 * Un schéma coté. Le SVG vient du serveur : s'il est illisible, on ne casse pas l'écran.
 * @param {object} props
 * @param {Record<string, any>} props.block bloc de type `svg`, portant `svg` et `caption`
 * @param {Record<string, any>} props.Colors palette de couleurs du thème
 * @param {Record<string, any>} props.Fonts styles typographiques du thème
 * @param {Record<string, any>} props.Spaces échelle d'espacement du thème
 * @returns {React.ReactElement|null} le schéma et sa légende, ou rien si le SVG est inutilisable
 */
function BlockSvg({
  block, Colors, Fonts, Spaces,
}) {
  const xml = typeof block.svg === 'string' && block.svg.includes('<svg') ? block.svg : null;
  if (!xml) return null;
  return (
    <View style={Spaces.gap[4]}>
      <View style={{ backgroundColor: Colors.neutral00, borderRadius: 8, padding: 4 }}>
        <SvgXml width="100%" xml={xml} />
      </View>
      {Boolean(block.caption) && (
        <RichText
          color={Colors.neutral200}
          style={[Fonts.caption, { color: Colors.neutral300 }]}
          text={block.caption}
        />
      )}
    </View>
  );
}

const TONE_COLORS = {
  info: 'primary500',
  ok: 'success500',
  warn: 'gold500',
};

/**
 * Un encart mis en avant (conseil, avertissement, réussite), coloré selon son ton.
 * @param {object} props
 * @param {Record<string, any>} props.block bloc de type `note`, portant `tone` et `text`
 * @param {Record<string, any>} props.Colors palette de couleurs du thème
 * @param {Record<string, any>} props.Fonts styles typographiques du thème
 * @returns {React.ReactElement} l'encart rendu, barre de couleur à gauche
 */
function BlockNote({ block, Colors, Fonts }) {
  const ton = /** @type {keyof TONE_COLORS} */ (block.tone);
  const accent = Colors[TONE_COLORS[ton] || 'primary500'];
  return (
    <View
      style={{
        backgroundColor: Colors.neutral800,
        borderLeftColor: accent,
        borderLeftWidth: 3,
        borderRadius: 6,
        padding: 10,
      }}
    >
      <RichText
        color={Colors.neutral00}
        style={[Fonts.p3, { color: Colors.neutral200 }]}
        text={block.text}
      />
    </View>
  );
}

/**
 * Rend le contenu d'une fiche d'entraînement en aiguillant chaque bloc vers son type.
 * @param {object} props
 * @param {Array<Record<string, any>>} props.blocks blocs typés venus du serveur
 * @param {boolean} [props.compact] resserre les espacements (usage en accordéon)
 * @returns {React.ReactElement|null} la suite de blocs rendus, ou rien si la liste est vide
 */
function TrainingBlocks({ blocks, compact = false }) {
  const { Colors, Fonts, Spaces } = useTheme();
  const list = Array.isArray(blocks) ? blocks : [];
  if (!list.length) return null;

  return (
    <View style={compact ? Spaces.gap[8] : Spaces.gap[12]}>
      {list.map((block, index) => {
        const key = `${block?.type}-${index}`;
        if (!block?.type) return null;

        if (block.type === 'p') {
          return (
            <RichText
              color={Colors.neutral00}
              key={key}
              style={[Fonts.p2, { color: Colors.neutral200 }]}
              text={block.text}
            />
          );
        }

        if (block.type === 'ul' || block.type === 'ol') {
          const items = Array.isArray(block.items) ? block.items : [];
          return (
            <View key={key} style={Spaces.gap[8]}>
              {items.map((item, itemIndex) => (
                <Bullet
                  Colors={Colors}
                  Fonts={Fonts}
                  index={itemIndex}
                  key={`${key}-${String(item).slice(0, 32)}`}
                  ordered={block.type === 'ol'}
                  Spaces={Spaces}
                  text={item}
                />
              ))}
            </View>
          );
        }

        if (block.type === 'table') {
          return <BlockTable block={block} Colors={Colors} Fonts={Fonts} key={key} />;
        }
        if (block.type === 'svg') {
          return (
            <BlockSvg
              block={block}
              Colors={Colors}
              Fonts={Fonts}
              key={key}
              Spaces={Spaces}
            />
          );
        }
        if (block.type === 'note') {
          return <BlockNote block={block} Colors={Colors} Fonts={Fonts} key={key} />;
        }

        return null;
      })}
    </View>
  );
}

/**
 * Les liens « pour voir le geste » : ouverts dans le navigateur, jamais dans l'app.
 * @param {object} props
 * @param {Array<{url: string, titre?: string, title?: string}>} props.links liens de la fiche
 * @returns {React.ReactElement|null} la liste de liens, ou rien si aucun lien n'est valide
 */
export function TrainingLinks({ links }) {
  const { Colors, Fonts, Spaces } = useTheme();
  const list = Array.isArray(links) ? links.filter((link) => /^https?:\/\//.test(link?.url || '')) : [];
  if (!list.length) return null;

  return (
    <View style={Spaces.gap[8]}>
      {list.map((link) => (
        <Text
          key={link.url}
          onPress={() => Linking.openURL(link.url).catch(() => {})}
          style={[Fonts.p3, { color: Colors.primary400, textDecorationLine: 'underline' }]}
        >
          {link.titre || link.title || link.url}
        </Text>
      ))}
    </View>
  );
}

export default memo(TrainingBlocks);
