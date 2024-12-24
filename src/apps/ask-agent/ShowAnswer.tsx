import React, { useState, useEffect } from 'react';
import { Toaster, toast } from 'sonner';
import { useLocation } from 'wouter';

const ShowAskAgent = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(true);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const navigateToHome = () => {
    window.location.href = '/';
  };

  return (
    <><div className="w-full max-w-3xl mt-8">
          <ResponseCard visible={visible} />
        </div>
        <ActionButtons />
        </>
  );
};

const ResponseCard = ({ visible }) => {
  const response = {
    question: decodeURIComponent(window.serverData.question),
    content: decodeURIComponent(window.serverData.content),
    timestamp: window.serverData.timestamp,
  };

  return (
    <div className={`bg-neutral-900/90 backdrop-blur-sm border border-neutral-800 rounded-2xl shadow-xl ${visible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="p-6 border-b border-neutral-800 view-transition-question">
        <div className="text-neutral-200 text-sm sm:text-base">{response.question}</div>
      </div>
      
      <div className="p-6">
        <div className="flex gap-3 sm:gap-4 mb-3 items-center">
          <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full overflow-hidden ring-1 ring-neutral-800 flex-shrink-0 view-transition-avatar">
            <img 
              src={window.serverData.agentImage} 
              alt={`chat${window.serverData.botName}`} 
              className="w-full h-full object-cover" 
            />
          </div>
          <div className="flex-1">
          <div className="view-transition-name-container">
            <div className="text-neutral-50 font-bold leading-5 text-base sm:text-lg view-transition-name">
              {window.serverData.botName}
            </div>
            </div>
            <div className="text-neutral-500 text-sm">{window.serverData.botTag}</div>
          </div>
        </div>

        <div className="mt-4 sm:mt-5">
          <div className="font-sans text-[16px] sm:text-[20px] leading-normal text-neutral-100 whitespace-pre-line">
            {response.content.split("\n").map((line, index) => (
              <p key={index} className="mb-2">{line}</p>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-6 text-neutral-500 text-xs sm:text-sm">
          <span>
            {new Date(response.timestamp).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            })}
          </span>
          <span>·</span>
          <span>
            {new Date(response.timestamp).toLocaleDateString([], {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>
      </div>

      {window.serverData.twitterPostLink && <div className="absolute bottom-0 right-0">
        <div className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-neutral-900/95 to-neutral-950/95 backdrop-blur-[2px] border-t border-l border-neutral-800/30 rounded-tl-xl">
          <div className="text-neutral-400 text-[10px] sm:text-xs">{window.serverData.twitterPostLink}</div>
        </div>
      </div>}
    </div>
  );
};

const ActionButtons = () => {
  const [,setLocation] = useLocation();

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied to clipboard!", {
        'closeButton': true,
      });
    } catch (err) {
      toast.error("Failed to copy link. Please copy it manually.", {
        'closeButton': true,
      });
    }
  };

  const handleShare = () => {
    const tweetUrl = window.serverData.twitterPostLink || 
      `https://twitter.com/intent/tweet?text=${window.serverData.content}`;
    window.open(tweetUrl, '_blank');
  };

  return (
    <div className="flex gap-4 mt-6">
      <button
        onClick={async () => {
          if (document.startViewTransition) {
            await document.startViewTransition(() => {
              setLocation(`/`);
            }).finished;
          } else {
            setLocation(`/`);
          }
        }}
        className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors cursor-pointer"
      >
        Ask Another Question
      </button>
      <button
        onClick={handleShare}
        className="px-6 py-3 bg-blue-500/80 hover:bg-blue-500 text-white rounded-xl transition-colors cursor-pointer"
      >
        Share on Twitter
      </button>
      <button
        onClick={handleCopyLink}
        className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors cursor-pointer"
      >
        Copy Link
      </button>
    </div>
  );
};

export default ShowAskAgent;
