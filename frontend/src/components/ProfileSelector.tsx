import type { Profile } from '../types';

interface Props {
  profiles: Profile[];
  onSelect: (profileId: string) => void;
  onCreate: () => void;
}

export default function ProfileSelector({ profiles, onSelect, onCreate }: Props) {
  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Browser in Browser</h1>
      <p className="text-gray-400 mb-8">Select a profile or create a new one</p>

      {profiles.length === 0 ? (
        <p className="text-gray-500">No profiles yet.</p>
      ) : (
        <div className="space-y-3">
          {profiles.map((p) => (
            <button
              key={p.profile_id}
              onClick={() => onSelect(p.profile_id)}
              className="w-full text-left p-4 rounded-lg bg-gray-800 hover:bg-gray-700 transition"
            >
              <div className="font-medium">{p.name}</div>
              <div className="text-sm text-gray-400">{p.base_url}</div>
            </button>
          ))}
        </div>
      )}

      <button
        onClick={onCreate}
        className="mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition"
      >
        + New Profile
      </button>
    </div>
  );
}
