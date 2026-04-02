import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface DataPaginationProps {
  page: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}

export function DataPagination({
  page,
  totalPages,
  totalCount,
  onPageChange,
}: DataPaginationProps) {
  if (totalPages <= 1) return null;

  const getPageNumbers = (): (number | "ellipsis")[] => {
    const pages: (number | "ellipsis")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push("ellipsis");
      for (
        let i = Math.max(2, page - 1);
        i <= Math.min(totalPages - 1, page + 1);
        i++
      ) {
        pages.push(i);
      }
      if (page < totalPages - 2) pages.push("ellipsis");
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="flex items-center justify-between mt-4">
      <p className="text-sm text-muted-foreground">
        Page {page} sur {totalPages} — {totalCount} résultats
      </p>
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={() => onPageChange(page - 1)}
              className={
                page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"
              }
            />
          </PaginationItem>
          {getPageNumbers().map((p, i) =>
            p === "ellipsis" ? (
              <PaginationItem key={`ellipsis-${i}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={p}>
                <PaginationLink
                  isActive={p === page}
                  onClick={() => onPageChange(p)}
                  className="cursor-pointer"
                >
                  {p}
                </PaginationLink>
              </PaginationItem>
            )
          )}
          <PaginationItem>
            <PaginationNext
              onClick={() => onPageChange(page + 1)}
              className={
                page >= totalPages
                  ? "pointer-events-none opacity-50"
                  : "cursor-pointer"
              }
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
