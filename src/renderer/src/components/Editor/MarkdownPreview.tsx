import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import rehypeSlug from 'rehype-slug'
import 'highlight.js/styles/github-dark.css'

interface MarkdownPreviewProps {
  content: string
  fontFamily?: string
  fontSize?: number
}

export function MarkdownPreview({ content, fontFamily, fontSize }: MarkdownPreviewProps): React.JSX.Element {
  return (
    <div className="h-full overflow-y-auto bg-zinc-950 px-8 py-8">
      <div
        className="prose prose-invert prose-zinc max-w-none"
        style={{ fontFamily, fontSize }}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight, rehypeSlug]}
          components={{
            // Links abrem externamente
            a: ({ href, children }) => (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:text-indigo-300 underline"
              >
                {children}
              </a>
            ),
            // Code blocks com estilo consistente
            pre: ({ children }) => (
              <pre className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm">
                {children}
              </pre>
            ),
            // Inline code
            code: ({ className, children, ...props }) => {
              const isBlock = className?.startsWith('language-')
              if (isBlock) {
                return <code className={className} {...props}>{children}</code>
              }
              return (
                <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-sm font-mono text-amber-300" {...props}>
                  {children}
                </code>
              )
            },
            // Blockquote
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-indigo-500/50 pl-4 text-zinc-400 italic" style={{ fontFamily, fontSize }}>
                {children}
              </blockquote>
            ),
            // Tabela
            table: ({ children }) => (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">{children}</table>
              </div>
            ),
            th: ({ children }) => (
              <th className="border border-zinc-700 bg-zinc-800 px-3 py-2 text-left font-medium text-zinc-200" style={{ fontFamily, fontSize }}>
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="border border-zinc-700 px-3 py-2 text-zinc-300" style={{ fontFamily, fontSize }}>{children}</td>
            ),
            // Checkbox (GFM task lists)
            input: ({ type, checked, ...props }) => {
              if (type === 'checkbox') {
                return (
                  <input
                    type="checkbox"
                    checked={checked}
                    readOnly
                    className="mr-2 accent-indigo-500"
                    {...props}
                  />
                )
              }
              return <input type={type} {...props} />
            },
            // Headings — font-family from prefs, size kept from Tailwind classes
            h1: ({ children }) => (
              <h1 className="mt-8 mb-4 text-3xl font-bold text-zinc-100 border-b border-zinc-800 pb-2" style={{ fontFamily }}>
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="mt-6 mb-3 text-2xl font-semibold text-zinc-100 border-b border-zinc-800 pb-1" style={{ fontFamily }}>
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="mt-5 mb-2 text-xl font-semibold text-zinc-200" style={{ fontFamily }}>{children}</h3>
            ),
            h4: ({ children }) => (
              <h4 className="mt-4 mb-2 text-lg font-medium text-zinc-200" style={{ fontFamily }}>{children}</h4>
            ),
            // Parágrafos — both font-family and font-size from prefs
            p: ({ children }) => (
              <p className="my-3 leading-7 text-zinc-300" style={{ fontFamily, fontSize }}>{children}</p>
            ),
            // Listas
            ul: ({ children }) => (
              <ul className="my-3 ml-6 list-disc space-y-1 text-zinc-300">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="my-3 ml-6 list-decimal space-y-1 text-zinc-300">{children}</ol>
            ),
            li: ({ children }) => <li className="leading-7" style={{ fontFamily, fontSize }}>{children}</li>,
            // HR
            hr: () => <hr className="my-6 border-zinc-800" />,
            // Imagens
            img: ({ src, alt }) => (
              <img src={src} alt={alt} className="my-4 max-w-full rounded-lg" />
            ),
            // Strong / em
            strong: ({ children }) => (
              <strong className="font-semibold text-zinc-100">{children}</strong>
            ),
            em: ({ children }) => <em className="text-zinc-300 italic">{children}</em>
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  )
}
