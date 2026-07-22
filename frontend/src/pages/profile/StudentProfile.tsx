import { useState, useEffect } from "react";
import { useSystem } from "@/context/SystemContext";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Camera, User, Phone, MapPin, Users, PenTool, Loader2, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";

export default function StudentProfile() {
  const { user } = useAuth();
  const studentId = user?.username; // Assuming studentId is the username or use local storage if using legacy auth
  const [activeTab, setActiveTab] = useState("personal");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);

  // Forms states
  const [personalForm, setPersonalForm] = useState({
    gender: "", dateOfBirth: "", bloodGroup: "", religion: "",
    category: "", nationality: "Indian", aadharNumber: ""
  });
  const [addressForm, setAddressForm] = useState({
    permanentAddress: "", currentAddress: "", city: "", state: "", pincode: "",
    emergencyContactName: "", emergencyContactPhone: "", emergencyContactRelation: ""
  });
  const [parentForm, setParentForm] = useState({
    fatherName: "", fatherOccupation: "", fatherPhone: "", fatherEmail: "",
    motherName: "", motherOccupation: "", motherPhone: "", motherEmail: "",
    primaryContact: "father"
  });

  useEffect(() => {
    const fetchProfile = async () => {
      // Fallback to local storage if user context isn't fully migrated yet
      const savedStudent = localStorage.getItem("student_data");
      let currentStudentId = studentId;
      if (!currentStudentId && savedStudent) {
        currentStudentId = JSON.parse(savedStudent).studentId;
      }

      if (!currentStudentId) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/v2/profile/student/${currentStudentId}`);
        if (res.ok) {
          const data = await res.json();
          setProfileData(data);
          
          if (data.profile) {
            setPersonalForm({
              gender: data.profile.gender || "",
              dateOfBirth: data.profile.dateOfBirth ? new Date(data.profile.dateOfBirth).toISOString().split('T')[0] : "",
              bloodGroup: data.profile.bloodGroup || "",
              religion: data.profile.religion || "",
              category: data.profile.category || "",
              nationality: data.profile.nationality || "Indian",
              aadharNumber: data.profile.aadharNumber || ""
            });
            setAddressForm({
              permanentAddress: data.profile.permanentAddress || "",
              currentAddress: data.profile.currentAddress || "",
              city: data.profile.city || "",
              state: data.profile.state || "",
              pincode: data.profile.pincode || "",
              emergencyContactName: data.profile.emergencyContactName || "",
              emergencyContactPhone: data.profile.emergencyContactPhone || "",
              emergencyContactRelation: data.profile.emergencyContactRelation || ""
            });
          }
          if (data.parents) {
            setParentForm({
              fatherName: data.parents.fatherName || "",
              fatherOccupation: data.parents.fatherOccupation || "",
              fatherPhone: data.parents.fatherPhone || "",
              fatherEmail: data.parents.fatherEmail || "",
              motherName: data.parents.motherName || "",
              motherOccupation: data.parents.motherOccupation || "",
              motherPhone: data.parents.motherPhone || "",
              motherEmail: data.parents.motherEmail || "",
              primaryContact: data.parents.primaryContact || "father"
            });
          }
        }
      } catch (err) {
        console.error("Error fetching profile", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [studentId]);

  const handleUpdateProfile = async (e: React.FormEvent, type: 'personal' | 'address' | 'parents') => {
    e.preventDefault();
    setSaving(true);
    const savedStudent = localStorage.getItem("student_data");
    const currentStudentId = studentId || (savedStudent ? JSON.parse(savedStudent).studentId : null);

    try {
      let endpoint = `/api/v2/profile/student/${currentStudentId}`;
      let bodyData = {};

      if (type === 'personal') {
        bodyData = { ...personalForm };
      } else if (type === 'address') {
        bodyData = { ...addressForm };
      } else if (type === 'parents') {
        endpoint = `/api/v2/profile/student/${currentStudentId}/parent`;
        bodyData = { ...parentForm };
      }

      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyData)
      });

      if (res.ok) {
        toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} details updated`);
        // Optionally refetch to update completion %
        const profileRes = await fetch(`/api/v2/profile/student/${currentStudentId}`);
        if (profileRes.ok) {
          setProfileData(await profileRes.json());
        }
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || "Update failed");
      }
    } catch (err) {
      toast.error("An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'photo' | 'signature') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size, say limit to 500kb for base64
    if (file.size > 500 * 1024) {
      toast.error("File is too large. Please upload an image under 500KB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      const savedStudent = localStorage.getItem("student_data");
      const currentStudentId = studentId || (savedStudent ? JSON.parse(savedStudent).studentId : null);

      try {
        const res = await fetch(`/api/v2/profile/student/${currentStudentId}/media`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [type]: base64String })
        });
        if (res.ok) {
          toast.success(`${type} uploaded successfully`);
          setProfileData((prev: any) => ({
            ...prev,
            profile: { ...prev.profile, [type]: base64String }
          }));
        }
      } catch (err) {
        toast.error("Upload failed");
      }
    };
    reader.readAsDataURL(file);
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  const completion = profileData?.profile?.profileCompletion || 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-12">
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/student">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-xl font-semibold">Student Profile</h1>
          </div>
          <Link href="/profile/id-card">
            <Button variant="outline" className="gap-2 bg-blue-600 text-white hover:bg-blue-700 hover:text-white border-blue-600">
              <User className="h-4 w-4" /> View ID Card
            </Button>
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 mt-8 grid grid-cols-1 md:grid-cols-4 gap-8">
        
        {/* Left Sidebar - Photo & Progress */}
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6 flex flex-col items-center">
              <div className="relative group mb-4">
                <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-slate-100 dark:border-slate-800 bg-slate-100 flex items-center justify-center">
                  {profileData?.profile?.photo ? (
                    <img src={profileData.profile.photo} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-12 h-12 text-slate-400" />
                  )}
                </div>
                <label className="absolute bottom-0 right-0 p-2 bg-blue-600 text-white rounded-full cursor-pointer hover:bg-blue-700 transition-colors shadow-lg">
                  <Camera className="w-4 h-4" />
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => handleMediaUpload(e, 'photo')} />
                </label>
              </div>
              <h2 className="text-xl font-bold">{profileData?.name || "Student"}</h2>
              <p className="text-sm text-slate-500 mb-6">{profileData?.studentId || "ID Not found"}</p>

              <div className="w-full space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 font-medium">Profile Completion</span>
                  <span className="font-bold text-blue-600">{completion}%</span>
                </div>
                <Progress value={completion} className="h-2" />
                {completion < 100 && (
                  <p className="text-xs text-slate-500 text-center mt-2">Complete all tabs to reach 100%</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Digital Signature</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg h-24 flex items-center justify-center relative hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors overflow-hidden">
                {profileData?.profile?.signature ? (
                  <img src={profileData.profile.signature} alt="Signature" className="h-full w-full object-contain p-2" />
                ) : (
                  <span className="text-sm text-slate-400 flex items-center gap-2"><PenTool className="w-4 h-4" /> Upload Signature</span>
                )}
                <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={(e) => handleMediaUpload(e, 'signature')} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Content - Tabs */}
        <div className="md:col-span-3">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-3 mb-6 bg-white dark:bg-slate-900 border p-1 rounded-lg">
              <TabsTrigger value="personal" className="rounded-md">Personal Details</TabsTrigger>
              <TabsTrigger value="address" className="rounded-md">Address & Contact</TabsTrigger>
              <TabsTrigger value="parents" className="rounded-md">Parents Info</TabsTrigger>
            </TabsList>

            {/* Personal Details Tab */}
            <TabsContent value="personal">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card>
                  <CardHeader>
                    <CardTitle>Personal Information</CardTitle>
                    <CardDescription>Update your basic personal details.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={(e) => handleUpdateProfile(e, 'personal')} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Gender</Label>
                          <select 
                            className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:focus:ring-slate-300"
                            value={personalForm.gender} 
                            onChange={(e) => setPersonalForm({...personalForm, gender: e.target.value})}
                          >
                            <option value="">Select Gender</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label>Date of Birth</Label>
                          <Input type="date" value={personalForm.dateOfBirth} onChange={(e) => setPersonalForm({...personalForm, dateOfBirth: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                          <Label>Blood Group</Label>
                          <Input placeholder="e.g. O+" value={personalForm.bloodGroup} onChange={(e) => setPersonalForm({...personalForm, bloodGroup: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                          <Label>Nationality</Label>
                          <Input value={personalForm.nationality} onChange={(e) => setPersonalForm({...personalForm, nationality: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                          <Label>Religion</Label>
                          <Input value={personalForm.religion} onChange={(e) => setPersonalForm({...personalForm, religion: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                          <Label>Aadhar Number</Label>
                          <Input value={personalForm.aadharNumber} onChange={(e) => setPersonalForm({...personalForm, aadharNumber: e.target.value})} />
                        </div>
                      </div>
                      <Button type="submit" disabled={saving}>
                        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        Save Changes
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* Address Details Tab */}
            <TabsContent value="address">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card>
                  <CardHeader>
                    <CardTitle>Address & Emergency Contact</CardTitle>
                    <CardDescription>Keep your contact details up to date.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={(e) => handleUpdateProfile(e, 'address')} className="space-y-8">
                      <div className="space-y-4">
                        <h3 className="text-sm font-semibold flex items-center gap-2"><MapPin className="w-4 h-4" /> Address Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2 md:col-span-2">
                            <Label>Current Address</Label>
                            <Input value={addressForm.currentAddress} onChange={(e) => setAddressForm({...addressForm, currentAddress: e.target.value})} />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label>Permanent Address</Label>
                            <Input value={addressForm.permanentAddress} onChange={(e) => setAddressForm({...addressForm, permanentAddress: e.target.value})} />
                          </div>
                          <div className="space-y-2">
                            <Label>City</Label>
                            <Input value={addressForm.city} onChange={(e) => setAddressForm({...addressForm, city: e.target.value})} />
                          </div>
                          <div className="space-y-2">
                            <Label>State</Label>
                            <Input value={addressForm.state} onChange={(e) => setAddressForm({...addressForm, state: e.target.value})} />
                          </div>
                          <div className="space-y-2">
                            <Label>Pincode</Label>
                            <Input value={addressForm.pincode} onChange={(e) => setAddressForm({...addressForm, pincode: e.target.value})} />
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-4 pt-4 border-t">
                        <h3 className="text-sm font-semibold flex items-center gap-2"><Phone className="w-4 h-4 text-red-500" /> Emergency Contact</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>Contact Name</Label>
                            <Input value={addressForm.emergencyContactName} onChange={(e) => setAddressForm({...addressForm, emergencyContactName: e.target.value})} />
                          </div>
                          <div className="space-y-2">
                            <Label>Phone Number</Label>
                            <Input value={addressForm.emergencyContactPhone} onChange={(e) => setAddressForm({...addressForm, emergencyContactPhone: e.target.value})} />
                          </div>
                          <div className="space-y-2">
                            <Label>Relation</Label>
                            <Input placeholder="e.g. Uncle" value={addressForm.emergencyContactRelation} onChange={(e) => setAddressForm({...addressForm, emergencyContactRelation: e.target.value})} />
                          </div>
                        </div>
                      </div>

                      <Button type="submit" disabled={saving}>
                        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        Save Changes
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* Parents Details Tab */}
            <TabsContent value="parents">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card>
                  <CardHeader>
                    <CardTitle>Parents & Guardian Information</CardTitle>
                    <CardDescription>Details will be used for automated attendance alerts.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={(e) => handleUpdateProfile(e, 'parents')} className="space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <h3 className="text-sm font-semibold border-b pb-2">Father's Details</h3>
                          <div className="space-y-2">
                            <Label>Name</Label>
                            <Input value={parentForm.fatherName} onChange={(e) => setParentForm({...parentForm, fatherName: e.target.value})} />
                          </div>
                          <div className="space-y-2">
                            <Label>Occupation</Label>
                            <Input value={parentForm.fatherOccupation} onChange={(e) => setParentForm({...parentForm, fatherOccupation: e.target.value})} />
                          </div>
                          <div className="space-y-2">
                            <Label>Phone</Label>
                            <Input value={parentForm.fatherPhone} onChange={(e) => setParentForm({...parentForm, fatherPhone: e.target.value})} />
                          </div>
                          <div className="space-y-2">
                            <Label>Email</Label>
                            <Input type="email" value={parentForm.fatherEmail} onChange={(e) => setParentForm({...parentForm, fatherEmail: e.target.value})} />
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h3 className="text-sm font-semibold border-b pb-2">Mother's Details</h3>
                          <div className="space-y-2">
                            <Label>Name</Label>
                            <Input value={parentForm.motherName} onChange={(e) => setParentForm({...parentForm, motherName: e.target.value})} />
                          </div>
                          <div className="space-y-2">
                            <Label>Occupation</Label>
                            <Input value={parentForm.motherOccupation} onChange={(e) => setParentForm({...parentForm, motherOccupation: e.target.value})} />
                          </div>
                          <div className="space-y-2">
                            <Label>Phone</Label>
                            <Input value={parentForm.motherPhone} onChange={(e) => setParentForm({...parentForm, motherPhone: e.target.value})} />
                          </div>
                          <div className="space-y-2">
                            <Label>Email</Label>
                            <Input type="email" value={parentForm.motherEmail} onChange={(e) => setParentForm({...parentForm, motherEmail: e.target.value})} />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 pt-4 border-t">
                        <Label>Primary Contact For Alerts</Label>
                        <select 
                          className="flex h-10 w-full md:w-64 items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:focus:ring-slate-300"
                          value={parentForm.primaryContact}
                          onChange={(e) => setParentForm({...parentForm, primaryContact: e.target.value})}
                        >
                          <option value="father">Father</option>
                          <option value="mother">Mother</option>
                          <option value="guardian">Guardian</option>
                        </select>
                      </div>

                      <Button type="submit" disabled={saving}>
                        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        Save Changes
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
