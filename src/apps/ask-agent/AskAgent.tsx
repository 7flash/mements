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

const styles = {
    fixedAtTheBottom: "fixed bottom-0 left-0 right-0",
    blurredZincBackground: "bg-zinc-900/80 backdrop-blur-sm",
    maxWidthContainer: "max-w-7xl mx-auto px-4",
    flexCenter: "flex items-center justify-center",
    flexBetween: "flex items-center justify-between",
    flexColumn: "flex flex-col",
    flex1: "flex-1",
    textWhite: "text-white",
    textNeutral: "text-neutral-200",
    transitionOpacity: "transition-opacity",
    hoverOpacity: "hover:opacity-80",
    roundedXl: "rounded-xl",
    borderNeutral: "border border-neutral-800/50",
    shadowXl: "shadow-xl",
    overflowHidden: "overflow-hidden",
    transitionAll: "transition-all duration-100",
    transitionColors: "transition-colors",
    animateTyping: "animate-typing overflow-hidden whitespace-nowrap border-r-2 border-white pr-1",
    transitionTransform: "transition-transform duration-500 ease-in-out",
    textMoveAnimation: "transition-transform duration-700 ease-in-out transform scale-105",
};

const els = {
    nav: cls("sticky top-0 z-50 backdrop-blur-sm", styles.maxWidthContainer),
    navContent: cls(styles.flexBetween, "h-14 sm:h-16 md:h-20"),
    link: cls("font-mono text-lg md:text-xl font-semibold tracking-tight", styles.textWhite, styles.hoverOpacity),
    button: cls("cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap font-bold", styles.roundedXl, "h-9 sm:h-10 px-6 sm:px-8"),
    connectButton: cls("bg-neutral-800", styles.textWhite, "py-4 sm:py-6 text-sm sm:text-base border-b-4 hover:border-b-2 hover:border-t-2 border-neutral-900 hover:border-neutral-900", styles.transitionAll),
    buyButton: cls("bg-[#32ABFC]", styles.textWhite, "py-4 sm:py-6 text-sm sm:text-base border-b-4 hover:border-b-2 hover:border-t-2 border-[#2474c3] hover:border-[#2474c3]", styles.transitionAll),
    main: cls(styles.flex1, styles.flexColumn, "overflow-x-hidden bg-zinc-900 text-blue-100"),
    mainFixed: "fixed inset-0 min-h-[100dvh]",
    mainContent: "h-full p-3 sm:p-4 pb-24 sm:pb-32 font-mono overflow-y-auto",
    mainInner: cls("h-full", styles.flexColumn, styles.flexCenter, "-mx-2 sm:-mx-4"),
    footer: cls(styles.fixedAtTheBottom, styles.blurredZincBackground),
    footerContent: "w-full pb-3 px-3 sm:pb-4 sm:px-4",
    footerInner: "max-w-2xl mx-auto",
    form: "w-full max-w-3xl mx-auto",
    inputContainer: "relative",
    input: cls("flex w-full px-3 shadow-sm file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-neutral-950", "py-4 sm:py-3 pr-10", styles.roundedXl, "bg-white/5 border-[1.5px] border-white/10 hover:border-white/20", styles.textWhite, "placeholder:text-neutral-400", styles.transitionColors, "text-[18px]"),
    submitButton: cls("font-sans text-base md:text-lg font-semibold leading-6 md:leading-7 absolute right-2 top-1/2 -translate-y-1/2 p-2 text-neutral-400 hover:text-white", styles.roundedXl, styles.transitionColors),
    responseContainer: cls("w-full max-w-xl bg-neutral-950", styles.roundedXl, styles.borderNeutral, styles.shadowXl, styles.overflowHidden, "relative"),
    responseHeader: "px-4 sm:px-7 py-3 sm:py-5 border-b border-neutral-800/50 bg-neutral-900/50",
    responseContent: "px-4 sm:px-7 py-4 sm:py-6",
    responseMeta: "mt-4 sm:mt-6 flex items-center gap-1",
    shareButton: cls("bg-blue-600", styles.textWhite, "font-bold", styles.roundedXl, "px-6 py-3 flex-1 hover:bg-blue-700", styles.transitionAll, "transform hover:scale-105"),
    pageContainer: cls(styles.flexColumn, styles.flexCenter, "min-h-screen bg-neutral-900"),
    scrollContainer: "relative w-full max-w-full space-y-2 sm:space-y-3 mb-4 overflow-hidden",
    scrollInner: "relative w-full overflow-hidden",
    scrollInnerContent: "inline-flex gap-3 animate-scroll-slower hover:pause-animation",
    questionButton: cls("flex items-center gap-2.5 px-4 py-2.5 bg-[#1a1b1e] hover:bg-[#25262A] border border-white/[0.08]", styles.transitionAll, "duration-200 group", styles.roundedXl, "min-w-[260px] max-w-[400px] w-fit shrink-0 hover:cursor-pointer"),
    questionButtonInner: cls("font-sans md:text-sm leading-7 text-lg flex-shrink-0 opacity-0 group-hover:opacity-100", styles.transitionOpacity),
    questionButtonText: cls("font-mono text-xs md:text-sm leading-5 md:leading-6 text-[#A1A1AA] font-medium whitespace-nowrap group-hover:text-white/90", styles.transitionColors),
    socialLink: cls("flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12", styles.roundedXl, "bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200", styles.transitionAll, "hover:scale-110 transform duration-200"),
    header: "mb-6 sm:mb-12",
    headerContent: cls("text-center", styles.flexColumn, styles.flexCenter, "gap-4 sm:gap-6 md:gap-12 pt-4 sm:pt-8"),
    avatar: cls("w-24 h-24 sm:w-32 sm:h-32 md:w-56 md:h-56", styles.roundedXl, "overflow-hidden border-4 border-white"),
    headerTitle: cls("font-mono text-3xl md:text-4xl font-black tracking-tight", "inline-flex"),
    animation: styles.animateTyping,
    transitionText: styles.transitionTransform,
    textMoveAnimation: styles.textMoveAnimation,
};

const Navbar = ({ connectWallet, publicKey }: { connectWallet: () => void; publicKey: string }) => {
    const shortenPublicKey = (key: string) => {
        return `${key.slice(0, 4)}...${key.slice(-4)}`;
    };

    return (
        <nav className={els.nav}>
            <div className={els.navContent}>
                <Link
                    className={els.link}
                    to="/"
                >
                    <span className={styles.textNeutral}>Chat</span>
                    <span className="text-red-500">{window.serverData.botName}</span>
                </Link>
                <div className="flex-shrink-0 flex items-center space-x-4">
                    {publicKey ? <span className={cls(styles.textWhite, "font-mono")}>{shortenPublicKey(publicKey)}</span> : (
                        <button
                            onClick={connectWallet}
                            className={cls(els.button, els.connectButton)}
                        >
                            Connect Wallet
                        </button>
                    )}
                    <a
                        target="_blank"
                        rel="noopener noreferrer"
                        href={`https://pump.fun/coin/${window.serverData.mintAddress}`}
                        className={cls(els.button, els.buyButton)}
                    >
                        Buy
                    </a>
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
        <div className={styles.flex1}>
            <main className={els.main}>
                <div className={els.mainFixed}>
                    <div className={els.mainContent}>
                        <div className={els.mainInner}>
                            <Header />
                            <Gallery handleQuestionClick={handleQuestionClick} />
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
        <div className={els.footer}>
            <div className={els.footerContent}>
                <div className={els.footerInner}>
                    <form className={els.form} onSubmit={handleFormSubmit}>
                        <div className={els.inputContainer}>
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyPress={handleKeyPress}
                                className={cls(els.input, animateText && els.textMoveAnimation)}
                                placeholder="Ask anything..."
                                disabled={isLoading}
                            />
                            <button
                                type="submit"
                                disabled={isLoading}
                                className={els.submitButton}
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
            <div className={cls(styles.flexColumn, styles.flexCenter, "w-full")}>
                <div
                    ref={ref}
                    className={cls(els.responseContainer, visible ? "animate-ios-like" : "opacity-0")}
                >
                    <div className={els.responseHeader}>
                        <div className="text-neutral-200 text-sm sm:text-base">{response.question}</div>
                    </div>
                    <div className={els.responseContent}>
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
                        <div className={els.responseMeta}>
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
        <div className={els.pageContainer}>
            <ResponseDisplay
                response={response}
                onReset={() => console.log("Reset")}
            />
            <div className="fixed bottom-0 left-0 right-0 p-4 z-50">
                <div className="max-w-xl mx-auto flex gap-2 sm:gap-4">
                    <a
                        className={els.shareButton}
                        target="_blank"
                        href={`https://twitter.com/intent/tweet?text="${encodeURIComponent(response.content)}" - ${encodeURIComponent(window.serverData.botName)} ${encodeURIComponent(window.location.href)}`}
                    >
                        {response.twitterPostLink ? "Repost on Twitter" : "Share on Twitter"}
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
            
            const data = await response.json();

            if (response.status === 400 && data.error) {
                toast.error(`Error: ${data.error}. ${data.details}`);
                return;
            }            

            if (data.chatId) {
                window.serverData = {
                    ...window.serverData,
                    ...data,
                };
                setLocation(`/chat/${data.chatId}`);
            } else {
                throw new Error('Missing response value');
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
        <div className={els.header}>
            <div className={els.headerContent}>
                <div className={els.avatar}>
                    <img src={window.serverData.agentImage} alt={window.serverData.botName} className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col items-center gap-2 md:gap-3">
                    <h1 className={els.headerTitle}>
                        <span className={els.animation}>
                            {window.serverData.mintAddress ? `CA: ${window.serverData.mintAddress}` : window.serverData.botName}
                        </span>
                    </h1>
                </div>
            </div>
        </div>
    );
};

const Gallery = ({ handleQuestionClick }: { handleQuestionClick: (question: string) => void }) => {
    const exampleResponses = window.serverData.exampleResponses || [];

    return (
        <div className={styles.galleryContainer}>
            {exampleResponses.map((response: any, index: number) => (
                <ResponseDisplay
                    key={index}
                    response={response}
                    onReset={() => handleQuestionClick(response.question)}
                />
            ))}
        </div>
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
                    className={els.socialLink}
                >
                    <GitbookIcon />
                </a>
            )}
            {socialLinks.telegram && (
                <a
                    href={socialLinks.telegram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={els.socialLink}
                >
                    <TelegramIcon />
                </a>
            )}
            {socialLinks.dex && (
                <a
                    href={socialLinks.dex}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={els.socialLink}
                >
                    <DexIcon />
                </a>
            )}
            {socialLinks.X && (
                <a
                    href={socialLinks.X}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={els.socialLink}
                >
                    <XIcon />
                </a>
            )}
        </div>
    );
};