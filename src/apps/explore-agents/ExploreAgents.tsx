import React, { useState, createContext, useContext, useMemo, useEffect } from 'react';
import { Bot, MessageSquare, Terminal, Rss, Zap, Check, ArrowLeft, ArrowRight } from 'lucide-react';
import { Link, Route, Switch, useLocation } from "wouter";
import Confetti from 'react-confetti';
import { Toaster, toast } from 'sonner';
import { Twitter } from 'lucide-react';

import assets from "#generated/assets.json";
import constants from "#generated/constants.json";

declare global {
  interface Window {
    serverData?: {
      agents: Agent[];
      pagination?: {
        page: number;
      };
      twitterAccount?: string;
      contractAddress?: string;
    };
    phantom?: {
      solana?: {
        isPhantom?: boolean;
        connect(): Promise<{ publicKey: { toString(): string } }>;
      };
    };
  }
}

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

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'just now';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (diffInSeconds < 2592000) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } else if (diffInSeconds < 31536000) {
    const months = Math.floor(diffInSeconds / 2592000);
    return `${months} month${months > 1 ? 's' : ''} ago`;
  } else {
    const years = Math.floor(diffInSeconds / 31536000);
    return `${years} year${years > 1 ? 's' : ''} ago`;
  }
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
              Last active {formatRelativeTime(mement.last_activity)}
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
  const [location, setLocation] = useLocation();
  
  const handlePageChange = (newPage: number) => {
    const url = new URL(window.location.href);
    const currentParams = new URLSearchParams(url.search);
    currentParams.set('page', newPage.toString());
    
    // Preserve existing filters
    if (window.serverData?.filters) {
      if (window.serverData.filters.search) {
        currentParams.set('search', window.serverData.filters.search);
      }
      if (window.serverData.filters.category) {
        currentParams.set('category', window.serverData.filters.category);
      }
      if (window.serverData.filters.sortBy) {
        currentParams.set('sortBy', window.serverData.filters.sortBy);
      }
    }
    
    setLocation(`${url.pathname}?${currentParams.toString()}`);
    onPageChange(newPage);
  };
  return (
    <div className="w-full">
      {/* Responsive grid with proper spacing */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 mb-12">
        {mements.map((mement) => (
          <MementCard key={mement.subdomain} mement={mement} />
        ))}
      </div>
      {/* todo: it should also push page filters into navigation so that we can refresh page and be on the same place, also it should read window.serverData.filters which looks like           filters: {
            search,
            category,
            sortBy
          } and apply it into ui elements accordingly
 */}
      {pagination.pages > 1 && (
        <div className="flex justify-center mt-8 sm:mt-12">
          <nav className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            
            <span className="px-4 py-2 text-sm sm:text-base">
              Page {pagination.page} of {pagination.pages}
            </span>
            
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.pages}
              className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 hover:bg-gray-50 transition-colors cursor-pointer"
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
  sortField: 'last_activity' | 'total_chats' | 'name';
  sortOrder: 'asc' | 'desc';
  category?: string;
  search?: string;
}

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

function FilterBar({ onFilterChange, initialValue }: { 
  onFilterChange: (options: FilterOptions) => void;
  initialValue?: string;
}) {
  const [location, setLocation] = useLocation();
  const [currentValue, setCurrentValue] = useState(
    initialValue || 
    window.serverData?.filters?.sortBy || 
    'recent'
  );
  
  const handleChange = (value: FilterOptions['sortBy']) => {
    setCurrentValue(value);
    const url = new URL(window.location.href);
    url.searchParams.set('sortBy', value);
    
    // Preserve other params
    const currentParams = new URLSearchParams(url.search);
    if (window.serverData?.filters?.search) {
      currentParams.set('search', window.serverData.filters.search);
    }
    
    setLocation(`${url.pathname}?${currentParams.toString()}`);
    
    onFilterChange({ 
      sortBy: value,
      sortField: value === 'recent' ? 'last_activity' : 
                value === 'popular' ? 'total_chats' : 'name',
      sortOrder: value === 'name' ? 'asc' : 'desc'
    });
  };

  return (
    <div className="flex flex-wrap gap-4 items-center">
      <select 
        value={currentValue}
        onChange={(e) => handleChange(e.target.value as FilterOptions['sortBy'])}
        className="px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
      >
        <option value="recent">Recently Active</option>
        <option value="popular">Most Popular</option>
        <option value="name">Name A-Z</option>
      </select>
    </div>
  );
}

function ExplorePage() {
  const AGENTS_PER_PAGE = 9;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agents, setAgents] = useState(window.serverData?.agents || []);
  const [pagination, setPagination] = useState({
    total: window.serverData?.pagination?.total || 0,
    page: window.serverData?.pagination?.page || 1,
    limit: AGENTS_PER_PAGE,
    pages: window.serverData?.pagination?.pages || 1
  });

  const [location, setLocation] = useLocation();
  const urlParams = new URLSearchParams(window.location.search);

  const [currentPage, setCurrentPage] = useState(
    parseInt(urlParams.get('page') || '') || 
    window.serverData?.pagination?.page || 
    1
  );
  
  // todo: fix search query is not embedded into url so when page refreshed its lost
  const [searchQuery, setSearchQuery] = useState(
    urlParams.get('search') || 
    window.serverData?.filters?.search || 
    ''
  );

  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    sortBy: (urlParams.get('sortBy') as FilterOptions['sortBy']) || 
           window.serverData?.filters?.sortBy || 
           'recent',
    sortField: 'last_activity',
    sortOrder: 'desc'
  });

  useEffect(() => {
    // Update state based on URL params whenever location changes
    const params = new URLSearchParams(window.location.search);
    const page = parseInt(params.get('page') || '1');
    const search = params.get('search') || '';
    const sortBy = params.get('sortBy') as FilterOptions['sortBy'] || 'recent';
    
    setCurrentPage(page);
    setSearchQuery(search);
    setFilterOptions(prev => ({
      ...prev,
      sortBy,
      sortField: sortBy === 'recent' ? 'last_activity' : 
                 sortBy === 'popular' ? 'total_chats' : 'name',
      sortOrder: sortBy === 'name' ? 'asc' : 'desc'
    }));
    
    if (!window.serverData?.agents) {
      fetchAgents(page, search, filterOptions);
    }
  }, [location]);

  // Debounced search function
  const debouncedSearch = useMemo(
    () => debounce((query: string) => {
      fetchAgents(1, query, filterOptions);
    }, 500),
    [filterOptions]
  );

  // Fetch agents from backend
  const fetchAgents = async (page: number, query: string, filters: FilterOptions) => {
    try {
      setLoading(true);
      setError(null);

      const sortField = filters.sortBy === 'recent' ? 'last_activity' :
      filters.sortBy === 'popular' ? 'total_chats' :
      'name';

      const params = new URLSearchParams({
        page: page.toString(),
        limit: AGENTS_PER_PAGE.toString(),
        search: query,
        sortBy: sortField,
        sortOrder: filters.sortBy === 'name' ? 'asc' : 'desc',
          ...(filters.category && { category: filters.category })
      });

      const response = await fetch(`/api/agents?${params}`);
      if (!response.ok) throw new Error('Failed to fetch agents');

      const data = await response.json();
      
      setAgents(data.agents);
      setPagination({
        total: data.total,
        page: data.page,
        limit: AGENTS_PER_PAGE,
        pages: Math.ceil(data.total / AGENTS_PER_PAGE)
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      toast.error('Failed to load agents');
    } finally {
      setLoading(false);
    }
  };

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    fetchAgents(newPage, searchQuery, filterOptions);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
    
    // Update URL with search query
    const url = new URL(window.location.href);
    const currentParams = new URLSearchParams(url.search);
    if (query) {
      currentParams.set('search', query);
    } else {
      currentParams.delete('search');
    }
    
    // Preserve other filters
    if (filterOptions.sortBy) {
      currentParams.set('sortBy', filterOptions.sortBy);
    }
    
    setLocation(`${location.pathname}?${currentParams.toString()}`);
    debouncedSearch(query);
  };

  // Handle filter change
  const handleFilterChange = (options: FilterOptions) => {
    setFilterOptions(prev => {
      const newOptions = { ...prev, ...options };
      fetchAgents(1, searchQuery, newOptions);
      return newOptions;
    });
    setCurrentPage(1);
  };

  // Initial fetch on mount
  useEffect(() => {
    if (!window.serverData?.agents) {
      fetchAgents(currentPage, searchQuery, filterOptions);
    }
  }, []);

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

        {error && (
          <div className="text-center py-12">
            <p className="text-red-500 text-lg">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto" />
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No Mements found matching your criteria</p>
          </div>
        ) : (
          <MementGrid 
            mements={agents}
            pagination={pagination}
            onPageChange={handlePageChange}
          />
        )}
      </div>
    </div>
  );
}

// Utility function for debouncing
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
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
