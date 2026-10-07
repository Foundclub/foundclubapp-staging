import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import InfosDuGroupe from '../InfosDuGroupe';

// MSG1A (§3.16) — « INFOS DU GROUPE » : ce que chacun voit, et ce que seul l'admin peut faire.
// Plus de bouton « Retirer » sur chaque ligne : on passe par la fiche du membre, puis par
// une confirmation.

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
      const gabarit = typeof repli === 'string' ? repli : repli?.defaultValue;
      if (typeof gabarit !== 'string') return cle;
      return gabarit.replace(/\{\{(\w+)\}\}/g, (_m, nom) => (repli?.[nom] !== undefined ? String(repli[nom]) : _m));
    },
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
  }),
}));
jest.mock('react-native-svg', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    Circle: VueRN,
    default: VueRN,
    Line: VueRN,
    Path: VueRN,
    Polyline: VueRN,
    Rect: VueRN,
    Svg: VueRN,
  };
});
jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const Colors = generateColors();
  return { __esModule: true, default: () => ({ Colors }) };
});
jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => () => null);
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => () => null);

const GROUPE = {
  groupName: 'Covoit U15',
  participants: [
    { documentId: 'karim', firstname: 'Karim', lastname: 'Benali' },
    { documentId: 'moi', firstname: 'Adel', lastname: 'F' },
    { documentId: 'lea', firstname: 'Lea', lastname: 'Morel' },
  ],
};

/**
 * Aide du temoin : `rendre`.
 * @param {any} [props]
 * @returns {{ arbre: any, appels: Record<string, jest.Mock> }}
 */
const rendre = (props = {}) => {
  const appels = {
    onAjouter: jest.fn(),
    onBasculerAdmin: jest.fn(),
    onClose: jest.fn(),
    onEnvoyerUnMessage: jest.fn(),
    onRenommer: jest.fn(() => Promise.resolve()),
    onRetirer: jest.fn(),
    onSignaler: jest.fn(),
  };
  const reglages = {
    adminIds: ['moi'],
    chat: GROUPE,
    estAdmin: true,
    meId: 'moi',
    ...appels,
    ...props,
  };
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <InfosDuGroupe
        adminIds={reglages.adminIds}
        chat={reglages.chat}
        estAdmin={reglages.estAdmin}
        meId={reglages.meId}
        onAjouter={reglages.onAjouter}
        onBasculerAdmin={reglages.onBasculerAdmin}
        onClose={reglages.onClose}
        onEnvoyerUnMessage={reglages.onEnvoyerUnMessage}
        onQuitter={reglages.onQuitter}
        onRenommer={reglages.onRenommer}
        onRetirer={reglages.onRetirer}
        onSignaler={reglages.onSignaler}
        visible
      />,
    );
  });
  return { appels, arbre };
};

/**
 * Aide du temoin : `parId`.
 * @param {any} arbre
 * @param {string} id
 * @returns {any}
 */
const parId = (arbre, id) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.testID === id
      && (typeof n.props?.onPress === 'function' || typeof n.props?.onChangeText === 'function'),
)[0];

/**
 * Aide du temoin : `textes`.
 * @param {any} arbre
 * @returns {string}
 */
const textes = (arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ n) => [n.props.children].flat().join(''))
  .join(' | ');

describe('InfosDuGroupe (§3.16)', () => {
  test(
    'IG1 — « Vous » en tete, pastille Admin, nombre de membres, aucun « Retirer » sur les lignes',
    () => {
      const { arbre } = rendre();
      const vu = textes(arbre);
      expect(vu).toContain('Covoit U15');
      expect(vu).toContain('Groupe · 3 membres');
      expect(vu.indexOf('Vous')).toBeLessThan(vu.indexOf('Karim Benali'));
      expect(vu).toContain('Admin');
      expect(vu).not.toContain('Retirer');
    },
  );

  test('IG2 — admin : renommer en direct, « Enregistrer » envoie le nouveau nom', async () => {
    const { appels, arbre } = rendre();
    act(() => {
      parId(arbre, 'infos-du-groupe-nom').props.onPress();
    });
    act(() => {
      parId(arbre, 'infos-du-groupe-champ-nom').props.onChangeText('Covoit U16');
    });
    await act(async () => {
      await parId(arbre, 'infos-du-groupe-enregistrer').props.onPress();
    });
    expect(appels.onRenommer).toHaveBeenCalledWith('Covoit U16');
  });

  test('IG3 — admin : fiche du membre > « Retirer du groupe » > confirmation > « Retirer »', () => {
    const { appels, arbre } = rendre();
    act(() => {
      parId(arbre, 'infos-du-groupe-membre-karim').props.onPress();
    });
    act(() => {
      parId(arbre, 'infos-du-groupe-retirer').props.onPress();
    });
    expect(textes(arbre)).toContain('Retirer Karim Benali du groupe ?');
    expect(appels.onRetirer).not.toHaveBeenCalled();

    act(() => {
      parId(arbre, 'infos-du-groupe-confirmer-retrait').props.onPress();
    });
    expect(appels.onRetirer).toHaveBeenCalledWith(GROUPE.participants[0]);
  });

  test('IG4 — admin : nommer admin, puis retirer le role a un admin', () => {
    const { appels, arbre } = rendre({ adminIds: ['moi', 'lea'] });
    act(() => {
      parId(arbre, 'infos-du-groupe-membre-karim').props.onPress();
    });
    expect(textes(arbre)).toContain('Nommer admin du groupe');
    act(() => {
      parId(arbre, 'infos-du-groupe-admin').props.onPress();
    });
    expect(appels.onBasculerAdmin).toHaveBeenLastCalledWith(GROUPE.participants[0], true);

    act(() => {
      parId(arbre, 'infos-du-groupe-membre-lea').props.onPress();
    });
    expect(textes(arbre)).toContain('Retirer le rôle d’admin');
    act(() => {
      parId(arbre, 'infos-du-groupe-admin').props.onPress();
    });
    expect(appels.onBasculerAdmin).toHaveBeenLastCalledWith(GROUPE.participants[2], false);
  });

  test(
    'IG5 — simple membre : ni renommage, ni ajout ; sa fiche n offre que « Envoyer un message »',
    () => {
      const { appels, arbre } = rendre({ adminIds: ['karim'], estAdmin: false });
      expect(parId(arbre, 'infos-du-groupe-ajouter')).toBeUndefined();
      expect(parId(arbre, 'infos-du-groupe-nom').props.disabled).toBe(true);

      act(() => {
        parId(arbre, 'infos-du-groupe-membre-karim').props.onPress();
      });
      expect(parId(arbre, 'infos-du-groupe-admin')).toBeUndefined();
      expect(parId(arbre, 'infos-du-groupe-retirer')).toBeUndefined();
      act(() => {
        parId(arbre, 'infos-du-groupe-message').props.onPress();
      });
      expect(appels.onEnvoyerUnMessage).toHaveBeenCalledWith(GROUPE.participants[0]);
    },
  );

  test('IG6 — « Signaler le groupe » et « Ajouter des membres »', () => {
    const { appels, arbre } = rendre();
    act(() => {
      parId(arbre, 'infos-du-groupe-signaler').props.onPress();
    });
    act(() => {
      parId(arbre, 'infos-du-groupe-ajouter').props.onPress();
    });
    expect(appels.onSignaler).toHaveBeenCalled();
    expect(appels.onAjouter).toHaveBeenCalled();
  });

  test('IG7 — « Quitter le groupe » pour tout membre : confirmation, puis le depart', () => {
    const onQuitter = jest.fn();
    const { arbre } = rendre({ adminIds: ['karim'], estAdmin: false, onQuitter });
    act(() => {
      parId(arbre, 'infos-du-groupe-quitter').props.onPress();
    });
    expect(textes(arbre)).toContain(
      'Quitter le groupe « Covoit U15 » ? Tu ne recevras plus ses messages.',
    );
    expect(onQuitter).not.toHaveBeenCalled();

    act(() => {
      parId(arbre, 'infos-du-groupe-confirmer-depart').props.onPress();
    });
    expect(onQuitter).toHaveBeenCalledTimes(1);
  });

  test('IG8 — sans onQuitter, pas de ligne « Quitter »', () => {
    const { arbre } = rendre();
    expect(parId(arbre, 'infos-du-groupe-quitter')).toBeUndefined();
  });
});
