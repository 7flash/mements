import React from 'react';
import { Header } from './components/Layout/Header';
import { CreateMementForm } from './components/CreateMement/CreateMementForm';

import { Bot } from 'lucide-react';
import { MessageSquare, Terminal, Rss } from 'lucide-react';
import { Zap, Bot } from 'lucide-react';

// todo: define navigation routes as normally for all our pages/steps
import { Link, Route, Switch, useLocation } from "wouter";

export function Navigation() {
  const links = [
    { name: 'Dashboard', href: '#' },
    { name: 'Agents', href: '#' },
    { name: 'Analytics', href: '#' },
  ];

  return (
    <nav className="hidden sm:ml-6 sm:flex sm:space-x-8">
      {links.map((link) => (
        <a
          key={link.name}
          href={link.href}
          className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-900"
        >
          {link.name}
        </a>
      ))}
    </nav>
  );
}

function AgentDescriptionForm({ values, onChange, onDeploy, isDeploying }: AgentDescriptionFormProps) {
  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Mement Handle
        </label>
        <UsernameInput
          id="name"
          value={values.name}
          onChange={(value) => onChange('name', value)}
          placeholder="jesus"
        />
        <p className="mt-1 text-sm text-gray-500">Choose a unique identifier for your Mement</p>
      </div>

      <div>
        <label htmlFor="location" className="block text-sm font-medium text-gray-700">
          Location/Context
        </label>
        <input
          type="text"
          id="location"
          value={values.location}
          onChange={(e) => onChange('location', e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="Ancient Jerusalem, 30 AD"
        />
        <p className="mt-1 text-sm text-gray-500">Describe where and when your Mement exists</p>
      </div>

      <div>
        <label htmlFor="purpose" className="block text-sm font-medium text-gray-700">
          Purpose/Behavior
        </label>
        <textarea
          id="purpose"
          value={values.purpose}
          onChange={(e) => onChange('purpose', e.target.value)}
          rows={4}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="Provides wisdom and guidance through parables and teachings, focusing on love, forgiveness, and spiritual growth"
        />
        <p className="mt-1 text-sm text-gray-500">Describe what your Mement does and how it behaves</p>
      </div>

      <div className="mt-8">
        <button
          onClick={onDeploy}
          disabled={isDeploying || !values.name || !values.location || !values.purpose}
          className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {isDeploying ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Deploying Mement...
            </>
          ) : (
            'Create Mement'
          )}
        </button>
      </div>
    </div>
  );
}

function AgentDetailsForm({ values, onChange }: AgentDetailsFormProps) {
  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Agent Name
        </label>
        <input
          type="text"
          id="name"
          value={values.name}
          onChange={(e) => onChange('name', e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="e.g., Jesus"
        />
      </div>

      <div>
        <label htmlFor="subdomain" className="block text-sm font-medium text-gray-700">
          Subdomain
        </label>
        <input
          type="text"
          id="subdomain"
          value={values.subdomain}
          onChange={(e) => onChange('subdomain', e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="e.g., jesus-ai-Lm0B"
        />
      </div>

      <div>
        <label htmlFor="prompt" className="block text-sm font-medium text-gray-700">
          Prompt
        </label>
        <textarea
          id="prompt"
          value={values.prompt}
          onChange={(e) => onChange('prompt', e.target.value)}
          rows={4}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="When X were walking around Y, he heard the voice asking him given question, and what might have been his response?"
        />
      </div>

      <div>
        <label htmlFor="workflow" className="block text-sm font-medium text-gray-700">
          Workflow
        </label>
        <select
          id="workflow"
          value={values.workfloAw}
          onChange={(e) => onChange('workflow', e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
          <option value="answer-as-mement">Answer as Mement</option>
          <option value="custom">Custom</option>
        </select>
      </div>
    </div>
  );
}

export function Header() {
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center gap-2">
              <Bot className="w-6 h-6 text-purple-600" />
              <span className="text-xl font-bold text-gray-900">Mements</span>
            </div>
            <Navigation />
          </div>
          <div className="flex items-center">
            <button className="ml-4 px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900">
              Profile
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

function StepIndicator({ currentStep, totalSteps }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center space-x-4 mb-8">
      {Array.from({ length: totalSteps }).map((_, index) => (
        <React.Fragment key={index}>
          <div className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                index < currentStep
                  ? 'bg-blue-600 text-white'
                  : index === currentStep
                  ? 'bg-blue-100 border-2 border-blue-600 text-blue-600'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {index < currentStep ? (
                <Check size={16} />
              ) : (
                <span>{index + 1}</span>
              )}
            </div>
            <span className="ml-2 text-sm text-gray-600">
              {index === 0 ? 'Type' : index === 1 ? 'Details' : 'Review'}
            </span>
          </div>
          {index < totalSteps - 1 && (
            <div
              className={`h-0.5 w-12 ${
                index < currentStep ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
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
      <p className="text-gray-600 mb-8">This will be your Mement's unique identifier</p>
      
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
            placeholder="jesus"
          />
        </div>
        {value && value.length < 3 && (
          <p className="mt-2 text-sm text-gray-500">Handle must be at least 3 characters long</p>
        )}
      </div>
    </div>
  );
}


const agentTypeConfig = {
  chat: {
    icon: MessageSquare,
    title: 'Chat',
    description: 'Interactive conversational agent',
  },
  terminal: {
    icon: Terminal,
    title: 'Terminal',
    description: 'Command-line interface agent',
  },
  feed: {
    icon: Rss,
    title: 'Feed',
    description: 'Content stream processing agent',
  },
};

const types = [
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

function DeploymentSuccess({ agentUrl, onEdit }: DeploymentSuccessProps) {
  return (
    <div className="text-center">
      <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
        <Check className="h-6 w-6 text-green-600" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">Agent Successfully Deployed!</h3>
      <p className="text-sm text-gray-500 mb-6">Your agent is now live and ready to interact</p>
      
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <p className="text-sm font-medium text-gray-700 mb-2">Agent URL:</p>
        <a
          href={agentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 break-all"
        >
          {agentUrl}
        </a>
      </div>

      <button
        onClick={onEdit}
        className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        Edit Agent Configuration
      </button>
    </div>
  );
}

function AgentTypeCard({ type, isSelected, disabled = false, onClick }: AgentTypeCardProps) {
  const config = agentTypeConfig[type];
  const Icon = config.icon;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`p-6 rounded-lg border-2 transition-all w-full ${
        isSelected
          ? 'border-blue-600 bg-blue-50'
          : disabled
          ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
          : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50'
      }`}
    >
      <div className="flex flex-col items-center text-center">
        <Icon
          size={32}
          className={isSelected ? 'text-blue-600' : disabled ? 'text-gray-400' : 'text-gray-600'}
        />
        <h3 className="mt-4 font-semibold">{config.title}</h3>
        <p className="mt-2 text-sm text-gray-600">{config.description}</p>
      </div>
    </button>
  );
}

export function TypeSelection({ selected, onSelect }: TypeSelectionProps) {
  return (
    <div className="text-center">
      <h2 className="text-2xl font-bold mb-2">Choose Your Mement Type</h2>
      <p className="text-gray-600 mb-8">Select how your Mement will interact</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {types.map(({ id, icon: Icon, title, description, disabled }) => (
          <button
            key={id}
            onClick={() => !disabled && onSelect(id)}
            disabled={disabled}
            className={`p-6 rounded-lg border-2 transition-all ${
              selected === id
                ? 'border-purple-600 bg-purple-50'
                : disabled
                ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                : 'border-gray-200 hover:border-purple-400 hover:bg-purple-50'
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
      <p className="text-gray-600 mb-8">Give your Mement context and purpose</p>

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
            placeholder="Ancient Jerusalem, 30 AD"
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
            placeholder="Provides wisdom and guidance through parables and teachings, focusing on love, forgiveness, and spiritual growth"
          />
        </div>
      </div>
    </div>
  );
}

function UsernameInput({ id, value, onChange, placeholder }: UsernameInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.toLowerCase()
      .replace(/[^a-z0-9_]/g, '') // Only allow lowercase letters, numbers, and underscore
      .replace(/^[^a-z]+/, ''); // Must start with a letter
    onChange(newValue);
  };

  return (
    <div className="mt-1 flex rounded-md shadow-sm">
      <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
        @
      </span>
      <input
        type="text"
        id={id}
        value={value}
        onChange={handleChange}
        className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-md border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
        placeholder={placeholder}
      />
    </div>
  );
}

function StepNavigation({ currentStep, onBack, onNext, canProceed }: StepNavigationProps) {
  return (
    <div className="flex justify-between mt-8">
      {currentStep !== 'handle' && (
        <button
          onClick={onBack}
          className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </button>
      )}
      {currentStep !== 'description' && (
        <button
          onClick={onNext}
          disabled={!canProceed}
          className={`ml-auto flex items-center px-6 py-2 rounded-md ${
            canProceed
              ? 'bg-purple-600 text-white hover:bg-purple-700'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          } transition-colors`}
        >
          Next
          <ArrowRight className="w-4 h-4 ml-2" />
        </button>
      )}
    </div>
  );
}

export function CreateMementForm() {
  const [currentStep, setCurrentStep] = useState<Step>('handle');
  const [data, setData] = useState<MementData>({
    handle: '',
    type: null,
    location: '',
    purpose: '',
  });

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

  const handleDeploy = () => {
    // Handle deployment logic
    console.log('Deploying:', data);
  };

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <StepHeader currentStep={currentStep} data={data} />
      
      <div className="bg-white rounded-xl shadow-lg p-8">
        {currentStep === 'handle' && (
          <HandleInput 
            value={data.handle}
            onChange={(value) => updateField('handle', value)}
          />
        )}

        {currentStep === 'type' && (
          <TypeSelection
            selected={data.type}
            onSelect={(type) => updateField('type', type)}
          />
        )}

        {currentStep === 'description' && (
          <>
            <DescriptionInput
              location={data.location}
              purpose={data.purpose}
              onLocationChange={(value) => updateField('location', value)}
              onPurposeChange={(value) => updateField('purpose', value)}
            />
            {canProceed && (
              <button
                onClick={handleDeploy}
                className="w-full mt-8 px-4 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
              >
                Deploy Mement
              </button>
            )}
          </>
        )}

        <StepNavigation
          currentStep={currentStep}
          onBack={handleBack}
          onNext={handleNext}
          canProceed={canProceed}
        />
      </div>
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
        Create, manage, and scale your AI personalities effortlessly. Bring your
        Mements to life with our cutting-edge deployment platform.
      </p>

{/* todo: do not need input field here, just a get started (create mement button) leading to the form */}
      <div className="mb-12">
        <textarea
          placeholder="Paste your Mement configuration here..."
          className="w-full h-32 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
        />
      </div>

      <button
        onClick={onProceed}
        className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-purple-500 to-blue-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity mb-16"
      >
        Create New Mement
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
            <Bot className="w-6 h-6 text-purple-600" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Intelligent Mements</h3>
          <p className="text-gray-600">
            Deploy state-of-the-art AI personalities with ease
          </p>
        </div>
        <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
            <Zap className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Lightning Fast</h3>
          <p className="text-gray-600">
            Optimized infrastructure for rapid deployment and scaling
          </p>
        </div>
      </div>
    </div>
  );
}

// todo: show landing first
function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <CreateMementForm />
    </div>
  );
}

export default App;