import React, { useState, useContext } from 'react';
import { Toaster, toast } from 'sonner';
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

  const fetchAndRedirect = async (content) => {
    window.serverData = {
      "botName": "oracle",
      "botTag": "@oracle",
      "socialMediaLinks": {},
      "agentImage": "https://brown-quintessential-planarian-681.mypinata.cloud/files/bafybeidsgbn744pag3rlyuwh3f3amkuspxfrwbwa7bz4hjry2525nsgocm?X-Algorithm=PINATA1&X-Date=1734973511&X-Expires=3600&X-Method=GET&X-Signature=d663dd12c1dddec85f7b6cfa6e6d55280ee97e746bbddb94e9bbaf017edc71e3",
      "chatId": "xc046i3x3c",
      "question": "meaning%20of%20life%3F",
      "content": "%0AThe%20meaning%20of%20life%20is%20not%20to%20be%20found%20in%20a%20single%20answer%2C%20but%20in%20the%20journey%20of%20seeking%2C%20understanding%2C%20and%20experiencing%20the%20tapestry%20of%20existence%2C%20where%20each%20thread%20weaves%20its%20unique%20pattern%20of%20purpose%20and%20truth.%0A",
      "timestamp": "2024-12-23T17:01:29.392Z",
      "twitterPostLink": null
    }
    setLocation('/chat/'+window.serverData.chatId);
    return;

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
      setLocation(`/chat/${data.chatId}`);
    } else if (response.status === 422 && data.error) {
      toast.error(`Question cannot be answered`, {
        'description': data.error,
        'closeButton': true,
      });
      return;
    } else {
      throw `${data.error || 'Unknown error'}`;
    }
  };
  
  const handleSubmit = async (content) => {
    try {
      setIsLoading(true);
      if (document.startViewTransition) {
        await document.startViewTransition(async () => {
          await fetchAndRedirect(content);
        });
      } else {
        await fetchAndRedirect(content);
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
      <div className="relative min-h-screen w-full overflow-hidden bg-zinc-900">
        <BackgroundImage />
        <main className="relative z-10 flex flex-col items-center justify-between min-h-screen p-4">
          <div className="flex flex-col items-center mt-8 space-y-6">
            <Avatar />
            <Header />
          </div>
          <ChatInput />
        </main>
      </div>
      <Toaster richColors />
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
      <span className="text-4xl font-bold text-white mb-2 font-geohumanist-sans">{capitalizeFirstLetter(window.serverData.botName)}</span>
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
