import { useGetTutorSettingsQuery } from '../../store/api';

/**
 * Whether the tutor has already published their profile.
 *
 * `publishProfile` is the only mutation that sets `isActive`, and nothing in the
 * tutor-facing UI sets it back, so the flag doubles as "onboarding is done".
 * Self-registration creates the tutor with `isActive: false`, so a brand new
 * account always starts unpublished.
 *
 * Reports *not* published while the query is in flight or has failed, so a
 * network error can never lock a tutor out of finishing their setup.
 */
export function useProfilePublished(): { published: boolean; loading: boolean } {
  const { data, isLoading } = useGetTutorSettingsQuery();
  return { published: data?.isActive === true, loading: isLoading };
}
