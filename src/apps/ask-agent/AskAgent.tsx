import React, { useContext, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { Link, Route, Switch, useLocation } from "wouter";
import { DexIcon, TelegramIcon, XIcon, GitbookIcon } from "./icons";
import { Toaster, toast } from 'sonner'; // todo: avoid using sonner and make it our own embedded alternative toast in our context

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
    fontStyle: "font-mono text-lg md:text-xl font-semibold",
    transitionOpacity: "transition-opacity",
    link: "text-white hover:opacity-80 flex items-center",
    button: "cursor-pointer inline-flex items-center justify-center gap-2 font-bold rounded-xl",
    connectButton: "bg-neutral-800 text-white py-4 sm:py-6 text-sm sm:text-base",
    buyButton: "bg-[#32ABFC] text-white py-4 sm:py-6 text-sm sm:text-base",
    main: "flex-1 flex flex-col overflow-x-hidden bg-zinc-900 text-blue-100",
    footer: "fixed bottom-0 left-0 right-0 bg-zinc-900/80 backdrop-blur-sm",
    footerInner: "max-w-2xl mx-auto",
    form: "w-full max-w-3xl mx-auto",
    input: "flex w-full px-3 py-4 sm:py-3 pr-10 rounded-xl text-white placeholder:text-neutral-400",
    submitButton: "absolute right-2 top-1/2 -translate-y-1/2 p-2",
    responseContainer: "w-full max-w-xl bg-neutral-950 rounded-xl",
    responseHeader: "px-4 sm:px-7 py-3 sm:py-5 border-b bg-neutral-900/50",
    responseContent: "px-4 sm:px-7 py-4 sm:py-6",
    responseMeta: "mt-4 sm:mt-6 flex items-center gap-1",
    shareButton: "bg-blue-600 text-white font-bold rounded-xl px-6 py-3 flex-1",
    pageContainer: "flex flex-col items-center justify-center min-h-screen bg-neutral-900",
    header: "mb-6 sm:mb-12",
    avatar: "w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden border-4 border-white",
    headerTitle: "font-mono text-3xl md:text-4xl font-black tracking-tight inline-flex",
};

// todo: extract all styles for specific elements in here by combining common styles for each for example "footer" key can be equal to cls(styles.fixedAtTheBottom, cls.blurredZincBackground) ensure all elements then are pointing to corresponding element style
const els = {};

const Navbar = ({ connectWallet, publicKey }: { connectWallet: () => void; publicKey: string }) => {
    const shortenPublicKey = (key: string) => `${key.slice(0, 4)}...${key.slice(-4)}`;

    return (
        <nav className={styles.nav}>
            <div className={styles.navContainer}>
                <div className={styles.navContent}>
                    <Link className={cls(styles.link, styles.fontStyle, styles.transitionOpacity)} to="/">
                        <span className="text-neutral-200">Chat</span>
                        <span className="text-red-500">{window.serverData.botName}</span>
                    </Link>
                    <div className="flex-shrink-0 flex items-center space-x-4">
                        {publicKey ? (
                            <span className="text-white">{shortenPublicKey(publicKey)}</span>
                        ) : (
                            <button onClick={connectWallet} className={cls(styles.button, styles.connectButton)}>
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
                <div className="fixed inset-0 min-h-[100dvh]">
                    <div className="h-full p-3 sm:p-4 pb-24 sm:pb-32">
                        <div className="h-full flex flex-col items-center justify-center -mx-2 sm:-mx-4">
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
            setAnimateText("true");
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
            <div className={styles.footerInner}>
                <form className={styles.form} onSubmit={handleFormSubmit}>
                    <div className="relative">
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyPress={handleKeyPress}
                            className={cls(styles.input, animateText && "transform scale-105")}
                            placeholder="Ask anything..."
                            disabled={isLoading}
                        />
                        <button type="submit" disabled={isLoading} className={styles.submitButton}>
                            {isLoading ? <p>Loading<span className="animate-pulse">...</span></p> : "→"}
                        </button>
                    </div>
                </form>
            </div>
            <Toaster richColors />
        </div>
    );
};

const ResponseDisplay = React.forwardRef<HTMLDivElement, {
    response: any; onReset: () => void; actionBar?: React.ReactNode; hideDefaultActions?: boolean 
}>(({ response, onReset, actionBar, hideDefaultActions = false }, ref) => {
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
            } else {
                throw new Error("Clipboard API not available");
            }
        } catch (err) {
            toast.error("Failed to share. Please try copying the URL manually.");
        }
    };

    return (
        <div className="flex flex-col items-center justify-center w-full">
            <div ref={ref} className={cls(styles.responseContainer, visible ? "animate-ios-like" : "opacity-0")}>
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
                {!hideDefaultActions && (
                    <div className="absolute bottom-0 right-0 select-none pointer-events-none">
                        <div className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-neutral-900/95 to-neutral-950/95">
                            <div className="flex items-center gap-1 sm:gap-1.5">
                                <div className="text-neutral-400 text-[10px] sm:text-xs">Powered by</div>
                                <div className="flex items-center">
                                    <div className="font-bold text-neutral-200 text-[10px] sm:text-xs">Chat</div>
                                    <div className="font-bold text-red-500 text-[10px] sm:text-xs">{window.serverData.botName}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

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
            toast.error("Failed to submit question. Please, ensure its appropriate to the agent domain of expertise and then try again.");
        } finally {
            setIsLoading(false);
        }

    };

    return (
        <AppContext.Provider value={{ inputValue, setInputValue, handleSubmit, isLoading, setIsLoading }}>
            <div className="h-screen w-screen font-sans antialiased flex flex-col bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-900">
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
            <div className="text-center flex flex-col items-center gap-4 sm:gap-6 md:gap-12 pt-4 sm:pt-8">
                <div className={styles.avatar}>
                    <img src={window.serverData.agentImage} alt={window.serverData.botName} className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col items-center gap-2 md:gap-3">
                    <h1 className={styles.headerTitle}>
                        <span className="whitespace-nowrap">CA: {window.serverData.mintAddress}</span>
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
        {/* Implement a slideshow or provide animations in input placeholder */}
        {/* This can be a placeholder for future implementation */}
    </div>
));

const SocialLinks = () => {
    const socialLinks = window.serverData?.socialLinks || {};
    return (
        <div className="left-0 flex items-center space-x-4 sm:space-x-8 mt-2 sm:mt-8" role="navigation" aria-label="Social Links">
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