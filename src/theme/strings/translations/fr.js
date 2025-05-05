export default {
  addCoach: {
    actions: {
      save: 'Ajouter',
    },
    alerts: {
      alreadyExist: {
        actions: {
          addToClub: 'Ajouter au club',
          cancel: 'Annuler',
        },
        description: "Le détenteur de ce numéro de téléphone utilise l'application sous le nom de {{firstname}} {{lastname}}. Voulez-vous l'ajouter à votre club ?",
        title: 'Un utilisateur existe déjà avec ce numéro de téléphone.',
      },
      alreadyInClub: {
        description: "Un utilisateur du nom de {{firstname}} {{lastname}} est déjà membre d'un autre club.",
        title: "Impossible d'ajouter cet·te entraîneur·e à l'équipe",
      },
    },
    fields: {
      birthdate: {
        label: 'Date de naissance',
        placeholder: 'JJ/MM/AAAA',
      },
      firstname: {
        label: 'Prénom',
        placeholder: 'Luc',
      },
      lastname: {
        label: 'Nom',
        placeholder: 'Harne',
      },
      phoneNumber: {
        label: 'Numéro de téléphone',
        placeholder: '+33612345678',
      },
    },
    subtitles: {
      avatar: "Ajoutez une photo de profil pour que l'on puisse reconnaître l'entraîneur·e facilement.",
      birthdate: "Renseignez la date de naissance de l'entraîneur·e.",
      name: "Renseignez le nom et prénom de l'entraîneur·e.",
    },
    titles: {
      avatar: 'Une photo de profil ?',
      birthdate: 'Quelle est sa date de naissance ?',
      main: 'Ajouter un·e entraîneur·e',
      name: "Comment s'appelle l'entraîneur·e ?",
    },
  },
  addSponsor: {
    actions: {
      save: 'Ajouter',
    },
    fields: {
      link: {
        label: 'Lien vers le site du partenaire',
        placeholder: 'https://www.nike.com',
      },
      logo: 'Logo du partenaire',
      title: {
        label: 'Nom du partenaire',
        placeholder: 'Nike',
      },
    },
    title: 'Ajouter un partenaire',
  },
  APIerrors: {
    // Authentication errors
    AUTHENTICATION_FAILED: "Échec d'authentification.",
    INVALID_TOKEN: "Jeton d'authentification invalide.",
    MISSING_TOKEN: "Jeton d'authentification manquant.",

    // Authorization errors
    FORBIDDEN: 'Accès refusé.',
    UNAUTHORIZED: "Vous n'êtes pas autorisé·e à effectuer cette action.",

    // Validation errors
    INVALID_FIELD_FORMAT: 'Format de champ invalide.',
    MISSING_REQUIRED_FIELD: 'Un champ obligatoire est manquant.',
    VALIDATION_ERROR: 'Erreur de validation.',

    // User errors
    EMAIL_TAKEN: 'Cette adresse email est déjà utilisée.',
    PHONE_NUMBER_TAKEN: 'Ce numéro de téléphone est déjà utilisé.',
    USER_ALREADY_EXISTS: 'Cet utilisateur existe déjà.',
    USER_NOT_FOUND: 'Utilisateur introuvable.',
    USERNAME_TAKEN: "Ce nom d'utilisateur est déjà utilisé.",

    // Club errors
    CLUB_DELETE_ERROR: 'Erreur lors de la suppression du club.',
    CLUB_IMPORT_ERROR: "Erreur lors de l'import des données du club.",
    CLUB_NOT_FOUND: 'Club introuvable.',
    CLUB_SPONSOR_ERROR: 'Erreur concernant le partenaire du club.',
    CLUB_UPDATE_ERROR: 'Erreur lors de la mise à jour du club.',
    USER_NOT_IN_CLUB: "L'utilisateur n'est pas membre du club.",

    // Membership request errors
    MEMBERSHIP_REQUEST_ALREADY_PROCESSED: "La demande d'adhésion a déjà été traitée.",
    MEMBERSHIP_REQUEST_NOT_PENDING: "La demande d'adhésion n'est pas en attente.",
    MEMBERSHIP_REQUEST_REFUSED: "La demande d'adhésion a été refusée.",

    // Activity errors
    ACTIVITY_DELETE_ERROR: "Erreur lors de la suppression de l'activité.",

    // Trainer errors
    NOT_A_TRAINER: "L'utilisateur n'est pas un·e entraîneur·e.",
    TRAINER_ALREADY_IN_CLUB: "L'entraîneur·e est déjà membre d'un club.",
    TRAINER_HAS_TEAMS: "L'entraîneur·e est associé·e à des équipes.",
    TRAINER_IS_UNIQUE_TEAM_TRAINER: "L'entraîneur·e est le/la seul·e entraîneur·e de l'équipe.",
    TRAINER_NOT_FOUND: 'Entraîneur·e introuvable.',
    TRAINER_NOT_IN_CLUB: "L'entraîneur·e n'est pas membre du club.",

    // Team errors
    CLUB_MAX_TEAM_NUMBER_REACHED: 'Le nombre maximum d\'équipes pour ce club a été atteint.',
    TEAM_CLUB_REQUIRED: 'Un club est requis pour chaque équipe.',
    TEAM_MEMBER_POLICY_ERROR: 'Violation de la politique concernant les membres de l\'équipe.',
    TEAM_PLAYER_REMOVE_ERROR: 'Erreur lors de la suppression du/de la joueur·se de l\'équipe.',
    TEAM_TRAINER_CONNECT_REQUIRED: 'La connexion avec l\'entraîneur·e est requise.',
    TEAM_TRAINER_REMOVE_ERROR: 'Erreur lors de la suppression de l\'entraîneur·e de l\'équipe.',
    TEAM_TRAINER_REQUIRED: 'Au moins un·e entraîneur·e est requis·e pour chaque équipe.',
    TEAM_TRAINER_SET_REQUIRED: 'Une équipe d\'entraîneur·e·s est requise.',

    // Department errors
    DEPARTMENT_IMPORT_ERROR: 'Erreur lors de l\'import des données du département.',
    DEPARTMENT_REQUIRED: 'Le département est requis.',

    // Event errors
    EVENT_CAPACITY_ERROR: 'La capacité maximale de l\'événement est atteinte.',
    EVENT_DATE_ERROR: 'La date de l\'événement est invalide.',
    EVENT_IS_NOT_ACTIVE_ERROR: 'L\'événement n\'est pas actif.',
    EVENT_PARTICIPATION_ACCEPT_ERROR: 'Erreur lors de l\'acceptation de la participation.',
    EVENT_PARTICIPATION_ALREADY_TREATED: 'La demande de participation a déjà été traitée.',
    EVENT_PARTICIPATION_CREATE_ERROR: 'Erreur lors de la création de la participation.',
    EVENT_PARTICIPATION_REFUSE_ERROR: 'Erreur lors du refus de la participation.',
    EVENT_USER_ALREADY_IN_EVENT_ERROR: 'L\'utilisateur·rice est déjà inscrit·e à cet événement.',
    EVENT_USER_NOT_PLAYER_OF_TEAM_ERROR: 'L\'utilisateur·rice n\'est pas joueur·se de l\'équipe.',

    // Event participation request errors
    EVENT_PARTICIPATION_ALREADY_HAS_A_REQUEST_POLICY_ERROR: 'Une demande de participation existe déjà pour cet événement.',
    EVENT_PARTICIPATION_REQUEST_ALREADY_EXISTS: 'Une demande de participation existe déjà.',
    EVENT_PARTICIPATION_REQUEST_NOT_FOUND: 'Demande de participation introuvable.',
    EVENT_PARTICIPATION_REQUEST_POLICY_ERROR: 'Violation de la politique concernant les demandes de participation.',

    // Policy errors
    TEAM_MANAGER_POLICY_ERROR: 'Violation de la politique concernant les gestionnaires d\'équipe.',

    // Server errors
    DATABASE_ERROR: 'Erreur de base de données.',
    INTERNAL_SERVER_ERROR: 'Erreur interne du serveur.',

    // File upload errors
    FILE_TOO_LARGE: 'Fichier trop volumineux.',
    FILE_UPLOAD_ERROR: 'Erreur lors du téléchargement du fichier.',
    INVALID_FILE_TYPE: 'Type de fichier invalide.',

    // Policy errors
    CLUB_MANAGER_POLICY_ERROR: 'Violation de la politique concernant les dirigeant·e·s du club.',
    CLUB_MEMBER_POLICY_ERROR: 'Violation de la politique concernant les membres du club.',
    CLUB_STAFF_CREATE_POLICY_ERROR: 'Violation de la politique de création de personnel du club.',
    CLUB_STAFF_POLICY_ERROR: 'Violation de la politique concernant le personnel du club.',
    EVENT_TRAINER_CREATE_POLICY_ERROR: "Violation de la politique de création d'événements par les entraîneur·e·s.",
    EVENT_TRAINER_POLICY_ERROR: 'Violation de la politique concernant les entraîneur·e·s et les événements.',
    generic: 'Une erreur est survenue. Veuillez réessayer plus tard.',
    HAD_PENDING_MEMBERSHIP_REQUEST_POLICY_ERROR: "Vous avez déjà une demande d'adhésion en attente.",
    MANAGER_TRAINER_CLUB_POLICY_ERROR: 'Violation de la politique concernant les entraîneur·e·s et dirigeant·e·s du club.',
    MANAGER_WITH_CLUB_POLICY_ERROR: 'Violation de la politique concernant les dirigeant·e·s avec club.',
    phoneNumberAlreadyUsed: 'Ce numéro est déjà utilisé par {{firstname}} {{lastname}}.',
    phoneNumberAlreadyUsedWithClub: 'Ce numéro est déjà utilisé par un·e entraîneur·e qui appartient à un club.',
    'Request failed with status code 404': 'La ressource demandée est introuvable.',
    schemaMismatch: 'Un problème est survenu lors de la récupération des informations.'
    + ' Veuillez vérifier que votre application est à jour ou réessayer plus tard.',
    title: 'Erreur',
  },
  clubDetails: {
    actions: {
      delete: 'Supprimer',
      join: "C'est mon club !",
      manageJoinRequests: 'Voir les demandes d\'affiliation',
    },
    alerts: {
      deleteSponsor: {
        actions: {
          cancel: 'Annuler',
          confirm: 'Supprimer',
        },
        description: 'Êtes-vous sûr·e de vouloir continuer ?',
        title: 'Vous êtes sur le point de supprimer le partenaire {{sponsorName}} .',
      },
      deleteTrainer: {
        actions: {
          cancel: 'Annuler',
          confirm: 'Supprimer',
        },
        description: 'Le compte ne sera pas supprimé mais l\'entraineur·e ne sera plus lié au club. Êtes-vous sûr·e de vouloir continuer ?',
        title: 'Vous êtes sur le point de supprimer cet·te entraîneur·e.',
      },
      inviteTrainer: {
        message: 'Bonjour {{coachName}} !'
        + '\nVous avez été désigné comme entraineur·e dans le club {{clubName}}.'
        + "\nTéléchargez l'application Found Club pour finaliser la création de votre compte"
        + ' et commencer à gérer vos équipes et vos évènements.'
        + '\nIOS : {{appStoreUrl}}'
        + '\nAndroid : {{googlePlayUrl}}',
        title: 'Bienvenue sur Found Club !',
      },
      joinClub: {
        actions: {
          ok: 'OK',
        },
        description: 'Votre dirigeant·e va recevoir votre demande et la traiter dès que possible.',
        title: "Votre demande d'adhésion a bien été envoyée",
      },
    },
    titles: {
      activities: 'Activités',
      coachs: 'Nos entraîneur·e·s',
      sponsors: 'Nos partenaires',
      teams: 'Équipes',
    },
  },
  clubFilters: {
    actions: {
      apply: 'Appliquer les filtres',
      clear: 'Effacer les filtres',
    },
    fields: {
      activity: {
        label: 'Activité',
        placeholder: 'Basketball',
      },
      city: {
        label: 'Ville',
        placeholder: 'Marseille',
      },
      radius: {
        label: 'Dans un rayon autour de : ',
      },
    },
  },
  clubList: {
    actions: {
      createClub: 'Ajouter mon club',
    },
    fields: {
      search: 'Rechercher',
    },
    noData: 'Aucun club ne correspond à la recherche.',
    title: 'Trouver mon club ',
  },
  clubMembershipRequestList: {
    actions: {
      accept: 'Accepter',
      reject: 'Refuser',
    },
    fields: {
      accepted: 'Demande acceptée',
      pending: "{{firstname}} s'est signalé comme entraineur·e de cette équipe ",
      rejected: 'Demande refusée',
    },
    noData: 'Aucune demande d\'affiliation en attente',
    title: 'Demandes d\'affiliation',
  },
  common: {
    actions: {
      cancel: 'Annuler',
      photoFromCamera: 'Prendre une photo',
      photoFromGallery: 'Choisir depuis la gallerie',
    },
    messages: {
      noData: 'Aucune donnée disponible',
    },
  },
  createClubRequest: {
    actions: {
      create: 'Ajouter le club',
      ok: 'OK',
    },
    alerts: {
      description: "L'équipe Found Club va examiner votre demande et vous recontacter dans les plus brefs délais.",
      title: 'Votre demande de création de club a bien été envoyée',
    },
    fields: {
      clubName: {
        label: 'Nom du club',
        placeholder: 'FC Marseille',
      },
      holderFirstname: {
        label: 'Prénom du responsable',
        placeholder: 'Luc',
      },
      holderLastname: {
        label: 'Nom du responsable',
        placeholder: 'Harne',
      },
      holderPhone: {
        label: 'Numéro de téléphone du responsable',
        placeholder: '0612345678',
      },
    },
    title: 'Ajouter un club',
  },
  errorPage: {
    action: 'Recharger la page',
    subtitle: 'Une erreur est survenue.',
    title: 'Oups !',
  },
  eventEdit: {
    actions: {
      save: 'Enregistrer',
    },
    fields: {
      capacity: {
        label: 'Capacité',
        placeholder: 'Nombre de participant·e·s',
      },
      club: {
        label: 'Club',
        placeholder: 'Sélectionner un club',
      },
      date: {
        label: "Date de l'évènement",
        placeholder: 'JJ/MM/AAAA',
      },
      description: {
        label: 'Description',
        placeholder: 'Évènement de détection ouvert à tous·tes les joueur·se·s.',
      },
      location: {
        label: 'Lieu',
        placeholder: 'Sélectionner un lieu',
      },
      sessionStatus: {
        label: 'Statut de la session',
        options: {
          closed: 'Fermé',
          open: 'Ouvert',
        },
      },
      team: {
        label: 'Équipe',
        placeholder: 'Sélectionner une équipe',
      },
      time: {
        label: "Horaire de l'évènement",
        placeholder: 'JJ/MM/AAAA',
      },
      type: {
        label: 'Type d\'évènement',
        placeholder: 'Sélectionner un type d\'évènement',
      },
      validationMode: {
        label: 'Mode de validation',
        options: {
          auto: 'Automatique',
          manual: 'Manuelle',
        },
      },
    },
    title: 'Créer un évènement',
    titleEdit: 'Modifier l\'évènement',
  },
  home: {
    fields: {
      type: {
        label: 'Trouver',
        options: {
          club: 'un club',
          event: 'un évènement',
          team: 'une équipe',
        },
      },
    },
  },
  login: {
    actions: {
      login: 'Se connecter',
      register: 'Créer un compte',
    },
    fields: {
      phoneNumber: {
        label: 'Numéro de téléphone',
        placeholder: '0612345678',
      },
    },
    or: 'ou',
    subtitle: 'Renseigne ton numéro de téléphone.',
    title: 'Connecte-toi',
  },
  menu: {
    chat: 'Messagerie',
    myAccount: 'Mon compte',
    search: 'Rechercher',
  },
  modals: {
    actions: {
      search: 'Rechercher...',
      select: 'Sélectionner',
    },
    phone: {
      title: 'Sélectionner un pays',
    },
  },
  myTeamList: {

    title: 'Mes équipes',
  },
  otp: {
    actions: {
      confirm: 'Confirmer',
    },
    fields: {
      code: {
        label: 'Code de confirmation',
        placeholder: '123456',
      },
    },
    subtitle: 'Entre le code reçu par SMS.',
    title: 'Confirme ton numéro',
  },
  profile: {
    actions: {
      deleteAccount: 'Supprimer mon compte',
      edit: 'Modifier mon profil',
      findClub: 'Trouver mon club',
      ignore: 'Ignorer',
      logout: 'Déconnexion',
      manageClub: 'Gérer mon club',
      manageClubJoinRequests: 'Gérer les demandes d\'affiliation au club',
      manageEvents: 'Gérer mes évènements',
      manageTeamJoinRequests: 'Gérer les demandes d\'adhésion aux équipes',
      manageTeams: 'Gérer mes équipes',
      myTeams: 'Mes équipes',
      save: 'Continuer',
    },
    alerts: {
      deleteAlert: {
        actions: {
          cancel: 'Annuler',
          confirm: 'Ouvrir le formulaire',
        },
        subtitle: 'Pour demander la suppression de votre compte merci de remplir le formulaire de contact'
        + ' suivant en précisant votre demande.',
        title: 'Supprimer votre compte ?',
      },
    },
    fields: {
      birthdate: {
        label: 'Date de naissance',
        placeholder: 'JJ/MM/AAAA',
      },
      firstname: {
        label: 'Prénom',
        placeholder: 'Luc',
      },
      lastname: {
        label: 'Nom',
        placeholder: 'Harne',
      },
      phoneNumber: {
        label: 'Numéro de téléphone',
        placeholder: '+33612345678',
      },
      section: {
        label: 'Section',
        placeholder: 'Sélectionner une section',
      },
      sections: {
        female: 'Féminine',
        male: 'Masculine',
      },
      types: {
        coach: 'Entraîneur·e',
        player: 'Joueur·se',
        president: 'Dirigeant·e',
      },
    },
    subtitles: {
      avatar: "Ajoute une photo de profil pour que l'on puisse te reconnaître facilement.",
      birthdate: 'Renseigne ta date de naissance.',
      name: 'Renseigne ton nom et prénom.',
      section: 'Renseigne la catégorie de sexe dans laquelle tu évolues',
      type: 'Renseignez votre fonction principale.',
    },
    titles: {
      avatar: 'Une photo de profil ?',
      birthdate: 'Quelle est ta date de naissance ?',
      edit: 'Modifier mes informations',
      name: "Comment t'appelles-tu ?",
      profile: 'Mon compte',
      section: 'Dans quelle section évolues-tu ?',
      type: 'Quel est votre statut ?',
    },
  },
  register: {
    actions: {
      register: 'Continuer',
    },
    fields: {
      phoneNumber: {
        label: 'Numéro de téléphone',
        placeholder: '0612345678',
      },
    },
    subtitle: 'Renseigne ton numéro de téléphone.',
    title: 'Crée ton compte',
  },
  teamDetails: {
    actions: {
      edit: 'Modifier l\'équipe',
      join: "C'est mon équipe !",
      leave: "Quitter l'équipe",
    },
    alerts: {
      invitePlayers: {
        message: 'Bonjour !'
        + '\nVotre équipe {{teamName}} de votre club {{clubName}} vous attends !'
        + "\nTéléchargez l'application Found Club pour finaliser la création de votre compte"
        + ' et commencer accéder et participer aux évènements de votre équipe.'
        + '\nIOS : {{appStoreUrl}}'
        + '\nAndroid : {{googlePlayUrl}}',
        title: 'Vos coéquipiers vous attendent !',
      },
      joinRequest: {
        actions: {
          ok: 'OK',
        },
        description: 'Votre entraîneur·e va recevoir votre demande et la traiter dès que possible.',
        title: 'Votre demande d\'adhésion a bien été envoyée',
      },
      leave: {
        actions: {
          cancel: 'Annuler',
          confirm: "Quitter l'équipe",
        },
        description: 'Vous êtes sur le point de quitter l\'équipe. Une fois cette action validée vous ne pourrez plus participer aux entrainements et matchs.',
        title: 'Êtes-vous sûr·e de vouloir quitter cette équipe ?',
      },
    },
    sections: {
      players_one: 'Joueur·se',
      players_other: 'Joueur·se·s',
      trainers_one: 'Entraîneur·e',
      trainers_other: 'Entraîneur·e·s',
    },
    title: 'Mon équipe',
  },
  teamEdit: {
    actions: {
      save: 'Enregistrer',
    },
    fields: {
      activities: {
        label: 'Activités',
        placeholder: 'Basketball',
      },
      category: {
        label: 'Catégorie',
        placeholder: 'U16',
      },
      description: {
        label: 'Description',
        placeholder: 'Équipe senior évoluant en championnat régional depuis 2015.',
      },
      level: {
        label: 'Niveau',
        placeholder: 'Régional',
      },
      name: {
        label: 'Nom de l\'équipe',
        placeholder: 'Les lions de Marseille',
      },
      section: {
        label: 'Section',
        placeholder: 'Féminine',
      },
      trainers: {
        label: 'Entraîneur·e·s',
        placeholder: 'Luc Harne',
      },
    },
    title: 'Créer une équipe',
    titleEdit: "Modifier l'équipe",
  },
  teamFilters: {
    actions: {
      apply: 'Appliquer les filtres',
      clear: 'Effacer les filtres',
    },
    fields: {
      activities: {
        label: 'Activités',
        placeholder: 'Basketball',
      },
      category: {
        label: 'Catégorie',
        placeholder: 'U16',
      },
      level: {
        label: 'Niveau',
        placeholder: 'Régional',
      },
      section: {
        label: 'Section',
        placeholder: 'Féminine',
      },
    },
  },
  teamList: {
    actions: {
      add: 'Ajouter une équipe',
    },
    alerts: {
      maxTeamLimitReached: {
        actions: {
          cancel: 'Abandon',
          contact: 'Contacter Found Club',
        },
        description: 'Vous avez atteint le nombre maximum d\'équipes autorisées dans votre club. Veuillez contacter Found Club pour débloquer cette limite.',
        title: 'Limite d\'équipes atteinte',
      },
    },
    fields: {
      category: 'Catégorie',
      level: 'Niveau',
      section: 'Section',
    },
    noData: 'Aucune équipe trouvée.',
    title: 'Équipes de mon club',
  },
  teamMembershipRequestList: {
    actions: {
      accept: 'Accepter',
      reject: 'Refuser',
    },
    fields: {
      accepted: 'Demande acceptée',
      pending: "{{firstname}} s'est signalé comme joueur·se de l'équipe {{teamName}} ",
      rejected: 'Demande refusée',
    },
    noData: 'Aucune demande d\'adhésion en attente',
    title: 'Demandes d\'adhésion',
  },
  welcome: {
    actions: {
      go: 'Allons-y !',
    },
    descriptions: {
      club: {
        bold: '🔥 Rejoins un club',
        regular: 'et progresse dans ta carrière sportive.',
      },
      info: {
        bold: '📢 Reste informé·e',
        regular: ' des nouveautés grâce aux notifications',
      },
      register: {
        bold: '📅 Inscris-toi',
        regular: ' à des entrainements et détections ouverts',
      },
      search: {
        bold: '🔎 Recherche',
        regular: ' des clubs et des évènements près de chez toi.',
      },
    },
    subtitle: 'Prêt·e à trouver ton club et évoluer dans le sport ?',
    title: 'Bienvenu·e sur',
  },
};
