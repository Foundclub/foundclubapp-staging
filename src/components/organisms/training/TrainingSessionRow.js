import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import ClubCardSurface from '@/components/molecules/clubCard/ClubCardSurface';

/**
 * UNE RANGÉE DE SÉANCE — le code de la journée, son titre, sa date, son lieu,
 * sa durée et son statut, avec un liseré appuyé quand c'est la prochaine.
 *
 * 🔎 POURQUOI ELLE VIT ICI : le pack de design sort délibérément la liste des
 * huit journées de l'écran « Mon entraînement » pour la mettre derrière une porte
 * — afin que le premier écran ne montre que trois choses. La rangée sert donc
 * maintenant à DEUX écrans : « Toutes mes séances » et, en une seule exemplaire,
 * la carte de la prochaine séance. La recopier aurait garanti qu'elles divergent.
 */

/**
 * La couleur de la gélule d'ÉTAT, à droite — elle nomme où en est la séance.
 */
const STATUS_COLORS = {
  done: 'success500',
  in_progress: 'primary500',
  planned: 'neutral500',
  postponed: 'gold500',
  skipped: 'neutral600',
};

/**
 * La couleur de la pastille du CODE, à gauche — et elle ne suit que TROIS règles.
 *
 * 🪤 Elle reprenait la couleur d'état, donc cinq couleurs : la pastille du code
 * disait la même chose que la gélule juste en face, en moins clair. Le dessin n'en
 * veut que trois — vert quand c'est fait, bleu quand c'est la prochaine, gris
 * sinon — pour qu'un coup d'œil sur la colonne de gauche suffise à voir où on en est.
 * @param {Record<string, any>} colors les couleurs du thème
 * @param {string|undefined} statut le statut de la séance
 * @param {boolean} isNext vrai si c'est la prochaine séance
 * @returns {string} la couleur de la pastille du code
 */
const codeColor = (colors, statut, isNext) => {
  if (statut === 'done') return colors.success500;
  if (isNext) return colors.primary500;
  return colors.neutral600;
};

/**
 * La date d'une séance, courte et lisible.
 * @param {string|null|undefined} iso la date prévue
 * @returns {string} la date affichable, vide si elle est absente ou illisible
 */
export const formatSessionDate = (iso) => {
  if (!iso) return '';
  const date = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', weekday: 'short' });
};

/**
 * @param {object} props
 * @param {boolean} [props.isNext] Vrai pour la prochaine séance, mise en avant.
 * @param {() => void} props.onPress Ouvre le détail de la journée.
 * @param {Record<string, any>} props.session La séance affichée.
 * @returns {React.ReactElement} la rangée cliquable d'une séance
 */
function TrainingSessionRow({ isNext = false, onPress, session }) {
  const { Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();
  const day = session?.day || {};
  const etat = /** @type {keyof STATUS_COLORS} */ (session?.status);
  const statusColor = Colors[/** @type {keyof Colors} */ (STATUS_COLORS[etat] || 'neutral500')];

  return (
    <TouchableOpacity accessibilityRole="button" onPress={onPress}>
      {/*
        🎨 La carte passe par `ClubCardSurface`, le POINT DE VÉRITÉ UNIQUE des
        cartes de l'app : dégradé `primary700` → `primary900` et liseré cyan.
        Elle posait avant un `neutral800` écrit à la main — un gris que plus aucun
        autre écran n'emploie comme surface, ce qui faisait de la section une île.
      */}
      <ClubCardSurface
        style={[
          Spaces.gap[4],
          {
            borderColor: isNext ? Colors.primary500 : withAlpha(Colors.primary500, 0.25),
            borderRadius: 12,
            borderWidth: isNext ? 2 : 1,
            // Une séance sautée s'efface sans disparaître : elle reste là, et on
            // voit d'un coup d'œil qu'on l'a passée.
            opacity: session?.status === 'skipped' ? 0.55 : 1,
            padding: 14,
          },
        ]}
      >
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
          <View style={{
            backgroundColor: codeColor(Colors, session?.status, isNext),
            borderRadius: 6,
            paddingHorizontal: 8,
            paddingVertical: 2,
          }}
          >
            <Text style={[Fonts.captionBold, { color: Colors.neutral00 }]}>{day.code}</Text>
          </View>
          {/*
            Une seule ligne, coupée aux points de suspension : sur deux lignes, les
            rangées changeaient de hauteur d'une journée à l'autre et la colonne
            perdait son rythme.
          */}
          <Text
            numberOfLines={1}
            style={[Fonts.p2, { color: Colors.neutral00, flex: 1 }]}
          >
            {day.title}
          </Text>
        </View>

        <View style={{ alignItems: 'center', flexDirection: 'row', gap: 6 }}>
          {/*
            Les trois informations sont RELIÉES par des points médians, pas
            simplement espacées : espacées, elles se lisaient comme trois étiquettes
            sans rapport.
          */}
          <Text style={[Fonts.caption, { color: Colors.neutral300 }]}>
            {[
              formatSessionDate(session.plannedDate),
              // Le lieu s'écrit en minuscules : le serveur rend « SALLE » ou
              // « Salle » selon les programmes, et une casse qui saute d'une
              // rangée à l'autre se voit tout de suite.
              day.place ? String(day.place).toLowerCase() : null,
              day.durationMinutes ? `${day.durationMinutes} min` : null,
            ].filter(Boolean).join(' · ')}
          </Text>
          <View style={{
            borderColor: statusColor,
            borderRadius: 999,
            borderWidth: 1,
            marginLeft: 'auto',
            paddingHorizontal: 8,
            paddingVertical: 2,
          }}
          >
            <Text style={[Fonts.caption, { color: statusColor }]}>
              {t(`training.status.${session.status || 'planned'}`)}
            </Text>
          </View>
        </View>
      </ClubCardSurface>
    </TouchableOpacity>
  );
}

export default TrainingSessionRow;
