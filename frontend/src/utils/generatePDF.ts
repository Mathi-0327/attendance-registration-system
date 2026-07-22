import { format } from "date-fns";

interface AttendanceRecord {
  id: string;
  name: string;
  studentId: string;
  department?: string;
  timestamp: Date | string;
  status: string;
  ipAddress?: string;
}

interface Session {
  id: number;
  name: string | null;
  startTime: string | Date;
  endTime: string | Date | null;
  isActive: boolean;
}

interface PDFOptions {
  records: AttendanceRecord[];
  session: Session | null;
  sessionName?: string;
}

export async function generateAttendancePDF({ records, session, sessionName }: PDFOptions) {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;

  // ─── Header Banner ───────────────────────────────────────────────────────────
  doc.setFillColor(37, 99, 235); // blue-600
  doc.rect(0, 0, pageW, 32, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("AttendReg", margin, 14);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Attendance Management System", margin, 21);

  doc.setFontSize(9);
  const generated = `Generated: ${format(new Date(), "MMM dd, yyyy · HH:mm")}`;
  doc.text(generated, pageW - margin - doc.getTextWidth(generated), 21);

  // ─── Session Info Box ─────────────────────────────────────────────────────────
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, 38, pageW - margin * 2, 30, 3, 3, "FD");

  doc.setTextColor(51, 65, 85);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  const title = sessionName || session?.name || "Attendance Report";
  doc.text(title, margin + 5, 48);

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);

  const startStr = session?.startTime
    ? format(new Date(session.startTime), "MMM dd, yyyy  HH:mm")
    : format(new Date(), "MMM dd, yyyy  HH:mm");
  const endStr = session?.endTime
    ? format(new Date(session.endTime), "HH:mm")
    : session?.isActive
    ? "Session Active"
    : "—";

  doc.text(`Start: ${startStr}`, margin + 5, 56);
  doc.text(`End: ${endStr}`, margin + 5, 62);

  // Total count badge on the right
  const totalLabel = `${records.length} Student${records.length !== 1 ? "s" : ""}`;
  doc.setFillColor(37, 99, 235);
  const badgeW = 32;
  doc.roundedRect(pageW - margin - badgeW - 5, 45, badgeW + 10, 14, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(totalLabel, pageW - margin - badgeW / 2 - 5, 54, { align: "center" });

  // ─── Stats Row ────────────────────────────────────────────────────────────────
  const present = records.filter((r) => r.status === "present").length;
  const late = records.filter((r) => r.status === "late").length;
  const depts = records.reduce((acc: Record<string, number>, r) => {
    const d = r.department || "N/A";
    acc[d] = (acc[d] || 0) + 1;
    return acc;
  }, {});
  const topDept = Object.entries(depts).sort((a, b) => b[1] - a[1])[0];

  const statsY = 74;
  const statW = (pageW - margin * 2 - 12) / 3;

  const stats = [
    { label: "Present", value: `${present}`, color: [16, 185, 129] as [number,number,number] },
    { label: "Late", value: `${late}`, color: [245, 158, 11] as [number,number,number] },
    { label: "Top Dept", value: topDept ? `${topDept[0]} (${topDept[1]})` : "—", color: [99, 102, 241] as [number,number,number] },
  ];

  stats.forEach((s, i) => {
    const x = margin + i * (statW + 6);
    doc.setFillColor(s.color[0], s.color[1], s.color[2]);
    doc.roundedRect(x, statsY, statW, 18, 3, 3, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(s.value, x + statW / 2, statsY + 9, { align: "center" });
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.text(s.label, x + statW / 2, statsY + 15, { align: "center" });
  });

  // ─── Attendance Table ─────────────────────────────────────────────────────────
  autoTable(doc, {
    startY: statsY + 24,
    head: [["#", "Name", "Student ID", "Department", "Time", "Status"]],
    body: records.map((r, i) => [
      String(i + 1),
      r.name,
      r.studentId,
      r.department || "N/A",
      format(new Date(r.timestamp), "HH:mm:ss"),
      r.status.charAt(0).toUpperCase() + r.status.slice(1),
    ]),
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: { fontSize: 8.5, textColor: [51, 65, 85] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 42 },
      2: { cellWidth: 32 },
      3: { cellWidth: 28 },
      4: { cellWidth: 22, halign: "center" },
      5: { cellWidth: 22, halign: "center" },
    },
    margin: { left: margin, right: margin },
    didDrawCell: (data) => {
      if (data.section === "body" && data.column.index === 5) {
        const val = data.cell.raw as string;
        if (val === "Present") {
          doc.setTextColor(5, 150, 105);
        } else if (val === "Late") {
          doc.setTextColor(217, 119, 6);
        }
      }
    },
  });

  // ─── Department breakdown mini table ─────────────────────────────────────────
  const afterTableY = (doc as any).lastAutoTable?.finalY ?? 150;

  if (Object.keys(depts).length > 0 && afterTableY < pageH - 50) {
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Department Breakdown", margin, afterTableY + 10);

    autoTable(doc, {
      startY: afterTableY + 14,
      head: [["Department", "Count", "% of Total"]],
      body: Object.entries(depts)
        .sort((a, b) => b[1] - a[1])
        .map(([dept, count]) => [
          dept,
          String(count),
          `${Math.round((count / records.length) * 100)}%`,
        ]),
      headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255], fontSize: 8.5 },
      bodyStyles: { fontSize: 8.5, textColor: [51, 65, 85] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: margin, right: pageW / 2 },
    });
  }

  // ─── Footer ───────────────────────────────────────────────────────────────────
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFillColor(248, 250, 252);
    doc.rect(0, pageH - 12, pageW, 12, "F");
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.text(`AttendReg · Confidential`, margin, pageH - 5);
    doc.text(`Page ${p} of ${totalPages}`, pageW - margin, pageH - 5, { align: "right" });
  }

  // ─── Save ─────────────────────────────────────────────────────────────────────
  const fileName = `Attendance_${(session?.name || "Report").replace(/\s+/g, "_")}_${format(new Date(), "yyyy-MM-dd")}.pdf`;
  doc.save(fileName);
}
