/**
 * @file frontend/src/pages/dashboard/ParentDashboard.tsx
 * @description Parent portal view showing child's academic attendance.
 */

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  User, CheckCircle, AlertTriangle, Calendar, Clock, Loader2
} from "lucide-react";
import { toast } from "sonner";

export default function ParentDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchParentData() {
      try {
        const token = localStorage.getItem("attendreg_access_token") || sessionStorage.getItem("attendreg_access_token");
        const res = await fetch("/api/dashboard/parent", {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        if (!res.ok) {
          throw new Error("Failed to load parent metrics");
        }
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchParentData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-slate-100">
        <Loader2 className="animate-spin rounded-full h-12 w-12 text-blue-500" />
      </div>
    );
  }

  const childName = data?.studentName || "Linked Student";
  const childId = data?.studentId || "N/A";
  const stats = data?.stats || { totalClasses: 0, presentCount: 0, absentCount: 0, rate: 0 };
  const recentRecords = data?.recentRecords || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-pink-400 to-rose-400 bg-clip-text text-transparent">
            Parent Portal
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Monitoring attendance for student: <span className="text-slate-200 font-semibold">{childName}</span> ({childId})
          </p>
        </div>

        {/* stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-xl">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Attendance Rate</p>
                  <h3 className="text-3xl font-bold text-slate-100">{stats.rate}%</h3>
                  <Progress value={stats.rate} className="h-2 bg-slate-800 mt-2" />
                </div>
                <div className={`${stats.rate >= 75 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-rose-500/10 border-rose-500/20 text-rose-500"} p-3 rounded-2xl border`}>
                  {stats.rate >= 75 ? <CheckCircle className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-xl">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Classes Attended</p>
                  <h3 className="text-3xl font-bold text-emerald-400">{stats.presentCount}</h3>
                  <p className="text-slate-500 text-xs mt-1">Out of {stats.totalClasses} total</p>
                </div>
                <div className="bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/20 text-emerald-500">
                  <Calendar className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-xl">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Classes Missed</p>
                  <h3 className="text-3xl font-bold text-rose-400">{stats.absentCount}</h3>
                  <p className="text-slate-500 text-xs mt-1">Requires correction check</p>
                </div>
                <div className="bg-rose-500/10 p-3 rounded-2xl border border-rose-500/20 text-rose-500">
                  <Clock className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* list of recent check-ins */}
        <Card className="bg-slate-900/30 border-slate-800 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-slate-100 text-lg font-bold">Recent Attendance Logs</CardTitle>
            <CardDescription className="text-slate-500">History of class attendance markings</CardDescription>
          </CardHeader>
          <CardContent>
            {recentRecords.length === 0 ? (
              <p className="text-slate-500 text-sm py-4">No recent attendance records found.</p>
            ) : (
              <div className="divide-y divide-slate-800">
                {recentRecords.map((r: any) => (
                  <div key={r.id} className="flex justify-between items-center py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <h5 className="text-sm font-semibold text-slate-200">Session #{r.sessionId}</h5>
                        <p className="text-xs text-slate-500">{new Date(r.markedAt).toLocaleString()}</p>
                      </div>
                    </div>
                    <Badge className={
                      r.status === "present" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                      r.status === "late" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                      "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                    }>
                      {r.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
