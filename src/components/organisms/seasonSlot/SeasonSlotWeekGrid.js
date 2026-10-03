import { useTranslation } from 'react-i18next';
import {
  Pressable, Text, TouchableOpacity, View,
} from 'react-native';

import {
  fromMinutes,
  fullRangesOfSlots,
  SEASON_SLOT_WEEKDAYS,
  slotWho,
  timeRange,
  weekdayName,
  weekGridLanes,
  weekGridRows,
} from '@/domains/seasonSlot/seasonSlotDisplay';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

// Une minute = un point : 60 px par heure (la planche en dessine 56).
const PAR_MINUTE = 1;
const LARGEUR_DES_HEURES = 56;
// Une case vide par demi-heure ; « Attribuer » propose 1 h 30, comme le planning (P5v2).
const PAS_DES_CASES = 30;
const DUREE_PROPOSEE = 90;
const FIN_DU_JOUR = (23 * 60) + 59;

/**
 * 📐 COLL-C2B-BIS (03/10) — planche 23, ORDINATEUR : la semaine type de l installation A L ECHELLE
 * DES HEURES (design HY521H1, P4v2-creneaux-ordi, etat A). La colonne des heures a gauche, sept
 * colonnes de jours ; chaque creneau est un bloc a sa hauteur, deux creneaux a la meme heure se
 * posent cote a cote (le jeudi complet, teinte). Les heures sans aucun creneau se replient en une
 * ligne (« Aucun creneau de 12:00 a 17:30 »).
 *
 * La mairie clique un bloc pour le gerer, ou une case VIDE pour attribuer : le panneau s ouvre
 * deja rempli du jour et de l heure. Sans `onAttribuer` (un lecteur qui ne gere pas), aucune case.
 * ⛔ Aucun nom de personne : un club, une equipe, des heures.
 * @param {{
 *   capacite: number,
 *   creneaux: any[],
 *   fermeture?: number | null,
 *   onAttribuer?: (initial: { endTime: string, startTime: string, weekday: number }) => void,
 *   onCreneau: (creneau: any) => void,
 *   ouverture?: number | null,
 * }} props - `ouverture` et `fermeture` en minutes depuis minuit.
 * @returns {import('react').ReactElement} La grille.
 */
function SeasonSlotWeekGrid({
  capacite,
  creneaux,
  fermeture = null,
  onAttribuer,
  onCreneau,
  ouverture = null,
}) {
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const trait = withAlpha(Colors.neutral00, 0.08);
  const lignes = weekGridRows(creneaux, { fermeture, ouverture });
  const jours = SEASON_SLOT_WEEKDAYS.map((jour) => {
    const duJour = creneaux.filter((creneau) => Number(creneau?.weekday) === jour);
    return {
      complet: fullRangesOfSlots(duJour, capacite),
      jour,
      places: weekGridLanes(duJour),
    };
  });

  const enTete = (
    <View
      style={[
        Alignments.row,
        Spaces.paddingVertical[8],
        { borderBottomColor: trait, borderBottomWidth: 1 },
      ]}
    >
      <View style={{ width: LARGEUR_DES_HEURES }} />
      {jours.map(({ complet, jour }) => (
        <View key={`tete-${jour}`} style={{ alignItems: 'center', flex: 1, minWidth: 0 }}>
          <Text style={[Fonts.p3Bold, Fonts.neutral300]}>
            {weekdayName(jour, { short: true })}
          </Text>
          {complet[0] ? (
            <Text numberOfLines={1} style={[Fonts.p3, Fonts.warning500]}>
              {t('collectiviteCreneaux.creneaux.completDe', 'complet {{heures}}', {
                heures: timeRange(fromMinutes(complet[0].start), fromMinutes(complet[0].end)),
                ...SANS_ECHAPPEMENT,
              })}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );

  const ligneRepliee = (/** @type {{ debut: number, fin: number | null }} */ ligne) => (
    <View key={`creux-${ligne.debut}`} style={[Alignments.row, Spaces.paddingVertical[4]]}>
      <Text
        style={[
          Fonts.p3Bold,
          Fonts.neutral300,
          { paddingRight: 8, textAlign: 'right', width: LARGEUR_DES_HEURES },
        ]}
      >
        {fromMinutes(ligne.debut)}
      </Text>
      <View
        style={[
          Spaces.paddingHorizontal[8],
          {
            borderColor: withAlpha(Colors.neutral00, 0.12),
            borderRadius: 8,
            borderStyle: 'dashed',
            borderWidth: 1,
            flex: 1,
            justifyContent: 'center',
            minHeight: 24,
          },
        ]}
      >
        <Text style={[Fonts.p3, Fonts.neutral300]}>
          {ligne.fin === null
            ? t('collectiviteCreneaux.grille.creuxApres', 'Aucun créneau après {{debut}}', {
              debut: fromMinutes(ligne.debut),
              ...SANS_ECHAPPEMENT,
            })
            : t('collectiviteCreneaux.grille.creux', 'Aucun créneau de {{debut}} à {{fin}}', {
              debut: fromMinutes(ligne.debut),
              fin: fromMinutes(ligne.fin),
              ...SANS_ECHAPPEMENT,
            })}
        </Text>
      </View>
    </View>
  );

  const casesVides = (
    /** @type {number} */ jour,
    /** @type {{ debut: number, fin: number }} */ bande,
  ) => {
    if (!onAttribuer) return null;
    const cases = [];
    for (let minute = bande.debut; minute < bande.fin; minute += PAS_DES_CASES) cases.push(minute);
    return cases.map((minute) => (
      <Pressable
        accessibilityLabel={t(
          'collectiviteCreneaux.grille.caseVide',
          'Attribuer le {{jour}} à {{heure}}',
          {
            heure: fromMinutes(minute),
            jour: weekdayName(jour).toLocaleLowerCase(),
            ...SANS_ECHAPPEMENT,
          },
        )}
        accessibilityRole="button"
        key={`case-${jour}-${minute}`}
        onPress={() => onAttribuer({
          endTime: fromMinutes(Math.min(minute + DUREE_PROPOSEE, fermeture ?? FIN_DU_JOUR)),
          startTime: fromMinutes(minute),
          weekday: jour,
        })}
        // Sur le site, la case survolee se montre (« + Attribuer ») ; au repos, rien.
        style={(etat) => [
          {
            borderRadius: 8,
            height: Math.min(PAS_DES_CASES, bande.fin - minute) * PAR_MINUTE,
            justifyContent: 'center',
            left: 2,
            position: 'absolute',
            right: 2,
            top: (minute - bande.debut) * PAR_MINUTE,
          },
          /** @type {any} */ (etat).hovered ? {
            backgroundColor: withAlpha(Colors.primary500, 0.08),
            borderColor: withAlpha(Colors.primary500, 0.4),
            borderStyle: 'dashed',
            borderWidth: 1,
          } : null,
        ]}
        testID={`case-vide-${jour}-${fromMinutes(minute)}`}
      >
        {(etat) => (/** @type {any} */ (etat).hovered ? (
          <Text style={[Fonts.p3Bold, Fonts.primary200, { textAlign: 'center' }]}>
            {`+ ${t('collectiviteCreneaux.creneaux.attribuerCourt', 'Attribuer')}`}
          </Text>
        ) : null)}
      </Pressable>
    ));
  };

  const bloc = (
    /** @type {{ creneau: any, debut: number, fin: number, voie: number, voies: number }} */ place,
    /** @type {{ debut: number }} */ bande,
  ) => {
    const { creneau } = place;
    const heures = timeRange(fromMinutes(place.debut), fromMinutes(place.fin));
    return (
      <TouchableOpacity
        accessibilityLabel={t(
          'collectiviteCreneaux.creneaux.ouvrirCreneau',
          '{{qui}}, {{jour}} {{heures}}',
          {
            heures,
            jour: weekdayName(creneau.weekday).toLocaleLowerCase(),
            qui: slotWho(creneau),
            ...SANS_ECHAPPEMENT,
          },
        )}
        accessibilityRole="button"
        key={creneau.documentId}
        onPress={() => onCreneau(creneau)}
        style={{
          height: Math.max(20, ((place.fin - place.debut) * PAR_MINUTE) - 2),
          left: `${(place.voie * 100) / place.voies}%`,
          paddingHorizontal: 2,
          position: 'absolute',
          top: ((place.debut - bande.debut) * PAR_MINUTE) + 1,
          width: `${100 / place.voies}%`,
        }}
        testID={`creneau-${creneau.documentId}`}
      >
        <View
          style={[
            Spaces.paddingHorizontal[8],
            Spaces.paddingVertical[4],
            {
              backgroundColor: withAlpha(Colors.primary800, 0.92),
              borderColor: withAlpha(Colors.neutral00, 0.12),
              borderLeftColor: Colors.primary500,
              borderLeftWidth: 3,
              borderRadius: 10,
              borderWidth: 1,
              flex: 1,
              overflow: 'hidden',
            },
          ]}
        >
          <Text numberOfLines={1} style={[Fonts.p3Bold, Fonts.neutral00]}>
            {creneau.club?.name || ''}
          </Text>
          {creneau.team?.name ? (
            <Text numberOfLines={1} style={[Fonts.p3, Fonts.neutral200]}>{creneau.team.name}</Text>
          ) : null}
          {place.fin - place.debut >= 75 ? (
            <Text numberOfLines={1} style={[Fonts.p3, Fonts.neutral300]}>{heures}</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const bandeAlEchelle = (
    /** @type {{ debut: number, fin: number, reperes: number[] }} */ bande,
  ) => (
    <View
      key={`bande-${bande.debut}`}
      style={[Alignments.row, { height: (bande.fin - bande.debut) * PAR_MINUTE }]}
      testID={`grille-bande-${fromMinutes(bande.debut)}`}
    >
      <View style={{ width: LARGEUR_DES_HEURES }}>
        {bande.reperes.map((minute) => (
          <Text
            key={`repere-${minute}`}
            style={[
              Fonts.p3Bold,
              Fonts.neutral300,
              {
                paddingRight: 8,
                position: 'absolute',
                right: 0,
                top: (minute - bande.debut) * PAR_MINUTE,
              },
            ]}
          >
            {fromMinutes(minute)}
          </Text>
        ))}
      </View>
      {jours.map(({ complet, jour, places }) => (
        <View
          key={`jour-${jour}-${bande.debut}`}
          style={{
            borderLeftColor: trait, borderLeftWidth: 1, flex: 1, minWidth: 0,
          }}
        >
          {/* Le moment complet se teinte (« Jeudi teinte : complet de 18:00 a 19:30 »). */}
          {complet
            .filter((plage) => plage.end > bande.debut && plage.start < bande.fin)
            .map((plage) => (
              <View
                key={`complet-${jour}-${plage.start}`}
                pointerEvents="none"
                style={{
                  backgroundColor: withAlpha(Colors.warning500, 0.08),
                  height: (Math.min(plage.end, bande.fin) - Math.max(plage.start, bande.debut))
                    * PAR_MINUTE,
                  left: 0,
                  position: 'absolute',
                  right: 0,
                  top: (Math.max(plage.start, bande.debut) - bande.debut) * PAR_MINUTE,
                }}
              />
            ))}
          {casesVides(jour, bande)}
          {places
            .filter((place) => place.debut >= bande.debut && place.debut < bande.fin)
            .map((place) => bloc(place, bande))}
        </View>
      ))}
    </View>
  );

  const teintes = jours.filter(({ complet }) => complet.length > 0);
  return (
    <View style={{ gap: 8 }} testID="semaine-type-grille">
      <View
        style={[
          Spaces.paddingHorizontal[12],
          Spaces.paddingBottom[12],
          {
            backgroundColor: withAlpha(Colors.primary800, 0.45),
            borderColor: withAlpha(Colors.neutral00, 0.1),
            borderRadius: 16,
            borderWidth: 1,
            gap: 4,
          },
        ]}
      >
        {enTete}
        {lignes.map((ligne) => (
          ligne.type === 'bande' ? bandeAlEchelle(ligne) : ligneRepliee(ligne)
        ))}
      </View>
      {teintes.map(({ complet, jour }) => (
        <Text key={`teinte-${jour}`} style={[Fonts.p3, Fonts.neutral300]}>
          {t(
            'collectiviteCreneaux.grille.teinte',
            '{{jour}} teinté : complet de {{debut}} à {{fin}}.',
            {
              debut: fromMinutes(complet[0].start),
              fin: fromMinutes(complet[0].end),
              jour: weekdayName(jour),
              ...SANS_ECHAPPEMENT,
            },
          )}
        </Text>
      ))}
    </View>
  );
}

export default SeasonSlotWeekGrid;
