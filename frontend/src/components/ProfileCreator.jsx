import { useState } from 'react';

export default function ProfileCreator({ onSubmit, onCancel }) {
  const [url, setUrl] = useState('');
  const [request, setRequest] = useState('');

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h2 className="text-2xl font-bold mb-6">Create New Profile</h2>

      <label className="block mb-4">
        <span className="text-sm text-gray-400">Website URL</span>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://news.ycombinator.com"
          className="mt-1 block w-full p-3 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 outline-none"
        />
      </label>

      <label className="block mb-6">
        <span className="text-sm text-gray-400">What do you want to see?</span>
        <textarea
          value={request}
          onChange={(e) => setRequest(e.target.value)}
          placeholder="Show me the top stories with titles, scores, and comment counts"
          rows={3}
          className="mt-1 block w-full p-3 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 outline-none"
        />
      </label>

      <div className="flex gap-3">
        <button
          onClick={() => onSubmit(url, request)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition"
        >
          Create Profile
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
