"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Location, Employee, EmployeeLocation } from "@/types";
import { MapPin, Users, Plus, X, Check, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

type LocationWithCount = Location & { employee_count: number };

type EmpLocWithEmployee = EmployeeLocation & {
  employees: { first_name: string; last_name: string } | null;
};

export default function LocationsPage() {
  const qc = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [hoursInput, setHoursInput] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);

  const { data: locations = [], isLoading } = useQuery<LocationWithCount[]>({
    queryKey: ["locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;

      const { data: empLocs } = await supabase
        .from("employee_locations")
        .select("location_id");

      const countMap: Record<string, number> = {};
      (empLocs ?? []).forEach((el: { location_id: string }) => {
        countMap[el.location_id] = (countMap[el.location_id] ?? 0) + 1;
      });

      return (data ?? []).map((loc) => ({
        ...(loc as unknown as Location),
        employee_count: countMap[loc.id] ?? 0,
      }));
    },
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["all-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name, hours_per_week, is_active, company_id")
        .eq("is_active", true)
        .order("last_name");
      if (error) throw error;
      return data as unknown as Employee[];
    },
  });

  const { data: allEmpLocs = [] } = useQuery<EmpLocWithEmployee[]>({
    queryKey: ["employee-locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_locations")
        .select("*, employees(first_name, last_name)")
        .order("created_at");
      if (error) throw error;
      return data as unknown as EmpLocWithEmployee[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async ({
      locationId,
      employeeId,
      hours,
      primary,
    }: {
      locationId: string;
      employeeId: string;
      hours: number;
      primary: boolean;
    }) => {
      const emp = employees.find((e) => e.id === employeeId);
      const { error } = await supabase.from("employee_locations").insert({
        location_id: locationId,
        employee_id: employeeId,
        hours_per_week: hours,
        is_primary: primary,
        company_id: emp?.company_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["locations"] });
      qc.invalidateQueries({ queryKey: ["employee-locations"] });
      toast.success("Zuweisung gespeichert");
      setAddingFor(null);
      setSelectedEmpId("");
      setHoursInput("");
      setIsPrimary(false);
    },
    onError: (err: Error) => toast.error(err.message ?? "Fehler"),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("employee_locations")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["locations"] });
      qc.invalidateQueries({ queryKey: ["employee-locations"] });
      toast.success("Zuweisung entfernt");
    },
    onError: () => toast.error("Fehler beim Entfernen"),
  });

  function handleAdd(locationId: string) {
    const hours = parseFloat(hoursInput);
    if (!selectedEmpId || isNaN(hours) || hours <= 0) {
      toast.error("Mitarbeiterin und Stunden angeben");
      return;
    }
    addMutation.mutate({ locationId, employeeId: selectedEmpId, hours, primary: isPrimary });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Filialen</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {locations.length} Standorte · Mitarbeiter:innen können mehreren Filialen zugeordnet sein
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">Wird geladen…</p>
      ) : (
        <div className="space-y-3">
          {locations.map((loc) => {
            const empLocsForLoc = allEmpLocs.filter((el) => el.location_id === loc.id);
            const isExpanded = expandedId === loc.id;
            const isAdding = addingFor === loc.id;

            return (
              <div key={loc.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition text-left"
                  onClick={() => setExpandedId(isExpanded ? null : loc.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#4F772D]/10">
                      <MapPin className="h-4 w-4 text-[#4F772D]" strokeWidth={1.5} />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-gray-900">{loc.name}</p>
                      <p className="text-xs text-gray-400">
                        {[loc.address?.street, loc.address?.zip, loc.address?.city]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">
                      <Users className="h-3 w-3" strokeWidth={1.5} />
                      {empLocsForLoc.length}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 px-5 pb-4 pt-3">
                    {empLocsForLoc.length > 0 ? (
                      <div className="mb-3 space-y-2">
                        {empLocsForLoc.map((el) => (
                          <div key={el.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#4F772D]/10 text-xs font-semibold text-[#4F772D]">
                                {el.employees?.first_name?.[0]}
                                {el.employees?.last_name?.[0]}
                              </div>
                              <div>
                                <p className="text-xs font-medium text-gray-800">
                                  {el.employees?.first_name} {el.employees?.last_name}
                                </p>
                                <p className="text-[10px] text-gray-400">
                                  {el.hours_per_week}h/Woche
                                  {el.is_primary && (
                                    <span className="ml-1.5 rounded-full bg-[#4F772D]/10 px-1.5 py-0.5 text-[#4F772D]">
                                      Hauptfiliale
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => removeMutation.mutate(el.id)}
                              className="rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-400 transition"
                            >
                              <X className="h-3.5 w-3.5" strokeWidth={2} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mb-3 text-xs text-gray-400">Noch keine Mitarbeiter:innen zugeordnet</p>
                    )}

                    {isAdding ? (
                      <div className="rounded-lg border border-[#4F772D]/20 bg-[#4F772D]/5 p-3 space-y-2">
                        <select
                          value={selectedEmpId}
                          onChange={(e) => setSelectedEmpId(e.target.value)}
                          className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-700 focus:border-[#4F772D] focus:outline-none bg-white"
                        >
                          <option value="">Mitarbeiterin wählen…</option>
                          {employees
                            .filter((emp) => !empLocsForLoc.find((el) => el.employee_id === emp.id))
                            .map((emp) => (
                              <option key={emp.id} value={emp.id}>
                                {emp.first_name} {emp.last_name} ({emp.hours_per_week}h/Wo gesamt)
                              </option>
                            ))}
                        </select>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max="60"
                            step="0.5"
                            placeholder="Stunden/Woche in dieser Filiale"
                            value={hoursInput}
                            onChange={(e) => setHoursInput(e.target.value)}
                            className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-700 focus:border-[#4F772D] focus:outline-none bg-white"
                          />
                          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isPrimary}
                              onChange={(e) => setIsPrimary(e.target.checked)}
                              className="rounded"
                            />
                            Hauptfiliale
                          </label>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAdd(loc.id)}
                            disabled={addMutation.isPending}
                            className="flex items-center gap-1.5 rounded-lg bg-[#4F772D] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#31572C] transition disabled:opacity-50"
                          >
                            <Check className="h-3 w-3" strokeWidth={2} />
                            Speichern
                          </button>
                          <button
                            onClick={() => {
                              setAddingFor(null);
                              setSelectedEmpId("");
                              setHoursInput("");
                              setIsPrimary(false);
                            }}
                            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 transition"
                          >
                            Abbrechen
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingFor(loc.id)}
                        className="flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs text-gray-500 hover:border-[#4F772D] hover:text-[#4F772D] transition w-full justify-center"
                      >
                        <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                        Mitarbeiterin zuordnen
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
