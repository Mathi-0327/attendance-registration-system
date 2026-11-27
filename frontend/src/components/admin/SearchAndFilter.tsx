import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, X, Filter, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

interface SearchAndFilterProps {
  onSearch: (search: string) => void;
  onFilter?: (filters: { department?: string; status?: string; dateRange?: string }) => void;
  onSort?: (sortBy: string, sortOrder: string) => void;
  hideFilter?: boolean;
  hideSort?: boolean;
  placeholder?: string;
}

export function SearchAndFilter({
  onSearch,
  onFilter,
  onSort,
  hideFilter,
  hideSort,
  placeholder,
}: SearchAndFilterProps) {
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("all");
  const [sortBy, setSortBy] = useState("time");
  const [sortOrder, setSortOrder] = useState("desc");

  const handleSearch = (value: string) => {
    setSearch(value);
    onSearch(value);
  };

  const handleFilter = () => {
    if (!onFilter) return;
    const filters: { department?: string; status?: string; dateRange?: string } = {};
    if (department && department !== "all") filters.department = department;
    if (status && status !== "all") filters.status = status;
    if (dateRange && dateRange !== "all") filters.dateRange = dateRange;
    onFilter(filters);
  };

  const handleSort = (by: string, order: string) => {
    if (!onSort) return;
    setSortBy(by);
    setSortOrder(order);
    onSort(by, order);
  };

  const clearFilters = () => {
    setSearch("");
    setDepartment("all");
    setStatus("all");
    setDateRange("all");
    setSortBy("time");
    setSortOrder("desc");
    onSearch("");
    if (onFilter) onFilter({});
    if (onSort) onSort("time", "desc");
  };

  const hasActiveFilters =
    search ||
    (!hideFilter &&
      ((department && department !== "all") ||
        (status && status !== "all") ||
        (dateRange && dateRange !== "all")));

  return (
    <div className="p-3.5 bg-card/80 backdrop-blur-md rounded-xl border border-border/60 shadow-sm space-y-3">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search Field */}
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={placeholder || "Search attendee name, student ID, department..."}
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10 h-10 bg-background/50 border-border/50 focus-visible:ring-primary/20 rounded-lg text-sm"
          />
          {search && (
            <button
              onClick={() => handleSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter dropdowns */}
        {!hideFilter && (
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            <Select
              value={department}
              onValueChange={(val) => {
                setDepartment(val);
                if (onFilter) {
                  onFilter({
                    department: val !== "all" ? val : undefined,
                    status: status !== "all" ? status : undefined,
                    dateRange: dateRange !== "all" ? dateRange : undefined,
                  });
                }
              }}
            >
              <SelectTrigger className="w-full sm:w-[150px] h-10 bg-background/50 text-xs font-medium">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                <SelectItem value="CS">Computer Science</SelectItem>
                <SelectItem value="IT">Information Tech</SelectItem>
                <SelectItem value="ECE">Electronics (ECE)</SelectItem>
                <SelectItem value="MECH">Mechanical</SelectItem>
                <SelectItem value="OTHER">Other Depts</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={status}
              onValueChange={(val) => {
                setStatus(val);
                if (onFilter) {
                  onFilter({
                    department: department !== "all" ? department : undefined,
                    status: val !== "all" ? val : undefined,
                    dateRange: dateRange !== "all" ? dateRange : undefined,
                  });
                }
              }}
            >
              <SelectTrigger className="w-full sm:w-[130px] h-10 bg-background/50 text-xs font-medium">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="present">Present (On-Time)</SelectItem>
                <SelectItem value="late">Late Arrival</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={dateRange}
              onValueChange={(val) => {
                setDateRange(val);
                if (onFilter) {
                  onFilter({
                    department: department !== "all" ? department : undefined,
                    status: status !== "all" ? status : undefined,
                    dateRange: val !== "all" ? val : undefined,
                  });
                }
              }}
            >
              <SelectTrigger className="w-full sm:w-[130px] h-10 bg-background/50 text-xs font-medium">
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today Only</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Sort */}
        {!hideSort && (
          <Select
            value={`${sortBy}-${sortOrder}`}
            onValueChange={(value) => {
              const [by, order] = value.split("-");
              handleSort(by, order);
            }}
          >
            <SelectTrigger className="w-full sm:w-[150px] h-10 bg-background/50 text-xs font-medium">
              <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5 opacity-60" />
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="time-desc">Latest First</SelectItem>
              <SelectItem value="time-asc">Earliest First</SelectItem>
              <SelectItem value="name-asc">Name (A–Z)</SelectItem>
              <SelectItem value="name-desc">Name (Z–A)</SelectItem>
              <SelectItem value="department-asc">Dept (A–Z)</SelectItem>
            </SelectContent>
          </Select>
        )}

        {/* Clear */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            onClick={clearFilters}
            size="sm"
            className="h-10 text-xs text-muted-foreground hover:text-foreground shrink-0"
          >
            Reset
          </Button>
        )}
      </div>
    </div>
  );
}
