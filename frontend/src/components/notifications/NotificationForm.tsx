import { useState, useRef } from 'react';
import type { SendNotificationData } from '../../utils/notificationsApi';

interface NotificationFormProps {
  onSend: (data: SendNotificationData) => Promise<boolean>;
  sending: boolean;
  disabled: boolean;
  remainingToday: number;
}

export const NotificationForm: React.FC<NotificationFormProps> = ({
  onSend,
  sending,
  disabled,
  remainingToday,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validation
  const titleError = title.length > 100;
  const descriptionError = description.length > 500;
  const isValid = title.trim() && description.trim() && !titleError && !descriptionError;

  /**
   * Handle image selection
   */
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size must be less than 5MB');
        return;
      }

      setImage(file);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  /**
   * Remove selected image
   */
  const handleRemoveImage = () => {
    setImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid || disabled || sending) return;

    const data: SendNotificationData = {
      title: title.trim(),
      description: description.trim(),
    };

    if (image) {
      data.image = image;
    }

    const success = await onSend(data);

    if (success) {
      // Clear form
      setTitle('');
      setDescription('');
      setImage(null);
      setImagePreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg border p-6 bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
          Send Notification
        </h2>

        {/* Limit warning */}
        {disabled && (
          <div className="mb-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-400">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="font-medium">Daily limit reached</span>
            </div>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
              You have used all {remainingToday === 0 ? '5' : ''} notifications for today. Try again tomorrow.
            </p>
          </div>
        )}

        {/* Title input */}
        <div className="space-y-2">
          <label
            htmlFor="notification-title"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Title <span className="text-red-500">*</span>
          </label>
          <input
            id="notification-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter notification title..."
            maxLength={100}
            disabled={disabled || sending}
            className={`
              w-full px-4 py-3 bg-white dark:bg-gray-900 border rounded-lg
              text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500
              focus:outline-none focus:ring-2 focus:border-transparent
              disabled:opacity-50 disabled:cursor-not-allowed
              ${
                titleError
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-slate-200 dark:border-gray-700 focus:ring-blue-500'
              }
            `}
          />
          <div className="flex items-center justify-between text-sm">
            <span
              className={`${
                titleError ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {title.length}/100 characters
            </span>
            {titleError && (
              <span className="text-red-500">Title is too long</span>
            )}
          </div>
        </div>

        {/* Description textarea */}
        <div className="space-y-2">
          <label
            htmlFor="notification-description"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            id="notification-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter notification description..."
            rows={4}
            maxLength={500}
            disabled={disabled || sending}
            className={`
              w-full px-4 py-3 bg-white dark:bg-gray-900 border rounded-lg
              text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500
              focus:outline-none focus:ring-2 focus:border-transparent resize-none
              disabled:opacity-50 disabled:cursor-not-allowed
              ${
                descriptionError
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-slate-200 dark:border-gray-700 focus:ring-blue-500'
              }
            `}
          />
          <div className="flex items-center justify-between text-sm">
            <span
              className={`${
                descriptionError ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {description.length}/500 characters
            </span>
            {descriptionError && (
              <span className="text-red-500">Description is too long</span>
            )}
          </div>
        </div>

        {/* Image upload */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Image (Optional)
          </label>

          {imagePreview ? (
            <div className="relative">
              <img
                src={imagePreview}
                alt="Notification preview"
                className="w-full h-48 object-cover rounded-lg border border-slate-200 dark:border-gray-700"
              />
              <button
                type="button"
                onClick={handleRemoveImage}
                disabled={disabled || sending}
                className="absolute top-2 right-2 p-2 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          ) : (
            <div
              onClick={() => !disabled && !sending && fileInputRef.current?.click()}
              className={`
                border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                transition-colors
                ${
                  disabled || sending
                    ? 'border-slate-300 dark:border-gray-600 cursor-not-allowed opacity-50'
                    : 'border-slate-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-500'
                }
              `}
            >
              <svg
                className="mx-auto h-12 w-12 text-slate-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Click to upload an image
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
                PNG, JPG, GIF up to 5MB
              </p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            disabled={disabled || sending}
            className="hidden"
          />
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={!isValid || disabled || sending}
          className={`
            w-full py-3 px-4 rounded-lg font-medium transition-colors
            flex items-center justify-center gap-2
            ${
              !isValid || disabled || sending
                ? 'bg-slate-300 dark:bg-gray-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }
          `}
        >
          {sending ? (
            <>
              <svg
                className="animate-spin h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Sending...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
              Send Notification
            </>
          )}
        </button>
      </div>
    </form>
  );
};