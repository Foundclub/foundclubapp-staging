import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';

import { useGetClubAudiencePreview } from '@/services/event/eventQueries';

/**
 * EVT-CLUB-ECRANS (14/11/2026, D121) — ecrans 1 et 2 de la maquette v2 (MAQUETTE_EVT_CLUB_v2.html).
 * La carte « Tous les membres du club » de l'etape « Equipe organisatrice », et sa feuille
 * « Prevenir tout le club ? » avec les comptes de l'apercu serveur (GET /clubs/:id/event-club-audience).
 * Le parent decide de l'afficher (dirigeant seulement, Q1 A ; masquee pendant une recherche).
 * Sur le site, la feuille est une fenetre centree (`webPresentation="dialog"`, maquette 5a).
 * @param {object} props Proprietes.
 * @param {{ documentId?: string, name?: string } | null} props.club Le club de l'evenement.
 * @param {number} props.teamsCount Le nombre d'equipes du club, affiche sur la carte.
 * @param {boolean} props.isSelected Vrai si « tout le club » est deja choisi (Match / Tournoi, ou retour).
 * @param {boolean} props.keepsTeam Vrai pour un Match / Tournoi (l'equipe se choisit ensuite, R1 A).
 * @param {(counts: any) => void} props.onConfirm « Oui, tout le club ».
 * @param {() => void} props.onClear Revenir a un evenement d'equipe (feuille rouverte sur une carte choisie).
 * @returns {import('react').ReactElement} La carte et sa feuille.
 */
function EventWizardClubAudience({
  club, isSelected, keepsTeam, onClear, onConfirm, teamsCount,
}) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const clubId = String(club?.documentId || '');
  const preview = useGetClubAudiencePreview(clubId);
  const counts = preview?.data?.counts || null;
  const total = Number(counts?.total);
  const hasTotal = Number.isFinite(total);

  const subtitle = hasTotal
    ? t('eventClubAudience.cardSubtitle', {
      club: club?.name || '', count: total, defaultValue: '{{club}} · {{teams}} équipes · {{count}} personnes', teams: teamsCount,
    })
    : t('eventClubAudience.cardSubtitleNoCount', {
      club: club?.name || '', defaultValue: '{{club}} · {{teams}} équipes', teams: teamsCount,
    });

  const intertitreStyle = [Fonts.p3Bold, Fonts.neutral300, { letterSpacing: 1 }];
  const ligneDeCompte = (label, value) => (
    <View key={label} style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, { columnGap: 12 }]}>
      <Text style={[Fonts.p2, Fonts.neutral100, { flex: 1 }]}>{label}</Text>
      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{String(value ?? 0)}</Text>
    </View>
  );

  const fermer = () => setIsSheetOpen(false);
  const choisirUneEquipe = () => {
    fermer();
    if (isSelected) onClear?.();
  };
  const confirmer = () => {
    fermer();
    onConfirm?.(counts);
  };

  return (
    <View style={[Spaces.gap[12]]}>
      <Text style={intertitreStyle}>
        {t('eventClubAudience.sectionTitle', 'POUR TOUT LE CLUB')}
      </Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ selected: Boolean(isSelected) }}
        activeOpacity={0.9}
        onPress={() => setIsSheetOpen(true)}
        style={[
          ApplicationStyle.card,
          Spaces.padding[16],
          Spaces.gap[8],
          {
            backgroundColor: isSelected ? 'rgba(1, 179, 244, 0.18)' : Colors.primary700,
            borderColor: isSelected ? Colors.primary500 : 'rgba(1, 179, 244, 0.32)',
            borderRadius: 20,
            borderWidth: 1,
          },
        ]}
        testID="event-wizard-club-audience-card"
      >
        <Text style={[Fonts.h4Bold, isSelected ? Fonts.primary500 : Fonts.neutral00]}>
          {t('eventClubAudience.cardTitle', 'Tous les membres du club')}
        </Text>
        <Text style={[Fonts.p3Bold, Fonts.primary500]}>{subtitle}</Text>
        <Text style={[Fonts.p3, Fonts.neutral200, { lineHeight: 20 }]}>
          {isSelected && keepsTeam
            ? t('eventClubAudience.cardSelected', 'Tout le club sera prévenu. Choisis maintenant l’équipe qui joue.')
            : t('eventClubAudience.cardHint', 'Joueurs, parents des moins de 13 ans, entraîneurs et membres sans équipe.')}
        </Text>
      </TouchableOpacity>

      {isSheetOpen ? (
        <BottomModal close={fermer} isVisible={isSheetOpen} scrollable={false} webPresentation="dialog">
          <View style={[Spaces.paddingTop[24], Spaces.paddingBottom[24], Spaces.gap[16]]}>
            <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
              {t('eventClubAudience.sheetTitle', 'Prévenir tout le club ?')}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {t(
                'eventClubAudience.sheetIntro',
                'Quand tu créeras l’événement, chacune de ces personnes recevra une notification :',
              )}
            </Text>

            {preview?.isLoading ? (
              <Text style={[Fonts.p3, Fonts.neutral300]}>
                {t('eventClubAudience.sheetLoading', 'Calcul des personnes…')}
              </Text>
            ) : null}
            {!preview?.isLoading && (preview?.error || !counts) ? (
              <Text style={[Fonts.p3, Fonts.neutral300]}>
                {t('eventClubAudience.sheetError', 'Impossible de compter les membres du club. Réessaie.')}
              </Text>
            ) : null}

            {counts ? (
              <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[8], { backgroundColor: Colors.primary700 }]}>
                <Text style={[Fonts.h4Bold, Fonts.primary500]}>
                  {t('eventClubAudience.sheetTotal', { count: total, defaultValue: '{{count}} personnes' })}
                </Text>
                {ligneDeCompte(t('eventClubAudience.sheetPlayers', 'Joueurs de 13 ans et plus'), counts.players)}
                {ligneDeCompte(
                  t('eventClubAudience.sheetParents', {
                    count: Number(counts.children) || 0,
                    defaultValue: 'Parents, pour {{count}} enfants de moins de 13 ans',
                  }),
                  counts.parents,
                )}
                {ligneDeCompte(t('eventClubAudience.sheetCoaches', 'Entraîneurs'), counts.coaches)}
                {ligneDeCompte(t('eventClubAudience.sheetMembers', 'Membres sans équipe'), counts.members)}
              </View>
            ) : null}

            <Text style={[Fonts.p3, Fonts.neutral300]}>
              {t(
                'eventClubAudience.sheetDedupe',
                'Une personne qui est à la fois parent et entraîneur ne reçoit qu’une notification et n’est comptée qu’une fois.',
              )}
            </Text>
            {keepsTeam ? (
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {t(
                  'eventClubAudience.sheetMatchHint',
                  'Pour un match ou un tournoi, choisis ensuite l’équipe qui joue : sa convocation ne change pas.',
                )}
              </Text>
            ) : null}
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {t(
                'eventClubAudience.sheetLater',
                'Rien ne part maintenant. Une dernière confirmation te sera demandée quand tu créeras l’événement.',
              )}
            </Text>

            <View style={[Spaces.gap[12], Spaces.marginTop[8]]}>
              <Button
                disabled={!counts}
                onPress={confirmer}
                title={t('eventClubAudience.sheetConfirm', 'Oui, tout le club')}
                variant="Primary"
              />
              <Button
                onPress={choisirUneEquipe}
                title={t('eventClubAudience.sheetChooseTeam', 'Choisir une équipe')}
                variant="Secondary"
              />
            </View>
          </View>
        </BottomModal>
      ) : null}
    </View>
  );
}

export default EventWizardClubAudience;
