import { CheckIcon } from '@heroicons/react/24/outline';

export function meta() {
  return [
    { title: 'Checkout Successful' },
    { name: 'description', content: 'Checkout successful' },
  ];
}

export default function CheckoutSuccessful() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-100 p-4 dark:bg-zinc-900">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow-xs">
        <div className="mb-6 flex justify-center">
          <CheckIcon className="h-16 w-16 text-green-500" />
        </div>

        <h1 className="mb-4 text-center text-2xl font-bold text-gray-800">
          Thank You for Your Purchase!
        </h1>

        <p className="mb-8 text-center text-gray-600">
          You will receive an email with your purchase details and further
          instructions.
        </p>
      </div>
    </div>
  );
}
