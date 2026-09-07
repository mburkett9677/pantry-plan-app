"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/plan", label: "Plan" },
  { href: "/recipes", label: "Recipes" },
  { href: "/shop", label: "Shop" },
  { href: "/stores", label: "Stores" },
  { href: "/lunch", label: "Lunch" },
];

export function BottomNav({ kidMode = false }: { kidMode?: boolean }) {
  const pathname = usePathname();
  const items = kidMode
    ? [
        { href: "/lunch", label: "Lunch" },
        { href: "/plan", label: "Week" },
        { href: "/settings", label: "Me" },
      ]
    : [...links, { href: "/settings", label: "Settings" }].slice(0, 5);

  // For adults keep 5: Plan Recipes Shop Stores Settings — lunch via plan/settings
  const adult = [
    { href: "/plan", label: "Plan" },
    { href: "/recipes", label: "Recipes" },
    { href: "/shop", label: "Shop" },
    { href: "/stores", label: "Aisles" },
    { href: "/settings", label: "More" },
  ];
  const shown = kidMode ? items : adult;

  return (
    <nav className="nav" style={{ gridTemplateColumns: `repeat(${shown.length}, 1fr)` }}>
      {shown.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link key={link.href} href={link.href} className={active ? "active" : ""}>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
