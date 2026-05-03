import { useEffect } from 'react';
import { toast } from 'sonner';

/**
 * @typedef {Object} ActionResponse
 * @property {string} message
 * @property {string} error
 */

/**
 * Display toast notifications when action response data changes
 *
 * @param {ActionResponse} response
 */
export default function useToaster(response) {
  useEffect(() => {
    if (response?.message) {
      toast.success(response.message);
    }
    if (response?.error) {
      toast.error(response.error);
    }
  }, [response]);
}
