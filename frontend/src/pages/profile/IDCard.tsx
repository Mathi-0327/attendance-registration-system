import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Download, ArrowLeft, Printer, User } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "sonner";
import { Link } from "wouter";

export default function IDCard() {
  const { user } = useAuth();
  const studentId = user?.username; // Fallback handled in effect
  const [loading, setLoading] = useState(true);
  const [cardData, setCardData] = useState<any>(null);
  const idCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchIDCard = async () => {
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
        const res = await fetch(`/api/v2/profile/student/${currentStudentId}/idcard`);
        if (res.ok) {
          const data = await res.json();
          setCardData(data);
        } else {
          toast.error("Failed to load ID card details");
        }
      } catch (err) {
        toast.error("An error occurred");
      } finally {
        setLoading(false);
      }
    };
    fetchIDCard();
  }, [studentId]);

  const handleDownloadPDF = async () => {
    if (!idCardRef.current) return;
    
    try {
      const canvas = await html2canvas(idCardRef.current, {
        scale: 3, // High resolution
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/png");
      // Standard ID card size: 2.125 x 3.375 inches (CR80) -> approx 54 x 86 mm
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [54, 86]
      });

      pdf.addImage(imgData, "PNG", 0, 0, 54, 86);
      pdf.save(`IDCard_${cardData?.studentId || "Student"}.pdf`);
      toast.success("ID Card downloaded successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF");
    }
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!cardData) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-4 text-center">
        <h2 className="text-xl font-bold mb-2">Profile Incomplete</h2>
        <p className="text-slate-500 mb-4">Please complete your profile details to generate an ID Card.</p>
        <Link href="/profile/student">
          <Button>Complete Profile</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-12">
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/profile/student">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-xl font-semibold">Student ID Card</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.print()} className="gap-2">
              <Printer className="w-4 h-4" /> Print
            </Button>
            <Button onClick={handleDownloadPDF} className="gap-2">
              <Download className="w-4 h-4" /> Download PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 mt-12 flex flex-col items-center">
        
        {/* ID Card Container - Fixed aspect ratio for CR80 standard */}
        <div className="bg-white shadow-2xl rounded-2xl overflow-hidden print:shadow-none" style={{ width: '340px', height: '540px' }} ref={idCardRef}>
          
          {/* Header */}
          <div className="bg-blue-700 text-white p-4 text-center">
            <h2 className="text-lg font-bold tracking-tight uppercase leading-tight">{cardData.institution?.name}</h2>
            <p className="text-[10px] opacity-80 uppercase mt-1">{cardData.institution?.address}</p>
          </div>

          <div className="p-6 flex flex-col items-center bg-white relative">
            {/* Background Logo Watermark (Optional) */}
            <div className="absolute inset-0 opacity-[0.03] flex items-center justify-center pointer-events-none">
              <span className="text-9xl font-bold font-serif text-blue-900">AR</span>
            </div>

            {/* Profile Photo */}
            <div className="w-32 h-32 rounded-xl overflow-hidden border-2 border-blue-100 shadow-sm z-10 bg-slate-50">
              {cardData.photo ? (
                <img src={cardData.photo} alt="Student" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-300">
                  <User className="w-16 h-16" />
                </div>
              )}
            </div>

            {/* Personal Info */}
            <div className="text-center mt-4 w-full z-10">
              <h3 className="text-xl font-bold text-slate-900 truncate uppercase">{cardData.name}</h3>
              <p className="text-blue-700 font-semibold text-sm mt-1">{cardData.department}</p>
              
              <div className="grid grid-cols-2 gap-x-2 gap-y-3 mt-5 text-left text-xs bg-slate-50 rounded-lg p-3 border border-slate-100">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Student ID</span>
                  <span className="text-slate-900 font-medium">{cardData.studentId}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Blood Group</span>
                  <span className="text-red-600 font-bold">{cardData.bloodGroup}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">DOB</span>
                  <span className="text-slate-900 font-medium">{cardData.dateOfBirth ? new Date(cardData.dateOfBirth).toLocaleDateString() : 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Emergency</span>
                  <span className="text-slate-900 font-medium">{cardData.emergencyContact}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer & QR */}
          <div className="mt-auto flex items-end justify-between p-6 bg-gradient-to-t from-slate-50 to-white">
            <div className="flex flex-col items-center">
              {cardData.signature ? (
                <img src={cardData.signature} alt="Signature" className="h-8 max-w-[120px] object-contain opacity-80 mix-blend-multiply" />
              ) : (
                <div className="h-8 w-24 border-b border-dashed border-slate-300"></div>
              )}
              <span className="text-[9px] text-slate-500 uppercase font-semibold mt-1">Holder's Signature</span>
            </div>
            
            <div className="bg-white p-1.5 rounded-lg border border-slate-200 shadow-sm">
              <QRCodeSVG 
                value={cardData.qrCodeValue || cardData.studentId} 
                size={60} 
                level={"M"} 
              />
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="bg-blue-700 h-2 w-full"></div>
        </div>
      </div>
    </div>
  );
}
