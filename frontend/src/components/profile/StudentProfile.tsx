/**
 * StudentProfile.tsx
 * Student Profile editing tab with photo/signature uploads, emergency contact
 * details, and address details. Implements local image compression via canvas.
 */

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  User,
  MapPin,
  Phone,
  Camera,
  Signature,
  Save,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// ─────────────────────────────────────────────
// SCHEMA
// ─────────────────────────────────────────────

const profileSchema = z.object({
  gender: z.string().min(1, "Select gender"),
  dateOfBirth: z.string().min(1, "Select date of birth"),
  bloodGroup: z.string().min(1, "Select blood group"),
  aadharNumber: z.string().length(12, "Aadhar must be exactly 12 digits").regex(/^\d+$/, "Aadhar must be digits"),
  permanentAddress: z.string().min(5, "Address must be at least 5 characters"),
  currentAddress: z.string().min(5, "Address must be at least 5 characters"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  pincode: z.string().length(6, "Pincode must be exactly 6 digits").regex(/^\d+$/, "Pincode must be digits"),
  emergencyContactName: z.string().min(2, "Emergency contact name is required"),
  emergencyContactPhone: z.string().length(10, "Phone number must be exactly 10 digits").regex(/^\d+$/, "Phone must be digits"),
  emergencyContactRelation: z.string().min(2, "Relation is required"),
});

type ProfileValues = z.infer<typeof profileSchema>;

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────

interface StudentProfileProps {
  studentId: string;
  onProfileUpdated?: () => void;
}

export function StudentProfile({ studentId, onProfileUpdated }: StudentProfileProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [sigBase64, setSigBase64] = useState<string | null>(null);
  const [completion, setCompletion] = useState(0);

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      gender: "",
      dateOfBirth: "",
      bloodGroup: "",
      aadharNumber: "",
      permanentAddress: "",
      currentAddress: "",
      city: "",
      state: "",
      pincode: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      emergencyContactRelation: "",
    },
  });

  // Load Profile
  const loadProfile = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v2/profile/student/${studentId}`);
      if (!res.ok) throw new Error("Failed to load profile");
      const data = await res.json();

      if (data.profile) {
        const p = data.profile;
        form.reset({
          gender: p.gender || "",
          dateOfBirth: p.dateOfBirth ? new Date(p.dateOfBirth).toISOString().split("T")[0] : "",
          bloodGroup: p.bloodGroup || "",
          aadharNumber: p.aadharNumber || "",
          permanentAddress: p.permanentAddress || "",
          currentAddress: p.currentAddress || "",
          city: p.city || "",
          state: p.state || "",
          pincode: p.pincode || "",
          emergencyContactName: p.emergencyContactName || "",
          emergencyContactPhone: p.emergencyContactPhone || "",
          emergencyContactRelation: p.emergencyContactRelation || "",
        });
        setPhotoBase64(p.photo || null);
        setSigBase64(p.signature || null);
        setCompletion(p.profileCompletion || 0);
      }
    } catch {
      toast.error("Failed to load student profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [studentId]);

  // Client-side image compression using Canvas
  const compressImage = (file: File, maxWidth: number, maxHeight: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;

          // Scale dimensions
          if (width > height) {
            if (width > maxWidth) {
              height *= maxWidth / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width *= maxHeight / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);

          // Compress to JPEG with quality 0.7
          const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
          resolve(dataUrl);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  // Upload photo/signature media
  const handleMediaUpload = async (file: File, type: "photo" | "signature") => {
    try {
      const compressedBase64 = await compressImage(file, type === "photo" ? 300 : 400, type === "photo" ? 300 : 150);

      const res = await fetch(`/api/v2/profile/student/${studentId}/media`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [type]: compressedBase64 }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (type === "photo") setPhotoBase64(compressedBase64);
      else setSigBase64(compressedBase64);

      if (data.profile) {
        setCompletion(data.profile.profileCompletion);
      }

      toast.success(`${type === "photo" ? "Photo" : "Signature"} uploaded successfully`);
      onProfileUpdated?.();
    } catch (err: any) {
      toast.error(err.message || `Failed to upload ${type}`);
    }
  };

  async function onSubmit(values: ProfileValues) {
    setSaving(true);
    try {
      const res = await fetch(`/api/v2/profile/student/${studentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");

      if (data.profile) {
        setCompletion(data.profile.profileCompletion);
      }

      toast.success("Profile saved successfully");
      onProfileUpdated?.();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
        <RefreshCw className="h-5 w-5 animate-spin" />
        <span>Loading personal profile...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile completion bar */}
      <div className="space-y-2 bg-muted/30 border p-4 rounded-xl">
        <div className="flex justify-between items-center text-sm font-medium">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            Profile Completion
          </span>
          <span className="text-foreground">{completion}%</span>
        </div>
        <Progress value={completion} className="h-2 bg-slate-200 dark:bg-slate-800" />
        <p className="text-xs text-muted-foreground pt-0.5">
          Fill out all sections and upload photo/signature to reach 100% completion.
        </p>
      </div>

      {/* Media upload section */}
      <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-xl border bg-card/50">
        {/* Photo Upload */}
        <div className="flex flex-col items-center gap-2">
          <div className="relative group">
            <Avatar className="h-24 w-24 border-2 border-primary/20">
              <AvatarImage src={photoBase64 || undefined} />
              <AvatarFallback>
                <User className="h-10 w-10 text-muted-foreground" />
              </AvatarFallback>
            </Avatar>
            <label className="absolute bottom-0 right-0 p-1.5 rounded-full bg-primary text-white cursor-pointer hover:scale-105 transition-transform shadow-md">
              <Camera className="h-4 w-4" />
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && handleMediaUpload(e.target.files[0], "photo")}
              />
            </label>
          </div>
          <span className="text-xs font-semibold text-muted-foreground">Profile Photo</span>
        </div>

        {/* Signature Upload */}
        <div className="flex-1 flex flex-col items-center sm:items-start gap-2">
          {sigBase64 ? (
            <div className="border rounded-md p-2 bg-white dark:bg-slate-900 w-full max-w-[200px] h-12 flex items-center justify-center relative group">
              <img src={sigBase64} alt="Signature" className="max-h-full max-w-full object-contain" />
              <label className="absolute top-1 right-1 p-1 rounded bg-black/60 text-white cursor-pointer hover:bg-black transition-colors opacity-0 group-hover:opacity-100">
                <Signature className="h-3 w-3" />
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleMediaUpload(e.target.files[0], "signature")}
                />
              </label>
            </div>
          ) : (
            <label className="border border-dashed rounded-md p-4 bg-muted/20 w-full max-w-[200px] h-12 flex items-center justify-center cursor-pointer hover:bg-muted/40 transition-colors">
              <Signature className="h-4 w-4 text-muted-foreground mr-2" />
              <span className="text-xs text-muted-foreground">Upload Signature</span>
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && handleMediaUpload(e.target.files[0], "signature")}
              />
            </label>
          )}
          <span className="text-xs font-semibold text-muted-foreground">Student E-Signature</span>
        </div>
      </div>

      {/* Main Profile Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Section 1: Personal Details */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2 border-b pb-1 text-primary">
              <User className="h-4 w-4" /> Personal Profile
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Birth</FormLabel>
                    <FormControl>
                      <Input type="date" className="h-11" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bloodGroup"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Blood Group</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Select blood group" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="A+">A +ve</SelectItem>
                        <SelectItem value="A-">A -ve</SelectItem>
                        <SelectItem value="B+">B +ve</SelectItem>
                        <SelectItem value="B-">B -ve</SelectItem>
                        <SelectItem value="O+">O +ve</SelectItem>
                        <SelectItem value="O-">O -ve</SelectItem>
                        <SelectItem value="AB+">AB +ve</SelectItem>
                        <SelectItem value="AB-">AB -ve</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="aadharNumber"
                render={({ field }) => (
                  <FormItem className="md:col-span-3">
                    <FormLabel>Aadhar Card Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter 12-digit Aadhar number" className="h-11 font-mono" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Section 2: Address */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2 border-b pb-1 text-primary">
              <MapPin className="h-4 w-4" /> Permanent Address
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="permanentAddress"
                render={({ field }) => (
                  <FormItem className="md:col-span-3">
                    <FormLabel>Permanent Address</FormLabel>
                    <FormControl>
                      <Input placeholder="Flat, Street, Area info" className="h-11" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currentAddress"
                render={({ field }) => (
                  <FormItem className="md:col-span-3">
                    <FormLabel>Current/Local Address</FormLabel>
                    <FormControl>
                      <Input placeholder="Current residence address" className="h-11" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input placeholder="City" className="h-11" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <FormControl>
                      <Input placeholder="State" className="h-11" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="pincode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pincode</FormLabel>
                    <FormControl>
                      <Input placeholder="6-digit pincode" className="h-11 font-mono" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Section 3: Emergency Contact */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2 border-b pb-1 text-primary">
              <Phone className="h-4 w-4" /> Emergency Contact
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="emergencyContactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Person Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Name" className="h-11" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="emergencyContactPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder="10-digit mobile number" className="h-11 font-mono" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="emergencyContactRelation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Relation</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Father, Uncle, Mother" className="h-11" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Save Button */}
          <Button
            type="submit"
            className="w-full h-11 gap-2 font-medium"
            disabled={saving}
          >
            {saving ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" /> Save Profile Details
              </>
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}


