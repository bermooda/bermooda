import { useCallback, useEffect, useState } from 'react';

import {
  CREATE_PAGE_DESIGNS,
  DEFAULT_CREATE_PAGE_DESIGN_ID,
  getCreatePageDesign,
} from '#/components/admin/create-page/designs';

/** @typedef {import('#/components/admin/create-page/designs').CreatePageDesign} CreatePageDesign */

const STORAGE_KEY = 'bermooda:admin-create-design';

/**
 * @typedef {Object} AdminCreateDesignValue
 * @property {string} designId
 * @property {CreatePageDesign} design
 * @property {CreatePageDesign[]} designs
 * @property {(id: string) => void} selectDesign
 * @property {(step: number) => void} stepDesign Move forward/backward in the list
 */

/**
 * Which create-page design is being previewed. The choice is client-only and
 * persisted in local storage, so the first render always matches the server.
 *
 * @returns {AdminCreateDesignValue}
 */
export default function useAdminCreateDesign() {
  const [designId, setDesignId] = useState(DEFAULT_CREATE_PAGE_DESIGN_ID);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && CREATE_PAGE_DESIGNS.some((design) => design.id === stored)) {
      setDesignId(stored);
    }
  }, []);

  const selectDesign = useCallback(
    /** @param {string} id */ (id) => {
      setDesignId(id);
      window.localStorage.setItem(STORAGE_KEY, id);
    },
    []
  );

  const stepDesign = useCallback(
    /** @param {number} step */ (step) => {
      setDesignId((current) => {
        const index = CREATE_PAGE_DESIGNS.findIndex(
          (design) => design.id === current
        );
        const next =
          CREATE_PAGE_DESIGNS[
            (index + step + CREATE_PAGE_DESIGNS.length) %
              CREATE_PAGE_DESIGNS.length
          ];
        window.localStorage.setItem(STORAGE_KEY, next.id);
        return next.id;
      });
    },
    []
  );

  return {
    designId,
    design: getCreatePageDesign(designId),
    designs: CREATE_PAGE_DESIGNS,
    selectDesign,
    stepDesign,
  };
}
