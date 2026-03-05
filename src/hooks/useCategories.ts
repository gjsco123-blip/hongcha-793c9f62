import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface School {
  id: string;
  name: string;
  created_at: string;
}

export interface Passage {
  id: string;
  school_id: string;
  name: string;
  passage_text: string;
  pdf_title: string;
  results_json: any;
  preset: string;
  created_at: string;
  updated_at: string;
}

export function useCategories() {
  const { user } = useAuth();
  const [schools, setSchools] = useState<School[]>([]);
  const [passages, setPassages] = useState<Passage[]>([]);
  const [selectedSchoolId, _setSelectedSchoolId] = useState<string | null>(null);
  const [selectedPassageId, _setSelectedPassageId] = useState<string | null>(null);
  
  const setSelectedSchoolId = (id: string | null) => _setSelectedSchoolId(id || null);
  const setSelectedPassageId = (id: string | null) => _setSelectedPassageId(id || null);
  const [loadingSchools, setLoadingSchools] = useState(false);
  const [loadingPassages, setLoadingPassages] = useState(false);

  // Fetch schools
  const fetchSchools = useCallback(async () => {
    if (!user) return;
    setLoadingSchools(true);
    const { data, error } = await supabase
      .from("schools")
      .select("id, name, created_at")
      .order("created_at", { ascending: true });
    if (error) {
      toast.error("학교 목록 불러오기 실패");
    } else {
      setSchools(data || []);
    }
    setLoadingSchools(false);
  }, [user]);

  // Fetch passages for selected school
  const fetchPassages = useCallback(async (schoolId: string) => {
    if (!user) return;
    setLoadingPassages(true);
    const { data, error } = await supabase
      .from("passages")
      .select("*")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: true });
    if (error) {
      toast.error("지문 목록 불러오기 실패");
    } else {
      setPassages(data || []);
    }
    setLoadingPassages(false);
  }, [user]);

  useEffect(() => {
    fetchSchools();
  }, [fetchSchools]);

  useEffect(() => {
    if (selectedSchoolId) {
      fetchPassages(selectedSchoolId);
      setSelectedPassageId(null);
    } else {
      setPassages([]);
    }
  }, [selectedSchoolId, fetchPassages]);

  // CRUD
  const addSchool = async (name: string) => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("schools")
      .insert({ name, user_id: user.id })
      .select("id, name, created_at")
      .single();
    if (error) {
      toast.error("학교 추가 실패: " + error.message);
      return null;
    }
    setSchools((prev) => [...prev, data]);
    return data;
  };

  const deleteSchool = async (id: string) => {
    const { error } = await supabase.from("schools").delete().eq("id", id);
    if (error) {
      toast.error("학교 삭제 실패");
      return;
    }
    setSchools((prev) => prev.filter((s) => s.id !== id));
    if (selectedSchoolId === id) {
      setSelectedSchoolId(null);
      setSelectedPassageId(null);
    }
  };

  const addPassage = async (schoolId: string, name: string) => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("passages")
      .insert({ school_id: schoolId, name, user_id: user.id, pdf_title: name })
      .select("*")
      .single();
    if (error) {
      toast.error("지문 추가 실패: " + error.message);
      return null;
    }
    setPassages((prev) => [...prev, data]);
    return data;
  };

  const deletePassage = async (id: string) => {
    const { error } = await supabase.from("passages").delete().eq("id", id);
    if (error) {
      toast.error("지문 삭제 실패");
      return;
    }
    setPassages((prev) => prev.filter((p) => p.id !== id));
    if (selectedPassageId === id) setSelectedPassageId(null);
  };

  const updatePassage = async (id: string, updates: Partial<Pick<Passage, "passage_text" | "pdf_title" | "results_json" | "preset" | "name">>) => {
    const { error } = await supabase
      .from("passages")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("자동저장 실패:", error.message);
    }
  };

  const selectedPassage = passages.find((p) => p.id === selectedPassageId) || null;

  return {
    schools,
    passages,
    selectedSchoolId,
    selectedPassageId,
    selectedPassage,
    loadingSchools,
    loadingPassages,
    setSelectedSchoolId,
    setSelectedPassageId,
    addSchool,
    deleteSchool,
    addPassage,
    deletePassage,
    updatePassage,
    fetchPassages,
  };
}
