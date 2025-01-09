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

function MementCard({ mement }: { mement: Agent }) {
  return (
    <div className="relative h-[400px] rounded-xl overflow-hidden group hover:shadow-lg transition-shadow">
      {/* Background image with blur */}
      <div className="absolute inset-0">
        <img 
          src={mement.avatar} 
          alt={mement.name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-black/20 backdrop-blur-[2px]" />
      </div>
      
      {/* Content overlay */}
      <div className="relative h-full flex flex-col justify-end p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-sm text-white/90 font-medium">
              {mement.total_chats} chats
            </span>
          </div>
          
          <h3 className="text-2xl font-bold text-white">{mement.name}</h3>
          
          <p className="text-white/80 line-clamp-3 text-sm sm:text-base">
            {mement.prompt}
          </p>
          
          <div className="flex items-center justify-between pt-4">
            <div className="text-sm text-white/60">
              Last active: {new Date(mement.last_activity).toLocaleDateString()}
            </div>
            <Link className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-lg text-white hover:bg-white/20 transition-colors" href={`https://${mement.subdomain}.${constants.BASE_URL}`} target='_blank'>
                Visit →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function MementGrid({ mements, pagination, onPageChange }: {
  mements: Agent[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="w-full">
      {/* Responsive grid with proper spacing */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 mb-12">
        {mements.map((mement) => (
          <MementCard key={mement.subdomain} mement={mement} />
        ))}
      </div>
      
      {pagination.pages > 1 && (
        <div className="flex justify-center mt-8 sm:mt-12">
          <nav className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            
            <span className="px-4 py-2 text-sm sm:text-base">
              Page {pagination.page} of {pagination.pages}
            </span>
            
            <button
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.pages}
              className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 hover:bg-gray-50 transition-colors"
            >
              <ArrowRight className="w-5 h-5" />
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

interface FilterOptions {
  sortBy: 'recent' | 'popular' | 'name';
  category?: string;
}

// todo: currently search and filters only works over the agents already present on the page, but of course we need to utilize backend here to actually retrieve all the results from database along with updated pagination of a new set of agents corresponding to search and filters and sorting

function SearchBar({ onSearch }: { onSearch: (query: string) => void }) {
  return (
    <div className="relative w-full max-w-md">
      <input
        type="text"
        placeholder="Search..."
        onChange={(e) => onSearch(e.target.value)}
        className="w-full px-4 py-2 pl-10 pr-4 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
      />
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
    </div>
  );
}

function FilterBar({ onFilterChange }: { onFilterChange: (options: FilterOptions) => void }) {
  return (
    <div className="flex flex-wrap gap-4 items-center">
      <select 
        onChange={(e) => onFilterChange({ sortBy: e.target.value as FilterOptions['sortBy'] })}
        className="px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
      >
        <option value="recent">Most Recent</option>
        <option value="popular">Most Popular</option>
        <option value="name">Name A-Z</option>
      </select>
    </div>
  );
}

function ExplorePage() {
  const AGENTS_PER_PAGE = 9; // 3x3 grid layout
  const [currentPage, setCurrentPage] = useState(window.serverData?.pagination?.page || 1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ sortBy: 'recent' });
  const [agents, setAgents] = useState(window.serverData?.agents || []);

  // Filter and sort agents based on search query and filter options
  const filteredAgents = useMemo(() => {
    let filtered = [...agents];
    
    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(agent => 
        agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.prompt.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Apply sorting
    switch (filterOptions.sortBy) {
      case 'recent':
        filtered.sort((a, b) => new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime());
        break;
      case 'popular':
        filtered.sort((a, b) => b.total_chats - a.total_chats);
        break;
      case 'name':
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }
    
    return filtered;
  }, [agents, searchQuery, filterOptions]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredAgents.length / AGENTS_PER_PAGE);
  const paginatedAgents = filteredAgents.slice(
    (currentPage - 1) * AGENTS_PER_PAGE,
    currentPage * AGENTS_PER_PAGE
  );

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1); // Reset to first page when searching
  };

  const handleFilterChange = (options: FilterOptions) => {
    setFilterOptions(prev => ({ ...prev, ...options }));
    setCurrentPage(1); // Reset to first page when filtering
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        <div className="flex flex-col gap-6 mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Explore Memetic Agents
          </h1>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            <SearchBar onSearch={handleSearch} />
            <FilterBar onFilterChange={handleFilterChange} />
          </div>
        </div>

        {filteredAgents.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No Mements found matching your criteria</p>
          </div>
        ) : (
          <MementGrid 
            mements={paginatedAgents}
            pagination={{
              total: filteredAgents.length,
              page: currentPage,
              limit: AGENTS_PER_PAGE,
              pages: totalPages
            }}
            onPageChange={handlePageChange}
          />
        )}
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
