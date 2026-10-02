import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { splitAdminInvitations } from '@/domains/collectivite/collectiviteConsole';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import ManagerRequestsLink from '@/views/admin/components/ManagerRequestsLink';

import { RouteNames } from '@/navigation/routeNames';

import { useAdminCollectiviteInvitations } from '@/services/collectivite/collectiviteQueries';

/**
 * Une ligne de « À traiter » : un libelle, son nombre (rien quand il vaut 0, « — » quand la
 * lecture a echoue), et l ecran qu elle ouvre. Meme dessin que la porte de la file des
 * demandes de gestionnaire (ManagerRequestsLink, lot COLL-ACCUEIL), posee a cote d elle.
 * @param {{ count: number | null, label: string, onPress: () => void, testID: string }} props
 *   - La ligne.
 * @returns {import('react').ReactElement} La ligne.
 */
function LigneATraiter({
  count, label, onPress, testID,
}) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  let compteur = null;
  if (count === null) {
    compteur = <Text style={[Fonts.p3Bold, Fonts.neutral300]}>—</Text>;
  } else if (count > 0) {
    compteur = (
      <View
        style={[
          Alignments.alignCenter,
          Alignments.justifyCenter,
          {
            backgroundColor: Colors.error700, borderRadius: 999, minWidth: 24, paddingHorizontal: 6,
          },
        ]}
      >
        <Text style={[Fonts.p3Bold, Fonts.neutral00]}>{String(count)}</Text>
      </View>
    );
  }
  return (
    <TouchableOpacity
      accessibilityLabel={count ? `${label} : ${count}` : label}
      accessibilityRole="button"
      onPress={onPress}
      style={[
        ApplicationStyle.borderRadius16,
        Alignments.row,
        Alignments.alignCenter,
        Spaces.padding[12],
        {
          backgroundColor: withAlpha(Colors.primary700, 0.35),
          borderColor: withAlpha(Colors.primary500, 0.28),
          borderWidth: 1,
          gap: 12,
          minHeight: 44,
        },
      ]}
      testID={testID}
    >
      <Text style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>{label}</Text>
      {compteur}
    </TouchableOpacity>
  );
}

/**
 * 🏛️ « À TRAITER » DES COLLECTIVITÉS — COLL-CONSOLE (02/10/2026), planche P2-console (design
 * HY521H1, page 2, écran 1, état 2 et B) ; décision d'Adel « console oui » (01/10).
 *
 * En tête de la console des collectivités, ce qui attend l'équipe FoundClub :
 *   - « Mairies à activer » : une mairie INACTIVE qui a déjà des clubs (la ligne n'existe que
 *     s'il y en a ; elle filtre la liste sur les inactives) ;
 *   - « Demandes de gestionnaire » : la porte de la file posée par COLL-ACCUEIL, telle quelle ;
 *   - « Demandes de rattachement » : un dirigeant a ouvert le lien de sa Ville (COLL-CLUBS) ;
 *   - « Clubs à inviter, par FoundClub » : une mairie a donné un club absent de FoundClub.
 * Les deux dernières ouvrent l'écran des demandes (AdminCollectiviteInvitations), sur leur onglet.
 * @param {{ onShowToActivate: () => void, toActivate: number }} props - Le nombre de mairies à
 *   activer (calculé par la liste) et le geste qui filtre la liste sur elles.
 * @returns {import('react').ReactElement} Le bloc.
 */
function CollectivitesATraiter({ onShowToActivate, toActivate }) {
  const { t } = useTranslation();
  const { ApplicationStyle, Colors, Fonts } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const demandes = useAdminCollectiviteInvitations();
  const piles = splitAdminInvitations(demandes.data);
  const compter = (/** @type {any[]} */ pile) => (demandes.error ? null : pile.length);
  const ouvrir = (/** @type {string} */ onglet) => () => navigation.navigate(
    RouteNames.AdminCollectiviteInvitations,
    { onglet },
  );

  return (
    <View
      accessibilityLabel={t('collectiviteConsole.aTraiter.titre', 'À traiter')}
      style={[
        ApplicationStyle.borderRadius16,
        {
          backgroundColor: withAlpha(Colors.primary700, 0.45),
          borderColor: withAlpha(Colors.primary500, 0.5),
          borderWidth: 1,
          gap: 8,
          padding: 16,
        },
      ]}
      testID="collectivites-a-traiter"
    >
      <Text accessibilityRole="header" style={[Fonts.p3Bold, Fonts.primary200]}>
        {t('collectiviteConsole.aTraiter.titre', 'À traiter').toUpperCase()}
      </Text>
      {toActivate > 0 ? (
        <LigneATraiter
          count={toActivate}
          label={t('collectiviteConsole.aTraiter.mairiesAActiver', 'Mairies à activer')}
          onPress={onShowToActivate}
          testID="a-traiter-mairies"
        />
      ) : null}
      <ManagerRequestsLink />
      <LigneATraiter
        count={compter(piles.attachRequests)}
        label={t('collectiviteConsole.aTraiter.rattachements', 'Demandes de rattachement')}
        onPress={ouvrir('rattachements')}
        testID="a-traiter-rattachements"
      />
      <LigneATraiter
        count={compter(piles.foundclub)}
        label={t('collectiviteConsole.aTraiter.parFoundClub', 'Clubs à inviter, par FoundClub')}
        onPress={ouvrir('foundclub')}
        testID="a-traiter-foundclub"
      />
    </View>
  );
}

export default CollectivitesATraiter;
