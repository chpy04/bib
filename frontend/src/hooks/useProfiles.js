import { useState, useEffect } from 'react';
import { fetchProfiles } from '../lib/api';

export function useProfiles() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfiles()
      .then(setProfiles)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return { profiles, loading, refresh: () => fetchProfiles().then(setProfiles) };
}
