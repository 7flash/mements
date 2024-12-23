import React, { useState, useContext } from 'react';
import { Toaster, toast } from 'sonner';

const AppContext = React.createContext({
  inputValue: '',
  setInputValue: (value) => {},
  handleSubmit: (content) => {},
  isLoading: false
});

const GlassmorphicChat = () => {
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (content) => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/ask-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      const data = await response.json();
      if (response.status === 400 && data.error) {
        toast.error(`Error: ${data.error}. ${data.details}`);
        return;
      }
      if (data.chatId) {
        window.location.href = `/chat/${data.chatId}`;
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppContext.Provider value={{ inputValue, setInputValue, handleSubmit, isLoading }}>
      <div className="relative min-h-screen w-full overflow-hidden bg-zinc-900">
        <BackgroundImage />
        <main className="relative z-10 flex flex-col items-center justify-between min-h-screen p-4">
          <div className="flex flex-col items-center mt-8 space-y-6">
            <Avatar />
            <Header />
          </div>
          <ChatInput />
          <Toaster richColors />
        </main>
      </div>
    </AppContext.Provider>
  );
};

const BackgroundImage = () => (
  <div 
    className="absolute inset-0 bg-cover bg-center"
    style={{ 
      backgroundImage: `url(${window.serverData.agentImage})`,
      filter: 'blur(8px) brightness(0.3)'
    }}
  />
);

const Avatar = () => (
  <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-white/20 shadow-2xl">
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
      <span className="text-2xl font-bold text-white mb-2 font-geohumanist-sans">{capitalizeFirstLetter(window.serverData.botName)}</span>
      <div className="text-white/70">
        {Object.entries(window.serverData.socialLinks || {}).map(([platform, handle]) => (
          <p key={platform}>
            {platform}: {handle}
          </p>
        ))}
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
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="w-full px-6 py-4 text-lg text-white bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shadow-lg focus:outline-none focus:border-white/30 transition-all"
          placeholder="Ask me anything..."
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors animate-pulse"
        >
          {isLoading ? '...' : '→'}
        </button>
      </div>
    </form>
  );
};

export default GlassmorphicChat;