import { XMLParser } from "fast-xml-parser";

/** One entry from a feed, before normalization. All strings are raw (may contain HTML). */
export interface FeedEntry {
  title?: string | undefined;
  link?: string | undefined;
  guid?: string | undefined;
  description?: string | undefined;
  published?: string | undefined;
  imageUrl?: string | undefined;
  categories: string[];
}

export interface ParsedFeed {
  format: "rss" | "atom";
  title?: string | undefined;
  entries: FeedEntry[];
}

const ARRAY_TAGS = new Set([
  "item",
  "entry",
  "link",
  "category",
  "enclosure",
  "media:content",
  "media:thumbnail",
  "media:group",
]);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
  isArray: (name) => ARRAY_TAGS.has(name),
});

type Node = Record<string, unknown>;

function text(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "string") return v || undefined;
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return text(v[0]);
  if (typeof v === "object") return text((v as Node)["#text"]);
  return undefined;
}

function attr(v: unknown, name: string): string | undefined {
  if (Array.isArray(v)) return attr(v[0], name);
  if (v && typeof v === "object") return text((v as Node)[`@_${name}`]);
  return undefined;
}

function asArray(v: unknown): unknown[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function firstImage(node: Node): string | undefined {
  for (const enc of asArray(node.enclosure)) {
    const type = attr(enc, "type") ?? "";
    const url = attr(enc, "url");
    if (url && (type.startsWith("image/") || type === "")) return url;
  }
  const groups = [node, ...asArray(node["media:group"]).filter((g) => g && typeof g === "object")];
  for (const g of groups as Node[]) {
    for (const key of ["media:content", "media:thumbnail"]) {
      for (const m of asArray(g[key])) {
        const url = attr(m, "url");
        const medium = attr(m, "medium") ?? "";
        const type = attr(m, "type") ?? "";
        if (
          url &&
          (medium === "image" || type.startsWith("image/") || (medium === "" && type === ""))
        ) {
          return url;
        }
      }
    }
  }
  return undefined;
}

function categories(node: Node): string[] {
  const out: string[] = [];
  for (const c of asArray(node.category)) {
    const t = text(c) ?? attr(c, "term") ?? attr(c, "label");
    if (t) out.push(t);
  }
  return out;
}

function rssEntry(item: Node): FeedEntry {
  const guidNode = item.guid;
  return {
    title: text(item.title),
    link:
      text(item.link) ?? (attr(guidNode, "isPermaLink") !== "false" ? text(guidNode) : undefined),
    guid: text(guidNode) ?? text(item.link),
    description: text(item["content:encoded"]) ?? text(item.description),
    published: text(item.pubDate) ?? text(item["dc:date"]),
    imageUrl: firstImage(item),
    categories: categories(item),
  };
}

function atomLink(entry: Node): string | undefined {
  const links = asArray(entry.link);
  const alternate = links.find((l) => {
    const rel = attr(l, "rel");
    return rel === undefined || rel === "alternate";
  });
  return attr(alternate ?? links[0], "href");
}

function atomEntry(entry: Node): FeedEntry {
  return {
    title: text(entry.title),
    link: atomLink(entry),
    guid: text(entry.id) ?? atomLink(entry),
    description: text(entry.summary) ?? text(entry.content),
    published: text(entry.published) ?? text(entry.updated),
    imageUrl: firstImage(entry),
    categories: categories(entry),
  };
}

export class FeedParseError extends Error {
  override name = "FeedParseError";
}

export function parseFeed(xml: string): ParsedFeed {
  let doc: Node;
  try {
    doc = parser.parse(xml) as Node;
  } catch (err) {
    throw new FeedParseError(`invalid XML: ${(err as Error).message}`);
  }

  const rss = doc.rss as Node | undefined;
  const channel = rss?.channel as Node | undefined;
  if (channel) {
    return {
      format: "rss",
      title: text(channel.title),
      entries: asArray(channel.item).map((i) => rssEntry(i as Node)),
    };
  }

  const feed = doc.feed as Node | undefined;
  if (feed) {
    return {
      format: "atom",
      title: text(feed.title),
      entries: asArray(feed.entry).map((e) => atomEntry(e as Node)),
    };
  }

  // RSS 1.0 (RDF)
  const rdf = doc["rdf:RDF"] as Node | undefined;
  if (rdf) {
    return {
      format: "rss",
      title: text((rdf.channel as Node | undefined)?.title),
      entries: asArray(rdf.item).map((i) => rssEntry(i as Node)),
    };
  }

  throw new FeedParseError("no <rss>, <feed>, or <rdf:RDF> root element");
}
