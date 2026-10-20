import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import {
  formatDay,
  formatMonthYear,
  SEASON_SLOT_WEEKDAYS,
  weekdayName,
} from '@/domains/seasonSlot/seasonSlotDisplay';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

const JOUR_MS = 24 * 60 * 60 * 1000;

/**
 * Le 1er du mois d'un jour, et le mois voisin.
 * @param {string} jour - AAAA-MM-JJ.
 * @param {number} [decalage] - +1 : le mois suivant, -1 : le précédent.
 * @returns {string} AAAA-MM-01.
 */
const premierDuMois = (jour, decalage = 0) => {
  const date = new Date(`${jour.slice(0, 7)}-01T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + decalage);
  return date.toISOString().slice(0, 10);
};

/**
 * Les cases d'un mois, du lundi au dimanche : null avant le 1er.
 * @param {string} premier - AAAA-MM-01.
 * @returns {Array<string | null>} Les jours (AAAA-MM-JJ).
 */
const casesDuMois = (premier) => {
  const debut = new Date(`${premier}T00:00:00.000Z`);
  const decalage = (debut.getUTCDay() + 6) % 7;
  /** @type {Array<string | null>} */
  const cases = Array.from({ length: decalage }, () => null);
  for (let temps = debut.getTime(); ; temps += JOUR_MS) {
    const jour = new Date(temps).toISOString().slice(0, 10);
    if (jour.slice(0, 7) !== premier.slice(0, 7)) break;
    cases.push(jour);
  }
  return cases;
};

/**
 * 🗓️ R17-QUAND-1, point 4 (planches P10-quand-tel état « Des dates choisies », P11-quand-v2-tel
 * « Le calendrier libre », validées par Adel le 19/10) — LE CALENDRIER DES DATES CHOISIES.
 * N'importe quel jour se coche (Q4 B) ; un appui coche, un autre décoche. Chaque jour dit son
 * état : choisi, fermé (la Ville a fermé l'installation : il ne se coche pas), complet (il se
 * coche quand même, comme aujourd'hui). Les jours passés et ceux après la saison ne se cochent pas.
 * ponytail: une grille de mois écrite ici plutôt que `react-native-calendars` : jest ne sait pas
 * transformer cette bibliothèque, et chaque témoin qui monte le tunnel devrait la doubler (une
 * vingtaine). Plafond : ni balayage d'un mois à l'autre, ni semaine affichée ; sortie : la
 * bibliothèque, le jour où elle passe par la configuration de jest.
 * @param {{
 *   completDe?: (jour: string) => string | null,
 *   dates: string[],
 *   depuis: string,
 *   fermeDe?: (jour: string) => string | null,
 *   jusqua?: string | null,
 *   legendeVacances?: string | null,
 *   onToggle: (jour: string) => void,
 *   vacancesDe?: (jour: string) => string | null,
 * }} props - `completDe` : « 18:00 – 19:30 » si ce jour est complet ; `fermeDe` : le nom de la
 *   fermeture ; `depuis` / `jusqua` : les bornes (AAAA-MM-JJ) ; `vacancesDe` (R17-QUAND-2) : le
 *   nom des vacances scolaires de la zone ce jour-là, `legendeVacances` leur légende.
 * @returns {import('react').ReactElement} Le calendrier et sa légende.
 */
export default function SeasonSlotDatesCalendar({
  completDe = () => null,
  dates,
  depuis,
  fermeDe = () => null,
  jusqua = null,
  legendeVacances = null,
  onToggle,
  vacancesDe = () => null,
}) {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts } = useTheme();
  const [mois, setMois] = useState(premierDuMois(dates[0] || depuis));
  const premierMois = premierDuMois(depuis);
  const dernierMois = jusqua ? premierDuMois(jusqua) : null;

  const rendreLeJour = (/** @type {string | null} */ jour, /** @type {number} */ rang) => {
    if (!jour) return <View key={`vide-${rang}`} style={{ height: 44, width: `${100 / 7}%` }} />;
    const choisi = dates.includes(jour);
    const fermeture = fermeDe(jour);
    const complet = completDe(jour);
    // 🌴 R17-QUAND-2 — en violet, jamais confondues avec une fermeture (planche P11-quand-v2-tel).
    const vacances = vacancesDe(jour);
    const horsBornes = jour < depuis || Boolean(jusqua && jour > jusqua);
    const bloque = horsBornes || (Boolean(fermeture) && !choisi);
    const quand = formatDay(jour, { withYear: false });
    let etat = t('collectiviteCreneaux.quand.calendrier.libre', '{{date}}, libre', {
      date: quand, ...SANS_ECHAPPEMENT,
    });
    if (fermeture) {
      etat = t('collectiviteCreneaux.quand.calendrier.ferme', '{{date}}, fermé ({{fermeture}})', {
        date: quand, fermeture, ...SANS_ECHAPPEMENT,
      });
    } else if (complet) {
      etat = t('collectiviteCreneaux.quand.calendrier.complet', '{{date}}, complet de {{heures}}', {
        date: quand, heures: complet, ...SANS_ECHAPPEMENT,
      });
    } else if (vacances) {
      etat = t('collectiviteCreneaux.quand.calendrier.vacances', '{{date}}, vacances ({{nom}})', {
        date: quand, nom: vacances, ...SANS_ECHAPPEMENT,
      });
    }
    if (choisi) {
      etat = t('collectiviteCreneaux.quand.calendrier.choisi', '{{etat}}, choisi', {
        etat, ...SANS_ECHAPPEMENT,
      });
    }
    let fond = 'transparent';
    let bord = 'transparent';
    let couleur = horsBornes ? Colors.neutral600 : Colors.neutral00;
    if (choisi) {
      fond = Colors.primary500;
      couleur = Colors.primary900;
    } else if (fermeture) {
      bord = Colors.warning500;
      couleur = Colors.warning400;
    } else if (complet) {
      bord = withAlpha(Colors.warning500, 0.6);
    } else if (vacances) {
      fond = withAlpha(Colors.violet500, 0.22);
      bord = withAlpha(Colors.violet200, 0.6);
    }
    return (
      <View key={jour} style={[Alignments.center, { height: 44, width: `${100 / 7}%` }]}>
        <TouchableOpacity
          accessibilityLabel={etat}
          accessibilityRole="button"
          accessibilityState={{ disabled: bloque, selected: choisi }}
          disabled={bloque}
          onPress={() => onToggle(jour)}
          style={[Alignments.center, {
            backgroundColor: fond,
            borderColor: bord,
            borderRadius: 12,
            borderStyle: fermeture && !choisi ? 'dashed' : 'solid',
            borderWidth: 1,
            height: 44,
            width: 44,
          }]}
          testID={`date-${jour}`}
        >
          <Text
            style={[Fonts.p2Bold, {
              color: couleur,
              textDecorationLine: fermeture && !choisi ? 'line-through' : 'none',
            }]}
          >
            {Number(jour.slice(8, 10))}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={{ gap: 8 }} testID="season-slot-dates-calendar">
      <View
        style={[
          Alignments.row, Alignments.alignCenter, { gap: 8, justifyContent: 'space-between' },
        ]}
      >
        <Button
          accessibilityLabel={t(
            'collectiviteCreneaux.quand.calendrier.precedent',
            'Mois précédent',
          )}
          disabled={mois <= premierMois}
          icon="arrowLeft"
          onPress={() => setMois(premierDuMois(mois, -1))}
          style={{ minHeight: 44, minWidth: 44 }}
          variant="Ghost"
        />
        <Text accessibilityLiveRegion="polite" style={[Fonts.h5Bold, Fonts.neutral00]}>
          {formatMonthYear(mois)}
        </Text>
        <Button
          accessibilityLabel={t('collectiviteCreneaux.quand.calendrier.suivant', 'Mois suivant')}
          disabled={Boolean(dernierMois && mois >= dernierMois)}
          icon="arrowRight"
          onPress={() => setMois(premierDuMois(mois, 1))}
          style={{ minHeight: 44, minWidth: 44 }}
          variant="Ghost"
        />
      </View>
      <View style={[Alignments.row, Alignments.wrap]}>
        {SEASON_SLOT_WEEKDAYS.map((numero) => (
          <Text
            key={`entete-${numero}`}
            style={[Fonts.p3Bold, Fonts.neutral300, { textAlign: 'center', width: `${100 / 7}%` }]}
          >
            {weekdayName(numero, { short: true })}
          </Text>
        ))}
        {casesDuMois(mois).map(rendreLeJour)}
      </View>
      <View style={[Alignments.row, Alignments.wrap, { gap: 16 }]}>
        <View style={[Alignments.row, Alignments.alignCenter, { gap: 6 }]}>
          <View style={{
            backgroundColor: Colors.primary500, borderRadius: 4, height: 12, width: 12,
          }}
          />
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t('collectiviteCreneaux.quand.calendrier.legendeChoisi', 'Choisi')}
          </Text>
        </View>
        <View style={[Alignments.row, Alignments.alignCenter, { gap: 6 }]}>
          <View style={{
            borderColor: Colors.warning500,
            borderRadius: 4,
            borderStyle: 'dashed',
            borderWidth: 1,
            height: 12,
            width: 12,
          }}
          />
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t('collectiviteCreneaux.quand.calendrier.legendeFerme', 'Complet ou fermé')}
          </Text>
        </View>
        {legendeVacances ? (
          <View style={[Alignments.row, Alignments.alignCenter, { gap: 6 }]}>
            <View style={{
              backgroundColor: withAlpha(Colors.violet500, 0.5),
              borderColor: Colors.violet200,
              borderRadius: 4,
              borderWidth: 1,
              height: 12,
              width: 12,
            }}
            />
            <Text style={[Fonts.p3, Fonts.neutral200]}>{legendeVacances}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
