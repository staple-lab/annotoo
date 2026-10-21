import { CATEGORIES, type Annotation, type AnnotationCategory } from './types';

function categoryLabel(category: AnnotationCategory = 'note'): string {
  return CATEGORIES.find((c) => c.value === category)?.label ?? 'Note';
}

/**
 * The annotations as Markdown, for pasting into a ticket, a doc or a chat. Numbered in
 * badge order and grouped by page when they span more than one.
 */
export function annotationsToMarkdown(annotations: Annotation[], title = document.title): string {
  const byRoute = new Map<string, Annotation[]>();
  for (const a of [...annotations].sort((x, y) => x.n - y.n)) {
    const route = a.route ?? '';
    byRoute.set(route, [...(byRoute.get(route) ?? []), a]);
  }
  const grouped = byRoute.size > 1 || !byRoute.has('');
  const lines = [`# ${title.trim() || 'Annotations'}`];
  for (const [route, list] of byRoute) {
    if (grouped) lines.push('', `## ${route || 'Every page'}`);
    for (const a of list) {
      const heading = a.title?.trim() || categoryLabel(a.category);
      lines.push('', `${grouped ? '###' : '##'} ${a.n}. ${heading}`);
      const meta = a.title?.trim() ? [`*${categoryLabel(a.category)}*`] : [];
      meta.push('`' + a.anchor.selector + '`');
      if (a.anchor.textSnippet) meta.push(`“${a.anchor.textSnippet}”`);
      lines.push('', meta.join(' · '));
      if (a.body.trim()) lines.push('', a.body.trim());
      if (a.author) lines.push('', `By ${a.author.name} · ${new Date(a.createdAt).toISOString()}`);
      if (a.updatedBy && a.updatedAt) lines.push('', `Edited by ${a.updatedBy.name} · ${new Date(a.updatedAt).toISOString()}`);
      for (const reply of a.replies ?? []) {
        lines.push('', `**${reply.author.name}** · ${new Date(reply.createdAt).toISOString()}`, '', reply.body.trim());
      }
      for (const event of a.events ?? []) {
        lines.push('', `${event.type === 'resolved' ? 'Resolved' : 'Reopened'} by ${event.author.name} · ${new Date(event.createdAt).toISOString()}`);
      }
      if (a.status === 'resolved') {
        lines.push('', `**Resolved**${a.resolvedBy ? ` by ${a.resolvedBy.name}` : ''}`);
      }
    }
  }
  return lines.join('\n') + '\n';
}
