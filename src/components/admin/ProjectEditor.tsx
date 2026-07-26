'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  DOMAINS,
  DOMAIN_LABELS,
  SLUG_REGEX,
  SLUG_MIN,
  SLUG_MAX,
} from '@/server/models/types';
import { AdminShell } from './AdminShell';
import { Button } from './Button';
import { RichTextToolbar, type EditorCommand } from './RichTextToolbar';
import { MarkdownPreview } from './MarkdownPreview';
import { ToastRegion, useToast } from './Toast';
import { ChevronLeftIcon, ExternalIcon, PlusIcon } from './icons';
import { emptyProjectDraft, type ProjectDraft } from './types';
import { createProject, updateProject, checkProjectSlug, type ApiError } from './api';

type FieldKey = 'title' | 'slug' | 'domain' | 'summary' | 'longDescription';
type SlugStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, '');
}

function serialize(d: ProjectDraft): string {
  return JSON.stringify({
    title: d.title,
    slug: d.slug,
    domain: d.domain,
    summary: d.summary,
    role: d.role,
    stack: d.stack,
    heroText: d.heroText,
    longDescription: d.longDescription,
    links: d.links,
    graph: d.graph,
    order: d.order,
    featured: d.featured,
  });
}

const inputStyle = {
  background: 'var(--surface)',
  borderColor: 'var(--border-strong)',
  color: 'var(--text)',
} as const;

const labelClass = 'mb-1.5 block text-[12.5px] font-semibold';
const textInputClass =
  'w-full rounded-[var(--radius-sm)] border px-3 py-2.5 text-[13.5px] outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]';
const monoInputClass =
  'w-full rounded-[var(--radius-sm)] border px-3 py-2.5 text-[12.5px] outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]';

export function ProjectEditor({
  user,
  initial,
}: {
  user: { name: string };
  initial?: ProjectDraft;
}) {
  const router = useRouter();
  const { toast, show, clear } = useToast();

  const [draft, setDraft] = useState<ProjectDraft>(() => initial ?? emptyProjectDraft());
  const [slugTouched, setSlugTouched] = useState<boolean>(Boolean(initial?.slug));
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle');
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [showSummary, setShowSummary] = useState(false);
  const [view, setView] = useState<'write' | 'preview'>('write');
  const [active, setActive] = useState<Partial<Record<EditorCommand, boolean>>>({});
  const [stackInput, setStackInput] = useState('');

  // Refs: latest state for interval/guard closures + focus targets.
  const savedSnapshotRef = useRef<string>(serialize(initial ?? emptyProjectDraft()));
  const submittedRef = useRef(false);
  const slugStatusRef = useRef<SlugStatus>('idle');
  const titleRef = useRef<HTMLInputElement>(null);
  const slugRef = useRef<HTMLInputElement>(null);
  const domainRef = useRef<HTMLSelectElement>(null);
  const summaryRef = useRef<HTMLTextAreaElement>(null);
  const longDescRef = useRef<HTMLTextAreaElement>(null);

  // The slug is set at creation and immutable afterwards: any saved project
  // (has an id) shows a read-only slug and never runs the uniqueness check.
  const slugImmutable = Boolean(draft.id);

  const dirty = savedSnapshotRef.current !== serialize(draft);

  const latest = useRef({ draft, dirty, saving });
  latest.current = { draft, dirty, saving };
  slugStatusRef.current = slugStatus;

  // --- field updates ------------------------------------------------------
  const patch = useCallback((p: Partial<ProjectDraft>) => {
    setDraft((prev) => ({ ...prev, ...p }));
  }, []);

  function onTitleChange(v: string) {
    setDraft((prev) => {
      const next = { ...prev, title: v };
      if (!slugTouched && !prev.id) next.slug = slugify(v);
      return next;
    });
  }

  function onSlugChange(v: string) {
    setSlugTouched(true);
    patch({ slug: v.toLowerCase() });
  }

  function addStack() {
    const t = stackInput.trim();
    if (!t) return;
    setDraft((prev) => (prev.stack.includes(t) ? prev : { ...prev, stack: [...prev.stack, t] }));
    setStackInput('');
  }

  function removeStack(t: string) {
    patch({ stack: draft.stack.filter((x) => x !== t) });
  }

  // --- links helpers ------------------------------------------------------
  function patchLinks(p: Partial<ProjectDraft['links']>) {
    setDraft((prev) => ({ ...prev, links: { ...prev.links, ...p } }));
  }

  function addExtraLink() {
    setDraft((prev) => ({
      ...prev,
      links: { ...prev.links, extra: [...prev.links.extra, { label: '', url: '' }] },
    }));
  }

  function updateExtraLink(i: number, field: 'label' | 'url', value: string) {
    setDraft((prev) => ({
      ...prev,
      links: {
        ...prev.links,
        extra: prev.links.extra.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)),
      },
    }));
  }

  function removeExtraLink(i: number) {
    setDraft((prev) => ({
      ...prev,
      links: { ...prev.links, extra: prev.links.extra.filter((_, idx) => idx !== i) },
    }));
  }

  // --- graph helpers ------------------------------------------------------
  function patchGraph(p: Partial<ProjectDraft['graph']>) {
    setDraft((prev) => ({ ...prev, graph: { ...prev.graph, ...p } }));
  }

  function graphNumber(value: string): number | '' {
    if (value.trim() === '') return '';
    const n = Number(value);
    return Number.isNaN(n) ? '' : n;
  }

  // --- slug uniqueness check (debounced, new mode only) -------------------
  useEffect(() => {
    if (slugImmutable) {
      setSlugStatus('idle');
      return;
    }
    const slug = (draft.slug || '').trim();
    if (!slug) {
      setSlugStatus('idle');
      return;
    }
    if (!SLUG_REGEX.test(slug) || slug.length < SLUG_MIN || slug.length > SLUG_MAX) {
      setSlugStatus('invalid');
      return;
    }
    setSlugStatus('checking');
    const t = setTimeout(async () => {
      try {
        const ok = await checkProjectSlug(slug);
        setSlugStatus(ok ? 'available' : 'taken');
      } catch {
        setSlugStatus('idle');
      }
    }, 450);
    return () => clearTimeout(t);
  }, [draft.slug, slugImmutable]);

  // --- validation ---------------------------------------------------------
  const validate = useCallback((d: ProjectDraft): Partial<Record<FieldKey, string>> => {
    const e: Partial<Record<FieldKey, string>> = {};
    if (!d.title.trim()) e.title = 'Add a title.';
    if (!d.id) {
      const slug = (d.slug || '').trim();
      if (!slug) e.slug = 'Add a slug.';
      else if (!SLUG_REGEX.test(slug) || slug.length < SLUG_MIN || slug.length > SLUG_MAX)
        e.slug = 'Use lowercase letters, numbers and hyphens.';
      else if (slugStatusRef.current === 'taken') e.slug = 'That slug is already taken.';
    }
    if (!d.domain) e.domain = 'Choose a domain.';
    if (!d.summary.trim()) e.summary = 'Add a summary.';
    return e;
  }, []);

  function focusFirstInvalid(e: Partial<Record<FieldKey, string>>) {
    const order: [FieldKey, React.RefObject<HTMLElement | null>][] = [
      ['title', titleRef],
      ['slug', slugRef],
      ['domain', domainRef],
      ['summary', summaryRef],
      ['longDescription', longDescRef],
    ];
    for (const [key, ref] of order) {
      if (e[key]) {
        ref.current?.focus();
        break;
      }
    }
  }

  // --- persistence --------------------------------------------------------
  const persist = useCallback(async () => {
    const d = latest.current.draft;
    let id = d.id;
    let outSlug = d.slug;
    if (!id) {
      const res = await createProject(d);
      id = res.id;
      outSlug = res.slug ?? d.slug;
      // Reflect the new id in the URL without a full navigation.
      window.history.replaceState(null, '', `/admin/projects/${id}`);
    } else {
      const res = await updateProject(id, d);
      if (res?.slug) outSlug = res.slug;
    }
    const saved: ProjectDraft = { ...d, id, slug: outSlug };
    setDraft((prev) => ({ ...prev, id, slug: outSlug }));
    savedSnapshotRef.current = serialize(saved);
    setLastSavedAt(new Date());
    return { id: id as string, slug: outSlug };
  }, []);

  const handleErr = useCallback(
    (err: unknown, verb: string) => {
      const status = (err as ApiError).status;
      if (status === 401) {
        show('error', 'Session expired — please sign in again.');
      } else if (status === 409) {
        show('error', 'That slug is already taken — choose another.');
        setErrors((e) => ({ ...e, slug: 'That slug is already taken.' }));
      } else {
        show('error', `Couldn't ${verb} — your changes are still here. Try again.`);
      }
    },
    [show],
  );

  const doSave = useCallback(
    async (silent = false) => {
      const st = latest.current;
      const e = validate(st.draft);
      if (Object.keys(e).length) {
        // Silent autosave stays quiet on an incomplete draft (a create would 400).
        if (silent) return;
        setErrors(e);
        setShowSummary(true);
        focusFirstInvalid(e);
        show('error', 'Fix the highlighted fields before saving.');
        return;
      }
      if (st.saving) return;
      setErrors({});
      setShowSummary(false);
      submittedRef.current = true; // set BEFORE the async save (guard race)
      setSaving(true);
      try {
        await persist();
        if (!silent) show('success', 'Saved.');
      } catch (err) {
        submittedRef.current = false; // re-arm guard; edits are kept
        handleErr(err, 'save');
      } finally {
        setSaving(false);
      }
    },
    [persist, validate, show, handleErr],
  );

  // --- unsaved-changes guard (beforeunload) -------------------------------
  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (submittedRef.current) return; // an intentional save/nav is in flight
      if (!latest.current.dirty) return;
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // --- autosave on interval ----------------------------------------------
  useEffect(() => {
    const id = setInterval(() => {
      const st = latest.current;
      if (st.dirty && !st.saving) void doSave(true);
    }, 20000);
    return () => clearInterval(id);
  }, [doSave]);

  function onFieldBlur() {
    const st = latest.current;
    if (st.dirty && !st.saving) void doSave(true);
  }

  function guardedGoToProjects(e: React.MouseEvent) {
    e.preventDefault();
    if (latest.current.dirty && !submittedRef.current) {
      if (!window.confirm('You have unsaved changes. Discard them?')) return;
    }
    submittedRef.current = true;
    router.push('/admin/projects');
  }

  // --- textarea Markdown commands (operate on longDescription) ------------
  const applyToBody = useCallback(
    (start: number, end: number, text: string, selStart: number, selEnd: number) => {
      const ta = longDescRef.current;
      if (!ta) return;
      const next = ta.value.slice(0, start) + text + ta.value.slice(end);
      patch({ longDescription: next });
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(selStart, selEnd);
      });
    },
    [patch],
  );

  function wrapInline(mark: string, placeholder: string) {
    const ta = longDescRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const sel = value.slice(s, e);
    if (sel) {
      applyToBody(s, e, mark + sel + mark, s + mark.length, e + mark.length);
    } else {
      applyToBody(s, e, mark + placeholder + mark, s + mark.length, s + mark.length + placeholder.length);
    }
  }

  function linePrefix(prefix: string) {
    const ta = longDescRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const lineStart = value.lastIndexOf('\n', s - 1) + 1;
    let lineEnd = value.indexOf('\n', e);
    if (lineEnd === -1) lineEnd = value.length;
    const lines = value.slice(lineStart, lineEnd).split('\n');
    const allPrefixed = lines.every((l) => l.startsWith(prefix));
    const newBlock = lines
      .map((l) => (allPrefixed ? l.slice(prefix.length) : prefix + l))
      .join('\n');
    applyToBody(lineStart, lineEnd, newBlock, lineStart, lineStart + newBlock.length);
  }

  function insertAtCaret(text: string, caretOffset?: number) {
    const ta = longDescRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e } = ta;
    const pos = caretOffset != null ? s + caretOffset : s + text.length;
    applyToBody(s, e, text, pos, pos);
  }

  function runCommand(cmd: EditorCommand) {
    const ta = longDescRef.current;
    if (!ta) return;
    const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd);
    switch (cmd) {
      case 'bold':
        wrapInline('**', 'bold text');
        break;
      case 'italic':
        wrapInline('*', 'italic text');
        break;
      case 'h2':
        linePrefix('## ');
        break;
      case 'quote':
        linePrefix('> ');
        break;
      case 'ul':
        linePrefix('- ');
        break;
      case 'code':
        insertAtCaret('\n```\n' + (sel || 'code') + '\n```\n');
        break;
      case 'hr':
        insertAtCaret('\n\n---\n\n');
        break;
      case 'link': {
        const label = sel || 'link text';
        insertAtCaret(`[${label}](https://)`, `[${label}](`.length + 8);
        break;
      }
      case 'image': {
        const label = sel || 'alt text';
        insertAtCaret(`![${label}](https://)`, `![${label}](`.length + 8);
        break;
      }
    }
  }

  function computeActive() {
    const ta = longDescRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const lineStart = value.lastIndexOf('\n', s - 1) + 1;
    let lineEnd = value.indexOf('\n', s);
    if (lineEnd === -1) lineEnd = value.length;
    const line = value.slice(lineStart, lineEnd);
    const sel = value.slice(s, e);
    setActive({
      h2: line.startsWith('## '),
      quote: line.startsWith('> '),
      ul: line.startsWith('- '),
      bold: /^\*\*[\s\S]+\*\*$/.test(sel),
      italic: /^\*(?!\*)[\s\S]+\*$/.test(sel),
    });
  }

  // --- derived ------------------------------------------------------------
  const savedLabel = lastSavedAt
    ? `Saved ${lastSavedAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
    : dirty
      ? 'Unsaved changes'
      : 'No changes yet';

  const slugHint: { text: string; color: string } = (() => {
    switch (slugStatus) {
      case 'checking':
        return { text: 'Checking availability…', color: 'var(--text-faint)' };
      case 'available':
        return { text: 'Available', color: 'var(--success)' };
      case 'taken':
        return { text: 'Already taken — choose another.', color: 'var(--danger)' };
      case 'invalid':
        return { text: 'Use lowercase letters, numbers and hyphens.', color: 'var(--danger)' };
      default:
        return { text: 'Auto from title · editable · must be unique.', color: 'var(--text-faint)' };
    }
  })();

  const fieldError = (k: FieldKey) => errors[k];

  const requiredMark = (
    <span style={{ color: 'var(--info)' }} title="required">
      *
    </span>
  );

  const header = (
    <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <Link
          href="/admin/projects"
          onClick={guardedGoToProjects}
          className="inline-flex items-center gap-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
          style={{ color: 'var(--text-muted)' }}
        >
          <ChevronLeftIcon aria-hidden />
          <span className="hidden sm:inline">Projects</span>
        </Link>
        {draft.featured && (
          <span
            className="inline-flex items-center gap-2 rounded-[var(--radius-full)] px-3 py-1.5 text-[13px] font-semibold"
            style={{
              color: 'var(--success)',
              backgroundColor: 'color-mix(in srgb, var(--success) 13%, transparent)',
            }}
          >
            <span aria-hidden="true" className="h-[7px] w-[7px] shrink-0 rounded-full bg-current" />
            Featured
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {draft.slug && (
          <a
            href={`/projects/${draft.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center gap-1.5 rounded-[var(--radius-md)] px-3 text-sm font-semibold sm:h-9 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
            style={{ color: 'var(--info)' }}
          >
            View
            <ExternalIcon aria-hidden />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        )}
        <Button
          data-testid="editor-save"
          variant="primary"
          size="sm"
          loading={saving}
          onClick={() => void doSave(false)}
        >
          Save
        </Button>
      </div>
    </div>
  );

  return (
    <AdminShell activeNav="projects" user={user} header={header} mainClassName="p-0">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px]">
        {/* Main editor pane */}
        <div className="min-w-0 border-b p-5 sm:p-7 lg:border-b-0 lg:border-r" style={{ borderColor: 'var(--border)' }}>
          {showSummary && Object.keys(errors).length > 0 && (
            <div
              role="alert"
              className="mb-4 rounded-[var(--radius-md)] border px-4 py-3 text-sm"
              style={{
                borderColor: 'var(--danger)',
                background: 'color-mix(in srgb, var(--danger) 8%, transparent)',
                color: 'var(--danger)',
              }}
            >
              <strong className="font-bold">Can&apos;t save yet.</strong> Please fix:
              <ul className="mt-1 list-disc pl-5">
                {Object.entries(errors).map(([k, v]) => (
                  <li key={k}>{v}</li>
                ))}
              </ul>
            </div>
          )}

          <label htmlFor="editor-title" className="sr-only">
            Project title
          </label>
          <input
            id="editor-title"
            data-testid="editor-title"
            ref={titleRef}
            value={draft.title}
            onChange={(e) => onTitleChange(e.target.value)}
            onBlur={onFieldBlur}
            placeholder="Project title"
            required
            aria-required="true"
            aria-invalid={Boolean(fieldError('title'))}
            aria-describedby={fieldError('title') ? 'title-error' : undefined}
            className="mb-4 w-full border-0 bg-transparent p-0 text-3xl font-bold leading-tight outline-none sm:text-[38px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--ring)]"
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', color: 'var(--text)' }}
          />
          {fieldError('title') && (
            <p id="title-error" className="mb-3 text-sm" style={{ color: 'var(--danger)' }}>
              {fieldError('title')}
            </p>
          )}

          <RichTextToolbar onCommand={runCommand} active={active} />

          {/* Write / Preview toggle */}
          <div
            role="tablist"
            aria-label="Editor view"
            className="mb-3 inline-flex gap-1 rounded-[var(--radius-md)] p-1"
            style={{ background: 'var(--surface-2)' }}
          >
            {(['write', 'preview'] as const).map((v) => (
              <button
                key={v}
                role="tab"
                type="button"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className="rounded-md px-3.5 py-1.5 text-[13px] font-semibold capitalize focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
                style={
                  view === v
                    ? { background: 'var(--bg-elevated)', color: 'var(--text)', boxShadow: 'var(--elev-1)' }
                    : { color: 'var(--text-muted)' }
                }
              >
                {v}
              </button>
            ))}
          </div>

          {view === 'write' ? (
            <>
              <label htmlFor="editor-longdesc" className="sr-only">
                Long description (Markdown)
              </label>
              <textarea
                id="editor-longdesc"
                data-testid="editor-longdesc"
                ref={longDescRef}
                value={draft.longDescription}
                onChange={(e) => patch({ longDescription: e.target.value })}
                onBlur={onFieldBlur}
                onSelect={computeActive}
                onKeyUp={computeActive}
                onClick={computeActive}
                aria-invalid={Boolean(fieldError('longDescription'))}
                placeholder="Write the case study in Markdown…"
                className="min-h-[440px] w-full resize-y rounded-[var(--radius-md)] border p-5 text-sm leading-relaxed outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
                style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
              />
            </>
          ) : (
            <div
              className="min-h-[440px] w-full overflow-x-auto rounded-[var(--radius-md)] border p-5"
              style={{ background: 'var(--surface)', borderColor: 'var(--border-strong)' }}
            >
              <MarkdownPreview body={draft.longDescription} />
            </div>
          )}
          {fieldError('longDescription') && (
            <p className="mt-2 text-sm" style={{ color: 'var(--danger)' }}>
              {fieldError('longDescription')}
            </p>
          )}

          <div className="mt-3 flex items-center gap-2 text-[12.5px]" style={{ color: 'var(--text-faint)' }}>
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: dirty ? 'var(--warning)' : 'var(--success)' }}
            />
            <span aria-live="polite">{saving ? 'Saving…' : savedLabel}</span>
          </div>
        </div>

        {/* Settings aside */}
        <aside className="p-5 sm:p-6" aria-label="Project settings" style={{ background: 'var(--bg-elevated)' }}>
          <h2
            className="m-0 mb-4 text-[13px] font-bold uppercase tracking-wider"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-faint)' }}
          >
            Settings
          </h2>

          {/* Slug */}
          <div className="mb-5">
            <label htmlFor="editor-slug" className={labelClass} style={{ color: 'var(--text)' }}>
              Slug {requiredMark}
            </label>
            {slugImmutable ? (
              <>
                <input
                  id="editor-slug"
                  data-testid="editor-slug"
                  ref={slugRef}
                  value={draft.slug}
                  readOnly
                  aria-readonly="true"
                  aria-describedby="slug-hint"
                  className={`${monoInputClass} cursor-not-allowed opacity-70`}
                  style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
                />
                <p id="slug-hint" className="mt-1 text-[11.5px]" style={{ color: 'var(--warning)' }}>
                  Permanent — the URL key is set at creation and can&apos;t be changed.
                </p>
              </>
            ) : (
              <>
                <input
                  id="editor-slug"
                  data-testid="editor-slug"
                  ref={slugRef}
                  value={draft.slug}
                  onChange={(e) => onSlugChange(e.target.value)}
                  onBlur={onFieldBlur}
                  required
                  aria-required="true"
                  aria-invalid={slugStatus === 'taken' || slugStatus === 'invalid' || Boolean(fieldError('slug'))}
                  aria-describedby={fieldError('slug') ? 'slug-hint slug-error' : 'slug-hint'}
                  className={monoInputClass}
                  style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
                />
                <p id="slug-hint" className="mt-1 text-[11.5px]" style={{ color: slugHint.color }} aria-live="polite">
                  {slugHint.text}
                </p>
                {fieldError('slug') && (
                  <p id="slug-error" className="mt-1 text-[11.5px]" style={{ color: 'var(--danger)' }}>
                    {fieldError('slug')}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Domain (required) */}
          <div className="mb-5">
            <label htmlFor="editor-domain" className={labelClass} style={{ color: 'var(--text)' }}>
              Domain {requiredMark}
            </label>
            <select
              id="editor-domain"
              data-testid="editor-domain"
              ref={domainRef}
              value={draft.domain}
              onChange={(e) => patch({ domain: e.target.value as ProjectDraft['domain'] })}
              onBlur={onFieldBlur}
              required
              aria-required="true"
              aria-invalid={Boolean(fieldError('domain'))}
              aria-describedby={fieldError('domain') ? 'domain-hint domain-error' : 'domain-hint'}
              className={textInputClass}
              style={inputStyle}
            >
              <option value="">Select a domain…</option>
              {DOMAINS.map((d) => (
                <option key={d} value={d}>
                  {DOMAIN_LABELS[d]}
                </option>
              ))}
            </select>
            <p id="domain-hint" className="mt-1 text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
              Which cluster this project belongs to on the graph home.
            </p>
            {fieldError('domain') && (
              <p id="domain-error" className="mt-1 text-[11.5px]" style={{ color: 'var(--danger)' }}>
                {fieldError('domain')}
              </p>
            )}
          </div>

          {/* Summary (required) */}
          <div className="mb-5">
            <label htmlFor="editor-summary" className={labelClass} style={{ color: 'var(--text)' }}>
              Summary {requiredMark}
            </label>
            <textarea
              id="editor-summary"
              data-testid="editor-summary"
              ref={summaryRef}
              rows={3}
              value={draft.summary}
              onChange={(e) => patch({ summary: e.target.value })}
              onBlur={onFieldBlur}
              required
              aria-required="true"
              aria-invalid={Boolean(fieldError('summary'))}
              aria-describedby={fieldError('summary') ? 'summary-hint summary-error' : 'summary-hint'}
              className={`${textInputClass} resize-y`}
              style={inputStyle}
            />
            <p id="summary-hint" className="mt-1 text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
              One–two sentences shown on cards and the graph.
            </p>
            {fieldError('summary') && (
              <p id="summary-error" className="mt-1 text-[11.5px]" style={{ color: 'var(--danger)' }}>
                {fieldError('summary')}
              </p>
            )}
          </div>

          {/* Role */}
          <div className="mb-5">
            <label htmlFor="editor-role" className={labelClass} style={{ color: 'var(--text)' }}>
              Role
            </label>
            <input
              id="editor-role"
              value={draft.role}
              onChange={(e) => patch({ role: e.target.value })}
              onBlur={onFieldBlur}
              placeholder="e.g. Solo build · Lead engineer"
              className={textInputClass}
              style={inputStyle}
            />
          </div>

          {/* Hero text */}
          <div className="mb-5">
            <label htmlFor="editor-hero" className={labelClass} style={{ color: 'var(--text)' }}>
              Hero text
            </label>
            <textarea
              id="editor-hero"
              rows={2}
              value={draft.heroText}
              onChange={(e) => patch({ heroText: e.target.value })}
              onBlur={onFieldBlur}
              aria-describedby="hero-hint"
              className={`${textInputClass} resize-y`}
              style={inputStyle}
            />
            <p id="hero-hint" className="mt-1 text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
              Short punch line for the project hero.
            </p>
          </div>

          {/* Stack */}
          <div className="mb-5">
            <span className={labelClass} style={{ color: 'var(--text)' }}>
              Stack
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {draft.stack.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-full)] px-2.5 py-1 text-[11.5px] font-semibold"
                  style={{
                    background: 'color-mix(in srgb, var(--info) 12%, transparent)',
                    color: 'var(--info)',
                  }}
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => removeStack(t)}
                    aria-label={`Remove ${t}`}
                    className="grid h-6 w-6 place-items-center rounded-full hover:bg-[color-mix(in_srgb,var(--info)_20%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <label htmlFor="editor-stack-input" className="sr-only">
                Add a tool
              </label>
              <input
                id="editor-stack-input"
                value={stackInput}
                onChange={(e) => setStackInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addStack();
                  }
                }}
                placeholder="Add a tool…"
                className="min-w-0 flex-1 rounded-[var(--radius-sm)] border px-3 py-2 text-[12.5px] outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]"
                style={inputStyle}
              />
              <Button size="sm" variant="secondary" onClick={addStack}>
                Add
              </Button>
            </div>
          </div>

          <div className="my-5 h-px" style={{ background: 'var(--border)' }} />

          {/* Links */}
          <h3
            className="mb-3 text-[13px] font-bold uppercase tracking-wider"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-faint)' }}
          >
            Links
          </h3>
          <div className="mb-5">
            <label htmlFor="editor-link-repo" className={labelClass} style={{ color: 'var(--text)' }}>
              Repo
            </label>
            <input
              id="editor-link-repo"
              type="url"
              inputMode="url"
              value={draft.links.repo}
              onChange={(e) => patchLinks({ repo: e.target.value })}
              onBlur={onFieldBlur}
              placeholder="https://…"
              className={monoInputClass}
              style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
            />
          </div>
          <div className="mb-5">
            <label htmlFor="editor-link-live" className={labelClass} style={{ color: 'var(--text)' }}>
              Live
            </label>
            <input
              id="editor-link-live"
              type="url"
              inputMode="url"
              value={draft.links.live}
              onChange={(e) => patchLinks({ live: e.target.value })}
              onBlur={onFieldBlur}
              placeholder="https://…"
              className={monoInputClass}
              style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
            />
          </div>
          <div className="mb-5">
            <label htmlFor="editor-link-docs" className={labelClass} style={{ color: 'var(--text)' }}>
              Docs
            </label>
            <input
              id="editor-link-docs"
              type="url"
              inputMode="url"
              value={draft.links.docs}
              onChange={(e) => patchLinks({ docs: e.target.value })}
              onBlur={onFieldBlur}
              placeholder="https://…"
              className={monoInputClass}
              style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
            />
          </div>

          {/* Extra links */}
          <div className="mb-5">
            <span className={labelClass} style={{ color: 'var(--text)' }}>
              Extra links
            </span>
            {draft.links.extra.length === 0 ? (
              <p className="mt-1 text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
                No extra links.
              </p>
            ) : (
              <ul className="flex list-none flex-col gap-2 p-0">
                {draft.links.extra.map((link, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <label htmlFor={`editor-extra-label-${i}`} className="sr-only">
                      Link label
                    </label>
                    <input
                      id={`editor-extra-label-${i}`}
                      value={link.label}
                      onChange={(e) => updateExtraLink(i, 'label', e.target.value)}
                      onBlur={onFieldBlur}
                      placeholder="Label, e.g. npm"
                      className="min-w-0 flex-1 rounded-[var(--radius-sm)] border px-3 py-2 text-[12.5px] outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]"
                      style={inputStyle}
                    />
                    <label htmlFor={`editor-extra-url-${i}`} className="sr-only">
                      Link URL
                    </label>
                    <input
                      id={`editor-extra-url-${i}`}
                      type="url"
                      inputMode="url"
                      value={link.url}
                      onChange={(e) => updateExtraLink(i, 'url', e.target.value)}
                      onBlur={onFieldBlur}
                      placeholder="https://…"
                      className="min-w-0 flex-1 rounded-[var(--radius-sm)] border px-3 py-2 text-[12.5px] outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]"
                      style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
                    />
                    <button
                      type="button"
                      onClick={() => removeExtraLink(i)}
                      aria-label={`Remove link ${link.label || i + 1}`}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-[var(--radius-md)] text-lg leading-none hover:bg-[var(--surface-2)] sm:h-9 sm:w-9 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2">
              <Button size="sm" variant="secondary" iconLeft={<PlusIcon aria-hidden />} onClick={addExtraLink}>
                Add link
              </Button>
            </div>
          </div>

          <div className="my-5 h-px" style={{ background: 'var(--border)' }} />

          {/* Graph placement (advanced) — collapsible */}
          <details className="mb-5">
            <summary
              className="flex h-11 cursor-pointer list-none items-center text-[13px] font-bold uppercase tracking-wider sm:h-9 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--text-faint)' }}
            >
              Graph placement (advanced)
            </summary>
            <div className="mt-3">
              <div className="mb-5">
                <label htmlFor="editor-graph-cluster" className={labelClass} style={{ color: 'var(--text)' }}>
                  Cluster
                </label>
                <input
                  id="editor-graph-cluster"
                  value={draft.graph.cluster}
                  onChange={(e) => patchGraph({ cluster: e.target.value })}
                  onBlur={onFieldBlur}
                  aria-describedby="graph-cluster-hint"
                  className={textInputClass}
                  style={inputStyle}
                />
                <p id="graph-cluster-hint" className="mt-1 text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
                  Defaults to the domain; override only to sub-group.
                </p>
              </div>
              <div className="mb-5">
                <label htmlFor="editor-graph-x" className={labelClass} style={{ color: 'var(--text)' }}>
                  X (0–1)
                </label>
                <input
                  id="editor-graph-x"
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={draft.graph.x}
                  onChange={(e) => patchGraph({ x: graphNumber(e.target.value) })}
                  onBlur={onFieldBlur}
                  aria-describedby="graph-x-hint"
                  className={textInputClass}
                  style={inputStyle}
                />
                <p id="graph-x-hint" className="mt-1 text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
                  Normalized horizontal position. Leave blank to auto-place.
                </p>
              </div>
              <div className="mb-5">
                <label htmlFor="editor-graph-y" className={labelClass} style={{ color: 'var(--text)' }}>
                  Y (0–1)
                </label>
                <input
                  id="editor-graph-y"
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={draft.graph.y}
                  onChange={(e) => patchGraph({ y: graphNumber(e.target.value) })}
                  onBlur={onFieldBlur}
                  aria-describedby="graph-y-hint"
                  className={textInputClass}
                  style={inputStyle}
                />
                <p id="graph-y-hint" className="mt-1 text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
                  Normalized vertical position.
                </p>
              </div>
              <div className="mb-1">
                <label htmlFor="editor-graph-weight" className={labelClass} style={{ color: 'var(--text)' }}>
                  Weight
                </label>
                <input
                  id="editor-graph-weight"
                  type="number"
                  min={0}
                  step={0.1}
                  value={draft.graph.weight}
                  onChange={(e) => patchGraph({ weight: graphNumber(e.target.value) })}
                  onBlur={onFieldBlur}
                  aria-describedby="graph-weight-hint"
                  className={textInputClass}
                  style={inputStyle}
                />
                <p id="graph-weight-hint" className="mt-1 text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
                  Scales node size on the graph.
                </p>
              </div>
            </div>
          </details>

          {/* Order */}
          <div className="mb-5">
            <label htmlFor="editor-order" className={labelClass} style={{ color: 'var(--text)' }}>
              Order
            </label>
            <input
              id="editor-order"
              type="number"
              step={1}
              value={draft.order}
              onChange={(e) => patch({ order: e.target.value === '' ? 0 : Number(e.target.value) })}
              onBlur={onFieldBlur}
              aria-describedby="order-hint"
              className={textInputClass}
              style={inputStyle}
            />
            <p id="order-hint" className="mt-1 text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
              Sort order within the domain (ascending).
            </p>
          </div>

          {/* Featured toggle */}
          <div className="mb-5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className={labelClass} style={{ color: 'var(--text)' }} id="featured-label">
                Featured
              </span>
              <p className="text-[11.5px]" style={{ color: 'var(--text-faint)' }} id="featured-hint">
                Show this project on the graph home.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={draft.featured}
              aria-labelledby="featured-label"
              aria-describedby="featured-hint"
              onClick={() => patch({ featured: !draft.featured })}
              className="relative inline-flex h-11 w-16 shrink-0 items-center rounded-full p-1 transition-colors sm:h-7 sm:w-12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
              style={{ background: draft.featured ? 'var(--info)' : 'var(--surface-2)' }}
            >
              <span
                aria-hidden="true"
                className="inline-block h-8 w-8 rounded-full bg-white shadow transition-transform sm:h-5 sm:w-5"
                style={{ transform: draft.featured ? 'translateX(1.25rem)' : 'translateX(0)' }}
              />
            </button>
          </div>

          <div className="my-5 h-px" style={{ background: 'var(--border)' }} />

          {/* Related posts (read-only, server-derived) */}
          <div className="mb-1">
            <h3
              className="mb-2 text-[13px] font-bold uppercase tracking-wider"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--text-faint)' }}
            >
              Related posts
            </h3>
            {draft.relatedPostSlugs.length > 0 ? (
              <>
                <ul className="flex flex-wrap gap-1.5 p-0">
                  {draft.relatedPostSlugs.map((s) => (
                    <li
                      key={s}
                      className="inline-flex items-center rounded-[var(--radius-full)] px-2.5 py-1 text-[11.5px] font-medium"
                      style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
                    >
                      {s}
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
                  Derived automatically from posts that link this project.
                </p>
              </>
            ) : (
              <p className="text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
                No posts link this project yet.
              </p>
            )}
          </div>
        </aside>
      </div>

      <ToastRegion toast={toast} onClose={clear} />
    </AdminShell>
  );
}
