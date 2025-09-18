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
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent mb-3">
            {isLogin ? t('welcomeBack') : t('joinVonex')}
          </h1>
          <p className="text-gray-300 text-lg">
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
  const messagesEndRef = useRef(null);
  const pollingInterval = useRef(null);
  const { token, user } = useAuth();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
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

  // Fetch room users function
  const fetchRoomUsers = async () => {
    try {
      const response = await api.get(`${API}/rooms/${room.id}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRoomUsers(response.data);
    } catch (error) {
      console.error('Failed to fetch room users:', error);
    }
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

  // Open private chat
  const openPrivateChat = (user) => {
    setPrivateChatUser(user);
    setShowPrivateChat(true);
    setShowUserList(false);
    setShowAvatarBubble(null);
    fetchPrivateMessages(user.id);
  };

  // Handle avatar click/hover
  const handleAvatarClick = (event, messageUser) => {
    if (messageUser.user_id === user?.id) return; // Don't show for current user
    
    const rect = event.currentTarget.getBoundingClientRect();
    setAvatarBubblePosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    });
    
    setShowAvatarBubble({
      id: messageUser.user_id,
      nickname: messageUser.user_name,
      avatar_url: messageUser.user_avatar
    });
  };

  // Close avatar bubble
  const closeAvatarBubble = () => {
    setShowAvatarBubble(null);
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
      setShowAvatarBubble(null);
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
  };

  useEffect(() => {
    // Initial fetch
    fetchMessages();
    fetchRoomUsers();

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
    pollingInterval.current = setInterval(fetchMessages, 3000); // Poll every 3 seconds
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

    try {
      if (ws && ws.readyState === WebSocket.OPEN) {
        // Send via WebSocket
        ws.send(JSON.stringify({
          content: newMessage.trim(),
          token: token
        }));
      } else {
        // Send via HTTP API (fallback)
        const response = await api.post(`${API}/rooms/${room.id}/messages`, {
          content: newMessage.trim()
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // Immediately fetch messages to show the new message
        setTimeout(fetchMessages, 500);
      }
      
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
      // Show error to user
      alert('Nu s-a putut trimite mesajul. Încearcă din nou.');
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
            <span className="text-white text-sm font-medium">{room.member_count} membri</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.user_id === user?.id ? 'justify-end' : 'justify-start'} w-full`}
          >
            <div className="flex items-end space-x-2 max-w-xs lg:max-w-md">
              {message.user_id !== user?.id && (
                <div className="relative group">
                  <button
                    onClick={(e) => handleAvatarClick(e, message)}
                    className="w-8 h-8 rounded-full overflow-hidden border border-purple-500/30 flex-shrink-0 mb-1 relative hover:border-purple-400 transition-all duration-200 cursor-pointer hover:scale-110"
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
                    
                    {/* Plus indicator */}
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full border-2 border-gray-800 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                  </button>
                </div>
              )}
              
              <div
                className={`px-4 py-3 rounded-2xl shadow-lg backdrop-blur-sm border ${
                  message.user_id === user?.id
                    ? 'bg-gradient-to-br from-purple-600 to-blue-600 text-white border-purple-500/30'
                    : 'bg-white/10 text-gray-100 border-white/20'
                } ${message.user_id === user?.id ? 'rounded-br-md' : 'rounded-bl-md'}`}
              >
                {message.user_id !== user?.id && (
                  <div className="text-xs font-semibold mb-1 opacity-75">
                    {message.user_name}
                  </div>
                )}
                <div className="break-words leading-relaxed">{message.content}</div>
                <div className={`text-xs mt-2 opacity-70 ${
                  message.user_id === user?.id ? 'text-purple-100' : 'text-gray-400'
                }`}>
                  {formatTime(message.created_at)}
                </div>
              </div>
              
              {message.user_id === user?.id && (
                <div className="w-8 h-8 rounded-full overflow-hidden border border-green-500/30 flex-shrink-0 mb-1">
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
                    <div className="w-full h-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                      <span className="text-white text-xs font-semibold">
                        {user?.nickname?.charAt(0)?.toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
        
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

      {/* Message Input */}
      <form onSubmit={sendMessage} className="p-6 bg-gradient-to-r from-gray-800/50 to-gray-900/50 backdrop-blur-xl border-t border-white/10">
        <div className="flex space-x-4">
          <div className="flex-1 relative">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={`Trimite un mesaj în ${room.name}...`}
              className="w-full bg-white/10 backdrop-blur-sm text-white px-6 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white/20 placeholder-gray-400 border border-white/20 transition-all duration-200"
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
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 text-white px-6 py-4 rounded-2xl transition-all duration-200 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:transform-none flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            <span className="font-medium">Trimite</span>
          </button>
        </div>
      </form>

      {/* Users List Panel */}
      {showUserList && (
        <div className="absolute top-16 right-6 w-80 bg-gray-800/95 backdrop-blur-xl rounded-xl border border-white/20 shadow-2xl z-50 max-h-96 overflow-hidden">
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold">Utilizatori online</h3>
              <button
                onClick={() => setShowUserList(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="overflow-y-auto max-h-80">
            {roomUsers.map((roomUser) => (
              <div key={roomUser.id} className="p-3 border-b border-white/5 hover:bg-white/5 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-purple-500/30">
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
                    <div>
                      <div className="text-white font-medium">{roomUser.nickname}</div>
                      {roomUser.is_friend && (
                        <div className="text-green-400 text-xs">★ Favorit</div>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => openPrivateChat(roomUser)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-sm transition-colors"
                    >
                      Chat
                    </button>
                    {!roomUser.is_friend && (
                      <button
                        onClick={() => addToFavorites(roomUser.id)}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-lg text-sm transition-colors"
                      >
                        ★ Favorit
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
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
                <div>
                  <h3 className="text-white font-semibold">Chat privat cu {privateChatUser.nickname}</h3>
                  <p className="text-gray-400 text-sm">Conversație privată</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowPrivateChat(false);
                  setPrivateChatUser(null);
                  setPrivateMessages([]);
                }}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
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

  return (
    <div className="h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-800/95 to-gray-900/95 backdrop-blur-xl px-6 py-5 flex items-center justify-between border-b border-white/10 shadow-lg">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div>
            <h1 className="text-white text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              {t('appName')}
            </h1>
            <p className="text-gray-400 text-sm">{t('welcome')}, <span className="text-purple-400 font-medium">{user?.nickname}</span></p>
          </div>
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

      {/* Room List */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-4">
          {rooms.map((room) => (
            <div
              key={room.id}
              onClick={() => {
                joinRoom(room.id);
                onRoomSelect(room);
              }}
              className="group bg-gradient-to-r from-gray-800/50 to-gray-700/50 hover:from-gray-700/60 hover:to-gray-600/60 backdrop-blur-lg p-5 rounded-2xl cursor-pointer transition-all duration-300 border border-white/10 hover:border-white/20 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
            >
              <div className="flex items-center space-x-4">
                {/* Room Icon */}
                <div className="flex-shrink-0 transition-transform duration-300 group-hover:scale-110">
                  {getRoomIcon(room.name, room.is_private)}
                </div>
                
                {/* Room Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-white font-semibold text-lg truncate group-hover:text-purple-200 transition-colors">
                      {room.name}
                    </h3>
                    <div className="flex items-center space-x-2">
                      {room.is_private && (
                        <div className="flex items-center text-yellow-400">
                          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                          </svg>
                          <span className="text-xs font-medium">Private</span>
                        </div>
                      )}
                      <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
                        <span className="text-white text-sm font-medium">{room.member_count} membri</span>
                      </div>
                    </div>
                  </div>
                  
                  {room.description && (
                    <p className="text-gray-300 text-sm leading-relaxed group-hover:text-gray-200 transition-colors line-clamp-2">
                      {room.description}
                    </p>
                  )}
                  
                  {/* Room Activity Indicator */}
                  <div className="flex items-center mt-3 space-x-4">
                    <div className="flex items-center text-green-400">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse mr-2"></div>
                      <span className="text-xs font-medium">Activ acum</span>
                    </div>
                    <div className="text-gray-400 text-xs">
                      Creat de {room.created_by === user?.id ? 'tine' : 'cineva'}
                    </div>
                  </div>
                </div>
                
                {/* Arrow Icon */}
                <div className="flex-shrink-0 text-gray-400 group-hover:text-purple-400 transition-all duration-300 transform group-hover:translate-x-1">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          ))}
          
          {rooms.length === 0 && (
            <div className="text-center py-16">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
                <svg className="w-12 h-12 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Nicio cameră încă</h3>
              <p className="text-gray-400 mb-6 max-w-sm mx-auto">
                Începe prin a crea prima cameră de chat sau alătură-te unei camere existente
              </p>
              <button
                onClick={() => setShowCreateRoom(true)}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8 py-4 rounded-xl transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-1"
              >
                <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Creează Prima Cameră
              </button>
            </div>
          )}
        </div>
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

// Friends Bar Component
const FriendsBar = ({ onFriendClick }) => {
  const [friends, setFriends] = useState([]);
  const [conversations, setConversations] = useState([]);
  const { token } = useAuth();

  useEffect(() => {
    fetchFriends();
    fetchConversations();
  }, []);

  const fetchFriends = async () => {
    try {
      const response = await api.get(`${API}/friends`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFriends(response.data);
    } catch (error) {
      console.error('Failed to fetch friends:', error);
    }
  };

  const fetchConversations = async () => {
    try {
      const response = await api.get(`${API}/private-conversations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConversations(response.data);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    }
  };

  // Combine friends and conversations, prioritize friends
  const allContacts = [...friends, ...conversations.filter(conv => !friends.find(f => f.friend_user_id === conv.user_id))];

  if (allContacts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-40">
      <div className="flex flex-col space-y-2">
        {allContacts.slice(0, 5).map((contact) => {
          const isConversation = !contact.friend_user_id;
          const userId = isConversation ? contact.user_id : contact.friend_user_id;
          const nickname = isConversation ? contact.nickname : contact.friend_nickname;
          const avatar = isConversation ? contact.avatar_url : contact.friend_avatar_url;
          const unreadCount = isConversation ? contact.unread_count : contact.unread_count;
          
          return (
            <div key={userId} className="relative">
              <button
                onClick={() => onFriendClick({
                  id: userId,
                  nickname: nickname,
                  avatar_url: avatar
                })}
                className="w-12 h-12 rounded-full overflow-hidden border-2 border-purple-500/50 hover:border-purple-400 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                {avatar ? (
                  avatar.startsWith('data:') ? (
                    <img 
                      src={avatar} 
                      alt="Avatar" 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <div 
                      className="w-full h-full"
                      dangerouslySetInnerHTML={{ 
                        __html: defaultAvatars.find(a => a.id === avatar)?.svg || '' 
                      }}
                    />
                  )
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                    <span className="text-white text-sm font-semibold">
                      {nickname?.charAt(0)?.toUpperCase()}
                    </span>
                  </div>
                )}
              </button>
              {unreadCount > 0 && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                </div>
              )}
            </div>
          );
        })}
        {allContacts.length > 5 && (
          <div className="w-12 h-12 rounded-full bg-gray-700/80 backdrop-blur-sm border-2 border-white/20 flex items-center justify-center">
            <span className="text-white text-xs font-semibold">+{allContacts.length - 5}</span>
          </div>
        )}
      </div>
    </div>
  );
};

const AppContent = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [showPrivateChat, setShowPrivateChat] = useState(false);
  const [privateChatUser, setPrivateChatUser] = useState(null);
  const [privateMessages, setPrivateMessages] = useState([]);
  const [newPrivateMessage, setNewPrivateMessage] = useState('');
  const { user, loading, token } = useAuth();

  // Functions for private chat
  const openPrivateChat = (chatUser) => {
    setPrivateChatUser(chatUser);
    setShowPrivateChat(true);
    fetchPrivateMessages(chatUser.id);
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
      
      {/* Global Private Chat Overlay */}
      {showPrivateChat && privateChatUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
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
                <div>
                  <h3 className="text-white font-semibold">Chat privat cu {privateChatUser.nickname}</h3>
                  <p className="text-gray-400 text-sm">Conversație privată</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowPrivateChat(false);
                  setPrivateChatUser(null);
                  setPrivateMessages([]);
                }}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
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