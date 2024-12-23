import React from 'react';
import { Route, Switch } from 'wouter';
import AskQuestion from './AskQuestion';
import ShowAnswer from './ShowAnswer';

export default function() {
    return <Switch>
        <Route path="/" component={AskQuestion} />
        <Route path="/chat/:id" component={ShowAnswer} /> 
    </Switch>  
}