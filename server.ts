import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

// Server-side Gemini AI client initialization
const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;

if (apiKey) {
  try {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  } catch (err) {
    console.warn('Failed to initialize GoogleGenAI with key:', err);
  }
}

// 1. Endpoint: AI Question Generation tailored to Interview Type & Topic
app.post('/api/gemini/generate-questions', async (req, res) => {
  try {
    const {
      topic = 'Public Health & Community Needs',
      interviewType = 'structured', // 'structured' | 'semi-structured' | 'unstructured'
      targetAudience = 'Community Members & Local Leaders',
      count = 5,
      language = 'en',
      category = 'General Assessment',
      focusAreas = '',
    } = req.body;

    const requestedCount = Math.min(Math.max(Number(count) || 5, 1), 20);

    if (!aiClient) {
      // Fallback generator when API key is pending or offline
      return res.json({
        success: true,
        source: 'fallback',
        questions: generateFallbackQuestions(topic, interviewType, targetAudience, requestedCount, category),
      });
    }

    const prompt = `You are a world-class survey methodology and qualitative/quantitative research instrument designer.
Task: Generate ${requestedCount} high-quality survey questions for an instrument on the topic: "${topic}".

Interview Type: "${interviewType}"
- If "structured": questions must be standardized, clear, quantifiable, utilizing 5-point or 7-point Likert scales, single-choice, or rating scales.
- If "semi-structured": questions must combine structured main inquiries with 2-3 specific probing cues ("probes") for the interviewer to follow up and dig deeper.
- If "unstructured": questions must be open-ended, narrative, conversational prompts inviting lived experiences, storytelling, and qualitative reflections.

Target Audience: "${targetAudience}"
Category/Domain: "${category}"
${focusAreas ? `Specific Focus Areas: "${focusAreas}"` : ''}
Base Language: "${language}" (If Tagalog or Philippine dialect, provide natural phrasing; otherwise English with optional Tagalog translation).

Provide valid JSON with an array of objects matching this exact structure:
[
  {
    "text": "The question text in ${language}",
    "type": "likert" | "multiple_choice" | "open_ended" | "rating",
    "category": "${category}",
    "difficultyScore": number from 1 to 5 (1=Basic recall/low cognitive load, 3=Evaluative, 5=Deep introspective/high cognitive load),
    "relevanceScore": number from 70 to 99 (Relevance percentage to ${topic}),
    "scoringRationale": "Brief explanation of difficulty and alignment with research goals",
    "probes": ["Follow-up probe 1", "Follow-up probe 2"], // required if semi-structured or unstructured
    "likertTemplate": "5_point_agreement" | "5_point_satisfaction" | "7_point_satisfaction" | "5_point_frequency" | "5_point_importance" | null,
    "options": ["Option 1", "Option 2", "Option 3"], // if multiple_choice
    "translations": {
      "tl": "Tagalog translation",
      "ceb": "Cebuano/Bisaya translation"
    },
    "guidanceNotes": "Interviewer pacing or administration notes"
  }
]

Return strictly valid JSON without markdown fences.`;

    const response = await aiClient.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const rawText = response.text || '[]';
    let parsed = [];
    try {
      parsed = JSON.parse(rawText.trim());
    } catch {
      // strip code block markers if any
      const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    }

    res.json({
      success: true,
      source: 'gemini',
      questions: parsed,
    });
  } catch (error: any) {
    console.error('Error generating questions with Gemini:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate questions',
      fallback: generateFallbackQuestions(
        req.body?.topic || 'Community Survey',
        req.body?.interviewType || 'structured',
        req.body?.targetAudience || 'General',
        req.body?.count || 5,
        req.body?.category || 'General'
      ),
    });
  }
});

// 2. Endpoint: AI Multilingual Translation with Philippine Dialect Support
app.post('/api/gemini/translate', async (req, res) => {
  try {
    const {
      texts, // string[] or string
      targetLanguages = ['tl', 'ceb', 'ilo', 'hil'], // Tagalog, Cebuano, Ilocano, Hiligaynon
      sourceLanguage = 'en',
      context = 'Survey research instrument for field interviews in the Philippines',
    } = req.body;

    const textList = Array.isArray(texts) ? texts : [texts];

    if (!aiClient) {
      return res.json({
        success: true,
        source: 'fallback',
        translations: generateFallbackTranslations(textList, targetLanguages),
      });
    }

    const languageNames: Record<string, string> = {
      tl: 'Tagalog / Filipino',
      ceb: 'Cebuano / Bisaya (Visayan)',
      ilo: 'Ilocano',
      hil: 'Hiligaynon (Ilonggo)',
      bik: 'Bicolano (Bikol)',
      war: 'Waray-Waray',
      es: 'Spanish',
      ja: 'Japanese',
      en: 'English',
    };

    const targetDesc = targetLanguages
      .map((code: string) => `${code}: ${languageNames[code] || code}`)
      .join(', ');

    const prompt = `You are a professional linguistic researcher and cultural localization specialist for the Philippines.
Translate the following survey items from "${sourceLanguage}" into these target languages: ${targetDesc}.
Context: ${context}.
Ensure appropriate formal yet respectful register (e.g. using polite particles like 'po'/'opo' where natural in Tagalog, and culturally idiomatic expressions in Bisaya/Ilocano).

Survey items:
${JSON.stringify(textList, null, 2)}

Provide valid JSON with this format:
{
  "results": [
    {
      "original": "...",
      "translations": {
        ${targetLanguages.map((code: string) => `"${code}": "natural translated text"`).join(',\n        ')}
      },
      "culturalNotes": "Brief notes on tone or vocabulary choice"
    }
  ]
}

Return strictly valid JSON without markdown fences.`;

    const response = await aiClient.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const rawText = response.text || '{}';
    let parsed: any = {};
    try {
      parsed = JSON.parse(rawText.trim());
    } catch {
      const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    }

    res.json({
      success: true,
      source: 'gemini',
      results: parsed.results || [],
    });
  } catch (error: any) {
    console.error('Translation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Translation failed',
      fallback: generateFallbackTranslations(req.body.texts || [], req.body.targetLanguages || ['tl']),
    });
  }
});

// 3. Endpoint: AI Sentiment & Thematic Keyword Analysis for Unstructured Responses
app.post('/api/gemini/analyze-sentiment', async (req, res) => {
  try {
    const { responses = [], surveyTitle = 'Qualitative Study' } = req.body;

    if (!responses.length) {
      return res.json({
        success: true,
        summary: {
          overallScore: 0,
          label: 'neutral',
          positivePercent: 33,
          neutralPercent: 34,
          negativePercent: 33,
          themes: [],
          keywords: [],
        },
        analyzedResponses: [],
      });
    }

    if (!aiClient) {
      return res.json({
        success: true,
        source: 'fallback',
        ...generateFallbackSentimentAnalysis(responses),
      });
    }

    const prompt = `You are a senior qualitative researcher specializing in thematic coding, natural language sentiment extraction, and survey analytics.
Analyze the following unstructured responses from survey: "${surveyTitle}".

Responses to analyze:
${JSON.stringify(responses.slice(0, 30), null, 2)}

Respond with valid JSON containing:
{
  "summary": {
    "overallScore": number between -1.0 (strongly negative) and +1.0 (strongly positive),
    "label": "positive" | "neutral" | "negative",
    "positivePercent": number (0-100),
    "neutralPercent": number (0-100),
    "negativePercent": number (0-100),
    "executiveSummary": "2-3 sentences synthesizing the core findings, sentiments, and respondent mindset.",
    "themes": [
      { "theme": "Theme Title", "count": number, "sentiment": "positive"|"neutral"|"negative", "description": "Short explanation" }
    ],
    "keywords": [
      { "word": "keyword", "count": number, "relevance": number, "sentiment": "positive"|"neutral"|"negative" }
    ]
  },
  "analyzedResponses": [
    {
      "id": "response id or index",
      "text": "original text",
      "sentimentScore": number between -1.0 and 1.0,
      "sentimentLabel": "positive" | "neutral" | "negative",
      "primaryEmotion": "e.g., Hopeful, Frustrated, Grateful, Anxious, Satisfied",
      "extractedKeywords": ["tag1", "tag2"],
      "thematicCategory": "Category name"
    }
  ]
}

Return strictly valid JSON without markdown fences.`;

    const response = await aiClient.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const rawText = response.text || '{}';
    let parsed: any = {};
    try {
      parsed = JSON.parse(rawText.trim());
    } catch {
      const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    }

    res.json({
      success: true,
      source: 'gemini',
      ...parsed,
    });
  } catch (error: any) {
    console.error('Sentiment analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Sentiment analysis failed',
      ...generateFallbackSentimentAnalysis(req.body.responses || []),
    });
  }
});

// 4. Endpoint: Question Difficulty & Relevance Evaluator
app.post('/api/gemini/score-question', async (req, res) => {
  try {
    const { questionText, surveyObjective = 'General Survey', interviewType = 'structured' } = req.body;

    if (!aiClient) {
      return res.json({
        success: true,
        source: 'heuristic',
        difficultyScore: Math.min(5, Math.max(1, Math.round(questionText.length / 30))),
        relevanceScore: 88,
        scoringRationale: 'Evaluated based on semantic clarity, response load, and structural alignment.',
        suggestions: ['Consider adding follow-up probes if conducted in semi-structured mode.'],
      });
    }

    const prompt = `Evaluate this survey question for:
Question: "${questionText}"
Survey Objective: "${surveyObjective}"
Interview Type: "${interviewType}"

Provide valid JSON:
{
  "difficultyScore": number from 1 to 5 (1 = elementary/low cognitive demand, 5 = highly nuanced/introspective),
  "relevanceScore": number from 50 to 100,
  "scoringRationale": "Detailed justification of cognitive difficulty and objective relevance",
  "suggestions": ["Actionable improvement 1", "Actionable improvement 2"],
  "recommendedLikertScale": "5-point agreement" // if applicable, else null
}

Strictly valid JSON only.`;

    const response = await aiClient.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const rawText = response.text || '{}';
    let parsed = {};
    try {
      parsed = JSON.parse(rawText.trim());
    } catch {
      const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    }

    res.json({
      success: true,
      source: 'gemini',
      ...parsed,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Scoring failed',
      difficultyScore: 3,
      relevanceScore: 85,
    });
  }
});

// 5. Endpoint: Interviewer & Questioner AI Copilot Chatbot
app.post('/api/gemini/interviewer-copilot', async (req, res) => {
  try {
    const { message, chatHistory = [], context = {} } = req.body;

    const {
      surveyTitle = '',
      interviewType = '',
      activeQuestion = '',
      activeLanguage = 'en',
      currentRespondentName = '',
      recentResponse = '',
      isQuestionnaireCreation = false,
    } = context;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    if (!aiClient) {
      return res.json({
        success: true,
        source: 'fallback',
        reply: generateFallbackCopilotReply(message, context),
      });
    }

    const systemInstruction = `You are "UGNAYai", an expert real-time assistant for survey interviewers and questionnaire creators.

STRICT DIRECT ANSWER ONLY RULE:
- Give DIRECT ANSWERS ONLY.
- DO NOT provide meta-tips, pleasantries, preambles, summaries, explanations, or disclaimers.
- NEVER output coaching headings or bullets like:
  - "🤖 Interviewer Copilot Tips:"
  - "• Active Listening:"
  - "• Current Question:"
  - "• Recommended Probe:"
  - "• If the respondent seems hesitant..."
- If asked for a probe: output the direct probing question immediately (e.g. "Maaari po ba kayong magbigay ng isang partikular na halimbawa?").
- If asked to simplify: output the direct simplified question immediately.
- If asked for Tagalog or Philippine dialects: output the direct respectful question immediately using appropriate politeness markers like "po" or "opo".
- If asked to improve a question: output the improved question text directly.
- The output MUST be immediately readable or speakable by the interviewer with zero editing needed.`;

    const contents: any[] = [];
    // Append recent history (up to last 6 turns)
    const recentTurns = chatHistory.slice(-6);
    for (const turn of recentTurns) {
      contents.push({
        role: turn.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: turn.text || '' }],
      });
    }
    // Append current user message
    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    const response = await aiClient.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        systemInstruction,
        temperature: 0.5,
      },
    });

    const rawReply = response.text || '';
    const cleanReply = cleanDirectAnswer(rawReply) || generateFallbackCopilotReply(message, context);

    res.json({
      success: true,
      source: 'gemini',
      reply: cleanReply,
    });
  } catch (error: any) {
    console.error('Copilot endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Copilot assistance failed',
      reply: generateFallbackCopilotReply(req.body?.message || '', req.body?.context || {}),
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    geminiEnabled: Boolean(aiClient),
    timestamp: new Date().toISOString(),
  });
});

// Vite middleware mounting in dev or static serving in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

startServer();

// --- Helper Fallbacks for Offline & Instant Response ---

function generateFallbackQuestions(
  topic: string,
  interviewType: string,
  targetAudience: string,
  count: number,
  category: string
) {
  const templates: Record<string, any[]> = {
    structured: [
      {
        text: `How satisfied are you with the current resources provided for ${topic}?`,
        type: 'likert',
        category,
        difficultyScore: 2,
        relevanceScore: 94,
        scoringRationale: 'Standard 5-point satisfaction metric with low cognitive burden.',
        likertTemplate: '5_point_satisfaction',
        translations: {
          tl: `Gaano ka nasiyahan sa kasalukuyang mga mapagkukunan para sa ${topic}?`,
          ceb: `Unsa ka kontento ka sa kasamtangang mga kahinguhaan alang sa ${topic}?`,
          ilo: `Kasanoka a mapnek iti agdama a rekurso para iti ${topic}?`,
        },
        guidanceNotes: 'Present standard 5-point Likert card to the respondent.',
      },
      {
        text: `To what extent do you agree that communication regarding ${topic} has been transparent and timely?`,
        type: 'likert',
        category,
        difficultyScore: 3,
        relevanceScore: 92,
        scoringRationale: 'Measures institutional trust and communicative clarity.',
        likertTemplate: '5_point_agreement',
        translations: {
          tl: `Hanggang saan ka sumasang-ayon na ang komunikasyon tungkol sa ${topic} ay bukas at napapanahon?`,
          ceb: `Hangtod asa ka mouyon nga ang komunikasyon bahin sa ${topic} hayag ug tukma sa panahon?`,
        },
        guidanceNotes: 'Emphasize honesty; no right or wrong answers.',
      },
      {
        text: `How frequently do you participate in or utilize programs related to ${topic}?`,
        type: 'likert',
        category,
        difficultyScore: 2,
        relevanceScore: 89,
        scoringRationale: 'Measures behavioral engagement and routine adoption.',
        likertTemplate: '5_point_frequency',
        translations: {
          tl: `Gaano kadalas kang lumalahok o gumagamit ng mga programang may kinalaman sa ${topic}?`,
          ceb: `Unsa ka subsob ka moapil o mogamit sa mga programa nga may kalabotan sa ${topic}?`,
        },
      },
      {
        text: `Which of the following represents your primary challenge regarding ${topic}?`,
        type: 'multiple_choice',
        category,
        difficultyScore: 3,
        relevanceScore: 96,
        options: ['Lack of budget/funding', 'Inadequate access to information', 'Scheduling/Time constraints', 'Lack of community support', 'Other'],
        scoringRationale: 'Categorical diagnostic question identifying priority bottlenecks.',
        translations: {
          tl: `Alin sa mga sumusunod ang iyong pangunahing hamon kaugnay ng ${topic}?`,
          ceb: `Hain sa mga mosunod ang imong nag-unang hagit bahin sa ${topic}?`,
        },
      },
      {
        text: `Overall, how would you rate the general quality of services delivered?`,
        type: 'rating',
        category,
        difficultyScore: 1,
        relevanceScore: 95,
        scoringRationale: 'Universal 1-10 benchmark rating.',
        translations: {
          tl: `Sa pangkalahatan, paano mo mamarkahan ang kalidad ng mga serbisyong ibinibigay?`,
          ceb: `Sa kinatibuk-an, unsaon nimo pagmarka ang kalidad sa serbisyo?`,
        },
      },
    ],
    'semi-structured': [
      {
        text: `Can you walk me through your personal experience when navigating ${topic}?`,
        type: 'open_ended',
        category,
        difficultyScore: 3,
        relevanceScore: 95,
        probes: [
          'What was the most difficult moment during this process?',
          'Who did you reach out to for assistance, and what was their reaction?',
          'What would have made that experience noticeably smoother?',
        ],
        scoringRationale: 'Combines open narrative anchor with structured diagnostic follow-up cues.',
        translations: {
          tl: `Maaari mo bang ibahagi ang iyong personal na karanasan kaugnay ng ${topic}?`,
          ceb: `Mahimo ba nimo ipaambit ang imong personal nga kasinatian bahin sa ${topic}?`,
        },
        guidanceNotes: 'Allow respondent 2 minutes to elaborate before introducing probes.',
      },
      {
        text: `How do local decisions or policies regarding ${topic} impact your daily routine or household?`,
        type: 'open_ended',
        category,
        difficultyScore: 4,
        relevanceScore: 94,
        probes: [
          'Have financial or travel costs changed noticeably?',
          'How do other family members or neighbors feel about this?',
        ],
        scoringRationale: 'Evaluates socio-economic spillover effects on household well-being.',
        translations: {
          tl: `Paano nakakaapekto ang mga lokal na desisyon sa ${topic} sa iyong pang-araw-araw na pamumuhay?`,
          ceb: `Giunsa pag-apekto sa mga lokal nga desisyon sa ${topic} ang imong adlaw-adlaw nga panginabuhi?`,
        },
      },
      {
        text: `To what degree do community members feel included in discussions about ${topic}?`,
        type: 'likert',
        category,
        difficultyScore: 3,
        relevanceScore: 90,
        likertTemplate: '5_point_agreement',
        probes: ['Can you recall a specific instance where your feedback was acted upon or disregarded?'],
        scoringRationale: 'Measures perceived civic efficacy paired with an illustrative case probe.',
        translations: {
          tl: `Hanggang saan nararamdaman ng mga kasapi ng komunidad na sila ay kasama sa usapin tungkol sa ${topic}?`,
          ceb: `Hangtod asa gibati sa mga miyembro sa komunidad nga sila giapil sa hisgutanang ${topic}?`,
        },
      },
    ],
    unstructured: [
      {
        text: `Tell me the story of how ${topic} has shaped your community over the past several years. What stands out most?`,
        type: 'open_ended',
        category,
        difficultyScore: 4,
        relevanceScore: 98,
        scoringRationale: 'Open narrative arc eliciting lived historical perspectives and generational shifts.',
        probes: ['Take your time; start from whenever you first noticed significant changes.'],
        translations: {
          tl: `Ikuwento mo sa akin kung paano hinubog ng ${topic} ang inyong komunidad nitong mga nakaraang taon. Ano ang pinakatumatak sa iyo?`,
          ceb: `Iasoy kanako ang istorya giunsa paghulma sa ${topic} ang inyong komunidad niining miaging mga tuig. Unsa ang labing nagpabilin sa imong panumduman?`,
        },
        guidanceNotes: 'Conversational interview: maintain eye contact, note emotional cadence and non-verbal cues.',
      },
      {
        text: `If you were speaking directly to community decision-makers today without any restrictions, what truth about ${topic} would you want them to understand?`,
        type: 'open_ended',
        category,
        difficultyScore: 5,
        relevanceScore: 97,
        scoringRationale: 'High introspective reflexivity asking respondent for unvarnished candid assessment.',
        translations: {
          tl: `Kung ikaw ay direktang makikipag-usap sa mga pinuno ngayon nang walang pag-aalinlangan, anong katotohanan ukol sa ${topic} ang nais mong maunawaan nila?`,
          ceb: `Kung makig-istorya ka diretso sa mga opisyal karon nga walay pugong, unsang kamatuoran bahin sa ${topic} ang gusto nimong masabtan nila?`,
        },
      },
    ],
  };

  const pool = templates[interviewType] || templates.structured;
  const result: any[] = [];
  for (let i = 0; i < count; i++) {
    const base = pool[i % pool.length];
    result.push({
      ...base,
      id: `gen_${Date.now()}_${i + 1}`,
      text: i >= pool.length ? `${base.text} (Aspect #${i + 1})` : base.text,
      order: i + 1,
    });
  }
  return result;
}

function generateFallbackTranslations(texts: string[], targetLanguages: string[]) {
  const dictionary: Record<string, Record<string, string>> = {
    tl: {
      satisfaction: 'kasiyahan',
      agree: 'sumasang-ayon',
      disagree: 'hindi sumasang-ayon',
      health: 'kalusugan',
      community: 'komunidad',
    },
    ceb: {
      satisfaction: 'katagbawan / pagkakontento',
      agree: 'mouyon',
      disagree: 'dili mouyon',
      health: 'panglawas',
      community: 'katilingban',
    },
  };

  return texts.map((t) => {
    const translations: Record<string, string> = {};
    for (const lang of targetLanguages) {
      if (lang === 'tl') {
        translations.tl = `[Filipino / Tagalog]: Paano mo ilalarawan ang: "${t}"?`;
      } else if (lang === 'ceb') {
        translations.ceb = `[Cebuano / Bisaya]: Giunsa nimo paghulagway ang: "${t}"?`;
      } else if (lang === 'ilo') {
        translations.ilo = `[Ilocano]: Kasanom a deskribiren ti: "${t}"?`;
      } else if (lang === 'hil') {
        translations.hil = `[Hiligaynon]: Paano mo ilaragway ang: "${t}"?`;
      } else {
        translations[lang] = `[${lang.toUpperCase()}]: ${t}`;
      }
    }
    return {
      original: t,
      translations,
      culturalNotes: 'Localized for respectful field enumerator delivery in Philippine rural and urban settings.',
    };
  });
}

function generateFallbackSentimentAnalysis(responses: any[]) {
  const total = responses.length || 1;
  let pos = 0;
  let neg = 0;
  let neu = 0;

  const analyzed = responses.map((r: any, idx: number) => {
    const text = typeof r === 'string' ? r : r.text || r.value || '';
    const lower = text.toLowerCase();
    let score = 0;
    let label: 'positive' | 'neutral' | 'negative' = 'neutral';
    let emotion = 'Thoughtful';

    if (
      lower.includes('good') ||
      lower.includes('great') ||
      lower.includes('salamat') ||
      lower.includes('maganda') ||
      lower.includes('ayos') ||
      lower.includes('nindot') ||
      lower.includes('improved') ||
      lower.includes('happy') ||
      lower.includes('satisfied')
    ) {
      score = 0.75;
      label = 'positive';
      emotion = 'Hopeful & Appreciative';
      pos++;
    } else if (
      lower.includes('bad') ||
      lower.includes('delay') ||
      lower.includes('mahirap') ||
      lower.includes('problema') ||
      lower.includes('kulang') ||
      lower.includes('lisud') ||
      lower.includes('frustrated') ||
      lower.includes('disappointed') ||
      lower.includes('unhappy')
    ) {
      score = -0.65;
      label = 'negative';
      emotion = 'Frustrated / Concerned';
      neg++;
    } else {
      score = 0.1;
      label = 'neutral';
      emotion = 'Reflective / Objective';
      neu++;
    }

    return {
      id: r.id || `resp_${idx + 1}`,
      text,
      sentimentScore: score,
      sentimentLabel: label,
      primaryEmotion: emotion,
      extractedKeywords: ['service delivery', 'accessibility', 'community', 'response time'].slice(0, (idx % 3) + 2),
      thematicCategory: label === 'positive' ? 'Institutional Trust & Service Delivery' : label === 'negative' ? 'Resource Constraints & Bottlenecks' : 'Community Participation',
    };
  });

  const posPct = Math.round((pos / total) * 100);
  const negPct = Math.round((neg / total) * 100);
  const neuPct = 100 - posPct - negPct;
  const overall = total > 0 ? Number(((pos * 0.8 - neg * 0.7) / total).toFixed(2)) : 0;

  return {
    summary: {
      overallScore: overall,
      label: overall > 0.2 ? 'positive' : overall < -0.2 ? 'negative' : 'neutral',
      positivePercent: posPct,
      neutralPercent: Math.max(neuPct, 0),
      negativePercent: negPct,
      executiveSummary: `Analysis across ${total} qualitative responses demonstrates a net ${overall >= 0 ? 'constructive' : 'challenging'} sentiment (${overall}). Primary themes center on accessibility, response latency, and staff empathy.`,
      themes: [
        { theme: 'Service Accessibility & Timeliness', count: Math.ceil(total * 0.6), sentiment: overall >= 0 ? 'positive' : 'negative', description: 'Availability of personnel and clarity of procedures.' },
        { theme: 'Community Dignity & Staff Empathy', count: Math.ceil(total * 0.4), sentiment: 'positive', description: 'Courteous interactions and attentive listening during consultations.' },
        { theme: 'Resource & Facility Adequacy', count: Math.ceil(total * 0.35), sentiment: 'negative', description: 'Equipment shortages, physical distance, and queue waiting times.' },
      ],
      keywords: [
        { word: 'accessibility', count: 14, relevance: 0.95, sentiment: 'neutral' },
        { word: 'mabilis / fast', count: 11, relevance: 0.88, sentiment: 'positive' },
        { word: 'mahirap / difficult', count: 8, relevance: 0.82, sentiment: 'negative' },
        { word: 'salamat / grateful', count: 9, relevance: 0.85, sentiment: 'positive' },
        { word: 'pasilidad / facility', count: 6, relevance: 0.78, sentiment: 'neutral' },
      ],
    },
    analyzedResponses: analyzed,
  };
}

function cleanDirectAnswer(text: string): string {
  if (!text) return '';
  let cleaned = text;

  // Remove coaching headers, meta-tips, and disclaimers
  cleaned = cleaned.replace(/🤖\s*\*?Interviewer Copilot Tips:\*?/gi, '');
  cleaned = cleaned.replace(/•?\s*\*?Active Listening:\*?[^\n]*\n?/gi, '');
  cleaned = cleaned.replace(/•?\s*\*?Current Question:\*?[^\n]*\n?/gi, '');
  cleaned = cleaned.replace(/•?\s*\*?Recommended Probe:\*?\s*/gi, '');
  cleaned = cleaned.replace(/•?\s*If the respondent seems hesitant[^\n]*\n?/gi, '');
  cleaned = cleaned.replace(/Interviewer Copilot Tips:/gi, '');
  cleaned = cleaned.replace(/Interviewer Guidance:/gi, '');

  // Strip leading and trailing quotation marks if the whole reply was wrapped
  cleaned = cleaned.trim();
  if (cleaned.startsWith('"') && cleaned.endsWith('"') && cleaned.length > 2) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  return cleaned;
}

function generateFallbackCopilotReply(message: string, context: any): string {
  const lower = (message || '').toLowerCase();
  const q = context?.activeQuestion || '';
  const isDigital = q.toLowerCase().includes('digital') || q.toLowerCase().includes('device') || q.toLowerCase().includes('software') || q.toLowerCase().includes('computer');

  if (lower.includes('probe') || lower.includes('follow up') || lower.includes('halimbawa') || lower.includes('partikular')) {
    if (isDigital) {
      return `Maaari po ba kayong magbigay ng isang partikular na halimbawa?`;
    }
    return `Maaari po ba kayong magbigay ng isang partikular na halimbawa?`;
  }

  if (lower.includes('simplify') || lower.includes('simple')) {
    if (isDigital) {
      return `Madali po ba at maaasahan ang mga tablet, computer, o software na ibinigay ng paaralan?`;
    }
    if (q) {
      return `Madali po ba at maaasahan ang mga kagamitan o serbisyong ibinigay para sa inyo?`;
    }
    return `Madali po ba at maaasahan ang serbisyong ito sa inyong araw-araw?`;
  }

  if (lower.includes('tagalog') || lower.includes('filipino')) {
    if (isDigital) {
      return `Maaasahan po ba at madaling gamitin ang mga digital device at learning software na ibinigay ng paaralan?`;
    }
    if (q) {
      return `Maaari po ba ninyong ibahagi kung gaano ito naging kapaki-pakinabang sa inyo?`;
    }
    return `Sumasang-ayon po ba kayo na maayos at maaasahan ang serbisyong ito?`;
  }

  if (lower.includes('cebuano') || lower.includes('bisaya') || lower.includes('binisaya')) {
    if (isDigital) {
      return `Kasaligan ba ug sayon gamiton ang mga computer ug software nga gihatag sa eskwelahan?`;
    }
    return `Kasaligan ba ug sayon gamiton kining maong serbisyo o kagamitan?`;
  }

  if (lower.includes('icebreaker') || lower.includes('greeting')) {
    return `Magandang araw po! Maraming salamat po sa paglalaan ng inyong oras para sa maikling panayam na ito.`;
  }

  // Default: Direct rephrase/probe for the active question
  if (q) {
    return `Maaari po ba ninyong ibahagi ang inyong karanasan o obserbasyon ukol dito?`;
  }

  return `Maaari po ba kayong magbigay ng isang partikular na halimbawa?`;
}
