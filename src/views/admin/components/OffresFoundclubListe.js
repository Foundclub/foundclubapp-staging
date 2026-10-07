import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import {
  FeuilleRetraitOffreFoundclub,
  formatJourOffre,
  libelleFinOffre,
} from '@/views/admin/components/OffreFoundclubClub';

import { RouteNames } from '@/navigation/routeNames';

import { useFoundclubOffers } from '@/services/admin/foundclubOfferQueries';

/**
 * 🎁 OFFRIR-ABONNEMENT (07/10/2026) — « Abonnements offerts » dans la console SuperAdmin : les
 * offres de FoundClub EN COURS, une ligne par club (le club, l offre, depuis, jusqu’au, le
 * motif), chacune retirable (confirmation). Le nom du club ouvre sa fiche ; « Offrir à un club »
 * ouvre la recherche des clubs, d ou l on offre depuis la fiche.
 * @returns {import('react').ReactElement} Le panneau.
 */
function OffresFoundclubListe() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts,
  } = useTheme();
  const lecture = useFoundclubOffers();
  const [aRetirer, setARetirer] = useState(
    /** @type {{ id: string, nom: string } | null} */ (null),
  );
  const offres = Array.isArray(lecture.data?.data) ? lecture.data.data : [];
  const rangee = [
    Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, { gap: 12 },
  ];

  /** @type {import('react').ReactNode} */
  let corps;
  if (lecture.isLoading) {
    corps = <Text style={[Fonts.p3, Fonts.neutral300]}>{t('offreFoundclub.lecture')}</Text>;
  } else if (lecture.error) {
    corps = (
      <View style={{ gap: 8 }}>
        <Text style={[Fonts.p3, Fonts.error300]}>{t('offreFoundclub.listeImpossible')}</Text>
        <Button
          onPress={() => lecture.refetch?.()}
          size="sm"
          title={t('offreFoundclub.reessayer')}
          variant="Secondary"
        />
      </View>
    );
  } else if (offres.length === 0) {
    corps = <Text style={[Fonts.p3, Fonts.neutral300]}>{t('offreFoundclub.listeVide')}</Text>;
  } else {
    corps = offres.map((/** @type {any} */ offre) => {
      const nom = String(offre?.clubName || offre?.clubDocumentId || '').trim();
      return (
        <View
          key={offre.subscriptionDocumentId || offre.clubDocumentId}
          style={[
            ApplicationStyle.borderRadius12,
            {
              backgroundColor: withAlpha(Colors.success500, 0.08),
              borderColor: withAlpha(Colors.success500, 0.35),
              borderWidth: 1,
              gap: 4,
              padding: 12,
            },
          ]}
          testID={`offres-foundclub-ligne-${offre.clubDocumentId}`}
        >
          <View style={rangee}>
            <TouchableOpacity
              accessibilityRole="link"
              onPress={() => navigation.navigate(
                /** @type {never} */ (RouteNames.AdminClubDetail),
                /** @type {never} */ ({ clubId: offre.clubDocumentId }),
              )}
              style={{ flex: 1, justifyContent: 'center', minHeight: 44 }}
              testID={`offres-foundclub-club-${offre.clubDocumentId}`}
            >
              <Text numberOfLines={2} style={[Fonts.p2Bold, Fonts.neutral00]}>{nom}</Text>
            </TouchableOpacity>
            <Button
              onPress={() => setARetirer({ id: offre.clubDocumentId, nom })}
              size="sm"
              title={t('offreFoundclub.retirerCourt')}
              variant="Danger"
            />
          </View>
          <Text style={[Fonts.p3Bold, Fonts.success500]}>{t('offreFoundclub.offreCourte')}</Text>
          {offre.since ? (
            <Text style={[Fonts.p3, Fonts.neutral300]}>
              {t('offreFoundclub.depuis', {
                date: formatJourOffre(offre.since), ...SANS_ECHAPPEMENT,
              })}
            </Text>
          ) : null}
          <Text style={[Fonts.p3, Fonts.neutral100]}>{libelleFinOffre(offre.until)}</Text>
          {offre.reason ? (
            <Text style={[Fonts.p3, Fonts.neutral300]}>
              {t('offreFoundclub.motif', { motif: offre.reason, ...SANS_ECHAPPEMENT })}
            </Text>
          ) : null}
        </View>
      );
    });
  }

  return (
    <View
      style={{ gap: 12, marginTop: 16 }}
      testID={lecture.isLoading ? undefined : 'offres-foundclub-liste'}
    >
      <View style={rangee}>
        <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00, { flex: 1 }]}>
          {t('offreFoundclub.listeTitre')}
        </Text>
        <Button
          onPress={() => navigation.navigate(/** @type {never} */ (RouteNames.AdminClubList))}
          size="sm"
          title={t('offreFoundclub.offrirAUnClub')}
          variant="Secondary"
        />
      </View>
      {corps}
      {/* Montee a l ouverture seulement : son geste n existe pas tant qu on ne retire rien. */}
      {aRetirer ? (
        <FeuilleRetraitOffreFoundclub
          clubId={aRetirer.id}
          clubName={aRetirer.nom}
          onClose={() => setARetirer(null)}
        />
      ) : null}
    </View>
  );
}

export default OffresFoundclubListe;
