/**
 * VOC BUCKETING ENGINE — Mosaic Wellness Complaint Tracker
 * Based on VOC Bucketing Master Guide v2.0
 * 7 Buckets · 32 Sub-Buckets · Priority Rules
 */

// ─── BUCKET DEFINITIONS (priority order: lower = higher priority) ──────────
const BUCKET_DEFS = [
  {
    name: 'Delivery Issue',
    priority: 1,
    subBuckets: [
      {
        name: 'Not Received / Order Missing',
        patterns: [
          'not received','not recieved','never received','order not received',
          'still waiting','still pending','where is my order','where is my parcel',
          'nahi mila','kab milega','kab aayega','yet to receive','pending delivery',
          'awaiting delivery','not delivered','undelivered','nvr received',
          'nt received','not rcvd','didnt receive','didn\'t receive',
          'haven\'t received','have not received','order missing','parcel missing',
          'havent received','no delivery','not got','not gotten'
        ]
      },
      {
        name: 'Fake / False Delivery',
        patterns: [
          'marked delivered but not received','shows delivered','status delivered but not got',
          'fake delivery','false delivery','fake attempt','fake otp','otp not received',
          'delivery boy didn\'t come','nobody came','no one came','marked as delivered',
          'falsely marked','fraud delivery','cheated','marked without coming',
          'delivery agent didn\'t come','shows as delivered','status shows delivered',
          'says delivered','tracking shows delivered but','otp entered without','fake mark'
        ]
      },
      {
        name: 'Delay / Late Delivery',
        patterns: [
          'delay','delayed','late delivery','taking too long','edd crossed','edd breached',
          'promised date passed','stuck in transit','stuck at hub','no movement',
          'tracking not updating','same status for days','still pending','not dispatched',
          'slow delivery','overdue','kab aayega','bahut late','abhi tak nahi aaya',
          'late than expected','later than promised','delivery delayed','shipment delayed',
          'transit delay','expected by','was supposed to arrive','overdue','not shipped yet',
          'not dispatched yet','dispatch not done','waiting for dispatch','in transit since',
          'days since dispatch','no tracking update','same tracking','hasnt moved','hasn\'t moved'
        ]
      },
      {
        name: 'RTO / Return / Reship',
        patterns: [
          'rto','rtoed','rto\'d','return to origin','returned to origin','sent back',
          'going back','returned to warehouse','cancelled by courier','auto cancelled',
          'porter','porter request','need porter','arrange porter','reship','resend',
          'send again','redelivery','re-delivery','raised redelivery','need redelivery',
          'package returned','shipment returned','order returned','cancel redeliver',
          'reattempt delivery','delivery attempt failed','returned back'
        ]
      },
      {
        name: 'Wrong Product Received',
        patterns: [
          'wrong product','wrong item','wrong order','received different','got different',
          'incorrect product','not what i ordered','someone else\'s order','wrong flavour',
          'wrong variant','wrong size','wrong brand','mix up','swapped','switched',
          'galat product','alag product','kuch aur aaya','ordered chocolate got vanilla',
          'wrong sku','different product','different item','not the product i ordered',
          'delivered wrong','sent wrong','got wrong','received wrong product',
          'different flavor received','ordered one got another'
        ]
      },
      {
        name: 'Missing Items from Delivered Box',
        patterns: [
          'item missing','items missing','not in box','incomplete order','partial order',
          'ordered 2 got 1','ordered 3 received 2','free gift missing','freebie missing',
          'invoice missing','combo incomplete','accessory missing','not all items',
          'half order','some items missing','poora nahi mila','kam mila',
          'one item missing','something missing from box','product missing from box',
          'accessories not included','not all products','only one received','partial delivery'
        ]
      },
      {
        name: 'Near Expiry / Expired Product Received',
        patterns: [
          'near expiry','near-expiry','expiring soon','short expiry','short shelf life',
          'only 1 month expiry','2 month expiry','expired product received','already expired',
          'past expiry','expiry date passed','old batch received','old stock',
          'short dated','expiry concern','mfg date old','delivered expired',
          'expiry is very close','3 month expiry','expiry soon','expires soon',
          'close to expiry','about to expire','almost expired','manufacture date old',
          'best before passed','use by date passed'
        ]
      },
      {
        name: 'Address / Location Issue',
        patterns: [
          'wrong address','incorrect address','address issue','pincode wrong',
          'address not found','misrouted','wrong hub','wrong location',
          'delivered to neighbour','delivered to wrong person','security received',
          'address change','shifted','moved','new address','incomplete address',
          'landmark missing','address mismatch','wrong pin code','delivered to neighbor',
          'neighbour received','someone else received','wrong house','wrong flat'
        ]
      },
      {
        name: 'Courier / Delivery Executive Issue',
        patterns: [
          'delivery boy rude','delivery executive not coming','de not responding',
          'de misbehaved','courier not coming','asked extra money','bribe',
          'not answering call','phone off','unreachable','delhivery issue','ekart issue',
          'shadowfax issue','xpressbees','bluedart issue','change courier','courier rude',
          'delivery agent rude','courier misbehave','agent not picking','agent unreachable',
          'delivery person rude','courier guy','delivery boy not picking calls',
          'delivery executive rude','courier partner issue','logistics partner'
        ]
      },
      {
        name: 'Tracking Issue',
        patterns: [
          'tracking not working','tracking issue','tracking not updated','no update on tracking',
          'tracking stuck','awb not working','no tracking','status not updating',
          'same tracking status','tracking shows wrong','can\'t track','tracking not found',
          'tracking details missing','tracking link not working','tracking number invalid',
          'awb number not found','tracking page error','tracking unavailable'
        ]
      },
      {
        name: 'Empty Box Received',
        patterns: [
          'empty box','box empty','nothing inside box','no product in box','empty parcel',
          'parcel empty','empty delivery','nothing in carton','received empty',
          'blank box','empty package','box had nothing','empty shipment',
          'nothing was inside','box was empty','parcel was empty','no product received',
          'got empty box','received empty box'
        ]
      }
    ]
  },
  {
    name: 'Primary Packaging Issue',
    priority: 2,
    subBuckets: [
      {
        name: 'Bottle / Container Broken or Cracked',
        patterns: [
          'bottle broken','bottle cracked','bottle shattered','cracked bottle','broken bottle',
          'glass broken','glass cracked','jar broken','jar cracked','container broken',
          'container cracked','shattered','tube broken','tube cracked','tube burst',
          'botl toot gaya','bottle toota hua','tub broken','tub cracked',
          'product container broken','packaging broken','bottle damage','container damage',
          'broken container','cracked jar','glass bottle broken','dispenser broken'
        ]
      },
      {
        name: 'Leakage / Spillage',
        patterns: [
          'leaking','leaked','leakage','spilled','spillage','spilling','product leaked',
          'oil leaked','serum leaked','powder spilled','coming out','dripping','oozing',
          'wet product','sticky from leak','packet leaking','sachet leaking','tube leaked',
          'bottle leaking','seal leak','cap leaking','product spilled','liquid leaked',
          'lotion leaked','shampoo leaked','oil spilling','product is leaking',
          'opened to find leakage','arrived leaking','leaked in transit','messy inside box',
          'product came out','dripping product','spilt','leaky bottle','found leaking'
        ]
      },
      {
        name: 'Seal Tampered / Broken / Missing',
        patterns: [
          'seal open','seal broken','seal missing','seal damaged','seal tampered',
          'seal already open','unsealed','not sealed','seal loose','seal removed',
          'seal was open','foil seal broken','induction seal open','opened seal',
          'tampered seal','seal khula hua','seal nahi tha','no seal','without seal',
          'induction seal broken','foil broken','safety seal open','seal not intact',
          'seal was already broken','received without seal','no safety seal',
          'product not sealed','inner seal missing','seal cut','seal torn'
        ]
      },
      {
        name: 'Cap / Pump / Dropper / Applicator Damaged',
        patterns: [
          'cap broken','cap missing','cap loose','lid broken','lid missing','pump broken',
          'pump not working','pump not dispensing','pump stuck','pump jammed',
          'dropper broken','dropper cracked','spray not working','nozzle broken',
          'roll-on broken','applicator broken','pump nahi chal raha','dispenser broken',
          'pump failure','spray broken','nozzle not working','cap cracked','lid cracked',
          'pump damaged','dropper not working','pump is broken','lid is broken',
          'spray doesn\'t work','dispenser not working','roller broken','roll on broken'
        ]
      },
      {
        name: 'Label / Batch / Expiry Info Missing or Damaged',
        patterns: [
          'label missing','label torn','label damaged','label peeled','no label',
          'batch not visible','batch missing','batch number not readable','expiry not visible',
          'expiry missing','mfg date missing','date not printed','mrp missing',
          'barcode damaged','barcode missing','can\'t read label','details missing on pack',
          'label not there','no batch number','no expiry','label is damaged',
          'cannot read label','label rubbed off','label faded','batch number missing',
          'manufacturing date not visible','no manufacturing date','label falling off',
          'label came off','expiry date not visible','mfg date not printed'
        ]
      },
      {
        name: 'Already Opened / Used Product Received',
        patterns: [
          'already opened','already used','seems used','product used','level less than expected',
          'someone used this','used product received','pre-opened','not factory sealed',
          'opened pack received','tampered product','used before','half empty','half full',
          'product level low','less than full','partially used','someone has used',
          'looks used','appears used','previously opened','seal was open when opened',
          'product was used','opened product'
        ]
      },
      {
        name: 'Pouch / Packet / Sachet Torn or Damaged',
        patterns: [
          'pouch torn','pouch damaged','pouch ripped','packet torn','packet damaged',
          'packet ripped','packet cut','lole in packet','sachet torn','sachet open',
          'sachet ripped','sachet damaged','packet phata hua','pouch phata',
          'packet cut ho gaya','torn pouch','damaged packet','ripped pouch',
          'packet has hole','pouch has hole','sachet has hole','pouch punctured',
          'packet punctured','torn packaging','pack torn','bag torn'
        ]
      }
    ]
  },
  {
    name: 'Secondary Packaging Issue',
    priority: 3,
    subBuckets: [
      {
        name: 'Outer Box / Carton Damaged or Crushed',
        patterns: [
          'outer box damaged','box crushed','box dented','box torn','box broken',
          'carton damaged','carton crushed','carton dented','carton torn',
          'outer packaging damaged','rough handling','transit damage','shipping damage',
          'squashed box','smashed box','bent box','deformed carton','dibba damage',
          'carton toot gaya','delivery box damaged','shipping box damaged',
          'outer carton crushed','box badly damaged','packaging was damaged',
          'box arrived damaged','damaged box','crushed carton','shipment box damaged'
        ]
      },
      {
        name: 'Wet / Soaked Outer Packaging',
        patterns: [
          'wet box','soaked box','damp box','wet carton','soaked carton','moist box',
          'wet outer packaging','rain damaged box',' humidity damage','box soaked',
          'water damaged outer box','outer box wet','box was wet','box is damp',
          'wet packaging','damp packaging','moisture damaged box'
        ]
      },
      {
        name: 'Box Opened / Tampered in Transit',
        patterns: [
          'box open','tape removed','tape open','tampered box','box tampered',
          'opened box','carton open','unsealed box','packing open',
          'box was already open',�someone opened the box','outer box tampered',
          'outer packaging open','delivery box open','box arrived open','package tampered',
          'box seal removed','packaging tampered','outer carton open','shipping box open'
        ]
      }
    ]
  },
  {
    name: 'Product Quality Issue',
    priority: 4,
    subBuckets: [
      {
        name: 'Bad Taste / Smell / Off Odour',
        patterns: [
          'bad taste','weird taste','strange taste','off taste','bitter taste',
          'chemical taste','plastic taste','metallic taste','bad smell','foul smell',
          'rancid smell','rancid','stinking','sour smell','musty smell','smell changed',
          'taste changed','taste is horrible','very bad smell','kharab smell',
          'badbu','taste kharab','smell ajeeb','unpleasant smell','unpleasant taste',
          'odd smell','odd taste','unusual smell','unusual taste','smell is off',
          'taste is off','horrible smell','pungent smell','fermented smell',
          'spoilt smell','smell is bad','tastes bad','smells bad','awful taste',
          'awful smell','smells weird','tastes weird','smells strange','tastes strange',
          'plastic smell','chemical smell','off odour','off smell'
        ]
      },
      {
        name: 'Texture / Consistency Issue',
        patterns: [
          'clumpy','lumpy','not mixing','not dissolving','doesn\'t mix','won\'t dissolve',
          'hard lumps','too thick','texture different','consistency off','powder not mixing',
          'clumping','settling at bottom','grains','gritty','not smooth','hardened',
          'crystallised','solidified','mixability issue','foam','foamy',
          'lumps in powder','lumps in product','product is lumpy','product is clumpy',
          'difficult to mix','wont mix','wont dissolve','not dissolving well',
          'product hardened','solidified product','changed texture','texture has changed',
          'grainy texture','watery texture','too watery','too thick','very thick',
          'consistency different','texture issue','powder is hard','tub is hard'
        ]
      },
      {
        name: 'Colour / Appearance Change',
        patterns: [
          'discoloration','discoloured','colour changed','color changed','looks different',
          'turned yellow','turned brown','turned black','white spots','dark spots',
          'streaks','powder looks different','cream looks off','different color than usual',
          'appearance different','looks weird','discolored product','color change',
          'product has changed color','product color is different','product looks different',
          'discoloured','yellowish','brownish','unusual color','strange color','wrong color',
          'different shade','colour is off','product changed appearance'
        ]
      },
      {
        name: 'Contamination (Foreign Object / Particle)',
        patterns: [
          'foreign object','foreign particle','foreign matter',hair found','Hair strand',
          'plastic piece inside','metal piece','stone inside','thread found','glass piece',
          'black particle','white particle','unknown substance','something inside',
          'contaminated','unsafe','not safe','impurity found','found something in',
          'particle found','dust inside','dirt inside','sand inside','stone in product',
          'plastic in product','metal in product','Hair in product','something floating',
          'foreign body','unidentified particle','strange particle','black dot','black dots',
          'brown particle','grey particle','white particle','debris inside'
        ]
      },
      {
        name: 'Quantity Shortage (Inside Sealed Pack)',
        patterns: [
          'quantity less','quantity short','less quantity','short quantity','fewer tablets',
          'fewer gummies','gummies less','tablets missing','capsules missing',
          'only 40 gummies in 60','bottle not full','tub not full','less powder',
          'weight less','underfilled','half filled','count wrong','not 60','not 30',
          'less than mentioned','lesser quantity','quantity low','not enough tablets',
          'tablets count wrong','gummies count wrong','capsules count wrong',
          'product weight less','less than labelled','short filled','not as per weight',
          'underweight','quantity doesn\'t match','count doesn\'t match','missing tablets',
          'only received','pack has less','less in pack','fewer than expected'
        ]
      },
      {
        name: 'Mould / Fungus Visible',
        patterns: [
          'mould','mold','mould visible','fungus','fungal growth','white layer',
          'white fuzzy','green spots','black spots on product','mildew',
          'fungus on gummies','fungus on product','white growth','product has mould',
          'mould spots','moldy','mouldy','fungal','slight mould','few mould spots',
          'light mould','small mould','traces of mould','surface mould',
          'gummies have mould','tablets have mould','powder has mould'
        ]
      },
      {
        name: 'Expired / Stale / Spoiled Product',
        patterns: [
          'expired','stale','spoiled','rotten','gone bad','product spoiled',
          'tastes expired','smells expired','quality degraded','product is bad',
          'not usable','cannot consume','product is off','completely spoiled',
          'gone stale','kharab ho gaya product','product has gone bad',
          'product is expired','product deteriorated','not fit for consumption',
          'bad product quality','quality is poor','product quality is bad',
          'product is degraded'
        ]
      }
    ]
  },
  {
    name: 'Infestation',
    priority: 5,
    subBuckets: [
      {
        name: 'Worms / Larvae / Maggots',
        patterns: [
          'worm','worms','larva','larvae','maggot','maggots','grub','grubs',
          'caterpillar','white worm','black worm','small worm','moving worm',
          'live worm','dead worm','worm found','found worm','worm inside',
          'kida','kide','keeda','keede','kira','keeda mila','kida nikla',
          'moth larvae','thread worm','tiny worm','small creature','maggot found',
          'worms in product','larvae in product','found worms','worms inside powder',
          'worms in gummies','worms in tablets','worms in capsules'
        ]
      },
      {
        name: 'Insects / Ants / Flies / Beetles / Other Bugs',
        patterns: [
          'bug','bugs','insect','insects','ant','ants','red ant','black ant',
          'cockroach','roach','beetle','weevil','fly','flies','fruit fly',
          'mosquito','gnat','moth','spider','mite','flea','termite',
          'chiti','cheenti','makhi','makkhi','machhar','bug found','insect found',
          'found insect','Insect inside','dead bug','live bug','dead insect',
          'living insect','small bug','tiny insect','beetles in','ants in product',
          'found a bug','found bugs','Insects in powder','bugs in product'
        ]
      },
      {
        name: 'Rodents / Other Creatures',
        patterns: [
          'rat','rats','mouse','mice','rodent','rodents','chuha','chooha','chuhe',
          'rat found','mouse found','rat inside','rodent inside','rat droppings',
          'mouse droppings','gnawed','chewed','frog','frog inside','snake',
          'bird','creature inside','living thing found','animal inside','creature found'
        ]
      },
      {
        name: 'Severe Mould / Fungal Infestation (Active Growth)',
        patterns: [
          'full of mould','mould everywhere','mold all over','completely mouldy',
          'product covered with fungus','fungus growing','active mould','mould spreading',
          'severe fungus','white mould everywhere','black mould inside','product is mouldy',
          'can\'t use heavily moulded','heavily infested with mould','covered in mould',
          'entire product has mould','product completely mouldy','mould all over product'
        ]
      }
    ]
  },
  {
    name: 'Product Performance',
    priority: 6,
    subBuckets: [
      {
        name: 'No Effect / Not Working / Ineffective',
        patterns: [
          'no effect','no result','not working','doesn\'t work','didn\'t work',
          'no improvement','no change','no benefit','ineffective','useless',
          'waste of money','no visible result','not helping','false claims',
          'overpromised','not as described','not as expected','kaam nahi kiya',
          'koi fayda nahi','result nahi aaya','bekaar product','product doesn\'t work',
          'not effective','no difference','no visible difference','no visible improvement',
          'not giving results','no growth','no benefit seen','not working at all',
          'completely useless','did not work','didn\'t see any result',
          'product is not working','not satisfied with results','zero effect',
          'not helping at all','worked for a while then stopped'
        ]
      },
      {
        name: 'Skin Reaction / Allergic Reaction',
        patterns: [
          'rash','skin rash','itching','itchy','irritation','redness','burning sensation',
          'burning skin','swelling','swollen','hives','pimples after using','breakout',
          'blisters','peeling skin','eczema worsened','allergic reaction','skin reaction',
          'side effect on skin','laal ho gaya','khujli','jalan','laal padi',
          'skin burned','skin peeling','acne breakout','skin is burning','redness on skin',
          'skin became red','developed rash','allergic to product','skin allergy',
          'contact dermatitis','skin irritation','skin inflammation','skin sensitivity',
          'caused breakout','broke out','breaking out','skin is itching','skin turned red',
          'burning after applying','irritating skin','face burning','face itching'
        ]
      },
      {
        name: 'Digestive / Gut Reaction',
        patterns: [
          'nausea','nauseous','vomiting','vomited','stomach pain','stomach ache',
          'upset stomach','loose motion','diarrhea','loose stool','constipation',
          'bloating','bloated','gas','acidity','acid reflux','stomach cramps',
          'indigestion','digestive issue','ulti','pet dard','ulti ho gayi',
          'dast','diarrhea ho gaya','stomach upset','gut issue','digestive problem',
          'had to vomit','felt like vomiting','stomach discomfort','bowel issues',
          'gastrointestinal','felt nauseous after','threw up','got diarrhea',
          'caused acidity','caused gas','caused bloating','stomach is upset'
        ]
      },
      {
        name: 'Hair / Scalp Adverse Reaction',
        patterns: [
          'hair fall increased','more hair loss after using','hair fall worse',
          'scalp irritation','scalp burning','scalp itching','itchy scalp',
          'scalp redness','dandruff increased','Hair breakage','hair damage from product',
          'baal jhad rahe','scalp me jalan','scalp me khujli','hair thin ho gaye',
          'hair thinning after use','more hair fall','Hair fall after using',
          'hair loss increased','scalp is burning','scalp is itching',
          'caused hair fall','hair fell more','increased hair shedding',
          'scalp became irritated','dandruff after using','hair became thin',
          'hair became dry after','hair damaged after using'
        ]
      },
      {
        name: 'General Physical Reaction (Systemic)',
        patterns: [
          'dizziness','dizzy','lightheaded','faint','fainting','headache','Head pain',
          'weakness','weak feeling','tired','fatigue','drowsy','chest pain',
          'breathing difficulty','breathing issue','throat swelling','medical emergency',
          'consulted doctor','went to hospital','food poisoning symptoms','chakkar',
          'kamzori','saans lene mein dikkat','got dizzy','feeling weak',
          'feeling tired after','extreme fatigue','hospital','doctor visit',
          'shortness of breath','difficulty breathing','heart palpitation',
          'felt faint','lost consciousness','severe reaction','anaphylaxis'
        ]
      },
      {
        name: 'Product Not Suitable / Sensitivity',
        patterns: [
          'not suitable','didn\'t suit','doesn\'t suit','not for my skin','not for me',
          'skin type mismatch','too strong for me','too harsh','not suitable for sensitive skin',
          'suit nahi kiya','mujhe suit nahi hua','meri skin ke liye nahi',
          'not for my hair type','too oily for me','too drying','not compatible',
          'doesn\'t agree with me','not matching my skin','too strong','too gentle',
          'doesn\'t suit my skin','product is too harsh','product is too strong',
          'not working for my skin type'
        ]
      }
    ]
  },
  {
    name: 'Technical Issue',
    priority: 7,
    subBuckets: [
      {
        name: 'Website / App Error',
        patterns: [
          'website error','app error','app crash','app not loading','website not opening',
          'page not loading','site down','checkout page error','error message on app',
          'app is slow','website not working','server Error','website crash',
          'app crashed','website is down','app keeps crashing','error on website',
          'website error page','not able to open app','app not opening'
        ]
      },
      {
        name: 'Payment / Transaction Issue',
        patterns: [
          'payment failed','payment failure','transaction failed','amount deducted',
          'money deducted','order not placed but amount deducted','charged twice',
          'double charge','wrong amount charged','cod issue','cod not collected',
          'coupon not applied','discount not applied','promo not applied',
          'refund pending','refund not credited','payment issue','payment problem',
          'money got deducted','debited but order not placed','charged multiple times',
          'extra charged','overcharged','amount debited','wrong charge',
          'refund not received','refund not processed'
        ]
      },
      {
        name: 'Order Placement / Checkout Issue',
        patterns: [
          'can\'t place order','unable to place order','order not placed','checkout error',
          'checkout not working','order confirmation not received','order not going through',
          'add to cart not working','unable to checkout','order page error','cart issue',
          'checkout problem','order placement failed','can\'t complete order',
          'order not confirmed','confirmation not received','unable to order'
        ]
      },
      {
        name: 'Account / Login Issue',
        patterns: [
          'can\'t login','login issue','forgot password','can\'t access account',
          'account locked','address not updating','profile update error',
          'name change issue','billing address wrong','account not found',
          'otp not received for login','account issue','login problem',
          'can\'t sign in','unable to login','password issue','account locked out',
          'account not working','otp issue','sign in problem'
        ]
      }
    ]
  }
]

// ─── TEXT NORMALIZATION ────────────────────────────────────────────────────
function normalizeText(text) {
  if (!text || typeof text !== 'string') return ''
  return text
    .toLowerCase()
    .replace(/[^\w\s\u0900-\u097F]/g, ' ') // keep Hindi Unicode chars
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── COMMON HINGLISH / MISSPELLING CORRECTIONS ────────────────────────────
const CORRECTIONS = {
  'recieved': 'received',
  'deliverd': 'delivered',
  'packging': 'packaging',
  'packagng': 'packaging',
  'prodcut': 'product',
  'prodect': 'product',
  'prduct': 'product',
  'damge': 'damage',
  'damagd': 'damaged',
  'brodken': 'broken',
  'brocken': 'broken',
  'borken': 'broken',
  'leeking': 'leaking',
  'leacking': 'leaking',
  'spiled': 'spilled',
  'nahi': 'not',
  'milta': 'received',
  'mila': 'received',
  'aya': 'arrived',
  'tuta': 'broken',
  'toot': 'broken',
  'phata': 'torn',
  'toota': 'broken',
  'kharab': 'bad',
  'kida': 'worm',
  'keeda': 'insect',
  'badbu': 'bad smell',
  'jalan': 'burning',
  'khujli': 'itching',
  'chakkar': 'dizziness'
}

function applyCorrections(text) {
  let corrected = text
  for (const [wrong, right] of Object.entries(CORRECTIONS)) {
    const regex = new RegExp(`\\b${wrong}\\b`, 'gi')
    corrected = corrected.replace(regex, right)
  }
  return corrected
}

// ─── MAIN CLASSIFICATION FUNCTION ──────────────────────────────────────────
export function classifyVOC(vocText) {
  if (!vocText || String(vocText).trim() === '') {
    return { bucket: 'Other', subBucket: 'Other' }
  }

  // Step 1: Normalize
  let normalized = normalizeText(String(vocText))

  // Step 2: Apply corrections for misspellings / Hinglish
  normalized = applyCorrections(normalized)

  // Step 3: Try each bucket in priority order
  for (const bucket of BUCKET_DEFS) {
    for (const subBucket of bucket.subBuckets) {
      for (const pattern of subBucket.patterns) {
        if (normalized.includes(pattern.toLowerCase())) {
          return {
            bucket: bucket.name,
            subBucket: subBucket.name
          }
        }
      }
    }
  }

  // Step 4: No match
  return { bucket: 'Other', subBucket: 'Other' }
}

// ─── BATCH CLASSIFY ───────────────────────────────────────────────────────
export function classifyBatch(rows) {
  return rows.map(row => classifyVOC(row.voc || row.detailedVOC || ''))
}

// ─── GET BUCKET LIST ──────────────────────────────────────────────────────
export function getBucketList() {
  return BUCKET_DEFS.map(b => b.name)
}

export function getSubBucketList(bucketName) {
  const bucket = BUCKET_DEFS.find(b => b.name === bucketName)
  return bucket ? bucket.subBuckets.map(s => s.name) : []
}

export function getAllBucketsWithSubBuckets() {
  return BUCKET_DEFS.map(b => ({
    name: b.name,
    subBuckets: b.subBuckets.map(s => s.name)
  }))
}
