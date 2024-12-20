import React from "react"
 
export default function() {
    return <div className="mx-auto"><span className="text-2xl">Ask Agent</span><pre>{JSON.stringify(window.serverData, null, 2)}</pre></div>
}
