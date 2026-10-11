import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { requestContext } from "@/lib/request";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requestContext();
  return (
    <>
      <Header lang={ctx.lang} settings={ctx.settings} theme={ctx.theme} />
      <main className="pb-6">{children}</main>
      <Footer lang={ctx.lang} settings={ctx.settings} />
    </>
  );
}
