/**
 * @file frontend/src/pages/dashboard/FacultyDashboard.tsx
 * @description Premium faculty dashboard interface.
 * Implements real-time session toggling, QR code display, and pending approvals management.
 */

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Users, Clock, Play, Square, Check, X,
  FileCheck, Calendar, Bell, Loader2, ArrowRight, Scan, Shield
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { QRCodeSVG } from "qrcode.react";

export default function FacultyDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Active session controls
  const [sessionName, setSessionName] = useState("");
  const [lateThreshold, setLateThreshold] = useState("15");
  const [toggling, setToggling] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const fetchDashboard = async () => {
    try {
      const token = localStorage.getItem("attendreg_access_token") || sessionStorage.getItem("attendreg_access_token");
      const res = await fetch("/api/dashboard/faculty", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) {
        throw new Error("Failed to load faculty metrics");
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleToggleSession = async () => {
    setToggling(true);
    try {
      const res = await fetch("/api/session/toggle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: sessionName,
          lateThresholdMinutes: parseInt(lateThreshold, 10),
        }),
      });

      if (!res.ok) throw new Error("Failed to toggle session");
      const result = await res.json();
      
      if (result.active) {
        toast.success("Attendance session successfully started!");
      } else {
        toast.success("Attendance session successfully stopped.");
      }
      
      setSessionName("");
      fetchDashboard();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setToggling(false);
    }
  };

  const handleApproveLeave = async (id: number, status: "approved" | "rejected") => {
    setProcessingId(id);
    try {
      const token = localStorage.getItem("attendreg_access_token") || sessionStorage.getItem("attendreg_access_token");
      const res = await fetch(`/api/v2/leave/${id}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          status,
          remarks: `${status.charAt(0).toUpperCase() + status.slice(1)} by Faculty`
        }),
      });

      if (!res.ok) throw new Error("Failed to process leave request");
      toast.success(`Leave request successfully ${status}!`);
      fetchDashboard();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleApproveCorrection = async (id: number, status: "approved" | "rejected") => {
    setProcessingId(id);
    try {
      const token = localStorage.getItem("attendreg_access_token") || sessionStorage.getItem("attendreg_access_token");
      const res = await fetch(`/api/v2/correction/${id}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          status,
          remarks: `${status.charAt(0).toUpperCase() + status.slice(1)} by Faculty`
        }),
      });

      if (!res.ok) throw new Error("Failed to process correction request");
      toast.success(`Correction request successfully ${status}!`);
      fetchDashboard();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-slate-100">
        <Loader2 className="animate-spin rounded-full h-12 w-12 text-blue-500" />
      </div>
    );
  }

  const activeSession = data?.activeSession;
  const stats = data?.stats || { totalSessions: 0, avgAttendance: 0, pendingLeaves: 0, pendingCorrections: 0 };
  const currentUrl = `${window.location.protocol}//${window.location.host}/attendance`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8"
        >
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
              Faculty Console
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Welcome back, {user?.name || "Professor"} | Institution: AttendReg Academic Portal
            </p>
          </div>
        </motion.div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-xl">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Sessions</p>
                  <h3 className="text-3xl font-bold text-slate-100">{stats.totalSessions}</h3>
                </div>
                <div className="bg-blue-500/10 p-3 rounded-2xl border border-blue-500/20 text-blue-500">
                  <Calendar className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-xl">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Avg Attendance Rate</p>
                  <h3 className="text-3xl font-bold text-slate-100">{stats.avgAttendance}%</h3>
                </div>
                <div className="bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/20 text-emerald-500">
                  <Users className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-xl">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Pending Leaves</p>
                  <h3 className="text-3xl font-bold text-slate-100">{stats.pendingLeaves}</h3>
                </div>
                <div className="bg-amber-500/10 p-3 rounded-2xl border border-amber-500/20 text-amber-500">
                  <Bell className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-xl">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Pending Corrections</p>
                  <h3 className="text-3xl font-bold text-slate-100">{stats.pendingCorrections}</h3>
                </div>
                <div className="bg-purple-500/10 p-3 rounded-2xl border border-purple-500/20 text-purple-500">
                  <FileCheck className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Toggling Console */}
          <Card className="bg-slate-900/30 border-slate-800 backdrop-blur-xl lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-slate-100 text-lg font-bold">Session Controller</CardTitle>
              <CardDescription className="text-slate-500">Manage real-time Wi-Fi attendance check-ins</CardDescription>
            </CardHeader>
            <CardContent>
              {activeSession ? (
                <div className="flex flex-col md:flex-row gap-6 items-center">
                  <div className="bg-white p-4 rounded-xl shadow-lg border border-slate-200">
                    <QRCodeSVG value={currentUrl} size={150} />
                  </div>
                  <div className="space-y-4 flex-1">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse">ACTIVE</Badge>
                        <h4 className="text-slate-100 font-bold text-lg">{activeSession.name || "Live Session"}</h4>
                      </div>
                      <p className="text-slate-400 text-xs">Started at: {new Date(activeSession.startTime).toLocaleTimeString()}</p>
                    </div>
                    
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-400">
                      <Shield className="w-4 h-4 text-blue-500" />
                      <span>Lock: {activeSession.authorizedIp || "None"} (Wi-Fi match required)</span>
                    </div>

                    <Button onClick={handleToggleSession} disabled={toggling} className="w-full md:w-auto bg-rose-600 hover:bg-rose-500 text-white font-semibold">
                      {toggling ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Square className="w-4 h-4 mr-2" />}
                      End Session
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="session-name">Session Name</Label>
                      <Input
                        id="session-name"
                        type="text"
                        placeholder="e.g. CS-401 Lecture"
                        value={sessionName}
                        onChange={(e) => setSessionName(e.target.value)}
                        className="bg-slate-950/80 border-slate-800 text-slate-100"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="late-threshold">Late Threshold (mins)</Label>
                      <Input
                        id="late-threshold"
                        type="number"
                        min="1"
                        placeholder="15"
                        value={lateThreshold}
                        onChange={(e) => setLateThreshold(e.target.value)}
                        className="bg-slate-950/80 border-slate-800 text-slate-100"
                      />
                    </div>
                  </div>
                  <Button onClick={handleToggleSession} disabled={toggling} className="bg-blue-600 hover:bg-blue-500 text-white font-semibold">
                    {toggling ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                    Start Attendance Session
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats list */}
          <Card className="bg-slate-900/30 border-slate-800 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-slate-100 text-lg font-bold">Recent History</CardTitle>
              <CardDescription className="text-slate-500">Your recent lectures</CardDescription>
            </CardHeader>
            <CardContent>
              {data?.recentSessions?.length === 0 ? (
                <p className="text-slate-500 text-sm py-4">No recent sessions found.</p>
              ) : (
                <div className="space-y-3">
                  {data?.recentSessions?.map((s: any) => (
                    <div key={s.id} className="flex justify-between items-center p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                      <div>
                        <h5 className="text-sm font-semibold text-slate-200 line-clamp-1">{s.name || `Session #${s.id}`}</h5>
                        <p className="text-xs text-slate-500">{new Date(s.startTime).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-emerald-400 font-bold block">{s.presentCount || 0} Present</span>
                        <span className="text-[10px] text-slate-500">{s.absentCount || 0} Absent</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Approvals console */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Leaves approvals console */}
          <Card className="bg-slate-900/30 border-slate-800 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-slate-100 text-lg font-bold">Leave Requests</CardTitle>
              <CardDescription className="text-slate-500">Requires academic review</CardDescription>
            </CardHeader>
            <CardContent>
              {data?.leavesPending?.length === 0 ? (
                <p className="text-slate-500 text-sm py-6">No pending leaves to approve.</p>
              ) : (
                <div className="space-y-3">
                  {data?.leavesPending?.map((l: any) => (
                    <div key={l.id} className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800 flex flex-col gap-3">
                      <div>
                        <div className="flex justify-between items-start">
                          <span className="text-sm font-bold text-slate-200">ID: {l.studentId}</span>
                          <Badge variant="secondary" className="capitalize text-slate-300 border-slate-700 bg-slate-800">{l.type}</Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Date: {new Date(l.fromDate).toLocaleDateString()} - {new Date(l.toDate).toLocaleDateString()}</p>
                        <p className="text-sm text-slate-300 mt-2 italic">"{l.reason}"</p>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          onClick={() => handleApproveLeave(l.id, "approved")}
                          disabled={processingId !== null}
                          size="sm" 
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex-1"
                        >
                          <Check className="w-4 h-4 mr-1" /> Approve
                        </Button>
                        <Button 
                          onClick={() => handleApproveLeave(l.id, "rejected")}
                          disabled={processingId !== null}
                          size="sm" 
                          variant="destructive"
                          className="font-medium flex-1"
                        >
                          <X className="w-4 h-4 mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Corrections approvals console */}
          <Card className="bg-slate-900/30 border-slate-800 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-slate-100 text-lg font-bold">Attendance Corrections</CardTitle>
              <CardDescription className="text-slate-500">Requires attendance review</CardDescription>
            </CardHeader>
            <CardContent>
              {data?.correctionsPending?.length === 0 ? (
                <p className="text-slate-500 text-sm py-6">No pending corrections to approve.</p>
              ) : (
                <div className="space-y-3">
                  {data?.correctionsPending?.map((c: any) => (
                    <div key={c.id} className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800 flex flex-col gap-3">
                      <div>
                        <div className="flex justify-between items-start">
                          <span className="text-sm font-bold text-slate-200">ID: {c.studentId}</span>
                          <span className="text-xs text-slate-400">Session #{c.sessionId}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Requested Change: <span className="capitalize line-through text-rose-400">{c.currentStatus}</span> → <span className="capitalize text-emerald-400 font-bold">{c.requestedStatus}</span></p>
                        <p className="text-sm text-slate-300 mt-2 italic">"{c.reason}"</p>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          onClick={() => handleApproveCorrection(c.id, "approved")}
                          disabled={processingId !== null}
                          size="sm" 
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex-1"
                        >
                          <Check className="w-4 h-4 mr-1" /> Approve
                        </Button>
                        <Button 
                          onClick={() => handleApproveCorrection(c.id, "rejected")}
                          disabled={processingId !== null}
                          size="sm" 
                          variant="destructive"
                          className="font-medium flex-1"
                        >
                          <X className="w-4 h-4 mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
