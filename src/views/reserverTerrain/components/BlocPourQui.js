import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

const RADIO = 22;

/**
 * Un rond de choix (radio), plein quand il est coché.
 * @param {object} props - Les propriétés.
 * @param {boolean} props.coche - Coché.
 * @returns {import('react').ReactElement} Le rond.
 */
function Rond({ coche }) {
  const { Colors } = useTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        borderColor: coche ? Colors.primary500 : Colors.primary200,
        borderRadius: RADIO / 2,
        borderWidth: 2,
        height: RADIO,
        justifyContent: 'center',
        width: RADIO,
      }}
    >
      {coche ? (
        <View
          style={{
            backgroundColor: Colors.primary500, borderRadius: 6, height: 12, width: 12,
          }}
        />
      ) : null}
    </View>
  );
}

/**
 * Les initiales d'une équipe, pour son écusson (« U15 Valbrune » ⇒ « UV »).
 * @param {unknown} nom - Le nom.
 * @returns {string} Deux ou trois lettres.
 */
const initiales = (nom) => String(nom || '')
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 3)
  .map((mot) => mot.charAt(0).toLocaleUpperCase())
  .join('');

/**
 * « POUR QUI ? » — RESA-L6B-2 (20/10/2026), planche EP04 état 2, plan E-P04 bloc 2 (A-P04, D3,
 * AT-03 B). Seulement pour un encadrant MAJEUR d'au moins une équipe (l'écran en décide) :
 * « Pour moi » / « Pour mon équipe » ; puis ses équipes, une carte à choisir chacune (écusson, nom,
 * club). L'équipe choisie, le serveur la confirme (récapitulatif `dryRun` avec `team`) : le
 * bandeau d'AT-03 B dit alors que l'âge minimum du complexe ne vaut que pour l'encadrant, et
 * combien de joueurs sont ajoutés ; un refus du serveur dit sa phrase.
 * @param {object} props - Les propriétés.
 * @param {{ documentId: string, membres?: number | null, name: string } | null} props.equipe -
 *   L'équipe que le serveur a admise.
 * @param {string | null} props.equipeEnCours - L'équipe que le serveur juge en ce moment.
 * @param {any[]} props.equipes - Les équipes que ce compte encadre (`getManagedTeams`).
 * @param {number | null} props.ageMinimum - L'âge minimum du complexe.
 * @param {(equipe: any) => void} props.onChoisirEquipe - Une équipe touchée.
 * @param {(pourQui: 'equipe' | 'moi') => void} props.onPourQui - « Pour moi » ou « Pour mon
 *   équipe ».
 * @param {'equipe' | 'moi'} props.pourQui - Le choix.
 * @param {string | null} props.refus - La phrase du serveur quand il refuse l'équipe.
 * @returns {import('react').ReactElement} Le bloc.
 */
function BlocPourQui({
  ageMinimum, equipe, equipeEnCours, equipes, onChoisirEquipe, onPourQui, pourQui, refus,
}) {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts } = useTheme();

  const ligne = {
    alignItems: 'center',
    backgroundColor: withAlpha(Colors.primary800, 0.6),
    borderColor: withAlpha(Colors.primary500, 0.24),
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 10,
  };
  const choix = [
    { cle: 'moi', libelle: t('reserverTerrain.pourQui.moi', 'Pour moi') },
    { cle: 'equipe', libelle: t('reserverTerrain.pourQui.equipe', 'Pour mon équipe') },
  ];
  const membres = Number(equipe?.membres);
  let bandeau = null;
  if (pourQui === 'equipe' && equipe) {
    const nom = String(equipe.name || '');
    const age = Number(ageMinimum) > 0
      ? t(
        'reserverTerrain.pourQui.ageSeulementToi',
        'Tu encadres {{equipe}} : l’âge minimum du complexe ({{age}} ans) ne vaut que pour toi.',
        { age: Number(ageMinimum), equipe: nom, ...SANS_ECHAPPEMENT },
      )
      : t(
        'reserverTerrain.pourQui.ageSeulementToiSansChiffre',
        'Tu encadres {{equipe}} : l’âge minimum du complexe ne vaut que pour toi.',
        { equipe: nom, ...SANS_ECHAPPEMENT },
      );
    const ajoutes = Number.isFinite(membres) && membres > 0
      ? t('reserverTerrain.pourQui.ajoutes', {
        count: membres,
        defaultValue_one: 'Le joueur de l’équipe est ajouté.',
        defaultValue_other: 'Les {{count}} joueurs de l’équipe sont ajoutés.',
      })
      : '';
    bandeau = [age, ajoutes].filter(Boolean).join(' ');
  }

  return (
    <View style={{ gap: 8 }}>
      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
        {t('reserverTerrain.pourQui.titre', 'Pour qui ?')}
      </Text>
      {choix.map(({ cle, libelle }) => (
        <TouchableOpacity
          accessibilityLabel={libelle}
          accessibilityRole="radio"
          accessibilityState={{ checked: pourQui === cle }}
          key={cle}
          onPress={() => onPourQui(/** @type {'equipe' | 'moi'} */ (cle))}
          style={ligne}
          testID={cle === 'moi' ? 'reserver-pour-moi' : 'reserver-pour-equipe'}
        >
          <Rond coche={pourQui === cle} />
          <Text style={[pourQui === cle ? Fonts.p2Bold : Fonts.p2, Fonts.neutral00, { flex: 1 }]}>
            {libelle}
          </Text>
        </TouchableOpacity>
      ))}
      {pourQui === 'equipe' ? equipes.map((une) => {
        const choisie = equipe?.documentId === une.documentId || equipeEnCours === une.documentId;
        const club = String(une?.club?.name || '').trim();
        return (
          <TouchableOpacity
            accessibilityLabel={[une.name, club].filter(Boolean).join(', ')}
            accessibilityRole="radio"
            accessibilityState={{ busy: equipeEnCours === une.documentId, checked: choisie }}
            disabled={Boolean(equipeEnCours)}
            key={une.documentId}
            onPress={() => onChoisirEquipe(une)}
            style={{ ...ligne, borderColor: choisie ? Colors.primary500 : ligne.borderColor }}
            testID={`reserver-equipe-${une.documentId}`}
          >
            <View
              style={[
                Alignments.alignCenter,
                Alignments.justifyCenter,
                {
                  backgroundColor: withAlpha(Colors.primary500, 0.16),
                  borderRadius: 10,
                  height: 36,
                  width: 36,
                },
              ]}
            >
              <Text style={[Fonts.p3Bold, Fonts.primary200]}>{initiales(une.name)}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{String(une.name || '')}</Text>
              {club ? <Text style={[Fonts.p3, Fonts.neutral200]}>{club}</Text> : null}
            </View>
            <Rond coche={choisie} />
          </TouchableOpacity>
        );
      }) : null}
      {refus && pourQui === 'equipe' ? (
        <Text accessibilityRole="alert" style={[Fonts.p2Bold, Fonts.error300]}>{refus}</Text>
      ) : null}
      {bandeau ? (
        <View
          style={{
            backgroundColor: withAlpha(Colors.primary500, 0.1),
            borderColor: withAlpha(Colors.primary500, 0.45),
            borderRadius: 16,
            borderWidth: 1,
            gap: 6,
            padding: 12,
          }}
          testID="reserver-equipe-bandeau"
        >
          <Text style={[Fonts.p2, Fonts.neutral00]}>{bandeau}</Text>
        </View>
      ) : null}
      {pourQui === 'equipe' && equipe ? (
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {t(
            'reserverTerrain.pourQui.aide',
            'La réservation est à ton nom ; les joueurs ajoutés répondent présent ou absent, '
              + 'comme à une convocation.',
          )}
        </Text>
      ) : null}
    </View>
  );
}

export default BlocPourQui;
