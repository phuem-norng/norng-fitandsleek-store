import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { subscribeApiInfrastructureDegraded } from "../lib/apiHealth";

const CatalogAvailabilityContext = createContext({
  infrastructureDegraded: false,
});

export function CatalogAvailabilityProvider({ children }) {
  const [infrastructureDegraded, setInfrastructureDegraded] = useState(false);

  useEffect(() => {
    return subscribeApiInfrastructureDegraded(() => setInfrastructureDegraded(true));
  }, []);

  const value = useMemo(
    () => ({ infrastructureDegraded }),
    [infrastructureDegraded]
  );

  return (
    <CatalogAvailabilityContext.Provider value={value}>
      {children}
    </CatalogAvailabilityContext.Provider>
  );
}

export function useCatalogAvailability() {
  return useContext(CatalogAvailabilityContext);
}
