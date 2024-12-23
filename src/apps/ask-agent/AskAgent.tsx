import React, { useState, useContext } from 'react';
import { Link, Route, Switch } from 'wouter';
import { DexIcon, TelegramIcon, XIcon, GitbookIcon } from './icons';

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
          <Header />
          <ChatInput />
          <SocialLinks />
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

const Header = () => (
  <div className="text-center mt-8">
    <h1 className="text-4xl font-bold text-white mb-4">
      Chat<span className="text-red-500">{window.serverData.botName}</span>
    </h1>
  </div>
);

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
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors"
        >
          {isLoading ? '...' : '→'}
        </button>
      </div>
    </form>
  );
};

const SocialLinks = () => {
  const links = window.serverData?.socialLinks || {};
  
  return (
    <div className="flex gap-4 mb-8">
      {Object.entries({
        telegram: [TelegramIcon, links.telegram],
        dex: [DexIcon, links.dex],
        x: [XIcon, links.X],
        gitbook: [GitbookIcon, links.gitbook]
      }).map(([key, [Icon, url]]) => url && (
        <a
          key={key}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-3 bg-white/10 backdrop-blur-md rounded-xl hover:bg-white/20 transition-all"
        >
          <Icon />
        </a>
      ))}
    </div>
  );
};

export default GlassmorphicChat;
