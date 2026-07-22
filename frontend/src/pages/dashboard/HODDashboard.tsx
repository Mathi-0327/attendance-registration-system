/**
 * @file frontend/src/pages/dashboard/HODDashboard.tsx
 * @description HOD (Head of Department) dashboard view.
 */

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Users, AlertTriangle, Compass, TrendingUp,
  Mail, Phone, BookOpen, Loader2
} from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function HODDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHodData() {
      try {
        const token = localStorage.getItem("attendreg_access_token") || sessionStorage.getItem("attendreg_access_token");
        const res = await fetch("/api/dashboard/hod", {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        if (!res.ok) {
          throw new Error("Failed to load department dashboard");
        }
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchHodData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-slate-100">
        <Loader2 className="animate-spin rounded-full h-12 w-12 text-blue-500" />
      </div>
    );
  }

  const stats = data?.stats || { totalStudents: 0, activeSessions: 0, atRiskCount: 0, avgAttendance: 85 };
  const mockChartData = [
    { name: "Sem 1", Attendance: 86 },
    { name: "Sem 3", Attendance: 82 },
    { name: "Sem 5", Attendance: 85 },
    { name: "Sem 7", Attendance: 79 },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">
            Department Console
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Department: Computer Science & Engineering | Academic Year: 2026
          </p>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-xl">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Students</p>
                  <h3 className="text-3xl font-bold text-slate-100">{stats.totalStudents}</h3>
                </div>
                <div className="bg-blue-500/10 p-3 rounded-2xl border border-blue-500/20 text-blue-500">
                  <Users className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-xl">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Active Lectures</p>
                  <h3 className="text-3xl font-bold text-slate-100">{stats.activeSessions}</h3>
                </div>
                <div className="bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/20 text-emerald-500">
                  <Compass className="w-6 h-6 animate-spin" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-xl">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Students At Risk</p>
                  <h3 className="text-3xl font-bold text-slate-100">{stats.atRiskCount}</h3>
                </div>
                <div className="bg-rose-500/10 p-3 rounded-2xl border border-rose-500/20 text-rose-500">
                  <AlertTriangle className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-xl">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Department Avg</p>
                  <h3 className="text-3xl font-bold text-slate-100">{stats.avgAttendance}%</h3>
                </div>
                <div className="bg-teal-500/10 p-3 rounded-2xl border border-teal-500/20 text-teal-500">
                  <TrendingUp className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts & Lists */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="bg-slate-900/30 border-slate-800 backdrop-blur-xl lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-slate-100 text-lg font-bold">At-Risk Students List</CardTitle>
              <CardDescription className="text-slate-500">Students whose attendance rate is below 75%</CardDescription>
            </CardHeader>
            <CardContent>
              {data?.atRiskStudents?.length === 0 ? (
                <p className="text-slate-500 text-sm py-4">No at-risk students flagged in your department.</p>
              ) : (
                <div className="space-y-4">
                  {data?.atRiskStudents?.map((s: any) => (
                    <div key={s.id} className="flex justify-between items-center p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                      <div>
                        <h4 className="text-sm font-bold text-slate-200">{s.studentId}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">Risk Level: <span className="text-rose-400 font-bold capitalize">{s.riskLevel}</span></p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="text-sm font-bold text-rose-400">{s.currentRate || s.predictedRate}%</span>
                          <span className="text-[10px] text-slate-500 block">Attendance</span>
                        </div>
                        <Badge className="bg-rose-500/10 text-rose-400 border border-rose-500/20">ALERT SENT</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recharts comparison */}
          <Card className="bg-slate-900/30 border-slate-800 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-slate-100 text-lg font-bold">Semester-Wise Breakdown</CardTitle>
              <CardDescription className="text-slate-500">Average attendance by semester</CardDescription>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={mockChartData}>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                  <Tooltip contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155" }} />
                  <Bar dataKey="Attendance" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
