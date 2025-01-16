import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Header from 'src/components/Header.tsx';
import Footer from 'src/components/Footer.tsx';
import { ErrorBoundary } from 'src/components/ErrorBoundary';

export const FallbackErrorUI = () => (
  <div className="min-h-screen bg-gray-50 flex flex-col">
    <Header />
    <div className="flex-grow flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Oops! Something went wrong
        </h2>
        <p className="text-gray-600 mb-4">
          Please try refreshing the page
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 cursor-pointer"
        >
          Refresh Page
        </button>
      </div>
    </div>
    <Footer />
  </div>
);