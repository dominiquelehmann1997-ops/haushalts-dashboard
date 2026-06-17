import { PushSetupControl } from "@/components/PushSetupControl";

export default function MobileSettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold mb-4">Einstellungen</h1>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-300">Push-Benachrichtigungen</h2>
        <p className="text-xs text-slate-500">
          Aktiviere Push auf diesem Handy, um benachrichtigt zu werden, sobald ein
          Essensplan-Entwurf bereitliegt.
        </p>
        <PushSetupControl />
      </section>

      <p className="text-slate-500 text-xs">Cloudflare-Status folgt.</p>
    </div>
  );
}
