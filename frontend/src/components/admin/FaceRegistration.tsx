import { useState, useRef, useEffect } from "react";
import * as faceapi from "face-api.js";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, Save, X, UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSystem } from "@/context/SystemContext";

const MAX_SAMPLES = 3;

export function FaceRegistration() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isModelLoaded, setIsModelLoaded] = useState(false);
    const [studentId, setStudentId] = useState("");
    const [descriptors, setDescriptors] = useState<Float32Array[]>([]);
    const [isCapturing, setIsCapturing] = useState(false);
    const [showCamera, setShowCamera] = useState(false);

    // Load models on mount
    useEffect(() => {
        const loadModels = async () => {
            const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/";
            try {
                await Promise.all([
                    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL), // Faster than tinyFaceDetector for higher acc
                    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
                ]);
                setIsModelLoaded(true);
                toast.success("AI Face Models loaded successfully");
            } catch (err) {
                console.error("Failed to load models", err);
                toast.error("Failed to load AI models. Check internet connection.");
            }
        };
        loadModels();
    }, []);

    const startCamera = async () => {
        setShowCamera(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            toast.error("Could not access camera");
            setShowCamera(false);
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        setShowCamera(false);
    };

    const captureSample = async () => {
        if (!videoRef.current || !isModelLoaded) return;
        setIsCapturing(true);

        try {
            // 1. Detect face
            const detection = await faceapi
                .detectSingleFace(videoRef.current, new faceapi.SsdMobilenetv1Options())
                .withFaceLandmarks()
                .withFaceDescriptor();

            if (!detection) {
                toast.error("No face detected! Look straight at the camera.");
                setIsCapturing(false);
                return;
            }

            // 2. Save descriptor
            setDescriptors(prev => [...prev, detection.descriptor]);
            toast.success(`Sample ${descriptors.length + 1}/${MAX_SAMPLES} captured!`);

            // 3. Stop if enough samples
            if (descriptors.length + 1 >= MAX_SAMPLES) {
                stopCamera();
            }

        } catch (err) {
            console.error(err);
            toast.error("Detection failed");
        } finally {
            setIsCapturing(false);
        }
    };

    const handleSave = async () => {
        if (descriptors.length === 0) return;

        // Average the descriptors for better accuracy
        const avgDescriptor = new Float32Array(128);
        for (let i = 0; i < 128; i++) {
            let sum = 0;
            for (const d of descriptors) sum += d[i];
            avgDescriptor[i] = sum / descriptors.length;
        }

        try {
            const res = await fetch(`/api/students/${studentId}/face`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ descriptor: Array.from(avgDescriptor) }),
            });

            if (res.ok) {
                toast.success("Face registered successfully!");
                setDescriptors([]);
                setStudentId("");
            } else {
                const err = await res.json();
                toast.error(err.error || "Failed to save face data");
            }
        } catch (err) {
            toast.error("Network error");
        }
    };

    return (
        <Card className="w-full max-w-2xl mx-auto shadow-xl">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <UserPlus className="w-6 h-6" />
                    Face Registration
                </CardTitle>
                <CardDescription>
                    Capture {MAX_SAMPLES} photos to enable facial recognition for this student.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

                <div className="flex gap-4 items-end">
                    <div className="flex-1 space-y-2">
                        <Label htmlFor="sid">Student ID</Label>
                        <Input
                            id="sid"
                            value={studentId}
                            onChange={(e) => setStudentId(e.target.value)}
                            placeholder="Enter Student ID (e.g. CS101)"
                        />
                    </div>
                    {!showCamera && descriptors.length < MAX_SAMPLES && (
                        <Button onClick={startCamera} disabled={!isModelLoaded || !studentId}>
                            <Camera className="mr-2 h-4 w-4" />
                            Start Camera
                        </Button>
                    )}
                </div>

                {/* Camera Feed */}
                {showCamera && (
                    <div className="relative rounded-lg overflow-hidden border-2 border-primary bg-black aspect-video">
                        <video
                            ref={videoRef}
                            autoPlay
                            muted
                            className="w-full h-full object-cover"
                        />

                        {/* Overlay UI */}
                        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                            <Button
                                variant="secondary"
                                onClick={stopCamera}
                            >
                                <X className="mr-2 h-4 w-4" /> Cancel
                            </Button>
                            <Button
                                onClick={captureSample}
                                disabled={isCapturing}
                            >
                                {isCapturing ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Camera className="mr-2 h-4 w-4" />
                                )}
                                Capture Sample ({descriptors.length}/{MAX_SAMPLES})
                            </Button>
                        </div>
                    </div>
                )}

                {/* Success State */}
                {descriptors.length >= MAX_SAMPLES && (
                    <div className="bg-green-50 p-4 rounded-lg flex items-center justify-between">
                        <div className="text-green-700 font-medium">
                            ✓ Face samples collected
                        </div>
                        <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700">
                            <Save className="mr-2 h-4 w-4" />
                            Save Face Data
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
