import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';

// ⏰ A7-UX (20/10) — la journée d'un club d'abord : 08 h → 22 h, les heures que la Ville ouvre
// par défaut (`freeRanges`, 08:00 – 22:00). La nuit et le petit matin se montrent sur demande.
const HEURES_DU_JOUR = Array.from({ length: 15 }, (_, rang) => rang + 8);
const HEURES_DE_NUIT = [23, 0, 1, 2, 3, 4, 5, 6, 7];
// Les minutes de 5 en 5 (le pas de la roue de l'iPhone), sur 3 colonnes : la première colonne
// porte les quarts d'heure (:00, :15, :30, :45), l'œil les trouve sans chercher.
const MINUTES = Array.from({ length: 12 }, (_, rang) => rang * 5);
const ECART = 6;

const deuxChiffres = (/** @type {number} */ nombre) => String(nombre).padStart(2, '0');

/**
 * Une case de la grille : 44 px de haut, aux couleurs des puces de FoundClub.
 * @param {{
 *   choisie: boolean, colonnes: number, desactivee?: boolean, etat?: string | null,
 *   libelle: string, onPress: () => void, suggeree?: boolean,
 * }} props - `etat` : « complet » ou « en partie » (A7-UX-2), écrit sous l'heure et lu.
 * @returns {import('react').ReactElement} La case.
 */
function Case({
  choisie, colonnes, desactivee = false, etat = null, libelle, onPress, suggeree = false,
}) {
  const { Colors, Fonts } = useTheme();
  let bordure = withAlpha(Colors.neutral00, 0.18);
  if (etat) bordure = Colors.warning500;
  if (choisie || suggeree) bordure = Colors.primary500;
  return (
    <View style={{ padding: ECART / 2, width: `${100 / colonnes}%` }}>
      <TouchableOpacity
        accessibilityLabel={etat ? `${libelle}, ${etat}` : libelle}
        accessibilityRole="button"
        accessibilityState={{ disabled: desactivee, selected: choisie }}
        disabled={desactivee}
        onPress={onPress}
        style={{
          alignItems: 'center',
          backgroundColor: choisie ? Colors.primary500 : withAlpha(Colors.neutral00, 0.04),
          borderColor: bordure,
          borderRadius: 12,
          borderWidth: 1,
          justifyContent: 'center',
          minHeight: 44,
          opacity: desactivee ? 0.38 : 1,
        }}
      >
        <Text style={[Fonts.p2Bold, choisie ? Fonts.primary900 : Fonts.neutral00]}>
          {libelle}
        </Text>
        {etat ? (
          <Text style={[Fonts.p4, choisie ? Fonts.primary900 : Fonts.warning500]}>{etat}</Text>
        ) : null}
      </TouchableOpacity>
    </View>
  );
}

/**
 * ⏰ A7-UX — LE CHOIX DE L'HEURE AUX COULEURS DE FOUNDCLUB, posé DANS la page sous le champ (rien
 * ne recouvre « Suivant », contrairement à la liste du navigateur). Deux appuis : une heure, puis
 * une minute ; la minute écrit « HH:mm » et referme. Aucune liste qui défile.
 * @param {{
 *   apres?: string | null,
 *   onChoisir: (heure: string) => void,
 *   pleines?: Array<{ end: number, start: number }>,
 *   suggestion?: string | null,
 *   valeur?: string | null,
 * }} props - `apres` : rien jusqu'à cette heure incluse (la Fin après le Début) ; `pleines` :
 *   A7-UX-2, les plages pleines du jour en minutes (elles restent touchables, D74) ;
 *   `suggestion` : l'exemple du champ, cerclé ; `valeur` : l'heure saisie, choisie.
 * @returns {import('react').ReactElement} La grille.
 */
function GrilleDesHeures({
  apres = null, onChoisir, pleines = [], suggestion = null, valeur = null,
}) {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts } = useTheme();
  const heureDe = (/** @type {string | null} */ texte) => (
    /^\d{2}:\d{2}$/.test(String(texte || '')) ? Number(String(texte).slice(0, 2)) : null
  );
  const minutesDe = (/** @type {string | null} */ texte) => (heureDe(texte) === null
    ? null
    : (Number(heureDe(texte)) * 60) + Number(String(texte).slice(3, 5)));
  const heureSaisie = heureDe(valeur);
  const limite = minutesDe(apres);
  const [heure, setHeure] = useState(/** @type {number | null} */ (null));
  const [nuit, setNuit] = useState(
    [heureSaisie, heureDe(apres)].some((h) => h !== null && !HEURES_DU_JOUR.includes(h)),
  );
  const [largeur, setLargeur] = useState(0);
  // Une case garde 44 px de large : 3 colonnes, 2 dans un champ étroit (rendez-vous, 128 px).
  const colonnes = largeur && largeur < 150 ? 2 : 3;
  const passee = (/** @type {number} */ minutes) => limite !== null && minutes <= limite;
  // A7-UX-2 (22/10, Adel « P4 oui ») — les minutes pleines d'une plage [de, a[ du jour.
  const minutesPleines = (/** @type {number} */ de, /** @type {number} */ a) => (
    Array.isArray(pleines) ? pleines : []
  ).reduce((total, plage) => (
    total + Math.max(0, Math.min(a, plage.end) - Math.max(de, plage.start))
  ), 0);
  const etatDeLHeure = (/** @type {number} */ h) => {
    const pleinesDeLHeure = minutesPleines(h * 60, (h * 60) + 60);
    if (pleinesDeLHeure >= 60) return t('timePickerInput.complet', 'complet');
    return pleinesDeLHeure > 0 ? t('timePickerInput.enPartie', 'en partie') : null;
  };

  const grille = (/** @type {import('react').ReactNode} */ cases) => (
    <View style={[Alignments.row, Alignments.wrap, { margin: -ECART / 2 }]}>{cases}</View>
  );

  const corps = heure === null ? (
    <>
      {grille((nuit ? [...HEURES_DU_JOUR, ...HEURES_DE_NUIT] : HEURES_DU_JOUR).map((h) => (
        <Case
          choisie={h === heureSaisie}
          colonnes={colonnes}
          desactivee={passee((h * 60) + 55)}
          etat={etatDeLHeure(h)}
          key={`h${h}`}
          libelle={t('timePickerInput.heure', '{{heure}} h', {
            heure: deuxChiffres(h), interpolation: { escapeValue: false },
          })}
          onPress={() => setHeure(h)}
          suggeree={heureSaisie === null && h === heureDe(suggestion)}
        />
      )))}
      {nuit ? null : (
        <TouchableOpacity
          accessibilityLabel={t('timePickerInput.autresHeures', 'Autres heures')}
          accessibilityRole="button"
          onPress={() => setNuit(true)}
          style={[Alignments.row, Alignments.alignCenter, { gap: 8, minHeight: 44 }]}
        >
          <SvgIcon color={Colors.primary200} height={16} name="chevron-down" width={16} />
          <Text style={[Fonts.p2Bold, { color: Colors.primary200 }]}>
            {t('timePickerInput.autresHeures', 'Autres heures')}
          </Text>
        </TouchableOpacity>
      )}
    </>
  ) : (
    <>
      <TouchableOpacity
        accessibilityLabel={t('timePickerInput.autreHeure', 'Autre heure')}
        accessibilityRole="button"
        onPress={() => setHeure(null)}
        style={[Alignments.row, Alignments.alignCenter, { gap: 8, minHeight: 44 }]}
      >
        <SvgIcon color={Colors.primary200} height={16} name="arrow-left" width={16} />
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
          {t('timePickerInput.heure', '{{heure}} h', {
            heure: deuxChiffres(heure), interpolation: { escapeValue: false },
          })}
        </Text>
      </TouchableOpacity>
      {grille(MINUTES.map((m) => {
        const libelle = `${deuxChiffres(heure)}:${deuxChiffres(m)}`;
        return (
          <Case
            choisie={libelle === valeur}
            colonnes={colonnes}
            desactivee={passee((heure * 60) + m)}
            etat={minutesPleines((heure * 60) + m, (heure * 60) + m + 1)
              ? t('timePickerInput.complet', 'complet') : null}
            key={`m${m}`}
            libelle={libelle}
            onPress={() => onChoisir(libelle)}
          />
        );
      }))}
    </>
  );

  return (
    <View
      onLayout={(evenement) => setLargeur(evenement?.nativeEvent?.layout?.width || 0)}
      style={{
        backgroundColor: Colors.primary700,
        borderColor: withAlpha(Colors.primary500, 0.3),
        borderRadius: 12,
        borderWidth: 1,
        gap: 8,
        padding: 8,
      }}
    >
      {corps}
    </View>
  );
}

export default GrilleDesHeures;
