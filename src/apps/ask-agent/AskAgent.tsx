import React, { useState, useContext } from 'react';
import { Toaster, toast } from 'sonner';

const AppContext = React.createContext({
  inputValue: '',
  setInputValue: (value) => {},
  handleSubmit: (content) => {},
  isLoading: false
});

/*
todo: rewrite this page to become ShowAskAgent where the question and answers are already present on /chat/$id page so we just render them and show button to ask another question pointing to root / and button to share answer on twitter pointing to tweet if its present along with showing its tweet url or if its not present just pointing to twitter posting like this



and the overall layout of question/response card should include all these fields as in this example

-const ResponseDisplay = React.forwardRef<
-    HTMLDivElement,
-    { response: any; onReset: () => void; actionBar?: React.ReactNode; hideDefaultActions?: boolean }
->(
-    ({ response, onReset, actionBar, hideDefaultActions = false }, ref) => {
-        const [visible, setVisible] = useState(false);
-
-        useEffect(() => {
-            const timer = setTimeout(() => {
-                setVisible(true);
-            }, 300);
-            return () => clearTimeout(timer);
-        }, []);
-
-        const copyLink = async () => {
-            try {
-                const url = window.location.href;
-                if (navigator.clipboard && navigator.clipboard.writeText) {
-                    await navigator.clipboard.writeText(url);
-                    toast.success("Link copied to clipboard!");
-                    return;
-                }
-                const textarea = document.createElement("textarea");
-                textarea.value = url;
-                textarea.style.position = "fixed";
-                document.body.appendChild(textarea);
-                textarea.focus();
-                textarea.select();
-                try {
-                    document.execCommand("copy");
-                    textarea.remove();
-                    toast.success("Link copied to clipboard!");
-                } catch (err) {
-                    textarea.remove();
-                    toast.error("Failed to copy link. Please copy it manually.");
-                }
-            } catch (err) {
-                console.error("Sharing failed:", err);
-                toast.error("Failed to share. Please try copying the URL manually.");
-            }
-        };
-
-        return (
-            <div className={cls(styles.flexColumn, styles.flexCenter, "w-full")}>
-                <div
-                    ref={ref}
-                    className={cls(els.responseContainer, visible ? "animate-ios-like" : "opacity-0")}
-                >
-                    <div className={els.responseHeader}>
-                        <div className="text-neutral-200 text-sm sm:text-base">{response.question}</div>
-                    </div>
-                    <div className={els.responseContent}>
-                        <div className="flex gap-3 sm:gap-4 mb-3 items-center">
-                            <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full overflow-hidden ring-1 ring-neutral-800 flex-shrink-0">
-                                <img src={window.serverData.agentImage} alt={`chat${window.serverData.botName}`} className="w-full h-full object-cover" />
-                            </div>
-                            <div className="flex-1 flex items-center">
-                                <div className="flex flex-col justify-center">
-                                    <div className="text-neutral-50 font-bold leading-5 text-base sm:text-lg">
-                                        {window.serverData.botName}
-                                    </div>
-                                    <div className="text-neutral-500 text-sm">{window.serverData.botTag}</div>
-                                </div>
-                            </div>
-                        </div>
-                        <div className="mt-4 sm:mt-5">
-                            <div className="font-sans text-[16px] sm:text-[20px] leading-normal text-neutral-100 whitespace-pre-line">
-                                {response.content.split("\n").map((line, index) => (
-                                    <p key={index} className="mb-2">
-                                        {line}
-                                    </p>
-                                ))}
-                            </div>
-                        </div>
-                        <div className={els.responseMeta}>
-                            <div className="text-neutral-500 text-xs sm:text-sm">
-                                {new Date(response.timestamp).toLocaleTimeString([], {
-                                    hour: "numeric",
-                                    minute: "2-digit",
-                                    hour12: true,
-                                })}
-                            </div>
-                            <div className="text-neutral-600">┬╖</div>
-                            <div className="text-neutral-500 text-xs sm:text-sm">
-                                {new Date(response.timestamp).toLocaleDateString([], {
-                                    month: "short",
-                                    day: "numeric",
-                                    year: "numeric",
-                                })}
-                            </div>
-                        </div>
-                    </div>
-                    <div className="absolute bottom-0 right-0 select-none pointer-events-none">
-                        <div className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-neutral-900/95 to-neutral-950/95 backdrop-blur-[2px] border-t border-l border-neutral-800/30 rounded-tl-xl">
-                            <div className="flex items-center gap-1 sm:gap-1.5">
-                                <div className="text-neutral-400 text-[10px] sm:text-xs">Powered by</div>
-                                <div className="flex items-center">
-                                    <div className="font-bold text-neutral-200 text-[10px] sm:text-xs">Chat</div>
-                                    <div className="font-bold text-red-500 text-[10px] sm:text-xs">{window.serverData.botName}</div>
-                                </div>
-                            </div>
-                        </div>
-                    </div>
-                </div>
-            </div>
-        );
-    },
-);

*/

const AskAgent = () => {
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
      if (response.status === 400 && data.error) {
        toast.error(`Error: ${data.error}. ${data.details}`);
        return;
      }
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
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors animate-pulse"
        >
          {isLoading ? '...' : '→'}
        </button>
      </div>
    </form>
  );
};

export default GlassmorphicChat;