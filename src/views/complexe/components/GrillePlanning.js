import { useTranslation } from 'react-i18next';
import {
  ScrollView, Text, TouchableOpacity, useWindowDimensions, View,
} from 'react-native';

import {
  etatDeFrise,
  libelleDuCreneau,
  minutesAParis,
  plageHoraire,
} from '@/domains/complexe/complexeReservation';
import { heureDe, minutesDe, texteHeure } from '@/domains/complexe/complexeTerrain';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import { styleDuCreneau } from '@/views/complexe/components/allureDuCreneau';

const PAR_MINUTE = 1.5;
const AXE = 44;
const ENTETE = 40;

/**
 * @typedef {{ closure: any, date: string, endsAt: string, from: string | null, reservation: any,
 *   startsAt: string, state: string, terrainId: string, terrainNom: string,
 *   to: string | null }} CreneauDuPlanning
 * @typedef {{ cle: string, couleur?: string | null, creneaux: CreneauDuPlanning[],
 *   titre: string }} ColonneDuPlanning
 */

/**
 * Les minutes de début et de fin d'un créneau (son modèle, sinon ses instants : une réservation
 * « hors modèle » n'a pas d'heures de modèle).
 * @param {CreneauDuPlanning} creneau - Le créneau.
 * @returns {{ a: number, de: number }} Les minutes depuis minuit, à Paris.
 */
export const minutesDuCreneau = (creneau) => {
  const de = creneau.from ? minutesDe(creneau.from) : null;
  const a = creneau.to ? minutesDe(creneau.to) : null;
  const debut = de ?? minutesAParis(new Date(creneau.startsAt));
  let fin = a ?? minutesAParis(new Date(creneau.endsAt));
  if (fin <= debut) fin += 24 * 60;
  return { a: fin, de: debut };
};

/**
 * LA GRILLE DU PLANNING — RESA-L5A2 (14/10/2026), planche EG03 : vue Jour = une colonne par
 * terrain, vue Semaine = un terrain, 7 colonnes ; les heures en lignes, chaque créneau à sa
 * place, coloré par son état (l'allure de la frise de l'accueil, `allureDuCreneau`) et nommé
 * (« Julien M. · App »,
 * « Bloqué : entretien »). Toucher = agir (une case libre, un bloc) ; appui long sur une case libre
 * = « Bloquer à partir d'ici » (le repli accessible du glisser, qui n'existe pas encore dans
 * l'app). Les colonnes défilent à l'horizontale quand elles ne tiennent pas.
 * @param {object} props - Les propriétés.
 * @param {ColonneDuPlanning[]} props.colonnes - Les colonnes.
 * @param {(creneau: CreneauDuPlanning) => boolean} props.estActif - Le créneau répond-il ?
 * @param {(creneau: CreneauDuPlanning) => void} props.onAppuiLong - Appui long (case libre).
 * @param {(creneau: CreneauDuPlanning) => void} props.onToucher - Toucher.
 * @returns {import('react').ReactElement} La grille.
 */
function GrillePlanning({
  colonnes, estActif, onAppuiLong, onToucher,
}) {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts } = useTheme();
  const { width } = useWindowDimensions();

  const tous = colonnes.flatMap((colonne) => colonne.creneaux.map(minutesDuCreneau));
  if (!tous.length) {
    return (
      <Text style={[Fonts.p2, Fonts.neutral200]}>
        {t('complexeReservations.planning.aucunCreneau', 'Aucun créneau ce jour-là.')}
      </Text>
    );
  }
  const debut = Math.floor(Math.min(...tous.map((m) => m.de)) / 60) * 60;
  const fin = Math.ceil(Math.max(...tous.map((m) => m.a)) / 60) * 60;
  const hauteur = (fin - debut) * PAR_MINUTE;
  const heures = Array.from({ length: (fin - debut) / 60 + 1 }, (_v, index) => debut + index * 60);
  const parColonne = Math.floor((width - 32 - AXE) / Math.max(1, colonnes.length));
  const largeurColonne = Math.max(104, parColonne);

  const caseDe = (
    /** @type {ColonneDuPlanning} */ colonne,
    /** @type {CreneauDuPlanning} */ creneau,
  ) => {
    const { a, de } = minutesDuCreneau(creneau);
    const etat = etatDeFrise(creneau.state);
    const libelle = libelleDuCreneau(t, creneau);
    const actif = estActif(creneau);
    const debutTexte = creneau.from || heureDe(de);
    return (
      <TouchableOpacity
        accessibilityLabel={t(
          'complexeReservations.planning.a11y',
          '{{terrain}}, {{plage}}, {{etat}}',
          {
            etat: libelle,
            plage: plageHoraire(heureDe(de), heureDe(a)),
            terrain: creneau.terrainNom,
            ...SANS_ECHAPPEMENT,
          },
        )}
        accessibilityRole="button"
        accessibilityState={{ disabled: !actif }}
        delayLongPress={400}
        disabled={!actif}
        key={`${colonne.cle}-${creneau.startsAt}`}
        onLongPress={etat === 'libre' ? () => onAppuiLong(creneau) : undefined}
        onPress={() => onToucher(creneau)}
        style={[
          Alignments.justifyCenter,
          {
            borderRadius: 8,
            borderWidth: 1,
            height: Math.max(24, (a - de) * PAR_MINUTE - 4),
            left: 3,
            opacity: actif ? 1 : 0.5,
            paddingHorizontal: 6,
            position: 'absolute',
            right: 3,
            top: (de - debut) * PAR_MINUTE + 2,
          },
          styleDuCreneau(Colors, etat),
        ]}
        testID={`creneau-${creneau.terrainId}-${creneau.date}-${debutTexte}`}
      >
        <Text numberOfLines={2} style={[Fonts.p4Bold, Fonts.neutral00]}>
          {etat === 'libre' ? '' : libelle}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[Alignments.row]} testID="grille-planning">
      <View style={{ paddingTop: ENTETE, width: AXE }}>
        <View style={{ height: hauteur }}>
          {heures.map((minutes) => (
            <Text
              key={minutes}
              style={[
                Fonts.p4,
                Fonts.neutral200,
                { position: 'absolute', top: (minutes - debut) * PAR_MINUTE - 6 },
              ]}
            >
              {texteHeure(heureDe(minutes))}
            </Text>
          ))}
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
        <View style={[Alignments.row]}>
          {colonnes.map((colonne) => (
            <View key={colonne.cle} style={{ width: largeurColonne }}>
              <View style={[Alignments.justifyCenter, { height: ENTETE, paddingHorizontal: 4 }]}>
                <Text numberOfLines={1} style={[Fonts.p3Bold, Fonts.neutral00]}>
                  {colonne.titre}
                </Text>
              </View>
              <View
                style={{
                  borderLeftColor: Colors.primary700,
                  borderLeftWidth: 1,
                  height: hauteur,
                }}
              >
                {colonne.creneaux.map((creneau) => caseDe(colonne, creneau))}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

export default GrillePlanning;
