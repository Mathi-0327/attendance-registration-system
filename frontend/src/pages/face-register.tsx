import { useSystem } from "@/context/SystemContext";
import { Header } from "@/components/layout/Header";
import { FaceRegistration } from "@/components/admin/FaceRegistration";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export default function FaceRegisterPage() {
    const { isAuthenticated } = useSystem();

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <Header />
            <main className="flex-1 container py-8 px-4 md:px-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-8"
                >
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Biometric Onboarding</h1>
                            <p className="text-muted-foreground">Register student faces for the AI Attendance System.</p>
                        </div>
                        <Button variant="outline" onClick={() => window.history.back()}>
                            Back to Dashboard
                        </Button>
                    </div>

                    <FaceRegistration />

                </motion.div>
            </main>
        </div>
    );
}
