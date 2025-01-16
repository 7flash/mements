import React, { useState, useContext } from 'react';
import { toast } from 'sonner';
import { useLocation } from 'wouter';

const AppContext = React.createContext({
  inputValue: '',
  setInputValue: (value) => {},
  handleSubmit: (content) => {},
  isLoading: false
});

export default function() {
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();

  const handleSubmit = async (content) => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/ask-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      const data = await response.json();
      
      if (response.status === 200 && data.chatId) {
        window.serverData = {
          ...window.serverData,
          ...data,
        };
        if (document.startViewTransition) {
          await document.startViewTransition(() => {
            setLocation(`/chat/${data.chatId}`);
          }).finished;
        } else {
          setLocation(`/chat/${data.chatId}`);
        }
      } else if (response.status === 422 && data.error) {
        toast.error(`Question cannot be answered`, {
          'description': data.error,
          'closeButton': true,
        });
        return;
      } else {
        throw `${data.error || 'Unknown error'}`;
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Unexpected error', {
        'description': `${error}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppContext.Provider value={{ inputValue, setInputValue, handleSubmit, isLoading }}>
      <div className="flex flex-col items-center mt-8 sm:mt-16 space-y-8 sm:space-y-12 px-6 sm:px-8 max-w-6xl mx-auto">
        <Avatar />
        <Header />
        <ChatInput />
      </div>
    </AppContext.Provider>
  );
};

const Avatar = () => (
  <div className="relative w-32 h-32 sm:w-48 sm:h-48 rounded-full overflow-hidden border-8 border-white/20 shadow-2xl view-transition-avatar">
    <img 
      src={window.serverData.agentImages['avatar'] ? window.serverData.agentImages['avatar'] : window.serverData.agentImages['default']}
      alt="Avatar"
      className="w-full h-full object-cover"
    />
  </div>
);

const Header = () => {
  const capitalizeFirstLetter = (string) => string.charAt(0).toUpperCase() + string.slice(1);

  const renderInfo = () => {
    if (window.serverData.customInfo) {
      let info = decodeURIComponent(window.serverData.customInfo);
      for (let [key, value] of Object.entries(window.serverData.links || {})) {
        info = info.replace(`__${key.toUpperCase()}__`, value);
      }

      return info.split('\n').map((line, index) => <p key={index}>{line}</p>);
    }
    return Object.entries(window.serverData.links || {}).map(([platform, value]) => (
      <p key={platform}>
        <span data-tootik={platform} data-tootik-conf="invert no-fading shadow multiline">{value}
        </span>
      </p>
    ));
  };

  return (
    <div className="text-left w-full max-w-4xl">
      <div className="flex flex-col items-center bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-xl p-6 sm:p-8">
        <div className="view-transition-name-container">
          {!window.serverData.customInfo && (
            <span className="text-3xl sm:text-5xl font-bold text-white mb-4 font-geohumanist-sans view-transition-name tracking-tight">
              {capitalizeFirstLetter(window.serverData.botName)}
            </span>
          )}
          <div className="text-white/80 font-mono text-base sm:text-xl leading-relaxed whitespace-pre-wrap break-words">
            {renderInfo()}
          </div>
        </div>
      </div>
    </div>
  );
};

const ChatInput = () => {
  const { inputValue, setInputValue, handleSubmit, isLoading } = useContext(AppContext);

  const onSubmit = (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    handleSubmit(inputValue);
  };

  return (
    <form onSubmit={onSubmit} className="w-full max-w-4xl">
      <div className="relative view-transition-question-container">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="w-full px-6 sm:px-8 py-4 sm:py-6 text-lg sm:text-xl text-white bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-xl focus:outline-none focus:border-white/40 transition-all view-transition-question"
          placeholder={window.serverData.links['input_placeholder'] ?? 'Ask me anything...'}
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading}
          className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 text-white/80 hover:text-white transition-colors text-xl sm:text-2xl"
        >
          {isLoading ? '...' : '→'}
        </button>
      </div>
    </form>
  );
};