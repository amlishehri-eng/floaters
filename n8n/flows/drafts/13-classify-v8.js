// Stage 2, the audit layer. v8 = scoring v3 (Amli, n8n/scoring-v3-plan.md), built on Nils's v7.1:
// - fit is recomputed here from the stored points (points / their max x the v3 weight): tech_depth 40, corporate_pull 25,
//   research_or_patent 20, capital_need 15 (flow 33). germany, sector, stage, no_funding are hard checks only, 0 points.
//   Unknown or unsupported criteria count 0. Anti-signals with v3 values (at most -30), plus the register adjustment from 12.
//   The old fit (from 15) is kept once in fit_score_v2 (rollback); fit_version = 3 marks rows written by v8.
// - germany: a German base of operations is enough (HTGF: "or a German base of operations"); fail only with no German presence.
// - age: the exact register date when there is one (older than 3 years = fail), else the founding year.
// - research chairs, labs, student and competition teams, university initiatives = not_a_startup unless the evidence shows a company or a founding plan.
// - call_now needs ALL must-haves: tech_depth >= 70% with evidence, one outside validation (corporate pull, research or patent,
//   a grant, a prize or accelerator), a known technical founder, team_score_known >= 60, fit >= FIT_BAR, no failed check.
// - priority = verdict weight + quality (0.5 fit + 0.3 team_score_known + 0.2 timing) + flight-risk bonus, below 100.
// Pure code, no model calls: re-run on every lead, every run.
// Verdict order, first hit wins: htgf_portfolio (X) > not_a_lead (X) > not_a_startup (D) > too_late (C) > out_of_scope (C) > not_high_tech (C)
// > unscored (B) > needs_enrichment (B) > call_now (A) > watchlist (B).
const FIT_BAR = 55, A_TEAM_KNOWN = 60, MAX_AGE_YEARS = 3;
const HIGH_TECH_MIN = 15;        // tech_depth points (of 25) for "hard to copy" (the gate stays as it was)
const CALL_TECH_SHARE = 0.7;     // call_now: tech_depth at least 70% of its max (18 of 25)
const SECTOR_CLEARLY_NOT = 10;
const MAX_UNKNOWN_TEAM = 2;
const TEAM_MAX = { technical_founder: 30, complementary_roles: 20, worked_together: 20, deep_research: 15, earlier_startup: 15 };
const CORE_TEAM = Object.keys(TEAM_MAX);
// v3 fit weights (sum 100). Hard checks give no points.
const FIT_W = { tech_depth: 40, corporate_pull: 25, research_or_patent: 20, capital_need: 15 };
// v3 anti-signal values (by signal name); other signals keep the model's value. All together at most -30.
const ANTI_V3 = { thin_wrapper: -10, agency_income: -10, marketing_no_product: -10, too_many_projects: -5 };
const ANTI_MIN = -30;
const VERDICT_WEIGHT = { htgf_portfolio: 0, call_now: 500, needs_enrichment: 400, watchlist: 300, unscored: 250, not_high_tech: 200, too_late: 100, out_of_scope: 100, not_a_startup: 0, not_a_lead: 0 };
const TIER_OF = { htgf_portfolio: 'X', not_a_lead: 'X', not_a_startup: 'D', too_late: 'C', out_of_scope: 'C', not_high_tech: 'C', unscored: 'B', needs_enrichment: 'B', watchlist: 'B', call_now: 'A' };
const NOW = new Date(), THIS_YEAR = NOW.getFullYear();
const NOT_A_LEAD = ['investor', 'ecosystem_org', 'event_only'];
const NOT_A_STARTUP = ['agency', 'established_company', 'hobby', 'assignment', 'unreadable'];
const TYPE_FROM_LABEL = { vc_backable: 'startup_candidate', agency: 'agency', hobby: 'hobby', assignment: 'assignment', event_only: 'event_only', unreadable: 'unreadable' };
const HTGF_SECTORS = ['digital tech', 'industrial tech', 'life sciences', 'chemistry', 'climate and energy'];
const fold = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');
const DE_CITIES = /\b(munchen|munich|muenchen|garching|martinsried|planegg|unterschleissheim|freising|berlin|hamburg|koln|cologne|frankfurt|stuttgart|dusseldorf|dortmund|essen|leipzig|dresden|hannover|nurnberg|nuremberg|bremen|bonn|mannheim|karlsruhe|heidelberg|augsburg|regensburg|wurzburg|ingolstadt|aachen|darmstadt|freiburg|ulm|jena|potsdam|kiel|lubeck|mainz|wiesbaden|munster|bochum|erlangen|tubingen|konstanz|passau|rosenheim|kaiserslautern|oldenburg|saarbrucken|magdeburg|rostock|halle|chemnitz|gottingen|braunschweig|bielefeld|paderborn|siegen|ilmenau|cottbus|germany|deutschland|bayern|bavaria)\b/;
const GERMAN_BASE = /(german (office|base|subsidiary|site|entity|branch)|office in germany|niederlassung|standort in deutschland|sitz in deutschland|deutsche (tochter|niederlassung)|\bgmbh\b|\bug \(haftungsbeschr)/i;
// v8: research chairs, labs, student and competition teams, university initiatives (not a company yet).
const STUDENT_TEAM = /(lehrstuhl|\bchair of\b|\binstitut(e)? (for|fur|of)\b|research (group|chair|lab|project)|forschungs(gruppe|projekt)|\blab(oratory)? at\b|student(ische)? ?(team|initiative|club|verein|projekt|project)|hochschulgruppe|\be\.\s?v\.|racing team|motorsport|hyperloop|formula student|rocketry|\bwarr\b|robocup|university (team|initiative|project)|tum [a-z]+ team)/i;
const FOUNDING_PLAN = /(\bgmbh\b|\bug\b|ausgr(u|ü)ndung|spin-?off|spinoff|exist|gr(u|ü)ndung|founding|founded|we are founding|start-?up (in gr(u|ü)ndung|founded))/i;
// v8 outside validation from text: prizes, competitions won, accelerator programmes.
const PRIZE = /(winner|won|gewinner|gewonnen|award|preis(trager|träger)?\b|prize|1st place|first place|finalist|accelerator|incubat|cohort|batch|bootcamp)/i;
const split = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean);
const obj = s => { try { const v = typeof s === 'object' && s ? s : JSON.parse(s || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } };
const arr = s => { try { const v = Array.isArray(s) ? s : JSON.parse(s || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
const check = (result, evidence, trace_ids) => ({ result, evidence, trace_ids });
// share of a criterion's max that counts: 0 when unknown, unsupported or missing
const share = c => (!c || typeof c !== 'object' || c.known === false || c.unsupported || !(Number(c.max) > 0)) ? 0 : Math.max(0, Math.min(1, (Number(c.points) || 0) / Number(c.max)));
const hasEvidence = c => !!(c && typeof c === 'object' && c.known !== false && !c.unsupported && Number(c.points) > 0);
const TOO_LATE_TEXT = /(series [a-d]\b|serie [a-d]\b|series-[a-d]\b|vc[- ]backed|venture[- ]backed|y ?combinator|\byc [swfx]\d\d\b|seed[- ]?(round|runde|finanzierung)(?:[^.\n]|\.\d){0,60}(led by|angeführt|vc|fonds|fund|ventures|capital)|(closed|abgeschlossen)(?:[^.\n]|\.\d){0,30}seed[- ]?(round|runde)(?:[^.\n]|\.\d){0,60}(vc|fonds|fund|ventures|capital))/i;
// v8.2: a round 'led by' a named fund is institutional even when an accelerator or grant is named in the same sentence
const LED_BY_FUND = /(led by|angef(ü|ue)hrt von)(?:[^.\n]|\.\d){0,40}(ventures|capital|fund|fonds|partners|\bvc\b|invest)/i;
// v8.3 (21 Nov, Amli's call): HTGF's first ticket is EUR 800k+, so a seed round under EUR 3M with a disclosed amount is a hint,
// not too late (eversyn: seed EUR 1.6M led by bmp ventures). Series A+, EUR 3M+ and seeds without an amount stay too late.
const SMALL_SEED_M = 3;
const NOT_TOO_LATE_TEXT = /(angel|seeking|suche[n]?\b|looking for|planen|planning|want to raise|pre-?seed|preseed|exist|dati|bmbf|eic\b|sprind|horizon|grant|förder|foerder|stipend|preis|award|prize|accelerator)/i;
const eurMillions = s => { const t = String(s || ''); let m = t.match(/(\d+(?:[.,]\d+)?)\s?(mio|million|millionen|mn|m)\b/i); if (m) return parseFloat(m[1].replace(',', '.'));
  m = t.match(/(\d+(?:[.,]\d+)?)\s?k\b/i); if (m) return parseFloat(m[1].replace(',', '.')) / 1000;
  m = t.match(/(€|eur|euro)\s?(\d{1,3}(?:[.,]\d{3})+)/i) || t.match(/(\d{1,3}(?:[.,]\d{3})+)\s?(€|eur|euro)/i); if (m) return Number(String(m[2] && /\d/.test(m[2]) ? m[2] : m[1]).replace(/[.,]/g, '')) / 1e6;
  return null; };
const statusFromText = s => { const t = String(s || ''); if (!t.trim()) return 'unknown'; if (TOO_LATE_TEXT.test(t)) return /series|serie/i.test(t) ? 'series_a_plus' : 'seed_vc';
  if (/angel/i.test(t)) return 'angels'; if (/pre-?seed|preseed/i.test(t)) return 'pre_seed'; if (/(suche|seeking|looking for|planen|planning|raise)/i.test(t)) return 'seeking';
  if (/(exist|dati|bmbf|eic\b|sprind|horizon|grant|förder|foerder|stipend|preis|award|prize)/i.test(t)) return 'grants'; return 'unknown'; };
const INSTITUTIONAL_HOLDER = /(gmbh\s*&\s*co\.?\s*kg|\bfonds\b|\bfund\b|capital partners|venture capital|\b(htgf|high-tech gr(ü|ue)nderfonds|bayern kapital|earlybird|speedinvest|cherry ventures|42cap|la famiglia|project a|btov|picus|uvc partners|unternehmertum venture|vito one|holtzbrinck|tengelmann|signals venture|point nine|lakestar|hv capital|creandum|atomico|redalpine|xdeck|vsquared|planet a|extantia|amadeus capital|bosch venture|siemens|basf venture|merck|evonik venture|e\.on|ibb ventures|kfw capital|tgfs|nrw\.bank|bm-h|mbg)\b)/i;
const PERSONAL_HOLDING = /(\bUG\b|haftungsbeschr(ä|ae)nkt|\b(ventures|capital|holding|beteiligungs\w*|invest\w*)\s+gmbh\b(?!\s*&))/i;
// Already in HTGF's portfolio (data/htgf-portfolio.json, filtered by Nils in v7.1; code only, never a model).
const PORTFOLIO_NAMES = new Set(["4animalsalsterscience","6wunderkinder","7learnings","abalos","abhoptics","actitrexx","adikteev","adivo","adlatusrobotics","adtriba","advanova","aegiq","aerleum","agorainnovation","agriportance","aignostics","ailosrobotics","aipredict","airgateway","akirolabs","akribiontherapeutics","alentis","algiax","all3dp","alpineeagle","altavo","alteva","altruja","aluvation","amaltherapeutics","amedrix","angiolutions","anybill","applanga","aqimplants","argamedtech","ariososystems","asanarebel","attenio","audavis","audiocure","auditone","autarkize","autoaid","auxilius","aveliosmedical","babla","banxware","become1","beelformerlytokenizeit","beeoled","belyntic","bentekk","betterfront","bindx","biograil","biovox","bitstars","boxidsystems","brainjo","cacustomeralliance","caeliwind","cancilico","capical","cardior","carelane","casavi","ccicustomcellsitzehoe","ceregate","certivity","cevotec","chipmetrics","chromotek","cihub","clecta","cleemedical","clickworker","cloudplan","cloudsquid","codetrailsexits","coinlend","coinpanion","colipi","collimatehealth","collinorsoftware","commercetools","commsolid","comnovo","compositence","computomics","comydo","confovis","contros","conweaver","coolsemtechnologies","coramaze","coredinate","corimmun","cortec","crealytics","crocuslabs","crossvertise","cryotherapeutics","ctrls","cubical","cuciniale","cumulocity","cunesoft","customsurg","cutanos","cyclize","cytena","datarade","datavirtuality","dcubed","dearemployee","deepscenario","deepskill","delftcircuits","demosquare","depotcharge","deskly","deutschedigitalassetsdda","devicetrust","dimate","dimericon","dimpora","dntox","doctorflix","doinstruct","dotega","dracoon","draupnirbio","dresdensilicon","ebenbuild","ecopals","eddyson","eeden","emaxdigital","emergencetherapeutics","emergetech","emmasleepbettzeit","emproof","emteria","enercast","enexion","enscapetm","enshape","entelios","envelio","epixsports","erium","esgscore","esylabs","etvas","everreal","everyoneenergy","evlabio","evoxxtechnologies","ewingscom","exelonix","extoll","eyefactive","eyeobv","facellitate","factor2energy","fairfleet","famplus","fazua","fiagon","fidlock","filestage","findiq","finelegal","finleapconnect","finmarie","fionenergy","flowtify","flynex","fmcferroelectricmemorycompany","fodjan","fos4x","ftapisoftware","fundamentalpharma","futalis","geospin","gestigon","gilupi","gilytics","givve","glassdollar","glassflow","gqbiotherapeutics","grandcentrix","grandperspective","graswald","graylog","gridscale","gsbavaria","hankoio","hapila","hboxtherapies","hccarbon","heartbeatmedical","heidelbergepignostix","hemato","heparegenix","hiperscan","hofmannstirner","hornetsecurity","hprobe","hqplus","hqsquantumsimulations","humedics","hypros","i3membrane","iatros","icegateway","icolux","immersight","immunic","implandataophthalmicproducts","implisense","incappticconnect","incephalo","incirt","incontalert","industrialsolar","industrialtechnologyandwitchcraft","ineratec","inleapphotonics","innerspace","inovedis","instagrid","intelligentfluids","iodynamics","ionkraft","iplytics","iqevolution","irubis","isptech","itembase","jaipurrobotics","jenacell","jobleads","juniqe","jupus","kausable","kimeta","kinaxo","kinkaa","kiutra","kiwigrid","kontem","koumobilitygroup","kranushealth","kskdiagnostics","kumovis","kupando","laclareevision","ledexchange","lignopure","lindisbloodcare","linobiotech","lipocalyx","loewi","luphos","lymphatica","lytra","m2plabs","magazino","maketv","marbleimaging","materialsnexus","mbiomics","mbmsystems","mdtbcellmanufacturing","mediaire","medicaldecisionalliance","medineering","medovent","meinprospekt","memetis","messengerpeople","metismotion","metoda","mevaldi","middlepeak","midelphotonics","mincell","mindance","minubo","mirdetect","misterspex","mitigantformerlyknownasresility","moberries","mobilitysignage","mobilversichert","mosanna","multibind","multiphotonoptics","mycoverse","nandatechnologies","nanostruct","natifai","naturaldentalimplantsndi","nebulabiocides","neotiv","neuralconcept","nextkraftwerke","niahealth","nodeenergy","nordantechsolutions","northworkssoftware","notionsystems","novumengineering","noxon","numaferm","nuuenergy","nuuron","nyris","o11biomedical","oculai","omeicos","ondeso","outfittery","pactos","paddy","pagentai","palveera","panthernatherapeutics","pasanalytik","payever","pepperprint","performanat","personalmedsystems","phialogics","photonicshealthcare","phytonics","picolas","pidoco","pixelflo","pixelphotonics","plancraft","plasmion","plastformance","plista","plixos","pospulse","praxiseins","precomb","preomics","pressmatrix","preventicus","primogene","productvaluesystems","propertybase","protectednetworks","provecsmedical","proximafusion","pulsarphotonics","purenum","pxlvision","qnami","qphox","quentic","quobyte","qurie","rabotenergy","radioopt","raidboxes","raumfeld","raydiax","rebelle","recatalyst","redmimicry","refinedlasersystems","reflexaerospace","refoxypharma","refuelgreen","rement","replex","resolvebiosciences","resourcify","reversefashion","reviertherapeutics","rigontec","rimasys","sablono","scavengerai","scirhom","scopis","sedivention","selfapy","semasio","semknox","senodis","seqana","serenedb","seveneducationvormalssdui","sewts","sidecaps","sierrasensors","signatope","simreka","simscale","sioptica","sirionbiotech","skinuvita","skoove","skyengineai","smartbax","smarterialstechnology","smartloc","softgarden","sonormed","sopat","sovity","spacegoats","spherity","srtdbiotech","stackgini","steuerboard","stimos","stocard","sunhilltechnologies","supportwave","symphera","symtavision","synapticon","synendostherapeuthics","synoste","synthara","tacalyx","talpasolutions","tangany","taxdoo","tech11","tecregen","terrawater","textunes","threedium","threedy","tiramizoo","tixel","tolerogenixx","tomorrowthings","toolify","tqtherapeutics","tracekey","tracelessmaterials","traide","transduodenalconcepts","trimtx","trustnxt","tubulis","tweezr","twentyonesemiconductors","twogeebiotech","ubermetrics","umlautbio","uniki","urgeioversus","urotec","userlane","vacis","valispace","vanatec","variolytics","venly","veodin","veridue","verovaccines","vertama","viamon","viboo","vioso","virtualq","visiolab","visometry","visumotion","vmray","volterion","wesustain","wetransform","wiferion","windelnde","wirelane","workpath","yattasolutions","zedira","zeenergy","zentio","zimplanttechnology","zymofix"]);
const PORTFOLIO_HOSTS = new Set(["7education.com","7learnings.com","abhoptics.dk","adikteev.com","adivo.vet","adtriba.com","aegiq.com","aerleum.com","agriportance.com","aica.tech","aignostics.com","ailos-robotics.com","airgateway.com","akirolabs.com","altruja.de","aluvation.com","amaltherapeutics.com","amedrix.de","angiolutions.com","anybill.de","applanga.com","aq-implants.de","arcos.eu","argamedtech.com","attenio.de","audavis.ai","auditone.io","autarkize.com","autoaid.de","auxilius.ai","avelios.com","bab.la","banxware.com","beel.com","bentekk.com","betterfront.io","bitstars.com","brainjo.de","c-lecta.com","caeli-wind.de","cancilico.com","capical.de","cardior.de","cardiosecur.com","casavi.de","ceregate.com","chromotek.com","ci-hub.com","cleemedical.com","cloudsquid.io","co-reactive.com","codetrails.com","collimatehealth.com","collinor.de","comnovo.de","compositence.de","computomics.com","connect.finleap.com","conweaver.com","coolsemtechnologies.com","coramaze.com","coredinate.de","crealytics.com","crocuslabs.com","crossvertise.com","cryotherapeutics.com","ctrl-s.io","cubical.it","cuciniale.com","cumulocity.com","cunesoft.com","customcells.de","customer-alliance.com","cyclize.de","cytena.com","datarade.ai","datavirtuality.com","de.locr.com","dearemployee.de","deepscenario.com","deepskill.com","demosquare.ch","desk.ly","deutschedigitalassets.com","devicetrust.de","dimate.de","dntox.de","doctorflix.de","doinstruct.com","dotega.de","dracoon.com","draupnir.bio","dx-i.com","ecopals.de","eddyson.de","egym.de","eh-d.de","emerge-tech.io","emergencetx.com","emma-matratze.de","emproof.com","emteria.com","enercast.de","enexion.de","enshape.de","epignostix.com","epix-sports.com","esg-score.org","etvas.com","everreal.co","everyone-energy.de","evlabio.com","ewings.com","exelonix.com","extoll.de","eyefactive.com","factor2-energy.com","famplus.de","fazua.com","ferroelectric-memory.com","fiagon.com","fidlock.com","filestage.io","finches.ai","fion-energy.com","flowtify.de","flynex.de","fodjan.de","fos4x.de","futalis.de","genow.ai","gestigon.de","gilupi.com","givve.com","glassdollar.com","gq-biotx.com","grandcentrix.net","grandperspective.de","graswald3d.com","gravit.io","graylog.org","gridscale.io","hanko.io","hapila.de","hbox-therapies.com","hc-carbon.com","heartbeat-med.de","hema.to","hiperscan.com","hornetsecurity.com","hprobe.com","hqplus.de","humedics.de","hypros.de","i-atros.com","i3membrane.de","ico-lux.de","immersight.com","implandata.com","implisense.com","incapptic.com","incephalo.com","industrial-technology-and-witchcraft.com","ineratec.de","instagrid.co","iq-evolution.com","itembase.com","jaipurrobotics.com","jenacell.com","jobleads.com","juniqe.com","jupus.de","kausable.ai","kimeta.de","kiwigrid.com","kontext.security","koumobility.com","kranushealth.com","laclaree-vision.com","limata.de","lino-biotech.com","lipocalyx.de","lockboxsystem.com","loewi.com","lymphatica.ch","lytra.ai","m2p-labs.com","magazino.eu","make.tv","marble-imaging.de","materialsnexus.com","mbiomics.com","mdtbcells.com","mediaire.de","medical-chitosan.com","medical-decision-alliance.com","medineering.de","medovent.com","memetis.com","messengerpeople.com","metoda.com","middlepeakmedical.com","mindance.de","minubo.com","misterspex.de","mitigant.io","moberries.com","mobilitysignage.com","mobilversichert.de","multibind.de","multiphoton.net","nanostruct.eu","natif.ai","neotiv.com","neuralconcept.com","next-kraftwerke.de","niahealth.ai","nordantech.com","notion-systems.com","nuuenergy.com","nuuron.com","nyris.io","o11-biomedical.com","oculai.de","outfittery.de","pactos.ai","pagent.ai","pepperprint.com","phialogics.net","phytonics.tech","pidoco.com","pixel-flo.com","pixelphotonics.com","plasmion.de","preomics.com","primogene.bio","propertybase.com","protected-networks.com","provecs.com","pxl-vision.com","qnami.ch","quantumsimulations.de","quentic.de","quobyte.com","qurie.de","r3dt.com","radioopt.com","raidboxes.de","raydiax.com","rebelle.com","redmimicry.com","refined-lasers.com","refuel.green","relio.ch","rement.tech","replicatetooth.com","reverse.fashion","rimasys.com","rulebook.de","sablono.com","scavenger-ai.com","scirhom.com","scopis.com","selfapy.de","semasio.com","semknox.com","seqana.com","serenedb.com","sierrasensors.com","signatope.de","simscale.de","sirion-biotech.de","skinuvita.de","skoove.com","smartbax.de","softgarden.de","sonormed.com","spacegoats.io","spherity.com","spoks.de","stackgini.de","steuerboard.net","stimos.net","stocard.de","storybox.blog","sunhill-technologies.com","supportwave.com","symtavision.com","synapticon.com","synendos.com","synoste.com","syte.ms","tacalyx.com","talpasolutions.eu","tangany.com","tech11.com","tecregen.com","telerik.com","threedium.co.uk","threedy.io","till-tech.com","tixeltec.com","tolerogenixx.com","tomorrowthings.com","tqtherapeutics.com","traceless.eu","traide.ai","trait.club","trustnxt.com","tweezr.io","twogee-biotech.com","ubermetrics-technologies.com","uniki.de","urge.io","usetoday.io","vacis.nl","variolytics.de","venly.io","veodin.com","veridue.ai","vertama.com","viboo.io","vioso.com","virtualq.io","visiolab.io","visionlib.com","vmray.com","vogt-druck.de","volterion.com","vrey.io","wesustain.com","wiferion.com","wirelane.com","wiseneuro.com","xito.one","yara.zim-plant-technology.com","yatta.de","zedira.com","zeeg.me","zentio.io"]);
const normName = s => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\((exit|insolvent)\)/g, '').replace(/\b(gmbh|ug|ag|se|inc|ltd|haftungsbeschrankt|co|kg)\b/g, '').replace(/[^a-z0-9]+/g, '');
const hostOf = s => { const m = String(s || '').trim().match(/^(?:https?:\/\/)?([^/?#:@\s]+)/i); return m ? m[1].toLowerCase().replace(/^www\./, '') : null; };

const out = [];
for (const item of $input.all()) {
  const l = item.json;
  if (!l.lead_key) continue;
  if (String(l.verdict || '').startsWith('merged_into:')) continue;
  const ids = split(l.trace_ids);
  const lead_type = l.lead_type || TYPE_FROM_LABEL[l.label] || 'unreadable';
  const typeIds = split(l.type_trace_ids).length ? split(l.type_trace_ids) : ids;
  const type_reason = l.type_reason || l.label_reason || '';
  const fitB = obj(l.fit_breakdown), teamB = obj(l.team_breakdown), timeB = obj(l.timing_breakdown), reg = obj(l.registry_signals);
  const regChecked = !!l.registry_checked_at;
  const deep = obj(l.deep_signals);
  const deepUrl = f => f && f.url ? f.url : 'flow 17';
  // flow 35 web check: founding year and rounds, each with a source URL
  const ageChk = obj(l.age_check);
  const webFund = ageChk.institutional && ageChk.institutional.url ? ageChk.institutional : null;
  // student-team words only in the name and the one-line description (type_reason often says "not a research project");
  // a founding plan may show anywhere in the evidence
  const aboutShort = [l.name, l.what].join(' ');
  const about = [l.name, l.what, type_reason, l.quotes].join(' ');
  const elig = {};

  // 1 germany (v8: a German base of operations is enough)
  const country = (l.country || '').toUpperCase();
  const hq = fitB.germany && fitB.germany.hq_evidence ? String(fitB.germany.hq_evidence) : '';
  const germanBase = l.registered === true || DE_CITIES.test(fold(l.city)) || DE_CITIES.test(fold(hq)) || GERMAN_BASE.test(hq) || (fitB.germany && fitB.germany.known !== false && Number(fitB.germany.points) > 0);
  if (deep.hq_outside_germany && !germanBase) elig.germany = check('fail', `deep check: ${String(deep.hq_outside_germany.claim).slice(0, 140)} (${deepUrl(deep.hq_outside_germany)}), no German base found`, ['deep:' + deepUrl(deep.hq_outside_germany)]);
  else if (country && country !== 'DE' && !germanBase) elig.germany = check('fail', `country ${country}${l.city ? ', ' + l.city : ''}, no German base found`, typeIds);
  else if (country && country !== 'DE') elig.germany = check('pass', `headquarters ${country}, German base of operations${l.registered === true ? ' (German register entry)' : l.city ? ' (' + l.city + ')' : ''}`, typeIds);
  else if (deep.hq_outside_germany) elig.germany = check('pass', `German base of operations (${l.registered === true ? 'German register entry' : l.city || 'German city'}); deep check also found: ${String(deep.hq_outside_germany.claim).slice(0, 100)}`, typeIds);
  else if (country === 'DE' || DE_CITIES.test(fold(l.city))) elig.germany = check('pass', `based in ${l.city || 'Germany'}${/munchen|munich|muenchen/.test(fold(l.city)) ? ' (Munich)' : ''}`, typeIds);
  else elig.germany = check('unknown', l.city ? `city "${l.city}" not recognised as German` : 'no location in the traces', typeIds);

  // 2 sector (unchanged)
  if (HTGF_SECTORS.includes(l.sector)) elig.sector = check('pass', `sector: ${l.sector}${l.sector === 'climate and energy' ? ' (counts as industrial tech)' : ''}`, typeIds);
  else if (NOT_A_STARTUP.includes(lead_type) || NOT_A_LEAD.includes(lead_type)) elig.sector = check('fail', `sector: ${l.sector || 'none'}, ${lead_type}`, typeIds);
  else elig.sector = check('unknown', `sector: ${l.sector || 'none'}`, typeIds);

  // 3 age (v8: exact register date when there is one)
  // register date: flow 12 (handelsregister.ai) first, else the register entry flow 35 found on the web (with its URL)
  const webReg = ageChk.register && ageChk.register.registered_date && ageChk.register.url ? ageChk.register : null;
  const regAt = l.registered_at || (webReg ? webReg.registered_date : null);
  const regId = l.registered_at ? (l.register_id || 'commercial register') : webReg ? `${webReg.court} ${webReg.number}`.trim() + ', ' + webReg.url : '';
  const regDate = regAt ? new Date(regAt) : null;
  const regYears = regDate && !isNaN(regDate) ? (NOW - regDate) / (365.25 * 864e5) : null;
  const ages = [];
  if (Number.isInteger(l.founded_year)) ages.push({ year: l.founded_year, why: `founded ${l.founded_year} (from the trace)`, ids: typeIds });
  if (Number.isInteger(ageChk.founded_year)) ages.push({ year: ageChk.founded_year, why: `founded ${ageChk.founded_year} (web check: ${ageChk.founded_url})`, ids: ['web:' + ageChk.founded_url] });
  if (regDate && !isNaN(regDate)) ages.push({ year: regDate.getFullYear(), why: `registered ${String(regAt).slice(0, 10)} (${regId})`, ids: [l.registered_at ? 'registry' : 'web:' + webReg.url] });
  const age_warning = l.first_public_at && THIS_YEAR - new Date(l.first_public_at).getFullYear() > MAX_AGE_YEARS
    ? `first press ${String(l.first_public_at).slice(0, 10)} (${l.first_public_url || 'news'}) is more than ${MAX_AGE_YEARS} years ago; may be from the research or EXIST phase, check the register date` : '';
  const oldest = ages.sort((a, b) => a.year - b.year)[0];
  if (regYears !== null && regYears > MAX_AGE_YEARS) elig.stage = check('fail', `older than ${MAX_AGE_YEARS} years: registered ${String(regAt).slice(0, 10)} (${regId}), ${regYears.toFixed(1)} years ago`, [l.registered_at ? 'registry' : 'web:' + webReg.url]);
  else if (regYears === null && oldest && THIS_YEAR - oldest.year > MAX_AGE_YEARS) elig.stage = check('fail', `older than ${MAX_AGE_YEARS} years: ${oldest.why}`, oldest.ids);
  else if (['idea', 'prototype', 'pilot customers', 'revenue'].includes(l.stage)) elig.stage = check('pass', `stage: ${l.stage}${oldest ? '; ' + oldest.why : ''}`, typeIds);
  else elig.stage = check('unknown', `stage: ${l.stage || 'unknown'}${oldest ? '; ' + oldest.why : ''}`, typeIds);

  // 4 no institutional funding yet (unchanged from v7.1)
  const holders = [...(reg.investor_shareholders || []), ...(reg.personal_holdings || [])];
  const instHolders = holders.filter(x => INSTITUTIONAL_HOLDER.test(x.name) && !PERSONAL_HOLDING.test(x.name)).map(x => x.name);
  const personalHolders = holders.filter(x => !instHolders.includes(x.name)).map(x => x.name);
  const fund = fitB.funding || {};
  let funding_status = fund.status || (fund.mentioned ? statusFromText(fund.what) : 'unknown');
  if (funding_status === 'unknown' && personalHolders.length) funding_status = 'angels';
  const fundQuote = String(l.quotes || '').split('\n').find(q => TOO_LATE_TEXT.test(q) && (!NOT_TOO_LATE_TEXT.test(q) || LED_BY_FUND.test(q)));
  const lateClaim = t => TOO_LATE_TEXT.test(t) && (!NOT_TOO_LATE_TEXT.test(t) || LED_BY_FUND.test(t));
  const smallSeed = t => { const x = String(t || ''); const m = eurMillions(x); return /seed/i.test(x) && !/series|serie/i.test(x) && m != null && m < SMALL_SEED_M; };
  const deepFund = deep.funding_found && lateClaim(String(deep.funding_found.claim)) ? deep.funding_found : null;
  const smallSeedText = [deepFund && deepFund.claim, webFund && webFund.claim, fund.what].find(t => t && smallSeed(t)) || null;
  const disclosed = [fund.total_eur_m, eurMillions(fund.what), deep.funding_found ? eurMillions(deep.funding_found.claim) : null].filter(x => typeof x === 'number' && !isNaN(x));
  const total_m = disclosed.length ? Math.max(...disclosed) : null;
  let funding_evidence = fund.what ? `${String(fund.what).slice(0, 160)} (${fund.trace_id || typeIds[0] || ''})` : '';
  const co_investors = [...new Set([...(fund.co_investors || []), ...personalHolders, ...instHolders])];
  const bareSeed = funding_status === 'seed_vc' && !(fund.co_investors || []).length && total_m == null && !TOO_LATE_TEXT.test(String(fund.what || '')) && !/\b(led by|angef(ü|ue)hrt|vc|venture|fonds|fund|capital)\b/i.test(String(fund.what || ''));
  if (bareSeed) { funding_status = 'unknown'; funding_evidence = (funding_evidence ? funding_evidence + '; ' : '') + 'seed mentioned without a lead investor: check who led it'; }
  const otherLate = (funding_status === 'series_a_plus' && fund.what && !smallSeed(fund.what)) || (total_m != null && total_m >= SMALL_SEED_M) || instHolders.length
    || (deepFund && !smallSeed(deepFund.claim)) || (webFund && !smallSeed(webFund.claim));
  if (smallSeedText && !otherLate) { funding_status = 'seed_vc'; funding_evidence = `${String(smallSeedText).slice(0, 160)}`; elig.no_funding = check('pass', `seed under EUR ${SMALL_SEED_M}M: "${String(smallSeedText).slice(0, 140)}" (HTGF's first ticket is EUR 800k+; check who leads the next round)`, typeIds); }
  else if (['seed_vc', 'series_a_plus'].includes(funding_status) && fund.what) elig.no_funding = check('fail', `${funding_status}: "${String(fund.what).slice(0, 140)}"`, [fund.trace_id].filter(Boolean));
  else if (total_m != null && total_m >= 3) { funding_status = funding_status === 'unknown' ? 'seed_vc' : funding_status; elig.no_funding = check('fail', `EUR ${total_m}M disclosed (3M or more)`, typeIds); }
  else if (instHolders.length) { funding_status = 'seed_vc'; funding_evidence = `register: ${instHolders.join(', ')}`; elig.no_funding = check('fail', `register: institutional investor ${instHolders.join(', ')} ${instHolders.length > 1 ? 'are shareholders' : 'is a shareholder'}`, ['registry']); }
  else if (deepFund) { funding_status = /series|serie/i.test(deepFund.claim) ? 'series_a_plus' : 'seed_vc'; funding_evidence = `${deepFund.claim} (${deepUrl(deepFund)})`; elig.no_funding = check('fail', `deep check: ${String(deepFund.claim).slice(0, 140)} (${deepUrl(deepFund)})`, ['deep:' + deepUrl(deepFund)]); }
  else if (webFund) { funding_status = /series/i.test(webFund.claim) ? 'series_a_plus' : 'seed_vc'; funding_evidence = `${webFund.claim} (${webFund.url})`; elig.no_funding = check('fail', `web check: ${String(webFund.claim).slice(0, 140)} (${webFund.url})`, ['web:' + webFund.url]); }
  else if (fundQuote) { funding_status = statusFromText(fundQuote); funding_evidence = fundQuote.slice(0, 160); elig.no_funding = check('fail', `quote: "${fundQuote.replace(/^\[[^\]]*\]\s*/, '').slice(0, 140)}"`, typeIds); }
  else if (['angels', 'grants', 'seeking', 'pre_seed', 'none'].includes(funding_status)) elig.no_funding = check('pass', `${funding_status}${fund.what ? ': "' + String(fund.what).slice(0, 120) + '"' : ''}${personalHolders.length ? '; register: personal holdings ' + personalHolders.join(', ') : ''} (HTGF invests pre-seed and seed, with angels)`, typeIds);
  else elig.no_funding = check('unknown', `no institutional money in the traces; register ${regChecked ? (holders.length ? 'only personal holdings: ' + personalHolders.join(', ') : 'without an investor shareholder') : 'not checked yet'}`, typeIds);
  if (reg.capital_increase && reg.capital_increase.date && !instHolders.length && !elig.no_funding.result.startsWith('fail')) funding_evidence = (funding_evidence ? funding_evidence + '; ' : '') + `register: capital increase ${reg.capital_increase.date}`;

  // 5 legal entity (unchanged)
  const status = String(reg.status || '').toUpperCase();
  if (!regChecked) elig.legal_entity = check('unknown', 'register not checked yet', []);
  else if (l.registered === true && /DISSOLVED|TERMINATED|INSOLVENT/.test(status)) elig.legal_entity = check('fail', `register status ${status} (${l.register_id})`, ['registry']);
  else if (l.registered === true) elig.legal_entity = check('pass', `${l.legal_form || 'company'} ${l.register_id || ''}, registered ${l.registered_at ? String(l.registered_at).slice(0, 10) : ''}`.trim(), ['registry']);
  else if (l.registered === false) elig.legal_entity = check('unknown', 'not in the commercial register yet (normal for the earliest teams)', ['registry']);
  else elig.legal_entity = check('unknown', `register match ${reg.match ? reg.match.status : 'unclear'}`, ['registry']);

  const results = Object.values(elig).map(c => c.result);
  const failed = Object.entries(elig).filter(([, c]) => c.result === 'fail').map(([k]) => k);
  const eligible = failed.length ? 'fail' : results.includes('unknown') ? 'unknown' : 'pass';

  // v8 fit: v3 weights on the stored points. Rows read only by stage 1 (no v2 breakdown) have tech_depth and little else.
  const capital = obj(l.capital_need);
  const research = Math.max(share(fitB.patent_before_company), share(fitB.research_or_patent), 0.5 * share(teamB.spin_off_chair));
  const parts = { tech_depth: share(fitB.tech_depth), corporate_pull: share(fitB.corporate_pull), research_or_patent: research, capital_need: share(capital) };
  const fitBase = Object.entries(FIT_W).reduce((s, [k, w]) => s + w * parts[k], 0);
  const anti = arr(l.anti_signals).map(a => ({ signal: a.signal, points: ANTI_V3[a.signal] !== undefined ? ANTI_V3[a.signal] : Math.min(0, Number(a.points) || 0) }));
  const antiTotal = Math.max(ANTI_MIN, anti.reduce((s, a) => s + a.points, 0));
  const regAdj = Number((reg.score_adjustment || {}).fit) || 0;
  const fit = Math.max(0, Math.min(100, Math.round(fitBase + antiTotal + regAdj)));
  const fit_score_v2 = l.fit_version === 3 ? (l.fit_score_v2 ?? null) : (l.fit_score ?? null);   // keep the old fit once (rollback)

  // team (unchanged): unknown criteria carry 0 points, team_score_known = known points / known max
  const teamUnsup = Object.values(teamB).filter(v => v && typeof v === 'object' && v.unsupported).reduce((s, v) => s + (Number(v.points) || 0), 0);
  const team = Math.max(0, (Number(l.team_score) || 0) - teamUnsup);
  const unknownTeam = CORE_TEAM.filter(k => teamB[k] && teamB[k].known === false);
  const teamEntries = Object.entries(teamB).filter(([, v]) => v && typeof v === 'object' && 'points' in v);
  const knownMax = teamEntries.length ? teamEntries.filter(([, v]) => v.known !== false).reduce((s, [k, v]) => s + (Number(v.max) || TEAM_MAX[k] || 0), 0) : 100;
  const team_score_known = knownMax ? Math.max(0, Math.min(100, Math.round(team / knownMax * 100))) : null;
  const tech = fitB.tech_depth;
  const sectorPts = fitB.sector ? Number(fitB.sector.points) : null;
  const sectorShare = sectorPts === null ? null : sectorPts / (Number(fitB.sector.max) || 25);
  const strong = l.score_version === 2 ? ' (strong model, whole lead)' : '';
  const ev = k => `${k} (${elig[k].evidence})`;

  // v8 call_now must-haves
  const techShare = share(tech);
  const grant = hasEvidence(timeB.exist_runway) || funding_status === 'grants';
  const prize = PRIZE.test(String(l.quotes || '') + ' ' + String(l.what || '')) || split(l.sources).includes('accelerator') || hasEvidence(timeB.comeback);
  const validations = [hasEvidence(fitB.corporate_pull) && 'corporate pull', research > 0 && 'research or patent', grant && 'grant', prize && 'prize or accelerator'].filter(Boolean);
  const techFounder = hasEvidence(teamB.technical_founder);
  const missing = [];
  if (techShare < CALL_TECH_SHARE) missing.push(`tech_depth ${tech ? tech.points + '/' + tech.max : 'none'} below ${Math.round(CALL_TECH_SHARE * 100)}% with evidence`);
  if (!validations.length) missing.push('no outside validation (pilot, patent or research, grant, prize or accelerator)');
  if (!techFounder) missing.push('no known technical founder');
  if (team_score_known === null || team_score_known < A_TEAM_KNOWN) missing.push(`team ${team_score_known ?? 'unknown'} < ${A_TEAM_KNOWN} on known criteria`);
  if (fit < FIT_BAR) missing.push(`fit ${fit} < ${FIT_BAR}`);
  // v8.2 (21 Nov): TOO_LATE_TEXT reads past decimal amounts ("Seed round of €1.6 million led by bmp ventures" was missed at the '.').
  // v8.1: HTGF only invests in companies up to 3 years old, so call_now needs a known age (founding year or register date).
  // Unknown age let Vyoma (2020), AlixLabs (2019), SaxonQ (2021) and Devanthro (2018) through on 20 Nov.
  if (!oldest && regYears === null) missing.push('age unknown: no founding year or register date in the evidence');
  if (age_warning && regYears === null && !Number.isInteger(ageChk.founded_year)) missing.push('first press more than 3 years ago: check the register date');

  const htgfHolder = holders.map(x => x.name).find(n => /high-tech gr(ü|ue)nderfonds|\bhtgf\b/i.test(n));
  const inPortfolio = PORTFOLIO_NAMES.has(normName(l.name)) || PORTFOLIO_HOSTS.has(hostOf(l.website)) || !!htgfHolder;
  const studentTeam = (lead_type === 'research_project' || STUDENT_TEAM.test(aboutShort)) && !(l.registered === true || FOUNDING_PLAN.test(about));
  let verdict, verdict_reason;
  if (inPortfolio) { verdict = 'htgf_portfolio'; verdict_reason = `already in HTGF's portfolio (${htgfHolder ? 'register shareholder ' + htgfHolder : PORTFOLIO_HOSTS.has(hostOf(l.website)) ? 'website ' + hostOf(l.website) : 'name ' + l.name})`; }
  else if (NOT_A_LEAD.includes(lead_type)) { verdict = 'not_a_lead'; verdict_reason = `${lead_type}: ${type_reason}`; }
  else if (NOT_A_STARTUP.includes(lead_type)) { verdict = 'not_a_startup'; verdict_reason = `${lead_type}: ${type_reason}`; }
  else if (studentTeam) { verdict = 'not_a_startup'; verdict_reason = `research or student team, no company or founding plan in the evidence${lead_type === 'research_project' ? ' (research_project)' : ''}: ${String(l.what || type_reason).slice(0, 140)}`; }
  else if (elig.no_funding.result === 'fail' || elig.stage.result === 'fail') {
    verdict = 'too_late'; verdict_reason = ['no_funding', 'stage'].filter(k => elig[k].result === 'fail').map(ev).join('; ');
  }
  else if (elig.germany.result === 'fail' || (l.sector === 'other' && (sectorPts === null || sectorShare < SECTOR_CLEARLY_NOT / 25)) || elig.legal_entity.result === 'fail') {
    const why = [];
    if (elig.germany.result === 'fail') why.push(ev('germany'));
    if (l.sector === 'other' && (sectorPts === null || sectorShare < SECTOR_CLEARLY_NOT / 25)) why.push(`sector "other"${sectorPts !== null ? ` (${sectorPts}/${fitB.sector.max || 25}${fitB.sector.why ? ': ' + fitB.sector.why : ''})` : ''}`);
    if (elig.legal_entity.result === 'fail') why.push(ev('legal_entity'));
    verdict = 'out_of_scope'; verdict_reason = why.join('; ');
  }
  else if (!tech) { verdict = 'unscored'; verdict_reason = 'no tech_depth reading yet (read before the rubric): traces queued for a stage-1 re-read'; }
  else if (tech.known === false) { verdict = 'needs_enrichment'; verdict_reason = `tech depth unknown (thin evidence): ${tech.why || 'no product or technology description'}`; }
  else if ((tech.unsupported ? 0 : Number(tech.points)) < HIGH_TECH_MIN) { verdict = 'not_high_tech'; verdict_reason = `tech_depth ${tech.points}/25${tech.unsupported ? ' unsupported (no trace evidence), counts 0' : ''} < ${HIGH_TECH_MIN}${strong}: ${tech.why || 'no reason given'}`; }
  else if (team_score_known === null) { verdict = 'needs_enrichment'; verdict_reason = 'no team criterion known: the evidence says nothing about the founders'; }
  else if (unknownTeam.length > MAX_UNKNOWN_TEAM) { verdict = 'needs_enrichment'; verdict_reason = `${unknownTeam.length} of 5 team criteria unknown: ${unknownTeam.join(', ')}`; }
  else if (!missing.length && !failed.length) { verdict = 'call_now'; verdict_reason = `fit ${fit} >= ${FIT_BAR} (v3), team ${team_score_known} >= ${A_TEAM_KNOWN} on known criteria, tech_depth ${tech.points}/${tech.max}, validated by ${validations.join(', ')}, technical founder known${strong}`; }
  else { verdict = 'watchlist'; verdict_reason = `not yet call now: ${missing.join('; ') || 'a check failed'}${strong}`; }
  const tier = TIER_OF[verdict];
  const FLIGHT_BONUS = { high: 20, medium: 10 };
  const quality = 0.5 * fit + 0.3 * (team_score_known || 0) + 0.2 * Math.max(0, Math.min(100, Number(l.timing_score) || 0));
  const priority = (VERDICT_WEIGHT[verdict] ?? 0) + Math.min(99, Math.round(quality) + (FLIGHT_BONUS[l.flight_risk] || 0));
  const tier_reason = `${tier}: ${verdict}, ${verdict_reason}`;

  const row = {
    lead_key: l.lead_key, lead_type, type_reason, type_trace_ids: typeIds.join(', '),
    eligibility: JSON.stringify(elig), eligible, verdict, verdict_reason, team_score_known, tier, tier_reason, worth_a_call: verdict === 'call_now', priority,
    funding_status, funding_evidence, co_investors: co_investors.join(', '), age_warning,
    fit_score: fit, fit_score_v2, fit_version: 3,
  };
  const changed = ['lead_type', 'type_reason', 'type_trace_ids', 'eligibility', 'eligible', 'verdict', 'verdict_reason', 'team_score_known', 'tier', 'tier_reason', 'worth_a_call', 'priority', 'funding_status', 'funding_evidence', 'co_investors', 'age_warning', 'fit_score', 'fit_score_v2', 'fit_version'].some(k => (l[k] ?? null) !== (row[k] ?? null));
  if (changed) out.push({ json: { ...row, before: { name: l.name, tier: l.tier || null, verdict: l.verdict || null, fit: l.fit_score ?? null, team: team } } });
}
return out;
