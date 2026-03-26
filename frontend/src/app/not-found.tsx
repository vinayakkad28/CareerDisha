import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] px-4">
      <div className="text-center max-w-sm">
        <p className="text-7xl font-bold text-gray-200 mb-2">404</p>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Page not found</h2>
        <p className="text-gray-500 text-sm mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: "#1a5276" }}
          >
            Go Home
          </Link>
          <Link
            href="/assessment"
            className="px-6 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            Start Assessment
          </Link>
        </div>
      </div>
    </div>
  );
}
