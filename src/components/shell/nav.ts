
export type IconKey = "dashboard" | "calendar" | "students" | "book" | "lessons" | "payments" | "reports" | "instructors" | "vehicles" | "packages" | "settings";

export type NavItem = { href: string; labelKey: string; icon: IconKey };

export const mainNav = (role: "ADMIN" | "INSTRUCTOR"): NavItem[] =>
  role === "ADMIN"
    ? [
        { href: "/", labelKey: "dashboard", icon: "dashboard" },
        { href: "/agenda", labelKey: "calendar", icon: "calendar" },
        { href: "/leerlingen", labelKey: "students", icon: "students" },
        { href: "/les-inplannen", labelKey: "book", icon: "book" },
        { href: "/lessen", labelKey: "lessons", icon: "lessons" },
        { href: "/betalingen", labelKey: "payments", icon: "payments" },
        { href: "/rapportages", labelKey: "reports", icon: "reports" },
      ]
    : [
        { href: "/", labelKey: "dashboard", icon: "dashboard" },
        { href: "/agenda", labelKey: "calendar", icon: "calendar" },
        { href: "/leerlingen", labelKey: "myStudents", icon: "students" },
        { href: "/les-inplannen", labelKey: "book", icon: "book" },
        { href: "/lessen", labelKey: "lessons", icon: "lessons" },
      ];

export const manageNav: NavItem[] = [
  { href: "/instructeurs", labelKey: "instructors", icon: "instructors" },
  { href: "/lesautos", labelKey: "vehicles", icon: "vehicles" },
  { href: "/pakketten", labelKey: "packages", icon: "packages" },
  { href: "/instellingen", labelKey: "settings", icon: "settings" },
];

