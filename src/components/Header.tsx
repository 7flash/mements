import React, { useState, useMemo } from "react";
import assets from "#generated/assets.json";

export default function Header() {
    const [publicKey, setPublicKey] = useState<string | null>(null);
  
    const handleConnectWallet = useMemo(() => {
      const getProvider = () => {
        if ("phantom" in window) {
          const provider = window.phantom?.solana;
          return provider?.isPhantom ? provider : window.open("https://phantom.app/", "_blank");
        }
      };
  
      return async () => {
        const provider = getProvider();
        if (provider) {
          const resp = await provider.connect();
          const key = resp.publicKey.toString();
          setPublicKey(key);
        }
      };
    }, []);
  
    return (
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <a href="/" className="flex-shrink-0 flex items-center gap-2">
                <img src={assets.logo} alt="Logo" width={24} height={24} />
                <span className="text-xl font-bold font-geohumanist-sans text-[#006DD8]">Mements</span>
              </a>
            </div>
            <div className="flex items-center">
              {publicKey ? (
                <span className="px-4 py-2 text-sm font-medium text-gray-700">
                  {`${publicKey.slice(0, 4)}...${publicKey.slice(-4)}`}
                </span>
              ) : (
                <button className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer" onClick={handleConnectWallet}>
                  Connect Wallet
                </button>
              )}
            </div>
          </div>
        </div>
      </header>
    );
  }