/**
 * Deep TON — Backend (server.js)
 * Express + MySQL2 + Multer + Axios + Ollama SSE
 */

require("dotenv").config();
const express  = require("express");
const cors     = require("cors");
const multer   = require("multer");
const mysql    = require("mysql2/promise");
const axios    = require("axios");
const FormData = require("form-data");
const path     = require("path");

/* ── Config ── */
const PORT             = process.env.PORT            || 3000;
const CLOUDMERSIVE_KEY = process.env.CLOUDMERSIVE_KEY;
const CLOUDMERSIVE_URL = "https://api.cloudmersive.com/virus/scan/file";
const OLLAMA_URL       = process.env.OLLAMA_URL      || "http://localhost:11434/api/generate";
const OLLAMA_MODEL     = process.env.OLLAMA_MODEL    || "phi3";

/* ── Banco de dados ── */
const pool = mysql.createPool({
  host:               process.env.DB_HOST     || "localhost",
  port:               process.env.DB_PORT     || 3306,
  user:               process.env.DB_USER     || "root",
  password:           process.env.DB_PASSWORD || "",
  database:           process.env.DB_NAME     || "deepton",
  waitForConnections: true,
  connectionLimit:    10,
});
  
/* ── App ── */
const app    = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* ──────────────────────────────────────────────────────────
   POST /api/scan
   Recebe arquivo → chama Cloudmersive via axios → salva MySQL
────────────────────────────────────────────────────────── */
app.post("/api/scan", upload.single("inputFile"), async (req, res) => {
  if (!req.file) return res.status(400).json({ erro: "Nenhum arquivo enviado." });

  const { originalname, size, mimetype, buffer } = req.file;

  try {
    const form = new FormData();
    form.append("inputFile", buffer, { filename: originalname, contentType: mimetype });

    const cvRes = await axios.post(CLOUDMERSIVE_URL, form, {
      headers: { ...form.getHeaders(), Apikey: CLOUDMERSIVE_KEY },
    });

    const cvData = cvRes.data;

    let resultado      = "inconclusivo";
    let totalDeteccoes = 0;
    let virus          = [];

    if (cvData.CleanResult === true) {
      resultado = "limpo";
    } else if (cvData.CleanResult === false && cvData.FoundViruses?.length > 0) {
      resultado      = "infectado";
      totalDeteccoes = cvData.FoundViruses.length;
      virus          = cvData.FoundViruses.map(v => v.VirusName);
    }

    const [insert] = await pool.execute(
      `INSERT INTO varreduras (nome_arquivo, tamanho_bytes, tipo_arquivo, resultado, total_deteccoes, detalhes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [originalname, size, mimetype || "desconhecido", resultado, totalDeteccoes, JSON.stringify(cvData)]
    );
    const varreduraId = insert.insertId;

    if (virus.length > 0) {
      const values = virus.map(nome => [varreduraId, nome]);
      await pool.query("INSERT INTO virus_encontrados (varredura_id, nome_virus) VALUES ?", [values]);
    }

    res.json({
      id: varreduraId,
      resultado,
      totalDeteccoes,
      virus,
      detalhes: cvData.ContentInformation?.RelevantSubfileName || "",
    });

  } catch (err) {
    const msg = err.response
      ? `Cloudmersive HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}`
      : err.message;
    console.error("[SCAN ERROR]", msg);
    res.status(500).json({ erro: msg });
  }
});

/* ──────────────────────────────────────────────────────────
   GET /api/scan/:id/explain  (SSE)
   Streaming do Ollama → salva explicação no banco ao final
────────────────────────────────────────────────────────── */
app.get("/api/scan/:id/explain", async (req, res) => {
  const varreduraId = parseInt(req.params.id);

  const [rows] = await pool.execute(
    "SELECT nome_virus FROM virus_encontrados WHERE varredura_id = ?",
    [varreduraId]
  );

  if (rows.length === 0)
    return res.status(404).json({ erro: "Nenhum vírus associado a esta varredura." });

  const nomes = rows.map(r => r.nome_virus).join(", ");

  const prompt = `Você é um assistente amigável que explica ameaças de segurança de forma simples e tranquila para pessoas sem conhecimento técnico.
Um antivírus detectou: ${nomes}
Responda apenas em português, seguindo esta estrutura:
1: O que é: Explique de forma simples o que é esse tipo de vírus (1 frase).
2: Riscos: Diga calmamente os principais males que ele pode causar (1-2 frases).
3: O que fazer: Oriente os próximos passos imediatos e seguros (1-2 frases).
Tom calmo e reconfortante, como se estivesse ajudando um amigo preocupado.`.trim();

  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");

  let textoCompleto = "";

  try {
    const ollamaRes = await axios.post(
      OLLAMA_URL,
      { model: OLLAMA_MODEL, prompt, stream: true, options: { temperature: 0 } },
      { responseType: "stream" }
    );

    ollamaRes.data.on("data", chunk => {
      for (const line of chunk.toString().split("\n").filter(l => l.trim())) {
        try {
          const json = JSON.parse(line);
          if (json.response) {
            textoCompleto += json.response;
            res.write(`data: ${JSON.stringify({ token: json.response })}\n\n`);
          }
          if (json.done) {
            pool.execute(
              `INSERT INTO explicacoes_ia (varredura_id, texto, modelo) VALUES (?, ?, ?)
               ON DUPLICATE KEY UPDATE texto = VALUES(texto), gerado_em = NOW()`,
              [varreduraId, textoCompleto, OLLAMA_MODEL]
            );
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
            res.end();
          }
        } catch { }
      }
    });

    ollamaRes.data.on("error", err => {
      res.write(`data: ${JSON.stringify({ erro: err.message })}\n\n`);
      res.end();
    });

  } catch (err) {
    console.error("[EXPLAIN ERROR]", err.message);
    res.write(`data: ${JSON.stringify({ erro: err.message })}\n\n`);
    res.end();
  }
});

/* ──────────────────────────────────────────────────────────
   GET /api/historico — últimas 50 varreduras
────────────────────────────────────────────────────────── */
app.get("/api/historico", async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT v.id, v.nome_arquivo, v.tamanho_bytes, v.tipo_arquivo,
             v.resultado, v.total_deteccoes, v.data_varredura,
             GROUP_CONCAT(ve.nome_virus SEPARATOR ', ') AS virus_encontrados,
             LEFT(e.texto, 200) AS resumo_ia
      FROM varreduras v
      LEFT JOIN virus_encontrados ve ON ve.varredura_id = v.id
      LEFT JOIN explicacoes_ia     e  ON e.varredura_id  = v.id
      GROUP BY v.id
      ORDER BY v.data_varredura DESC
      LIMIT 50
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* ──────────────────────────────────────────────────────────
   DELETE /api/historico/:id
────────────────────────────────────────────────────────── */
app.delete("/api/historico/:id", async (req, res) => {
  try {
    await pool.execute("DELETE FROM varreduras WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* ── Start ── */
app.listen(PORT, () => console.log(`\n🛡️  Deep TON rodando em http://localhost:${PORT}\n`));
