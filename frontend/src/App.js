import React, { useState, useEffect, useContext, createContext, useRef } from 'react';
import axios from 'axios';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetchCurrentUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchCurrentUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API}/auth/login`, { email, password });
      const { access_token } = response.data;
      localStorage.setItem('token', access_token);
      setToken(access_token);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Login failed' };
    }
  };

  const register = async (email, password, name) => {
    try {
      const response = await axios.post(`${API}/auth/register`, { email, password, name });
      const { access_token } = response.data;
      localStorage.setItem('token', access_token);
      setToken(access_token);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Registration failed' };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
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

// Components
const LoginForm = ({ isLogin, onToggle }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = isLogin 
      ? await login(email, password)
      : await register(email, password, name);

    if (!result.success) {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 w-full max-w-md border border-white/20">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            {isLogin ? 'Welcome Back' : 'Join ChatRooms'}
          </h1>
          <p className="text-gray-300">
            {isLogin ? 'Sign in to continue chatting' : 'Create your account to get started'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {!isLogin && (
            <div>
              <input
                type="text"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                required
              />
            </div>
          )}
          
          <div>
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              required
            />
          </div>
          
          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              required
            />
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-200 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <span className="text-gray-300">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
          </span>
          <button
            onClick={onToggle}
            className="text-purple-400 hover:text-purple-300 font-semibold transition-colors"
          >
            {isLogin ? 'Sign Up' : 'Sign In'}
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
  const messagesEndRef = useRef(null);
  const { token, user } = useAuth();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Fetch existing messages
    const fetchMessages = async () => {
      try {
        const response = await axios.get(`${API}/rooms/${room.id}/messages`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMessages(response.data);
      } catch (error) {
        console.error('Failed to fetch messages:', error);
      }
    };

    fetchMessages();

    // Setup WebSocket connection
    const wsUrl = `${BACKEND_URL.replace('https:', 'wss:').replace('http:', 'ws:')}/ws/${room.id}`;
    const websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      console.log('WebSocket connected');
      setWs(websocket);
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
      console.log('WebSocket disconnected');
      setWs(null);
    };

    return () => {
      websocket.close();
    };
  }, [room.id, token]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !ws) return;

    ws.send(JSON.stringify({
      content: newMessage.trim(),
      token: token
    }));

    setNewMessage('');
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
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 px-4 py-3 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="text-white font-semibold text-lg"># {room.name}</h2>
            {room.description && (
              <p className="text-gray-400 text-sm">{room.description}</p>
            )}
          </div>
        </div>
        <div className="text-gray-400 text-sm">
          {room.member_count} members
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.user_id === user?.id ? 'justify-end' : 'justify-start'} w-full`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                message.user_id === user?.id
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700 text-gray-100'
              }`}
            >
              {message.user_id !== user?.id && (
                <div className="text-xs text-gray-300 mb-1 font-medium">
                  {message.user_name}
                </div>
              )}
              <div className="break-words">{message.content}</div>
              <div className={`text-xs mt-1 ${
                message.user_id === user?.id ? 'text-purple-200' : 'text-gray-400'
              }`}>
                {formatTime(message.created_at)}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <form onSubmit={sendMessage} className="p-4 bg-gray-800 border-t border-gray-700">
        <div className="flex space-x-4">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={`Message # ${room.name}`}
            className="flex-1 bg-gray-700 text-white px-4 py-3 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-400"
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || !ws}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-full transition-colors disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
};

const RoomList = ({ onRoomSelect }) => {
  const [rooms, setRooms] = useState([]);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDescription, setNewRoomDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const { token, user, logout } = useAuth();

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const response = await axios.get(`${API}/rooms`, {
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
      await axios.post(`${API}/rooms`, {
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
      await axios.post(`${API}/rooms/${roomId}/join`, {}, {
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
      <div className="bg-gray-800 px-4 py-4 flex items-center justify-between border-b border-gray-700">
        <div>
          <h1 className="text-white text-xl font-bold">ChatRooms</h1>
          <p className="text-gray-400 text-sm">Welcome, {user?.name}</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowCreateRoom(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
          >
            + New Room
          </button>
          <button
            onClick={logout}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>

      {/* Room List */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {rooms.map((room) => (
            <div
              key={room.id}
              onClick={() => {
                joinRoom(room.id);
                onRoomSelect(room);
              }}
              className="bg-gray-800 hover:bg-gray-700 p-4 rounded-lg cursor-pointer transition-colors border border-gray-700"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-white font-semibold flex items-center">
                  {room.is_private ? (
                    <svg className="w-4 h-4 mr-2 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <span className="mr-2 text-gray-400">#</span>
                  )}
                  {room.name}
                </h3>
                <span className="text-gray-400 text-sm">{room.member_count} members</span>
              </div>
              {room.description && (
                <p className="text-gray-400 text-sm">{room.description}</p>
              )}
            </div>
          ))}
          
          {rooms.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-400 mb-4">No chat rooms yet</p>
              <button
                onClick={() => setShowCreateRoom(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg transition-colors"
              >
                Create Your First Room
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Create Room Modal */}
      {showCreateRoom && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-white text-xl font-bold mb-4">Create New Room</h2>
            
            <form onSubmit={createRoom} className="space-y-4">
              <div>
                <input
                  type="text"
                  placeholder="Room Name"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-400"
                  required
                />
              </div>
              
              <div>
                <textarea
                  placeholder="Room Description (optional)"
                  value={newRoomDescription}
                  onChange={(e) => setNewRoomDescription(e.target.value)}
                  className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-400 resize-none"
                  rows="3"
                />
              </div>
              
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="isPrivate"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 focus:ring-purple-500 rounded"
                />
                <label htmlFor="isPrivate" className="text-gray-300 text-sm">
                  Make this room private
                </label>
              </div>
              
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateRoom(false)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg transition-colors"
                >
                  Create Room
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
  const [isLogin, setIsLogin] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState(null);

  return (
    <AuthProvider>
      <AuthenticatedApp
        isLogin={isLogin}
        setIsLogin={setIsLogin}
        selectedRoom={selectedRoom}
        setSelectedRoom={setSelectedRoom}
      />
    </AuthProvider>
  );
};

const AuthenticatedApp = ({ isLogin, setIsLogin, selectedRoom, setSelectedRoom }) => {
  const { user, loading } = useAuth();

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

  if (selectedRoom) {
    return (
      <ChatRoom
        room={selectedRoom}
        onBack={() => setSelectedRoom(null)}
      />
    );
  }

  return (
    <RoomList onRoomSelect={setSelectedRoom} />
  );
};

export default App;