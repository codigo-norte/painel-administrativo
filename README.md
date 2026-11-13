# Painel Administrativo

## Sobre o projeto

Este projeto consiste no desenvolvimento de um painel administrativo reutilizável, criado para permitir que proprietários de pequenos negócios gerenciem de forma simples e independente as informações de seus sites.

A proposta é oferecer uma interface intuitiva na qual o cliente possa atualizar conteúdos sem precisar editar diretamente o código-fonte.

## Funcionalidades

O painel tem como objetivo permitir o gerenciamento de:

* Produtos e serviços.
* Categorias.
* Preços.
* Informações comerciais da empresa.
* Imagens e conteúdos visuais.

As informações serão armazenadas em um banco de dados e disponibilizadas para o site público correspondente.

## Tecnologias utilizadas

* HTML5
* CSS3
* JavaScript
* Netlify

## Estrutura do projeto

O projeto está organizado para separar a interface do painel, os estilos e os scripts, facilitando a manutenção e a evolução do código.

## Publicação

O projeto será hospedado na Netlify, com integração ao GitHub para facilitar o controle de versões e a atualização automática da aplicação.

## Desenvolvimento local e banco de dados

O painel usa Netlify Functions para acessar o PostgreSQL por meio de `@netlify/database` e Drizzle ORM. A conexão é lida no servidor pela variável `NETLIFY_DB_URL`. Nunca coloque a URL ou credenciais no JavaScript do navegador, em `netlify.toml` ou em arquivos versionados.

Requisitos: Node.js 22.12 ou posterior, uma conta Netlify com o projeto correto vinculado e acesso ao PostgreSQL.

### Configurar a conexão local

1. Instale as dependências e vincule esta pasta ao projeto correto da Netlify:

   ```powershell
   npm install
   netlify login
   netlify link
   ```

   Se necessário, escolha `painel-adms` no assistente de vínculo.

2. Crie ou abra o arquivo local ignorado pelo Git:

   ```powershell
   if (-not (Test-Path .env)) { New-Item .env -ItemType File }
   notepad .env
   ```

3. No `.env`, defina `NETLIFY_DB_URL` com a URL do PostgreSQL. Salve o arquivo e não o envie ao GitHub. O `.gitignore` já ignora `.env`.

4. Inicie o painel local:

   ```powershell
   npm run dev
   ```

O Netlify CLI pode usar uma base local para desenvolvimento. Não presuma que ela seja a base de produção; confira o destino antes de executar qualquer migração ou teste que grave dados.

### Configurar a produção na Netlify

1. Abra o projeto `painel-adms` no painel da Netlify e acesse **Project configuration → Environment variables**.
2. Adicione `NETLIFY_DB_URL` com a URL nova do PostgreSQL. Defina o contexto de produção e habilite o escopo **Functions**. Se também pretende usar a mesma conexão em deploy previews, configure esse contexto separadamente e confirme que ele deve acessar essa base.
3. Salve a variável e publique um novo deploy de produção. Variáveis de ambiente atualizadas só passam a valer nas Functions após um novo deploy.
4. Confira o deploy e teste a aplicação sem usar dados reais até confirmar conexão, esquema e proteção de acesso.

Não adicione a URL a `netlify.toml`: valores nesse arquivo podem ser versionados e não são disponibilizados às Functions em produção. Para cadastrar a variável pela CLI, vincule primeiro o projeto e use `netlify env:set NETLIFY_DB_URL`; prefira o painel da Netlify para inserir a credencial sem colocá-la no histórico do terminal.

### Migrações e segurança

`npm run db:generate` cria arquivos de migração a partir de alterações aprovadas em `db/schema.ts`; o Drizzle Kit lê a variável do `.env` local. `npm run db:migrate:local` aplica migrações pendentes somente ao banco local do Netlify CLI. Revise as migrações antes de executá-las. Não rode comandos de migração contra produção sem revisão e backup apropriados.

As migrações em `netlify/database/migrations` são aplicadas automaticamente no ciclo de deploy quando o projeto usa o Netlify Database provisionado. Se `NETLIFY_DB_URL` apontar para uma base PostgreSQL externa, não presuma que esse ciclo aplique o esquema nela; confirme o mecanismo e o destino da migração antes de qualquer alteração.

A migração `site-visits` adiciona apenas a tabela diária `site_visits`; ela não foi aplicada a nenhum banco. `POST /.netlify/functions/visits` registra uma page view por chamada, em UTC, sem gravar IP ou identificador de visitante. O gráfico consulta `GET /.netlify/functions/visits?days=7|30|90` com sessão administrativa. Para contar acessos ao site público, inclua nele o script abaixo e substitua o domínio pelo endereço publicado deste projeto:

```html
<script defer src="https://SEU-DOMINIO-DA-NETLIFY/js/visit-tracker.js"></script>
```

O contador não identifica visitantes únicos nem filtra bots; chamadas repetidas são contadas como page views. A migração precisa ser aplicada ao banco correto antes de a Function de estatísticas ser usada.

## Segurança antes da publicação

O login usa Netlify Identity. Antes de publicar, habilite Identity nas configurações do site, desative o cadastro público ou restrinja-o a convites e conceda o papel administrativo `admin` somente à conta autorizada. A tela de login não oferece cadastro.

As leituras públicas de produtos, categorias, empresa e imagens são servidas pelas Netlify Functions, sem acesso ao banco pelo navegador. `GET /.netlify/functions/products` retorna apenas produtos ativos; `GET /.netlify/functions/categories` retorna somente categorias vinculadas a produtos ativos; `GET /.netlify/functions/company` retorna os campos do perfil da empresa; `GET /.netlify/functions/images` lista URLs públicas e `GET /.netlify/functions/images?id=<uuid>` entrega a imagem. Essas rotas aceitam leitura pública e CORS, mas não incluem os dados da conta administrativa.

As operações de cadastro, edição e exclusão continuam protegidas no servidor pelo papel `admin` e validam a origem nas requisições que alteram dados. As leituras completas de produtos e categorias também são administrativas e usam `?view=admin`. A gravação das page views é pública e não aceita dados pessoais; a consulta do gráfico exige `admin`. O envio (`POST`) e a exclusão (`DELETE`) de imagens exigem `admin`. Imagens aceitas: JPEG, PNG, WebP e GIF de até 4 MB; todo arquivo enviado fica disponível publicamente. Chamadas administrativas sem sessão recebem `401`; contas sem o papel `admin` recebem `403`. A conta pessoal permanece protegida. O painel local também precisa do Netlify Identity disponível via `netlify dev`.

O cliente do Identity é empacotado em `js/auth.bundle.js` pelo comando de build; esse arquivo gerado é ignorado pelo Git e produzido em `npm run build` e antes de `npm run dev`. Configure Identity na Netlify antes de usar a aplicação: sem esse serviço e sem a função `admin` atribuída à conta do proprietário, o acesso é negado.

Dados que já existam no `localStorage` de um navegador não são importados automaticamente para o PostgreSQL.

## Objetivo

Desenvolver uma solução administrativa simples, acessível e reutilizável, permitindo que diferentes pequenos negócios tenham autonomia para atualizar seus próprios sites.

## Desenvolvedora

**Evelyn Góis**

Estudante de Engenharia de Software | Desenvolvedora Web em formação.
