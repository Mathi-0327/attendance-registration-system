/**
 * SubjectSelector.tsx
 * Dropdown to pick which subject/period to mark attendance for.
 * Fetches active subjects from the academic module API.
 */

import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Loader2 } from "lucide-react";

interface Subject {
  id: number;
  name: string;
  code: string;
  credits?: number;
}

interface SubjectSelectorProps {
  value?: string;
  onValueChange: (value: string, subject?: Subject) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function SubjectSelector({
  value,
  onValueChange,
  disabled = false,
  placeholder = "Select Subject",
  className,
}: SubjectSelectorProps) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSubjects() {
      try {
        setLoading(true);
        const res = await fetch("/api/academic/subjects");
        if (!res.ok) throw new Error("Failed to fetch subjects");
        const data = await res.json();
        setSubjects(data.subjects || []);
      } catch (err: any) {
        setError(err.message);
        // Fallback to common subjects for demo
        setSubjects([
          { id: 1, name: "Data Structures", code: "CS201", credits: 4 },
          { id: 2, name: "Operating Systems", code: "CS301", credits: 4 },
          { id: 3, name: "Computer Networks", code: "CS401", credits: 3 },
          { id: 4, name: "Database Management", code: "CS402", credits: 4 },
          { id: 5, name: "Software Engineering", code: "CS501", credits: 3 },
        ]);
      } finally {
        setLoading(false);
      }
    }

    fetchSubjects();
  }, []);

  const handleChange = (val: string) => {
    const subject = subjects.find((s) => String(s.id) === val);
    onValueChange(val, subject);
  };

  if (loading) {
    return (
      <div className={`flex items-center gap-2 text-muted-foreground text-sm ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading subjects...</span>
      </div>
    );
  }

  return (
    <Select value={value} onValueChange={handleChange} disabled={disabled}>
      <SelectTrigger className={`h-11 ${className}`}>
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <SelectValue placeholder={placeholder} />
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel className="text-xs text-muted-foreground">Available Subjects</SelectLabel>
          {subjects.length === 0 ? (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              No subjects found
            </div>
          ) : (
            subjects.map((subject) => (
              <SelectItem key={subject.id} value={String(subject.id)}>
                <div className="flex items-center justify-between gap-3 w-full">
                  <div>
                    <span className="font-medium">{subject.name}</span>
                    <span className="text-muted-foreground text-xs ml-2">{subject.code}</span>
                  </div>
                  {subject.credits && (
                    <Badge variant="secondary" className="text-xs ml-2">
                      {subject.credits}cr
                    </Badge>
                  )}
                </div>
              </SelectItem>
            ))
          )}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
