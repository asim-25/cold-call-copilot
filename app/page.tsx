"use client";

import { useState, useEffect } from "react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

const CALL_STAGES = [
  { stage: 1, title: "Opener", description: "Get permission to speak", buttons: ["Permission Granted", "Not Interested", "Bad Time"] },
  { stage: 2, title: "Reason for Call", description: "State core proposition", buttons: ["HOOKed / Interested", "Pushback", "Wrong Person"] },
  { stage: 3, title: "Discovery / Problem", description: "Uncover pain point", buttons: ["Pain Confirmed", "No Need", "Using Competitor"] },
  { stage: 4, title: "Value Proposition", description: "Introduce solution", buttons: ["Resonated", "Skeptical", "Too Expensive"] },
  { stage: 5, title: "Qualification", description: "Verify budget/authority", buttons: ["Qualified", "Not Decision Maker", "No Budget"] },
  { stage: 6, title: "Objection Handling", description: "Address resistance", buttons: ["Objection Cleared", "Hard No", "Send Info First"] },
  { stage: 7, title: "Closing / Next Step", description: "Propose meeting", buttons: ["Meeting Agreed", "Follow-up Later", "Declined"] },
  { stage: 8, title: "Call Wrap Up", description: "Confirm outcome & details", buttons: ["Wrapped Up Successfully", "Dropped Call"] },
];

export default function Home() {
  const [prospectName, setProspectName] = useState("");
  const [company, setCompany] = useState("");
  const [activeCall, setActiveCall] = useState<any>(null);
  const [currentStage, setCurrentStage] = useState(1);
  const [prospectWords, setProspectWords] = useState("");
  const [logs, setLogs] = useState<any[]>([]);
  const [pastCalls, setPastCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  useEffect(() => {
    fetchCalls();
  }, []);

  const fetchCalls = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/calls`);
      if (res.ok) {
        const data = await res.json();
        setPastCalls(data);
      }
    } catch (e) {
      console.error("Failed to fetch past calls", e);
    }
  };

  const startCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prospectName || !company) return;

    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/calls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospect_name: prospectName, company }),
      });
      if (res.ok) {
        const call = await res.json();
        setActiveCall(call);
        setCurrentStage(1);
        setLogs([]);
        setSummary(null);
      }
    } catch (e) {
      alert("Error starting call. Ensure backend server is running.");
    } finally {
      setLoading(false);
    }
  };

  const handleStageSubmit = async (buttonTapped: string) => {
    if (!activeCall) return;

    try {
      const res = await fetch(`${BACKEND_URL}/calls/${activeCall.id}/stages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage_number: currentStage,
          button_tapped: buttonTapped,
          prospect_words: prospectWords,
        }),
      });

      if (res.ok) {
        const stageData = await res.json();
        setLogs([...logs, { ...stageData, stage_title: CALL_STAGES[currentStage - 1].title }]);
        setProspectWords("");

        if (currentStage < 8) {
          setCurrentStage(currentStage + 1);
        }
      }
    } catch (e) {
      alert("Failed to log stage action.");
    }
  };

  const endCall = async () => {
    if (!activeCall) return;
    setLoading(true);

    try {
      const res = await fetch(`${BACKEND_URL}/calls/${activeCall.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        const data = await res.json();
        setSummary(data.call.outcome);
        setActiveCall(null);
        setProspectName("");
        setCompany("");
        fetchCalls();
      }
    } catch (e) {
      alert("Failed to close call.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8 font-sans">
      <header className="max-w-5xl mx-auto mb-8 border-b border-slate-800 pb-4 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-indigo-400">Cold Call Co-Pilot</h1>
          <p className="text-slate-400 text-sm">Real-time script guidance & automated Gemini call summarization</p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          {!activeCall ? (
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
              <h2 className="text-xl font-semibold mb-4 text-slate-200">Start New Call Session</h2>
              <form onSubmit={startCall} className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Prospect Name</label>
                  <input
                    type="text"
                    required
                    value={prospectName}
                    onChange={(e) => setProspectName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Company</label>
                  <input
                    type="text"
                    required
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="e.g. Acme Corp"
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 rounded transition"
                >
                  {loading ? "Initializing..." : "Start Call Session"}
                </button>
              </form>
            </div>
          ) : (
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg space-y-6">
              <div className="flex justify-between items-center border-b border-slate-700 pb-3">
                <div>
                  <span className="text-xs uppercase tracking-wider text-indigo-400 font-bold">Active Call</span>
                  <h2 className="text-2xl font-bold">{activeCall.prospect_name}</h2>
                  <p className="text-slate-400 text-sm">{activeCall.company}</p>
                </div>
                <button
                  onClick={endCall}
                  disabled={loading}
                  className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded text-sm font-medium transition"
                >
                  {loading ? "Closing Call..." : "End Call & Summarize"}
                </button>
              </div>

              {/* Stage Progress Bar */}
              <div className="flex space-x-1">
                {CALL_STAGES.map((s) => (
                  <div
                    key={s.stage}
                    className={`h-2 flex-1 rounded-full ${
                      s.stage === currentStage
                        ? "bg-indigo-500"
                        : s.stage < currentStage
                        ? "bg-indigo-900"
                        : "bg-slate-700"
                    }`}
                  />
                ))}
              </div>

              {/* Active Stage Tracker */}
              <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
                <div className="text-xs text-indigo-400 font-semibold mb-1">
                  STAGE {currentStage} OF 8
                </div>
                <h3 className="text-lg font-bold text-slate-100">
                  {CALL_STAGES[currentStage - 1].title}
                </h3>
                <p className="text-sm text-slate-400 mb-4">
                  {CALL_STAGES[currentStage - 1].description}
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Prospect Response / Notes</label>
                    <textarea
                      rows={2}
                      value={prospectWords}
                      onChange={(e) => setProspectWords(e.target.value)}
                      placeholder="Type prospect's exact words or pain points..."
                      className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <label className="block text-xs text-slate-400 mb-1">Quick Action Button</label>
                  <div className="grid grid-cols-3 gap-2">
                    {CALL_STAGES[currentStage - 1].buttons.map((btn) => (
                      <button
                        key={btn}
                        onClick={() => handleStageSubmit(btn)}
                        className="bg-slate-800 hover:bg-indigo-600 border border-slate-700 text-xs py-2 px-3 rounded text-slate-200 transition"
                      >
                        {btn}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {summary && (
            <div className="bg-emerald-950/40 border border-emerald-600/50 p-4 rounded-xl text-emerald-200">
              <h3 className="font-bold text-sm text-emerald-400 mb-1">✨ AI Call Outcome Summary (Gemini 2.5 Flash)</h3>
              <p className="text-sm">{summary}</p>
            </div>
          )}
        </div>

        {/* Call Log & History Sidebar */}
        <div className="space-y-6">
          {activeCall && logs.length > 0 && (
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
              <h3 className="font-semibold text-sm text-slate-300 mb-3">Live Call Script Log</h3>
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {logs.map((log, idx) => (
                  <div key={idx} className="bg-slate-900 p-2.5 rounded border border-slate-800 text-xs">
                    <span className="font-bold text-indigo-400">{log.stage_title}:</span>{" "}
                    <span className="text-slate-300">{log.button_tapped}</span>
                    {log.prospect_words && (
                      <p className="text-slate-400 italic mt-1 font-serif">"{log.prospect_words}"</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
            <h3 className="font-semibold text-sm text-slate-300 mb-3">Call History</h3>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {pastCalls.length === 0 ? (
                <p className="text-xs text-slate-500">No previous calls logged yet.</p>
              ) : (
                pastCalls.map((c) => (
                  <div key={c.id} className="bg-slate-900 p-3 rounded border border-slate-800 text-xs space-y-1">
                    <div className="flex justify-between font-bold text-slate-200">
                      <span>{c.prospect_name}</span>
                      <span className="text-slate-400 font-normal">{c.company}</span>
                    </div>
                    {c.outcome && <p className="text-slate-400 text-3xs line-clamp-2">{c.outcome}</p>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}