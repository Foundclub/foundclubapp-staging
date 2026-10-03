import { addDays, format, isSameDay } from 'date-fns';
import { enGB, fr } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import {
  ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import {
  closureBandLabel,
  closureHoursLabel,
  closureOfDay,
} from '@/domains/facilityClosure/facilityClosureDisplay';
import {
  capitalize,
  freeRanges,
  fromMinutes,
  fullRanges,
  slotWho,
  timeRange,
  toMinutes,
} from '@/domains/seasonSlot/seasonSlotDisplay';
import { withAlpha } from '@/theme/colors';
import localeDesFormats from '@/theme/strings/localeDesFormats';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Hachures from '@/components/atoms/hachures/Hachures';

import { getPlanningItemDate } from '@/utils/planning/planningSlots';

/**
 * Les minutes d un bloc de planning (son horloge, comme la grille).
 * @param {any} bloc - Un bloc normalise.
 * @returns {{ start: number, end: number }} Les bornes, en minutes depuis minuit.
 */
const minutesDuBloc = (bloc) => {
  const debut = toMinutes(bloc?.startTime) ?? 0;
  const fin = toMinutes(bloc?.endTime);
  return { end: fin && fin > debut ? fin : debut + 90, start: debut };
};

/**
 * 📐 COLL-C2B (02/10) — la vue « Liste » du planning d une installation (design HY521H1,
 * P5v2-vues-tel ecran 4, P5v2-vues-ordi B) : la semaine en lignes, jour par jour, avec les
 * heures LIBRES en pointille. La plus lisible pour un tour d horizon.
 *
 * La mairie touche une ligne libre ⇒ « Attribuer » (deja rempli du jour et de l heure) ; elle
 * touche un bloc ⇒ sa fiche. Sans `onFreePress`, une ligne libre n est qu une information :
 * un joueur ou un parent consulte, sans plus (aucun bouton mort).
 * ⛔ « club · equipe », jamais une personne.
 * COLL-C4B-BIS (03/10, planche 25) : `fermetures` (`meta.closures`) — UN JOUR FERME N A AUCUNE
 * PLACE : ni « Libre toute la journee », ni « Attribuer » ; un blocage retire ses heures du libre ;
 * la plage se lit, hachuree, en tete du jour (la seance touchee reste listee, D16).
 * @param {{
 *   capacite: number,
 *   debutDeSemaine: Date,
 *   evenements: any[],
 *   fermeture?: string | null,
 *   fermetures?: any[],
 *   onBlockPress?: (bloc: any) => void,
 *   onFreePress?: (jour: Date, debut: number, fin: number) => void,
 *   ouvreLesAutresClubs?: boolean,
 *   origineDe?: (bloc: any) => string | null,
 *   ouverture?: string | null,
 * }} props
 * @returns {import('react').ReactElement} La liste.
 */
function FacilityPlanningList({
  capacite,
  debutDeSemaine,
  evenements,
  fermeture = null,
  fermetures = [],
  onBlockPress,
  onFreePress,
  origineDe,
  ouverture = null,
  ouvreLesAutresClubs = false,
}) {
  const { t } = useTranslation();
  const { Colors, Fonts, Spaces } = useTheme();
  const locale = localeDesFormats() === 'en-GB' ? enGB : fr;
  const debutDuJour = toMinutes(ouverture) ?? 8 * 60;
  const finDuJour = toMinutes(fermeture) ?? 22 * 60;
  const jours = Array.from({ length: 7 }, (_, index) => addDays(debutDeSemaine, index));

  return (
    <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 24 }}>
      {jours.map((jour) => {
        const duJour = evenements
          .filter((bloc) => {
            const date = getPlanningItemDate(bloc);
            return date ? isSameDay(date, jour) : false;
          })
          .sort((a, b) => minutesDuBloc(a).start - minutesDuBloc(b).start);
        const confirmes = duJour.filter((bloc) => bloc?.raw?.pending !== true);
        const complet = fullRanges(confirmes.map(minutesDuBloc), capacite)[0];
        // COLL-C4B-BIS : la fermeture du jour. Toute la journee : aucune place. Un blocage : sa
        // plage s ajoute a ce qui est pris.
        const fermetureDuJour = closureOfDay(fermetures, format(jour, 'yyyy-MM-dd'));
        const journeeFermee = Boolean(fermetureDuJour) && fermetureDuJour.kind !== 'block';
        const plageBloquee = fermetureDuJour?.kind === 'block'
          ? {
            end: toMinutes(fermetureDuJour.endTime) ?? finDuJour,
            start: toMinutes(fermetureDuJour.startTime) ?? debutDuJour,
          }
          : null;
        const libres = journeeFermee ? [] : freeRanges(
          [...confirmes.map(minutesDuBloc), ...(plageBloquee ? [plageBloquee] : [])],
          debutDuJour,
          finDuJour,
        );
        const toutLibre = duJour.length === 0 && !fermetureDuJour;
        const titre = [
          capitalize(format(jour, 'EEEE d', { locale })),
          complet
            ? t('collectiviteCreneaux.creneaux.completDe', 'complet {{heures}}', {
              heures: timeRange(fromMinutes(complet.start), fromMinutes(complet.end)),
              ...SANS_ECHAPPEMENT,
            })
            : null,
        ].filter(Boolean).join(' · ');
        const texteLibre = toutLibre
          ? t('collectiviteCreneaux.vues.libreJournee', 'Libre toute la journée')
          : t('collectiviteCreneaux.vues.libre', 'Libre {{plages}}', {
            plages: libres.map(({ end, start }) => timeRange(fromMinutes(start), fromMinutes(end)))
              .join(' · '),
            ...SANS_ECHAPPEMENT,
          });
        let premiereLibre = toutLibre ? { end: finDuJour, start: debutDuJour } : libres[0];
        if (journeeFermee) premiereLibre = null;
        return (
          <View key={format(jour, 'yyyy-MM-dd')} style={{ gap: 6 }}>
            <Text accessibilityRole="header" style={[Fonts.p2Bold, Fonts.primary200]}>{titre}</Text>
            {fermetureDuJour ? (
              <View
                style={[
                  Spaces.padding[12],
                  {
                    borderColor: withAlpha(Colors.warning500, 0.55),
                    borderRadius: 12,
                    borderWidth: 1,
                    gap: 2,
                    overflow: 'hidden',
                  },
                ]}
                testID={`fermeture-${format(jour, 'yyyy-MM-dd')}`}
              >
                <Hachures color={Colors.warning500} />
                <Text style={[Fonts.p2Bold, Fonts.warning400]}>
                  {closureBandLabel(t, fermetureDuJour)}
                </Text>
                <Text style={[Fonts.p3, Fonts.neutral100]}>
                  {closureHoursLabel(t, fermetureDuJour)}
                </Text>
              </View>
            ) : null}
            {duJour.map((bloc, index) => {
              const enAttente = bloc?.raw?.pending === true;
              // COLL-C4B (02/10) — touchee par une fermeture : elle garde sa place (D16), cernee.
              const aDeplacer = Boolean(bloc?.raw?.closure);
              const qui = slotWho(bloc);
              const origine = origineDe ? origineDe(bloc) : null;
              const contenu = (
                <>
                  <Text numberOfLines={2} style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>
                    {enAttente
                      ? t('collectiviteCreneaux.vues.enAttente', 'En attente : {{qui}}', {
                        qui,
                        ...SANS_ECHAPPEMENT,
                      })
                      : qui}
                  </Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[Fonts.p3, Fonts.neutral200]}>
                      {timeRange(bloc.startTime, bloc.endTime)}
                    </Text>
                    {origine ? <Text style={[Fonts.p4, Fonts.neutral300]}>{origine}</Text> : null}
                    {aDeplacer ? (
                      <Text style={[Fonts.p4, Fonts.warning500]}>
                        {t('collectiviteFermetures.planning.aDeplacer', 'à déplacer')}
                      </Text>
                    ) : null}
                  </View>
                </>
              );
              const style = [
                Spaces.padding[12],
                {
                  alignItems: 'center',
                  backgroundColor: withAlpha(Colors.primary800, 0.6),
                  borderColor: enAttente || aDeplacer
                    ? Colors.warning500
                    : withAlpha(Colors.neutral00, 0.12),
                  // COLL-C4B-BIS (03/10) : Android ne trace des pointilles que si les QUATRE bords
                  // sont egaux (epaisseur, couleur) ; sinon, un trait plein (photo T10_C25_5).
                  borderLeftColor: enAttente || aDeplacer
                    ? Colors.warning500
                    : bloc.displayColor || Colors.primary500,
                  borderLeftWidth: enAttente || aDeplacer ? 1 : 3,
                  borderRadius: 12,
                  borderStyle: enAttente || aDeplacer ? 'dashed' : 'solid',
                  borderWidth: 1,
                  flexDirection: 'row',
                  gap: 8,
                },
              ];
              const cle = `${bloc.documentId || 'bloc'}-${index + 1}`;
              // Le bloc de son club s ouvre toujours ; celui d un autre, pour la mairie seulement.
              const ouvrable = Boolean(onBlockPress)
                && (Boolean(bloc.documentId) || ouvreLesAutresClubs);
              return ouvrable ? (
                <TouchableOpacity
                  accessibilityLabel={[qui, timeRange(bloc.startTime, bloc.endTime)].join(', ')}
                  accessibilityRole="button"
                  key={cle}
                  onPress={() => onBlockPress?.(bloc)}
                  style={/** @type {any} */ (style)}
                >
                  {contenu}
                </TouchableOpacity>
              ) : (
                <View accessible key={cle} style={/** @type {any} */ (style)}>{contenu}</View>
              );
            })}
            {premiereLibre && onFreePress ? (
              <TouchableOpacity
                accessibilityLabel={t(
                  'collectiviteCreneaux.vues.libreAttribuer',
                  '{{libre}} : attribuer',
                  {
                    libre: texteLibre,
                    ...SANS_ECHAPPEMENT,
                  },
                )}
                accessibilityRole="button"
                onPress={() => onFreePress(jour, premiereLibre.start, premiereLibre.end)}
                style={[
                  Spaces.padding[12],
                  {
                    alignItems: 'center',
                    borderColor: withAlpha(Colors.success500, 0.5),
                    borderRadius: 12,
                    borderStyle: 'dashed',
                    borderWidth: 1,
                    flexDirection: 'row',
                    gap: 8,
                  },
                ]}
                testID={`libre-${format(jour, 'yyyy-MM-dd')}`}
              >
                <Text style={[Fonts.p3Bold, Fonts.success500, { flex: 1 }]}>{texteLibre}</Text>
                <Text style={[Fonts.p3Bold, Fonts.primary200]}>
                  {t('collectiviteCreneaux.creneaux.attribuerCourt', 'Attribuer')}
                </Text>
              </TouchableOpacity>
            ) : null}
            {premiereLibre && !onFreePress ? (
              <Text style={[Fonts.p3, Fonts.neutral300]}>{texteLibre}</Text>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

export default FacilityPlanningList;
