// A tiny router: the page is the part of the URL after "#" (#today, #calendar, #pay, #settings).
// Plenty for four screens. If the app grows (sign-in pages, nested routes), switch to React Router.

import { useEffect, useState } from "react";

export const ROUTES = ["today", "calendar", "pay", "settings"] as const;
export type Route = (typeof ROUTES)[number];

function readRoute(): Route {
  const hash = window.location.hash.slice(1);
  return (ROUTES as readonly string[]).includes(hash) ? (hash as Route) : "today";
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(readRoute);
  useEffect(() => {
    const onChange = () => {
      setRoute(readRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}
