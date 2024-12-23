import React from 'react';
import { Toaster, toast } from 'sonner';

const ShowAskAgent = ({ response }) => {
  const copyLink = async () => {
    try {
      const url = window.location.href;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied to clipboard!");
        return;
      }
      const textarea = document.createElement("textarea");
      textarea.value = url;
      textarea.style.position = "fixed";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        document.execCommand("copy");
        textarea.remove();
        toast.success("Link copied to clipboard!");
      } catch (err) {
        textarea.remove();
        toast.error("Failed to copy link. Please copy it manually.");
      }
    } catch (err) {
      console.error("Sharing failed:", err);
      toast.error("Failed to share. Please try copying the URL manually.");
    }
  };

  const tweetUrl = response.tweetUrl || `https://twitter.com/intent/tweet?text=${encodeURIComponent(response.content)}`;

  return (
    <div className="flex flex-col items-center w-full">
      <div className="response-container animate-ios-like">
        <div className="response-header">
          <div className="text-neutral-200 text-sm sm:text-base">{response.question}</div>
        </div>
        <div className="response-content">
          <div className="flex gap-3 sm:gap-4 mb-3 items-center">
            <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full overflow-hidden ring-1 ring-neutral-800 flex-shrink-0">
              <img src={window.serverData.agentImage} alt={`chat${window.serverData.botName}`} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 flex items-center">
              <div className="flex flex-col justify-center">
                <div className="text-neutral-50 font-bold leading-5 text-base sm:text-lg">
                  {window.serverData.botName}
                </div>
                <div className="text-neutral-500 text-sm">{window.serverData.botTag}</div>
              </div>
            </div>
          </div>
          <div className="mt-4 sm:mt-5">
            <div className="font-sans text-[16px] sm:text-[20px] leading-normal text-neutral-100 whitespace-pre-line">
              {response.content.split("\n").map((line, index) => (
                <p key={index} className="mb-2">
                  {line}
                </p>
              ))}
            </div>
          </div>
          <div className="response-meta">
            <div className="text-neutral-500 text-xs sm:text-sm">
              {new Date(response.timestamp).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })}
            </div>
            <div className="text-neutral-600">┬╖</div>
            <div className="text-neutral-500 text-xs sm:text-sm">
              {new Date(response.timestamp).toLocaleDateString([], {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 right-0 select-none pointer-events-none">
          <div className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-neutral-900/95 to-neutral-950/95 backdrop-blur-[2px] border-t border-l border-neutral-800/30 rounded-tl-xl">
            <div className="flex items-center gap-1 sm:gap-1.5">
              <div className="text-neutral-400 text-[10px] sm:text-xs">Powered by</div>
              <div className="flex items-center">
                <div className="font-bold text-neutral-200 text-[10px] sm:text-xs">Chat</div>
                <div className="font-bold text-red-500 text-[10px] sm:text-xs">{window.serverData.botName}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex mt-4 space-x-4">
        <button onClick={() => window.location.href = '/'} className="px-4 py-2 bg-blue-500 text-white rounded-lg">Ask Another Question</button>
        <a href={tweetUrl} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-blue-400 text-white rounded-lg">Share on Twitter</a>
      </div>
      <Toaster richColors />
    </div>
  );
};

export default ShowAskAgent;