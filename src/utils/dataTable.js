import { useEffect, useMemo, useState } from "react";

export const DEFAULT_PAGE_SIZE = 10;

export const getDistinctValues = (records, getValue) =>
  Array.from(
    new Set(
      records
        .map((record) => String(getValue(record) || "").trim())
        .filter(Boolean)
    )
  ).sort((first, second) => first.localeCompare(second));

const getComparableValue = (value) => {
  if (value === null || value === undefined) return "";

  if (value instanceof Date) return value.getTime();

  if (typeof value?.toDate === "function") {
    return value.toDate().getTime();
  }

  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const text = String(value).trim();

  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);

  const dateValue = Date.parse(text);
  if (/^\d{4}-\d{2}-\d{2}/.test(text) && Number.isFinite(dateValue)) {
    return dateValue;
  }

  return text.toLocaleLowerCase();
};

export const sortRecords = (records, getValue, direction = "asc") => {
  const directionMultiplier = direction === "desc" ? -1 : 1;

  return [...records].sort((first, second) => {
    const firstValue = getComparableValue(getValue(first));
    const secondValue = getComparableValue(getValue(second));

    if (typeof firstValue === "number" && typeof secondValue === "number") {
      return (firstValue - secondValue) * directionMultiplier;
    }

    return String(firstValue).localeCompare(String(secondValue), undefined, {
      numeric: true,
      sensitivity: "base",
    }) * directionMultiplier;
  });
};

export const getPageSlice = (records, page, pageSize = DEFAULT_PAGE_SIZE) => {
  const totalPages = Math.max(1, Math.ceil(records.length / pageSize));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = (currentPage - 1) * pageSize;

  return {
    currentPage,
    totalPages,
    startIndex,
    rows: records.slice(startIndex, startIndex + pageSize),
  };
};

export const useDataTable = (
  records,
  { sortOptions = [], defaultSortBy, defaultSortDirection = "asc", resetKey = "", pageSize = DEFAULT_PAGE_SIZE }
) => {
  const initialSortBy = defaultSortBy || sortOptions[0]?.value || "";
  const [sortBy, setSortBy] = useState(initialSortBy);
  const [sortDirection, setSortDirection] = useState(defaultSortDirection);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [resetKey, sortBy, sortDirection]);

  const activeSort = sortOptions.find((option) => option.value === sortBy) || sortOptions[0];
  const sortedRecords = useMemo(
    () => sortRecords(records, activeSort?.getValue || (() => ""), sortDirection),
    [records, activeSort, sortDirection]
  );
  const pageSlice = useMemo(
    () => getPageSlice(sortedRecords, page, pageSize),
    [sortedRecords, page, pageSize]
  );

  useEffect(() => {
    if (pageSlice.currentPage !== page) setPage(pageSlice.currentPage);
  }, [page, pageSlice.currentPage]);

  return {
    ...pageSlice,
    count: records.length,
    pageSize,
    setPage,
    sortBy,
    setSortBy,
    sortDirection,
    setSortDirection,
    sortOptions,
  };
};
