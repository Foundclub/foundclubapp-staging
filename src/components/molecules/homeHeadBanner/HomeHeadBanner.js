import {
  Image, Pressable, Text, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

// D72 — LE BANDEAU DE TETE DE L'ACCUEIL (pack accueil, tache 2).
//
// Il se pose entre l'en-tete et le bloc titre « ACCUEIL / ROLE », et porte ce
// qui ATTEND la personne aujourd'hui. Deux variantes seulement :
//   · « liste »    (Dirigeant, Super admin) : des files, une ligne chacune ;
//   · « evenement » (Entraineur, Joueur)    : la prochaine echeance, et son geste.
//
// ⛔ REGLE QUI PRIME SUR TOUTES LES AUTRES : un bandeau vide DISPARAIT
// entierement, etiquette comprise. Pas de cadre vide, pas de « rien a signaler ».
// C'est ce qui permet a un compte sans rien en attente de retrouver EXACTEMENT
// l'accueil d'avant le lot (critere de recette 3).
//
// 🎨 Deux ecarts assumes avec le pack, faute de pouvoir ajouter une dependance :
//   · le fond est un aplat teinte, pas un `linear-gradient` (aucune bibliotheque
//     de degrade n'est installee, et en ajouter une pour un fond serait cher) ;
//   · les trois gris du pack (chevron, valeur, libelle) n'existent dans AUCUN
//     jeton : ce sont `neutral600` / `neutral300` / `neutral100`, les plus
//     proches. Les autres couleurs du pack tombent au jeton exact.

const EMPTY_LIST = [];

// T02 — LES VARIANTES DE BOUTON QUE LE BANDEAU SAIT PORTER.
// `secondaryLight` marque LA REPONSE DEJA DONNEE : c'est le motif que la fiche de
// l'evenement emploie deja pour le meme sens (`EventAnswerButtons.js`, la rangee
// « Présent » / « Absent » des journees de stage), ou le choix en cours passe en
// clair et se fige.
const ACTION_VARIANTS = {
  secondary: 'Secondary',
  secondaryLight: 'SecondaryLight',
};

/**
 * Une ligne de la variante « liste ».
 * @typedef {object} HomeHeadBannerLine
 * @property {boolean} [hasAlert] - Du retard : point rouge colle au glyphe.
 * @property {string} icon - Clef d'image du theme.
 * @property {string} key
 * @property {string} label
 * @property {string} [notice] - MARQUE-MAIRIE : « En attente de la mairie », sous le libelle.
 * @property {() => void} [onPress]
 * @property {string} [tone] - Couleur du glyphe. Defaut : le `tone` du bandeau.
 * @property {string} [value] - Valeur affichee a droite.
 */

/**
 * A05 — la reponse qui vient de partir, ecrite sous les boutons :
 * « ✓ <label> <answerLabel> ».
 * @typedef {object} HomeHeadBannerConfirmation
 * @property {'present' | 'absent'} answer - La reponse envoyee.
 * @property {string} answerLabel - Son mot, celui du bouton (« Présent », « Absent »).
 * @property {string} label - Le debut de la ligne (« Réponse envoyée : »).
 */

/**
 * Bandeau de tete de l'accueil.
 * @param {object} props
 * @param {{ disabled?: boolean, isLoading?: boolean, key: string, label: string,
 *   onPress?: () => void, variant?: string }[]} [props.actions]
 *   Boutons pleine largeur de la variante « evenement ».
 * @param {HomeHeadBannerConfirmation} [props.confirmation] - A05, sous les boutons.
 * @param {string} props.label - Etiquette au-dessus du cadre (ex. « Aujourd'hui »).
 * @param {HomeHeadBannerLine[]} [props.lines] - Variante « liste ».
 * @param {string} [props.notice] - Variante « evenement » : MARQUE-MAIRIE, l echeance attend une
 *   decision (« En attente de la mairie »), sous le sous-titre.
 * @param {string} [props.subtitle] - Variante « evenement ».
 * @param {{ key: string, label: string, tone?: string, value: string }[]} [props.tiles]
 *   Variante « evenement » : tuiles chiffrees cote a cote (entraineur).
 * @param {string} [props.title] - Variante « evenement » (ex. « Samedi 15 · 15:00 »).
 * @param {string} [props.titleSuffix] - Nom d'equipe, en accent, a la suite du titre.
 * @param {string} [props.tone] - Couleur d'accent du bandeau. Defaut : primary500.
 * @param {'event' | 'list'} [props.variant]
 * @returns {import('react').ReactElement | null}
 */
function HomeHeadBanner({
  actions = EMPTY_LIST,
  confirmation,
  label,
  lines = EMPTY_LIST,
  notice,
  subtitle,
  tiles = EMPTY_LIST,
  title,
  titleSuffix,
  tone,
  variant = 'list',
}) {
  const {
    Alignments,
    Colors,
    Fonts,
    Images,
    Spaces,
  } = useTheme();

  const resolvedTone = tone || Colors.primary500;
  // A05 — seul le MOT « Absent » passe en rouge ; tout le reste de la ligne est vert.
  const couleurDuMot = confirmation?.answer === 'absent' ? Colors.error500 : Colors.success500;

  // ⛔ LA REGLE DU BANDEAU VIDE. Elle est ici, en haut, et pas dans l'appelant :
  // un bandeau sait seul s'il a quelque chose a dire.
  const isEmpty = variant === 'list' ? lines.length === 0 : !title;
  if (isEmpty) return null;

  return (
    <View>
      <Text
        style={[
          Fonts.small,
          {
            color: Colors.neutral400,
            fontSize: 10,
            fontWeight: '900',
            letterSpacing: 1.6,
            marginBottom: 9,
            marginTop: 16,
          },
        ]}
      >
        {label.toUpperCase()}
      </Text>

      <View
        style={{
          backgroundColor: withAlpha(resolvedTone, 0.09),
          borderColor: withAlpha(resolvedTone, 0.33),
          borderRadius: 16,
          borderWidth: 1,
          paddingBottom: 14,
          paddingHorizontal: 14,
          paddingTop: 4,
        }}
      >
        {variant === 'list' ? lines.map((line, index) => (
          <Pressable
            accessibilityRole={line.onPress ? 'button' : undefined}
            key={line.key}
            onPress={line.onPress}
            style={[
              Alignments.row,
              Alignments.alignCenter,
              {
                borderTopColor: withAlpha(Colors.neutral00, 0.08),
                borderTopWidth: index === 0 ? 0 : 1,
                gap: 11,
                minHeight: 54,
              },
            ]}
          >
            <View style={{ position: 'relative' }}>
              <Image
                source={Images[line.icon]}
                style={{ height: 17, width: 17 }}
                tintColor={line.tone || resolvedTone}
              />
              {line.hasAlert ? (
                <View
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                  style={{
                    backgroundColor: Colors.error500,
                    borderRadius: 4.5,
                    height: 9,
                    position: 'absolute',
                    right: -4,
                    top: -3,
                    width: 9,
                  }}
                />
              ) : null}
            </View>
            {line.notice ? (
              // MARQUE-MAIRIE (14/10) — le prochain evenement attend : la phrase sous son libelle,
              // au ton orange de la grille du planning (COLL-R-A4).
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    Fonts.small,
                    { color: Colors.neutral100, fontSize: 12.5, fontWeight: '700' },
                  ]}
                >
                  {line.label}
                </Text>
                <Text
                  style={[
                    Fonts.small,
                    {
                      alignSelf: 'stretch',
                      color: Colors.warning400,
                      fontSize: 11,
                      fontWeight: '700',
                      marginTop: 2,
                    },
                  ]}
                  testID="bandeau-seance-en-attente"
                >
                  {line.notice}
                </Text>
              </View>
            ) : (
              <Text
                style={[
                  Fonts.small,
                  {
                    color: Colors.neutral100, flex: 1, fontSize: 12.5, fontWeight: '700',
                  },
                ]}
              >
                {line.label}
              </Text>
            )}
            {line.value ? (
              <Text
                style={[
                  Fonts.small,
                  { color: Colors.neutral300, fontSize: 11.5, fontWeight: '700' },
                ]}
              >
                {line.value}
              </Text>
            ) : null}
            {line.onPress ? (
              <Text style={[Fonts.small, { color: Colors.neutral600, fontSize: 15 }]}>›</Text>
            ) : null}
          </Pressable>
        )) : null}

        {variant === 'event' ? (
          <View style={[Spaces.gap[12], { paddingTop: 10 }]}>
            <View>
              <Text style={[Fonts.p2Bold, Fonts.neutral00, { fontSize: 16, fontWeight: '900' }]}>
                {title}
                {titleSuffix ? (
                  <Text style={{ color: resolvedTone, fontSize: 12, fontWeight: '800' }}>
                    {`  ${titleSuffix}`}
                  </Text>
                ) : null}
              </Text>
              {subtitle ? (
                <Text
                  style={[
                    Fonts.small,
                    { color: Colors.neutral300, fontSize: 11.5, marginTop: 4 },
                  ]}
                >
                  {subtitle}
                </Text>
              ) : null}
              {notice ? (
                // MARQUE-MAIRIE (14/10) — l echeance attend une decision (« En attente de la
                // mairie »), au ton orange de la grille du planning. 📐 Piege Android 16 (gras
                // de plusieurs mots) : la ligne s ETIRE sur toute la colonne.
                <Text
                  style={[
                    Fonts.small,
                    {
                      alignSelf: 'stretch',
                      color: Colors.warning400,
                      fontSize: 11.5,
                      fontWeight: '700',
                      marginTop: 4,
                    },
                  ]}
                  testID="bandeau-seance-en-attente"
                >
                  {notice}
                </Text>
              ) : null}
            </View>

            {tiles.length ? (
              <View style={[Alignments.row, { gap: 8 }]}>
                {tiles.map((tile) => (
                  <View
                    key={tile.key}
                    style={{
                      backgroundColor: withAlpha(tile.tone || resolvedTone, 0.1),
                      borderColor: withAlpha(tile.tone || resolvedTone, 0.35),
                      borderRadius: 12,
                      borderWidth: 1,
                      flex: 1,
                      paddingHorizontal: 11,
                      paddingVertical: 9,
                    }}
                  >
                    <Text
                      style={[
                        Fonts.p2Bold,
                        { color: tile.tone || Colors.neutral00, fontSize: 17, fontWeight: '900' },
                      ]}
                    >
                      {tile.value}
                    </Text>
                    <Text
                      style={[
                        Fonts.small,
                        { color: Colors.neutral400, fontSize: 10, fontWeight: '700' },
                      ]}
                    >
                      {tile.label}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {actions.length ? (
              // Un seul bouton occupe toute la largeur (entraineur, « Ouvrir la
              // compo ») ; deux se partagent la ligne (joueur, « Present » /
              // « Absent »), tels que les captures 02 et 03 les montrent.
              <View style={[Alignments.row, { gap: 8 }]}>
                {actions.map((action) => (
                  <Button
                    disabled={action.disabled}
                    isLoading={action.isLoading}
                    key={action.key}
                    onPress={action.onPress}
                    style={{ flex: 1, minHeight: 46 }}
                    title={action.label}
                    variant={ACTION_VARIANTS[action.variant] || 'Primary'}
                  />
                ))}
              </View>
            ) : null}

            {confirmation ? (
              // ✓ A05 (audit V1, decision d'Adel du 30/09) — « ✓ Réponse envoyée : X »
              // apres Present COMME apres Absent. « La coche et le texte gardent leur
              // couleur verte ; apres Absent, le MOT « Absent » est en ROUGE. » Deux
              // couleurs de la charte, celles que les ecrans de convocation donnent
              // deja a present / absent (`MatchConvocationPublished.js`) : aucun
              // vert ni rouge invente.
              // 📢 Region vivante : un lecteur d'ecran l'annonce sans qu'on la cherche.
              // 📐 Piege Android 16 (gras de plusieurs mots dans une boite a sa largeur
              // mesuree : le dernier mot disparait) : la ligne s'ETIRE sur toute la
              // colonne (`alignSelf: 'stretch'`), la parade n° 1 du piege.
              <Text
                accessibilityLiveRegion="polite"
                style={[
                  Fonts.small,
                  {
                    alignSelf: 'stretch',
                    color: Colors.success500,
                    fontSize: 12.5,
                    fontWeight: '700',
                  },
                ]}
              >
                {`${confirmation.label} `}
                <Text style={{ color: couleurDuMot }}>
                  {confirmation.answerLabel}
                </Text>
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default HomeHeadBanner;
