import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { choixDesOptions, quantitesDesFigees } from '@/domains/complexe/optionsTerrain';
import { contenuDEchec, varianteDEchec } from '@/domains/complexe/reserverTerrain';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import BlocOptions from '@/views/reserverTerrain/components/BlocOptions';

import { useModifierMesOptions } from '@/services/complexe/complexeJoueurQueries';

/**
 * E-P07, LA FEUILLE « MODIFIER LES OPTIONS » — RESA-OPTIONS-2 (12/11/2026), maquette section
 * 4 bis, décision a de « 233- oui » : les compteurs du récapitulatif (`BlocOptions`), partis des
 * quantités de la réservation ; une option déjà prise garde son prix figé (`optionsModifiables`).
 * « Enregistrer les options » envoie la liste ENTIÈRE ; le complexe est prévenu par le serveur.
 * Un refus (délai passé…) se lit dans la feuille, qui reste ouverte.
 * @param {object} props - Les propriétés.
 * @param {() => void} props.close - Fermer la feuille.
 * @param {any[]} props.figees - Les options de la réservation (`reservation.options`).
 * @param {any[]} props.modifiables - Les options de la feuille (`optionsModifiables`).
 * @param {string} props.reservationId - documentId de la réservation.
 * @returns {import('react').ReactElement} La feuille.
 */
function FeuilleModifierOptions({
  close, figees, modifiables, reservationId,
}) {
  const { t } = useTranslation();
  const { Fonts } = useTheme();
  const modifier = useModifierMesOptions();
  const [quantites, setQuantites] = useState(() => quantitesDesFigees(modifiables, figees));
  const [refus, setRefus] = useState(/** @type {string | null} */ (null));

  const enregistrer = async () => {
    setRefus(null);
    try {
      await modifier.mutateAsync({
        options: choixDesOptions(modifiables, quantites),
        reservationId,
      });
      close();
    } catch (erreur) {
      const lu = /** @type {{ message?: unknown } | null} */ (erreur);
      const message = String(lu?.message || '').trim();
      setRefus(message || contenuDEchec(t, varianteDEchec(erreur), { erreur }).titre);
    }
  };

  return (
    <BottomModal close={close} isVisible webPresentation="dialog">
      <View style={{ gap: 12 }} testID="feuille-modifier-options">
        <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
          {t('complexeOptions.modifier', 'Modifier les options')}
        </Text>
        <BlocOptions
          offertes={modifiables}
          onQuantite={(id, quantite) => setQuantites((avant) => ({ ...avant, [id]: quantite }))}
          quantites={quantites}
        />
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {t('complexeOptions.complexePrevenu', 'Le complexe sera prévenu.')}
        </Text>
        {refus ? (
          <Text
            accessibilityRole="alert"
            style={[Fonts.p2Bold, Fonts.error300]}
            testID="feuille-modifier-options-refus"
          >
            {refus}
          </Text>
        ) : null}
        <Button
          isLoading={Boolean(modifier?.isPending)}
          onPress={enregistrer}
          title={t('complexeOptions.enregistrerLesOptions', 'Enregistrer les options')}
          variant="Primary"
        />
        <Button
          onPress={close}
          title={t('complexeOptions.rienChanger', 'Ne rien changer')}
          variant="Ghost"
        />
      </View>
    </BottomModal>
  );
}

export default FeuilleModifierOptions;
