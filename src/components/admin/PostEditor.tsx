'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DOMAINS,
  DOMAIN_LABELS,
  SLUG_REGEX,
  SLUG_MIN,
  SLUG_MAX,
} from '@/server/models/types';
import { AdminShell } from './AdminShell';
import { Button } from './Button';
import { StatusPill } from './StatusPill';
import { RichTextToolbar, type EditorCommand } from './RichTextToolbar';
import { MarkdownPreview } from './MarkdownPreview';
import { ToastRegion, useToast } from './Toast';
import { ChevronLeftIcon, ExternalIcon } from './icons';
import { emptyDraft, type PostDraft, type ProjectOption } from './types';
import {
  createPost,
  updatePost,
  publishPost,
  unpublishPost,
  checkSlug,
  type ApiError,
} from './api';

type FieldKey = 'title' | 'slug' | 'project' | 'body';
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

function serialize(d: PostDraft): string {
  return JSON.stringify({
    title: d.title,
    slug: d.slug,
    projectSlug: d.projectSlug,
    domain: d.domain,
    tags: d.tags,
    excerpt: d.excerpt,
    body: d.body,
    coverImage: d.coverImage,
    status: d.status,
    seo: {
      metaTitle: d.seo.metaTitle ?? '',
      metaDescription: d.seo.metaDescription ?? '',
      ogImage: d.seo.ogImage ?? '',
    },
  });
}

function readingMinutes(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function PostEditor({
  user,
  projects,
  initial,
}: {
  user: { name: string };
  projects: ProjectOption[];
  initial?: PostDraft;
}) {
  const router = useRouter();
  const { toast, show, clear } = useToast();

  const [draft, setDraft] = useState<PostDraft>(() => initial ?? emptyDraft());
  const [slugTouched, setSlugTouched] = useState<boolean>(Boolean(initial?.slug));
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [showSummary, setShowSummary] = useState(false);
  const [view, setView] = useState<'write' | 'preview'>('write');
  const [active, setActive] = useState<Partial<Record<EditorCommand, boolean>>>({});
  const [tagInput, setTagInput] = useState('');

  // Refs: latest state for interval/guard closures + focus targets.
  const savedSnapshotRef = useRef<string>(serialize(initial ?? emptyDraft()));
  const submittedRef = useRef(false);
  const slugStatusRef = useRef<SlugStatus>('idle');
  const titleRef = useRef<HTMLInputElement>(null);
  const slugRef = useRef<HTMLInputElement>(null);
  const projectRef = useRef<HTMLSelectElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const dirty = savedSnapshotRef.current !== serialize(draft);

  const latest = useRef({ draft, dirty, saving, publishing });
  latest.current = { draft, dirty, saving, publishing };
  slugStatusRef.current = slugStatus;

  const readMinutes = useMemo(() => readingMinutes(draft.body), [draft.body]);

  // --- field updates ------------------------------------------------------
  const patch = useCallback((p: Partial<PostDraft>) => {
    setDraft((prev) => ({ ...prev, ...p }));
  }, []);

  function onTitleChange(v: string) {
    setDraft((prev) => {
      const next = { ...prev, title: v };
      if (!slugTouched) next.slug = slugify(v);
      return next;
    });
  }

  function onSlugChange(v: string) {
    setSlugTouched(true);
    patch({ slug: v.toLowerCase() });
  }

  function onProjectChange(slug: string) {
    const opt = projects.find((p) => p.slug === slug);
    setDraft((prev) => ({
      ...prev,
      projectSlug: slug || null,
      domain: opt?.domain ?? prev.domain,
    }));
  }

  function addTag() {
    const t = tagInput.trim();
    if (!t) return;
    setDraft((prev) =>
      prev.tags.includes(t) ? prev : { ...prev, tags: [...prev.tags, t] },
    );
    setTagInput('');
  }

  function removeTag(t: string) {
    patch({ tags: draft.tags.filter((x) => x !== t) });
  }

  // --- slug uniqueness check (debounced) ----------------------------------
  useEffect(() => {
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
        const ok = await checkSlug(slug, draft.id);
        setSlugStatus(ok ? 'available' : 'taken');
      } catch {
        setSlugStatus('idle');
      }
    }, 450);
    return () => clearTimeout(t);
  }, [draft.slug, draft.id]);

  // --- persistence --------------------------------------------------------
  const persist = useCallback(async () => {
    const d = latest.current.draft;
    const slug = (d.slug || slugify(d.title)).trim();
    const payload: PostDraft = { ...d, slug, readingTime: readingMinutes(d.body) };
    let id = d.id;
    let outSlug = slug;
    if (!id) {
      const res = await createPost(payload);
      id = res.id;
      outSlug = res.slug ?? slug;
      // Reflect the new id in the URL without a full navigation.
      window.history.replaceState(null, '', `/admin/posts/${id}`);
    } else {
      const res = await updatePost(id, payload);
      if (res?.slug) outSlug = res.slug;
    }
    const saved: PostDraft = { ...payload, id, slug: outSlug };
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
      if (!st.draft.title.trim()) {
        if (!silent) show('error', 'Add a title before saving.');
        return;
      }
      if (st.saving || st.publishing) return;
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
    [persist, show, handleErr],
  );

  const validate = useCallback((d: PostDraft): Partial<Record<FieldKey, string>> => {
    const e: Partial<Record<FieldKey, string>> = {};
    if (!d.title.trim()) e.title = 'Add a title.';
    const slug = (d.slug || '').trim();
    if (!slug) e.slug = 'Add a slug.';
    else if (!SLUG_REGEX.test(slug) || slug.length < SLUG_MIN || slug.length > SLUG_MAX)
      e.slug = 'Use lowercase letters, numbers and hyphens.';
    else if (slugStatusRef.current === 'taken') e.slug = 'That slug is already taken.';
    if (!d.projectSlug) e.project = 'Choose the project this post belongs to.';
    if (!d.body.trim()) e.body = 'Write some body content.';
    return e;
  }, []);

  function focusFirstInvalid(e: Partial<Record<FieldKey, string>>) {
    const order: [FieldKey, React.RefObject<HTMLElement | null>][] = [
      ['title', titleRef],
      ['slug', slugRef],
      ['project', projectRef],
      ['body', bodyRef],
    ];
    for (const [key, ref] of order) {
      if (e[key]) {
        ref.current?.focus();
        break;
      }
    }
  }

  const doPublish = useCallback(async () => {
    const st = latest.current;
    const e = validate(st.draft);
    if (Object.keys(e).length) {
      setErrors(e);
      setShowSummary(true);
      focusFirstInvalid(e);
      show('error', 'Fix the highlighted fields before publishing.');
      return;
    }
    setErrors({});
    setShowSummary(false);
    submittedRef.current = true;
    setPublishing(true);
    try {
      const { id, slug } = await persist();
      await publishPost(id);
      const published: PostDraft = { ...latest.current.draft, id, slug, status: 'published' };
      setDraft(published);
      savedSnapshotRef.current = serialize(published);
      setLastSavedAt(new Date());
      show('success', 'Published — your post is now live.');
      router.refresh();
    } catch (err) {
      submittedRef.current = false;
      handleErr(err, 'publish');
    } finally {
      setPublishing(false);
    }
  }, [persist, validate, show, handleErr, router]);

  const doUnpublish = useCallback(async () => {
    const id = latest.current.draft.id;
    if (!id) return;
    submittedRef.current = true;
    setPublishing(true);
    try {
      await unpublishPost(id);
      const reverted: PostDraft = { ...latest.current.draft, status: 'draft' };
      setDraft(reverted);
      savedSnapshotRef.current = serialize(reverted);
      setLastSavedAt(new Date());
      show('success', 'Reverted to draft — removed from the public site.');
      router.refresh();
    } catch (err) {
      submittedRef.current = false;
      handleErr(err, 'unpublish');
    } finally {
      setPublishing(false);
    }
  }, [show, handleErr, router]);

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
      if (st.dirty && st.draft.title.trim() && !st.saving && !st.publishing) {
        void doSave(true);
      }
    }, 20000);
    return () => clearInterval(id);
  }, [doSave]);

  function onFieldBlur() {
    const st = latest.current;
    if (st.dirty && st.draft.title.trim() && !st.saving && !st.publishing) {
      void doSave(true);
    }
  }

  function guardedGoToPosts(e: React.MouseEvent) {
    e.preventDefault();
    if (latest.current.dirty && !submittedRef.current) {
      if (!window.confirm('You have unsaved changes. Discard them?')) return;
    }
    submittedRef.current = true;
    router.push('/admin');
  }

  // --- textarea Markdown commands ----------------------------------------
  const applyToBody = useCallback(
    (start: number, end: number, text: string, selStart: number, selEnd: number) => {
      const ta = bodyRef.current;
      if (!ta) return;
      const next = ta.value.slice(0, start) + text + ta.value.slice(end);
      patch({ body: next });
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(selStart, selEnd);
      });
    },
    [patch],
  );

  function wrapInline(mark: string, placeholder: string) {
    const ta = bodyRef.current;
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
    const ta = bodyRef.current;
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
    const ta = bodyRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e } = ta;
    const pos = caretOffset != null ? s + caretOffset : s + text.length;
    applyToBody(s, e, text, pos, pos);
  }

  function runCommand(cmd: EditorCommand) {
    const ta = bodyRef.current;
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
    const ta = bodyRef.current;
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
  const isPublished = draft.status === 'published';
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

  const inputStyle = {
    background: 'var(--surface)',
    borderColor: 'var(--border-strong)',
    color: 'var(--text)',
  } as const;

  const header = (
    <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <a
          href="/admin"
          onClick={guardedGoToPosts}
          className="inline-flex items-center gap-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
          style={{ color: 'var(--text-muted)' }}
        >
          <ChevronLeftIcon aria-hidden />
          <span className="hidden sm:inline">Posts</span>
        </a>
        <StatusPill status={draft.status} size="md" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {isPublished && draft.slug && (
          <a
            href={`/blog/${draft.slug}`}
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
          variant="secondary"
          size="sm"
          loading={saving}
          onClick={() => void doSave(false)}
        >
          Save
        </Button>
        {isPublished ? (
          <Button variant="secondary" size="sm" loading={publishing} onClick={() => void doUnpublish()}>
            Unpublish
          </Button>
        ) : (
          <Button
            data-testid="editor-publish"
            variant="primary"
            size="sm"
            loading={publishing}
            onClick={() => void doPublish()}
          >
            Publish
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <AdminShell activeNav="posts" user={user} header={header} mainClassName="p-0">
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
              <strong className="font-bold">Can&apos;t publish yet.</strong> Please fix:
              <ul className="mt-1 list-disc pl-5">
                {Object.entries(errors).map(([k, v]) => (
                  <li key={k}>{v}</li>
                ))}
              </ul>
            </div>
          )}

          <label htmlFor="editor-title" className="sr-only">
            Post title
          </label>
          <input
            id="editor-title"
            data-testid="editor-title"
            ref={titleRef}
            value={draft.title}
            onChange={(e) => onTitleChange(e.target.value)}
            onBlur={onFieldBlur}
            placeholder="Post title"
            aria-invalid={Boolean(fieldError('title'))}
            className="mb-4 w-full border-0 bg-transparent p-0 text-3xl font-bold leading-tight outline-none sm:text-[38px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--ring)]"
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', color: 'var(--text)' }}
          />
          {fieldError('title') && (
            <p className="mb-3 text-sm" style={{ color: 'var(--danger)' }}>
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
              <label htmlFor="editor-body" className="sr-only">
                Post body (Markdown)
              </label>
              <textarea
                id="editor-body"
                data-testid="editor-body"
                ref={bodyRef}
                value={draft.body}
                onChange={(e) => patch({ body: e.target.value })}
                onBlur={onFieldBlur}
                onSelect={computeActive}
                onKeyUp={computeActive}
                onClick={computeActive}
                aria-invalid={Boolean(fieldError('body'))}
                placeholder="Write your post in Markdown…"
                className="min-h-[440px] w-full resize-y rounded-[var(--radius-md)] border p-5 text-sm leading-relaxed outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
                style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
              />
            </>
          ) : (
            <div
              className="min-h-[440px] w-full overflow-x-auto rounded-[var(--radius-md)] border p-5"
              style={{ background: 'var(--surface)', borderColor: 'var(--border-strong)' }}
            >
              <MarkdownPreview body={draft.body} />
            </div>
          )}
          {fieldError('body') && (
            <p className="mt-2 text-sm" style={{ color: 'var(--danger)' }}>
              {fieldError('body')}
            </p>
          )}

          <div className="mt-3 flex items-center gap-2 text-[12.5px]" style={{ color: 'var(--text-faint)' }}>
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: dirty ? 'var(--warning)' : 'var(--success)' }}
            />
            <span aria-live="polite">
              {saving ? 'Saving…' : savedLabel} · {draft.status}
            </span>
          </div>
        </div>

        {/* Settings aside */}
        <aside
          className="p-5 sm:p-6"
          aria-label="Post settings"
          style={{ background: 'var(--bg-elevated)' }}
        >
          <h2
            className="m-0 mb-4 text-[13px] font-bold uppercase tracking-wider"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-faint)' }}
          >
            Settings
          </h2>

          {/* Slug */}
          <div className="mb-5">
            <label htmlFor="editor-slug" className="mb-1.5 block text-[12.5px] font-semibold" style={{ color: 'var(--text)' }}>
              Slug
            </label>
            <input
              id="editor-slug"
              ref={slugRef}
              value={draft.slug}
              onChange={(e) => onSlugChange(e.target.value)}
              onBlur={onFieldBlur}
              aria-invalid={slugStatus === 'taken' || slugStatus === 'invalid' || Boolean(fieldError('slug'))}
              aria-describedby="slug-hint"
              className="w-full rounded-[var(--radius-sm)] border px-3 py-2.5 text-[12.5px] outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]"
              style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
            />
            <p id="slug-hint" className="mt-1 text-[11.5px]" style={{ color: slugHint.color }} aria-live="polite">
              {slugHint.text}
            </p>
            {fieldError('slug') && (
              <p className="mt-1 text-[11.5px]" style={{ color: 'var(--danger)' }}>
                {fieldError('slug')}
              </p>
            )}
            {isPublished && slugTouched && (
              <p className="mt-1 text-[11.5px]" style={{ color: 'var(--warning)' }}>
                Changing a published slug breaks existing links.
              </p>
            )}
          </div>

          {/* Project (required) */}
          <div className="mb-5">
            <label htmlFor="editor-project" className="mb-1.5 block text-[12.5px] font-semibold" style={{ color: 'var(--text)' }}>
              Project <span style={{ color: 'var(--info)' }} title="required">*</span>
            </label>
            <select
              id="editor-project"
              data-testid="editor-project"
              ref={projectRef}
              value={draft.projectSlug ?? ''}
              onChange={(e) => onProjectChange(e.target.value)}
              onBlur={onFieldBlur}
              required
              aria-invalid={Boolean(fieldError('project'))}
              className="w-full rounded-[var(--radius-sm)] border px-3 py-2.5 text-[13.5px] outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]"
              style={inputStyle}
            >
              <option value="">Select a project…</option>
              {projects.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
              Links the post back to its project (required).
            </p>
            {fieldError('project') && (
              <p className="mt-1 text-[11.5px]" style={{ color: 'var(--danger)' }}>
                {fieldError('project')}
              </p>
            )}
          </div>

          {/* Domain */}
          <div className="mb-5">
            <label htmlFor="editor-domain" className="mb-1.5 block text-[12.5px] font-semibold" style={{ color: 'var(--text)' }}>
              Domain
            </label>
            <select
              id="editor-domain"
              value={draft.domain}
              onChange={(e) => patch({ domain: e.target.value as PostDraft['domain'] })}
              className="w-full rounded-[var(--radius-sm)] border px-3 py-2.5 text-[13.5px] outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]"
              style={inputStyle}
            >
              <option value="">Auto from project</option>
              {DOMAINS.map((d) => (
                <option key={d} value={d}>
                  {DOMAIN_LABELS[d]}
                </option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div className="mb-5">
            <span className="mb-1.5 block text-[12.5px] font-semibold" style={{ color: 'var(--text)' }}>
              Tags
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {draft.tags.map((t) => (
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
                    onClick={() => removeTag(t)}
                    aria-label={`Remove tag ${t}`}
                    className="grid h-5 w-5 place-items-center rounded-full hover:bg-[color-mix(in_srgb,var(--info)_20%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <label htmlFor="editor-tag-input" className="sr-only">
                Add a tag
              </label>
              <input
                id="editor-tag-input"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Add a tag…"
                className="min-w-0 flex-1 rounded-[var(--radius-sm)] border px-3 py-2 text-[12.5px] outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]"
                style={inputStyle}
              />
              <Button size="sm" variant="secondary" onClick={addTag}>
                Add
              </Button>
            </div>
          </div>

          {/* Excerpt */}
          <div className="mb-5">
            <label htmlFor="editor-excerpt" className="mb-1.5 block text-[12.5px] font-semibold" style={{ color: 'var(--text)' }}>
              Excerpt
            </label>
            <textarea
              id="editor-excerpt"
              rows={3}
              value={draft.excerpt}
              onChange={(e) => patch({ excerpt: e.target.value })}
              onBlur={onFieldBlur}
              className="w-full resize-y rounded-[var(--radius-sm)] border px-3 py-2.5 text-[13.5px] outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]"
              style={inputStyle}
            />
          </div>

          {/* Cover image URL (media upload endpoint pending backend — see HANDOFF) */}
          <div className="mb-5">
            <label htmlFor="editor-cover" className="mb-1.5 block text-[12.5px] font-semibold" style={{ color: 'var(--text)' }}>
              Cover image URL
            </label>
            <input
              id="editor-cover"
              value={draft.coverImage}
              onChange={(e) => patch({ coverImage: e.target.value })}
              onBlur={onFieldBlur}
              placeholder="https://… (1600×900)"
              className="w-full rounded-[var(--radius-sm)] border px-3 py-2.5 text-[12.5px] outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]"
              style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
            />
          </div>

          <div className="my-5 h-px" style={{ background: 'var(--border)' }} />

          {/* SEO */}
          <div className="mb-5">
            <label htmlFor="editor-seo-title" className="mb-1.5 block text-[12.5px] font-semibold" style={{ color: 'var(--text)' }}>
              SEO title
            </label>
            <input
              id="editor-seo-title"
              value={draft.seo.metaTitle ?? ''}
              onChange={(e) => patch({ seo: { ...draft.seo, metaTitle: e.target.value } })}
              onBlur={onFieldBlur}
              className="w-full rounded-[var(--radius-sm)] border px-3 py-2.5 text-[13.5px] outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]"
              style={inputStyle}
            />
          </div>
          <div className="mb-5">
            <label htmlFor="editor-seo-desc" className="mb-1.5 block text-[12.5px] font-semibold" style={{ color: 'var(--text)' }}>
              SEO description
            </label>
            <textarea
              id="editor-seo-desc"
              rows={2}
              value={draft.seo.metaDescription ?? ''}
              onChange={(e) => patch({ seo: { ...draft.seo, metaDescription: e.target.value } })}
              onBlur={onFieldBlur}
              className="w-full resize-y rounded-[var(--radius-sm)] border px-3 py-2.5 text-[13.5px] outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]"
              style={inputStyle}
            />
          </div>

          <div
            className="flex items-center justify-between rounded-[var(--radius-sm)] px-3 py-2.5 text-[13px]"
            style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
          >
            <span>Read time</span>
            <b style={{ color: 'var(--text)' }}>
              {readMinutes} min · auto
            </b>
          </div>
        </aside>
      </div>

      <ToastRegion toast={toast} onClose={clear} />
    </AdminShell>
  );
}
