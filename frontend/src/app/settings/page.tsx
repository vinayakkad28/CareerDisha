"use client";

export default function SettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-primary mb-6">Settings</h1>

      <div className="bg-white rounded-xl shadow-sm p-6 max-w-2xl">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">API Configuration</h2>
        <p className="text-sm text-gray-500 mb-4">
          API keys are configured in the backend <code className="bg-gray-100 px-1.5 py-0.5 rounded">.env</code> file.
          Restart the backend server after making changes.
        </p>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-gray-600">ANTHROPIC_API_KEY</span>
            <span className="text-gray-400">Configured in .env</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-gray-600">OPENAI_API_KEY</span>
            <span className="text-gray-400">Configured in .env</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-gray-600">GOOGLE_API_KEY</span>
            <span className="text-gray-400">Configured in .env</span>
          </div>
        </div>

        <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-4">About</h2>
        <div className="space-y-2 text-sm text-gray-600">
          <p><strong>CareerDisha</strong> — AI Career Counselling Platform</p>
          <p>Version 1.0.0</p>
          <p>For Indian school students, Class 8-12</p>
        </div>
      </div>
    </div>
  );
}
