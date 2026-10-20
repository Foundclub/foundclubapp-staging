import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, Text, TouchableOpacity, View,
} from 'react-native';

import {
  checkPill,
  checkShortDate,
  currentChecks,
} from '@/domains/facilityCheck/facilityCheckDisplay';
import {
  reportAuthorLabel,
  reportDayLabel,
  reportShortSpan,
  reportStatusTone,
  securityHistory,
  splitReports,
} from '@/domains/facilityReport/facilityReportDisplay';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import EmptyState from '@/components/atoms/emptyState/EmptyState';
import SkeletonLoader from '@/components/atoms/skeletonLoader/SkeletonLoader';

import { RouteNames } from '@/navigation/routeNames';

import { useFacilityChecks } from '@/services/facilityCheck/facilityCheckQueries';
import { useFacilityReports } from '@/services/facilityReport/facilityReportQueries';

import { getImageUrl } from '@/utils/imageUrl';

import { useIsDesktop } from '@/responsive';

// Planche A : l historique se lit en 3 jalons, puis « Voir tout l historique ».
const JALONS_VISIBLES = 3;
// R17-CONTROLES — planche A : la colonne des controles (380) a droite, quand l onglet a la place
// (ordinateur, aucun panneau ouvert) ; sinon elle passe sous l historique (planche tel 1).
const LARGEUR_DEUX_COLONNES = 880;
const LARGEUR_DU_CARNET = 380;

/**
 * R17-SIGNALER-1 (19/10, REC17-011) — le 5ᵉ ONGLET de la fiche d une installation, cote Ville :
 * « Sécurité et suivi » (planches P10-securite-ordi A, D, E, F et P10-securite-tel 1, validees par
 * Adel le 19/10). En tete l ETAT, deduit par le serveur (Q5 A) ; puis les signalements OUVERTS, la
 * securite d abord ; puis l HISTORIQUE (signalements traites, fermetures). Le carnet des controles
 * (Q6 B, lot R17-CONTROLES, 20/10) : a droite sur ordinateur, sous l historique au telephone ;
 * un appui ouvre un controle (`onOpenCheck`), « Ajouter un contrôle » le formulaire
 * (`onAddCheck`). Les controles faits et les seances d une fermeture (« 6 séances touchées,
 * 4 déplacées ») sont des jalons.
 * La Ville est vouvoyee. Aucun nom de membre : le serveur ne rend que celui d un encadrant (Q2 A).
 * Un signalement s ouvre par `onOpenReport` quand l ecran le donne (sur ordinateur, le PANNEAU de
 * droite, planche B) ; sinon en page (le telephone).
 * Au TELEPHONE (planche tel 1), la carte est compacte (titre, pastille dessous, « Sécurité ·
 * sam. 18 oct. ») et l historique abrege (« 6 – 14 oct. · « Joint changé. » »).
 * @param {{ facilityId: string | null, onAddCheck?: () => void,
 *   onOpenCheck?: (series: string) => void, onOpenClosures?: () => void,
 *   onOpenReport?: (reportId: string) => void, selectedReportId?: string | null }} props
 * @returns {import('react').ReactElement} L onglet.
 */
function FacilitySecurityTab({
  facilityId, onAddCheck, onOpenCheck, onOpenClosures, onOpenReport, selectedReportId = null,
}) {
  const { t } = useTranslation();
  const { Colors, Fonts, Images } = useTheme();
  const isDesktop = useIsDesktop();
  const navigation = /** @type {any} */ (useNavigation());
  const suivi = useFacilityReports(facilityId);
  const carnet = useFacilityChecks(facilityId);
  const [toutLHistorique, setToutLHistorique] = useState(false);
  const [largeur, setLargeur] = useState(0);
  const ouvrir = (/** @type {string} */ reportId) => {
    if (onOpenReport) {
      onOpenReport(reportId);
      return;
    }
    navigation.navigate(RouteNames.FacilityReportDetails, { espace: 'ville', reportId });
  };

  if (suivi.isLoading) {
    // Planche F (« comme les autres onglets ») : le squelette du projet, deux blocs de 56 et 80 —
    // l etat, puis une carte — au lieu d une roue. Un bloc du squelette a un FOND : c est lui que
    // le masque du chatoiement dessine (motif CollectiviteRequests, COLL-C3B-BIS).
    const bloc = { backgroundColor: Colors.primary700, borderRadius: 8 };
    return (
      <View accessibilityState={{ busy: true }} testID="securite-chargement">
        <SkeletonLoader isActive wrapperStyle={[{ gap: 12 }]}>
          <View style={[bloc, { height: 56 }]} />
          <View style={[bloc, { height: 80 }]} />
        </SkeletonLoader>
      </View>
    );
  }
  if (suivi.isError || !suivi.data) {
    return (
      <View style={{ gap: 12, padding: 16 }} testID="securite-erreur">
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
          {t('facilityReports.ville.erreur', 'Le suivi n’a pas pu être chargé.')}
        </Text>
        <Button
          onPress={() => suivi.refetch?.()}
          size="sm"
          title={t('facilityReports.ville.reessayer', 'Réessayer')}
          variant="Secondary"
        />
      </View>
    );
  }

  const reports = Array.isArray(suivi.data?.data) ? suivi.data.data : [];
  const meta = suivi.data?.meta || {};
  const state = meta.state || { code: 'en_service' };
  const { ouverts, traites } = splitReports(reports);
  const jalons = securityHistory(traites, meta.closures, carnet.data?.data);
  const jalonsVisibles = toutLHistorique ? jalons : jalons.slice(0, JALONS_VISIBLES);

  const tons = {
    a_surveiller: Colors.warning500,
    en_service: Colors.success500,
    fermee: Colors.error500,
  };
  const { code } = /** @type {{ code: 'a_surveiller' | 'en_service' | 'fermee' }} */ (state);
  const couleurEtat = tons[code] || Colors.success500;
  const motif = state.closure?.reason
    ? t(`collectiviteFermetures.motifs.${state.closure.reason}`, state.closure.reason)
    : null;
  let phraseEtat = t(
    'facilityReports.ville.etatEnService',
    'Aucun signalement ouvert, aucune fermeture en cours.',
  );
  if (state.code === 'a_surveiller') {
    phraseEtat = t('facilityReports.ville.etatASurveiller', {
      ...SANS_ECHAPPEMENT,
      count: state.securityOpenCount || 1,
      date: reportDayLabel(state.securitySince),
    });
  }
  if (state.code === 'fermee' && state.closure) {
    const jours = {
      debut: reportDayLabel(state.closure.startDate),
      fin: reportDayLabel(state.closure.endDate),
    };
    phraseEtat = motif
      ? t('facilityReports.ville.etatFermeeMotif', { ...SANS_ECHAPPEMENT, ...jours, motif })
      : t('facilityReports.ville.etatFermee', jours);
  }

  const pastille = (/** @type {string} */ status) => {
    const ton = reportStatusTone(status);
    const couleur = {
      neutral: Colors.neutral300,
      primary: Colors.primary500,
      success: Colors.success500,
      warning: Colors.warning500,
    }[ton];
    return (
      <View
        style={{
          alignSelf: 'flex-start',
          backgroundColor: withAlpha(couleur, 0.16),
          borderRadius: 999,
          paddingHorizontal: 10,
          paddingVertical: 2,
        }}
      >
        <Text style={[Fonts.p3Bold, { color: couleur }]}>
          {t(`facilityReports.statuts.${status}`, status)}
        </Text>
      </View>
    );
  };

  /**
   * Le titre et le detail d un signalement clos (planches A et tel 1).
   * @param {any} item - Le signalement.
   * @returns {{ couleur: string, detail: string, titre: string }} Les lignes.
   */
  const decrireSignalement = (item) => {
    const resolu = item.status === 'resolu';
    const couleur = resolu ? Colors.success500 : Colors.neutral300;
    const titre = resolu
      ? t('facilityReports.ville.histoResolu', { ...SANS_ECHAPPEMENT, title: item.title })
      : t('facilityReports.ville.histoSansSuite', { ...SANS_ECHAPPEMENT, title: item.title });
    const court = isDesktop ? null : reportShortSpan(item.createdAt, item.closedAt);
    if (court) {
      // Planche tel 1 : « 6 – 14 oct. · « Joint changé. » ».
      const periode = 'jour' in court
        ? court.jour
        : t('facilityReports.ville.histoPeriode', { ...SANS_ECHAPPEMENT, ...court });
      return {
        couleur,
        detail: item.cityNote
          ? t('facilityReports.ville.histoCourtMot', {
            ...SANS_ECHAPPEMENT,
            note: item.cityNote,
            periode,
          })
          : periode,
        titre,
      };
    }
    const dates = { debut: reportDayLabel(item.createdAt), fin: reportDayLabel(item.closedAt) };
    if (item.cityNote) {
      return {
        couleur,
        detail: t(
          resolu
            ? 'facilityReports.ville.histoDatesMot'
            : 'facilityReports.ville.histoDatesSansSuiteMot',
          { ...SANS_ECHAPPEMENT, ...dates, note: item.cityNote },
        ),
        titre,
      };
    }
    return {
      couleur,
      detail: t(
        resolu ? 'facilityReports.ville.histoDates' : 'facilityReports.ville.histoDatesSansSuite',
        dates,
      ),
      titre,
    };
  };

  /**
   * Les seances d une fermeture (R17-CONTROLES, reste de R17-SIGNALER-1) : « 6 séances touchées,
   * 4 déplacées » ; null pour une fermeture d avant (le serveur n a pas le nombre).
   * @param {any} item - La fermeture (meta.closures).
   * @param {boolean} avecDeplacees - Faux au telephone (planche tel 1 : « 6 séances touchées »).
   * @returns {string | null} Le texte, ou null.
   */
  const seancesDeLaFermeture = (item, avecDeplacees) => {
    if (typeof item?.touchedSessionsCount !== 'number') return null;
    const touchees = t('facilityReports.ville.seancesTouchees', {
      ...SANS_ECHAPPEMENT,
      count: item.touchedSessionsCount,
    });
    const deplacees = Number(item.movedSessionsCount) || 0;
    if (!avecDeplacees || !deplacees) return touchees;
    return t('facilityReports.ville.seancesEtDeplacees', {
      ...SANS_ECHAPPEMENT,
      deplacees: t('facilityReports.ville.seancesDeplacees', {
        ...SANS_ECHAPPEMENT,
        count: deplacees,
      }),
      touchees,
    });
  };

  /**
   * Le titre et le detail d un jalon de l historique (signalement, fermeture, controle fait).
   * @param {any} item - L element.
   * @param {'report' | 'closure' | 'check'} kind - Sa sorte.
   * @returns {{ couleur: string, detail: string, titre: string }} Les lignes.
   */
  const decrireJalon = (item, kind) => {
    if (kind === 'check') {
      // R17-CONTROLES (planches A et tel 1) : « Contrôle : Buts et paniers », puis la date, qui
      // l a fait et (ordinateur) le prochain.
      const titreDuControle = t('facilityReports.controles.histoTitre', {
        ...SANS_ECHAPPEMENT,
        label: item.label,
      });
      if (!isDesktop) {
        const date = reportShortSpan(item.doneOn, null);
        const jour = date && 'jour' in date ? date.jour : '';
        return {
          couleur: Colors.primary200,
          detail: item.doneBy
            ? t('facilityReports.controles.histoCourt', {
              ...SANS_ECHAPPEMENT,
              date: jour,
              par: item.doneBy,
            })
            : jour,
          titre: titreDuControle,
        };
      }
      const valeurs = {
        ...SANS_ECHAPPEMENT,
        date: reportDayLabel(item.doneOn),
        par: item.doneBy,
        prochain: checkShortDate(item.nextDue),
      };
      return {
        couleur: Colors.primary200,
        detail: item.doneBy
          ? t('facilityReports.controles.histoDetail', valeurs)
          : t('facilityReports.controles.histoDetailSansPar', valeurs),
        titre: titreDuControle,
      };
    }
    if (kind === 'report') return decrireSignalement(item);
    const motifDuJalon = item.reason
      ? t(`collectiviteFermetures.motifs.${item.reason}`, item.reason)
      : item.label || '';
    const rouverte = item.status === 'reopened';
    const jours = { debut: reportDayLabel(item.startDate), fin: reportDayLabel(item.endDate) };
    if (isDesktop) {
      const seances = seancesDeLaFermeture(item, true);
      if (seances !== null) {
        // Planche A : « Fermé du 5 au 9 oct. · réfection du sol » / « Fermeture · 6 séances
        // touchées, 4 déplacées ».
        return {
          couleur: Colors.warning500,
          detail: rouverte
            ? t('facilityReports.ville.histoRouverte', 'Fermeture · rouverte')
            : t('facilityReports.ville.histoFermetureSeances', { ...SANS_ECHAPPEMENT, seances }),
          titre: t('facilityReports.ville.histoFermetureTitreMotif', {
            ...SANS_ECHAPPEMENT,
            ...jours,
            motif: item.reason ? motifDuJalon.toLocaleLowerCase() : motifDuJalon,
          }),
        };
      }
      return {
        couleur: Colors.warning500,
        detail: rouverte
          ? t('facilityReports.ville.histoRouverte', 'Fermeture · rouverte')
          : t('facilityReports.ville.histoFermetureMotif', {
            ...SANS_ECHAPPEMENT,
            motif: motifDuJalon,
          }),
        titre: t('facilityReports.ville.histoFermeture', { ...SANS_ECHAPPEMENT, ...jours }),
      };
    }
    // Planche tel 1 : « Fermé du 5 au 9 oct. », puis « Réfection du sol · 6 séances touchées ».
    const periode = reportShortSpan(item.startDate, item.endDate);
    let titre = t('facilityReports.ville.histoFermeture', { ...SANS_ECHAPPEMENT, ...jours });
    if (periode && 'jour' in periode) {
      titre = t('facilityReports.ville.histoFermetureJour', {
        ...SANS_ECHAPPEMENT,
        jour: periode.jour,
      });
    } else if (periode) {
      titre = t('facilityReports.ville.histoFermeture', { ...SANS_ECHAPPEMENT, ...periode });
    }
    const seances = seancesDeLaFermeture(item, false);
    let detail = motifDuJalon;
    if (rouverte) detail = t('facilityReports.ville.histoRouverte', 'Fermeture · rouverte');
    else if (seances !== null) {
      detail = t('facilityReports.ville.histoMotifSeances', {
        ...SANS_ECHAPPEMENT,
        motif: motifDuJalon,
        seances,
      });
    }
    return { couleur: Colors.warning500, detail, titre };
  };

  const lignesDuCarnet = currentChecks(carnet.data?.data);
  const jourDuCarnet = carnet.data?.meta?.today || meta.today || '';
  const tonsDuCarnet = {
    error: Colors.error500,
    success: Colors.success500,
    warning: Colors.warning500,
  };
  let contenuDuCarnet = null;
  if (carnet.isLoading) {
    contenuDuCarnet = (
      <SkeletonLoader isActive wrapperStyle={[{ gap: 8 }]}>
        <View style={{ backgroundColor: Colors.primary700, borderRadius: 8, height: 56 }} />
      </SkeletonLoader>
    );
  } else if (carnet.isError || !carnet.data) {
    contenuDuCarnet = (
      <View style={{ gap: 8 }} testID="securite-controles-erreur">
        <Text style={[Fonts.p3, Fonts.neutral100]}>
          {t('facilityReports.controles.erreur', 'Les contrôles n’ont pas pu être chargés.')}
        </Text>
        <Button
          onPress={() => carnet.refetch?.()}
          size="sm"
          title={t('facilityReports.ville.reessayer', 'Réessayer')}
          variant="Secondary"
        />
      </View>
    );
  } else if (!lignesDuCarnet.length) {
    contenuDuCarnet = (
      <View style={{ gap: 4 }}>
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
          {t('facilityReports.controles.videTitre', 'Aucun contrôle noté')}
        </Text>
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {t(
            'facilityReports.controles.videTexte',
            'Notez ici vos contrôles obligatoires : FoundClub vous prévient 30 jours avant '
              + 'chaque échéance.',
          )}
        </Text>
      </View>
    );
  } else {
    contenuDuCarnet = lignesDuCarnet.map((ligne, rang) => {
      const pastilleDuControle = checkPill(t, ligne, jourDuCarnet);
      const couleur = tonsDuCarnet[pastilleDuControle.tone];
      return (
        <TouchableOpacity
          accessibilityLabel={t('facilityReports.controles.ouvrir', {
            ...SANS_ECHAPPEMENT,
            label: ligne.label,
          })}
          accessibilityRole="button"
          key={ligne.series}
          onPress={() => onOpenCheck?.(ligne.series)}
          style={{
            alignItems: 'center',
            borderTopColor: withAlpha(Colors.neutral00, 0.08),
            borderTopWidth: rang ? 1 : 0,
            flexDirection: 'row',
            gap: 12,
            minHeight: 56,
            paddingVertical: 8,
          }}
          testID={`controle-${ligne.series}`}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{ligne.label}</Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {t('facilityReports.controles.prochain', {
                ...SANS_ECHAPPEMENT,
                date: checkShortDate(ligne.nextDue),
              })}
            </Text>
          </View>
          <View
            style={{
              backgroundColor: withAlpha(couleur, 0.16),
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 2,
            }}
          >
            <Text style={[Fonts.p3Bold, { color: couleur }]}>{pastilleDuControle.label}</Text>
          </View>
        </TouchableOpacity>
      );
    });
  }
  // Planche A (colonne de droite), tel 1 (bloc sous l historique) : le carnet des controles.
  const blocDuCarnet = (
    <View
      style={{
        backgroundColor: withAlpha(Colors.neutral00, 0.04),
        borderColor: withAlpha(Colors.neutral00, 0.1),
        borderRadius: 16,
        borderWidth: 1,
        gap: 10,
        padding: 16,
      }}
      testID="securite-controles"
    >
      <Text accessibilityRole="header" style={[Fonts.h5Bold, Fonts.neutral00]}>
        {t('facilityReports.controles.titre', 'Contrôles obligatoires')}
      </Text>
      {contenuDuCarnet}
      <Button
        icon="plus"
        iconPosition="before"
        onPress={() => onAddCheck?.()}
        size="sm"
        title={t('facilityReports.controles.ajouter', 'Ajouter un contrôle')}
        variant="Secondary"
      />
      {lignesDuCarnet.length ? (
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {t(
            'facilityReports.controles.rappel',
            'Un rappel arrive 30 jours avant chaque échéance.',
          )}
        </Text>
      ) : null}
    </View>
  );
  const deuxColonnes = largeur >= LARGEUR_DEUX_COLONNES;

  // La colonne principale : l etat, les signalements ouverts, l historique.
  const colonnePrincipale = (
    <View style={deuxColonnes ? { flex: 1, gap: 16, minWidth: 0 } : { gap: 16 }}>
      <View
        accessibilityRole="summary"
        style={{
          backgroundColor: withAlpha(couleurEtat, 0.1),
          borderColor: withAlpha(couleurEtat, 0.45),
          borderRadius: 16,
          borderWidth: 1,
          gap: 4,
          padding: 14,
        }}
        testID={`securite-etat-${state.code}`}
      >
        <Text style={[Fonts.h5Bold, { color: couleurEtat }]}>
          {String(t(
            /** @type {string} */ (`facilityReports.ville.etat.${state.code}`),
            state.code,
          ))}
        </Text>
        <Text style={[Fonts.p3, Fonts.neutral100]}>{phraseEtat}</Text>
        {state.code === 'fermee' && onOpenClosures ? (
          <Button
            onPress={onOpenClosures}
            size="sm"
            title={t('facilityReports.ville.voirFermetures', 'Fermetures')}
            variant="Secondary"
          />
        ) : null}
      </View>

      {reports.length === 0 ? (
        <EmptyState
          description={t(
            'facilityReports.ville.videTexte',
            'Les membres des clubs qui utilisent l’installation peuvent signaler un problème '
          + 'depuis son planning ou depuis une séance. '
          + 'Vous êtes prévenus à chaque signalement.',
          )}
          title={t('facilityReports.ville.videTitre', 'Aucun signalement')}
        />
      ) : null}

      {ouverts.length ? (
        <View style={{ gap: 10 }}>
          <View style={{ gap: 2 }}>
            <Text accessibilityRole="header" style={[Fonts.h5Bold, Fonts.neutral00]}>
              {t('facilityReports.ville.ouverts', { ...SANS_ECHAPPEMENT, count: ouverts.length })}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {t(
                'facilityReports.ville.ouvertsSous',
                'Reçus des membres des clubs qui utilisent l’installation',
              )}
            </Text>
          </View>
          {ouverts.map((report) => (
            <TouchableOpacity
              accessibilityLabel={t('facilityReports.ville.ouvrirFiche', {
                ...SANS_ECHAPPEMENT,
                title: report.title,
              })}
              accessibilityRole="button"
              accessibilityState={{ selected: report.documentId === selectedReportId }}
              key={report.documentId}
              onPress={() => ouvrir(report.documentId)}
              style={{
                backgroundColor: withAlpha(Colors.neutral00, 0.04),
                borderColor:
              report.status === 'envoye'
                ? withAlpha(Colors.warning500, 0.5)
                : withAlpha(Colors.neutral00, 0.1),
                // Planche B : le signalement ouvert dans le panneau se lit dans la liste.
                ...(report.documentId === selectedReportId ? {
                  backgroundColor: withAlpha(Colors.primary500, 0.12),
                  borderColor: Colors.primary500,
                } : {}),
                borderRadius: 14,
                borderWidth: 1,
                flexDirection: 'row',
                gap: 12,
                minHeight: 44,
                padding: 12,
              }}
              testID={`securite-signalement-${report.documentId}`}
            >
              {/* Planche A : la vignette, 56 x 56 — la photo jointe, sinon l icone du statut. */}
              <View
                style={{
                  alignItems: 'center',
                  backgroundColor: withAlpha(Colors.primary500, 0.18),
                  borderRadius: 10,
                  height: 56,
                  justifyContent: 'center',
                  overflow: 'hidden',
                  width: 56,
                }}
                testID={`securite-vignette-${report.documentId}`}
              >
                {report.photo?.url ? (
                  <Image
                    accessibilityIgnoresInvertColors
                    resizeMode="cover"
                    source={{
                      uri: getImageUrl(report.photo.formats?.thumbnail?.url || report.photo.url),
                    }}
                    style={{ height: 56, width: 56 }}
                  />
                ) : (
                  <Image
                    source={report.status === 'envoye' ? Images.stadium : Images.clock}
                    style={{ height: 20, tintColor: Colors.primary200, width: 20 }}
                  />
                )}
              </View>
              {isDesktop ? (
                <View style={{ flex: 1, gap: 4 }}>
                  <View
                    style={{
                      alignItems: 'center',
                      flexDirection: 'row',
                      gap: 8,
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text numberOfLines={2} style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>
                      {report.title}
                    </Text>
                    {pastille(report.status)}
                  </View>
                  <Text numberOfLines={2} style={[Fonts.p3, Fonts.neutral100]}>
                    {`${t(
                      `facilityReports.categoriesCourtes.${report.category}`,
                      report.category,
                    )} · « ${report.description} »`}
                  </Text>
                  <Text style={[Fonts.p3, Fonts.neutral200]}>
                    {`${reportDayLabel(report.createdAt)} · ${reportAuthorLabel(t, report)}`}
                  </Text>
                </View>
              ) : (
              // Planche tel 1 : le titre, la pastille DESSOUS, « Sécurité · sam. 18 oct. ».
                <View style={{ flex: 1, gap: 4 }}>
                  <Text numberOfLines={2} style={[Fonts.p2Bold, Fonts.neutral00]}>
                    {report.title}
                  </Text>
                  {pastille(report.status)}
                  <Text style={[Fonts.p3, Fonts.neutral200]}>
                    {`${t(
                      `facilityReports.categoriesCourtes.${report.category}`,
                      report.category,
                    )} · ${reportDayLabel(report.createdAt)}`}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {jalons.length ? (
        <View style={{ gap: 10 }} testID="securite-historique">
          <Text accessibilityRole="header" style={[Fonts.h5Bold, Fonts.neutral00]}>
            {t('facilityReports.ville.historique', 'Historique')}
          </Text>
          {jalonsVisibles.map(({ item, kind }) => {
            const { couleur, detail, titre } = decrireJalon(item, kind);
            // Un signalement s ouvre ; un controle fait ouvre sa serie ; une fermeture se lit.
            const ouvrable = kind === 'report' || (kind === 'check' && Boolean(onOpenCheck));
            return (
              <TouchableOpacity
                accessibilityRole={ouvrable ? 'button' : 'text'}
                disabled={!ouvrable}
                key={`${kind}-${item.documentId}`}
                onPress={() => (kind === 'check'
                  ? onOpenCheck?.(item.series)
                  : ouvrir(item.documentId))}
                style={{ flexDirection: 'row', gap: 10, minHeight: 44 }}
                testID={`securite-jalon-${kind}-${item.documentId}`}
              >
                <View
                  style={{
                    backgroundColor: couleur,
                    borderRadius: 5,
                    height: 10,
                    marginTop: 6,
                    width: 10,
                  }}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{titre}</Text>
                  <Text style={[Fonts.p3, Fonts.neutral200]}>{detail}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
          {jalons.length > JALONS_VISIBLES && !toutLHistorique ? (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => setToutLHistorique(true)}
              style={{
                alignItems: 'center',
                alignSelf: 'flex-start',
                flexDirection: 'row',
                gap: 8,
                minHeight: 44,
              }}
              testID="securite-historique-tout"
            >
              <Text style={[Fonts.p2Bold, Fonts.primary500]}>
                {t('facilityReports.ville.voirToutHistorique', 'Voir tout l’historique')}
              </Text>
              <Image
                source={Images.arrowRight}
                style={{ height: 12, tintColor: Colors.primary500, width: 12 }}
              />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  return (
    // La CLE monte une racine neuve apres le squelette : react-native-web n observe la largeur
    // (onLayout) qu au MONTAGE d une vue ; sans elle, la racine du squelette etait reutilisee et
    // le carnet restait sous l historique sur ordinateur (banc du site du 20/10, 1 360 px).
    <View
      key="onglet-securite"
      onLayout={(evenement) => setLargeur(evenement.nativeEvent.layout.width)}
      testID="onglet-securite"
    >
      <View
        style={deuxColonnes
          ? { alignItems: 'flex-start', flexDirection: 'row', gap: 24 }
          : { gap: 16 }}
        testID="securite-colonnes"
      >
        {colonnePrincipale}
        {deuxColonnes ? (
          <View style={{ width: LARGEUR_DU_CARNET }}>{blocDuCarnet}</View>
        ) : blocDuCarnet}
      </View>
    </View>
  );
}

export default FacilitySecurityTab;
