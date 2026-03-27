"use client";

import PageHeader from "@/components/PageHeader";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" />

      {/* API Configuration */}
      <div className="sa-card max-w-2xl">
        <h2 className="text-lg font-heading font-semibold text-on-surface mb-2">API Configuration</h2>
        <p className="text-sm text-on-surface-variant mb-5">
          API keys are configured in the backend <code className="bg-surface-container-high px-1.5 py-0.5 rounded text-xs font-mono">. env</code> file.
          Restart the backend server after making changes.
        </p>

        <div className="space-y-0">
          {[
            { name: "ANTHROPIC_API_KEY", label: "Anthropic (Claude)" },
            { name: "OPENAI_API_KEY", label: "OpenAI (GPT)" },
            { name: "GOOGLE_API_KEY", label: "Google (Gemini)" },
          ].map((key) => (
            <div
              key={key.name}
              className="flex items-center justify-between py-3.5 border-b border-surface-container-high last:border-b-0"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-surface-container-highest" />
                <div>
                  <span className="text-sm font-medium text-on-surface font-mono">{key.name}</span>
                  <p className="text-xs text-on-surface-variant/50">{key.label}</p>
                </div>
              </div>
              <span className="text-xs text-on-surface-variant/50 bg-surface-container-high px-2.5 py-1 rounded-full">
                Configured in .env
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* About */}
      <div className="sa-card max-w-2xl">
        <h2 className="text-lg font-heading font-semibold text-on-surface mb-4">About</h2>
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-brand-gradient flex items-center justify-center flex-shrink-0">
              <span className="text-white font-heading font-bold text-sm">CD</span>
            </div>
            <div>
              <p className="font-heading font-semibold text-on-surface">CareerDisha</p>
              <p className="text-on-surface-variant">AI Career Counselling Platform</p>
            </div>
          </div>
          <div className="pt-3 border-t border-surface-container-high space-y-1.5 text-on-surface-variant">
            <p>Version 1.0.0</p>
            <p>For Indian school students, Class 9-12</p>
          </div>
        </div>
      </div>
    </div>
  );
}
