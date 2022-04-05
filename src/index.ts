import Cite, { CitationFormatOptions } from 'citation-js';

import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

export type InlineNode = {
  type: string;
  children: InlineNode[];
};

export function createSanitizer() {
  const { window } = new JSDOM('');
  const DOMPurify = createDOMPurify(window as unknown as Window);
  return {
    cleanCitationHtml(htmlStr: string) {
      return DOMPurify.sanitize(htmlStr, { ALLOWED_TAGS: ['b', 'a', 'u', 'i'] });
    },
  };
}
function cleanRef(citation: string) {
  const sanitizer = createSanitizer();
  const cleanHtml = sanitizer.cleanCitationHtml(citation).trim();
  return cleanHtml.replace(/^1\./g, '').trim();
}

const defaultOpts: CitationFormatOptions = {
  format: 'string',
  type: 'json',
  style: 'ris',
  lang: 'en-US',
};

export enum CitationJSStyles {
  'apa' = 'citation-apa',
  'vancouver' = 'citation-vancouver',
  'harvard' = 'citation-harvard1',
}

export enum InlineCite {
  'p' = 'p',
  't' = 't',
}

const defaultString: CitationFormatOptions = {
  format: 'string',
  lang: 'en-US',
  type: 'html',
  style: CitationJSStyles.apa,
};

export function getInlineCitation(c: Cite, kind: InlineCite) {
  const cite = new Cite();
  const authors = cite.set(c).data[0].author;
  const year = cite.set(c).data[0].issued?.['date-parts']?.[0]?.[0];
  const yearPart = kind === InlineCite.t ? ` (${year})` : `, ${year}`;
  if (authors.length === 1) {
    return [{ type: 'text', value: `${authors[0].family}${yearPart}` }];
  }
  if (authors.length === 2) {
    return [
      { type: 'text', value: `${authors[0].family} & ${authors[1].family}${yearPart}` },
    ];
  }
  if (authors.length > 2) {
    return [
      { type: 'text', value: `${authors[0].family} ` },
      { type: 'emphasis', value: 'et al.' },
      { type: 'text', value: `${yearPart}` },
    ];
  }
}

export type CitationRenderer = Record<
  string,
  {
    render: (style?: CitationJSStyles) => string;
    inline: (kind?: InlineCite) => InlineNode[];
    getDOI: () => string | undefined;
    cite: any;
  }
>;

export async function getCitations(bibtex: string): Promise<CitationRenderer> {
  const parse = Cite.parse.input.async.chain;
  const cite = new Cite();
  const p = await parse(bibtex);

  return Object.fromEntries(
    p.map((c: any) => {
      return [
        c.id,
        {
          inline(kind = InlineCite.p) {
            return getInlineCitation(c, kind);
          },
          render(style?: CitationJSStyles) {
            return cleanRef(
              cite
                .set(c)
                .get({ ...defaultString, style: style ?? CitationJSStyles.apa }),
            );
          },
          getDOI(): string | undefined {
            return c.DOI || undefined;
          },
          cite: c,
        },
      ];
    }),
  );
}
