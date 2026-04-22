-- ============================================================
-- Deep TON — Schema do Banco de Dados [cite: 6, 79]
-- ============================================================

CREATE DATABASE IF NOT EXISTS deepton
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE deepton;

--  Registro principal de cada scan realizado 
CREATE TABLE IF NOT EXISTS varreduras (
  id                INT           AUTO_INCREMENT PRIMARY KEY,
  nome_arquivo      VARCHAR(255)  NOT NULL,
  tamanho_bytes     BIGINT        NOT NULL,
  tipo_arquivo      VARCHAR(100)  DEFAULT 'desconhecido',
  resultado         ENUM('limpo', 'infectado', 'inconclusivo') NOT NULL,
  total_deteccoes   INT           DEFAULT 0,
  detalhes          TEXT,                        
  data_varredura    DATETIME      DEFAULT CURRENT_TIMESTAMP
);

--  Cada vírus detectado em uma varredura 
CREATE TABLE IF NOT EXISTS virus_encontrados (
  id            INT          AUTO_INCREMENT PRIMARY KEY,
  varredura_id  INT          NOT NULL,
  nome_virus    VARCHAR(255) NOT NULL,
  CONSTRAINT fk_virus_varredura
    FOREIGN KEY (varredura_id)
    REFERENCES varreduras(id)
    ON DELETE CASCADE [cite: 82]
);

--  Explicações geradas pelo Ollama (phi3)
CREATE TABLE IF NOT EXISTS explicacoes_ia (
  id            INT      AUTO_INCREMENT PRIMARY KEY,
  varredura_id  INT      NOT NULL UNIQUE,
  texto         TEXT     NOT NULL,
  modelo        VARCHAR(50)  DEFAULT 'phi3',
  gerado_em     DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ia_varredura
    FOREIGN KEY (varredura_id)
    REFERENCES varreduras(id)
    ON DELETE CASCADE [cite: 82]
);

-- View para consulta de histórico consolidado 
CREATE OR REPLACE VIEW vw_historico AS
SELECT
  v.id,
  v.nome_arquivo,
  ROUND(v.tamanho_bytes / 1024, 1)  AS tamanho_kb,
  v.tipo_arquivo,
  v.resultado,
  v.total_deteccoes,
  GROUP_CONCAT(ve.nome_virus SEPARATOR ', ') AS virus_encontrados,
  LEFT(e.texto, 120)                AS resumo_ia,
  v.data_varredura
FROM varreduras v
LEFT JOIN virus_encontrados ve ON ve.varredura_id = v.id
LEFT JOIN explicacoes_ia     e  ON e.varredura_id  = v.id
GROUP BY v.id
ORDER BY v.data_varredura DESC;
