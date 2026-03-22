const https = require('https');
const http = require('http');
 
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RadioAscoliApp/1.0)' }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}
 
async function fetchNews() {
  const res = await fetchUrl('https://www.radioascoli.it/wp-json/wp/v2/posts?per_page=20&_embed=true');
  if (res.status !== 200) throw new Error('WP API ' + res.status);
  const posts = JSON.parse(res.body);
  return posts.map(p => {
    let image = '';
    try { image = p._embedded['wp:featuredmedia'][0].source_url || ''; } catch(e) {}
    const content = (p.content && p.content.rendered) || '';
    const excerpt = ((p.excerpt && p.excerpt.rendered) || '').replace(/<[^>]+>/g,'').trim();
    const title = ((p.title && p.title.rendered) || '').replace(/&amp;/g,'&').replace(/&#039;/g,"'").replace(/&quot;/g,'"');
    return { title, link: p.link||'', pubDate: p.date||'', description: excerpt.substring(0,300), content, image, categories:[] };
  });
}
 
function fetchPodcastList() {
  return [
    {title:"Il circo-lo del giovedi",description:"Temi al centro dell'arena. Conducono Alberto Vitelli, Armando Giampieri e Tonino Sofia.",image:"https://www.radioascoli.it/wp-content/uploads/2026/01/circolo-giovedi-2.jpg",link:"https://www.radioascoli.it/index.php/tutti-i-podcast/il-circo-lo-del-giovedi/",pubDate:'',content:'',categories:['Podcast']},
    {title:"Zona mista",description:"Il calcio Piceno a tutto campo. Conduce Mario La Rocca.",image:"https://www.radioascoli.it/wp-content/uploads/2025/10/pallone-in-rete-2-quadrato.jpg",link:"https://www.radioascoli.it/index.php/tutti-i-podcast/zona-mista/",pubDate:'',content:'',categories:['Podcast']},
    {title:"La tela dei temi",description:"Un convegno alla volta. Fili e nodi della societa in discussione.",image:"https://www.radioascoli.it/wp-content/uploads/2025/10/tela-temi-icona.jpg",link:"https://www.radioascoli.it/index.php/tutti-i-podcast/la-tela-dei-temi/",pubDate:'',content:'',categories:['Podcast']},
    {title:"A(p)puntino",description:"La nota del Direttore Lanfranco Norcini Pala.",image:"https://www.radioascoli.it/wp-content/uploads/2025/09/appuntino-rid.jpg",link:"https://www.radioascoli.it/index.php/tutti-i-podcast/a(p)puntino/",pubDate:'',content:'',categories:['Podcast']},
    {title:"Diario da Gaza",description:"La testimonianza settimanale dei medici dalla Clinica di Emergency a Gaza.",image:"https://www.radioascoli.it/wp-content/uploads/2025/07/gaza.jpg",link:"https://www.radioascoli.it/index.php/tutti-i-podcast/diario-da-gaza/",pubDate:'',content:'',categories:['Podcast']},
    {title:"Domenica Cuore della Comunita",description:"Riflessione sul Vangelo della domenica. A cura di Suor Sophia Gitahi.",image:"https://www.radioascoli.it/wp-content/uploads/2024/11/Podcast-Domenica-cuore-della-comunita.jpg",link:"https://www.radioascoli.it/index.php/tutti-i-podcast/domenica-cuore-della-comunita/",pubDate:'',content:'',categories:['Podcast']},
    {title:"Nel nome di Sant'Emidio",description:"Racconti sul Santo Patrono di Ascoli Piceno.",image:"https://www.radioascoli.it/wp-content/uploads/2025/07/emidio-rid.jpg",link:"https://www.radioascoli.it/index.php/tutti-i-podcast/nel-nome-di-santemidio/",pubDate:'',content:'',categories:['Podcast']}
  ];
}
 
async function fetchPodcastEpisodes(pageUrl) {
  const res = await fetchUrl(pageUrl);
  const html = res.body;
  const episodes = [];
  const h5Re = /<h5[^>]*>([\s\S]*?)<\/h5>([\s\S]*?)(?=<h5|<footer|<\/main)/gi;
  let m;
  while ((m = h5Re.exec(html)) !== null) {
    const date = m[1].replace(/<[^>]+>/g,'').trim();
    const block = m[2];
    const lm = block.match(/href="(https:\/\/soundcloud\.com\/user-186724097\/[^"]+)"[^>]*title="([^"]+)"/i);
    if (lm) episodes.push({ date, title: lm[2], soundcloudUrl: lm[1] });
  }
  if (episodes.length === 0) {
    const re2 = /href="(https:\/\/soundcloud\.com\/user-186724097\/[^"#?]+)"[^>]*title="([^"]+)"/gi;
    const seen = {};
    while ((m = re2.exec(html)) !== null) {
      if (!seen[m[1]]) { seen[m[1]]=true; episodes.push({date:'',title:m[2],soundcloudUrl:m[1]}); }
    }
  }
  return episodes;
}
 
exports.handler = async (event) => {
  const p = event.queryStringParameters || {};
  const headers = { 'Content-Type':'application/json', 'Access-Control-Allow-Origin':'*', 'Cache-Control':'public, max-age=300' };
  try {
    if (p.action === 'podcast' && p.url) {
      const episodes = await fetchPodcastEpisodes(p.url);
      return { statusCode:200, headers, body: JSON.stringify({ok:true, episodes}) };
    }
    if (p.type === 'podcast') {
      return { statusCode:200, headers, body: JSON.stringify({ok:true, items:fetchPodcastList()}) };
    }
    const items = await fetchNews();
    return { statusCode:200, headers, body: JSON.stringify({ok:true, items}) };
  } catch(err) {
    return { statusCode:500, headers, body: JSON.stringify({ok:false, error:err.message}) };
  }
};
