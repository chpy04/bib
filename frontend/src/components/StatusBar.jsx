export default function StatusBar({ status, profileName, onBack }) {
  const colors = {
    connected: 'bg-green-500',
    disconnected: 'bg-gray-500',
    error: 'bg-red-500',
    running: 'bg-yellow-500',
  };

  return (
    <div className="flex items-center justify-between p-3 bg-gray-900 border-b border-gray-800">
      <button
        onClick={onBack}
        className="text-sm text-gray-400 hover:text-white transition"
      >
        ← Back to profiles
      </button>
      <span className="text-sm text-gray-400">{profileName}</span>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${colors[status] || colors.disconnected}`} />
        <span className="text-xs text-gray-500">{status}</span>
      </div>
    </div>
  );
}
