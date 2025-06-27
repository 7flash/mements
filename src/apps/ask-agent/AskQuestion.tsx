import React, { useState, useContext, useRef } from 'react';
import { toast } from 'sonner';
import { useLocation } from 'wouter';

interface AppContextType {
  inputValue: string;
  setInputValue: (value: string) => void;
  handleSubmit: (content: string, file?: File) => void;
  isLoading: boolean;
}

const AppContext = React.createContext<AppContextType>({
  inputValue: '',
  setInputValue: (value: string) => {},
  handleSubmit: (content: string, file?: File) => {},
  isLoading: false
});

export default function() {
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();

  const handleSubmit = async (content: string, file?: File) => {
    try {
      setIsLoading(true);
      const formData = new FormData();
      formData.append('content', content);
      if (file) {
        formData.append('file', file);
      }

      const response = await fetch('/api/ask-agent', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      
      if (response.status === 200 && data.chatId) {
        window.serverData = {
          ...window.serverData,
          ...data,
        };
        if (document.startViewTransition) {
          await document.startViewTransition(() => {
            setLocation(`/chat/${data.chatId}`);
          }).finished;
        } else {
          setLocation(`/chat/${data.chatId}`);
        }
      } else if (response.status === 422 && data.error) {
        toast.error(`Question cannot be answered`, {
          'description': data.error,
          'closeButton': true,
        });
        return;
      } else {
        throw `${data.error || 'Unknown error'}`;
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
      <style>
        {`
          @keyframes sinkDown {
            0% { transform: translateY(0); opacity: 1; }
            100% { transform: translateY(20px); opacity: 0; }
          }
          
          .loading-animation {
            animation: sinkDown 1s ease-in-out infinite;
          }
        `}
      </style>
      <div className="flex flex-col items-center mt-8 sm:mt-16 space-y-8 sm:space-y-12 px-6 sm:px-8 max-w-6xl mx-auto">
        <Avatar />
        <Header />
        <ChatInput />
      </div>
    </AppContext.Provider>
  );
};

const Avatar = () => (
  <div className="relative w-32 h-32 sm:w-48 sm:h-48 rounded-full overflow-hidden border-8 border-white/20 shadow-2xl view-transition-avatar">
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
    <div className="text-left w-full max-w-4xl">
      <div className="flex flex-col items-center bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-xl p-6 sm:p-8">
        <div className="view-transition-name-container">
          {!window.serverData.customInfo && (
            <span className="text-3xl sm:text-5xl font-bold text-white mb-4 font-geohumanist-sans view-transition-name tracking-tight">
              {capitalizeFirstLetter(window.serverData.botName)}
            </span>
          )}
          <div className="text-white/80 font-mono text-base sm:text-xl leading-relaxed whitespace-pre-wrap break-words">
            {renderInfo()}
          </div>
        </div>
      </div>
    </div>
  );
};

const ChatInput = () => {
  const { inputValue, setInputValue, handleSubmit, isLoading } = useContext(AppContext);
  const [dragActive, setDragActive] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // todo: when i drop image it should automatically submit form
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files?.[0]) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        setImageFile(file);
        handleSubmit(inputValue, file);
      } else {
        toast.error('Only image files are allowed');
      }
    }
  };

  const removeImage = () => {
    setImageFile(null);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() && !imageFile) return;
    handleSubmit(inputValue, imageFile || undefined);
    setImageFile(null);
  };

  return (
    <form onSubmit={onSubmit} className="w-full max-w-4xl">
      <div 
        className={`relative view-transition-question-container ${dragActive ? 'border-white/40' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {imageFile && (
          <div className={`absolute left-4 top-1/2 -translate-y-1/2 flex items-center ${isLoading ? 'animate-sink' : ''}`}>
            <div className="relative w-8 h-8">
              <img 
                src={URL.createObjectURL(imageFile)} 
                alt="Preview" 
                className="w-full h-full object-cover rounded"
              />
              <button
                type="button"
                onClick={removeImage}
                className="absolute -top-2 -right-2 bg-white/10 rounded-full p-1 text-white/80 hover:text-white"
              >
                ×
              </button>
            </div>
          </div>
        )}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className={`w-full px-6 sm:px-8 py-4 sm:py-6 text-lg sm:text-xl text-white bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-xl focus:outline-none focus:border-white/40 transition-all view-transition-question ${imageFile ? 'pl-16' : ''} ${isLoading ? 'animate-content-sink' : ''}`}
          placeholder={window.serverData.links['input_placeholder'] ?? 'Tell me anything... or drop an image'}
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading}
          className={`absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 text-white/80 hover:text-white transition-colors text-xl sm:text-2xl ${isLoading ? 'animate-loading' : ''}`}
        >
          {isLoading ? (
            <div className="loading-dots">
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
            </div>
          ) : '→'}
        </button>
      </div>
      <style jsx>{`
        @keyframes sink {
          0% { transform: translateY(-50%); opacity: 1; }
          100% { transform: translateY(100%); opacity: 0; }
        }

        @keyframes content-sink {
          0% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(20px); opacity: 0.5; }
        }

        @keyframes loading-dots {
          0%, 80%, 100% { opacity: 0; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }

        .animate-sink {
          animation: sink 0.5s ease-in forwards;
        }

        .animate-content-sink {
          animation: content-sink 0.5s ease-in forwards;
        }

        .loading-dots {
          display: flex;
          gap: 4px;
        }

        .dot {
          width: 6px;
          height: 6px;
          background-color: white;
          border-radius: 50%;
          display: inline-block;
          animation: loading-dots 1.4s infinite ease-in-out both;
        }

        .dot:nth-child(1) { animation-delay: -0.32s; }
        .dot:nth-child(2) { animation-delay: -0.16s; }
        .dot:nth-child(3) { animation-delay: 0s; }
      `}</style>      
    </form>
  );
};
