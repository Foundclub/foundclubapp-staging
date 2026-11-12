import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { libelleSport } from '@/domains/complexe/complexeTerrain';
import {
  prixDuCreneau, texteCreneau, texteJourCourt, texteKilometres,
} from '@/domains/complexe/reserverTerrain';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import { RouteNames } from '@/navigation/routeNames';

import { useAnnoncesOuvertes } from '@/services/complexe/complexeJoueurQueries';

/**
 * « Il manque 4 joueurs » / « Il manque 1 joueur ».
 * @param {any} t - Traduction.
 * @param {number} nombre - Ce qui manque.
 * @returns {string} Le texte.
 */
const texteManque = (t, nombre) => (nombre > 1
  ? t('reserverTerrain.recherche.joueurs.manqueN', 'Il manque {{nombre}} joueurs', { nombre })
  : t('reserverTerrain.recherche.joueurs.manqueUn', 'Il manque {{nombre}} joueur', { nombre }));

/**
 * RESA-JOUEUR (11/11/2026) — D51 (« où est-ce qu'on trouve les annonces postées pour rechercher un
 * joueur manquant ? ») : les annonces « Il manque des joueurs », même carte partout (maquette
 * « 232- ok », Adel « A+B ») — « Il manque N joueurs » d'abord, puis le jour et l'heure, complexe ·
 * terrain · sport, le prix, la distance. Un appui ouvre l'annonce (ReserverAnnonce, « Je viens »).
 * Deux usages : la page du complexe (« Ils cherchent des joueurs », 3 au plus, rien s'il n'y en a
 * pas) et l'entrée « Recherche de joueurs » du panneau Réservations (autour de la zone).
 * @param {object} props - Les propriétés.
 * @param {{ complexe?: string, lat?: number, lng?: number, rayon?: number } | null} props.lieu
 *   - Où chercher.
 * @param {number} [props.max] - Le nombre de cartes au plus (toutes sinon).
 * @param {string} props.testID - Le repère.
 * @param {string} [props.titre] - Le titre du bloc (rien sans).
 * @param {boolean} [props.vide] - Dire « aucune annonce » plutôt que ne rien montrer.
 * @returns {import('react').ReactElement | null} Le bloc.
 */
function BlocRechercheDeJoueurs({
  lieu, max = 0, testID, titre = '', vide = false,
}) {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const lecture = useAnnoncesOuvertes(lieu);
  const toutes = Array.isArray(lecture?.data) ? lecture.data : [];
  const cartes = max > 0 ? toutes.slice(0, max) : toutes;
  if (!cartes.length && !vide) return null;

  return (
    <View style={{ gap: 10 }} testID={testID}>
      {titre ? (
        <Text accessibilityRole="header" style={[Fonts.h5Bold, Fonts.neutral00]}>{titre}</Text>
      ) : null}
      {!cartes.length ? (
        <Text style={[Fonts.p2, Fonts.neutral100]}>
          {lecture?.isLoading
            ? t('reserverTerrain.recherche.joueurs.chargement', 'Lecture des annonces…')
            : t(
              'reserverTerrain.recherche.joueurs.aucune',
              'Aucune partie ne cherche de joueurs ici pour l’instant.',
            )}
        </Text>
      ) : null}
      {cartes.map((/** @type {any} */ carte) => {
        const manque = Number(carte?.manque) || 0;
        const quand = t('reserverTerrain.creneau.choix', '{{jour}} · {{creneau}}', {
          creneau: texteCreneau(carte?.from, carte?.to),
          jour: texteJourCourt(t, carte?.date),
          ...SANS_ECHAPPEMENT,
        });
        const sport = typeof carte?.terrain?.sport === 'string'
          ? { name: carte.terrain.sport }
          : carte?.terrain?.sport;
        const lieuDuMatch = [carte?.complexe?.name, carte?.terrain?.name, libelleSport(sport)]
          .filter(Boolean)
          .join(' · ');
        const prix = prixDuCreneau(t, carte?.price, carte?.places)?.principal || '';
        const distance = Number.isFinite(Number(carte?.distanceKm)) && carte?.distanceKm !== null
          ? texteKilometres(Number(carte.distanceKm))
          : '';
        return (
          <TouchableOpacity
            accessibilityLabel={[texteManque(t, manque), quand, lieuDuMatch].join(', ')}
            accessibilityRole="button"
            key={String(carte?.annonce)}
            onPress={() => navigation.navigate(RouteNames.ReserverAnnonce, {
              annonceId: carte?.annonce,
            })}
            style={{
              backgroundColor: withAlpha(Colors.primary800, 0.6),
              borderColor: withAlpha(Colors.warning500, 0.45),
              borderRadius: 16,
              borderWidth: 1,
              gap: 4,
              padding: 14,
            }}
            testID={`annonce-${carte?.annonce}`}
          >
            <View
              style={[
                Alignments.row,
                Alignments.wrap,
                { columnGap: 8, justifyContent: 'space-between' },
              ]}
            >
              <Text style={[Fonts.p1Bold, Fonts.warning500]}>{texteManque(t, manque)}</Text>
              {distance ? <Text style={[Fonts.p3, Fonts.neutral200]}>{distance}</Text> : null}
            </View>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{quand}</Text>
            {lieuDuMatch ? <Text style={[Fonts.p3, Fonts.neutral100]}>{lieuDuMatch}</Text> : null}
            {prix ? <Text style={[Fonts.p3, Fonts.neutral100]}>{prix}</Text> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default BlocRechercheDeJoueurs;
