import React, { useContext, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { Link, Route, Switch, useLocation } from "wouter";

import { DexIcon, TelegramIcon, XIcon, GitbookIcon, LoaderIcon } from "./icons";
import { Toaster, toast } from 'sonner';

const AppContext = React.createContext({
    inputValue: "",
    setInputValue: (value: string) => { },
    handleSubmit: (content: string) => { },
    isLoading: false,
    setIsLoading: (loading: boolean) => { },
});

export function cls(...classes: any) {
    return classes.filter(Boolean).join(" ");
}

// todo: styles key should not point to specific elements but should describe what each style is doing like "fixedAtTheBottom" and "blurredZincBackground" can be two different styles
const styles = {
    nav: "sticky top-0 z-50 backdrop-blur-sm",
    navContainer: "max-w-7xl mx-auto px-4",
    navContent: "flex items-center justify-between h-14 sm:h-16 md:h-20",
    link: "font-mono text-lg md:text-xl font-semibold tracking-tight text-white hover:opacity-80 transition-opacity flex items-center",
    button: "cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap font-bold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-950 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 dark:focus-visible:ring-neutral-300 rounded-xl h-9 sm:h-10 px-6 sm:px-8",
    connectButton: "bg-neutral-800 text-white py-4 sm:py-6 text-sm sm:text-base border-b-4 hover:border-b-2 hover:border-t-2 border-neutral-900 hover:border-neutral-900 transition-all duration-100 dark:bg-neutral-700 dark:border-neutral-800 text-neutral-300 hover:text-white transition-colors",
    buyButton: "bg-[#32ABFC] text-white py-4 sm:py-6 text-sm sm:text-base border-b-4 hover:border-b-2 hover:border-t-2 border-[#2474c3] hover:border-[#2474c3] transition-all duration-100",
    main: "flex-1 flex flex-col overflow-x-hidden bg-zinc-900 text-blue-100",
    mainFixed: "fixed inset-0 min-h-[100dvh]",
    mainContent: "h-full p-3 sm:p-4 pb-24 sm:pb-32 font-mono overflow-y-auto",
    mainInner: "h-full flex flex-col items-center justify-center -mx-2 sm:-mx-4",
    footer: "fixed bottom-0 left-0 right-0 bg-zinc-900/80 backdrop-blur-sm",
    footerContent: "w-full pb-3 px-3 sm:pb-4 sm:px-4",
    footerInner: "max-w-2xl mx-auto",
    form: "w-full max-w-3xl mx-auto",
    inputContainer: "relative",
    input: "flex w-full px-3 shadow-sm file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-neutral-950 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-950 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-800 dark:file:text-neutral-50 dark:placeholder:text-neutral-400 dark:focus-visible:ring-neutral-700 py-4 sm:py-3 pr-10 rounded-xl bg-white/5 border-[1.5px] border-white/10 hover:border-white/20 focus:border-white/20 focus:ring-0 focus:outline-none text-white placeholder:text-neutral-400 transition-colors text-[18px]",
    submitButton: "font-sans text-base md:text-lg font-semibold leading-6 md:leading-7 absolute right-2 top-1/2 -translate-y-1/2 p-2 text-neutral-400 hover:text-white rounded-xl disabled:opacity-50 transition-colors",
    responseContainer: "w-full max-w-xl bg-neutral-950 rounded-xl border border-neutral-800/50 shadow-xl overflow-hidden relative",
    responseHeader: "px-4 sm:px-7 py-3 sm:py-5 border-b border-neutral-800/50 bg-neutral-900/50",
    responseContent: "px-4 sm:px-7 py-4 sm:py-6",
    responseMeta: "mt-4 sm:mt-6 flex items-center gap-1",
    shareButton: "bg-blue-600 text-white font-bold rounded-xl px-6 py-3 flex-1 hover:bg-blue-700 transition-all duration-200 transform hover:scale-105",
    pageContainer: "flex flex-col items-center justify-center min-h-screen bg-neutral-900",
    scrollContainer: "relative w-full max-w-full space-y-2 sm:space-y-3 mb-4 overflow-hidden",
    scrollInner: "relative w-full overflow-hidden",
    scrollInnerContent: "inline-flex gap-3 animate-scroll-slower hover:pause-animation",
    questionButton: "flex items-center gap-2.5 px-4 py-2.5 bg-[#1a1b1e] hover:bg-[#25262A] border border-white/[0.08] transition-all duration-200 group rounded-xl min-w-[260px] max-w-[400px] w-fit shrink-0 hover:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
    questionButtonInner: "font-sans md:text-sm leading-7 text-lg flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity",
    questionButtonText: "font-mono text-xs md:text-sm leading-5 md:leading-6 text-[#A1A1AA] font-medium whitespace-nowrap group-hover:text-white/90 transition-colors",
    socialLink: "flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 transition-all hover:scale-110 transform duration-200",
    header: "mb-6 sm:mb-12",
    headerContent: "text-center flex flex-col items-center gap-4 sm:gap-6 md:gap-12 pt-4 sm:pt-8",
    avatar: "w-24 h-24 sm:w-32 sm:h-32 md:w-56 md:h-56 rounded-full overflow-hidden border-4 border-white",
    headerTitle: "font-mono text-3xl md:text-4xl font-black tracking-tight inline-flex",
    animation: "animate-typing overflow-hidden whitespace-nowrap border-r-2 border-white pr-1",
    transitionText: "transition-transform duration-500 ease-in-out",
    textMoveAnimation: "transition-transform duration-700 ease-in-out transform scale-105",
};

// todo: extract all styles for specific elements in here by combining common styles for each for example "footer" key can be equal to cls(styles.fixedAtTheBottom, cls.blurredZincBackground) ensure all elements then are pointing to corresponding element style
const els = {};

const Navbar = ({ connectWallet, publicKey }: { connectWallet: () => void; publicKey: string }) => {
    const shortenPublicKey = (key: string) => {
        return `${key.slice(0, 4)}...${key.slice(-4)}`;
    };

    return (
        <nav className={styles.nav}>
            <div className={styles.navContainer}>
                <div className={styles.navContent}>
                    <Link
                        className={styles.link}
                        to="/"
                    >
                        <span className="text-neutral-200">Chat</span>
                        <span className="text-red-500">{window.serverData.botName}</span>
                    </Link>
                    <div className="flex-shrink-0 flex items-center space-x-4">
                        {publicKey ? <span className="text-white font-mono">{shortenPublicKey(publicKey)}</span> : (
                            <button
                                onClick={connectWallet}
                                className={cls(styles.button, styles.connectButton)}
                            >
                                Connect Wallet
                            </button>
                        )}
                        <a
                            target="_blank"
                            rel="noopener noreferrer"
                            href={`https://pump.fun/coin/${window.serverData.mintAddress}`}
                            className={cls(styles.button, styles.buyButton)}
                        >
                            Buy
                        </a>
                    </div>
                </div>
            </div>
        </nav>
    );
};

const MainContent = () => {
    const [, setLocation] = useLocation();
    const { inputValue, setInputValue, handleSubmit, setIsLoading } = useContext(AppContext);

    const handleQuestionClick = async (question: string) => {
        setInputValue(question);
        setIsLoading(true);
        await handleSubmit(question);
        setIsLoading(false);
    };

    return (
        <div className="flex-1">
            <main className={styles.main}>
                <div className={styles.mainFixed}>
                    <div className={styles.mainContent}>
                        <div className={styles.mainInner}>
                            <Header />
                            <ScrollingQuestions handleQuestionClick={handleQuestionClick} />
                            <SocialLinks />
                        </div>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
};

const Footer = () => {
    const { inputValue, setInputValue, handleSubmit, isLoading, setIsLoading } = useContext(AppContext);
    const [animateText, setAnimateText] = useState(false);

    const handleKeyPress = async (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            event.preventDefault();
            setIsLoading(true);
            setAnimateText(true);
            await handleSubmit(inputValue);
            setIsLoading(false);
        }
    };

    const handleFormSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setIsLoading(true);
        setAnimateText(true);
        await handleSubmit(inputValue);
        setIsLoading(false);
    };

    return (
        <div className={styles.footer}>
            <div className={styles.footerContent}>
                <div className={styles.footerInner}>
                    <form className={styles.form} onSubmit={handleFormSubmit}>
                        <div className={styles.inputContainer}>
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyPress={handleKeyPress}
                                className={cls(styles.input, animateText && styles.textMoveAnimation)}
                                placeholder="Ask anything..."
                                disabled={isLoading}
                            />
                            <button
                                type="submit"
                                disabled={isLoading}
                                className={styles.submitButton}
                            >
                                {isLoading ? <div className="flex items-center justify-center gap-2.5">
                                    <p className="text-black text-sm font-medium leading-snug">
                                        Loading<span className="animate-pulse" >...</span></p>
                                </div>
                                    : "→"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

const ResponseDisplay = React.forwardRef<
    HTMLDivElement,
    { response: any; onReset: () => void; actionBar?: React.ReactNode; hideDefaultActions?: boolean }
>(
    ({ response, onReset, actionBar, hideDefaultActions = false }, ref) => {
        const [visible, setVisible] = useState(false);

        useEffect(() => {
            const timer = setTimeout(() => {
                setVisible(true);
            }, 300);
            return () => clearTimeout(timer);
        }, []);

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
            <div className="flex flex-col items-center justify-center w-full">
                <div
                    ref={ref}
                    className={cls(styles.responseContainer, visible ? "animate-ios-like" : "opacity-0")}
                >
                    <div className={styles.responseHeader}>
                        <div className="text-neutral-200 text-sm sm:text-base">{response.question}</div>
                    </div>
                    <div className={styles.responseContent}>
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
                        <div className={styles.responseMeta}>
                            <div className="text-neutral-500 text-xs sm:text-sm">
                                {new Date(response.timestamp).toLocaleTimeString([], {
                                    hour: "numeric",
                                    minute: "2-digit",
                                    hour12: true,
                                })}
                            </div>
                            <div className="text-neutral-600">·</div>
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
            </div>
        );
    },
);

const BuyPage = () => {
    const response = {
        question: window.serverData.buyQuestion,
        content: window.serverData.buyContent,
        timestamp: new Date().getTime(),
    };

    return (
        <div>
            <ResponseDisplay
                response={response}
                onReset={() => console.log("Reset")}
            />
        </div>
    );
};

const ChatPage = ({ params }: any) => {
    const [response, setResponse] = useState<any>(null);

    useEffect(() => {
        if (window.serverData && window.serverData.chatId === params.id) {
            console.debug(1733219905, window.serverData);

            setResponse({
                question: decodeURIComponent(window.serverData.question),
                content: decodeURIComponent(window.serverData.content),
                timestamp: window.serverData.timestamp,
            });
        } else {
            toast.error("Error: chat not found");
            const fetchResponse = async () => {
                try {
                    const res = await fetch(`/chat/${params.id}`);
                    const data = await res.json();
                    setResponse(data);
                } catch (error) {
                    console.error("Error fetching chat response:", error);
                }
            };
            fetchResponse();
        }
    }, [params.id]);

    if (!response) {
        return <div className="flex items-center justify-center min-h-screen text-white">Loading...</div>;
    }

    return (
        <div className={styles.pageContainer}>
            <ResponseDisplay
                response={response}
                onReset={() => console.log("Reset")}
            />
            <div className="fixed bottom-0 left-0 right-0 p-4 z-50">
                <div className="max-w-xl mx-auto flex gap-2 sm:gap-4">
                    <a
                        className={styles.shareButton}
                        target="_blank"
                        href={`https://twitter.com/intent/tweet?text="${encodeURIComponent(response.content)}" - ${encodeURIComponent(window.serverData.botName)} ${encodeURIComponent(window.location.href)}`}
                    >
                        Share on Twitter
                    </a>
                </div>
            </div>
        </div>
    );
};

export default function App() {
    const [publicKey, setPublicKey] = useState<string>("");
    const [inputValue, setInputValue] = useState<string>("");
    const [, setLocation] = useLocation();
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const getProvider = () => {
        if ("phantom" in window) {
            const provider = window.phantom?.solana;
            return provider?.isPhantom ? provider : window.open("https://phantom.app/", "_blank");
        }
    };

    const connectWallet = async () => {
        const provider = getProvider();
        if (provider) {
            const resp = await provider.connect();
            setPublicKey(resp.publicKey.toString());
        }
    };

    const handleSubmit = async (content: string) => {
        try {
            const response = await fetch("/api/ask-agent", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ content }),
            });
            if (!response.ok) {
                throw new Error("Network response was not ok");
            }
            const data = await response.json();
            if (data.twitterPostLink) {
                window.location = data.twitterPostLink;
            } else if (data.chatId) {
                window.serverData = {
                    ...window.serverData,
                    ...data,
                };
                setLocation(`/chat/${data.chatId}`);
            } else {
                throw 'missing response value';
            }
        } catch (error) {
            console.error("Error submitting question:", error);
            toast.error("Failed to submit question. Please, ensure it's appropriate to the agent domain of expertise and then try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AppContext.Provider value={{ inputValue, setInputValue, handleSubmit, isLoading, setIsLoading }}>
            <div className="h-screen w-screen font-sans antialiased flex flex-col bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-900 animate-wave bg-[length:400%_400%] overflow-hidden">
                <Toaster richColors />
                <Navbar connectWallet={connectWallet} publicKey={publicKey} />
                <Switch>
                    <Route path="/buy" component={BuyPage} />
                    <Route path="/chat/:id" component={ChatPage} />
                    <Route path="/" component={MainContent} />
                </Switch>
            </div>
        </AppContext.Provider>
    );
};

const Header = () => {
    return (
        <div className={styles.header}>
            <div className={styles.headerContent}>
                <div className={styles.avatar}>
                    <img src={window.serverData.agentImage} alt={window.serverData.botName} className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col items-center gap-2 md:gap-3">
                    <h1 className={styles.headerTitle}>
                        <span className={styles.animation}>
                            {window.serverData.mintAddress ? `CA: ${window.serverData.mintAddress}` : window.serverData.botName}
                        </span>
                    </h1>
                </div>
            </div>
        </div>
    );
};

const ScrollingQuestions = React.memo((
    { handleQuestionClick }: { handleQuestionClick: (question: string) => void },
) => (
    <div className={styles.scrollContainer}>
        <div id="line-scrolled-left" className={styles.scrollInner}>
            <div className={cls(styles.scrollInnerContent)} style={{ animationDuration: "120s", width: "3984px" }}>
                {window.serverData.scrollItemsLeft.map((item: string, index: number) => (
                    <QuestionButton key={index} item={item} handleQuestionClick={handleQuestionClick} />
                ))}
            </div>
        </div>
        <div id="line-scrolled-right" className={styles.scrollInner}>
            <div
                className={cls(styles.scrollInnerContent)}
                style={{ animationDuration: "120s", width: "3984px", animationDirection: "reverse" }}
            >
                {window.serverData.scrollItemsRight.map((item: string, index: number) => (
                    <QuestionButton key={index} item={item} handleQuestionClick={handleQuestionClick} />
                ))}
            </div>
        </div>
    </div>
));

const QuestionButton = (
    { item, handleQuestionClick }: { item: string; handleQuestionClick: (question: string) => void },
) => {
    const { isLoading } = useContext(AppContext);

    return (
        <button
            onClick={() => handleQuestionClick(item)}
            className={styles.questionButton}
            disabled={isLoading}
        >
            <span className={styles.questionButtonInner}>
                
            </span>
            <span className={styles.questionButtonText}>
                {item}
            </span>
        </button>
    );
};

const SocialLinks = () => {
    const socialLinks = window.serverData?.socialLinks || {};
    return (
        <div className="flex items-center space-x-4 sm:space-x-8 mt-2 sm:mt-8" role="navigation" aria-label="Social Links">
            {socialLinks.gitbook && (
                <a
                    href={socialLinks.gitbook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.socialLink}
                >
                    <GitbookIcon />
                </a>
            )}
            {socialLinks.telegram && (
                <a
                    href={socialLinks.telegram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.socialLink}
                >
                    <TelegramIcon />
                </a>
            )}
            {socialLinks.dex && (
                <a
                    href={socialLinks.dex}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.socialLink}
                >
                    <DexIcon />
                </a>
            )}
            {socialLinks.X && (
                <a
                    href={socialLinks.X}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.socialLink}
                >
                    <XIcon />
                </a>
            )}
        </div>
    );
};