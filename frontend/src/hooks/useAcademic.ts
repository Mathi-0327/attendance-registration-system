/**
 * @file frontend/src/hooks/useAcademic.ts
 * @description React Query hooks for all academic API endpoints.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";

// ─── Fetch helper ─────────────────────────────────────────────────────────────
async function apiFetch<T>(url: string, token: string | null, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts?.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}

// ─── Institutions ─────────────────────────────────────────────────────────────

export function useInstitutions() {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ["institutions"],
    queryFn: () => apiFetch<{ institutions: any[] }>("/api/academic/institutions", accessToken),
    select: (d) => d.institutions,
    enabled: !!accessToken,
  });
}

export function useCreateInstitution() {
  const { accessToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, any>) =>
      apiFetch("/api/academic/institutions", accessToken, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["institutions"] }),
  });
}

// ─── Departments ──────────────────────────────────────────────────────────────

export function useDepartments() {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ["departments"],
    queryFn: () => apiFetch<{ departments: any[] }>("/api/academic/departments", accessToken),
    select: (d) => d.departments,
    enabled: !!accessToken,
  });
}

export function useCreateDepartment() {
  const { accessToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, any>) =>
      apiFetch("/api/academic/departments", accessToken, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["departments"] }),
  });
}

export function useUpdateDepartment() {
  const { accessToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, any> }) =>
      apiFetch(`/api/academic/departments/${id}`, accessToken, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["departments"] }),
  });
}

// ─── Courses ──────────────────────────────────────────────────────────────────

export function useCourses(departmentId: number | null) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ["courses", departmentId],
    queryFn: () =>
      apiFetch<{ courses: any[] }>(
        `/api/academic/departments/${departmentId}/courses`,
        accessToken
      ),
    select: (d) => d.courses,
    enabled: !!accessToken && !!departmentId,
  });
}

export function useCreateCourse() {
  const { accessToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, any>) =>
      apiFetch("/api/academic/courses", accessToken, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["courses", vars.departmentId] }),
  });
}

// ─── Academic Years ───────────────────────────────────────────────────────────

export function useAcademicYears(institutionId: number | null) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ["academic-years", institutionId],
    queryFn: () =>
      apiFetch<{ academicYears: any[] }>(
        `/api/academic/institutions/${institutionId}/academic-years`,
        accessToken
      ),
    select: (d) => d.academicYears,
    enabled: !!accessToken && !!institutionId,
  });
}

// ─── Semesters ────────────────────────────────────────────────────────────────

export function useSemesters(courseId: number | null) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ["semesters", courseId],
    queryFn: () =>
      apiFetch<{ semesters: any[] }>(
        `/api/academic/courses/${courseId}/semesters`,
        accessToken
      ),
    select: (d) => d.semesters,
    enabled: !!accessToken && !!courseId,
  });
}

// ─── Sections ─────────────────────────────────────────────────────────────────

export function useSections(semesterId: number | null) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ["sections", semesterId],
    queryFn: () =>
      apiFetch<{ sections: any[] }>(
        `/api/academic/semesters/${semesterId}/sections`,
        accessToken
      ),
    select: (d) => d.sections,
    enabled: !!accessToken && !!semesterId,
  });
}

// ─── Subjects ─────────────────────────────────────────────────────────────────

export function useSubjects(semesterId: number | null) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ["subjects", semesterId],
    queryFn: () =>
      apiFetch<{ subjects: any[] }>(
        `/api/academic/semesters/${semesterId}/subjects`,
        accessToken
      ),
    select: (d) => d.subjects,
    enabled: !!accessToken && !!semesterId,
  });
}

export function useCreateSubject() {
  const { accessToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, any>) =>
      apiFetch("/api/academic/subjects", accessToken, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["subjects", vars.semesterId] }),
  });
}

// ─── Timetable ────────────────────────────────────────────────────────────────

export function useTimetable(sectionId: number | null) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: ["timetable", sectionId],
    queryFn: () =>
      apiFetch<{ timetable: any[] }>(
        `/api/academic/sections/${sectionId}/timetable`,
        accessToken
      ),
    select: (d) => d.timetable,
    enabled: !!accessToken && !!sectionId,
  });
}

export function useCreateTimetableSlot() {
  const { accessToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, any>) =>
      apiFetch("/api/academic/timetable", accessToken, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["timetable", vars.sectionId] }),
  });
}

export function useDeleteTimetableSlot() {
  const { accessToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, sectionId }: { id: number; sectionId: number }) =>
      apiFetch(`/api/academic/timetable/${id}`, accessToken, { method: "DELETE" }),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["timetable", vars.sectionId] }),
  });
}
