import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { estAuPlanning, joueurDesComplexesAllume } from '@/domains/complexe/reservationsDuJoueur';
import {
  ajouterJours, etatAffiche, jourDeParis, texteCreneau, texteJourCourt,
} from '@/domains/complexe/reserverTerrain';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import PastilleEtat from '@/views/reserverTerrain/components/PastilleEtat';

import { RouteNames } from '@/navigation/routeNames';

import {
  useGroupesDeReservations,
  useMesReservations,
} from '@/services/complexe/complexeJoueurQueries';

// Une panne de cette lecture ne dit rien : l'accueil reste tel quel (même réglage que le
// planning, qui lit la même liste : le cache est partagé).
const LECTURE_DISCRETE = Object.freeze({ meta: { preventToastError: true }, retry: false });

/**
 * RESA-JOUEUR-2 (11/11/2026) — ACCUEIL « TA PROCHAINE RÉSERVATION » (maquette « 232- ok ») :
 * pour retrouver ses réservations sans passer par Mon compte, une carte en haut de l'accueil, tant
 * qu'une réservation est à venir (confirmée, demandée ou en construction, comme au planning) : le
 * jour et l'heure, le complexe et le terrain, son état, « Ouvrir » et « Toutes mes réservations
 * (N) ». Rien sans réservation à venir, rien si la lecture échoue. Caché par `COMPLEXES_JOUEUR`.
 * @param {object} props - Les propriétés.
 * @param {{ navigate: (...args: any[]) => void }} props.navigation - La navigation de l'accueil.
 * @returns {import('react').ReactElement | null} La carte, ou rien.
 */
function CarteProchaineReservation({ navigation }) {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts } = useTheme();
  const allume = joueurDesComplexesAllume();
  const lecture = useMesReservations('a-venir', { ...LECTURE_DISCRETE, enabled: allume });
  const aVenir = (Array.isArray(lecture?.data) ? lecture.data : [])
    .filter(estAuPlanning)
    .slice()
    .sort((a, b) => String(a?.startsAt || '').localeCompare(String(b?.startsAt || '')));
  const prochaine = aVenir[0] || null;
  const enConstruction = prochaine?.status === 'en_collecte';
  const { groupes } = useGroupesDeReservations(
    enConstruction ? [String(prochaine.documentId)] : [],
    { enabled: allume && enConstruction },
  );
  if (!allume || !prochaine?.documentId) return null;

  const aujourdhui = jourDeParis();
  let jour = texteJourCourt(t, prochaine.date);
  if (prochaine.date === aujourdhui) {
    jour = t('reserverTerrain.recherche.aujourdhui', 'Aujourd’hui');
  } else if (prochaine.date === ajouterJours(aujourdhui, 1)) {
    jour = t('reserverTerrain.recherche.demain', 'Demain');
  }
  const collecte = groupes?.[prochaine.documentId]?.collecte;
  const ouvrir = () => navigation.navigate(RouteNames.ReserverMaReservation, {
    reservationId: prochaine.documentId,
  });

  return (
    <View
      style={{
        backgroundColor: withAlpha(Colors.primary800, 0.82),
        borderColor: withAlpha(Colors.primary500, 0.3),
        borderRadius: 20,
        borderWidth: 1,
        gap: 6,
        padding: 16,
      }}
      testID="accueil-prochaine-reservation"
    >
      <Text style={[Fonts.p3Bold, Fonts.primary200]}>
        {t('reserverTerrain.accueil.prochaine', 'Ta prochaine réservation')}
      </Text>
      <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
        {t('reserverTerrain.resultat.jourEtCreneau', '{{jour}} · {{creneau}}', {
          creneau: texteCreneau(prochaine.from, prochaine.to),
          jour,
          ...SANS_ECHAPPEMENT,
        })}
      </Text>
      <Text style={[Fonts.p3, Fonts.neutral200]}>
        {[prochaine?.complexe?.name, prochaine?.terrain?.name].filter(Boolean).join(' · ')}
      </Text>
      <View style={[Alignments.row, Alignments.alignCenter, { gap: 12, marginTop: 4 }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <PastilleEtat
            compte={collecte ? `${collecte.presents}/${collecte.quorum}` : null}
            etat={etatAffiche(prochaine)}
          />
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={ouvrir}
          style={{ justifyContent: 'center', minHeight: 44, paddingHorizontal: 8 }}
          testID="accueil-prochaine-reservation-ouvrir"
        >
          <Text style={[Fonts.p2Bold, Fonts.primary500]}>
            {t('reserverTerrain.accueil.ouvrir', 'Ouvrir')}
          </Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        accessibilityRole="link"
        onPress={() => navigation.navigate(RouteNames.ReserverMesReservations)}
        style={{ justifyContent: 'center', minHeight: 44 }}
      >
        <Text style={[Fonts.p2Bold, Fonts.primary200]}>
          {t('reserverTerrain.accueil.toutes', 'Toutes mes réservations ({{nombre}})', {
            nombre: aVenir.length,
          })}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export default CarteProchaineReservation;
