import React, { useState, createContext, useContext, useMemo, useEffect } from 'react';
import { Bot, MessageSquare, Terminal, Rss, Zap, Check, ArrowLeft, ArrowRight } from 'lucide-react';
import { Link, Route, Switch, useLocation } from "wouter";
import Confetti from 'react-confetti';
import { Toaster, toast } from 'sonner';
import { Twitter } from 'lucide-react';

import assets from "#generated/assets.json";
import constants from "#generated/constants.json";
import Header from 'src/components/Header';
import Footer from 'src/components/Footer';

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
            <a className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-lg text-white hover:bg-white/20 transition-colors" href={`https://${mement.subdomain}.${constants.BASE_URL}`} target='_blank'>
                Visit →
            </a>
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
    
    // Update page number
    currentParams.set('page', newPage.toString());
    
    // Preserve all existing filters from window.serverData.filters
    if (window.serverData?.filters) {
      Object.entries(window.serverData.filters).forEach(([key, value]) => {
        if (value) {
          currentParams.set(key, value.toString());
        }
      });
    }
    
    // Update location with preserved filters
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

interface FilterOptions {
  sortBy: 'recent' | 'popular' | 'name';
  sortField: 'last_activity' | 'total_chats' | 'name';
  sortOrder: 'asc' | 'desc';
  category?: string;
  search?: string;
}

function SearchBar({ onSearch, initialValue = '' }: { onSearch: (query: string) => void, initialValue?: string }) {
  const [value, setValue] = useState(initialValue);

  return (
    <div className="relative w-full max-w-md">
      <input
        type="text"
        placeholder="Search..."
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          onSearch(e.target.value);
        }}
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

  const fetchAgents = useMemo(() => async (
    page: number,
    search: string,
    sortBy: FilterOptions['sortBy']
  ) => {
    try {
      setLoading(true);
      setError(null);

      const fetchParams = new URLSearchParams({
        page: page.toString(),
        limit: AGENTS_PER_PAGE.toString(),
        sortBy: sortBy === 'recent' ? 'last_activity' :
               sortBy === 'popular' ? 'total_chats' : 'name',
        sortOrder: sortBy === 'name' ? 'asc' : 'desc'
      });

      if (search) {
        fetchParams.set('search', search);
      }

      const response = await fetch(`/api/agents?${fetchParams}`);
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
      console.error(err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      // toast.error('Failed to load agents');
    } finally {
      setLoading(false);
    }
  }, []);

  const debouncedFetch = useMemo(
    () => debounce((query: string, options: FilterOptions) => {
      fetchAgents(1, query, options.sortBy);
      
      const newUrl = new URL(window.location.pathname, window.location.origin);
      const params = new URLSearchParams();
      
      if (query) params.set('search', query);
      params.set('sortBy', options.sortBy);
      params.set('page', '1');
      
      setLocation(`${newUrl.pathname}?${params.toString()}`);
    }, 500),
    []
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const page = parseInt(params.get('page') || '1');
    const searchParam = params.get('search') || '';
    const sortBy = (params.get('sortBy') as FilterOptions['sortBy']) || 'recent';

    // todo: fix here even though filter options set correctly but setting search query does not work when we have it like this in url http://localhost:3001/explore?sortBy=popular&search=super&page=1
    setCurrentPage(page);
    setSearchQuery(searchParam);
    setFilterOptions(prev => ({
      ...prev,
      sortBy,
      sortField: sortBy === 'recent' ? 'last_activity' : 
                 sortBy === 'popular' ? 'total_chats' : 'name',
      sortOrder: sortBy === 'name' ? 'asc' : 'desc'
    }));
  }, []);
  
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1); // Reset page on new search
    debouncedFetch(query, filterOptions);
  };

  const handleFilterChange = (options: FilterOptions) => {
    setFilterOptions(options);
    setCurrentPage(1);
    
    fetchAgents(1, searchQuery, options.sortBy);
    
    const newUrl = new URL(window.location.pathname, window.location.origin);
    const params = new URLSearchParams();
    
    params.set('sortBy', options.sortBy);
    if (searchQuery) params.set('search', searchQuery);
    params.set('page', '1');
    
    setLocation(`${newUrl.pathname}?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    fetchAgents(newPage, searchQuery, filterOptions.sortBy);
    
    const newUrl = new URL(window.location.pathname, window.location.origin);
    const params = new URLSearchParams();
    
    params.set('page', newPage.toString());
    if (searchQuery) params.set('search', searchQuery);
    params.set('sortBy', filterOptions.sortBy);
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setLocation(`${newUrl.pathname}?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        <div className="flex flex-col gap-6 mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Explore Memetic Agents
          </h1>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <SearchBar onSearch={handleSearch} initialValue={searchQuery} />
          <FilterBar onFilterChange={handleFilterChange} initialValue={filterOptions.sortBy} />
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

type DebouncedFunction<T extends (...args: any[]) => any> = {
  (...args: Parameters<T>): void;
  cancel?: () => void;
}

// Improved debounce implementation with cancel functionality
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): DebouncedFunction<T> {
  let timeout: NodeJS.Timeout;
  
  const debounced: DebouncedFunction<T> = (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };

  debounced.cancel = () => {
    clearTimeout(timeout);
  };

  return debounced;
}

function App() {
  return (
    <AgentProvider>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <div className="flex-grow">
          <ExplorePage />
        </div>
        <Footer />
      </div>
    </AgentProvider>
  );
}

export default App;
