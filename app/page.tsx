import type { Metadata } from "next";
import Link from "next/link";
import { FileDown, Server, ShieldCheck, Snowflake } from "lucide-react";

const REPOSITORY_URL = "https://github.com/rajshahbuilds/cryomap";

export const metadata: Metadata = {
  title: "CryoMap · Collaborative cryogenic wiring diagrams",
  description:
    "Open-source wiring documentation, versioning, and collaboration for quantum-hardware research labs.",
};

const primaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-ice-deep px-5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(11,37,69,0.16)] transition hover:opacity-90";
const secondaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-white/80 px-5 text-sm font-semibold text-ice-deep transition hover:bg-white";

export default function Home() {
  return (
    <div className="home-page flex min-h-full flex-1 flex-col text-ice-deep">
      <header className="mx-auto flex w-[min(70rem,calc(100%-3rem))] items-center justify-between gap-5 border-b border-border/80 py-5 max-sm:w-[calc(100%-1.75rem)] max-sm:py-4">
        <Link
          href="/"
          aria-label="CryoMap home"
          className="flex items-center gap-2.5 font-semibold tracking-tight"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-ice-deep via-ice to-ice-frost text-white shadow-[0_8px_24px_rgba(29,111,165,0.22)]">
            <Snowflake aria-hidden="true" size={19} strokeWidth={2.2} />
          </span>
          CryoMap
        </Link>

        <nav aria-label="Main navigation" className="flex items-center gap-2">
          <a
            href={REPOSITORY_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-2 px-3 text-sm font-medium text-ice-muted transition hover:text-ice-deep max-sm:hidden"
          >
            GitHub
          </a>
          <Link href="/auth/login" className={primaryButton}>
            Sign in
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto w-[min(54rem,calc(100%-3rem))] py-28 text-center max-md:py-20 max-sm:w-[calc(100%-1.75rem)] max-sm:py-16">
          <h1
            aria-label="A shared map of your cryogenic wiring."
            className="text-7xl font-semibold leading-[0.99] tracking-[-0.055em] max-md:text-6xl max-sm:text-5xl"
          >
            A shared map of your
            <span className="ice-text block pb-2">cryogenic wiring.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-ice-deep/80">
            CryoMap is an open-source project that helps quantum-hardware teams
            document dilution refrigerators, preserve known configurations, and
            collaborate without losing context.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-2.5 max-sm:flex-col">
            <Link
              href="/auth/login?next=%2Fworkspaces%2Fnew"
              className={primaryButton}
            >
              Create your workspace
            </Link>
            <a
              href={REPOSITORY_URL}
              target="_blank"
              rel="noreferrer"
              className={secondaryButton}
            >
              Explore the code
            </a>
          </div>

          <ul className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-ice-muted">
            <li className="flex items-center gap-1.5">
              <ShieldCheck aria-hidden="true" size={14} className="text-ice" />
              Role-based access
            </li>
            <li className="flex items-center gap-1.5">
              <FileDown aria-hidden="true" size={14} className="text-ice" />
              PNG, PDF, and JSON export
            </li>
            <li className="flex items-center gap-1.5">
              <Server aria-hidden="true" size={14} className="text-ice" />
              Self-hostable
            </li>
          </ul>
        </section>

        <section className="border-y border-border/80 bg-white/65 py-20 max-md:py-16">
          <div className="mx-auto w-[min(70rem,calc(100%-3rem))] max-sm:w-[calc(100%-1.75rem)]">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-4xl font-semibold tracking-[-0.04em] max-sm:text-3xl">
                From empty workspace to shared reference
              </h2>
              <p className="mt-3 text-base leading-7 text-ice-muted">
                A lightweight workflow for documenting what is actually
                connected.
              </p>
            </div>

            <ol className="mt-14 grid grid-cols-3 gap-14 [counter-reset:step] max-md:grid-cols-1 max-md:gap-10">
              <li className="relative pt-14 [counter-increment:step] before:absolute before:left-0 before:top-0 before:grid before:h-9 before:w-9 before:place-items-center before:rounded-full before:bg-ice before:text-sm before:font-semibold before:text-white before:content-[counter(step)]">
                <h3 className="text-lg font-semibold">
                  Create a lab workspace
                </h3>
                <p className="mt-2 text-sm leading-7 text-ice-muted">
                  Keep each lab&rsquo;s fridges and collaborators organized
                  together.
                </p>
              </li>
              <li className="relative pt-14 [counter-increment:step] before:absolute before:left-0 before:top-0 before:grid before:h-9 before:w-9 before:place-items-center before:rounded-full before:bg-ice before:text-sm before:font-semibold before:text-white before:content-[counter(step)]">
                <h3 className="text-lg font-semibold">Map the wiring</h3>
                <p className="mt-2 text-sm leading-7 text-ice-muted">
                  Add stages, lines, components, annotations, and connections.
                </p>
              </li>
              <li className="relative pt-14 [counter-increment:step] before:absolute before:left-0 before:top-0 before:grid before:h-9 before:w-9 before:place-items-center before:rounded-full before:bg-ice before:text-sm before:font-semibold before:text-white before:content-[counter(step)]">
                <h3 className="text-lg font-semibold">Version and share</h3>
                <p className="mt-2 text-sm leading-7 text-ice-muted">
                  Save known states and invite teammates with the access they
                  need.
                </p>
              </li>
            </ol>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-[min(70rem,calc(100%-3rem))] items-center justify-between gap-6 py-8 text-xs text-ice-muted max-md:flex-col max-md:items-start max-sm:w-[calc(100%-1.75rem)]">
        <span>© 2026 Raj Shah · CryoMap public beta</span>
        <nav
          aria-label="Footer navigation"
          className="flex flex-wrap gap-x-5 gap-y-2"
        >
          <a href={REPOSITORY_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a
            href={`${REPOSITORY_URL}/blob/main/docs/SELF_HOSTING.md`}
            target="_blank"
            rel="noreferrer"
          >
            Self-hosting
          </a>
          <a
            href={`${REPOSITORY_URL}/issues/new/choose`}
            target="_blank"
            rel="noreferrer"
          >
            Report an issue
          </a>
          <a
            href={`${REPOSITORY_URL}/blob/main/PRIVACY.md`}
            target="_blank"
            rel="noreferrer"
          >
            Privacy
          </a>
          <a
            href={`${REPOSITORY_URL}/blob/main/TERMS.md`}
            target="_blank"
            rel="noreferrer"
          >
            Terms
          </a>
        </nav>
      </footer>
    </div>
  );
}
