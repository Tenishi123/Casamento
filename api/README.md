# API do casamento

API REST em .NET Minimal API com EF Core e SQLite. O banco `wedding.db` é criado
automaticamente na primeira execução, em qualquer ambiente. O Swagger
fica disponível em `http://localhost:5000/swagger` (ou na porta exibida pelo
Kestrel).

## Criar o banco manualmente

O schema SQLite está disponível em [`database.sql`](./database.sql). Para criar
o banco e as tabelas:

```bash
cd api
sqlite3 wedding.db ".read database.sql"
```

Os valores de `Attendance` são `0` (`Pending`), `1` (`Attending`) e `2`
(`NotAttending`). Valores de data e hora devem ser gravados em formato ISO 8601.

## Executar

```bash
cd api
dotnet restore
dotnet run
```

Configure a conexão SQLite em `appsettings.json` ou em
`ConnectionStrings__DefaultConnection`. As origens CORS do Vite ficam em
`Cors:AllowedOrigins` (por padrão `http://localhost:5173` e
`http://127.0.0.1:5173`).

## Logs

A API grava logs no console e em arquivos diários dentro de `api/logs`, por
exemplo `api-.20260919.log`. Os arquivos são mantidos por 30 dias. O caminho
pode ser alterado em `Logging:FilePath` no `appsettings.json` ou por variável de
ambiente:

```powershell
$env:Logging__FilePath = "C:\caminho\dos\logs\api-.log"
```

## Endpoints

- `GET /api/rsvps` e `GET /api/rsvps/{id}` — listar/consultar confirmações.
- `POST /api/rsvps` — criar confirmação.
- `PUT /api/rsvps/{id}` — atualizar confirmação.
- `GET /api/gifts` e `GET /api/gifts/{id}` — listar presentes e contribuições.
  Cada presente informa `isReserved`, `reservedBy` e `isAvailable`; presentes
  reservados não ficam disponíveis novamente.
- `POST /api/gifts` — cadastrar um presente.
- `POST /api/gifts/{id}/reserve` — reservar um presente uma única vez.
  Recebe `contributorName` e, opcionalmente, `message`; retorna `409 Conflict`
  se o presente já estiver reservado.
- `POST /api/gifts/{id}/contributions` — endpoint legado que registra uma
  contribuição e também reserva o presente (uma única vez).

Para produção, crie o banco com [`database.sql`](./database.sql), use migrations
(`dotnet ef database update`) em vez de `EnsureCreated` e defina uma origem CORS
explícita.
