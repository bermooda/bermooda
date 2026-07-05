import Card from '#/components/admin/card';

export default function DashboardWidgetsBlock({ totalOrders }) {
  return (
    <Card>
      <p className="text-text text-sm font-medium">Sample Analytics</p>
      <p className="text-text-muted mt-1 text-sm">
        Tracking store activity. {totalOrders?.toLocaleString('en') ?? 0} orders
        recorded in the shop.
      </p>
    </Card>
  );
}
