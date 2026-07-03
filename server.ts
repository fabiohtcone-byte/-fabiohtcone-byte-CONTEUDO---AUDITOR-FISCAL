import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { requireAuth, AuthRequest } from "./src/middleware/auth.js";
import { db } from "./src/db/index.js";
import { subjects, topics, userProgress, dailyStudyPlan, subjectMaterials } from "./src/db/schema.js";
import multer from 'multer';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
import { eq, and, asc, desc, lt, gte } from 'drizzle-orm';
import { format } from "date-fns";

let ai: GoogleGenAI | null = null;
try {
  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  } else {
    console.warn("GEMINI_API_KEY is missing, AI tutor will not work.");
  }
} catch (error) {
  console.error("Error initializing GoogleGenAI:", error);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Use auth middleware for API routes (except maybe health check if we had one)
  const upload = multer({ storage: multer.memoryStorage() });

  app.post("/api/subjects/:id/materials", requireAuth, upload.single('file'), async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const subjectId = parseInt(req.params.id);
      if (isNaN(subjectId)) {
        return res.status(400).json({ error: 'Invalid subject ID' });
      }

      // Parse PDF
      const pdfData = await pdfParse(req.file.buffer);
      const textContent = pdfData.text;

      // Save to database
      await db.insert(subjectMaterials).values({
        subjectId,
        fileName: req.file.originalname,
        content: textContent,
      });

      res.json({ success: true, message: 'Material uploaded successfully' });
    } catch (e: any) {
      console.error("PDF upload error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/subjects/:id/materials", requireAuth, async (req: AuthRequest, res) => {
    try {
      const subjectId = parseInt(req.params.id);
      const materials = await db.query.subjectMaterials.findMany({
        where: eq(subjectMaterials.subjectId, subjectId),
        columns: {
          id: true,
          fileName: true,
          createdAt: true
        }
      });
      res.json(materials);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/syllabus", requireAuth, async (req: AuthRequest, res) => {
    try {
      const allSubjects = await db.query.subjects.findMany({
        with: {
          topics: true,
        },
      });
      res.json(allSubjects);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/progress", requireAuth, async (req: AuthRequest, res) => {
    try {
      const progress = await db.query.userProgress.findMany({
        where: eq(userProgress.userId, req.dbUser.id),
      });
      res.json(progress);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/progress", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { topicId, masteryLevel } = req.body;
      const existing = await db.query.userProgress.findFirst({
        where: and(eq(userProgress.userId, req.dbUser.id), eq(userProgress.topicId, topicId)),
      });

      if (existing) {
        await db.update(userProgress).set({
          masteryLevel,
          timesStudied: (existing.timesStudied || 0) + 1,
          lastStudiedAt: new Date(),
        }).where(eq(userProgress.id, existing.id));
      } else {
        await db.insert(userProgress).values({
          userId: req.dbUser.id,
          topicId,
          masteryLevel,
          timesStudied: 1,
          lastStudiedAt: new Date(),
        });
      }

      const today = format(new Date(), 'yyyy-MM-dd');
      await db.update(dailyStudyPlan).set({
        completed: true
      }).where(
        and(
          eq(dailyStudyPlan.userId, req.dbUser.id),
          eq(dailyStudyPlan.topicId, topicId),
          eq(dailyStudyPlan.date, today)
        )
      );

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/daily-plan", requireAuth, async (req: AuthRequest, res) => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      let plan = await db.query.dailyStudyPlan.findMany({
        where: and(eq(dailyStudyPlan.userId, req.dbUser.id), eq(dailyStudyPlan.date, today)),
        with: {
          topic: {
            with: { subject: true }
          }
        }
      });

      if (plan.length === 0) {
        // Generate new plan
        // 70% with less knowledge, 30% with more knowledge
        // Less knowledge: < 80% mastery
        const allProgress = await db.query.userProgress.findMany({
          where: eq(userProgress.userId, req.dbUser.id),
        });

        const allTopics = await db.query.topics.findMany();
        const topicToSubjectMap = new Map<number, number>();
        allTopics.forEach((t: any) => topicToSubjectMap.set(t.id as number, t.subjectId as number));

        // Find topics to study. Max 3.
        // 2 low mastery, 1 high mastery for review. Or if none, just pick new ones.
        const lowMasteryIds = allProgress.filter(p => p.masteryLevel < 80).sort((a,b) => a.masteryLevel - b.masteryLevel).map(p => p.topicId);
        const highMasteryIds = allProgress.filter(p => p.masteryLevel >= 80).sort((a,b) => (b.lastStudiedAt?.getTime() || 0) - (a.lastStudiedAt?.getTime() || 0)).map(p => p.topicId);

        let selectedTopicIds: number[] = [];
        let selectedSubjects = new Set<number>();

        // We want 2 low mastery topics, ideally from different subjects
        for (const tid of lowMasteryIds) {
          if (selectedTopicIds.length >= 2) break;
          const sid = topicToSubjectMap.get(tid);
          if (sid && !selectedSubjects.has(sid)) {
            selectedTopicIds.push(tid);
            selectedSubjects.add(sid);
          }
        }
        
        // If we still need low mastery topics but ran out of unique subjects, just add any low mastery
        for (const tid of lowMasteryIds) {
          if (selectedTopicIds.length >= 2) break;
          if (!selectedTopicIds.includes(tid)) {
            selectedTopicIds.push(tid);
            const sid = topicToSubjectMap.get(tid);
            if (sid) selectedSubjects.add(sid);
          }
        }

        // We want 1 high mastery for review, ideally from a different subject
        for (const tid of highMasteryIds) {
          if (selectedTopicIds.length >= 3) break;
          const sid = topicToSubjectMap.get(tid);
          if (sid && !selectedSubjects.has(sid)) {
            selectedTopicIds.push(tid);
            selectedSubjects.add(sid);
            break;
          }
        }
        
        // If we still need a high mastery topic, just add any
        for (const tid of highMasteryIds) {
          if (selectedTopicIds.length >= 3) break;
          if (!selectedTopicIds.includes(tid)) {
            selectedTopicIds.push(tid);
            const sid = topicToSubjectMap.get(tid);
            if (sid) selectedSubjects.add(sid);
            break;
          }
        }

        // Fill remaining with new topics
        if (selectedTopicIds.length < 3) {
          const usedIds = new Set<number>([...lowMasteryIds, ...highMasteryIds, ...selectedTopicIds]);
          const newTopics = allTopics.filter((t: any) => !usedIds.has(t.id as number));
          
          // First pass: try to add new subjects
          for (const t of newTopics) {
            if (selectedTopicIds.length >= 3) break;
            if (!selectedSubjects.has(t.subjectId as number)) {
              selectedTopicIds.push(t.id as number);
              selectedSubjects.add(t.subjectId as number);
              usedIds.add(t.id as number);
            }
          }
          
          // Second pass: just fill up to 3
          for (const t of newTopics) {
            if (selectedTopicIds.length >= 3) break;
            if (!usedIds.has(t.id as number)) {
              selectedTopicIds.push(t.id as number);
              usedIds.add(t.id as number);
            }
          }
        }

        for (const tid of selectedTopicIds) {
          await db.insert(dailyStudyPlan).values({
            userId: req.dbUser.id,
            topicId: tid,
            date: today,
            completed: false,
          });
        }

        plan = await db.query.dailyStudyPlan.findMany({
          where: and(eq(dailyStudyPlan.userId, req.dbUser.id), eq(dailyStudyPlan.date, today)),
          with: {
            topic: {
              with: { subject: true }
            }
          }
        });
      }

      res.json(plan);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/chat", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!ai) {
        return res.status(500).json({ error: 'A chave da API Gemini (GEMINI_API_KEY) não está configurada.' });
      }
      const { messages, topicContext, subjectId } = req.body;
      
      let contextMaterials = '';
      if (subjectId) {
        const materials = await db.query.subjectMaterials.findMany({
          where: eq(subjectMaterials.subjectId, parseInt(subjectId)),
        });
        if (materials.length > 0) {
          contextMaterials = `\nMATERIAL DE REFERÊNCIA DA DISCIPLINA:\n${materials.map(m => `--- Início do Arquivo: ${m.fileName} ---\n${m.content}\n--- Fim do Arquivo ---`).join('\n\n')}\nUtilize este material como base de conhecimento prioritária para responder e ensinar o usuário.\n`;
        }
      }
      
      const systemInstruction = `Você é um Tutor especializado no edital da Receita Federal.
Siga os princípios do LEARN-ANYTHING TUTOR: passo-a-passo, perguntas socráticas, seja didático, e não dê a resposta completa de cara. 
Tópico atual que o usuário está estudando: ${topicContext || 'Geral'}.${contextMaterials}
Lembre-se:
1. Explique passo a passo e use analogias claras.
2. Certifique-se de que o usuário entendeu fazendo uma pergunta rápida no final da sua explicação.
3. Não use jargões sem explicá-los.`;

      const formattedMessages = messages.map((m: any) => ({
        role: m.role === 'tutor' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: formattedMessages,
        config: {
          systemInstruction: systemInstruction,
        }
      });
      
      // We could also try to analyze if the user has mastered the topic based on their answers
      // For simplicity, we can let the user self-report or just increment mastery level on chat

      res.json({ text: response.text });
    } catch (error: any) {
      console.error('Error in /api/chat:', error);
      res.status(500).json({ error: 'Erro ao gerar resposta do tutor. ' + (error.message || '') });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
