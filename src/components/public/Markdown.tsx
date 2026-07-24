import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import rehypeSlug from 'rehype-slug';
import rehypeHighlight from 'rehype-highlight';

interface MarkdownProps {
  children: string;
}

/**
 * Sanitized Markdown renderer (server component). Pipeline:
 *   remark-gfm            → tables, task lists, strikethrough, autolinks
 *   rehype-sanitize       → strip any unsafe HTML FIRST (defense in depth)
 *   rehype-slug           → stable heading ids (for in-page anchors)
 *   rehype-highlight      → code syntax classes (themed in globals.css .hljs)
 *
 * Sanitize runs before slug/highlight so we sanitize the untrusted content, then
 * decorate it with trusted ids/classes. Admin preview may import this too.
 * react-markdown does not parse raw HTML by default, so the injection surface is
 * already minimal; sanitize is belt-and-braces.
 */
export function Markdown({ children }: MarkdownProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSanitize, rehypeSlug, rehypeHighlight]}
    >
      {children}
    </ReactMarkdown>
  );
}

export default Markdown;
