import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QrCode, Copy, Download, Wifi, Check, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export function QRCodeDisplay() {
  const [qrUrl, setQrUrl] = useState("");
  const [qrData, setQrData] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/qr-code")
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        setQrUrl(data.url);
        setQrData(data.qrData || data.url);
      })
      .catch((error) => {
        console.error("Error fetching QR code:", error);
        const currentUrl = window.location.origin;
        const attendanceUrl = `${currentUrl}/attendance`;
        setQrUrl(attendanceUrl);
        setQrData(attendanceUrl);
      });
  }, []);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(qrUrl);
    setCopied(true);
    toast.success("Attendance URL copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadQR = () => {
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(
      qrUrl
    )}`;
    const link = document.createElement("a");
    link.href = qrImageUrl;
    link.download = "attendance-qr-code.png";
    link.click();
    toast.success("QR Code downloaded");
  };

  return (
    <Card className="relative overflow-hidden border border-border/60 bg-card/80 backdrop-blur-md shadow-md">
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">Quick QR Connect</CardTitle>
              <CardDescription className="text-xs">Scan from student smartphones</CardDescription>
            </div>
          </div>
          <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            <Wifi className="h-3 w-3" /> Same Wi-Fi
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Glowing QR Code Container */}
        <div className="relative group flex justify-center items-center p-5 bg-gradient-to-b from-muted/60 to-muted/20 rounded-2xl border border-border/50">
          {qrData ? (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="p-3 bg-white rounded-xl shadow-xl border border-slate-200"
            >
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                  qrData
                )}`}
                alt="Attendance QR Code"
                className="w-44 h-44 object-contain"
              />
            </motion.div>
          ) : (
            <div className="w-44 h-44 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-xs">Generating QR...</span>
            </div>
          )}
        </div>

        {/* URL Display */}
        <div className="space-y-2">
          <div className="p-2.5 rounded-lg bg-muted/40 border border-border/40 font-mono text-xs text-muted-foreground break-all flex items-center justify-between gap-2">
            <span className="truncate">{qrUrl || "Loading URL..."}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              onClick={copyToClipboard}
              variant="outline"
              size="sm"
              className="w-full gap-1.5 h-9 font-medium"
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? "Copied!" : "Copy Link"}
            </Button>
            <Button
              onClick={downloadQR}
              variant="outline"
              size="sm"
              className="w-full gap-1.5 h-9 font-medium"
            >
              <Download className="h-4 w-4" />
              Save Image
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
