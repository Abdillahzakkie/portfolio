import { Header } from '@/components/public/Header';
import { Footer } from '@/components/public/Footer';

/**
 * Public site chrome: skip-link → sticky Header → <main> landmark → Footer.
 * Admin lives outside this group and uses its own shell (no public header).
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to projects
      </a>
      <Header />
      <main id="main">{children}</main>
      <Footer />
    </>
  );
}
