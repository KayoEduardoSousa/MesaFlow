# MesaFlow — Implantação

## Requisitos básicos

- Node.js LTS
- npm
- projeto Supabase configurado
- variáveis de ambiente no frontend
- acesso ao ambiente do banco e autenticação

## Variáveis do frontend

Arquivo `.env.local`:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_PUBLICA
```

## Execução local

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Observações

- a aplicação atual está em modo auditoria quando o Supabase não está configurado
- a autenticação real, RLS e dados administrativos dependem das chaves e do banco configurados
- produção deve ser feita em ambiente dedicado com políticas e monitoramento
