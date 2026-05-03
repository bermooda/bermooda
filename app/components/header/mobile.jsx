import SidebarToggle from '#/components/sidebar/toggle';
import Logo from '#/components/ui/logo';

export default function MobileHeader() {
  return (
    <div className="dark:border-dark-700/50 dark:bg-dark-800 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3 md:hidden">
      <SidebarToggle />

      <div className="flex items-center">
        <a
          href="/dashboard"
          className="-m-1.5 flex items-center gap-2 p-1.5 text-slate-800 dark:text-white"
        >
          <Logo alt="CursorStack Logo" className="-m-1 h-8 w-auto" />
          <h2 className="text-lg font-bold">CursorStack</h2>
        </a>
      </div>

      {/* Keep this to center the logo */}
      <div className="h-10 w-10" />
    </div>
  );
}
