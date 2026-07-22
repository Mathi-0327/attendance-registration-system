/**
 * @file frontend/src/pages/attendance.tsx
 * @description Phase 4 Enhanced Attendance Page.
 * 3-tab layout: Mark Attendance | Request Leave | My Attendance Summary
 * Preserves all legacy behavior while adding subject selector, geo-fencing,
 * leave requests, and personal attendance summary.
 */

import { useSystem } from "@/context/SystemContext";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Wifi,
  Lock,
  AlertCircle,
  WifiOff,
  BookOpen,
  MapPin,
  CalendarDays,
  BarChart3,
  ChevronRight,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { SubjectSelector } from "@/components/attendance/SubjectSelector";
import { GeoFenceIndicator } from "@/components/attendance/GeoFenceIndicator";
import { LeaveRequestForm } from "@/components/attendance/LeaveRequestForm";
import { AttendanceSummaryCard } from "@/components/attendance/AttendanceSummaryCard";

// ─────────────────────────────────────────────
// FORM SCHEMA
// ─────────────────────────────────────────────

const formSchema = z.object({
  name: z.string().min(2, "Name is required"),
  studentId: z.string().min(3, "ID is required"),
  department: z.string().optional(),
});

// ─────────────────────────────────────────────
// ACTIVE SESSION BANNER
// ─────────────────────────────────────────────

interface SessionInfo {
  id: number;
  name?: string;
  subjectId?: number;
  geoFenceLatitude?: number;
  geoFenceLongitude?: number;
  geoFenceRadius?: number;
  attendanceMode?: string;
}

// ─────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────

export default function Attendance() {
  const { sessionActive, markAttendance } = useSystem();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<{
    allowed: boolean;
    message: string;
    clientIp?: string;
    serverIp?: string;
  } | null>(null);
  const [student, setStudent] = useState<any>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | undefined>(undefined);
  const [gpsCoords, setGpsCoords] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
  } | null>(null);
  const [activeTab, setActiveTab] = useState("mark");
  const [v2Session, setV2Session] = useState<SessionInfo | null>(null);
  const [leaveRefreshKey, setLeaveRefreshKey] = useState(0);

  // Load student from localStorage
  useEffect(() => {
    const savedStudent = localStorage.getItem("student_data");
    const savedAuth = localStorage.getItem("student_authenticated");
    if (savedStudent && savedAuth === "true") {
      try {
        setStudent(JSON.parse(savedStudent));
      } catch {}
    }
  }, []);

  // Check legacy network status
  useEffect(() => {
    const checkNetwork = async () => {
      try {
        const res = await fetch("/api/network/check");
        const data = await res.json();
        setNetworkStatus(data);
      } catch {}
    };
    checkNetwork();
  }, []);

  // Check for active v2 extended session
  useEffect(() => {
    const checkV2Session = async () => {
      try {
        const res = await fetch("/api/v2/attendance/session/active");
        if (res.ok) {
          const data = await res.json();
          if (data.active && data.session) {
            setV2Session(data.session);
          }
        }
      } catch {}
    };
    checkV2Session();
  }, []);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: student?.name || "",
      studentId: student?.studentId || "",
      department: student?.department || "",
    },
  });

  useEffect(() => {
    if (student) {
      form.reset({
        name: student.name,
        studentId: student.studentId,
        department: student.department || "",
      });
    }
  }, [student, form]);

  const handleLocationUpdate = useCallback(
    (lat: number, lng: number, accuracy: number) => {
      setGpsCoords({ lat, lng, accuracy });
    },
    []
  );

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    setError(null);
    try {
      // Try v2 extended submission first (if v2 session is active)
      if (v2Session) {
        const payload: any = {
          sessionId: v2Session.id,
          studentId: values.studentId,
          name: values.name,
          department: values.department,
        };
        if (selectedSubjectId) payload.subjectId = parseInt(selectedSubjectId);
        if (gpsCoords) {
          payload.latitude = gpsCoords.lat;
          payload.longitude = gpsCoords.lng;
          payload.locationAccuracy = gpsCoords.accuracy;
        }

        const res = await fetch("/api/v2/attendance/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setSubmitted(true);
      } else {
        // Fallback to legacy attendance submission
        await markAttendance(values);
        setSubmitted(true);
      }
      form.reset();
    } catch (err: any) {
      const errorMessage = err.message || "Failed to submit attendance. Please try again.";
      if (errorMessage.includes("Network Access Denied") || errorMessage.includes("same network")) {
        setError(
          "Access Denied: You must be connected to the same Wi-Fi network as the server."
        );
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────

  const isNetworkBlocked = networkStatus && !networkStatus.allowed;

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-background flex flex-col">
      <Header />

      <main className="flex-1 flex items-start justify-center p-4 pt-6">
        <div className="w-full max-w-lg space-y-4">

          {/* Network Status Pill */}
          {networkStatus && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex items-center justify-center gap-2 text-sm rounded-full py-2 px-4 w-fit mx-auto border shadow-sm ${
                networkStatus.allowed
                  ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                  : "bg-destructive/10 border-destructive/20 text-destructive"
              }`}
            >
              {networkStatus.allowed ? (
                <>
                  <Wifi className="w-4 h-4" />
                  <span className="font-medium">{networkStatus.message}</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4" />
                  <span className="font-medium">{networkStatus.message}</span>
                </>
              )}
            </motion.div>
          )}

          {/* Active Session Badge */}
          {v2Session && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-lg px-3 py-2"
            >
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-sm font-medium text-primary">
                Session active{v2Session.name ? `: ${v2Session.name}` : ""}
              </span>
              {v2Session.attendanceMode && (
                <Badge variant="secondary" className="text-xs ml-auto">
                  {v2Session.attendanceMode.toUpperCase()}
                </Badge>
              )}
            </motion.div>
          )}

          {/* Network blocked overlay */}
          <AnimatePresence mode="wait">
            {isNetworkBlocked ? (
              <motion.div
                key="network-error"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Card className="border-destructive/20 shadow-lg">
                  <CardHeader className="text-center pb-2">
                    <div className="mx-auto bg-destructive/10 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                      <WifiOff className="w-6 h-6 text-destructive" />
                    </div>
                    <CardTitle className="text-destructive">Network Access Denied</CardTitle>
                  </CardHeader>
                  <CardContent className="text-center text-muted-foreground space-y-2">
                    <p>{networkStatus!.message}</p>
                    <p className="text-sm">
                      You must be connected to the same Wi-Fi network as the server to mark attendance.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                key="tabs"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-3 mb-4 h-11">
                    <TabsTrigger value="mark" className="gap-1.5 text-xs sm:text-sm">
                      <Wifi className="h-3.5 w-3.5" />
                      Mark
                    </TabsTrigger>
                    <TabsTrigger value="leave" className="gap-1.5 text-xs sm:text-sm">
                      <CalendarDays className="h-3.5 w-3.5" />
                      Leave
                    </TabsTrigger>
                    <TabsTrigger value="summary" className="gap-1.5 text-xs sm:text-sm">
                      <BarChart3 className="h-3.5 w-3.5" />
                      Summary
                    </TabsTrigger>
                  </TabsList>

                  {/* ── TAB 1: MARK ATTENDANCE ── */}
                  <TabsContent value="mark" className="mt-0">
                    <AnimatePresence mode="wait">
                      {!sessionActive && !v2Session ? (
                        <motion.div
                          key="inactive"
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                        >
                          <Card className="border-destructive/20 shadow-lg">
                            <CardHeader className="text-center pb-2">
                              <div className="mx-auto bg-destructive/10 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                                <AlertCircle className="w-6 h-6 text-destructive" />
                              </div>
                              <CardTitle className="text-destructive">Session Inactive</CardTitle>
                            </CardHeader>
                            <CardContent className="text-center text-muted-foreground">
                              Attendance is currently closed by the host. Please wait for the session to start.
                            </CardContent>
                          </Card>
                        </motion.div>
                      ) : submitted ? (
                        <motion.div
                          key="success"
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                        >
                          <Card className="border-emerald-500/20 shadow-lg overflow-hidden relative">
                            <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" />
                            <CardHeader className="text-center pb-2">
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 200, damping: 10 }}
                                className="mx-auto bg-emerald-100 dark:bg-emerald-900/30 w-20 h-20 rounded-full flex items-center justify-center mb-4"
                              >
                                <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
                              </motion.div>
                              <CardTitle className="text-2xl text-emerald-700 dark:text-emerald-400">
                                Attendance Recorded
                              </CardTitle>
                              <CardDescription>Your presence has been logged successfully.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 pt-2">
                              <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg text-sm space-y-2 border">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Time:</span>
                                  <span className="font-medium">{new Date().toLocaleTimeString()}</span>
                                </div>
                                {gpsCoords && (
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Location:</span>
                                    <span className="font-mono text-xs text-emerald-600">
                                      ±{Math.round(gpsCoords.accuracy)}m accuracy
                                    </span>
                                  </div>
                                )}
                              </div>
                              <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => {
                                  setSubmitted(false);
                                  setActiveTab("summary");
                                }}
                              >
                                <BarChart3 className="h-4 w-4 mr-2" />
                                View My Summary
                              </Button>
                            </CardContent>
                          </Card>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="form"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                        >
                          <Card className="shadow-xl border-primary/10">
                            <CardHeader>
                              <CardTitle className="text-2xl">Mark Attendance</CardTitle>
                              <CardDescription>
                                {student
                                  ? `Logged in as ${student.name} (${student.studentId})`
                                  : "Enter your details to clock in for today's session."}
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                                  {/* Name */}
                                  <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Full Name</FormLabel>
                                        <FormControl>
                                          <Input
                                            placeholder="John Doe"
                                            {...field}
                                            className="h-11"
                                            disabled={!!student}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />

                                  {/* Student ID */}
                                  <FormField
                                    control={form.control}
                                    name="studentId"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Student / Employee ID</FormLabel>
                                        <FormControl>
                                          <Input
                                            placeholder="ID-12345"
                                            {...field}
                                            className="h-11 font-mono"
                                            disabled={!!student}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />

                                  {/* Department */}
                                  <FormField
                                    control={form.control}
                                    name="department"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Department (Optional)</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!!student}>
                                          <FormControl>
                                            <SelectTrigger className="h-11">
                                              <SelectValue placeholder="Select Department" />
                                            </SelectTrigger>
                                          </FormControl>
                                          <SelectContent>
                                            <SelectItem value="CS">Computer Science</SelectItem>
                                            <SelectItem value="IT">Information Technology</SelectItem>
                                            <SelectItem value="ECE">Electronics</SelectItem>
                                            <SelectItem value="MECH">Mechanical</SelectItem>
                                            <SelectItem value="OTHER">Other</SelectItem>
                                          </SelectContent>
                                        </Select>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />

                                  {/* Subject Selector (Phase 4) */}
                                  <div className="space-y-1.5">
                                    <label className="text-sm font-medium leading-none">
                                      Subject{" "}
                                      <span className="text-muted-foreground font-normal text-xs">
                                        (Optional)
                                      </span>
                                    </label>
                                    <SubjectSelector
                                      value={selectedSubjectId}
                                      onValueChange={(val) => setSelectedSubjectId(val)}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                      Select the subject for subject-wise tracking
                                    </p>
                                  </div>

                                  {/* Geo-Fence Indicator (Phase 4) */}
                                  {v2Session?.geoFenceLatitude && (
                                    <div className="space-y-1.5">
                                      <label className="text-sm font-medium leading-none flex items-center gap-1.5">
                                        <MapPin className="h-3.5 w-3.5" />
                                        Location Check
                                      </label>
                                      <GeoFenceIndicator
                                        geoFence={
                                          v2Session.geoFenceLatitude
                                            ? {
                                                latitude: v2Session.geoFenceLatitude,
                                                longitude: v2Session.geoFenceLongitude!,
                                                radiusMeters: v2Session.geoFenceRadius || 100,
                                              }
                                            : null
                                        }
                                        onLocationUpdate={handleLocationUpdate}
                                        advisory={true}
                                      />
                                    </div>
                                  )}

                                  {/* GPS capture when no geo-fence (just capture location) */}
                                  {!v2Session?.geoFenceLatitude && (
                                    <div className="space-y-1.5">
                                      <label className="text-sm font-medium leading-none flex items-center gap-1.5">
                                        <MapPin className="h-3.5 w-3.5" />
                                        GPS Location
                                        <span className="text-xs text-muted-foreground font-normal">
                                          (Optional)
                                        </span>
                                      </label>
                                      <GeoFenceIndicator
                                        geoFence={null}
                                        onLocationUpdate={handleLocationUpdate}
                                        advisory={true}
                                      />
                                    </div>
                                  )}

                                  {/* Error */}
                                  {error && (
                                    <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3 rounded-md">
                                      {error}
                                    </div>
                                  )}

                                  {/* Submit */}
                                  <Button
                                    type="submit"
                                    className="w-full h-12 text-lg font-medium bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
                                    disabled={isSubmitting}
                                  >
                                    {isSubmitting ? "Submitting..." : "Submit Attendance"}
                                  </Button>
                                </form>
                              </Form>
                            </CardContent>
                          </Card>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </TabsContent>

                  {/* ── TAB 2: LEAVE REQUEST ── */}
                  <TabsContent value="leave" className="mt-0">
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Card className="shadow-xl border-primary/10">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-xl">
                            <CalendarDays className="h-5 w-5 text-primary" />
                            Request Leave
                          </CardTitle>
                          <CardDescription>
                            Submit a leave request for medical, OD, sports, or other reasons.
                            Faculty will review and approve.
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          {student ? (
                            <LeaveRequestForm
                              studentId={student.studentId}
                              onSuccess={() => setLeaveRefreshKey((k) => k + 1)}
                            />
                          ) : (
                            <div className="flex flex-col items-center gap-3 py-8 text-center text-muted-foreground">
                              <Lock className="h-8 w-8 opacity-50" />
                              <div>
                                <p className="font-medium">Login Required</p>
                                <p className="text-sm mt-1">
                                  Please log in to your student account to submit a leave request.
                                </p>
                              </div>
                              <Button variant="outline" onClick={() => (window.location.href = "/student")}>
                                Go to Student Portal
                                <ChevronRight className="h-4 w-4 ml-1" />
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  </TabsContent>

                  {/* ── TAB 3: MY ATTENDANCE SUMMARY ── */}
                  <TabsContent value="summary" className="mt-0">
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Card className="shadow-xl border-primary/10">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-xl">
                            <BarChart3 className="h-5 w-5 text-primary" />
                            My Attendance
                          </CardTitle>
                          <CardDescription>
                            Subject-wise attendance breakdown and percentage.
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          {student ? (
                            <AttendanceSummaryCard studentId={student.studentId} />
                          ) : (
                            <div className="flex flex-col items-center gap-3 py-8 text-center text-muted-foreground">
                              <BarChart3 className="h-8 w-8 opacity-50" />
                              <div>
                                <p className="font-medium">Login Required</p>
                                <p className="text-sm mt-1">
                                  Please log in to your student account to view your attendance summary.
                                </p>
                              </div>
                              <Button variant="outline" onClick={() => (window.location.href = "/student")}>
                                Go to Student Portal
                                <ChevronRight className="h-4 w-4 ml-1" />
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  </TabsContent>
                </Tabs>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
