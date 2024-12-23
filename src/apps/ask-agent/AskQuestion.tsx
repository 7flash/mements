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
      <><div className="flex flex-col items-center mt-8 space-y-6">
            <Avatar />
            <Header />
          </div>
          <ChatInput />
      </>
    </AppContext.Provider>
  );
};

const Avatar = () => (
  <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-white/20 shadow-2xl view-transition-avatar">
    <img 
      src={window.serverData.agentImage} 
      alt="Avatar"
      className="w-full h-full object-cover"
    />
  </div>
);

const Header = () => {
  const capitalizeFirstLetter = (string) => string.charAt(0).toUpperCase() + string.slice(1);

  return (
    <div className="text-center">
      <div className="flex flex-col items-center bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shadow-lg p-4">
        <div className="view-transition-name-container">
          <span className="text-4xl font-bold text-white mb-2 font-geohumanist-sans view-transition-name">{capitalizeFirstLetter(window.serverData.botName)}</span>
          <div className="text-white/70">
            {Object.entries(window.serverData.links || {}).map(([platform, value]) => (
              <p key={platform}>
                <span data-tootik={platform} data-tootik-conf="invert no-fading shadow multiline">{value}
                </span>
              </p>
            ))}
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
    <form onSubmit={onSubmit} className="w-full max-w-2xl">
      <div className="relative view-transition-question-container">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="w-full px-6 py-4 text-lg text-white bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shadow-lg focus:outline-none focus:border-white/30 transition-all view-transition-question"
          placeholder="Ask me anything..."
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors"
        >
          {isLoading ? '...' : '→'}
        </button>
      </div>
    </form>
  );
};