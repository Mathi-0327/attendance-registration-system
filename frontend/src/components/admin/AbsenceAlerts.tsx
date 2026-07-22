import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, RefreshCw, TrendingDown, Users, ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";

interface AlertEntry {
  studentId: string;
  name: string;
  department: string;
  attended: number;
  totalSessions: number;
  rate: number;
  status: "warning" | "critical";
}

export function AbsenceAlerts() {
  const [alerts, setAlerts] = useState<AlertEntry[]>([]);
  const [totalSessions, setTotalSessions] = useState(0);
  const [threshold, setThreshold] = useState(75);
  const [inputThreshold, setInputThreshold] = useState("75");
  const [loading, setLoading] = useState(false);

  const fetchAlerts = async (t = threshold) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/absence-alerts?threshold=${t}`);
      if (!res.ok) throw new Error("Failed to fetch alerts");
      const data = await res.json();
      setAlerts(data.alerts || []);
      setTotalSessions(data.totalSessions || 0);
    } catch (err) {
      console.error("Error fetching absence alerts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const handleApplyThreshold = () => {
    const t = parseInt(inputThreshold);
    if (isNaN(t) || t < 1 || t > 100) return;
    setThreshold(t);
    fetchAlerts(t);
  };

  const criticalCount = alerts.filter((a) => a.status === "critical").length;
  const warningCount = alerts.filter((a) => a.status === "warning").length;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-slate-50 dark:bg-slate-900">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 dark:bg-blue-900/40 p-2 rounded-lg">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Sessions</p>
                <p className="text-2xl font-bold">{totalSessions}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="bg-orange-100 dark:bg-orange-900/40 p-2 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Warning (&lt;{threshold}%)</p>
                <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">{warningCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="bg-red-100 dark:bg-red-900/40 p-2 rounded-lg">
                <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Critical (&lt;50%)</p>
                <p className="text-2xl font-bold text-red-700 dark:text-red-400">{criticalCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Threshold control */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-orange-500" />
              At-Risk Students
            </CardTitle>
            <CardDescription>
              Students with attendance below the threshold are flagged here
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm whitespace-nowrap">Threshold %</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={inputThreshold}
              onChange={(e) => setInputThreshold(e.target.value)}
              className="w-20 h-9"
            />
            <Button size="sm" onClick={handleApplyThreshold} className="h-9">
              Apply
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchAlerts(threshold)}
              disabled={loading}
              className="h-9 gap-1"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {totalSessions === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">No completed sessions yet</p>
              <p className="text-sm mt-1">Absence alerts will appear after sessions are closed</p>
            </div>
          ) : loading ? (
            <div className="text-center py-12 text-muted-foreground">
              <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin" />
              <p>Loading alerts...</p>
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="mx-auto w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="font-medium text-emerald-700 dark:text-emerald-400">All students are above {threshold}%</p>
              <p className="text-sm mt-1">No attendance alerts at this threshold</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Attended</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alerts.map((alert, i) => (
                    <motion.tr
                      key={alert.studentId}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="border-b transition-colors hover:bg-muted/50"
                    >
                      <TableCell className="font-medium">{alert.name}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">{alert.studentId}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{alert.department || "N/A"}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {alert.attended} / {alert.totalSessions}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-muted rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full transition-all ${
                                alert.rate < 50
                                  ? "bg-red-500"
                                  : "bg-orange-400"
                              }`}
                              style={{ width: `${alert.rate}%` }}
                            />
                          </div>
                          <span className={`text-sm font-semibold ${
                            alert.rate < 50
                              ? "text-red-600 dark:text-red-400"
                              : "text-orange-600 dark:text-orange-400"
                          }`}>
                            {alert.rate}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            alert.status === "critical"
                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200"
                              : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200"
                          }
                          variant="outline"
                        >
                          {alert.status === "critical" ? "⚠ Critical" : "⚡ Warning"}
                        </Badge>
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
