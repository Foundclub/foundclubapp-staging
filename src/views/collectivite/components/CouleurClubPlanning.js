import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';

import {
  useCollectiviteClubs,
  useSetClubPlanningColor,
} from '@/services/collectivite/collectiviteQueries';

import { getErrorMessage } from '@/utils/errors/displayError';
import {
  assignClubPlanningColors,
  FACILITY_PLANNING_COLOR_NAMES,
  FACILITY_PLANNING_PALETTE,
  isValidFacilityPlanningColor,
} from '@/utils/facilityPlanningColor';

/**
 * Choix par la Ville, partage par la fiche du telephone et celle du site.
 * @param {{
 * club: {documentId: string, name: string, planningColor?: string | null},
 * collectiviteId: string,
 * }} props - Le club rattache.
 * @returns {import('react').ReactElement} La ligne et sa feuille de choix.
 */
export default function CouleurClubPlanning({ club, collectiviteId }) {
  const { t } = useTranslation();
  const { Colors, Fonts } = useTheme();
  const clubs = useCollectiviteClubs(collectiviteId);
  const sauver = useSetClubPlanningColor();
  const [ouvert, setOuvert] = useState(false);
  const [confirmation, setConfirmation] = useState(/** @type {string | null} */ (null));
  const [erreur, setErreur] = useState('');
  const liste = Array.isArray(clubs.data) ? clubs.data : [];
  // Le detail fraichement relu prime sur la ligne eventuellement encore en cache.
  const aJour = liste.map((ligne) => (ligne.documentId === club.documentId ? club : ligne));
  const blocs = assignClubPlanningColors(
    aJour.map((ligne) => ({ club: ligne })),
    aJour,
  );
  const couleur = assignClubPlanningColors([{ club }], aJour)[0].displayColor;
  const automatique = !isValidFacilityPlanningColor(club.planningColor);
  const nom = (/** @type {string} */ valeur) => {
    const cle = /** @type {keyof typeof FACILITY_PLANNING_COLOR_NAMES} */ (valeur);
    return t(`facilityForm.colors.${FACILITY_PLANNING_COLOR_NAMES[cle]}`);
  };
  const occupants = (/** @type {string} */ valeur) => blocs
    .filter(
      (bloc) => bloc.club.documentId !== club.documentId && bloc.displayColor === valeur,
    )
    .map((bloc) => bloc.club.name)
    .join(', ');
  const fermer = () => {
    if (!sauver.isPending) setOuvert(false);
  };
  const enregistrer = async (/** @type {string | null} */ valeur) => {
    setErreur('');
    try {
      await sauver.mutateAsync({
        clubId: club.documentId,
        collectiviteId,
        planningColor: valeur,
      });
      setOuvert(false);
      setConfirmation(null);
    } catch (refus) {
      setErreur(getErrorMessage(/** @type {any} */ (refus)));
    }
  };
  const choisir = (/** @type {string | null} */ valeur) => {
    if (valeur && occupants(valeur)) setConfirmation(valeur);
    else enregistrer(valeur);
  };
  const option = (/** @type {string | null} */ valeur) => {
    const titre = valeur ? nom(valeur) : t('collectiviteClubs.couleur.automatique');
    const dejaPris = valeur ? occupants(valeur) : '';
    const selectionne = valeur
      ? club.planningColor?.toUpperCase() === valeur
      : automatique;
    return (
      <TouchableOpacity
        accessibilityLabel={
          dejaPris
            ? `${titre} · ${t('collectiviteClubs.couleur.prise', {
              clubs: dejaPris,
              ...SANS_ECHAPPEMENT,
            })}`
            : titre
        }
        accessibilityRole="radio"
        accessibilityState={{
          checked: selectionne, disabled: sauver.isPending, selected: selectionne,
        }}
        aria-checked={selectionne}
        aria-disabled={sauver.isPending}
        disabled={sauver.isPending}
        key={valeur || 'auto'}
        onPress={() => choisir(valeur)}
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          gap: 12,
          minHeight: 48,
          paddingVertical: 8,
        }}
        testID={`club-couleur-${valeur ? valeur.slice(1) : 'auto'}`}
      >
        <View
          style={{
            backgroundColor: valeur || couleur,
            borderColor: Colors.neutral300,
            borderRadius: 14,
            borderWidth: selectionne ? 3 : 1,
            height: 24,
            width: 24,
          }}
        />
        <View style={{ flex: 1 }}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{titre}</Text>
          {dejaPris ? (
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {t('collectiviteClubs.couleur.prise', {
                clubs: dejaPris,
                ...SANS_ECHAPPEMENT,
              })}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };
  return (
    <View style={{ gap: 8 }} testID="club-couleur-planning">
      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
        {t('collectiviteClubs.couleur.titre')}
      </Text>
      <View
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <View
          style={{
            backgroundColor: couleur,
            borderRadius: 10,
            height: 16,
            width: 16,
          }}
        />
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {`${nom(couleur)}${
            automatique ? ` · ${t('collectiviteClubs.couleur.autoCourt')}` : ''
          }`}
        </Text>
        {/* Ancien serveur : automatique ; aucun bouton qui appelle une route absente. */}
        {Object.prototype.hasOwnProperty.call(club, 'planningColor') ? (
          <View testID="club-couleur-changer">
            <Button
              isOption
              onPress={() => {
                setErreur('');
                setConfirmation(null);
                setOuvert(true);
              }}
              size="sm"
              style={{ minHeight: 44 }}
              title={t('collectiviteClubs.couleur.changer')}
              variant="SecondaryLight"
            />
          </View>
        ) : null}
      </View>
      <BottomModal
        close={fermer}
        closeOnBackdropPress={!sauver.isPending}
        enablePanDownToClose={!sauver.isPending}
        isVisible={ouvert}
        snapPoints={['80%']}
        webPresentation="dialog"
      >
        <View style={{ gap: 12 }}>
          <Text accessibilityRole="header" style={[Fonts.h3Bold, Fonts.neutral00]}>
            {t('collectiviteClubs.couleur.titre')}
          </Text>
          {erreur ? (
            <Text
              accessibilityRole="alert"
              style={[Fonts.p3, Fonts.error500]}
              testID="club-couleur-erreur"
            >
              {erreur}
            </Text>
          ) : null}
          {clubs.isLoading ? (
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {t('collectiviteClubs.couleur.chargement')}
            </Text>
          ) : null}
          {clubs.isError ? (
            <View style={{ gap: 8 }}>
              <Text style={[Fonts.p3, Fonts.error500]}>
                {getErrorMessage(clubs.error)}
              </Text>
              <Button
                onPress={() => clubs.refetch()}
                title={t('collectiviteClubs.list.retry')}
                variant="SecondaryLight"
              />
            </View>
          ) : null}
          {!clubs.isLoading
            && !clubs.isError
            && (confirmation ? (
              <View style={{ gap: 12 }}>
                <Text style={[Fonts.p2, Fonts.neutral00]}>
                  {t('collectiviteClubs.couleur.avertissement', {
                    clubs: occupants(confirmation),
                    couleur: nom(confirmation),
                    ...SANS_ECHAPPEMENT,
                  })}
                </Text>
                <View testID="club-couleur-confirmer">
                  <Button
                    disabled={sauver.isPending}
                    onPress={() => enregistrer(confirmation)}
                    title={t('collectiviteClubs.couleur.confirmer')}
                  />
                </View>
                <Button
                  disabled={sauver.isPending}
                  onPress={() => setConfirmation(null)}
                  title={t('collectiviteClubs.couleur.retour')}
                  variant="SecondaryLight"
                />
              </View>
            ) : (
              <View>{[null, ...FACILITY_PLANNING_PALETTE].map(option)}</View>
            ))}
          {sauver.isPending ? (
            <Text accessibilityLiveRegion="polite" style={[Fonts.p3, Fonts.neutral200]}>
              {t('collectiviteClubs.couleur.enregistrement')}
            </Text>
          ) : null}
          <Button
            disabled={sauver.isPending}
            onPress={fermer}
            title={t('collectiviteClubs.couleur.fermer')}
            variant="SecondaryLight"
          />
        </View>
      </BottomModal>
    </View>
  );
}
