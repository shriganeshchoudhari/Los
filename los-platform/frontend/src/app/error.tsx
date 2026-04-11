'use client';

import { useEffect } from 'react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-6">
          <svg
            className="mx-auto h-16 w-16 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
        <p className="text-gray-600 mb-6">
          {error.digest === 'NEXT_NOTFOUND' ? (
            'The page you are looking for does not exist.'
          ) : (
            'An unexpected error occurred. Please try again.'
          )}
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
        >
          Try again
        </button>
        <div className="mt-4">
          <a href="/" className="text-sm text-blue-600 hover:underline">
            Return to home
          </a>
        </div>
        {process.env.NODE_ENV === 'development' && error?.message && (
          <details className="mt-6 text-left bg-gray-100 rounded-lg p-3 text-xs text-gray-700 font-mono whitespace-pre-wrap">
            <summary className="cursor-pointer font-semibold mb-1">Error details</summary>
            {error.message}
          </details>
        )}
      </div>
    </div>
  );
}
