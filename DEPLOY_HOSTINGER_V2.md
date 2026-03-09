# Deploy Hostinger - v2.sistema-atividades.com.br

Ultima atualizacao: 2026-03-09

## Objetivo

Publicar este projeto somente no destino vinculado a `v2.sistema-atividades.com.br`, sem afetar outros sistemas no mesmo servidor.

## Mapeamento confirmado

- Projeto local: `c:\Users\guilh\OneDrive\Documentos\Desenvolvimento\Sistema de Organização\system-adapt-now`
- Build do frontend: `vite build`
- Saida do build: `dist/`
- O projeto atual nao possui configuracao de deploy para Hostinger dentro do repositorio.
- O dominio `v2.sistema-atividades.com.br` resolve para o IP `72.60.57.196`.
- O dominio responde com `nginx/1.24.0 (Ubuntu)`.
- O site atual servido nesse subdominio e um build estatico Vite na raiz do dominio.
- Acesso de rede confirmado:
  - `22/tcp` aberto
  - `443/tcp` aberto
  - `21/tcp` fechado
  - `65002/tcp` fechado
- SSH validado com:
  - host: `72.60.57.196`
  - usuario: `root`
- Configuracao nginx confirmada:
  - arquivo: `/etc/nginx/sites-available/v2-sistema.conf`
  - root publicado: `/var/www/v2-sistema-atividades`
- HTML atualmente publicado referencia:
  - `/assets/index-hYc-pC4G.js`
  - `/assets/index-B7UhHBdj.css`
- Nao foi encontrada nesta maquina:
  - configuracao em `~/.ssh/config`
  - perfil local de WinSCP
  - perfil local de FileZilla
  - historico local claro com comando de deploy para esse host

## O que ainda falta confirmar

- Metodo de acesso ao servidor:
- SSH na porta `22` e o meio mais provavel
- Usuario de acesso SSH
- Caminho remoto exato do subdominio `v2.sistema-atividades.com.br`
- Estrategia de backup do build atualmente publicado

## Tentativas realizadas

- Tentativa de autenticacao via SSH com:
  - host: `72.60.57.196`
  - usuario: `root`
  - metodo: senha
- Resultado:
  - autenticacao bem-sucedida com a senha corrigida

## Deploy executado

- Data/hora do deploy: `2026-03-09 03:39` BRT
- Estrategia:
  - upload do pacote do `dist`
  - extracao em diretorio temporario
  - backup completo do site atual
  - troca do diretorio publicado
  - validacao do nginx
- Backup criado em:
  - diretorio: `/var/www/deploy-backups/v2-sistema-atividades-20260309-033939-dir`
  - tarball: `/var/www/deploy-backups/v2-sistema-atividades-20260309-033939-predeploy.tar.gz`
- Validacoes pos-deploy:
  - `nginx -t`: ok
  - `systemctl reload nginx`: executado
  - `https://v2.sistema-atividades.com.br`: retornando o novo `index.html`
  - `https://v2.sistema-atividades.com.br/assets/index-hYc-pC4G.js`: HTTP `200`

## Observacoes

- O `nginx -t` emitiu warnings de `protocol options redefined` em outros arquivos de configuracao (`new-system.conf` e `redirects-www.conf`), mas a configuracao ficou valida e isso nao bloqueou o deploy deste subdominio.

## WWW do v2

- DNS confirmado para `www.v2.sistema-atividades.com.br` apontando para `72.60.57.196`.
- Ajustes aplicados no servidor:
  - `server_name` atualizado em `/etc/nginx/sites-available/v2-sistema.conf`
  - hosts ativos:
    - `v2.sistema-atividades.com.br`
    - `www.v2.sistema-atividades.com.br`
  - bloco `80` redirecionando para `https://$host$request_uri`
- Certificado renovado/expandido com SAN para:
  - `v2.sistema-atividades.com.br`
  - `www.v2.sistema-atividades.com.br`
- Expiracao do certificado atual: `2026-06-07`

## Validacoes do `www.v2`

- `http://www.v2.sistema-atividades.com.br` responde `301` para HTTPS
- `https://www.v2.sistema-atividades.com.br` responde `200`
- DNS publico confirmado:
  - `www.v2.sistema-atividades.com.br -> 72.60.57.196` via `1.1.1.1`
  - `www.v2.sistema-atividades.com.br -> 72.60.57.196` via `8.8.8.8`
- Observacao operacional:
  - a resolucao DNS local desta maquina ainda pode retornar `NXDOMAIN` pelo resolvedor padrao do Windows/ISP
  - nesse caso, o servidor ja esta correto e a pendencia restante e propagacao/cache de DNS no cliente ou no provedor

## Regras de seguranca para este deploy

- Nao publicar nada antes de identificar o caminho remoto exato do subdominio.
- Fazer backup do `index.html` atual e da pasta `assets/` do destino antes de sobrescrever.
- Validar que o caminho remoto pertence ao `v2.sistema-atividades.com.br` e nao ao dominio principal nem a outro subdominio.
- Manter historico deste arquivo sempre que uma nova informacao de deploy for confirmada.

## Proximo passo

Identificar a credencial ou mecanismo de acesso atualmente usado nesta maquina para publicar no servidor `72.60.57.196`.
