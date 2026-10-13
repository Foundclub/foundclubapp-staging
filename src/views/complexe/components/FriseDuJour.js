import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import { heureDe, minutesDe, texteHeure } from '@/domains/complexe/complexeTerrain';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

const PAR_MINUTE = 1.4;
const NOMS = 84;
const HAUTEUR = 44;

/** @typedef {'app' | 'attente' | 'bloque' | 'exterieur' | 'ferme' | 'libre'} EtatDuCreneau */
/**
 * @typedef {{ etat: EtatDuCreneau, from: string, libelle?: string, to: string }} CreneauDeLaFrise
 * @typedef {{ cle: string, couleur?: string | null, creneaux: CreneauDeLaFrise[],
 *   nom: string }} LigneDeLaFrise
 */

const ETATS = /** @type {EtatDuCreneau[]} */ ([
  'libre', 'app', 'exterieur', 'attente', 'bloque', 'ferme',
]);

/**
 * LA FRISE « AUJOURD'HUI » DE L'ACCUEIL DU GÉRANT — RESA-L5A1 (13/10/2026), planches E-G02 bloc 3
 * et P00 bloc 2 : une ligne par terrain, de l'ouverture à la fermeture, chaque créneau à sa place
 * et coloré par son état (libre, réservé dans l'app, réservé à l'extérieur, en attente, bloqué,
 * fermé), le trait de l'heure courante, la légende repliable. La frise défile à l'horizontale, les
 * noms des terrains restent figés à gauche. Une collecte n'y apparaît jamais (elle n'occupe rien).
 * L'ÉTAT d'un créneau vient de l'appelant : tant que le lot L2A ne sert pas les réservations,
 * l'accueil ne passe que des créneaux « libre ».
 * @param {object} props - Les propriétés.
 * @param {LigneDeLaFrise[]} props.lignes - Les terrains et leurs créneaux du jour.
 * @param {number} [props.largeurNoms] - La colonne des noms : 84 sur téléphone, 120 sur
 *   ordinateur (planche OR1 : « noms des terrains en clair »).
 * @param {number} props.maintenant - L'heure courante, en minutes depuis minuit.
 * @returns {import('react').ReactElement | null} La frise, ou rien sans créneau.
 */
function FriseDuJour({ largeurNoms = NOMS, lignes, maintenant }) {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts } = useTheme();
  const [legende, setLegende] = useState(false);

  const creneaux = lignes.flatMap((ligne) => ligne.creneaux);
  if (!creneaux.length) return null;
  const debuts = creneaux.map((creneau) => Number(minutesDe(creneau.from)));
  const fins = creneaux.map((creneau) => Number(minutesDe(creneau.to)));
  const debut = Math.floor(Math.min(...debuts) / 60) * 60;
  const fin = Math.ceil(Math.max(...fins) / 60) * 60;
  const largeur = (fin - debut) * PAR_MINUTE;
  const heures = Array.from({ length: (fin - debut) / 60 + 1 }, (_v, index) => debut + index * 60);

  const libelleDe = (/** @type {EtatDuCreneau} */ etat) => {
    switch (etat) {
      case 'app':
        return t('complexeGerant.frise.app', 'Réservé dans l’app');
      case 'attente':
        return t('complexeGerant.frise.attente', 'En attente');
      case 'bloque':
        return t('complexeGerant.frise.bloque', 'Bloqué');
      case 'exterieur':
        return t('complexeGerant.frise.exterieur', 'Réservé à l’extérieur');
      case 'ferme':
        return t('complexeGerant.frise.ferme', 'Fermé');
      default:
        return t('complexeGerant.frise.libre', 'Libre');
    }
  };

  /**
   * Le style d'un créneau selon son état.
   * @param {EtatDuCreneau} etat - L'état.
   * @param {string} couleur - La couleur du sport.
   * @returns {import('react-native').ViewStyle} Le style.
   */
  const styleDe = (etat, couleur) => {
    switch (etat) {
      case 'app':
        return { backgroundColor: withAlpha(couleur, 0.85), borderColor: couleur };
      case 'attente':
        return {
          backgroundColor: 'transparent',
          borderColor: Colors.warning500,
          borderStyle: 'dashed',
        };
      case 'bloque':
        return {
          backgroundColor: withAlpha(Colors.primary200, 0.14),
          borderColor: withAlpha(Colors.primary200, 0.4),
        };
      case 'exterieur':
        return { backgroundColor: withAlpha(couleur, 0.3), borderColor: couleur };
      case 'ferme':
        return {
          backgroundColor: withAlpha(Colors.warning500, 0.2),
          borderColor: Colors.warning500,
        };
      default:
        return {
          backgroundColor: 'transparent',
          borderColor: withAlpha(Colors.primary500, 0.6),
          borderStyle: 'dashed',
        };
    }
  };

  const caseDuCreneau = (
    /** @type {LigneDeLaFrise} */ ligne,
    /** @type {CreneauDeLaFrise} */ creneau,
  ) => {
    const de = Number(minutesDe(creneau.from));
    const a = Number(minutesDe(creneau.to));
    const couleur = ligne.couleur || Colors.primary500;
    const libelle = creneau.libelle || libelleDe(creneau.etat);
    return (
      <View
        accessibilityLabel={t(
          'complexeGerant.frise.a11y',
          '{{terrain}}, {{de}} – {{a}}, {{etat}}',
          {
            a: texteHeure(creneau.to),
            de: texteHeure(creneau.from),
            etat: libelleDe(creneau.etat).toLowerCase(),
            terrain: ligne.nom,
            ...SANS_ECHAPPEMENT,
          },
        )}
        accessible
        key={`${ligne.cle}-${creneau.from}`}
        style={[
          Alignments.justifyCenter,
          {
            borderRadius: 8,
            borderWidth: 1,
            height: HAUTEUR - 8,
            left: (de - debut) * PAR_MINUTE + 1,
            paddingHorizontal: 6,
            position: 'absolute',
            top: 4,
            width: Math.max(8, (a - de) * PAR_MINUTE - 2),
          },
          styleDe(creneau.etat, couleur),
        ]}
        testID={`frise-creneau-${ligne.cle}-${creneau.from}`}
      >
        <Text numberOfLines={1} style={[Fonts.p4Bold, Fonts.primary100]}>{libelle}</Text>
      </View>
    );
  };

  const traitDeLHeure = maintenant >= debut && maintenant <= fin ? (
    <View
      pointerEvents="none"
      style={{
        backgroundColor: Colors.primary500,
        bottom: 0,
        left: (maintenant - debut) * PAR_MINUTE,
        position: 'absolute',
        top: 18,
        width: 2,
      }}
      testID="frise-maintenant"
    />
  ) : null;

  return (
    <View style={{ gap: 8 }} testID="frise-du-jour">
      <View style={[Alignments.row, { gap: 8 }]}>
        <View style={{ paddingTop: 18, width: largeurNoms }} testID="frise-noms">
          {lignes.map((ligne) => (
            <View key={ligne.cle} style={[Alignments.justifyCenter, { height: HAUTEUR }]}>
              <Text numberOfLines={2} style={[Fonts.p3Bold, Fonts.neutral00]}>{ligne.nom}</Text>
            </View>
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
          <View style={{ width: largeur + 24 }}>
            <View style={{ height: 18 }}>
              {heures.map((minutes) => (
                <Text
                  key={minutes}
                  style={[
                    Fonts.p4,
                    Fonts.neutral200,
                    { left: (minutes - debut) * PAR_MINUTE, position: 'absolute' },
                  ]}
                >
                  {texteHeure(heureDe(minutes))}
                </Text>
              ))}
            </View>
            {lignes.map((ligne) => (
              <View key={ligne.cle} style={{ height: HAUTEUR, width: largeur }}>
                {ligne.creneaux.map((creneau) => caseDuCreneau(ligne, creneau))}
              </View>
            ))}
            {traitDeLHeure}
          </View>
        </ScrollView>
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ expanded: legende }}
        onPress={() => setLegende(!legende)}
        style={[Alignments.justifyCenter, { alignSelf: 'flex-start', minHeight: 44 }]}
        testID="frise-legende"
      >
        <Text style={[Fonts.p3Bold, Fonts.primary500]}>
          {t('complexeGerant.frise.legende', 'Légende')}
        </Text>
      </TouchableOpacity>
      {legende ? (
        <View style={[Alignments.row, Alignments.wrap, { gap: 8 }]}>
          {ETATS.map((etat) => (
            <View key={etat} style={[Alignments.row, Alignments.alignCenter, { gap: 6 }]}>
              <View
                style={[
                  {
                    borderRadius: 4, borderWidth: 1, height: 14, width: 22,
                  },
                  styleDe(etat, Colors.primary500),
                ]}
              />
              <Text style={[Fonts.p3, Fonts.neutral100]}>{libelleDe(etat)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default FriseDuJour;
