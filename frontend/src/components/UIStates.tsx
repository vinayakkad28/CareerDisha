"use client";

export function LoadingSpinner({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
      <p className="text-gray-500 text-sm">{message}</p>
    </div>
  );
}

export function ErrorState({
  message = "Something went wrong",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-xl">
        !
      </div>
      <p className="text-gray-700 text-sm font-medium">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-sm text-primary hover:underline mt-1"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title = "Nothing here yet",
  description,
  actionLabel,
  onAction,
}: {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-xl">
        +
      </div>
      <p className="text-gray-700 font-medium">{title}</p>
      {description && <p className="text-gray-500 text-sm max-w-md">{description}</p>}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-2 bg-primary text-white px-4 py-2 rounded-lg text-sm hover:bg-primary/90"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const btnColor = variant === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-primary hover:bg-primary/90";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-600 mt-2">{message}</p>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm text-white rounded-lg ${btnColor}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
