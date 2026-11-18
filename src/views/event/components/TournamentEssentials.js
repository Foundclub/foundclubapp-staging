import i18next from 'i18next';
import { Text, View } from 'react-native';

import localeDesFormats from '@/theme/strings/localeDesFormats';
import useTheme from '@/theme/themeContext';

import { getEventLocationText } from '@/utils/eventLocationText';

import { createTournamentDesignSystem } from '../tournamentDesignSystem';
import { getTournamentEntryFeeLabel, getTournamentMinAge } from '../tournamentUtils';

// T-PAGES-1 (17/11/2026, maquette DESIGN-TOURNOI-PAGES validée, fiches (a) et (b),
// « Le tournoi » de (c)) — L'ESSENTIEL EN 4 CASES : date et heures, lieu, prix par joueur,
// format. Une case dont la donnée manque n'est pas dessinée. L'âge vient de
// `tournamentConfig.minAge` (pas de l'âge de la catégorie). Brique commune, sans requête :
// `getTournamentEssentials(event)` lit le tournoi, le composant dessine.
// Témoin : components/__tests__/TournamentEssentials.test.js.

/**
 * @typedef {{ key: 'date' | 'place' | 'price' | 'format', label: string, value: string,
 *   note: string | null }} EssentialItem
 */

/**
 * « 19:00 » depuis « 19:00:00 », ou `null`.
 * @param {unknown} value - L'heure saisie sur l'événement.
 * @returns {string | null} L'heure courte.
 */
const heureCourte = (value) => {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value || ''));
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : null;
};

/**
 * La case « Date » : « sam. 19 décembre », puis « 19:00 – 23:00 ».
 * @param {any} event - Le tournoi.
 * @returns {EssentialItem | null} La case, ou rien.
 */
const caseDate = (event) => {
  const jour = event?.date ? new Date(event.date) : null;
  if (!jour || Number.isNaN(jour.getTime())) return null;
  const value = jour.toLocaleDateString(localeDesFormats(), {
    day: 'numeric', month: 'long', weekday: 'short',
  });
  const debut = heureCourte(event?.startTime)
    || jour.toLocaleTimeString(localeDesFormats(), { hour: '2-digit', minute: '2-digit' });
  const fin = heureCourte(event?.endTime);
  return {
    key: 'date',
    label: i18next.t('tournamentEssentials.date'),
    note: fin ? `${debut} – ${fin}` : debut,
    value,
  };
};

/**
 * La case « Lieu » : le lieu par la règle commune (jamais le JSON de `locationDetails`).
 * @param {any} event - Le tournoi.
 * @returns {EssentialItem | null} La case, ou rien.
 */
const caseLieu = (event) => {
  const texte = getEventLocationText(event);
  if (!texte) return null;
  const [nom, ...reste] = String(texte).split(',');
  return {
    key: 'place',
    label: i18next.t('tournamentEssentials.place'),
    note: reste.join(',').trim() || null,
    value: nom.trim(),
  };
};

/**
 * La case « Prix » : le montant encaissé (`entryFeeCents`), et le maillot s'il est demandé.
 * @param {any} event - Le tournoi.
 * @returns {EssentialItem | null} La case, ou rien (tournoi gratuit).
 */
const casePrix = (event) => {
  const value = getTournamentEntryFeeLabel(event);
  if (!value) return null;
  return {
    key: 'price',
    label: i18next.t('tournamentEssentials.price'),
    note: event?.tournamentConfig?.jerseySizeRequired === true
      ? i18next.t('tournamentEssentials.jerseyNote')
      : null,
    value,
  };
};

/**
 * La case « Format » : joueurs par équipe, puis l'âge minimum et le nombre d'équipes.
 * @param {any} event - Le tournoi.
 * @returns {EssentialItem | null} La case, ou rien.
 */
const caseFormat = (event) => {
  const config = event?.tournamentConfig || {};
  const min = Math.round(Number(config.minRosterSize));
  const equipes = Math.round(Number(config.maxTeams));
  const minAge = getTournamentMinAge(event);
  let value = null;
  // T-SANS-PLAFOND (18/11, Adel D239) : plus de nombre maximum ; « 5 joueurs par équipe »
  // (le minimum).
  if (min > 0) value = i18next.t('tournamentEssentials.players', { count: min });
  const note = [
    minAge ? i18next.t('tournamentUtils.fromAge', { minAge }) : null,
    equipes > 0 ? i18next.t('tournamentEssentials.maxTeams', { count: equipes }) : null,
  ].filter(Boolean).join(' · ') || null;
  if (!value && !note) return null;
  return {
    key: 'format',
    label: i18next.t('tournamentEssentials.format'),
    note: value ? note : null,
    value: value || String(note),
  };
};

/**
 * Les cases de l'essentiel, dans l'ordre date, lieu, prix, format ; sans les cases vides.
 * @param {any} event - Le tournoi tel que la page le reçoit (`team.event` ou la fiche).
 * @returns {EssentialItem[]} Les cases.
 */
export const getTournamentEssentials = (event) => (
  /** @type {EssentialItem[]} */ (
    [caseDate(event), caseLieu(event), casePrix(event), caseFormat(event)].filter(Boolean)
  )
);

/**
 * L'essentiel en cases (2 × 2 sur un téléphone, une ligne sur un écran large).
 * @param {object} props - Les propriétés.
 * @param {EssentialItem[]} props.items - Les cases (`getTournamentEssentials(event)`).
 * @param {Partial<Record<EssentialItem['key'], import('react').ReactNode>>} [props.actions] - Un
 *   lien sous une case (l'itinéraire sous le lieu).
 * @returns {import('react').ReactElement | null} Les cases, ou rien.
 */
function TournamentEssentials({ actions = {}, items }) {
  const {
    ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const ds = createTournamentDesignSystem({
    ApplicationStyle, Colors, Fonts, Spaces,
  });
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <View
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}
      testID="tournament-essentials"
    >
      {items.map((item) => (
        <View
          key={item.key}
          style={[...ds.styles.compactPanelCard, { flexBasis: 150, flexGrow: 1, minWidth: 140 }]}
          testID={`tournament-essentials-${item.key}`}
        >
          <Text style={[Fonts.p4Bold, Fonts.primary500]}>{item.label}</Text>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{item.value}</Text>
          {item.note ? <Text style={[Fonts.p4, Fonts.neutral200]}>{item.note}</Text> : null}
          {actions[item.key] || null}
        </View>
      ))}
    </View>
  );
}

export default TournamentEssentials;
