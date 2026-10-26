// @ts-nocheck
/**
 * CardCompletionFlow — CARTECODE-PARCOURS (planche v2, partie 8) : « Compléter ma carte ».
 *
 * Une question par écran, dans l'ordre que donne `listMissingCardSteps` (la date EN PREMIER).
 * Chaque écran se passe : personne n'est bloqué. Pendant qu'on répond, `onDraft` remplit la
 * carte posée au-dessus (`card`) ; « Suivant » enregistre le seul champ de l'étape.
 * La date reprend les règles de `ProfileEdit` : moins de 15 ans sans déclaration ⇒ la case
 * de la déclaration parentale, et « Suivant » attend qu'elle soit cochée.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, StyleSheet, Text, View,
} from 'react-native';

import {
  formatBirthdateToDisplay,
  formatBirthdateToSend,
  isExistingBirthdate,
} from '@/domains/auth/authUseCases';
import { getGeohashForPointAndRadius } from '@/domains/places/placesUseCases';
import { CARD_COMPLETION_STEP as E } from '@/domains/playerCard/cardCompletion';
import { computeAge } from '@/domains/playerCard/cardModel';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Input from '@/components/molecules/input/Input';
// eslint-disable-next-line max-len
import ParentalDeclarationCard from '@/components/molecules/parentalDeclarationCard/ParentalDeclarationCard';
// eslint-disable-next-line max-len
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';
import OnboardingChoiceChip from '@/views/onboarding/components/OnboardingChoiceChip';

import { updateMe } from '@/services/auth/authService';

import { erreurPhysique } from '@/utils/heightCentimeters';

import {
  buildMinorParentalDeclarationPayload,
  isBirthdateInFuture,
  isBirthdateUnderParentalAge,
  isMinorParentAccountRequiredError,
} from '@/constants/parentalDeclaration';
import { getPositionsForSport } from '@/constants/positions';

const texte = (value) => (value === null || value === undefined ? '' : String(value));

/**
 * Le parcours, une question par écran ; la carte (`card`) se remplit au-dessus.
 * @param {{
 *   card: import('react').ReactNode,
 *   onDraft: (patch: object | null) => void,
 *   onFinish: () => void,
 *   onSaved: () => void,
 *   steps: string[],
 *   user: object,
 * }} props
 * @returns {import('react').ReactElement}
 */
function CardCompletionFlow({
  card, onDraft, onFinish, onSaved, steps, user,
}) {
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [date, setDate] = useState('');
  const [declarationChecked, setDeclarationChecked] = useState(false);
  const [position, setPosition] = useState('');
  const [height, setHeight] = useState(texte(user?.height));
  const [weight, setWeight] = useState(texte(user?.weight));
  const [address, setAddress] = useState(null);
  const [number, setNumber] = useState('');

  const step = steps[index];
  const isLast = index >= steps.length - 1;

  // La date : un jour qui existe, pas dans le futur.
  const dateIso = isExistingBirthdate(date) ? formatBirthdateToSend(date) : '';
  const dateValide = Boolean(dateIso) && !isBirthdateInFuture(dateIso)
    && computeAge(dateIso) !== null;
  const needsDeclaration = dateValide && isBirthdateUnderParentalAge(dateIso)
    && user?.parentalDeclarationAccepted !== true;

  const age = computeAge(dateValide ? dateIso : user?.birthdate);
  const tailleLue = erreurPhysique('height', height, age);
  const poidsLu = erreurPhysique('weight', weight, age);

  const avancer = () => {
    if (isLast) onFinish();
    else setIndex(index + 1);
  };

  // La charge de l'étape : le seul champ qu'elle demande. `null` = rien à enregistrer.
  const charge = () => {
    switch (step) {
      case E.BIRTHDATE:
        if (!dateValide) return null;
        return {
          birthdate: dateIso,
          ...(needsDeclaration ? {
            legalAcceptance: buildMinorParentalDeclarationPayload({
              metadata: { birthdate: dateIso, childUserDocumentId: user?.documentId || null },
              sourceScreen: 'player_card_completion_parental_declaration',
              targetDocumentId: user?.documentId || null,
            }),
            parentalDeclarationAccepted: true,
          } : {}),
        };
      case E.CITY: {
        if (!address) return null;
        const [lon, lat] = String(address.value || '').split('|');
        const geohash = lat && lon
          ? getGeohashForPointAndRadius(parseFloat(lat), parseFloat(lon), 0.001)
          : null;
        return { address, ...(geohash ? { geohash } : {}) };
      }
      case E.PHYSIQUE: {
        const patch = {
          ...(tailleLue.valeur ? { height: tailleLue.valeur } : {}),
          ...(poidsLu.valeur ? { weight: poidsLu.valeur } : {}),
        };
        return Object.keys(patch).length ? patch : null;
      }
      case E.POSITION:
        return position ? { position } : null;
      default:
        return number === '' ? null : { jerseyNumber: Number.parseInt(number, 10) };
    }
  };

  const peutAvancer = (() => {
    if (isSaving) return false;
    switch (step) {
      case E.BIRTHDATE: return dateValide && (!needsDeclaration || declarationChecked);
      case E.PHYSIQUE: return !tailleLue.cle && !poidsLu.cle && Boolean(charge());
      default: return Boolean(charge());
    }
  })();

  const enregistrer = async () => {
    const patch = charge();
    if (!patch) return;
    setIsSaving(true);
    try {
      await updateMe(patch);
      // Le profil en mémoire se relit ; le brouillon tient la carte en attendant.
      onDraft(patch);
      onSaved();
      avancer();
    } catch (error) {
      Alert.alert(
        t('common.error', 'Erreur'),
        isMinorParentAccountRequiredError(error)
          ? t(
            'playerCard.completion.under13',
            'Avant 13 ans, un compte FoundClub se crée avec un parent. Tu peux passer cette étape.',
          )
          : t(
            'playerCard.completion.saveError',
            'Impossible d\'enregistrer pour le moment. Vérifie ta connexion, ou passe cette étape.',
          ),
      );
    } finally {
      setIsSaving(false);
    }
  };

  // « Passer » n'écrit rien : la carte redevient ce qui est enregistré.
  const passer = () => {
    const champs = {
      [E.BIRTHDATE]: ['birthdate'],
      [E.CITY]: ['address'],
      [E.NUMBER]: ['jerseyNumber'],
      [E.PHYSIQUE]: ['height', 'weight'],
      [E.POSITION]: ['position'],
    }[step] || [];
    onDraft(Object.fromEntries(champs.map((champ) => [champ, user?.[champ] ?? null])));
    avancer();
  };

  const titre = {
    [E.BIRTHDATE]: t('playerCard.completion.birthdate.title', 'Ta date de naissance'),
    [E.CITY]: t('playerCard.completion.city.title', 'Ta ville'),
    [E.NUMBER]: t('playerCard.completion.number.title', 'Ton numéro de maillot'),
    [E.PHYSIQUE]: t('playerCard.completion.physique.title', 'Ta taille et ton poids'),
    [E.POSITION]: t('playerCard.completion.position.title', 'Ton poste'),
  }[step];

  const aide = {
    [E.BIRTHDATE]: t(
      'playerCard.completion.birthdate.hint',
      'Seul ton âge apparaît sur ta carte. Ta date reste privée.',
    ),
    [E.CITY]: t('playerCard.completion.city.hint', 'Jamais ton adresse.'),
    [E.PHYSIQUE]: t('playerCard.completion.physique.hint', 'Tu peux les effacer quand tu veux.'),
  }[step];

  const corps = () => {
    switch (step) {
      case E.BIRTHDATE:
        return (
          <View style={[Spaces.gap[12]]}>
            <Input
              enterKeyHint="done"
              error={date.length === 10 && !dateValide
                ? t(
                  'playerCard.completion.birthdate.invalid',
                  'Écris une date qui existe : JJ/MM/AAAA.',
                )
                : undefined}
              inputMode="numeric"
              keyboardType="number-pad"
              label={t('profile.fields.birthdate.label', 'Date de naissance')}
              maxLength={10}
              onChangeText={(valeur) => {
                const affichee = formatBirthdateToDisplay(valeur);
                setDate(affichee);
                const iso = isExistingBirthdate(affichee) ? formatBirthdateToSend(affichee) : '';
                const lue = iso && !isBirthdateInFuture(iso) ? iso : null;
                onDraft({ birthdate: lue || user?.birthdate || null });
              }}
              placeholder={t('profile.fields.birthdate.placeholder', 'JJ/MM/AAAA')}
              value={date}
            />
            {needsDeclaration ? (
              <ParentalDeclarationCard
                checked={declarationChecked}
                helperText={!declarationChecked ? t(
                  'profileEdit.parentalDeclaration.required',
                  'Coche la déclaration parentale pour enregistrer.',
                ) : undefined}
                onChange={setDeclarationChecked}
              />
            ) : null}
          </View>
        );
      case E.CITY:
        return (
          <AutocompleteAddressInput
            address={address}
            label={t('playerCard.completion.city.label', 'Ville ou code postal')}
            placeholder={t('profile.fields.city.placeholder', 'Rechercher une ville')}
            setAddress={(valeur) => {
              setAddress(valeur);
              onDraft({ address: valeur || user?.address || null });
            }}
          />
        );
      case E.PHYSIQUE:
        return (
          <View style={[Alignments.row, Spaces.gap[12]]}>
            <View style={styles.moitie}>
              <Input
                error={tailleLue.cle ? t(tailleLue.cle) : undefined}
                inputMode="numeric"
                keyboardType="number-pad"
                label={t('profile.fields.height.label', 'Taille (cm)')}
                maxLength={3}
                onChangeText={(valeur) => {
                  setHeight(valeur);
                  const lu = erreurPhysique('height', valeur, age);
                  onDraft({ height: !lu.cle && lu.valeur ? lu.valeur : user?.height ?? null });
                }}
                placeholder={t('profile.fields.height.placeholder', 'Ex : 180')}
                value={height}
              />
            </View>
            <View style={styles.moitie}>
              <Input
                error={poidsLu.cle ? t(poidsLu.cle) : undefined}
                inputMode="decimal"
                keyboardType="decimal-pad"
                label={t('profile.fields.weight.label', 'Poids (kg)')}
                maxLength={5}
                onChangeText={(valeur) => {
                  setWeight(valeur);
                  const lu = erreurPhysique('weight', valeur, age);
                  onDraft({ weight: !lu.cle && lu.valeur ? lu.valeur : user?.weight ?? null });
                }}
                placeholder={t('profile.fields.weight.placeholder', 'Ex : 75')}
                value={weight}
              />
            </View>
          </View>
        );
      case E.POSITION:
        return (
          <View style={[Alignments.row, Spaces.gap[8], styles.chips]}>
            {getPositionsForSport(user?.preferredSport).map((option) => (
              <OnboardingChoiceChip
                checked={position === option.value}
                key={option.value}
                label={option.label}
                onPress={() => {
                  setPosition(option.value);
                  onDraft({ position: option.value });
                }}
              />
            ))}
          </View>
        );
      default:
        return (
          <Input
            enterKeyHint="done"
            inputMode="numeric"
            keyboardType="number-pad"
            label={t('playerCard.completion.number.label', 'Numéro')}
            maxLength={2}
            onChangeText={(valeur) => {
              const chiffres = valeur.replace(/[^0-9]/g, '');
              setNumber(chiffres);
              onDraft({ jerseyNumber: chiffres === '' ? null : Number.parseInt(chiffres, 10) });
            }}
            placeholder={t('profile.fields.jerseyNumber.placeholder', 'Ex. 10')}
            value={number}
          />
        );
    }
  };

  return (
    <View style={[Spaces.gap[16]]}>
      <View style={[Spaces.gap[8]]}>
        <Text style={[Fonts.label, { color: Colors.primary200, letterSpacing: 1 }]}>
          {t('playerCard.completion.step', {
            current: index + 1,
            defaultValue: 'ÉTAPE {{current}} SUR {{total}}',
            total: steps.length,
          })}
        </Text>
        <View style={[styles.piste, { backgroundColor: Colors.neutral800 }]}>
          <View
            style={[styles.piste, {
              backgroundColor: Colors.primary500,
              width: `${Math.round(((index + 1) / steps.length) * 100)}%`,
            }]}
          />
        </View>
      </View>
      {card}
      <Text style={[Fonts.h3Black, Fonts.neutral00]}>{titre}</Text>
      {corps()}
      {aide ? <Text style={[Fonts.p3, Fonts.neutral300]}>{aide}</Text> : null}
      <View style={[Spaces.gap[8]]}>
        <Button
          disabled={!peutAvancer}
          isLoading={isSaving}
          onPress={enregistrer}
          title={isLast
            ? t('playerCard.completion.finish', 'Terminer')
            : t('playerCard.completion.next', 'Suivant')}
          variant="Primary"
        />
        <Button
          disabled={isSaving}
          onPress={passer}
          title={t('playerCard.completion.skip', 'Passer')}
          variant="Ghost"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexWrap: 'wrap' },
  moitie: { flex: 1 },
  piste: { borderRadius: 999, height: 4 },
});

export default CardCompletionFlow;
