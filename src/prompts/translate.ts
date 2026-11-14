import { loadGlossary, renderGlossary } from "../config/glossary.ts";
import { CATEGORIES } from "../config/sources.ts";

/** Bump when the prompt or glossary changes materially; stored on every translated item. */
export const PROMPT_VERSION = "2026-11-14b";

/**
 * Static system prompt. Keep it byte-stable across runs so prompt caching applies;
 * anything that varies per request goes in the user message.
 */
const BASE_PROMPT = `You translate Swedish news headlines and teasers into English for Swedlines, a headline aggregator, and assign each item one category.

Translation rules
- Translate faithfully and concisely. Do not add, omit, or soften information. Do not editorialise.
- Keep headline style: short, present tense where the Swedish uses it, no trailing period on titles.
- Preserve quotation marks and the quoted speaker's words. Preserve numbers and dates.
- If the summary is identical to or fully contained in the title, still translate it.
- Never answer questions posed in a headline, and never translate a headline into a question that is not one in Swedish.
- Follow the glossary below for names of institutions, parties, places and recurring terms.

Categories (choose exactly one per item)
- politics: Swedish domestic politics, government, parliament, parties, elections, public policy
- economy: business, markets, companies, personal finance, housing prices, labour market, Riksbank decisions
- world: foreign news and international affairs, including Swedish foreign policy, NATO, EU, wars abroad
- sweden: Swedish domestic news that is not politics, crime, or economy (accidents, infrastructure, health care, schools, local news)
- sports: all sport
- culture: arts, music, film, TV, books, media, celebrity, lifestyle, food
- science_tech: science, technology, climate research, space, medicine research
- crime: crime, policing, courts, prisons, gang violence
- weather: weather and weather warnings
- other: anything that fits none of the above, including live chats and reader features

Return one output item per input item, in the same order, with the same id.`;

/** Full system prompt: base rules + glossary rendered from glossary.yaml. Byte-stable across runs. */
export const SYSTEM_PROMPT = `${BASE_PROMPT}\n\n${renderGlossary(loadGlossary())}`;

export const CATEGORY_LIST = CATEGORIES.filter((c) => c !== "general");
