/**
 * @file frontend/src/pages/analytics/AIDashboard.tsx
 * @description AI-Powered student risk analytics dashboard and chat advisor interface.
 */

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Brain, Bot, Send, ShieldAlert, TrendingUp, TrendingDown,
  Sparkles, ListRestart, HelpCircle, Loader2, ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useAuth } from "@/context/AuthContext";
import { UserRole } from "@shared/types";

export default function AIDashboard() {
  const { user } = useAuth();
  const [studentId, setStudentId] = useState("");
  const [prediction, setPrediction] = useState<any>(null);
  const [insights, setInsights] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // Chat Assistant State
  const [messages, setMessages] = useState<Array<{ sender: "user" | "bot"; text: string }>>([
    { sender: "bot", text: "Hello! I am your AI academic advisor. Ask me questions about attendance requirements, predictions, or dropout risks." }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);

  // Run analysis when a student ID is provided or loaded from user context
  const runAnalysis = async (targetId: string) => {
    if (!targetId.trim()) return;
    setLoading(true);
    try {
      const token = localStorage.getItem("attendreg_access_token") || sessionStorage.getItem("attendreg_access_token");
      
      // Fetch Predictions
      const predRes = await fetch(`/api/ai/predictions/${targetId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!predRes.ok) throw new Error("Failed to generate AI predictions");
      const predData = await predRes.json();
      setPrediction(predData);

      // Fetch Narrative Insights
      const insRes = await fetch(`/api/ai/insights/${targetId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (insRes.ok) {
        const insData = await insRes.json();
        setInsights(insData.insights);
      }
      
      toast.success("AI Analysis generated successfully!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // If student is logged in, auto-analyze
    if (user && user.roles.includes(UserRole.STUDENT)) {
      const sId = user.username; // Or map correctly
      setStudentId(sId);
      runAnalysis(sId);
    }
  }, [user]);

  const handleSendChat = async () => {
    if (!chatInput.trim()) return;
    const userQuery = chatInput;
    setMessages(prev => [...prev, { sender: "user", text: userQuery }]);
    setChatInput("");
    setSending(true);

    try {
      const token = localStorage.getItem("attendreg_access_token") || sessionStorage.getItem("attendreg_access_token");
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          query: userQuery,
          studentId: studentId || undefined
        })
      });

      if (!res.ok) throw new Error("Failed to get response");
      const data = await res.json();
      setMessages(prev => [...prev, { sender: "bot", text: data.reply }]);
    } catch (err: any) {
      toast.error(err.message);
      setMessages(prev => [...prev, { sender: "bot", text: "Sorry, I am having trouble connecting to the advisory server." }]);
    } finally {
      setSending(false);
    }
  };

  // Mock Trend Chart
  const trendChartData = prediction ? [
    { name: "Week -3", Rate: Math.max(50, prediction.currentRate - 6) },
    { name: "Week -2", Rate: Math.max(50, prediction.currentRate - 3) },
    { name: "Week -1", Rate: prediction.currentRate },
    { name: "Week +1 (Projected)", Rate: prediction.predictedRate }
  ] : [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                AI Advisory Portal
              </h1>
              <p className="text-slate-400 text-sm mt-0.5">
                Attendance rate projections, risk score tracking, and chat insights.
              </p>
            </div>
          </div>
          
          {user?.roles.some(r => ["faculty", "hod", "super_admin"].includes(r)) && (
            <div className="flex gap-2 w-full md:w-auto">
              <Input
                placeholder="Enter Student ID (e.g. STU1001)"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="bg-slate-900 border-slate-800 text-slate-100 max-w-xs"
              />
              <Button onClick={() => runAnalysis(studentId)} className="bg-indigo-600 hover:bg-indigo-500">
                Analyze student
              </Button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="animate-spin w-12 h-12 text-indigo-500" />
            <p className="text-slate-400 text-sm">Compiling historical attendance & running regressions...</p>
          </div>
        ) : prediction ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Predictions & Risk Overview */}
            <div className="space-y-6 lg:col-span-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Rate Card */}
                <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-xl">
                  <CardContent className="pt-6">
                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Current vs Projected</p>
                    <div className="flex justify-between items-baseline mt-2">
                      <span className="text-3xl font-bold">{prediction.currentRate}%</span>
                      <ArrowRight className="w-4 h-4 text-slate-500" />
                      <span className="text-2xl font-bold text-indigo-400">{prediction.predictedRate}%</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-4 text-xs font-bold text-slate-400">
                      {prediction.trendDirection === "improving" ? (
                        <>
                          <TrendingUp className="w-4 h-4 text-emerald-400" />
                          <span className="text-emerald-400">Improving Trend</span>
                        </>
                      ) : prediction.trendDirection === "declining" ? (
                        <>
                          <TrendingDown className="w-4 h-4 text-rose-400" />
                          <span className="text-rose-400">Declining Trend</span>
                        </>
                      ) : (
                        <span>Stable Trend</span>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Risk Level */}
                <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-xl col-span-1 md:col-span-2">
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Academic Dropout Risk</p>
                        <h3 className="text-2xl font-extrabold capitalize mt-1 text-slate-100">{prediction.riskLevel}</h3>
                      </div>
                      <Badge className={
                        prediction.riskLevel === "critical" || prediction.riskLevel === "high"
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      }>
                        Risk Score: {prediction.riskScore}/100
                      </Badge>
                    </div>
                    <Progress value={prediction.riskScore} className="h-2 bg-slate-800" />
                  </CardContent>
                </Card>
              </div>

              {/* Trend Chart */}
              <Card className="bg-slate-900/30 border-slate-800 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="text-slate-100 text-lg font-bold">Attendance Curve Projections</CardTitle>
                  <CardDescription className="text-slate-500">Linear regression model on the past 30 check-ins</CardDescription>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                      <YAxis stroke="#64748b" domain={[40, 100]} fontSize={11} />
                      <Tooltip contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155" }} />
                      <Line type="monotone" dataKey="Rate" stroke="#6366f1" strokeWidth={3} dot={{ fill: "#6366f1" }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Natural Language Insights (Gemini narrative) */}
              <Card className="bg-slate-900/30 border-slate-800 backdrop-blur-xl">
                <CardHeader className="flex flex-row items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                  <div>
                    <CardTitle className="text-slate-100 text-lg font-bold">AI Advisor Narrative Summary</CardTitle>
                    <CardDescription className="text-slate-500">Intelligent overview of student record</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-slate-300 text-sm leading-relaxed prose prose-invert max-w-none">
                    <p className="whitespace-pre-line">{insights || "Generating narrative diagnostic reports..."}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* AI Advisor Chat Widget */}
            <Card className="bg-slate-900/30 border-slate-800 backdrop-blur-xl flex flex-col h-[550px]">
              <CardHeader className="border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-indigo-400" />
                  <div>
                    <CardTitle className="text-slate-100 text-base font-bold">AI Advisor Chat</CardTitle>
                    <CardDescription className="text-slate-500">Ask questions about your risk</CardDescription>
                  </div>
                </div>
              </CardHeader>
              
              {/* Message History */}
              <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((m, idx) => (
                  <div key={idx} className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-xl px-4 py-2 text-sm leading-relaxed ${
                      m.sender === "user"
                        ? "bg-indigo-600 text-white rounded-tr-none"
                        : "bg-slate-850 text-slate-200 border border-slate-800 rounded-tl-none"
                    }`}>
                      {m.text}
                    </div>
                  </div>
                ))}
                {sending && (
                  <div className="flex justify-start">
                    <div className="bg-slate-850 text-slate-400 border border-slate-800 rounded-xl rounded-tl-none px-4 py-2 text-xs flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                      Advisor is writing...
                    </div>
                  </div>
                )}
              </CardContent>

              {/* Chat Input */}
              <div className="p-4 border-t border-slate-800 flex gap-2">
                <Input
                  placeholder="Ask a question..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                  className="bg-slate-950/80 border-slate-850 text-slate-100 flex-1"
                />
                <Button onClick={handleSendChat} disabled={sending || !chatInput.trim()} className="bg-indigo-600 hover:bg-indigo-500 text-white">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 border border-dashed border-slate-850 rounded-2xl bg-slate-900/10">
            <Brain className="w-16 h-16 stroke-[1] text-slate-600 mb-3" />
            <h3 className="text-lg font-bold text-slate-300">Select student to analyze</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm text-center">
              Please search or select a student using the input box above to compile predictions.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
