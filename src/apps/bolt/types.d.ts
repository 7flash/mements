
type StepIndicatorProps = {
  currentStep: number;
  totalSteps: number;
};

type StepHeaderProps = {
  currentStep: Step;
  data: MementData;
};

type HandleInputProps = {
  value: string;
  onChange: (value: string) => void;
};

type AgentType = 'chat' | 'terminal' | 'feed';

type TypeSelectionProps = {
  selected: AgentType | null;
  onSelect: (type: AgentType) => void;
};

type DescriptionInputProps = {
  location: string;
  purpose: string;
  onLocationChange: (value: string) => void;
  onPurposeChange: (value: string) => void;
};

export type MementData = {
    handle: string;
    type: 'chat' | 'terminal' | 'feed' | null;
    location: string;
    purpose: string;
  };
  
export type Step = 'handle' | 'type' | 'description';

type StepNavigationProps = {
currentStep: Step;
onBack: () => void;
onNext: () => void;
canProceed: boolean;
};

type UsernameInputProps = {
id: string;
value: string;
onChange: (value: string) => void;
placeholder?: string;
};

type LandingHeroProps = {
onProceed: () => void;
};

type AgentDescriptionFormProps = {
values: {
    name: string;
    location: string;
    purpose: string;
};
onChange: (field: string, value: string) => void;
onDeploy: () => void;
isDeploying: boolean;
};
  
type AgentType = 'chat' | 'terminal' | 'feed';

type AgentTypeCardProps = {
  type: AgentType;
  isSelected: boolean;
  disabled?: boolean;
  onClick: () => void;
};

type DeploymentSuccessProps = {
    agentUrl: string;
    onEdit: () => void;
  };

  export type AgentType = 'chat' | 'terminal' | 'feed'
  export type WorkflowType = 'answer-as-mement' | 'other-workflow'
  export type LinkType = 'twitter' | 'telegram'
  
  export interface Link {
    type: LinkType
    value: string
  }
  
  export interface TwitterBot {
    oauth_token: string
    oauth_token_secret: string
    user_id: string
    screen_name: string
  }
  
  export interface TelegramBot {
    bot_token: string
  }
  
  export interface Domain {
    domain: string
    custom_script_path: string
  }
  
  export interface AgentConfig {
    type: AgentType
    name: string
    description: string // New field
    subdomain: string
    context: string
    purpose: string
    titles: string[]
    suggestions: string[]
    prompt: string
    workflow: WorkflowType
    image: string
    links: Link[]
    twitterBot: TwitterBot
    telegramBot: TelegramBot
    domains: Domain[]
  }
  