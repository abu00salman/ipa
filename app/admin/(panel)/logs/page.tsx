import { listLogs } from "@/lib/db";
import { requestContext } from "@/lib/request";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function LogsPage() {
  const { lang } = await requestContext();
  const logs = listLogs(300);
  const levelLabel = { info: t(lang, "logs_level_info"), warn: t(lang, "logs_level_warn"), error: t(lang, "logs_level_error") };
  const levelClass = { info: "", warn: "badge-warn", error: "badge-bad" };

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold tracking-tight">{t(lang, "logs_title")}</h1>
      {logs.length === 0 ? (
        <div className="card p-8 text-center muted">{t(lang, "logs_empty")}</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-start text-sm">
            <thead className="muted text-xs">
              <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                <th scope="col" className="p-3 text-start">{t(lang, "log_time")}</th>
                <th scope="col" className="p-3 text-start">{t(lang, "log_level")}</th>
                <th scope="col" className="p-3 text-start">{t(lang, "log_category")}</th>
                <th scope="col" className="p-3 text-start">{t(lang, "log_message")}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b align-top" style={{ borderColor: "var(--border)" }}>
                  <td className="muted whitespace-nowrap p-3 tabular-nums">{new Date(log.createdAt).toLocaleString(lang === "ar" ? "ar-EG" : "en-US")}</td>
                  <td className="p-3"><span className={`badge ${levelClass[log.level]}`}>{levelLabel[log.level]}</span></td>
                  <td className="p-3">{log.category}</td>
                  <td className="p-3">
                    <p className="leading-6">{log.message}</p>
                    {Object.keys(log.meta).length > 0 && <code className="muted mt-1 block break-all text-xs">{JSON.stringify(log.meta)}</code>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
