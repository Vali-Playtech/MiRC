import React, { useState, useEffect, useContext, createContext, useRef } from 'react';
import './App.css';
import { languages, translations, getTranslation, defaultAvatars, getAvatarUrl, svgToBase64 } from './i18n';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Replace axios with fetch
const api = {
  get: async (url, options = {}) => {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return { data: await response.json() };
  },
  post: async (url, data, options = {}) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return { data: await response.json() };
  },
  put: async (url, data, options = {}) => {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return { data: await response.json() };
  },
  delete: async (url, options = {}) => {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return { data: await response.json() };
  }
};

// Language Context
const LanguageContext = createContext();

const LanguageProvider = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState(
    localStorage.getItem('vonex_language') || 'en'
  );

  const changeLanguage = (langCode) => {
    setCurrentLanguage(langCode);
    localStorage.setItem('vonex_language', langCode);
  };

  const t = (key, variables = {}) => getTranslation(key, currentLanguage, variables);

  return (
    <LanguageContext.Provider value={{ currentLanguage, changeLanguage, t, languages }}>
      {children}
    </LanguageContext.Provider>
  );
};

const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};

// Auth Context
const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const { changeLanguage } = useLanguage();

  useEffect(() => {
    if (token) {
      fetchCurrentUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchCurrentUser = async () => {
    try {
      const response = await api.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
      // Set user's saved language if available
      if (response.data.language) {
        changeLanguage(response.data.language);
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await api.post(`${API}/auth/login`, { email, password });
      const { access_token } = response.data;
      localStorage.setItem('token', access_token);
      setToken(access_token);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message || 'Login failed' };
    }
  };

  const register = async (email, password, firstName, lastName, nickname) => {
    try {
      const response = await api.post(`${API}/auth/register`, { 
        email, 
        password, 
        first_name: firstName,
        last_name: lastName,
        nickname 
      });
      const { access_token } = response.data;
      localStorage.setItem('token', access_token);
      setToken(access_token);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message || 'Registration failed' };
    }
  };

  const updateProfile = async (updates) => {
    try {
      const response = await api.put(`${API}/auth/profile`, updates, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message || 'Update failed' };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      loading, 
      login, 
      register, 
      updateProfile,
      logout,
      fetchCurrentUser 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// Account Settings Component
const AccountSettings = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState('profile');
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    nickname: '',
    email: '',
    avatar_url: null
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [nicknameRequestData, setNicknameRequestData] = useState({
    newNickname: '',
    reason: ''
  });
  const [nicknameRequests, setNicknameRequests] = useState([]);
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(null);
  const [showAvatarSection, setShowAvatarSection] = useState(false);
  const fileInputRef = useRef(null);
  const { user, updateProfile, token } = useAuth();
  const { t, currentLanguage, changeLanguage, languages } = useLanguage();

  useEffect(() => {
    if (user) {
      setProfileData({
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        nickname: user.nickname || '',
        email: user.email || '',
        avatar_url: user.avatar_url || null
      });
      setSelectedAvatar(user.avatar_url || null);
    }
    fetchNicknameRequests();
  }, [user]);

  const fetchNicknameRequests = async () => {
    try {
      const response = await api.get(`${API}/auth/nickname-requests`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNicknameRequests(response.data);
    } catch (error) {
      console.error('Failed to fetch nickname requests:', error);
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: t('invalidFileType', 'Please select a valid image file') });
      return;
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'error', text: t('fileTooLarge', 'File size must be less than 2MB') });
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = (e) => {
      setSelectedAvatar(e.target.result);
      setShowAvatarSection(false);
    };
    reader.readAsDataURL(file);
  };

  const handleDefaultAvatarSelect = (avatarId) => {
    const avatar = defaultAvatars.find(a => a.id === avatarId);
    if (avatar) {
      setSelectedAvatar(avatarId);
      setShowAvatarSection(false);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    
    try {
      const updates = {
        first_name: profileData.firstName,
        last_name: profileData.lastName,
        language: currentLanguage,
        avatar_url: selectedAvatar
      };
      
      const result = await updateProfile(updates);
      if (result.success) {
        setMessage({ type: 'success', text: t('profileUpdated') });
        setProfileData(prev => ({ ...prev, avatar_url: selectedAvatar }));
      } else {
        setMessage({ type: 'error', text: result.error });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleNicknameRequest = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    
    try {
      const response = await api.post(`${API}/auth/nickname-request`, {
        new_nickname: nicknameRequestData.newNickname,
        reason: nicknameRequestData.reason
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data) {
        setMessage({ type: 'success', text: t('nicknameRequestSubmitted') });
        setNicknameRequestData({ newNickname: '', reason: '' });
        setShowNicknameModal(false);
        fetchNicknameRequests();
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message || t('nicknameAlreadyTaken') });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: t('passwordMismatch', 'Passwords do not match') });
      return;
    }
    
    setLoading(true);
    setMessage('');
    
    try {
      const response = await api.post(`${API}/auth/change-password`, {
        current_password: passwordData.currentPassword,
        new_password: passwordData.newPassword
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data) {
        setMessage({ type: 'success', text: t('passwordChanged', 'Password changed successfully') });
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'profile', icon: '👤', label: t('profile') },
    { id: 'preferences', icon: '⚙️', label: t('preferences') },
    { id: 'security', icon: '🔒', label: t('security') },
    { id: 'about', icon: 'ℹ️', label: t('about') }
  ];

  return (
    <div className="h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-800/95 to-gray-900/95 backdrop-blur-xl px-6 py-4 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="text-gray-400 hover:text-white transition-all duration-200 p-2 rounded-lg hover:bg-white/10"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-white text-xl font-bold">{t('accountSettings')}</h1>
            <p className="text-gray-400 text-sm">{user?.email}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 bg-gray-800/50 backdrop-blur-sm border-r border-white/10 p-4">
          <nav className="space-y-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white hover:bg-white/10'
                }`}
              >
                <span className="text-lg">{tab.icon}</span>
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {message && (
            <div className={`mb-6 p-4 rounded-xl backdrop-blur-sm ${
              message.type === 'success' 
                ? 'bg-green-500/20 border border-green-500/50 text-green-200'
                : 'bg-red-500/20 border border-red-500/50 text-red-200'
            }`}>
              {message.text}
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">{t('editProfile')}</h2>
                <p className="text-gray-400">{t('updateProfileInfo', 'Update your profile information')}</p>
              </div>
              
              <form onSubmit={handleProfileUpdate} className="space-y-6">
                {/* Avatar Section */}
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-4">{t('avatar')}</label>
                  <div className="flex items-center space-x-6">
                    {/* Current Avatar Display */}
                    <div className="relative">
                      {selectedAvatar ? (
                        <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-purple-500 shadow-lg">
                          {selectedAvatar.startsWith('data:') ? (
                            <img src={selectedAvatar} alt="Avatar" className="w-full h-full object-cover" />
                          ) : (
                            <div 
                              className="w-full h-full"
                              dangerouslySetInnerHTML={{ 
                                __html: defaultAvatars.find(a => a.id === selectedAvatar)?.svg || '' 
                              }}
                            />
                          )}
                        </div>
                      ) : (
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center border-4 border-gray-500 shadow-lg">
                          <span className="text-white text-2xl font-bold">
                            {user?.name?.charAt(0)?.toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Avatar Change Buttons */}
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setShowAvatarSection(true)}
                        className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-4 py-2 rounded-lg transition-all duration-200 font-medium text-sm"
                      >
                        {t('changeAvatar')}
                      </button>
                      {selectedAvatar && (
                        <button
                          type="button"
                          onClick={() => setSelectedAvatar(null)}
                          className="block bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-all duration-200 font-medium text-sm"
                        >
                          {t('removeAvatar')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Avatar Selection Modal */}
                {showAvatarSection && (
                  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-xl rounded-3xl p-6 w-full max-w-2xl border border-white/20 shadow-2xl max-h-[80vh] overflow-y-auto">
                      <div className="text-center mb-6">
                        <h3 className="text-white text-xl font-bold mb-2">{t('chooseAvatar')}</h3>
                        <p className="text-gray-300 text-sm">{t('selectDefaultAvatar')}</p>
                      </div>

                      {/* Default Avatars Grid */}
                      <div className="mb-8">
                        <h4 className="text-white font-semibold mb-4">{t('defaultAvatars')}</h4>
                        <div className="grid grid-cols-5 gap-4">
                          {defaultAvatars.map((avatar) => (
                            <button
                              key={avatar.id}
                              onClick={() => handleDefaultAvatarSelect(avatar.id)}
                              className={`relative group transition-all duration-200 ${
                                selectedAvatar === avatar.id ? 'ring-4 ring-purple-500 rounded-full' : ''
                              }`}
                            >
                              <div 
                                className="w-16 h-16 rounded-full overflow-hidden hover:scale-110 transition-transform duration-200 shadow-lg"
                                dangerouslySetInnerHTML={{ __html: avatar.svg }}
                              />
                              <div className="absolute inset-0 bg-black/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Custom Upload Section */}
                      <div className="mb-6">
                        <h4 className="text-white font-semibold mb-4">{t('uploadCustomAvatar')}</h4>
                        <div className="border-2 border-dashed border-gray-600 rounded-xl p-6 text-center">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-3 rounded-xl transition-all duration-200 font-medium"
                          >
                            <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            {t('uploadImage')}
                          </button>
                          <p className="text-gray-400 text-xs mt-2">{t('supportedFormats')}</p>
                        </div>
                      </div>

                      {/* Modal Close Button */}
                      <div className="flex justify-center">
                        <button
                          onClick={() => setShowAvatarSection(false)}
                          className="bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white px-6 py-2 rounded-lg transition-all duration-200 font-medium border border-white/20"
                        >
                          {t('close')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Nickname Change Request Modal */}
                {showNicknameModal && (
                  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-xl rounded-3xl p-6 w-full max-w-md border border-white/20 shadow-2xl">
                      <div className="text-center mb-6">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </div>
                        <h3 className="text-white text-xl font-bold mb-2">{t('requestNicknameChange')}</h3>
                        <p className="text-gray-300 text-sm">{t('nicknameChangeExplanation', 'Nickname changes require admin approval')}</p>
                      </div>

                      <form onSubmit={handleNicknameRequest} className="space-y-4">
                        <div>
                          <label className="block text-gray-300 text-sm font-medium mb-2">{t('currentNickname')}</label>
                          <input
                            type="text"
                            value={profileData.nickname}
                            disabled
                            className="w-full bg-gray-700/50 text-gray-400 px-4 py-3 rounded-xl border border-white/10 cursor-not-allowed"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-gray-300 text-sm font-medium mb-2">{t('newNickname')}</label>
                          <input
                            type="text"
                            value={nicknameRequestData.newNickname}
                            onChange={(e) => setNicknameRequestData({...nicknameRequestData, newNickname: e.target.value})}
                            className="w-full bg-white/10 backdrop-blur-sm text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 border border-white/20"
                            required
                          />
                        </div>
                        
                        <div>
                          <label className="block text-gray-300 text-sm font-medium mb-2">{t('reasonForChange')}</label>
                          <textarea
                            value={nicknameRequestData.reason}
                            onChange={(e) => setNicknameRequestData({...nicknameRequestData, reason: e.target.value})}
                            placeholder={t('reasonPlaceholder')}
                            className="w-full bg-white/10 backdrop-blur-sm text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 border border-white/20 resize-none"
                            rows="3"
                            required
                          />
                        </div>

                        <div className="flex space-x-3 pt-4">
                          <button
                            type="button"
                            onClick={() => setShowNicknameModal(false)}
                            className="flex-1 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white py-3 rounded-xl transition-all duration-200 font-medium border border-white/20"
                          >
                            {t('cancel')}
                          </button>
                          <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white py-3 rounded-xl transition-all duration-200 font-medium shadow-lg disabled:opacity-50"
                          >
                            {loading ? t('pleaseWait') : t('submitRequest')}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-2">{t('firstName')}</label>
                    <input
                      type="text"
                      value={profileData.firstName}
                      onChange={(e) => setProfileData({...profileData, firstName: e.target.value})}
                      className="w-full bg-white/10 backdrop-blur-sm text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 border border-white/20"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-2">{t('lastName')}</label>
                    <input
                      type="text"
                      value={profileData.lastName}
                      onChange={(e) => setProfileData({...profileData, lastName: e.target.value})}
                      className="w-full bg-white/10 backdrop-blur-sm text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 border border-white/20"
                      required
                    />
                  </div>
                </div>

                {/* Nickname Section - Read Only with Change Request */}
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">{t('nickname')}</label>
                  <div className="flex items-center space-x-4">
                    <input
                      type="text"
                      value={profileData.nickname}
                      disabled
                      className="flex-1 bg-gray-700/50 text-gray-400 px-4 py-3 rounded-xl border border-white/10 cursor-not-allowed"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNicknameModal(true)}
                      className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white px-4 py-3 rounded-xl transition-all duration-200 font-medium text-sm"
                    >
                      {t('requestNicknameChange')}
                    </button>
                  </div>
                  <p className="text-gray-500 text-xs mt-1">{t('nicknameVisibleInChat', 'This nickname is visible in chat messages')}</p>
                  
                  {/* Show recent nickname requests */}
                  {nicknameRequests.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-gray-300 font-medium mb-2">{t('nicknameChangeRequests')}</h4>
                      <div className="space-y-2">
                        {nicknameRequests.slice(0, 3).map((request) => (
                          <div key={request.id} className="bg-white/5 rounded-lg p-3 border border-white/10">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-300 text-sm">{request.new_nickname}</span>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                request.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' :
                                request.status === 'approved' ? 'bg-green-500/20 text-green-300' :
                                'bg-red-500/20 text-red-300'
                              }`}>
                                {t(`${request.status}Request`)}
                              </span>
                            </div>
                            {request.admin_comment && (
                              <p className="text-gray-400 text-xs mt-1">{request.admin_comment}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">{t('emailAddress')}</label>
                  <input
                    type="email"
                    value={profileData.email}
                    disabled
                    className="w-full bg-gray-700/50 text-gray-400 px-4 py-3 rounded-xl border border-white/10 cursor-not-allowed"
                  />
                  <p className="text-gray-500 text-xs mt-1">{t('emailCannotBeChanged', 'Email address cannot be changed')}</p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-6 py-3 rounded-xl transition-all duration-200 font-semibold disabled:opacity-50"
                >
                  {loading ? t('pleaseWait') : t('saveChanges')}
                </button>
              </form>
            </div>
          )}

          {/* Preferences Tab */}
          {activeTab === 'preferences' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">{t('preferences')}</h2>
                <p className="text-gray-400">{t('customizeExperience', 'Customize your VONEX experience')}</p>
              </div>

              <div className="space-y-6">
                {/* Language Selection */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">{t('language')}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.entries(languages).map(([code, lang]) => (
                      <button
                        key={code}
                        onClick={() => changeLanguage(code)}
                        className={`flex items-center space-x-3 p-3 rounded-xl transition-all duration-200 ${
                          currentLanguage === code
                            ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
                            : 'bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white'
                        }`}
                      >
                        <span className="text-xl">{lang.flag}</span>
                        <span className="font-medium">{lang.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">{t('security')}</h2>
                <p className="text-gray-400">{t('manageAccountSecurity', 'Manage your account security settings')}</p>
              </div>

              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">{t('currentPassword')}</label>
                  <input
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                    className="w-full bg-white/10 backdrop-blur-sm text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 border border-white/20"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">{t('newPassword')}</label>
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                    className="w-full bg-white/10 backdrop-blur-sm text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 border border-white/20"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">{t('confirmPassword')}</label>
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                    className="w-full bg-white/10 backdrop-blur-sm text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 border border-white/20"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-6 py-3 rounded-xl transition-all duration-200 font-semibold disabled:opacity-50"
                >
                  {loading ? t('pleaseWait') : t('changePassword')}
                </button>
              </form>
            </div>
          )}

          {/* About Tab */}
          {activeTab === 'about' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">{t('about')}</h2>
                <p className="text-gray-400">{t('aboutVonex', 'About VONEX and your account')}</p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6">
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-white">{t('appName')}</h3>
                  <p className="text-gray-300">{t('appDescription')}</p>
                  <p className="text-gray-400 text-sm">
                    {t('version', 'Version')} 1.0.0
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Components
const LoginForm = ({ isLogin, onToggle }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, register } = useAuth();
  const { t } = useLanguage();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = isLogin 
      ? await login(email, password)
      : await register(email, password, firstName, lastName, nickname);

    if (!result.success) {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl"></div>
      </div>
      
      <div className="relative bg-white/10 backdrop-blur-xl rounded-3xl p-8 w-full max-w-md border border-white/20 shadow-2xl">
        <div className="text-center mb-8">
          {/* Logo VONEX original cu 100% mai mare pentru login */}
          <div className="w-auto h-40 mx-auto mb-3 flex items-center justify-center">
            <img 
              src="/vonex-original-logo.png" 
              alt="VONEX" 
              className="h-32 w-auto object-contain"
              style={{
                filter: 'drop-shadow(0 0 20px rgba(0, 255, 255, 0.6)) drop-shadow(0 0 30px rgba(68, 255, 68, 0.5)) drop-shadow(0 0 40px rgba(255, 255, 68, 0.4)) drop-shadow(0 0 50px rgba(255, 136, 68, 0.3))'
              }}
            />
          </div>
          
          {/* Slogan VONEX - pe o singură linie, încadrat perfect stânga-dreapta */}
          <div className="mb-4 px-6">
            <p className="text-sm font-bold mb-3 text-white text-center whitespace-nowrap" style={{
              fontFamily: 'monospace',
              letterSpacing: '0.01em'
            }}>
              Voice • Opinions • Network • Experiences
            </p>
          </div>
          
          <p className="text-gray-300 text-base mb-6">
            {isLogin ? t('signInSubtitle') : t('createAccountSubtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {!isLogin && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-gray-300 text-sm font-medium">{t('firstName')}</label>
                  <input
                    type="text"
                    placeholder={t('firstNamePlaceholder')}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-4 py-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent focus:bg-white/20 transition-all duration-200"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-gray-300 text-sm font-medium">{t('lastName')}</label>
                  <input
                    type="text"
                    placeholder={t('lastNamePlaceholder')}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-4 py-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent focus:bg-white/20 transition-all duration-200"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-gray-300 text-sm font-medium">{t('nickname')}</label>
                <input
                  type="text"
                  placeholder={t('nicknamePlaceholder')}
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full px-4 py-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent focus:bg-white/20 transition-all duration-200"
                  required
                />
                <p className="text-gray-400 text-xs">{t('nicknameWillAppearInChat', 'This nickname will appear in chat messages')}</p>
              </div>
            </>
          )}
          
          <div className="space-y-2">
            <label className="text-gray-300 text-sm font-medium">{t('emailAddress')}</label>
            <input
              type="email"
              placeholder={t('emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent focus:bg-white/20 transition-all duration-200"
              required
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-gray-300 text-sm font-medium">{t('password')}</label>
            <input
              type="password"
              placeholder={t('passwordPlaceholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent focus:bg-white/20 transition-all duration-200"
              required
            />
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 text-red-200 text-sm backdrop-blur-sm">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-4 px-4 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:transform-none flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>{t('pleaseWait')}</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                <span>{isLogin ? t('signIn') : t('createAccount')}</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/20"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-gray-300">
                {isLogin ? t('noAccountYet') : t('alreadyHaveAccount')}
              </span>
            </div>
          </div>
          <button
            onClick={onToggle}
            className="mt-4 text-purple-400 hover:text-purple-300 font-semibold transition-colors text-lg"
          >
            {isLogin ? t('registerHere') : t('signInHere')}
          </button>
        </div>
      </div>
    </div>
  );
};

const ChatRoom = ({ room, onBack }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [ws, setWs] = useState(null);
  const [isPolling, setIsPolling] = useState(true);
  const [roomUsers, setRoomUsers] = useState([]);
  const [showUserList, setShowUserList] = useState(false);
  const [showPrivateChat, setShowPrivateChat] = useState(false);
  const [privateChatUser, setPrivateChatUser] = useState(null);
  const [privateMessages, setPrivateMessages] = useState([]);
  const [newPrivateMessage, setNewPrivateMessage] = useState('');
  const [showAvatarBubble, setShowAvatarBubble] = useState(null);
  const [avatarBubblePosition, setAvatarBubblePosition] = useState({ x: 0, y: 0 });
  const [isPrivateChatUserFriend, setIsPrivateChatUserFriend] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [userScrolled, setUserScrolled] = useState(false);
  const [permanentButtons, setPermanentButtons] = useState(new Set()); // Track which messages have permanent buttons
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const pollingInterval = useRef(null);
  const { token, user } = useAuth();

  const scrollToBottom = (force = false) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      setIsAtBottom(true);
      setShowScrollToBottom(false);
      if (force) {
        setUserScrolled(false);
      }
    }
  };

  // Check if user is at bottom of chat
  const checkIfAtBottom = () => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const atBottom = scrollHeight - scrollTop - clientHeight < 50; // 50px threshold
      setIsAtBottom(atBottom);
      setShowScrollToBottom(!atBottom);
    }
  };

  // Handle scroll events
  const handleScroll = () => {
    setUserScrolled(true);
    checkIfAtBottom();
  };

  // Only auto-scroll to bottom when:
  // 1. User sends a new message
  // 2. User is at bottom and new messages arrive
  // 3. Initial load
  useEffect(() => {
    if (!userScrolled || isAtBottom) {
      scrollToBottom();
    }
  }, [messages]);

  // Fetch messages function
  const fetchMessages = async () => {
    try {
      const response = await api.get(`${API}/rooms/${room.id}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(response.data);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  // Fetch only real friends (not room users)
  const fetchFavorites = async () => {
    try {
      // Get friends list only
      const friendsResponse = await api.get(`${API}/friends`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const friends = friendsResponse.data.map(friend => ({
        id: friend.friend_user_id,
        nickname: friend.friend_nickname,
        avatar_url: friend.friend_avatar_url,
        is_friend: true,
        unread_count: 0, // Will be updated by separate call if needed
        first_unread_message_id: null
      }));
      
      setRoomUsers(friends);
    } catch (error) {
      console.error('Failed to fetch favorites:', error);
    }
  };

  // Remove from favorites
  const removeFromFavorites = async (userId) => {
    console.log('🔥 DEBUGGING: removeFromFavorites called with userId:', userId);
    console.log('🔥 DEBUGGING: Current roomUsers:', roomUsers);
    
    try {
      const userToRemove = roomUsers.find(u => u.id === userId);
      console.log('🔥 DEBUGGING: User to remove:', userToRemove);
      
      // Temporarily skip confirmation for easier testing
      const confirmed = true; // window.confirm(`Elimină ${userToRemove?.nickname || 'utilizatorul'} din favorit?\n\nApasă OK pentru a confirma eliminarea.`);
      console.log('🔥 DEBUGGING: User confirmed (auto-true):', confirmed);
      
      if (confirmed) {
        console.log('🔥 DEBUGGING: Making API call...');
        
        // Call backend to remove friendship
        const response = await api.delete(`${API}/friends/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        console.log('🔥 DEBUGGING: API response:', response);
        
        // Remove from local state immediately
        setRoomUsers(prev => {
          const newUsers = prev.filter(user => user.id !== userId);
          console.log('🔥 DEBUGGING: New roomUsers after filter:', newUsers);
          return newUsers;
        });
        
        // Show success message
        alert(`${userToRemove?.nickname || 'Utilizatorul'} a fost eliminat din favorite!`);
        console.log('🔥 DEBUGGING: User removal completed successfully');
      } else {
        console.log('🔥 DEBUGGING: User cancelled the removal');
      }
    } catch (error) {
      console.error('🔥 DEBUGGING: Error in removeFromFavorites:', error);
      
      // If backend call fails, try to remove locally anyway
      const removeLocally = window.confirm('Nu s-a putut elimina din backend. Vrei să elimini doar local?');
      if (removeLocally) {
        setRoomUsers(prev => prev.filter(user => user.id !== userId));
        console.log('🔥 DEBUGGING: Removed locally after backend error');
      }
    }
  };

  // Get last seen time for a user in this room (placeholder - would be stored locally or in backend)
  const getLastSeenTime = (userId) => {
    // For now, use localStorage to track last seen time per user per room
    const key = `last_seen_${room.id}_${userId}`;
    const lastSeen = localStorage.getItem(key);
    return lastSeen ? new Date(lastSeen) : new Date(0); // If no record, show all messages as unread
  };

  // Update last seen time for a user in this room
  const updateLastSeenTime = (userId) => {
    const key = `last_seen_${room.id}_${userId}`;
    localStorage.setItem(key, new Date().toISOString());
  };

  // Fetch private messages
  const fetchPrivateMessages = async (userId) => {
    try {
      const response = await api.get(`${API}/private-messages/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPrivateMessages(response.data);
    } catch (error) {
      console.error('Failed to fetch private messages:', error);
    }
  };

  // Send private message
  const sendPrivateMessage = async (e) => {
    e.preventDefault();
    if (!newPrivateMessage.trim() || !privateChatUser) return;

    try {
      const response = await api.post(`${API}/private-messages`, {
        content: newPrivateMessage.trim(),
        recipient_id: privateChatUser.id
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setPrivateMessages(prev => [...prev, response.data]);
      setNewPrivateMessage('');
    } catch (error) {
      console.error('Failed to send private message:', error);
      alert('Nu s-a putut trimite mesajul privat. Încearcă din nou.');
    }
  };

  // Add to favorites (friends)
  const addToFavorites = async (userId) => {
    try {
      await api.post(`${API}/friends/request`, {
        friend_user_id: userId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Update user list to reflect friend status
      setRoomUsers(prev => 
        prev.map(u => u.id === userId ? {...u, is_friend: true} : u)
      );
      
      alert('Utilizator adăugat la favorit!');
    } catch (error) {
      console.error('Failed to add to favorites:', error);
      alert('Nu s-a putut adăuga la favorit.');
    }
  };

  // Check friend status
  const checkFriendStatus = async (userId) => {
    try {
      const response = await api.get(`${API}/friends`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const isFriend = response.data.some(friend => friend.friend_user_id === userId);
      setIsPrivateChatUserFriend(isFriend);
    } catch (error) {
      console.error('Failed to check friend status:', error);
      setIsPrivateChatUserFriend(false);
    }
  };

  // Toggle friend status
  const toggleFriendStatus = async () => {
    if (!privateChatUser) return;

    try {
      if (isPrivateChatUserFriend) {
        // Remove from friends - need to implement unfriend endpoint
        alert('Funcționalitatea de eliminare din favorite va fi implementată în curând.');
      } else {
        await api.post(`${API}/friends/request`, {
          friend_user_id: privateChatUser.id
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setIsPrivateChatUserFriend(true);
        alert('Utilizator adăugat la favorite!');
      }
    } catch (error) {
      console.error('Failed to toggle friend status:', error);
      alert('Nu s-a putut actualiza statusul de favorit.');
    }
  };

  // Open private chat
  const openPrivateChat = (user) => {
    setPrivateChatUser(user);
    setShowPrivateChat(true);
    setShowUserList(false);
    setShowAvatarBubble(null);
    fetchPrivateMessages(user.id);
    checkFriendStatus(user.id);
  };

  // Add to favorites from message avatar
  const addToFavoritesFromAvatar = async (userId) => {
    try {
      await api.post(`${API}/friends/request`, {
        friend_user_id: userId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert('Utilizator adăugat la favorit!');
    } catch (error) {
      console.error('Failed to add to favorites:', error);
      alert('Nu s-a putut adăuga la favorit.');
    }
  };

  // Open private chat from avatar
  const openPrivateChatFromAvatar = (chatUser) => {
    setPrivateChatUser(chatUser);
    setShowPrivateChat(true);
    setShowAvatarBubble(null);
    fetchPrivateMessages(chatUser.id);
    checkFriendStatus(chatUser.id);
  };

  // Toggle permanent buttons for a message
  const togglePermanentButtons = (messageId) => {
    setPermanentButtons(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId); // Hide buttons if already showing
      } else {
        newSet.clear(); // Clear all other permanent buttons
        newSet.add(messageId); // Show buttons for this message only
      }
      return newSet;
    });
  };

  // Handle avatar click to toggle permanent buttons
  const handleAvatarClick = (messageId) => {
    togglePermanentButtons(messageId);
  };

  // Navigate to first unread message from a friend
  const navigateToFirstUnreadMessage = (friendUser) => {
    if (friendUser.first_unread_message_id) {
      // Find the message element and scroll to it
      const messageElement = document.getElementById(`message-${friendUser.first_unread_message_id}`);
      if (messageElement) {
        messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Highlight the message temporarily
        messageElement.classList.add('bg-yellow-200/20', 'border', 'border-yellow-400/50', 'rounded-lg');
        setTimeout(() => {
          messageElement.classList.remove('bg-yellow-200/20', 'border', 'border-yellow-400/50', 'rounded-lg');
        }, 3000);
      } else {
        // If message not found in current view, reload messages and try again
        fetchMessages().then(() => {
          setTimeout(() => {
            const retryElement = document.getElementById(`message-${friendUser.first_unread_message_id}`);
            if (retryElement) {
              retryElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
              retryElement.classList.add('bg-yellow-200/20', 'border', 'border-yellow-400/50', 'rounded-lg');
              setTimeout(() => {
                retryElement.classList.remove('bg-yellow-200/20', 'border', 'border-yellow-400/50', 'rounded-lg');
              }, 3000);
            }
          }, 500);
        });
      }
    }
    
    // Update last seen time for this friend
    updateLastSeenTime(friendUser.id);
    // Refresh the friends list to update unread counts
    setTimeout(() => fetchFavorites(), 1000);
    // Close the users panel
    setShowUserList(false);
  };

  useEffect(() => {
    // Initial fetch
    fetchMessages();
    fetchFavorites();
    
    // Initialize scroll detection
    checkIfAtBottom();

    // Try WebSocket connection first
    const wsUrl = `${BACKEND_URL.replace('https:', 'wss:').replace('http:', 'ws:')}/ws/${room.id}`;
    const websocket = new WebSocket(wsUrl);
    let wsConnected = false;

    const wsTimeout = setTimeout(() => {
      if (!wsConnected) {
        console.log('WebSocket connection failed, switching to polling...');
        websocket.close();
        setWs(null);
        startPolling();
      }
    }, 5000); // 5 second timeout

    websocket.onopen = () => {
      console.log('WebSocket connected successfully');
      wsConnected = true;
      clearTimeout(wsTimeout);
      setWs(websocket);
      setIsPolling(false);
      stopPolling();
    };

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.error) {
        console.error('WebSocket error:', data.error);
        return;
      }
      if (data.type === 'message') {
        setMessages(prev => [...prev, {
          id: data.id,
          content: data.content,
          room_id: data.room_id,
          user_id: data.user_id,
          user_name: data.user_name,
          user_avatar: data.user_avatar,
          created_at: data.created_at
        }]);
      }
    };

    websocket.onclose = () => {
      console.log('WebSocket disconnected, switching to polling...');
      setWs(null);
      if (!wsConnected) {
        clearTimeout(wsTimeout);
        startPolling();
      }
    };

    websocket.onerror = () => {
      console.error('WebSocket error, switching to polling...');
      clearTimeout(wsTimeout);
      websocket.close();
      startPolling();
    };

    // Cleanup function
    return () => {
      clearTimeout(wsTimeout);
      websocket.close();
      stopPolling();
    };
  }, [room.id, token]);

  const startPolling = () => {
    if (pollingInterval.current) return; // Already polling
    
    setIsPolling(true);
    pollingInterval.current = setInterval(() => {
      fetchMessages();
      fetchFavorites(); // Also update favorites list
    }, 3000); // Poll every 3 seconds
    console.log('Started message polling (3 second interval)');
  };

  const stopPolling = () => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
      setIsPolling(false);
      console.log('Stopped message polling');
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const messageContent = newMessage.trim();
    
    // Clear input immediately at the start after getting content
    setNewMessage('');
    
    try {
      if (ws && ws.readyState === WebSocket.OPEN) {
        // Send via WebSocket
        ws.send(JSON.stringify({
          content: messageContent,
          token: token
        }));
        // Force scroll to bottom when user sends message
        setTimeout(() => {
          scrollToBottom(true);
        }, 100);
      } else {
        // Send via HTTP API (fallback)
        const response = await api.post(`${API}/rooms/${room.id}/messages`, {
          content: messageContent
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // Force scroll to bottom when user sends message
        setTimeout(() => {
          scrollToBottom(true);
        }, 100);
        // Immediately fetch messages to show the new message
        setTimeout(fetchMessages, 500);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      // Show error to user
      alert('Nu s-a putut trimite mesajul. Încearcă din nou.');
      // Restore the message on error so user can retry
      setNewMessage(messageContent);
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-800/95 to-gray-900/95 backdrop-blur-xl px-6 py-4 flex items-center justify-between border-b border-white/10 shadow-lg">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="text-gray-400 hover:text-white transition-all duration-200 p-2 rounded-lg hover:bg-white/10"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <div className="flex items-center space-x-3">
            {getRoomIcon(room.name, room.is_private)}
            <div>
              <h2 className="text-white font-bold text-xl">{room.name}</h2>
              {room.description && (
                <p className="text-gray-400 text-sm">{room.description}</p>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className={`flex items-center ${isPolling ? 'text-yellow-400' : 'text-green-400'}`}>
            <div className={`w-2 h-2 ${isPolling ? 'bg-yellow-400' : 'bg-green-400'} rounded-full animate-pulse mr-2`}></div>
            <span className="text-sm font-medium">
              {isPolling ? 'Sincronizare...' : 'Online'}
            </span>
          </div>
          <button
            onClick={() => setShowUserList(!showUserList)}
            className="bg-white/10 backdrop-blur-sm px-3 py-1 rounded-full border border-white/20 hover:bg-white/20 transition-all duration-200 flex items-center space-x-2"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
            <span className="text-white text-sm font-medium">Favoriti</span>
          </button>
        </div>
      </div>

      {/* Messages - Responsive */}
      <div 
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-3 sm:space-y-4 relative"
      >
        {messages.map((message) => (
          <div
            key={message.id}
            id={`message-${message.id}`}
            className={`flex ${message.user_id === user?.id ? 'justify-end' : 'justify-start'} w-full relative`}
          >
            <div className="flex flex-col space-y-1 max-w-full relative">
              {/* Avatar and Name Row with Action Buttons - WhatsApp Style */}
              {message.user_id !== user?.id && (
                <div className="flex items-center justify-between mb-1 group">
                  <div className="flex items-center space-x-2">
                    <div className="relative">
                      <button
                        onClick={() => handleAvatarClick(message.id)}
                        className="w-8 h-8 rounded-full overflow-hidden border-2 border-purple-500/50 hover:border-purple-400 flex-shrink-0 cursor-pointer transition-all duration-200 hover:scale-105"
                      >
                        {message.user_avatar ? (
                          message.user_avatar.startsWith('data:') ? (
                            <img 
                              src={message.user_avatar} 
                              alt="Avatar" 
                              className="w-full h-full object-cover" 
                            />
                          ) : (
                            <div 
                              className="w-full h-full"
                              dangerouslySetInnerHTML={{ 
                                __html: defaultAvatars.find(a => a.id === message.user_avatar)?.svg || '' 
                              }}
                            />
                          )
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                            <span className="text-white text-xs font-semibold">
                              {message.user_name?.charAt(0)?.toUpperCase()}
                            </span>
                          </div>
                        )}
                      </button>
                      
                      {/* Interactive Plus Indicator */}
                      <div className={`absolute -top-0.5 -right-0.5 w-4 h-4 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full border-2 border-white shadow-lg flex items-center justify-center transition-all duration-200 pointer-events-none ${
                        permanentButtons.has(message.id) 
                          ? 'opacity-100 scale-110' 
                          : 'opacity-60 group-hover:opacity-100 group-hover:scale-110'
                      }`}>
                        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d={
                            permanentButtons.has(message.id) ? "M20 12H4" : "M12 4v16m8-8H4"
                          } />
                        </svg>
                      </div>
                      
                      {/* Subtle pulse animation - only when not permanent */}
                      {!permanentButtons.has(message.id) && (
                        <div className="absolute inset-0 rounded-full border-2 border-purple-400 animate-ping opacity-20 group-hover:opacity-0 pointer-events-none"></div>
                      )}
                    </div>
                    
                    <div className="text-xs font-semibold text-purple-300 opacity-90">
                      {message.user_name}
                    </div>
                  </div>
                  
                  {/* Action Buttons - show on hover OR when permanent */}
                  <div className={`flex space-x-1 transition-all duration-200 flex-shrink-0 ${
                    permanentButtons.has(message.id) 
                      ? 'opacity-100' 
                      : 'opacity-0 group-hover:opacity-100'
                  }`}>
                    <button
                      onClick={() => openPrivateChatFromAvatar({
                        id: message.user_id,
                        nickname: message.user_name,
                        avatar_url: message.user_avatar
                      })}
                      className="bg-blue-600/90 hover:bg-blue-600 text-white px-2 py-1 rounded-lg text-xs transition-colors duration-200 flex items-center space-x-1"
                      title="Chat privat"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <span>Chat</span>
                    </button>
                    <button
                      onClick={() => addToFavoritesFromAvatar(message.user_id)}
                      className="bg-purple-600/90 hover:bg-purple-600 text-white px-2 py-1 rounded-lg text-xs transition-colors duration-200 flex items-center"
                      title="Adaugă la favorit"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                      <span>★</span>
                    </button>
                  </div>
                </div>
              )}
              
              {/* Message Bubble - Clean without action buttons */}
              <div
                className={`px-4 py-3 rounded-2xl shadow-lg backdrop-blur-sm border ${
                  message.user_id === user?.id
                    ? 'bg-gradient-to-br from-purple-600 to-blue-600 text-white border-purple-500/30 ml-auto'
                    : 'bg-white/10 text-gray-100 border-white/20 max-w-xs sm:max-w-sm lg:max-w-md'
                } ${message.user_id === user?.id ? 'rounded-br-md' : 'rounded-tl-md'}`}
              >
                <div className="break-words leading-relaxed">{message.content}</div>
                <div className={`text-xs mt-2 opacity-70 ${
                  message.user_id === user?.id ? 'text-purple-100' : 'text-gray-400'
                }`}>
                  {formatTime(message.created_at)}
                </div>
              </div>
              
              {/* Own Avatar - positioned at top right for own messages */}
              {message.user_id === user?.id && (
                <div className="flex justify-end mb-1">
                  <div className="w-8 h-8 rounded-full overflow-hidden border border-green-500/30 flex-shrink-0">
                    {user?.avatar_url ? (
                      user.avatar_url.startsWith('data:') ? (
                        <img 
                          src={user.avatar_url} 
                          alt="Avatar" 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <div 
                          className="w-full h-full"
                          dangerouslySetInnerHTML={{ 
                            __html: defaultAvatars.find(a => a.id === user.avatar_url)?.svg || '' 
                          }}
                        />
                      )
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center">
                        <span className="text-white text-xs font-semibold">
                          {user?.nickname?.charAt(0)?.toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
        
        {/* Scroll to Bottom Button - Subtle like Messenger, positioned above input */}
        {showScrollToBottom && (
          <div className="absolute bottom-20 sm:bottom-24 left-1/2 transform -translate-x-1/2 z-10">
            <button
              onClick={() => scrollToBottom(true)}
              className="bg-gray-700/60 backdrop-blur-md hover:bg-gray-600/70 text-white/80 hover:text-white p-2.5 rounded-full shadow-lg border border-white/20 transition-all duration-300 opacity-70 hover:opacity-100 hover:scale-105"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7" />
              </svg>
            </button>
          </div>
        )}
        
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Începe conversația</h3>
            <p className="text-gray-400 max-w-sm">
              Fii primul care trimite un mesaj în această cameră. Începe o conversație interesantă!
            </p>
          </div>
        )}
      </div>

      {/* Message Input - Responsive */}
      <form onSubmit={sendMessage} className="p-3 sm:p-6 bg-gradient-to-r from-gray-800/50 to-gray-900/50 backdrop-blur-xl border-t border-white/10 relative z-20">
        <div className="flex space-x-2 sm:space-x-4">
          <div className="flex-1 relative">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={`Trimite un mesaj în ${room.name}...`}
              className="w-full bg-white/10 backdrop-blur-sm text-white px-3 sm:px-6 py-2 sm:py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white/20 placeholder-gray-400 border border-white/20 transition-all duration-200 text-sm sm:text-base"
            />
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2h4a1 1 0 011 1v1a1 1 0 01-1 1H3a1 1 0 01-1-1V5a1 1 0 011-1h4z" />
              </svg>
            </div>
          </div>
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 text-white px-4 sm:px-6 py-2 sm:py-4 rounded-2xl transition-all duration-200 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:transform-none flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            <span className="font-medium">Trimite</span>
          </button>
        </div>
      </form>

      {/* Friends List Panel - Responsive */}
      {showUserList && (
        <div className="absolute top-16 right-2 sm:right-6 w-full max-w-sm sm:max-w-md md:w-96 bg-gray-900/95 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl z-50 max-h-[70vh] sm:max-h-[500px] overflow-hidden mx-2 sm:mx-0">
          <div className="p-4 border-b border-white/10 bg-gradient-to-r from-purple-600/20 to-blue-600/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                <h3 className="text-white font-semibold text-lg">Prieteni activi</h3>
              </div>
              <button
                onClick={() => setShowUserList(false)}
                className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-all duration-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="overflow-y-auto max-h-80">
            {roomUsers.length === 0 ? (
              <div className="p-6 text-center text-gray-400">
                <div className="text-4xl mb-2">👥</div>
                <p>Nu ai prieteni activi în această cameră</p>
                <p className="text-sm mt-1">Adaugă utilizatori la favorite pentru a-i vedea aici</p>
              </div>
            ) : (
              roomUsers.map((roomUser) => (
                <div key={roomUser.id} className="border-b border-white/5 last:border-b-0 hover:bg-white/5 transition-colors">
                  <div className="p-4">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-full overflow-hidden border border-purple-500/30">
                          {roomUser.avatar_url ? (
                            roomUser.avatar_url.startsWith('data:') ? (
                              <img 
                                src={roomUser.avatar_url} 
                                alt="Avatar" 
                                className="w-full h-full object-cover" 
                              />
                            ) : (
                              <div 
                                className="w-full h-full"
                                dangerouslySetInnerHTML={{ 
                                  __html: defaultAvatars.find(a => a.id === roomUser.avatar_url)?.svg || '' 
                                }}
                              />
                            )
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                              <span className="text-white text-sm font-semibold">
                                {roomUser.nickname?.charAt(0)?.toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                        {roomUser.unread_count > 0 && (
                          <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full border-2 border-gray-800 flex items-center justify-center">
                            <span className="text-white text-xs font-bold">
                              {roomUser.unread_count > 99 ? '99+' : roomUser.unread_count}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-white font-semibold">{roomUser.nickname}</h3>
                        <p className="text-gray-400 text-sm">
                          {roomUser.is_friend ? '★ Favorit' : 'Utilizator în cameră'}
                        </p>
                      </div>
                    </div>
                    
                    {/* Action Buttons Row */}
                    <div className="flex space-x-2">
                      <button
                        onClick={() => openPrivateChat({
                          id: roomUser.id,
                          nickname: roomUser.nickname,
                          avatar_url: roomUser.avatar_url
                        })}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm transition-colors duration-200 flex items-center justify-center space-x-2"
                        title="Chat privat"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <span>Chat</span>
                      </button>
                      <button
                        onClick={() => removeFromFavorites(roomUser.id)}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm transition-colors duration-200 flex items-center justify-center space-x-2"
                        title="Elimină din favorit"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                        <span>Unfavorite</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Private Chat Panel */}
      {showPrivateChat && privateChatUser && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800/95 backdrop-blur-xl rounded-xl border border-white/20 shadow-2xl w-full max-w-2xl h-96 flex flex-col">
            {/* Private Chat Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full overflow-hidden border border-purple-500/30">
                  {privateChatUser.avatar_url ? (
                    privateChatUser.avatar_url.startsWith('data:') ? (
                      <img 
                        src={privateChatUser.avatar_url} 
                        alt="Avatar" 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <div 
                        className="w-full h-full"
                        dangerouslySetInnerHTML={{ 
                          __html: defaultAvatars.find(a => a.id === privateChatUser.avatar_url)?.svg || '' 
                        }}
                      />
                    )
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                      <span className="text-white text-sm font-semibold">
                        {privateChatUser.nickname?.charAt(0)?.toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-semibold">Chat privat cu {privateChatUser.nickname}</h3>
                  <p className="text-gray-400 text-sm flex items-center">
                    Conversație privată
                    {isPrivateChatUserFriend && (
                      <span className="ml-2 text-green-400 text-xs">★ Favorit</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={toggleFriendStatus}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center space-x-1 ${
                    isPrivateChatUserFriend 
                      ? 'bg-red-600 hover:bg-red-700 text-white' 
                      : 'bg-purple-600 hover:bg-purple-700 text-white'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {isPrivateChatUserFriend ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    )}
                  </svg>
                  <span>{isPrivateChatUserFriend ? 'FAVORIT' : 'FAVORIT'}</span>
                </button>
                <button
                  onClick={() => {
                    setShowPrivateChat(false);
                    setPrivateChatUser(null);
                    setPrivateMessages([]);
                    setIsPrivateChatUserFriend(false);
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Private Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {privateMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                    msg.sender_id === user?.id
                      ? 'bg-gradient-to-br from-purple-600 to-blue-600 text-white'
                      : 'bg-white/10 text-gray-100'
                  }`}>
                    <div className="break-words">{msg.content}</div>
                    <div className={`text-xs mt-1 opacity-70 ${
                      msg.sender_id === user?.id ? 'text-purple-100' : 'text-gray-400'
                    }`}>
                      {formatTime(msg.created_at)}
                    </div>
                  </div>
                </div>
              ))}
              {privateMessages.length === 0 && (
                <div className="text-center text-gray-400">
                  <p>Încă nu aveți mesaje. Începeți conversația!</p>
                </div>
              )}
            </div>

            {/* Private Message Input */}
            <form onSubmit={sendPrivateMessage} className="p-4 border-t border-white/10">
              <div className="flex space-x-3">
                <input
                  type="text"
                  value={newPrivateMessage}
                  onChange={(e) => setNewPrivateMessage(e.target.value)}
                  placeholder={`Mesaj pentru ${privateChatUser.nickname}...`}
                  className="flex-1 bg-white/10 backdrop-blur-sm text-white px-4 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white/20 placeholder-gray-400 border border-white/20"
                />
                <button
                  type="submit"
                  disabled={!newPrivateMessage.trim()}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 text-white px-4 py-2 rounded-xl transition-all duration-200 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* No longer need avatar bubble popup - actions are inline now */}
    </div>
  );
};

// Helper function to get room icon based on room name/type
const getRoomIcon = (roomName, isPrivate) => {
  const name = roomName.toLowerCase();
  
  if (isPrivate) {
    return (
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center shadow-lg">
        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
        </svg>
      </div>
    );
  }
  
  if (name.includes('general') || name.includes('main') || name.includes('lobby')) {
    return (
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg">
        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
        </svg>
      </div>
    );
  }
  
  if (name.includes('gaming') || name.includes('game') || name.includes('play')) {
    return (
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-lg">
        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM18 10a2 2 0 11-4 0 2 2 0 014 0zM14 4a2 2 0 100 4 2 2 0 000-4zM6 4a2 2 0 100 4 2 2 0 000-4zM10 15a4 4 0 01-4-4v-1h8v1a4 4 0 01-4 4z"/>
        </svg>
      </div>
    );
  }
  
  if (name.includes('music') || name.includes('audio') || name.includes('sound')) {
    return (
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center shadow-lg">
        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z"/>
        </svg>
      </div>
    );
  }
  
  if (name.includes('tech') || name.includes('dev') || name.includes('code') || name.includes('programming')) {
    return (
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center shadow-lg">
        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </div>
    );
  }
  
  if (name.includes('movie') || name.includes('film') || name.includes('cinema') || name.includes('tv')) {
    return (
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center shadow-lg">
        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z"/>
        </svg>
      </div>
    );
  }
  
  if (name.includes('news') || name.includes('announce') || name.includes('info')) {
    return (
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-lg">
        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 3a1 1 0 00-1.447-.894L8.763 6H5a3 3 0 000 6h.28l1.771 5.316A1 1 0 008 18h1a1 1 0 001-1v-4.382l6.553 3.276A1 1 0 0018 15V3z" clipRule="evenodd" />
        </svg>
      </div>
    );
  }
  
  if (name.includes('help') || name.includes('support') || name.includes('question')) {
    return (
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center shadow-lg">
        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
      </div>
    );
  }
  
  if (name.includes('random') || name.includes('misc') || name.includes('other')) {
    return (
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shadow-lg">
        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>
      </div>
    );
  }
  
  // Default icon for any other room
  return (
    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg">
      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
        <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/>
      </svg>
    </div>
  );
};

const RoomList = ({ onRoomSelect, onAccountSettings }) => {
  const [rooms, setRooms] = useState([]);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDescription, setNewRoomDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const { token, user, logout } = useAuth();
  const { t } = useLanguage();

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const response = await api.get(`${API}/rooms`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRooms(response.data);
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    }
  };

  const createRoom = async (e) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    try {
      await api.post(`${API}/rooms`, {
        name: newRoomName.trim(),
        description: newRoomDescription.trim() || null,
        is_private: isPrivate
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setNewRoomName('');
      setNewRoomDescription('');
      setIsPrivate(false);
      setShowCreateRoom(false);
      fetchRooms();
    } catch (error) {
      console.error('Failed to create room:', error);
    }
  };

  const joinRoom = async (roomId) => {
    try {
      await api.post(`${API}/rooms/${roomId}/join`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchRooms();
    } catch (error) {
      console.error('Failed to join room:', error);
    }
  };

  // State pentru noua interfață cu taburi
  const [activeTab, setActiveTab] = useState('world-chat');
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [newPostLink, setNewPostLink] = useState('');
  
  // New state for Facebook-style post creation
  const [linkPreview, setLinkPreview] = useState(null);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [selectedImageModal, setSelectedImageModal] = useState(null);
  const [characterCount, setCharacterCount] = useState(0);
  const MAX_CHARACTERS = 5000;
  
  // New state for sharing functionality
  const [shareModalPost, setShareModalPost] = useState(null);
  const [shareOption, setShareOption] = useState(''); // 'room' or 'friend'
  const [shareComment, setShareComment] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');
  const [selectedFriend, setSelectedFriend] = useState('');
  const [userRooms, setUserRooms] = useState([]);
  const [userFavorites, setUserFavorites] = useState([]);

  // New state for Camera ta functionality
  const [userCameras, setUserCameras] = useState([]);
  const [showCreateCamera, setShowCreateCamera] = useState(false);
  const [newCamera, setNewCamera] = useState({
    name: '',
    theme: '',
    description: '',
    rules: '',
    visibility: 'public', // public, private, invite-only
    allowInvites: true,
    maxMembers: 100
  });
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [cameraMembers, setCameraMembers] = useState([]);
  const [showCameraSettings, setShowCameraSettings] = useState(false);

  // New state for Favorites functionality
  const [favoriteUsers, setFavoriteUsers] = useState([]);
  const [selectedFavorite, setSelectedFavorite] = useState(null);
  const [showFavoriteActions, setShowFavoriteActions] = useState(null);

  // World Chat functions
  const handleTextChange = (e) => {
    const text = e.target.value;
    if (text.length <= MAX_CHARACTERS) {
      setNewPost(text);
      setCharacterCount(text.length);
      
      // Auto-detect links in text (like Facebook)
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const urls = text.match(urlRegex);
      
      if (urls && urls.length > 0) {
        // Take the first URL found
        const firstUrl = urls[0];
        if (firstUrl !== newPostLink) {
          setNewPostLink(firstUrl);
          generateLinkPreview(firstUrl);
        }
      } else {
        // No URL found, clear preview
        setNewPostLink('');
        setLinkPreview(null);
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      createPost();
    }
  };

  const generateLinkPreview = async (url) => {
    setIsLoadingPreview(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/world-chat/link-preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ url })
      });
      
      if (response.ok) {
        const preview = await response.json();
        setLinkPreview(preview);
      } else {
        setLinkPreview(null);
      }
    } catch (error) {
      console.error('Error generating link preview:', error);
      setLinkPreview(null);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleImageUpload = async (files) => {
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        const formData = new FormData();
        formData.append('file', file);
        
        try {
          const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/world-chat/upload-image`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: formData
          });
          
          if (response.ok) {
            const imageData = await response.json();
            setUploadedImages(prev => [...prev, imageData]);
          } else {
            alert('Eroare la încărcarea imaginii');
          }
        } catch (error) {
          console.error('Error uploading image:', error);
          alert('Eroare la încărcarea imaginii');
        }
      }
    }
  };

  const removeImage = (imageId) => {
    setUploadedImages(prev => prev.filter(img => img.id !== imageId));
  };

  const createPost = async () => {
    if (!newPost.trim() && uploadedImages.length === 0) {
      return;
    }

    setIsCreatingPost(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/world-chat/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          content: newPost,
          link_url: newPostLink || null,
          images: uploadedImages.map(img => img.id)
        })
      });

      if (response.ok) {
        const newPostData = await response.json();
        setPosts(prev => [newPostData, ...prev]);
        
        // Clear form
        setNewPost('');
        setNewPostLink('');
        setLinkPreview(null);
        setUploadedImages([]);
        setCharacterCount(0);
      } else {
        const errorData = await response.json();
        console.error('Error creating post:', errorData);
        alert('Eroare la crearea postării: ' + (errorData.detail || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error creating post:', error);
      alert('Eroare de conexiune la crearea postării');
    } finally {
      setIsCreatingPost(false);
    }
  };

  const loadPosts = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/world-chat/posts`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const postsData = await response.json();
        setPosts(postsData);
      }
    } catch (error) {
      console.error('Error loading posts:', error);
    }
  };

  // Load posts when World Chat tab becomes active
  useEffect(() => {
    if (activeTab === 'world-chat') {
      loadPosts();
    }
  }, [activeTab]);
  
  const formatPostDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 1) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return diffMins < 1 ? 'acum' : `${diffMins}m`;
    } else if (diffHours < 24) {
      return `${diffHours}h`;
    } else if (diffDays < 7) {
      return `${diffDays}d`;
    } else {
      return date.toLocaleDateString('ro-RO');
    }
  };

  // Sharing functions
  const openShareModal = (post) => {
    setShareModalPost(post);
    setShareOption('');
    setShareComment('');
    setSelectedRoom('');
    setSelectedFriend('');
    // Load user rooms and favorites when opening modal
    loadUserRooms();
    loadUserFavorites();
  };

  const closeShareModal = () => {
    setShareModalPost(null);
    setShareOption('');
    setShareComment('');
    setSelectedRoom('');
    setSelectedFriend('');
  };

  const loadUserRooms = async () => {
    // Mock data for now - in real implementation, fetch from API
    setUserRooms([
      { id: '1', name: 'Camera mea tehnologie', type: 'public' },
      { id: '2', name: 'Discusii private', type: 'private' },
      { id: '3', name: 'Hobby & Gaming', type: 'public' }
    ]);
  };

  const loadUserFavorites = async () => {
    // Mock data for now - in real implementation, fetch from favorites API
    setUserFavorites([
      { id: '1', name: 'Ana Popescu', nickname: 'ana_pop', avatar: null },
      { id: '2', name: 'Mihai Ion', nickname: 'mihai_i', avatar: null },
      { id: '3', name: 'Elena Marin', nickname: 'elena_m', avatar: null }
    ]);
  };

  const handleShare = async () => {
    if (!shareModalPost) return;

    try {
      const shareData = {
        post_id: shareModalPost.id,
        comment: shareComment.trim(),
        share_type: shareOption,
        target_id: shareOption === 'room' ? selectedRoom : selectedFriend
      };

      // For now, just show success message - in real implementation, call API
      if (shareOption === 'room') {
        const roomName = userRooms.find(r => r.id === selectedRoom)?.name;
        alert(`Postarea a fost partajată în camera "${roomName}"!`);
      } else if (shareOption === 'friend') {
        const friendName = userFavorites.find(f => f.id === selectedFriend)?.name;
        alert(`Postarea a fost partajată către "${friendName}"!`);
      }

      closeShareModal();
    } catch (error) {
      console.error('Error sharing post:', error);
      alert('Eroare la partajarea postării');
    }
  };

  // Camera ta functions
  useEffect(() => {
    if (activeTab === 'my-room') {
      loadUserCameras();
    }
  }, [activeTab]);

  const loadUserCameras = async () => {
    // Mock data - only MY ROOMS that I created - in real implementation, fetch from API
    setUserCameras([
      {
        id: '1',
        name: 'Presa Liberă',
        theme: 'Știri & Media',
        description: 'Discuții libere despre știri, politică și evenimente curente din România și lume.',
        rules: '1. Discuții civilizate\n2. Respect față de opinii diferite\n3. Fără fake news sau dezinformare',
        visibility: 'public',
        membersCount: 89,
        messagesCount: 567,
        createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        isActive: true,
        isOwned: true, // Camera mea
        category: 'my-rooms',
        pinnedMessage: null
      },
      {
        id: '2',
        name: 'Tech Talks România',
        theme: 'Tehnologie',
        description: 'Discuții despre ultimele tehnologii, programming, AI și inovații.',
        rules: '1. Respectă ceilalți membri\n2. Postează doar conținut relevant\n3. Nu spam sau reclame',
        visibility: 'public',
        membersCount: 45,
        messagesCount: 234,
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        isActive: true,
        isOwned: true, // Camera mea
        category: 'my-rooms',
        pinnedMessage: 'Bun venit în camera Tech Talks! Să discutăm despre tehnologie.'
      },
      {
        id: '3',
        name: 'Gamers Private',
        theme: 'Gaming',
        description: 'Camera privată pentru pasionații de gaming. Discuții despre jocuri, strategi și turnee.',
        rules: '1. Doar membri invitați\n2. Respectă regulile comunității\n3. Share your gaming moments',
        visibility: 'private',
        membersCount: 12,
        messagesCount: 89,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        isActive: false,
        isOwned: true, // Camera mea
        category: 'my-rooms',
        pinnedMessage: 'Camera temporar închisă pentru mentenanță.'
      }
    ]);
  };

  const handleCreateCamera = async () => {
    if (!newCamera.name.trim() || !newCamera.theme.trim()) {
      alert('Numele și tema sunt obligatorii');
      return;
    }

    try {
      const cameraData = {
        ...newCamera,
        id: Date.now().toString(),
        membersCount: 1,
        messagesCount: 0,
        createdAt: new Date(),
        isActive: true,
        pinnedMessage: null
      };

      setUserCameras(prev => [cameraData, ...prev]);
      
      // Reset form
      setNewCamera({
        name: '',
        theme: '',
        description: '',
        rules: '',
        visibility: 'public',
        allowInvites: true,
        maxMembers: 100
      });
      
      setShowCreateCamera(false);
      alert(`Camera "${cameraData.name}" a fost creată cu succes!`);
    } catch (error) {
      console.error('Error creating camera:', error);
      alert('Eroare la crearea camerei');
    }
  };

  const handleCameraAction = (action, camera) => {
    switch (action) {
      case 'enter':
        setSelectedCamera(camera);
        break;
      case 'settings':
        setSelectedCamera(camera);
        setShowCameraSettings(true);
        break;
      case 'delete':
        if (window.confirm(`Ești sigur că vrei să ștergi camera "${camera.name}"?`)) {
          setUserCameras(prev => prev.filter(c => c.id !== camera.id));
          alert('Camera a fost ștearsă cu succes');
        }
        break;
      case 'toggle':
        setUserCameras(prev => prev.map(c => 
          c.id === camera.id ? { ...c, isActive: !c.isActive } : c
        ));
        break;
      default:
        break;
    }
  };

  const getCameraVisibilityIcon = (visibility) => {
    switch (visibility) {
      case 'public': return '🌍';
      case 'private': return '🔒';
      case 'invite-only': return '📧';
      default: return '🌍';
    }
  };

  const getCameraVisibilityText = (visibility) => {
    switch (visibility) {
      case 'public': return 'Publică';
      case 'private': return 'Privată';
      case 'invite-only': return 'Doar cu invitație';
      default: return 'Publică';
    }
  };

  // Camera Card Component
  const CameraCard = ({ camera, onAction }) => {
    const getCategoryBadge = () => {
      if (camera.isOwned) return { text: 'A mea', color: 'bg-green-500/20 text-green-400 border-green-500/30' };
      if (camera.isFollowing) return { text: 'Urmăresc', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
      if (camera.hasInteracted) return { text: 'Vizitată', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' };
      if (camera.category === 'suggested') return { text: 'Sugerată', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' };
      return null;
    };

    const badge = getCategoryBadge();

    return (
      <div className={`bg-gray-800/50 rounded-xl border border-white/10 overflow-hidden hover:border-cyan-400/30 transition-all duration-200 ${!camera.isActive ? 'opacity-60' : ''}`}>
        {/* Camera Header */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-lg">{getCameraVisibilityIcon(camera.visibility)}</span>
                <h3 className="text-white font-semibold text-lg line-clamp-1">{camera.name}</h3>
                {badge && (
                  <span className={`text-xs px-2 py-1 rounded-full border ${badge.color}`}>
                    {badge.text}
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-3 text-xs text-gray-400">
                <span>{getCameraVisibilityText(camera.visibility)}</span>
                <span>•</span>
                <span>{camera.theme}</span>
                {camera.owner && !camera.isOwned && (
                  <>
                    <span>•</span>
                    <span>de {camera.owner}</span>
                  </>
                )}
              </div>
            </div>
            <div className="relative ml-2">
              <button className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-700/50 transition-colors">
                <span className="text-sm">⋯</span>
              </button>
            </div>
          </div>
        </div>

        {/* Camera Content */}
        <div className="p-4 space-y-3">
          {camera.description && (
            <p className="text-gray-300 text-sm line-clamp-2">{camera.description}</p>
          )}
          
          {camera.pinnedMessage && (
            <div className="bg-cyan-400/10 border border-cyan-400/20 rounded-lg p-2">
              <div className="text-xs text-cyan-400 mb-1">📌 Mesaj fixat</div>
              <div className="text-white text-sm line-clamp-2">{camera.pinnedMessage}</div>
            </div>
          )}

          {camera.suggestionReason && (
            <div className="bg-purple-400/10 border border-purple-400/20 rounded-lg p-2">
              <div className="text-xs text-purple-400 mb-1">💡 Sugerată</div>
              <div className="text-white text-sm">{camera.suggestionReason}</div>
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center justify-between text-xs text-gray-400">
            <div className="flex items-center space-x-4">
              <span>👥 {camera.membersCount} membri</span>
              <span>💬 {camera.messagesCount} mesaje</span>
            </div>
            <span>{camera.createdAt.toLocaleDateString('ro-RO')}</span>
          </div>
        </div>

        {/* Camera Actions */}
        <div className="p-4 border-t border-white/10 flex items-center space-x-2">
          {camera.isOwned ? (
            // Actions for my rooms
            <>
              <button
                onClick={() => onAction('enter', camera)}
                disabled={!camera.isActive}
                className="flex-1 px-3 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all duration-200 text-sm"
              >
                {camera.isActive ? 'Intră' : 'Inactivă'}
              </button>
              <button
                onClick={() => onAction('settings', camera)}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
              >
                ⚙️
              </button>
              <button
                onClick={() => onAction('toggle', camera)}
                className={`px-3 py-2 rounded-lg transition-colors text-sm ${camera.isActive ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'} text-white`}
              >
                {camera.isActive ? '⏸️' : '▶️'}
              </button>
              <button
                onClick={() => onAction('delete', camera)}
                className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm"
              >
                🗑️
              </button>
            </>
          ) : (
            // Actions for other rooms
            <>
              <button
                onClick={() => onAction('enter', camera)}
                className="flex-1 px-3 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-medium rounded-lg transition-all duration-200 text-sm"
              >
                Intră
              </button>
              {camera.isFollowing ? (
                <button
                  onClick={() => onAction('unfollow', camera)}
                  className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm"
                >
                  Nu mai urmări
                </button>
              ) : (
                <button
                  onClick={() => onAction('follow', camera)}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
                >
                  Urmărește
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  // Favorites functions
  useEffect(() => {
    if (activeTab === 'favorites') {
      loadFavoriteUsers();
    }
  }, [activeTab]);

  const loadFavoriteUsers = async () => {
    // Mock data for favorites - in real implementation, fetch from API
    setFavoriteUsers([
      {
        id: '1',
        name: 'Ana Popescu',
        nickname: 'ana_pop',
        avatar: 'https://images.unsplash.com/photo-1494790108755-2616c9ca7908?w=100&h=100&fit=crop&crop=face',
        isOnline: true,
        lastSeen: new Date(),
        unreadMessages: 3,
        lastMessage: 'Ai văzut știrea de astăzi?',
        lastMessageTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        isMuted: false,
        commonRooms: ['Presa Liberă', 'Tech Talks România']
      },
      {
        id: '2',
        name: 'Mihai Ionescu',
        nickname: 'mihai_dev',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
        isOnline: true,
        lastSeen: new Date(),
        unreadMessages: 0,
        lastMessage: 'Perfect! Mulțumesc pentru ajutor.',
        lastMessageTime: new Date(Date.now() - 30 * 60 * 1000), // 30 min ago
        isMuted: false,
        commonRooms: ['Tech Talks România']
      },
      {
        id: '3',
        name: 'Elena Marin',
        nickname: 'elena_m',
        avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face',
        isOnline: false,
        lastSeen: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
        unreadMessages: 1,
        lastMessage: 'Ne vedem mâine!',
        lastMessageTime: new Date(Date.now() - 4 * 60 * 60 * 1000),
        isMuted: false,
        commonRooms: ['Presa Liberă']
      },
      {
        id: '4',
        name: 'Alexandru Popa',
        nickname: 'alex_crypto',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
        isOnline: false,
        lastSeen: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        unreadMessages: 5,
        lastMessage: 'Bitcoin a crescut din nou! 🚀',
        lastMessageTime: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
        isMuted: true, // Muted user
        commonRooms: []
      },
      {
        id: '5',
        name: 'Ioana Georgescu',
        nickname: 'ioana_travel',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face',
        isOnline: true,
        lastSeen: new Date(),
        unreadMessages: 0,
        lastMessage: 'Brasovul este superb toamna!',
        lastMessageTime: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
        isMuted: false,
        commonRooms: []
      },
      {
        id: '6',
        name: 'Dan Radu',
        nickname: 'dan_business',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face',
        isOnline: false,
        lastSeen: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        unreadMessages: 0,
        lastMessage: 'Să discutăm despre proiect.',
        lastMessageTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        isMuted: false,
        commonRooms: []
      }
    ]);
  };

  const handleFavoriteAction = (action, user) => {
    switch (action) {
      case 'dm':
        // Open direct message
        alert(`Opening DM with ${user.name}`);
        break;
      case 'jump':
        // Jump to last message
        alert(`Jumping to last message with ${user.name}`);
        break;
      case 'mute':
        // Toggle mute
        setFavoriteUsers(prev => prev.map(u => 
          u.id === user.id ? { ...u, isMuted: !u.isMuted } : u
        ));
        break;
      case 'unfollow':
        // Remove from favorites
        if (window.confirm(`Ești sigur că vrei să elimini pe ${user.name} din favoriți?`)) {
          setFavoriteUsers(prev => prev.filter(u => u.id !== user.id));
        }
        break;
      default:
        break;
    }
    setShowFavoriteActions(null);
  };

  const formatLastSeen = (lastSeen) => {
    const now = new Date();
    const diffMs = now - lastSeen;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 1) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return diffMins < 1 ? 'acum' : `${diffMins}min`;
    } else if (diffHours < 24) {
      return `${diffHours}h`;
    } else if (diffDays < 7) {
      return `${diffDays}d`;
    } else {
      return lastSeen.toLocaleDateString('ro-RO');
    }
  };

  return (
    <div className="h-screen bg-gray-900 flex flex-col">
      {/* Header nou cu logo și taburi */}
      <div className="bg-gradient-to-r from-gray-800/95 to-gray-900/95 backdrop-blur-xl px-6 py-4 border-b border-white/10 shadow-lg">
        {/* Logo și taburi */}
        <div className="flex items-center justify-between">
          {/* Logo VONEX în stânga */}
          <div className="w-auto h-16 flex items-center">
            <img 
              src="/vonex-original-logo.png" 
              alt="VONEX" 
              className="h-16 w-auto object-contain"
              style={{
                filter: 'drop-shadow(0 0 8px rgba(0, 255, 255, 0.3)) drop-shadow(0 0 12px rgba(68, 255, 68, 0.2)) drop-shadow(0 0 16px rgba(255, 136, 68, 0.1))'
              }}
            />
          </div>

          {/* Taburi în centru - design ca bule */}
          <div className="flex space-x-2">
            {[
              { id: 'world-chat', name: 'World Chat' },
              { id: 'my-room', name: 'Camerele mele' },
              { id: 'favorites', name: 'Favoriți' },
              { id: 'recent', name: 'Recente' },
              { id: 'search', name: 'Search' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 rounded-full font-medium transition-all duration-300 relative ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-cyan-500/30 to-blue-500/30 text-white border-2 border-cyan-400/50 shadow-lg shadow-cyan-400/20 scale-105'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/30 border-2 border-transparent hover:border-gray-600/30 hover:scale-102'
                }`}
                style={activeTab === tab.id ? {
                  textShadow: '0 0 10px rgba(6, 182, 212, 0.5)',
                  boxShadow: '0 0 20px rgba(6, 182, 212, 0.3), inset 0 0 20px rgba(6, 182, 212, 0.1)'
                } : {}}
              >
                <span className="text-sm font-semibold">{tab.name}</span>
                {/* Badge for unread messages on favorites tab */}
                {tab.id === 'favorites' && favoriteUsers.reduce((total, user) => total + user.unreadMessages, 0) > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {favoriteUsers.reduce((total, user) => total + user.unreadMessages, 0) > 9 
                      ? '9+' 
                      : favoriteUsers.reduce((total, user) => total + user.unreadMessages, 0)
                    }
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Butonul de profil în dreapta */}
          <button
            onClick={() => onAccountSettings()}
            className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center text-white font-bold hover:shadow-lg transition-all duration-200 hover:scale-105"
          >
            {user?.nickname ? user.nickname.charAt(0).toUpperCase() : 'U'}
          </button>
        </div>
        
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setShowCreateRoom(true)}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-6 py-3 rounded-xl transition-all duration-300 text-sm font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>{t('newRoom')}</span>
          </button>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={onAccountSettings}
              className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-gray-500 hover:border-purple-400 transition-all duration-200 group"
              title={t('accountSettings')}
            >
              {user?.avatar_url ? (
                user.avatar_url.startsWith('data:') ? (
                  <img 
                    src={user.avatar_url} 
                    alt="Avatar" 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200" 
                  />
                ) : (
                  <div 
                    className="w-full h-full group-hover:scale-110 transition-transform duration-200"
                    dangerouslySetInnerHTML={{ 
                      __html: defaultAvatars.find(a => a.id === user.avatar_url)?.svg || '' 
                    }}
                  />
                )
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center group-hover:from-gray-500 group-hover:to-gray-600 transition-all duration-200">
                  <span className="text-white text-sm font-semibold">
                    {user?.nickname?.charAt(0)?.toUpperCase()}
                  </span>
                </div>
              )}
            </button>
            <button
              onClick={logout}
              className="text-gray-400 hover:text-red-400 transition-colors p-2 rounded-lg hover:bg-red-500/10"
              title={t('logout')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Content tabs */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'world-chat' && (
          <div className="h-full flex flex-col">
            {/* World Chat Header */}
            <div className="bg-gray-800/50 px-6 py-4 border-b border-white/10">
              <div className="flex items-center space-x-4">
                <div>
                  <h1 className="text-xl font-bold text-white">World Chat</h1>
                  <p className="text-gray-400 text-sm">Cameră globală publică • Oricine poate posta</p>
                </div>
              </div>
            </div>

            {/* Feed Posts - Responsive Facebook-style layout */}
            <div className="flex-1 overflow-y-auto py-6">
              <div className="max-w-full md:max-w-2xl md:mx-auto px-0 md:px-4">
                {posts.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <h3 className="text-xl font-semibold text-white mb-2">Welcome to World Chat!</h3>
                    <p className="text-gray-400 mb-6">Primul feed global VONEX. Împarte știri, link-uri și idei cu toată comunitatea.</p>
                    <p className="text-sm text-gray-500">Fii primul care postează ceva!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {posts.map((post) => (
                      <div key={post.id} className="bg-gray-800/50 md:rounded-xl border-0 md:border md:border-white/10 overflow-hidden md:shadow-lg">
                        {/* Post Header */}
                        <div className="p-4 flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center text-white font-bold">
                            {post.user_avatar ? (
                              <img src={post.user_avatar} alt={post.user_name} className="w-10 h-10 rounded-full object-cover" />
                            ) : (
                              post.user_nickname?.charAt(0)?.toUpperCase() || 'U'
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="text-white font-medium text-sm">{post.user_name || post.user_nickname}</div>
                            <div className="text-gray-400 text-xs">{formatPostDate(post.created_at)}</div>
                          </div>
                          <div className="relative">
                            <button className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-700/50 transition-colors">
                              <span className="text-lg">⋯</span>
                            </button>
                          </div>
                        </div>

                        {/* Post Content */}
                        {post.content && (
                          <div className="px-4 pb-3">
                            <div className="text-white whitespace-pre-wrap break-words text-sm leading-relaxed">
                              {post.content.length > 500 ? (
                                <>
                                  {post.content.substring(0, 500)}...
                                  <button className="text-cyan-400 hover:text-cyan-300 ml-1 text-sm font-medium">
                                    Vezi mai mult
                                  </button>
                                </>
                              ) : (
                                post.content
                              )}
                            </div>
                          </div>
                        )}

                        {/* Post Images */}
                        {post.images && post.images.length > 0 && (
                          <div className="pb-3">
                            {post.images.length === 1 ? (
                              <div className="px-0 md:px-4">
                                <img 
                                  src={`${process.env.REACT_APP_BACKEND_URL}${post.images[0].thumbnail_url}`}
                                  alt="Post image"
                                  className="w-full max-h-96 object-cover md:rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() => setSelectedImageModal(post.images[0])}
                                />
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 gap-1 px-0 md:px-4">
                                {post.images.slice(0, 4).map((image, index) => (
                                  <div key={image.id} className="relative">
                                    <img 
                                      src={`${process.env.REACT_APP_BACKEND_URL}${image.thumbnail_url}`}
                                      alt={`Post image ${index + 1}`}
                                      className="w-full h-48 object-cover md:rounded cursor-pointer hover:opacity-90 transition-opacity"
                                      onClick={() => setSelectedImageModal(image)}
                                    />
                                    {index === 3 && post.images.length > 4 && (
                                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-bold text-lg md:rounded cursor-pointer">
                                        +{post.images.length - 4}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Link Preview */}
                        {post.link_preview && (
                          <div className="px-4 pb-3">
                            <div className="bg-gray-700/30 border border-white/10 rounded-lg overflow-hidden hover:bg-gray-700/40 transition-colors cursor-pointer">
                              {post.link_preview.image_url && (
                                <img 
                                  src={post.link_preview.image_url} 
                                  alt="Link preview"
                                  className="w-full h-48 object-cover"
                                />
                              )}
                              <div className="p-4 space-y-2">
                                <div className="text-xs text-gray-400 uppercase font-medium">{post.link_preview.domain}</div>
                                {post.link_preview.title && (
                                  <div className="text-white font-medium text-sm line-clamp-2">{post.link_preview.title}</div>
                                )}
                                {post.link_preview.description && (
                                  <div className="text-gray-300 text-sm line-clamp-2">{post.link_preview.description}</div>
                                )}
                                <a 
                                  href={post.link_preview.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-cyan-400 hover:text-cyan-300 text-sm inline-flex items-center space-x-1 font-medium"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <span>Vizitează</span>
                                  <span>↗</span>
                                </a>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Post Actions - Only Share button */}
                        <div className="px-4 py-3 border-t border-white/10">
                          <div className="flex items-center justify-center">
                            <button 
                              onClick={() => openShareModal(post)}
                              className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors px-4 py-2 rounded-lg hover:bg-gray-700/30 justify-center"
                            >
                              <span className="text-lg">📤</span>
                              <span className="text-sm font-medium hidden sm:inline">Partajează</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Post Creation Area */}
            {/* Post Creation Area - Responsive Facebook-style */}
            <div className="bg-gray-800/50 md:border-t border-white/10">
              <div className="max-w-full md:max-w-2xl md:mx-auto p-4 md:p-6">
                <div className="space-y-4">
                  {/* Single Text Input pentru mesaj și link */}
                  <div className="space-y-2">
                    <textarea
                      value={newPost}
                      onChange={handleTextChange}
                      onKeyDown={handleKeyPress}
                      placeholder="Ce vrei să împarți cu lumea? Poți scrie text, pune link-uri..."
                      className="w-full p-4 bg-gray-700/50 border border-white/20 rounded-xl text-white placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-transparent transition-all duration-200"
                      rows="4"
                      style={{ minHeight: '100px' }}
                    />
                    
                    {/* Character Counter */}
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center space-x-2 md:space-x-4">
                        <span className="text-gray-500">
                          {characterCount > 0 && `${characterCount}/${MAX_CHARACTERS} caractere`}
                        </span>
                        {newPostLink && (
                          <span className="text-cyan-400 text-xs">
                            🔗 Link detectat automat
                          </span>
                        )}
                      </div>
                      {characterCount > MAX_CHARACTERS * 0.8 && (
                        <span className={`${characterCount >= MAX_CHARACTERS ? 'text-red-400' : 'text-yellow-400'}`}>
                          {MAX_CHARACTERS - characterCount} rămase
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Uploaded Images Preview */}
                  {uploadedImages.length > 0 && (
                    <div className="space-y-3">
                      <div className="text-sm text-gray-400">
                        {uploadedImages.length} imagine{uploadedImages.length > 1 ? 'i' : ''} atașat{uploadedImages.length > 1 ? 'e' : 'ă'}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {uploadedImages.map((image) => (
                          <div key={image.id} className="relative group">
                            <img 
                              src={`${process.env.REACT_APP_BACKEND_URL}${image.thumbnail_url}`}
                              alt="Preview"
                              className="w-full h-32 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => setSelectedImageModal(image)}
                            />
                            <button
                              onClick={() => removeImage(image.id)}
                              className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Link Preview Loading */}
                  {isLoadingPreview && (
                    <div className="flex items-center space-x-2 text-gray-400 text-sm">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-cyan-400"></div>
                      <span>Se generează preview pentru link...</span>
                    </div>
                  )}

                  {/* Link Preview */}
                  {linkPreview && (
                    <div className="bg-gray-700/30 border border-white/10 rounded-xl overflow-hidden">
                      {linkPreview.image_url && (
                        <img 
                          src={linkPreview.image_url} 
                          alt="Link preview"
                          className="w-full h-40 object-cover"
                        />
                      )}
                      <div className="p-4 space-y-2">
                        <div className="text-xs text-gray-400 uppercase">{linkPreview.domain}</div>
                        {linkPreview.title && (
                          <div className="text-white font-medium text-sm line-clamp-2">{linkPreview.title}</div>
                        )}
                        {linkPreview.description && (
                          <div className="text-gray-300 text-sm line-clamp-3">{linkPreview.description}</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                    <div className="flex items-center space-x-4">
                      {/* Image Upload Button */}
                      <label className="cursor-pointer flex items-center space-x-2 text-gray-400 hover:text-white transition-colors">
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleImageUpload(Array.from(e.target.files))}
                        />
                        <span className="text-lg">📷</span>
                        <span className="text-sm">Imagine</span>
                      </label>
                      
                      <div className="text-xs text-gray-500 hidden md:block">
                        💡 Poți invita oameni în camera ta din orice postare • Ctrl+Enter pentru a posta rapid
                      </div>
                    </div>
                    
                    <button
                      onClick={createPost}
                      disabled={(!newPost.trim() && uploadedImages.length === 0) || isCreatingPost || characterCount > MAX_CHARACTERS}
                      className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 w-full sm:w-auto"
                    >
                      {isCreatingPost ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Se postează...</span>
                        </>
                      ) : (
                        <>
                          <span>🚀</span>
                          <span>Postează</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'my-room' && (
          <div className="h-full flex flex-col">
            {!selectedCamera ? (
              /* Camera List View */
              <div className="flex-1 overflow-y-auto">
                {/* Header */}
                <div className="bg-gray-800/50 p-6 border-b border-white/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="text-xl font-bold text-white">Camerele tale</h1>
                      <p className="text-gray-400 text-sm">Creează și gestionează propriile camere tematice</p>
                    </div>
                    <button
                      onClick={() => setShowCreateCamera(true)}
                      className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-medium rounded-lg transition-all duration-200 flex items-center space-x-2"
                    >
                      <span>➕</span>
                      <span>Cameră nouă</span>
                    </button>
                  </div>
                </div>

                {/* My Cameras Only */}
                <div className="flex-1 p-6">
                  <div className="max-w-full md:max-w-4xl md:mx-auto">
                    {userCameras.length === 0 ? (
                      <div className="text-center py-12">
                        <span className="text-6xl mb-4 block">🏠</span>
                        <h3 className="text-xl font-semibold text-white mb-2">Nicio cameră creată încă</h3>
                        <p className="text-gray-400 mb-6">Creează prima ta cameră tematică și invită prietenii să discute!</p>
                        <button
                          onClick={() => setShowCreateCamera(true)}
                          className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-medium rounded-lg transition-all duration-200"
                        >
                          Creează prima cameră
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {userCameras.map((camera) => (
                          <div key={camera.id} className={`bg-gray-800/50 rounded-xl border border-white/10 overflow-hidden hover:border-cyan-400/30 transition-all duration-200 ${!camera.isActive ? 'opacity-60' : ''}`}>
                            {/* Camera Header */}
                            <div className="p-4 border-b border-white/10">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2 mb-1">
                                    <span className="text-lg">{getCameraVisibilityIcon(camera.visibility)}</span>
                                    <h3 className="text-white font-semibold text-lg line-clamp-1">{camera.name}</h3>
                                  </div>
                                  <div className="flex items-center space-x-3 text-xs text-gray-400">
                                    <span>{getCameraVisibilityText(camera.visibility)}</span>
                                    <span>•</span>
                                    <span>{camera.theme}</span>
                                  </div>
                                </div>
                                <div className="relative ml-2">
                                  <button className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-700/50 transition-colors">
                                    <span className="text-sm">⋯</span>
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Camera Content */}
                            <div className="p-4 space-y-3">
                              {camera.description && (
                                <p className="text-gray-300 text-sm line-clamp-2">{camera.description}</p>
                              )}
                              
                              {camera.pinnedMessage && (
                                <div className="bg-cyan-400/10 border border-cyan-400/20 rounded-lg p-2">
                                  <div className="text-xs text-cyan-400 mb-1">📌 Mesaj fixat</div>
                                  <div className="text-white text-sm line-clamp-2">{camera.pinnedMessage}</div>
                                </div>
                              )}

                              {/* Stats */}
                              <div className="flex items-center justify-between text-xs text-gray-400">
                                <div className="flex items-center space-x-4">
                                  <span>👥 {camera.membersCount} membri</span>
                                  <span>💬 {camera.messagesCount} mesaje</span>
                                </div>
                                <span>{camera.createdAt.toLocaleDateString('ro-RO')}</span>
                              </div>
                            </div>

                            {/* Camera Actions - Full control for my rooms */}
                            <div className="p-4 border-t border-white/10 flex items-center space-x-2">
                              <button
                                onClick={() => handleCameraAction('enter', camera)}
                                disabled={!camera.isActive}
                                className="flex-1 px-3 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all duration-200 text-sm"
                              >
                                {camera.isActive ? 'Intră' : 'Inactivă'}
                              </button>
                              <button
                                onClick={() => handleCameraAction('settings', camera)}
                                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
                                title="Setări cameră"
                              >
                                ⚙️
                              </button>
                              <button
                                onClick={() => handleCameraAction('toggle', camera)}
                                className={`px-3 py-2 rounded-lg transition-colors text-sm ${camera.isActive ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'} text-white`}
                                title={camera.isActive ? 'Pauzează camera' : 'Activează camera'}
                              >
                                {camera.isActive ? '⏸️' : '▶️'}
                              </button>
                              <button
                                onClick={() => handleCameraAction('delete', camera)}
                                className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm"
                                title="Șterge camera"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Selected Camera View */
              <div className="flex-1 flex flex-col">
                {/* Camera Header */}
                <div className="bg-gray-800/50 p-4 border-b border-white/10">
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={() => setSelectedCamera(null)}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <span className="text-lg">←</span>
                    </button>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{getCameraVisibilityIcon(selectedCamera.visibility)}</span>
                        <h1 className="text-xl font-bold text-white">{selectedCamera.name}</h1>
                        <span className="text-xs text-gray-400">({selectedCamera.theme})</span>
                      </div>
                      <p className="text-gray-400 text-sm">{selectedCamera.membersCount} membri • {selectedCamera.messagesCount} mesaje</p>
                    </div>
                    <button
                      onClick={() => setShowCameraSettings(true)}
                      className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                      ⚙️ Setări
                    </button>
                  </div>
                </div>

                {/* Camera Chat Interface */}
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <span className="text-6xl mb-4 block">💬</span>
                    <h3 className="text-xl font-semibold text-white mb-2">Camera "{selectedCamera.name}"</h3>
                    <p className="text-gray-400 mb-6">Interfața de chat va fi implementată aici.</p>
                    <p className="text-sm text-gray-500">Funcționalitate în dezvoltare...</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'favorites' && (
          <div className="h-full flex">
            {/* Main Content Area - Left Side */}
            <div className="flex-1 flex items-center justify-center bg-gray-900/20">
              <div className="text-center py-12">
                <span className="text-6xl mb-4 block">💬</span>
                <h3 className="text-xl font-semibold text-white mb-2">Selectează un favorit</h3>
                <p className="text-gray-400 mb-6">Alege un utilizator favorit din lista de pe dreapta pentru a începe o conversație.</p>
                <p className="text-sm text-gray-500">Mesajele tale private vor apărea aici.</p>
              </div>
            </div>

            {/* Favorites Sidebar - Right Side (WhatsApp + Messenger style) */}
            <div className="w-80 bg-gray-800/50 border-l border-white/10 flex flex-col">
              {/* Header */}
              <div className="p-4 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white">Favoriți</h2>
                  <div className="text-sm text-gray-400">
                    {favoriteUsers.length} persoane
                  </div>
                </div>
                <p className="text-gray-400 text-sm mt-1">Contactele tale favorite</p>
              </div>

              {/* Favorites List */}
              <div className="flex-1 overflow-y-auto">
                {favoriteUsers.length === 0 ? (
                  <div className="p-4 text-center">
                    <span className="text-4xl mb-3 block">⭐</span>
                    <p className="text-gray-400 text-sm">Niciun favorit încă</p>
                    <p className="text-gray-500 text-xs mt-2">Adaugă utilizatori la favoriți din camerele tale.</p>
                  </div>
                ) : (
                  <div className="p-2">
                    {favoriteUsers
                      .slice()
                      .sort((a, b) => {
                        // Sort by: unread messages first, then online status, then name
                        if (b.unreadMessages !== a.unreadMessages) {
                          return b.unreadMessages - a.unreadMessages;
                        }
                        if (b.isOnline !== a.isOnline) {
                          return b.isOnline ? 1 : -1;
                        }
                        return a.name.localeCompare(b.name);
                      })
                      .map((user) => (
                        <div
                          key={user.id}
                          className={`p-3 rounded-lg mb-1 cursor-pointer transition-all duration-200 hover:bg-gray-700/50 relative ${
                            selectedFavorite?.id === user.id ? 'bg-cyan-500/20 border border-cyan-400/30' : ''
                          }`}
                          onClick={() => setSelectedFavorite(user)}
                        >
                          <div className="flex items-center space-x-3">
                            {/* Avatar - Only profile pictures with colored borders, NO LETTERS */}
                            <div className="relative flex-shrink-0">
                              <div className={`w-12 h-12 rounded-full border-2 overflow-hidden ${
                                user.isOnline 
                                  ? 'border-green-500' 
                                  : 'border-gray-500'
                              } ${user.isMuted ? 'opacity-60' : ''}`}>
                                <img 
                                  src={user.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face'} 
                                  alt="" 
                                  className="w-full h-full object-cover"
                                  style={{ display: 'block' }}
                                />
                              </div>

                              {/* Online Status Dot */}
                              {user.isOnline && (
                                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-gray-800 rounded-full"></div>
                              )}
                            </div>

                            {/* User Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2 min-w-0">
                                  <h3 className="text-white font-medium text-sm truncate">{user.name}</h3>
                                  {user.isMuted && (
                                    <span className="text-gray-400 text-xs">🔇</span>
                                  )}
                                </div>
                                <div className="flex items-center space-x-2 flex-shrink-0">
                                  {user.lastMessageTime && (
                                    <span className="text-gray-500 text-xs">
                                      {formatLastSeen(user.lastMessageTime)}
                                    </span>
                                  )}
                                  {user.unreadMessages > 0 && (
                                    <div className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                                      {user.unreadMessages > 9 ? '9+' : user.unreadMessages}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Last Message Preview */}
                              <div className="flex items-center space-x-1 mt-1">
                                <span className="text-gray-400 text-xs">@{user.nickname}</span>
                                <span className="text-gray-500 text-xs">•</span>
                                <span className={`text-xs truncate flex-1 ${
                                  user.isOnline ? 'text-green-400' : 'text-gray-500'
                                }`}>
                                  {user.isOnline ? 'Online' : `Văzut ${formatLastSeen(user.lastSeen)}`}
                                </span>
                              </div>

                              {/* Last Message */}
                              {user.lastMessage && (
                                <div className="mt-1">
                                  <p className={`text-xs truncate ${
                                    user.unreadMessages > 0 ? 'text-white font-medium' : 'text-gray-400'
                                  }`}>
                                    {user.lastMessage}
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* Action Menu */}
                            <div className="relative flex-shrink-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowFavoriteActions(showFavoriteActions === user.id ? null : user.id);
                                }}
                                className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-700/50 transition-colors opacity-0 group-hover:opacity-100"
                              >
                                ⋯
                              </button>

                              {/* Action Dropdown */}
                              {showFavoriteActions === user.id && (
                                <div className="absolute right-0 top-full mt-1 bg-gray-700 rounded-lg shadow-lg border border-white/10 min-w-[140px] z-20">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleFavoriteAction('dm', user);
                                    }}
                                    className="w-full text-left px-3 py-2 text-white hover:bg-gray-600 rounded-t-lg transition-colors flex items-center space-x-2 text-sm"
                                  >
                                    <span>💬</span>
                                    <span>Mesaj</span>
                                  </button>
                                  {user.unreadMessages > 0 && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleFavoriteAction('jump', user);
                                      }}
                                      className="w-full text-left px-3 py-2 text-white hover:bg-gray-600 transition-colors flex items-center space-x-2 text-sm"
                                    >
                                      <span>↗️</span>
                                      <span>Ultimul mesaj</span>
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleFavoriteAction('mute', user);
                                    }}
                                    className="w-full text-left px-3 py-2 text-white hover:bg-gray-600 transition-colors flex items-center space-x-2 text-sm"
                                  >
                                    <span>{user.isMuted ? '🔊' : '🔇'}</span>
                                    <span>{user.isMuted ? 'Unmute' : 'Mute'}</span>
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleFavoriteAction('unfollow', user);
                                    }}
                                    className="w-full text-left px-3 py-2 text-red-400 hover:bg-gray-600 rounded-b-lg transition-colors flex items-center space-x-2 text-sm"
                                  >
                                    <span>❌</span>
                                    <span>Elimină</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Common Rooms (if any) */}
                          {user.commonRooms.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {user.commonRooms.slice(0, 2).map((room, index) => (
                                <span key={index} className="bg-blue-500/20 text-blue-400 text-xs px-2 py-1 rounded-full">
                                  {room}
                                </span>
                              ))}
                              {user.commonRooms.length > 2 && (
                                <span className="text-gray-500 text-xs">+{user.commonRooms.length - 2}</span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Footer with quick actions */}
              <div className="p-3 border-t border-white/10 text-center">
                <p className="text-gray-500 text-xs">
                  {favoriteUsers.filter(u => u.unreadMessages > 0).length > 0 && 
                    `${favoriteUsers.filter(u => u.unreadMessages > 0).length} cu mesaje noi`
                  }
                  {favoriteUsers.filter(u => u.isOnline).length > 0 && 
                    ` • ${favoriteUsers.filter(u => u.isOnline).length} online`
                  }
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'recent' && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <h3 className="text-xl font-semibold text-white mb-2">Camere Recente</h3>
              <p className="text-gray-400">În curând...</p>
            </div>
          </div>
        )}

        {activeTab === 'search' && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <h3 className="text-xl font-semibold text-white mb-2">Search Camere</h3>
              <p className="text-gray-400">În curând...</p>
            </div>
          </div>
        )}
      </div>

      {/* Create Room Modal */}
      {showCreateRoom && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-xl rounded-3xl p-8 w-full max-w-md border border-white/20 shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <h2 className="text-white text-2xl font-bold mb-2">{t('createNewRoom')}</h2>
              <p className="text-gray-300 text-sm">{t('startConversation')}</p>
            </div>
            
            <form onSubmit={createRoom} className="space-y-6">
              <div className="space-y-2">
                <label className="text-gray-300 text-sm font-medium">{t('roomName')}</label>
                <input
                  type="text"
                  placeholder={t('roomNamePlaceholder')}
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="w-full bg-white/10 backdrop-blur-sm text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white/20 placeholder-gray-400 border border-white/20 transition-all duration-200"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-gray-300 text-sm font-medium">{t('roomDescription')}</label>
                <textarea
                  placeholder={t('roomDescriptionPlaceholder')}
                  value={newRoomDescription}
                  onChange={(e) => setNewRoomDescription(e.target.value)}
                  className="w-full bg-white/10 backdrop-blur-sm text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white/20 placeholder-gray-400 border border-white/20 resize-none transition-all duration-200"
                  rows="3"
                />
              </div>
              
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-white font-medium">{t('privateRoom')}</div>
                    <div className="text-gray-400 text-xs">{t('privateRoomDesc')}</div>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPrivate}
                    onChange={(e) => setIsPrivate(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300/25 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>
              
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateRoom(false)}
                  className="flex-1 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white py-3 rounded-xl transition-all duration-200 font-medium border border-white/20 hover:border-white/30"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white py-3 rounded-xl transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {t('createRoom')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Modal for Full View */}
      {selectedImageModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setSelectedImageModal(null)}>
          <div className="relative max-w-4xl max-h-full">
            <img 
              src={`${process.env.REACT_APP_BACKEND_URL}${selectedImageModal.url}`}
              alt="Full size"
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setSelectedImageModal(null)}
              className="absolute top-4 right-4 bg-gray-900/70 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-gray-900 transition-colors"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Share Modal - Facebook Style */}
      {shareModalPost && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={closeShareModal}>
          <div className="bg-gray-800 rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white">Partajează postarea</h3>
              <button
                onClick={closeShareModal}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <span className="text-xl">×</span>
              </button>
            </div>

            {/* Share Options */}
            <div className="p-4 space-y-4">
              {!shareOption ? (
                /* Option Selection */
                <div className="space-y-3">
                  <p className="text-gray-300 text-sm">Alege unde vrei să partajezi:</p>
                  
                  {/* Share to Room */}
                  <button
                    onClick={() => setShareOption('room')}
                    className="w-full p-4 bg-gray-700/50 hover:bg-gray-700/70 rounded-lg border border-white/10 transition-colors text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">🏠</span>
                      <div>
                        <div className="text-white font-medium">În camera ta</div>
                        <div className="text-gray-400 text-sm">Partajează în una din camerele tale create</div>
                      </div>
                    </div>
                  </button>

                  {/* Share to Friend */}
                  <button
                    onClick={() => setShareOption('friend')}
                    className="w-full p-4 bg-gray-700/50 hover:bg-gray-700/70 rounded-lg border border-white/10 transition-colors text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">👥</span>
                      <div>
                        <div className="text-white font-medium">Către un prieten</div>
                        <div className="text-gray-400 text-sm">Trimite direct unui utilizator favorit</div>
                      </div>
                    </div>
                  </button>
                </div>
              ) : (
                /* Share Form */
                <div className="space-y-4">
                  {/* Back Button */}
                  <button
                    onClick={() => setShareOption('')}
                    className="flex items-center space-x-2 text-cyan-400 hover:text-cyan-300 text-sm"
                  >
                    <span>←</span>
                    <span>Înapoi</span>
                  </button>

                  {/* Target Selection */}
                  <div className="space-y-2">
                    <label className="text-white text-sm font-medium">
                      {shareOption === 'room' ? 'Alege camera:' : 'Alege prietenul:'}
                    </label>
                    
                    {shareOption === 'room' ? (
                      <select
                        value={selectedRoom}
                        onChange={(e) => setSelectedRoom(e.target.value)}
                        className="w-full p-3 bg-gray-700/50 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                      >
                        <option value="">Selectează camera...</option>
                        {userRooms.map(room => (
                          <option key={room.id} value={room.id}>{room.name}</option>
                        ))}
                      </select>
                    ) : (
                      <select
                        value={selectedFriend}
                        onChange={(e) => setSelectedFriend(e.target.value)}
                        className="w-full p-3 bg-gray-700/50 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                      >
                        <option value="">Selectează prietenul...</option>
                        {userFavorites.map(friend => (
                          <option key={friend.id} value={friend.id}>{friend.name} (@{friend.nickname})</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Comment Section */}
                  <div className="space-y-2">
                    <label className="text-white text-sm font-medium">
                      Adaugă un comentariu (opțional):
                    </label>
                    <textarea
                      value={shareComment}
                      onChange={(e) => setShareComment(e.target.value)}
                      placeholder="Scrie un comentariu despre această postare..."
                      className="w-full p-3 bg-gray-700/50 border border-white/20 rounded-lg text-white placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                      rows="3"
                    />
                  </div>

                  {/* Original Post Preview */}
                  <div className="bg-gray-700/30 border border-white/10 rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-2">Postarea originală:</div>
                    <div className="flex items-start space-x-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
                        {shareModalPost.user_nickname?.charAt(0)?.toUpperCase() || 'U'}
                      </div>
                      <div className="flex-1">
                        <div className="text-white text-xs font-medium">{shareModalPost.user_name}</div>
                        <div className="text-gray-300 text-xs mt-1 line-clamp-3">
                          {shareModalPost.content.substring(0, 100)}
                          {shareModalPost.content.length > 100 && '...'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex space-x-3 pt-2">
                    <button
                      onClick={closeShareModal}
                      className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                      Anulează
                    </button>
                    <button
                      onClick={handleShare}
                      disabled={!((shareOption === 'room' && selectedRoom) || (shareOption === 'friend' && selectedFriend))}
                      className="flex-1 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                    >
                      Partajează
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Camera Modal */}
      {showCreateCamera && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowCreateCamera(false)}>
          <div className="bg-gray-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h3 className="text-xl font-semibold text-white">Creează cameră nouă</h3>
              <button
                onClick={() => setShowCreateCamera(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <span className="text-xl">×</span>
              </button>
            </div>

            {/* Create Form */}
            <div className="p-6 space-y-4">
              {/* Camera Name */}
              <div className="space-y-2">
                <label className="text-white text-sm font-medium">
                  Numele camerei *
                </label>
                <input
                  type="text"
                  value={newCamera.name}
                  onChange={(e) => setNewCamera(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="ex: Tech Talks România"
                  className="w-full p-3 bg-gray-700/50 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                  maxLength="50"
                />
              </div>

              {/* Theme */}
              <div className="space-y-2">
                <label className="text-white text-sm font-medium">
                  Tema *
                </label>
                <input
                  type="text"
                  value={newCamera.theme}
                  onChange={(e) => setNewCamera(prev => ({ ...prev, theme: e.target.value }))}
                  placeholder="ex: Tehnologie, Politică, Gaming"
                  className="w-full p-3 bg-gray-700/50 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                  maxLength="30"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-white text-sm font-medium">
                  Descriere
                </label>
                <textarea
                  value={newCamera.description}
                  onChange={(e) => setNewCamera(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descrie pe scurt despre ce este camera ta..."
                  className="w-full p-3 bg-gray-700/50 border border-white/20 rounded-lg text-white placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                  rows="3"
                  maxLength="200"
                />
              </div>

              {/* Visibility */}
              <div className="space-y-2">
                <label className="text-white text-sm font-medium">
                  Vizibilitate
                </label>
                <select
                  value={newCamera.visibility}
                  onChange={(e) => setNewCamera(prev => ({ ...prev, visibility: e.target.value }))}
                  className="w-full p-3 bg-gray-700/50 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                >
                  <option value="public">🌍 Publică - Oricine poate să se alăture</option>
                  <option value="private">🔒 Privată - Doar tu și persoanele invitate</option>
                  <option value="invite-only">📧 Doar cu invitație - Membri acceptați manual</option>
                </select>
              </div>

              {/* Rules */}
              <div className="space-y-2">
                <label className="text-white text-sm font-medium">
                  Reguli (opțional)
                </label>
                <textarea
                  value={newCamera.rules}
                  onChange={(e) => setNewCamera(prev => ({ ...prev, rules: e.target.value }))}
                  placeholder="1. Respectă ceilalți membri&#10;2. Postează doar conținut relevant&#10;3. Fără spam sau reclame"
                  className="w-full p-3 bg-gray-700/50 border border-white/20 rounded-lg text-white placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                  rows="4"
                />
              </div>

              {/* Max Members */}
              <div className="space-y-2">
                <label className="text-white text-sm font-medium">
                  Numărul maxim de membri
                </label>
                <select
                  value={newCamera.maxMembers}
                  onChange={(e) => setNewCamera(prev => ({ ...prev, maxMembers: parseInt(e.target.value) }))}
                  className="w-full p-3 bg-gray-700/50 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                >
                  <option value="50">50 membri</option>
                  <option value="100">100 membri</option>
                  <option value="200">200 membri</option>
                  <option value="500">500 membri</option>
                  <option value="1000">1000 membri</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => setShowCreateCamera(false)}
                  className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Anulează
                </button>
                <button
                  onClick={handleCreateCamera}
                  disabled={!newCamera.name.trim() || !newCamera.theme.trim()}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                >
                  Creează camera
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Main App Component  
const App = () => {
  return (
    <LanguageProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </LanguageProvider>
  );
};

// Componenta FriendsBar a fost eliminată definitiv
// Nu mai afișează bulele cu litere din colțul din dreapta jos

const AppContent = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [showPrivateChat, setShowPrivateChat] = useState(false);
  const [privateChatUser, setPrivateChatUser] = useState(null);
  const [privateMessages, setPrivateMessages] = useState([]);
  const [newPrivateMessage, setNewPrivateMessage] = useState('');
  const [isPrivateChatUserFriend, setIsPrivateChatUserFriend] = useState(false);
  const { user, loading, token } = useAuth();

  // Functions for private chat
  const openPrivateChat = (chatUser) => {
    setPrivateChatUser(chatUser);
    setShowPrivateChat(true);
    fetchPrivateMessages(chatUser.id);
    checkIfUserIsFriend(chatUser.id);
  };

  // Check if user is friend
  const checkIfUserIsFriend = async (userId) => {
    try {
      const response = await api.get(`${API}/friends`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const isFriend = response.data.some(friend => friend.friend_user_id === userId);
      setIsPrivateChatUserFriend(isFriend);
    } catch (error) {
      console.error('Failed to check friend status:', error);
      setIsPrivateChatUserFriend(false);
    }
  };

  // Toggle friend status
  const toggleFriendStatus = async () => {
    if (!privateChatUser) return;

    try {
      if (isPrivateChatUserFriend) {
        // Remove from friends - need to implement unfriend endpoint
        alert('Funcționalitatea de eliminare din favorite va fi implementată în curând.');
      } else {
        // Add to friends
        await api.post(`${API}/friends/request`, {
          friend_user_id: privateChatUser.id
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setIsPrivateChatUserFriend(true);
        alert('Utilizator adăugat la favorite!');
      }
    } catch (error) {
      console.error('Failed to toggle friend status:', error);
      alert('Nu s-a putut modifica statusul de favorit.');
    }
  };

  const fetchPrivateMessages = async (userId) => {
    try {
      const response = await api.get(`${API}/private-messages/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPrivateMessages(response.data);
    } catch (error) {
      console.error('Failed to fetch private messages:', error);
    }
  };

  const sendPrivateMessage = async (e) => {
    e.preventDefault();
    if (!newPrivateMessage.trim() || !privateChatUser) return;

    try {
      const response = await api.post(`${API}/private-messages`, {
        content: newPrivateMessage.trim(),
        recipient_id: privateChatUser.id
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setPrivateMessages(prev => [...prev, response.data]);
      setNewPrivateMessage('');
    } catch (error) {
      console.error('Failed to send private message:', error);
      alert('Nu s-a putut trimite mesajul privat. Încearcă din nou.');
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <LoginForm
        isLogin={isLogin}
        onToggle={() => setIsLogin(!isLogin)}
      />
    );
  }

  if (showAccountSettings) {
    return (
      <AccountSettings onBack={() => setShowAccountSettings(false)} />
    );
  }

  if (selectedRoom) {
    return (
      <ChatRoom
        room={selectedRoom}
        onBack={() => setSelectedRoom(null)}
      />
    );
  }

  return (
    <>
      <RoomList 
        onRoomSelect={setSelectedRoom}
        onAccountSettings={() => setShowAccountSettings(true)}
      />
      <FriendsBar onFriendClick={openPrivateChat} />
      
      {/* Global Private Chat Overlay - Responsive */}
      {showPrivateChat && privateChatUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-gray-800/95 backdrop-blur-xl rounded-xl border border-white/20 shadow-2xl w-full max-w-full sm:max-w-2xl h-full sm:h-96 flex flex-col">
            {/* Private Chat Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full overflow-hidden border border-purple-500/30">
                  {privateChatUser.avatar_url ? (
                    privateChatUser.avatar_url.startsWith('data:') ? (
                      <img 
                        src={privateChatUser.avatar_url} 
                        alt="Avatar" 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <div 
                        className="w-full h-full"
                        dangerouslySetInnerHTML={{ 
                          __html: defaultAvatars.find(a => a.id === privateChatUser.avatar_url)?.svg || '' 
                        }}
                      />
                    )
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                      <span className="text-white text-sm font-semibold">
                        {privateChatUser.nickname?.charAt(0)?.toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-semibold">Chat privat cu {privateChatUser.nickname}</h3>
                  <p className="text-gray-400 text-sm flex items-center">
                    Conversație privată
                    {isPrivateChatUserFriend && (
                      <span className="ml-2 text-green-400 text-xs">★ Favorit</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={toggleFriendStatus}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center space-x-1 ${
                    isPrivateChatUserFriend 
                      ? 'bg-red-600 hover:bg-red-700 text-white' 
                      : 'bg-purple-600 hover:bg-purple-700 text-white'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {isPrivateChatUserFriend ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    )}
                  </svg>
                  <span>{isPrivateChatUserFriend ? 'FAVORIT' : 'FAVORIT'}</span>
                </button>
                <button
                  onClick={() => {
                    setShowPrivateChat(false);
                    setPrivateChatUser(null);
                    setPrivateMessages([]);
                    setIsPrivateChatUserFriend(false);
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Private Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {privateMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                    msg.sender_id === user?.id
                      ? 'bg-gradient-to-br from-purple-600 to-blue-600 text-white'
                      : 'bg-white/10 text-gray-100'
                  }`}>
                    <div className="break-words">{msg.content}</div>
                    <div className={`text-xs mt-1 opacity-70 ${
                      msg.sender_id === user?.id ? 'text-purple-100' : 'text-gray-400'
                    }`}>
                      {formatTime(msg.created_at)}
                    </div>
                  </div>
                </div>
              ))}
              {privateMessages.length === 0 && (
                <div className="text-center text-gray-400">
                  <p>Încă nu aveți mesaje. Începeți conversația!</p>
                </div>
              )}
            </div>

            {/* Private Message Input */}
            <form onSubmit={sendPrivateMessage} className="p-4 border-t border-white/10">
              <div className="flex space-x-3">
                <input
                  type="text"
                  value={newPrivateMessage}
                  onChange={(e) => setNewPrivateMessage(e.target.value)}
                  placeholder={`Mesaj pentru ${privateChatUser.nickname}...`}
                  className="flex-1 bg-white/10 backdrop-blur-sm text-white px-4 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white/20 placeholder-gray-400 border border-white/20"
                />
                <button
                  type="submit"
                  disabled={!newPrivateMessage.trim()}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 text-white px-4 py-2 rounded-xl transition-all duration-200 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default App;