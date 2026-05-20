import { Link } from "@tanstack/react-router";
import { ChevronRight, Home } from "lucide-react";

export type BreadcrumbItem = {
  label: string;
  /** Absolute path starting with `/` including the current page. */
  to: string;
};

export type BreadcrumbProps = {
  items: BreadcrumbItem[];
  className?: string;
};

const BASE_URL = "https://sleepox.com";

/** Visual breadcrumb trail. Always includes "Home" as the first crumb. */
export function Breadcrumbs({ items, className = "" }: BreadcrumbProps) {
  const trail: BreadcrumbItem[] = [{ label: "Home", to: "/" }, ...items];
  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground ${className}`}
    >
      <ol className="flex flex-wrap items-center gap-1.5">
        {trail.map((item, idx) => {
          const isLast = idx === trail.length - 1;
          return (
            <li key={`${item.label}-${idx}`} className="flex items-center gap-1.5">
              {idx > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />}
              {isLast ? (
                <span aria-current="page" className="font-medium text-foreground">
                  {idx === 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <Home className="h-3.5 w-3.5" /> {item.label}
                    </span>
                  ) : (
                    item.label
                  )}
                </span>
              ) : (
                <Link
                  to={item.to}
                  className="inline-flex items-center gap-1 transition hover:text-foreground"
                >
                  {idx === 0 && <Home className="h-3.5 w-3.5" />}
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Build the BreadcrumbList JSON-LD object. Pass to JSON.stringify and inject via head().scripts. */
export function buildBreadcrumbSchema(items: BreadcrumbItem[]) {
  const trail: BreadcrumbItem[] = [{ label: "Home", to: "/" }, ...items];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.label,
      ...(item.to ? { item: `${BASE_URL}${item.to}` } : {}),
    })),
  };
}
