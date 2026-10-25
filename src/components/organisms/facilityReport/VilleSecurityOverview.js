import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { checkDayMonth } from '@/domains/facilityCheck/facilityCheckDisplay';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

// Une liste longue est bornee : au-dela, « Voir tout » (la liste des installations, ou chaque carte
// dit ses signalements et son etat).
const LIGNES_PAR_GROUPE = 3;

/**
 * R17-SECURITE-VUE (22/10, decision d Adel « 2- A ») — LA VUE D ENSEMBLE « Sécurité et suivi »
 * de l accueil de la Ville : les signalements ouverts, les installations à surveiller, les
 * controles a refaire (30 jours) ou en retard. Elle ne lit RIEN de plus : les deux resumes que
 * l accueil lit deja (signalements, controles) ; une Ville de 20 installations = 2 appels.
 * Un appui sur une ligne ouvre l installation sur son onglet « Sécurité et suivi ».
 * @param {{ controles: any, onOpenFacility: (facilityId: string) => void, onSeeAll: () => void,
 *   signalements: any }} props
 * @returns {import('react').ReactElement} Le bloc.
 */
function VilleSecurityOverview({
  controles, onOpenFacility, onSeeAll, signalements,
}) {
  const { t } = useTranslation();
  const { ApplicationStyle, Colors, Fonts } = useTheme();

  const titre = (
    <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>
      {t('collectiviteAccueil.securite.titre', 'Sécurité et suivi')}
    </Text>
  );
  const carte = (/** @type {any} */ contenu, /** @type {string} */ testID) => (
    <View style={{ gap: 12 }} testID={testID}>
      {titre}
      <View style={[ApplicationStyle.card, { gap: 12, padding: 16 }]}>{contenu}</View>
    </View>
  );

  if (signalements?.isLoading || controles?.isLoading) {
    const bloc = { backgroundColor: withAlpha(Colors.neutral00, 0.06), borderRadius: 12 };
    return carte(
      <View accessibilityState={{ busy: true }} style={{ gap: 10 }}>
        <View style={[bloc, { height: 44 }]} />
        <View style={[bloc, { height: 44 }]} />
        <View style={[bloc, { height: 44 }]} />
      </View>,
      'ville-securite-chargement',
    );
  }
  if (signalements?.isError || controles?.isError) {
    return carte(
      <View style={{ gap: 8 }}>
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
          {t('collectiviteAccueil.securite.erreur', 'La vue d’ensemble n’a pas pu être chargée.')}
        </Text>
        <Button
          onPress={() => {
            signalements?.refetch?.();
            controles?.refetch?.();
          }}
          size="sm"
          title={t('collectiviteAccueil.reessayer', 'Réessayer')}
          variant="Secondary"
        />
      </View>,
      'ville-securite-erreur',
    );
  }

  const meta = signalements?.data?.meta || {};
  const ouverts = Array.isArray(meta.openReports) ? meta.openReports : [];
  const nombreOuverts = Number(meta.openCount) || ouverts.length;
  const aSurveiller = Array.isArray(meta.watch) ? meta.watch : [];
  const aRefaire = Array.isArray(controles?.data?.data) ? controles.data.data : [];
  const nombreARefaire = Number(controles?.data?.meta?.dueCount) || aRefaire.length;

  if (!nombreOuverts && !aSurveiller.length && !nombreARefaire) {
    const nombre = Number(meta.facilityCount) || 0;
    return carte(
      <Text style={[Fonts.p2, Fonts.neutral100]}>
        {nombre
          ? t('collectiviteAccueil.securite.rien', { count: nombre })
          : t('collectiviteAccueil.securite.rienSans', 'Rien à signaler.')}
      </Text>,
      'ville-securite-rien',
    );
  }

  /** @type {Record<string, string>} */
  const tons = {
    a_surveiller: Colors.warning500,
    en_retard: Colors.error500,
    fermee: Colors.error500,
    signalement: Colors.warning500,
  };
  const ligne = (/**
                  * @type {{ cle: string, detail: string, facilityId: string,
                     titre: string, ton: string }} */ {
      cle, detail, facilityId, titre: titreLigne, ton,
    },
  ) => (
    <TouchableOpacity
      accessibilityRole="button"
      key={cle}
      onPress={() => onOpenFacility(facilityId)}
      style={{
        alignItems: 'center', flexDirection: 'row', gap: 10, minHeight: 44,
      }}
      testID={`ville-securite-${cle}`}
    >
      <View style={{
        backgroundColor: ton, borderRadius: 5, height: 10, width: 10,
      }}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{titreLigne}</Text>
        {detail ? <Text style={[Fonts.p3, Fonts.neutral200]}>{detail}</Text> : null}
      </View>
    </TouchableOpacity>
  );
  const groupe = (
    /** @type {string} */ id,
    /** @type {string} */ entete,
    /** @type {any[]} */ lignes,
    /** @type {number} */ total,
  ) => (lignes.length ? (
    <View key={id} style={{ gap: 4 }} testID={`ville-securite-groupe-${id}`}>
      <Text style={[Fonts.p3Bold, Fonts.neutral200, { textTransform: 'uppercase' }]}>{entete}</Text>
      {lignes.slice(0, LIGNES_PAR_GROUPE).map(ligne)}
      {total > LIGNES_PAR_GROUPE ? (
        <TouchableOpacity
          accessibilityRole="link"
          onPress={onSeeAll}
          style={{ alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44 }}
          testID={`ville-securite-tout-${id}`}
        >
          <Text style={[Fonts.p3Bold, Fonts.primary500]}>
            {t('collectiviteAccueil.securite.voirTout', { count: total })}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  ) : null);

  const lignesSignalements = ouverts.map((/** @type {any} */ report) => ({
    cle: `signalement-${report.documentId}`,
    detail: [
      String(t(`facilityReports.statuts.${report.status}`, report.status)),
      report.title,
    ].filter(Boolean).join(' · '),
    facilityId: report.facility?.documentId,
    titre: t('collectiviteAccueil.securite.ligneSignalement', {
      ...SANS_ECHAPPEMENT,
      category: String(t(`facilityReports.categoriesCourtes.${report.category}`, report.category)),
      facility: report.facility?.name || '',
    }),
    ton: report.category === 'securite' ? Colors.error500 : tons.signalement,
  }));
  const raisons = (/** @type {any} */ state) => {
    if (state.code === 'fermee' && state.closure) {
      return t('collectiviteAccueil.securite.fermeeJusquau', {
        ...SANS_ECHAPPEMENT,
        date: checkDayMonth(state.closure.endDate),
      });
    }
    const nonConformes = Array.isArray(state.nonConformChecks) ? state.nonConformChecks : [];
    return [
      state.securityOpenCount
        ? t('collectiviteAccueil.securite.surveillerSecurite', { count: state.securityOpenCount })
        : null,
      nonConformes.length === 1
        ? t('collectiviteAccueil.securite.nonConforme', {
          ...SANS_ECHAPPEMENT,
          label: nonConformes[0].label,
        })
        : null,
      nonConformes.length > 1
        ? t('collectiviteAccueil.securite.nonConformes', { count: nonConformes.length })
        : null,
    ].filter(Boolean).join(' · ');
  };
  const lignesSurveiller = aSurveiller.map((/** @type {any} */ entree) => ({
    cle: `installation-${entree.facility?.documentId}`,
    detail: raisons(entree.state || {}),
    facilityId: entree.facility?.documentId,
    titre: entree.facility?.name || '',
    ton: tons[entree.state?.code] || tons.a_surveiller,
  }));
  const lignesControles = aRefaire.map((/** @type {any} */ check) => ({
    cle: `controle-${check.documentId}`,
    detail: check.state === 'en_retard'
      ? t('collectiviteAccueil.securite.controleRetard', {
        ...SANS_ECHAPPEMENT,
        date: checkDayMonth(check.nextDue),
      })
      : t('collectiviteAccueil.securite.controleAvant', {
        ...SANS_ECHAPPEMENT,
        date: checkDayMonth(check.nextDue),
      }),
    facilityId: check.facility?.documentId,
    titre: t('collectiviteAccueil.securite.ligneControle', {
      ...SANS_ECHAPPEMENT,
      facility: check.facility?.name || '',
      label: check.label,
    }),
    ton: check.state === 'en_retard' ? tons.en_retard : tons.a_surveiller,
  }));

  return carte(
    <View style={{ gap: 14 }}>
      {groupe(
        'signalements',
        t('collectiviteAccueil.securite.signalements', { count: nombreOuverts }),
        lignesSignalements,
        nombreOuverts,
      )}
      {groupe(
        'installations',
        t('collectiviteAccueil.securite.surveiller', { count: aSurveiller.length }),
        lignesSurveiller,
        aSurveiller.length,
      )}
      {groupe(
        'controles',
        t('collectiviteAccueil.securite.controles', { count: nombreARefaire }),
        lignesControles,
        nombreARefaire,
      )}
    </View>,
    'ville-securite',
  );
}

export default VilleSecurityOverview;
