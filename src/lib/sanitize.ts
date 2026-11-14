import DOMPurify from 'dompurify';

const CONFIG = {
  ALLOWED_TAGS: ['h2', 'h3', 'p', 'br', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'u', 'a', 'img', 'blockquote', 'hr'],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt'],
  ALLOW_DATA_ATTR: false,
  ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:)/i,
};

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

/** Maqola HTML ini saqlashdan oldin ham, ko‘rsatishdan oldin ham tozalaymiz. */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, CONFIG) as unknown as string;
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function readMinutes(html: string): number {
  const words = stripHtml(html).split(' ').filter(Boolean).length;
  return Math.max(1, Math.round(words / 180));
}
