const https = require('https');
const puppeteer = require('puppeteer');
const OpenAI = require('openai');

const fetchJSON = (url) =>
  new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'GSTWand/1.0' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Failed to parse news response')); }
      });
    }).on('error', reject);
  });

// @desc    Get GST / tax news (FREE — no credit deduction)
// @route   GET /api/news
// @access  Private
const getNews = async (req, res) => {
  const userQuery = req.query.q?.trim() || '';
  const apiKey = process.env.NEWSDATA_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ success: false, message: 'News service not configured.' });
  }

  const query = userQuery || 'GST India';
  const url = `https://newsdata.io/api/1/news?apikey=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(query)}&language=en`;

  try {
    const data = await fetchJSON(url);

    if (data.status !== 'success') {
      console.error('NewsData.io error:', data.message || data.results);
      return res.status(502).json({
        success: false,
        message: data.message || 'Failed to fetch news. Please try again.',
      });
    }

    const articles = (data.results || [])
      .filter((item) => item.title && item.title !== '[Removed]')
      .map((item) => ({
        title: item.title,
        description: item.description || '',
        url: item.link,
        image: item.image_url || null,
        source: item.source_id || 'Unknown',
        publishedAt: item.pubDate,
      }));

    return res.status(200).json({ success: true, articles });
  } catch (error) {
    console.error('News fetch error:', error.message);
    return res.status(500).json({ success: false, message: 'Could not fetch news. Please try again.' });
  }
};

// @desc    Scrape article and generate AI summary
// @route   POST /api/news/summarize
// @access  Private
const summarizeArticle = async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ success: false, message: 'Article URL is required.' });
  }

  let browser;
  try {
    // ── Step 1: Scrape article content ──
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-web-security'],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.setDefaultNavigationTimeout(20000);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    } catch {
      // Some sites load slowly — just extract whatever rendered
    }

    // Extract readable text — strip nav/ads/scripts
    const rawText = await page.evaluate(() => {
      const REMOVE_SELECTORS = [
        'script', 'style', 'noscript', 'nav', 'header', 'footer', 'aside',
        'iframe', 'form', '.ad', '.ads', '.advertisement', '.sidebar',
        '.menu', '.navigation', '.social-share', '.related-articles',
        '.comments', '.cookie', '[class*="popup"]', '[class*="modal"]',
        '[class*="banner"]', '[class*="newsletter"]',
      ];
      REMOVE_SELECTORS.forEach((sel) => {
        try { document.querySelectorAll(sel).forEach((el) => el.remove()); } catch (_) {}
      });

      const content =
        document.querySelector('article') ||
        document.querySelector('[class*="article-body"]') ||
        document.querySelector('[class*="article-content"]') ||
        document.querySelector('[class*="story-body"]') ||
        document.querySelector('[class*="post-content"]') ||
        document.querySelector('main') ||
        document.querySelector('[role="main"]') ||
        document.body;

      return content ? (content.innerText || content.textContent || '') : '';
    });

    await browser.close();
    browser = null;

    // Clean up whitespace
    const content = rawText
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    // ── Step 2: Validate content ──
    if (!content || content.length < 80) {
      return res.status(400).json({ success: false, message: 'Unable to extract article content.' });
    }

    const wordCount = content.split(/\s+/).length;
    if (wordCount > 5000) {
      return res.status(400).json({ success: false, message: 'Article is too large to summarize.' });
    }

    console.log(`[News Summarize] Scraped ${wordCount} words from ${url}`);

    // ── Step 3: OpenAI summarization ──
    const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are an expert analyst specializing in Indian GST, taxation, finance, and business news. ' +
            'Produce clear, structured, and insightful summaries that help CA professionals and business owners quickly understand what matters.',
        },
        {
          role: 'user',
          content: `Analyze this news article and provide a structured summary in EXACTLY this format. Use bullet points for Summary and Insights. Keep TL;DR to 2-3 sentences.

## Summary
- [Most important fact or development]
- [Key detail 2]
- [Key detail 3]
- [Additional important points as needed]

## Insights
- [Why this matters to businesses or taxpayers]
- [Impact or implication]
- [What to watch or act on]

## TL;DR
[2-3 sentence plain-language summary of the entire article]

---
Article content:
${content}`,
        },
      ],
      max_tokens: 1200,
      temperature: 0.25,
    });

    const summary = completion.choices[0]?.message?.content?.trim() || '';
    if (!summary) {
      return res.status(500).json({ success: false, message: 'Failed to generate summary. Try again.' });
    }

    console.log(`[News Summarize] Summary generated (${summary.length} chars)`);
    return res.status(200).json({ success: true, summary });

  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    console.error('[News Summarize] Error:', err.message);

    if (err.message?.includes('Navigation timeout') || err.message?.includes('net::ERR')) {
      return res.status(400).json({ success: false, message: 'Unable to fetch article content.' });
    }
    return res.status(500).json({ success: false, message: 'Failed to generate summary. Try again.' });
  }
};

module.exports = { getNews, summarizeArticle };
