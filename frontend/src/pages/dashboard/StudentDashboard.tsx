/**
 * @file frontend/src/pages/dashboard/StudentDashboard.tsx
 * @description Premium student dashboard interface with attendance charts and streaks.
 */

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Calendar, CheckCircle, AlertTriangle, Flame,
  FileText, Clock, User, Compass, ArrowRight, ClipboardList
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";

export default function StudentDashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const token = localStorage.getItem("attendreg_access_token") || sessionStorage.getItem("attendreg_access_token");
        const res = await fetch("/api/dashboard/student", {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        if (!res.ok) {
          throw new Error("Failed to load student dashboard metrics");
        }
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-slate-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const attendance = data?.attendance || { percentage: 0, attendedCount: 0, absentCount: 0, totalClasses: 0 };
  const streak = data?.currentStreak || 0;
  
  const chartData = [
    { name: "Present", value: attendance.attendedCount, color: "#10b981" },
    { name: "Absent", value: attendance.absentCount, color: "#f43f5e" }
  ];

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
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              Student Dashboard
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Welcome back, {data?.profile?.name || user?.name || "Student"} | ID: {data?.profile?.studentId}
            </p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => navigate("/profile/student")} variant="outline" className="border-slate-800 bg-slate-900/50 text-slate-300 hover:bg-slate-800">
              <User className="w-4 h-4 mr-2" /> View Profile
            </Button>
            <Button onClick={() => navigate("/attendance")} className="bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-lg shadow-blue-500/20">
              Check Attendance <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </motion.div>

        {/* Dashboard Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {/* Card 1: Streaks */}
          <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-xl">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Attendance Streak</p>
                  <h3 className="text-3xl font-bold text-slate-100">{streak} Days</h3>
                  <p className="text-slate-500 text-xs mt-1">Keep it up!</p>
                </div>
                <div className="bg-amber-500/10 p-3 rounded-2xl border border-amber-500/20">
                  <Flame className="w-6 h-6 text-amber-500 fill-amber-500 animate-pulse" />
                </div>
              </div>
              {streak >= 3 && (
                <div className="mt-4 flex items-center gap-1.5 px-3 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold w-fit">
                  🔥 On Fire!
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card 2: Attendance Rate */}
          <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-xl col-span-1 md:col-span-2">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start mb-4">
                <div className="space-y-1 w-full mr-4">
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Overall Attendance Rate</p>
                  <h3 className="text-3xl font-bold text-slate-100">{attendance.percentage}%</h3>
                  <Progress value={attendance.percentage} className="h-2 bg-slate-800 mt-2" />
                </div>
                <div className={`${attendance.percentage >= 75 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-rose-500/10 border-rose-500/20 text-rose-500"} p-3 rounded-2xl border`}>
                  {attendance.percentage >= 75 ? <CheckCircle className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                </div>
              </div>
              <p className="text-slate-500 text-xs">
                {attendance.percentage >= 75 
                  ? "Great! You are meeting the academic threshold of 75%." 
                  : "Warning: Your attendance is below the mandatory 75% threshold."}
              </p>
            </CardContent>
          </Card>

          {/* Card 3: Classes info */}
          <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-xl">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Classes</p>
                  <h3 className="text-3xl font-bold text-slate-100">{attendance.totalClasses}</h3>
                  <div className="flex gap-3 text-xs mt-2 text-slate-400">
                    <span className="text-emerald-400">Attended: {attendance.attendedCount}</span>
                    <span className="text-rose-400">Missed: {attendance.absentCount}</span>
                  </div>
                </div>
                <div className="bg-blue-500/10 p-3 rounded-2xl border border-blue-500/20">
                  <Compass className="w-6 h-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Dashboard Charts & Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Pie Chart Representation */}
          <Card className="bg-slate-900/30 border-slate-800 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-slate-100 text-lg font-bold">Attendance Distribution</CardTitle>
              <CardDescription className="text-slate-500">Visual attendance breakdown</CardDescription>
            </CardHeader>
            <CardContent className="h-64 flex flex-col justify-center items-center">
              {attendance.totalClasses > 0 ? (
                <ResponsiveContainer width="100%" height="80%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155" }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-slate-500 text-sm">No class records available</p>
              )}
              <div className="flex justify-center gap-6 mt-4 text-xs font-medium text-slate-400">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span>Present ({attendance.attendedCount})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-rose-500" />
                  <span>Absent ({attendance.absentCount})</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Leaves and Corrections */}
          <Card className="bg-slate-900/30 border-slate-800 backdrop-blur-xl lg:col-span-2">
            <CardHeader className="flex flex-row justify-between items-center">
              <div>
                <CardTitle className="text-slate-100 text-lg font-bold">Leave Requests & Corrections</CardTitle>
                <CardDescription className="text-slate-500">Recently filed requests</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {data?.recentLeaves?.length === 0 && data?.recentCorrections?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <FileText className="w-12 h-12 stroke-[1.5] mb-2" />
                  <p className="text-sm">No leave requests or corrections filed.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {data?.recentLeaves?.map((leave: any) => (
                    <div key={leave.id} className="flex justify-between items-center p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="border-blue-500/30 text-blue-400 capitalize bg-blue-500/5">
                            {leave.type} Leave
                          </Badge>
                          <span className="text-xs text-slate-500">
                            {new Date(leave.fromDate).toLocaleDateString()} - {new Date(leave.toDate).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-slate-300 line-clamp-1">{leave.reason}</p>
                      </div>
                      <Badge className={
                        leave.status === "approved" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                        leave.status === "rejected" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
                        "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      }>
                        {leave.status}
                      </Badge>
                    </div>
                  ))}
                  {data?.recentCorrections?.map((c: any) => (
                    <div key={c.id} className="flex justify-between items-center p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="border-purple-500/30 text-purple-400 bg-purple-500/5">
                            Correction Request
                          </Badge>
                          <span className="text-xs text-slate-500">
                            Session #{c.sessionId}
                          </span>
                        </div>
                        <p className="text-sm text-slate-300 line-clamp-1">Change status to: <span className="capitalize font-semibold text-slate-100">{c.requestedStatus}</span></p>
                      </div>
                      <Badge className={
                        c.status === "approved" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                        c.status === "rejected" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
                        "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      }>
                        {c.status}
                      </Badge>
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
