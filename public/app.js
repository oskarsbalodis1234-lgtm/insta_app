const handleInput = document.querySelector("#handleInput");
const jsonInput = document.querySelector("#jsonInput");
const periodInput = document.querySelector("#periodInput");
const searchLabel = document.querySelector("#searchLabel");
const keywordsInput = document.querySelector("#keywordsInput");
const saveGraphButton = document.querySelector("#saveGraphButton");
const testGraphButton = document.querySelector("#testGraphButton");
const graphApiVersion = document.querySelector("#graphApiVersion");
const graphIgUserId = document.querySelector("#graphIgUserId");
const graphAccessToken = document.querySelector("#graphAccessToken");
const graphTestHandle = document.querySelector("#graphTestHandle");
const graphStatus = document.querySelector("#graphStatus");
const progressBar = document.querySelector("#progressBar");
const progressPercent = document.querySelector("#progressPercent");
const progressStatus = document.querySelector("#progressStatus");
const analysisProgress = document.querySelector("#analysisProgress");
const graphTestResult = document.querySelector("#graphTestResult");
const runButton = document.querySelector("#runButton");
const seedButton = document.querySelector("#seedButton");
const demoButton = document.querySelector("#demoButton");
const clearButton = document.querySelector("#clearButton");
const exportButton = document.querySelector("#exportButton");
const influencerList = document.querySelector("#influencerList");
const postsList = document.querySelector("#postsList");
const historyList = document.querySelector("#historyList");
const influencerViewButton = document.querySelector("#influencerViewButton");
const postsViewButton = document.querySelector("#postsViewButton");
const dashboardSection = document.querySelector("#dashboardSection");
const dedupeCount = document.querySelector("#dedupeCount");
const resultTitle = document.querySelector("#resultTitle");
const influencerTotal = document.querySelector("#influencerTotal");
const postTotal = document.querySelector("#postTotal");
const linkTotal = document.querySelector("#linkTotal");
const influencerTemplate = document.querySelector("#influencerTemplate");
const postTemplate = document.querySelector("#postTemplate");

let currentResults = [];
let currentHistory = [];
let currentView = "influencers";
let statsChart = null;

const knownAccountAliases = new Map([
  ["cristiano ronaldo", { handle: "cristiano", name: "Cristiano Ronaldo" }],
  ["cristiano", { handle: "cristiano", name: "Cristiano Ronaldo" }],
  ["ronaldo", { handle: "cristiano", name: "Cristiano Ronaldo" }],
  ["cr7", { handle: "cristiano", name: "Cristiano Ronaldo" }],
  ["lionel messi", { handle: "leomessi", name: "Lionel Messi" }],
  ["leo messi", { handle: "leomessi", name: "Lionel Messi" }],
  ["messi", { handle: "leomessi", name: "Lionel Messi" }],
  ["selena gomez", { handle: "selenagomez", name: "Selena Gomez" }],
  ["ariana grande", { handle: "arianagrande", name: "Ariana Grande" }],
  ["kylie jenner", { handle: "kyliejenner", name: "Kylie Jenner" }],
  ["dwayne johnson", { handle: "therock", name: "Dwayne Johnson" }],
  ["the rock", { handle: "therock", name: "Dwayne Johnson" }],
  ["kim kardashian", { handle: "kimkardashian", name: "Kim Kardashian" }],
  ["beyonce", { handle: "beyonce", name: "Beyonce" }],
  ["nike", { handle: "nike", name: "Nike" }]
]);

const demoInfluencers = [
  {
    handle: "nora.studio",
    followers: 125000,
    postCount: 842,
    posts: [
      {
        url: "https://instagram.com/p/nora-launch",
        date: "2026-04-18",
        caption: "Spring edit is live #beauty #skincare with @glowlab",
        collaborators: ["glowlab"],
        info: "Campaign details at https://example.com"
      },
      {
        url: "https://instagram.com/p/nora-old",
        date: "2026-03-21",
        caption: "Archived discount #makeup",
        info: "Old promo link https://example.invalid/promo"
      }
    ]
  },
  {
    handle: "marco.fit",
    followers: 58200,
    postCount: 311,
    posts: [
      {
        url: "https://instagram.com/p/marco-plan",
        date: "2026-04-30",
        caption: "New 30 day plan #fitness #wellness with @motionclub",
        collaborators: ["motionclub"],
        info: "Signup page: https://example.com/fitness"
      }
    ]
  }
];

const savedInfluencerHandles = [
  "@aventurasconpapablo",
  "@tizascerasytijeras",
  "@cuentos_para_mi_peque",
  "@rookie.teacher.ester",
  "@educarteinclusion",
  "@aflipar.boxes",
  "@pompasdivertidas",
  "@aureoeduca",
  "@aprendermedivierte",
  "@loscuentosdemerche",
  "@edukiduca",
  "@miclasedeinfantil__",
  "@mamideinfantil",
  "@docentenaccion",
  "@educarpensandoconelcorazon",
  "@loscuentos_denoor",
  "@los_recursos_de_laura",
  "@somosloquejugamos",
  "@missmaternidad",
  "@materiales.educacion.infantil",
  "@las_aventuras_de_inma",
  "@aula_mininautas",
  "@felizemprendedora",
  "@mundomofletes",
  "@caja_de_sorpresas",
  "@cuentos_de_luz",
  "@educ.ama",
  "@centre_pedagogic_educamor",
  "@aprendoconsentido_",
  "@mami_superguerreras",
  "@lanubeducativa",
  "@lamestraclara",
  "@patriciacunina",
  "@maymeraki",
  "@lamademoiselledufle",
  "@elbolsillodeunamaestra",
  "@entrehijosylibros",
  "@aprenderjugando24",
  "@maes_cribe",
  "@enlaclasedecarmela",
  "@maestrapaolapt",
  "@cerebritos_motivados",
  "@loscuentosdeaaron",
  "@susanatorrubiano",
  "@lasonrisaqueun",
  "@habitaciondealex",
  "@colomaestra",
  "@decraencra",
  "@cosquilleando.la.docencia",
  "@vitamina.musical",
  "@maestradechill",
  "@nuestromundode_tres",
  "@entrejuegosycuentos",
  "@merytxr",
  "@entrecasayelcole",
  "@lara_mamaestra",
  "@mr.egomiss",
  "@tanhya_88",
  "@doctoramaceta",
  "@curiosetea",
  "@secisan",
  "@cuentamecantame",
  "@profe_actividadsensorial",
  "@_mamademariaylogan_",
  "@actividades_escuela_infantil",
  "@miriespacioal",
  "@crecimientobebes",
  "@las_aventuras_de_julia",
  "@srta_wabisabi",
  "@barbyboure",
  "@garrapatea.musical",
  "@aurora.recursosmusicales",
  "@jugant_i_aprenent",
  "@todominimundos",
  "@la_magiadeensenarte",
  "@alecerezo93",
  "@maestranovata_",
  "@lapizarrapedagogica",
  "@maestrilladelibrillo",
  "@carmenmateo_psi",
  "@elmaterialdelmaestro",
  "@cuentosparaeducar",
  "@edumetanoia",
  "@maestraaainvisiblealea",
  "@profe.rebeca",
  "@celiasanchopsicopedagoga",
  "@love.three.mom",
  "@elbaulpedagogico",
  "@cosetesespecials",
  "@ceieltriangulo",
  "@mjcantii",
  "@tesorosbrillantes",
  "@profeyeray",
  "@vallejimmar",
  "@mitizatehipnotiza",
  "@cuentosatope",
  "@scrapterapia",
  "@maestrilloalvarillo",
  "@familiaguerrera",
  "@mamidemellis86",
  "@alba.mato.escritora",
  "@laclasedelaprofepatty",
  "@martitaolm",
  "@elauladecampanilla",
  "@manuelamanasrodriguez",
  "@maestra_paloma_experimentos",
  "@sandraflores94",
  "@opo.girl",
  "@vapororules",
  "@laulecane",
  "@mirincondesonidosypalabras",
  "@la.butxaca",
  "@profe_merche",
  "@tanyagode",
  "@miminipandi",
  "@losmimosdemaria",
  "@princesa_sandraricau",
  "@chollosparato2",
  "@mamyde_2",
  "@pepi.alemany",
  "@la_profle_licorne",
  "@llenomimaleta",
  "@maytelizondo",
  "@go_mami_go",
  "@elenais_r",
  "@villacositas8",
  "@sensory.homemade",
  "@destino.escrito.94",
  "@entrenubesespeciales",
  "@teacherinmita",
  "@superprofeadri",
  "@bookish.es",
  "@madrededosaunqueparecen10",
  "@mibauldeaprendizajes",
  "@mmaria_1608",
  "@creoenti.educa",
  "@unpocomaestro",
  "@loliylorena",
  "@educaa_lu",
  "@lasuperprofenat",
  "@chikiyilla",
  "@alcoleconsilvia",
  "@lostbetweenbooks_",
  "@lamagiadelaef",
  "@mestramim",
  "@jaume.aram",
  "@masqueunavocacion",
  "@maestra_de_al",
  "@una_mami_del_monton",
  "@maestra_andrea_infantil",
  "@jugando_en_neptuno",
  "@deinfinitasmaneras",
  "@pekewiswis",
  "@divertologia",
  "@asi_aprendo_yo",
  "@elena.alvarez.c",
  "@el_espacio_musical_de_maca",
  "@irisbernabegarcia",
  "@teachervirvir",
  "@malumecuida",
  "@luciacamba__",
  "@educaparaladiversidad",
  "@tini_y_niti_home",
  "@mi_rincon_meraki",
  "@los_aventurikis",
  "@dosjugandoencasa",
  "@mamaeducativa",
  "@plastificando_ilusiones",
  "@madre100_",
  "@paulinha.silva.perlimpimpim",
  "@educa.ludic",
  "@profesornovato92",
  "@diveraprender",
  "@123eraseunavez",
  "@liliescuela",
  "@es20ther",
  "@descubriendo.estrellas",
  "@aventuraenprimaria",
  "@elmundodenisabelt",
  "@nisabelt",
  "@ensina_corujinhas_a_ler",
  "@la_teacher_cris",
  "@pasiondemaestra",
  "@elrefugitrapella",
  "@latidodemiaula",
  "@realeetaa",
  "@el_pais_denuncajamas",
  "@becindys",
  "@melaniemirandah",
  "@allwhitemoon",
  "@deborahblanco8",
  "@marymarcasta",
  "@luciaagobernaa",
  "@maestraoficial_infantil",
  "@cazadorasdelibros34",
  "@com.amor.todososdias",
  "@educadoramiah",
  "@martarubioblog",
  "@mama_chula_3",
  "@psico_mporienta",
  "@interestela_",
  "@palodepiruleta",
  "@a_profe_inne",
  "@rebelion_docente",
  "@musiqueandoconmaria",
  "@musiquillos",
  "@elnoucami",
  "@musicaifamilia",
  "@mariaa_ys",
  "@mae.oquevamosler",
  "@carlosdnobrega",
  "@sandrinaferre29",
  "@elena_infantil",
  "@cei_elcastillomagico",
  "@_estela.cortes_",
  "@lalixatina"
];

function extractHandle(value) {
  const clean = String(value || "")
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .split(/[/?#\s,;]/)[0]
    .toLowerCase();

  return /^[a-z0-9._]{1,30}$/.test(clean) ? clean : "";
}

function extractAccountsFromLine(line) {
  const raw = String(line || "").trim();
  const explicitHandles = [...raw.matchAll(/@([a-z0-9._]{1,30})/gi)]
    .map((match) => resolveAccount(match[1]))
    .filter(Boolean);

  if (explicitHandles.length) return explicitHandles;

  const account = resolveAccount(raw);
  return account ? [account] : [];
}

function normalizeLookupText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/@/g, "")
    .replace(/([\d,.]+)\s*([km])?\s*(followers?|follower count|posts?|post count|media)/gi, "")
    .replace(/[/?#;,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveAccount(value) {
  const raw = String(value || "").trim();
  const lookup = normalizeLookupText(raw);
  const known = knownAccountAliases.get(lookup);
  if (known) {
    return {
      ...known,
      sourceName: raw,
      resolved: lookup !== known.handle
    };
  }

  const handle = extractHandle(raw);
  return handle ? { handle, name: null, sourceName: raw, resolved: false } : null;
}

function parseInfluencerLine(line) {
  const followersMatch = String(line).match(/([\d,.]+)\s*([km])?\s*(followers?|follower count)/i);
  const postsMatch = String(line).match(/([\d,.]+)\s*([km])?\s*(posts?|post count|media)/i);

  return extractAccountsFromLine(line).map((account) => ({
    handle: account.handle,
    name: account.name,
    sourceName: account.sourceName,
    resolved: account.resolved,
    followers: followersMatch ? parseNumber(`${followersMatch[1]}${followersMatch[2] || ""}`) : null,
    postCount: postsMatch ? parseNumber(`${postsMatch[1]}${postsMatch[2] || ""}`) : null
  }));
}

function getInfluencerEntries() {
  const entries = handleInput.value
    .split(/\n/)
    .flatMap(parseInfluencerLine)
    .filter(Boolean);

  const byHandle = new Map();
  for (const entry of entries) {
    const existing = byHandle.get(entry.handle) || {};
    byHandle.set(entry.handle, {
      ...existing,
      ...entry,
      name: entry.name ?? existing.name ?? null,
      sourceName: entry.sourceName ?? existing.sourceName ?? null,
      resolved: entry.resolved || existing.resolved || false,
      followers: entry.followers ?? existing.followers ?? null,
      postCount: entry.postCount ?? existing.postCount ?? null
    });
  }

  return byHandle;
}

function getHandles() {
  return [...getInfluencerEntries().keys()];
}

function getResearchInputs() {
  const fromLines = [...getInfluencerEntries().values()].map((item) => item.handle);
  const fromJson = [...parseJsonData().values()].map((item) => item.handle);
  return [...new Set([...fromLines, ...fromJson])];
}

function parseNumber(value) {
  if (typeof value === "number") return value;
  const normalized = String(value || "").toLowerCase().replace(/,/g, "").trim();
  const match = normalized.match(/^([\d.]+)\s*([km])?$/);
  if (!match) return null;
  const number = Number(match[1]);
  if (!Number.isFinite(number)) return null;
  if (match[2] === "k") return Math.round(number * 1_000);
  if (match[2] === "m") return Math.round(number * 1_000_000);
  return Math.round(number);
}

function formatNumber(value) {
  const number = parseNumber(value);
  if (number === null) return "unknown";
  return new Intl.NumberFormat().format(number);
}

function parseJsonData() {
  const raw = jsonInput.value.trim();
  if (!raw) return new Map();

  const parsed = JSON.parse(raw);
  const list = Array.isArray(parsed) ? parsed : parsed.influencers || [];
  const byHandle = new Map();

  for (const item of list) {
    const handle = extractHandle(item.handle || item.username || item.url);
    if (!handle) continue;

    byHandle.set(handle, {
      handle,
      name: item.name ?? item.fullName ?? null,
      sourceName: item.name ?? item.fullName ?? item.handle ?? item.username ?? null,
      resolved: false,
      followers: item.followers ?? item.followerCount ?? item.followersCount ?? null,
      postCount: item.postCount ?? item.postsCount ?? item.mediaCount ?? null,
      posts: Array.isArray(item.posts) ? item.posts : []
    });
  }

  return byHandle;
}

function parsePeriod(value) {
  const text = String(value || "").toLowerCase().trim();
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;
  const number = Number((text.match(/\d+/) || [])[0] || 1);

  if (text.includes("year")) return new Date(now.getTime() - number * 365 * day);
  if (text.includes("month")) return new Date(now.setMonth(now.getMonth() - number));
  if (text.includes("week")) return new Date(Date.now() - number * 7 * day);
  if (text.includes("day") || text.includes("yesterday")) return new Date(Date.now() - number * day);

  const date = new Date(text);
  if (!Number.isNaN(date.getTime())) return date;

  return new Date(Date.now() - 30 * day);
}

function extractHashtags(text) {
  return [...new Set(String(text || "").match(/#[\p{L}\p{N}_]+/gu) || [])];
}

function extractCollaborators(post) {
  const explicit = Array.isArray(post.collaborators) ? post.collaborators : [];
  const mentions = String(`${post.caption || ""} ${post.info || ""}`).match(/@[a-z0-9._]{1,30}/gi) || [];
  return [...new Set([...explicit.map((item) => `@${extractHandle(item)}`), ...mentions.map((item) => item.toLowerCase())].filter((item) => item !== "@"))];
}

function extractLinks(text) {
  const matches = String(text || "").match(/https?:\/\/[^\s)"'<]+/gi) || [];
  return matches.map((link) => link.replace(/[.,;:!?]+$/, ""));
}

function normalizePost(post) {
  const text = [post.caption, post.info, post.description].filter(Boolean).join(" ");
  const links = [...new Set([post.url, post.link, ...extractLinks(text)].filter(Boolean))];

  return {
    id: post.id || "",
    url: post.url || post.link || "",
    date: post.date || post.takenAt || post.createdAt || "",
    info: post.info || post.caption || post.description || "No post info supplied.",
    mediaType: post.mediaType || post.media_type || "",
    mediaUrl: post.mediaUrl || post.media_url || "",
    likeCount: post.likeCount ?? post.like_count ?? null,
    commentsCount: post.commentsCount ?? post.comments_count ?? null,
    hashtags: [...new Set([...(Array.isArray(post.hashtags) ? post.hashtags : []), ...extractHashtags(text)])],
    collaborators: extractCollaborators(post),
    links,
    linkResults: []
  };
}

function buildResults() {
  const data = parseJsonData();
  const lineData = getInfluencerEntries();
  const handles = [...new Set([...lineData.keys(), ...data.keys()])];
  const cutoff = parsePeriod(periodInput.value);

  return handles.map((handle) => {
    const imported = data.get(handle);
    const typed = lineData.get(handle);
    const posts = (imported?.posts || [])
      .map(normalizePost)
      .filter((post) => {
        const date = new Date(post.date);
        return !post.date || Number.isNaN(date.getTime()) || date >= cutoff;
      });

    return {
      handle,
      name: imported?.name ?? typed?.name ?? null,
      sourceName: typed?.sourceName ?? imported?.sourceName ?? null,
      resolved: typed?.resolved || false,
      followers: imported?.followers ?? typed?.followers ?? null,
      postCount: imported?.postCount ?? typed?.postCount ?? null,
      posts
    };
  });
}

async function researchInfluencers(inputs) {
  if (!inputs.length) return new Map();

  const response = await fetch("/api/research", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ influencers: inputs })
  });

  if (!response.ok) return new Map();
  const { results } = await response.json();
  return new Map((results || []).filter((item) => item.handle).map((item) => [item.handle, item]));
}

function mergeResearch(results, researchByHandle) {
  const byHandle = new Map(results.map((item) => [item.handle, item]));
  const cutoff = parsePeriod(periodInput.value);

  for (const researched of researchByHandle.values()) {
    const existing = byHandle.get(researched.handle) || {
      handle: researched.handle,
      posts: []
    };

    byHandle.set(researched.handle, {
      ...existing,
      name: researched.name ?? existing.name ?? null,
      sourceName: researched.sourceName ?? existing.sourceName ?? null,
      resolved: researched.resolved || existing.resolved || false,
      followers: researched.followers ?? existing.followers ?? null,
      followsCount: researched.followsCount ?? existing.followsCount ?? null,
      postCount: researched.postCount ?? existing.postCount ?? null,
      biography: researched.biography ?? existing.biography ?? null,
      website: researched.website ?? existing.website ?? null,
      profilePictureUrl: researched.profilePictureUrl ?? existing.profilePictureUrl ?? null,
      source: researched.source ?? existing.source ?? null,
      posts: (researched.posts?.length
        ? researched.posts.map(normalizePost).filter((post) => {
            const date = new Date(post.date);
            return !post.date || Number.isNaN(date.getTime()) || date >= cutoff;
          })
        : existing.posts) || [],
      researchedAt: researched.researchedAt,
      researchMessage: researched.message,
      researchOk: researched.ok
    });
  }

  return [...byHandle.values()];
}

async function checkLinks(results) {
  const links = [...new Set(results.flatMap((influencer) => influencer.posts.flatMap((post) => post.links)))];
  if (!links.length) return new Map();

  const response = await fetch("/api/check-links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ links })
  });

  if (!response.ok) throw new Error("Link checker failed.");
  const { results: checkedLinks } = await response.json();
  return new Map(checkedLinks.map((item) => [item.url, item]));
}

function addTag(container, text) {
  const tag = document.createElement("span");
  tag.className = "tag";
  tag.textContent = text;
  container.append(tag);
}

function highlightKeywords(text, keywords) {
  if (!keywords || !keywords.length || !text) return text;
  let highlighted = text;
  keywords.forEach(kw => {
    const trimmed = kw.trim();
    if (!trimmed) return;
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    highlighted = highlighted.replace(regex, '<mark>$1</mark>');
  });
  return highlighted;
}

function renderPostCard(post, influencer) {
  const card = postTemplate.content.firstElementChild.cloneNode(true);
  const postUrl = card.querySelector(".post-url");
  postUrl.textContent = post.url || "Post without URL";
  postUrl.href = post.url || `https://instagram.com/${influencer.handle}`;
  card.querySelector(".post-date").textContent = post.date || "No date";

  const keywords = (keywordsInput?.value || "").split(',').map(s => s.trim()).filter(Boolean);
  const infoEl = card.querySelector(".post-info");
  infoEl.innerHTML = highlightKeywords(post.info, keywords);

  if (keywords.some(kw => post.info.toLowerCase().includes(kw.toLowerCase()))) {
    card.classList.add("keyword-match");
  }

  const hashtags = card.querySelector(".hashtags");
  const collaborators = card.querySelector(".collaborators");
  const linkList = card.querySelector(".link-list");

  if (post.hashtags.length) post.hashtags.forEach((tag) => addTag(hashtags, tag.startsWith("#") ? tag : `#${tag}`));
  if (post.collaborators.length) post.collaborators.forEach((name) => addTag(collaborators, name.startsWith("@") ? name : `@${name}`));

  if (post.mediaType) addTag(hashtags, post.mediaType);
  if (post.likeCount !== null) addTag(collaborators, `${formatNumber(post.likeCount)} likes`);
  if (post.commentsCount !== null) addTag(collaborators, `${formatNumber(post.commentsCount)} comments`);

  for (const linkResult of post.linkResults) {
    const item = document.createElement("span");
    item.className = `link-item ${linkResult.ok ? "good" : "bad"}`;
    item.textContent = `${linkResult.ok ? "Works" : "Old/broken"} | ${linkResult.status || "no status"} | ${linkResult.url}`;
    linkList.append(item);
  }

  if (!post.linkResults.length) {
    const item = document.createElement("span");
    item.className = "link-item";
    item.textContent = "No links found";
    linkList.append(item);
  }

  return card;
}

function renderPostsView(results) {
  postsList.className = "posts-list";
  postsList.textContent = "";

  const allPosts = results.flatMap((influencer) =>
    influencer.posts.map((post) => ({ influencer, post }))
  );

  if (!allPosts.length) {
    postsList.className = "posts-list empty-state";
    postsList.textContent = "No post data supplied for this period.";
    return;
  }

  const byWeek = new Map();
  for (const item of allPosts) {
    const key = getWeekKey(item.post.date);
    if (!byWeek.has(key)) byWeek.set(key, []);
    byWeek.get(key).push(item);
  }

  const sortedWeeks = [...byWeek.entries()].sort(([a], [b]) => b.localeCompare(a));
  for (const [weekKey, posts] of sortedWeeks) {
    const section = document.createElement("section");
    section.className = "week-section";

    const heading = document.createElement("h3");
    heading.textContent = weekKey === "No date" ? "No date" : `Week of ${weekKey}`;
    section.append(heading);

    posts
      .sort((a, b) => String(b.post.date || "").localeCompare(String(a.post.date || "")))
      .forEach(({ influencer, post }) => {
        const card = renderPostCard(post, influencer);
        const owner = document.createElement("div");
        owner.className = "post-owner";
        owner.innerHTML = `<strong>@${influencer.handle}</strong> &middot; ${post.date || "No date"}`;
        card.prepend(owner);
        section.append(card);
      });

    postsList.append(section);
  }
}

function getWeekKey(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "No date";
  const day = date.getDay() || 7;
  const monday = new Date(date);
  monday.setDate(date.getDate() - day + 1);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

function updateDashboard(results) {
  const validResults = results.filter(r => r.followers > 0);
  if (!validResults.length || !window.Chart) {
    dashboardSection?.classList.add("hidden");
    return;
  }
  dashboardSection?.classList.remove("hidden");
  const ctx = document.getElementById('statsChart').getContext('2d');
  
  if (statsChart) statsChart.destroy();

  const labels = validResults.map(r => `@${r.handle}`);
  const data = validResults.map(r => r.followers);

  statsChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Followers',
        data: data,
        backgroundColor: '#6366f1',
        borderRadius: 6,
        barThickness: 20
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { 
        y: { beginAtZero: true, grid: { color: '#334155' }, ticks: { color: '#94a3b8', font: { size: 10 } } },
        x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 10 } } }
      }
    }
  });
}

function exportToCSV() {
  if (!currentResults.length) return alert("Run an analysis first to export data.");
  const headers = ["Handle", "Name", "Followers", "Total Posts", "Source", "Timestamp"];
  const rows = currentResults.map(inf => [
    inf.handle,
    `"${inf.name || ''}"`,
    inf.followers || 0,
    inf.postCount || 0,
    inf.source || "manual",
    inf.researchedAt || new Date().toISOString()
  ]);
  const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `influencer_report_${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
}

function renderResults(results) {
  currentResults = results;
  influencerList.className = "influencer-list";
  influencerList.textContent = "";
  renderPostsView(results);
  updateDashboard(results);

  if (!results.length) {
    influencerList.className = "influencer-list empty-state";
    influencerList.textContent = "No valid Instagram handles found.";
  }

  for (const influencer of results) {
    const row = influencerTemplate.content.firstElementChild.cloneNode(true);
    const linkCount = influencer.posts.reduce((sum, post) => sum + post.links.length, 0);

    const avatar = row.querySelector(".avatar");
    if (influencer.profilePictureUrl) {
      avatar.style.backgroundImage = `url(${influencer.profilePictureUrl})`;
      avatar.style.backgroundSize = "cover";
      avatar.style.backgroundPosition = "center";
    }

    const handleLink = document.createElement("a");
    handleLink.href = `https://instagram.com/${influencer.handle}`;
    handleLink.target = "_blank";
    handleLink.rel = "noreferrer";
    handleLink.textContent = `@${influencer.handle}`;

    row.querySelector(".handle").textContent = "";
    row.querySelector(".handle").append(handleLink);
    row.querySelector(".meta").textContent = influencer.posts.length || influencer.researchMessage
      ? `${influencer.resolved ? `Resolved from "${influencer.sourceName}" | ` : ""}${influencer.source === "graph" ? "Graph API | " : ""}${influencer.researchedAt ? "Refreshed now | " : ""}Click to view posts`
      : `${influencer.resolved ? `Resolved from "${influencer.sourceName}" | ` : ""}${influencer.source === "graph" ? "Graph API | " : ""}${influencer.researchedAt ? "Refreshed now | " : ""}${influencer.researchMessage || ""}`;
    row.querySelector(".followers").textContent = formatNumber(influencer.followers);
    row.querySelector(".post-count").textContent = formatNumber(influencer.postCount);
    row.querySelector(".period-posts").textContent = influencer.posts.length;
    row.querySelector(".period-links").textContent = linkCount;

    const panel = row.querySelector(".post-panel");
    if (!influencer.posts.length) {
      panel.textContent = "No posts supplied for this period.";
      panel.classList.add("empty-state");
    }

    for (const post of influencer.posts) {
      panel.append(renderPostCard(post, influencer));
    }

    row.querySelector(".row-main").addEventListener("click", () => {
      row.classList.toggle("open");
    });

    influencerList.append(row);
  }

  const posts = results.reduce((sum, influencer) => sum + influencer.posts.length, 0);
  const links = results.reduce((sum, influencer) => sum + influencer.posts.reduce((postSum, post) => postSum + post.links.length, 0), 0);
  resultTitle.textContent = searchLabel.value.trim() || periodInput.value.trim() || "Current audit";
  influencerTotal.textContent = results.length;
  postTotal.textContent = posts;
  linkTotal.textContent = links;
  dedupeCount.textContent = `${results.length} unique`;
  setActiveView(currentView);
}

function renderHistory(history) {
  currentHistory = history;
  historyList.className = "history-list";
  historyList.textContent = "";

  if (!history.length) {
    historyList.className = "history-list empty-state";
    historyList.textContent = "No saved searches yet.";
    return;
  }

  for (const entry of history) {
    const item = document.createElement("div");
    item.className = "history-item";
    const date = new Date(entry.savedAt).toLocaleString();
    const title = entry.label || "Untitled audit";

    item.innerHTML = `
      <div class="history-meta">${date}</div>
      <div class="history-title">${title}</div>
      <div class="history-stats">${entry.results.length} influencers | ${entry.results.reduce((s, i) => s + i.posts.length, 0)} posts</div>
    `;

    item.addEventListener("click", () => {
      renderResults(entry.results);
      searchLabel.value = entry.label || "";
    });
    historyList.append(item);
  }
}

async function loadGraphConfig() {
  try {
    const response = await fetch("/api/graph-config");
    if (response.ok) {
      const config = await response.json();
      if (graphApiVersion) graphApiVersion.value = config.apiVersion || "v25.0";
      if (graphIgUserId) graphIgUserId.value = config.igUserId || "";
      if (graphAccessToken) graphAccessToken.placeholder = config.tokenPreview || "Paste new token to update";
      if (keywordsInput) keywordsInput.value = config.keywords || "";
      updateGraphStatus(config.configured);
    }
  } catch (err) { console.error("Failed to load Graph API config", err); }
}

async function saveGraphConfig() {
  const payload = { apiVersion: graphApiVersion.value, igUserId: graphIgUserId.value, accessToken: graphAccessToken.value, keywords: keywordsInput.value };
  try {
    const response = await fetch("/api/graph-config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (response.ok) {
      const config = await response.json();
      graphAccessToken.value = "";
      graphAccessToken.placeholder = config.tokenPreview || "Token saved";
      updateGraphStatus(config.configured);
      alert("Graph API settings saved locally.");
    }
  } catch (err) { alert("Failed to save Graph API settings."); }
}

function updateGraphStatus(configured) {
  if (!graphStatus) return;
  graphStatus.textContent = configured ? "On" : "Off";
  graphStatus.className = `status-pill ${configured ? "good" : "bad"}`;
}

async function testGraphConfig() {
  const handle = graphTestHandle.value.trim() || "bluebottle";
  if (graphTestResult) graphTestResult.textContent = `Testing Business Discovery for @${handle}...`;
  try {
    const response = await fetch("/api/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ influencers: [handle] })
    });
    if (response.ok) {
      const { results } = await response.json();
      const result = results[0];
      if (graphTestResult) {
        graphTestResult.innerHTML = result.ok
          ? `<span class="good">Success! Found @${result.handle} with ${formatNumber(result.followers)} followers.</span>`
          : `<span class="bad">Failed: ${result.message}</span>`;
      }
    } else { if (graphTestResult) graphTestResult.textContent = "Server error during test."; }
  } catch (err) {
    console.error("Test API Fetch Error:", err);
    if (graphTestResult) graphTestResult.textContent = "Network error during test.";
  }
}

async function runAnalysis() {
  const inputs = getResearchInputs();
  if (!inputs.length) return alert("Please enter at least one influencer handle or URL.");

  const initial = buildResults();
  const total = inputs.length;

  runButton.disabled = true;
  analysisProgress.classList.remove("hidden");
  progressBar.style.width = "0%";
  progressPercent.textContent = "0%";

  try {
    let allResearch = new Map();
    
    // Process handle-by-handle to update progress bar
    for (let i = 0; i < total; i++) {
      const handle = inputs[i];
      progressStatus.textContent = `Analyzing @${handle}...`;
      
      const batchRes = await researchInfluencers([handle]);
      for (const [h, data] of batchRes) {
        allResearch.set(h, data);
      }

      const percent = Math.round(((i + 1) / total) * 100);
      progressBar.style.width = `${percent}%`;
      progressPercent.textContent = `${percent}%`;
    }

    progressStatus.textContent = "Checking links...";
    let results = mergeResearch(initial, allResearch);

    const linkMap = await checkLinks(results);
    results = results.map(inf => ({
      ...inf,
      posts: inf.posts.map(p => ({
        ...p,
        linkResults: p.links.map(l => linkMap.get(l)).filter(Boolean)
      }))
    }));

    progressStatus.textContent = "Finalizing...";
    currentView = "influencers";
    renderResults(results);

    const resp = await fetch("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: searchLabel.value.trim() || "Current audit", results })
    });

    if (resp.ok) {
      const saved = await resp.json();
      currentHistory.unshift(saved);
      renderHistory(currentHistory.slice(0, 100));
    }

    progressStatus.textContent = "Complete";
  } catch (err) {
    console.error(err);
    progressStatus.textContent = "Failed";
  } finally {
    runButton.disabled = false;
  }
}

function init() {
  loadGraphConfig();
  fetch("/api/history")
    .then((r) => r.json())
    .then(renderHistory)
    .catch(() => renderHistory([]));

  if (runButton) runButton.addEventListener("click", runAnalysis);
  if (saveGraphButton) saveGraphButton.addEventListener("click", saveGraphConfig);
  if (testGraphButton) testGraphButton.addEventListener("click", testGraphConfig);
  if (influencerViewButton) influencerViewButton.addEventListener("click", () => setActiveView("influencers"));
  if (postsViewButton) postsViewButton.addEventListener("click", () => setActiveView("posts"));
  if (exportButton) exportButton.addEventListener("click", exportToCSV);

  if (seedButton) seedButton.addEventListener("click", () => {
    const uniqueHandles = [...new Set(savedInfluencerHandles)];
    handleInput.value = uniqueHandles.join("\n");
    handleInput.dispatchEvent(new Event("input"));
  });
  if (demoButton) demoButton.addEventListener("click", () => {
    jsonInput.value = JSON.stringify(demoInfluencers, null, 2);
    handleInput.value = "";
    runAnalysis();
  });
  if (clearButton) clearButton.addEventListener("click", () => {
    handleInput.value = "";
    jsonInput.value = "";
    renderResults([]);
  });
  if (handleInput) {
    handleInput.addEventListener("input", () => {
      const count = getHandles().length;
      dedupeCount.textContent = `${count} unique`;
    });
  }
}

function setActiveView(view) {
  currentView = view;
  document.body.setAttribute("data-view", view);

  // Toggle button active states
  influencerViewButton?.classList.toggle("active", view === "influencers");
  postsViewButton?.classList.toggle("active", view === "posts");

  // Toggle list visibility
  influencerList?.classList.toggle("hidden", view !== "influencers");
  postsList?.classList.toggle("hidden", view !== "posts");
}

init();
