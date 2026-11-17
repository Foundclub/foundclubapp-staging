import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

import { useGetTournamentTeam } from '@/services/tournamentTeam/tournamentTeamQueries';

import LinksPlatform from '@/platform/links';

// eslint-disable-next-line perfectionist/sort-imports -- « @/platform » est hors groupe pour perfectionist ; import/order le veut avant les chemins relatifs (même parade que TournamentFicheWeb.js).
import { createTournamentDesignSystem } from '../tournamentDesignSystem';
import TournamentTeamDiscussion from '../TournamentTeamDiscussion';
import TournamentTeamProgress from './TournamentTeamProgress';

/**
 * T-PAGES-4 (17/11, maquette validée (b), R4) — la carte « Mon équipe » de la fiche du tournoi,
 * au téléphone : capitaine, membre, invité ou demandeur retrouvent leur équipe et leur geste.
 * Même carte, mêmes textes que celle du site (TournamentFicheWeb.js, T-PAGES-3) : le rôle en
 * surtitre (`tournamentFicheWeb.myTeam.kicker.*`), le nom, la brique TournamentTeamProgress
 * (T-PAGES-A, non modifiée), « Payer ma place » si la sienne est due, la discussion de l'équipe.
 *
 * La fiche ne reçoit ni les membres ni les places payées (`members` vide, pas de `payment`) : la
 * carte lit la page d'équipe (`useGetTournamentTeam`, la requête de « Voir mon équipe », aucun
 * changement serveur). Tant qu'elle n'est pas là (chargement, refus), la carte dit le rôle, le
 * nom et le geste : jamais « 0 / 5 » faute de données.
 * ⛔ Le hook vit ici, pas dans `EventDetails.js` : une trentaine de suites montent l'écran avec une
 * doublure de react-query sans `useQuery` ; seule la fiche d'un lecteur qui a une équipe le monte.
 * @param {object} props - Les propriétés.
 * @param {{ onPress: () => void, title: string } | null} props.action - Le geste du lecteur (le
 *   même que le bouton du bas, `getTournamentPrimaryAction`).
 * @param {any} props.navigation - La navigation de l'écran (la discussion de l'équipe).
 * @param {'captain' | 'member' | 'invited' | 'requested'} props.role - Le lecteur dans l'équipe.
 * @param {any} props.team - L'équipe du lecteur, telle que la fiche la reçoit.
 * @param {any} [props.tournamentConfig] - Le réglage du tournoi.
 * @returns {import('react').ReactElement} La carte.
 */
function TournamentFicheMyTeamCard({
  action, navigation, role, team, tournamentConfig = {},
}) {
  const { t } = useTranslation();
  const {
    ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const ds = createTournamentDesignSystem({
    ApplicationStyle, Colors, Fonts, Spaces,
  });
  const { data } = useGetTournamentTeam(team?.documentId);
  const lue = data?.data || data || null;
  const detail = lue?.documentId ? lue : null;
  const places = Array.isArray(detail?.payment?.members) ? detail.payment.members : [];
  const maPlace = places.find((/** @type {any} */ place) => place?.isSelf) || null;
  const payer = Boolean(
    (role === 'captain' || role === 'member')
    && maPlace && maPlace.status !== 'paid' && maPlace.paymentUrl,
  );

  return (
    <View
      style={[...ds.styles.panelCard, Spaces.gap[12], { borderColor: Colors.primary500 }]}
      testID="tournament-fiche-my-team"
    >
      <View style={Spaces.gap[4]}>
        <Text style={[Fonts.p4Bold, Fonts.primary500]}>
          {t(`tournamentFicheWeb.myTeam.kicker.${role}`)}
        </Text>
        <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
          {detail?.name || team?.name || t('eventDetails.tournamentTeam', 'Équipe tournoi')}
        </Text>
      </View>
      {detail ? (
        <TournamentTeamProgress
          members={detail.members || []}
          payment={detail.payment || null}
          showTodo
          teamStatus={detail.status || ''}
          tournamentConfig={detail?.event?.tournamentConfig || tournamentConfig}
        />
      ) : null}
      {payer ? (
        // L'identifiant des témoins sur une enveloppe : le bouton commun ne le déclare pas.
        <View testID="tournament-fiche-my-team-pay">
          <Button
            onPress={() => LinksPlatform.openUrl(maPlace.paymentUrl)}
            style={{ minHeight: 44 }}
            title={t('tournamentTeamDetails.places.payMine', 'Payer ma place')}
            variant="Primary"
          />
        </View>
      ) : null}
      {action ? (
        <Button
          onPress={action.onPress}
          style={{ minHeight: 44 }}
          title={action.title}
          variant="Secondary"
        />
      ) : null}
      {detail?.discussion ? (
        <TournamentTeamDiscussion discussion={detail.discussion} navigation={navigation} />
      ) : null}
    </View>
  );
}

export default TournamentFicheMyTeamCard;
