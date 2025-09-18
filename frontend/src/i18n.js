// Internationalization system for VONEX
export const languages = {
  en: { name: 'English', flag: '🇺🇸', code: 'en' },
  ro: { name: 'Română', flag: '🇷🇴', code: 'ro' },
  es: { name: 'Español', flag: '🇪🇸', code: 'es' },
  fr: { name: 'Français', flag: '🇫🇷', code: 'fr' },
  de: { name: 'Deutsch', flag: '🇩🇪', code: 'de' },
  it: { name: 'Italiano', flag: '🇮🇹', code: 'it' },
  pt: { name: 'Português', flag: '🇵🇹', code: 'pt' },
  ru: { name: 'Русский', flag: '🇷🇺', code: 'ru' },
  zh: { name: '中文', flag: '🇨🇳', code: 'zh' },
  ja: { name: '日本語', flag: '🇯🇵', code: 'ja' }
};

export const translations = {
  en: {
    // App Name
    appName: 'VONEX',
    appDescription: 'Modern Chat Platform',
    
    // Authentication
    welcomeBack: 'Welcome Back to VONEX',
    joinVonex: 'Join VONEX',
    signInSubtitle: 'Sign in to continue chatting',
    createAccountSubtitle: 'Create your account to get started',
    firstName: 'First Name',
    firstNamePlaceholder: 'e.g. John',
    lastName: 'Last Name', 
    lastNamePlaceholder: 'e.g. Smith',
    nickname: 'Nickname',
    nicknamePlaceholder: 'e.g. JohnS or Johnny',
    emailAddress: 'Email Address',
    emailPlaceholder: 'name@example.com',
    password: 'Password',
    passwordPlaceholder: 'Your secret password',
    signIn: 'Sign In',
    createAccount: 'Create Account',
    pleaseWait: 'Please wait...',
    noAccountYet: "Don't have an account yet?",
    alreadyHaveAccount: 'Already have an account?',
    registerHere: 'Register here',
    signInHere: 'Sign in here',
    
    // Dashboard
    welcome: 'Welcome',
    newRoom: 'New Room',
    logout: 'Logout',
    
    // Rooms
    createNewRoom: 'Create New Room',
    startConversation: 'Start a conversation on a topic you love',
    roomName: 'Room Name',
    roomNamePlaceholder: 'e.g. General Discussion, Gaming, Music...',
    roomDescription: 'Room Description',
    roomDescriptionPlaceholder: 'Describe what this room is about...',
    privateRoom: 'Private Room',
    privateRoomDesc: 'Only invited people can join',
    cancel: 'Cancel',
    createRoom: 'Create Room',
    members: 'members',
    active: 'Active now',
    createdBy: 'Created by',
    you: 'you',
    someone: 'someone',
    noRoomsYet: 'No rooms yet',
    noRoomsDescription: 'Start by creating your first chat room or join an existing one',
    createFirstRoom: 'Create Your First Room',
    
    // Chat
    sendMessage: 'Send',
    sendMessagePlaceholder: 'Send a message in {roomName}...',
    startConversation: 'Start the conversation',
    startConversationDesc: 'Be the first to send a message in this room. Start an interesting conversation!',
    online: 'Online',
    synchronizing: 'Synchronizing...',
    messageSendError: 'Could not send message. Please try again.',
    
    // Account Settings
    accountSettings: 'Account Settings',
    profile: 'Profile',
    preferences: 'Preferences',
    security: 'Security',
    about: 'About',
    editProfile: 'Edit Profile',
    changePassword: 'Change Password',
    language: 'Language',
    selectLanguage: 'Select Language',
    notifications: 'Notifications',
    pushNotifications: 'Push Notifications',
    emailNotifications: 'Email Notifications',
    soundNotifications: 'Sound Notifications',
    deleteAccount: 'Delete Account',
    dangerZone: 'Danger Zone',
    deleteAccountWarning: 'This action cannot be undone. This will permanently delete your account.',
    save: 'Save',
    saveChanges: 'Save Changes',
    currentPassword: 'Current Password',
    newPassword: 'New Password',
    confirmPassword: 'Confirm New Password',
    
    // Avatar Settings
    avatar: 'Avatar',
    changeAvatar: 'Change Avatar',
    chooseAvatar: 'Choose Avatar',
    defaultAvatars: 'Default Avatars',
    uploadCustomAvatar: 'Upload Custom Avatar',
    uploadImage: 'Upload Image',
    removeAvatar: 'Remove Avatar',
    avatarUpdated: 'Avatar updated successfully',
    selectDefaultAvatar: 'Select a default avatar',
    orUploadCustom: 'or upload your own image',
    supportedFormats: 'Supported formats: JPG, PNG, GIF (max 2MB)',
    // Nickname Management
    changeNickname: 'Change Nickname',
    currentNickname: 'Current Nickname',
    requestNicknameChange: 'Request Nickname Change',
    newNickname: 'New Nickname',
    reasonForChange: 'Reason for Change',
    reasonPlaceholder: 'Please explain why you want to change your nickname...',
    submitRequest: 'Submit Request',
    nicknameChangeRequests: 'Nickname Change Requests',
    pendingRequest: 'Pending Request',
    approvedRequest: 'Approved',
    rejectedRequest: 'Rejected',
    nicknameRequestSubmitted: 'Nickname change request submitted successfully',
    nicknameRequestExists: 'You already have a pending nickname change request',
    nicknameAlreadyTaken: 'Nickname already taken',
    viewRequests: 'View My Requests',
    requestStatus: 'Request Status',
    adminComment: 'Admin Comment',
    requestDate: 'Request Date',
    reviewDate: 'Review Date',
    
    // Common
    close: 'Close',
    back: 'Back',
    next: 'Next',
    confirm: 'Confirm',
    yes: 'Yes',
    no: 'No',
    or: 'or',
    and: 'and'
  },
  
  ro: {
    // App Name
    appName: 'VONEX',
    appDescription: 'Platformă Modernă de Chat',
    
    // Authentication
    welcomeBack: 'Bun venit în VONEX',
    joinVonex: 'Alătură-te la VONEX',
    signInSubtitle: 'Conectează-te pentru a continua să discuți',
    createAccountSubtitle: 'Creează-ți contul pentru a începe',
    firstName: 'Prenume',
    firstNamePlaceholder: 'ex. Ion',
    lastName: 'Nume',
    lastNamePlaceholder: 'ex. Popescu',
    nickname: 'Nickname',
    nicknamePlaceholder: 'ex. IonP sau Ionel',
    emailAddress: 'Adresa de email',
    emailPlaceholder: 'nume@exemplu.com',
    password: 'Parola',
    passwordPlaceholder: 'Parola ta secretă',
    signIn: 'Conectează-te',
    createAccount: 'Creează contul',
    pleaseWait: 'Te rugăm să aștepți...',
    noAccountYet: 'Nu ai cont încă?',
    alreadyHaveAccount: 'Ai deja un cont?',
    registerHere: 'Înregistrează-te aici',
    signInHere: 'Conectează-te aici',
    
    // Dashboard
    welcome: 'Bun venit',
    newRoom: 'Cameră Nouă',
    logout: 'Ieși din cont',
    
    // Rooms
    createNewRoom: 'Creează o Cameră Nouă',
    startConversation: 'Începe o conversație pe un subiect care te pasionează',
    roomName: 'Numele camerei',
    roomNamePlaceholder: 'ex. General Discussion, Gaming, Music...',
    roomDescription: 'Descrierea camerei',
    roomDescriptionPlaceholder: 'Descrie despre ce este această cameră...',
    privateRoom: 'Cameră Privată',
    privateRoomDesc: 'Doar persoanele invitate pot intra',
    cancel: 'Anulează',
    createRoom: 'Creează Camera',
    members: 'membri',
    active: 'Activ acum',
    createdBy: 'Creat de',
    you: 'tine',
    someone: 'cineva',
    noRoomsYet: 'Nicio cameră încă',
    noRoomsDescription: 'Începe prin a crea prima cameră de chat sau alătură-te unei camere existente',
    createFirstRoom: 'Creează Prima Cameră',
    
    // Chat
    sendMessage: 'Trimite',
    sendMessagePlaceholder: 'Trimite un mesaj în {roomName}...',
    startConversation: 'Începe conversația',
    startConversationDesc: 'Fii primul care trimite un mesaj în această cameră. Începe o conversație interesantă!',
    online: 'Online',
    synchronizing: 'Sincronizare...',
    messageSendError: 'Nu s-a putut trimite mesajul. Încearcă din nou.',
    
    // Account Settings
    accountSettings: 'Setări Cont',
    profile: 'Profil',
    preferences: 'Preferințe',
    security: 'Securitate',
    about: 'Despre',
    editProfile: 'Editează Profilul',
    changePassword: 'Schimbă Parola',
    language: 'Limba',
    selectLanguage: 'Selectează Limba',
    notifications: 'Notificări',
    pushNotifications: 'Notificări Push',
    emailNotifications: 'Notificări Email',
    soundNotifications: 'Notificări Sonore',
    deleteAccount: 'Șterge Contul',
    dangerZone: 'Zonă Periculoasă',
    deleteAccountWarning: 'Această acțiune nu poate fi anulată. Îți va șterge permanent contul.',
    save: 'Salvează',
    saveChanges: 'Salvează Modificările',
    currentPassword: 'Parola Actuală',
    newPassword: 'Parola Nouă',
    confirmPassword: 'Confirmă Parola Nouă',
    
    // Avatar Settings
    avatar: 'Avatar',
    changeAvatar: 'Schimbă Avatar',
    chooseAvatar: 'Alege Avatar',
    defaultAvatars: 'Avataruri Implicite',
    uploadCustomAvatar: 'Încarcă Avatar Personal',
    uploadImage: 'Încarcă Imagine',
    removeAvatar: 'Șterge Avatar',
    avatarUpdated: 'Avatar actualizat cu succes',
    selectDefaultAvatar: 'Selectează un avatar implicit',
    orUploadCustom: 'sau încarcă propria imagine',
    supportedFormats: 'Formate suportate: JPG, PNG, GIF (max 2MB)',
    // Nickname Management
    changeNickname: 'Schimbă Nickname',
    currentNickname: 'Nickname Curent',
    requestNicknameChange: 'Cere Schimbarea Nickname',
    newNickname: 'Nickname Nou',
    reasonForChange: 'Motivul Schimbării',
    reasonPlaceholder: 'Te rugăm să explici de ce vrei să îți schimbi nickname-ul...',
    submitRequest: 'Trimite Cererea',
    nicknameChangeRequests: 'Cereri Schimbare Nickname',
    pendingRequest: 'Cerere în Așteptare',
    approvedRequest: 'Aprobată',
    rejectedRequest: 'Respinsă',
    nicknameRequestSubmitted: 'Cererea de schimbare nickname trimisă cu succes',
    nicknameRequestExists: 'Ai deja o cerere în așteptare pentru schimbarea nickname',
    nicknameAlreadyTaken: 'Nickname-ul este deja folosit',
    viewRequests: 'Vezi Cererile Mele',
    requestStatus: 'Status Cerere',
    adminComment: 'Comentariu Admin',
    requestDate: 'Data Cererii',
    reviewDate: 'Data Revizuirii',
    profileUpdated: 'Profil actualizat cu succes',
    passwordChanged: 'Parolă schimbată cu succes',
    passwordMismatch: 'Parolele nu se potrivesc',
    
    // Common
    close: 'Închide',
    back: 'Înapoi',
    next: 'Următorul',
    confirm: 'Confirmă',
    yes: 'Da',
    no: 'Nu',
    or: 'sau',
    and: 'și'
  },
  
  // Adding basic translations for other languages (can be expanded)
  es: {
    appName: 'VONEX',
    appDescription: 'Plataforma de Chat Moderna',
    welcomeBack: 'Bienvenido de vuelta a VONEX',
    joinVonex: 'Únete a VONEX',
    signIn: 'Iniciar Sesión',
    createAccount: 'Crear Cuenta',
    accountSettings: 'Configuración de Cuenta',
    language: 'Idioma',
    // ... more translations would go here
  },
  
  fr: {
    appName: 'VONEX',
    appDescription: 'Plateforme de Chat Moderne',
    welcomeBack: 'Bienvenue dans VONEX',
    joinVonex: 'Rejoignez VONEX',
    signIn: 'Se connecter',
    createAccount: 'Créer un compte',
    accountSettings: 'Paramètres du compte',
    language: 'Langue',
    // ... more translations would go here
  },
  
  de: {
    appName: 'VONEX',
    appDescription: 'Moderne Chat-Plattform',
    welcomeBack: 'Willkommen zurück bei VONEX',
    joinVonex: 'Tritt VONEX bei',
    signIn: 'Anmelden',
    createAccount: 'Konto erstellen',
    accountSettings: 'Kontoeinstellungen',
    language: 'Sprache',
    // ... more translations would go here
  },
  
  it: {
    appName: 'VONEX',
    appDescription: 'Piattaforma di Chat Moderna',
    welcomeBack: 'Bentornato su VONEX',
    joinVonex: 'Unisciti a VONEX',
    signIn: 'Accedi',
    createAccount: 'Crea Account',
    accountSettings: 'Impostazioni Account',
    language: 'Lingua',
    // ... more translations would go here
  },
  
  pt: {
    appName: 'VONEX',
    appDescription: 'Plataforma de Chat Moderna',
    welcomeBack: 'Bem-vindo de volta ao VONEX',
    joinVonex: 'Junte-se ao VONEX',
    signIn: 'Entrar',
    createAccount: 'Criar Conta',
    accountSettings: 'Configurações da Conta',
    language: 'Idioma',
    // ... more translations would go here
  },
  
  ru: {
    appName: 'VONEX',
    appDescription: 'Современная Чат-Платформа',
    welcomeBack: 'Добро пожаловать в VONEX',
    joinVonex: 'Присоединиться к VONEX',
    signIn: 'Войти',
    createAccount: 'Создать аккаунт',
    accountSettings: 'Настройки аккаунта',
    language: 'Язык',
    // ... more translations would go here
  },
  
  zh: {
    appName: 'VONEX',
    appDescription: '现代聊天平台',
    welcomeBack: '欢迎回到VONEX',
    joinVonex: '加入VONEX',
    signIn: '登录',
    createAccount: '创建账户',
    accountSettings: '账户设置',
    language: '语言',
    // ... more translations would go here
  },
  
  ja: {
    appName: 'VONEX',
    appDescription: 'モダンチャットプラットフォーム',
    welcomeBack: 'VONEXへお帰りなさい',
    joinVonex: 'VONEXに参加',
    signIn: 'サインイン',
    createAccount: 'アカウント作成',
    accountSettings: 'アカウント設定',
    language: '言語',
    // ... more translations would go here
  }
};

// Helper function to get translation with fallback
export const getTranslation = (key, lang = 'en', variables = {}) => {
  let translation = translations[lang]?.[key] || translations['en'][key] || key;
  
  // Replace variables in translation
  Object.keys(variables).forEach(variable => {
    translation = translation.replace(`{${variable}}`, variables[variable]);
  });
  
  return translation;
};

// Default avatars - beautiful gradient designs
export const defaultAvatars = [
  {
    id: 'gradient-1',
    name: 'Purple Blaze',
    svg: `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#8b5cf6"/>
          <stop offset="100%" style="stop-color:#3b82f6"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill="url(#grad1)"/>
      <circle cx="50" cy="40" r="15" fill="white" opacity="0.9"/>
      <path d="M25 75 Q50 60 75 75 L75 100 L25 100 Z" fill="white" opacity="0.9"/>
    </svg>`
  },
  {
    id: 'gradient-2', 
    name: 'Ocean Wave',
    svg: `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#06b6d4"/>
          <stop offset="100%" style="stop-color:#1d4ed8"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill="url(#grad2)"/>
      <circle cx="50" cy="40" r="15" fill="white" opacity="0.9"/>
      <path d="M25 75 Q50 60 75 75 L75 100 L25 100 Z" fill="white" opacity="0.9"/>
    </svg>`
  },
  {
    id: 'gradient-3',
    name: 'Sunset Glow', 
    svg: `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad3" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#f59e0b"/>
          <stop offset="100%" style="stop-color:#ef4444"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill="url(#grad3)"/>
      <circle cx="50" cy="40" r="15" fill="white" opacity="0.9"/>
      <path d="M25 75 Q50 60 75 75 L75 100 L25 100 Z" fill="white" opacity="0.9"/>
    </svg>`
  },
  {
    id: 'gradient-4',
    name: 'Forest Green',
    svg: `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad4" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#10b981"/>
          <stop offset="100%" style="stop-color:#059669"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill="url(#grad4)"/>
      <circle cx="50" cy="40" r="15" fill="white" opacity="0.9"/>
      <path d="M25 75 Q50 60 75 75 L75 100 L25 100 Z" fill="white" opacity="0.9"/>
    </svg>`
  },
  {
    id: 'gradient-5',
    name: 'Rose Gold',
    svg: `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad5" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#f472b6"/>
          <stop offset="100%" style="stop-color:#be185d"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill="url(#grad5)"/>
      <circle cx="50" cy="40" r="15" fill="white" opacity="0.9"/>
      <path d="M25 75 Q50 60 75 75 L75 100 L25 100 Z" fill="white" opacity="0.9"/>
    </svg>`
  },
  {
    id: 'gradient-6',
    name: 'Electric Blue',
    svg: `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad6" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#3b82f6"/>
          <stop offset="100%" style="stop-color:#1e40af"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill="url(#grad6)"/>
      <circle cx="50" cy="40" r="15" fill="white" opacity="0.9"/>
      <path d="M25 75 Q50 60 75 75 L75 100 L25 100 Z" fill="white" opacity="0.9"/>
    </svg>`
  },
  {
    id: 'gradient-7',
    name: 'Lavender Dream',
    svg: `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad7" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#a78bfa"/>
          <stop offset="100%" style="stop-color:#7c3aed"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill="url(#grad7)"/>
      <circle cx="50" cy="40" r="15" fill="white" opacity="0.9"/>
      <path d="M25 75 Q50 60 75 75 L75 100 L25 100 Z" fill="white" opacity="0.9"/>
    </svg>`
  },
  {
    id: 'gradient-8',
    name: 'Ember Fire',
    svg: `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad8" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#fb7185"/>
          <stop offset="100%" style="stop-color:#e11d48"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill="url(#grad8)"/>
      <circle cx="50" cy="40" r="15" fill="white" opacity="0.9"/>
      <path d="M25 75 Q50 60 75 75 L75 100 L25 100 Z" fill="white" opacity="0.9"/>
    </svg>`
  },
  {
    id: 'gradient-9',
    name: 'Cosmic Purple',
    svg: `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad9" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#6366f1"/>
          <stop offset="100%" style="stop-color:#4338ca"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill="url(#grad9)"/>
      <circle cx="50" cy="40" r="15" fill="white" opacity="0.9"/>
      <path d="M25 75 Q50 60 75 75 L75 100 L25 100 Z" fill="white" opacity="0.9"/>
    </svg>`
  },
  {
    id: 'gradient-10',
    name: 'Golden Hour',
    svg: `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad10" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#fbbf24"/>
          <stop offset="100%" style="stop-color:#f59e0b"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill="url(#grad10)"/>
      <circle cx="50" cy="40" r="15" fill="white" opacity="0.9"/>
      <path d="M25 75 Q50 60 75 75 L75 100 L25 100 Z" fill="white" opacity="0.9"/>
    </svg>`
  }
];

// Helper function to convert SVG to base64
export const svgToBase64 = (svgString) => {
  return `data:image/svg+xml;base64,${btoa(svgString)}`;
};

export const getAvatarUrl = (avatar) => {
  if (!avatar) return null;
  if (avatar.startsWith('data:')) return avatar; // Already base64
  
  // Find default avatar
  const defaultAvatar = defaultAvatars.find(a => a.id === avatar);
  return defaultAvatar ? svgToBase64(defaultAvatar.svg) : null;
};