import { useState, useRef, useEffect, useCallback } from "react";
import * as faceapi from "face-api.js";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, CameraOff, Loader2, CheckCircle2, AlertCircle, ScanFace, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/";
const CONFIDENCE_THRESHOLD = 0.45;
const DETECTION_INTERVAL_MS = 1200;

interface RecognizedStudent {
  studentId: string;
  name: string;
  department?: string;
  confidence: number;
}

interface FaceAttendanceProps {
  sessionActive: boolean;
}

export function FaceAttendance({ sessionActive }: FaceAttendanceProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [faceMatcher, setFaceMatcher] = useState<faceapi.FaceMatcher | null>(null);
  const [studentsLoaded, setStudentsLoaded] = useState(0);
  const [recognizing, setRecognizing] = useState(false);
  const [lastRecognized, setLastRecognized] = useState<RecognizedStudent | null>(null);
  const [submittedToday, setSubmittedToday] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<"idle" | "scanning" | "found" | "liveness" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("Start camera to begin scanning");
  const [pendingMatch, setPendingMatch] = useState<{ name: string, studentId: string, department?: string, confidence: number } | null>(null);

  const loadModels = useCallback(async () => {
    setModelsLoading(true);
    try {
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
      ]);
      setModelsLoaded(true);
      toast.success("Face AI models loaded");
    } catch (err) {
      console.error("Failed to load models", err);
      toast.error("Failed to load AI models — check internet connection");
    } finally {
      setModelsLoading(false);
    }
  }, []);

  const loadStudentDescriptors = useCallback(async () => {
    try {
      const res = await fetch("/api/students/with-faces");
      if (!res.ok) throw new Error("Failed to fetch students");
      const { students } = await res.json();

      if (!students || students.length === 0) {
        toast.warning("No students with face data registered yet");
        setStudentsLoaded(0);
        return;
      }

      const labeledDescriptors = students
        .filter((s: any) => s.faceDescriptor && Array.isArray(s.faceDescriptor))
        .map((s: any) => {
          const descriptor = new Float32Array(s.faceDescriptor);
          return new faceapi.LabeledFaceDescriptors(
            JSON.stringify({ id: s.studentId, name: s.name, department: s.department }),
            [descriptor]
          );
        });

      if (labeledDescriptors.length === 0) {
        toast.warning("No valid face descriptors found");
        return;
      }

      const matcher = new faceapi.FaceMatcher(labeledDescriptors, CONFIDENCE_THRESHOLD);
      setFaceMatcher(matcher);
      setStudentsLoaded(labeledDescriptors.length);
      toast.success(`Loaded ${labeledDescriptors.length} student face profile(s)`);
    } catch (err) {
      console.error("Error loading student descriptors:", err);
      toast.error("Failed to load student faces");
    }
  }, []);

  useEffect(() => {
    loadModels();
    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    if (modelsLoaded) {
      loadStudentDescriptors();
    }
  }, [modelsLoaded]);

  const startCamera = async () => {
    if (!modelsLoaded) {
      toast.error("Models not loaded yet, please wait");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
      setStatus("scanning");
      setStatusMessage("Scanning for faces...");
      startDetectionLoop();
    } catch (err) {
      toast.error("Could not access camera. Check browser permissions.");
    }
  };

  const stopCamera = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setStatus("idle");
    setStatusMessage("Start camera to begin scanning");
    setLastRecognized(null);
    setPendingMatch(null);
    clearCanvas();
  };

  const clearCanvas = () => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  const startDetectionLoop = () => {
    intervalRef.current = setInterval(async () => {
      if (!videoRef.current || !faceMatcher || recognizing) return;
      await runDetection();
    }, DETECTION_INTERVAL_MS);
  };

  const runDetection = async () => {
    if (!videoRef.current || videoRef.current.readyState < 2) return;
    setRecognizing(true);

    try {
      const detections = await faceapi
        .detectAllFaces(videoRef.current, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
        .withFaceLandmarks()
        .withFaceExpressions()
        .withFaceDescriptors();

      if (!canvasRef.current || !videoRef.current) return;

      const dims = {
        width: videoRef.current.videoWidth,
        height: videoRef.current.videoHeight,
      };
      faceapi.matchDimensions(canvasRef.current, dims);
      const resized = faceapi.resizeResults(detections, dims);

      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }

      if (detections.length === 0) {
        setStatus("scanning");
        setStatusMessage("No face detected — look at the camera");
        setRecognizing(false);
        return;
      }

      for (const det of resized) {
        const match = faceMatcher!.findBestMatch(det.descriptor);
        const box = det.detection.box;

        if (ctx) {
          ctx.strokeStyle = match.label === "unknown" ? "#ef4444" : "#10b981";
          ctx.lineWidth = 2;
          ctx.strokeRect(box.x, box.y, box.width, box.height);

          ctx.fillStyle = match.label === "unknown" ? "#ef4444" : "#10b981";
          ctx.font = "14px sans-serif";
          const label = match.label === "unknown"
            ? "Unknown"
            : (() => {
              try { return JSON.parse(match.label).name; } catch { return match.label; }
            })();
          ctx.fillText(label, box.x, box.y > 16 ? box.y - 4 : box.y + 16);
        }

        if (match.label !== "unknown") {
          try {
            const parsed = JSON.parse(match.label);
            const studentId = parsed.id;
            const confidence = Math.round((1 - match.distance) * 100);
            const isSmiling = det.expressions && det.expressions.happy > 0.7;

            if (!submittedToday.has(studentId)) {
              if (pendingMatch?.studentId === studentId) {
                // Already waiting for this student to smile
                if (isSmiling) {
                  setLastRecognized({ ...parsed, studentId, confidence });
                  setStatus("found");
                  setStatusMessage(`Recognized: ${parsed.name} (${confidence}% match)`);
                  await submitFaceAttendance(parsed.name, studentId, parsed.department, confidence, det.expressions.happy);
                  setSubmittedToday((prev) => new Set([...prev, studentId]));
                  setPendingMatch(null);
                } else {
                  // Keep prompting to smile
                  setStatus("liveness");
                  setStatusMessage(`Match found: ${parsed.name}. Please SMILE to verify liveness!`);
                }
              } else {
                // New match, initiate liveness check
                setPendingMatch({ name: parsed.name, studentId, department: parsed.department, confidence });
                setStatus("liveness");
                setStatusMessage(`Match found: ${parsed.name}. Please SMILE to verify liveness!`);
              }
            }
          } catch {}
        } else {
          setStatus("scanning");
          setStatusMessage("Face detected but not recognized");
        }
      }
    } catch (err) {
      console.error("Detection error:", err);
    } finally {
      setRecognizing(false);
    }
  };

  const submitFaceAttendance = async (name: string, studentId: string, department?: string, confidence?: number, livenessScore?: number) => {
    try {
      const res = await fetch("/api/attendance/face", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, studentId, department, confidence, livenessScore }),
      });

      if (res.status === 409) {
        toast.info(`${name} already marked present`);
        return;
      }
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to mark attendance");
        return;
      }

      toast.success(`✅ ${name} marked present via face recognition!`, { duration: 4000 });
    } catch (err) {
      console.error("Face attendance submit error:", err);
      toast.error("Failed to submit attendance");
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScanFace className="h-5 w-5 text-primary" />
          Face Recognition Attendance
        </CardTitle>
        <CardDescription>
          Automatically marks attendance when a registered student's face is detected
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status row */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            {modelsLoading ? (
              <Badge variant="secondary" className="gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading AI models...
              </Badge>
            ) : modelsLoaded ? (
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 gap-1">
                <CheckCircle2 className="h-3 w-3" /> AI Ready · {studentsLoaded} face(s) loaded
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="h-3 w-3" /> Models not loaded
              </Badge>
            )}
            {!sessionActive && (
              <Badge variant="outline" className="text-orange-600 border-orange-300">
                Session inactive
              </Badge>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadStudentDescriptors}
            disabled={!modelsLoaded}
            className="gap-1"
          >
            <RefreshCw className="h-3 w-3" />
            Reload Faces
          </Button>
        </div>

        {/* Camera viewer */}
        <div className="relative rounded-lg overflow-hidden bg-slate-900 aspect-video">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            muted
            playsInline
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
          />

          {/* Overlay when camera is off */}
          {!cameraActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/60 gap-3">
              <CameraOff className="h-12 w-12" />
              <p className="text-sm">Camera inactive</p>
            </div>
          )}

          {/* Status badge on camera */}
          {cameraActive && (
            <div className="absolute top-3 left-3">
              <AnimatePresence mode="wait">
                <motion.div
                  key={status}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <Badge className={
                    status === "found"
                      ? "bg-emerald-500 text-white shadow"
                      : status === "liveness"
                      ? "bg-blue-500 text-white shadow animate-pulse"
                      : status === "error"
                      ? "bg-red-500 text-white shadow"
                      : "bg-black/60 text-white backdrop-blur-sm"
                  }>
                    {status === "scanning" && <span className="mr-1.5 inline-block w-2 h-2 bg-white rounded-full animate-pulse" />}
                    {status === "liveness" ? "😊 Smile to verify" : status === "found" ? "✓ Verified" : status === "scanning" ? "Scanning..." : statusMessage}
                  </Badge>
                </motion.div>
              </AnimatePresence>
            </div>
          )}

          {/* Liveness overlay prompt */}
          <AnimatePresence>
            {status === "liveness" && pendingMatch && (
              <motion.div
                key="liveness-overlay"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute bottom-0 left-0 right-0 bg-blue-900/80 backdrop-blur-sm text-white text-center py-3 px-4"
              >
                <p className="text-sm font-semibold">👋 Hi, {pendingMatch.name}!</p>
                <p className="text-xs mt-0.5 text-blue-200">Please SMILE to complete liveness verification 😊</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Last recognized */}
        <AnimatePresence>
          {lastRecognized && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3"
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-emerald-800 dark:text-emerald-300">{lastRecognized.name}</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    ID: {lastRecognized.studentId}
                    {lastRecognized.department && ` · ${lastRecognized.department}`}
                    {" · "}{lastRecognized.confidence}% confidence
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submitted this session */}
        {submittedToday.size > 0 && (
          <p className="text-xs text-muted-foreground">
            {submittedToday.size} student(s) marked via face recognition this session
          </p>
        )}

        {/* Controls */}
        <div className="flex gap-2">
          {!cameraActive ? (
            <Button
              className="flex-1 gap-2"
              onClick={startCamera}
              disabled={!modelsLoaded || !sessionActive}
            >
              <Camera className="h-4 w-4" />
              {!sessionActive ? "Start a session first" : "Start Face Scanner"}
            </Button>
          ) : (
            <Button
              className="flex-1 gap-2"
              variant="destructive"
              onClick={stopCamera}
            >
              <CameraOff className="h-4 w-4" />
              Stop Scanner
            </Button>
          )}
        </div>

        {studentsLoaded === 0 && modelsLoaded && (
          <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded p-2">
            ⚠️ No students with face data found. Go to <strong>Register Face</strong> to enroll students.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
