import React from "react";
import { Toaster, toast } from "sonner";

// Mock data for demonstration purposes:
const responseData = {
  question: "What is the capital of France?",
  content: "The capital of France is Paris.",
  timestamp: Date.now(),
  tweetUrl: "", // Example: "https://twitter.com/intent/tweet?text=The%20capital%20of%20France%20is%20Paris."
};

const ShowAskAgent = () => {
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-900 text-white">
      <ResponseCard response={responseData} />
      <div className="mt-6 flex gap-4">
        <button
          onClick={() => (window.location.href = "/")}
          className="px-4 py-2 bg-blue-600 rounded text-white hover:bg-blue-700">
          Ask another question
        </button>
        <button
          onClick={() =>
            window.open(
              responseData.tweetUrl ||
                `https://twitter.com/intent/tweet?text=${encodeURIComponent(
                  responseData.content
                )}`,
              "_blank"
            )
          }
          className="px-4 py-2 bg-blue-600 rounded text-white hover:bg-blue-700">
          Share on Twitter
        </button>
        <button
          onClick={copyLink}
          className="px-4 py-2 bg-gray-600 rounded text-white hover:bg-gray-700">
          Copy Link
        </button>
      </div>
      <Toaster richColors />
    </div>
  );
};

const ResponseCard = ({ response }) => {
  const formattedTime = new Date(response.timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const formattedDate = new Date(response.timestamp).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="bg-zinc-800 p-6 rounded-lg shadow-lg w-full max-w-2xl">
      <div className="text-neutral-200 text-lg mb-2">
        {response.question}
      </div>
      <div className="mt-4 text-white">
        {response.content.split("\n").map((line, index) => (
          <p key={index} className="mb-2">
            {line}
          </p>
        ))}
      </div>
      <div className="mt-4 text-neutral-500 text-sm">
        <div>{formattedTime}</div>
        <div>{formattedDate}</div>
      </div>
    </div>
  );
};

export default ShowAskAgent;