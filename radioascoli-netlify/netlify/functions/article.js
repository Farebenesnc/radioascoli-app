// Netlify Function: /netlify/functions/article.js
// Scarica un articolo completo da radioascoli.it e restituisce solo il contenuto principale

const https = require('https');
const http = require('http');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 11; Mobile) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,*/*',
        'Accept-Language': 'it-IT,it;q=0.9'
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function extractContent(html) {
  // Rimuovi script, style, commenti (ma NON iframe - servono per SoundCloud/YouTube)
  let clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // Cerca contenuto articolo WordPress
  const selectors = [
    /class=["'][^"']*entry-content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /class=["'][^"']*post-content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /class=["'][^"']*article-content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i
  ];

  for (const sel of selectors) {
    const m = clean.match(sel);
    if (m && m[1] && m[1].length > 200) {
      let content = m[1];
      // Rimuovi elementi superflui
      content = content
        .replace(/<(nav|header|footer|aside|form)[^>]*>[\s\S]*?<\/(nav|header|footer|aside|form)>/gi, '')
        .replace(/class=["'][^"']*(share|social|comment|related|widget|sidebar)[^"']*["']/gi, ' class="removed"')
        .replace(/<[^>]+class="removed"[^>]*>[\s\S]*?<\/[^>]+>/gi, '')
        // Rendi immagini responsive
        .replace(/<img([^>]*?)>/gi, function(_, attrs) {
          attrs = attrs.replace(/\s(width|height)=["'][^"']*["']/gi, '');
          attrs += ' style="max-width:100%;height:auto;border-radius:4px;margin:8px 0"';
          return '<img' + attrs + '>';
        })
        // Link si aprono nel browser esterno
        .replace(/<a\s/gi, '<a target="_blank" ');
      return content;
    }
  }

  return null;
}

exports.handler = async (event) => {
  const url = (event.queryStringParameters || {}).url;

  if (!url || !url.includes('radioascoli.it')) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: false, error: 'URL non valido' })
    };
  }

  try {
    const html = await fetchUrl(url);
    const content = extractContent(html);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600'
      },
      body: JSON.stringify({ ok: true, content: content || null })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};
