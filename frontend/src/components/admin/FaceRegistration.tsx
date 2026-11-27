import { useState, useRef, useEffect, useCallback } from "react";
import * as faceapi from "face-api.js";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Camera,
  CameraOff,
  Save,
  X,
  UserPlus,
  Loader2,
  CheckCircle2,
  UserCheck,
  Sparkles,
  RefreshCw,
  ScanFace,
  Volume2
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const MAX_SAMPLES = 3;
const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/";
const FALLBACK_MODEL_URL = "https://raw.githubusercontent.com/vladmandic/face-api/master/model/";

// Web Audio API synthesized chimes for instant user feedback
function playBeep(type: "capture" | "complete" | "error") {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (type === "capture") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === "complete") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch (e) {
    // AudioContext blocked or not supported
  }
}

export function FaceRegistration() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loopRef = useRef<NodeJS.Timeout | null>(null);

  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [modelLoadingText, setModelLoadingText] = useState("Loading AI Neural Models...");

  // Registration mode: "new" or "existing"
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [students, setStudents] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Form Fields
  const [studentId, setStudentId] = useState("");
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [descriptors, setDescriptors] = useState<Float32Array[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Live detection feedback state
  const [isFaceInFrame, setIsFaceInFrame] = useState(false);
  const [liveConfidence, setLiveConfidence] = useState<number | null>(null);

  // 1. Load models on mount (Tiny + SSD Mobilenet V1 + Landmarks + Recognition)
  useEffect(() => {
    let isMounted = true;
    const loadModels = async () => {
      try {
        setModelLoadingText("Initializing high-speed face models...");
        try {
          await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
          ]);
        } catch (primaryErr) {
          console.warn("Primary CDN face models failed, retrying with fallback CDN...", primaryErr);
          await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(FALLBACK_MODEL_URL),
            faceapi.nets.ssdMobilenetv1.loadFromUri(FALLBACK_MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(FALLBACK_MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(FALLBACK_MODEL_URL),
          ]);
        }
        if (isMounted) {
          setIsModelLoaded(true);
          toast.success("AI Face Vision Engine Ready");
        }
      } catch (err) {
        console.error("Failed to load models", err);
        if (isMounted) {
          toast.error("Failed to load face models from CDN. Check connection.");
        }
      }
    };

    loadModels();
    loadStudentsList();

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, []);

  const loadStudentsList = async () => {
    setLoadingStudents(true);
    try {
      const res = await fetch("/api/students");
      if (res.ok) {
        const data = await res.json();
        setStudents(data.students || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleSelectExistingStudent = (selectedId: string) => {
    setStudentId(selectedId);
    const found = students.find((s) => s.studentId === selectedId);
    if (found) {
      setName(found.name || "");
      setDepartment(found.department || "");
      setEmail(found.email || "");
      setPhone(found.phone || "");
    }
  };

  // 2. Start Camera and Live Tracking Loop
  const startCamera = async () => {
    if (!studentId.trim()) {
      toast.error("Please enter or select a Student ID first");
      return;
    }
    if (mode === "new" && !name.trim()) {
      toast.error("Please enter the student's full name");
      return;
    }

    setShowCamera(true);
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

      // Start live bounding box overlay loop
      startLiveTracking();
    } catch (err) {
      toast.error("Could not access camera. Check browser permissions.");
      setShowCamera(false);
    }
  };

  const stopCamera = () => {
    if (loopRef.current) {
      clearInterval(loopRef.current);
      loopRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsFaceInFrame(false);
    setLiveConfidence(null);
    clearCanvas();
    setShowCamera(false);
  };

  const clearCanvas = () => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  // 3. Live face tracking loop for instant visual confirmation
  const startLiveTracking = () => {
    if (loopRef.current) clearInterval(loopRef.current);

    loopRef.current = setInterval(async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2 || isCapturing) return;

      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;
      if (videoWidth === 0 || videoHeight === 0) return;

      if (canvas.width !== videoWidth || canvas.height !== videoHeight) {
        canvas.width = videoWidth;
        canvas.height = videoHeight;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      try {
        // High sensitivity detection: TinyFaceDetector first (inputSize 416, threshold 0.22)
        let det = await faceapi.detectSingleFace(
          video,
          new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.22 })
        );

        // Fallback to SSD MobileNet V1 if tiny doesn't catch it
        if (!det && faceapi.nets.ssdMobilenetv1.isLoaded) {
          det = await faceapi.detectSingleFace(
            video,
            new faceapi.SsdMobilenetv1Options({ minConfidence: 0.22 })
          );
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (det) {
          const score = Math.round(det.score * 100);
          setIsFaceInFrame(true);
          setLiveConfidence(score);

          const { x, y, width, height } = det.box;
          // Video is mirrored (-scale-x-100), so flip X coordinate for canvas drawing
          const mx = canvas.width - (x + width);

          // Draw biometric reticle (corner brackets)
          ctx.strokeStyle = "#10b981"; // Emerald
          ctx.lineWidth = 3;
          ctx.shadowColor = "rgba(16, 185, 129, 0.6)";
          ctx.shadowBlur = 8;

          const cornerLen = Math.min(width, height) * 0.25;

          // Top-Left corner
          ctx.beginPath();
          ctx.moveTo(mx, y + cornerLen);
          ctx.lineTo(mx, y);
          ctx.lineTo(mx + cornerLen, y);
          ctx.stroke();

          // Top-Right corner
          ctx.beginPath();
          ctx.moveTo(mx + width - cornerLen, y);
          ctx.lineTo(mx + width, y);
          ctx.lineTo(mx + width, y + cornerLen);
          ctx.stroke();

          // Bottom-Left corner
          ctx.beginPath();
          ctx.moveTo(mx, y + height - cornerLen);
          ctx.lineTo(mx, y + height);
          ctx.lineTo(mx + cornerLen, y + height);
          ctx.stroke();

          // Bottom-Right corner
          ctx.beginPath();
          ctx.moveTo(mx + width - cornerLen, y + height);
          ctx.lineTo(mx + width, y + height);
          ctx.lineTo(mx + width, y + height - cornerLen);
          ctx.stroke();

          // Reset shadow
          ctx.shadowBlur = 0;

          // Subtle bounding frame
          ctx.strokeStyle = "rgba(16, 185, 129, 0.35)";
          ctx.lineWidth = 1;
          ctx.strokeRect(mx, y, width, height);

          // HUD status badge
          const label = `✓ Face Detected (${score}%) · Ready`;
          ctx.font = "bold 13px sans-serif";
          const textWidth = ctx.measureText(label).width;
          const badgeY = y > 28 ? y - 10 : y + height + 22;

          ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
          ctx.fillRect(mx + (width - textWidth) / 2 - 8, badgeY - 14, textWidth + 16, 22);

          ctx.strokeStyle = "#10b981";
          ctx.lineWidth = 1;
          ctx.strokeRect(mx + (width - textWidth) / 2 - 8, badgeY - 14, textWidth + 16, 22);

          ctx.fillStyle = "#34d399";
          ctx.fillText(label, mx + (width - textWidth) / 2, badgeY);
        } else {
          setIsFaceInFrame(false);
          setLiveConfidence(null);

          // Draw subtle alignment guide in center
          const guideW = canvas.width * 0.45;
          const guideH = canvas.height * 0.55;
          const gx = (canvas.width - guideW) / 2;
          const gy = (canvas.height - guideH) / 2;

          ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
          ctx.lineWidth = 2;
          ctx.setLineDash([8, 8]);
          ctx.strokeRect(gx, gy, guideW, guideH);
          ctx.setLineDash([]);

          ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
          ctx.font = "12px sans-serif";
          const guideText = "Position face within frame";
          const tw = ctx.measureText(guideText).width;
          ctx.fillText(guideText, (canvas.width - tw) / 2, gy + guideH + 20);
        }
      } catch (err) {
        // Ignore loop tick errors
      }
    }, 180);
  };

  // 4. Capture Sample with Multi-frame fallback
  const captureSample = async () => {
    const video = videoRef.current;
    if (!video || !isModelLoaded) return;
    setIsCapturing(true);

    try {
      let detection: any = null;

      // Try up to 3 frames in quick succession to prevent momentary misfire
      for (let attempt = 0; attempt < 3; attempt++) {
        // 1. Fast TinyFaceDetector with sensitive score threshold
        detection = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.20 }))
          .withFaceLandmarks()
          .withFaceDescriptor();

        // 2. Fallback to SsdMobilenetv1 if tiny didn't catch it
        if (!detection && faceapi.nets.ssdMobilenetv1.isLoaded) {
          detection = await faceapi
            .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.20 }))
            .withFaceLandmarks()
            .withFaceDescriptor();
        }

        if (detection) break;
        await new Promise((r) => setTimeout(r, 80));
      }

      if (!detection) {
        toast.error("No face detected! Please look straight at the camera with clear lighting.");
        setIsCapturing(false);
        return;
      }

      const nextSampleNum = descriptors.length + 1;
      setDescriptors((prev) => [...prev, detection.descriptor]);
      playBeep("capture");
      toast.success(`Face Sample ${nextSampleNum}/${MAX_SAMPLES} captured successfully!`);

      if (nextSampleNum >= MAX_SAMPLES) {
        playBeep("complete");
        stopCamera();
        toast.success("All 3 biometric face samples captured! Click 'Save' to finalize enrollment.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Detection failed. Please adjust angle/lighting and try again.");
    } finally {
      setIsCapturing(false);
    }
  };

  // 5. Save Student & Face Profile
  const handleSave = async () => {
    if (descriptors.length === 0) {
      toast.error("Please capture at least 1 face sample first");
      return;
    }
    if (!studentId.trim()) {
      toast.error("Student ID is required");
      return;
    }

    // Average the descriptors for maximum geometric precision
    const avgDescriptor = new Float32Array(128);
    for (let i = 0; i < 128; i++) {
      let sum = 0;
      for (const d of descriptors) sum += d[i];
      avgDescriptor[i] = sum / descriptors.length;
    }
    const descriptorArray = Array.from(avgDescriptor);

    setIsSaving(true);
    try {
      if (mode === "new") {
        // Register new student directly with biometric face
        const res = await fetch("/api/students", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            studentId: studentId.trim(),
            department: department.trim() || "General",
            email: email.trim() || undefined,
            phone: phone.trim() || undefined,
            faceDescriptor: descriptorArray,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to register student");
        }

        toast.success(`Student ${name} (${studentId}) registered with Biometric Face successfully!`);
      } else {
        // Attach face to existing student
        const res = await fetch(`/api/students/${studentId}/face`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ descriptor: descriptorArray }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to save face profile");
        }

        toast.success(`Biometric face profile linked to student ${studentId}!`);
      }

      // Reset form
      setDescriptors([]);
      setStudentId("");
      setName("");
      setDepartment("");
      setEmail("");
      setPhone("");
      loadStudentsList();
    } catch (err: any) {
      toast.error(err.message || "Failed to save biometric face registration");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto border border-border/80 bg-card/95 backdrop-blur-xl shadow-xl rounded-2xl overflow-hidden">
      <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-400" />
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <ScanFace className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold font-heading">
                Biometric Student Enrollment
              </CardTitle>
              <CardDescription className="text-xs">
                Enroll student facial vectors with real-time neural vision tracking.
              </CardDescription>
            </div>
          </div>
          {isModelLoaded ? (
            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> AI Vision Engine Ready
            </Badge>
          ) : (
            <Badge variant="outline" className="text-amber-600 border-amber-300 gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> {modelLoadingText}
            </Badge>
          )}
        </div>

        {/* Mode Switcher */}
        <div className="flex gap-2 pt-3 border-t border-border/40 mt-3">
          <Button
            type="button"
            size="sm"
            variant={mode === "new" ? "default" : "outline"}
            onClick={() => setMode("new")}
            className="text-xs h-8 gap-1.5"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Register New Student & Face
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "existing" ? "default" : "outline"}
            onClick={() => setMode("existing")}
            className="text-xs h-8 gap-1.5"
          >
            <UserCheck className="w-3.5 h-3.5" />
            Attach Face to Existing Student
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {mode === "existing" ? (
          <div className="space-y-3 p-4 rounded-xl bg-muted/40 border border-border/60">
            <div className="space-y-1.5">
              <Label htmlFor="existing-select" className="text-xs font-semibold">
                Select Existing Student
              </Label>
              <select
                id="existing-select"
                value={studentId}
                onChange={(e) => handleSelectExistingStudent(e.target.value)}
                className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs shadow-sm focus:ring-2 focus:ring-primary/20"
              >
                <option value="">-- Choose student from directory --</option>
                {students.map((s) => (
                  <option key={s.id} value={s.studentId}>
                    {s.name} ({s.studentId}) {s.department ? `— ${s.department}` : ""} {s.faceRegistered ? "✓ (Face Enrolled)" : ""}
                  </option>
                ))}
              </select>
            </div>
            {studentId && (
              <div className="text-xs text-muted-foreground flex gap-4 pt-1">
                <span><strong>Name:</strong> {name}</span>
                <span><strong>Dept:</strong> {department || "N/A"}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 rounded-xl bg-muted/30 border border-border/60">
            <div className="space-y-1.5">
              <Label htmlFor="s-name" className="text-xs font-semibold">Full Name *</Label>
              <Input
                id="s-name"
                placeholder="e.g. Rahul Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 text-xs rounded-lg"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-id" className="text-xs font-semibold">Student / Roll ID *</Label>
              <Input
                id="s-id"
                placeholder="e.g. 2024CS101"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="h-9 text-xs rounded-lg font-mono"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-dept" className="text-xs font-semibold">Class / Department</Label>
              <Input
                id="s-dept"
                placeholder="e.g. Computer Science"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="h-9 text-xs rounded-lg"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-phone" className="text-xs font-semibold">Student Phone</Label>
              <Input
                id="s-phone"
                placeholder="+91 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-9 text-xs rounded-lg"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="s-email" className="text-xs font-semibold">Student Email</Label>
              <Input
                id="s-email"
                type="email"
                placeholder="rahul@institution.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-9 text-xs rounded-lg"
              />
            </div>
          </div>
        )}

        {/* Camera Launch & Preview */}
        {!showCamera && descriptors.length < MAX_SAMPLES && (
          <div className="text-center py-6 border border-dashed border-border/80 rounded-2xl bg-muted/20">
            <ScanFace className="w-10 h-10 mx-auto text-primary mb-2 opacity-80" />
            <p className="text-sm font-semibold text-foreground">Facial Biometric Scanner</p>
            <p className="text-xs text-muted-foreground mt-0.5 mb-4 max-w-sm mx-auto">
              Ready to capture {MAX_SAMPLES} face vector samples with real-time neural vision tracking.
            </p>
            <Button
              onClick={startCamera}
              disabled={!isModelLoaded || !studentId || (mode === "new" && !name)}
              className="h-10 px-5 text-xs font-semibold gap-2 bg-primary text-primary-foreground shadow-md shadow-primary/20"
            >
              <Camera className="w-4 h-4" />
              Launch Camera & Scanner
            </Button>
          </div>
        )}

        {/* Live Camera View with Real-time Canvas Reticle */}
        {showCamera && (
          <div className="relative rounded-2xl overflow-hidden border-2 border-primary bg-slate-950 aspect-video shadow-2xl">
            {/* Mirrored webcam stream */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover -scale-x-100"
            />

            {/* Overlaid canvas for real-time tracking box */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />

            {/* Top HUD status */}
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
              <div className="bg-black/70 backdrop-blur-md px-3 py-1 rounded-full text-xs text-white font-mono flex items-center gap-2 border border-white/10">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Dual-Engine Neural Vision</span>
              </div>

              {isFaceInFrame ? (
                <Badge className="bg-emerald-500 text-white shadow-lg animate-pulse">
                  Face in Frame ({liveConfidence}%)
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-black/60 text-amber-300 border border-amber-500/40">
                  Align face in center
                </Badge>
              )}
            </div>

            {/* Bottom Controls */}
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3 px-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={stopCamera}
                className="text-xs font-semibold bg-white/90 hover:bg-white text-slate-900 shadow-md"
              >
                <X className="w-4 h-4 mr-1.5" /> Cancel
              </Button>
              <Button
                size="sm"
                onClick={captureSample}
                disabled={isCapturing}
                className={`text-xs font-semibold gap-1.5 shadow-lg transition-all ${
                  isFaceInFrame
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-400/50 scale-105"
                    : "bg-primary text-primary-foreground"
                }`}
              >
                {isCapturing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing Face...
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4" />
                    Capture Face Sample ({descriptors.length}/{MAX_SAMPLES})
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Samples Captured & Save Button */}
        {descriptors.length > 0 && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  {descriptors.length} of {MAX_SAMPLES} Biometric Vector Samples Ready
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Averaged 128-dimensional vector will be stored in SQLite for ultra-fast matching.
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              {descriptors.length < MAX_SAMPLES && !showCamera && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={startCamera}
                  className="text-xs h-9"
                >
                  <Camera className="w-3.5 h-3.5 mr-1.5" />
                  Capture Sample {descriptors.length + 1}
                </Button>
              )}
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold gap-1.5 shadow-md shadow-emerald-600/20 h-9"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    Save Student & Face
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
