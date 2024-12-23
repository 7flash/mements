import React, { useState, createContext, useContext, useMemo } from 'react';
import { Bot, MessageSquare, Terminal, Rss, Zap, Check, ArrowLeft, ArrowRight } from 'lucide-react';
import { Link, Route, Switch, useLocation } from "wouter";
import Confetti from 'react-confetti';
import { Toaster, toast } from 'sonner';

import assets from "#generated/assets.json";
import constants from "#generated/constants.json";

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

export function StepHeader({ currentStep, data }: StepHeaderProps) {
  if (currentStep === 'handle') return null;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-gray-500">Creating Mement</p>
        <div className="flex items-center space-x-1">
          <span className={`h-2 w-2 rounded-full ${currentStep === 'type' ? 'bg-purple-600' : 'bg-purple-200'}`} />
          <span className={`h-2 w-2 rounded-full ${currentStep === 'description' ? 'bg-purple-600' : 'bg-purple-200'}`} />
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <p className="text-lg font-medium text-gray-900">@{data.handle}</p>
        {currentStep === 'description' && data.type === 'chat' && (
          <div className="flex items-center gap-1 px-2 py-1 bg-purple-100 rounded-full">
            <MessageSquare className="w-4 h-4 text-purple-600" />
            <span className="text-sm text-purple-600 font-medium">Chat</span>
          </div>
        )}
      </div>
    </div>
  );
}

function HandleInput({ value, onChange }: HandleInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .replace(/^[^a-z]+/, '');
    onChange(newValue);
  };

  return (
    <div className="text-center">
      <Bot className="w-12 h-12 text-purple-600 mx-auto mb-4" />
      <h2 className="text-2xl font-bold mb-2">Choose Your Mement Handle</h2>
      <p className="text-gray-600 mb-8">This will be used to generate your Meme Agent's unique identifier</p>
      
      <div className="max-w-md mx-auto">
        <div className="flex rounded-lg shadow-sm">
          <span className="inline-flex items-center px-4 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-lg">
            @
          </span>
          <input
            type="text"
            value={value}
            onChange={handleChange}
            className="flex-1 block w-full px-4 py-3 rounded-r-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-lg"
            placeholder="oracle" // todo: we should replace oracle to kind of more generic santa claus and as well his location and purpose
          />
        </div>
        {value && value.length < 3 && (
          <p className="mt-2 text-sm text-gray-500">Handle must be at least 3 characters long</p>
        )}
      </div>
    </div>
  );
}

const agentTypes = [
  {
    id: 'chat',
    icon: MessageSquare,
    title: 'Chat',
    description: 'Interactive conversational agent',
    disabled: false
  },
  {
    id: 'terminal',
    icon: Terminal,
    title: 'Terminal',
    description: 'Command-line interface agent',
    disabled: true
  },
  {
    id: 'feed',
    icon: Rss,
    title: 'Feed',
    description: 'Content stream processing agent',
    disabled: true
  }
] as const;

export function TypeSelection({ selected, onSelect }: TypeSelectionProps) {
  return (
    <div className="text-center">
      <h2 className="text-2xl font-bold mb-2">Choose Your Mement Type</h2>
      <p className="text-gray-600 mb-8">Select how your Meme Agent will interact</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {agentTypes.map(({ id, icon: Icon, title, description, disabled }) => (
          <button
            key={id}
            onClick={() => !disabled && onSelect(id)}
            disabled={disabled}
            className={`p-6 rounded-lg border-2 transition-all ${
              selected === id
                ? 'border-purple-600 bg-purple-50 cursor-pointer'
                : disabled
                ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                : 'border-gray-200 hover:border-purple-400 hover:bg-purple-50 cursor-pointer'
            }`}
          >
            <div className="flex flex-col items-center text-center">
              <Icon
                size={32}
                className={selected === id ? 'text-purple-600' : disabled ? 'text-gray-400' : 'text-gray-600'}
              />
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-gray-600">{description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function DescriptionInput({
  location,
  purpose,
  onLocationChange,
  onPurposeChange
}: DescriptionInputProps) {
  return (
    <div className="text-center">
      <h2 className="text-2xl font-bold mb-2">Describe Your Mement</h2>
      <p className="text-gray-600 mb-8">Give your Meme Agent context and purpose</p>

      <div className="space-y-6">
        <div>
          <label htmlFor="location" className="block text-sm font-medium text-gray-700 text-left mb-1">
            Location/Context
          </label>
          <input
            type="text"
            id="location"
            value={location}
            onChange={(e) => onLocationChange(e.target.value)}
            className="block w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            placeholder="City of Wisdom, 2030 AD"
          />
        </div>

        <div>
          <label htmlFor="purpose" className="block text-sm font-medium text-gray-700 text-left mb-1">
            Purpose/Behavior
          </label>
          <textarea
            id="purpose"
            value={purpose}
            onChange={(e) => onPurposeChange(e.target.value)}
            rows={4}
            className="block w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            placeholder="Provides wisdom and guidance through parables and teaching, focusing on daily practical advice"
          />
        </div>
      </div>
    </div>
  );
}

function StepNavigation({ currentStep, onBack, onNext, canProceed }: StepNavigationProps) {
  return (
    <div className="flex justify-between mt-8">
      {currentStep !== 'handle' && (
        <button onClick={onBack} className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors cursor-pointer">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </button>
      )}
      {currentStep !== 'description' && (
        <button onClick={onNext} disabled={!canProceed} className={`ml-auto flex items-center px-6 py-2 rounded-md cursor-pointer ${
          canProceed ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
        } transition-colors`}>
          Next
          <ArrowRight className="w-4 h-4 ml-2" />
        </button>
      )}
    </div>
  );
}

function CreateMementForm() {
  const [currentStep, setCurrentStep] = useState<Step>('handle');
  const [data, setData] = useState<MementData>({ handle: '', type: null, location: '', purpose: '' });
  const { updateAgentConfig } = useAgent();
  const [location, setLocation] = useLocation();
  const [isDeploying, setIsDeploying] = useState(false);

  const updateField = <K extends keyof MementData>(field: K, value: MementData[K]) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (currentStep === 'handle') setCurrentStep('type');
    else if (currentStep === 'type') setCurrentStep('description');
  };

  const handleBack = () => {
    if (currentStep === 'type') setCurrentStep('handle');
    else if (currentStep === 'description') setCurrentStep('type');
  };

  const canProceed = 
    (currentStep === 'handle' && data.handle.length >= 3) ||
    (currentStep === 'type' && data.type === 'chat') ||
    (currentStep === 'description' && data.location && data.purpose);

  const handleDeploy = async () => {
    setIsDeploying(true);
    try {
      const response = await fetch('/api/create-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: data.handle,
          type: data.type,
          location: data.location,
          purpose: data.purpose,
        }),
      });

      const result = await response.json();

      if (response.status == 500) {
        throw `${result?.error}`
      }

      updateAgentConfig({ subdomain: result.subdomain });
      setLocation('/success');
    } catch (error) {
      toast.error(`${error}`);
    } finally {
      setIsDeploying(false);
    }
  };

  if (isDeploying) {
    return <DeployProgress />;
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <StepHeader currentStep={currentStep} data={data} />
      <div className="bg-white rounded-xl shadow-lg p-8">
        {/* pressing enter should work at this step as alternative to pressing Next button with a cursor */}
        {currentStep === 'handle' && (
          <HandleInput value={data.handle} onChange={(value) => updateField('handle', value)} />
        )}
        {currentStep === 'type' && (
          <TypeSelection selected={data.type} onSelect={(type) => updateField('type', type)} />
        )}
        {currentStep === 'description' && (
          <>
            <DescriptionInput
              location={data.location}
              purpose={data.purpose}
              onLocationChange={(value) => updateField('location', value)}
              onPurposeChange={(value) => updateField('purpose', value)}
            />
            {/* todo: in this case we still should use StepNavigation and render Deploy memetn button inside of otherwise it renders here in a separate row */}
            <div className="flex justify-between mt-8">
                <button onClick={handleDeploy} disabled={!canProceed} className={`ml-auto flex items-center px-6 py-2 rounded-md cursor-pointer ${
                  canProceed ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                } transition-colors`}>
                  Deploy Mement
                  <ArrowRight className="w-4 h-4 ml-2" />
                </button>
            </div>
          </>
        )}
        <StepNavigation currentStep={currentStep} onBack={handleBack} onNext={handleNext} canProceed={canProceed} />
      </div>
    </div>
  );
}

function DeployProgress() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="space-y-6">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <h2 className="mt-4 text-xl font-semibold text-gray-900">Deploying Your Agent</h2>
              <p className="mt-2 text-sm text-gray-500 text-center">
                Please wait while we create and configure your agent...
              </p>
            </div>
            
            {/* todo: must ensure this animation is not repeating over and over again but rather just moving slowly towards the end in period of 10 seconds or so slowing down closer towards the end */}
            <div className="space-y-3">
              <div className="bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="bg-blue-600 h-2 rounded-full animate-progress"
                  style={{
                    animation: 'progress 2s ease-in-out infinite',
                    width: '0%'
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes progress {
          0% { width: 0% }
          100% { width: 100% }
        }
        .animate-progress {
          animation: progress 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

function LandingHero({ onProceed }: LandingHeroProps) {
  return (
    <div className="text-center max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-4xl sm:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-blue-600 mb-6">
        Deploy AI Agents with Ease
      </h1>
      <p className="text-lg text-gray-600 mb-12">
        Create, manage, and scale your AI personalities effortlessly. Bring your Mements to life with our cutting-edge deployment platform.
      </p>
      <button
        onClick={onProceed}
        className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-purple-500 to-blue-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity mb-16 cursor-pointer"
      >
        Create New Mement
      </button>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
        <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
          {/* todo: fix its still aligned to left size but must be in middle */}
          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
            <Bot className="w-6 h-6 text-purple-600" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Self-evolving</h3>
          <p className="text-gray-600">Mements believe to have spontaneous thoughts, not just acting as assistants.</p>
        </div>
        <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
            <Zap className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Self-initiative</h3>
          <p className="text-gray-600">Capable of posting automatically to their own Twitter accounts and leading Telegram channels.</p>
        </div>
        <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
            <Check className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Self-sustainable</h3>
          <p className="text-gray-600">Launch fair tokens supported by the community to pay electricity bills and share dividends of their success back to supporters.</p>
        </div>
      </div>
    </div>
  );
}

function DeploymentSuccess() {
  const { agentConfig } = useAgent();
  const agentUrl = `https://${agentConfig.subdomain}.${constants.BASE_URL}`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      {/* it should not be continous overwhelming confetti just short burst */}
      <Confetti />
      <div className="text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
          <Check className="h-6 w-6 text-green-600" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Agent Successfully Deployed!</h3>
        <p className="text-sm text-gray-500 mb-6">Your agent is now live and ready to interact</p>
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <p className="text-sm font-medium text-gray-700 mb-2">Agent URL:</p>
          <a href={agentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 break-all">
            {agentUrl}
          </a>
        </div>
        <a href={agentUrl} target="_blank" rel="noopener noreferrer" className="px-4 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors cursor-pointer">
          Go to Agent
        </a>
      </div>
    </div>
  );
}

function App() {
  const [location, setLocation] = useLocation();
  
  return (
    <AgentProvider>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <Switch>
          <Route path="/">
            <LandingHero onProceed={() => setLocation('/create')} />
          </Route>
          <Route path="/create">
            <CreateMementForm />
          </Route>
          <Route path="/success">
            <DeploymentSuccess />
          </Route>
        </Switch>
        <Toaster richColors />
      </div>
    </AgentProvider>
  );
}

export default App;