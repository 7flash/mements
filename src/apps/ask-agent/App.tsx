import React from 'react';
import { Route, Switch } from 'wouter';
import AskQuestion from './AskQuestion';
import ShowAnswer from './ShowAnswer';
import { Toaster, toast } from 'sonner';

const BackgroundImage = () => (
    <div 
      className="absolute inset-0 bg-cover bg-center"
      style={{ 
        backgroundImage: `url(${window.serverData.agentImage})`,
        filter: 'blur(8px) brightness(0.3)'
      }}
    />
  );

export default function() {
    return <div className="relative min-h-screen w-full overflow-hidden bg-zinc-900">
        <BackgroundImage />
        <main className="relative z-10 flex flex-col items-center justify-between min-h-screen p-4">
            <Switch>
                <Route path="/" component={AskQuestion} />
                <Route path="/chat/:id" component={ShowAnswer} /> 
            </Switch>
        </main>
        <Toaster richColors />
    </div>
}