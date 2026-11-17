import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TextInput, View } from 'react-native';

import { formatEuros } from '@/domains/complexe/complexeTerrain';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';

/**
 * CORR-EVENEMENTS 130 (recette du site, décision A) — la feuille d'équipe du tournoi.
 *
 * Le site demandait le nom d'une équipe, ou le numéro de l'équipe à inscrire, dans une fenêtre
 * grise du navigateur (`window.prompt`) ; l'annuler ne disait rien. Cette feuille reprend celle
 * du téléphone (`EventDetails.js`, « Créer une équipe ») et ses textes :
 *   · `mode="name"` : le nom de l'équipe éphémère, refusé vide avec un message ;
 *   · `mode="choose"` : une rangée par équipe du club à inscrire.
 * Elle n'appelle aucun service : `onCreate(nom)` et `onChoose(equipe)` sont pilotés par l'écran.
 */

/** Cible tactile minimale du projet. */
const MIN_TOUCH_TARGET = 44;

/**
 * La feuille d'équipe du tournoi.
 * @param {object} props - Les propriétés du composant.
 * @param {number} [props.entryFeeCents] - T-PARCOURS-1 (R10) : le prix d'une place, en
 *   centimes (0 = gratuit).
 * @param {boolean} [props.isPending] - Une création ou une inscription est-elle en cours.
 * @param {number | null} [props.maxRosterSize] - T-PARCOURS-1 (R10) : le nombre de joueurs
 *   d'une équipe.
 * @param {'name' | 'choose' | null} props.mode - Ce que demande la feuille ; `null` la ferme.
 * @param {() => void} props.onClose - Fermer sans rien faire.
 * @param {(equipe: any) => void} props.onChoose - Inscrire cette équipe.
 * @param {(nom: string) => void} props.onCreate - Créer l'équipe sous ce nom.
 * @param {any[]} [props.teams] - Les équipes inscriptibles (`mode="choose"`).
 * @returns {import('react').ReactElement | null} - La feuille.
 */
function TournamentTeamSheet({
  entryFeeCents = 0, isPending = false, maxRosterSize = null, mode, onChoose, onClose, onCreate,
  teams = [],
}) {
  const { Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();
  const [nom, setNom] = useState('');
  const [nomManquant, setNomManquant] = useState(false);

  useEffect(() => {
    if (mode !== 'name') return;
    setNom('');
    setNomManquant(false);
  }, [mode]);

  if (!mode) return null;

  // T-PARCOURS-1 (17/11, R10) — ce qui attend le capitaine, lu sur le tournoi : rien pour un
  // tournoi gratuit.
  const prix = Number(entryFeeCents) > 0 ? formatEuros(Number(entryFeeCents) / 100) : '';
  const coequipiers = Number(maxRosterSize) - 1;
  let ensuite = '';
  if (prix) {
    ensuite = coequipiers > 0
      ? t('eventDetails.createMyTeamNext', { count: coequipiers, prix })
      : t('eventDetails.createMyTeamNextAnyPlayers', { prix });
  }

  const creer = () => {
    const nomPropre = nom.trim();
    if (!nomPropre) {
      setNomManquant(true);
      return;
    }
    onCreate(nomPropre);
  };

  const pied = (
    <View style={[Spaces.gap[12]]}>
      {mode === 'name' ? (
        <Button
          disabled={isPending}
          isLoading={isPending}
          onPress={creer}
          style={{ minHeight: MIN_TOUCH_TARGET }}
          title={t('eventDetails.createMyTeam', 'Créer mon équipe')}
          variant="Primary"
        />
      ) : null}
      <Button
        disabled={isPending}
        onPress={onClose}
        style={{ minHeight: MIN_TOUCH_TARGET }}
        title={t('eventDetails.cancel', 'Annuler')}
        variant="Secondary"
      />
    </View>
  );

  return (
    <BottomModal
      close={onClose}
      footerComponent={pied}
      headerComponent={(
        <View style={[Spaces.gap[8]]}>
          <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
            {mode === 'name'
              ? t('eventDetails.createATeam', 'Créer une équipe')
              : t('eventDetails.registerMyTeam', 'Inscrire mon équipe')}
          </Text>
          {mode === 'name' ? (
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {t(
                'eventDetails.thisTeamWillOnlyExist',
                'Cette équipe n’existera que pour ce tournoi. Tu en deviendras automatiquement le capitaine.',
              )}
            </Text>
          ) : null}
          {mode === 'name' && ensuite ? (
            <Text style={[Fonts.p2Bold, Fonts.neutral00]} testID="tournament-team-sheet-next">
              {ensuite}
            </Text>
          ) : null}
        </View>
      )}
      isVisible
      webPresentation="dialog"
    >
      <View style={[Spaces.gap[12], Spaces.paddingBottom[16]]}>
        {mode === 'name' ? (
          <>
            <TextInput
              accessibilityLabel={t('eventDetails.teamName', 'Nom de l’équipe')}
              autoFocus
              onChangeText={(texte) => {
                setNom(texte);
                if (texte.trim()) setNomManquant(false);
              }}
              onSubmitEditing={creer}
              placeholder={t('eventDetails.teamName', 'Nom de l’équipe')}
              placeholderTextColor={Colors.neutral300}
              style={[Fonts.p2, {
                borderColor: nomManquant ? Colors.error500 : Colors.neutral500,
                borderRadius: 12,
                borderWidth: 1,
                color: Colors.neutral00,
                minHeight: MIN_TOUCH_TARGET,
                paddingHorizontal: 14,
              }]}
              value={nom}
            />
            {nomManquant ? (
              <Text accessibilityRole="alert" style={[Fonts.p3, { color: Colors.error500 }]}>
                {t('eventDetails.addATeamNameBefore', 'Ajoute un nom d’équipe avant de continuer.')}
              </Text>
            ) : null}
          </>
        ) : teams.map((equipe) => (
          <Button
            disabled={isPending}
            key={equipe?.documentId || equipe?.name}
            onPress={() => onChoose(equipe)}
            style={{ minHeight: MIN_TOUCH_TARGET }}
            title={equipe?.name || t('eventDetails.teamFallback', 'Équipe')}
            variant="SecondaryLight"
          />
        ))}
      </View>
    </BottomModal>
  );
}

export default TournamentTeamSheet;
