import { useState } from 'react';
import { useProfiles } from './hooks/useProfiles';
import { useWebSocket } from './hooks/useWebSocket';
import ProfileSelector from './components/ProfileSelector';
import ProfileCreator from './components/ProfileCreator';
import DynamicRenderer from './components/DynamicRenderer';
import StatusBar from './components/StatusBar';

export default function App() {
  const { profiles, loading, refresh } = useProfiles();
  const [view, setView] = useState('select'); // 'select' | 'create' | 'profile'
  const [activeProfileId, setActiveProfileId] = useState(null);
  const [activeProfile, setActiveProfile] = useState(null);
  const { data, status, send } = useWebSocket(activeProfileId);

  const handleSelect = async (profileId) => {
    // TODO: fetch full profile config
    setActiveProfileId(profileId);
    setView('profile');
  };

  const handleCreate = async (url, request) => {
    // TODO: call POST /api/profiles
    setView('select');
    refresh();
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {view === 'select' && (
        <ProfileSelector
          profiles={profiles}
          onSelect={handleSelect}
          onCreate={() => setView('create')}
        />
      )}
      {view === 'create' && (
        <ProfileCreator
          onSubmit={handleCreate}
          onCancel={() => setView('select')}
        />
      )}
      {view === 'profile' && (
        <>
          <StatusBar
            status={status}
            profileName={activeProfile?.name || activeProfileId}
            onBack={() => { setActiveProfileId(null); setView('select'); }}
          />
          <DynamicRenderer
            componentCode={activeProfile?.component_code}
            data={data}
          />
        </>
      )}
    </div>
  );
}
