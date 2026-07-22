/**
 * @file frontend/src/pages/settings/NotificationSettings.tsx
 * @description Page to configure user notification preferences.
 */

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Bell, Mail, MessageSquare, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function NotificationSettings() {
  const [settings, setSettings] = useState<any>({
    emailEnabled: true,
    smsEnabled: false,
    pushEnabled: true,
    absentAlertEnabled: true,
    attendanceConfirmEnabled: true,
    lowAttendanceEnabled: true,
    reportEmailEnabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const token = localStorage.getItem("attendreg_access_token") || sessionStorage.getItem("attendreg_access_token");
        const res = await fetch("/api/settings/notifications", {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        if (!res.ok) throw new Error("Failed to load settings");
        const data = await res.json();
        setSettings(data);
      } catch (err: any) {
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleToggle = (key: string) => {
    setSettings((prev: any) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem("attendreg_access_token") || sessionStorage.getItem("attendreg_access_token");
      const res = await fetch("/api/settings/notifications", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Failed to save notification settings");
      toast.success("Notification preferences saved successfully!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <Loader2 className="animate-spin h-12 w-12 text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Notification Preferences
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Choose how and when you receive automated attendance notices.
          </p>
        </div>

        <Card className="bg-slate-900/30 border-slate-800 backdrop-blur-xl mb-6">
          <CardHeader>
            <CardTitle className="text-slate-100 text-lg font-bold">Delivery Channels</CardTitle>
            <CardDescription className="text-slate-500">Enable or disable messaging routes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Email Toggle */}
            <div className="flex justify-between items-center py-2">
              <div className="space-y-0.5">
                <Label className="text-slate-200 font-semibold flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-400" /> Email Notifications
                </Label>
                <p className="text-slate-500 text-xs">Receive alerts directly in your inbox</p>
              </div>
              <Switch checked={settings.emailEnabled} onCheckedChange={() => handleToggle("emailEnabled")} />
            </div>

            {/* SMS Toggle */}
            <div className="flex justify-between items-center py-2">
              <div className="space-y-0.5">
                <Label className="text-slate-200 font-semibold flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-400" /> SMS Alerts
                </Label>
                <p className="text-slate-500 text-xs">Send urgent reminders to your mobile device</p>
              </div>
              <Switch checked={settings.smsEnabled} onCheckedChange={() => handleToggle("smsEnabled")} />
            </div>

            {/* Push Toggle */}
            <div className="flex justify-between items-center py-2">
              <div className="space-y-0.5">
                <Label className="text-slate-200 font-semibold flex items-center gap-2">
                  <Bell className="w-4 h-4 text-purple-400" /> Browser Push Notifications
                </Label>
                <p className="text-slate-500 text-xs">Show desktop banner notifications in real time</p>
              </div>
              <Switch checked={settings.pushEnabled} onCheckedChange={() => handleToggle("pushEnabled")} />
            </div>
          </CardContent>
        </Card>

        {/* Triggers Section */}
        <Card className="bg-slate-900/30 border-slate-800 backdrop-blur-xl mb-8">
          <CardHeader>
            <CardTitle className="text-slate-100 text-lg font-bold">Notification Triggers</CardTitle>
            <CardDescription className="text-slate-500">Decide which alerts to subscribe to</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-between items-center py-2">
              <div className="space-y-0.5">
                <Label className="text-slate-200">Absent Alerts</Label>
                <p className="text-slate-500 text-xs">Triggered when you are marked absent in a class</p>
              </div>
              <Switch checked={settings.absentAlertEnabled} onCheckedChange={() => handleToggle("absentAlertEnabled")} />
            </div>

            <div className="flex justify-between items-center py-2">
              <div className="space-y-0.5">
                <Label className="text-slate-200">Confirmation Notices</Label>
                <p className="text-slate-500 text-xs">Triggered immediately when attendance is successfully recorded</p>
              </div>
              <Switch checked={settings.attendanceConfirmEnabled} onCheckedChange={() => handleToggle("attendanceConfirmEnabled")} />
            </div>

            <div className="flex justify-between items-center py-2">
              <div className="space-y-0.5">
                <Label className="text-slate-200">Low Attendance Warning</Label>
                <p className="text-slate-500 text-xs">Triggered if your attendance drops below the 75% requirement</p>
              </div>
              <Switch checked={settings.lowAttendanceEnabled} onCheckedChange={() => handleToggle("lowAttendanceEnabled")} />
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={saving} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-500/20">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
          Save Notification Settings
        </Button>
      </main>
    </div>
  );
}
