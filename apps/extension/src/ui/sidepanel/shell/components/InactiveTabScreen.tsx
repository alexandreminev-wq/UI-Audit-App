interface InactiveTabScreenProps {
  error?: string;
  onActivate: () => void;
}

export function InactiveTabScreen({ error, onActivate }: InactiveTabScreenProps) {
  return (
    <div className="flex flex-col h-full p-6">
      <div className="mb-6">
        <h1>UI Audit Tool</h1>
        <p className="text-gray-600 mt-2">
          Sidepanel is active in another tab. To work in this tab, activate capture here and choose a project.
        </p>
      </div>

      {error ? <p className="text-sm text-red-600 mb-3">{error}</p> : null}

      <button
        onClick={onActivate}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Activate capture in this tab
      </button>

      <div className="mt-4 text-sm text-gray-500">
        You’ll need to pick a project again after switching tabs.
      </div>
    </div>
  );
}


