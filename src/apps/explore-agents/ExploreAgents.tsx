import React, { useState, createContext, useContext, useMemo } from 'react';
import { Bot, MessageSquare, Terminal, Rss, Zap, Check, ArrowLeft, ArrowRight } from 'lucide-react';
import { Link, Route, Switch, useLocation } from "wouter";
import Confetti from 'react-confetti';
import { Toaster, toast } from 'sonner';
import { Twitter } from 'lucide-react';

import assets from "#generated/assets.json";
import constants from "#generated/constants.json";

interface Agent {
  avatar: string;
  last_activity: string;
  name: string;
  prompt: string;
  subdomain: string;
  total_chats: number;
  workflow: any;
}

interface AgentContextType {
  agentConfig: Partial<AgentConfig>;
  updateAgentConfig: (updates: Partial<AgentConfig>) => void;
  resetConfig: () => void;
}

const defaultConfig: Partial<AgentConfig> = {
  type: 'chat',
  name: '',
  description: '',
  subdomain: '',
  purpose: '',
};

const AgentContext = createContext<AgentContextType | undefined>(undefined);

function useAgent() {
  const context = useContext(AgentContext);
  if (!context) {
    throw new Error("useAgent must be used within an AgentProvider");
  }
  return context;
}

function AgentProvider({ children }: { children: React.ReactNode }) {
  const [agentConfig, setAgentConfig] = useState<Partial<AgentConfig>>(defaultConfig);

  const updateAgentConfig = (updates: Partial<AgentConfig>) => {
    setAgentConfig(current => ({ ...current, ...updates }));
  };

  const resetConfig = () => {
    setAgentConfig(defaultConfig);
  };

  return (
    <AgentContext.Provider value={{ agentConfig, updateAgentConfig, resetConfig }}>
      {children}
    </AgentContext.Provider>
  );
}

export function cls(...classes: any) {
  return classes.filter(Boolean).join(" ");
}

export function Navigation() {
  const links = [
    // Add navigation links here if needed
  ];

  return (
    <nav className="hidden sm:ml-6 sm:flex sm:space-x-8">
      {links.map((link) => (
        <Link key={link.name} href={link.href}>
          <a className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-900">
            {link.name}
          </a>
        </Link>
      ))}
    </nav>
  );
}

function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
          {window.serverData?.twitterAccount && <a 
              href={`https://twitter.com/${window.serverData?.twitterAccount}`}
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-gray-600 hover:text-purple-600 transition-colors"
            >
              <Twitter className="w-5 h-5" />
              <span>@{window.serverData?.twitterAccount}</span>
            </a>}
          </div>
          <div className="flex flex-col md:flex-row items-center gap-4">
            {
              window.serverData?.contractAddress && <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Contract Address:</span>
              <code className="px-3 py-1 bg-gray-100 rounded text-sm font-mono">
              {window.serverData?.contractAddress}
              </code>
            </div>
            }
            <div className="text-sm text-gray-500">
              © {2025} Mements. All rights reserved.
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function Header() {
  const [publicKey, setPublicKey] = useState<string | null>(null);

  const handleConnectWallet = useMemo(() => {
    const getProvider = () => {
      if ("phantom" in window) {
        const provider = window.phantom?.solana;
        return provider?.isPhantom ? provider : window.open("https://phantom.app/", "_blank");
      }
    };

    return async () => {
      const provider = getProvider();
      if (provider) {
        const resp = await provider.connect();
        const key = resp.publicKey.toString();
        setPublicKey(key);
      }
    };
  }, []);

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <a href="/" className="flex-shrink-0 flex items-center gap-2">
              <img src={assets.logo} alt="Logo" width={24} height={24} />
              <span className="text-xl font-bold font-geohumanist-sans text-[#006DD8]">Mements</span>
            </a>
            <Navigation />
          </div>
          <div className="flex items-center">
            {publicKey ? (
              <span className="px-4 py-2 text-sm font-medium text-gray-700">
                {`${publicKey.slice(0, 4)}...${publicKey.slice(-4)}`}
              </span>
            ) : (
              <button className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer" onClick={handleConnectWallet}>
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

/*
todo: fix grid, currently its totally messed up.

should be just three vertical cards in one row in a page, its blurred image of the card and on top a partly transparent container for its name and description, similarly as its implemented on question page:


  // todo: improve mobile layout currently it shows a desktop version thats not responsive just very big distance around the edges and very small text
  return (
    <AppContext.Provider value={{ inputValue, setInputValue, handleSubmit, isLoading }}>
      <div className="flex flex-col items-center mt-4 sm:mt-8 space-y-4 sm:space-y-6 px-4 sm:px-0">
        <Avatar />
        <Header />
        <ChatInput />
      </div>
    </AppContext.Provider>
  );
};

const Avatar = () => (
  <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden border-4 border-white/20 shadow-2xl view-transition-avatar">
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
    <div className="text-left">
      <div className="flex flex-col items-center bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shadow-lg p-4">
        <div className="view-transition-name-container">
          {!window.serverData.customInfo && <span className="text-2xl sm:text-4xl font-bold text-white mb-2 font-geohumanist-sans view-transition-name">{capitalizeFirstLetter(window.serverData.botName)}</span>}
          <div className="text-white/70 font-mono text-sm sm:text-base leading-tight whitespace-pre-wrap break-words">
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
    <form onSubmit={onSubmit} className="w-full max-w-md sm:max-w-2xl">
      <div className="relative view-transition-question-container">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="w-full px-4 sm:px-6 py-3 sm:py-4 text-base sm:text-lg text-white bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shadow-lg focus:outline-none focus:border-white/30 transition-all view-transition-question"
          placeholder={window.serverData.links['input_placeholder'] ?? 'Ask me anything...'}
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading}
          className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors"
        >
          {isLoading ? '...' : '→'}
        </button>
      </div>
    </form>
  );
};
*/

function MementCard({ mement }: { mement: Agent }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
      <div className="aspect-w-16 aspect-h-9 rounded-t-xl overflow-hidden">
        <img 
          src={mement.avatar} 
          alt={mement.name}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="px-3 py-1 bg-purple-100 rounded-full text-sm text-purple-600 font-medium">
            {mement.total_chats} chats
          </span>
        </div>
        <h3 className="text-xl font-semibold mb-2">{mement.name}</h3>
        <p className="text-gray-600 mb-4 line-clamp-2">{mement.prompt}</p>
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Last active: {new Date(mement.last_activity).toLocaleDateString()}
          </div>
          <Link href={`https://${mement.subdomain}.${constants.BASE_URL}`}>
            <a className="text-purple-600 hover:text-purple-700 font-medium">
              Visit →
            </a>
          </Link>
        </div>
      </div>
    </div>
  );
}

function MementGrid({ mements, currentPage, totalPages, onPageChange }: {
  mements: Agent[];
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {mements.map((mement) => (
          <MementCard key={mement.subdomain} mement={mement} />
        ))}
      </div>
      
      {totalPages > 1 && (
        <div className="flex justify-center mt-12">
          <nav className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-gray-300 disabled:opacity-50"
            >
              <ArrowLeft size={20} />
            </button>
            
            <span className="px-4 py-2">
              Page {currentPage} of {totalPages}
            </span>
            
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-gray-300 disabled:opacity-50"
            >
              <ArrowRight size={20} />
            </button>
          </nav>
        </div>
      )}
    </div>
  );
}

function LandingHero() {
  return (
    <div className="text-center max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-4xl sm:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-blue-600 mb-6">
        Explore AI Personalities
      </h1>
      <p className="text-lg text-gray-600 mb-12">
        Discover unique AI agents with distinct personalities, purposes, and capabilities. 
        Interact with Mements that bring imagination to life.
      </p>
      <Link href="/explore">
        <a className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-purple-500 to-blue-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity mb-16 inline-block">
          Explore All Mements
        </a>
      </Link>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
        <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col items-center">
          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
            <Bot className="w-6 h-6 text-purple-600" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Self-evolving</h3>
          <p className="text-gray-600 text-center">Each Mement inhabits its own unique imaginary world.</p>
        </div>
        
        <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col items-center">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
            <Zap className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Self-initiative</h3>
          <p className="text-gray-600 text-center">Mements engage independently across social platforms.</p>
        </div>
        
        <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col items-center">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
            <Check className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Community-driven</h3>
          <p className="text-gray-600 text-center">Powered by community engagement and Solana tokens.</p>
        </div>
      </div>
    </div>
  );
}

function ExplorePage() {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;

  // Get agents from window.serverData
  const agents = window.serverData?.agents || [];
  const totalPages = Math.ceil(agents.length / itemsPerPage);

  // Calculate current page items
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentAgents = agents.slice(startIndex, endIndex);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    window.scrollTo(0, 0);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Explore Mements</h1>
        <MementGrid 
          mements={currentAgents}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      </div>
    </div>
  );
}

function App() {
  return (
    <AgentProvider>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <div className="flex-grow">
          <Switch>
            <Route path="/">
              <LandingHero />
            </Route>
            <Route path="/explore">
              <ExplorePage />
            </Route>
          </Switch>
        </div>
        <Footer />
        <Toaster richColors />
      </div>
    </AgentProvider>
  );
}

export default App;
