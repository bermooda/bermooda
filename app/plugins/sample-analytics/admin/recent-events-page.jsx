export function RecentEventsPage({ loaderData }) {
  const { events } = loaderData ?? { events: [] };

  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-semibold">
        Sample Analytics — Recent Events
      </h1>
      {events.length === 0 ? (
        <p className="text-slate-500">
          No events captured yet. Place an order to see data here.
        </p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-slate-600">
              <th className="py-2 pr-4">Order #</th>
              <th className="py-2 pr-4">Total</th>
              <th className="py-2 pr-4">Currency</th>
              <th className="py-2">Captured At</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.orderId} className="border-b">
                <td className="py-2 pr-4 font-mono">{e.orderNumber}</td>
                <td className="py-2 pr-4">{(e.totalCents / 100).toFixed(2)}</td>
                <td className="py-2 pr-4">{e.currency}</td>
                <td className="py-2 text-slate-500">
                  {new Date(e.capturedAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
