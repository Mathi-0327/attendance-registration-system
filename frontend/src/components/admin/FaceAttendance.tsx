import { useState, useRef, useEffect, useCallback } from "react";
import * as faceapi from "face-api.js";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Camera,
  CameraOff,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ScanFace,
  RefreshCw,
  Sparkles,
  UserX,
  Volume2
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/";
// Standard Euclidean distance threshold for 128-d face recognition vectors (0.60 is standard)
const DISTANCE_THRESHOLD = 0.58;
const DETECTION_INTERVAL_MS = 280;

// Web Audio API synthesized chime for verified attendance
function playSuccessBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.09); // E5
    osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.18); // G5
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {
    // Ignore audio context error
  }
}

interface RecognizedStudent {
  studentId: string;
  name: string;
  department?: string;
  confidence: number;
}

interface FaceAttendanceProps {
  sessionActive: boolean;
  onNavigateToEnrollment?: () => void;
}

export function FaceAttendance({ sessionActive, onNavigateToEnrollment }: FaceAttendanceProps) {
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
  const [status, setStatus] = useState<"idle" | "scanning" | "found" | "unregistered" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("Start camera to begin scanning");

  // 1. Load both fast TinyFaceDetector AND accurate SSD MobileNet V1 + Landmarks + Recognition
  const loadModels = useCallback(async () => {
    setModelsLoading(true);
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      setModelsLoaded(true);
      toast.success("High-Speed Biometric AI Vision loaded");
    } catch (err) {
      console.error("Failed to load models", err);
      toast.error("Failed to load AI face models from CDN. Check connection.");
    } finally {
      setModelsLoading(false);
    }
  }, []);

  // 2. Load Student Descriptors
  const loadStudentDescriptors = useCallback(async () => {
    try {
      const res = await fetch("/api/students/with-faces");
      if (!res.ok) throw new Error("Failed to fetch students");
      const { students } = await res.json();

      if (!students || students.length === 0) {
        setStudentsLoaded(0);
        setFaceMatcher(null);
        return;
      }

      const labeledDescriptors = students
        .filter((s: any) => s.faceDescriptor && Array.isArray(s.faceDescriptor) && s.faceDescriptor.length === 128)
        .map((s: any) => {
          const descriptor = new Float32Array(s.faceDescriptor);
          return new faceapi.LabeledFaceDescriptors(
            JSON.stringify({ id: s.studentId, name: s.name, department: s.department }),
            [descriptor]
          );
        });

      if (labeledDescriptors.length === 0) {
        setStudentsLoaded(0);
        setFaceMatcher(null);
        return;
      }

      const matcher = new faceapi.FaceMatcher(labeledDescriptors, DISTANCE_THRESHOLD);
      setFaceMatcher(matcher);
      setStudentsLoaded(labeledDescriptors.length);
      toast.success(`Loaded ${labeledDescriptors.length} enrolled student face profile(s)`);
    } catch (err) {
      console.error("Error loading student descriptors:", err);
      toast.error("Failed to load student faces from server");
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
  }, [modelsLoaded, loadStudentDescriptors]);

  // 3. Camera Start & Stop
  const startCamera = async () => {
    if (!modelsLoaded) {
      toast.error("AI Models are still loading, please wait a moment");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraActive(true);
      setStatus("scanning");
      setStatusMessage("Active scanner: Looking for student faces...");
      startDetectionLoop();
    } catch (err) {
      toast.error("Could not access camera. Check browser webcam permissions.");
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
    clearCanvas();
  };

  const clearCanvas = () => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  // 4. Real-time Detection Loop (DOES NOT BLOCK IF MATCHER IS NULL)
  const startDetectionLoop = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2 || recognizing) return;
      await runDetection();
    }, DETECTION_INTERVAL_MS);
  };

  const runDetection = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    if (videoWidth === 0 || videoHeight === 0) return;

    if (canvas.width !== videoWidth || canvas.height !== videoHeight) {
      canvas.width = videoWidth;
      canvas.height = videoHeight;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setRecognizing(true);

    try {
      // 1. Dual-pass detection: TinyFaceDetector first for ultra-fast reaction (inputSize 416, threshold 0.22)
      let detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.22 }))
        .withFaceLandmarks()
        .withFaceDescriptors();

      // 2. Fallback to SSD MobileNet V1 if Tiny didn't catch anything
      if (detections.length === 0 && faceapi.nets.ssdMobilenetv1.isLoaded) {
        detections = await faceapi
          .detectAllFaces(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.22 }))
          .withFaceLandmarks()
          .withFaceDescriptors();
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (detections.length === 0) {
        if (status !== "scanning") {
          setStatus("scanning");
          setStatusMessage("Scanning... Looking for student face");
        }
        return;
      }

      // Iterate through detected faces
      for (const det of detections) {
        const { x, y, width, height } = det.detection.box;
        // Video is mirrored (-scale-x-100), so flip X coordinate for canvas drawing
        const mx = canvas.width - (x + width);

        // CASE A: No student face profiles enrolled yet
        if (!faceMatcher || studentsLoaded === 0) {
          drawBiometricReticle(ctx, mx, y, width, height, "#0284c7", "rgba(2, 132, 199, 0.5)");
          drawReticleBadge(ctx, mx, y, width, height, "Face Detected · Not Enrolled", "#0284c7", "#38bdf8");
          setStatus("unregistered");
          setStatusMessage("Face detected! Please enroll student faces in 'Register Face' tab.");
          continue;
        }

        // CASE B: Face Matcher is active — evaluate Euclidean distance
        const match = faceMatcher.findBestMatch(det.descriptor);
        const isKnown = match.label !== "unknown";

        if (isKnown) {
          try {
            const parsed = JSON.parse(match.label);
            const studentId = parsed.id;
            const confidence = Math.max(1, Math.min(99, Math.round((1 - match.distance) * 100)));

            // Draw emerald glowing reticle
            drawBiometricReticle(ctx, mx, y, width, height, "#10b981", "rgba(16, 185, 129, 0.6)");
            drawReticleBadge(ctx, mx, y, width, height, `✓ ${parsed.name} (${confidence}%)`, "#10b981", "#34d399");

            if (!submittedToday.has(studentId) && confidence >= 40) {
              setLastRecognized({ ...parsed, studentId, confidence });
              setStatus("found");
              setStatusMessage(`✓ Verified: ${parsed.name} (${confidence}% match)`);
              setSubmittedToday((prev) => new Set([...prev, studentId]));
              playSuccessBeep();

              // Submit attendance record
              await submitFaceAttendance(parsed.name, studentId, parsed.department, confidence, 1.0);
            }
          } catch (e) {
            console.error(e);
          }
        } else {
          // Unknown face (not in enrolled directory)
          drawBiometricReticle(ctx, mx, y, width, height, "#f59e0b", "rgba(245, 158, 11, 0.5)");
          drawReticleBadge(ctx, mx, y, width, height, "Unknown Face", "#f59e0b", "#fbbf24");
          setStatus("scanning");
          setStatusMessage("Face detected — Not enrolled in database");
        }
      }
    } catch (err) {
      console.error("Detection loop error:", err);
    } finally {
      setRecognizing(false);
    }
  };

  // Helper: Draw high-tech corner brackets around the face
  const drawBiometricReticle = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    glow: string
  ) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 8;

    const corner = Math.min(w, h) * 0.22;

    // Top-Left
    ctx.beginPath();
    ctx.moveTo(x, y + corner);
    ctx.lineTo(x, y);
    ctx.lineTo(x + corner, y);
    ctx.stroke();

    // Top-Right
    ctx.beginPath();
    ctx.moveTo(x + w - corner, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + corner);
    ctx.stroke();

    // Bottom-Left
    ctx.beginPath();
    ctx.moveTo(x, y + h - corner);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x + corner, y + h);
    ctx.stroke();

    // Bottom-Right
    ctx.beginPath();
    ctx.moveTo(x + w - corner, y + h);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + w, y + h - corner);
    ctx.stroke();

    ctx.shadowBlur = 0;

    // Subtle outline
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.35;
    ctx.strokeRect(x, y, w, h);
    ctx.globalAlpha = 1.0;
  };

  // Helper: Draw HUD text badge
  const drawReticleBadge = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    text: string,
    borderColor: string,
    textColor: string
  ) => {
    ctx.font = "bold 13px sans-serif";
    const textWidth = ctx.measureText(text).width;
    const badgeY = y > 28 ? y - 10 : y + h + 22;

    ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
    ctx.fillRect(x + (w - textWidth) / 2 - 8, badgeY - 14, textWidth + 16, 22);

    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + (w - textWidth) / 2 - 8, badgeY - 14, textWidth + 16, 22);

    ctx.fillStyle = textColor;
    ctx.fillText(text, x + (w - textWidth) / 2, badgeY);
  };

  // 5. Submit Face Attendance to Backend
  const submitFaceAttendance = async (
    name: string,
    studentId: string,
    department?: string,
    confidence?: number,
    livenessScore?: number
  ) => {
    try {
      const res = await fetch("/api/attendance/face", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, studentId, department, confidence, livenessScore }),
      });

      if (res.status === 409) {
        toast.info(`${name} already marked present in this session`);
        return;
      }
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to mark attendance");
        return;
      }

      toast.success(`✅ ${name} verified & marked present!`, { duration: 4000 });
    } catch (err) {
      console.error("Face attendance submit error:", err);
      toast.error("Failed to submit attendance to server");
    }
  };

  return (
    <Card className="overflow-hidden border border-border/70 bg-card/95 backdrop-blur-md shadow-xl rounded-2xl">
      <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-400" />
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <ScanFace className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold font-heading flex items-center gap-2">
                Biometric Face Attendance Scanner
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time neural recognition automatically records attendance upon face match.
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadStudentDescriptors}
              disabled={!modelsLoaded}
              className="text-xs h-8 gap-1.5"
            >
              <RefreshCw className="h-3 w-3" />
              Reload Profiles
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status indicator row */}
        <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2">
            {modelsLoading ? (
              <Badge variant="secondary" className="gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading AI Models...
              </Badge>
            ) : modelsLoaded ? (
              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> AI Engine Ready · {studentsLoaded} Enrolled Profile(s)
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" /> Models Not Loaded
              </Badge>
            )}

            {!sessionActive && (
              <Badge variant="outline" className="text-amber-600 border-amber-300">
                Session inactive (Start session in top bar)
              </Badge>
            )}
          </div>

          {submittedToday.size > 0 && (
            <Badge variant="secondary" className="bg-primary/10 text-primary font-medium">
              {submittedToday.size} marked present this session
            </Badge>
          )}
        </div>

        {/* Camera HUD Viewer */}
        <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-video shadow-2xl border-2 border-primary/40">
          {/* Mirrored video element */}
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover -scale-x-100"
          />

          {/* Overlaid canvas for real-time tracking box */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />

          {/* Camera Inactive Overlay */}
          {!cameraActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 gap-3 bg-slate-950/90 backdrop-blur-sm">
              <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                <CameraOff className="h-7 w-7 text-white/60" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-white">Camera Scanner Idle</p>
                <p className="text-xs text-white/50 mt-0.5">Click Start Scanner below to begin real-time scanning</p>
              </div>
            </div>
          )}

          {/* Top Live Badge */}
          {cameraActive && (
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
              <Badge className={
                status === "found"
                  ? "bg-emerald-500 text-white shadow-lg"
                  : status === "unregistered"
                  ? "bg-sky-600 text-white shadow-lg"
                  : "bg-black/70 text-white backdrop-blur-md border border-white/10"
              }>
                {status === "scanning" && (
                  <span className="mr-1.5 inline-block w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                )}
                {status === "found" ? "✓ Verified" : statusMessage}
              </Badge>

              <div className="bg-black/60 backdrop-blur-sm px-2.5 py-0.5 rounded-full text-[11px] text-white/80 font-mono border border-white/10 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-cyan-400" />
                <span>Dual-Detector Active</span>
              </div>
            </div>
          )}
        </div>

        {/* Last Recognized Student Banner */}
        <AnimatePresence>
          {lastRecognized && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 rounded-xl p-3 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                      {lastRecognized.name}
                    </p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                      ID: {lastRecognized.studentId}
                      {lastRecognized.department && ` · ${lastRecognized.department}`}
                      {" · "}{lastRecognized.confidence}% match confidence
                    </p>
                  </div>
                </div>

                <Badge className="bg-emerald-600 text-white text-[11px]">
                  Attendance Recorded
                </Badge>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Warning if 0 students enrolled */}
        {studentsLoaded === 0 && modelsLoaded && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <UserX className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                No student biometric face profiles found in the database yet.
              </p>
            </div>
            {onNavigateToEnrollment && (
              <Button
                size="sm"
                variant="outline"
                onClick={onNavigateToEnrollment}
                className="text-xs h-7 border-amber-500/40 text-amber-700 dark:text-amber-300"
              >
                Enroll Faces Now →
              </Button>
            )}
          </div>
        )}

        {/* Camera Action Buttons */}
        <div className="flex gap-2">
          {!cameraActive ? (
            <Button
              className="flex-1 gap-2 h-11 text-xs font-semibold bg-primary text-primary-foreground shadow-md"
              onClick={startCamera}
              disabled={!modelsLoaded}
            >
              <Camera className="h-4 w-4" />
              Start Biometric Face Scanner
            </Button>
          ) : (
            <Button
              className="flex-1 gap-2 h-11 text-xs font-semibold"
              variant="destructive"
              onClick={stopCamera}
            >
              <CameraOff className="h-4 w-4" />
              Stop Face Scanner
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
