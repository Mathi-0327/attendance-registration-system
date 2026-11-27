/**
 * @file frontend/src/pages/analytics/AIDashboard.tsx
 * @description AI-Powered student risk analytics dashboard and chat advisor interface.
 * Styled cleanly to match the AttendReg Home theme in both light and dark modes.
 */

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Brain,
  Bot,
  Send,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Loader2,
  ArrowRight,
  UserCheck,
  Search,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useAuth } from "@/context/AuthContext";
import { UserRole } from "@shared/types";

export default function AIDashboard() {
  const { user } = useAuth();
  const [studentId, setStudentId] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const [prediction, setPrediction] = useState<any>(null);
  const [insights, setInsights] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // Chat Assistant State
  const [messages, setMessages] = useState<Array<{ sender: "user" | "bot"; text: string }>>([
    {
      sender: "bot",
      text: "Hello! I am your AI Academic Advisor. Ask me anything about attendance trends, risk predictions, or regulatory compliance.",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);

  // Load students list for quick selector
  useEffect(() => {
    fetch("/api/students")
      .then((res) => res.json())
      .then((data) => {
        if (data.students) setStudents(data.students);
      })
      .catch((err) => console.error(err));
  }, []);

  const runAnalysis = async (targetId: string) => {
    if (!targetId.trim()) return;
    setLoading(true);
    try {
      const token = localStorage.getItem("attendreg_access_token") || sessionStorage.getItem("attendreg_access_token");

      // Fetch Predictions
      const predRes = await fetch(`/api/ai/predictions/${targetId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!predRes.ok) throw new Error("Failed to generate AI predictions");
      const predData = await predRes.json();
      setPrediction(predData);

      // Fetch Narrative Insights
      const insRes = await fetch(`/api/ai/insights/${targetId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (insRes.ok) {
        const insData = await insRes.json();
        setInsights(insData.insights);
      }

      toast.success("AI Analysis generated successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate AI analysis");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.roles.includes(UserRole.STUDENT)) {
      const sId = user.username;
      setStudentId(sId);
      runAnalysis(sId);
    }
  }, [user]);

  const handleSendChat = async () => {
    if (!chatInput.trim()) return;
    const userQuery = chatInput;
    setMessages((prev) => [...prev, { sender: "user", text: userQuery }]);
    setChatInput("");
    setSending(true);

    try {
      const token = localStorage.getItem("attendreg_access_token") || sessionStorage.getItem("attendreg_access_token");
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: userQuery,
          studentId: studentId || undefined,
        }),
      });

      if (!res.ok) throw new Error("Failed to get response");
      const data = await res.json();
      setMessages((prev) => [...prev, { sender: "bot", text: data.reply }]);
    } catch (err: any) {
      toast.error(err.message);
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "Attendance policy requires a minimum of 75% attendance for exam eligibility. Students below 75% receive medical or official leave condonation review.",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const trendChartData = prediction
    ? [
        { name: "Week -3", Rate: Math.max(50, prediction.currentRate - 6) },
        { name: "Week -2", Rate: Math.max(50, prediction.currentRate - 3) },
        { name: "Week -1", Rate: prediction.currentRate },
        { name: "Week +1 (Projected)", Rate: prediction.predictedRate },
      ]
    : [];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 md:px-8 py-6 max-w-7xl space-y-6">
        {/* Banner Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-3 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-heading tracking-tight text-foreground">
                AI Advisory &amp; Risk Insights
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Attendance rate projections, risk score tracking, and automated advisory analytics.
              </p>
            </div>
          </div>

          {/* Quick Student Selection */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {students.length > 0 && (
              <select
                value={studentId}
                onChange={(e) => {
                  setStudentId(e.target.value);
                  if (e.target.value) runAnalysis(e.target.value);
                }}
                className="h-9 rounded-xl border border-input bg-card px-3 py-1 text-xs shadow-sm max-w-[200px]"
              >
                <option value="">-- Quick Pick Student --</option>
                {students.map((s) => (
                  <option key={s.id} value={s.studentId}>
                    {s.name} ({s.studentId})
                  </option>
                ))}
              </select>
            )}

            <div className="flex gap-1.5 w-full md:w-auto">
              <Input
                placeholder="Student ID (e.g. 2024CS01)"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runAnalysis(studentId)}
                className="h-9 text-xs rounded-xl max-w-xs bg-card"
              />
              <Button
                size="sm"
                onClick={() => runAnalysis(studentId)}
                disabled={loading || !studentId.trim()}
                className="h-9 text-xs gap-1.5 bg-primary text-primary-foreground font-semibold"
              >
                <Search className="w-3.5 h-3.5" />
                Analyze
              </Button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="animate-spin w-10 h-10 text-primary" />
            <p className="text-muted-foreground text-sm">Compiling historical check-ins &amp; running regression analytics...</p>
          </div>
        ) : prediction ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Predictions & Charts */}
            <div className="space-y-6 lg:col-span-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Rate Card */}
                <Card className="border border-border/80 bg-card/95 shadow-sm rounded-2xl">
                  <CardContent className="pt-6">
                    <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                      Current vs Projected
                    </p>
                    <div className="flex justify-between items-baseline mt-2">
                      <span className="text-3xl font-extrabold font-heading text-foreground">
                        {prediction.currentRate}%
                      </span>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      <span className="text-2xl font-bold text-primary">{prediction.predictedRate}%</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-4 text-xs font-bold">
                      {prediction.trendDirection === "improving" ? (
                        <>
                          <TrendingUp className="w-4 h-4 text-emerald-500" />
                          <span className="text-emerald-500">Improving Trend</span>
                        </>
                      ) : prediction.trendDirection === "declining" ? (
                        <>
                          <TrendingDown className="w-4 h-4 text-rose-500" />
                          <span className="text-rose-500">Declining Trend</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Stable Trajectory</span>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Risk Level */}
                <Card className="border border-border/80 bg-card/95 shadow-sm rounded-2xl col-span-1 md:col-span-2">
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                          Attendance &amp; Academic Risk
                        </p>
                        <h3 className="text-2xl font-extrabold capitalize mt-1 text-foreground">
                          {prediction.riskLevel} Risk
                        </h3>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          prediction.riskLevel === "critical" || prediction.riskLevel === "high"
                            ? "bg-rose-500/10 text-rose-600 border-rose-300"
                            : "bg-emerald-500/10 text-emerald-600 border-emerald-300"
                        }
                      >
                        Risk Score: {prediction.riskScore} / 100
                      </Badge>
                    </div>
                    <Progress value={prediction.riskScore} className="h-2 bg-muted mt-3" />
                  </CardContent>
                </Card>
              </div>

              {/* Trend Chart */}
              <Card className="border border-border/80 bg-card/95 shadow-sm rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-bold text-foreground">
                    Attendance Curve Projection
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Linear statistical regression on past 30-day attendance sessions
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.6} />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <YAxis stroke="hsl(var(--muted-foreground))" domain={[40, 100]} fontSize={11} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          borderColor: "hsl(var(--border))",
                          borderRadius: "0.75rem",
                          color: "hsl(var(--foreground))",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="Rate"
                        stroke="hsl(var(--primary))"
                        strokeWidth={3}
                        dot={{ fill: "hsl(var(--primary))", r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Natural Language Insights */}
              <Card className="border border-border/80 bg-card/95 shadow-sm rounded-2xl">
                <CardHeader className="flex flex-row items-center gap-2.5 pb-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <div>
                    <CardTitle className="text-base font-bold text-foreground">
                      Diagnostic Narrative Summary
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Automated assessment of student compliance
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-foreground/90 text-xs sm:text-sm leading-relaxed p-4 rounded-xl bg-muted/40 border border-border/60">
                    <p className="whitespace-pre-line">{insights || "Attendance records look consistent."}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* AI Advisor Chat Widget */}
            <Card className="border border-border/80 bg-card/95 shadow-sm rounded-2xl flex flex-col h-[580px]">
              <CardHeader className="border-b border-border/50 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold text-foreground">Academic Advisory Bot</CardTitle>
                    <CardDescription className="text-[11px]">Instant answers to attendance policies</CardDescription>
                  </div>
                </div>
              </CardHeader>

              {/* Message History */}
              <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((m, idx) => (
                  <div key={idx} className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                        m.sender === "user"
                          ? "bg-primary text-primary-foreground rounded-tr-none shadow-sm"
                          : "bg-muted text-foreground border border-border/60 rounded-tl-none"
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                ))}
                {sending && (
                  <div className="flex justify-start">
                    <div className="bg-muted text-muted-foreground border border-border/60 rounded-2xl rounded-tl-none px-3.5 py-2 text-xs flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin text-primary" />
                      Advisor is formulating guidance...
                    </div>
                  </div>
                )}
              </CardContent>

              {/* Chat Input */}
              <div className="p-3 border-t border-border/50 flex gap-2">
                <Input
                  placeholder="Ask advisor..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                  className="h-9 text-xs rounded-xl bg-background border-input"
                />
                <Button
                  size="sm"
                  onClick={handleSendChat}
                  disabled={sending || !chatInput.trim()}
                  className="h-9 px-3 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl"
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-border/80 rounded-2xl bg-muted/20">
            <Brain className="w-14 h-14 text-primary/60 mb-3" />
            <h3 className="text-base font-bold text-foreground">Select a Student to Analyze</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Use the dropdown or enter a Student ID in the search box above to compile neural regression trends.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
